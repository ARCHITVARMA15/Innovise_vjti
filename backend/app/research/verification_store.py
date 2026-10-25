import json
from uuid import uuid4

from fastapi import HTTPException

from app.research.analysis_models import AnalysisSnapshot, SnapshotDocument
from app.research.analysis_store import content_hash, input_changes
from app.research.analysis_llm import model_configuration
from app.research.financial_models import FactSnapshot
from app.research.financial_store import FinancialStore
from app.research.store import now
from app.research.verification_models import ClaimInput, ClaimMapping


def document_in_db(db, case_id, document_id):
    row = db.execute('SELECT payload FROM documents WHERE case_id=? AND id=?', (case_id, document_id)).fetchone()
    if not row:
        return None
    pages = [json.loads(p['payload']) for p in db.execute('SELECT payload FROM pages WHERE document_id=? ORDER BY position', (document_id,)).fetchall()]
    return {**json.loads(row['payload']), 'pages': pages}


def verification_changes(db, run):
    reasons = input_changes(db, run)
    row = db.execute('SELECT payload FROM research_claims WHERE case_id=? AND id=?', (run['case_id'], run['claim_id'])).fetchone()
    if not row or json.loads(row['payload'])['revision'] != run['claim_snapshot']['revision']:
        reasons.append('Claim edited after verification; review the latest revision.')
    source = run['claim_snapshot'].get('source')
    if source:
        current = document_in_db(db, run['case_id'], source['document_id'])
        if not current or content_hash(current) != source['document_hash']:
            reasons.append('The checked note source changed or was removed.')
    for receipt_id in (run.get('result') or {}).get('receipt_ids', []):
        row = db.execute('SELECT payload FROM calculation_receipts WHERE case_id=? AND id=?', (run['case_id'], receipt_id)).fetchone()
        if not row or json.loads(row['payload'])['status'] != 'valid':
            reasons.append('A depended-on calculation receipt is no longer valid.')
    return reasons


def invalidate_verifications(db, case_id):
    for row in db.execute('SELECT id,payload FROM verification_runs WHERE case_id=?', (case_id,)).fetchall():
        run = json.loads(row['payload'])
        changed = verification_changes(db, run)
        if changed:
            run['stale'] = True
            run['stale_reasons'] = list(dict.fromkeys(run['stale_reasons'] + changed))
            db.execute('UPDATE verification_runs SET payload=? WHERE id=?', (json.dumps(run), row['id']))


