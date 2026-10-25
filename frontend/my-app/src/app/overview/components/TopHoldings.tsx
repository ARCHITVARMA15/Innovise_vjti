'use client';

import type { Holding } from '@/lib/types/overview';
import { formatPercent } from '@/lib/utils/format';

interface Props {
  data: Holding[];
}

export default function TopHoldings({ data }: Props) {
  return (
    <div
      className="lg:col-span-2 rounded-xl overflow-hidden"
      style={{ backgroundColor: '#ffffff', boxShadow: '0 24px 40px rgba(11,28,48,0.05)' }}
    >
      {/* Header */}
      <div
        className="px-8 py-6 flex justify-between items-center"
        style={{ borderBottom: '1px solid rgba(198,198,205,0.08)' }}
      >
        <h3
          className="text-lg font-bold"
          style={{ color: '#000000', fontFamily: 'Manrope, sans-serif' }}
        >
          Top Performing Holdings
        </h3>
        <button
          className="text-[11px] uppercase font-bold tracking-widest transition-colors"
          style={{ color: '#006591', fontFamily: 'Inter, sans-serif' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#000000'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#006591'; }}
        >
          View All
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr
              className="text-[10px] uppercase tracking-[0.15em] font-bold"
              style={{ color: 'rgba(69,70,77,0.6)', fontFamily: 'Inter, sans-serif' }}
            >
              <th className="px-8 py-4 font-bold">Asset</th>
              <th className="px-4 py-4 font-bold">Ticker</th>
              <th className="px-4 py-4 text-right font-bold">Price</th>
              <th className="px-8 py-4 text-right font-bold">Daily Change</th>
            </tr>
          </thead>
          <tbody style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.875rem' }}>
            {data.map((holding, i) => {
              const isPositive = holding.dailyChangePercent >= 0;
              const isAlt = i % 2 !== 0;
              return (
                <tr
                  key={holding.id ?? i}
                  style={{
                    backgroundColor: isAlt ? 'rgba(239,244,255,0.3)' : 'transparent',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLTableRowElement).style.backgroundColor = 'rgba(239,244,255,0.6)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLTableRowElement).style.backgroundColor = isAlt
                      ? 'rgba(239,244,255,0.3)'
                      : 'transparent';
                  }}
                >
                  <td
                    className="px-8 py-4 font-semibold"
                    style={{ color: '#000000' }}
                  >
                    {holding.name}
                  </td>
                  <td className="px-4 py-4" style={{ color: '#45464d' }}>
                    {holding.ticker}
                  </td>
                  <td className="px-4 py-4 text-right font-medium" style={{ color: '#0b1c30' }}>
                    ${holding.price.toFixed(2)}
                  </td>
                  <td
                    className="px-8 py-4 text-right font-bold"
                    style={{ color: isPositive ? '#4edea3' : '#ba1a1a' }}
                  >
                    {formatPercent(holding.dailyChangePercent)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
