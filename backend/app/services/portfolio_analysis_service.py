"""
Portfolio Analysis Service - Computes diversification, allocation, goals, strategy.
All data is computed and stored in portfolio.json.
"""

import json
from pathlib import Path
from typing import Any
from datetime import datetime, timedelta
import math

from app.services import yfinance_service as yf_svc
from app.services import portfolio_service as portfolio_svc

DATA_FILE = Path(__file__).parent.parent.parent / "data" / "portfolio.json"

# Asset class mappings based on sector
SECTOR_TO_ASSET_CLASS = {
    # Domestic Equity
    "Technology": "domestic-equity",
    "Consumer Cyclical": "domestic-equity",
    "Consumer Defensive": "domestic-equity",
    "Communication Services": "domestic-equity",
    "Healthcare": "domestic-equity",
    "Industrials": "domestic-equity",
    "Basic Materials": "domestic-equity",
    "Energy": "domestic-equity",
    "Utilities": "domestic-equity",
    "Real Estate": "domestic-equity",
    # International
    "International": "international-equity",
    # Fixed Income
    "Fixed Income": "fixed-income",
    "Bonds": "fixed-income",
    # Crypto treated as alternatives
    "Crypto": "cash-alternatives",
}

ASSET_CLASS_CONFIG = {
    "domestic-equity": {
        "id": "domestic-equity",
        "label": "Domestic Equity",
        "icon": "trending_up",
        "defaultTarget": 45,
    },
    "international-equity": {
        "id": "international-equity",
        "label": "International Equity",
        "icon": "language",
        "defaultTarget": 20,
    },
    "fixed-income": {
        "id": "fixed-income",
        "label": "Fixed Income",
        "icon": "account_balance",
        "defaultTarget": 25,
    },
    "cash-alternatives": {
        "id": "cash-alternatives",
        "label": "Cash & Alternatives",
        "icon": "savings",
        "defaultTarget": 10,
    },
}

DEFAULT_GOALS = [
    {
        "id": "retirement",
        "icon": "landscape",
        "iconBg": "#e5eeff",
        "iconColor": "#131b2e",
        "label": "RETIREMENT 2045",
        "targetValue": 3500000,
        "progressBarColor": "#000000",
    },
    {
        "id": "education",
        "icon": "school",
        "iconBg": "#eff4ff",
        "iconColor": "#006591",
        "label": "EDUCATION FUND",
        "targetValue": 250000,
        "progressBarColor": "#006591",
    },
    {
        "id": "vacation-home",
        "icon": "home",
        "iconBg": "#f0fdf4",
        "iconColor": "#009668",
        "label": "VACATION HOME",
        "targetValue": 150000,
        "progressBarColor": "#39b8fd",
    },
]

DEFAULT_STRATEGY = {
    "name": "Moderate Growth",
    "description": "Designed for 7–10 year horizons with focus on capital preservation and steady yield.",
    "ctaLabel": "Change Strategy",
}

DEFAULT_STRATEGY_DRAFT = {
    "name": "",
    "description": "",
    "ctaLabel": "Apply Strategy",
    "source": "manual",
    "status": "draft",
    "notes": "",
    "objective": "",
    "time_horizon": "",
    "risk_profile": "",
    "rebalance_rule": "",
    "max_drawdown_pct": None,
    "max_single_position_pct": None,
    "max_sector_exposure_pct": None,
    "stop_loss_rule": "",
    "entry_rule": "",
    "validation_metrics": [],
    "allocation_targets": {},
    "suggested_actions": [],
    "created_at": None,
}

DEFAULT_STRATEGY_ADVISOR = {
    "label": "Aggressive Growth",
    "rationale": "Based on your portfolio composition and growth trajectory, your risk tolerance supports an equity-heavy allocation.",
    "expectedReturnPA": 12.4,
    "riskLevel": "High",
    "horizonYears": "15+ Years",
    "equitySplit": 85,
    "bondSplit": 15,
}


def _load_data() -> dict:
    """Load data from JSON file."""
    if not DATA_FILE.exists():
        return {"holdings": [], "cash_balance": 0, "transactions": []}
    with open(DATA_FILE, "r") as f:
        return json.load(f)


def _save_data(data: dict) -> None:
    """Save data to JSON file."""
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(DATA_FILE, "w") as f:
        json.dump(data, f, indent=2)