class VerificationStore:
    def __init__(self, store):
        self.store = store

    def _claim(self, db, case_id, claim_id):
        row = db.execute('SELECT payload FROM research_claims WHERE case_id=? AND id=?', (case_id, claim_id)).fetchone()
        if not row:
            raise HTTPException(404, 'Claim not found in this case.')
        claim = json.loads(row['payload'])
        claim['history'] = [json.loads(r['payload']) for r in db.execute('SELECT payload FROM claim_revisions WHERE claim_id=? ORDER BY revision', (claim_id,)).fetchall()]
        source=claim.get('source')
        current=document_in_db(db,case_id,source['document_id']) if source else None
        claim['source_available'] = not source or bool(current and content_hash(current)==source['document_hash'])
        return claim

    def claim(self, case_id, claim_id):
        with self.store.connection() as db:
            return self._claim(db, case_id, claim_id)

    def claims(self, case_id):
        self.store.get_case(case_id)
        with self.store.connection() as db:
            return [self._claim(db, case_id, row['id']) for row in db.execute('SELECT id FROM research_claims WHERE case_id=? ORDER BY rowid DESC', (case_id,)).fetchall()]

    def add(self, case_id, payload, *, origin='analyst_entered', origin_reference=None, source=None, origin_key=None):
        with self.store.connection() as db:
            db.execute('BEGIN IMMEDIATE')
            self.store._case(db, case_id)
            if origin_key:
                row = db.execute('SELECT id FROM research_claims WHERE case_id=? AND origin_key=?', (case_id, origin_key)).fetchone()
                if row:
                    return self._claim(db, case_id, row['id'])
            if source:
                doc = document_in_db(db, case_id, source['document_id'])
                page = next((p for p in (doc or {}).get('pages', []) if p['id'] == source['section_id']), None)
                if not page or page['text'][source['start_offset']:source['end_offset']] != source['excerpt']:
                    raise HTTPException(422, 'Claim source reference/offsets do not match a saved case section.')
            timestamp, claim_id = now(), str(uuid4())
            claim = {**payload.model_dump(mode='json'), 'id': claim_id, 'case_id': case_id, 'origin': origin,
                'origin_reference': origin_reference, 'source': source, 'revision': 1, 'created_at': timestamp, 'updated_at': timestamp}
            db.execute('INSERT INTO research_claims VALUES (?,?,?,?)', (claim_id, case_id, origin_key, json.dumps(claim)))
            db.execute('INSERT INTO claim_revisions VALUES (?,?,?)', (claim_id, 1, json.dumps({'revision':1,'timestamp':timestamp,'reason':'Created','values':claim})))
            return self._claim(db, case_id, claim_id)

    def edit(self, case_id, claim_id, payload):
        with self.store.connection() as db:
            db.execute('BEGIN IMMEDIATE')
            claim = self._claim(db, case_id, claim_id)
            if claim['revision'] != payload.expected_revision:
                raise HTTPException(409, 'Claim changed since loading. Reload before editing.')
            claim.pop('history', None); claim.pop('source_available', None)
            claim.update(text=payload.text, mapping=payload.mapping.model_dump(mode='json'), mapping_reviewed=payload.mapping_reviewed,
                         revision=claim['revision']+1, updated_at=now())
            db.execute('UPDATE research_claims SET payload=? WHERE id=? AND case_id=?', (json.dumps(claim), claim_id, case_id))
            db.execute('INSERT INTO claim_revisions VALUES (?,?,?)', (claim_id, claim['revision'], json.dumps({
                'revision':claim['revision'],'timestamp':claim['updated_at'],'reason':payload.reason,'values':claim})))
            invalidate_verifications(db, case_id)
            return self._claim(db, case_id, claim_id)

    def import_finding(self, case_id, analysis_run_id, finding):
        mapping = ClaimMapping(assertion_type='qualitative')
        receipts = FinancialStore(self.store).list_receipts(case_id)
        if finding.get('receipt_ids'):
            receipt = next((r for r in receipts if r['id'] == finding['receipt_ids'][0]), None)
            if receipt:
                values = list(receipt['inputs'].values())
                mapping = ClaimMapping(assertion_type='numerical', target=receipt['calculation_type'],
                    entity=values[0]['entity'], asserted_value=receipt['display_result'],
                    unit='percent' if receipt['result_unit']=='%' else 'ratio', currency=values[0]['currency'],
                    periods=[receipt['inputs'][r]['reporting_period'] for r in ('previous','current') if receipt['inputs'][r]['reporting_period']] if receipt['calculation_type']=='revenue_growth'
                        else [values[0]['reporting_period']] if values[0]['reporting_period'] else [],
                    accounting_scope=values[0]['accounting_scope'], rounding_places=2, temporal_scope='historical')
        return self.add(case_id, ClaimInput(text=finding['text'], mapping=mapping, mapping_reviewed=mapping.assertion_type=='numerical'),
            origin='analysis_finding', origin_reference=f'{analysis_run_id}:{finding["id"]}', origin_key=f'{analysis_run_id}:{finding["id"]}')

    def snapshot(self, case_id, claim, request):
        case = self.store.get_case(case_id)
        documents, length = [], 0
        for document_id in dict.fromkeys(request.supporting_document_ids):
            if claim.get('source') and claim['source']['document_id'] == document_id:
                raise HTTPException(422, 'The checked note cannot corroborate its own claim. Choose separate supporting documents.')
            doc = self.store.get_document(case_id, document_id)
            length += sum(len(page['text']) for page in doc['pages'])
            if length > 3_000_000:
                raise HTTPException(422, 'Supporting scope exceeds 3 million text characters.')
            as_of, published = case.get('research_as_of_date'), doc.get('publication_date')
            included = not (as_of and published and published > as_of)
            documents.append(SnapshotDocument(document=doc, content_hash=content_hash(doc), included=included,
                exclusion_reason=None if included else 'Published after research-as-of date.'))
        included = {d.document.id for d in documents if d.included}
        facts = [FactSnapshot.model_validate({k:v for k,v in f.items() if k!='history'}) for f in FinancialStore(self.store).list_facts(case_id) if f['document_id'] in included]
        if len(facts)>1000:
            raise HTTPException(422, 'Supporting fact catalog exceeds 1000 facts.')
        receipts = []
        saved_receipts = FinancialStore(self.store).list_receipts(case_id)
        for receipt_id in dict.fromkeys(request.receipt_ids):
            receipt = next((r for r in saved_receipts if r['id']==receipt_id), None)
            if not receipt or receipt['status']!='valid' or any(f['document_id'] not in included for f in receipt['inputs'].values()):
                raise HTTPException(422, 'Select a valid case receipt using only included supporting documents.')
            receipts.append(receipt)
        return AnalysisSnapshot(case=case,documents=documents,facts=facts,selected_receipts=receipts)

    def create_run(self, case_id, claim_id, request):
        if request.previous_run_id is None:
            with self.store.connection() as db:
                previous=db.execute('SELECT id FROM verification_runs WHERE case_id=? AND claim_id=? ORDER BY rowid DESC LIMIT 1',
                    (case_id,claim_id)).fetchone()
            if previous:
                request=request.model_copy(update={'previous_run_id':previous['id']})
        if request.previous_run_id:
            previous=self.get_run(case_id,request.previous_run_id)
            if previous['claim_id']!=claim_id:
                raise HTTPException(422,'Retry predecessor must check the same claim in this case.')
        claim = self.claim(case_id,claim_id)
        snapshot = self.snapshot(case_id,claim,request)
        primary,fallback = model_configuration()
        warnings = [f'Unknown publication date: {d.document.title}.' for d in snapshot.documents if d.included and not d.document.publication_date]
        if claim['mapping']['temporal_scope']=='current':
            warnings.append('Current-condition claim: selected historical documents do not establish that conditions persist today.')
        run = {'id':str(uuid4()),'case_id':case_id,'claim_id':claim_id,'status':'queued','stale':False,'stale_reasons':[],
            'created_at':now(),'started_at':None,'finished_at':None,'claim_snapshot':claim,'snapshot':snapshot.model_dump(mode='json'),
            'requested_model':{'primary':primary,'fallback':fallback,'observed_serving_model':None},'result':None,'evidence':[],
            'events':[],'errors':[],'warnings':warnings,'attempts':[],'repairs':[],'previous_run_id':request.previous_run_id}
        with self.store.connection() as db:
            db.execute('BEGIN IMMEDIATE')
            if db.execute("SELECT id FROM verification_runs WHERE claim_id=? AND status IN ('queued','running')",(claim_id,)).fetchone():
                raise HTTPException(409,'A verification is already active for this claim.')
            db.execute('INSERT INTO verification_runs VALUES (?,?,?,?,?)',(run['id'],case_id,claim_id,'queued',json.dumps(run)))
        return run

    def save_run(self,run,event=None):
        with self.store.connection() as db:
            db.execute('BEGIN IMMEDIATE')
            changed=verification_changes(db,run)
            if changed:
                run['stale']=True; run['stale_reasons']=list(dict.fromkeys(run['stale_reasons']+changed))
            if event:
                run['events'].append({'timestamp':now(),'stage':event[0],'message':event[1]})
            db.execute('UPDATE verification_runs SET status=?,payload=? WHERE id=? AND case_id=?',
                       (run['status'],json.dumps(run),run['id'],run['case_id']))

    def get_run(self,case_id,run_id):
        with self.store.connection() as db:
            row=db.execute('SELECT payload FROM verification_runs WHERE id=? AND case_id=?',(run_id,case_id)).fetchone()
            if not row:
                raise HTTPException(404,'Verification run not found in this case.')
            run=json.loads(row['payload'])
            changes=verification_changes(db,run)
            if changes:
                run['stale']=True; run['stale_reasons']=list(dict.fromkeys(run['stale_reasons']+changes))
                db.execute('UPDATE verification_runs SET payload=? WHERE id=?',(json.dumps(run),run_id))
            ids={d['document']['id'] for d in run['snapshot']['documents']}
            if run['claim_snapshot'].get('source'):
                ids.add(run['claim_snapshot']['source']['document_id'])
            run['source_availability']={i:document_in_db(db,case_id,i) is not None for i in ids}
            return run

    def runs(self,case_id):
        self.store.get_case(case_id)
        with self.store.connection() as db:
            ids=[r['id'] for r in db.execute('SELECT id FROM verification_runs WHERE case_id=? ORDER BY rowid DESC',(case_id,)).fetchall()]
        return [self.get_run(case_id,i) for i in ids]

    def interrupt_active(self):
        with self.store.connection() as db:
            for row in db.execute("SELECT payload FROM verification_runs WHERE status IN ('queued','running')").fetchall():
                run=json.loads(row['payload']); run.update(status='interrupted',finished_at=now(),result=None)
                run['errors'].append('Backend restarted before verification finished; no automatic resume.')
                run['events'].append({'timestamp':now(),'stage':'interrupted','message':run['errors'][-1]})
                db.execute("UPDATE verification_runs SET status='interrupted',payload=? WHERE id=?",(json.dumps(run),run['id']))
