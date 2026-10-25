"""Immutable structured reports with append-only, unauthenticated human review."""
import json
from decimal import Decimal
from uuid import uuid4, uuid5, NAMESPACE_URL
from typing import Literal

from fastapi import HTTPException
from pydantic import Field, StringConstraints
from typing import Annotated

from app.research.analysis_models import StrictModel, AnalysisSnapshot
from app.research.analysis_store import AnalysisStore, content_hash
from app.research.verification_store import VerificationStore, document_in_db
from app.research.financial_store import FinancialStore
from app.research.financial_models import CalculationReceipt
from app.research.calculations import canonical
from app.research.store import now

Reason = Literal['extraction_error','source_stale','basis_mismatch','missing_evidence','numeric_error','unresolved_conflict','provider_error']


class ReportCreate(StrictModel):
    analysis_run_id: str
    predecessor_id: str | None = None


class ReviewRequest(StrictModel):
    expected_revision: int = Field(ge=1)
    action: Literal['submit','comment','request_correction','approve','reject']
    reviewer_label: Annotated[str, StringConstraints(strip_whitespace=True,min_length=1,max_length=120)]
    comment: Annotated[str, StringConstraints(strip_whitespace=True,min_length=1,max_length=2000)]
    dispositions: dict[str, Literal['exclude_from_affirmative_conclusions','retain_as_unresolved']] = Field(default_factory=dict,max_length=100)
    finding_feedback: dict[str, str] = Field(default_factory=dict,max_length=100)
    materiality_adjustments: dict[str, bool] = Field(default_factory=dict,max_length=100)
    acknowledge_limitations: bool = False


class ResearchReport(StrictModel):
    id: str
    case_id: str
    analysis_run_id: str
    version: int
    predecessor_id: str | None
    created_at: str
    rendering_method: Literal['deterministic_structured_artifacts']
    question: str
    scope: dict
    snapshot: AnalysisSnapshot
    findings: list[dict]
    executive_findings: list[str]
    material_unresolved: list[str]
    metrics: list[CalculationReceipt]
    risks: dict
    limitations: list[str]
    unresolved_questions: list[str]
    workflow: list[dict]
    failures: list[str]
    claim_ids: list[str]
    receipt_ids: list[str]
    notice: str
    base_stale: bool
    source_analysis_status: str
    repairs: list[dict]
    dependency_signature: str
    state: Literal['draft','needs_review','changes_requested','approved','rejected']
    stale: bool
    stale_reasons: list[str]
    revision: int
    reviews: list[dict]
    dispositions: dict[str,str]
    materiality_adjustments: dict[str,bool]
    current_approval: bool


def materiality(claim):
    text=claim['text'].lower()
    principal=claim['origin']=='analysis_finding'
    numerical=claim['mapping']['assertion_type'] in ('numerical','debt_free')
    flagged=any(word in text for word in ('liquidity','solvency','acquisition','acquir','distress','risk','borrow','debt','revenue','profit','margin'))
    return {'material': principal or numerical or flagged,
            'reason':'Principal report conclusion, numerical performance, liquidity/solvency, acquisition or risk assertion.' if principal or numerical or flagged else 'Other claim; analyst may adjust with a recorded reason.',
            'method':'Conservative semantic categories; no monetary threshold.'}


def issue_reason(run):
    if not run or not run.get('result'):
        return 'provider_error' if run and run.get('errors') else 'missing_evidence'
    if run.get('stale'):
        return 'source_stale'
    text=run['result']['explanation'].lower()
    if 'basis' in text or 'period' in text:
        return 'basis_mismatch'
    if 'compet' in text or 'conflict' in text:
        return 'unresolved_conflict'
    if run['result']['status']=='contradicted':
        return 'numeric_error' if run['result']['method']=='deterministic_numerical_check' else 'unresolved_conflict'
    return 'missing_evidence'


