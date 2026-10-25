// ─── Investment Page Types ─────────────────────────────────────────────────────
// Aligned with backend API responses from backend_doc.md
// Quote data: /yf/quote/{symbol} or /nse/quote/{symbol}
// History data: /yf/history/{symbol}?period=1mo&interval=1d
// Batch quotes: POST /yf/batch-quotes

// ─── Hero Stats ───────────────────────────────────────────────────────────────

export interface InvestmentSummary {
  totalValue: number;           // e.g. 1248650.42
  allTimeProfitAbs: number;     // e.g. 138402
  allTimeProfitPercent: number; // e.g. 12.4
  dayChangeAbs: number;         // e.g. 8420.12
  dayChangePercent: number;     // e.g. 0.68
  buyingPower: number;          // e.g. 42190.50
}

// ─── Performance History ──────────────────────────────────────────────────────
// Maps to /yf/history/{symbol} response OHLCV shape

export type HistoryPeriod = '1M' | '3M' | '1Y' | 'ALL';

export interface OHLCVPoint {
  date: string;    // ISO date string
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PerformanceHistory {
  period: HistoryPeriod;
  points: OHLCVPoint[];
  peakValue: number;
}

// ─── Asset Breakdown ──────────────────────────────────────────────────────────

export interface AssetBreakdownItem {
  label: string;        // e.g. "Stocks"
  percentage: number;   // e.g. 65
  color: string;        // hex color for SVG arc
}

export interface AssetBreakdown {
  targetPercent: number;        // e.g. 94.2
  items: AssetBreakdownItem[];
}

// ─── Holdings ─────────────────────────────────────────────────────────────────
// Enriched with /yf/quote/{symbol} for live price
// Cost basis and shares are portfolio-specific data

export interface Holding {
  id: string;
  ticker: string;           // e.g. "AAPL"
  name: string;             // e.g. "Apple Inc."
  sector: string;           // e.g. "Technology"
  shares: number;
  costBasis: number;        // avg cost per share
  currentPrice: number;     // from /yf/quote/{symbol} → price
  marketValue: number;      // shares * currentPrice
  returnPercent: number;    // ((currentPrice - costBasis) / costBasis) * 100
  sparkline: number[];      // normalized 0–20 Y values for mini SVG trend line
  // Backend swap note: fetch currentPrice from GET /yf/quote/{ticker}
  // sparkline from GET /yf/history/{ticker}?period=1mo&interval=1d (close values)
}

// ─── Opportunities ────────────────────────────────────────────────────────────
// Enriched with /yf/quote/{symbol} for live price + dayChangePercent
// or /yf/recommendations/{symbol} for analyst signal

export type OpportunitySignal = 'BUY' | 'WATCH' | 'SELL';

export interface Opportunity {
  id: string;
  ticker: string;
  name: string;
  signal: OpportunitySignal;
  description: string;
  currentPrice: number;     // from /yf/quote/{ticker} → price
  dayChangePercent: number; // from /yf/quote/{ticker} → change_percent
  // Backend swap: GET /yf/quote/{ticker} for price/change, GET /yf/recommendations/{ticker} for signal
}

export interface PortfolioRiskAlert {
  title: string;
  description: string;
  ctaLabel: string;
}

// ─── Full Investment Page Payload ─────────────────────────────────────────────
// This is the aggregated shape your page expects.
// In production, compose this from multiple API calls:
// - summary: aggregate from holdings
// - history: GET /yf/history/{portfolio_symbol}?period=...
// - breakdown: computed from holdings categories
// - holdings: POST /yf/batch-quotes with all tickers → merge with portfolio DB
// - opportunities: GET /yf/recommendations/{symbol} + /yf/quote/{symbol}

export interface InvestmentData {
  summary: InvestmentSummary;
  history: Record<HistoryPeriod, PerformanceHistory>;
  breakdown: AssetBreakdown;
  holdings: Holding[];
  opportunities: Opportunity[];
  riskAlert: PortfolioRiskAlert;
}
