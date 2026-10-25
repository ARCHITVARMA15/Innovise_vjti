"""Bounded persisted automation, paused for explicit human fact confirmation."""
import asyncio
import hashlib
import json
import re
from datetime import date
from decimal import Decimal
from uuid import uuid4
from fastapi import HTTPException
from app.research.store import now
from app.research.financial_store import FinancialStore
from app.research.financial_models import FactInput, CalculationRequest
from app.research.calculations import SPECS, calculate
from app.research.analysis_models import AnalysisStart
from app.research.analysis_store import AnalysisStore
from app.research.extraction import extract_upload
from .network import SecClient, RetrievalError
from .sec import SecProvider, parse_html, prepare_records, clean, fiscal_end
from .sources import import_source
from .store import AutomationStore, encode

TERMINAL={'awaiting_review','completed','partial','blocked','needs_input','cancelled','interrupted','failed'}
RUNTIME=240


def years_for(request):
    query=request['query'];years=sorted(set(int(y) for y in re.findall(r'(?<!\d)(20\d{2})(?!\d)',query)))
    questions=[]
    if not years or len(years)>2:questions=['Which one or two fiscal years should this annual 10-K comparison cover? Start a query with explicit FY years.']
    elif min(years)<2010 or max(years)>date.fromisoformat(request['as_of_date']).year:questions=['Choose fiscal years from 2010 through the research-as-of year.']
    basis=request.get('year_basis')
    if not basis:
        if re.search(r'\b(?:calendar|CY)\b',query,re.I):basis='calendar'
        elif re.search(r'\b(?:FY\s*20\d{2}|fiscal|annual|10-K)\b',query,re.I):basis='fiscal'
    if basis=='calendar':questions=['This slice retrieves fiscal-year SEC 10-Ks. Use fiscal years instead, or use the manual workflow for calendar-year aggregation.']
    elif not basis and years:questions=['Interpret the requested year(s) as fiscal years? This slice does not aggregate calendar-year financials.']
    if len(years)==1:years=[years[0]-1,years[0]]
    return years,questions


def basis_for(document):
    expressions=r'(?:in conformity with|in accordance with)\s+(?:accounting principles generally accepted in the United States(?: of America)?|U\.?S\.?\s+GAAP)'
    alltext=' '.join(p['text'] for p in document['pages'])
    if not re.search(r'consolidated\s+(?:financial|statements|balance)',alltext,re.I):return None,[]
    for page in document['pages']:
        match=re.search(expressions,page['text'],re.I)
        if match:
            return 'consolidated US GAAP',[{'document_id':document['id'],'section_id':page['id'],'start':match.start(),'end':match.end(),'excerpt':match[0]}]
    return None,[]

