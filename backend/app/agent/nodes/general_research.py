"""
General research node — catch-all for general financial questions.
"""

import logging
from datetime import datetime, timezone

from app.agent.config import PRIMARY_MODEL, safe_llm_call
from app.agent.prompts.system import get_veritas_system_prompt
from app.agent.state import AgentState
from app.agent.tools.evidence_tools import build_evidence_items, build_market_evidence
from app.agent.tools.market_data import build_data_snapshots, get_asset_data, summarize_market_data
from app.agent.tools.workflow_plan import get_mode_plan
from app.agent.tools.web_search import summarize_search_results, web_search

log = logging.getLogger("veritas.nodes.general_research")


async def general_research_node(state: AgentState) -> dict:
    """
    General pipeline:
    1. Web search for context
    2. Optionally fetch market data if entities look like tickers
    3. ONE Llama 70B call to answer
    """
    query = state["query"]
    entities = state.get("entities") or []
    iteration = int(state.get("iteration", 0)) + 1

    # ── Step 1: Web search ──
    search_results = web_search(query, max_results=3)
    if iteration > 1:
        search_results += web_search(f"{query} corroboration counterpoint analysis", max_results=2)
    search_summary = summarize_search_results(search_results)

    # ── Step 2: Market data if entities present ──
    market_summary = ""
    data_snapshots: list[dict] = []
    if entities:
        market_data = get_asset_data(entities)
        market_summary = summarize_market_data(market_data)
        data_snapshots = build_data_snapshots(market_data)

    # ── Step 3: LLM answer ──
    history_ctx = _build_history_context(state)
    system_prompt = get_veritas_system_prompt()

    parts = [f"{history_ctx}Query: {query}"]
    if search_summary and search_summary != "No web results found.":
        parts.append(f"\nWeb Search Results:\n{search_summary}")
    if market_summary and market_summary != "No market data available.":
        parts.append(f"\nMarket Data:\n{market_summary}")

    user_message = "\n".join(parts)

    answer = await safe_llm_call(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        model=PRIMARY_MODEL,
        max_tokens=900,
        fallback_model="llama-3.1-8b-instant",
    )

    sources: list[dict] = []
    for r in search_results[:3]:
        sources.append({
            "type": "web_search",
            "title": r.get("title", "Web result"),
            "url": r.get("url"),
            "snippet": (r.get("snippet") or "")[:150],
            "confidence": None,
        })

    evidence_items = (
        build_evidence_items(iteration=iteration, intent="general", source_type="web_search", raw_items=search_results)
        + build_market_evidence(iteration=iteration, intent="general", market_data=market_data if entities else {})
    )
    mode_plan = get_mode_plan("general", iteration, entities)
    confidence_by_title = {e["source_title"]: e["confidence"] for e in evidence_items}
    for src in sources:
        if src.get("title") in confidence_by_title:
            src["confidence"] = confidence_by_title[src["title"]]

    return {
        "tool_results": [{"tool": "web_search", "data": search_summary}],
        "tool_summaries": ["Searched web for context"],
        "sources": sources,
        "data_snapshots": data_snapshots,
        "traces": [
            {
                "iteration": int(state.get("iteration", 0)) + 1,
                "layer": "execution",
                "intent": "general",
                "summary": "Synthesized response from web context and optional market snapshots.",
                "confidence": float(state.get("intent_confidence", 0.0)) if state.get("intent_confidence") is not None else None,
                "stop_reason": None,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        ],
        "iteration_outputs": [
            {
                "iteration": int(state.get("iteration", 0)) + 1,
                "layer": "execution",
                "intent": "general",
                "tools": ["web_search", "market_data"],
                "tool_summaries": [
                    f"Collected {len(search_results)} web references",
                    f"Loaded market snapshots for {len(entities)} entities",
                ],
                "mode_plan": mode_plan,
                "answer_preview": answer[:220],
            }
        ],
        "evidence_items": evidence_items,
        "thinking_steps": [
            {"step": "Researching...", "tool": "web_search", "status": "done"},
            *([{"step": "Running corroboration pass...", "tool": "web_search", "status": "done"}] if iteration > 1 else []),
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
