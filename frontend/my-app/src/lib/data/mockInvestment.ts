import type { InvestmentData, HistoryPeriod, OHLCVPoint } from '@/lib/types/investment';
import { apiFetch, REVALIDATE } from '@/lib/api/client';
import { getMockPerformanceHistory } from '@/lib/utils/performanceMockData';
import type {
  RawInvestmentStats,
  RawPerformance,
  RawBreakdown,
  RawHolding,
  RawOpportunity,
  RawAlert,
} from '@/lib/api/types';

// Sparklines: normalized Y values (0–20 scale, lower = higher on chart)
const SPARKLINE_UP    = [15, 12, 14, 10, 12, 8, 10, 5, 7, 2, 5];
const SPARKLINE_UP2   = [10, 12, 8, 9, 5, 2];
const SPARKLINE_DOWN  = [5, 10, 8, 15, 12, 18];

// Build OHLCV chart points for different periods (mock price series)
function buildHistory(base: number, count: number, trend: 'up' | 'wave') {
  return Array.from({ length: count }, (_, i) => {
    const progress = i / count;
    const noise = (Math.sin(i * 1.5) * 0.03 + Math.random() * 0.02 - 0.01);
    const trendFactor = trend === 'up' ? progress * 0.15 : Math.sin(progress * Math.PI) * 0.1;
    const close = base * (1 + trendFactor + noise);
    return {
      date: new Date(Date.now() - (count - i) * 24 * 60 * 60 * 1000).toISOString(),
      open: close * 0.998,
      high: close * 1.005,
      low: close * 0.993,
      close,
      volume: Math.floor(Math.random() * 5_000_000 + 1_000_000),
    };
  });
}

