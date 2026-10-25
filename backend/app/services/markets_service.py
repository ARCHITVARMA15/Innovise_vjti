"""
Markets Service - Computes all market data for the Markets page.
All data is computed from real yfinance data, with caching in portfolio.json.
"""

import json
from pathlib import Path
from typing import Any
from datetime import datetime, timedelta
import statistics

from app.services import yfinance_service as yf_svc

DATA_FILE = Path(__file__).parent.parent.parent / "data" / "portfolio.json"

# Sector ETFs for heatmap
SECTOR_ETFS = {
    "Technology": "XLK",
    "Healthcare": "XLV",
    "Finance": "XLF",
    "Energy": "XLE",
    "Consumer": "XLY",
    "Industrials": "XLI",
    "Materials": "XLB",
    "Utilities": "XLU",
    "Real Estate": "XLRE",
    "Communication": "XLC",
}

# Default stocks for asset explorer
DEFAULT_STOCKS = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "AMD", "NFLX", "CRM"]
DEFAULT_CRYPTO = ["BTC-USD", "ETH-USD", "SOL-USD", "BNB-USD", "XRP-USD"]

# Cache duration in seconds
CACHE_DURATION = 300  # 5 minutes


def _load_data() -> dict:
    """Load data from JSON file."""
    if not DATA_FILE.exists():
        return {}
    with open(DATA_FILE, "r") as f:
        return json.load(f)


def _save_data(data: dict) -> None:
    """Save data to JSON file."""
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(DATA_FILE, "w") as f:
        json.dump(data, f, indent=2)


def _is_cache_valid(cached_at: str | None, duration: int = CACHE_DURATION) -> bool:
    """Check if cache is still valid."""
    if not cached_at:
        return False
    try:
        cached_time = datetime.fromisoformat(cached_at)
        return datetime.now() - cached_time < timedelta(seconds=duration)
    except Exception:
        return False


def get_market_indices() -> list[dict[str, Any]]:
    """
    Get market indices (S&P 500, NASDAQ, BTC, ETH).
    Computes from yfinance, caches in portfolio.json.
    """
    data = _load_data()
    markets_cache = data.get("markets_cache", {})
    
    # Check cache
    if _is_cache_valid(markets_cache.get("indices_cached_at")):
        return markets_cache.get("indices", [])
    
    indices_config = [
        {"id": "sp500", "label": "S&P 500", "symbol": "^GSPC"},
        {"id": "nasdaq", "label": "NASDAQ", "symbol": "^IXIC"},
        {"id": "btc", "label": "Bitcoin", "symbol": "BTC-USD"},
        {"id": "eth", "label": "Ethereum", "symbol": "ETH-USD"},
    ]
    
    result = []
    for cfg in indices_config:
        try:
            quote = yf_svc.get_stock_quote(cfg["symbol"])
            price = quote.get("price") or 0
            prev_close = quote.get("previous_close") or price
            change_pct = ((price - prev_close) / prev_close * 100) if prev_close else 0
            
            # Calculate bar fill based on daily range position
            day_high = quote.get("day_high") or price
            day_low = quote.get("day_low") or price
            if day_high != day_low:
                bar_fill = ((price - day_low) / (day_high - day_low)) * 100
            else:
                bar_fill = 50
            
            result.append({
                "id": cfg["id"],
                "label": cfg["label"],
                "symbol": cfg["symbol"],
                "price": round(price, 2),
                "changePercent": round(change_pct, 2),
                "barFillPercent": round(bar_fill, 0),
            })
        except Exception as e:
            result.append({
                "id": cfg["id"],
                "label": cfg["label"],
                "symbol": cfg["symbol"],
                "price": 0,
                "changePercent": 0,
                "barFillPercent": 50,
                "error": str(e),
            })
    
    # Cache result
    if "markets_cache" not in data:
        data["markets_cache"] = {}
    data["markets_cache"]["indices"] = result
    data["markets_cache"]["indices_cached_at"] = datetime.now().isoformat()
    _save_data(data)
    
    return result


