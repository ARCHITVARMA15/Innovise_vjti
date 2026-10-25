"""
What-if / cause chain analysis node — scenario simulation with historical precedents.
"""

import logging
from datetime import datetime, timezone

from app.agent.config import PRIMARY_MODEL, safe_llm_call
from app.agent.prompts.system import get_veritas_system_prompt
from app.agent.prompts.what_if_prompt import WHAT_IF_SYSTEM_PROMPT
from app.agent.state import AgentState
from app.agent.tools.evidence_tools import build_evidence_items, build_market_evidence
from app.agent.tools.market_data import build_data_snapshots, get_asset_data, summarize_market_data
from app.agent.tools.workflow_plan import get_mode_plan
from app.agent.tools.web_search import summarize_search_results, web_search

log = logging.getLogger("veritas.nodes.what_if")


async def what_if_node(state: AgentState) -> dict:
    """
    What-if pipeline:
    1. Web search for historical precedents of the scenario
    2. Fetch current market data for affected entities
    3. ONE Llama 70B call for causal chain reasoning
    """
    query = state["query"]
    entities = state.get("entities") or []
    iteration = int(state.get("iteration", 0)) + 1

    # ── Step 1: Search historical precedents ──
    search_query = f"historical impact {query} stock market financial markets"
    precedents = web_search(search_query, max_results=5)
    if iteration > 1:
        precedents += web_search(f"{query} tail risk contagion policy response", max_results=3)
    precedent_summary = summarize_search_results(precedents)

    # ── Step 2: Get current data for affected entities ──
    market_data: dict = {}
    market_summary = "No specific assets identified."
    data_snapshots: list[dict] = []
    if entities:
        market_data = get_asset_data(entities)
        market_summary = summarize_market_data(market_data)
        data_snapshots = build_data_snapshots(market_data)

    # ── Step 3: LLM causal chain reasoning ──
    history_ctx = _build_history_context(state)
    system_prompt = f"{get_veritas_system_prompt()}\n\n{WHAT_IF_SYSTEM_PROMPT}"

    user_message = (
        f"{history_ctx}"
        f"Scenario: {query}\n\n"
        f"Historical Precedents:\n{precedent_summary}\n\n"
        f"Current Market Context:\n{market_summary}\n\n"
        "Build a cause-and-effect chain:\n"
        "1. Immediate impacts (0-1 week)\n"
        "2. Secondary effects (1-4 weeks)\n"
        "3. Long-term implications (1-6 months)\n"
        "4. Which sectors/assets are most affected?\n"
        "5. Historical parallel and what happened then."
    )

    answer = await safe_llm_call(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        model=PRIMARY_MODEL,
        max_tokens=1100,
        fallback_model="llama-3.1-8b-instant",
    )

    sources: list[dict] = []
    for r in precedents[:5]:
        sources.append({
            "type": "web_search",
            "title": r.get("title", "Web result"),
            "url": r.get("url"),
            "snippet": (r.get("snippet") or "")[:150],
            "confidence": None,
        })

    evidence_items = (
        build_evidence_items(iteration=iteration, intent="what_if", source_type="web_search", raw_items=precedents)
        + build_market_evidence(iteration=iteration, intent="what_if", market_data=market_data)
    )
    mode_plan = get_mode_plan("what_if", iteration, entities)
    confidence_by_title = {e["source_title"]: e["confidence"] for e in evidence_items}
    for src in sources:
        if src.get("title") in confidence_by_title:
            src["confidence"] = confidence_by_title[src["title"]]

    return {
        "tool_results": [
            {"tool": "web_search", "data": precedent_summary},
            {"tool": "market_data", "data": market_summary},
        ],
        "tool_summaries": [
            f"Found {len(precedents)} historical precedents",
            f"Checked {len(entities)} affected assets",
        ],
        "sources": sources,
        "data_snapshots": data_snapshots,
        "traces": [
            {
                "iteration": int(state.get("iteration", 0)) + 1,
                "layer": "execution",
                "intent": "what_if",
                "summary": "Evaluated scenario using historical precedents and current market context.",
                "confidence": float(state.get("intent_confidence", 0.0)) if state.get("intent_confidence") is not None else None,
                "stop_reason": None,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        ],
        "iteration_outputs": [
            {
                "iteration": int(state.get("iteration", 0)) + 1,
                "layer": "execution",
                "intent": "what_if",
                "tools": ["web_search", "market_data"],
                "tool_summaries": [
                    f"Found {len(precedents)} historical precedents",
                    f"Loaded market context for {len(entities)} entities",
                ],
                "mode_plan": mode_plan,
                "answer_preview": answer[:220],
            }
        ],
        "evidence_items": evidence_items,
        "thinking_steps": [
            {"step": "Searching historical precedents...", "tool": "web_search", "status": "done"},
            *([{"step": "Expanding with tail-risk scenarios...", "tool": "web_search", "status": "done"}] if iteration > 1 else []),
            {"step": "Checking affected assets...", "tool": "market_data", "status": "done"},
            {"step": "Building cause-effect chain...", "tool": None, "status": "done"},
        ],
        "answer": answer,
    }


def _build_history_context(state: AgentState) -> str:
    history = state.get("conversation_history") or []
    if not history:
        return ""
    last = history[-4:]
    lines = [f"{'User' if t['role'] == 'user' else 'Veritas'}: {t['content'][:200]}" for t in last]
    return "Conversation context:\n" + "\n".join(lines) + "\n\n"
