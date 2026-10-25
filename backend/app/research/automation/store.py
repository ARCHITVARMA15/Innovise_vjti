import hashlib
import json
import threading
from decimal import Decimal
from uuid import uuid4
from fastapi import HTTPException
from app.research.models import CaseCreate
from app.research.store import now
from app.research.financial_store import FinancialStore
from app.research.financial_models import FactInput, FactUpdate
from app.research.calculations import financial_identity, normalized_value
from .sec import clean

_START_LOCK=threading.Lock()

def encode(value):return json.dumps(value,sort_keys=True,default=str,ensure_ascii=False)

class AutomationStore:
    def __init__(self,research):self.research=research
    def read(self,db,case_id,rid):
        self.research._case(db,case_id)
        row=db.execute('SELECT payload FROM automation_runs WHERE id=? AND case_id=?',(rid,case_id)).fetchone()
        if not row:raise HTTPException(404,'Automation run not found in this case.')
        return json.loads(row[0])
    def create(self,request,case_id=None):
        with _START_LOCK:
            with self.research.connection() as db:
                old=db.execute('SELECT case_id,id,payload FROM automation_runs WHERE request_id=?',(request.request_id,)).fetchone()
                if old:
                    saved=json.loads(old['payload'])
                    if (case_id and case_id!=old['case_id']) or saved.get('initial_request',saved['request'])!=request.model_dump(mode='json'):raise HTTPException(409,'Request ID belongs to another automation request.')
                    return saved
            created=case_id is None
            if created:
                case_id=self.research.create_case(CaseCreate(title='Ask Dexter: '+request.query[:225],company_name='SEC company resolution pending',research_question=request.query,research_as_of_date=request.as_of_date))['id']
            else:self.research.get_case(case_id)
            rid=str(uuid4())
            run=dict(id=rid,case_id=case_id,created_case=created,request=request.model_dump(mode='json'),initial_request=request.model_dump(mode='json'),original_query=request.query,status='queued',revision=1,
                created_at=now(),finished_at=None,scope=None,filings=[],source_decisions=[],document_ids=[],candidate_ids=[],selected_fact_ids=[],reviewed_revisions={},
                imported_filings=[],record_issues=[],questions=[],blockers=[],limitations=['US SEC 10-K annual filings only. No universal company/country coverage, autonomous confirmation, report approval or trade execution.'],
                budgets={'max_seconds':240,'max_documents':4,'max_candidates':30,'max_requests':24,'max_fallback_sections':2},coverage=[],analysis_run_id=None,
                receipt_ids=[],report_id=None,extraction_run_id=None,cancel_requested=False,stage='queued')
            with self.research.connection() as db:db.execute('INSERT INTO automation_runs VALUES(?,?,?,?,?,?)',(rid,case_id,request.request_id,run['status'],run['revision'],encode(run)))
            self.event(run,'scope','queued','Query saved; SEC annual-filing automation queued.')
            return run
    def save(self,run,*,clear_cancel=False):
        with self.research.connection() as db:
            db.execute('BEGIN IMMEDIATE');current=self.read(db,run['case_id'],run['id'])
            run['cancel_requested']=False if clear_cancel else current.get('cancel_requested',False)
            run['revision']=current['revision']+1
            db.execute('UPDATE automation_runs SET status=?,revision=?,payload=? WHERE id=? AND case_id=?',(run['status'],run['revision'],encode(run),run['id'],run['case_id']))
    def event(self,run,stage,transition,message):
        with self.research.connection() as db:
            self.read(db,run['case_id'],run['id'])
            db.execute('INSERT INTO automation_events(run_id,payload) VALUES(?,?)',(run['id'],encode({'stage':stage,'transition':transition,'message':message,'timestamp':now()})))
    def get(self,case_id,rid):
        with self.research.connection() as db:
            run=self.read(db,case_id,rid)
            run['events']=[{'sequence':row['sequence'],**json.loads(row['payload'])} for row in db.execute('SELECT * FROM automation_events WHERE run_id=? ORDER BY sequence',(rid,))]
        return run
    def list(self,case_id):
        with self.research.connection() as db:
            self.research._case(db,case_id)
            return [json.loads(r[0]) for r in db.execute('SELECT payload FROM automation_runs WHERE case_id=? ORDER BY rowid DESC LIMIT 30',(case_id,))]
    def resolve_new_case(self,run):
        if not run['created_case']:return
        with self.research.connection() as db:
            case=self.research._case(db,run['case_id'])
            if case['company_name']!='SEC company resolution pending':return
            for table in ('documents','financial_facts','analysis_runs'):
                if db.execute(f'SELECT 1 FROM {table} WHERE case_id=?',(run['case_id'],)).fetchone():raise HTTPException(409,'Case was edited during resolution. Start a matching case instead of replacing its scope.')
            row=db.execute('SELECT payload FROM research_cases WHERE id=?',(run['case_id'],)).fetchone();payload=json.loads(row[0]);scope=run['scope']
            payload.update(company_name=scope['entity']['name'],ticker=scope['entity']['ticker'],reporting_period=' and '.join(scope['periods']))
            db.execute('UPDATE research_cases SET payload=?,updated_at=? WHERE id=?',(encode(payload),now(),run['case_id']))
    def candidates(self,run):
        fs=FinancialStore(self.research)
        with self.research.connection() as db:
            allfacts=[fs._fact(db,run['case_id'],r['id']) for r in db.execute('SELECT id FROM financial_facts WHERE case_id=? ORDER BY rowid DESC LIMIT 1000',(run['case_id'],))]
            results=[]
            for fid in run['candidate_ids']:
                fact=next((f for f in allfacts if f['id']==fid),None)
                if not fact:continue
                values=FactInput.model_validate({k:fact.get(k) for k in FactInput.model_fields})
                missing=[k for k in ('entity','currency','scale','accounting_scope','period_end','reporting_period') if not getattr(values,k)]
                if values.period_type=='unknown':missing.append('period_type')
                if values.period_type=='duration' and not values.period_start:missing.append('period_start')
                error=None
                try:fs.source(db,run['case_id'],values)
                except HTTPException as e:error=str(e.detail)
                comparable=[f for f in allfacts if f['status']=='confirmed' and f['source_available'] and not f['removed_at'] and not f.get('ambiguity_note') and f['id']!=fid
                    and financial_identity(f)==financial_identity(fact) and f.get('scale') and fact.get('scale')]
                equivalent=[f['id'] for f in comparable if normalized_value(f['value'],f['scale'])==normalized_value(fact['value'],fact['scale'])]
                conflicts=[f['id'] for f in comparable if normalized_value(f['value'],f['scale'])!=normalized_value(fact['value'],fact['scale'])]
                valid=not (missing or error or conflicts or fact.get('ambiguity_note') or fact.get('removed_at') or not fact['source_available'])
                results.append({'fact':fact,'values':values.model_dump(mode='json'),'eligible':valid,'missing_fields':missing,'source_error':error,'conflicts':conflicts,'equivalent_confirmed_ids':equivalent})
            return results
    def review(self,case_id,rid,payload):
        if not payload.acknowledge:raise HTTPException(409,'Explicit acknowledgement of selected values, dates, units, column/context and accounting basis is required.')
        fs=FinancialStore(self.research);fingerprint=hashlib.sha256(encode(payload.model_dump(mode='json')).encode()).hexdigest()
        with self.research.connection() as db:
            db.execute('BEGIN IMMEDIATE');run=self.read(db,case_id,rid)
            old=db.execute('SELECT payload,run_id FROM automation_reviews WHERE request_id=?',(payload.request_id,)).fetchone()
            if old:
                if old['run_id']!=rid or json.loads(old['payload'])['fingerprint']!=fingerprint:raise HTTPException(409,'Review request ID was already used with different inputs.')
                return run
            if run['revision']!=payload.expected_revision:raise HTTPException(409,'Automation changed; reload before confirming.')
            if run['status']!='awaiting_review':raise HTTPException(409,'This automation is not awaiting fact review.')
            if len({i.fact_id for i in payload.items})!=len(payload.items):raise HTTPException(422,'Select each candidate once.')
            prepared=[]
            for item in payload.items:
                if item.fact_id not in run['candidate_ids']:raise HTTPException(422,'Fact is not a candidate of this automation.')
                fact=fs._fact(db,case_id,item.fact_id)
                if fact['revision']!=item.expected_revision:raise HTTPException(409,'A candidate changed; reload before confirming.')
                values=item.values or FactInput.model_validate({k:fact.get(k) for k in FactInput.model_fields})
                if fact['removed_at'] or values.ambiguity_note or not all((values.entity,values.currency,values.scale,values.period_end,values.reporting_period,values.accounting_scope)) or values.period_type=='unknown' or (values.period_type=='duration' and not values.period_start):
                    raise HTTPException(422,'Selected candidate has missing metadata, unresolved ambiguity or has been removed. Resolve it before confirming.')
                fs.source(db,case_id,values)
                prepared.append((fact,values))
            selected=[]
            for fact,values in prepared:
                expected=values.model_dump(mode='json');existing=[]
                for row in db.execute('SELECT id FROM financial_facts WHERE case_id=?',(case_id,)):
                    other=fs._fact(db,case_id,row['id'])
                    if other['id']==fact['id'] or other['status']!='confirmed' or not other['source_available'] or other['removed_at'] or other.get('ambiguity_note'):continue
                    if financial_identity(other)==financial_identity(expected) and other.get('scale'):
                        if normalized_value(other['value'],other['scale'])!=normalized_value(values.value,values.scale):raise HTTPException(409,'A competing confirmed value exists for this metric/date/basis. Resolve it explicitly in Financials; this batch cannot silently choose it.')
                        existing.append(other)
                chosen=existing[0] if existing else fs.update_fact_in_transaction(db,case_id,fact['id'],FactUpdate(expected_revision=fact['revision'],values=values,status='confirmed',reason=payload.reason))
                selected.append(chosen['id']);run['reviewed_revisions'][chosen['id']]=chosen['revision']
            run['selected_fact_ids']=list(dict.fromkeys([*run['selected_fact_ids'],*selected]));run['revision']+=1
            db.execute('UPDATE automation_runs SET revision=?,payload=? WHERE id=?',(run['revision'],encode(run),rid))
            db.execute('INSERT INTO automation_reviews VALUES(?,?,?)',(payload.request_id,rid,encode({'fingerprint':fingerprint,'at':now(),'reason':payload.reason,'selected_fact_ids':selected,'request':payload.model_dump(mode='json')})))
        self.event(run,'review','completed',f'Analyst confirmed/reused {len(selected)} selected source-linked facts. Continue remains a separate action.')
        return run
    def interrupt_active(self):
        with self.research.connection() as db:
            for row in db.execute("SELECT payload FROM automation_runs WHERE status IN ('queued','running')"):
                run=json.loads(row[0]);run.update(status='interrupted',finished_at=now(),revision=run['revision']+1)
                run['blockers'].append('Backend restarted during automation. Saved sources/facts remain; explicit retry can resume retrieval checkpoints. Analysis execution is not crash-resumed.')
                db.execute('UPDATE automation_runs SET status=?,revision=?,payload=? WHERE id=?',(run['status'],run['revision'],encode(run),run['id']))
