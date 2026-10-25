import re
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Request
from starlette.responses import JSONResponse
from app.research.router import get_store
from app.research.store import ResearchStore, now
from .models import Start, Clarify, BatchReview, Continue, Fallback
from .network import user_agent, RetrievalError, validate_url
from .store import AutomationStore, encode

router=APIRouter(tags=['Ask Dexter Automation'])
Research=Annotated[ResearchStore,Depends(get_store)]

def manager(request):
    result=getattr(request.app.state,'automation_manager',None)
    if result is None:raise HTTPException(503,'Automation worker is unavailable; manual research remains usable.')
    return result

@router.get('/research/automation/config')
def configuration():
    try:user_agent();ready=True
    except RetrievalError:ready=False
    return {'provider':'SEC EDGAR','configured':ready,'forms':['10-K'],'countries':['US SEC filers using supported US-GAAP tags'],
            'limits':{'requests':24,'documents':4,'candidates':30,'runtime_seconds':240,'fallback_sections':2},
            'notice':'Official SEC retrieval only. Human fact confirmation and report approval remain separate.'}

@router.post('/research/automation',status_code=202)
async def create(payload:Start,request:Request,research:Research):
    run=AutomationStore(research).create(payload)
    if run['status']=='queued':manager(request).schedule(run)
    return run

@router.post('/research/cases/{case_id}/automation',status_code=202)
async def create_in_case(case_id:str,payload:Start,request:Request,research:Research):
    run=AutomationStore(research).create(payload,case_id)
    if run['status']=='queued':manager(request).schedule(run)
    return run

@router.get('/research/cases/{case_id}/automation')
def history(case_id:str,research:Research):return AutomationStore(research).list(case_id)

@router.get('/research/cases/{case_id}/automation/{rid}')
def detail(case_id:str,rid:str,research:Research):
    store=AutomationStore(research);run=store.get(case_id,rid);run['candidates']=store.candidates(run)
    return run

def mutable(store,case_id,rid,revision,allowed):
    run=store.get(case_id,rid);run.pop('events',None)
    if run['revision']!=revision:raise HTTPException(409,'Automation changed; reload before taking this action.')
    if run['status'] not in allowed:raise HTTPException(409,'This action is unavailable while the task is active or after an immutable continuation. Start a new automation for a new scope.')
    return run

@router.post('/research/cases/{case_id}/automation/{rid}/clarify',status_code=202)
async def clarify(case_id:str,rid:str,payload:Clarify,request:Request,research:Research):
    store=AutomationStore(research);run=mutable(store,case_id,rid,payload.expected_revision,{'needs_input','blocked'})
    if payload.company and payload.company!=run['request'].get('company'):
        if run['document_ids']:raise HTTPException(409,'Changing company after import requires a new automation; existing sources were preserved.')
        run['scope']=None;run['request']['company']=payload.company
    if payload.year_basis:run['request']['year_basis']=payload.year_basis
    run.update(status='queued',questions=[],cancel_requested=False);store.save(run,clear_cancel=True);return manager(request).schedule(run)

@router.post('/research/cases/{case_id}/automation/{rid}/review')
def review(case_id:str,rid:str,payload:BatchReview,research:Research):return AutomationStore(research).review(case_id,rid,payload)

@router.post('/research/cases/{case_id}/automation/{rid}/continue',status_code=202)
async def continue_run(case_id:str,rid:str,payload:Continue,request:Request,research:Research):
    store=AutomationStore(research);run=store.get(case_id,rid)
    if run['analysis_run_id'] or (run['stage']=='calculate_verify_report' and run['status']=='running'):return run
    run=mutable(store,case_id,rid,payload.expected_revision,{'awaiting_review','blocked'})
    if not run['selected_fact_ids']:raise HTTPException(409,'Confirm selected reviewed facts first.')
    run.update(status='queued',stage='continue',allow_partial=payload.allow_partial,cancel_requested=False,blockers=[]);store.save(run)
    return manager(request).schedule(run,continuation=True)

@router.post('/research/cases/{case_id}/automation/{rid}/retry',status_code=202)
async def retry(case_id:str,rid:str,payload:Continue,request:Request,research:Research):
    store=AutomationStore(research);run=mutable(store,case_id,rid,payload.expected_revision,{'blocked','failed','interrupted','cancelled','queued'})
    if run['analysis_run_id']:raise HTTPException(409,'Linked analysis execution is retained and is not crash-resumed. Inspect Analysis/Report or start a new automation with the saved inputs.')
    run.update(status='queued',cancel_requested=False,blockers=[]);store.save(run,clear_cancel=True);return manager(request).schedule(run)

@router.post('/research/cases/{case_id}/automation/{rid}/cancel')
def cancel(case_id:str,rid:str,payload:Continue,research:Research):
    store=AutomationStore(research);run=mutable(store,case_id,rid,payload.expected_revision,{'queued','running'})
    run['cancel_requested']=True
    # save() deliberately merges the database cancellation flag, so set it transactionally here.
    with research.connection() as db:
        db.execute('BEGIN IMMEDIATE');fresh=store.read(db,case_id,rid)
        if fresh['revision']!=payload.expected_revision:raise HTTPException(409,'Task progressed; reload before cancelling.')
        fresh['cancel_requested']=True;fresh['revision']+=1
        db.execute('UPDATE automation_runs SET revision=?,payload=? WHERE id=?',(fresh['revision'],encode(fresh),rid))
    return fresh

@router.post('/research/cases/{case_id}/automation/{rid}/fallback',status_code=202)
async def fallback(case_id:str,rid:str,payload:Fallback,request:Request,research:Research):
    store=AutomationStore(research);run=mutable(store,case_id,rid,payload.expected_revision,{'blocked','awaiting_review'})
    filing=next((f for f in run['filings'] if f['accessionNumber']==payload.accession),None)
    if not filing:raise HTTPException(422,'Select a discovered filing accession for fallback.')
    if payload.document_id:
        research.get_document(case_id,payload.document_id)
        run.setdefault('manual_documents',{})[payload.accession]=payload.document_id
        run['imported_filings']=[f for f in run['imported_filings'] if f['accessionNumber']!=payload.accession]
    elif payload.source_url:
        validate_url(payload.source_url)
        if payload.source_url!=filing['url']:raise HTTPException(422,'This slice supports the discovered official primary SEC URL only. Upload issuer PDF/text manually for other hosts.')
    else:raise HTTPException(422,'Choose a case document or the supported source URL.')
    if run['candidate_ids']:raise HTTPException(409,'Candidates already exist. Start a new automation to select a replacement source without changing their provenance.')
    run.update(status='queued',cancel_requested=False,blockers=[],preparation_complete=False);store.save(run,clear_cancel=True);return manager(request).schedule(run)

class AutomationIntakeLimit:
    def __init__(self,app):self.app=app
    async def __call__(self,scope,receive,send):
        path=scope.get('path','')
        if scope['type']!='http' or scope.get('method')!='POST' or not (path.startswith('/research/automation') or re.match(r'^/research/cases/[^/]+/automation(?:/|$)',path)):
            return await self.app(scope,receive,send)
        body=b''
        while True:
            message=await receive()
            if message['type']=='http.disconnect':return
            body+=message.get('body',b'')
            if len(body)>262144:return await JSONResponse({'detail':'Automation request exceeds 256 KiB.'},413)(scope,receive,send)
            if not message.get('more_body'):break
        async def replay():return {'type':'http.request','body':body,'more_body':False}
        return await self.app(scope,replay,send)