def report_check_issue(claim, check, run, scope, receipts):
    """A verdict applies to one claim revision and its unchanged selected evidence."""
    if check['claim_snapshot']['revision'] != claim['revision']:
        return ('source_stale', 'The saved check is for a different claim revision.',
                'Verify the current claim revision in Evidence, then compose a new report.')
    if check['stale']:
        return ('source_stale', 'The saved verification is stale: ' + '; '.join(check.get('stale_reasons', [])),
                'Review changed sources/facts and recheck this claim before composing a new report.')
    if check['status'] != 'completed' or not check.get('result'):
        return ('provider_error' if check.get('errors') else 'missing_evidence',
                'No completed verification result is available for this claim revision.',
                'Complete the claim check in Evidence, then compose a new report.')
    selected = {d['document']['id']: d for d in run['snapshot']['documents'] if d['included']}
    evidence = [d for d in check['snapshot']['documents'] if d['included']]
    if not evidence or any(d['document']['id'] not in selected
            or d['content_hash'] != selected[d['document']['id']]['content_hash'] for d in evidence):
        return ('basis_mismatch', 'Verification evidence is outside the report sources or has a different source snapshot.',
                'Recheck the claim using the report sources, or start an analysis with the intended source scope.')
    mapping = claim['mapping']
    if mapping.get('entity') and canonical(mapping['entity']) != canonical(scope.get('entity')):
        return ('basis_mismatch', 'The claim entity differs from the report entity.',
                'Select the matching entity in Analysis or correct and recheck the claim.')
    if mapping.get('accounting_scope') and scope.get('accounting_basis') and canonical(mapping['accounting_scope']) != canonical(scope['accounting_basis']):
        return ('basis_mismatch', 'The claim accounting basis differs from the report basis.',
                'Use the matching reviewed accounting basis and recheck the claim.')
    result = check['result']
    inputs = list((result.get('comparison') or {}).get('inputs', {}).values())
    if result['method'] == 'deterministic_numerical_check' and result['status'] in ('supported', 'contradicted'):
        report_facts = {f['id']: f for f in run['snapshot']['facts']}
        check_facts = {f['id']: f for f in check['snapshot']['facts']}
        identity_fields = ('id', 'revision', 'document_id', 'section_id', 'metric', 'entity', 'value',
            'currency', 'scale', 'reporting_period', 'period_type', 'period_start', 'period_end', 'accounting_scope')
        if not inputs or any(f['id'] not in report_facts or f['id'] not in check_facts
                or any(f.get(k) != saved.get(k) for saved in (report_facts[f['id']], check_facts[f['id']]) for k in identity_fields)
                or f['status'] != 'confirmed' or not f['source_available'] or f.get('removed_at') or f.get('ambiguity_note')
                for f in inputs):
            return ('source_stale', 'Verified numerical inputs do not match the report fact IDs and revisions.',
                    'Start an analysis using the current reviewed facts, then recheck and compose a new report.')
        if scope.get('research_as_of_date') and any(not f.get('period_end') or f['period_end'] > scope['research_as_of_date'] for f in inputs):
            return ('basis_mismatch', 'Verified numerical periods extend beyond the report research-as-of date.',
                    'Use an appropriate research-as-of date or recheck with temporally eligible facts.')
    periods = scope.get('periods') or []
    outside = [p for p in mapping.get('periods', []) if periods and canonical(p) not in {canonical(s) for s in periods}]
    if outside:
        # Display-label compatibility requires an exact receipt binding already used
        # by this analysis and verified against the same fact IDs/revisions.
        from app.research.analysis_financial import matches_fact_period
        linked = set(run.get('receipt_ids', [])) | {r['id'] for r in run['snapshot']['selected_receipts']}
        comparison = (result.get('comparison') or {}).get('inputs', {})
        bound = any(rid in linked and rid in receipts and receipts[rid]['status'] == 'valid'
            and {role: (f['id'], f['revision']) for role, f in receipts[rid]['inputs'].items()}
                == {role: (f['id'], f['revision']) for role, f in comparison.items()}
            for rid in result.get('receipt_ids', []))
        if not (result['method'] == 'deterministic_numerical_check' and inputs and bound
                and all(any(canonical(f.get('reporting_period')) == canonical(p)
                    and any(matches_fact_period(f, label, explicit=True) for label in periods) for f in inputs) for p in outside)):
            return ('basis_mismatch', 'Claim periods do not match the report periods through its verified receipt inputs.',
                    'Use the exact reviewed period labels and matching receipt in Analysis, then compose a new report.')
    if result['status'] == 'supported' and not (result.get('supporting_ids') or result.get('receipt_ids') or result.get('fact_ids')):
        return ('missing_evidence', 'The supported result has no saved evidence or financial references.',
                'Recheck the claim against saved supporting evidence before composing a new report.')
    return None


