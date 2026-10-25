'use client';

import type { InvestmentSummary } from '@/lib/types/investment';

interface Props {
  data: InvestmentSummary;
}

function fmt(n: number) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function HeroStats({ data }: Props) {
  return (
    <section className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      {/* Total Investment Value — spans 2 cols */}
      <div
        className="lg:col-span-2 p-8 rounded-xl flex flex-col justify-between"
        style={{
          backgroundColor: '#ffffff',
          boxShadow: '24px 0 40px rgba(11,28,48,0.03)',
          minHeight: '180px',
        }}
      >
        <div>
          <span
            className="text-[11px] tracking-[0.15em] uppercase font-bold"
            style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}
          >
            Total Investment Value
          </span>
          <h2
            className="leading-tight mt-2"
            style={{
              fontFamily: 'Manrope, sans-serif',
              fontSize: '3.5rem',
              fontWeight: 800,
              color: '#000000',
            }}
          >
            ₹{fmt(data.totalValue)}
          </h2>
        </div>
        <div className="flex items-center gap-4 mt-4">
          <span
            className="px-3 py-1 font-bold text-xs rounded-full flex items-center gap-1"
            style={{
              backgroundColor: data.allTimeProfitPercent >= 0 ? '#4edea3' : '#ffdad6',
              color: data.allTimeProfitPercent >= 0 ? '#002113' : '#ba1a1a',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '16px', fontVariationSettings: "'FILL' 1, 'wght' 400" }}
            >
              {data.allTimeProfitPercent >= 0 ? 'arrow_drop_up' : 'arrow_drop_down'}
            </span>
            {data.allTimeProfitPercent >= 0 ? '+' : ''}{data.allTimeProfitPercent}%
          </span>
          <span
            className="text-sm font-medium"
            style={{ color: '#94a3b8', fontFamily: 'Inter, sans-serif' }}
          >
            All-time profit:{' '}
            <span style={{ color: '#0b1c30', fontWeight: 600 }}>
              {data.allTimeProfitAbs >= 0 ? '+' : '-'}₹{Math.abs(data.allTimeProfitAbs).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </span>
        </div>
      </div>

      {/* Day's Change */}
      <div
        className="p-8 rounded-xl flex flex-col justify-center"
        style={{ backgroundColor: '#eff4ff' }}
      >
        <span
          className="text-[11px] tracking-[0.15em] uppercase font-bold mb-4"
          style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}
        >
          Day&apos;s Change
        </span>
        <div className="space-y-1">
          <div
            className="text-2xl font-bold"
            style={{ color: data.dayChangeAbs >= 0 ? '#009668' : '#ba1a1a', fontFamily: 'Manrope, sans-serif' }}
          >
            {data.dayChangeAbs >= 0 ? '+' : '-'}₹{fmt(Math.abs(data.dayChangeAbs))}
          </div>
          <div
            className="text-sm font-medium"
            style={{ color: data.dayChangePercent >= 0 ? '#009668' : '#ba1a1a', fontFamily: 'Inter, sans-serif' }}
          >
            {data.dayChangePercent >= 0 ? '+' : ''}{data.dayChangePercent.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Buying Power */}
      <div
        className="p-8 rounded-xl flex flex-col justify-center"
        style={{ backgroundColor: '#eff4ff' }}
      >
        <span
          className="text-[11px] tracking-[0.15em] uppercase font-bold mb-4"
          style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}
        >
          Buying Power
        </span>
        <div className="space-y-1">
          <div
            className="text-2xl font-bold"
            style={{ color: '#000000', fontFamily: 'Manrope, sans-serif' }}
          >
            ₹{fmt(data.buyingPower)}
          </div>
          <div
            className="text-sm font-medium"
            style={{ color: '#94a3b8', fontFamily: 'Inter, sans-serif' }}
          >
            Cash &amp; Equivalents
          </div>
        </div>
      </div>
    </section>
  );
}
