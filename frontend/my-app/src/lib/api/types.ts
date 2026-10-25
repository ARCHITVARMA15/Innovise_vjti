// ─── Raw backend response shapes ─────────────────────────────────────────────
// These match exactly what the FastAPI endpoints return (backend_doc.md).
// Do NOT use these directly in components — always go through the mapper layer.
// ─────────────────────────────────────────────────────────────────────────────

// GET /portfolio/summary
export interface RawPortfolioSummary {
  total_assets: number;
  total_invested: number;
  total_current_value: number;
  total_pnl: number;
  total_pnl_percent: number;
  cash_balance: number;
  dividends_ytd: number;
  allocation: Record<string, number>;   // e.g. { equities: 77.69, cash: 23.08 }
  holdings_count: number;
}

// GET /portfolio/top-performers
export interface RawTopPerformer {
  symbol: string;
  current_price: number;
  daily_change: number;   // percent
}

// GET /portfolio/activity
export interface RawActivity {
  id: string;
  type: 'buy' | 'sell' | 'dividend' | 'news' | 'alert';
  title: string;
  description: string;
  timestamp: string;      // ISO string
}

// GET /insights
export interface RawInsight {
  id: string;
  type: 'research_report' | 'buy_signal' | 'risk_alert';
  title: string;
  summary: string;
  action_label?: string;
  symbol?: string;
  analysts_agree?: number;
  timestamp: string;
}

// GET /insights/risk-score
export interface RawRiskScore {
  score: number;
  max_score: number;
  label: string;
  description: string;
}

// GET /investments/stats
export interface RawInvestmentStats {
  total_investment_value: number;
  all_time_profit: number;
  all_time_profit_percent: number;
  days_change: number;
  days_change_percent: number;
  buying_power: number;
}

// GET /investments/performance?period=1M
export interface RawPerformancePoint {
  date: string;
  value: number;
}
export interface RawPerformance {
  period: string;
  data_points: RawPerformancePoint[];
  peak: { value: number; date: string };
  growth: number;
  growth_percent: number;
}

// GET /investments/breakdown
export interface RawBreakdownItem {
  type: string;
  name: string;
  value: number;
  percentage: number;
}
export interface RawBreakdown {
  allocation: RawBreakdownItem[];
  total_value: number;
  target_achievement: number;
}

// GET /investments/holdings
export interface RawTrendPoint {
  date: string;
  close: number;
}
export interface RawHolding {
  symbol: string;
  ticker: string;
  name: string;
  sector: string;
  shares: number;
  cost_basis: number;
  current_price: number;
  market_value: number;
  return_percent: number;
  return_value: number;
  trend: RawTrendPoint[];
}

// GET /investments/opportunities
export interface RawOpportunity {
  id: string;
  action: 'BUY' | 'WATCH' | 'SELL';
  symbol: string;
  ticker: string;
  name: string;
  reason: string;
  current_price: number;
  daily_change: number;
}

// GET /investments/alerts
export interface RawAlert {
  type: string;
  severity: string;
  title: string;
  message: string;
  action: string;
}
