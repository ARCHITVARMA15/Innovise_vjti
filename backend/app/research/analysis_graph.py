"""Bounded conditional LangGraph; the Insights graph is never imported or changed."""
import asyncio
import inspect

from langgraph.graph import StateGraph, START, END

from app.research.analysis_state import AnalystState
from app.research.analysis_store import AnalysisStore
from app.research.analysis_planning import planning_node
from app.research.analysis_retrieval import retrieve
from app.research.analysis_financial import financial_node
from app.research.analysis_brief import brief_node
from app.research.analysis_verification import verification_node
from app.research.investigation import resolve_scope, bounded_plan, risk_node, report_node
from app.research.analysis_models import RetrievalOutput, QualitativeOutput, FinancialOutput, VerificationStageOutput
from app.research.analysis_brief import assemble_brief


def create_research_graph(store: AnalysisStore, ecosystem_operation=None):
    graph = StateGraph(AnalystState)
    # Application-owned dispatch; retrieved text cannot select this branch or
    # change its tools/budgets. Ordinary research retains its existing path.
    graph.add_node('optional_supervisor', lambda state: {})
    if ecosystem_operation is not None:
        graph.add_node('ecosystem_risk', ecosystem_operation)
        graph.add_edge('ecosystem_risk', END)

    def node(stage, field, operation):
        async def execute(state):
            store.update(state["case_id"], state["run_id"], event=(stage, "started", f"{stage.replace('_', ' ').capitalize()} started."))
            try:
                result = operation(state)
                if inspect.isawaitable(result):
                    result = await result
                if stage == "brief_assembly" and result.qualitative_status == "unavailable":
                    store.update(state["case_id"], state["run_id"], event=(stage, "failed", "Qualitative synthesis unavailable; saving an explicitly partial numerical brief."))
                store.update(state["case_id"], state["run_id"], output=(stage, result.model_dump(mode="json") if hasattr(result, "model_dump") else result),
                    event=(stage, "completed", f"{stage.replace('_', ' ').capitalize()} output validated and saved."))
                updates={field: result}
                if stage == 'scope_resolution':
                    updates.update(retrieval=RetrievalOutput(passages=[],scanned_sections=0,scanned_chunks=0,total_chunks=0,omitted_chunks=0,limitations=[]),
                        financial=FinancialOutput(findings=[],receipt_ids=[],needs_input=[],limitations=[]),
                        verification=VerificationStageOutput(claim_ids=[],verification_ids=[],status_counts={},limitations=[]))
                return updates
            except asyncio.CancelledError:
                store.update(state["case_id"], state["run_id"], event=(stage, "interrupted", f"{stage.replace('_', ' ').capitalize()} was cancelled before completion."))
                raise
            except Exception:
                store.update(state["case_id"], state["run_id"], event=(stage, "failed", f"{stage.replace('_', ' ').capitalize()} did not complete. See run errors."))
                raise
        return execute

    graph.add_node("scope_resolution", node("scope_resolution", "scope", resolve_scope))
    async def plan(state):
        return bounded_plan(state) if state.get("request", {}).get("task_type") else await planning_node(state)
    def skip(state, stage):
        store.update(state["case_id"], state["run_id"], event=(stage,"skipped","Not required by validated task route."))
    def retrieval(state):
        if state.get("request", {}).get("task_type") in ("simple_metric", "claim_verification"):
            skip(state,"evidence_retrieval")
            return RetrievalOutput(passages=[],scanned_sections=0,scanned_chunks=0,total_chunks=0,omitted_chunks=0,limitations=[])
        return retrieve(state["snapshot"], state["plan"])
    async def brief(state):
        if state.get("request", {}).get("task_type") in ("simple_metric", "claim_verification", "risk_assessment"):
            store.update(state['case_id'],state['run_id'],event=('qualitative_synthesis','skipped','Model synthesis not required; deterministic brief assembled from saved results.'))
            result=assemble_brief(state, QualitativeOutput(observations=[]))
            result.qualitative_status='not_requested'
            return result
        return await brief_node(state)
    graph.add_node("planning", node("planning", "plan", plan))
    graph.add_node("evidence_retrieval", node("evidence_retrieval", "retrieval", retrieval))
    graph.add_node("financial_analysis", node("financial_analysis", "financial", lambda state: financial_node(state, store)))
    graph.add_node("verification", node("verification", "verification", lambda state: verification_node(state, store)))
    graph.add_node("brief_assembly", node("brief_assembly", "brief", brief))
    graph.add_node("risk_assessment", node("risk_assessment", "risks", lambda state: risk_node(state, store)))
    graph.add_node("report_composition", node("report_composition", "report", lambda state: report_node(state, store)))
    graph.add_edge(START, 'optional_supervisor')
    def supervisor_route(state):
        if state.get('workflow') == 'ecosystem_risk':
            if ecosystem_operation is None:
                raise ValueError('Ecosystem execution is available through the case ecosystem API.')
            return 'ecosystem_risk'
        return 'scope_resolution'
    destinations = {'scope_resolution': 'scope_resolution'}
    if ecosystem_operation is not None:
        destinations['ecosystem_risk'] = 'ecosystem_risk'
    graph.add_conditional_edges('optional_supervisor', supervisor_route, destinations)
    graph.add_conditional_edges("scope_resolution", lambda state: "stop" if state["scope"]["questions"] else "continue", {"stop":END,"continue":"planning"})
    def after_plan(state):
        task=state.get('request',{}).get('task_type')
        if task=='simple_metric':
            skip(state,'evidence_retrieval')
            return 'financial_analysis'
        if task=='claim_verification':
            skip(state,'evidence_retrieval'); skip(state,'financial_analysis')
            return 'verification'
        return 'evidence_retrieval'
    graph.add_conditional_edges('planning',after_plan,{'financial_analysis':'financial_analysis','verification':'verification','evidence_retrieval':'evidence_retrieval'})
    def after_retrieval(state):
        if state.get('request',{}).get('task_type') in (None,'full_research') or state['plan'].calculations:
            return 'financial_analysis'
        skip(state,'financial_analysis')
        if state.get('request',{}).get('claim_ids'):
            return 'verification'
        skip(state,'verification')
        return 'brief_assembly'
    graph.add_conditional_edges('evidence_retrieval',after_retrieval,{'financial_analysis':'financial_analysis','verification':'verification','brief_assembly':'brief_assembly'})
    graph.add_edge("financial_analysis", "verification")
    graph.add_edge("verification", "brief_assembly")
    def after_brief(state):
        task=state.get('request',{}).get('task_type')
        if not task:
            return 'legacy'
        if task in ('risk_assessment','full_research'):
            return 'risk'
        skip(state,'risk_assessment')
        return 'report'
    graph.add_conditional_edges("brief_assembly", after_brief, {"risk":"risk_assessment","report":"report_composition","legacy":END})
    graph.add_edge("risk_assessment", "report_composition")
    graph.add_edge("report_composition", END)
    return graph.compile()
