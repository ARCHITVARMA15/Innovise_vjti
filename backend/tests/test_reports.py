"""Increment 5 acceptance: bounded routing, evidence gating and immutable human review."""
import asyncio
import json
import subprocess
import sys
import unittest
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException
import test_financials as fixtures
from app.research.analysis_manager import AnalysisManager
from app.research.analysis_models import AnalysisStart, AnalysisSnapshot
from app.research.reports import ReportStore, ReportCreate, ReviewRequest, assess_risks
from app.research.verification_store import VerificationStore
from app.research.verification_models import ClaimInput, ClaimMapping, ClaimEdit, VerificationStart, QualitativeAssessment
from app.research.verification_engine import execute_verification
from app.research.analysis_llm import investigation_repairs, ModelCallError
from app.research.financial_models import FactUpdate
from app.research.fact_extraction import parse_response
from app.research.claim_intake import extract_claims


class ReportTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.fixture=fixtures.FinancialTests();self.fixture.setUp()
        self.store=self.fixture.store;self.cid=self.fixture.case['id']
        self.manager=AnalysisManager(self.store);self.manager.startup()
        self.reports=ReportStore(self.store);self.verifier=VerificationStore(self.store)
        self.facts={(metric,year):self.fixture.fact(metric,year) for year in (2024,2025) for metric in fixtures.METRICS}

    async def asyncTearDown(self):
        await self.manager.shutdown();self.fixture.tearDown()

    def request(self,**changes):
        return AnalysisStart.model_validate(dict(task_type='simple_metric',document_ids=[self.fixture.doc['id']],
            entity='Synthetic Fixture Co',accounting_basis='consolidated / synthetic GAAP',periods=['FY2024','FY2025'],research_as_of_date='2025-06-30',
            calculations=[{'calculation_type':'revenue_growth','periods':['FY2024','FY2025']},{'calculation_type':'net_profit_margin','periods':['FY2025']}],**changes))

    async def run_task(self,request=None):
        run=self.manager.store.create(self.cid,request or self.request())
        await self.manager.execute(self.cid,run['id'])
        return self.manager.store.get(self.cid,run['id'])

    def review(self,report,action,**changes):
        return self.reports.review(self.cid,report['id'],ReviewRequest(expected_revision=report['revision'],action=action,
            reviewer_label='Synthetic analyst (not authenticated)',comment='Reviewed selected synthetic evidence and retained limitations.',**changes))

    def claim(self,text='Revenue growth was 25% in FY2025.',**changes):
        values=dict(assertion_type='numerical',target='revenue_growth',entity='Synthetic Fixture Co',asserted_value='25',unit='percent',
            currency='INR',periods=['FY2024','FY2025'],accounting_scope='consolidated / synthetic GAAP',rounding_places=0,temporal_scope='historical')
        values.update(changes)
        return self.verifier.add(self.cid,ClaimInput(text=text,mapping=ClaimMapping(**values),mapping_reviewed=True))

    async def check(self,claim,**changes):
        run=self.verifier.create_run(self.cid,claim['id'],VerificationStart(supporting_document_ids=[self.fixture.doc['id']],**changes))
        return await execute_verification(self.verifier,run)

    async def test_simple_metric_skips_models_and_persists_report(self):
        with patch('app.research.analysis_llm._invoke_research_model',new_callable=AsyncMock) as model:
            run=await self.run_task()
        self.assertEqual(run['status'],'completed',run['errors']);model.assert_not_called()
        skips={e['stage'] for e in run['events'] if e['transition']=='skipped'}
        self.assertTrue({'evidence_retrieval','risk_assessment','qualitative_synthesis'}<=skips)
        report=self.reports.list(self.cid)[0]
        self.assertEqual([r['display_result'] for r in report['metrics'] if r['calculation_type']=='revenue_growth'],['10.00'])
        self.assertTrue(any(r['display_result']=='12.00' for r in report['metrics']))
        self.assertEqual(report['rendering_method'],'deterministic_structured_artifacts')
        self.assertTrue(all(f['verdict']=='supported' for f in report['findings']))
        self.assertEqual(report['state'],'draft')
        with self.assertRaises(HTTPException):self.reports.get(self.fixture.other['id'],report['id'])
        code="from pathlib import Path; from app.research.store import ResearchStore; from app.research.reports import ReportStore; import sys; r=ReportStore(ResearchStore(Path(sys.argv[1]))).list(sys.argv[2]); print(r[0]['id'])"
        output=subprocess.check_output([sys.executable,'-c',code,str(self.fixture.directory),self.cid],text=True)
        self.assertIn(report['id'],output)

    async def test_ambiguous_scope_needs_actionable_input_without_provider(self):
        request=self.request().model_copy(update={'accounting_basis':None,'research_as_of_date':None,'periods':[]})
        # Two bases cannot be silently selected.
        self.fixture.fact('revenue',2025,accounting_scope='standalone')
        with patch('app.research.analysis_planning.structured_call',new_callable=AsyncMock) as model:
            run=await self.run_task(request)
        self.assertEqual(run['status'],'needs_input');model.assert_not_called()
        self.assertTrue(any('accounting_basis' in q for q in run['scope']['questions']))
        self.assertTrue(any('research_as_of_date' in q for q in run['scope']['questions']))
        self.assertIsNone(run['brief'])

    async def test_changes_correction_new_version_approval_and_invalidation(self):
        claim=self.claim();check=await self.check(claim)
        self.assertEqual(check['result']['status'],'contradicted')
        run=await self.run_task();first=self.reports.list(self.cid)[0]
        first=self.review(first,'submit')
        with self.assertRaises(HTTPException):self.review(first,'approve',acknowledge_limitations=True)
        first=self.review(first,'request_correction')
        with self.assertRaises(HTTPException):self.review(first,'approve')
        # Correct reviewed claim through existing Evidence editor contract; reverify a new snapshot.
        mapping=ClaimMapping.model_validate(claim['mapping']).model_copy(update={'asserted_value':'10'})
        edited=self.verifier.edit(self.cid,claim['id'],ClaimEdit(text='Revenue grew 10% in FY2025.',mapping=mapping,mapping_reviewed=True,
            expected_revision=claim['revision'],reason='Correct the misleading synthetic claim against saved calculation.'))
        check2=await self.check(edited,previous_run_id=check['id'])
        self.assertEqual(check2['result']['status'],'supported');self.assertEqual(check2['previous_run_id'],check['id'])
        second=self.reports.create(self.cid,ReportCreate(analysis_run_id=run['id'],predecessor_id=first['id']))
        self.assertEqual(second['version'],2);self.assertEqual(second['predecessor_id'],first['id'])
        second=self.review(second,'submit');second=self.review(second,'approve',acknowledge_limitations=True)
        self.assertTrue(second['current_approval'])
        with self.assertRaises(HTTPException):self.review(second,'comment')
        fact=self.facts['revenue',2025]
        values=self.fixture.input('revenue',2025,value='1200',excerpt='Revenue INR crore 1100')
        self.fixture.financials.update_fact(self.cid,fact['id'],FactUpdate(expected_revision=fact['revision'],values=values,status='candidate',reason='Synthetic analyst correction requiring review'))
        saved=self.reports.get(self.cid,second['id'])
        self.assertTrue(saved['stale']);self.assertFalse(saved['current_approval'])
        self.assertEqual(saved['state'],'approved');self.assertEqual(saved['reviews'][-1]['action'],'approve')
        self.assertEqual(self.reports.get(self.cid,first['id'])['state'],'changes_requested')

    async def test_honestly_limited_approval_dispositions_stale_writes_and_terminal_rejection(self):
        claim=self.claim();await self.check(claim)
        run=await self.run_task();report=self.reports.list(self.cid)[0]
        submitted=self.review(report,'submit')
        with self.assertRaises(HTTPException) as error:self.review(report,'comment')
        self.assertEqual(error.exception.status_code,409)
        with self.assertRaises(HTTPException):self.review(submitted,'approve',dispositions={claim['id']:'retain_as_unresolved'})
        approved=self.review(submitted,'approve',dispositions={claim['id']:'retain_as_unresolved'},acknowledge_limitations=True)
        row=next(f for f in approved['findings'] if f['id']==claim['id'])
        self.assertEqual(row['verdict'],'contradicted');self.assertFalse(row['affirmative_conclusion'])
        new=self.reports.create(self.cid,ReportCreate(analysis_run_id=run['id']))
        rejected=self.review(new,'reject')
        with self.assertRaises(HTTPException):self.review(rejected,'submit')

    async def test_ratio_trends_provenance_and_unsupported_risk_not_established(self):
        for year in (2024,2025):
            self.fixture.calc('current_ratio',current_assets=self.facts['current_assets',year],current_liabilities=self.facts['current_liabilities',year])
            self.fixture.calc('debt_to_equity',total_debt=self.facts['total_debt',year],total_equity=self.facts['total_equity',year])
        allegation=self.claim('Synthetic Fixture Co faces an undisclosed catastrophic acquisition risk.',assertion_type='qualitative',target=None)
        unsupported=QualitativeAssessment(status='unsupported',supporting_ids=[],contradicting_ids=[],explanation='No selected evidence supports this allegation.',incompatible_evidence=None,same_entity_period_basis=None,missing_evidence=['Acquisition disclosure'],limitations=[])
        with patch('app.research.verification_engine.structured_call',new_callable=AsyncMock,return_value=unsupported):
            check=await self.check(allegation)
        self.assertEqual(check['result']['status'],'unsupported')
        await self.run_task();report=self.reports.list(self.cid)[0]
        trends=report['risks']['items']
        self.assertEqual(len(trends),2)
        self.assertTrue(any('declined from 2.00 to 1.50' in r['observation'] for r in trends))
        self.assertTrue(any('increased from 0.40 to 0.50' in r['observation'] for r in trends))
        self.assertTrue(all(len(r['receipt_ids'])==2 and r['fact_ids'] for r in trends))
        self.assertIn(allegation['id'],report['material_unresolved'])
        self.assertFalse(any(r['category']=='source_grounded_business_disclosure' for r in trends))

    async def test_claim_repairs_share_global_budget_and_provider_errors_have_no_verdict(self):
        assessment=QualitativeAssessment(status='unsupported',supporting_ids=[],contradicting_ids=[],explanation='No support.',incompatible_evidence=None,same_entity_period_basis=None,missing_evidence=['Exact disclosure'],limitations=[])
        claims=[self.claim('Revenue acquisition risk disclosure exists '+str(i),assertion_type='qualitative',target=None) for i in range(3)]
        with patch('app.research.verification_engine.structured_call',new_callable=AsyncMock,return_value=assessment):
            async with investigation_repairs(limit=1):
                checks=[await self.check(c) for c in claims]
        self.assertEqual(sum(len(c['attempts'])-1 for c in checks),1)
        self.assertEqual(checks[-1]['repairs'][-1]['stopping_reason'],'investigation repair budget exhausted')
        with patch('app.research.verification_engine.structured_call',new_callable=AsyncMock,side_effect=ModelCallError('Groq rate limit reached.')):
            failed=await self.check(claims[0])
        self.assertEqual(failed['status'],'failed');self.assertIsNone(failed['result'])

    async def test_basis_mismatch_not_contradiction_and_report_source_claim_changes_stale(self):
        claim=self.claim(accounting_scope='standalone');check=await self.check(claim)
        self.assertEqual(check['result']['status'],'needs_review')
        await self.run_task();report=self.reports.list(self.cid)[0]
        self.verifier.edit(self.cid,claim['id'],ClaimEdit(text=claim['text']+' corrected',mapping=ClaimMapping.model_validate(claim['mapping']),
            mapping_reviewed=True,expected_revision=1,reason='Explicit revision'))
        self.assertTrue(self.reports.get(self.cid,report['id'])['stale'])
        self.store.remove_document(self.cid,self.fixture.doc['id'])
        self.assertTrue(self.reports.get(self.cid,report['id'])['stale'])

    async def test_final_qualitative_finding_gate_and_partial_provider_failure(self):
        from app.research.analysis_models import QualitativeOutput,QualitativeObservation
        async def synthesis(model,instruction,data):
            return QualitativeOutput(observations=[QualitativeObservation(text='Revenue disclosure contains undisclosed acquisition risk.',evidence_ids=[data['evidence'][0]['id']],limitations=[])])
        request=self.request().model_copy(update={'task_type':'full_research'})
        with patch('app.research.analysis_brief.structured_call',new_callable=AsyncMock,side_effect=synthesis), patch('app.research.verification_engine.structured_call',new_callable=AsyncMock,side_effect=ModelCallError('Provider unavailable')):
            run=await self.run_task(request)
        self.assertEqual(run['status'],'completed',run['errors'])
        report=self.reports.list(self.cid)[0]
        qual=next(f for f in report['findings'] if 'undisclosed' in f['text'])
        self.assertIsNone(qual['verdict']);self.assertFalse(qual['affirmative_conclusion']);self.assertIn(qual['id'],report['material_unresolved'])
        self.assertEqual(qual['execution_status'],'failed')
        with patch('app.research.analysis_brief.structured_call',new_callable=AsyncMock,side_effect=ModelCallError('Unavailable')):
            partial=await self.run_task(request)
        self.assertEqual(partial['status'],'partial');self.assertTrue(self.reports.list(self.cid)[0]['metrics'])

    async def test_span_resolution_exact_offsets_and_note_failure_category(self):
        values=self.fixture.input().model_dump(mode='json');text=fixtures.FIXTURE
        sid=self.fixture.doc['pages'][0]['id'];span_id=f'{sid}:0:{len(text)}'
        values.update(span_id=span_id,excerpt='Model paraphrase is replaced only by an explicit supplied span')
        parsed=parse_response(json.dumps({'facts':[values]}),[{'document_id':self.fixture.doc['id'],'section_id':sid,'text':text,
            'spans':[{'id':span_id,'start_offset':0,'end_offset':len(text)}]}])
        self.assertEqual(parsed.facts[0].excerpt,text);self.assertEqual(parsed.facts[0].span_end,len(text))
        start=text.index('Revenue INR crore 1100');end=start+len('Revenue INR crore 1100')
        values.update(span_id=f'{sid}:{start}:{end}',context_span_ids=[])
        resolved=parse_response(json.dumps({'facts':[values]}),[{'document_id':self.fixture.doc['id'],'section_id':sid,'text':text,
            'spans':[{'id':f'{sid}:0:70','start_offset':0,'end_offset':70},
                     {'id':values['span_id'],'start_offset':start,'end_offset':end}]}]).facts[0]
        with self.store.connection() as db:
            provenance=self.fixture.financials.source(db,self.cid,resolved)
        self.assertEqual(provenance['context_spans'][0]['excerpt'],text[:70])
        self.assertEqual(resolved.excerpt,text[start:end])
        self.assertEqual(provenance['context_spans'][0]['start_offset'],0)

        with patch('app.research.claim_intake.structured_call',new_callable=AsyncMock,side_effect=ModelCallError('Groq rate limit reached.')):
            note=await extract_claims(self.verifier,self.cid,self.fixture.doc['id'])
        self.assertEqual(note['status'],'failed');self.assertTrue(note['errors'][0].startswith('provider_error:'))

    async def test_typed_http_reports_and_restart_interruption(self):
        run=await self.run_task();report=self.reports.list(self.cid)[0]
        response=self.fixture.client.get(f'/research/cases/{self.cid}/reports')
        self.assertEqual(response.status_code,200);self.assertEqual(response.json()[0]['id'],report['id'])
        queued=self.manager.store.create(self.cid,self.request())
        self.manager.startup()
        self.assertEqual(self.manager.store.get(self.cid,queued['id'])['status'],'interrupted')
        self.assertEqual(self.reports.get(self.cid,report['id'])['id'],report['id'])

    async def test_span_only_note_candidates_exact_sources_and_unreviewed_mapping(self):
        from app.research.verification_models import NoteSpanSelection
        async def choose(model,instruction,data,**kwargs):
            return NoteSpanSelection(span_ids=[data['sections'][0]['span_id']])
        with patch('app.research.claim_intake.structured_call',new_callable=AsyncMock,side_effect=choose):
            result=await extract_claims(self.verifier,self.cid,self.fixture.doc['id'])
        self.assertEqual(result['status'],'partial')  # fixture has more than eight lines
        claim=self.verifier.claim(self.cid,result['claim_ids'][0]);source=claim['source']
        self.assertEqual(fixtures.FIXTURE[source['start_offset']:source['end_offset']],source['excerpt'])
        self.assertFalse(claim['mapping_reviewed']);self.assertEqual(claim['mapping']['assertion_type'],'unknown')
        with self.assertRaises(HTTPException):
            self.verifier.create_run(self.cid,claim['id'],VerificationStart(supporting_document_ids=[self.fixture.doc['id']]))

    async def test_document_comparison_and_claim_only_routes(self):
        request=self.request().model_copy(update={'task_type':'document_comparison','calculations':[]})
        missing=await self.run_task(request)
        self.assertEqual(missing['status'],'needs_input')
        doc=self.store.add_document(self.cid,fixtures.DocumentMetadata(title='SYNTHETIC comparison'), 'pasted_text',None,b'Revenue disclosure context',
            [{'position':1,'page_number':None,'label':'Text section','text':'Revenue disclosure context','extraction_status':'extracted'}])
        request=request.model_copy(update={'document_ids':[self.fixture.doc['id'],doc['id']]})
        from app.research.analysis_models import QualitativeOutput
        with patch('app.research.analysis_brief.structured_call',new_callable=AsyncMock,return_value=QualitativeOutput(observations=[])):
            compared=await self.run_task(request)
        self.assertEqual(compared['status'],'completed',compared['errors'])
        started={e['stage'] for e in compared['events'] if e['transition']=='started'}
        self.assertNotIn('financial_analysis',started);self.assertNotIn('verification',started)
        claim=self.claim()
        claim_request=self.request().model_copy(update={'task_type':'claim_verification','calculations':[],'claim_ids':[claim['id']]})
        with patch('app.research.analysis_llm._invoke_research_model',new_callable=AsyncMock) as model:
            checked=await self.run_task(claim_request)
        model.assert_not_called();self.assertEqual(checked['verification']['status_counts'],{'contradicted':1})
        self.assertEqual(checked['brief']['qualitative_status'],'not_requested')

    async def test_provider_lock_and_safe_retry_diagnostics(self):
        from app.research.analysis_llm import structured_call,provider_diagnostic,retry_delay
        from app.research.analysis_models import QualitativeOutput
        active=0;maximum=0
        async def response(*args):
            nonlocal active,maximum
            active+=1;maximum=max(maximum,active)
            await asyncio.sleep(0.005)
            active-=1
            return '{"observations":[]}'
        with patch('app.research.analysis_llm.research_call_lock',asyncio.Lock()),patch('app.research.analysis_llm._get_groq_api_key',return_value='synthetic-key'),patch('app.research.analysis_llm._invoke_research_model',new_callable=AsyncMock,side_effect=response):
            await asyncio.gather(*(structured_call(QualitativeOutput,'Test',{}) for _ in range(3)))
        self.assertEqual(maximum,1)
        class Failure:
            status_code=400
            body={'error':{'code':'json_validate_failed','failed_generation':'SECRET SOURCE CONTENT'}}
        category,message=provider_diagnostic(Failure())
        self.assertEqual(category,'provider_bad_request');self.assertIn('json_validate_failed',message);self.assertNotIn('SECRET',message)
        class RateLimit:
            response=type('Response',(),{'headers':{'retry-after':'90'}})()
        self.assertEqual(retry_delay(RateLimit(),0),35)


    async def test_later_retry_recalculates_only_reviewed_inputs_and_records_budget_stop(self):
        claim=self.claim();previous=await self.check(claim)
        fact=self.facts['revenue',2025]
        self.fixture.financials.update_fact(self.cid,fact['id'],FactUpdate(expected_revision=fact['revision'],
            values=self.fixture.input('revenue',2025,value='1200'),status='confirmed',reason='Explicit synthetic analyst correction'))
        checked=await self.check(claim,previous_run_id=previous['id'])
        self.assertEqual(checked['result']['comparison']['computed_value'],'20.0')
        self.assertEqual(checked['repairs'][0]['action'],'recalculate_eligible_confirmed_inputs')
        async with investigation_repairs(limit=0):
            stopped=await self.check(claim,previous_run_id=previous['id'])
        self.assertEqual(stopped['result']['status'],'needs_review')
        self.assertEqual(stopped['repairs'][0]['stopping_reason'],'investigation repair budget exhausted')


if __name__=='__main__':unittest.main()
