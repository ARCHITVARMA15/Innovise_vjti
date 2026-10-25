import json
from pathlib import Path
from typing import Any
from datetime import datetime

from app.services import yfinance_service as yf_svc

DATA_FILE = Path(__file__).parent.parent.parent / "data" / "portfolio.json"


def _load_portfolio() -> dict:
    """Load portfolio from JSON file."""
    if not DATA_FILE.exists():
        return {"holdings": [], "cash_balance": 0, "transactions": [], "watchlist": []}
    with open(DATA_FILE, "r") as f:
        return json.load(f)


def _save_portfolio(data: dict) -> None:
    """Save portfolio to JSON file."""
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(DATA_FILE, "w") as f:
        json.dump(data, f, indent=2)


def get_holdings() -> list[dict[str, Any]]:
    """Get all holdings with current prices."""
    portfolio = _load_portfolio()
    holdings = portfolio.get("holdings", [])
    transactions = portfolio.get("transactions", [])
    
    enriched = []
    for h in holdings:
        symbol = h["symbol"]
        try:
            quote = yf_svc.get_stock_quote(symbol)
            current_price = quote.get("price") or h["avg_buy_price"]
            prev_close = quote.get("previous_close") or current_price
            daily_change = ((current_price - prev_close) / prev_close * 100) if prev_close else 0
        except Exception:
            current_price = h["avg_buy_price"]
            daily_change = 0
        
        # Calculate buy_date and sell_date from transactions
        sym_txns = [t for t in transactions if t.get("symbol") == symbol]
        buy_txns = sorted([t for t in sym_txns if t.get("type") == "buy"], key=lambda k: k.get("timestamp", ""))
        sell_txns = sorted([t for t in sym_txns if t.get("type") == "sell"], key=lambda k: k.get("timestamp", ""))
        
        buy_date = buy_txns[0].get("timestamp", buy_txns[0].get("date", "N/A")).split("T")[0] if buy_txns else "N/A"
        
        quantity = h["quantity"]
        avg_price = h["avg_buy_price"]
        current_value = quantity * current_price
        invested_value = quantity * avg_price
        pnl = current_value - invested_value
        pnl_percent = (pnl / invested_value * 100) if invested_value else 0
        
        enriched.append({
            "symbol": symbol,
            "quantity": quantity,
            "avg_buy_price": avg_price,
            "current_price": round(current_price, 2),
            "current_value": round(current_value, 2),
            "invested_value": round(invested_value, 2),
            "pnl": round(pnl, 2),
            "pnl_percent": round(pnl_percent, 2),
            "daily_change": round(daily_change, 2),
            "asset_type": h.get("asset_type", "equity"),
            "buy_date": buy_date,
            "sell_date": "Active",
            "status": "Holding"
        })
    
    return enriched


def get_portfolio_summary() -> dict[str, Any]:
    """Get portfolio summary with totals and allocation."""
    portfolio = _load_portfolio()
    holdings = get_holdings()
    cash = portfolio.get("cash_balance", 0)
    
    total_invested = sum(h["invested_value"] for h in holdings)
    total_current = sum(h["current_value"] for h in holdings)
    total_pnl = total_current - total_invested
    total_pnl_percent = (total_pnl / total_invested * 100) if total_invested else 0
    
    total_assets = total_current + cash
    
    # Calculate allocation
    equity_value = sum(h["current_value"] for h in holdings if h["asset_type"] == "equity")
    
    allocation = {
        "equities": round((equity_value / total_assets * 100) if total_assets else 0, 2),
        "cash": round((cash / total_assets * 100) if total_assets else 0, 2),
    }
    
    # Calculate dividends YTD
    transactions = portfolio.get("transactions", [])
    current_year = datetime.now().year
    dividends_ytd = sum(
        t.get("amount", 0) 
        for t in transactions 
        if t.get("type") == "dividend" and str(current_year) in t.get("timestamp", "")
    )
    
    return {
        "total_assets": round(total_assets, 2),
        "total_invested": round(total_invested, 2),
        "total_current_value": round(total_current, 2),
        "total_pnl": round(total_pnl, 2),
        "total_pnl_percent": round(total_pnl_percent, 2),
        "cash_balance": round(cash, 2),
        "dividends_ytd": round(dividends_ytd, 2),
        "allocation": allocation,
        "holdings_count": len(holdings),
    }