class AutomationManager:
    def __init__(self,research,analysis_manager,client_factory=SecClient):
        self.store=AutomationStore(research);self.analysis=analysis_manager;self.client_factory=client_factory;self.tasks={}
    def startup(self):self.store.interrupt_active()
    def schedule(self,run,continuation=False):
        if run['id'] in self.tasks:return run
        if len(self.tasks)>=2:raise HTTPException(429,'At most two local automation tasks may be active.')
        task=asyncio.create_task(self.execute(run['case_id'],run['id'],continuation));self.tasks[run['id']]=task
        task.add_done_callback(lambda _:self.tasks.pop(run['id'],None));return run
    async def stage(self,run,name,message,operation):
        latest=self.store.get(run['case_id'],run['id'])
        if latest['cancel_requested']:raise asyncio.CancelledError()
        run['stage']=name;run['status']='running';self.store.save(run);self.store.event(run,name,'started',message)
        result=await operation()
        self.store.save(run);self.store.event(run,name,'completed',message+' — saved.')
        return result
    async def execute(self,case_id,rid,continuation=False):
        run=self.store.get(case_id,rid);run.pop('events',None)
        client=self.client_factory(self.store.research.directory);provider=SecProvider(client)
        client.requests=run.get('budgets',{}).get('requests',0);client.bytes=run.get('budgets',{}).get('bytes',0)
        try:
            async with asyncio.timeout(RUNTIME):
                if continuation:
                    await self.continue_research(run)
                    return
                run['blockers']=[];run['questions']=[]
                years,questions=years_for(run['request'])
                if not run.get('scope') or not run['scope'].get('entity'):
                    async def resolve():
                        entity,submissions=await asyncio.to_thread(provider.resolve,run['original_query'],run['request'].get('company'))
                        run['scope']={'entity':entity if entity.get('cik') else None,'years':years,'periods':[f'FY{y}' for y in years],
                            'research_as_of_date':run['request']['as_of_date'],'year_basis':'fiscal','requested_metrics':run['request']['metrics'],
                            'default_scope_note':'One specified fiscal year also proposes comparison with the preceding fiscal year. Review the resolved scope before confirmation.'}
                        run['company_choices']=entity.get('company_choices',[])
                        run['questions']=entity.get('questions',[]) or questions
                        if run['scope']['entity'] and not run['questions']:
                            case=self.store.research.get_case(case_id)
                            if not run['created_case'] and clean(case['company_name'])!=clean(entity['name']):run['questions']=['The resolved SEC company differs from this saved case. Start Ask Dexter as a new case; existing case scope was not changed.']
                            else:self.store.resolve_new_case(run)
                        return submissions
                    submissions=await self.stage(run,'scope','Resolving the company using official SEC metadata',resolve)
                else:
                    run['scope'].update(years=years,periods=[f'FY{y}' for y in years]);run['questions']=questions
                    submissions=None
                if run['questions']:
                    run['status']='needs_input';return
                if not run['filings']:
                    async def discover():
                        nonlocal submissions
                        if submissions is None:submissions,_=await asyncio.to_thread(client.json,f'https://data.sec.gov/submissions/CIK{run["scope"]["entity"]["cik"]}.json')
                        filings,decisions,blockers,history=await asyncio.to_thread(provider.discover,run['scope']['entity'],submissions,years,run['request']['as_of_date'])
                        run.update(filings=filings,source_decisions=decisions,blockers=blockers,additional_history=history)
                    await self.stage(run,'discover','Locating exact-report-period 10-Ks and eligible amendments',discover)
                if not run['filings']:raise RetrievalError('No eligible official filings were located. Review company/year/as-of scope or upload a source manually.')
                if any(f.get('amendments') for f in run['filings']):
                    run['status']='blocked';return
                async def ingest_filings():
                    for filing in run['filings']:
                        if any(x['accessionNumber']==filing['accessionNumber'] for x in run['imported_filings']):continue
                        manual=run.get('manual_documents',{}).get(filing['accessionNumber'])
                        meta={}
                        if manual:
                            document=self.store.research.get_document(case_id,manual)
                            if not document.get('publication_date') or document['publication_date']>run['request']['as_of_date']:raise RetrievalError('Manual fallback requires an explicit publication date no later than research-as-of.')
                            if document.get('reporting_period')!=f'FY{filing["requested_year"]}':raise RetrievalError('Manual fallback reporting-period label must match the selected fiscal year.')
                            created=False;manual=True
                        else:
                            raw=await asyncio.to_thread(client.fetch,filing['url'],'filing',604800)
                            if raw['content_type']=='application/pdf':
                                _,pages=extract_upload('official.pdf',raw['data']);kind='pdf'
                            else:pages,meta=parse_html(raw['data']);kind='html'
                            focus=next(iter(meta.get('documentfiscalyearfocus',[])),None)
                            end=next(iter(meta.get('documentperiodenddate',[])),None)
                            if focus and focus!=str(filing['requested_year']):raise RetrievalError(f'10-K declares FY{focus}, not requested FY{filing["requested_year"]}. Fiscal-label exceptions require manual resolution; report-year guessing was rejected.')
                            if end and fiscal_end(end)!=filing['reportDate']:raise RetrievalError('Primary filing fiscal end conflicts with submissions report date.')
                            document,created=await asyncio.to_thread(import_source,self.store.research,case_id,raw,filing['accessionNumber'],
                                f'{run["scope"]["entity"]["name"]} FY{filing["requested_year"]} 10-K',filing['filingDate'],f'FY{filing["requested_year"]}',kind,pages,extra={'filing':filing,'dei':meta})
                        basis,evidence=basis_for(document)
                        record={**filing,'document_id':document['id'],'basis':basis,'basis_evidence':evidence,'dei':meta,'manual_fallback':bool(manual)}
                        run['imported_filings'].append(record);run['document_ids']=list(dict.fromkeys([*run['document_ids'],document['id']]))
                        self.store.save(run);self.store.event(run,'ingest','completed',f'{"Imported" if created else "Reused"} FY{filing["requested_year"]} 10-K with stable citations; no PDF page numbers were invented.')
                await self.stage(run,'fetch_ingest','Fetching and importing official primary filings',ingest_filings)
                if not run.get('preparation_complete'):
                    async def prepare():
                        try:data,raw=await asyncio.to_thread(provider.companyfacts,run['scope']['entity'])
                        except RetrievalError as error:
                            run['record_issues'].append(str(error));raise
                        records=[];issues=[]
                        for filing in run['imported_filings']:
                            chosen,gaps=prepare_records(data,filing,run['scope']['entity'],filing['basis'],filing['basis_evidence']);records.extend(chosen);issues.extend(gaps)
                        run['record_issues'].extend(issues)
                        run['limitations'].append('No general total-debt tag is inferred or derived. Debt/equity is unavailable in this automation slice; use the existing manual Financials workflow with reviewed debt evidence.')
                        if len(records)>30:raise RetrievalError('More than 30 structured candidates; ambiguous coverage requires manual refinement.')
                        if records:
                            pages=[];contexts=[]
                            for index,record in enumerate(records,1):
                                projection={'taxonomy':'us-gaap','tag':record['tag'],'unit':record['unit'],'json_pointer':record['json_pointer'],'entry':record['record']}
                                text=json.dumps(projection,sort_keys=True,ensure_ascii=False,default=str)
                                pages.append({'position':index,'page_number':None,'label':f'XBRL record {index:02d}: {record["metric"]} {record["reporting_period"]}','text':text,'extraction_status':'extracted'})
                                provenance={'kind':'sec_companyfacts','cik':run['scope']['entity']['cik'],'taxonomy':'us-gaap','tag':record['tag'],'unit':record['unit'],
                                    'accession':record['record']['accn'],'json_pointer':record['json_pointer'],'raw_source_url':raw['final_url'],'raw_content_hash':raw['content_hash'],
                                    'retrieved_at':raw['retrieved_at'],'filed':record['record']['filed'],'period_start':record['period_start'],'period_end':record['period_end'],
                                    'fiscal_label':record['reporting_period'],'context':record['record'],'metadata_evidence':record['basis_evidence'],
                                    'method':'Exact-accession, whole-entity standard SEC XBRL context; saved JSON projection, not a PDF excerpt.'}
                                contexts.append({'expected':{k:record.get(k) for k in ('metric','entity','value','currency','scale','reporting_period','period_start','period_end','period_type','accounting_scope')},'provenance':provenance})
                            identity='xbrl:'+run['scope']['entity']['cik']+':'+':'.join(f['accessionNumber'] for f in run['imported_filings'])
                            document,_=await asyncio.to_thread(import_source,self.store.research,case_id,raw,identity,
                                run['scope']['entity']['name']+' — selected SEC XBRL annual contexts',max(f['filingDate'] for f in run['imported_filings']),
                                ' / '.join(run['scope']['periods']),'structured_json',pages,extra={'selected_accessions':[f['accessionNumber'] for f in run['imported_filings']],'as_of':run['request']['as_of_date']},contexts=contexts)
                            run['document_ids']=list(dict.fromkeys([*run['document_ids'],document['id']]))
                            fs=FinancialStore(self.store.research)
                            for record,page in zip(records,document['pages']):
                                values={k:record.get(k) for k in ('metric','entity','value','currency','scale','reporting_period','period_start','period_end','period_type','accounting_scope','ambiguity_note')}
                                fact,_=fs.add_fact(case_id,FactInput(**values,document_id=document['id'],section_id=page['id'],excerpt=page['text'],span_id=f'{page["id"]}:0:{len(page["text"])}',span_start=0,span_end=len(page['text'])),origin='sec_xbrl_automation',extraction=True)
                                if fact['id'] not in run['candidate_ids']:run['candidate_ids'].append(fact['id'])
                            self.store.save(run)
                        if issues:await self.fallback_extraction(run)
                    await self.stage(run,'prepare','Preparing source-linked financial candidates with exact XBRL contexts',prepare)
                    if not run['candidate_ids']:raise RetrievalError('No supported source-linked financial candidates were found. Use manual Financials or explicitly retry source retrieval; no AI fallback was run.')
                    run['preparation_complete']=True
                run['status']='awaiting_review';run['stage']='await_analyst_review'
                self.store.event(run,'review','waiting',f'Prepared {len(run["candidate_ids"])} financial candidates. Explicit analyst confirmation is required before calculations.')
        except asyncio.CancelledError:
            run['status']='cancelled' if self.store.get(case_id,rid)['cancel_requested'] else 'interrupted'
            run['blockers'].append('Stopped between safe stages. Previously saved imports, candidates and results are retained; no automatic crash resume.')
        except (RetrievalError,HTTPException) as error:
            run['status']='blocked';run['blockers'].append(str(error.detail) if isinstance(error,HTTPException) else str(error))
            self.store.event(run,run['stage'],'blocked',run['blockers'][-1])
        except TimeoutError:
            run['status']='interrupted';run['blockers'].append('Automation exceeded its 240-second execution budget. Saved successful stages remain; explicit retry required.')
        except Exception:
            run['status']='failed';run['blockers'].append('Automation could not complete due to an unexpected source/storage validation error. Saved results remain; use manual workflows or retry. No fabricated result was substituted.')
        finally:
            run['budgets'].update(client.budget());run['finished_at']=now();self.store.save(run)
    async def fallback_extraction(self,run):
        run['limitations'].append('Automatic AI fallback is deferred. Missing structured facts require the existing manual Financials workflow.')
    async def continue_research(self,run):
        fs=FinancialStore(self.store.research);facts=[]
        for fid in run['selected_fact_ids']:
            with self.store.research.connection() as db:f=fs._fact(db,run['case_id'],fid)
            if f['revision']!=run['reviewed_revisions'].get(fid) or f['status']!='confirmed' or not f['source_available'] or f['removed_at']:raise HTTPException(409,'A reviewed fact/source changed. Re-review before continuation; earlier receipts/reports remain historical.')
            facts.append(f)
        if not facts:raise HTTPException(409,'Confirm at least one selected candidate before continuing.')
        bases={f['accounting_scope'] for f in facts}
        if len(bases)!=1:raise HTTPException(409,'Selected facts use different accounting bases. Review a single compatible basis before continuing.')
        entity=run['scope']['entity']['name'];periods=run['scope']['periods'];operations=[];coverage=[];receipts=[]
        for tool in run['request']['metrics']:
            for labels in ([periods] if tool=='revenue_growth' else [[p] for p in periods]):
                roles=SPECS[tool][0];inputs={};missing=[]
                for role,metric in roles.items():
                    label=labels[0] if role=='previous' else labels[-1]
                    matching=[f for f in facts if f['metric']==metric and ((f.get('source_snapshot',{}).get('structured_provenance') or {}).get('fiscal_label')==label or f['reporting_period']==label)]
                    if len(matching)!=1:missing.append(metric+' '+label)
                    else:inputs[role]=matching[0]['id']
                if tool=='debt_to_equity' and missing:
                    coverage.append({'tool':tool,'periods':labels,'status':'conditional_unavailable','missing':missing});continue
                operations.append({'calculation_type':tool,'periods':labels})
                if missing:coverage.append({'tool':tool,'periods':labels,'status':'missing','missing':missing});continue
                chosen=[f for f in facts if f['id'] in inputs.values()]
                compatible=[r for r in fs.list_receipts(run['case_id']) if r['status']=='valid' and r['calculation_type']==tool and {k:v['id'] for k,v in r['inputs'].items()}==inputs and all(any(f['id']==v['id'] and f['revision']==v['revision'] for f in facts) for v in r['inputs'].values())]
                receipt=compatible[0] if compatible else calculate(fs,run['case_id'],CalculationRequest(calculation_type=tool,inputs=inputs))
                if receipt['status']=='valid':receipts.append(receipt['id'])
                coverage.append({'tool':tool,'periods':labels,'status':receipt['status'],'receipt_id':receipt['id'],'missing':receipt['warnings']})
        run['coverage']=coverage;run['receipt_ids']=receipts;self.store.save(run)
        incomplete=any(c['status']!='valid' for c in coverage)
        if incomplete and not run.get('allow_partial'):
            run['status']='awaiting_review';run['blockers']=['Requested coverage is incomplete. Review missing inputs or explicitly allow partial continuation.'];return
        if not operations:raise HTTPException(409,'No supported metric operation is available for this selected scope.')
        docs=list(dict.fromkeys([*run['document_ids'],*[f['document_id'] for f in facts]]))
        labels=list(dict.fromkeys([*periods,*[f['reporting_period'] for f in facts]]))
        if len(docs)>10 or len(labels)>8:raise HTTPException(422,'Selected source/label scope exceeds the existing analysis bounds; use fewer inputs.')
        request=AnalysisStart(automation_run_id=run['id'],fact_ids=[f['id'] for f in facts],task_type='simple_metric',entity=entity,periods=labels,accounting_basis=next(iter(bases)),
            research_as_of_date=run['request']['as_of_date'],document_ids=docs,question_override=run['original_query'],calculations=operations,receipt_ids=receipts)
        analysis=self.analysis.start(run['case_id'],request)
        run['analysis_run_id']=analysis['id'];run['stage']='calculate_verify_report';self.store.save(run)
        self.store.event(run,'calculate','completed',f'Saved/bound {len(receipts)} exact calculation receipts; existing verification and draft report workflow started.')
        while analysis['status'] in ('queued','running'):
            if self.store.get(run['case_id'],run['id'])['cancel_requested']:
                child=self.analysis.tasks.get(analysis['id'])
                if child:child.cancel()
                raise asyncio.CancelledError()
            await asyncio.sleep(.2);analysis=self.analysis.store.get(run['case_id'],analysis['id'])
        run['report_id']=(analysis.get('report') or {}).get('report_id')
        run['status']='partial' if incomplete or analysis['status']!='completed' else 'completed'
        run['blockers']=list(dict.fromkeys([*analysis.get('errors',[]),*((analysis.get('financial') or {}).get('needs_input',[]))]))
        run['stage']='draft_report' if run['report_id'] else 'partial_results'
        self.store.event(run,'report','completed' if run['report_id'] else 'partial','Unapproved versioned draft saved; report submission and approval remain separate.' if run['report_id'] else 'Partial receipts/checks preserved; draft report could not be completed. Inspect existing Analysis/Evidence.')
    async def shutdown(self):
        for task in list(self.tasks.values()):task.cancel()
        if self.tasks:await asyncio.gather(*list(self.tasks.values()),return_exceptions=True)
