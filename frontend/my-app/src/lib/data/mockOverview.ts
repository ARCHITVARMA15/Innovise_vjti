import type { OverviewData, AllocationItem, NewsArticle } from '@/lib/types/overview';
import { apiFetch, REVALIDATE } from '@/lib/api/client';
import type {
  RawPortfolioSummary,
  RawTopPerformer,
  RawActivity,
  RawInsight,
  RawRiskScore,
} from '@/lib/api/types';

export const mockOverviewData: OverviewData = {
  portfolio: {
    totalAUM: 4285190,
    totalAUMCents: 42,
    quarterlyChangePercent: 12.4,
    cashFlow: 142000,
    dividendsYTD: 38412,
    riskScore: 4,
    riskLabel: 'Balanced',
    chartPoints: [80, 70, 85, 60, 40, 50, 35, 30, 20],
  },

  allocation: [
    { label: 'Equities (Stocks)',    percentage: 55, colorClass: 'bg-slate-800' },
    { label: 'Fixed Income (Bonds)', percentage: 25, colorClass: 'bg-sky-500' },
    { label: 'Cash & Equivalents',   percentage: 12, colorClass: 'bg-sky-300' },
    { label: 'Alternative / Crypto', percentage: 8,  colorClass: 'bg-slate-400' },
  ],

  holdings: [
    { id: 'aapl',  name: 'Apple Inc.',         ticker: 'AAPL',  price: 192.53, dailyChangePercent:  1.84 },
    { id: 'nvda',  name: 'NVIDIA Corporation',  ticker: 'NVDA',  price: 875.28, dailyChangePercent:  4.12 },
    { id: 'msft',  name: 'Microsoft Corp',      ticker: 'MSFT',  price: 415.10, dailyChangePercent:  0.95 },
    { id: 'googl', name: 'Alphabet Inc.',        ticker: 'GOOGL', price: 158.22, dailyChangePercent: -0.42 },
    { id: 'amzn',  name: 'Amazon.com Inc',       ticker: 'AMZN',  price: 185.07, dailyChangePercent:  1.15 },
  ],

  activity: [
    {
      id: 'act-1',
      type: 'trade',
      title: 'Bought 24 shares of NVDA',
  description: 'Executed at market price ₹868.50',
      timeLabel: 'Yesterday',
      amount: 20844,
    },
    {
      id: 'act-2',
      type: 'trade',
      title: 'Sold 50 shares of AAPL',
  description: 'Executed at limit price ₹192.50',
      timeLabel: 'Yesterday',
      amount: -9625,
    },
    {
      id: 'act-3',
      type: 'trade',
      title: 'Bought 15 shares of MSFT',
  description: 'Executed at market price ₹415.10',
      timeLabel: 'Yesterday',
      amount: 6226,
    },
    {
      id: 'act-4',
      type: 'dividend',
      title: 'Dividend Received: AAPL',
      description: 'Quarterly dividend payment',
      timeLabel: 'Yesterday',
      amount: 412,
    },
  ],

  insights: [
    {
      id: 'ins-1',
      variant: 'report',
      title: 'New Research Report: Tech Sector Resilience',
      description:
        'Our proprietary analysis indicates enterprise SaaS remains undervalued relative to historical cash flow multiples.',
      cta: 'Read Full Report',
    },
    {
      id: 'ins-2',
      variant: 'signal',
      badge: 'Buy Signal',
      title: 'NVDA Momentum Alert',
      description:
        'Regulatory shifts in sovereign AI infrastructure create a 12% upside potential based on adjusted 2024 guidance.',
      analystCount: 9,
    },
    {
      id: 'ins-3',
      variant: 'risk',
      badge: 'Market Risk Alert',
      title: 'Impending Rate Hike Impact',
      description:
        'Liquidity stress testing suggests shifting 15% of bond allocation to short-term treasuries to mitigate duration risk.',
      cta: 'Adjust Allocation',
    },
  ],

  insightsUpdatedAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),

  news: [
    {
      id: 'mock-n1',
      headline: 'Fed Holds Rates Steady Amid Persistent Inflation Concerns',
      summary: 'The Federal Reserve maintained its benchmark interest rate at 5.25–5.50%, citing sticky services inflation. Markets now price in two cuts before year-end.',
      url: 'https://www.reuters.com/markets/us/federal-reserve-interest-rates/',
      image: '',
      source_name: 'Reuters',
      category: 'macro',
      sentiment: 'neutral',
      tag: 'Macro · Policy',
      tag_class: 'tag-blue',
      related_tickers: [],
      published_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    },
    {
      id: 'mock-n2',
      headline: 'NVIDIA Surges 4% on Record Data Center Revenue',
      summary: 'NVDA beat Q1 estimates with data center revenue up 427% YoY. Jensen Huang confirmed Blackwell GPU shipments ahead of schedule, fuelling bullish sentiment.',
      url: 'https://www.bloomberg.com/quote/NVDA:US',
      image: '',
      source_name: 'Bloomberg',
      category: 'equity',
      sentiment: 'bullish',
      tag: 'NVDA · News',
      tag_class: 'tag-green',
      related_tickers: ['NVDA'],
      published_at: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
    },
    {
      id: 'mock-n3',
      headline: 'Bitcoin Retreats 3% as Long-Term Holders Take Profits',
  summary: 'BTC slipped to ₹66,200 as on-chain data shows long-term holders distributing near cycle highs. Analysts see strong support at the ₹63k range.',
      url: 'https://www.coindesk.com/price/bitcoin/',
      image: '',
      source_name: 'CoinDesk',
      category: 'crypto',
      sentiment: 'bearish',
      tag: 'Crypto · Market',
      tag_class: 'tag-amber',
      related_tickers: ['BTC', 'ETH'],
      published_at: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
    },
    {
      id: 'mock-n4',
      headline: 'Reliance Industries Posts Record Q4 Net Profit of ₹21,243 Cr',
      summary: "RIL's retail and Jio segments drove a 7.3% YoY profit growth. The board approved a Rs.10/share dividend and a Rs.10,000 Cr buyback programme.",
      url: 'https://economictimes.indiatimes.com/reliance-industries-ltd/stocks/companyid-13215.cms',
      image: '',
      source_name: 'Economic Times',
      category: 'equity',
      sentiment: 'bullish',
      tag: 'RELIANCE · News',
      tag_class: 'tag-green',
      related_tickers: ['RELIANCE.NS'],
      published_at: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
    },
    {
      id: 'mock-n5',
      headline: 'Crude Oil Drops 2% on Demand Slowdown Fears From China',
      summary: 'Brent crude fell to ₹81.40/bbl after weak Chinese manufacturing PMI data raised demand concerns. Goldman Sachs trimmed its year-end forecast to ₹87.',
      url: 'https://www.ft.com/commodities',
      image: '',
      source_name: 'Financial Times',
      category: 'commodity',
      sentiment: 'bearish',
      tag: 'Commodity',
      tag_class: 'tag-red',
      related_tickers: [],
      published_at: new Date(Date.now() - 18 * 3600 * 1000).toISOString(),
    },
    {
      id: 'mock-n6',
      headline: 'RBI Keeps Repo Rate Unchanged, Shifts Stance to Neutral',
      summary: 'The Reserve Bank of India held the repo rate at 6.5% for the seventh consecutive meeting, but shifted its policy stance from withdrawal to neutral — signalling rate cuts could begin in Q2.',
      url: 'https://www.livemint.com/market/stock-market-news',
      image: '',
      source_name: 'Mint',
      category: 'macro',
      sentiment: 'bullish',
      tag: 'Macro · Policy',
      tag_class: 'tag-blue',
      related_tickers: ['HDFCBANK.NS', 'SBIN.NS'],
      published_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    },
  ] as NewsArticle[],
};

