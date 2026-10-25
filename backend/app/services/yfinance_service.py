import yfinance as yf
from typing import Any


def search_stocks(query: str) -> list[dict[str, Any]]:
    """Search for stocks by ticker or name."""
    try:
        # Use yfinance's search functionality
        ticker = yf.Ticker(query)
        info = ticker.info
        
        # If we got valid info, return it as a search result
        if info and info.get('symbol'):
            return [{
                "symbol": info.get('symbol', query.upper()),
                "name": info.get('longName', info.get('shortName', query)),
                "type": info.get('quoteType', 'EQUITY'),
                "exchange": info.get('exchange', 'Unknown'),
            }]
        
        # Fallback: return the query as uppercase ticker
        return [{
            "symbol": query.upper(),
            "name": query.upper(),
            "type": "EQUITY",
            "exchange": "Unknown",
        }]
    except Exception:
        # If search fails, still return the query as a potential ticker
        return [{
            "symbol": query.upper(),
            "name": query.upper(),
            "type": "EQUITY",
            "exchange": "Unknown",
        }]


def get_stock_quote(symbol: str) -> dict[str, Any]:
    """Get live quote for a stock."""
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.fast_info
        return {
            "symbol": symbol,
            "price": info.get("lastPrice"),
            "previous_close": info.get("previousClose"),
            "open": info.get("open"),
            "day_high": info.get("dayHigh"),
            "day_low": info.get("dayLow"),
            "volume": info.get("lastVolume"),
            "market_cap": info.get("marketCap"),
        }
    except Exception:
        # Fallback: try using .info instead of .fast_info
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.info
            price = info.get("currentPrice") or info.get("regularMarketPrice") or info.get("previousClose")
            return {
                "symbol": symbol,
                "price": price,
                "previous_close": info.get("previousClose") or info.get("regularMarketPreviousClose"),
                "open": info.get("open") or info.get("regularMarketOpen"),
                "day_high": info.get("dayHigh") or info.get("regularMarketDayHigh"),
                "day_low": info.get("dayLow") or info.get("regularMarketDayLow"),
                "volume": info.get("volume") or info.get("regularMarketVolume"),
                "market_cap": info.get("marketCap"),
            }
        except Exception:
            return {"symbol": symbol, "price": None}


def get_stock_fundamentals(symbol: str) -> dict[str, Any]:
    """Get fundamental data for a stock."""
    ticker = yf.Ticker(symbol)
    info = ticker.info
    return {
        "symbol": symbol,
        "pe_ratio": info.get("trailingPE"),
        "forward_pe": info.get("forwardPE"),
        "eps": info.get("trailingEps"),
        "dividend_yield": info.get("dividendYield"),
        "sector": info.get("sector"),
        "industry": info.get("industry"),
        "fifty_two_week_high": info.get("fiftyTwoWeekHigh"),
        "fifty_two_week_low": info.get("fiftyTwoWeekLow"),
        "beta": info.get("beta"),
        "market_cap": info.get("marketCap"),
    }


def get_stock_history(
    symbol: str,
    period: str = "1mo",
    interval: str = "1d"
) -> list[dict[str, Any]]:
    """Get OHLCV history for a stock.
    
    Periods: 1d, 5d, 1mo, 3mo, 6mo, 1y, 5y, max
    Intervals: 1m, 5m, 15m, 1h, 1d, 1wk, 1mo
    """
    ticker = yf.Ticker(symbol)
    df = ticker.history(period=period, interval=interval)
    df = df.reset_index()
    records = []
    for _, row in df.iterrows():
        records.append({
            "date": str(row.get("Date", row.get("Datetime", ""))),
            "open": row.get("Open"),
            "high": row.get("High"),
            "low": row.get("Low"),
            "close": row.get("Close"),
            "volume": row.get("Volume"),
        })
    return records


def get_financials(symbol: str) -> dict[str, Any]:
    """Get financial statements."""
    ticker = yf.Ticker(symbol)
    
    def df_to_dict(df):
        if df is None or df.empty:
            return {}
        df = df.reset_index()
        return df.to_dict(orient="records")
    
    return {
        "symbol": symbol,
        "income_statement": df_to_dict(ticker.income_stmt),
        "balance_sheet": df_to_dict(ticker.balance_sheet),
        "cashflow": df_to_dict(ticker.cashflow),
    }


def get_earnings(symbol: str) -> list[dict[str, Any]]:
    """Get earnings dates."""
    ticker = yf.Ticker(symbol)
    df = ticker.earnings_dates
    if df is None or df.empty:
        return []
    df = df.reset_index()
    return df.to_dict(orient="records")


def get_recommendations(symbol: str) -> list[dict[str, Any]]:
    """Get analyst recommendations."""
    ticker = yf.Ticker(symbol)
    df = ticker.recommendations
    if df is None or df.empty:
        return []
    df = df.reset_index()
    return df.tail(10).to_dict(orient="records")


def get_batch_quotes(symbols: list[str]) -> dict[str, dict[str, Any]]:
    """Get quotes for multiple symbols efficiently."""
    result = {}
    for symbol in symbols:
        try:
            result[symbol] = get_stock_quote(symbol)
        except Exception as e:
            result[symbol] = {"error": str(e)}
    return result


def get_index_quote(symbol: str) -> dict[str, Any]:
    """Get quote for an index (^NSEI, ^BSESN, ^NSEBANK)."""
    return get_stock_quote(symbol)


def get_index_history(
    symbol: str,
    period: str = "1mo",
    interval: str = "1d"
) -> list[dict[str, Any]]:
    """Get history for an index."""
    return get_stock_history(symbol, period, interval)


def get_option_chain(symbol: str, expiry: str | None = None) -> dict[str, Any]:
    """Get options chain for a symbol."""
    ticker = yf.Ticker(symbol)
    expiries = ticker.options
    
    if not expiries:
        return {"symbol": symbol, "error": "No options available"}
    
    if expiry is None:
        expiry = expiries[0]
    
    if expiry not in expiries:
        return {"symbol": symbol, "error": f"Invalid expiry. Available: {expiries}"}
    
    chain = ticker.option_chain(expiry)
    
    def parse_options(df):
        if df is None or df.empty:
            return []
        return df.to_dict(orient="records")
    
    return {
        "symbol": symbol,
        "expiry": expiry,
        "available_expiries": list(expiries),
        "calls": parse_options(chain.calls),
        "puts": parse_options(chain.puts),
    }


def get_option_expiries(symbol: str) -> list[str]:
    """Get available option expiries."""
    ticker = yf.Ticker(symbol)
    return list(ticker.options)


def get_iv_surface(symbol: str) -> list[dict[str, Any]]:
    """Get IV surface across all expiries."""
    ticker = yf.Ticker(symbol)
    expiries = ticker.options
    
    surface = []
    for expiry in expiries:
        try:
            chain = ticker.option_chain(expiry)
            for _, row in chain.calls.iterrows():
                surface.append({
                    "expiry": expiry,
                    "strike": row.get("strike"),
                    "option_type": "call",
                    "iv": row.get("impliedVolatility"),
                })
            for _, row in chain.puts.iterrows():
                surface.append({
                    "expiry": expiry,
                    "strike": row.get("strike"),
                    "option_type": "put",
                    "iv": row.get("impliedVolatility"),
                })
        except Exception:
            continue
    
    return surface