def select_report_check(claim, checks, run, scope, receipts):
    candidates = [v for v in checks if v['claim_id'] == claim['id']]
    linked = (run.get('verification') or {}).get('verification_ids', [])
    # Prefer this analysis's own eligible check; other checks must pass all the
    # same revision/snapshot/scope gates. A newer failed retry cannot hide it.
    candidates.sort(key=lambda v: (v['claim_snapshot']['revision'] != claim['revision'], v['id'] not in linked))
    diagnosed = [(check, report_check_issue(claim, check, run, scope, receipts)) for check in candidates]
    return next(((check, issue) for check, issue in diagnosed if issue is None),
                diagnosed[0] if diagnosed else (None, ('missing_evidence',
                    'No verification exists for this claim.', 'Verify this claim in Evidence, then compose a new report.')))


def scoped_snapshot(snapshot, scope):
    if not scope:
        return snapshot
    return {**snapshot,'facts':[f for f in snapshot['facts'] if
        (not scope.get('entity') or canonical(f['entity'])==canonical(scope['entity']))
        and (not scope.get('accounting_basis') or canonical(f['accounting_scope'])==canonical(scope['accounting_basis']))
        and (not scope.get('periods') or f['reporting_period'] in scope['periods'])
        and (not scope.get('research_as_of_date') or not f['period_end'] or f['period_end']<=scope['research_as_of_date'])]}


def assess_risks(snapshot, receipts, extra_limitations=()):
    """Only saved comparable receipts establish trends. No threshold or distress inference."""
    selected={d['document']['id'] for d in snapshot['documents'] if d['included']}
    revisions={f['id']:f['revision'] for f in snapshot['facts']}
    groups={}
    limitations=list(extra_limitations)
    for receipt in receipts:
        inputs=list(receipt['inputs'].values())
        if receipt['status']!='valid' or receipt['calculation_type'] not in ('current_ratio','debt_to_equity') or receipt['acknowledged_conflicts']:
            continue
        if not inputs or any(f['document_id'] not in selected or revisions.get(f['id'])!=f['revision'] for f in inputs):
            continue
        key=(receipt['calculation_type'],canonical(inputs[0]['entity']),canonical(inputs[0]['accounting_scope']),inputs[0]['currency'])
        groups.setdefault(key,{}).setdefault(inputs[0]['period_end'],[]).append(receipt)
    items=[]
    for key, periods in groups.items():
        dates=sorted(d for d in periods if d)
        if len(dates)<2:
            continue
        # Duplicate identical calculations are fine; conflicting values are not.
        if any(len({r['result'] for r in periods[d]})!=1 for d in dates):
            limitations.append('Conflicting comparable receipts require analyst review; no trend selected.')
            continue
        previous,current=periods[dates[-2]][0],periods[dates[-1]][0]
        before,after=Decimal(previous['result']),Decimal(current['result'])
        direction='declined' if after<before else 'increased' if after>before else 'was unchanged'
        refs=[previous['id'],current['id']]
        items.append({'id':str(uuid5(NAMESPACE_URL,':'.join(refs))), 'category':'observed_financial_trend',
            'observation':f"{key[0].replace('_',' ').capitalize()} {direction} from {previous['display_result']} to {current['display_result']} ({dates[-2]} to {dates[-1]}).",
            'why_it_may_matter':'Changes may warrant investigation of liquidity or financing structure; direction alone does not prove distress.',
            'receipt_ids':refs,'fact_ids':sorted({f['id'] for r in (previous,current) for f in r['inputs'].values()}),'evidence_ids':[],
            'assessment_method':'Deterministic Decimal comparison of saved comparable receipts',
            'uncertainty':'No universal safe/risky threshold; selected uploaded documents only.',
            'open_questions':['Check composition, cash flows, seasonality and subsequent disclosures.']})
    if not items:
        limitations.append('No two-period comparable current-ratio/debt-to-equity receipts are available; trend assessment is partial.')
    for doc in snapshot['documents']:
        if not doc['document'].get('publication_date'):
            limitations.append('Unknown source publication date: '+doc['document']['id'])
        if doc['document'].get('extraction_status')=='partial':
            limitations.append('Source text extraction is incomplete: '+doc['document']['id'])
    if any(f.get('ambiguity_note') or f['status']!='confirmed' for f in snapshot['facts']):
        limitations.append('Unreviewed, ambiguous or rejected facts are excluded from financial conclusions.')
    limitations.append('Business/disclosure risks require separately checked source-grounded claims; no AI risk synthesis was attempted.')
    return {'items':items,'status':'partial','method':'deterministic_saved_receipts','limitations':list(dict.fromkeys(limitations))}


