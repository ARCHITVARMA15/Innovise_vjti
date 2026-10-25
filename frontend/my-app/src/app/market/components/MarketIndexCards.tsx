'use client';

import type { MarketIndex } from '@/lib/types/market';

interface Props {
  data: MarketIndex[];
}

export default function MarketIndexCards({ data }: Props) {
  return (
    <section className="grid grid-cols-2 lg:grid-cols-4 gap-6">
      {data.map(idx => {
        const isUp = idx.changePercent >= 0;
        return (
          <div
            key={idx.id}
            className="p-6 rounded-xl"
            style={{
              backgroundColor: '#ffffff',
              boxShadow: '0 24px 40px -15px rgba(11,28,48,0.04)',
            }}
          >
            <div className="flex justify-between items-start mb-4">
              <span
                className="text-[0.6875rem] font-bold tracking-widest uppercase"
                style={{ color: '#7c839b', fontFamily: 'Inter, sans-serif' }}
              >
                {idx.label}
              </span>
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: '20px',
                  color: isUp ? '#4edea3' : '#ba1a1a',
                  fontVariationSettings: "'FILL' 0, 'wght' 400",
                }}
              >
                {isUp ? 'trending_up' : 'trending_down'}
              </span>
            </div>

            <div className="flex items-baseline justify-between">
              <h2
                className="font-bold text-2xl tracking-tight"
                style={{ color: '#000000', fontFamily: 'Manrope, sans-serif' }}
              >
                {idx.price >= 10000
                  ? `₹${idx.price.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
                  : idx.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h2>
              <span
                className="text-xs font-bold"
                style={{ color: isUp ? '#4edea3' : '#ba1a1a', fontFamily: 'Inter, sans-serif' }}
              >
                {isUp ? '+' : ''}{idx.changePercent.toFixed(2)}%
              </span>
            </div>

            {/* Decorative progress bar */}
            <div
              className="mt-4 h-1 rounded-full overflow-hidden"
              style={{ backgroundColor: '#eff4ff' }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${idx.barFillPercent}%`,
                  backgroundColor: isUp ? '#4edea3' : '#ba1a1a',
                  transition: 'width 0.8s ease',
                }}
              />
            </div>
          </div>
        );
      })}
    </section>
  );
}
