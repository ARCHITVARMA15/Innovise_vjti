// ─── Portfolio Summary ────────────────────────────────────────────────────────

export interface PortfolioSummary {
  totalAUM: number;           // e.g. 4285190.42
  totalAUMCents: number;      // fractional cents portion, e.g. 42
  quarterlyChangePercent: number; // e.g. 12.4
  cashFlow: number;
  dividendsYTD: number;
  riskScore: number;          // 1–10
  riskLabel: string;          // e.g. "Balanced"
  chartPoints: number[];      // normalized Y values for sparkline (0–100)
}

// ─── Asset Allocation ────────────────────────────────────────────────────────

export interface AllocationItem {
  label: string;              // e.g. "Equities (Stocks)"
  percentage: number;         // e.g. 55
  colorClass: string;         // tailwind bg color class
}

// ─── Holdings ─────────────────────────────────────────────────────────────────

export interface Holding {
  id: string;
  name: string;               // e.g. "Apple Inc."
  ticker: string;             // e.g. "AAPL"
  price: number;              // e.g. 192.53
  dailyChangePercent: number; // e.g. 1.84 (positive = gain, negative = loss)
}

// ─── Recent Activity ─────────────────────────────────────────────────────────

export type ActivityType = 'trade' | 'news' | 'dividend' | 'alert';

export interface ActivityItem {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  timeLabel: string;          // e.g. "2 hours ago"
  amount?: number;            // Transaction amount (for trade type)
  date?: string;              // Transaction date
  time?: string;              // Transaction time
}

// ─── AI Insights ─────────────────────────────────────────────────────────────

export type InsightVariant = 'report' | 'signal' | 'risk';

export interface AIInsight {
  id: string;
  variant: InsightVariant;
  badge?: string;             // e.g. "Buy Signal", "Market Risk Alert"
  title: string;
  description: string;
  cta?: string;               // button label
  analystCount?: number;      // e.g. 9
}

// ─── News Article ─────────────────────────────────────────────────────────────
// Aligned with GET /news response shape from news_service.py

export type NewsSentiment = 'bullish' | 'bearish' | 'neutral';
export type NewsCategory  = 'macro' | 'equity' | 'crypto' | 'commodity';

export interface NewsArticle {
  id: string;                   // md5 hash of headline+source
  headline: string;
  summary: string;
  url: string;
  image: string;
  source_name: string;
  category: NewsCategory;
  sentiment: NewsSentiment;
  tag: string;                  // e.g. "Macro · Policy"
  tag_class: string;            // e.g. "tag-blue"
  related_tickers: string[];
  published_at: string;         // ISO date string
}

// ─── Full Overview Payload ─────────────────────────────────────────────────────

export interface OverviewData {
  portfolio: PortfolioSummary;
  allocation: AllocationItem[];
  holdings: Holding[];
  activity: ActivityItem[];
  insights: AIInsight[];
  insightsUpdatedAt: string;
  news: NewsArticle[];
}
