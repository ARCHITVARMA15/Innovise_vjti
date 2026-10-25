'use client';

import type { PortfolioSummary } from '@/lib/types/overview';
import { formatCurrency, formatPercent } from '@/lib/utils/format';

interface Props {
  data: PortfolioSummary;
}

export default function PortfolioHero({ data }: Props) {
  const {
    totalAUM,
    totalAUMCents,
    quarterlyChangePercent,
    cashFlow,
    dividendsYTD,
    riskScore,
    riskLabel,
    chartPoints,
  } = data;

  // Build SVG path from normalized chartPoints array
  const svgWidth = 400;
  const svgHeight = 100;
  const pts = chartPoints;
  const pathD = pts
    .map((y, i) => {
      const x = (i / (pts.length - 1)) * svgWidth;
      const sy = y; // already in 0–100 scale
      return `${i === 0 ? 'M' : 'L'}${x},${sy}`;
    })
    .join(' ');
  const areaD = `${pathD} L${svgWidth},${svgHeight} L0,${svgHeight} Z`;

  const formattedAUM = formatCurrency(totalAUM).replace('₹', '');

  return (
    <div
      className="lg:col-span-2 p-8 rounded-xl relative overflow-hidden flex flex-col justify-between"
      style={{
        backgroundColor: '#ffffff',
        boxShadow: '0 24px 40px rgba(11,28,48,0.05)',
        minHeight: '320px',
      }}
    >
      {/* Top content */}
      <div className="z-10 relative">
        <p
          className="text-[11px] uppercase tracking-[0.1em] font-bold mb-2"
          style={{ color: '#45464d', fontFamily: 'Inter, sans-serif' }}
        >
          Total Assets Under Management
        </p>

        <h2
          className="leading-none tracking-tighter"
          style={{
            fontFamily: 'Manrope, sans-serif',
            fontSize: '3.5rem',
            fontWeight: 800,
            color: '#000000',
          }}
        >
          ₹{formattedAUM}
          <span
            className="font-medium"
            style={{ fontSize: '1.5rem', color: '#45464d' }}
          >
            .{String(totalAUMCents).padStart(2, '0')}
          </span>
        </h2>

        <div className="mt-4 flex items-center gap-2">
          <span
            className="font-bold text-xs px-2 py-1 rounded flex items-center gap-1"
            style={{
              backgroundColor: '#4edea3',
              color: '#002113',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '14px', fontVariationSettings: "'FILL' 0, 'wght' 400" }}
            >
              trending_up
            </span>
            {formatPercent(quarterlyChangePercent)}
          </span>
          <span
            className="text-sm font-medium"
            style={{ color: '#45464d', fontFamily: 'Inter, sans-serif' }}
          >
            vs last quarter
          </span>
        </div>
      </div>

      {/* SVG Chart — decorative background */}
      <div className="absolute bottom-0 left-0 w-full h-40 opacity-20 pointer-events-none">
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id="chartGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#006591" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#006591" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={pathD} fill="none" stroke="#006591" strokeWidth="2" />
          <path d={areaD} fill="url(#chartGrad)" />
        </svg>
      </div>

      {/* Bottom stats row */}
      <div
        className="z-10 relative grid grid-cols-3 gap-8 mt-12 pt-8"
        style={{ borderTop: '1px solid rgba(198,198,205,0.15)' }}
      >
        <div>
          <p
            className="text-[10px] uppercase font-bold tracking-wider mb-1"
            style={{ color: '#45464d', fontFamily: 'Inter, sans-serif' }}
          >
            Cash Flow
          </p>
          <p
            className="text-lg font-bold"
            style={{ color: '#000000', fontFamily: 'Manrope, sans-serif' }}
          >
            {formatCurrency(cashFlow)}
          </p>
        </div>
        <div>
          <p
            className="text-[10px] uppercase font-bold tracking-wider mb-1"
            style={{ color: '#45464d', fontFamily: 'Inter, sans-serif' }}
          >
            Dividends YTD
          </p>
          <p
            className="text-lg font-bold"
            style={{ color: '#000000', fontFamily: 'Manrope, sans-serif' }}
          >
            {formatCurrency(dividendsYTD)}
          </p>
        </div>
        <div>
          <p
            className="text-[10px] uppercase font-bold tracking-wider mb-1"
            style={{ color: '#45464d', fontFamily: 'Inter, sans-serif' }}
          >
            Risk Score
          </p>
          <p
            className="text-lg font-bold"
            style={{ color: '#006591', fontFamily: 'Manrope, sans-serif' }}
          >
            {riskLabel} ({riskScore}/10)
          </p>
        </div>
      </div>
    </div>
  );
}