def _get_sector_for_symbol(symbol: str) -> str:
    """Get sector for a symbol from yfinance."""
    try:
        fundamentals = yf_svc.get_stock_fundamentals(symbol)
        sector = fundamentals.get("sector")
        if sector:
            return sector
    except Exception:
        pass
    
    # Fallback for crypto
    if "-USD" in symbol:
        return "Crypto"
    
    return "Technology"  # Default


def _get_asset_class(sector: str) -> str:
    """Map sector to asset class."""
    return SECTOR_TO_ASSET_CLASS.get(sector, "domestic-equity")


def compute_diversification_score() -> dict[str, Any]:
    """
    Compute diversification score from holdings.
    Score based on: sector count, asset class count, concentration.
    """
    data = _load_data()
    holdings = portfolio_svc.get_holdings()
    
    if not holdings:
        return {
            "score": 0,
            "grade": "POOR",
            "headline": "No holdings in your portfolio.",
            "body": "Add holdings to see your diversification analysis.",
            "tags": [],
            "sectorCount": 0,
            "assetClassCount": 0,
        }
    
    # Get sectors for each holding
    sectors = set()
    asset_classes = set()
    total_value = sum(h["current_value"] for h in holdings)
    max_concentration = 0
    
    for h in holdings:
        sector = _get_sector_for_symbol(h["symbol"])
        sectors.add(sector)
        asset_class = _get_asset_class(sector)
        asset_classes.add(asset_class)
        
        # Track concentration
        if total_value > 0:
            concentration = h["current_value"] / total_value
            max_concentration = max(max_concentration, concentration)
    
    sector_count = len(sectors)
    asset_class_count = len(asset_classes)
    
    # Calculate score (0-100)
    # Factors: sector diversity (40%), asset class diversity (30%), concentration (30%)
    sector_score = min(sector_count / 8, 1) * 40  # Max 8 sectors for full score
    asset_class_score = min(asset_class_count / 4, 1) * 30  # Max 4 asset classes
    concentration_score = (1 - max_concentration) * 30  # Lower concentration = better
    
    score = int(sector_score + asset_class_score + concentration_score)
    
    # Determine grade
    if score >= 80:
        grade = "EXCELLENT"
        headline = "Your portfolio is well-defended against market volatility."
        tags = ["LOW RISK", "BALANCED GROWTH"]
    elif score >= 60:
        grade = "GOOD"
        headline = "Your portfolio has solid diversification with room for improvement."
        tags = ["MODERATE RISK", "GROWTH ORIENTED"]
    elif score >= 40:
        grade = "FAIR"
        headline = "Your portfolio could benefit from more diversification."
        tags = ["ELEVATED RISK", "CONCENTRATED"]
    else:
        grade = "POOR"
        headline = "Your portfolio is highly concentrated and needs diversification."
        tags = ["HIGH RISK", "CONCENTRATED"]
    
    body = f"Based on your current holdings across {sector_count} sectors and {asset_class_count} asset classes. "
    if max_concentration > 0.3:
        body += f"Your largest position represents {max_concentration*100:.0f}% of your portfolio - consider rebalancing."
    else:
        body += "Your position sizes are well-balanced."
    
    result = {
        "score": score,
        "grade": grade,
        "headline": headline,
        "body": body,
        "tags": tags,
        "sectorCount": sector_count,
        "assetClassCount": asset_class_count,
    }
    
    # Cache in portfolio data
    data["diversification"] = result
    data["diversification_computed_at"] = datetime.now().isoformat()
    _save_data(data)
    
    return result


def compute_allocation() -> list[dict[str, Any]]:
    """
    Compute current allocation vs target allocation.
    """
    data = _load_data()
    holdings = portfolio_svc.get_holdings()
    summary = portfolio_svc.get_portfolio_summary()
    
    total_value = summary.get("total_assets", 0)
    cash = summary.get("cash_balance", 0)
    
    if total_value == 0:
        # Return default empty allocation
        return [
            {**ASSET_CLASS_CONFIG[ac], "currentPercent": 0, "targetPercent": cfg["defaultTarget"], "status": "UNDERWEIGHT"}
            for ac, cfg in ASSET_CLASS_CONFIG.items()
        ]
    
    # Get targets from stored data or use defaults
    stored_targets = data.get("allocation_targets", {})
    
    # Calculate current allocation by asset class
    asset_class_values = {ac: 0 for ac in ASSET_CLASS_CONFIG}
    asset_class_values["cash-alternatives"] = cash  # Cash goes to alternatives
    
    for h in holdings:
        sector = _get_sector_for_symbol(h["symbol"])
        asset_class = _get_asset_class(sector)
        asset_class_values[asset_class] += h["current_value"]
    
    # Build allocation result
    result = []
    for ac_id, config in ASSET_CLASS_CONFIG.items():
        current_value = asset_class_values.get(ac_id, 0)
        current_pct = (current_value / total_value * 100) if total_value > 0 else 0
        target_pct = stored_targets.get(ac_id, config["defaultTarget"])
        
        # Determine status
        diff = current_pct - target_pct
        if diff > 5:
            status = "OVERWEIGHT"
        elif diff < -5:
            status = "UNDERWEIGHT"
        else:
            status = "ALIGNED"
        
        result.append({
            "id": config["id"],
            "label": config["label"],
            "icon": config["icon"],
            "currentPercent": round(current_pct, 0),
            "targetPercent": round(target_pct, 0),
            "status": status,
        })
    
    # Cache
    data["allocation"] = result
    data["allocation_computed_at"] = datetime.now().isoformat()
    _save_data(data)
    
    return result