def get_top_performers(limit: int = 5) -> list[dict[str, Any]]:
    """Get top performing holdings by daily change."""
    holdings = get_holdings()
    sorted_holdings = sorted(holdings, key=lambda x: x["daily_change"], reverse=True)
    return sorted_holdings[:limit]


def get_activity(limit: int = 10) -> list[dict[str, Any]]:
    """Get recent transactions formatted for frontend."""
    portfolio = _load_portfolio()
    transactions = portfolio.get("transactions", [])
    sorted_txns = sorted(transactions, key=lambda x: x.get("timestamp", ""), reverse=True)
    
    # Format for frontend
    formatted = []
    for txn in sorted_txns[:limit]:
        txn_type = txn.get("type", "trade")
        symbol = txn.get("symbol", "")
        name = txn.get("name", symbol.replace(".NS", ""))
        timestamp = txn.get("timestamp", "")
        
        # Create formatted transaction
        formatted_txn = {
            "id": txn.get("id", f"txn-{len(formatted)}"),
            "type": txn_type,
            "symbol": symbol,
            "timestamp": timestamp,
        }
        
        # Build title and description based on type
        if txn_type == "buy":
            qty = txn.get("quantity", 0)
            price = txn.get("price", 0)
            formatted_txn["title"] = f"Bought {int(qty)} shares of {name}"
            formatted_txn["description"] = f"Executed at market price ₹{price:.2f}"
            formatted_txn["amount"] = txn.get("total_amount", qty * price)
        elif txn_type == "sell":
            qty = txn.get("quantity", 0)
            price = txn.get("price", 0)
            formatted_txn["title"] = f"Sold {int(qty)} shares of {name}"
            formatted_txn["description"] = f"Executed at limit price ₹{price:.2f}"
            formatted_txn["amount"] = -txn.get("total_amount", qty * price)
        elif txn_type == "dividend":
            amount = txn.get("amount", 0)
            formatted_txn["title"] = f"Dividend Received: {name}"
            formatted_txn["description"] = "Quarterly dividend payment"
            formatted_txn["amount"] = amount
        
        formatted.append(formatted_txn)
    
    return formatted


def add_holding(symbol: str, quantity: float, avg_buy_price: float, asset_type: str = "equity") -> dict[str, Any]:
    """Add a new holding or update existing."""
    portfolio = _load_portfolio()
    holdings = portfolio.get("holdings", [])
    
    # Check if holding exists
    for h in holdings:
        if h["symbol"] == symbol:
            # Update existing - calculate new average
            total_qty = h["quantity"] + quantity
            total_cost = (h["quantity"] * h["avg_buy_price"]) + (quantity * avg_buy_price)
            h["quantity"] = total_qty
            h["avg_buy_price"] = round(total_cost / total_qty, 2)
            _save_portfolio(portfolio)
            return {"message": f"Updated holding {symbol}", "holding": h}
    
    # Add new holding
    new_holding = {
        "symbol": symbol,
        "quantity": quantity,
        "avg_buy_price": avg_buy_price,
        "asset_type": asset_type,
    }
    holdings.append(new_holding)
    portfolio["holdings"] = holdings
    _save_portfolio(portfolio)
    
    return {"message": f"Added holding {symbol}", "holding": new_holding}


def remove_holding(symbol: str) -> dict[str, Any]:
    """Remove a holding."""
    portfolio = _load_portfolio()
    holdings = portfolio.get("holdings", [])
    
    original_len = len(holdings)
    holdings = [h for h in holdings if h["symbol"] != symbol]
    
    if len(holdings) == original_len:
        return {"error": f"Holding {symbol} not found"}
    
    portfolio["holdings"] = holdings
    _save_portfolio(portfolio)
    return {"message": f"Removed holding {symbol}"}


