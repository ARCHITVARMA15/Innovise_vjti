"""Isolated durable demo state. Snapshot/alert/outbox creation is one transaction."""
import hashlib
import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4
from fastapi import HTTPException
from app.research.store import now
from .models import Rules, Snapshot
from .engine import DemoProvider, evaluate, kpis, compatible
from .provider import reference, TRIAL_NOTICE

COOLDOWN=60
SEND_INTERVAL=30
DAILY_LIMIT=20

def encode(value):return json.dumps(value,ensure_ascii=False,sort_keys=True)
def age(timestamp):return (datetime.now(timezone.utc)-datetime.fromisoformat(timestamp.replace('Z','+00:00'))).total_seconds()

def message_for(alert):
    a=alert['analysis'];p=a['previous']['values'];c=a['current']['values']
    return (f"DEMO Analyst Watch | Aster Technologies — Demo\nSimulated financial update; real notification.\n"
        f"Q2 2025 vs Q1 2025, USD millions. Revenue {p['revenue']} → {c['revenue']}; net income {p['net_income']} → {c['net_income']}.\n"
        f"Net margin {p['net_margin']}% → {c['net_margin']}%; current ratio {p['current_ratio']} → {c['current_ratio']}.\n"
        f"{a['summary']}\nAlert {alert['id']}. Not a forecast or trading recommendation.")

