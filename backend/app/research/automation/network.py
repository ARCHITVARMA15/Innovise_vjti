"""Pinned public-IP HTTPS retrieval; no proxy inheritance or arbitrary web search."""
import email.utils
import hashlib
import http.client
import ipaddress
import json
import os
import re
import socket
import ssl
import threading
import time
from uuid import uuid4
from decimal import Decimal
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit, urljoin
from dotenv import dotenv_values
from app.research.store import now

ALLOWED={'www.sec.gov','sec.gov','data.sec.gov'}
MAX_BYTES=12*1024*1024
_LOCK=threading.Lock()
_LAST=0.0

class RetrievalError(ValueError):pass

def user_agent():
    local=dotenv_values(Path(__file__).resolve().parents[3]/'.env')
    value=local.get('SEC_USER_AGENT') or os.getenv('SEC_USER_AGENT','')
    if not value or len(value)>240 or '\n' in value or '\r' in value or not re.search(r'[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}',value):
        raise RetrievalError('Configure SEC_USER_AGENT with your application name and real contact email in backend/.env. Manual uploads remain available.')
    return value

def validate_url(url,resolver=None):
    try:
        p=urlsplit(url);port=p.port
    except ValueError:raise RetrievalError('Malformed official source URL.') from None
    if p.scheme!='https' or p.hostname not in ALLOWED or p.username or p.password or port not in (None,443) or p.fragment or p.query:
        raise RetrievalError('Only approved official SEC HTTPS URLs without credentials, query strings or custom ports are supported.')
    try:addresses=(resolver or socket.getaddrinfo)(p.hostname,443,type=socket.SOCK_STREAM)
    except OSError:raise RetrievalError('DNS lookup for the official SEC source failed; retrieval stopped.') from None
    ips=list(dict.fromkeys(a[4][0] for a in addresses))
    if not ips or any(not ipaddress.ip_address(ip).is_global for ip in ips):
        raise RetrievalError('Remote source resolved to a nonpublic address; import blocked.')
    return p,ips

class PinnedHTTPS(http.client.HTTPSConnection):
    def __init__(self,host,ip):super().__init__(host,timeout=8,context=ssl.create_default_context());self.ip=ip
    def connect(self):
        raw=socket.create_connection((self.ip,443),timeout=5)
        self.sock=self._context.wrap_socket(raw,server_hostname=self.host)

class SecClient:
    def __init__(self,directory):
        self.cache=Path(directory)/'sec_cache';self.cache.mkdir(parents=True,exist_ok=True)
        self.requests=0;self.bytes=0;self.cache_hits=0;self.decisions=[]
    def fetch(self,url,kind='json',ttl=3600):
        global _LAST
        agent=user_agent();validate_url(url);key=hashlib.sha256(url.encode()).hexdigest();meta=self.cache/(key+'.json');blob=self.cache/(key+'.bin')
        # Cached objects are hash-checked; stale/missing objects are never guessed.
        if meta.exists() and blob.exists():
            m=json.loads(meta.read_text());raw=blob.read_bytes()
            if time.time()-m['cached_at']<ttl and hashlib.sha256(raw).hexdigest()==m['content_hash']:
                validate_url(m['final_url']);self.cache_hits+=1;self.bytes+=len(raw)
                if self.bytes>48*1024*1024:raise RetrievalError('48 MiB source budget exhausted.')
                return {**m,'data':raw,'cached':True}
        current=url
        for redirect in range(4):
            parsed,ips=validate_url(current)
            for attempt in range(3):
                if self.requests>=24:raise RetrievalError('SEC request budget exhausted (24 requests including retries/redirects).')
                with _LOCK:
                    wait=max(0,.6-(time.monotonic()-_LAST))
                    if wait:time.sleep(wait)
                    _LAST=time.monotonic()
                self.requests+=1;connection=PinnedHTTPS(parsed.hostname,ips[0]);started=time.monotonic()
                try:
                    connection.request('GET',parsed.path or '/',headers={'User-Agent':agent,'Accept':'application/json' if kind=='json' else 'text/html,application/pdf','Accept-Encoding':'identity'})
                    response=connection.getresponse();status=response.status
                    if status in (301,302,303,307,308):
                        target=response.getheader('Location')
                        if not target or redirect==3:raise RetrievalError('SEC redirect limit or missing redirect destination.')
                        current=urljoin(current,target);validate_url(current);break
                    if status in (429,500,502,503,504) and attempt<2:
                        retry=response.getheader('Retry-After','')
                        try:delay=float(retry)
                        except ValueError:
                            try:delay=(email.utils.parsedate_to_datetime(retry)-datetime.now(timezone.utc)).total_seconds()
                            except (ValueError,TypeError):delay=2**attempt
                        if delay>15:raise RetrievalError('SEC requested a longer Retry-After. Retrieval paused; retry later instead of bypassing rate limits.')
                        time.sleep(max(0,delay));continue
                    if status!=200:raise RetrievalError(f'Official SEC retrieval returned HTTP {status}. No bypass or search-cache substitute was used. Upload the official filing manually or retry later.')
                    ctype=(response.getheader('Content-Type') or '').split(';')[0].lower()
                    allowed={'application/json','text/json'} if kind=='json' else {'text/html','application/xhtml+xml','application/pdf'}
                    if ctype not in allowed:raise RetrievalError('Unsupported official source content type: '+ctype)
                    length=response.getheader('Content-Length')
                    if length and int(length)>MAX_BYTES:raise RetrievalError('Official source exceeds 12 MiB per-object limit.')
                    chunks=[];size=0
                    while True:
                        if time.monotonic()-started>25:raise RetrievalError('Official source exceeded its 25-second fetch budget.')
                        block=response.read(65536)
                        if not block:break
                        size+=len(block);self.bytes+=len(block)
                        if size>MAX_BYTES or self.bytes>48*1024*1024:raise RetrievalError('Source byte budget exceeded (12 MiB/object, 48 MiB/run).')
                        chunks.append(block)
                    raw=b''.join(chunks)
                    if not raw or (ctype=='application/pdf' and not raw.startswith(b'%PDF-')):raise RetrievalError('Empty or invalid official payload.')
                    if kind=='json':
                        try:json.loads(raw)
                        except (ValueError,UnicodeError):raise RetrievalError('Official JSON payload could not be decoded.') from None
                    m={'url':url,'final_url':current,'retrieved_at':now(),'content_type':ctype,'content_hash':hashlib.sha256(raw).hexdigest(),'cached_at':time.time()}
                    tmp=blob.with_suffix('.'+uuid4().hex+'.tmp');tmp.write_bytes(raw);tmp.replace(blob)
                    tmp=meta.with_suffix('.'+uuid4().hex+'.tmp');tmp.write_text(json.dumps(m));tmp.replace(meta)
                    return {**m,'data':raw,'cached':False}
                except (socket.timeout,OSError,http.client.HTTPException):
                    if attempt==2:raise RetrievalError('SEC network/TLS connection failed after bounded retries. Source not imported.') from None
                    time.sleep(2**attempt)
                finally:connection.close()
            else:raise RetrievalError('SEC retries exhausted.')
        raise RetrievalError('SEC redirect budget exhausted.')
    def json(self,url,ttl=3600):
        result=self.fetch(url,'json',ttl);return json.loads(result['data'],parse_float=Decimal),result
    def budget(self):return {'requests':self.requests,'bytes':self.bytes,'cache_hits':self.cache_hits,'max_requests':24,'max_bytes':48*1024*1024}