def update_holding(symbol: str, quantity: float | None = None, avg_buy_price: float | None = None) -> dict[str, Any]:
    """Update a holding's quantity or average price."""
    portfolio = _load_portfolio()
    holdings = portfolio.get("holdings", [])
    
    for h in holdings:
        if h["symbol"] == symbol:
            if quantity is not None:
                h["quantity"] = quantity
            if avg_buy_price is not None:
                h["avg_buy_price"] = avg_buy_price
            _save_portfolio(portfolio)
            return {"message": f"Updated holding {symbol}", "holding": h}
    
    return {"error": f"Holding {symbol} not found"}


def add_transaction(
    txn_type: str,
    symbol: str,
    quantity: float | None = None,
    price: float | None = None,
    amount: float | None = None,
) -> dict[str, Any]:
    """Add a transaction (buy/sell/dividend)."""
    portfolio = _load_portfolio()
    transactions = portfolio.get("transactions", [])
    
    txn = {
        "type": txn_type,
        "symbol": symbol,
        "timestamp": datetime.now().isoformat(),
    }
    
    if txn_type in ["buy", "sell"]:
        txn["quantity"] = quantity
        txn["price"] = price
    elif txn_type == "dividend":
        txn["amount"] = amount
    
    transactions.append(txn)
    portfolio["transactions"] = transactions
    _save_portfolio(portfolio)
    
    return {"message": "Transaction added", "transaction": txn}


def update_cash_balance(amount: float) -> dict[str, Any]:
    """Update cash balance."""
    portfolio = _load_portfolio()
    portfolio["cash_balance"] = amount
    _save_portfolio(portfolio)
    return {"message": "Cash balance updated", "cash_balance": amount}


def buy_stock(symbol: str, amount: float) -> dict[str, Any]:
    """Buy stock with specified dollar amount."""
    try:
        # Get current price
        quote = yf_svc.get_stock_quote(symbol)
        current_price = quote.get("price")
        
        if not current_price:
            return {"error": f"Could not fetch price for {symbol}"}
        
        # Calculate quantity
        quantity = amount / current_price
        
        # Update portfolio
        portfolio = _load_portfolio()
        holdings = portfolio.get("holdings", [])
        
        # Check if holding exists
        holding_found = False
        for h in holdings:
            if h["symbol"] == symbol:
                # Update existing holding
                total_qty = h["quantity"] + quantity
                total_cost = (h["quantity"] * h["avg_buy_price"]) + amount
                h["quantity"] = round(total_qty, 4)
                h["avg_buy_price"] = round(total_cost / total_qty, 2)
                holding_found = True
                break
        
        if not holding_found:
            # Add new holding
            holdings.append({
                "symbol": symbol,
                "quantity": round(quantity, 4),
                "avg_buy_price": round(current_price, 2),
                "asset_type": "equity",
            })
        
        # Update cash balance
        cash = portfolio.get("cash_balance", 0)
        portfolio["cash_balance"] = round(cash - amount, 2)
        
        # Add transaction
        transactions = portfolio.get("transactions", [])
        transactions.append({
            "id": f"txn-{len(transactions) + 1}",
            "type": "buy",
            "symbol": symbol,
            "name": symbol,
            "quantity": round(quantity, 4),
            "price": round(current_price, 2),
            "total_amount": round(amount, 2),
            "timestamp": datetime.now().isoformat(),
        })
        
        portfolio["holdings"] = holdings
        portfolio["transactions"] = transactions
        _save_portfolio(portfolio)
        
        return {
            "success": True,
            "message": f"Bought {quantity:.4f} shares of {symbol} for ${amount:,.2f}",
            "symbol": symbol,
            "quantity": round(quantity, 4),
            "price": round(current_price, 2),
            "total_amount": round(amount, 2),
        }
    except Exception as e:
        return {"error": str(e)}


