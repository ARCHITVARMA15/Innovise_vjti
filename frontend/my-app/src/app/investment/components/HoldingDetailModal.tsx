'use client';

import { useEffect, useRef, useState } from 'react';
import type { Holding } from '@/lib/types/investment';
import {
  generateOHLCV,
  calcSMA,
  calcRSI,
  calcMACD,
  type Period,
  type OHLCBar,
  type VolBar,
} from '@/lib/utils/ohlcvGenerator';
// lightweight-charts v5 — dynamically imported inside useEffect (browser-only)

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

// ── Backend response shapes ───────────────────────────────────────────────────
interface YFBar {
  date: string;          // e.g. "2024-01-01 00:00:00+05:30"
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
}
interface YFQuote {
  price: number | null;
}

// Map backend bars → OHLCBar[] + VolBar[]
function mapBars(raw: YFBar[]): { bars: OHLCBar[]; volume: VolBar[] } {
  const bars: OHLCBar[] = [];
  const volume: VolBar[] = [];
  for (const r of raw) {
    if (r.open == null || r.high == null || r.low == null || r.close == null) continue;
    const t = r.date.slice(0, 10);
    bars.push({ time: t, open: r.open, high: r.high, low: r.low, close: r.close });
    volume.push({
      time: t,
      value: r.volume ?? 0,
      color: r.close >= r.open ? 'rgba(0,150,104,0.28)' : 'rgba(186,26,26,0.28)',
    });
  }
  return { bars, volume };
}

const PERIOD_MAP: Record<Period, string> = {
  '1W': '5d', '1M': '1mo', '3M': '3mo', '6M': '6mo',
};

interface Props {
  holding: Holding;
  onClose: () => void;
}

interface HoverData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  rsi?: number;
  macd?: number;
  signal?: number;
}

const PERIODS: Period[] = ['1W', '1M', '3M', '6M'];
const CHART_BG   = '#f8fafc';
const CHART_TEXT = '#64748b';
const GRID_COL   = 'rgba(15,23,42,0.04)';
const CROSS_COL  = 'rgba(0,101,145,0.4)';
const BORDER_COL = 'rgba(15,23,42,0.08)';

const fmt = (n: number, d = 2) =>
  n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

