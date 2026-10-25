# CodeCrafters Backend Documentation

> **Source of Truth** for backend API and system info. Frontend devs: read this before integrating.

---

## System Overview

| Item | Value |
|------|-------|
| Framework | FastAPI |
| Python | 3.13 |
| Package Manager | uv |
| Port | 8000 |
| Base URL | `http://localhost:8000` |

---

## Running the Backend

```bash
cd backend
uv sync              # Install dependencies
uv run python main.py   # Start server with hot reload
```

---

## Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # All API routes
│   └── services/
│       ├── yfinance_service.py   # yfinance data fetching
│       ├── nse_service.py        # NSE India direct API
│       ├── portfolio_service.py  # Portfolio CRUD & calculations
│       └── insights_service.py   # AI insights (mock)
├── data/
│   └── portfolio.json       # User portfolio storage (JSON file)
├── main.py                  # Entry point
├── pyproject.toml
└── backend_doc.md
```

---

## Data Sources

### 1. yfinance (`/yf/...`)
- Global stock data (works for US, India with `.NS` suffix, etc.)
- Fundamentals, financials, options, history
- Use for: historical data, fundamentals, global stocks

### 2. NSE India (`/nse/...`)
- Direct NSE India API
- Real-time Indian market data
- Use for: live Nifty 50, NSE indices, Indian options chains

---

## API Endpoints

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Server health check |

---

### yfinance Endpoints (`/yf/...`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/yf/quote/{symbol}` | Live quote (price, volume, etc.) |
| GET | `/yf/fundamentals/{symbol}` | PE, EPS, sector, 52w high/low |
| GET | `/yf/history/{symbol}?period=1mo&interval=1d` | OHLCV history |
| GET | `/yf/financials/{symbol}` | Income, balance sheet, cashflow |
| GET | `/yf/earnings/{symbol}` | Earnings dates |
| GET | `/yf/recommendations/{symbol}` | Analyst ratings |
| POST | `/yf/batch-quotes` | Multiple symbols at once |
| GET | `/yf/index/{symbol}` | Index quote (^NSEI, ^BSESN) |
| GET | `/yf/index-history/{symbol}` | Index OHLCV history |
| GET | `/yf/options/{symbol}?expiry=` | Option chain |
| GET | `/yf/option-expiries/{symbol}` | Available expiries |
| GET | `/yf/iv-surface/{symbol}` | IV across all strikes/expiries |

**Symbol format for Indian stocks:** `RELIANCE.NS`, `TCS.NS`, `INFY.NS`
**Index symbols:** `^NSEI` (Nifty 50), `^BSESN` (Sensex), `^NSEBANK` (Bank Nifty)

**History params:**
- `period`: 1d, 5d, 1mo, 3mo, 6mo, 1y, 5y, max
- `interval`: 1m, 5m, 15m, 1h, 1d, 1wk, 1mo

---

### NSE India Endpoints (`/nse/...`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/nse/quote/{symbol}` | Live NSE quote |
| GET | `/nse/indices` | All NSE indices |
| GET | `/nse/nifty50` | All Nifty 50 stocks live |
| GET | `/nse/market-status` | Market open/closed status |
| GET | `/nse/options/{symbol}?is_index=true` | Option chain |
| GET | `/nse/pcr/{symbol}?is_index=true` | Put-Call Ratio |
| GET | `/nse/iv-surface/{symbol}?is_index=true` | IV surface |

**Symbol format:** `RELIANCE`, `TCS`, `NIFTY`, `BANKNIFTY` (no suffix)
**is_index:** `true` for NIFTY/BANKNIFTY, `false` for stocks

---

### Portfolio Endpoints (`/portfolio/...`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/portfolio` | Get all holdings with live prices |
| GET | `/portfolio/summary` | Total value, P&L, allocation breakdown |
| GET | `/portfolio/top-performers?limit=5` | Top N holdings by daily change |
| GET | `/portfolio/activity?limit=10` | Recent transactions |
| POST | `/portfolio/holding` | Add a new holding |
| PUT | `/portfolio/holding/{symbol}` | Update holding quantity/price |
| DELETE | `/portfolio/holding/{symbol}` | Remove a holding |
| POST | `/portfolio/transaction` | Log a buy/sell/dividend |
| PUT | `/portfolio/cash` | Update cash balance |

