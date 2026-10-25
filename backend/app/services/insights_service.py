from typing import Any
from datetime import datetime, timedelta
import random


def get_ai_insights() -> list[dict[str, Any]]:
    """Get mock AI-driven insights."""
    insights = [
        {
            "id": "insight_1",
            "type": "research_report",
            "title": "New Research Report: Tech Sector Resilience",
            "summary": "Our proprietary analysis indicates enterprise SaaS remains undervalued relative to historical cash flow multiples.",
            "action_label": "READ FULL REPORT",
            "timestamp": (datetime.now() - timedelta(hours=2)).isoformat(),
        },
        {
            "id": "insight_2",
            "type": "buy_signal",
            "title": "RELIANCE Momentum Alert",
            "summary": "Technical indicators suggest a 8% upside potential based on recent volume patterns and support levels.",
            "symbol": "RELIANCE.NS",
            "analysts_agree": 7,
            "timestamp": (datetime.now() - timedelta(hours=5)).isoformat(),
        },
        {
            "id": "insight_3",
            "type": "risk_alert",
            "title": "RBI Policy Impact",
            "summary": "Upcoming RBI monetary policy may affect banking stocks. Consider reviewing HDFCBANK position.",
            "action_label": "REVIEW ALLOCATION",
            "timestamp": (datetime.now() - timedelta(hours=8)).isoformat(),
        },
        {
            "id": "insight_4",
            "type": "buy_signal",
            "title": "TCS Earnings Beat Expected",
            "summary": "Q4 results likely to exceed estimates. IT sector showing strong order book momentum.",
            "symbol": "TCS.NS",
            "analysts_agree": 5,
            "timestamp": (datetime.now() - timedelta(days=1)).isoformat(),
        },
        {
            "id": "insight_5",
            "type": "research_report",
            "title": "FMCG Sector Analysis",
            "summary": "Rural demand recovery signals positive outlook for ITC and other FMCG players.",
            "action_label": "READ FULL REPORT",
            "timestamp": (datetime.now() - timedelta(days=1, hours=3)).isoformat(),
        },
    ]
    
    return insights[:3]  # Return top 3 insights


def get_risk_score(holdings: list[dict]) -> dict[str, Any]:
    """Calculate mock risk score based on portfolio."""
    if not holdings:
        return {"score": 0, "label": "No Holdings", "description": "Add holdings to calculate risk"}
    
    # Mock risk calculation based on diversification
    num_holdings = len(holdings)
    
    if num_holdings >= 10:
        score = random.randint(2, 4)
        label = "Conservative"
    elif num_holdings >= 5:
        score = random.randint(4, 6)
        label = "Balanced"
    elif num_holdings >= 3:
        score = random.randint(5, 7)
        label = "Moderate"
    else:
        score = random.randint(7, 9)
        label = "Aggressive"
    
    return {
        "score": score,
        "max_score": 10,
        "label": label,
        "description": f"Based on {num_holdings} holdings diversification",
    }


def get_rebalancing_suggestions(holdings: list[dict], allocation: dict) -> list[dict[str, Any]]:
    """Get mock rebalancing suggestions."""
    suggestions = []
    
    equity_pct = allocation.get("equities", 0)
    cash_pct = allocation.get("cash", 0)
    
    if equity_pct > 80:
        suggestions.append({
            "type": "reduce",
            "message": "Consider reducing equity exposure. Current allocation is aggressive.",
            "action": "Move 10-15% to fixed income or cash",
        })
    
    if cash_pct > 20:
        suggestions.append({
            "type": "invest",
            "message": "High cash allocation. Consider deploying capital.",
            "action": "Review top-rated stocks for investment",
        })
    
    if len(holdings) < 5:
        suggestions.append({
            "type": "diversify",
            "message": "Portfolio concentration risk is high.",
            "action": "Add 3-5 more stocks across different sectors",
        })
    
    if not suggestions:
        suggestions.append({
            "type": "maintain",
            "message": "Portfolio is well balanced.",
            "action": "Continue monitoring market conditions",
        })
    
    return suggestions
