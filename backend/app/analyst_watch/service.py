import asyncio
from contextlib import asynccontextmanager
from app.research.store import research_directory, now
from app.research.ecosystem.workflow import application_lifespan as existing_lifespan
from .store import WatchStore, age
from .provider import TwilioProvider, ProviderFailure, config

class WatchWorker:
    def __init__(self,store,provider_factory=TwilioProvider):
        self.store=store;self.provider_factory=provider_factory;self.task=None
    def start(self):
        self.store.startup();self.task=asyncio.create_task(self.loop())
    async def loop(self):
        while True:
            try:
                job=self.store.claim()
                if job:
                    try:result=await asyncio.to_thread(self.provider_factory().send,job)
                    except ProviderFailure as error:
                        result={'state':'unknown' if error.uncertain else 'failed','error_code':error.code,'error_message':error.safe_message}
                    self.store.outcome(job['id'],result)
                else:
                    with self.store.connection() as db:
                        jobs=[j for j in self.store.objects(db,'aw_outbox',100) if j['state'] in ('provider-accepted','sent') and j.get('message_sid') and age(j['updated_at'])>=15 and age(j['created_at'])<21600][:2]
                    for pending in jobs:
                        await self.reconcile(pending['id'])
                await asyncio.sleep(1 if job else 3)
            except asyncio.CancelledError:raise
            except Exception:
                # Never log provider response bodies, credentials or recipient addresses.
                # A claimed sending intent is left uncertain, not blindly retried.
                self.store.startup()
                await asyncio.sleep(3)
    async def reconcile(self,jid,sid=None):
        with self.store.connection() as db:job=self.store.job(db,jid)
        sid=sid or job['message_sid']
        if not sid:raise ProviderFailure('sid','Outcome unknown: inspect Twilio Console and attach the matching Message SID. Automatic resend is blocked.')
        try:result=await asyncio.to_thread(self.provider_factory().inspect,job,sid)
        except ProviderFailure as error:
            with self.store.connection() as db:
                current=self.store.job(db,jid);current.update(last_status_check_error=error.safe_message,updated_at=now());self.store.save_job(db,current)
            raise
        return self.store.outcome(jid,result)
    async def stop(self):
        if self.task:self.task.cancel();await asyncio.gather(self.task,return_exceptions=True)

@asynccontextmanager
async def watch_lifespan(app):
    async with existing_lifespan(app):
        store=WatchStore(research_directory()/'analyst_watch.sqlite3')
        worker=WatchWorker(store);app.state.watch_store=store;app.state.watch_worker=worker;worker.start()
        try:yield
        finally:await worker.stop()
