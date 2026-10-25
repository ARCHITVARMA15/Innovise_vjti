"""
News tool — wraps news_service for the agent.
"""

import logging
from typing import Any

from app.services import news_service as news_svc

log = logging.getLogger("veritas.tools.news")


def get_news_for_entities(entities: list[str], limit: int = 5) -> list[dict[str, Any]]:
    """Get news for given entities from the Finnhub cache."""
    from app.agent.tools.market_data import normalize_ticker

    all_news: list[dict[str, Any]] = []

    for entity in entities[:2]:
        # Try the raw entity first
        ticker_news = news_svc.get_ticker_news(ticker=entity, limit=limit)
        all_news.extend(ticker_news)

        # Also try the resolved ticker (e.g. NVDA for nvidia)
        if not ticker_news:
            resolved = normalize_ticker(entity)
            if resolved != entity.strip().upper():
                ticker_news = news_svc.get_ticker_news(ticker=resolved, limit=limit)
                all_news.extend(ticker_news)

    # If still nothing, try keyword-filtering general news.
    # NEVER return random unrelated articles — empty is better than wrong.
    if not all_news:
        general = news_svc.get_news(limit=50)
        keywords = [e.lower() for e in entities]
        for article in general:
            text = f"{article.get('headline', '')} {article.get('summary', '')}".lower()
            if any(kw in text for kw in keywords):
                all_news.append(article)

    seen: set[str] = set()
    unique: list[dict[str, Any]] = []
    for article in all_news:
        aid = article.get("id", "")
        if aid not in seen:
            seen.add(aid)
            unique.append(article)

    return unique[:limit]


def summarize_news_results(news: list[dict[str, Any]], max_items: int = 5) -> str:
    """
    Summarize news articles to concise text.
    Target: ~200-300 tokens max.
    """
    if not news:
        return "No relevant news articles found."

    lines: list[str] = []
    for i, article in enumerate(news[:max_items], 1):
        headline = article.get("headline", "No headline")
        source = article.get("source_name", article.get("source", "Unknown"))
        sentiment = article.get("sentiment", "neutral")
        published = (article.get("published_at") or "")[:10]
        summary = (article.get("summary") or "")[:120]

        line = f"{i}. [{source}, {published}] {headline} (Sentiment: {sentiment})"
        if summary:
            line += f" — {summary}"
        lines.append(line)

    return "\n".join(lines)


def build_source_refs(
    news: list[dict[str, Any]],
    web_results: list[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    """Build SourceReference dicts for the context panel."""
    sources: list[dict[str, Any]] = []

    for article in news[:5]:
        sources.append({
            "type": "news",
            "title": article.get("headline", "News article"),
            "url": article.get("url"),
            "snippet": (article.get("summary") or "")[:150],
            "confidence": None,
        })

    if web_results:
        for result in web_results[:5]:
            sources.append({
                "type": "web_search",
                "title": result.get("title", "Web result"),
                "url": result.get("url"),
                "snippet": (result.get("snippet") or "")[:150],
                "confidence": None,
            })

    return sources
