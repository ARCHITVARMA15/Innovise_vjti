"""
Analyze asset node — fundamental + technical overview of any stock/commodity/bond.
Uses Tavily/DDG web search as the primary research source + yfinance for live data.
"""

import logging
from datetime import datetime, timezone
from typing import Any

from app.agent.config import PRIMARY_MODEL, safe_llm_call
from app.agent.prompts.analyze_prompt import ANALYZE_SYSTEM_PROMPT
from app.agent.prompts.system import get_veritas_system_prompt
from app.agent.state import AgentState
from app.agent.tools.evidence_tools import build_evidence_items, build_market_evidence
from app.agent.tools.market_data import build_data_snapshots, get_asset_data, normalize_ticker, summarize_market_data
from app.agent.tools.workflow_plan import get_mode_plan
from app.agent.tools.web_search import summarize_search_results, web_search

log = logging.getLogger("veritas.nodes.analyze_asset")


def _get_trend_data(entities: list[str]) -> list[dict[str, Any]]:
    """Fetch 1-month price history for trend sparkline in context panel."""
    from app.services import yfinance_service as yf_svc

    snapshots: list[dict[str, Any]] = []
    for entity in entities[:2]:
        ticker = normalize_ticker(entity)
        try:
            history = yf_svc.get_stock_history(ticker, period="1mo", interval="1d")
            if history:
                points = [{"date": p["date"][:10], "close": p["close"]} for p in history[-15:]]
                snapshots.append({
                    "type": "chart_data",
                    "label": f"{ticker} — 1M Trend",
                    "data": {"ticker": ticker, "points": points},
                })
        except Exception:
            pass
    return snapshots


async def analyze_asset_node(state: AgentState) -> dict:
    """
    Analysis pipeline:
    1. Fetch live market data via yfinance
    2. Web search (Tavily) for latest news/analysis about the entity
    3. Fetch trend history for context panel
    4. ONE Llama 70B call
    """
    entities = state.get("entities") or []
    query = state["query"]
    iteration = int(state.get("iteration", 0)) + 1

    # ── Step 1: Fetch live market data ──
    market_data = get_asset_data(entities) if entities else {}
    market_summary = summarize_market_data(market_data)

    # ── Step 2: Web search — the primary research source ──
    entity_names = " ".join(entities) if entities else query
    search_query = f"{entity_names} stock analysis latest news {query}"
    web_results = web_search(search_query, max_results=5)
    if iteration > 1:
        refinement_query = f"{entity_names} valuation risks earnings guidance macro sensitivity"
        web_results += web_search(refinement_query, max_results=3)
    web_summary = summarize_search_results(web_results)

    # ── Step 3: Trend data for context panel ──
    trend_snapshots = _get_trend_data(entities) if entities else []

    # ── Step 4: LLM analysis ──
    history_ctx = _build_history_context(state)
    system_prompt = f"{get_veritas_system_prompt()}\n\n{ANALYZE_SYSTEM_PROMPT}"

    parts = [f"{history_ctx}Query: {query}"]
    parts.append(f"\nLive Market Data:\n{market_summary}")
    if web_summary and web_summary != "No web results found.":
        parts.append(f"\nRecent Research & News (web search):\n{web_summary}")

    answer = await safe_llm_call(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": "\n".join(parts)},
        ],
        model=PRIMARY_MODEL,
        max_tokens=1000,
        fallback_model="llama-3.1-8b-instant",
    )

    # Data snapshots: live quote + trend chart
    data_snapshots = build_data_snapshots(market_data) + trend_snapshots

    # Sources: only web search results (relevant to the entity)
    sources: list[dict] = []
    for r in web_results[:5]:
        sources.append({
            "type": "web_search",
            "title": r.get("title", "Web result"),
            "url": r.get("url"),
            "snippet": (r.get("snippet") or "")[:150],
            "confidence": None,
        })

    evidence_items = (
        build_evidence_items(iteration=iteration, intent="analyze", source_type="web_search", raw_items=web_results)
        + build_market_evidence(iteration=iteration, intent="analyze", market_data=market_data)
    )
    mode_plan = get_mode_plan("analyze", iteration, entities)
    confidence_by_title = {e["source_title"]: e["confidence"] for e in evidence_items}
    for src in sources:
        if src.get("title") in confidence_by_title:
            src["confidence"] = confidence_by_title[src["title"]]

    return {
        "tool_results": [
            {"tool": "market_data", "data": market_summary},
            {"tool": "web_search", "data": web_summary},
        ],
        "tool_summaries": [
            f"Fetched live data for {', '.join(entities) or 'requested assets'}",
            f"Found {len(web_results)} web research results",
        ],
        "sources": sources,
        "data_snapshots": data_snapshots,
        "traces": [
            {
                "iteration": int(state.get("iteration", 0)) + 1,
                "layer": "execution",
                "intent": "analyze",
                "summary": f"Analyzed {', '.join(entities[:2]) if entities else 'query context'} with market + web data.",
                "confidence": float(state.get("intent_confidence", 0.0)) if state.get("intent_confidence") is not None else None,
                "stop_reason": None,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        ],
        "iteration_outputs": [
            {
                "iteration": int(state.get("iteration", 0)) + 1,
                "layer": "execution",
                "intent": "analyze",
                "tools": ["market_data", "web_search"],
                "tool_summaries": [
                    f"Fetched market data for {len(market_data)} assets",
                    f"Found {len(web_results)} web research results",
                ],
                "mode_plan": mode_plan,
                "answer_preview": answer[:220],
            }
        ],
        "evidence_items": evidence_items,
        "thinking_steps": [
            {"step": f"Fetching live data for {', '.join(entities) or 'assets'}...", "tool": "market_data", "status": "done"},
            {"step": f"Researching {entity_names}...", "tool": "web_search", "status": "done"},
            *([{"step": "Running refinement pass for risk catalysts...", "tool": "web_search", "status": "done"}] if iteration > 1 else []),
            {"step": "Running analysis...", "tool": None, "status": "done"},
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
