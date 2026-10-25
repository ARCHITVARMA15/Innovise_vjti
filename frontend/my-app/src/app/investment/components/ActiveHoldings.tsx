'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Holding } from '@/lib/types/investment';
import HoldingDetailModal from './HoldingDetailModal';
import BuyAssetModal from './BuyAssetModal';
import SellAssetModal from './SellAssetModal';

interface Props {
  data: Holding[];
}

function Sparkline({ points, positive }: { points: number[]; positive: boolean }) {
  const maxY = Math.max(...points);
  const minY = Math.min(...points);
  const range = maxY - minY || 1;
  const svgPoints = points
    .map((y, i) => {
      const x = (i / (points.length - 1)) * 100;
      const sy = 20 - ((y - minY) / range) * 18 - 1;
      return `${x},${sy}`;
    })
    .join(' L');
  return (
    <svg className="h-6 w-24 mx-auto" viewBox="0 0 100 20">
      <path
        d={`M${svgPoints}`}
        fill="none"
        stroke={positive ? '#009668' : '#ba1a1a'}
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function ActiveHoldings({ data }: Props) {
  const [selected, setSelected] = useState<Holding | null>(null);
  const [isBuyModalOpen, setIsBuyModalOpen] = useState(false);
  const [isSellModalOpen, setIsSellModalOpen] = useState(false);

  return (
    <>
      <section className="space-y-6">
      <div className="flex justify-between items-center">
        <h3
          className="text-xl font-extrabold tracking-tight"
          style={{ color: '#0f172a', fontFamily: 'Manrope, sans-serif' }}
        >
          Active Holdings
        </h3>
        <div className="flex gap-3">
          <button
            onClick={() => setIsBuyModalOpen(true)}
            className="px-4 py-2 bg-[#009668] text-white text-sm font-bold rounded-lg shadow-sm hover:bg-[#007a55] transition-all flex items-center gap-1.5"
            style={{ fontFamily: 'Manrope, sans-serif' }}
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            Buy Asset
          </button>
          <button
            onClick={() => setIsSellModalOpen(true)}
            className="px-4 py-2 bg-white border border-[#e2e8f0] text-[#ba1a1a] text-sm font-bold rounded-lg shadow-sm hover:bg-[#fff0f2] hover:border-[#fda4af] transition-all flex items-center gap-1.5"
            style={{ fontFamily: 'Manrope, sans-serif' }}
          >
            <span className="material-symbols-outlined text-[18px]">remove_circle</span>
            Sell Asset
          </button>
        </div>
      </div>

      <div
        className="rounded-xl overflow-hidden"
        style={{ backgroundColor: '#ffffff', boxShadow: '24px 0 40px rgba(11,28,48,0.03)' }}
      >
        <table className="w-full text-left border-collapse">
          <thead>
            <tr style={{ backgroundColor: '#eff4ff' }}>
              {['Ticker / Asset', 'Shares', 'Cost Basis', 'Price', 'Market Value', 'Return %', 'Trend'].map(
                (col, i) => (
                  <th
                    key={col}
                    className={`py-5 px-6 text-[10px] tracking-widest uppercase font-bold ${
                      i === 0 ? '' : i === 6 ? 'text-center' : 'text-right'
                    }`}
                    style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}
                  >
                    {col}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {data.map((h, i) => {
              const isPositive = h.returnPercent >= 0;
              return (
                <tr
                  key={h.id}
                  className="transition-colors"
                  style={{ borderTop: i > 0 ? '1px solid #f1f5f9' : 'none', cursor: 'pointer' }}
                  onClick={() => setSelected(h)}
                  onMouseEnter={e =>
                    ((e.currentTarget as HTMLTableRowElement).style.backgroundColor = 'rgba(239,244,255,0.6)')
                  }
                  onMouseLeave={e =>
                    ((e.currentTarget as HTMLTableRowElement).style.backgroundColor = 'transparent')
                  }
                >
                  {/* Ticker / Asset */}
                  <td className="py-5 px-6">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-xs"
                        style={{
                          backgroundColor: '#e5eeff',
                          color: '#000000',
                          fontFamily: 'Inter, sans-serif',
                        }}
                      >
                        {h.ticker}
                      </div>
                      <div>
                        <div
                          className="font-bold text-sm"
                          style={{ color: '#0f172a', fontFamily: 'Inter, sans-serif' }}
                        >
                          {h.name}
                        </div>
                        <div
                          className="text-[10px] tracking-wider uppercase"
                          style={{ color: '#94a3b8', fontFamily: 'Inter, sans-serif' }}
                        >
                          {h.sector}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Shares */}
                  <td
                    className="py-5 px-6 text-right font-medium text-sm"
                    style={{ color: '#0b1c30', fontFamily: 'Inter, sans-serif' }}
                  >
                    {h.shares.toFixed(2)}
                  </td>

                  {/* Cost Basis */}
                  <td
                    className="py-5 px-6 text-right font-medium text-sm"
                    style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}
                  >
                    ${h.costBasis.toFixed(2)}
                  </td>

                  {/* Current Price */}
                  <td
                    className="py-5 px-6 text-right font-bold text-sm"
                    style={{ color: '#0f172a', fontFamily: 'Inter, sans-serif' }}
                  >
                    ${h.currentPrice.toFixed(2)}
                  </td>

                  {/* Market Value */}
                  <td
                    className="py-5 px-6 text-right font-bold text-sm"
                    style={{ color: '#0f172a', fontFamily: 'Inter, sans-serif' }}
                  >
                    ${h.marketValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>

                  {/* Return % */}
                  <td className="py-5 px-6 text-right">
                    <span
                      className="font-bold text-sm"
                      style={{ color: isPositive ? '#009668' : '#ba1a1a' }}
                    >
                      {isPositive ? '+' : ''}{h.returnPercent.toFixed(1)}%
                    </span>
                  </td>

                  {/* Trend sparkline */}
                  <td className="py-5 px-6">
                    <Sparkline points={h.sparkline} positive={isPositive} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>

      {selected && (
        <HoldingDetailModal
          holding={selected}
          onClose={() => setSelected(null)}
        />
      )}
      
      {isBuyModalOpen && (
        <BuyAssetModal 
          onClose={() => setIsBuyModalOpen(false)}
          onSuccess={() => window.location.reload()}
        />
      )}
      
      {isSellModalOpen && (
        <SellAssetModal 
          holdings={data}
          onClose={() => setIsSellModalOpen(false)}
          onSuccess={() => window.location.reload()}
        />
      )}
    </>
  );
}