**Storage:** JSON file at `data/portfolio.json` (persists across restarts)

---

### Insights Endpoints (`/insights/...`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/insights` | AI-driven insights (mock data) |
| GET | `/insights/risk-score` | Portfolio risk score |
| GET | `/insights/rebalancing` | Rebalancing suggestions |

---

### Investments Page Endpoints (`/investments/...`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/investments/stats` | Top stats (total value, profit, day's change, buying power) |
| GET | `/investments/holdings` | Holdings table with trend sparkline data |
| GET | `/investments/performance?period=1M` | Performance history for chart (1M, 3M, 1Y, ALL) |
| GET | `/investments/breakdown` | Asset breakdown for pie chart |
| GET | `/investments/opportunities` | Investment opportunities (mock) |
| GET | `/investments/alerts` | Portfolio risk alerts |

---

### News Endpoints (`/news/...`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/news` | Get news articles (optional: category, ticker, limit, refresh) |
| POST | `/news/refresh` | Force refresh news from Finnhub API |
| GET | `/news/flashcards` | Lightweight news cards for UI ticker |
| GET | `/news/sentiment` | Aggregated sentiment by category and ticker |
| GET | `/news/ticker/{ticker}` | News for a specific stock ticker |
| GET | `/news/market-intelligence?domain=all` | Market Intelligence Feed for Overview page |

**Query params for `/news`:**
- `category`: macro, equity, commodity, crypto
- `ticker`: Filter by stock symbol
- `limit`: Max articles (default 20)
- `refresh`: Force API refresh (default false)

**Query params for `/news/market-intelligence`:**
- `domain`: all, macro, equity, commodity, crypto (default: all)
- `limit`: Max articles (default 10)

**Requires:** `FINNHUB_API_KEY` in `.env`

**Cache:** Auto-refreshes every 15 minutes. Data stored in `news_data/` folder.

---

### Markets Page Endpoints (`/markets/...`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/markets` | Get all market data for Markets page (indices, chart, sectors, signals, forecasts, assets) |
| GET | `/markets/indices` | Market indices (S&P 500, NASDAQ, BTC, ETH) |
| GET | `/markets/chart?symbol=QQQ` | Candlestick chart data for all periods (1D, 1W, 1M, 1Y) |
| GET | `/markets/sectors` | Sector performance heatmap (computed from sector ETFs) |
| GET | `/markets/signals` | Algorithmic trading signals (computed from RSI, SMA) |
| GET | `/markets/forecasts` | Growth forecasts for sectors (computed from momentum) |
| GET | `/markets/assets?tab=STOCKS` | Asset explorer data (STOCKS, OPTIONS, CRYPTO) |

**All data is computed from yfinance and cached in `portfolio.json` for 5 minutes.**

---

### Portfolio Analysis Endpoints (`/portfolio/...`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/portfolio/analysis` | Get full portfolio analysis for Portfolio page |
| GET | `/portfolio/diversification` | Diversification score (computed from holdings) |
| GET | `/portfolio/allocation` | Current vs target allocation by asset class |
| PUT | `/portfolio/allocation/targets` | Update target allocation percentages |
| GET | `/portfolio/rebalancing` | Rebalancing recommendations (computed from allocation deltas) |
| GET | `/portfolio/strategy` | Current investment strategy |
| PUT | `/portfolio/strategy` | Update investment strategy |
| GET | `/portfolio/strategy/advisor` | Strategy advisor recommendation (computed from portfolio beta) |
| GET | `/portfolio/goals` | Investment goals with progress (computed from portfolio value) |
| PUT | `/portfolio/goals` | Update investment goals |

**All analysis data is computed from holdings and stored in `portfolio.json`.**

---

