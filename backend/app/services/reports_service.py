from __future__ import annotations

from datetime import date, datetime
from typing import Any

from app.services import portfolio_service as portfolio_svc
from app.services import yfinance_service as yf_svc
from app.services import portfolio_analysis_service as portfolio_analysis_svc


ASSET_LABELS = {
    "equity": "Equities",
    "etf": "ETFs",
    "mf": "Mutual Funds",
    "mutual_fund": "Mutual Funds",
    "bond": "Bonds",
    "crypto": "Crypto",
    "cash": "Cash",
}


def _parse_txn_datetime(txn: dict[str, Any]) -> datetime:
    ts = txn.get("timestamp")
    if ts:
        try:
            return datetime.fromisoformat(ts)
        except Exception:
            pass

    d = txn.get("date")
    t = txn.get("time", "00:00:00")
    if d:
        try:
            return datetime.fromisoformat(f"{d}T{t}")
        except Exception:
            pass

    return datetime.min


def _safe_quote_price(symbol: str, fallback: float) -> float:
    try:
        quote = yf_svc.get_stock_quote(symbol)
        return float(quote.get("price") or fallback)
    except Exception:
        return fallback


def _safe_symbol_name(symbol: str) -> str:
    clean = symbol.replace(".NS", "").replace(".BO", "")
    try:
        fundamentals = yf_svc.get_stock_fundamentals(symbol)
        # yfinance fundamentals service does not expose full company name, so keep ticker-clean fallback
        return fundamentals.get("symbol", clean) or clean
    except Exception:
        return clean


def _safe_sector(symbol: str) -> str:
    if "-USD" in symbol:
        return "Crypto"

    try:
        fundamentals = yf_svc.get_stock_fundamentals(symbol)
        return fundamentals.get("sector") or fundamentals.get("industry") or "Others"
    except Exception:
        return "Others"


def _days_in_month(year: int, month: int) -> int:
    if month == 12:
        next_month = date(year + 1, 1, 1)
    else:
        next_month = date(year, month + 1, 1)
    this_month = date(year, month, 1)
    return (next_month - this_month).days


def _annualized_return_pct(invested: float, proceeds: float, holding_days: int) -> float:
    if invested <= 0 or proceeds <= 0:
        return 0.0
    if holding_days <= 0:
        return ((proceeds - invested) / invested) * 100

    total_return = proceeds / invested
    try:
        annualized = (total_return ** (365 / holding_days)) - 1
        return annualized * 100
    except Exception:
        return ((proceeds - invested) / invested) * 100


