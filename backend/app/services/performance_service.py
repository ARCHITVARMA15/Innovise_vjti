"""
Portfolio performance calculation service.
Generates time-series performance data from transaction history.
"""

import json
from pathlib import Path
from datetime import datetime, timedelta
from typing import List, Dict, Any

DATA_FILE = Path(__file__).parent.parent.parent / "data" / "portfolio.json"


def _load_portfolio() -> dict:
    """Load portfolio from JSON file."""
    if not DATA_FILE.exists():
        return {"holdings": [], "cash_balance": 0, "transactions": []}
    with open(DATA_FILE, "r") as f:
        return json.load(f)


def calculate_portfolio_performance(period: str = "1M") -> Dict[str, Any]:
    """
    Calculate portfolio performance over time from transaction history.
    
    Args:
        period: Time period - "1M", "3M", "1Y", or "ALL"
    
    Returns:
        Dictionary with data_points array and metadata
    """
    portfolio = _load_portfolio()
    transactions = portfolio.get("transactions", [])
    
    if not transactions:
        return {
            "period": period,
            "data_points": [],
            "peak_value": 0,
            "current_value": 0,
            "total_return": 0,
            "total_return_percent": 0
        }
    
    # Sort transactions by date
    sorted_txns = sorted(
        transactions, 
        key=lambda x: datetime.fromisoformat(x.get("timestamp", x.get("date", "2024-01-01")))
    )
    
    # Determine date range based on period
    now = datetime.now()
    if period == "1M":
        start_date = now - timedelta(days=30)
    elif period == "3M":
        start_date = now - timedelta(days=90)
    elif period == "1Y":
        start_date = now - timedelta(days=365)
    else:  # ALL
        start_date = datetime.fromisoformat(sorted_txns[0].get("timestamp", sorted_txns[0].get("date", "2024-01-01")))
    
    # Calculate portfolio value at each transaction point
    data_points = []
    running_value = portfolio.get("cash_balance", 0)
    holdings_qty = {}  # Track quantity of each holding
    
    for txn in sorted_txns:
        txn_date = datetime.fromisoformat(txn.get("timestamp", txn.get("date", "2024-01-01")))
        
        # Skip transactions before start_date
        if txn_date < start_date:
            # Still need to track holdings for accurate value calculation
            if txn["type"] == "buy":
                symbol = txn["symbol"]
                holdings_qty[symbol] = holdings_qty.get(symbol, 0) + txn.get("quantity", 0)
                running_value -= txn.get("total_amount", 0)
            elif txn["type"] == "sell":
                symbol = txn["symbol"]
                holdings_qty[symbol] = holdings_qty.get(symbol, 0) - txn.get("quantity", 0)
                running_value += txn.get("total_amount", 0)
            elif txn["type"] == "dividend":
                running_value += txn.get("amount", 0)
            continue
        
        # Process transaction
        if txn["type"] == "buy":
            symbol = txn["symbol"]
            holdings_qty[symbol] = holdings_qty.get(symbol, 0) + txn.get("quantity", 0)
            running_value -= txn.get("total_amount", 0)
        elif txn["type"] == "sell":
            symbol = txn["symbol"]
            holdings_qty[symbol] = holdings_qty.get(symbol, 0) - txn.get("quantity", 0)
            running_value += txn.get("total_amount", 0)
        elif txn["type"] == "dividend":
            running_value += txn.get("amount", 0)
        
        # Calculate total portfolio value (cash + holdings at current prices)
        # For simplicity, use average buy price as current price
        holdings_value = 0
        for symbol, qty in holdings_qty.items():
            if qty > 0:
                # Find the holding's average price
                holding = next((h for h in portfolio["holdings"] if h["symbol"] == symbol), None)
                if holding:
                    holdings_value += qty * holding["avg_buy_price"]
        
        total_value = running_value + holdings_value
        
        data_points.append({
            "date": txn_date.strftime("%Y-%m-%d"),
            "value": round(total_value, 2)
        })
    
    # Add current value as final data point if needed
    if data_points and data_points[-1]["date"] != now.strftime("%Y-%m-%d"):
        # Calculate current total value
        current_holdings_value = sum(
            h["quantity"] * h["avg_buy_price"] 
            for h in portfolio.get("holdings", [])
        )
        current_total = portfolio.get("cash_balance", 0) + current_holdings_value
        
        data_points.append({
            "date": now.strftime("%Y-%m-%d"),
            "value": round(current_total, 2)
        })
    
    # Calculate metadata
    if data_points:
        peak_value = max(dp["value"] for dp in data_points)
        current_value = data_points[-1]["value"]
        initial_value = data_points[0]["value"]
        total_return = current_value - initial_value
        total_return_percent = (total_return / initial_value * 100) if initial_value > 0 else 0
    else:
        peak_value = 0
        current_value = 0
        total_return = 0
        total_return_percent = 0
    
    return {
        "period": period,
        "data_points": data_points,
        "peak_value": round(peak_value, 2),
        "current_value": round(current_value, 2),
        "total_return": round(total_return, 2),
        "total_return_percent": round(total_return_percent, 2)
    }
