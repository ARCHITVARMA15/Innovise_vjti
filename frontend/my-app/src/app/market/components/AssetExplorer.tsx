'use client';

import { useState } from 'react';
import type { AssetTab, AssetRow, VolatilityLevel } from '@/lib/types/market';

interface Props {
  data: Record<AssetTab, AssetRow[]>;
}

const TABS: AssetTab[] = ['STOCKS', 'OPTIONS', 'CRYPTO'];

const volatilityColor: Record<VolatilityLevel, string> = {
  Low:    '#009668',
  Medium: '#C9A84C',
  High:   '#ba1a1a',
};

export default function AssetExplorer({ data }: Props) {
  const [activeTab, setActiveTab] = useState<AssetTab>('STOCKS');
  const rows = data[activeTab];

  return (
    <section className="space-y-8">
      {/* Header + tabs */}
      <div
        className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pb-4"
        style={{ borderBottom: '1px solid rgba(198,198,205,0.3)' }}
      >
        <h3
          className="text-3xl font-extrabold tracking-tighter"
          style={{ color: '#0f172a', fontFamily: 'Manrope, sans-serif' }}
        >
          Asset Explorer
        </h3>

        <div className="flex gap-8">
          {TABS.map(tab => {
            const isActive = tab === activeTab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="text-sm font-bold tracking-widest uppercase pb-2 transition-colors"
                style={{
                  color: isActive ? '#000000' : '#45464d',
                  borderBottom: isActive ? '2px solid #000000' : '2px solid transparent',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                {tab}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ backgroundColor: '#ffffff', boxShadow: '0 24px 40px -15px rgba(11,28,48,0.04)' }}
      >
        <table className="w-full text-left">
          <thead style={{ backgroundColor: '#eff4ff', borderBottom: '1px solid rgba(198,198,205,0.1)' }}>
            <tr>
              {['Ticker', 'Price', '24h Change', 'Volatility', 'Exp Growth', ''].map((col, i) => (
                <th
                  key={i}
                  className="px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em]"
                  style={{ color: '#7c839b', fontFamily: 'Inter, sans-serif' }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const isUp = row.changePercent24h >= 0;
              return (
                <tr
                  key={row.id}
                  className="transition-colors"
                  style={{ borderTop: i > 0 ? '1px solid rgba(239,244,255,0.8)' : 'none' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(239,244,255,0.35)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                >
                  {/* Ticker + name */}
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded flex items-center justify-center font-bold text-xs"
                        style={{ backgroundColor: '#dce9ff', color: '#000000', fontFamily: 'Inter, sans-serif' }}
                      >
                        {row.ticker.length <= 4 ? row.ticker : row.ticker.slice(0, 4)}
                      </div>
                      <div>
                        <div
                          className="font-bold text-sm"
                          style={{ color: '#0f172a', fontFamily: 'Inter, sans-serif' }}
                        >
                          {row.name}
                        </div>
                        <div
                          className="text-[10px] font-medium"
                          style={{ color: '#45464d', fontFamily: 'Inter, sans-serif' }}
                        >
                          {row.sector}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Price */}
                  <td
                    className="px-8 py-6 font-bold text-sm"
                    style={{ color: '#0f172a', fontFamily: 'Manrope, sans-serif' }}
                  >
                    ${row.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>

                  {/* 24h change */}
                  <td
                    className="px-8 py-6 font-bold text-sm"
                    style={{ color: isUp ? '#4edea3' : '#ba1a1a', fontFamily: 'Inter, sans-serif' }}
                  >
                    {isUp ? '+' : ''}{row.changePercent24h.toFixed(2)}%
                  </td>

                  {/* Volatility */}
                  <td
                    className="px-8 py-6 text-sm"
                    style={{ color: volatilityColor[row.volatility], fontFamily: 'Inter, sans-serif' }}
                  >
                    {row.volatility}
                  </td>

                  {/* Exp Growth */}
                  <td className="px-8 py-6">
                    {row.expGrowthPercent > 0 ? (
                      <span
                        className="text-[10px] px-2 py-1 rounded font-bold"
                        style={{ backgroundColor: '#dce9ff', color: '#000000', fontFamily: 'Inter, sans-serif' }}
                      >
                        {row.expGrowthPercent}%
                      </span>
                    ) : (
                      <span style={{ color: '#94a3b8', fontFamily: 'Inter, sans-serif', fontSize: '12px' }}>—</span>
                    )}
                  </td>

                  {/* More actions */}
                  <td className="px-8 py-6 text-right">
                    <button
                      className="material-symbols-outlined transition-colors"
                      style={{
                        fontSize: '20px',
                        color: '#76777d',
                        fontVariationSettings: "'FILL' 0, 'wght' 300",
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#000000'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#76777d'; }}
                    >
                      more_vert
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
