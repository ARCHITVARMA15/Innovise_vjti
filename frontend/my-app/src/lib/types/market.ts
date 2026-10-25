// ─── Market Page Types ────────────────────────────────────────────────────────
// Backend alignment (base URL: http://localhost:8000):
//
// IndexCard      → GET /yf/index/{symbol}       e.g. ^GSPC, ^IXIC
//               → GET /yf/quote/{symbol}        for BTC-USD, ETH-USD
// CandleChart    → GET /yf/history/{symbol}?period=1mo&interval=1d  (OHLCV)
//               → period maps: 1D→1d/5m, 1W→5d/1h, 1M→1mo/1d, 1Y→1y/1wk
// SectorHeatmap  → GET /yf/batch-quotes (POST)  for sector ETFs, or fundamentals
// AlgoSignals    → derived/computed server-side (own backend logic)
// GrowthForecast → derived/computed server-side (own backend logic)
// AssetExplorer  → POST /yf/batch-quotes        for stocks tab
//               → GET /yf/options/{symbol}      for options tab
//               → GET /yf/quote/{symbol}        for crypto tab (BTC-USD, ETH-USD)
// ─────────────────────────────────────────────────────────────────────────────

// ─── Index Overview Cards ─────────────────────────────────────────────────────
// Maps to /yf/index/{symbol} response shape

export interface MarketIndex {
  id: string;
  label: string;         // e.g. "S&P 500"
  symbol: string;        // e.g. "^GSPC" — passed to /yf/index/{symbol}
  price: number;
  changePercent: number; // positive = up, negative = down
  barFillPercent: number;// 0–100 for decorative progress bar
}

// ─── Candle Chart ─────────────────────────────────────────────────────────────
// Maps to /yf/history/{symbol} OHLCV response

export type ChartPeriod = '1D' | '1W' | '1M' | '1Y';

// Maps ChartPeriod → backend period + interval params
export const PERIOD_PARAMS: Record<ChartPeriod, { period: string; interval: string }> = {
  '1D': { period: '1d',  interval: '5m'  },
  '1W': { period: '5d',  interval: '1h'  },
  '1M': { period: '1mo', interval: '1d'  },
  '1Y': { period: '1y',  interval: '1wk' },
};

export interface CandlePoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ChartAsset {
  symbol: string;        // e.g. "QQQ"
  name: string;          // e.g. "Invesco QQQ Trust Series 1"
  volatility: number;    // e.g. 1.4 (%)
  rsi: number;           // e.g. 64.2
  candles: Record<ChartPeriod, CandlePoint[]>;
}

// ─── Sector Heatmap ───────────────────────────────────────────────────────────

export interface SectorItem {
  id: string;
  label: string;         // e.g. "Technology"
  changePercent: number; // positive or negative
}

// ─── Algorithmic Signals ──────────────────────────────────────────────────────

export type SignalType = 'ENTRY' | 'EXIT' | 'ACCUMULATE' | 'HOLD';
export type SignalStatus = 'CONFIRMED' | 'WARNING' | 'NEUTRAL';

export interface AlgoSignal {
  id: string;
  ticker: string;        // e.g. "NVDA"
  signalType: SignalType;
  status: SignalStatus;
  description: string;
  icon: string;          // material symbol
}

// ─── Q3 Growth Forecast ───────────────────────────────────────────────────────

export interface GrowthForecastItem {
  label: string;         // e.g. "AI Hardware"
  forecastPercent: number; // e.g. 12.4
  barWidthPercent: number; // 0–100 for bar width
}

// ─── Asset Explorer ───────────────────────────────────────────────────────────
// Maps to POST /yf/batch-quotes response (stocks)
// or GET /yf/quote/{symbol} per asset

export type AssetTab = 'STOCKS' | 'OPTIONS' | 'CRYPTO';
export type VolatilityLevel = 'Low' | 'Medium' | 'High';

export interface AssetRow {
  id: string;
  ticker: string;
  name: string;
  sector: string;
  price: number;
  changePercent24h: number;
  volatility: VolatilityLevel;
  expGrowthPercent: number;
  // Backend: GET /yf/quote/{ticker} → price, changePercent24h
  // Backend: GET /yf/fundamentals/{ticker} → sector, expGrowthPercent
}

// ─── Full Market Page Payload ─────────────────────────────────────────────────

export interface MarketData {
  indices: MarketIndex[];
  chart: ChartAsset;
  sectors: SectorItem[];
  signals: AlgoSignal[];
  growthForecasts: GrowthForecastItem[];
  assets: Record<AssetTab, AssetRow[]>;
}