def _build_position_journal() -> dict[str, Any]:
    portfolio = portfolio_svc._load_portfolio()
    transactions = sorted(portfolio.get("transactions", []), key=_parse_txn_datetime)

    state: dict[str, dict[str, Any]] = {}
    closed_positions: list[dict[str, Any]] = []
    daily_realized: dict[str, float] = {}
    dividend_events: list[dict[str, Any]] = []

    for txn in transactions:
        txn_type = str(txn.get("type", "")).lower()
        symbol = str(txn.get("symbol", ""))
        dt = _parse_txn_datetime(txn)
        day_key = dt.date().isoformat()

        if txn_type == "dividend":
            amount = float(txn.get("amount") or 0)
            if amount > 0:
                daily_realized[day_key] = daily_realized.get(day_key, 0.0) + amount
                dividend_events.append(
                    {
                        "symbol": symbol,
                        "name": txn.get("name") or symbol.replace(".NS", ""),
                        "date": day_key,
                        "type": "Dividend",
                        "amount": round(amount, 2),
                    }
                )
            continue

        if txn_type not in {"buy", "sell"}:
            continue

        qty = float(txn.get("quantity") or 0)
        price = float(txn.get("price") or 0)
        if qty <= 0 or price <= 0 or not symbol:
            continue

        entry = state.setdefault(
            symbol,
            {
                "symbol": symbol,
                "name": txn.get("name") or symbol.replace(".NS", ""),
                "qty": 0.0,
                "avg_cost": 0.0,
                "first_buy_date": None,
                "asset_type": "equity",
            },
        )

        if txn_type == "buy":
            prev_qty = float(entry["qty"])
            prev_cost = float(entry["avg_cost"])
            new_qty = prev_qty + qty
            new_avg = ((prev_qty * prev_cost) + (qty * price)) / new_qty if new_qty > 0 else price

            entry["qty"] = new_qty
            entry["avg_cost"] = new_avg
            if not entry["first_buy_date"]:
                entry["first_buy_date"] = day_key

            continue

        # sell
        sell_qty = min(qty, float(entry["qty"]))
        if sell_qty <= 0:
            continue

        avg_cost = float(entry["avg_cost"])
        invested = sell_qty * avg_cost
        proceeds = sell_qty * price
        pnl = proceeds - invested
        pnl_pct = (pnl / invested * 100) if invested > 0 else 0.0

        buy_date_str = entry.get("first_buy_date") or day_key
        try:
            holding_days = (dt.date() - date.fromisoformat(buy_date_str)).days
        except Exception:
            holding_days = 0

        xirr = _annualized_return_pct(invested, proceeds, holding_days)
        daily_realized[day_key] = daily_realized.get(day_key, 0.0) + pnl

        closed_positions.append(
            {
                "symbol": symbol,
                "name": entry.get("name") or symbol.replace(".NS", ""),
                "type": entry.get("asset_type", "equity"),
                "buy_price": round(avg_cost, 2),
                "buy_date": buy_date_str,
                "sell_price": round(price, 2),
                "sell_date": day_key,
                "qty": round(sell_qty, 4),
                "invested": round(invested, 2),
                "proceeds": round(proceeds, 2),
                "pnl": round(pnl, 2),
                "pnl_percent": round(pnl_pct, 2),
                "holding_days": holding_days,
                "xirr_percent": round(xirr, 2),
                "is_long_term": holding_days >= 365,
            }
        )

        entry["qty"] = round(float(entry["qty"]) - sell_qty, 8)

    # Reconcile with persisted holdings for final open positions and asset_type
    persisted_holdings = {h["symbol"]: h for h in portfolio.get("holdings", []) if h.get("symbol")}

    active_positions: list[dict[str, Any]] = []
    for symbol, h in persisted_holdings.items():
        qty = float(h.get("quantity") or 0)
        avg_buy = float(h.get("avg_buy_price") or 0)
        if qty <= 0 or avg_buy <= 0:
            continue

        open_entry = state.get(symbol, {})
        buy_date = open_entry.get("first_buy_date")

        active_positions.append(
            {
                "symbol": symbol,
                "name": open_entry.get("name") or h.get("name") or symbol.replace(".NS", ""),
                "qty": qty,
                "avg_buy_price": avg_buy,
                "buy_date": buy_date,
                "asset_type": h.get("asset_type", "equity"),
            }
        )

    closed_positions.sort(key=lambda x: x["sell_date"], reverse=True)
    dividend_events.sort(key=lambda x: x["date"], reverse=True)

    return {
        "active_positions": active_positions,
        "closed_positions": closed_positions,
        "daily_realized": daily_realized,
        "dividend_events": dividend_events,
    }


def _portfolio_cashflow_xirr(transactions: list[dict[str, Any]], current_value: float) -> float:
    # Approximate annualized return using first net investment date and current value.
    sorted_tx = sorted(transactions, key=_parse_txn_datetime)
    net_invested = 0.0
    first_dt: datetime | None = None

    for txn in sorted_tx:
        t = str(txn.get("type", "")).lower()
        dt = _parse_txn_datetime(txn)
        if dt == datetime.min:
            continue

        if t == "buy":
            amt = float(txn.get("total_amount") or (float(txn.get("quantity") or 0) * float(txn.get("price") or 0)))
            net_invested += amt
            if first_dt is None:
                first_dt = dt
        elif t == "sell":
            amt = float(txn.get("total_amount") or (float(txn.get("quantity") or 0) * float(txn.get("price") or 0)))
            net_invested -= amt
        elif t == "dividend":
            net_invested -= float(txn.get("amount") or 0)

    if not first_dt or net_invested <= 0 or current_value <= 0:
        return 0.0

    days = max((datetime.now().date() - first_dt.date()).days, 1)
    try:
        annualized = (current_value / net_invested) ** (365 / days) - 1
        return round(annualized * 100, 2)
    except Exception:
        return 0.0


def get_reports_summary(period: str = "1M") -> dict[str, Any]:
    summary = portfolio_svc.get_portfolio_summary()
    journal = _build_position_journal()
    portfolio = portfolio_svc._load_portfolio()

    realized_pnl = round(sum(c["pnl"] for c in journal["closed_positions"]), 2)
    unrealized_pnl = round(sum(h["pnl"] for h in portfolio_svc.get_holdings()), 2)
    total_value = round(summary.get("total_current_value", 0.0), 2)

    xirr = _portfolio_cashflow_xirr(portfolio.get("transactions", []), total_value)

    return {
        "period": period,
        "generated_at": datetime.now().isoformat(),
        "kpis": {
            "total_portfolio_value": total_value,
            "overall_return_percent": round(summary.get("total_pnl_percent", 0.0), 2),
            "realised_pnl": realized_pnl,
            "unrealised_pnl": unrealized_pnl,
            "dividends_ytd": round(summary.get("dividends_ytd", 0.0), 2),
            "xirr_percent": xirr,
        },
    }


