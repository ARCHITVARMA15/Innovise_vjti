import hashlib
import json
import threading
from decimal import Decimal
from uuid import uuid4
from fastapi import HTTPException
from app.research.models import DocumentMetadata
from app.research.calculations import canonical, normalized_value
from app.research.store import now

_IMPORT_LOCK=threading.Lock()

def validate_structured_context(db,case_id,values):
    row=db.execute('SELECT payload FROM automation_contexts WHERE case_id=? AND section_id=?',(case_id,values.section_id)).fetchone()
    if not row:return None
    context=json.loads(row[0]);expected=context['expected']
    same_amount=(normalized_value(values.value,values.scale)==normalized_value(expected['value'],expected['scale'])) if values.scale else Decimal(values.value)==Decimal(expected['value'])
    if not same_amount or values.metric!=expected['metric']:
        raise HTTPException(422,'Value/metric does not match the exact structured source record. Select the correct source context; do not relabel another number.')
    for field in ('entity','currency','period_type','period_start','period_end','accounting_scope'):
        actual=getattr(values,field)
        if field=='accounting_scope' and not expected.get(field):continue
        if actual is not None and str(actual)!=str(expected[field]):
            if field=='entity' and canonical(actual)==canonical(expected[field]):continue
            raise HTTPException(422,f'Structured fact {field} does not match its saved accession/context.')
    return context['provenance']

def import_source(research,case_id,source,identity,title,publication_date,period,kind,pages,*,extra=None,contexts=None):
    digest=hashlib.sha256(source['data']).hexdigest()
    retrieval={k:v for k,v in source.items() if k not in ('data','cached_at')}
    retrieval.update(identity=identity,content_hash=digest,selection=extra or {})
    with _IMPORT_LOCK:
        with research.connection() as db:
            research._case(db,case_id)
            found=db.execute('SELECT document_id FROM automation_sources WHERE case_id=? AND identity=? AND content_hash=?',(case_id,identity,digest)).fetchone()
            if found:
                try:return research.get_document(case_id,found['document_id']),False
                except HTTPException:raise HTTPException(409,'A previously imported source was removed. Its historical provenance is retained; explicitly upload a replacement instead of silently recreating it.') from None
        # Recover an import interrupted after document creation but before source registration.
        existing=next((d for d in research.list_documents(case_id) if (d.get('retrieval') or {}).get('identity')==identity and (d.get('retrieval') or {}).get('content_hash')==digest),None)
        if existing:document=research.get_document(case_id,existing['id'])
        else:
            document=research.add_document(case_id,DocumentMetadata(title=title,publication_date=publication_date,reporting_period=period,
                source_url=source['final_url'],document_type='SEC official '+('10-K' if kind in ('html','pdf') else 'XBRL JSON record projection')),
                kind,None,source['data'],pages,retrieval=retrieval)
        with research.connection() as db:
            db.execute('INSERT OR IGNORE INTO automation_sources VALUES(?,?,?,?,?,?)',(str(uuid4()),case_id,identity,digest,document['id'],json.dumps(retrieval,default=str)))
            if contexts:
                for page,ctx in zip(document['pages'],contexts):
                    db.execute('INSERT OR IGNORE INTO automation_contexts VALUES(?,?,?)',(page['id'],case_id,json.dumps(ctx,default=str)))
        return document,not bool(existing)