### Reports Page Endpoints (`/reports/...`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/reports?period=1M&year=2026&month=3` | Full reports payload in one call (summary, calendar, holdings, allocation, sector, tax, dividends, closed positions, doctor, transactions) |
| GET | `/reports/summary?period=1M` | Reports KPI summary (portfolio value, realized/unrealized P&L, dividends, XIRR) |
| GET | `/reports/pl-calendar?year=2026&month=3` | Daily realized P&L calendar for selected month |
| GET | `/reports/active-holdings` | Active holdings report table with buy/current/invested/market/P&L |
| GET | `/reports/asset-allocation` | Asset class distribution for reports page |
| GET | `/reports/sector-exposure` | Sector concentration breakdown by current market value |
| GET | `/reports/tax-summary?fy=2025-26` | Tax liability estimate from realized STCG/LTCG and loss offsets |
| GET | `/reports/dividend-history?limit=20` | Dividend and interest payout history with YTD total |
| GET | `/reports/closed-positions?limit=50` | Closed position trades with realized P&L and annualized return |
| GET | `/reports/portfolio-doctor` | Portfolio doctor insights derived from diversification and allocation analytics |
| GET | `/reports/pdf?period=1M&year=2026&month=3` | Download portfolio report as PDF |
| POST | `/reports/send-email` | Generate PDF and send report to an email address |

**Source:** These endpoints are computed from the user's `data/portfolio.json` holdings and transaction ledger.

**Email env variables required for `/reports/send-email`:**
- `MAIL_USERNAME`
- `MAIL_PASSWORD` (Gmail App Password recommended)
- `MAIL_FROM`
- `MAIL_SERVER` (for Gmail: `smtp.gmail.com`)
- `MAIL_PORT` (for Gmail STARTTLS: `587`)

---

## Response Examples

### `/yf/quote/RELIANCE.NS`
```json
{
  "symbol": "RELIANCE.NS",
  "price": 2450.50,
  "previous_close": 2440.00,
  "open": 2445.00,
  "day_high": 2460.00,
  "day_low": 2435.00,
  "volume": 5000000,
  "market_cap": 16500000000000
}
```

### `/nse/quote/RELIANCE`
```json
{
  "symbol": "RELIANCE",
  "price": 2450.50,
  "open": 2445.00,
  "previous_close": 2440.00,
  "day_high": 2460.00,
  "day_low": 2435.00,
  "week_high": 2600.00,
  "week_low": 2200.00,
  "volume": 5000000,
  "change": 10.50,
  "change_percent": 0.43,
  "industry": "Refineries",
  "isin": "INE002A01018"
}
```

### `/nse/nifty50`
```json
[
  {
    "symbol": "RELIANCE",
    "price": 2450.50,
    "change": 10.50,
    "change_percent": 0.43,
    "volume": 5000000
  },
  ...
]
```

### `/nse/pcr/NIFTY`
```json
{
  "symbol": "NIFTY",
  "pcr": 1.2345,
  "total_call_oi": 10000000,
  "total_put_oi": 12345000
}
```

### `/portfolio`
```json
[
  {
    "symbol": "RELIANCE.NS",
    "quantity": 50,
    "avg_buy_price": 2400.00,
    "current_price": 2450.50,
    "current_value": 122525.00,
    "invested_value": 120000.00,
    "pnl": 2525.00,
    "pnl_percent": 2.10,
    "daily_change": 0.43,
    "asset_type": "equity"
  }
]
```

### `/portfolio/summary`
```json
{
  "total_assets": 650000.00,
  "total_invested": 500000.00,
  "total_current_value": 520000.00,
  "total_pnl": 20000.00,
  "total_pnl_percent": 4.00,
  "cash_balance": 150000.00,
  "dividends_ytd": 1200.00,
  "allocation": {
    "equities": 77.69,
    "cash": 23.08
  },
  "holdings_count": 5
}
```

### `/portfolio/top-performers`
```json
[
  {
    "symbol": "RELIANCE.NS",
    "current_price": 2450.50,
    "daily_change": 1.84
  }
]
```

### `/insights`
```json
[
  {
    "id": "insight_1",
    "type": "research_report",
    "title": "New Research Report: Tech Sector Resilience",
    "summary": "Our analysis indicates enterprise SaaS remains undervalued...",
    "action_label": "READ FULL REPORT",
    "timestamp": "2024-03-28T10:00:00"
  },
  {
    "id": "insight_2",
    "type": "buy_signal",
    "title": "RELIANCE Momentum Alert",
    "summary": "Technical indicators suggest 8% upside potential...",
    "symbol": "RELIANCE.NS",
    "analysts_agree": 7,
    "timestamp": "2024-03-28T07:00:00"
  }
]
```

