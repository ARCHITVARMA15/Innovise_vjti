"""Backend-only Twilio REST adapter. No retries on uncertain message creation."""
import hashlib
import ipaddress
import json
import os
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.parse import urlparse
import requests
from dotenv import dotenv_values

API='https://api.twilio.com/2010-04-01'
SID=re.compile(r'^SM[0-9a-fA-F]{32}$')
TRIAL_NOTICE='WhatsApp trial sends a sample template; financial alert details are available in Veritas.'

def phone(value):
    value=(value or '').replace('whatsapp:','')
    value=re.sub(r'[\s()-]','',value)
    return 'whatsapp:'+value if re.fullmatch(r'\+[1-9]\d{7,14}',value) else ''

def reference(value):return hashlib.sha256(value.encode()).hexdigest()[:20]

def public_url(value):
    try:
        u=urlparse(value or '')
        if u.scheme!='https' or not u.hostname or u.username or u.password or u.query or u.fragment:return None
        host=u.hostname.lower()
        if host in ('localhost','localhost.localdomain') or host.endswith(('.localhost','.local')):return None
        try:
            if not ipaddress.ip_address(host).is_global:return None
        except ValueError:
            if '.' not in host:return None
        return value.rstrip('/')
    except ValueError:return None

@dataclass(repr=False)
class Config:
    sid:str='';token:str='';sender:str='';recipient:str='';content_sid:str='';app_url:str|None=None
    legacy_trial_body:bool=False
    delivery_mode:str='financial_alert'
    trial_content_sid:str=''
    trial_content_variables:dict[str,str]|None=field(default_factory=dict)
    @property
    def effective_content_sid(self):return self.trial_content_sid if self.delivery_mode=='trial_delivery_demo' else self.content_sid
    def ready(self):
        return bool(self.delivery_mode in ('financial_alert','trial_delivery_demo') and re.fullmatch(r'AC[0-9a-fA-F]{32}',self.sid)
            and self.token and self.sender and self.recipient and self.sender!=self.recipient
            and (self.delivery_mode!='trial_delivery_demo' or (self.trial_content_sid and self.trial_content_variables is not None))
            and (not self.effective_content_sid or re.fullmatch(r'HX[0-9a-fA-F]{32}',self.effective_content_sid)))
    def safe(self):
        return dict(mode='real_twilio',configuration_ready=self.ready(),destination=('••••'+self.recipient[-4:]) if self.recipient else 'Not configured',
            delivery_mode=self.delivery_mode,delivery_label='Trial delivery demo' if self.delivery_mode=='trial_delivery_demo' else 'Custom financial alerts',
            trial_notice=TRIAL_NOTICE if self.delivery_mode=='trial_delivery_demo' else None,
            content_mode='predefined_trial_template' if self.delivery_mode=='trial_delivery_demo' else 'approved_template' if self.content_sid else 'custom_body',recipient_ref=reference(self.recipient),
            readiness_note=('The exact Console trial template request is configured. A legacy Sandbox and reply window are not required by this mode. Twilio validates the sender/recipient assignment and template when you explicitly send; configuration presence does not prove delivery.' if self.delivery_mode=='trial_delivery_demo' else 'Configuration checks do not prove sender approval, sandbox membership, content eligibility or an open WhatsApp session. Run the read-only provider check.'),
            missing=[name for name,value in [('TWILIO_ACCOUNT_SID',self.sid),('TWILIO_AUTH_TOKEN',self.token),('TWILIO_WHATSAPP_FROM (or TWILIO_WHATSAPP_NUMBER)',self.sender),('TWILIO_WHATSAPP_TO',self.recipient),
                *([('TWILIO_TRIAL_CONTENT_SID',self.trial_content_sid),('Valid TWILIO_TRIAL_CONTENT_VARIABLES JSON',self.trial_content_variables is not None)] if self.delivery_mode=='trial_delivery_demo' else [])] if not value])

def config():
    # Other existing services load .env into os.environ at process startup.
    # Re-read the local file last so those cached values cannot shadow edits.
    # An explicit blank also clears a prior value (e.g. switching templates off).
    local_values=dotenv_values(Path(__file__).resolve().parents[2]/'.env')
    values={**os.environ,**{key:value or '' for key,value in local_values.items()}}
    try:
        variables=json.loads(values.get('TWILIO_TRIAL_CONTENT_VARIABLES') or '{}')
        if not isinstance(variables,dict) or len(variables)>20 or any(not re.fullmatch(r'[1-9]\d?',k) or not isinstance(v,str) or len(v)>1000 for k,v in variables.items()):variables=None
    except (ValueError,TypeError):variables=None
    return Config(sid=values.get('TWILIO_ACCOUNT_SID',''),token=values.get('TWILIO_AUTH_TOKEN',''),
        sender=phone(values.get('TWILIO_WHATSAPP_FROM') or values.get('TWILIO_WHATSAPP_NUMBER')),
        recipient=phone(values.get('TWILIO_WHATSAPP_TO')),content_sid=values.get('TWILIO_CONTENT_SID',''),
        app_url=public_url(values.get('PUBLIC_APP_URL')),legacy_trial_body=values.get('TWILIO_LEGACY_SANDBOX_BODY')=='1',
        delivery_mode=values.get('TWILIO_NOTIFICATION_MODE') or 'financial_alert',trial_content_sid=values.get('TWILIO_TRIAL_CONTENT_SID',''),trial_content_variables=variables)

