"""Optional supervisor branch with a bounded, observable ecosystem subgraph."""
import asyncio
from contextlib import asynccontextmanager
from typing import TypedDict

from fastapi import HTTPException
from langgraph.graph import StateGraph, START, END

from app.research.analysis_graph import create_research_graph
from app.research.analysis_manager import research_lifespan
from app.research.analysis_store import AnalysisStore
from app.research.store import now
from .engine import discover, verify_relationship, materiality, assess_entity, transmit, audit_run
from .models import Run
from .store import EcosystemStore

RUN_SECONDS = 30
MAX_ACTIVE_RUNS = 2
TERMINAL = {'completed', 'partial', 'needs_input', 'failed', 'interrupted'}


class EcosystemState(TypedDict):
    run: Run


def create_ecosystem_graph(store: EcosystemStore):
    graph = StateGraph(EcosystemState)

    def stage(name, operation):
        async def execute(state):
            run = state['run']
            store.event(run.case_id, run.id, name, 'started', f'{name.replace("_", " ")} started.')
            await asyncio.sleep(0)  # Cancellation point; not a simulated processing delay.
            operation(run)
            store.save(run)
            store.event(run.case_id, run.id, name, 'completed', f'{name.replace("_", " ")} output saved and validated.')
            return {'run': run}
        return execute

    def scope(run):
        discover(run, store.research)
        if run.questions:
            run.status, run.finished_at = 'needs_input', now()

    def verify(run):
        for relation in run.relationships:
            verify_relationship(relation, run.sources, run)

    def dependencies(run):
        run.exposures = [materiality(relation, run) for relation in run.relationships]

    def finance(run):
        run.assessments = [assess_entity(entity, run) for entity in run.entities]

    def transmission(run):
        exposures = {x.relationship_id: x for x in run.exposures}
        assessments = {x.entity_id: x for x in run.assessments}
        run.findings = [transmit(r, exposures[r.id], assessments[r.target_entity_id if r.source_entity_id == run.target_entity_id else r.source_entity_id], run) for r in run.relationships]

    def recheck(run):
        unresolved = set(audit_run(run))
        run.retry_count += 1
        for relation in run.relationships:
            if relation.id in unresolved:
                verify_relationship(relation, run.sources, run)
        dependencies(run)
        transmission(run)
        store.event(run.case_id, run.id, 'targeted_recheck', 'attempt',
            f'Attempt {run.retry_count}/{run.request.retry_budget}: revalidated failed relationship IDs against eligible curated sources only. No external search or tool expansion.')

    def report(run):
        unresolved = audit_run(run)
        if unresolved:
            run.uncertainties.append('Targeted retry budget exhausted or no eligible amendment exists. Unresolved evidence is escalated to the human reviewer.')
        run.uncertainties = list(dict.fromkeys(run.uncertainties))
        run.status = 'partial' if run.audit or any(r.synthetic for r in run.relationships) else 'completed'
        run.finished_at = now()
        run.limitations.append('Transmission uses explicit structured rule templates, not an LLM confidence score or quantitative probability.')

    for name, operation in [('relationship_discovery', scope), ('relationship_verification', verify),
                            ('dependency_materiality', dependencies), ('financial_analysis', finance),
                            ('transmission', transmission), ('independent_audit', audit_run),
                            ('targeted_recheck', recheck), ('report', report)]:
        graph.add_node(name, stage(name, operation))
    graph.add_edge(START, 'relationship_discovery')
    graph.add_conditional_edges('relationship_discovery', lambda s: 'stop' if s['run'].questions else 'continue', {'stop': END, 'continue': 'relationship_verification'})
    for a, b in [('relationship_verification', 'dependency_materiality'), ('dependency_materiality', 'financial_analysis'),
                 ('financial_analysis', 'transmission'), ('transmission', 'independent_audit'), ('targeted_recheck', 'independent_audit')]:
        graph.add_edge(a, b)
    graph.add_conditional_edges('independent_audit',
        lambda s: 'retry' if audit_run(s['run']) and s['run'].retry_count < s['run'].request.retry_budget else 'report',
        {'retry': 'targeted_recheck', 'report': 'report'})
    graph.add_edge('report', END)
    return graph.compile()


class EcosystemManager:
    def __init__(self, store: EcosystemStore):
        self.store = store
        self.tasks: dict[str, asyncio.Task] = {}

    def startup(self):
        self.store.interrupt_active()

    def start(self, case_id, payload, mode='curated'):
        if sum(not t.done() for t in self.tasks.values()) >= MAX_ACTIVE_RUNS:
            raise HTTPException(429, 'Two ecosystem investigations are already active. Wait for one to finish.')
        run = self.store.create(case_id, payload, mode)
        task = asyncio.create_task(self._execute(case_id, run.id))
        self.tasks[run.id] = task
        task.add_done_callback(lambda _: self.tasks.pop(run.id, None))
        return run

    async def _execute(self, case_id, run_id):
        run = self.store.get(case_id, run_id)
        run.status = 'running'
        self.store.save(run)
        self.store.event(case_id, run_id, 'supervisor', 'routed', 'Existing Research Lab supervisor selected the application-owned ecosystem_risk branch. One hop, at most five counterparties, no network/model tools.')
        async def ecosystem_operation(state):
            result = await create_ecosystem_graph(self.store).ainvoke({'run': self.store.get(case_id, run_id)}, {'recursion_limit': 32})
            return {'ecosystem_run': result['run'].model_dump(mode='json')}
        try:
            graph = create_research_graph(AnalysisStore(self.store.research), ecosystem_operation=ecosystem_operation)
            await asyncio.wait_for(graph.ainvoke({'workflow': 'ecosystem_risk', 'case_id': case_id, 'run_id': run_id}, {'recursion_limit': 40}), RUN_SECONDS)
        except asyncio.CancelledError:
            self._failure(case_id, run_id, 'interrupted', 'Investigation cancelled during worker shutdown. Start a new run.')
            raise
        except TimeoutError:
            self._failure(case_id, run_id, 'interrupted', 'The 30-second execution budget was exhausted. Partial saved stages remain visible; no completion was inferred.')
        except Exception:
            # No provider payload, document text or credentials in user errors.
            self._failure(case_id, run_id, 'failed', 'Ecosystem output or storage validation failed. Saved stage events show the last completed operation.')

    def _failure(self, case_id, run_id, status, message):
        run = self.store.get(case_id, run_id)
        if run.status not in TERMINAL:
            run.status, run.finished_at = status, now()
            run.errors.append(message)
            self.store.save(run)
            self.store.event(case_id, run_id, 'execution', status, message)

    async def shutdown(self):
        tasks = list(self.tasks.values())
        for task in tasks:
            task.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)


@asynccontextmanager
async def application_lifespan(app):
    async with research_lifespan(app):
        research = app.state.analysis_manager.store.store
        manager = EcosystemManager(EcosystemStore(research))
        manager.startup()
        app.state.ecosystem_manager = manager
        try:
            yield
        finally:
            await manager.shutdown()