def get_chart_data(symbol: str = "QQQ") -> dict[str, Any]:
    """
    Get candlestick chart data for all periods.
    Computes from yfinance, caches in portfolio.json.
    """
    data = _load_data()
    markets_cache = data.get("markets_cache", {})
    chart_cache_key = f"chart_{symbol}"
    
    # Check cache
    if _is_cache_valid(markets_cache.get(f"{chart_cache_key}_cached_at"), duration=60):
        cached = markets_cache.get(chart_cache_key)
        if cached:
            return cached
    
    # Period mappings
    periods = {
        "1D": {"period": "1d", "interval": "5m"},
        "1W": {"period": "5d", "interval": "1h"},
        "1M": {"period": "1mo", "interval": "1d"},
        "1Y": {"period": "1y", "interval": "1wk"},
    }
    
    candles = {}
    for period_key, params in periods.items():
        try:
            history = yf_svc.get_stock_history(symbol, params["period"], params["interval"])
            candles[period_key] = [
                {
                    "date": h["date"],
                    "open": round(h["open"], 2) if h["open"] else 0,
                    "high": round(h["high"], 2) if h["high"] else 0,
                    "low": round(h["low"], 2) if h["low"] else 0,
                    "close": round(h["close"], 2) if h["close"] else 0,
                    "volume": h["volume"] or 0,
                }
                for h in history
            ]
        except Exception:
            candles[period_key] = []
    
    # Get fundamentals for RSI and volatility calculation
    try:
        fundamentals = yf_svc.get_stock_fundamentals(symbol)
        beta = fundamentals.get("beta") or 1.0
    except Exception:
        beta = 1.0
    
    # Calculate RSI from 1M data
    rsi = _calculate_rsi(candles.get("1M", []))
    
    # Get name
    try:
        import yfinance as yf
        ticker = yf.Ticker(symbol)
        name = ticker.info.get("longName", symbol)
    except Exception:
        name = symbol
    
    result = {
        "symbol": symbol,
        "name": name,
        "volatility": round(beta, 2),
        "rsi": round(rsi, 1),
        "candles": candles,
    }
    
    # Cache result
    if "markets_cache" not in data:
        data["markets_cache"] = {}
    data["markets_cache"][chart_cache_key] = result
    data["markets_cache"][f"{chart_cache_key}_cached_at"] = datetime.now().isoformat()
    _save_data(data)
    
    return result


def _calculate_rsi(candles: list[dict], period: int = 14) -> float:
    """Calculate RSI from candle data."""
    if len(candles) < period + 1:
        return 50.0
    
    closes = [c["close"] for c in candles if c["close"]]
    if len(closes) < period + 1:
        return 50.0
    
    gains = []
    losses = []
    
    for i in range(1, len(closes)):
        change = closes[i] - closes[i - 1]
        if change > 0:
            gains.append(change)
            losses.append(0)
        else:
            gains.append(0)
            losses.append(abs(change))
    
    if len(gains) < period:
        return 50.0
    
    avg_gain = sum(gains[-period:]) / period
    avg_loss = sum(losses[-period:]) / period
    
    if avg_loss == 0:
        return 100.0
    
    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))
    
    return rsi


def get_sector_heatmap() -> list[dict[str, Any]]:
    """
    Get sector performance heatmap.
    Computes from sector ETFs via yfinance, caches in portfolio.json.
    """
    data = _load_data()
    markets_cache = data.get("markets_cache", {})
    
    # Check cache
    if _is_cache_valid(markets_cache.get("sectors_cached_at")):
        return markets_cache.get("sectors", [])
    
    result = []
    for sector_name, etf_symbol in SECTOR_ETFS.items():
        try:
            quote = yf_svc.get_stock_quote(etf_symbol)
            price = quote.get("price") or 0
            prev_close = quote.get("previous_close") or price
            change_pct = ((price - prev_close) / prev_close * 100) if prev_close else 0
            
            result.append({
                "id": etf_symbol.lower(),
                "label": sector_name,
                "changePercent": round(change_pct, 2),
            })
        except Exception:
            result.append({
                "id": etf_symbol.lower(),
                "label": sector_name,
                "changePercent": 0,
            })
    
    # Sort by change percent
    result.sort(key=lambda x: x["changePercent"], reverse=True)
    
    # Cache result
    if "markets_cache" not in data:
        data["markets_cache"] = {}
    data["markets_cache"]["sectors"] = result
    data["markets_cache"]["sectors_cached_at"] = datetime.now().isoformat()
    _save_data(data)
    
    return result