class ProviderFailure(Exception):
    def __init__(self,code='provider_unavailable',message='Twilio request failed; inspect the provider console.',uncertain=False):
        self.code=str(code);self.safe_message=message;self.uncertain=uncertain
        super().__init__(message)

def safe_error(code):
    return {20003:'Twilio authentication failed.',63016:'WhatsApp session is closed; use an approved relevant template or open a customer-service window.',
            21654:'Twilio requires a ContentSid for this request. The provider did not accept this custom message body; use an eligible template or an account setup that supports custom replies.',
            572002:'The sender is not assigned to this verified trial recipient. Use the exact WhatsApp From number shown for this recipient in Twilio Console.',
            572005:'The destination number has not completed Twilio trial verification. Complete verification in Try out WhatsApp.',
            572006:'The selected trial template is invalid. Use an eligible template from this account’s WhatsApp trial flow.',
            63015:'Recipient must join this WhatsApp sandbox.',63007:'WhatsApp sender is not configured for this account.',
            21608:'Trial recipient restrictions prevented sending.',63038:'Twilio account messaging limit reached.'}.get(code,'Twilio rejected this operation. Check the safe error code in the provider console.')

def provider_state(status):
    return {'accepted':'provider-accepted','queued':'provider-accepted','sending':'provider-accepted','scheduled':'provider-accepted',
            'sent':'sent','delivered':'delivered','read':'read','failed':'failed','undelivered':'failed','canceled':'failed'}.get(status,'unknown')