def get_pl_calendar(year: int, month: int) -> dict[str, Any]:
    journal = _build_position_journal()
    daily = journal["daily_realized"]

    days = []
    for d in range(1, _days_in_month(year, month) + 1):
        dt = date(year, month, d)
        key = dt.isoformat()
        pnl = round(float(daily.get(key, 0.0)), 2)

        if pnl >= 15000:
            cls = "cal-profit-3"
        elif pnl >= 6000:
            cls = "cal-profit-2"
        elif pnl > 0:
            cls = "cal-profit-1"
        elif pnl <= -15000:
            cls = "cal-loss-3"
        elif pnl <= -6000:
            cls = "cal-loss-2"
        elif pnl < 0:
            cls = "cal-loss-1"
        else:
            cls = "cal-neutral"

        days.append({"day": d, "date": key, "pnl": pnl, "class": cls})

    return {
        "year": year,
        "month": month,
        "total_realised_pnl": round(sum(item["pnl"] for item in days), 2),
        "days": days,
    }


def get_active_holdings() -> list[dict[str, Any]]:
    journal = _build_position_journal()
    rows: list[dict[str, Any]] = []

    for pos in journal["active_positions"]:
        symbol = pos["symbol"]
        qty = float(pos["qty"])
        buy_price = float(pos["avg_buy_price"])
        current = _safe_quote_price(symbol, buy_price)

        invested = qty * buy_price
        market_value = qty * current
        pnl = market_value - invested
        pnl_pct = (pnl / invested * 100) if invested > 0 else 0

        rows.append(
            {
                "symbol": symbol,
                "ticker": symbol.replace(".NS", "").replace(".BO", ""),
                "name": pos.get("name") or symbol.replace(".NS", ""),
                "type": pos.get("asset_type", "equity"),
                "buy_price": round(buy_price, 2),
                "buy_date": pos.get("buy_date"),
                "qty": round(qty, 4),
                "current": round(current, 2),
                "invested": round(invested, 2),
                "market_value": round(market_value, 2),
                "pnl": round(pnl, 2),
                "pnl_percent": round(pnl_pct, 2),
            }
        )

    rows.sort(key=lambda x: x["market_value"], reverse=True)
    return rows


def get_asset_allocation() -> dict[str, Any]:
    holdings = get_active_holdings()
    summary = portfolio_svc.get_portfolio_summary()

    total = float(summary.get("total_assets") or 0.0)
    bucket_values: dict[str, float] = {}

    for h in holdings:
        key = str(h.get("type") or "equity").lower()
        bucket_values[key] = bucket_values.get(key, 0.0) + float(h["market_value"])

    cash = float(summary.get("cash_balance") or 0.0)
    if cash > 0:
        bucket_values["cash"] = bucket_values.get("cash", 0.0) + cash

    parts = []
    for k, v in bucket_values.items():
        pct = (v / total * 100) if total > 0 else 0.0
        parts.append(
            {
                "type": k,
                "label": ASSET_LABELS.get(k, k.title()),
                "value": round(v, 2),
                "percentage": round(pct, 2),
            }
        )

    parts.sort(key=lambda x: x["value"], reverse=True)

    primary = parts[0] if parts else {"type": "equity", "percentage": 0}

    return {
        "total_value": round(total, 2),
        "primary_type": primary["type"],
        "primary_percentage": round(float(primary.get("percentage", 0.0)), 2),
        "distribution": parts,
    }


def get_sector_exposure() -> list[dict[str, Any]]:
    holdings = get_active_holdings()
    total = sum(float(h["market_value"]) for h in holdings)

    sector_values: dict[str, float] = {}
    for h in holdings:
        sector = _safe_sector(h["symbol"])
        sector_values[sector] = sector_values.get(sector, 0.0) + float(h["market_value"])

    result = []
    for sector, value in sector_values.items():
        pct = (value / total * 100) if total > 0 else 0.0
        result.append(
            {
                "name": sector,
                "value": round(value, 2),
                "pct": round(pct, 2),
                "warn": pct > 35,
            }
        )

    result.sort(key=lambda x: x["pct"], reverse=True)
    return result


def _resolve_financial_year_bounds(fy: str | None = None) -> tuple[date, date, str]:
    # FY format: 2024-25 (India, Apr-Mar)
    if fy:
        try:
            start_y = int(fy.split("-")[0])
            start = date(start_y, 4, 1)
            end = date(start_y + 1, 3, 31)
            label = fy
            return start, end, label
        except Exception:
            pass

    today = date.today()
    if today.month >= 4:
        start_y = today.year
    else:
        start_y = today.year - 1

    start = date(start_y, 4, 1)
    end = date(start_y + 1, 3, 31)
    label = f"{start_y}-{str((start_y + 1) % 100).zfill(2)}"
    return start, end, label