### `/insights/risk-score`
```json
{
  "score": 4,
  "max_score": 10,
  "label": "Balanced",
  "description": "Based on 5 holdings diversification"
}
```

### `POST /portfolio/holding` (Request Body)
```json
{
  "symbol": "SBIN.NS",
  "quantity": 100,
  "avg_buy_price": 750.00,
  "asset_type": "equity"
}
```

### `POST /portfolio/transaction` (Request Body)
```json
{
  "type": "buy",
  "symbol": "SBIN.NS",
  "quantity": 100,
  "price": 750.00
}
```
Or for dividend:
```json
{
  "type": "dividend",
  "symbol": "ITC.NS",
  "amount": 500.00
}
```

### `/investments/stats`
```json
{
  "total_investment_value": 520000.00,
  "all_time_profit": 20000.00,
  "all_time_profit_percent": 4.00,
  "days_change": 2500.00,
  "days_change_percent": 0.48,
  "buying_power": 150000.00
}
```

### `/investments/holdings`
```json
[
  {
    "symbol": "RELIANCE.NS",
    "ticker": "RELIANCE",
    "name": "RELIANCE",
    "sector": "Energy",
    "shares": 50,
    "cost_basis": 2400.00,
    "current_price": 2450.50,
    "market_value": 122525.00,
    "return_percent": 2.10,
    "return_value": 2525.00,
    "trend": [
      {"date": "2024-03-21", "close": 2420.00},
      {"date": "2024-03-22", "close": 2435.00},
      {"date": "2024-03-25", "close": 2450.50}
    ]
  }
]
```

### `/investments/performance?period=1M`
```json
{
  "period": "1M",
  "data_points": [
    {"date": "2024-02-28", "value": 480000.00},
    {"date": "2024-03-07", "value": 495000.00},
    {"date": "2024-03-14", "value": 510000.00},
    {"date": "2024-03-21", "value": 520000.00}
  ],
  "peak": {
    "value": 520000.00,
    "date": "2024-03-21"
  },
  "growth": 40000.00,
  "growth_percent": 8.33
}
```

### `/investments/breakdown`
```json
{
  "allocation": [
    {"type": "equity", "name": "Stocks", "value": 520000.00, "percentage": 77.61},
    {"type": "cash", "name": "Cash & Equivalents", "value": 150000.00, "percentage": 22.39}
  ],
  "total_value": 670000.00,
  "target_achievement": 77.61
}
```

### `/investments/opportunities`
```json
[
  {
    "id": "opp_1",
    "action": "BUY",
    "symbol": "HDFCBANK.NS",
    "ticker": "HDFCBANK",
    "name": "HDFC Bank Ltd",
    "reason": "Strong fundamentals with consistent earnings growth.",
    "current_price": 1650.00,
    "daily_change": 1.2
  }
]
```

### `/investments/alerts`
```json
[
  {
    "type": "concentration",
    "severity": "warning",
    "title": "Portfolio Risk Alert",
    "message": "Your Energy exposure is currently 45% above recommended allocation.",
    "action": "Rebalance Now"
  }
]
```

### `/news`
```json
[
  {
    "id": "a1b2c3d4e5f6",
    "source": "Finnhub",
    "source_name": "Reuters",
    "headline": "RBI Holds Rates Steady Amid Inflation Concerns",
    "summary": "The Reserve Bank of India maintained its repo rate...",
    "url": "https://...",
    "image": "https://...",
    "category": "macro",
    "sentiment": "neutral",
    "related_tickers": [],
    "tag": "Macro · Policy",
    "tag_class": "tag-blue",
    "published_at": "2024-03-28T10:00:00+00:00",
    "fetched_at": "2024-03-28T12:00:00+00:00"
  }
]
```