def sell_stock(symbol: str, amount: float) -> dict[str, Any]:
    """Sell stock worth specified dollar amount."""
    try:
        # Get current price
        quote = yf_svc.get_stock_quote(symbol)
        current_price = quote.get("price")
        
        if not current_price:
            return {"error": f"Could not fetch price for {symbol}"}
        
        # Calculate quantity to sell
        quantity_to_sell = amount / current_price
        
        # Update portfolio
        portfolio = _load_portfolio()
        holdings = portfolio.get("holdings", [])
        
        # Try to reduce existing holding if present
        for i, h in enumerate(holdings):
            if h["symbol"] == symbol:
                h["quantity"] = round(max(h["quantity"] - quantity_to_sell, 0), 4)
                if h["quantity"] < 0.0001:
                    holdings.pop(i)
                break
        
        # Update cash balance (always add proceeds)
        cash = portfolio.get("cash_balance", 0)
        portfolio["cash_balance"] = round(cash + amount, 2)
        
        # Add transaction
        transactions = portfolio.get("transactions", [])
        transactions.append({
            "id": f"txn-{len(transactions) + 1}",
            "type": "sell",
            "symbol": symbol,
            "name": symbol,
            "quantity": round(quantity_to_sell, 4),
            "price": round(current_price, 2),
            "total_amount": round(amount, 2),
            "timestamp": datetime.now().isoformat(),
        })
        
        portfolio["holdings"] = holdings
        portfolio["transactions"] = transactions
        _save_portfolio(portfolio)
        
        return {
            "success": True,
            "message": f"Sold {quantity_to_sell:.2f} shares of {symbol} at ${current_price:.2f} for ${amount:,.2f}",
            "symbol": symbol,
            "quantity": round(quantity_to_sell, 4),
            "price": round(current_price, 2),
            "total_amount": round(amount, 2),
        }
    except Exception as e:
        return {"error": str(e)}


def get_watchlist() -> list[dict[str, Any]]:
    """Get watchlist with current live prices."""
    portfolio = _load_portfolio()
    watchlist = portfolio.get("watchlist", [])
    
    enriched = []
    for item in watchlist:
        symbol = item["symbol"]
        try:
            quote = yf_svc.get_stock_quote(symbol)
            current_price = quote.get("price") or 0.0
            prev_close = quote.get("previous_close") or current_price
            daily_change = ((current_price - prev_close) / prev_close * 100) if prev_close else 0
        except Exception:
            current_price = 0.0
            daily_change = 0
            
        enriched.append({
            "symbol": symbol,
            "quantity": item.get("quantity", 0),
            "avg_buy_price": 0,
            "current_price": round(current_price, 2),
            "current_value": round(item.get("quantity", 0) * current_price, 2),
            "invested_value": 0,
            "pnl": 0,
            "pnl_percent": 0,
            "daily_change": round(daily_change, 2),
            "asset_type": "equity",
            "buy_date": item.get("buy_date") or item.get("added_date", datetime.now().strftime('%Y-%m-%d')),
            "sell_date": item.get("sell_date") or "Watching",
            "status": "Watchlist"
        })
    return enriched


def add_to_watchlist(
    symbol: str, 
    quantity: float = 0.0, 
    buy_date: str | None = None, 
    sell_date: str | None = None
) -> dict[str, Any]:
    """Add a symbol to the watchlist."""
    portfolio = _load_portfolio()
    watchlist = portfolio.get("watchlist", [])
    
    # Check if already in watchlist
    for wl in watchlist:
        if wl["symbol"] == symbol:
            # Update existing instead of rejecting
            wl["quantity"] = quantity
            if buy_date: wl["buy_date"] = buy_date
            if sell_date: wl["sell_date"] = sell_date
            portfolio["watchlist"] = watchlist
            _save_portfolio(portfolio)
            return {"message": f"Updated {symbol} in watchlist", "symbol": symbol}
        
    new_entry = {
        "symbol": symbol,
        "quantity": quantity,
        "added_date": datetime.now().strftime('%Y-%m-%d')
    }
    if buy_date: new_entry["buy_date"] = buy_date
    if sell_date: new_entry["sell_date"] = sell_date
    
    watchlist.append(new_entry)
    
    portfolio["watchlist"] = watchlist
    _save_portfolio(portfolio)
    return {"message": f"Added {symbol} to watchlist", "symbol": symbol}