class TwilioProvider:
    def __init__(self,cfg=None):self.cfg=cfg or config()
    def request(self,method,url,**kwargs):
        try:
            r=requests.request(method,url,auth=(self.cfg.sid,self.cfg.token),timeout=(4,8),allow_redirects=False,**kwargs)
        except requests.RequestException:
            raise ProviderFailure('network','Network outcome is uncertain; do not resend blindly.' if method=='POST' else 'Unable to verify Twilio status. No message was sent by this check.',method=='POST') from None
        try:data=r.json()
        except ValueError:data={}
        if not 200<=r.status_code<300:
            code=data.get('code') if isinstance(data.get('code'),int) else r.status_code
            raise ProviderFailure(code,safe_error(code),method=='POST' and r.status_code>=500)
        return data
    def root(self):return f'{API}/Accounts/{self.cfg.sid}'
    def template(self,sid=None):
        sid=sid or self.cfg.content_sid
        if not re.fullmatch(r'HX[0-9a-fA-F]{32}',sid):raise ProviderFailure('template','A valid financial demo ContentSid is required.')
        content=self.request('GET',f'https://content.twilio.com/v1/Content/{sid}')
        body=content.get('types',{}).get('twilio/text',{}).get('body','')
        approval=self.request('GET',f'https://content.twilio.com/v1/Content/{sid}/ApprovalRequests')
        status=approval.get('whatsapp',{}).get('status')
        if status!='approved' or 'DEMO' not in body or 'Analyst Watch' not in body or not all('{{'+str(i)+'}}' in body for i in (1,2,3)) or set(re.findall(r'{{(.*?)}}',body))!={'1','2','3'}:
            raise ProviderFailure('template','Use an approved Analyst Watch financial DEMO text template with variables 1=company, 2=financial summary, 3=alert/event ID. Unrelated sandbox templates are not supported.')
        return body
    def check(self):
        c=self.cfg
        if not c.ready():return {**c.safe(),'delivery_ready':False,'account_type':'unknown','account_status':'unknown','session':'unknown','restriction':'Complete valid backend sender and recipient configuration.'}
        account=self.request('GET',self.root()+'.json')
        result={**c.safe(),'account_type':account.get('type','unknown'),'account_status':account.get('status','unknown'),'session':'unknown','delivery_ready':False,'restriction':''}
        if account.get('status')!='active':result['restriction']='Twilio account is not active.';return result
        if c.delivery_mode=='trial_delivery_demo':
            result.update(delivery_ready=True,session='not required for predefined trial request',
                restriction='Predefined trial request configured; no Content API or legacy Sandbox access is needed. Sender assignment, permitted template and actual delivery are validated by Twilio at send time. '+TRIAL_NOTICE)
            return result
        if c.content_sid:
            self.template();result.update(delivery_ready=True,restriction='Approved relevant template verified; recipient eligibility and eventual delivery are still provider-controlled.');return result
        # Account type alone does not establish whether sandbox/custom replies
        # are allowed. Verify the reply window for every Body request and let
        # Twilio report any additional account/content restriction on creation.
        data=self.request('GET',self.root()+'/Messages.json',params={'From':c.recipient,'To':c.sender,'PageSize':20,'DateSent>':(datetime.now(timezone.utc)-timedelta(days=1)).date().isoformat()})
        for m in data.get('messages',[]):
            if m.get('direction')!='inbound' or m.get('from')!=c.recipient or m.get('to')!=c.sender:continue
            try:received=parsedate_to_datetime(m.get('date_sent') or m['date_created'])
            except (ValueError,TypeError,KeyError):continue
            if timedelta(0)<=datetime.now(timezone.utc)-received<timedelta(hours=24):
                result.update(session='recent inbound message verified',delivery_ready=True,restriction='Recent inbound message supports an open 24-hour session; final delivery and content eligibility remain provider-controlled.');return result
        result.update(session='not verified',restriction='No recent matching inbound message was verified. Send a WhatsApp message to the configured sender (join the sandbox first) or use an approved financial DEMO template.')
        return result
    def send(self,job):
        c=self.cfg
        trial=job.get('delivery_mode','financial_alert')=='trial_delivery_demo'
        if (reference(c.recipient)!=job['recipient_ref'] or reference(c.sender)!=job['sender_ref'] or c.effective_content_sid!=job['content_sid']
            or c.delivery_mode!=job.get('delivery_mode','financial_alert') or (job.get('account_ref') and reference(c.sid)!=job['account_ref'])
            or (trial and job['variables']!=c.trial_content_variables)):
            raise ProviderFailure('configuration_changed','Account, sender, recipient, messaging mode or template changed. Create a new deliberate notification intent; historical jobs are not retargeted.')
        readiness=self.check()
        if not readiness['delivery_ready']:raise ProviderFailure('not_ready',readiness['restriction'])
        fields={'From':c.sender,'To':c.recipient}
        if job['content_sid']:
            fields['ContentSid']=job['content_sid']
            if job['variables']:fields['ContentVariables']=json.dumps(job['variables'])
        else:fields['Body']=job['message']
        data=self.request('POST',self.root()+'/Messages.json',data=fields)
        if not SID.fullmatch(data.get('sid','')):raise ProviderFailure('uncertain_response','Provider response did not include a valid Message SID; reconcile before retrying.',True)
        return {'message_sid':data['sid'],'state':provider_state(data.get('status')),'provider_status':data.get('status','unknown'),
                **({'provider_message_body':data['body'][:1600]} if trial and isinstance(data.get('body'),str) else {}),
                'error_code':str(data['error_code']) if data.get('error_code') else None,'error_message':safe_error(data['error_code']) if data.get('error_code') else None}
    def inspect(self,job,sid):
        if not SID.fullmatch(sid):raise ProviderFailure('sid','A Twilio Message SID is required for reconciliation.')
        c=self.cfg
        trial=job.get('delivery_mode','financial_alert')=='trial_delivery_demo'
        if job.get('account_ref') and reference(c.sid)!=job['account_ref']:raise ProviderFailure('configuration_changed','Restore the account that owns this notification to inspect provider status.')
        if trial and not job.get('message_sid'):raise ProviderFailure('trial_unknown','This sample template carries no unique alert reference. An uncertain send cannot be safely attached to a Message SID automatically. Inspect Twilio Console; automatic resend remains blocked.')
        if job.get('message_sid') and job['message_sid']!=sid:raise ProviderFailure('mismatch','This intent already has a different provider Message SID; its association is immutable.')
        data=self.request('GET',self.root()+f'/Messages/{sid}.json')
        if reference(data.get('to',''))!=job['recipient_ref'] or reference(data.get('from',''))!=job['sender_ref']:raise ProviderFailure('mismatch','Message does not match this intent’s saved sender and recipient.')
        if trial:
            if data.get('content_sid') and data['content_sid']!=job['content_sid']:raise ProviderFailure('mismatch','Message template does not match the saved trial intent.')
            code=data.get('error_code')
            return {'message_sid':sid,'state':provider_state(data.get('status')),'provider_status':data.get('status','unknown'),
                **({'provider_message_body':data['body'][:1600]} if isinstance(data.get('body'),str) else {}),
                'error_code':str(code) if code else None,'error_message':safe_error(code) if code else None}
        expected=job['message']
        if job['content_sid']:
            expected=self.template(job['content_sid'])
            for k,v in job['variables'].items():expected=expected.replace('{{'+k+'}}',v)
        if data.get('body')!=expected:raise ProviderFailure('mismatch','Message body does not match the saved notification intent.')
        code=data.get('error_code')
        return {'message_sid':sid,'state':provider_state(data.get('status')),'provider_status':data.get('status','unknown'),'error_code':str(code) if code else None,'error_message':safe_error(code) if code else None}
