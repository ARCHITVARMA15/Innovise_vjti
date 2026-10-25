"""
Portfolio tool — wraps portfolio_service and portfolio_analysis_service for the agent.
"""

import logging
from typing import Any

from app.services import portfolio_service as portfolio_svc
from app.services import portfolio_analysis_service as analysis_svc

log = logging.getLogger("veritas.tools.portfolio")


def get_portfolio_context() -> dict[str, Any]:
    """
    Get full portfolio context for strategy advice.
    Combines holdings, summary, strategy, allocation, and diversification.
    """
    try:
        holdings = portfolio_svc.get_holdings()
    except Exception:
        holdings = []

    try:
        summary = portfolio_svc.get_portfolio_summary()
    except Exception:
        summary = {}

    try:
        strategy = analysis_svc.get_current_strategy()
    except Exception:
        strategy = {}

    try:
        allocation = analysis_svc.compute_allocation()
    except Exception:
        allocation = []

    try:
        diversification = analysis_svc.compute_diversification_score()
    except Exception:
        diversification = {}

    return {
        "holdings": holdings,
        "summary": summary,
        "strategy": strategy,
        "allocation": allocation,
        "diversification": diversification,
    }


def summarize_portfolio(portfolio: dict[str, Any]) -> str:
    """
    Summarize portfolio to concise text for LLM.
    Target: ~250-350 tokens max.
    """
    summary = portfolio.get("summary") or {}
    strategy = portfolio.get("strategy") or {}
    diversification = portfolio.get("diversification") or {}
    holdings = portfolio.get("holdings") or []

    if not holdings and not summary:
        return "Portfolio is empty. No holdings found."

    lines: list[str] = [
        f"Total Value: {summary.get('total_current_value', 'N/A')}",
        f"Total Invested: {summary.get('total_invested', 'N/A')}",
        f"Total P&L: {summary.get('total_pnl', 'N/A')} ({summary.get('total_pnl_percent', 'N/A')}%)",
        f"Cash: {summary.get('cash_balance', 'N/A')}",
        f"Strategy: {strategy.get('name', 'N/A')} — {strategy.get('description', '')}",
        f"Diversification: {diversification.get('grade', 'N/A')} (Score: {diversification.get('score', 'N/A')})",
        f"Holdings ({len(holdings)}):",
    ]

    for h in holdings[:8]:
        symbol = h.get("symbol", "?")
        pnl_pct = h.get("pnl_percent", 0)
        value = h.get("current_value", 0)
        lines.append(f"  - {symbol}: Value={value}, P&L={pnl_pct}%")

    return "\n".join(lines)


def build_portfolio_snapshots(portfolio: dict[str, Any]) -> list[dict[str, Any]]:
    """Build DataSnapshot dicts for the context panel."""
    summary = portfolio.get("summary") or {}
    allocation = portfolio.get("allocation") or []
    diversification = portfolio.get("diversification") or {}
    strategy = portfolio.get("strategy") or {}

    snapshots: list[dict[str, Any]] = []

    if summary:
        snapshots.append(
        {
            "type": "portfolio_summary",
            "label": "Your Portfolio",
            "data": {
                "total_value": summary.get("total_current_value"),
                "total_pnl": summary.get("total_pnl"),
                "total_pnl_percent": summary.get("total_pnl_percent"),
                "cash": summary.get("cash_balance"),
                "holdings_count": summary.get("holdings_count"),
            },
        }
    )

    if allocation:
        snapshots.append(
            {
                "type": "metric",
                "label": "Allocation Mix",
                "data": {
                    "allocations": allocation,
                },
            }
        )

    if diversification or strategy:
        snapshots.append(
            {
                "type": "metric",
                "label": "Risk Profile",
                "data": {
                    "score": diversification.get("score"),
                    "grade": diversification.get("grade"),
                    "sectorCount": diversification.get("sectorCount"),
                    "assetClassCount": diversification.get("assetClassCount"),
                    "strategyName": strategy.get("name"),
                },
            }
        )

    return snapshots