// ─────────────────────────────────────────────────────────────────────────────
// Mapper helpers
// ─────────────────────────────────────────────────────────────────────────────

function mapAllocation(raw: Record<string, number>): AllocationItem[] {
  const colorMap: Record<string, string> = {
    equities: 'bg-slate-800',
    cash:     'bg-sky-300',
    bonds:    'bg-sky-500',
    crypto:   'bg-slate-400',
    others:   'bg-slate-300',
  };
  const labelMap: Record<string, string> = {
    equities: 'Equities (Stocks)',
    cash:     'Cash & Equivalents',
    bonds:    'Fixed Income (Bonds)',
    crypto:   'Alternative / Crypto',
    others:   'Others',
  };
  return Object.entries(raw).map(([key, pct]) => ({
    label:      labelMap[key] ?? key,
    percentage: pct,
    colorClass: colorMap[key] ?? 'bg-slate-400',
  }));
}

function mapActivityType(raw: string): 'trade' | 'news' | 'dividend' | 'alert' {
  if (raw === 'buy' || raw === 'sell') return 'trade';
  if (raw === 'dividend') return 'dividend';
  if (raw === 'news') return 'news';
  return 'alert';
}

function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs} hr${hrs > 1 ? 's' : ''} ago`;
  return 'Yesterday';
}

function mapInsightVariant(type: string): 'report' | 'signal' | 'risk' {
  if (type === 'buy_signal')     return 'signal';
  if (type === 'risk_alert')     return 'risk';
  return 'report';
}

// ─────────────────────────────────────────────────────────────────────────────
// Data-fetching function — calls real backend, falls back to mock on error
// ─────────────────────────────────────────────────────────────────────────────

export async function getOverviewData(): Promise<OverviewData> {
  try {
    // Parallel fetch all required endpoints (no-store for portfolio data so buy/sell changes reflect immediately)
    const [summary, performers, activity, insights, riskScore] = await Promise.all([
      apiFetch<RawPortfolioSummary>('/portfolio/summary', { cache: 'no-store' }),
      apiFetch<RawTopPerformer[]>('/portfolio/top-performers?limit=5', { cache: 'no-store' }),
      apiFetch<RawActivity[]>('/portfolio/activity?limit=10', { cache: 'no-store' }),
      apiFetch<RawInsight[]>('/insights', { revalidate: REVALIDATE.SLOW }),
      apiFetch<RawRiskScore>('/insights/risk-score', { revalidate: REVALIDATE.SLOW }),
    ]);

    // News fetched independently — never blocks other data, falls back to mock if empty
    let rawNews: NewsArticle[] = [];
    try {
      const fetched = await apiFetch<NewsArticle[]>('/news?limit=6&refresh=false', { cache: 'no-store' });
      rawNews = Array.isArray(fetched) && fetched.length > 0 ? fetched : mockOverviewData.news;
    } catch {
      rawNews = mockOverviewData.news;
    }

    return {
      portfolio: {
        totalAUM:               summary.total_current_value,
        totalAUMCents:          Math.round((summary.total_current_value % 1) * 100),
        quarterlyChangePercent: summary.total_pnl_percent,
        cashFlow:               summary.total_pnl,
        dividendsYTD:           summary.dividends_ytd,
        riskScore:              riskScore.score,
        riskLabel:              riskScore.label,
        chartPoints:            [80, 70, 85, 60, 40, 50, 35, 30, 20], // static decorative
      },

      allocation: mapAllocation(summary.allocation),

      holdings: performers.map(p => ({
        id:                 p.symbol,
        name:               p.symbol.replace('.NS', ''),
        ticker:             p.symbol.replace('.NS', ''),
        price:              p.current_price,
        dailyChangePercent: p.daily_change,
      })),

      activity: (activity && activity.length > 0 ? activity : mockOverviewData.activity as any[]).map((a, i) => ({
        id:          a.id ?? `activity-${i}-${a.title?.slice(0, 10) ?? i}`,
        type:        a.type ? mapActivityType(a.type) : a.type,
        title:       a.title,
        description: a.description,
        timeLabel:   a.timestamp ? relativeTime(a.timestamp) : (a.timeLabel || 'Recently'),
        amount:      a.amount ?? (a as any).amount,
        date:        a.date ?? (a as any).date,
        time:        a.time ?? (a as any).time,
      })),

      insights: insights.map((ins, i) => ({
        id:            ins.id ?? `insight-${i}-${ins.type ?? i}`,
        variant:       mapInsightVariant(ins.type),
        badge:         ins.type === 'buy_signal' ? 'Buy Signal' : ins.type === 'risk_alert' ? 'Market Risk Alert' : undefined,
        title:         ins.title,
        description:   ins.summary,
        cta:           ins.action_label,
        analystCount:  ins.analysts_agree,
      })),

      insightsUpdatedAt: insights[0]?.timestamp ?? new Date().toISOString(),

      news: (rawNews.length > 0 ? rawNews : mockOverviewData.news).map((n, i) => ({
        id:              n.id ?? `news-${i}`,
        headline:        n.headline,
        summary:         n.summary,
        url:             n.url ?? '#',
        image:           n.image ?? '',
        source_name:     n.source_name ?? '',
        category:        n.category ?? 'equity',
        sentiment:       n.sentiment ?? 'neutral',
        tag:             n.tag ?? 'Markets',
        tag_class:       n.tag_class ?? 'tag-gray',
        related_tickers: n.related_tickers ?? [],
        published_at:    n.published_at ?? new Date().toISOString(),
      })),
    };
  } catch (err) {
    console.warn('[Overview] Backend unavailable, using mock data:', (err as Error).message);
    return mockOverviewData;
  }
}