### `/news/flashcards`
```json
[
  {
    "id": "a1b2c3d4e5f6",
    "headline": "RBI Holds Rates Steady",
    "summary": "The Reserve Bank of India maintained...",
    "source": "Reuters",
    "category": "macro",
    "sentiment": "neutral",
    "tag": "Macro · Policy",
    "tag_class": "tag-blue",
    "tickers": [],
    "url": "https://...",
    "published_at": "2024-03-28T10:00:00+00:00"
  }
]
```

### `/news/sentiment`
```json
{
  "generated_at": "2024-03-28T12:00:00+00:00",
  "by_category": {
    "macro": {"bullish": 2, "bearish": 1, "neutral": 5, "total": 8},
    "equity": {"bullish": 10, "bearish": 3, "neutral": 12, "total": 25}
  },
  "by_ticker": {
    "RELIANCE.NS": {"bullish": 2, "bearish": 0, "neutral": 3, "total": 5}
  }
}
```

### `POST /news/refresh`
```json
{
  "status": "ok",
  "fetched": 25,
  "total_stored": 50,
  "updated_at": "2024-03-28T12:00:00+00:00"
}
```

### `/markets`
```json
{
  "indices": [
    {"id": "sp500", "label": "S&P 500", "symbol": "^GSPC", "price": 5204.34, "changePercent": 1.24, "barFillPercent": 75},
    {"id": "nasdaq", "label": "NASDAQ", "symbol": "^IXIC", "price": 16428.82, "changePercent": 1.89, "barFillPercent": 83},
    {"id": "btc", "label": "Bitcoin", "symbol": "BTC-USD", "price": 68432, "changePercent": -2.11, "barFillPercent": 33},
    {"id": "eth", "label": "Ethereum", "symbol": "ETH-USD", "price": 3492, "changePercent": 0.45, "barFillPercent": 50}
  ],
  "chart": {
    "symbol": "QQQ",
    "name": "Invesco QQQ Trust Series 1",
    "volatility": 1.4,
    "rsi": 64.2,
    "candles": {
      "1D": [{"date": "2024-03-28T09:30:00", "open": 445.2, "high": 446.1, "low": 444.8, "close": 445.9, "volume": 2500000}],
      "1W": [],
      "1M": [],
      "1Y": []
    }
  },
  "sectors": [
    {"id": "xlk", "label": "Technology", "changePercent": 2.45},
    {"id": "xlv", "label": "Healthcare", "changePercent": -0.82}
  ],
  "signals": [
    {"id": "sig-nvda-entry", "ticker": "NVDA", "signalType": "ENTRY", "status": "CONFIRMED", "description": "RSI at 28.5 indicates oversold.", "icon": "login"}
  ],
  "growthForecasts": [
    {"label": "AI & Semiconductors", "forecastPercent": 12.4, "barWidthPercent": 85}
  ],
  "assets": {
    "STOCKS": [{"id": "aapl", "ticker": "AAPL", "name": "Apple Inc.", "sector": "Technology", "price": 172.62, "changePercent24h": 0.68, "volatility": "Low", "expGrowthPercent": 14.2}],
    "OPTIONS": [],
    "CRYPTO": []
  }
}
```

### `/portfolio/analysis`
```json
{
  "diversification": {
    "score": 85,
    "grade": "EXCELLENT",
    "headline": "Your portfolio is well-defended against market volatility.",
    "body": "Based on your current holdings across 5 sectors and 3 asset classes.",
    "tags": ["LOW RISK", "BALANCED GROWTH"],
    "sectorCount": 5,
    "assetClassCount": 3
  },
  "currentStrategy": {
    "name": "Moderate Growth",
    "description": "Designed for 7–10 year horizons with focus on capital preservation.",
    "ctaLabel": "Change Strategy"
  },
  "allocation": [
    {"id": "domestic-equity", "label": "Domestic Equity", "icon": "trending_up", "currentPercent": 52, "targetPercent": 45, "status": "OVERWEIGHT"},
    {"id": "international-equity", "label": "International Equity", "icon": "language", "currentPercent": 21, "targetPercent": 20, "status": "ALIGNED"},
    {"id": "fixed-income", "label": "Fixed Income", "icon": "account_balance", "currentPercent": 18, "targetPercent": 25, "status": "UNDERWEIGHT"},
    {"id": "cash-alternatives", "label": "Cash & Alternatives", "icon": "savings", "currentPercent": 9, "targetPercent": 10, "status": "ALIGNED"}
  ],
  "rebalancing": [
    {"id": "reb-sell-domestic", "action": "SELL", "title": "Reduce Domestic Equity", "subtitle": "Current overweight by 7% ($14,500)", "amount": 5000, "ctaLabel": "VIEW POSITIONS"}
  ],
  "strategyAdvisor": {
    "label": "Aggressive Growth",
    "rationale": "Your portfolio beta of 1.25 indicates high risk tolerance.",
    "expectedReturnPA": 12.4,
    "riskLevel": "High",
    "horizonYears": "15+ Years",
    "equitySplit": 85,
    "bondSplit": 15
  },
  "goals": [
    {"id": "retirement", "icon": "landscape", "iconBg": "#e5eeff", "iconColor": "#131b2e", "label": "RETIREMENT 2045", "currentValue": 1240000, "targetValue": 3500000, "progressPercent": 35.4, "status": "On Track", "statusColor": "#009668", "progressBarColor": "#000000"}
  ]
}
```

