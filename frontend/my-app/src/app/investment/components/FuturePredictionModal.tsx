"use client";

import React, { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { X, TrendingUp, Cpu, Activity, Clock, Maximize2, Minimize2 } from "lucide-react";
import { createChart, ColorType, IChartApi } from "lightweight-charts";
import { apiPost } from "@/lib/api/client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

interface FuturePredictionModalProps {
  isOpen: boolean;
  onClose: () => void;
  holdings: Array<{ ticker: string; name: string }>;
}

type CandlePoint = { time: string; open: number; high: number; low: number; close: number };
type LinePoint = { time: string; value: number };
type RiskPoint = { time: string; upper: number; lower: number };

type PredictionPayload = {
  data: CandlePoint[];
  trend_line?: LinePoint[];
  risk_band?: RiskPoint[];
  model?: string;
  period?: string;
  horizon_days?: number;
  retrained?: boolean;
  trained_at_utc?: string;
  metrics?: {
    linear?: { directional_accuracy?: number; test_mae?: number };
    logistic?: { test_accuracy?: number; brier_score?: number };
  };
  error?: string;
};

type PredictionApiResponse = PredictionPayload & {
  ticker?: string;
  models_available?: string[];
};

type ModelOption = "hybrid" | "linear" | "logistic" | "linear_stochastic" | "regime_switch";

const MODEL_OPTIONS: Array<{ value: ModelOption; label: string }> = [
  { value: "hybrid", label: "Hybrid" },
  { value: "linear", label: "Linear" },
  { value: "logistic", label: "Logistic" },
  { value: "linear_stochastic", label: "Linear Stochastic" },
  { value: "regime_switch", label: "Regime Switch" },
];

const PERIOD_OPTIONS = ["1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "ytd", "max"];

function cacheKeyFor(ticker: string, model: ModelOption, period: string, horizon: number): string {
  return `${ticker}|${model}|${period}|${horizon}`;
}

export default function FuturePredictionModal({
  isOpen,
  onClose,
  holdings,
}: FuturePredictionModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  
  const [activeTab, setActiveTab] = useState(0);
  const [isExpanded, setIsExpanded] = useState(true);
  const [chartDataCache, setChartDataCache] = useState<Record<string, PredictionPayload>>({});
  const [selectedModel, setSelectedModel] = useState<ModelOption>("hybrid");
  const [selectedPeriod, setSelectedPeriod] = useState("5y");
  const [selectedHorizon, setSelectedHorizon] = useState(30);
  const [isLoading, setIsLoading] = useState(false);
  const [isTraining, setIsTraining] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>("");

  const currentHolding = holdings[activeTab];

  // Clear transient status whenever configuration changes.
  useEffect(() => {
    if (!isOpen) return;
    setStatusMessage("");
  }, [isOpen, selectedModel, selectedPeriod, selectedHorizon, activeTab]);

  const trainSelectedModel = async () => {
    if (!currentHolding) return;

    const ticker = currentHolding.ticker;
    const key = cacheKeyFor(ticker, selectedModel, selectedPeriod, selectedHorizon);

    setIsTraining(true);
    setIsLoading(true);
    setStatusMessage(`Training ${selectedModel} model for ${ticker}...`);
    try {
      const json = await apiPost<PredictionApiResponse>("/investments/future-predictions/train", {
        ticker,
        model: selectedModel,
        period: selectedPeriod,
        horizon: selectedHorizon,
      });

      const payload: PredictionPayload = {
        data: json.data ?? [],
        trend_line: json.trend_line ?? [],
        risk_band: json.risk_band ?? [],
        model: json.model,
        period: json.period,
        horizon_days: json.horizon_days,
        retrained: json.retrained,
        trained_at_utc: json.trained_at_utc,
        metrics: json.metrics,
        error: json.error,
      };

      setChartDataCache((prev) => ({ ...prev, [key]: payload }));
      if (json.error) {
        setStatusMessage(`Training failed: ${json.error}`);
      } else {
        setStatusMessage(
          `Training complete for ${ticker} (${payload.model ?? selectedModel}, ${payload.period ?? selectedPeriod}, ${payload.horizon_days ?? selectedHorizon}d).`
        );
      }
    } catch (err) {
      console.error("Failed to train model:", err);
      setStatusMessage("Training failed due to a network or server error.");
    } finally {
      setIsTraining(false);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let ctx = gsap.context(() => {});
    if (isOpen) {
      document.body.style.overflow = "hidden";
      ctx = gsap.context(() => {
        gsap.fromTo(
          modalRef.current,
          { opacity: 0, backdropFilter: "blur(0px)" },
          { opacity: 1, backdropFilter: "blur(20px)", duration: 0.6, ease: "power3.out" }
        );
        gsap.fromTo(
          contentRef.current,
          { scale: 0.9, opacity: 0, y: 50 },
          { scale: 1, opacity: 1, y: 0, duration: 0.6, delay: 0.2, ease: "back.out(1.2)" }
        );
      });
    } else {
      document.body.style.overflow = "auto";
    }

    return () => {
      ctx.revert();
      document.body.style.overflow = "auto";
    };
  }, [isOpen]);

  // Timeline animation
  useEffect(() => {
    if (isOpen && timelineRef.current) {
      const scrollWidth = timelineRef.current.scrollWidth;
      gsap.to(timelineRef.current, {
        x: -scrollWidth / 2,
        duration: 20,
        ease: "linear",
        repeat: -1,
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentData = currentHolding
    ? chartDataCache[cacheKeyFor(currentHolding.ticker, selectedModel, selectedPeriod, selectedHorizon)]
    : null;

  return (
    <div
      ref={modalRef}
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/80 transition-all duration-300 ${isExpanded ? "p-0" : "p-4 sm:p-6 lg:p-8"}`}
    >
      {/* Background glow effects */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[30rem] h-[30rem] bg-indigo-500/20 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40rem] h-[40rem] bg-emerald-500/10 rounded-full blur-[150px]" />
      </div>

      <div
        ref={contentRef}
        onClick={(e) => e.stopPropagation()}
        className={`relative z-10 w-full overflow-hidden border border-white/10 bg-[#0a0f1d]/90 shadow-2xl backdrop-blur-2xl flex flex-col transition-all duration-500 ${
          isExpanded ? "h-screen rounded-none max-w-none" : "h-[90vh] rounded-[2xl] max-w-7xl"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center p-2 bg-emerald-500/20 rounded-lg text-emerald-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                Future Predictions
                <span className="px-2 py-0.5 text-xs font-semibold bg-blue-500/20 text-blue-400 rounded-full flex items-center gap-1">
                  <Cpu className="w-3 h-3" /> AI GENERATED
                </span>
              </h2>
              <p className="text-sm text-gray-400">Train model per stock and project model-specific future trend paths</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="rounded-full p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              {isExpanded ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
            <button
              onClick={onClose}
              className="rounded-full p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex flex-1 overflow-hidden relative">
          {/* Sidebar Tabs */}
          <div className="w-64 border-r border-white/5 p-4 overflow-y-auto hidden md:block hide-scrollbar bg-black/20">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 ml-2">Active Holdings</h3>
            <div className="space-y-1">
              {holdings.map((h, i) => (
                <button
                  key={h.ticker}
                  onClick={() => setActiveTab(i)}
                  className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-300 flex items-center justify-between group ${
                    activeTab === i
                      ? "bg-white/10 border border-white/10 shadow-[0_0_15px_rgba(59,130,246,0.15)]"
                      : "hover:bg-white/5 border border-transparent"
                  }`}
                >
                  <div>
                    <div className={`font-semibold transition-colors ${activeTab === i ? 'text-white' : 'text-gray-300 group-hover:text-white'}`}>
                      {h.ticker}
                    </div>
                    <div className="text-xs text-gray-500 truncate max-w-[120px]">{h.name}</div>
                  </div>
                  {activeTab === i && <TrendingUp className="w-4 h-4 text-blue-400" />}
                </button>
              ))}
            </div>
          </div>

          {/* Main Chart Area */}
          <div className="flex-1 p-6 flex flex-col relative w-full h-full">
            <div className="mb-4 grid grid-cols-1 lg:grid-cols-4 gap-3">
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                <span className="text-xs text-gray-400">Model</span>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value as ModelOption)}
                  className="ml-auto bg-transparent text-sm text-white outline-none"
                >
                  {MODEL_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-[#0a0f1d]">
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                <span className="text-xs text-gray-400">History</span>
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="ml-auto bg-transparent text-sm text-white outline-none"
                >
                  {PERIOD_OPTIONS.map((period) => (
                    <option key={period} value={period} className="bg-[#0a0f1d]">
                      {period}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                <span className="text-xs text-gray-400">Horizon</span>
                <select
                  value={selectedHorizon}
                  onChange={(e) => setSelectedHorizon(Number(e.target.value))}
                  className="ml-auto bg-transparent text-sm text-white outline-none"
                >
                  {[15, 30, 45, 60].map((h) => (
                    <option key={h} value={h} className="bg-[#0a0f1d]">
                      {h}d
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={trainSelectedModel}
                disabled={isTraining || !currentHolding}
                className="rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isTraining ? "Training..." : "Train Selected Model"}
              </button>
            </div>

            {statusMessage ? (
              <div className="mb-4 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-gray-300">
                {statusMessage}
              </div>
            ) : null}

            {/* Mobile Tabs */}
            <div className="w-full md:hidden flex overflow-x-auto gap-2 pb-4 mb-4 border-b border-white/5 hide-scrollbar">
               {holdings.map((h, i) => (
                 <button
                   key={h.ticker}
                   onClick={() => setActiveTab(i)}
                   className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                     activeTab === i
                       ? "bg-white/10 text-white border border-white/10"
                       : "text-gray-400 hover:text-white hover:bg-white/5"
                   }`}
                 >
                   {h.ticker}
                 </button>
               ))}
            </div>

            <div className="flex-1 relative rounded-2xl border border-white/10 bg-[#060912] overflow-hidden group flex items-center justify-center">
              {isLoading ? (
                <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/50 backdrop-blur-sm">
                  <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                </div>
              ) : currentData?.error ? (
                <div className="p-6 text-sm text-red-300">{currentData.error}</div>
              ) : currentData && (currentData.data?.length ?? 0) > 0 ? (
                <ChartComponent payload={currentData} ticker={currentHolding.ticker} />
              ) : (
                <div className="p-6 text-sm text-gray-400">
                  Train the selected model to generate and plot authentic model predictions.
                </div>
              )}

              {/* Decorative scanline overlay */}
              <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.1)_50%)] bg-[length:100%_2px] z-10 mix-blend-overlay opacity-30" />
            </div>
          </div>
        </div>

        {/* Animated Timeline Footer */}
        <div className="h-16 lg:h-20 border-t border-white/5 bg-black/40 flex flex-col justify-center overflow-hidden relative shrink-0">
          <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-[#0a0f1d] to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-[#0a0f1d] to-transparent z-10 pointer-events-none" />
          
          <div className="flex items-center gap-2 px-6 mb-1 text-[10px] lg:text-xs font-medium text-gray-500 uppercase tracking-wider">
            <Clock className="w-3 h-3" /> Predictive Timeline Events
          </div>

          <div className="flex whitespace-nowrap relative w-[200%] gap-8 px-6 text-sm" ref={timelineRef}>
            {[1, 2].map((loopIndex) => (
              <React.Fragment key={loopIndex}>
                <TimelineItem ticker="TCS" msg="Projected resistance breakout at +4.2%" color="text-emerald-400" border="border-emerald-500/20" bg="bg-emerald-500/10" dot="bg-emerald-400"/>
                <TimelineItem ticker="HDFCBANK" msg="Volatility approaching normal bounds" color="text-yellow-400" border="border-yellow-500/20" bg="bg-yellow-500/10" dot="bg-yellow-400"/>
                <TimelineItem ticker="RELIANCE" msg="Strong momentum cluster detected next week" color="text-blue-400" border="border-blue-500/20" bg="bg-blue-500/10" dot="bg-blue-400"/>
                <TimelineItem ticker="INFY" msg="Potential consolidation phase starting Day 12" color="text-purple-400" border="border-purple-500/20" bg="bg-purple-500/10" dot="bg-purple-400"/>
                <TimelineItem ticker="VXUS" msg="Macro trend maintaining positive drift" color="text-emerald-400" border="border-emerald-500/20" bg="bg-emerald-500/10" dot="bg-emerald-400"/>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TimelineItem({ ticker, msg, color, border, bg, dot }: { ticker: string, msg: string, color: string, border: string, bg: string, dot: string }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-1.5 lg:py-2 rounded-full border ${border} ${bg} flex-shrink-0 backdrop-blur-sm`}>
      <span className={`w-2 h-2 rounded-full ${dot} animate-pulse`} />
      <span className="font-bold text-white text-xs lg:text-sm">{ticker}</span>
      <span className={`${color} text-xs lg:text-sm`}>{msg}</span>
    </div>
  );
}

// Sub-component to manage lightweight-charts instance
function ChartComponent({ payload, ticker }: { payload: PredictionPayload, ticker: string }) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current || !payload) return;

    const chartOptions = {
      layout: {
        textColor: '#8b9bb4',
        background: { type: ColorType.Solid, color: 'transparent' },
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      crosshair: {
        mode: 1, // Magnet
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        scaleMargins: { top: 0.12, bottom: 0.12 },
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
      },
    };

    const chart = createChart(chartContainerRef.current, chartOptions);
    chartRef.current = chart;

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#00ff88',
      downColor: '#ff3366',
      borderVisible: false,
      wickUpColor: '#00ff88',
      wickDownColor: '#ff3366',
    });

    const candleData = payload.data ?? [];
    const trendData = payload.trend_line ?? candleData.map((x) => ({ time: x.time, value: x.close }));
    const riskData = payload.risk_band ?? [];

    candlestickSeries.setData(candleData);

    const trendSeries = chart.addLineSeries({
      color: '#3b82f6',
      lineWidth: 3,
      priceLineVisible: false,
      lastValueVisible: true,
    });
    trendSeries.setData(trendData);

    if (candleData.length > 0) {
      const baseline = chart.addLineSeries({
        color: 'rgba(16,185,129,0.55)',
        lineWidth: 1,
        lineStyle: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      const anchor = candleData[0].open;
      baseline.setData(candleData.map((r) => ({ time: r.time, value: anchor })));
    }

    if (riskData.length > 0) {
      const upperSeries = chart.addLineSeries({
        color: 'rgba(59,130,246,0.24)',
        lineWidth: 1,
        lineStyle: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      upperSeries.setData(riskData.map((r) => ({ time: r.time, value: r.upper })));

      const lowerSeries = chart.addLineSeries({
        color: 'rgba(59,130,246,0.24)',
        lineWidth: 1,
        lineStyle: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      lowerSeries.setData(riskData.map((r) => ({ time: r.time, value: r.lower })));
    }

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener('resize', handleResize);
    
    // Initial resize to fit container properly
    setTimeout(handleResize, 100);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [payload]);

  return (
    <div className="relative w-full h-full p-2">
      <div className="absolute top-4 left-4 z-10 text-white/50 text-2xl font-bold tracking-widest uppercase pointer-events-none mix-blend-overlay">
        {ticker} - MODEL PREDICTION
      </div>
      <div ref={chartContainerRef} className="w-full h-full" />
    </div>
  );
}