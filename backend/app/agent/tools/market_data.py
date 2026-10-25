"""
Market data tool — wraps yfinance_service and nse_service for the agent.
"""

import logging
from typing import Any

from app.services import yfinance_service as yf_svc
from app.services import nse_service as nse_svc

log = logging.getLogger("veritas.tools.market_data")

# Common Indian stocks that need .NS suffix for yfinance
_INDIAN_TICKERS = frozenset({
    "RELIANCE", "TCS", "INFY", "HDFCBANK", "ICICIBANK",
    "SBIN", "ITC", "BAJFINANCE", "BHARTIARTL", "WIPRO",
    "HCLTECH", "ADANIENT", "LT", "KOTAKBANK", "AXISBANK",
    "MARUTI", "TATAMOTORS", "TATASTEEL", "SUNPHARMA", "ONGC",
})

# Company name → yfinance ticker mapping
_NAME_TO_TICKER: dict[str, str] = {
    # US mega-caps
    "NVIDIA": "NVDA", "APPLE": "AAPL", "MICROSOFT": "MSFT",
    "GOOGLE": "GOOGL", "ALPHABET": "GOOGL", "AMAZON": "AMZN",
    "META": "META", "FACEBOOK": "META", "TESLA": "TSLA",
    "NETFLIX": "NFLX", "AMD": "AMD", "INTEL": "INTC",
    "BROADCOM": "AVGO", "SALESFORCE": "CRM", "ADOBE": "ADBE",
    "ORACLE": "ORCL", "PAYPAL": "PYPL", "UBER": "UBER",
    "AIRBNB": "ABNB", "COINBASE": "COIN", "PALANTIR": "PLTR",
    "SNOWFLAKE": "SNOW", "SHOPIFY": "SHOP", "SPOTIFY": "SPOT",
    "DISNEY": "DIS", "WALMART": "WMT", "JPMORGAN": "JPM",
    "GOLDMAN": "GS", "BERKSHIRE": "BRK-B", "VISA": "V",
    "MASTERCARD": "MA", "BOEING": "BA", "NIKE": "NKE",
    "STARBUCKS": "SBUX", "MCDONALDS": "MCD", "COCACOLA": "KO",
    "COCA-COLA": "KO", "PEPSI": "PEP", "PEPSICO": "PEP",
    "JOHNSON": "JNJ", "PFIZER": "PFE", "MODERNA": "MRNA",
    "EXXON": "XOM", "CHEVRON": "CVX", "SHELL": "SHEL",
    # Crypto
    "BITCOIN": "BTC-USD", "BTC": "BTC-USD",
    "ETHEREUM": "ETH-USD", "ETH": "ETH-USD",
    "SOLANA": "SOL-USD", "SOL": "SOL-USD",
    "DOGECOIN": "DOGE-USD", "DOGE": "DOGE-USD",
    "XRP": "XRP-USD", "RIPPLE": "XRP-USD",
    # Indices
    "NIFTY": "^NSEI", "SENSEX": "^BSESN", "BANKNIFTY": "^NSEBANK",
    "S&P500": "^GSPC", "S&P 500": "^GSPC", "SP500": "^GSPC",
    "NASDAQ": "^IXIC", "DOW": "^DJI", "DOW JONES": "^DJI",
    # Commodities
    "GOLD": "GC=F", "SILVER": "SI=F", "OIL": "CL=F",
    "CRUDE": "CL=F", "CRUDE OIL": "CL=F", "BRENT": "BZ=F",
    "NATURAL GAS": "NG=F",
    # Indian companies by name
    "RELIANCE INDUSTRIES": "RELIANCE.NS", "TATA MOTORS": "TATAMOTORS.NS",
    "TATA STEEL": "TATASTEEL.NS", "HDFC BANK": "HDFCBANK.NS",
    "ICICI BANK": "ICICIBANK.NS", "STATE BANK": "SBIN.NS",
    "INFOSYS": "INFY.NS", "WIPRO": "WIPRO.NS",
}