def compute_rebalancing_recommendations() -> list[dict[str, Any]]:
    """
    Compute rebalancing recommendations based on allocation deltas.
    """
    data = _load_data()
    allocation = compute_allocation()
    summary = portfolio_svc.get_portfolio_summary()
    holdings = portfolio_svc.get_holdings()
    
    total_value = summary.get("total_assets", 0)
    recommendations = []
    
    # Find overweight and underweight categories
    overweight = [a for a in allocation if a["status"] == "OVERWEIGHT"]
    underweight = [a for a in allocation if a["status"] == "UNDERWEIGHT"]
    
    # Generate sell recommendations for overweight
    for ow in overweight:
        diff_pct = ow["currentPercent"] - ow["targetPercent"]
        diff_value = total_value * diff_pct / 100
        
        recommendations.append({
            "id": f"reb-sell-{ow['id']}",
            "action": "SELL",
            "title": f"Reduce {ow['label']}",
            "subtitle": f"Current overweight by {diff_pct:.1f}% (${diff_value:,.0f})",
            "amount": round(diff_value, 0),
            "ctaLabel": "VIEW POSITIONS",
        })
    
    # Generate buy recommendations for underweight
    for uw in underweight:
        diff_pct = uw["targetPercent"] - uw["currentPercent"]
        diff_value = total_value * diff_pct / 100
        
        recommendations.append({
            "id": f"reb-buy-{uw['id']}",
            "action": "BUY",
            "title": f"Increase {uw['label']}",
            "subtitle": f"Underweight by {diff_pct:.1f}% (${diff_value:,.0f})",
            "amount": round(diff_value, 0),
            "ctaLabel": "EXPLORE OPTIONS",
        })
    
    # Add sector-specific recommendations based on holdings
    if holdings:
        # Find most concentrated sector
        sector_values = {}
        for h in holdings:
            sector = _get_sector_for_symbol(h["symbol"])
            sector_values[sector] = sector_values.get(sector, 0) + h["current_value"]
        
        if sector_values:
            max_sector = max(sector_values, key=sector_values.get)
            max_sector_pct = sector_values[max_sector] / total_value * 100 if total_value > 0 else 0
            
            if max_sector_pct > 30:
                recommendations.append({
                    "id": "reb-sector-diversify",
                    "action": "REALLOC",
                    "title": f"Diversify {max_sector}",
                    "subtitle": f"Sector concentration at {max_sector_pct:.0f}% - consider spreading risk",
                    "amount": round(sector_values[max_sector] * 0.2, 0),
                    "ctaLabel": "DETAILS",
                })
    
    # Limit to top 3 recommendations
    recommendations = recommendations[:3]
    
    # If no recommendations, add a maintenance one
    if not recommendations:
        recommendations.append({
            "id": "reb-maintain",
            "action": "REALLOC",
            "title": "Portfolio Well Balanced",
            "subtitle": "No immediate rebalancing needed. Continue monitoring.",
            "amount": 0,
            "ctaLabel": "REVIEW",
        })
    
    # Cache
    data["rebalancing"] = recommendations
    data["rebalancing_computed_at"] = datetime.now().isoformat()
    _save_data(data)
    
    return recommendations


def get_current_strategy() -> dict[str, Any]:
    """Get current investment strategy (stored or default)."""
    data = _load_data()
    return data.get("current_strategy", DEFAULT_STRATEGY)


