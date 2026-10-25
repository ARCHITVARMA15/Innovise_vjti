'use client';

import type { DataSnapshot } from '@/lib/types/agent';

interface Props {
  snapshot: DataSnapshot;
}

export default function DataCard({ snapshot }: Props) {
  if (snapshot.type === 'stock_quote') {
    return <StockQuoteCard label={snapshot.label} data={snapshot.data} />;
  }
  if (snapshot.type === 'chart_data') {
    return <TrendCard label={snapshot.label} data={snapshot.data} />;
  }
  if (snapshot.type === 'portfolio_summary') {
    return <PortfolioCard label={snapshot.label} data={snapshot.data} />;
  }
  return <GenericCard label={snapshot.label} data={snapshot.data} />;
}

function StockQuoteCard({ label, data }: { label: string; data: Record<string, unknown> }) {
  const price = data.price as number | null;
  const change = data.change_percent as number | null;
  const isPositive = (change ?? 0) >= 0;

  return (
    <div
      className="p-3 rounded-lg"
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid rgba(198,198,205,0.15)',
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <span
          className="text-[13px] font-bold"
          style={{ color: '#0f172a', fontFamily: 'Manrope, sans-serif' }}
        >
          {label}
        </span>
        {data.sector != null && (
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded"
            style={{ backgroundColor: '#f1f5f9', color: '#64748b', fontFamily: 'Inter, sans-serif' }}
          >
            {String(data.sector)}
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-2 mb-2">
        <span
          className="text-lg font-bold"
          style={{ color: '#0f172a', fontFamily: 'Manrope, sans-serif' }}
        >
          {price != null ? formatNumber(price) : 'N/A'}
        </span>
        {change != null && (
          <span
            className="text-[12px] font-bold"
            style={{ color: isPositive ? '#009668' : '#ba1a1a', fontFamily: 'Inter, sans-serif' }}
          >
            {isPositive ? '↑' : '↓'} {Math.abs(change).toFixed(2)}%
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {data.pe_ratio != null && <MiniStat label="PE" value={String(Number(data.pe_ratio).toFixed(1))} />}
        {data.market_cap != null && <MiniStat label="MCap" value={formatLargeNumber(data.market_cap as number)} />}
        {data['52w_high'] != null && <MiniStat label="52w H" value={formatNumber(data['52w_high'] as number)} />}
        {data['52w_low'] != null && <MiniStat label="52w L" value={formatNumber(data['52w_low'] as number)} />}
      </div>
    </div>
  );
}

function PortfolioCard({ label, data }: { label: string; data: Record<string, unknown> }) {
  const pnlPct = data.total_pnl_percent as number | null;
  const isPositive = (pnlPct ?? 0) >= 0;

  return (
    <div
      className="p-3 rounded-lg"
      style={{
        backgroundColor: '#131b2e',
        border: '1px solid rgba(57,184,253,0.15)',
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className="material-symbols-outlined"
          style={{ fontSize: '14px', color: '#39b8fd', fontVariationSettings: "'FILL' 1, 'wght' 400" }}
        >
          account_balance_wallet
        </span>
        <span
          className="text-[12px] font-bold"
          style={{ color: '#ffffff', fontFamily: 'Manrope, sans-serif' }}
        >
          {label}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {data.total_value != null && (
          <MiniStat label="Value" value={formatLargeNumber(data.total_value as number)} light />
        )}
        {data.total_pnl != null && (
          <MiniStat
            label="P&L"
            value={`${isPositive ? '+' : ''}${formatLargeNumber(data.total_pnl as number)}`}
            light
            valueColor={isPositive ? '#4edea3' : '#ff8a80'}
          />
        )}
        {data.cash != null && (
          <MiniStat label="Cash" value={formatLargeNumber(data.cash as number)} light />
        )}
        {data.holdings_count != null && (
          <MiniStat label="Holdings" value={String(data.holdings_count)} light />
        )}
      </div>
    </div>
  );
}

function TrendCard({ label, data }: { label: string; data: Record<string, unknown> }) {
  const points = (data.points as Array<{ date: string; close: number }>) || [];
  if (points.length < 2) return null;

  const closes = points.map((p) => p.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;
  const first = closes[0];
  const last = closes[closes.length - 1];
  const isUp = last >= first;
  const color = isUp ? '#009668' : '#ba1a1a';

  const w = 240;
  const h = 60;
  const pathPoints = closes
    .map((c, i) => {
      const x = (i / (closes.length - 1)) * w;
      const y = h - ((c - min) / range) * h;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div
      className="p-3 rounded-lg"
      style={{ backgroundColor: '#ffffff', border: '1px solid rgba(198,198,205,0.15)' }}
    >
      <div className="flex items-center justify-between mb-2">
        <span
          className="text-[12px] font-bold"
          style={{ color: '#0f172a', fontFamily: 'Manrope, sans-serif' }}
        >
          {label}
        </span>
        <span
          className="text-[11px] font-bold"
          style={{ color, fontFamily: 'Inter, sans-serif' }}
        >
          {isUp ? '↑' : '↓'} {Math.abs(((last - first) / first) * 100).toFixed(1)}%
        </span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none">
        <polyline
          points={pathPoints}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="flex justify-between mt-1">
        <span className="text-[10px]" style={{ color: '#94a3b8', fontFamily: 'Inter, sans-serif' }}>
          {points[0].date}
        </span>
        <span className="text-[10px]" style={{ color: '#94a3b8', fontFamily: 'Inter, sans-serif' }}>
          {points[points.length - 1].date}
        </span>
      </div>
    </div>
  );
}

function GenericCard({ label, data }: { label: string; data: Record<string, unknown> }) {
  return (
    <div
      className="p-3 rounded-lg"
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid rgba(198,198,205,0.15)',
      }}
    >
      <span
        className="text-[12px] font-bold block mb-1"
        style={{ color: '#0f172a', fontFamily: 'Manrope, sans-serif' }}
      >
        {label}
      </span>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {Object.entries(data).slice(0, 6).map(([key, val]) => (
          <MiniStat key={key} label={key} value={String(val ?? 'N/A')} />
        ))}
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  light,
  valueColor,
}: {
  label: string;
  value: string;
  light?: boolean;
  valueColor?: string;
}) {
  return (
    <div>
      <span
        className="text-[10px] uppercase tracking-wider block"
        style={{ color: light ? '#7c839b' : '#94a3b8', fontFamily: 'Inter, sans-serif' }}
      >
        {label}
      </span>
      <span
        className="text-[12px] font-bold"
        style={{ color: valueColor ?? (light ? '#ffffff' : '#0f172a'), fontFamily: 'Inter, sans-serif' }}
      >
        {value}
      </span>
    </div>
  );
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function formatLargeNumber(n: number): string {
  if (n == null) return 'N/A';
  const abs = Math.abs(n);
  if (abs >= 1e12) return `${(n / 1e12).toFixed(1)}T`;
  if (abs >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return formatNumber(n);
}
