"""
Verify news node — cross-references news from multiple sources to check truthfulness.
Also fetches current market data when stock entities are detected.
"""

import logging
from datetime import datetime, timezone

from app.agent.config import PRIMARY_MODEL, safe_llm_call
from app.agent.prompts.system import get_veritas_system_prompt
from app.agent.prompts.verify_prompt import VERIFY_SYSTEM_PROMPT
from app.agent.state import AgentState
from app.agent.tools.evidence_tools import build_evidence_items, build_market_evidence
from app.agent.tools.market_data import build_data_snapshots, get_asset_data, summarize_market_data
from app.agent.tools.news_tools import build_source_refs, get_news_for_entities, summarize_news_results
from app.agent.tools.workflow_plan import get_mode_plan
from app.agent.tools.web_search import summarize_search_results, web_search

log = logging.getLogger("veritas.nodes.verify_news")


async def verify_news_node(state: AgentState) -> dict:
    """
    Verification pipeline:
    1. Web search for independent sources (Tavily primary)
    2. Fetch news from Finnhub for the entities
    3. Fetch current market data if stock entities detected
    4. ONE Llama 70B call with all context
    """
    entities = state.get("entities") or []
    query = state["query"]
    iteration = int(state.get("iteration", 0)) + 1

    # ── Step 1: Web search (primary verification source) ──
    web_results = web_search(query, max_results=5)
    if iteration > 1:
        web_results += web_search(f"{query} fact check contradictory evidence", max_results=3)
    web_summary = summarize_search_results(web_results)

    # ── Step 2: Fetch news ──
    news_results = get_news_for_entities(entities, limit=3) if entities else []
    news_summary = summarize_news_results(news_results, max_items=3)

    # ── Step 3: Fetch market data for any stock entities ──
    market_data: dict = {}
    market_summary = ""
    data_snapshots: list[dict] = []
    if entities:
        market_data = get_asset_data(entities)
        market_summary = summarize_market_data(market_data)
        data_snapshots = build_data_snapshots(market_data)

    # ── Step 4: LLM verification ──
    history_ctx = _build_history_context(state)
    system_prompt = f"{get_veritas_system_prompt()}\n\n{VERIFY_SYSTEM_PROMPT}"

    parts = [f"{history_ctx}Claim to verify: {query}"]
    parts.append(f"\nWeb search results:\n{web_summary}")
    if news_summary and news_summary != "No relevant news articles found.":
        parts.append(f"\nFinancial news:\n{news_summary}")
    if market_summary and market_summary != "No market data available.":
        parts.append(f"\nCurrent market data:\n{market_summary}")

    answer = await safe_llm_call(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": "\n".join(parts)},
        ],
        model=PRIMARY_MODEL,
        max_tokens=1000,
        fallback_model="llama-3.1-8b-instant",
    )

    sources = build_source_refs(news_results, web_results)
    evidence_items = (
        build_evidence_items(iteration=iteration, intent="verify", source_type="news", raw_items=news_results)
        + build_evidence_items(iteration=iteration, intent="verify", source_type="web_search", raw_items=web_results)
        + build_market_evidence(iteration=iteration, intent="verify", market_data=market_data)
    )
    mode_plan = get_mode_plan("verify", iteration, entities)
    confidence_by_title = {e["source_title"]: e["confidence"] for e in evidence_items}
    for src in sources:
        if src.get("title") in confidence_by_title:
            src["confidence"] = confidence_by_title[src["title"]]

    return {
        "tool_results": [
            {"tool": "web_search", "data": web_summary},
            {"tool": "news_fetch", "data": news_summary},
        ],
        "tool_summaries": [
            f"Found {len(web_results)} web results",
            f"Found {len(news_results)} news articles",
        ],
        "sources": sources,
        "data_snapshots": data_snapshots,
        "traces": [
            {
                "iteration": int(state.get("iteration", 0)) + 1,
                "layer": "execution",
                "intent": "verify",
                "summary": "Cross-verified claim across web, financial news, and market context.",
                "confidence": float(state.get("intent_confidence", 0.0)) if state.get("intent_confidence") is not None else None,
                "stop_reason": None,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        ],
        "iteration_outputs": [
            {
                "iteration": int(state.get("iteration", 0)) + 1,
                "layer": "execution",
                "intent": "verify",
                "tools": ["web_search", "news_fetch", "market_data"],
                "tool_summaries": [
                    f"Collected {len(web_results)} web references",
                    f"Collected {len(news_results)} financial news items",
                    f"Loaded market data for {len(market_data)} assets",
                ],
                "mode_plan": mode_plan,
                "answer_preview": answer[:220],
            }
        ],
        "evidence_items": evidence_items,
        "thinking_steps": [
            {"step": "Searching web sources...", "tool": "web_search", "status": "done"},
            *([{"step": "Running contradiction sweep...", "tool": "web_search", "status": "done"}] if iteration > 1 else []),
            {"step": f"Checking news for {', '.join(entities) or 'topic'}...", "tool": "news_fetch", "status": "done"},
            *([{"step": f"Fetching prices for {', '.join(entities)}...", "tool": "market_data", "status": "done"}] if entities else []),
            {"step": "Verifying claim...", "tool": None, "status": "done"},
        ],
        "verification_result": {"raw_analysis": answer},
        "answer": answer,
    }


def _build_history_context(state: AgentState) -> str:
    history = state.get("conversation_history") or []
    if not history:
        return ""
    last = history[-4:]
    lines = [f"{'User' if t['role'] == 'user' else 'Veritas'}: {t['content'][:200]}" for t in last]
    return "Conversation context:\n" + "\n".join(lines) + "\n\n"