def update_current_strategy(strategy: dict[str, Any]) -> dict[str, Any]:
    """Update current investment strategy."""
    data = _load_data()
    strategy_copy = {
        "name": strategy.get("name", DEFAULT_STRATEGY["name"]),
        "description": strategy.get("description", DEFAULT_STRATEGY["description"]),
        "ctaLabel": strategy.get("ctaLabel", "Change Strategy"),
        "source": strategy.get("source", "manual"),
        "accepted_at": datetime.now().isoformat(),
    }
    data["current_strategy"] = strategy_copy
    _save_data(data)
    return strategy_copy


def get_strategy_editor_state() -> dict[str, Any]:
    """Get active strategy + pending draft for strategy editor UI."""
    data = _load_data()
    current = data.get("current_strategy", DEFAULT_STRATEGY)
    draft = data.get("strategy_draft")
    return {
        "currentStrategy": current,
        "draftStrategy": draft,
        "hasDraft": bool(draft),
        "updated_at": datetime.now().isoformat(),
    }


def save_strategy_draft(strategy_draft: dict[str, Any]) -> dict[str, Any]:
    """Save a pending strategy draft from manual editor or Veritas agent."""
    data = _load_data()
    base = dict(DEFAULT_STRATEGY_DRAFT)
    base.update(
        {
            "name": strategy_draft.get("name", "").strip(),
            "description": strategy_draft.get("description", "").strip(),
            "ctaLabel": strategy_draft.get("ctaLabel", "Apply Strategy"),
            "source": strategy_draft.get("source", "manual"),
            "status": "draft",
            "notes": strategy_draft.get("notes", ""),
            "objective": strategy_draft.get("objective", ""),
            "time_horizon": strategy_draft.get("time_horizon", ""),
            "risk_profile": strategy_draft.get("risk_profile", ""),
            "rebalance_rule": strategy_draft.get("rebalance_rule", ""),
            "max_drawdown_pct": strategy_draft.get("max_drawdown_pct"),
            "max_single_position_pct": strategy_draft.get("max_single_position_pct"),
            "max_sector_exposure_pct": strategy_draft.get("max_sector_exposure_pct"),
            "stop_loss_rule": strategy_draft.get("stop_loss_rule", ""),
            "entry_rule": strategy_draft.get("entry_rule", ""),
            "validation_metrics": strategy_draft.get("validation_metrics", []),
            "allocation_targets": strategy_draft.get("allocation_targets", {}),
            "suggested_actions": strategy_draft.get("suggested_actions", []),
            "created_at": datetime.now().isoformat(),
        }
    )

    data["strategy_draft"] = base
    _save_data(data)
    return base


def accept_strategy_draft() -> dict[str, Any]:
    """Promote pending strategy draft to current strategy and apply allocation targets when present."""
    data = _load_data()
    draft = data.get("strategy_draft")
    if not draft:
        return {"error": "No strategy draft available to accept."}

    active = {
        "name": draft.get("name") or DEFAULT_STRATEGY["name"],
        "description": draft.get("description") or DEFAULT_STRATEGY["description"],
        "ctaLabel": "Change Strategy",
        "source": draft.get("source", "manual"),
        "accepted_at": datetime.now().isoformat(),
    }
    data["current_strategy"] = active

    allocation_targets = draft.get("allocation_targets") or {}
    if isinstance(allocation_targets, dict) and allocation_targets:
        data["allocation_targets"] = allocation_targets

    data["strategy_draft"] = None
    _save_data(data)

    return {
        "currentStrategy": active,
        "allocation": compute_allocation(),
        "message": "Strategy accepted and applied.",
    }


