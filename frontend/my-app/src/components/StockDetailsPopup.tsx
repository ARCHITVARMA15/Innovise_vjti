'use client';

import { useState, useEffect } from 'react';

interface StockDetailsPopupProps {
  ticker: string;
  onClose: () => void;
}

interface StockData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: string;
  pe: number;
  high52w: number;
  low52w: number;
  dayHigh: number;
  dayLow: number;
  avgVolume: number;
}

interface CandlePoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export default function StockDetailsPopup({ ticker, onClose }: StockDetailsPopupProps) {
  const [stockData, setStockData] = useState<StockData | null>(null);
  const [candles, setCandles] = useState<CandlePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'1D' | '1W' | '1M' | '1Y'>('1M');

  useEffect(() => {
    fetchStockData();
  }, [ticker]);

  useEffect(() => {
    fetchCandleData();
  }, [ticker, period]);

  const fetchStockData = async () => {
    try {
      const response = await fetch(`http://localhost:8000/yf/quote/${ticker}`);
      if (!response.ok) throw new Error('Failed to fetch stock data');
      
      const data = await response.json();
      setStockData({
        symbol: data.symbol || ticker,
        name: data.name || ticker,
        price: data.price || 0,
        change: data.change || 0,
        changePercent: data.change_percent || 0,
        volume: data.volume || 0,
        marketCap: data.market_cap || 'N/A',
        pe: data.pe_ratio || 0,
        high52w: data.fifty_two_week_high || 0,
        low52w: data.fifty_two_week_low || 0,
        dayHigh: data.day_high || 0,
        dayLow: data.day_low || 0,
        avgVolume: data.average_volume || 0,
      });
    } catch (error) {
      console.error('Failed to fetch stock data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCandleData = async () => {
    try {
      const periodMap = {
        '1D': { period: '1d', interval: '5m' },
        '1W': { period: '5d', interval: '1h' },
        '1M': { period: '1mo', interval: '1d' },
        '1Y': { period: '1y', interval: '1d' },
      };
      
      const { period: yf_period, interval } = periodMap[period];
      const response = await fetch(
        `http://localhost:8000/yf/history/${ticker}?period=${yf_period}&interval=${interval}`
      );
      
      if (!response.ok) throw new Error('Failed to fetch candle data');
      
      const data = await response.json();
      setCandles(data);
    } catch (error) {
      console.error('Failed to fetch candle data:', error);
      setCandles([]);
    }
  };

  const renderMiniCandleChart = () => {
    if (candles.length === 0) return null;

    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const maxPrice = Math.max(...highs);
    const minPrice = Math.min(...lows);
    const priceRange = maxPrice - minPrice || 1;

    const W = 600;
    const H = 200;
    const candleW = Math.max(3, Math.floor(W / candles.length) - 2);
    const PAD = 16;

    const toY = (p: number) => H - PAD - ((p - minPrice) / priceRange) * (H - PAD * 2);

    return (
      <svg
        className="w-full"
        style={{ height: '200px' }}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
      >
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map(frac => (
          <line
            key={frac}
            x1="0" y1={H * frac} x2={W} y2={H * frac}
            stroke="rgba(198,198,205,0.2)" strokeWidth="1"
          />
        ))}

        {/* Candles */}
        {candles.map((c, i) => {
          const x = (i / candles.length) * W + (W / candles.length - candleW) / 2;
          const isGreen = c.close >= c.open;
          const color = isGreen ? '#4edea3' : '#ba1a1a';
          const bodyTop = toY(Math.max(c.open, c.close));
          const bodyBottom = toY(Math.min(c.open, c.close));
          const bodyH = Math.max(1, bodyBottom - bodyTop);
          const wickX = x + candleW / 2;

          return (
            <g key={i}>
              <line
                x1={wickX} y1={toY(c.high)}
                x2={wickX} y2={toY(c.low)}
                stroke={color} strokeWidth="1" opacity="0.7"
              />
              <rect
                x={x} y={bodyTop}
                width={candleW} height={bodyH}
                fill={color}
                opacity={isGreen ? 1 : 0.8}
                rx="1"
              />
            </g>
          );
        })}
      </svg>
    );
  };

  if (loading) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
        onClick={onClose}
      >
        <div className="bg-white rounded-xl glass-card-edge p-8">
          <p className="text-lg font-semibold" style={{ fontFamily: 'Inter, sans-serif' }}>
            Loading {ticker}...
          </p>
        </div>
      </div>
    );
  }

  if (!stockData) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
        onClick={onClose}
      >
        <div className="bg-white rounded-xl glass-card-edge p-8">
          <p className="text-lg font-semibold text-red-600" style={{ fontFamily: 'Inter, sans-serif' }}>
            Failed to load stock data
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl glass-card-edge p-8 max-w-4xl w-full shadow-2xl my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2
              className="text-4xl font-extrabold tracking-tight"
              style={{ color: '#0f172a', fontFamily: 'Manrope, sans-serif' }}
            >
              {stockData.symbol}
            </h2>
            <p
              className="text-sm mt-1"
              style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}
            >
              {stockData.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>close</span>
          </button>
        </div>

        {/* Price Info */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          <div>
            <p className="text-sm text-gray-500 mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>Current Price</p>
            <p className="text-5xl font-bold" style={{ color: '#0f172a', fontFamily: 'Manrope, sans-serif' }}>
              ₹{stockData.price.toFixed(2)}
            </p>
            <p
              className="text-lg mt-2 font-semibold"
              style={{
                color: stockData.changePercent >= 0 ? '#4edea3' : '#ba1a1a',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {stockData.changePercent >= 0 ? '+' : ''}{stockData.change.toFixed(2)} ({stockData.changePercent.toFixed(2)}%)
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg" style={{ backgroundColor: '#f8fafc' }}>
              <p className="text-xs text-gray-500 mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>Day High</p>
              <p className="text-lg font-bold" style={{ color: '#0f172a', fontFamily: 'Inter, sans-serif' }}>
                ₹{stockData.dayHigh > 0 ? stockData.dayHigh.toFixed(2) : 'N/A'}
              </p>
            </div>
            <div className="p-3 rounded-lg" style={{ backgroundColor: '#f8fafc' }}>
              <p className="text-xs text-gray-500 mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>Day Low</p>
              <p className="text-lg font-bold" style={{ color: '#0f172a', fontFamily: 'Inter, sans-serif' }}>
                ₹{stockData.dayLow > 0 ? stockData.dayLow.toFixed(2) : 'N/A'}
              </p>
            </div>
          </div>
        </div>

        {/* Chart Section */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold" style={{ color: '#0f172a', fontFamily: 'Manrope, sans-serif' }}>
              Price Chart
            </h3>
            <div className="flex gap-2">
              {(['1D', '1W', '1M', '1Y'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className="px-3 py-1 text-xs font-bold rounded transition-all"
                  style={{
                    backgroundColor: period === p ? '#000000' : 'transparent',
                    color: period === p ? '#ffffff' : '#64748b',
                    border: period === p ? 'none' : '1px solid #c6c6cd',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-lg overflow-hidden" style={{ backgroundColor: 'rgba(239,244,255,0.3)' }}>
            {renderMiniCandleChart()}
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-lg" style={{ backgroundColor: '#f8fafc' }}>
            <p className="text-xs text-gray-500 mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>Market Cap</p>
            <p className="text-lg font-bold" style={{ color: '#0f172a', fontFamily: 'Inter, sans-serif' }}>
              {stockData.marketCap}
            </p>
          </div>
          <div className="p-4 rounded-lg" style={{ backgroundColor: '#f8fafc' }}>
            <p className="text-xs text-gray-500 mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>P/E Ratio</p>
            <p className="text-lg font-bold" style={{ color: '#0f172a', fontFamily: 'Inter, sans-serif' }}>
              {stockData.pe > 0 ? stockData.pe.toFixed(2) : 'N/A'}
            </p>
          </div>
          <div className="p-4 rounded-lg" style={{ backgroundColor: '#f8fafc' }}>
            <p className="text-xs text-gray-500 mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>Volume</p>
            <p className="text-lg font-bold" style={{ color: '#0f172a', fontFamily: 'Inter, sans-serif' }}>
              {(stockData.volume / 1_000_000).toFixed(1)}M
            </p>
          </div>
          <div className="p-4 rounded-lg" style={{ backgroundColor: '#f8fafc' }}>
            <p className="text-xs text-gray-500 mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>52W High</p>
            <p className="text-lg font-bold" style={{ color: '#0f172a', fontFamily: 'Inter, sans-serif' }}>
              ₹{stockData.high52w > 0 ? stockData.high52w.toFixed(2) : 'N/A'}
            </p>
          </div>
          <div className="p-4 rounded-lg" style={{ backgroundColor: '#f8fafc' }}>
            <p className="text-xs text-gray-500 mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>52W Low</p>
            <p className="text-lg font-bold" style={{ color: '#0f172a', fontFamily: 'Inter, sans-serif' }}>
              ₹{stockData.low52w > 0 ? stockData.low52w.toFixed(2) : 'N/A'}
            </p>
          </div>
          <div className="p-4 rounded-lg" style={{ backgroundColor: '#f8fafc' }}>
            <p className="text-xs text-gray-500 mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>Avg Volume</p>
            <p className="text-lg font-bold" style={{ color: '#0f172a', fontFamily: 'Inter, sans-serif' }}>
              {stockData.avgVolume > 0 ? (stockData.avgVolume / 1_000_000).toFixed(1) + 'M' : 'N/A'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
