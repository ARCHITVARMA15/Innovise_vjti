"""Offline watch acceptance tests. All provider I/O is mocked; no real sends."""
import asyncio
import json
import tempfile
import time
import unittest
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from datetime import date, datetime, timezone
from email.utils import format_datetime
from pathlib import Path
from unittest.mock import patch
import requests
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from app.analyst_watch.engine import DemoProvider, evaluate, compatible, kpis
from app.analyst_watch.models import Rules, SettingsInput, Intent, Reconcile
from app.analyst_watch.store import WatchStore
from app.analyst_watch.provider import Config, TwilioProvider, ProviderFailure, reference, public_url, config, safe_error
from app.analyst_watch.router import router, WatchGuard
from app.analyst_watch.service import WatchWorker

CFG=Config(sid='AC'+'a'*32,token='test-secret',sender='whatsapp:+15555550001',recipient='whatsapp:+15555550002')

class WatchTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.path=Path(self.temp.name)/'watch.sqlite3';self.store=WatchStore(self.path);self.provider=DemoProvider()
        self.no_network=patch('requests.request',side_effect=AssertionError('All provider requests must be explicitly mocked.'));self.no_network.start()
    def tearDown(self):self.no_network.stop();self.temp.cleanup()
    def enable(self,delivery=True,monitoring=True,watched=True):
        return self.store.update(SettingsInput(watched=watched,monitoring_enabled=monitoring,whatsapp_enabled=delivery,rules=Rules()),CFG)
    def publish(self,scenario='earnings_shock',key=None,replay=False):
        key=key or 'event-'+__import__('uuid').uuid4().hex
        return self.store.ingest(self.provider.snapshot(scenario,key),scenario,CFG,replay)
    def old_jobs(self):
        with self.store.connection() as db:
            for j in self.store.objects(db,'aw_outbox'):
                j.update(created_at='2000-01-01T00:00:00Z',updated_at='2000-01-01T00:00:00Z',last_attempt_at='2000-01-01T00:00:00Z');self.store.save_job(db,j)
    def test_shock_exact_decimal_calculations_and_one_consolidated_intent(self):
        self.enable();e=self.publish();v=self.store.view(CFG)
        self.assertEqual(len(v['alerts']),1);self.assertEqual(len(v['notifications']),1)
        a=v['alerts'][0];r={c['name']:c for c in a['analysis']['calculations']}
        self.assertEqual(r['revenue_change']['result'],'-25.00')
        self.assertEqual(r['net_margin_change']['result'],'-16.00')
        self.assertEqual(r['net_margin_change']['unit'],'pp')
        self.assertEqual(r['current_ratio_change']['result'],'-0.65')
        self.assertEqual(r['net_income_change']['result'],'-15')
        self.assertEqual(a['analysis']['current']['values']['net_margin'],'-4.00')
        self.assertEqual(a['analysis']['current']['values']['current_ratio'],'0.95')
        self.assertEqual(len(a['analysis']['breaches']),4)
        self.assertIn('DEMO',v['notifications'][0]['message']);self.assertNotIn('localhost',v['notifications'][0]['message'])
        self.assertEqual(v['notifications'][0]['state'],'pending');self.assertEqual(v['notifications'][0]['attempts'],0)
        self.assertEqual(v['active']['source_type'],'simulated');self.assertNotEqual(v['active']['period_end'],v['active']['observed_at'][:10])
    def test_stable_positive_and_liquidity_rules(self):
        self.enable()
        for scenario in ('stable','positive_results'):
            e=self.publish(scenario);self.assertFalse(e['analysis']['breaches']);self.assertIsNone(e['alert_id'])
        e=self.publish('liquidity_deterioration')
        self.assertEqual([b['rule'] for b in e['analysis']['breaches']],['liquidity_crossing'])
        self.assertEqual(len(self.store.view(CFG)['notifications']),1)
    def test_missing_zero_and_incompatible_inputs(self):
        a=self.provider.snapshot('baseline','baseline-test');b=self.provider.snapshot('earnings_shock','snapshot-test')
        a.values['revenue']=0;b.values['current_liabilities']=0
        out=evaluate(a,b,Rules());self.assertIsNone(out['previous']['values']['net_margin']);self.assertIsNone(out['current']['values']['current_ratio']);self.assertGreaterEqual(len(out['gaps']),3)
        b.values.pop('net_income');self.assertTrue(any('missing' in g.lower() for g in evaluate(a,b,Rules())['gaps']))
        for field,value in [('currency','EUR'),('accounting_basis','standalone'),('company_id','another'),('period_start',date(2025,5,1)),('period_end',date(2025,6,29))]:
            c=self.provider.snapshot('earnings_shock','snapshot-test');setattr(c,field,value)
            with self.assertRaises(ValueError):compatible(a,c)
    def test_concurrent_repeated_event_requests_are_transactionally_idempotent(self):
        self.enable();snapshot=self.provider.snapshot('earnings_shock','same-event-123456')
        with ThreadPoolExecutor(max_workers=4) as pool:results=list(pool.map(lambda _:self.store.ingest(snapshot,'earnings_shock',CFG),range(4)))
        self.assertEqual(len({r['alert_id'] for r in results}),1)
        view=self.store.view(CFG);self.assertEqual((len(view['events']),len(view['alerts']),len(view['notifications'])),(1,1,1))
        snapshot.values['revenue']=70
        with self.assertRaises(HTTPException):self.store.ingest(snapshot,'earnings_shock',CFG)
    def test_duplicate_cooldown_deliberate_replay_and_rate_limit(self):
        self.enable();self.publish();second=self.publish()
        view=self.store.view(CFG);self.assertIsNotNone(view['alerts'][0]['duplicate_of']);self.assertEqual(len(view['notifications']),1)
        self.assertIn('cooldown',second['notification_note'])
        third=self.publish(replay=True);self.assertIn('rate limit',third['notification_note'])
        self.old_jobs();fourth=self.publish(replay=True);self.assertIn('queued',fourth['notification_note']);self.assertEqual(len(self.store.view(CFG)['notifications']),2)
    def test_reset_preserves_audit_and_never_sends(self):
        self.enable();self.publish();before=self.store.view(CFG);self.publish('reset');after=self.store.view(CFG)
        self.assertEqual(after['active']['values']['revenue'],'100');self.assertEqual(len(after['alerts']),1);self.assertEqual(len(after['notifications']),1)
        self.assertEqual(after['active']['period_end'],'2025-03-31');self.assertEqual(len(after['events']),2)
        self.assertEqual(before['alerts'][0],after['alerts'][0])
    def test_paused_removed_missing_credentials_and_disabled_delivery(self):
        for monitoring,watched in [(False,True),(True,False)]:
            self.enable(True,monitoring,watched);self.assertIsNone(self.publish()['alert_id'])
        self.enable(False);self.publish();self.assertFalse(self.store.view(CFG)['notifications'])
        self.enable(True);s=self.provider.snapshot('earnings_shock','missing-config-event')
        e=self.store.ingest(s,'earnings_shock',Config());self.assertIn('incomplete',e['notification_note']);self.assertFalse(self.store.view(CFG)['notifications'])
    def test_acknowledgement_rules_and_restart_preserve_evidence(self):
        self.enable();e=self.publish();view=self.store.view(CFG);a=view['alerts'][0];self.store.acknowledge(a['id'])
        self.store.update(SettingsInput(monitoring_enabled=True,whatsapp_enabled=False,rules=Rules(revenue_decline_percent=40)),CFG)
        reopened=WatchStore(self.path).view(CFG)
        self.assertEqual(reopened['alerts'][0]['rules'],a['rules']);self.assertEqual(reopened['alerts'][0]['baseline'],a['baseline']);self.assertIsNotNone(reopened['alerts'][0]['acknowledged_at'])
        self.assertEqual(reopened['notifications'][0]['state'],'failed')
    def test_restart_uncertainty_retry_and_monotone_provider_states(self):
        self.enable();self.publish();job=self.store.claim();self.assertEqual(job['state'],'sending')
        self.store.startup();job=self.store.view(CFG)['notifications'][0];self.assertEqual(job['state'],'unknown');self.assertIsNone(self.store.claim())
        with self.assertRaises(HTTPException):self.store.retry(job['id'])
        self.store.outcome(job['id'],{'state':'provider-accepted','message_sid':'SM'+'b'*32})
        self.store.startup();self.assertEqual(self.store.view(CFG)['notifications'][0]['state'],'provider-accepted')
        self.store.outcome(job['id'],{'state':'delivered'});self.store.outcome(job['id'],{'state':'sent'});self.assertEqual(self.store.view(CFG)['notifications'][0]['state'],'delivered')
    def test_known_failure_retry_limits_and_explicit_test_send_intent(self):
        self.enable();j=self.store.test_intent(Intent(request_id='explicit-test-request'),CFG)['notification'];self.assertIsNone(j['alert_id']);self.assertIn('explicit preflight test',j['message'])
        self.assertEqual(self.store.test_intent(Intent(request_id='explicit-test-request'),CFG)['notification']['id'],j['id'])
        self.store.claim();self.store.outcome(j['id'],{'state':'failed','error_code':'20003','error_message':'Authentication failed.'});self.old_jobs()
        self.assertEqual(self.store.retry(j['id'])['state'],'pending')
    def fake_http(self,method,url,**kwargs):
        class Response:
            status_code=200
            def __init__(self,data):self.data=data
            def json(self):return self.data
        if url.endswith('/Messages.json') and method=='POST':return Response({'sid':'SM'+'b'*32,'status':'queued'})
        if url.endswith('/Messages.json'):
            return Response({'messages':[{'direction':'inbound','from':CFG.recipient,'to':CFG.sender,'date_sent':format_datetime(datetime.now(timezone.utc))}]})
        if 'ApprovalRequests' in url:return Response({'whatsapp':{'status':'approved'}})
        if 'content.twilio.com' in url:return Response({'types':{'twilio/text':{'body':'DEMO Analyst Watch: {{1}}. {{2}}. Ref {{3}}.'}}})
        return Response({'type':'Full','status':'active'})
    def test_provider_acceptance_is_not_delivery_and_unknown_post_not_retried(self):
        self.enable();self.publish();job=self.store.claim();p=TwilioProvider(CFG)
        with patch('requests.request',side_effect=self.fake_http) as network:
            result=p.send(job);self.assertEqual(result['state'],'provider-accepted')
            posts=[c for c in network.call_args_list if c.args[0]=='POST'];self.assertEqual(len(posts),1)
            fields=posts[0].kwargs['data'];self.assertIn('Body',fields);self.assertNotIn('ContentSid',fields);self.assertEqual(fields['To'],CFG.recipient)
        def timeout(method,url,**kwargs):
            if method=='POST':raise requests.ReadTimeout('secret should never escape')
            return self.fake_http(method,url,**kwargs)
        with patch('requests.request',side_effect=timeout) as network:
            with self.assertRaises(ProviderFailure) as error:p.send(job)
            self.assertTrue(error.exception.uncertain);self.assertNotIn('secret',str(error.exception));self.assertEqual(sum(c.args[0]=='POST' for c in network.call_args_list),1)
    def test_trial_window_and_template_restrictions(self):
        class Response:
            status_code=200
            def json(self):return {'type':'Trial','status':'active'}
        with patch('requests.request',return_value=Response()) as network:
            result=TwilioProvider(CFG).check();self.assertFalse(result['delivery_ready']);self.assertIn('No recent matching inbound',result['restriction']);self.assertFalse(any(c.args[0]=='POST' for c in network.call_args_list))
        def trial_with_window(method,url,**kwargs):
            if url.endswith('.json') and '/Messages' not in url:return Response()
            return self.fake_http(method,url,**kwargs)
        with patch('requests.request',side_effect=trial_with_window):
            result=TwilioProvider(CFG).check()
            self.assertEqual(result['account_type'],'Trial')
            self.assertTrue(result['delivery_ready'])
            self.assertIn('recent inbound',result['session'])
        cfg=Config(sid=CFG.sid,token=CFG.token,sender=CFG.sender,recipient=CFG.recipient,content_sid='HX'+'c'*32)
        self.enable();e=self.provider.snapshot('earnings_shock','template-event-test');self.store.ingest(e,'earnings_shock',cfg);job=self.store.claim()
        with patch('requests.request',side_effect=self.fake_http) as network:
            result=TwilioProvider(cfg).send(job)
            fields=next(c.kwargs['data'] for c in network.call_args_list if c.args[0]=='POST');self.assertIn('ContentSid',fields);self.assertNotIn('Body',fields);self.assertEqual(json.loads(fields['ContentVariables']),job['variables'])
        with patch.object(TwilioProvider,'request',side_effect=[{'types':{'twilio/text':{'body':'Appointment {{1}} {{2}} {{3}}'}}},{'whatsapp':{'status':'approved'}}]):
            with self.assertRaises(ProviderFailure):TwilioProvider(cfg).template()
    def test_reconciliation_matches_saved_recipient_and_body(self):
        self.enable();self.publish();job=self.store.claim();sid='SM'+'b'*32
        data={'to':CFG.recipient,'from':CFG.sender,'body':job['message'],'status':'delivered'}
        with patch.object(TwilioProvider,'request',return_value=data):self.assertEqual(TwilioProvider(CFG).inspect(job,sid)['state'],'delivered')
        with patch.object(TwilioProvider,'request',return_value={**data,'body':'Unrelated message'}):
            with self.assertRaises(ProviderFailure):TwilioProvider(CFG).inspect(job,sid)
        with patch.object(TwilioProvider,'request',return_value={**data,'to':'whatsapp:+15555559999'}):
            with self.assertRaises(ProviderFailure):TwilioProvider(CFG).inspect(job,sid)
    def test_public_url_and_safe_readiness_no_credentials_or_phone_leak(self):
        for url in ('http://localhost:3000','https://localhost:3000','https://127.0.0.1','https://10.0.0.1','https://[::1]','https://name:secret@example.com','https://demo.example.com?a=secret'):
            self.assertIsNone(public_url(url))
        self.assertEqual(public_url('https://demo.example.com'),'https://demo.example.com')
        encoded=json.dumps(self.store.view(CFG));self.assertNotIn(CFG.token,encoded);self.assertNotIn(CFG.sid,encoded);self.assertNotIn(CFG.recipient,encoded);self.assertIn('0002',encoded)
    def test_local_env_edits_override_stale_process_values_without_restart(self):
        stale={'TWILIO_ACCOUNT_SID':'AC'+'a'*32,'TWILIO_AUTH_TOKEN':'old-token',
               'TWILIO_WHATSAPP_TO':'+15555550003','TWILIO_WHATSAPP_FROM':'+15555550004',
               'TWILIO_CONTENT_SID':'HX'+'a'*32}
        fresh={'TWILIO_ACCOUNT_SID':'AC'+'b'*32,'TWILIO_AUTH_TOKEN':'new-token',
               'TWILIO_WHATSAPP_TO':'+15555550002','TWILIO_WHATSAPP_NUMBER':'+15555550001',
               'TWILIO_WHATSAPP_FROM':'','TWILIO_CONTENT_SID':''}
        with patch.dict('os.environ',stale),patch('app.analyst_watch.provider.dotenv_values',return_value=fresh):
            first=config()
            self.assertEqual(first.recipient,'whatsapp:+15555550002')
            self.assertEqual(first.sender,'whatsapp:+15555550001')
            self.assertEqual(first.sid,'AC'+'b'*32)
            self.assertEqual(first.token,'new-token')
            self.assertEqual(first.content_sid,'')
            with patch('app.analyst_watch.provider.dotenv_values',return_value={**fresh,'TWILIO_WHATSAPP_TO':'+15555550005'}):
                self.assertEqual(config().recipient,'whatsapp:+15555550005')
        self.assertIn('not assigned',safe_error(572002))
    def test_api_guard_body_bound_and_server_only_recipient(self):
        app=FastAPI();app.include_router(router);app.add_middleware(WatchGuard);app.state.watch_store=self.store
        with TestClient(app) as c,patch('app.analyst_watch.router.config',return_value=CFG):
            self.assertEqual(c.get('/analyst-watch').status_code,200)
            self.assertEqual(c.post('/analyst-watch/demo-console/publish',json={'scenario':'earnings_shock','event_id':'api-event-123456789','recipient':'arbitrary'}).status_code,422)
            self.assertEqual(c.post('/analyst-watch/demo-console/publish',json={'scenario':'earnings_shock','event_id':'api-event-123456789'},headers={'origin':'https://evil.example'}).status_code,403)
            self.assertEqual(c.post('/analyst-watch/demo-console/publish',content='x'*17000).status_code,413)
            self.assertEqual(c.post('/analyst-watch/demo-console/publish',json={'scenario':'earnings_shock','event_id':'api-event-123456789'}).status_code,200)
    def test_backend_dispatch_runs_without_dashboard_or_llm(self):
        self.enable()
        fake=type('FakeProvider',(),{'send':lambda _,j:{'message_sid':'SM'+'b'*32,'state':'provider-accepted','provider_status':'queued'},'inspect':lambda _,j,s:{'message_sid':s,'state':'delivered','provider_status':'delivered'}})()
        worker=WatchWorker(self.store,lambda:fake)
        @asynccontextmanager
        async def lifespan(app):
            worker.start();yield;await worker.stop()
        app=FastAPI(lifespan=lifespan);app.include_router(router);app.state.watch_store=self.store;app.state.watch_worker=worker
        with TestClient(app) as c,patch('app.analyst_watch.router.config',return_value=CFG):
            # No GET/dashboard request is made before worker dispatch.
            response=c.post('/analyst-watch/demo-console/publish',json={'event_id':'headless-published-123456','scenario':'earnings_shock'});self.assertEqual(response.status_code,200,response.text)
            deadline=time.monotonic()+5
            while time.monotonic()<deadline:
                jobs=self.store.view(CFG)['notifications']
                if jobs and jobs[0]['state']=='provider-accepted':break
                time.sleep(.05)
            self.assertEqual(jobs[0]['state'],'provider-accepted')
            r=c.post('/analyst-watch/notifications/'+jobs[0]['id']+'/reconcile',json={});self.assertEqual(r.json()['state'],'delivered')
            self.assertEqual(len(self.store.view(CFG)['alerts']),1)

    def trial_config(self,variables=None):
        return Config(sid=CFG.sid,token=CFG.token,sender=CFG.sender,recipient=CFG.recipient,
            delivery_mode='trial_delivery_demo',trial_content_sid='HX'+'d'*32,
            trial_content_variables={} if variables is None else variables)

    def trial_job(self,cfg,event='trial-template-event-123456'):
        self.enable()
        e=self.provider.snapshot('earnings_shock',event)
        self.store.ingest(e,'earnings_shock',cfg)
        return self.store.claim()

    def test_trial_mode_sends_exact_console_shape_without_financial_substitution(self):
        cfg=self.trial_config();job=self.trial_job(cfg)
        self.assertEqual(job['delivery_mode'],'trial_delivery_demo')
        self.assertEqual(job['variables'],{})
        self.assertEqual(job['message'],'')
        self.assertEqual(job['content_sid'],cfg.trial_content_sid)
        self.assertEqual(len(self.store.view(cfg)['alerts'][0]['analysis']['breaches']),4)
        self.assertIn('financial alert details are available in Veritas',job['trial_notice'])
        class Response:
            status_code=200
            def __init__(self,data):self.data=data
            def json(self):return self.data
        def http(method,url,**kwargs):
            if method=='POST':return Response({'sid':'SM'+'d'*32,'status':'queued','body':'Twilio provided sample. Test message from Twilio.'})
            self.assertNotIn('content.twilio.com',url)
            self.assertNotIn('/Messages',url)
            return Response({'type':'Trial','status':'active'})
        with patch('requests.request',side_effect=http) as network:
            result=TwilioProvider(cfg).send(job)
            calls=[call for call in network.call_args_list if call.args[0]=='POST']
            self.assertEqual(len(calls),1)
            self.assertEqual(calls[0].kwargs['data'],{'To':CFG.recipient,'From':CFG.sender,'ContentSid':cfg.trial_content_sid})
            self.assertEqual(calls[0].kwargs['auth'],(CFG.sid,CFG.token))
            self.assertEqual(result['state'],'provider-accepted')
            self.assertIn('sample',result['provider_message_body'])
        self.store.outcome(job['id'],result)
        self.assertEqual(self.store.view(cfg)['notifications'][0]['state'],'provider-accepted')
        # Repeated event request keeps exactly one alert, intent and provider association.
        self.store.ingest(self.provider.snapshot('earnings_shock',job['event_id']),'earnings_shock',cfg)
        view=self.store.view(cfg)
        self.assertEqual((len(view['alerts']),len(view['notifications'])),(1,1))
        self.assertEqual(view['notification_config']['delivery_label'],'Trial delivery demo')
        self.assertIn('sample template',view['notification_config']['trial_notice'])

    def test_trial_static_console_variables_are_not_financial_placeholders(self):
        variables={'1':'2030-01-15','2':'10:00 AM'}
        cfg=self.trial_config(variables);job=self.trial_job(cfg)
        with patch('requests.request',side_effect=self.fake_http) as network:
            TwilioProvider(cfg).send(job)
            fields=next(call.kwargs['data'] for call in network.call_args_list if call.args[0]=='POST')
            self.assertNotIn('Body',fields)
            self.assertEqual(json.loads(fields['ContentVariables']),variables)
            self.assertEqual(job['variables'],variables)
            self.assertNotIn('Revenue',json.dumps(fields))
            self.assertNotIn('25.00',json.dumps(fields))
            self.assertFalse(any('content.twilio.com' in call.args[1] for call in network.call_args_list))

    def test_trial_configuration_requires_template_and_valid_static_variables(self):
        cfg=self.trial_config();self.assertTrue(cfg.ready())
        cfg.trial_content_sid='';self.assertFalse(cfg.ready())
        self.assertIn('TWILIO_TRIAL_CONTENT_SID',cfg.safe()['missing'])
        for raw in ('[]','{"1": 4}','{"arbitrary": "value"}','not-json'):
            with patch('app.analyst_watch.provider.dotenv_values',return_value={
                'TWILIO_ACCOUNT_SID':CFG.sid,'TWILIO_AUTH_TOKEN':CFG.token,'TWILIO_WHATSAPP_FROM':CFG.sender,'TWILIO_WHATSAPP_TO':CFG.recipient,
                'TWILIO_NOTIFICATION_MODE':'trial_delivery_demo','TWILIO_TRIAL_CONTENT_SID':'HX'+'d'*32,'TWILIO_TRIAL_CONTENT_VARIABLES':raw}):
                self.assertFalse(config().ready())
        with patch('app.analyst_watch.provider.dotenv_values',return_value={
            'TWILIO_ACCOUNT_SID':CFG.sid,'TWILIO_AUTH_TOKEN':CFG.token,'TWILIO_WHATSAPP_FROM':CFG.sender,'TWILIO_WHATSAPP_TO':CFG.recipient,
            'TWILIO_NOTIFICATION_MODE':'trial_delivery_demo','TWILIO_TRIAL_CONTENT_SID':'HX'+'d'*32,'TWILIO_TRIAL_CONTENT_VARIABLES':'{}'}):
            self.assertTrue(config().ready())
            self.assertEqual(config().trial_content_variables,{})

    def test_trial_status_uses_accepted_sid_and_saved_addresses_without_content_api(self):
        cfg=self.trial_config();job=self.trial_job(cfg);sid='SM'+'d'*32
        provider=TwilioProvider(cfg)
        # The static sample has no unique event reference, so unknown outcomes cannot be guessed.
        with self.assertRaises(ProviderFailure):provider.inspect(job,sid)
        job=self.store.outcome(job['id'],{'message_sid':sid,'state':'provider-accepted'})
        data={'to':CFG.recipient,'from':CFG.sender,'body':'Permitted Twilio sample','status':'delivered'}
        with patch.object(TwilioProvider,'request',return_value=data) as network:
            result=provider.inspect(job,sid)
            self.assertEqual(result['state'],'delivered')
            self.assertEqual(result['provider_message_body'],'Permitted Twilio sample')
            self.assertEqual(network.call_count,1)
            self.assertNotIn('content.twilio.com',network.call_args.args[1])
        with self.assertRaises(ProviderFailure):provider.inspect(job,'SM'+'e'*32)
        with patch.object(TwilioProvider,'request',return_value={**data,'to':'whatsapp:+15555559999'}):
            with self.assertRaises(ProviderFailure):provider.inspect(job,sid)
        self.store.outcome(job['id'],result);self.store.outcome(job['id'],{'state':'sent'})
        self.assertEqual(self.store.view(cfg)['notifications'][0]['state'],'delivered')

    def test_trial_mode_configuration_drift_never_retargets_an_existing_intent(self):
        cfg=self.trial_config();job=self.trial_job(cfg)
        from dataclasses import replace
        for changed in (replace(cfg,recipient='whatsapp:+15555559999'),replace(cfg,sid='AC'+'f'*32),
                        replace(cfg,delivery_mode='financial_alert'),replace(cfg,trial_content_variables={'1':'different static value'})):
            with self.assertRaises(ProviderFailure) as error:TwilioProvider(changed).send(job)
            self.assertEqual(error.exception.code,'configuration_changed')
            with self.assertRaises(HTTPException):self.store.retry(job['id'],changed)
        view=self.store.view(cfg);encoded=json.dumps(view)
        self.assertNotIn(CFG.token,encoded);self.assertNotIn(CFG.sid,encoded);self.assertNotIn(CFG.recipient,encoded)

    def test_trial_provider_errors_and_uncertain_outcomes_remain_real_failures(self):
        cfg=self.trial_config();job=self.trial_job(cfg)
        class Response:
            status_code=400
            def json(self):return {'code':572002,'message':'raw provider text should not escape'}
        def rejected(method,url,**kwargs):
            return Response() if method=='POST' else self.fake_http(method,url,**kwargs)
        with patch('requests.request',side_effect=rejected):
            with self.assertRaises(ProviderFailure) as error:TwilioProvider(cfg).send(job)
            self.assertFalse(error.exception.uncertain)
            self.assertEqual(error.exception.code,'572002')
            self.assertNotIn('raw provider',error.exception.safe_message)
        def uncertain(method,url,**kwargs):
            if method=='POST':raise requests.ReadTimeout('secret must not escape')
            return self.fake_http(method,url,**kwargs)
        with patch('requests.request',side_effect=uncertain) as network:
            with self.assertRaises(ProviderFailure) as error:TwilioProvider(cfg).send(job)
            self.assertTrue(error.exception.uncertain)
            self.assertEqual(sum(call.args[0]=='POST' for call in network.call_args_list),1)
        self.store.outcome(job['id'],{'state':'unknown','error_code':'network'})
        self.store.startup();self.assertIsNone(self.store.claim())
        with self.assertRaises(HTTPException):self.store.retry(job['id'])

    def test_trial_cooldown_and_disabled_delivery_still_apply(self):
        cfg=self.trial_config();self.enable(False)
        event=self.provider.snapshot('earnings_shock','disabled-trial-event-12345')
        self.store.ingest(event,'earnings_shock',cfg)
        self.assertEqual(self.store.view(cfg)['notifications'],[])
        self.enable(True)
        self.store.notify(self.store.view(cfg)['alerts'][0]['id'],Intent(request_id='deliberate-trial-intent'),cfg)
        self.store.ingest(self.provider.snapshot('earnings_shock','repeat-trial-event-12345'),'earnings_shock',cfg)
        self.assertEqual(len(self.store.view(cfg)['notifications']),1)
        self.store.ingest(self.provider.snapshot('reset','reset-trial-event-123456'),'reset',cfg)
        self.assertEqual(len(self.store.view(cfg)['notifications']),1)

if __name__=='__main__':unittest.main()