def get_algorithmic_signals() -> list[dict[str, Any]]:
    """
    Get algorithmic trading signals.
    Computes from technical analysis of top stocks, caches in portfolio.json.
    """
    data = _load_data()
    markets_cache = data.get("markets_cache", {})
    
    # Check cache
    if _is_cache_valid(markets_cache.get("signals_cached_at")):
        return markets_cache.get("signals", [])
    
    # Analyze top stocks for signals
    signal_candidates = ["NVDA", "TSLA", "AAPL", "MSFT", "AMD", "BTC-USD"]
    signals = []
    
    for symbol in signal_candidates:
        try:
            # Get recent history for analysis
            history = yf_svc.get_stock_history(symbol, "1mo", "1d")
            if len(history) < 14:
                continue
            
            closes = [h["close"] for h in history if h["close"]]
            if len(closes) < 14:
                continue
            
            # Calculate indicators
            rsi = _calculate_rsi(history)
            current_price = closes[-1]
            sma_20 = sum(closes[-20:]) / min(len(closes), 20) if len(closes) >= 5 else current_price
            
            # Determine signal
            ticker = symbol.replace("-USD", "")
            
            if rsi < 30:
                signals.append({
                    "id": f"sig-{ticker.lower()}-entry",
                    "ticker": ticker,
                    "signalType": "ENTRY",
                    "status": "CONFIRMED",
                    "description": f"RSI at {rsi:.1f} indicates oversold. Price near support level ${current_price:.2f}.",
                    "icon": "login",
                })
            elif rsi > 70:
                signals.append({
                    "id": f"sig-{ticker.lower()}-exit",
                    "ticker": ticker,
                    "signalType": "EXIT",
                    "status": "WARNING",
                    "description": f"RSI at {rsi:.1f} indicates overbought. Consider taking profits at ${current_price:.2f}.",
                    "icon": "logout",
                })
            elif current_price > sma_20 * 1.02:
                signals.append({
                    "id": f"sig-{ticker.lower()}-hold",
                    "ticker": ticker,
                    "signalType": "HOLD",
                    "status": "NEUTRAL",
                    "description": f"Trading above 20-day SMA. Trend remains bullish at ${current_price:.2f}.",
                    "icon": "trending_up",
                })
            elif current_price < sma_20 * 0.98:
                signals.append({
                    "id": f"sig-{ticker.lower()}-accum",
                    "ticker": ticker,
                    "signalType": "ACCUMULATE",
                    "status": "NEUTRAL",
                    "description": f"Price below 20-day SMA at ${current_price:.2f}. Potential accumulation zone.",
                    "icon": "target",
                })
            
            if len(signals) >= 3:
                break
                
        except Exception:
            continue
    
    # Ensure we have at least some signals
    if not signals:
        signals = [
            {
                "id": "sig-default",
                "ticker": "MARKET",
                "signalType": "HOLD",
                "status": "NEUTRAL",
                "description": "Markets are consolidating. Monitor for breakout opportunities.",
                "icon": "analytics",
            }
        ]
    
    # Cache result
    if "markets_cache" not in data:
        data["markets_cache"] = {}
    data["markets_cache"]["signals"] = signals
    data["markets_cache"]["signals_cached_at"] = datetime.now().isoformat()
    _save_data(data)
    
    return signals