def dependency_signature(db, case_id, snapshot, claim_ids, receipt_ids):
    # Includes competing facts, not just chosen inputs. No raw source text in diagnostics.
    docs={d['document']['id']:document_in_db(db,case_id,d['document']['id']) for d in snapshot['documents']}
    case=db.execute('SELECT payload FROM research_cases WHERE id=?',(case_id,)).fetchone()
    facts=[json.loads(r['payload']) for r in db.execute('SELECT payload FROM financial_facts WHERE case_id=? ORDER BY id',(case_id,))]
    claims=[]
    # New case claims also invalidate a prior report, preventing silent omission.
    claim_ids=[r['id'] for r in db.execute('SELECT id FROM research_claims WHERE case_id=?',(case_id,))]
    for cid in sorted(claim_ids):
        row=db.execute('SELECT payload FROM research_claims WHERE case_id=? AND id=?',(case_id,cid)).fetchone()
        claims.append(json.loads(row['payload']) if row else None)
    receipts=[]
    for rid in sorted(receipt_ids):
        row=db.execute('SELECT payload FROM calculation_receipts WHERE case_id=? AND id=?',(case_id,rid)).fetchone()
        receipts.append(json.loads(row['payload']) if row else None)
    checks=[json.loads(r['payload']) for r in db.execute('SELECT payload FROM verification_runs WHERE case_id=? ORDER BY id',(case_id,))
            if json.loads(r['payload'])['claim_id'] in claim_ids]
    return content_hash({'checks':checks,'case':json.loads(case['payload']),'documents':docs,'facts':facts,'claims':claims,'receipts':receipts})


def processing_failures(store,case_id,document_ids):
    errors=[]; flags=[]
    with store.connection() as db:
        for row in db.execute('SELECT payload FROM extraction_runs WHERE case_id=?',(case_id,)):
            run=json.loads(row['payload'])
            if not set(run['document_ids']) & document_ids:
                continue
            errors.extend(f"Financial extraction {run['id']}: {message}" for message in run.get('errors',[]))
            for section in run.get('sections',[]):
                if section['document_id'] in document_ids and section['status'] in ('failed','skipped'):
                    flags.append({'reason':'extraction_error','action':'request_source_span_review',
                        'document_id':section['document_id'],'section_id':section['section_id'],'extraction_id':run['id'],
                        'before_outcome':section['status'],'after_outcome':'analyst_review_required',
                        'stopping_reason':'No automatic confirmation or excerpt reconstruction. Use Financials/manual entry.'})
        for row in db.execute('SELECT payload FROM claim_extractions WHERE case_id=?',(case_id,)):
            run=json.loads(row['payload'])
            if run['document_id'] in document_ids:
                errors.extend(f"Note extraction {run['id']}: {message}" for message in run.get('errors',[]))
    return errors,flags