export default function HoldingDetailModal({ holding, onClose }: Props) {
  const [period,    setPeriod]    = useState<Period>('1M');
  const [livePrice, setLivePrice] = useState(holding.currentPrice);
  const [hoverData, setHoverData] = useState<HoverData | null>(null);
  const [loading,   setLoading]   = useState(true);
  
  // Interactive features state
  const [showReasoning, setShowReasoning] = useState(false);
  const [reasoning, setReasoning] = useState<any>(null);
  const [reasoningLoading, setReasoningLoading] = useState(false);
  const [showPatterns, setShowPatterns] = useState(true);
  const [showComparison, setShowComparison] = useState(false);
  const [annotations, setAnnotations] = useState(true);

  const mainRef = useRef<HTMLDivElement>(null);
  const rsiRef  = useRef<HTMLDivElement>(null);
  const macdRef = useRef<HTMLDivElement>(null);
  const barsRef = useRef<OHLCBar[]>([]);
  const rsiValueRef = useRef<number | null>(null);
  const macdValueRef = useRef<number | null>(null);

  // ── AI Reasoning fetch ──────────────────────────────────────────────────────
  const fetchAIReasoning = async () => {
    if (barsRef.current.length < 5) return;
    
    setReasoningLoading(true);
    try {
      const payload = {
        symbol: holding.ticker,
        bars: barsRef.current.slice(-30).map(b => ({
          date: b.time,
          open: b.open,
          high: b.high,
          low: b.low,
          close: b.close,
          volume: 0,
        })),
        rsi: rsiValueRef.current,
        macd: macdValueRef.current,
      };
      
      const res = await fetch(`${BASE_URL}/yf/analyze-chart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      if (res.ok) {
        const data = await res.json();
        setReasoning(data);
        setShowReasoning(true);
      }
    } catch (e) {
      console.error('[AI Reasoning] fetch failed:', e);
    } finally {
      setReasoningLoading(false);
    }
  };

  // ── Live price: real quote from /yf/quote, polling every 30s ────────────────
  useEffect(() => {
    const yfSymbol = holding.id.toUpperCase();
    async function fetchQuote() {
      try {
        const res = await fetch(`${BASE_URL}/yf/quote/${yfSymbol}`);
        if (res.ok) {
          const q: YFQuote = await res.json();
          if (q.price != null && q.price > 0) setLivePrice(q.price);
        }
      } catch {}
    }
    fetchQuote();
    const id = setInterval(fetchQuote, 30_000);
    return () => clearInterval(id);
  }, [holding.id]);

  // ── ESC close ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // ── Charts: init on period/ticker change only (NOT on livePrice) ────────────
  useEffect(() => {
    if (!mainRef.current || !rsiRef.current || !macdRef.current) return;

    let disposed = false;
    let mainChart: ReturnType<typeof import('lightweight-charts')['createChart']> | null = null;
    let rsiChart:  ReturnType<typeof import('lightweight-charts')['createChart']> | null = null;
    let macdChart: ReturnType<typeof import('lightweight-charts')['createChart']> | null = null;
    let ro: ResizeObserver | null = null;

    setLoading(true);

    (async () => {
      const {
        createChart, ColorType, CrosshairMode, LineStyle,
      } = await import('lightweight-charts');
      if (disposed) return;

      // ── Fetch real OHLCV from backend, fallback to generator ───────────────
      let bars: OHLCBar[] = [];
      let volume: VolBar[] = [];
      const yfSymbol = holding.id.toUpperCase();
      try {
        const res = await fetch(
          `${BASE_URL}/yf/history/${yfSymbol}?period=${PERIOD_MAP[period]}&interval=1d`,
        );
        if (res.ok) {
          const raw: YFBar[] = await res.json();
          ({ bars, volume } = mapBars(raw));
        }
      } catch (e) {
        console.warn('[HoldingDetailModal] history fetch failed, using generated data:', e);
      }

      if (bars.length < 3) {
        ({ bars, volume } = generateOHLCV(
          holding.ticker, holding.costBasis, holding.currentPrice, period
        ));
      }

      if (disposed) return;
      setLoading(false);

      // Store in refs for AI reasoning
      barsRef.current = bars;
      
      const rsiData  = calcRSI(bars);
      const macdData = calcMACD(bars);
      const ma20Data = calcSMA(bars, 20);
      const ma50Data = calcSMA(bars, 50);
      
      // Store latest indicator values
      rsiValueRef.current = rsiData.length > 0 ? rsiData[rsiData.length - 1].value : null;
      macdValueRef.current = macdData.macdLine.length > 0 ? macdData.macdLine[macdData.macdLine.length - 1].value : null;

      const toSeries = (b: typeof bars[0]) => ({
        time:  b.time,
        open:  b.open,
        high:  b.high,
        low:   b.low,
        close: b.close,
      });

      // ── Shared chart config ────────────────────────────────────────────────
      const baseOpts = {
        layout: {
          background: { type: ColorType.Solid, color: CHART_BG },
          textColor:  CHART_TEXT,
          fontFamily: 'Inter, sans-serif',
        },
        grid: {
          vertLines: { color: GRID_COL },
          horzLines: { color: GRID_COL },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: CROSS_COL, labelBackgroundColor: '#006591' },
          horzLine: { color: CROSS_COL, labelBackgroundColor: '#006591' },
        },
        timeScale: {
          borderColor:    BORDER_COL,
          timeVisible:    true,
          secondsVisible: false,
          fixLeftEdge:    true,
          fixRightEdge:   true,
        },
        rightPriceScale: { borderColor: BORDER_COL },
        handleScroll: true,
        handleScale:  true,
      };

      // ── Main chart (candlestick + volume + MA) ─────────────────────────────
      mainChart = createChart(mainRef.current!, {
        ...baseOpts,
        width:  mainRef.current!.clientWidth,
        height: 320,
      });

      const candleSeries = mainChart.addCandlestickSeries({
        upColor:         '#009668',
        downColor:       '#ba1a1a',
        borderUpColor:   '#009668',
        borderDownColor: '#ba1a1a',
        wickUpColor:     '#009668',
        wickDownColor:   '#ba1a1a',
      });
      candleSeries.setData(bars.map(toSeries));

      // Volume overlay on dedicated scale
      const volSeries = mainChart.addHistogramSeries({
        priceFormat:  { type: 'volume' },
        priceScaleId: 'vol',
      });
      mainChart.priceScale('vol').applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      });
      volSeries.setData(volume.map(v => ({ time: v.time, value: v.value, color: v.color })));

      // MA20
      if (ma20Data.length > 0) {
        const ma20 = mainChart.addLineSeries({
          color:                 '#006591',
          lineWidth:             1,
          crosshairMarkerVisible: false,
          lastValueVisible:      true,
          priceLineVisible:      false,
        });
        ma20.setData(ma20Data.map(p => ({ time: p.time, value: p.value })));
      }

      // MA50
      if (ma50Data.length > 0) {
        const ma50 = mainChart.addLineSeries({
          color:                 '#C9A84C',
          lineWidth:             1,
          crosshairMarkerVisible: false,
          lastValueVisible:      true,
          priceLineVisible:      false,
        });
        ma50.setData(ma50Data.map(p => ({ time: p.time, value: p.value })));
      }

      mainChart.timeScale().fitContent();

      // ── RSI chart ─────────────────────────────────────────────────────────
      rsiChart = createChart(rsiRef.current!, {
        ...baseOpts,
        width:  rsiRef.current!.clientWidth,
        height: 110,
        timeScale: { ...baseOpts.timeScale, visible: false },
        rightPriceScale: {
          ...baseOpts.rightPriceScale,
          scaleMargins: { top: 0.1, bottom: 0.1 },
        },
      });

      const rsiSeries = rsiChart.addLineSeries({
        color:       '#006591',
        lineWidth:   2,
        priceFormat: { type: 'price', precision: 1, minMove: 0.1 },
      });
      if (rsiData.length > 0) {
        rsiSeries.setData(rsiData.map(p => ({ time: p.time, value: p.value })));
        rsiSeries.createPriceLine({ price: 70, color: 'rgba(186,26,26,0.5)',   lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true,  title: 'OB' });
        rsiSeries.createPriceLine({ price: 30, color: 'rgba(0,150,104,0.55)', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true,  title: 'OS' });
        rsiSeries.createPriceLine({ price: 50, color: 'rgba(148,163,184,0.15)',lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: false });
      }
      rsiChart.timeScale().fitContent();

      // ── MACD chart ────────────────────────────────────────────────────────
      macdChart = createChart(macdRef.current!, {
        ...baseOpts,
        width:  macdRef.current!.clientWidth,
        height: 110,
        timeScale: { ...baseOpts.timeScale, visible: true },
        rightPriceScale: {
          ...baseOpts.rightPriceScale,
          scaleMargins: { top: 0.1, bottom: 0.1 },
        },
      });

      if (macdData.histogram.length > 0) {
        const histSeries = macdChart.addHistogramSeries({
          priceFormat: { type: 'price', precision: 4, minMove: 0.0001 },
        });
        histSeries.setData(macdData.histogram.map(p => ({
          time:  p.time,
          value: p.value,
          color: p.value >= 0 ? 'rgba(0,150,104,0.55)' : 'rgba(186,26,26,0.55)',
        })));

        const macdLine = macdChart.addLineSeries({
          color: '#006591', lineWidth: 2,
          crosshairMarkerVisible: false, lastValueVisible: false, priceLineVisible: false,
        });
        macdLine.setData(macdData.macdLine.map(p => ({ time: p.time, value: p.value })));

        const sigLine = macdChart.addLineSeries({
          color: '#C9A84C', lineWidth: 2,
          crosshairMarkerVisible: false, lastValueVisible: false, priceLineVisible: false,
        });
        sigLine.setData(macdData.signalLine.map(p => ({ time: p.time, value: p.value })));
      }
      macdChart.timeScale().fitContent();

      // ── Hover tooltip from main chart ──────────────────────────────────────
      mainChart.subscribeCrosshairMove((param: any) => {
        const p = param as any;
        if (!p?.point || !p.time || !p.seriesData?.size) {
          setHoverData(null);
          return;
        }
        const ohlcv  = p.seriesData.get(candleSeries) as any;
        const volVal = p.seriesData.get(volSeries)    as any;
        if (!ohlcv) return;

        const ts     = p.time as string;
        const rsiPt  = rsiData.find(r => r.time === ts);
        const macdPt = macdData.macdLine.find(m => m.time === ts);
        const sigPt  = macdData.signalLine.find(s => s.time === ts);

        setHoverData({
          date: new Date(ts + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          open:   ohlcv.open,
          high:   ohlcv.high,
          low:    ohlcv.low,
          close:  ohlcv.close,
          volume: volVal?.value ?? 0,
          rsi:    rsiPt?.value,
          macd:   macdPt?.value,
          signal: sigPt?.value,
        });
      });

      // ── Time-range sync across all three charts ────────────────────────────
      function syncRange(src: typeof mainChart, targets: (typeof mainChart)[]) {
        src!.timeScale().subscribeVisibleLogicalRangeChange((range: any) => {
          if (!range) return;
          targets.forEach(t => { try { t!.timeScale().setVisibleLogicalRange(range); } catch {} });
        });
      }
      syncRange(mainChart, [rsiChart, macdChart]);
      syncRange(rsiChart,  [mainChart, macdChart]);
      syncRange(macdChart, [mainChart, rsiChart]);

      // ── Responsive resize ──────────────────────────────────────────────────
      ro = new ResizeObserver(() => {
        if (!disposed) {
          if (mainRef.current) mainChart?.applyOptions({ width: mainRef.current.clientWidth });
          if (rsiRef.current)  rsiChart?.applyOptions({ width: rsiRef.current.clientWidth });
          if (macdRef.current) macdChart?.applyOptions({ width: macdRef.current.clientWidth });
        }
      });
      if (mainRef.current) ro.observe(mainRef.current);
    })();

    return () => {
      disposed = true;
      ro?.disconnect();
      try { mainChart?.remove(); } catch {}
      try { rsiChart?.remove(); }  catch {}
      try { macdChart?.remove(); } catch {}
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, holding.id, holding.ticker, holding.costBasis, holding.currentPrice]);

  // ── Derived P&L ─────────────────────────────────────────────────────────────
  const unrealPnL  = (livePrice - holding.costBasis) * holding.shares;
  const unrealPct  = ((livePrice - holding.costBasis) / holding.costBasis) * 100;
  const liveMktVal = livePrice * holding.shares;
  const isGain     = unrealPnL >= 0;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(15,23,42,0.32)', backdropFilter: 'blur(8px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-5xl rounded-2xl flex flex-col overflow-hidden"
        style={{
          backgroundColor: '#ffffff',
          maxHeight: '92vh',
          boxShadow: '0 24px 48px rgba(11,28,48,0.14), 0 0 0 1px rgba(15,23,42,0.06)',
        }}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div
          className="flex items-center justify-between px-8 py-5 shrink-0"
          style={{ borderBottom: '1px solid #f1f5f9' }}
        >
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-xs shrink-0"
              style={{ backgroundColor: '#eff4ff', color: '#006591', fontFamily: 'Inter, sans-serif' }}
            >
              {holding.ticker}
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight" style={{ color: '#0f172a', fontFamily: 'Manrope, sans-serif' }}>
                {holding.name}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded"
                  style={{ backgroundColor: '#eff4ff', color: '#006591', fontFamily: 'Inter, sans-serif' }}
                >
                  {holding.ticker}
                </span>
                <span
                  className="text-[10px] uppercase tracking-wider"
                  style={{ color: '#475569', fontFamily: 'Inter, sans-serif' }}
                >
                  {holding.sector}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors"
            style={{ color: '#64748b' }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.backgroundColor = '#f1f5f9';
              el.style.color = '#0f172a';
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.backgroundColor = 'transparent';
              el.style.color = '#64748b';
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>close</span>
          </button>
        </div>

        {/* ── Live P&L Metrics ───────────────────────────────────────────── */}
        <div
          className="grid grid-cols-2 sm:grid-cols-5 gap-px shrink-0"
          style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: '#f1f5f9' }}
        >
          {/* Live Price */}
          <div className="px-6 py-5" style={{ backgroundColor: '#ffffff' }}>
            <p className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: '#475569', fontFamily: 'Inter, sans-serif' }}>
              Live Price
            </p>
            <div className="flex items-center gap-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: '#009668' }} />
              <p className="text-xl font-bold" style={{ color: '#0f172a', fontFamily: 'Manrope, sans-serif' }}>
                ${fmt(livePrice)}
              </p>
            </div>
          </div>

          {/* Unrealized P&L */}
          <div className="px-6 py-5" style={{ backgroundColor: '#ffffff' }}>
            <p className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: '#475569', fontFamily: 'Inter, sans-serif' }}>
              Unrealized P&amp;L
            </p>
            <p className="text-xl font-bold" style={{ color: isGain ? '#009668' : '#ba1a1a', fontFamily: 'Manrope, sans-serif' }}>
              {isGain ? '+' : '-'}${fmt(Math.abs(unrealPnL))}
            </p>
            <p className="text-[11px] font-bold mt-0.5" style={{ color: isGain ? '#009668' : '#ba1a1a', fontFamily: 'Inter, sans-serif' }}>
              {isGain ? '▲' : '▼'} {fmt(Math.abs(unrealPct), 1)}%
            </p>
          </div>

          {/* Market Value */}
          <div className="px-6 py-5" style={{ backgroundColor: '#ffffff' }}>
            <p className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: '#475569', fontFamily: 'Inter, sans-serif' }}>
              Market Value
            </p>
            <p className="text-xl font-bold" style={{ color: '#0f172a', fontFamily: 'Manrope, sans-serif' }}>
              ${fmt(liveMktVal)}
            </p>
          </div>

          {/* Cost Basis */}
          <div className="px-6 py-5" style={{ backgroundColor: '#ffffff' }}>
            <p className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: '#475569', fontFamily: 'Inter, sans-serif' }}>
              Cost Basis
            </p>
            <p className="text-xl font-bold" style={{ color: '#0f172a', fontFamily: 'Manrope, sans-serif' }}>
              ${fmt(holding.costBasis)}
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: '#475569', fontFamily: 'Inter, sans-serif' }}>
              ${fmt(holding.costBasis * holding.shares)} total
            </p>
          </div>

          {/* Shares */}
          <div className="px-6 py-5" style={{ backgroundColor: '#ffffff' }}>
            <p className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: '#475569', fontFamily: 'Inter, sans-serif' }}>
              Shares Held
            </p>
            <p className="text-xl font-bold" style={{ color: '#0f172a', fontFamily: 'Manrope, sans-serif' }}>
              {holding.shares.toFixed(2)}
            </p>
          </div>
        </div>

        {/* ── Chart area ─────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3 min-h-0 relative">

          {/* Loading overlay */}
          {loading && (
            <div
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-b-2xl"
              style={{ backgroundColor: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(4px)' }}
            >
              <div
                className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: '#006591', borderTopColor: 'transparent' }}
              />
              <span className="text-xs font-semibold tracking-wide" style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}>
                Loading live data…
              </span>
            </div>
          )}

          {/* Period tabs + MA legend */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-1.5">
              {PERIODS.map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className="px-3 py-1 rounded text-[11px] font-bold uppercase tracking-wider transition-all"
                  style={{
                    backgroundColor: period === p ? '#0b1c30' : '#f1f5f9',
                    color:           period === p ? '#ffffff' : '#64748b',
                    fontFamily:      'Inter, sans-serif',
                    cursor:          'pointer',
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-5">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-px" style={{ backgroundColor: '#006591' }} />
                <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}>MA20</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-px" style={{ backgroundColor: '#C9A84C' }} />
                <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}>MA50</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: 'rgba(0,150,104,0.35)' }} />
                <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}>Vol</span>
              </div>
            </div>
          </div>

          {/* Hover OHLCV tooltip row */}
          <div
            className="flex items-center gap-5 px-3 py-2 rounded-lg text-[11px] transition-all"
            style={{
              backgroundColor: hoverData ? '#eff4ff' : 'transparent',
              fontFamily: 'Inter, sans-serif',
              minHeight: '32px',
            }}
          >
            {hoverData ? (
              <>
                <span style={{ color: '#94a3b8' }}>{hoverData.date}</span>
                <span style={{ color: '#64748b' }}>O: <strong style={{ color: '#0f172a' }}>${fmt(hoverData.open)}</strong></span>
                <span style={{ color: '#64748b' }}>H: <strong style={{ color: '#009668' }}>${fmt(hoverData.high)}</strong></span>
                <span style={{ color: '#64748b' }}>L: <strong style={{ color: '#ba1a1a' }}>${fmt(hoverData.low)}</strong></span>
                <span style={{ color: '#64748b' }}>C: <strong style={{ color: hoverData.close >= hoverData.open ? '#009668' : '#ba1a1a' }}>${fmt(hoverData.close)}</strong></span>
                <span style={{ color: '#94a3b8' }}>Vol: {(hoverData.volume / 1_000_000).toFixed(1)}M</span>
                {hoverData.rsi !== undefined && (
                  <span style={{ color: '#94a3b8' }}>
                    RSI: <strong style={{ color: hoverData.rsi > 70 ? '#ba1a1a' : hoverData.rsi < 30 ? '#009668' : '#006591' }}>
                      {hoverData.rsi.toFixed(1)}
                    </strong>
                  </span>
                )}
                {hoverData.macd !== undefined && hoverData.signal !== undefined && (
                  <>
                    <span style={{ color: '#64748b' }}>MACD: <strong style={{ color: '#006591' }}>{hoverData.macd.toFixed(2)}</strong></span>
                    <span style={{ color: '#64748b' }}>Sig: <strong style={{ color: '#C9A84C' }}>{hoverData.signal.toFixed(2)}</strong></span>
                  </>
                )}
              </>
            ) : (
              <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '10px' }}>Hover over the chart to see OHLCV data</span>
            )}
          </div>

          {/* ── Candlestick + Volume + MA chart ───────────────────────────── */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest mb-1.5 px-1" style={{ color: '#94a3b8', fontFamily: 'Inter, sans-serif' }}>
              Candlestick · Volume · MA
            </p>
            <div
              ref={mainRef}
              className="w-full rounded-lg overflow-hidden"
              style={{ backgroundColor: CHART_BG, minHeight: '320px' }}
            />
          </div>

          {/* ── RSI chart ─────────────────────────────────────────────────── */}
          <div>
            <div className="flex items-center gap-3 px-1 mb-1.5">
              <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: '#94a3b8', fontFamily: 'Inter, sans-serif' }}>RSI (14)</p>
              <div className="flex items-center gap-3 text-[9px]" style={{ color: '#94a3b8', fontFamily: 'Inter, sans-serif' }}>
                <span style={{ color: 'rgba(186,26,26,0.8)' }}>⸺ Overbought 70</span>
                <span style={{ color: 'rgba(0,150,104,0.8)' }}>⸺ Oversold 30</span>
              </div>
            </div>
            <div
              ref={rsiRef}
              className="w-full rounded-lg overflow-hidden"
              style={{ backgroundColor: CHART_BG, minHeight: '110px' }}
            />
          </div>

          {/* ── MACD chart ────────────────────────────────────────────────── */}
          <div>
            <div className="flex items-center gap-4 px-1 mb-1.5">
              <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: '#94a3b8', fontFamily: 'Inter, sans-serif' }}>MACD (12, 26, 9)</p>
              <div className="flex items-center gap-4 text-[9px]" style={{ fontFamily: 'Inter, sans-serif' }}>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-px" style={{ backgroundColor: '#006591' }} />
                  <span style={{ color: '#94a3b8' }}>MACD</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-px" style={{ backgroundColor: '#C9A84C' }} />
                  <span style={{ color: '#94a3b8' }}>Signal</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: 'rgba(0,150,104,0.45)' }} />
                  <span style={{ color: '#94a3b8' }}>Histogram</span>
                </div>
              </div>
            </div>
            <div
              ref={macdRef}
              className="w-full rounded-lg overflow-hidden"
              style={{ backgroundColor: CHART_BG, minHeight: '110px' }}
            />
          </div>

        </div>
      </div>

      {/* ── AI Reasoning Sliding Panel ──────────────────────────────────── */}
      <div
        className="absolute top-0 right-0 h-full w-full md:w-[420px] flex flex-col overflow-hidden transition-transform duration-500 ease-out"
        style={{
          backgroundColor: '#ffffff',
          boxShadow: '-8px 0 24px rgba(11,28,48,0.15)',
          transform: showReasoning ? 'translateX(0)' : 'translateX(100%)',
          borderLeft: '1px solid #f1f5f9',
        }}
      >
        {/* Panel Header */}
        <div className="px-6 py-5 shrink-0" style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: '#006591' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span style={{ fontSize: '24px' }}>🧠</span>
              <div>
                <h3 className="font-bold text-base" style={{ color: '#ffffff', fontFamily: 'Manrope, sans-serif' }}>
                  AI Chart Analysis
                </h3>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.7)', fontFamily: 'Inter, sans-serif' }}>
                  Pattern recognition & insights
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowReasoning(false)}
              className="p-2 rounded-lg transition-colors"
              style={{ color: '#ffffff' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.15)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
            </button>
          </div>
        </div>

        {/* Panel Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {reasoning ? (
            <>
              {/* Summary Badge */}
              <div className="p-4 rounded-xl" style={{ backgroundColor: '#eff4ff', border: '1px solid #006591' }}>
                <p className="text-sm font-bold leading-relaxed" style={{ color: '#0f172a', fontFamily: 'Inter, sans-serif' }}>
                  {reasoning.summary}
                </p>
              </div>

              {/* Trend Analysis */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-2" style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}>
                  <span>📈</span>
                  <span>Trend Analysis</span>
                </h4>
                <p className="text-sm leading-relaxed" style={{ color: '#475569', fontFamily: 'Inter, sans-serif' }}>
                  {reasoning.trend_analysis}
                </p>
              </div>

              {/* Key Levels */}
              {reasoning.key_levels && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg" style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}>
                    <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: '#991b1b', fontFamily: 'Inter, sans-serif' }}>Support</p>
                    <p className="text-base font-bold" style={{ color: '#dc2626', fontFamily: 'Manrope, sans-serif' }}>
                      ${reasoning.key_levels.support}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg" style={{ backgroundColor: '#f0f9ff', border: '1px solid #bae6fd' }}>
                    <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: '#075985', fontFamily: 'Inter, sans-serif' }}>Current</p>
                    <p className="text-base font-bold" style={{ color: '#0369a1', fontFamily: 'Manrope, sans-serif' }}>
                      ${reasoning.key_levels.current}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg" style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                    <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: '#166534', fontFamily: 'Inter, sans-serif' }}>Resistance</p>
                    <p className="text-base font-bold" style={{ color: '#16a34a', fontFamily: 'Manrope, sans-serif' }}>
                      ${reasoning.key_levels.resistance}
                    </p>
                  </div>
                </div>
              )}

              {/* Technical Signals */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}>
                  <span>⚡</span>
                  <span>Technical Signals</span>
                </h4>
                <div className="space-y-2">
                  {reasoning.technical_signals.map((signal: string, i: number) => (
                    <div
                      key={i}
                      className="p-3 rounded-lg flex items-start gap-2"
                      style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}
                    >
                      <span style={{ color: '#006591', fontSize: '14px', marginTop: '2px' }}>•</span>
                      <p className="text-xs leading-relaxed flex-1" style={{ color: '#475569', fontFamily: 'Inter, sans-serif' }}>
                        {signal}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Risk Assessment */}
              <div className="p-4 rounded-xl" style={{ backgroundColor: '#fefce8', border: '1px solid #fde047' }}>
                <h4 className="text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-2" style={{ color: '#854d0e', fontFamily: 'Inter, sans-serif' }}>
                  <span>⚠️</span>
                  <span>Risk Assessment</span>
                </h4>
                <p className="text-sm leading-relaxed" style={{ color: '#713f12', fontFamily: 'Inter, sans-serif' }}>
                  {reasoning.risk_assessment}
                </p>
              </div>

              {/* Recommendation */}
              <div
                className="p-5 rounded-xl"
                style={{
                  backgroundColor: reasoning.recommendation.startsWith('BUY') ? '#f0fdf4' : reasoning.recommendation.startsWith('SELL') ? '#fef2f2' : '#f8fafc',
                  border: `2px solid ${reasoning.recommendation.startsWith('BUY') ? '#22c55e' : reasoning.recommendation.startsWith('SELL') ? '#ef4444' : '#64748b'}`,
                }}
              >
                <h4 className="text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-2" style={{ color: '#0f172a', fontFamily: 'Inter, sans-serif' }}>
                  <span>🎯</span>
                  <span>Recommendation</span>
                </h4>
                <p className="text-sm font-bold leading-relaxed" style={{ color: '#0f172a', fontFamily: 'Inter, sans-serif' }}>
                  {reasoning.recommendation}
                </p>
              </div>

              {/* Metadata Footer */}
              {reasoning.metadata && (
                <div className="pt-4 mt-4" style={{ borderTop: '1px solid #f1f5f9' }}>
                  <div className="grid grid-cols-2 gap-3 text-xs" style={{ fontFamily: 'Inter, sans-serif' }}>
                    {reasoning.metadata.volatility != null && (
                      <div>
                        <span style={{ color: '#94a3b8' }}>Volatility: </span>
                        <strong style={{ color: '#0f172a' }}>{reasoning.metadata.volatility}%</strong>
                      </div>
                    )}
                    {reasoning.metadata.trend && (
                      <div>
                        <span style={{ color: '#94a3b8' }}>Trend: </span>
                        <strong style={{ color: '#0f172a', textTransform: 'capitalize' }}>{reasoning.metadata.trend}</strong>
                      </div>
                    )}
                    {reasoning.metadata.rsi != null && (
                      <div>
                        <span style={{ color: '#94a3b8' }}>RSI: </span>
                        <strong style={{ color: '#0f172a' }}>{reasoning.metadata.rsi}</strong>
                      </div>
                    )}
                    {reasoning.metadata.macd != null && (
                      <div>
                        <span style={{ color: '#94a3b8' }}>MACD: </span>
                        <strong style={{ color: '#0f172a' }}>{reasoning.metadata.macd}</strong>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <span style={{ fontSize: '48px', marginBottom: '16px' }}>🧠</span>
              <p className="text-sm font-semibold mb-2" style={{ color: '#0f172a', fontFamily: 'Manrope, sans-serif' }}>
                No Analysis Yet
              </p>
              <p className="text-xs" style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}>
                Click "AI Reasoning" to generate insights
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