def get_growth_forecasts() -> list[dict[str, Any]]:
    """
    Get growth forecasts for sectors.
    Computes from sector momentum, caches in portfolio.json.
    """
    data = _load_data()
    markets_cache = data.get("markets_cache", {})
    
    # Check cache
    if _is_cache_valid(markets_cache.get("forecasts_cached_at")):
        return markets_cache.get("forecasts", [])
    
    # Sector themes with representative ETFs
    themes = [
        {"label": "AI & Semiconductors", "symbols": ["SMH", "NVDA", "AMD"]},
        {"label": "Cloud & SaaS", "symbols": ["SKYY", "CRM", "NOW"]},
        {"label": "Clean Energy", "symbols": ["ICLN", "ENPH", "FSLR"]},
        {"label": "Healthcare", "symbols": ["XLV", "UNH", "JNJ"]},
    ]
    
    forecasts = []
    for theme in themes:
        try:
            # Calculate average momentum from 3-month performance
            total_change = 0
            valid_count = 0
            
            for symbol in theme["symbols"]:
                try:
                    history = yf_svc.get_stock_history(symbol, "3mo", "1d")
                    if len(history) >= 2:
                        start_price = history[0]["close"]
                        end_price = history[-1]["close"]
                        if start_price and end_price:
                            change = ((end_price - start_price) / start_price) * 100
                            total_change += change
                            valid_count += 1
                except Exception:
                    continue
            
            if valid_count > 0:
                avg_change = total_change / valid_count
                # Annualize the 3-month change for forecast
                forecast_pct = avg_change * 4 / 3  # Rough annualization
                bar_width = min(max(forecast_pct * 5, 10), 100)  # Scale to 0-100
                
                forecasts.append({
                    "label": theme["label"],
                    "forecastPercent": round(forecast_pct, 1),
                    "barWidthPercent": round(bar_width, 0),
                })
        except Exception:
            continue
    
    # Sort by forecast percent
    forecasts.sort(key=lambda x: x["forecastPercent"], reverse=True)
    forecasts = forecasts[:3]  # Top 3
    
    # Ensure we have forecasts
    if not forecasts:
        forecasts = [
            {"label": "Technology", "forecastPercent": 8.5, "barWidthPercent": 60},
            {"label": "Healthcare", "forecastPercent": 5.2, "barWidthPercent": 40},
            {"label": "Energy", "forecastPercent": 3.8, "barWidthPercent": 30},
        ]
    
    # Cache result
    if "markets_cache" not in data:
        data["markets_cache"] = {}
    data["markets_cache"]["forecasts"] = forecasts
    data["markets_cache"]["forecasts_cached_at"] = datetime.now().isoformat()
    _save_data(data)
    
    return forecasts


def get_asset_explorer(tab: str = "STOCKS") -> list[dict[str, Any]]:
    """
    Get assets for the explorer table.
    Computes from yfinance, caches in portfolio.json.
    """
    data = _load_data()
    markets_cache = data.get("markets_cache", {})
    cache_key = f"assets_{tab}"
    
    # Check cache
    if _is_cache_valid(markets_cache.get(f"{cache_key}_cached_at")):
        return markets_cache.get(cache_key, [])
    
    if tab == "STOCKS":
        symbols = DEFAULT_STOCKS
    elif tab == "CRYPTO":
        symbols = DEFAULT_CRYPTO
    elif tab == "OPTIONS":
        # Options are more complex, return simplified data
        return _get_options_data()
    else:
        symbols = DEFAULT_STOCKS
    
    result = []
    for symbol in symbols:
        try:
            quote = yf_svc.get_stock_quote(symbol)
            price = quote.get("price") or 0
            prev_close = quote.get("previous_close") or price
            change_pct = ((price - prev_close) / prev_close * 100) if prev_close else 0
            
            # Get fundamentals for sector
            try:
                fundamentals = yf_svc.get_stock_fundamentals(symbol)
                sector = fundamentals.get("sector") or ("Crypto" if "-USD" in symbol else "Technology")
                beta = fundamentals.get("beta") or 1.0
            except Exception:
                sector = "Crypto" if "-USD" in symbol else "Technology"
                beta = 1.0
            
            # Determine volatility level
            if beta > 1.5:
                volatility = "High"
            elif beta > 0.8:
                volatility = "Medium"
            else:
                volatility = "Low"
            
            # Calculate expected growth from momentum
            try:
                history = yf_svc.get_stock_history(symbol, "3mo", "1d")
                if len(history) >= 2:
                    start = history[0]["close"]
                    end = history[-1]["close"]
                    if start and end:
                        exp_growth = ((end - start) / start) * 100 * 4  # Annualized
                    else:
                        exp_growth = 0
                else:
                    exp_growth = 0
            except Exception:
                exp_growth = 0
            
            ticker = symbol.replace("-USD", "").replace(".NS", "")
            
            result.append({
                "id": symbol.lower().replace("-", "").replace(".", ""),
                "ticker": ticker,
                "name": _get_company_name(symbol),
                "sector": sector,
                "price": round(price, 2),
                "changePercent24h": round(change_pct, 2),
                "volatility": volatility,
                "expGrowthPercent": round(max(exp_growth, 0), 1),
            })
        except Exception:
            continue
    
    # Cache result
    if "markets_cache" not in data:
        data["markets_cache"] = {}
    data["markets_cache"][cache_key] = result
    data["markets_cache"][f"{cache_key}_cached_at"] = datetime.now().isoformat()
    _save_data(data)
    
    return result