class ReportStore:
    def __init__(self, store):
        self.store=store

    def create(self,case_id,request):
        run=AnalysisStore(self.store).get(case_id,request.analysis_run_id)
        if run['status'] in ('queued','running') and not run.get('brief'):
            raise HTTPException(409,'Wait for saved analysis outputs before composing a report.')
        if not any(run.get(k) for k in ('brief','financial','retrieval','verification')):
            raise HTTPException(422,'No genuine structured outputs exist for this run.')
        for finding in (run.get('brief') or run.get('financial') or {}).get('findings',[]):
            VerificationStore(self.store).import_finding(case_id,run['id'],finding)
        claims=VerificationStore(self.store).claims(case_id)
        checks=VerificationStore(self.store).runs(case_id)
        selected={d['document']['id'] for d in run['snapshot']['documents'] if d['included']}
        # Retain relevant case claims, including misleading note/manual assertions; never drop unresolved material claims.
        scope=run.get('scope')
        if not scope or scope.get('task_type')=='legacy_preliminary':
            from app.research.investigation import resolve_scope
            scope=resolve_scope({'request':{'task_type':'full_research'},'snapshot':AnalysisSnapshot.model_validate(run['snapshot'])})
        receipts=FinancialStore(self.store).list_receipts(case_id)
        receipt_map={r["id"]:r for r in receipts}
        rows=[]
        for claim in claims:
            if claim['origin']=='analysis_finding' and not claim['origin_reference'].startswith(run['id']+':'):
                continue
            check, issue = select_report_check(claim, checks, run, scope, receipt_map)
            result=(check or {}).get('result')
            eligible=bool(check and issue is None)
            verdict=result['status'] if eligible else 'needs_review' if result else None
            rows.append({'id':claim['id'],'claim_revision':claim['revision'],'text':claim['text'],'origin':claim['origin'],
                'materiality':materiality(claim),'verification_id':check['id'] if check else None,
                'verdict':verdict,'machine_result':result,'execution_status':check['status'] if check else 'not_run',
                'reason_code':issue[0] if issue else None if verdict=='supported' else issue_reason(check),
                'reason_detail':issue[1] if issue else None, 'resolution':issue[2] if issue else None, 'warnings':(check or {}).get('warnings',[]),
                'errors':(check or {}).get('errors',[]),'affirmative_conclusion':verdict=='supported',
                'label':result['label'] if result else 'Unresolved — no current eligible machine verdict'})
        receipt_ids=set(run.get('receipt_ids',[]))
        risks=assess_risks(scoped_snapshot(run['snapshot'],scope),receipts,(run.get('retrieval') or {}).get('limitations',[]))
        for item in risks['items']:
            receipt_ids.update(item['receipt_ids'])
        for row in rows:
            receipt_ids.update((row['machine_result'] or {}).get('receipt_ids',[]))
        used=[r for r in receipts if r['id'] in receipt_ids]
        processing_errors,extraction_flags=processing_failures(self.store,case_id,selected |
            {c['source']['document_id'] for c in claims if c.get('source')})
        risks['limitations']+=processing_errors
        limitations=list(dict.fromkeys((run.get('verification') or {}).get('limitations',[])+processing_errors+run['warnings']+run['limitations']+run['errors']+risks['limitations']+
            (run.get('brief') or {}).get('limitations',[])+[e for row in rows for e in row['errors']+row['warnings']]))
        unresolved=[row['id'] for row in rows if row['materiality']['material'] and row['verdict']!='supported']
        risks['items'] += [{'id':'risk:'+r['id'],'category':'source_grounded_business_disclosure',
            'observation':r['text'],'why_it_may_matter':'Source-grounded disclosure warrants analyst consideration.',
            'receipt_ids':(r['machine_result'] or {}).get('receipt_ids',[]),'fact_ids':(r['machine_result'] or {}).get('fact_ids',[]),
            'evidence_ids':(r['machine_result'] or {}).get('supporting_ids',[]),'verification_id':r['verification_id'],
            'assessment_method':(r['machine_result'] or {})['method'],'uncertainty':r['label'],
            'open_questions':['Review exact cited disclosure and its period/basis.']} for r in rows if r['verdict']=='supported'
            and (r['machine_result'] or {}).get('method')=='model_assessed_qualitative_support'
            and any(word in r['text'].lower() for word in ('risk','acquisition','liquidity','solvency'))]
        report={'id':str(uuid4()),'case_id':case_id,'analysis_run_id':run['id'],'created_at':now(),
            'rendering_method':'deterministic_structured_artifacts','question':run['question'],'scope':scope,
            'snapshot':run['snapshot'],'findings':rows,'executive_findings':[r['id'] for r in rows if r['affirmative_conclusion']],
            'material_unresolved':unresolved,'metrics':used,'risks':risks,'limitations':limitations,
            'unresolved_questions':(run.get('financial') or {}).get('needs_input',[])+['Review material unresolved/disputed claims in Evidence.'] if unresolved else (run.get('financial') or {}).get('needs_input',[]),
            'workflow':run['events'],'failures':run['errors']+processing_errors,'claim_ids':[r['id'] for r in rows],'receipt_ids':sorted(receipt_ids),
            'notice':'Research review only. Approval never authorizes transactions. Selected uploaded documents; no external filing/news retrieval.',
            'base_stale':run['stale'],'source_analysis_status':'needs_input' if (run.get('financial') or {}).get('needs_input') else run['status'],
            'repairs':extraction_flags+[{'verification_id':v['id'], **repair} for v in checks for repair in v.get('repairs',[]) if v['claim_id'] in {r['id'] for r in rows}]}
        with self.store.connection() as db:
            db.execute('BEGIN IMMEDIATE')
            latest=db.execute('SELECT id,version FROM research_reports WHERE case_id=? ORDER BY version DESC LIMIT 1',(case_id,)).fetchone()
            if request.predecessor_id and (not latest or latest['id']!=request.predecessor_id):
                raise HTTPException(409,'Revise the latest report version in this case.')
            report.update(version=latest['version']+1 if latest else 1, predecessor_id=latest['id'] if latest else None)
            report['dependency_signature']=dependency_signature(db,case_id,report['snapshot'],report['claim_ids'],report['receipt_ids'])
            db.execute('INSERT INTO research_reports VALUES (?,?,?,?)',(report['id'],case_id,report['version'],json.dumps(report)))
        return self.get(case_id,report['id'])

    def _get(self,db,case_id,report_id):
        row=db.execute('SELECT payload FROM research_reports WHERE case_id=? AND id=?',(case_id,report_id)).fetchone()
        if not row:
            raise HTTPException(404,'Report version not found in this case.')
        report=json.loads(row['payload'])
        events=[json.loads(r['payload']) for r in db.execute('SELECT payload FROM report_reviews WHERE report_id=? ORDER BY revision',(report_id,))]
        state='draft'
        dispositions={}; adjustments={}
        for event in events:
            state={'submit':'needs_review','request_correction':'changes_requested','approve':'approved','reject':'rejected'}.get(event['action'],state)
            dispositions.update(event['dispositions']); adjustments.update(event.get('materiality_adjustments',{}))
        stale=report['base_stale'] or report['dependency_signature']!=dependency_signature(db,case_id,report['snapshot'],report['claim_ids'],report['receipt_ids'])
        latest=db.execute('SELECT id FROM research_reports WHERE case_id=? ORDER BY version DESC LIMIT 1',(case_id,)).fetchone()
        report.update(state=state,stale=stale,stale_reasons=['Dependencies changed; compose a new version and review again.'] if stale else [],
            revision=len(events)+1,reviews=events,dispositions=dispositions,materiality_adjustments=adjustments,
            current_approval=state=='approved' and not stale and latest['id']==report_id)
        return report

    def get(self,case_id,report_id):
        with self.store.connection() as db:
            return self._get(db,case_id,report_id)

    def list(self,case_id):
        self.store.get_case(case_id)
        with self.store.connection() as db:
            return [self._get(db,case_id,r['id']) for r in db.execute('SELECT id FROM research_reports WHERE case_id=? ORDER BY version DESC',(case_id,)).fetchall()]

    def review(self,case_id,report_id,request):
        with self.store.connection() as db:
            db.execute('BEGIN IMMEDIATE')
            report=self._get(db,case_id,report_id)
            if report['revision']!=request.expected_revision:
                raise HTTPException(409,'Report review changed; reload the current version.')
            if report['state'] in ('approved','rejected'):
                raise HTTPException(409,'Terminal reviewed versions are immutable. Compose a linked new version.')
            allowed={'draft':{'submit','comment','request_correction','reject'},'needs_review':{'comment','request_correction','approve','reject'},'changes_requested':{'comment','reject'}}
            if request.action not in allowed[report['state']]:
                raise HTTPException(409,'Invalid review transition; corrections require a new report version.')
            ids=set(report['claim_ids'])
            if (set(request.dispositions)|set(request.finding_feedback)|set(request.materiality_adjustments))-ids:
                raise HTTPException(422,'Feedback/dispositions must target saved report findings.')
            if any(cid not in request.finding_feedback or not request.finding_feedback[cid].strip() for cid in request.materiality_adjustments):
                raise HTTPException(422,'Each materiality adjustment requires finding-level feedback explaining the reason.')
            dispositions={**report['dispositions'],**request.dispositions}
            materiality_changes={**report['materiality_adjustments'],**request.materiality_adjustments}
            if request.action=='approve':
                latest=db.execute('SELECT id FROM research_reports WHERE case_id=? ORDER BY version DESC LIMIT 1',(case_id,)).fetchone()
                if report['scope'].get('questions'):
                    raise HTTPException(422,'Resolve investigation scope questions in a new run before approval.')
                if report['stale'] or latest['id']!=report_id:
                    raise HTTPException(409,'Only the latest nonstale report can be approved.')
                unresolved=[r['id'] for r in report['findings'] if materiality_changes.get(r['id'],r['materiality']['material']) and r['verdict']!='supported']
                if any(cid not in dispositions for cid in unresolved):
                    raise HTTPException(422,'Explicit dispositions are required for every material unresolved/disputed claim.')
                if report['limitations'] and not request.acknowledge_limitations:
                    raise HTTPException(422,'Acknowledge retained material limitations and explain in the review comment.')
            event={**request.model_dump(mode='json'),'timestamp':now(),'report_id':report_id,'report_version':report['version'],
                'identity_notice':'Reviewer label is not authenticated identity.','revision':report['revision']}
            db.execute('INSERT INTO report_reviews VALUES (?,?,?)',(report_id,report['revision'],json.dumps(event)))
            return self._get(db,case_id,report_id)
