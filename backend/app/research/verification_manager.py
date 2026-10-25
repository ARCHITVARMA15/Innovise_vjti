import asyncio
from fastapi import HTTPException

from app.research.verification_store import VerificationStore
from app.research.verification_engine import execute_verification


class VerificationManager:
    def __init__(self,store):
        self.store=VerificationStore(store)
        self.tasks={}

    def startup(self):
        self.store.interrupt_active()

    def start(self,case_id,claim_id,request):
        if len(self.tasks)>=2:
            raise HTTPException(409,'The local verifier is busy; at most two managed verifications may run.')
        run=self.store.create_run(case_id,claim_id,request)
        task=asyncio.create_task(execute_verification(self.store,run))
        self.tasks[run['id']]=task
        task.add_done_callback(lambda done:self.tasks.pop(run['id'],None))
        return self.store.get_run(case_id,run['id'])

    async def shutdown(self):
        tasks=list(self.tasks.values())
        for task in tasks: task.cancel()
        if tasks: await asyncio.gather(*tasks,return_exceptions=True)
