"""
Web search tool — Tavily (primary) with DuckDuckGo fallback.

Tavily is purpose-built for AI agents and returns clean, summarised results.
Free tier: 1,000 searches / month.  Falls back to DuckDuckGo when the
TAVILY_API_KEY env-var is missing or the call fails.
"""

import logging
import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

_ENV_PATH = Path(__file__).resolve().parents[3] / ".env"
load_dotenv(dotenv_path=_ENV_PATH, override=True)

log = logging.getLogger("veritas.tools.web_search")


def _get_tavily_key() -> str:
    load_dotenv(dotenv_path=_ENV_PATH, override=True)
    return os.getenv("TAVILY_API_KEY", "")


# ── Tavily search ────────────────────────────────────────────────────────────

def _tavily_search(query: str, max_results: int = 5) -> list[dict[str, Any]]:
    """Search via Tavily API. Returns normalised result dicts."""
    from tavily import TavilyClient

    client = TavilyClient(api_key=_get_tavily_key())
    response = client.search(
        query=query,
        max_results=max_results,
        search_depth="basic",
        include_answer=False,
    )

    results: list[dict[str, Any]] = []
    for r in response.get("results", []):
        results.append({
            "title": r.get("title", ""),
            "url": r.get("url", ""),
            "snippet": r.get("content", "")[:300],
        })
    return results


# ── DuckDuckGo fallback ─────────────────────────────────────────────────────

def _ddg_search(query: str, max_results: int = 5) -> list[dict[str, Any]]:
    """Fallback search via DuckDuckGo. Free, no API key."""
    from duckduckgo_search import DDGS

    with DDGS() as ddgs:
        raw = list(ddgs.text(query, max_results=max_results))

    return [
        {
            "title": r.get("title", ""),
            "url": r.get("href", r.get("link", "")),
            "snippet": r.get("body", r.get("snippet", "")),
        }
        for r in raw
    ]


# ── Public API ───────────────────────────────────────────────────────────────

def web_search(query: str, max_results: int = 5) -> list[dict[str, Any]]:
    """
    Search the web. Uses Tavily when TAVILY_API_KEY is set,
    otherwise falls back to DuckDuckGo.
    Returns list of {"title", "url", "snippet"}.
    """
    # Try Tavily first
    if _get_tavily_key():
        try:
            results = _tavily_search(query, max_results)
            if results:
                log.info("Tavily returned %d results", len(results))
                return results
        except Exception as exc:
            log.warning("Tavily search failed (%s) — falling back to DuckDuckGo", exc)

    # Fallback to DuckDuckGo
    try:
        results = _ddg_search(query, max_results)
        if results:
            log.info("DuckDuckGo returned %d results", len(results))
            return results
    except Exception as exc:
        log.warning("DuckDuckGo search also failed: %s", exc)

    return []


def summarize_search_results(results: list[dict[str, Any]], max_items: int = 5) -> str:
    """
    Summarize web search results to concise text.
    Target: ~200-400 tokens max.
    """
    if not results:
        return "No web results found."

    lines: list[str] = []
    for i, r in enumerate(results[:max_items], 1):
        title = (r.get("title") or "No title")[:80]
        snippet = (r.get("snippet") or "")[:150]
        url = r.get("url", "")
        lines.append(f"{i}. {title}\n   {snippet}\n   Source: {url}")

    return "\n".join(lines)
