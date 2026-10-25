import asyncio
from contextlib import asynccontextmanager

from fastapi import HTTPException
from pydantic import ValidationError

from app.research.analysis_graph import create_research_graph
from app.research.analysis_models import AnalysisSnapshot, AnalysisStart, AnalysisRun, QualitativeOutput
from app.research.analysis_store import AnalysisStore
from app.research.analysis_llm import ModelCallError, StructuredOutputError, investigation_repairs
from app.research.store import ResearchStore, research_directory, now

RUN_BUDGET_SECONDS = 100
MAX_ACTIVE_RUNS = 2


class AnalysisManager:
    def __init__(self, store: ResearchStore):
        self.store = AnalysisStore(store)
        self.tasks: dict[str, asyncio.Task] = {}

    def startup(self):
        self.store.interrupt_active()

    def start(self, case_id: str, request: AnalysisStart):
        if sum(not task.done() for task in self.tasks.values()) >= MAX_ACTIVE_RUNS:
            raise HTTPException(409, "The local research worker is busy. At most two analysis runs may be active.")
        run = self.store.create(case_id, request)
        if run["status"] != "queued" or run["id"] in self.tasks:
            return run
        task = asyncio.create_task(self.execute(case_id, run["id"]), name=f"research-analysis-{run['id']}")
        self.tasks[run["id"]] = task
        task.add_done_callback(lambda finished: self.tasks.pop(run["id"], None))
        return run

    async def execute(self, case_id, run_id):
        try:
            run = self.store.get(case_id, run_id)
            self.store.update(case_id, run_id, changes={"status": "running", "started_at": now()},
                event=("execution", "started", "Managed research execution started."))
            async with asyncio.timeout(RUN_BUDGET_SECONDS), investigation_repairs():
                final = await create_research_graph(self.store).ainvoke({"run_id": run_id, "case_id": case_id,
                    "question": run["question"], "request": run.get("request", {}), "snapshot": AnalysisSnapshot.model_validate(run["snapshot"])})
            if final.get("scope", {}).get("questions"):
                self.store.update(case_id, run_id, changes={"status": "needs_input", "finished_at": now(),
                    "errors": final["scope"]["questions"]}, event=("execution", "completed", "Resolve scope questions and start a new snapshot."))
                return
            needs_input = bool(final["financial"].needs_input)
            partial = final["brief"].qualitative_status == "unavailable"
            self.store.update(case_id, run_id, changes={"status": "partial" if partial else "needs_input" if needs_input else "completed", "finished_at": now(),
                "errors": [final["brief"].synthesis_error["message"]] if partial else []},
                event=("execution", "completed", "Partial numerical brief saved; qualitative synthesis unavailable." if partial else "Research needs analyst input in Financials." if needs_input else "Versioned report saved; analyst review pending." if final.get("report") else "Preliminary brief saved; verification and analyst approval remain pending."))
        except asyncio.CancelledError:
            self.store.update(case_id, run_id, changes={"status": "interrupted", "finished_at": now(),
                "errors": ["Local research task interrupted during backend shutdown. No automatic resume."]},
                event=("execution", "interrupted", "Managed execution interrupted."))
        except Exception as error:
            if isinstance(error, TimeoutError):
                saved = AnalysisRun.model_validate(self.store.get(case_id, run_id))
                if saved.plan and saved.financial:
                    from app.research.analysis_brief import assemble_brief
                    diagnosis = {"category": "timeout", "message": "Overall investigation budget expired; saved structured stages are preserved and qualitative synthesis is incomplete."}
                    from app.research.analysis_models import RetrievalOutput
                    if saved.brief is None:
                        brief = assemble_brief({"question": saved.question, "snapshot": saved.snapshot, "plan": saved.plan,
                            "retrieval": saved.retrieval or RetrievalOutput(passages=[],scanned_sections=0,scanned_chunks=0,total_chunks=0,omitted_chunks=0,limitations=[]), "financial": saved.financial, "verification": saved.verification},
                            QualitativeOutput(observations=[]), diagnosis)
                        self.store.update(case_id, run_id, output=("brief_assembly", brief.model_dump(mode="json")))
                    self.store.update(case_id, run_id, changes={"status": "partial", "finished_at": now(), "errors": [diagnosis["message"]]},
                        event=("execution", "completed", "Partial structured results saved; overall budget exhausted."))
                    if saved.request.get('task_type') and not saved.report:
                        from app.research.reports import ReportStore, ReportCreate
                        report=ReportStore(self.store.store).create(case_id, ReportCreate(analysis_run_id=run_id))
                        self.store.update(case_id,run_id,output=('report_composition',{'report_id':report['id'],'version':report['version'],
                            'rendering_method':report['rendering_method']}))
                    return
            if isinstance(error, StructuredOutputError):
                message = f"{error.category}: {error}"
            elif isinstance(error, ModelCallError):
                message = str(error)
            elif isinstance(error, ValidationError):
                message = "Dexter returned malformed structured output. The run failed; no fabricated plan or brief was substituted."
            elif isinstance(error, TimeoutError):
                message = "Dexter provider call or the overall research execution exceeded its time budget. Start a new run when ready."
            elif isinstance(error, ValueError):
                message = "Research output validation failed: " + str(error)
            else:
                message = "Dexter research failed. Check GROQ_API_KEY, provider/network availability, and local storage. No mock brief was substituted."
            self.store.update(case_id, run_id, changes={"status": "failed", "finished_at": now(), "errors": [message]},
                event=("execution", "failed", message))

    async def shutdown(self):
        tasks = list(self.tasks.values())
        for task in tasks:
            task.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)


@asynccontextmanager
async def research_lifespan(app):
    manager = AnalysisManager(ResearchStore(research_directory()))
    manager.startup()
    app.state.analysis_manager = manager
    from app.research.verification_manager import VerificationManager
    verifier = VerificationManager(manager.store.store)
    verifier.startup()
    app.state.verification_manager = verifier
    try:
        yield
    finally:
        await verifier.shutdown()
        await manager.shutdown()