export const mockInvestmentData: InvestmentData = {
  summary: {
    totalValue: 1248650.42,
    allTimeProfitAbs: 138402,
    allTimeProfitPercent: 12.4,
    dayChangeAbs: 8420.12,
    dayChangePercent: 0.68,
    buyingPower: 42190.50,
  },

  history: {
    '1M':  { period: '1M',  points: buildHistory(1_100_000, 22,  'wave'), peakValue: 1_280_000 },
    '3M':  { period: '3M',  points: buildHistory(1_050_000, 65,  'up'),   peakValue: 1_280_000 },
    '1Y':  { period: '1Y',  points: buildHistory(900_000,   252, 'up'),   peakValue: 1_280_000 },
    'ALL': { period: 'ALL', points: buildHistory(700_000,   500, 'up'),   peakValue: 1_280_000 },
  },

  breakdown: {
    targetPercent: 94.2,
    items: [
      { label: 'Stocks',       percentage: 65, color: '#000000' },
      { label: 'Mutual Funds', percentage: 25, color: '#006591' },
      { label: 'Bonds',        percentage: 10, color: '#39b8fd' },
    ],
  },

  holdings: [
    {
      id: 'aapl',
      ticker: 'AAPL',
      name: 'Apple Inc.',
      sector: 'Technology',
      shares: 450,
      costBasis: 162.40,
      currentPrice: 194.22,
      marketValue: 87399.00,
      returnPercent: 19.6,
      sparkline: SPARKLINE_UP,
    },
    {
      id: 'voo',
      ticker: 'VOO',
      name: 'Vanguard S&P 500',
      sector: 'ETF / Index',
      shares: 820,
      costBasis: 380.15,
      currentPrice: 432.10,
      marketValue: 354322.00,
      returnPercent: 13.7,
      sparkline: SPARKLINE_UP2,
    },
    {
      id: 'tsla',
      ticker: 'TSLA',
      name: 'Tesla, Inc.',
      sector: 'Automotive',
      shares: 110,
      costBasis: 215.00,
      currentPrice: 176.54,
      marketValue: 19419.40,
      returnPercent: -17.9,
      sparkline: SPARKLINE_DOWN,
    },
  ],

  opportunities: [
    {
      id: 'hdfc',
      ticker: 'HDFCBANK.NS',
      name: 'HDFC Bank Ltd',
      signal: 'BUY',
      description: 'Strong fundamentals with consistent earnings growth. Recent correction provides entry opportunity.',
      currentPrice: 756.20,
      dayChangePercent: -3.1,
    },
    {
      id: 'wipro',
      ticker: 'WIPRO.NS',
      name: 'Wipro Ltd',
      signal: 'WATCH',
      description: 'IT sector showing recovery signs. Wait for breakout above resistance.',
      currentPrice: 191.60,
      dayChangePercent: 1.4,
    },
    {
      id: 'tatamotors',
      ticker: 'TATAMOTORS.NS',
      name: 'Tata Motors Ltd',
      signal: 'BUY',
      description: 'EV segment growth accelerating. Strong order book for JLR.',
      currentPrice: 950.00,
      dayChangePercent: 2.1,
    },
  ],

  riskAlert: {
    title: 'Portfolio Risk Alert',
    description: 'Your tech exposure is currently 15% above your target allocation.',
    ctaLabel: 'Rebalance Now',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Mapper helpers
// ─────────────────────────────────────────────────────────────────────────────

// Map backend performance data points → OHLCVPoint array the chart expects
function mapPerformanceToOHLCV(raw: RawPerformance): OHLCVPoint[] {
  return raw.data_points.map(pt => ({
    date:   pt.date,
    open:   pt.value * 0.998,
    high:   pt.value * 1.002,
    low:    pt.value * 0.996,
    close:  pt.value,
    volume: 0,
  }));
}

// Map backend trend data (close prices) → normalized sparkline (0–20 scale)
// Lower number = higher on chart (SVG inverted Y axis)
function mapTrendToSparkline(trend: { date: string; close: number }[]): number[] {
  if (!trend || trend.length === 0) return [10, 10, 10];
  const closes = trend.map(t => t.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;
  return closes.map(c => 20 - Math.round(((c - min) / range) * 18));
}

// Choose a consistent color for breakdown items based on type
function breakdownColor(type: string): string {
  const colors: Record<string, string> = {
    equity: '#000000',
    cash:   '#39b8fd',
    bonds:  '#006591',
    mutual_fund: '#4edea3',
  };
  return colors[type] ?? '#94a3b8';
}

// ─────────────────────────────────────────────────────────────────────────────
// Data-fetching function — calls real backend, falls back to mock on error
// ─────────────────────────────────────────────────────────────────────────────

export async function getInvestmentData(): Promise<InvestmentData> {
  try {
    // Parallel fetch all investment endpoints (except performance - using mock data for now)
    const [stats, holdings, breakdown, opportunities, alerts] = await Promise.all([
      apiFetch<RawInvestmentStats>('/investments/stats',         { revalidate: 0 }),
      apiFetch<RawHolding[]>('/investments/holdings',            { revalidate: 0 }),
      apiFetch<RawBreakdown>('/investments/breakdown',           { revalidate: 0 }),
      apiFetch<RawOpportunity[]>('/investments/opportunities',   { revalidate: 0 }),
      apiFetch<RawAlert[]>('/investments/alerts',                { revalidate: 0 }),
    ]);

    // Use mock performance data with realistic fluctuations
    const mockHistory = getMockPerformanceHistory(stats.total_investment_value);

    return {
      summary: {
        totalValue:           stats.total_investment_value,
        allTimeProfitAbs:     stats.all_time_profit,
        allTimeProfitPercent: stats.all_time_profit_percent,
        dayChangeAbs:         stats.days_change,
        dayChangePercent:     stats.days_change_percent,
        buyingPower:          stats.buying_power,
      },

      history: mockHistory,

      breakdown: {
        targetPercent: breakdown.target_achievement,
        items: breakdown.allocation.map(item => ({
          label:      item.name,
          percentage: item.percentage,
          color:      breakdownColor(item.type),
        })),
      },

      holdings: holdings.map(h => ({
        id:           h.symbol,
        ticker:       h.ticker,
        name:         h.name,
        sector:       h.sector,
        shares:       h.shares,
        costBasis:    h.cost_basis,
        currentPrice: h.current_price,
        marketValue:  h.market_value,
        returnPercent: h.return_percent,
        sparkline:    mapTrendToSparkline(h.trend),
      })),

      opportunities: opportunities.map(opp => ({
        id:             opp.id,
        ticker:         opp.ticker,
        name:           opp.name,
        signal:         opp.action,
        description:    opp.reason,
        currentPrice:   opp.current_price,
        dayChangePercent: opp.daily_change,
      })),

      riskAlert: alerts.length > 0 ? {
        title:       alerts[0].title,
        description: alerts[0].message,
        ctaLabel:    alerts[0].action,
      } : mockInvestmentData.riskAlert,
    };
  } catch (err) {
    console.warn('[Investment] Backend unavailable, using mock data:', (err as Error).message);
    return mockInvestmentData;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Low-level helpers (still usable directly if needed)
// ─────────────────────────────────────────────────────────────────────────────

export async function getLiveQuote(symbol: string) {
  return apiFetch(`/yf/quote/${symbol}`, { revalidate: REVALIDATE.LIVE });
}

export async function getHistory(symbol: string, period: HistoryPeriod = '1M') {
  const periodMap: Record<HistoryPeriod, string> = {
    '1M': '1mo', '3M': '3mo', '1Y': '1y', 'ALL': 'max',
  };
  return apiFetch(
    `/yf/history/${symbol}?period=${periodMap[period]}&interval=1d`,
    { revalidate: REVALIDATE.HISTORY },
  );
}