class WatchStore:
    def __init__(self,path):
        self.path=Path(path);self.path.parent.mkdir(parents=True,exist_ok=True)
        with self.connection() as db:
            db.executescript('''
            CREATE TABLE IF NOT EXISTS aw_settings(id INTEGER PRIMARY KEY CHECK(id=1),payload TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS aw_snapshots(id TEXT PRIMARY KEY,payload TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS aw_events(id TEXT PRIMARY KEY,scenario TEXT NOT NULL,payload TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS aw_alerts(id TEXT PRIMARY KEY,event_id TEXT UNIQUE NOT NULL,payload TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS aw_outbox(id TEXT PRIMARY KEY,event_id TEXT NOT NULL,recipient_ref TEXT NOT NULL,request_id TEXT UNIQUE NOT NULL,state TEXT NOT NULL,payload TEXT NOT NULL,UNIQUE(event_id,recipient_ref));
            ''')
            db.execute('BEGIN IMMEDIATE')
            if not db.execute('SELECT 1 FROM aw_settings').fetchone():
                seed=DemoProvider().snapshot('baseline','initial-baseline')
                db.execute('INSERT INTO aw_snapshots VALUES(?,?)',(seed.id,seed.model_dump_json()))
                settings=dict(monitoring_enabled=True,whatsapp_enabled=False,watched=True,rules=Rules().model_dump(mode='json'),baseline_id=seed.id,active_id=seed.id,case_id=None)
                db.execute('INSERT INTO aw_settings VALUES(1,?)',(encode(settings),))
    @contextmanager
    def connection(self):
        db=sqlite3.connect(self.path,timeout=10);db.row_factory=sqlite3.Row
        try:
            with db:yield db
        finally:db.close()
    def settings(self,db):return json.loads(db.execute('SELECT payload FROM aw_settings WHERE id=1').fetchone()[0])
    def save_settings(self,db,s):db.execute('UPDATE aw_settings SET payload=? WHERE id=1',(encode(s),))
    def snapshot(self,db,sid):return Snapshot.model_validate_json(db.execute('SELECT payload FROM aw_snapshots WHERE id=?',(sid,)).fetchone()[0])
    def objects(self,db,table,limit=100):return [json.loads(r[0]) for r in db.execute(f'SELECT payload FROM {table} ORDER BY rowid DESC LIMIT ?',(limit,))]
    def job(self,db,jid):
        row=db.execute('SELECT payload FROM aw_outbox WHERE id=?',(jid,)).fetchone()
        if not row:raise HTTPException(404,'Notification not found.')
        return json.loads(row[0])
    def save_job(self,db,j):db.execute('UPDATE aw_outbox SET state=?,payload=? WHERE id=?',(j['state'],encode(j),j['id']))
    def alert(self,db,aid):
        row=db.execute('SELECT payload FROM aw_alerts WHERE id=?',(aid,)).fetchone()
        if not row:raise HTTPException(404,'Alert not found.')
        return json.loads(row[0])
    def view(self,cfg):
        with self.connection() as db:
            settings=self.settings(db);baseline=self.snapshot(db,settings['baseline_id']);active=self.snapshot(db,settings['active_id'])
            return dict(company={'id':active.company_id,'name':active.display_name},settings=settings,
                baseline=baseline.model_dump(mode='json'),active=active.model_dump(mode='json'),baseline_kpis=kpis(baseline),active_kpis=kpis(active),
                events=self.objects(db,'aw_events'),alerts=self.objects(db,'aw_alerts'),notifications=self.objects(db,'aw_outbox'),
                notification_config=cfg.safe(),limits={'duplicate_cooldown_seconds':COOLDOWN,'notification_interval_seconds':SEND_INTERVAL,'daily_notification_limit':DAILY_LIMIT},
                label='Simulated financial data / real notification delivery')
    def update(self,payload,cfg):
        with self.connection() as db:
            db.execute('BEGIN IMMEDIATE');s=self.settings(db);s.update(payload.model_dump(mode='json'));self.save_settings(db,s)
            if not s['whatsapp_enabled'] or not s['monitoring_enabled'] or not s['watched']:
                for j in self.objects(db,'aw_outbox',1000):
                    if j['state']=='pending' and j['kind']!='test':
                        j.update(state='failed',error_code='paused',error_message='Paused before dispatch; no message sent.',updated_at=now());self.save_job(db,j)
        return self.view(cfg)
    def ingest(self,snapshot,scenario,cfg,new_demo_replay=False):
        """Provider boundary: validate → persist snapshot → evaluate → alert → outbox."""
        with self.connection() as db:
            db.execute('BEGIN IMMEDIATE')
            existing=db.execute('SELECT scenario,payload FROM aw_events WHERE id=?',(snapshot.event_id,)).fetchone()
            if existing:
                event=json.loads(existing['payload'])
                saved=self.snapshot(db,event['snapshot_id'])
                fields=('company_id','display_name','period_start','period_end','period_type','accounting_basis','currency','scale','source_type','values')
                if existing['scenario']!=scenario or any(getattr(saved,k)!=getattr(snapshot,k) for k in fields):
                    raise HTTPException(409,'Event ID already belongs to a different publication. Reuse it only for the same immutable financial update.')
                return event
            s=self.settings(db);baseline=self.snapshot(db,s['baseline_id'])
            if scenario=='reset':
                # Reset is an auditable new baseline snapshot, never a delete or send.
                analysis=None;s['baseline_id']=snapshot.id
            else:
                try:compatible(baseline,snapshot);analysis=evaluate(baseline,snapshot,Rules.model_validate(s['rules']))
                except ValueError as error:raise HTTPException(422,str(error)) from None
            db.execute('INSERT INTO aw_snapshots VALUES(?,?)',(snapshot.id,snapshot.model_dump_json()))
            s['active_id']=snapshot.id;self.save_settings(db,s)
            event=dict(id=snapshot.event_id,scenario=scenario,observed_at=snapshot.observed_at,snapshot_id=snapshot.id,
                baseline_id=s['baseline_id'],source_type='simulated',new_demo_replay=new_demo_replay,analysis=analysis,
                monitoring_evaluated=bool(s['monitoring_enabled'] and s['watched'] and analysis),alert_id=None,notification_note='No threshold breach.' if analysis else 'Reset restored baseline. Audit history retained; no notification.')
            if analysis and not event['monitoring_evaluated']:event['notification_note']='Snapshot persisted; watch removed or monitoring paused. No alert/notification created.'
            if analysis and analysis['breaches'] and event['monitoring_evaluated']:
                signature=hashlib.sha256(encode({'values':snapshot.model_dump(mode='json')['values'],'rules':s['rules'],'breaches':[b['rule'] for b in analysis['breaches']]}).encode()).hexdigest()
                prior=next((a for a in self.objects(db,'aw_alerts') if a['signature']==signature and age(a['created_at'])<COOLDOWN),None)
                aid=str(uuid4());alert=dict(id=aid,event_id=snapshot.event_id,created_at=now(),severity='critical' if any(b['severity']=='critical' for b in analysis['breaches']) else 'warning',
                    baseline=baseline.model_dump(mode='json'),current=snapshot.model_dump(mode='json'),analysis=analysis,rules=s['rules'],signature=signature,
                    duplicate_of=prior['id'] if prior else None,acknowledged_at=None,notification_note='WhatsApp disabled; no send intended.')
                event['alert_id']=aid
                if s['whatsapp_enabled']:
                    _,note=self.queue(db,alert,cfg,'event-'+snapshot.event_id,new_demo_replay)
                    alert['notification_note']=note
                elif prior:alert['notification_note']='Duplicate within cooldown; WhatsApp disabled.'
                event['notification_note']=alert['notification_note']
                db.execute('INSERT INTO aw_alerts VALUES(?,?,?)',(aid,snapshot.event_id,encode(alert)))
            db.execute('INSERT INTO aw_events VALUES(?,?,?)',(snapshot.event_id,scenario,encode(event)))
            return event
    def queue(self,db,alert,cfg,request_id,replay=False,kind='alert'):
        # The only destination is the server-configured recipient; request bodies cannot override it.
        existing=db.execute('SELECT payload FROM aw_outbox WHERE request_id=? OR (event_id=? AND recipient_ref=?)',(request_id,alert['event_id'],reference(cfg.recipient))).fetchone()
        if existing:
            old=json.loads(existing[0])
            if old['event_id']!=alert['event_id']:raise HTTPException(409,'Request ID is already used by a different event.')
            return old,'Existing notification intent retained; no duplicate created.'
        if not cfg.ready():return None,'Notification not queued: backend configuration is incomplete or invalid.'
        s=self.settings(db)
        if not s['whatsapp_enabled']:return None,'WhatsApp delivery is disabled.'
        if kind!='test' and not (s['monitoring_enabled'] and s['watched']):return None,'Watch is paused or removed.'
        if alert.get('duplicate_of') and age(alert['created_at'])<COOLDOWN and not replay:return None,'Duplicate within 60-second cooldown. A deliberate new demo replay is required to bypass it.'
        jobs=self.objects(db,'aw_outbox',1000)
        if any(age(j.get('last_attempt_at') or j['created_at'])<SEND_INTERVAL for j in jobs):return None,'Notification rate limit: wait 30 seconds between intents/attempts.'
        if sum(age(j['created_at'])<86400 for j in jobs)>=DAILY_LIMIT:return None,'Demo daily limit of 20 notification intents reached.'
        trial=cfg.delivery_mode=='trial_delivery_demo'
        aid=alert['id'];body=message_for(alert) if kind!='test' and not trial else ''
        if kind=='test' and not trial:body='DEMO Analyst Watch — explicit preflight test. Simulated financial data / real notification delivery. No financial alert is asserted. Test '+alert['event_id']
        if cfg.app_url and not trial:body+='\n'+cfg.app_url+'/analyst-watch'
        variables=dict(cfg.trial_content_variables or {}) if trial else {'1':'Aster Technologies — Demo','2':alert['analysis']['summary'] if kind!='test' else 'DEMO preflight test; no financial event asserted.','3':aid}
        j=dict(id=str(uuid4()),event_id=alert['event_id'],alert_id=None if kind=='test' else aid,recipient_ref=reference(cfg.recipient),sender_ref=reference(cfg.sender),
            account_ref=reference(cfg.sid),delivery_mode=cfg.delivery_mode,delivery_label='Trial delivery demo' if trial else 'Custom financial alerts',
            trial_notice=TRIAL_NOTICE if trial else None,
            request_id=request_id,kind=kind,message=body,variables=variables,
            content_sid=cfg.effective_content_sid,state='pending',message_sid=None,provider_status=None,error_code=None,error_message=None,attempts=0,
            created_at=now(),updated_at=now(),last_attempt_at=None,history=[{'at':now(),'state':'pending','note':'User-authorized notification intent persisted before provider access.'}])
        db.execute('INSERT INTO aw_outbox VALUES(?,?,?,?,?,?)',(j['id'],j['event_id'],j['recipient_ref'],j['request_id'],j['state'],encode(j)))
        return j,('Trial delivery demo intent queued. '+TRIAL_NOTICE+' Provider acceptance is not delivery.' if trial else 'Notification intent queued; provider acceptance is not delivery.')
    def notify(self,aid,intent,cfg):
        with self.connection() as db:
            db.execute('BEGIN IMMEDIATE');a=self.alert(db,aid);j,note=self.queue(db,a,cfg,intent.request_id,intent.new_demo_replay)
            a['notification_note']=note;db.execute('UPDATE aw_alerts SET payload=? WHERE id=?',(encode(a),aid))
            return {'notification':j,'note':note}
    def test_intent(self,intent,cfg):
        # No arbitrary message or recipient can enter this endpoint.
        with self.connection() as db:
            db.execute('BEGIN IMMEDIATE')
            a={'id':'test-'+intent.request_id,'event_id':'test-'+intent.request_id,'analysis':{'summary':'Explicit DEMO preflight test.'}}
            j,note=self.queue(db,a,cfg,intent.request_id,False,'test')
            return {'notification':j,'note':note}
    def acknowledge(self,aid):
        with self.connection() as db:
            db.execute('BEGIN IMMEDIATE');a=self.alert(db,aid)
            if not a['acknowledged_at']:
                a['acknowledged_at']=now();db.execute('UPDATE aw_alerts SET payload=? WHERE id=?',(encode(a),aid))
            return a
    def startup(self):
        with self.connection() as db:
            for j in self.objects(db,'aw_outbox',1000):
                if j['state']=='sending':
                    j.update(state='unknown',updated_at=now(),error_code='restart_uncertain',error_message='Process stopped during dispatch. Reconcile; automatic resend is blocked.')
                    j['history'].append({'at':now(),'state':'unknown','note':'Restart during dispatch; no automatic retry.'});self.save_job(db,j)
    def claim(self):
        with self.connection() as db:
            db.execute('BEGIN IMMEDIATE');s=self.settings(db)
            if not s['whatsapp_enabled']:return None
            rows=db.execute("SELECT payload FROM aw_outbox WHERE state='pending' ORDER BY rowid LIMIT 1").fetchall()
            if not rows:return None
            j=json.loads(rows[0][0])
            if any(x.get('last_attempt_at') and age(x['last_attempt_at'])<SEND_INTERVAL for x in self.objects(db,'aw_outbox',1000)):
                return None
            if j['kind']!='test' and not (s['monitoring_enabled'] and s['watched']):return None
            j.update(state='sending',attempts=j['attempts']+1,updated_at=now(),last_attempt_at=now());j['history'].append({'at':now(),'state':'sending','note':'Claimed once by the backend worker.'});self.save_job(db,j);return j
    def outcome(self,jid,result):
        with self.connection() as db:
            db.execute('BEGIN IMMEDIATE');j=self.job(db,jid)
            rank={'pending':0,'sending':1,'unknown':1,'provider-accepted':2,'sent':3,'delivered':4,'read':5}
            if rank.get(j['state'],0)>=4 and rank.get(result['state'],0)<rank[j['state']]:return j
            j.update(result,updated_at=now());j['history'].append({'at':now(),'state':j['state'],'note':'Provider status / safe execution outcome saved.'});self.save_job(db,j);return j
    def retry(self,jid,cfg=None):
        with self.connection() as db:
            db.execute('BEGIN IMMEDIATE');j=self.job(db,jid);s=self.settings(db)
            if cfg and (j.get('delivery_mode','financial_alert')!=cfg.delivery_mode or j['recipient_ref']!=reference(cfg.recipient)
                or j['sender_ref']!=reference(cfg.sender) or j['content_sid']!=cfg.effective_content_sid
                or (j.get('account_ref') and j['account_ref']!=reference(cfg.sid))
                or (cfg.delivery_mode=='trial_delivery_demo' and j['variables']!=cfg.trial_content_variables)):
                raise HTTPException(409,'This historical intent uses a different notification configuration. Use the current Send test sample template action or create a new deliberate event; old records are never retargeted.')
            if j['state']!='failed' or j['message_sid'] or j['attempts']>=3:raise HTTPException(409,'Only known failed sends without a provider SID can be retried (maximum 3 attempts). Accepted or uncertain sends require reconciliation.')
            if not s['whatsapp_enabled']:raise HTTPException(409,'Enable delivery first.')
            if age(j.get('last_attempt_at') or j['updated_at'])<SEND_INTERVAL:raise HTTPException(429,'Wait 30 seconds before retrying.')
            if any(x['id']!=jid and age(x.get('last_attempt_at') or x['created_at'])<SEND_INTERVAL for x in self.objects(db,'aw_outbox')):raise HTTPException(429,'Another notification used the 30-second send interval.')
            j.update(state='pending',updated_at=now(),error_code=None,error_message=None);j['history'].append({'at':now(),'state':'pending','note':'Explicit user retry of known failure.'});self.save_job(db,j);return j
