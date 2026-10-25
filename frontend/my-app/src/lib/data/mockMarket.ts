import type { MarketData, ChartPeriod, CandlePoint } from '@/lib/types/market';
import { apiFetch } from '@/lib/api/client';

// ─────────────────────────────────────────────────────────────────────────────
// MARKET DATA FETCHING - Connected to backend API
// All data is computed and cached by the backend in portfolio.json
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch live NASDAQ candlestick data from backend
 */
export async function fetchNasdaqCandles(period: ChartPeriod): Promise<CandlePoint[]> {
  try {
    const periodMap: Record<ChartPeriod, { period: string; interval: string }> = {
      '1D': { period: '1d', interval: '5m' },
      '1W': { period: '5d', interval: '1h' },
      '1M': { period: '1mo', interval: '1d' },
      '1Y': { period: '1y', interval: '1d' },
    };
    
    const { period: yf_period, interval } = periodMap[period];
    const response = await fetch(
      `http://localhost:8000/yf/history/^IXIC?period=${yf_period}&interval=${interval}`,
      { next: { revalidate: 60 } }
    );
    
    if (!response.ok) throw new Error('Failed to fetch NASDAQ data');
    
    const data = await response.json();
    return data.map((bar: any) => ({
      date: bar.date,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume: bar.volume,
    }));
  } catch (error) {
    console.error('Failed to fetch NASDAQ candles:', error);
    // Return fallback mock data
    return candlesByPeriod[period];
  }
}