def get_tax_summary(fy: str | None = None) -> dict[str, Any]:
    start, end, label = _resolve_financial_year_bounds(fy)
    journal = _build_position_journal()

    stcg_gains = 0.0
    ltcg_gains = 0.0
    realized_losses = 0.0

    for trade in journal["closed_positions"]:
        sell_date = date.fromisoformat(trade["sell_date"])
        if sell_date < start or sell_date > end:
            continue

        pnl = float(trade["pnl"])
        if pnl < 0:
            realized_losses += abs(pnl)
        elif trade["is_long_term"]:
            ltcg_gains += pnl
        else:
            stcg_gains += pnl

    stcg_tax = stcg_gains * 0.15
    ltcg_tax = ltcg_gains * 0.10
    gross_tax = stcg_tax + ltcg_tax
    offset = min(gross_tax, realized_losses)
    net_tax = max(gross_tax - offset, 0.0)

    # Simple actionable TLH candidate: worst unrealized holding
    active = get_active_holdings()
    tlh = None
    losers = [h for h in active if float(h["pnl"]) < 0]
    if losers:
        worst = min(losers, key=lambda x: x["pnl"])
        tax_saved = min(abs(float(worst["pnl"])) * 0.15, net_tax)
        tlh = {
            "symbol": worst["symbol"],
            "name": worst["name"],
            "quantity": worst["qty"],
            "estimated_tax_saved": round(tax_saved, 2),
        }

    return {
        "financial_year": label,
        "stcg": {
            "gains": round(stcg_gains, 2),
            "tax_rate": 15,
            "tax": round(stcg_tax, 2),
        },
        "ltcg": {
            "gains": round(ltcg_gains, 2),
            "tax_rate": 10,
            "tax": round(ltcg_tax, 2),
        },
        "tax_loss_offset": round(offset, 2),
        "net_tax_due": round(net_tax, 2),
        "tlh_opportunity": tlh,
        "disclaimer": "Estimated only. Not tax filing advice.",
    }


def get_dividend_history(limit: int = 20) -> dict[str, Any]:
    journal = _build_position_journal()
    events = journal["dividend_events"][: max(1, limit)]

    current_year = date.today().year
    ytd_total = 0.0
    for d in journal["dividend_events"]:
        if d["date"].startswith(str(current_year)):
            ytd_total += float(d["amount"])

    return {
        "ytd_total": round(ytd_total, 2),
        "events": events,
    }


def get_closed_positions(limit: int = 50) -> list[dict[str, Any]]:
    journal = _build_position_journal()
    return journal["closed_positions"][: max(1, limit)]


def get_ai_portfolio_doctor() -> dict[str, Any]:
    diversification = portfolio_analysis_svc.compute_diversification_score()
    allocation = portfolio_analysis_svc.compute_allocation()
    rebalancing = portfolio_analysis_svc.compute_rebalancing_recommendations()
    strategy = portfolio_analysis_svc.get_strategy_advisor()

    score = max(0, min(100, int(diversification.get("score", 0))))

    critical: list[str] = []
    strengths: list[str] = []
    prescriptions: list[str] = []

    for row in allocation:
        status = row.get("status")
        label = row.get("label", "Asset")
        current = row.get("currentPercent", 0)
        target = row.get("targetPercent", 0)

        if status == "OVERWEIGHT":
            critical.append(f"{label} overweight at {current}% vs target {target}%")
        elif status == "UNDERWEIGHT":
            critical.append(f"{label} underweight at {current}% vs target {target}%")
        else:
            strengths.append(f"{label} aligned near target allocation")

    strengths.append(diversification.get("headline", "Portfolio diversification improving"))

    for rec in rebalancing[:3]:
        prescriptions.append(f"{rec.get('action', 'ACT')}: {rec.get('title', 'Rebalance')} ({rec.get('subtitle', '')})")

    if not critical:
        critical = ["No critical allocation risks detected."]
    if not prescriptions:
        prescriptions = ["Maintain current allocation and review monthly."]

    return {
        "score": score,
        "max_score": 100,
        "critical": critical[:3],
        "strengths": strengths[:3],
        "prescriptions": prescriptions[:3],
        "advisor": strategy,
    }


def get_full_report(period: str = "1M", year: int | None = None, month: int | None = None) -> dict[str, Any]:
    today = date.today()
    report_year = year or today.year
    report_month = month or today.month

    return {
        "summary": get_reports_summary(period),
        "pl_calendar": get_pl_calendar(report_year, report_month),
        "active_holdings": get_active_holdings(),
        "asset_allocation": get_asset_allocation(),
        "sector_exposure": get_sector_exposure(),
        "tax_summary": get_tax_summary(),
        "dividend_history": get_dividend_history(),
        "closed_positions": get_closed_positions(),
        "portfolio_doctor": get_ai_portfolio_doctor(),
        "transactions": portfolio_svc.get_activity(limit=100),
    }
