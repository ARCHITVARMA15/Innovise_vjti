"""
LangGraph StateGraph definition for the Veritas research agent.
"""

from datetime import datetime, timezone

from langgraph.graph import END, START, StateGraph

from app.agent.nodes.analyze_asset import analyze_asset_node
from app.agent.nodes.general_research import general_research_node
from app.agent.nodes.router import router_node
from app.agent.nodes.regulators_check import regulators_check_node
from app.agent.nodes.strategy_advisor import strategy_advisor_node
from app.agent.nodes.verify_news import verify_news_node
from app.agent.nodes.what_if import what_if_node
from app.agent.state import AgentState


def _route_by_intent(state: AgentState) -> str:
    """Conditional edge function — returns the next node name based on classified intent."""
    return state["intent"]


def _increment_iteration(state: AgentState) -> dict:
    """Bookkeep iteration state and decide whether to continue the loop."""
    current = int(state.get("iteration", 0)) + 1
    max_iterations = int(state.get("max_iterations", 2))
    answer = (state.get("answer") or "").strip()

    stop_reason = state.get("stop_reason")
    if current >= max_iterations and not stop_reason:
        stop_reason = "max_iterations_reached"
    elif answer and not stop_reason:
        stop_reason = "answer_ready"

    trace = {
        "iteration": current,
        "layer": "synthesis",
        "intent": state.get("intent", "general"),
        "summary": f"Iteration {current} synthesized response.",
        "confidence": float(state.get("intent_confidence", 0.0)) if state.get("intent_confidence") is not None else None,
        "stop_reason": stop_reason,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    return {
        "iteration": current,
        "stop_reason": stop_reason,
        "traces": [trace],
    }


def _should_continue(state: AgentState) -> str:
    """Route controller for iterative execution."""
    iteration = int(state.get("iteration", 0))
    max_iterations = int(state.get("max_iterations", 2))
    if state.get("stop_reason"):
        return "end"
    if iteration < max_iterations:
        return "continue"
    return "end"


def create_agent_graph():
    """Build and compile the Veritas agent graph."""

    graph = StateGraph(AgentState)

    # Register nodes
    graph.add_node("router", router_node)
    graph.add_node("verify", verify_news_node)
    graph.add_node("analyze", analyze_asset_node)
    graph.add_node("strategy", strategy_advisor_node)
    graph.add_node("what_if", what_if_node)
    graph.add_node("regulatory", regulators_check_node)
    graph.add_node("general", general_research_node)
    graph.add_node("iteration_control", _increment_iteration)

    # Entry edge
    graph.add_edge(START, "router")

    # Conditional routing from router
    graph.add_conditional_edges(
        "router",
        _route_by_intent,
        {
            "verify": "verify",
            "analyze": "analyze",
            "strategy": "strategy",
            "what_if": "what_if",
            "regulatory": "regulatory",
            "general": "general",
        },
    )

    # All subgraphs go to iteration controller
    graph.add_edge("verify", "iteration_control")
    graph.add_edge("analyze", "iteration_control")
    graph.add_edge("strategy", "iteration_control")
    graph.add_edge("what_if", "iteration_control")
    graph.add_edge("regulatory", "iteration_control")
    graph.add_edge("general", "iteration_control")

    # Loop until stop condition is met
    graph.add_conditional_edges(
        "iteration_control",
        _should_continue,
        {
            "continue": "router",
            "end": END,
        },
    )

    return graph.compile()
