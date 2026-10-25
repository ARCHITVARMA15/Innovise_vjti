'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Opportunity, PortfolioRiskAlert } from '@/lib/types/investment';
import HoldingDetailModal from './HoldingDetailModal';

interface Props {
  opportunities: Opportunity[];
  riskAlert: PortfolioRiskAlert;
}

const signalStyles: Record<string, { bg: string; text: string }> = {
  BUY:   { bg: '#000000', text: '#ffffff' },
  WATCH: { bg: '#006591', text: '#ffffff' },
  SELL:  { bg: '#ba1a1a', text: '#ffffff' },
};

const signalIcons: Record<string, string> = {
  BUY:   'add_circle',
  WATCH: 'visibility',
  SELL:  'trending_down',
};

export default function Opportunities({ opportunities, riskAlert }: Props) {
  const [selectedStock, setSelectedStock] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleStockClick = async (opp: Opportunity) => {
    setIsLoading(true);
    
    // Open modal immediately with basic data, then fetch live data
    const basicHoldingData = {
      id: opp.ticker,
      ticker: opp.ticker,
      name: opp.name,
      shares: 0,
      costBasis: opp.currentPrice,
      currentPrice: opp.currentPrice,
      marketValue: 0,
      returnPercent: opp.dayChangePercent,
      trend: Array(7).fill(0).map(() => Math.random() * 100 + 50),
    };
    
    // Open modal immediately
    setSelectedStock(basicHoldingData);
    setIsLoading(false);
    
    // Note: The HoldingDetailModal will fetch its own data using the ticker
    // We don't need to fetch here since the modal handles all data fetching internally
  };

  return (
    <>
      <section className="space-y-6">
        <h3
          className="text-xl font-extrabold tracking-tight"
          style={{ color: '#0f172a', fontFamily: 'Manrope, sans-serif' }}
        >
          Opportunities for You
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Opportunity cards */}
          {opportunities.map(opp => {
            const isPositive = opp.dayChangePercent >= 0;
            const style = signalStyles[opp.signal] ?? signalStyles.BUY;
            return (
              <div
                key={opp.id}
                className="p-6 rounded-xl flex flex-col justify-between group cursor-pointer transition-all"
                style={{ backgroundColor: '#eff4ff' }}
                onClick={() => handleStockClick(opp)}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.backgroundColor = '#ffffff';
                  el.style.boxShadow = '0 20px 40px rgba(11,28,48,0.10)';
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.backgroundColor = '#eff4ff';
                  el.style.boxShadow = 'none';
                }}
              >
              <div className="flex justify-between items-start">
                <span
                  className="px-2 py-0.5 text-[10px] font-bold rounded"
                  style={{
                    backgroundColor: style.bg,
                    color: style.text,
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  {opp.signal}
                </span>
                <span
                  className="material-symbols-outlined transition-colors"
                  style={{
                    fontSize: '22px',
                    color: '#cbd5e1',
                    fontVariationSettings: "'FILL' 0, 'wght' 300",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#000000'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#cbd5e1'; }}
                >
                  {signalIcons[opp.signal]}
                </span>
              </div>

              <div className="mt-8">
                <h4
                  className="font-extrabold text-lg"
                  style={{ color: '#0f172a', fontFamily: 'Manrope, sans-serif' }}
                >
                  {opp.name}
                </h4>
                <p
                  className="text-sm mt-1 leading-relaxed"
                  style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}
                >
                  {opp.description}
                </p>
              </div>

              <div className="mt-6 flex items-center justify-between">
                <div
                  className="text-xl font-bold"
                  style={{ color: '#0f172a', fontFamily: 'Manrope, sans-serif' }}
                >
                  ${opp.currentPrice.toFixed(2)}
                </div>
                <div
                  className="text-xs font-bold"
                  style={{
                    color: isPositive ? '#009668' : '#ba1a1a',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  {isPositive ? '+' : ''}{opp.dayChangePercent.toFixed(1)}% Today
                </div>
              </div>
            </div>
          );
        })}

        {/* Portfolio Risk Alert card */}
        <div
          className="p-6 rounded-xl flex flex-col justify-between overflow-hidden relative"
          style={{ backgroundColor: '#000000', color: '#ffffff' }}
        >
          <div className="relative z-10">
            <h4
              className="font-extrabold text-lg"
              style={{ color: '#ffffff', fontFamily: 'Manrope, sans-serif' }}
            >
              {riskAlert.title}
            </h4>
            <p
              className="text-sm mt-2 leading-relaxed"
              style={{ color: '#94a3b8', fontFamily: 'Inter, sans-serif' }}
            >
              {riskAlert.description}
            </p>
          </div>

          <div className="mt-8 relative z-10">
            <Link
              href="/portfolio"
              className="inline-block px-4 py-2 text-xs font-bold rounded transition-opacity hover:opacity-90"
              style={{
                backgroundColor: '#ffffff',
                color: '#000000',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {riskAlert.ctaLabel}
            </Link>
          </div>

          {/* Decorative background icon */}
          <div className="absolute -right-4 -bottom-4 opacity-20 pointer-events-none">
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '7rem', fontVariationSettings: "'wght' 200" }}
            >
              monitoring
            </span>
          </div>
        </div>
      </div>
    </section>

    {/* Stock Detail Modal */}
    {selectedStock && (
      <HoldingDetailModal
        holding={selectedStock}
        onClose={() => setSelectedStock(null)}
      />
    )}
    </>
  );
}