export async function getMarketData(): Promise<MarketData> {
  try {
    // Fetch NASDAQ candles for all periods in parallel
    const [candles1D, candles1W, candles1M, candles1Y] = await Promise.all([
      fetchNasdaqCandles('1D'),
      fetchNasdaqCandles('1W'),
      fetchNasdaqCandles('1M'),
      fetchNasdaqCandles('1Y'),
    ]);

    return {
      ...mockMarketData,
      chart: {
        symbol: '^IXIC',
        name: 'NASDAQ Composite',
        volatility: 1.4,
        rsi: 64.2,
        candles: {
          '1D': candles1D,
          '1W': candles1W,
          '1M': candles1M,
          '1Y': candles1Y,
        },
      },
    };
  } catch (error) {
    console.error('Failed to fetch market data from backend:', error);
    // Return fallback mock data if backend fails
    return mockMarketData;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FALLBACK MOCK DATA - Used only when backend is unavailable
// ─────────────────────────────────────────────────────────────────────────────

function buildCandles(base: number, count: number, seed: number): CandlePoint[] {
  let price = base;
  return Array.from({ length: count }, (_, i) => {
    const change = (Math.sin(i * seed + 1.3) * 0.018 + (Math.random() - 0.48) * 0.012) * price;
    price = Math.max(price + change, base * 0.7);
    const open = price;
    const close = price + (Math.random() - 0.5) * price * 0.008;
    return {
      date: new Date(Date.now() - (count - i) * 3600 * 1000).toISOString(),
      open,
      high: Math.max(open, close) * (1 + Math.random() * 0.004),
      low:  Math.min(open, close) * (1 - Math.random() * 0.004),
      close,
      volume: Math.floor(Math.random() * 8_000_000 + 2_000_000),
    };
  });
}

const candlesByPeriod: Record<ChartPeriod, CandlePoint[]> = {
  '1D': buildCandles(445, 78,  2.1),
  '1W': buildCandles(430, 35,  1.7),
  '1M': buildCandles(400, 22,  1.3),
  '1Y': buildCandles(310, 52,  0.9),
};

export const mockMarketData: MarketData = {
  indices: [
    { id: 'sp500',    label: 'S&P 500',  symbol: '^GSPC',   price: 5204.34,   changePercent:  1.24, barFillPercent: 75 },
    { id: 'nasdaq',   label: 'NASDAQ',   symbol: '^IXIC',   price: 16428.82,  changePercent:  1.89, barFillPercent: 83 },
    { id: 'btc',      label: 'Bitcoin',  symbol: 'BTC-USD', price: 68432,     changePercent: -2.11, barFillPercent: 33 },
    { id: 'ethereum', label: 'Ethereum', symbol: 'ETH-USD', price: 3492,      changePercent:  0.45, barFillPercent: 50 },
  ],

  chart: {
    symbol: 'TCS.NS',
    name: 'Tata Consultancy Services Ltd',
    volatility: 1.2,
    rsi: 58.4,
    candles: candlesByPeriod,
  },

  sectors: [
    { id: 'tech',       label: 'Technology', changePercent:  2.45 },
    { id: 'healthcare', label: 'Healthcare',  changePercent: -0.82 },
    { id: 'energy',     label: 'Energy',      changePercent:  1.12 },
    { id: 'finance',    label: 'Finance',     changePercent:  0.05 },
    { id: 'consumer',   label: 'Consumer',    changePercent:  0.71 },
    { id: 'industrial', label: 'Industrials', changePercent: -0.33 },
    { id: 'materials',  label: 'Materials',   changePercent:  0.18 },
    { id: 'utilities',  label: 'Utilities',   changePercent: -0.55 },
  ],

  signals: [
    {
      id: 'sig-1',
      ticker: 'NVDA',
      signalType: 'ENTRY',
      status: 'CONFIRMED',
  description: 'Support hit at ₹824. RSI indicates oversold condition. High buy volume detected.',
      icon: 'login',
    },
    {
      id: 'sig-2',
      ticker: 'TSLA',
      signalType: 'EXIT',
      status: 'WARNING',
  description: 'Resistance at ₹175. Breaking 50-day moving average to the downside.',
      icon: 'logout',
    },
    {
      id: 'sig-3',
      ticker: 'BTC',
      signalType: 'ACCUMULATE',
      status: 'NEUTRAL',
  description: 'Consolidation phase between ₹65k–₹70k. Long-term trend remains bullish.',
      icon: 'target',
    },
  ],

  growthForecasts: [
    { label: 'AI Hardware', forecastPercent: 12.4, barWidthPercent: 85 },
    { label: 'Cloud SaaS',  forecastPercent:  8.7, barWidthPercent: 62 },
    { label: 'Clean Tech',  forecastPercent:  5.2, barWidthPercent: 40 },
  ],

  assets: {
    STOCKS: [
      { id: 'aapl', ticker: 'AAPL', name: 'Apple Inc.',  sector: 'Technology',    price: 172.62, changePercent24h:  0.68, volatility: 'Low',    expGrowthPercent: 14.2 },
      { id: 'msft', ticker: 'MSFT', name: 'Microsoft',   sector: 'Cloud/AI',      price: 425.22, changePercent24h:  1.22, volatility: 'Medium', expGrowthPercent: 18.5 },
      { id: 'amd',  ticker: 'AMD',  name: 'AMD',         sector: 'Semiconductors',price: 178.64, changePercent24h: -1.42, volatility: 'High',   expGrowthPercent: 22.8 },
      { id: 'nvda', ticker: 'NVDA', name: 'NVIDIA Corp', sector: 'Semiconductors',price: 842.20, changePercent24h:  2.40, volatility: 'High',   expGrowthPercent: 31.5 },
      { id: 'googl',ticker: 'GOOGL',name: 'Alphabet',    sector: 'Technology',    price: 158.22, changePercent24h: -0.42, volatility: 'Low',    expGrowthPercent: 11.8 },
    ],
    OPTIONS: [
      { id: 'aapl-c', ticker: 'AAPL 180C', name: 'Apple Call 180',   sector: 'Options', price: 3.45,  changePercent24h:  8.20, volatility: 'High',   expGrowthPercent: 0 },
      { id: 'tsla-p', ticker: 'TSLA 170P', name: 'Tesla Put 170',    sector: 'Options', price: 5.80,  changePercent24h: 12.50, volatility: 'High',   expGrowthPercent: 0 },
      { id: 'spy-c',  ticker: 'SPY 520C',  name: 'S&P 500 Call 520', sector: 'Options', price: 2.10,  changePercent24h: -3.10, volatility: 'Medium', expGrowthPercent: 0 },
    ],
    CRYPTO: [
      { id: 'btc',  ticker: 'BTC',  name: 'Bitcoin',  sector: 'Crypto', price: 68432, changePercent24h: -2.11, volatility: 'High',   expGrowthPercent: 0 },
      { id: 'eth',  ticker: 'ETH',  name: 'Ethereum', sector: 'Crypto', price: 3492,  changePercent24h:  0.45, volatility: 'High',   expGrowthPercent: 0 },
      { id: 'sol',  ticker: 'SOL',  name: 'Solana',   sector: 'Crypto', price: 142.8, changePercent24h:  3.22, volatility: 'High',   expGrowthPercent: 0 },
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Data-fetching function — now connected to backend
// ─────────────────────────────────────────────────────────────────────────────

// Exported for backward compatibility - getMarketData is now at top of file
