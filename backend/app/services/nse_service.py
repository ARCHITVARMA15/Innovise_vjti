import time
import requests
from typing import Any


class NSEClient:
    """NSE India API client with session management."""
    
    BASE_URL = "https://www.nseindia.com"
    HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Referer": "https://www.nseindia.com/",
        "Accept-Language": "en-US,en;q=0.9",
    }
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update(self.HEADERS)
        self._warmed_up = False
    
    def _warmup(self):
        """Warm up session to get required cookies."""
        if self._warmed_up:
            return
        try:
            self.session.get(f"{self.BASE_URL}", timeout=10)
            time.sleep(1)
            self.session.get(f"{self.BASE_URL}/market-data/live-equity-market", timeout=10)
            time.sleep(1)
            self._warmed_up = True
        except Exception:
            pass
    
    def _get(self, endpoint: str, retries: int = 3) -> dict[str, Any]:
        """Make GET request with retry logic."""
        for attempt in range(retries):
            try:
                self._warmup()
                response = self.session.get(
                    f"{self.BASE_URL}{endpoint}",
                    timeout=10
                )
                if response.status_code == 200:
                    data = response.json()
                    return data
                # If HTML returned, session expired
                if "<!DOCTYPE" in response.text or "<html" in response.text:
                    self._warmed_up = False
                    time.sleep(2)
                    continue
            except Exception:
                time.sleep(2)
                self._warmed_up = False
        return {"error": "Failed to fetch data from NSE"}


# Global client instance
_client = NSEClient()


def get_stock_quote(symbol: str) -> dict[str, Any]:
    """Get live NSE quote for a stock."""
    data = _client._get(f"/api/quote-equity?symbol={symbol}")
    if "error" in data:
        return data
    
    price_info = data.get("priceInfo", {})
    security_info = data.get("securityInfo", {})
    intraday = price_info.get("intraDayHighLow", {})
    week_hl = price_info.get("weekHighLow", {})
    
    return {
        "symbol": symbol,
        "price": price_info.get("lastPrice"),
        "open": price_info.get("open"),
        "previous_close": price_info.get("previousClose"),
        "day_high": intraday.get("max"),
        "day_low": intraday.get("min"),
        "week_high": week_hl.get("max"),
        "week_low": week_hl.get("min"),
        "volume": price_info.get("totalTradedVolume"),
        "change": price_info.get("change"),
        "change_percent": price_info.get("pChange"),
        "industry": security_info.get("industry"),
        "isin": security_info.get("isinCode"),
    }


def get_all_indices() -> list[dict[str, Any]]:
    """Get all NSE indices."""
    data = _client._get("/api/allIndices")
    if "error" in data:
        return [data]
    
    indices = []
    for item in data.get("data", []):
        indices.append({
            "symbol": item.get("indexSymbol"),
            "name": item.get("index"),
            "last": item.get("last"),
            "change": item.get("variation"),
            "change_percent": item.get("percentChange"),
            "open": item.get("open"),
            "high": item.get("high"),
            "low": item.get("low"),
            "previous_close": item.get("previousClose"),
        })
    return indices


def get_nifty50_stocks() -> list[dict[str, Any]]:
    """Get all Nifty 50 stocks live data."""
    data = _client._get("/api/equity-stockIndices?index=NIFTY%2050")
    if "error" in data:
        return [data]
    
    stocks = []
    for item in data.get("data", []):
        if item.get("symbol") == "NIFTY 50":
            continue
        stocks.append({
            "symbol": item.get("symbol"),
            "price": item.get("lastPrice"),
            "open": item.get("open"),
            "high": item.get("dayHigh"),
            "low": item.get("dayLow"),
            "previous_close": item.get("previousClose"),
            "change": item.get("change"),
            "change_percent": item.get("pChange"),
            "volume": item.get("totalTradedVolume"),
            "year_high": item.get("yearHigh"),
            "year_low": item.get("yearLow"),
        })
    return stocks


def get_market_status() -> dict[str, Any]:
    """Get NSE market status."""
    data = _client._get("/api/marketStatus")
    if "error" in data:
        return data
    
    statuses = []
    for item in data.get("marketState", []):
        statuses.append({
            "market": item.get("market"),
            "status": item.get("marketStatus"),
            "trade_date": item.get("tradeDate"),
        })
    return {"statuses": statuses}


def get_option_chain(symbol: str, is_index: bool = True) -> dict[str, Any]:
    """Get option chain for index or equity."""
    if is_index:
        endpoint = f"/api/option-chain-indices?symbol={symbol}"
    else:
        endpoint = f"/api/option-chain-equities?symbol={symbol}"
    
    data = _client._get(endpoint)
    if "error" in data:
        return data
    
    records = data.get("records", {})
    chain_data = records.get("data", [])
    
    options = []
    for record in chain_data:
        strike = record.get("strikePrice")
        expiry = record.get("expiryDate")
        
        ce = record.get("CE", {})
        pe = record.get("PE", {})
        
        if ce:
            options.append({
                "strike": strike,
                "expiry": expiry,
                "type": "CE",
                "ltp": ce.get("lastPrice"),
                "oi": ce.get("openInterest"),
                "oi_change": ce.get("changeinOpenInterest"),
                "volume": ce.get("totalTradedVolume"),
                "iv": ce.get("impliedVolatility"),
                "bid": ce.get("bidprice"),
                "ask": ce.get("askPrice"),
            })
        
        if pe:
            options.append({
                "strike": strike,
                "expiry": expiry,
                "type": "PE",
                "ltp": pe.get("lastPrice"),
                "oi": pe.get("openInterest"),
                "oi_change": pe.get("changeinOpenInterest"),
                "volume": pe.get("totalTradedVolume"),
                "iv": pe.get("impliedVolatility"),
                "bid": pe.get("bidprice"),
                "ask": pe.get("askPrice"),
            })
    
    return {
        "symbol": symbol,
        "expiry_dates": records.get("expiryDates", []),
        "underlying_value": records.get("underlyingValue"),
        "options": options,
    }


def get_pcr(symbol: str, is_index: bool = True) -> dict[str, Any]:
    """Calculate Put-Call Ratio from option chain."""
    chain = get_option_chain(symbol, is_index)
    if "error" in chain:
        return chain
    
    total_call_oi = 0
    total_put_oi = 0
    
    for opt in chain.get("options", []):
        oi = opt.get("oi") or 0
        if opt.get("type") == "CE":
            total_call_oi += oi
        else:
            total_put_oi += oi
    
    pcr = total_put_oi / total_call_oi if total_call_oi > 0 else 0
    
    return {
        "symbol": symbol,
        "pcr": round(pcr, 4),
        "total_call_oi": total_call_oi,
        "total_put_oi": total_put_oi,
    }


def get_iv_surface(symbol: str, is_index: bool = True) -> list[dict[str, Any]]:
    """Get IV surface from option chain."""
    chain = get_option_chain(symbol, is_index)
    if "error" in chain:
        return [chain]
    
    surface = []
    for opt in chain.get("options", []):
        if opt.get("iv"):
            surface.append({
                "strike": opt.get("strike"),
                "expiry": opt.get("expiry"),
                "type": opt.get("type"),
                "iv": opt.get("iv"),
            })
    
    return surface