### `/portfolio/diversification`
```json
{
  "score": 85,
  "grade": "EXCELLENT",
  "headline": "Your portfolio is well-defended against market volatility.",
  "body": "Based on your current holdings across 5 sectors and 3 asset classes.",
  "tags": ["LOW RISK", "BALANCED GROWTH"],
  "sectorCount": 5,
  "assetClassCount": 3
}
```

### `/markets/signals`
```json
[
  {
    "id": "sig-nvda-entry",
    "ticker": "NVDA",
    "signalType": "ENTRY",
    "status": "CONFIRMED",
    "description": "RSI at 28.5 indicates oversold. Price near support level $824.50.",
    "icon": "login"
  },
  {
    "id": "sig-tsla-exit",
    "ticker": "TSLA",
    "signalType": "EXIT",
    "status": "WARNING",
    "description": "RSI at 72.3 indicates overbought. Consider taking profits.",
    "icon": "logout"
  }
]
```

### `/news/market-intelligence?domain=equity`
```json
{
  "domain": "equity",
  "items": [
    {
      "id": "a1b2c3d4e5f6",
      "headline": "Yemen's Houthis strike at Israel as attacks on Iran continue",
      "summary": "Yemen's Houthis strike at Israel as attacks on Iran continue Reuters",
      "source": "Reuters",
      "category": "equity",
      "tag": "EQUITY · MARKETS",
      "tagClass": "tag-green",
      "timeLabel": "5h ago",
      "impactLevel": 3,
      "url": "https://..."
    }
  ],
  "counts": {
    "all": 50,
    "macro": 8,
    "equity": 25,
    "commodity": 7,
    "crypto": 10
  }
}
```

---

## Error Handling

All endpoints return errors as:
```json
{
  "error": "error message"
}
```

NSE endpoints may fail if market is closed or session expires (auto-retries 3 times).

---

## CORS

Enabled for all origins (`*`). Frontend can call from any domain.

---

## Dependencies

```bash
uv add package-name   # Add new package
```

Current:
- `fastapi` - Web framework
- `uvicorn[standard]` - ASGI server
- `yfinance` - Yahoo Finance data
- `requests` - HTTP client for NSE

---

## Notes for Frontend

1. **Base URL**: `http://localhost:8000`
2. **Swagger UI**: `http://localhost:8000/docs`
3. **All responses are JSON**
4. **No auth required**
5. **NSE endpoints may be slower** (session warmup)
6. **Use yfinance for historical data**, NSE for real-time Indian data

---

## Changelog

| Date | Change |
|------|--------|
| Initial | Basic setup with health endpoint |
| Update | Added yfinance + NSE data ingestion |
| Update | Added portfolio management + AI insights |
| Update | Added investments page endpoints (stats, holdings, performance, breakdown, opportunities, alerts) |
| Update | Added news endpoints (Finnhub integration) |
| Update | Added markets page endpoints (indices, chart, sectors, signals, forecasts, assets) |
| Update | Added portfolio analysis endpoints (diversification, allocation, rebalancing, strategy, goals) |

---

*Last updated: Auto-generated*
