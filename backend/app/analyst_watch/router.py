import asyncio
import os
from urllib.parse import urlparse
from fastapi import APIRouter, HTTPException, Request
from starlette.responses import JSONResponse
from app.research.models import CaseCreate
from .models import SettingsInput, Publish, Intent, Reconcile
from .engine import DemoProvider
from .provider import config, TwilioProvider, ProviderFailure, public_url

router=APIRouter(prefix='/analyst-watch',tags=['Analyst Watch'])

def store(request):
    result=getattr(request.app.state,'watch_store',None)
    if result is None:raise HTTPException(503,'Analyst Watch worker is not running.')
    return result

@router.get('')
def dashboard(request:Request):return store(request).view(config())

@router.post('/settings')
def settings(payload:SettingsInput,request:Request):return store(request).update(payload,config())

@router.post('/demo-console/publish')
def publish(payload:Publish,request:Request):
    snapshot=DemoProvider().snapshot(payload.scenario,payload.event_id)
    return store(request).ingest(snapshot,payload.scenario,config(),payload.new_demo_replay)

@router.post('/alerts/{alert_id}/acknowledge')
def acknowledge(alert_id:str,request:Request):return store(request).acknowledge(alert_id)

@router.post('/alerts/{alert_id}/notify')
def notify(alert_id:str,payload:Intent,request:Request):return store(request).notify(alert_id,payload,config())

@router.post('/notifications/test')
def test(payload:Intent,request:Request):return store(request).test_intent(payload,config())

@router.post('/notifications/check')
async def check(request:Request):
    store(request)
    try:return await asyncio.to_thread(TwilioProvider().check)
    except ProviderFailure as error:raise HTTPException(502,{'code':error.code,'message':error.safe_message}) from None

@router.post('/notifications/{notification_id}/reconcile')
async def reconcile(notification_id:str,payload:Reconcile,request:Request):
    store(request)
    try:return await request.app.state.watch_worker.reconcile(notification_id,payload.message_sid)
    except ProviderFailure as error:raise HTTPException(409,{'code':error.code,'message':error.safe_message}) from None

@router.post('/notifications/{notification_id}/retry')
def retry(notification_id:str,request:Request):return store(request).retry(notification_id,config())

@router.post('/research-case')
def research_case(request:Request):
    from app.research.store import ResearchStore, research_directory
    watch=store(request);research=ResearchStore(research_directory())
    with watch.connection() as db:
        db.execute('BEGIN IMMEDIATE');s=watch.settings(db)
        if not s.get('case_id'):
            existing=next((c for c in research.list_cases() if c['company_name']=='Aster Technologies — Demo'),None)
            c=existing or research.create_case(CaseCreate(title='Aster Technologies — Demo: simulated financial changes',company_name='Aster Technologies — Demo',research_question='Investigate simulated quarterly financial changes. These figures are fictional demo inputs, not real-company disclosures.',reporting_period='Q1 and Q2 2025',research_as_of_date='2025-06-30'))
            s['case_id']=c['id'];watch.save_settings(db,s)
        return {'case_id':s['case_id']}

class WatchGuard:
    """Local demo write boundary: no cross-origin browser sends or oversized bodies."""
    def __init__(self,app):self.app=app
    async def __call__(self,scope,receive,send):
        if scope['type']!='http' or not scope.get('path','').startswith('/analyst-watch') or scope['method'] in ('GET','HEAD','OPTIONS'):
            return await self.app(scope,receive,send)
        headers=dict(scope['headers']);origin=headers.get(b'origin',b'').decode()
        allowed={'http://localhost:3000','http://127.0.0.1:3000',*(x.strip() for x in os.getenv('ANALYST_WATCH_ALLOWED_ORIGINS','').split(',') if x.strip())}
        url=public_url(os.getenv('PUBLIC_APP_URL'))
        if url:
            parsed=urlparse(url);allowed.add(f'{parsed.scheme}://{parsed.netloc}')
        if origin and origin not in allowed:return await JSONResponse({'detail':'Analyst Watch writes are limited to configured local application origins.'},403)(scope,receive,send)
        data=b''
        while True:
            message=await receive()
            if message['type']=='http.disconnect':return
            data+=message.get('body',b'')
            if len(data)>16384:return await JSONResponse({'detail':'Analyst Watch request exceeds 16 KiB.'},413)(scope,receive,send)
            if not message.get('more_body'):break
        async def replay():return {'type':'http.request','body':data,'more_body':False}
        await self.app(scope,replay,send)