def get_strategy_advisor() -> dict[str, Any]:
    """
    Get strategy advisor recommendation.
    Computed based on portfolio characteristics.
    """
    data = _load_data()
    holdings = portfolio_svc.get_holdings()
    summary = portfolio_svc.get_portfolio_summary()
    
    if not holdings:
        return DEFAULT_STRATEGY_ADVISOR
    
    total_value = summary.get("total_assets", 0)
    equity_pct = summary.get("allocation", {}).get("equities", 0)
    
    # Calculate portfolio beta (risk)
    total_beta = 0
    total_weight = 0
    
    for h in holdings:
        try:
            fundamentals = yf_svc.get_stock_fundamentals(h["symbol"])
            beta = fundamentals.get("beta") or 1.0
            weight = h["current_value"] / total_value if total_value > 0 else 0
            total_beta += beta * weight
            total_weight += weight
        except Exception:
            continue
    
    portfolio_beta = total_beta / total_weight if total_weight > 0 else 1.0
    
    # Determine recommended strategy based on current allocation
    if portfolio_beta > 1.3:
        advisor = {
            "label": "Aggressive Growth",
            "rationale": f"Your portfolio beta of {portfolio_beta:.2f} indicates high risk tolerance. Current equity allocation supports growth-focused strategy.",
            "expectedReturnPA": round(8 + portfolio_beta * 4, 1),
            "riskLevel": "High",
            "horizonYears": "15+ Years",
            "equitySplit": 85,
            "bondSplit": 15,
        }
    elif portfolio_beta > 0.9:
        advisor = {
            "label": "Balanced Growth",
            "rationale": f"Your portfolio beta of {portfolio_beta:.2f} suggests moderate risk. Consider a balanced approach for steady returns.",
            "expectedReturnPA": round(6 + portfolio_beta * 3, 1),
            "riskLevel": "Medium",
            "horizonYears": "10-15 Years",
            "equitySplit": 70,
            "bondSplit": 30,
        }
    else:
        advisor = {
            "label": "Conservative Income",
            "rationale": f"Your portfolio beta of {portfolio_beta:.2f} indicates conservative positioning. Focus on income and capital preservation.",
            "expectedReturnPA": round(4 + portfolio_beta * 2, 1),
            "riskLevel": "Low",
            "horizonYears": "5-10 Years",
            "equitySplit": 50,
            "bondSplit": 50,
        }
    
    # Cache
    data["strategy_advisor"] = advisor
    data["strategy_advisor_computed_at"] = datetime.now().isoformat()
    _save_data(data)
    
    return advisor


def get_goals() -> list[dict[str, Any]]:
    """Get investment goals with progress computed from portfolio value."""
    data = _load_data()
    summary = portfolio_svc.get_portfolio_summary()
    total_value = summary.get("total_assets", 0)
    
    # Get stored goals or use defaults
    stored_goals = data.get("goals", DEFAULT_GOALS)
    
    # Compute progress for each goal
    result = []
    remaining_value = total_value
    
    for i, goal in enumerate(stored_goals):
        target = goal.get("targetValue", 100000)
        
        # Allocate portfolio value to goals proportionally
        # First goal gets priority, then remaining is split
        if i == 0:
            allocated = min(remaining_value * 0.6, target)  # 60% to primary goal
        elif i == 1:
            allocated = min(remaining_value * 0.5, target)  # 50% of remaining
        else:
            allocated = min(remaining_value, target)
        
        remaining_value = max(0, remaining_value - allocated)
        
        progress_pct = (allocated / target * 100) if target > 0 else 0
        
        # Determine status
        if progress_pct >= 100:
            status = "Achieved"
            status_color = "#009668"
        elif progress_pct >= 50:
            status = "On Track"
            status_color = "#009668"
        elif progress_pct >= 25:
            status = "Behind"
            status_color = "#94a3b8"
            cta_label = "Increase contributions"
        else:
            status = "Early stage"
            status_color = "#94a3b8"
        
        goal_result = {
            "id": goal.get("id", f"goal-{i}"),
            "icon": goal.get("icon", "flag"),
            "iconBg": goal.get("iconBg", "#e5eeff"),
            "iconColor": goal.get("iconColor", "#131b2e"),
            "label": goal.get("label", f"Goal {i+1}"),
            "currentValue": round(allocated, 0),
            "targetValue": target,
            "progressPercent": round(progress_pct, 1),
            "status": status,
            "statusColor": status_color,
            "progressBarColor": goal.get("progressBarColor", "#000000"),
        }
        
        if status == "Behind":
            goal_result["ctaLabel"] = "Increase contributions"
        
        result.append(goal_result)
    
    # Cache
    data["goals_computed"] = result
    data["goals_computed_at"] = datetime.now().isoformat()
    _save_data(data)
    
    return result


def update_goals(goals: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Update investment goals."""
    data = _load_data()
    data["goals"] = goals
    _save_data(data)
    return get_goals()  # Return computed goals


def update_allocation_targets(targets: dict[str, float]) -> list[dict[str, Any]]:
    """Update target allocation percentages."""
    data = _load_data()
    data["allocation_targets"] = targets
    _save_data(data)
    return compute_allocation()


def get_full_portfolio_analysis() -> dict[str, Any]:
    """
    Get all portfolio analysis data in one call.
    Used by the frontend Portfolio page.
    """
    return {
        "diversification": compute_diversification_score(),
        "currentStrategy": get_current_strategy(),
        "allocation": compute_allocation(),
        "rebalancing": compute_rebalancing_recommendations(),
        "strategyAdvisor": get_strategy_advisor(),
        "goals": get_goals(),
    }
