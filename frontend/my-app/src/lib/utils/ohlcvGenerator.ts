// ─── OHLCV Generator ──────────────────────────────────────────────────────────
// Generates realistic candlestick + indicator data for a holding.
// Seeded by ticker so the same ticker always produces the same base shape.

export interface OHLCBar {
  time: string;   // 'YYYY-MM-DD'
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface VolBar {
  time: string;
  value: number;
  color: string;
}

export interface IndicatorPoint {
  time: string;
  value: number;
}

export type Period = '1W' | '1M' | '3M' | '6M';

const PERIOD_BARS: Record<Period, number> = {
  '1W': 7,
  '1M': 22,
  '3M': 65,
  '6M': 130,
};

/** Seeded pseudo-random for deterministic noise per ticker */
function seededRand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function tickerSeed(ticker: string) {
  return ticker.split('').reduce((acc, c) => acc + c.charCodeAt(0) * 31, 0);
}

/** Generate OHLCV bars from costBasis → currentPrice */
export function generateOHLCV(
  ticker: string,
  costBasis: number,
  currentPrice: number,
  period: Period,
): { bars: OHLCBar[]; volume: VolBar[] } {
  const rand = seededRand(tickerSeed(ticker) + period.charCodeAt(0));
  const count = PERIOD_BARS[period];
  const nowMs = Date.now();

  const bars: OHLCBar[] = [];
  const volume: VolBar[] = [];

  let price = costBasis;
  const totalMove = currentPrice - costBasis;
  // Volatility scales with price level
  const dailyVol = Math.abs(totalMove / count) * 1.8 + costBasis * 0.008;

  for (let i = 0; i < count; i++) {
    const progress = i / (count - 1);
    // Smooth trend component
    const trend = totalMove * (progress * 0.7 + Math.sin(progress * Math.PI) * 0.3);
    // Random walk noise
    const noise = (rand() - 0.48) * dailyVol;
    const target = costBasis + trend + noise;

    const open = price;
    const close = target;
    const spread = Math.abs(close - open) * (0.3 + rand() * 0.5) + dailyVol * 0.1;
    const high = Math.max(open, close) + spread * rand();
    const low  = Math.min(open, close) - spread * rand();

    const d = new Date(nowMs - (count - 1 - i) * 86400_000);
    const t = d.toISOString().slice(0, 10);

    bars.push({ time: t, open, high, low, close });
    volume.push({
      time: t,
      value: Math.floor((rand() * 8_000_000 + 2_000_000)),
      color: close >= open ? 'rgba(0,150,104,0.28)' : 'rgba(186,26,26,0.28)',
    });

    price = close;
  }

  return { bars, volume };
}

/** Calculate Simple Moving Average */
export function calcSMA(bars: OHLCBar[], period: number): IndicatorPoint[] {
  return bars
    .map((b, i) => {
      if (i < period - 1) return null;
      const slice = bars.slice(i - period + 1, i + 1);
      const avg = slice.reduce((sum, b) => sum + b.close, 0) / period;
      return { time: b.time, value: avg };
    })
    .filter(Boolean) as IndicatorPoint[];
}

/** Calculate RSI (14-period default) */
export function calcRSI(bars: OHLCBar[], period = 14): IndicatorPoint[] {
  if (bars.length < period + 1) return [];
  const result: IndicatorPoint[] = [];

  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const delta = bars[i].close - bars[i - 1].close;
    if (delta >= 0) gainSum += delta; else lossSum -= delta;
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;

  for (let i = period; i < bars.length; i++) {
    if (i > period) {
      const delta = bars[i].close - bars[i - 1].close;
      avgGain = (avgGain * (period - 1) + Math.max(delta, 0)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.max(-delta, 0)) / period;
    }
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push({ time: bars[i].time, value: 100 - 100 / (1 + rs) });
  }
  return result;
}

/** Calculate MACD (12/26/9) */
export function calcMACD(bars: OHLCBar[]): {
  macdLine: IndicatorPoint[];
  signalLine: IndicatorPoint[];
  histogram: IndicatorPoint[];
} {
  if (bars.length < 35) {
    return { macdLine: [], signalLine: [], histogram: [] };
  }

  function ema(data: number[], period: number): number[] {
    const k = 2 / (period + 1);
    const result: number[] = [data[0]];
    for (let i = 1; i < data.length; i++) {
      result.push(data[i] * k + result[i - 1] * (1 - k));
    }
    return result;
  }

  const closes = bars.map(b => b.close);
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const macdValues = ema12.map((v, i) => v - ema26[i]);
  const signalValues = ema(macdValues.slice(25), 9);

  const macdLine: IndicatorPoint[] = [];
  const signalLine: IndicatorPoint[] = [];
  const histogram: IndicatorPoint[] = [];

  macdValues.slice(25).forEach((val, i) => {
    const t = bars[25 + i].time;
    const sig = signalValues[i];
    macdLine.push({ time: t, value: val });
    signalLine.push({ time: t, value: sig });
    histogram.push({ time: t, value: val - sig });
  });

  return { macdLine, signalLine, histogram };
}
