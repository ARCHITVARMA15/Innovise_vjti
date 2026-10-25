'use client';

import { useState } from 'react';
import type { AlgoSignal, SignalStatus } from '@/lib/types/market';

interface Props {
  data: AlgoSignal[];
}

interface StockDetails {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: string;
  pe: number;
  high52w: number;
  low52w: number;
}

const statusStyle: Record<SignalStatus, { color: string }> = {
  CONFIRMED: { color: '#4edea3' },
  WARNING:   { color: '#ba1a1a' },
  NEUTRAL:   { color: '#39b8fd' },
};

const iconBgStyle: Record<SignalStatus, { bg: string; color: string }> = {
  CONFIRMED: { bg: 'rgba(78,222,163,0.2)',  color: '#4edea3' },
  WARNING:   { bg: 'rgba(186,26,26,0.2)',   color: '#ba1a1a' },
  NEUTRAL:   { bg: 'rgba(57,184,253,0.2)',  color: '#39b8fd' },
};

export default function AlgorithmicSignals({ data }: Props) {
  const [selectedStock, setSelectedStock] = useState<StockDetails | null>(null);
  const [loading, setLoading] = useState(false);

  const handleStockClick = async (ticker: string) => {
    setLoading(true);
    try {
      // Fetch stock details from backend
      const response = await fetch(`http://localhost:8000/yf/quote/${ticker}`);
      const data = await response.json();
      
      setSelectedStock({
        ticker: data.symbol || ticker,
        name: data.name || ticker,
        price: data.price || 0,
        change: data.change || 0,
        changePercent: data.change_percent || 0,
        volume: data.volume || 0,
        marketCap: data.market_cap || 'N/A',
        pe: data.pe_ratio || 0,
        high52w: data.fifty_two_week_high || 0,
        low52w: data.fifty_two_week_low || 0,
      });
    } catch (error) {
      console.error('Failed to fetch stock details:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <section
        className="p-8 rounded-xl relative overflow-hidden"
        style={{ backgroundColor: '#131b2e' }}
      >
        {/* Ambient glow */}
        <div
          className="absolute -top-10 -right-10 w-40 h-40 rounded-full blur-3xl pointer-events-none"
          style={{ backgroundColor: 'rgba(0,101,145,0.15)' }}
        />

        <h3
          className="font-black text-xl text-white mb-6 tracking-tighter"
          style={{ fontFamily: 'Manrope, sans-serif' }}
        >
          Algorithmic Signals
        </h3>

        <div className="space-y-4 relative z-10">
          {data.map(sig => {
            const iconStyle = iconBgStyle[sig.status];
            const statusColor = statusStyle[sig.status].color;
            return (
              <div
                key={sig.id}
                onClick={() => handleStockClick(sig.ticker)}
                className="flex items-start gap-4 p-4 rounded-lg cursor-pointer transition-all hover:scale-[1.02]"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
              {/* Icon */}
              <div
                className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center"
                style={{ backgroundColor: iconStyle.bg }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{
                    fontSize: '18px',
                    color: iconStyle.color,
                    fontVariationSettings: "'FILL' 1, 'wght' 400",
                  }}
                >
                  {sig.icon}
                </span>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-1">
                  <span
                    className="font-bold text-white text-sm"
                    style={{ fontFamily: 'Inter, sans-serif' }}
                  >
                    {sig.ticker}: {sig.signalType}
                  </span>
                  <span
                    className="text-[10px] font-black uppercase"
                    style={{ color: statusColor, fontFamily: 'Inter, sans-serif' }}
                  >
                    {sig.status}
                  </span>
                </div>
                <p
                  className="text-[11px] leading-relaxed"
                  style={{ color: 'rgba(124,131,155,0.9)', fontFamily: 'Inter, sans-serif' }}
                >
                  {sig.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>

    {/* Stock Details Popup */}
    {selectedStock && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
        onClick={() => setSelectedStock(null)}
      >
        <div
          className="bg-white rounded-xl glass-card-edge p-8 max-w-2xl w-full shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2
                className="text-3xl font-extrabold tracking-tight"
                style={{ color: '#0f172a', fontFamily: 'Manrope, sans-serif' }}
              >
                {selectedStock.ticker}
              </h2>
              <p
                className="text-sm mt-1"
                style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}
              >
                {selectedStock.name}
              </p>
            </div>
            <button
              onClick={() => setSelectedStock(null)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>close</span>
            </button>
          </div>

          {/* Price Info */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <p className="text-sm text-gray-500 mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>Current Price</p>
              <p className="text-4xl font-bold" style={{ color: '#0f172a', fontFamily: 'Manrope, sans-serif' }}>
                ${selectedStock.price.toFixed(2)}
              </p>
              <p
                className="text-sm mt-1"
                style={{
                  color: selectedStock.changePercent >= 0 ? '#4edea3' : '#ba1a1a',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                {selectedStock.changePercent >= 0 ? '+' : ''}{selectedStock.change.toFixed(2)} ({selectedStock.changePercent.toFixed(2)}%)
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>Volume</p>
              <p className="text-2xl font-bold" style={{ color: '#0f172a', fontFamily: 'Manrope, sans-serif' }}>
                {selectedStock.volume.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg" style={{ backgroundColor: '#f8fafc' }}>
              <p className="text-xs text-gray-500 mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>Market Cap</p>
              <p className="text-lg font-bold" style={{ color: '#0f172a', fontFamily: 'Inter, sans-serif' }}>
                {selectedStock.marketCap}
              </p>
            </div>
            <div className="p-4 rounded-lg" style={{ backgroundColor: '#f8fafc' }}>
              <p className="text-xs text-gray-500 mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>P/E Ratio</p>
              <p className="text-lg font-bold" style={{ color: '#0f172a', fontFamily: 'Inter, sans-serif' }}>
                {selectedStock.pe > 0 ? selectedStock.pe.toFixed(2) : 'N/A'}
              </p>
            </div>
            <div className="p-4 rounded-lg" style={{ backgroundColor: '#f8fafc' }}>
              <p className="text-xs text-gray-500 mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>52W High</p>
              <p className="text-lg font-bold" style={{ color: '#0f172a', fontFamily: 'Inter, sans-serif' }}>
                ${selectedStock.high52w > 0 ? selectedStock.high52w.toFixed(2) : 'N/A'}
              </p>
            </div>
            <div className="p-4 rounded-lg" style={{ backgroundColor: '#f8fafc' }}>
              <p className="text-xs text-gray-500 mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>52W Low</p>
              <p className="text-lg font-bold" style={{ color: '#0f172a', fontFamily: 'Inter, sans-serif' }}>
                ${selectedStock.low52w > 0 ? selectedStock.low52w.toFixed(2) : 'N/A'}
              </p>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Loading Overlay */}
    {loading && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      >
        <div className="bg-white rounded-lg p-6">
          <p className="text-lg font-semibold" style={{ fontFamily: 'Inter, sans-serif' }}>Loading stock details...</p>
        </div>
      </div>
    )}
  </>
  );
}
