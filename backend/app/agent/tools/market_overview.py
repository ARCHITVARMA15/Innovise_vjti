"""
Market overview tool — wraps markets_service for the agent.
"""

import logging
from typing import Any

from app.services import markets_service as markets_svc

log = logging.getLogger("veritas.tools.market_overview")


def get_market_conditions() -> dict[str, Any]:
    """Get current market overview for strategy/analysis context."""
    try:
        indices = markets_svc.get_market_indices()
    except Exception:
        indices = []

    try:
        sectors = markets_svc.get_sector_heatmap()
    except Exception:
        sectors = []

    try:
        signals = markets_svc.get_algorithmic_signals()
    except Exception:
        signals = []

    return {
        "indices": indices,
        "sectors": sectors,
        "signals": signals,
    }


def summarize_market_conditions(data: dict[str, Any]) -> str:
    """
    Summarize market conditions to concise text.
    Target: ~150-200 tokens max.
    """
    lines: list[str] = ["Market Overview:"]

    for idx in (data.get("indices") or [])[:4]:
        label = idx.get("label", "?")
        change = idx.get("changePercent", 0)
        price = idx.get("price", "N/A")
        direction = "↑" if change >= 0 else "↓"
        lines.append(f"  {label}: {price} {direction} {abs(change):.1f}%")

    top_sectors = sorted(
        (data.get("sectors") or []),
        key=lambda s: abs(s.get("changePercent", 0)),
        reverse=True,
    )[:3]
    if top_sectors:
        lines.append("Top Moving Sectors:")
        for s in top_sectors:
            lines.append(f"  {s.get('label', '?')}: {s.get('changePercent', 0):+.1f}%")

    active_signals = [
        s for s in (data.get("signals") or [])
        if s.get("status") == "CONFIRMED"
    ]
    if active_signals:
        lines.append(f"Active Signals: {len(active_signals)} confirmed")
        for sig in active_signals[:2]:
            lines.append(f"  {sig.get('ticker', '?')} — {(sig.get('description') or '')[:60]}")

    return "\n".join(lines)