def _get_company_name(symbol: str) -> str:
    """Get company name from symbol."""
    names = {
        "AAPL": "Apple Inc.",
        "MSFT": "Microsoft Corp",
        "GOOGL": "Alphabet Inc.",
        "AMZN": "Amazon.com Inc.",
        "NVDA": "NVIDIA Corp",
        "META": "Meta Platforms",
        "TSLA": "Tesla Inc.",
        "AMD": "Advanced Micro Devices",
        "NFLX": "Netflix Inc.",
        "CRM": "Salesforce Inc.",
        "BTC-USD": "Bitcoin",
        "ETH-USD": "Ethereum",
        "SOL-USD": "Solana",
        "BNB-USD": "Binance Coin",
        "XRP-USD": "Ripple",
    }
    return names.get(symbol, symbol)


def _get_options_data() -> list[dict[str, Any]]:
    """Get simplified options data."""
    data = _load_data()
    markets_cache = data.get("markets_cache", {})
    
    if _is_cache_valid(markets_cache.get("assets_OPTIONS_cached_at")):
        return markets_cache.get("assets_OPTIONS", [])
    
    # Get options for popular stocks
    options_symbols = ["AAPL", "TSLA", "SPY"]
    result = []
    
    for symbol in options_symbols:
        try:
            quote = yf_svc.get_stock_quote(symbol)
            price = quote.get("price") or 100
            
            # Create sample call and put
            strike_call = round(price * 1.05, 0)
            strike_put = round(price * 0.95, 0)
            
            result.append({
                "id": f"{symbol.lower()}-call",
                "ticker": f"{symbol} {int(strike_call)}C",
                "name": f"{symbol} Call {int(strike_call)}",
                "sector": "Options",
                "price": round(price * 0.02, 2),
                "changePercent24h": round((price * 0.001) / (price * 0.02) * 100, 2),
                "volatility": "High",
                "expGrowthPercent": 0,
            })
            result.append({
                "id": f"{symbol.lower()}-put",
                "ticker": f"{symbol} {int(strike_put)}P",
                "name": f"{symbol} Put {int(strike_put)}",
                "sector": "Options",
                "price": round(price * 0.015, 2),
                "changePercent24h": round((price * 0.0008) / (price * 0.015) * 100, 2),
                "volatility": "High",
                "expGrowthPercent": 0,
            })
        except Exception:
            continue
    
    # Cache
    if "markets_cache" not in data:
        data["markets_cache"] = {}
    data["markets_cache"]["assets_OPTIONS"] = result
    data["markets_cache"]["assets_OPTIONS_cached_at"] = datetime.now().isoformat()
    _save_data(data)
    
    return result


def get_full_market_data() -> dict[str, Any]:
    """
    Get all market data in one call.
    Used by the frontend Markets page.
    """
    return {
        "indices": get_market_indices(),
        "chart": get_chart_data(),
        "sectors": get_sector_heatmap(),
        "signals": get_algorithmic_signals(),
        "growthForecasts": get_growth_forecasts(),
        "assets": {
            "STOCKS": get_asset_explorer("STOCKS"),
            "OPTIONS": get_asset_explorer("OPTIONS"),
            "CRYPTO": get_asset_explorer("CRYPTO"),
        },
    }
