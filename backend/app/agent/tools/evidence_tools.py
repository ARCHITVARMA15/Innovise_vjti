"""
Evidence scoring helpers for Veritas Evidence Ledger.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse


_HIGH_TRUST_DOMAINS = {
    "reuters.com",
    "bloomberg.com",
    "wsj.com",
    "ft.com",
    "moneycontrol.com",
    "seekingalpha.com",
}

_MEDIUM_TRUST_DOMAINS = {
    "yahoo.com",
    "marketwatch.com",
    "investing.com",
    "fool.com",
}


def _domain_score(url: str | None) -> float:
    if not url:
        return 0.55
    host = urlparse(url).netloc.lower().replace("www.", "")
    if host in _HIGH_TRUST_DOMAINS:
        return 0.9
    if host in _MEDIUM_TRUST_DOMAINS:
        return 0.72
    if host:
        return 0.62
    return 0.55


def _recency_days(raw: str | None) -> int | None:
    if not raw:
        return None
    try:
        ts = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        return max((now - ts).days, 0)
    except Exception:
        return None


def _recency_score(days: int | None) -> float:
    if days is None:
        return 0.6
    if days <= 1:
        return 0.95
    if days <= 3:
        return 0.85
    if days <= 7:
        return 0.75
    if days <= 30:
        return 0.62
    return 0.48


def _rating(score: float) -> str:
    if score >= 0.8:
        return "high"
    if score >= 0.62:
        return "medium"
    return "low"


def _signal_from_sentiment(sentiment: str | None) -> str:
    s = (sentiment or "").lower()
    if s in {"negative", "bearish"}:
        return "conflicting"
    if s in {"positive", "bullish"}:
        return "supporting"
    return "neutral"


def build_evidence_items(
    *,
    iteration: int,
    intent: str,
    source_type: str,
    raw_items: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Normalize heterogeneous sources into scored evidence items."""
    evidence: list[dict[str, Any]] = []

    for idx, item in enumerate(raw_items[:8], start=1):
        title = (
            item.get("title")
            or item.get("headline")
            or item.get("label")
            or "Untitled source"
        )
        url = item.get("url")
        published = item.get("published_at") or item.get("published")
        days = _recency_days(published)

        quality = _domain_score(url)
        freshness = _recency_score(days)
        score = round((quality * 0.6) + (freshness * 0.4), 3)

        sentiment = item.get("sentiment")
        signal = _signal_from_sentiment(sentiment)

        evidence.append(
            {
                "id": f"{intent}-{source_type}-{iteration}-{idx}",
                "iteration": iteration,
                "intent": intent,
                "source_type": source_type,
                "source_title": str(title)[:140],
                "source_url": url,
                "signal": signal,
                "rating": _rating(score),
                "confidence": score,
                "recency_days": days,
                "quality_score": round(quality, 3),
                "rationale": (
                    f"Quality {int(quality * 100)} and freshness {int(freshness * 100)} "
                    f"yield confidence {int(score * 100)}."
                ),
            }
        )

    return evidence


def build_market_evidence(iteration: int, intent: str, market_data: dict[str, Any]) -> list[dict[str, Any]]:
    """Build evidence entries for market snapshots."""
    items: list[dict[str, Any]] = []
    for idx, (ticker, payload) in enumerate((market_data or {}).items(), start=1):
        price = payload.get("price")
        change = payload.get("change_percent")
        score = 0.9 if price is not None else 0.68
        signal = "supporting"
        if change is not None and float(change) < -2.5:
            signal = "conflicting"

        items.append(
            {
                "id": f"{intent}-market-{iteration}-{idx}",
                "iteration": iteration,
                "intent": intent,
                "source_type": "market_data",
                "source_title": f"{ticker} live quote",
                "source_url": None,
                "signal": signal,
                "rating": _rating(score),
                "confidence": score,
                "recency_days": 0,
                "quality_score": score,
                "rationale": "Live market feed signal from latest quote snapshot.",
            }
        )

    return items