def normalize_ticker(entity: str) -> str:
    """Normalize an entity string to a yfinance-compatible ticker."""
    cleaned = entity.strip().upper()

    # Direct name lookup
    if cleaned in _NAME_TO_TICKER:
        return _NAME_TO_TICKER[cleaned]

    # Indian ticker without suffix
    if cleaned in _INDIAN_TICKERS:
        return f"{cleaned}.NS"

    # Already has a suffix (e.g. RELIANCE.NS, BTC-USD)
    if "." in cleaned or "-" in cleaned:
        return cleaned

    # Try yfinance search as last resort for unknown names
    try:
        import yfinance as yf
        results = yf.Ticker(cleaned)
        if results.fast_info and results.fast_info.get("lastPrice"):
            return cleaned
    except Exception:
        pass

    return cleaned


def get_asset_data(entities: list[str], max_entities: int = 3) -> dict[str, Any]:
    """
    Fetch market data for given entities (tickers, asset names).
    Automatically detects Indian vs. global tickers.
    Returns a normalised dict keyed by ticker.
    """
    results: dict[str, Any] = {}

    for entity in entities[:max_entities]:
        ticker = normalize_ticker(entity)
        try:
            quote = yf_svc.get_stock_quote(ticker)
            fundamentals = yf_svc.get_stock_fundamentals(ticker)
            results[ticker] = {"quote": quote, "fundamentals": fundamentals}
        except Exception as exc:
            log.debug("yfinance failed for %s: %s — trying NSE", ticker, exc)
            try:
                nse_quote = nse_svc.get_stock_quote(entity.upper().replace(".NS", ""))
                results[entity] = {"quote": nse_quote, "fundamentals": None}
            except Exception:
                results[entity] = {"error": f"Could not fetch data for {entity}"}

    return results


def summarize_market_data(data: dict[str, Any]) -> str:
    """
    Convert raw market data dict to a concise text summary.
    Target: ~300-400 tokens max.
    """
    if not data:
        return "No market data available."

    lines: list[str] = []
    for ticker, info in data.items():
        if "error" in info:
            lines.append(f"{ticker}: Data unavailable")
            continue

        q = info.get("quote") or {}
        f = info.get("fundamentals") or {}

        price = q.get("price", "N/A")
        change = q.get("change_percent", q.get("daily_change", "N/A"))
        volume = q.get("volume", "N/A")
        mcap = q.get("market_cap", f.get("market_cap", "N/A"))
        pe = f.get("pe_ratio", f.get("trailing_pe", "N/A"))
        eps = f.get("eps", f.get("trailing_eps", "N/A"))
        high52 = f.get("fifty_two_week_high", "N/A")
        low52 = f.get("fifty_two_week_low", "N/A")
        sector = f.get("sector", "N/A")

        lines.append(
            f"{ticker}: Price={price}, Change={change}%, Vol={volume}, "
            f"MCap={mcap}, PE={pe}, EPS={eps}, "
            f"52wH={high52}, 52wL={low52}, Sector={sector}"
        )

    return "\n".join(lines)


def build_data_snapshots(data: dict[str, Any]) -> list[dict[str, Any]]:
    """Build DataSnapshot dicts for the frontend context panel."""
    snapshots: list[dict[str, Any]] = []
    for ticker, info in data.items():
        if "error" in info:
            continue
        q = info.get("quote") or {}
        f = info.get("fundamentals") or {}
        snapshots.append({
            "type": "stock_quote",
            "label": ticker,
            "data": {
                "price": q.get("price"),
                "change_percent": q.get("change_percent", q.get("daily_change")),
                "volume": q.get("volume"),
                "market_cap": q.get("market_cap", f.get("market_cap")),
                "pe_ratio": f.get("pe_ratio"),
                "sector": f.get("sector"),
                "52w_high": f.get("fifty_two_week_high"),
                "52w_low": f.get("fifty_two_week_low"),
            },
        })
    return snapshots