def remove_from_watchlist(symbol: str) -> dict[str, Any]:
    """Remove a symbol from the watchlist."""
    portfolio = _load_portfolio()
    watchlist = portfolio.get("watchlist", [])
    
    initial_len = len(watchlist)
    watchlist = [item for item in watchlist if item["symbol"] != symbol]
    
    if len(watchlist) == initial_len:
        return {"error": f"{symbol} is not in your watchlist"}
        
    portfolio["watchlist"] = watchlist
    _save_portfolio(portfolio)
    return {"message": f"Removed {symbol} from watchlist", "symbol": symbol}


def add_holding(symbol: str, quantity: float, avg_buy_price: float, buy_date: str) -> dict[str, Any]:
    """Add or increment an active holding in the portfolio."""
    portfolio = _load_portfolio()
    holdings = portfolio.get("holdings", [])
    transactions = portfolio.get("transactions", [])
    
    symbol_upper = symbol.upper()
    
    # 1. Update Holdings list
    found = False
    for h in holdings:
        if h.get("symbol", "").upper() == symbol_upper:
            old_qty = h.get("quantity", 0.0)
            old_price = h.get("avg_buy_price", 0.0)
            
            new_qty = old_qty + quantity
            if new_qty > 0:
                h["avg_buy_price"] = round(((old_qty * old_price) + (quantity * avg_buy_price)) / new_qty, 4)
                h["quantity"] = round(new_qty, 4)
            found = True
            break
            
    if not found:
        # Schema match portfolio.json exactly
        holdings.append({
            "symbol": symbol_upper,
            "quantity": quantity,
            "avg_buy_price": avg_buy_price,
            "asset_type": "equity"
        })
        
    # 2. Append Transaction
    if "T" not in buy_date:
        tx_date = f"{buy_date}T00:00:00Z"
    else:
        tx_date = buy_date
        
    transactions.append({
        "id": f"txn-{int(datetime.now().timestamp())}",
        "type": "buy",
        "symbol": symbol_upper,
        "quantity": quantity,
        "price": avg_buy_price,
        "timestamp": tx_date
    })
    
    portfolio["holdings"] = holdings
    portfolio["transactions"] = transactions
    _save_portfolio(portfolio)
    return {"message": f"Successfully bought {quantity} shares of {symbol_upper}", "symbol": symbol_upper}


def remove_holding(symbol: str) -> dict[str, Any]:
    """Purge an active holding entirely from the portfolio list."""
    portfolio = _load_portfolio()
    holdings = portfolio.get("holdings", [])
    
    symbol_upper = symbol.upper()
    initial_len = len(holdings)
    
    # Filter out the symbol, checking primary symbol key
    holdings = [h for h in holdings if h.get("symbol", "").upper() != symbol_upper and h.get("ticker", "").upper() != symbol_upper]
    
    if len(holdings) == initial_len:
        return {"error": f"{symbol_upper} was not found in Active Holdings."}
        
    portfolio["holdings"] = holdings
    _save_portfolio(portfolio)
    return {"message": f"Successfully sold/removed {symbol_upper} from Active Holdings", "symbol": symbol_upper}


def get_unified_investments() -> dict[str, list[dict[str, Any]]]:
    """Return both active holdings and watchlist in unified schemas."""
    return {
        "active": get_holdings(),
        "watchlist": get_watchlist()
    }
