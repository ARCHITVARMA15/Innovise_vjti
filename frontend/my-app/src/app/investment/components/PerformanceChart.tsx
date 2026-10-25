'use client';

import { useState, useRef, MouseEvent } from 'react';
import type { PerformanceHistory, HistoryPeriod } from '@/lib/types/investment';

interface Props {
  data: Record<HistoryPeriod, PerformanceHistory>;
}

interface TooltipData {
  x: number;
  y: number;
  value: number;
  date: string;
  show: boolean;
}

const PERIODS: HistoryPeriod[] = ['1M', '3M', '1Y', 'ALL'];

export default function PerformanceChart({ data }: Props) {
  const [activePeriod, setActivePeriod] = useState<HistoryPeriod>('1M');
  const [tooltip, setTooltip] = useState<TooltipData>({ x: 0, y: 0, value: 0, date: '', show: false });
  const svgRef = useRef<SVGSVGElement>(null);
  const history = data[activePeriod];

  // Normalize values into SVG coordinates (1000 x 256 viewBox)
  // Support both old OHLCV format and new {date, value} format
  const values = history.points.map(p => ('close' in p ? p.close : (p as any).value));
  
  // Handle empty data
  if (values.length === 0) {
    return <div className="text-center p-8">No performance data available</div>;
  }

  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  const svgPoints = values.map((val, i) => {
    const x = values.length > 1 ? (i / (values.length - 1)) * 1000 : 500;
    const y = 256 - ((val - minVal) / range) * 220 - 18; // 18px top padding
    return `${x},${y}`;
  });

  const linePath = 'M' + svgPoints.join(' L');
  const areaPath = linePath + ` L1000,256 L0,256 Z`;

  // Bar heights for background decoration (normalized 0–100)
  const barHeights = [25, 40, 33, 60, 80, 67, 100];

  // Find peak index
  const peakIdx = values.indexOf(maxVal);
  const peakX = values.length > 1 ? (peakIdx / (values.length - 1)) * 1000 : 500;
  const peakY = 256 - ((maxVal - minVal) / range) * 220 - 18;
  const fmtPeak = (history.peakValue / 1_000_000).toFixed(2);

  // Handle mouse move for tooltip
  const handleMouseMove = (e: MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const svgX = (mouseX / rect.width) * 1000;
    
    // Find nearest data point
    const dataIndex = Math.round((svgX / 1000) * (values.length - 1));
    const clampedIndex = Math.max(0, Math.min(values.length - 1, dataIndex));
    
    const value = values[clampedIndex];
    const point = history.points[clampedIndex];
    const date = point.date;
    
    const pointX = values.length > 1 ? (clampedIndex / (values.length - 1)) * 1000 : 500;
    const pointY = 256 - ((value - minVal) / range) * 220 - 18;
    
    setTooltip({
      x: pointX,
      y: pointY,
      value,
      date,
      show: true,
    });
  };

  const handleMouseLeave = () => {
    setTooltip(prev => ({ ...prev, show: false }));
  };

  // Format value for display
  const formatValue = (val: number) => {
    if (val >= 1_000_000) return `₹${(val / 1_000_000).toFixed(2)}M`;
    if (val >= 1_000) return `₹${(val / 1_000).toFixed(1)}K`;
    return `₹${val.toFixed(0)}`;
  };

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Generate Y-axis labels
  const yAxisLabels = [
    { value: maxVal, label: formatValue(maxVal) },
    { value: (maxVal + minVal) / 2, label: formatValue((maxVal + minVal) / 2) },
    { value: minVal, label: formatValue(minVal) },
  ];

  // Generate X-axis labels
  const xAxisLabels = [
    { index: 0, label: formatDate(history.points[0].date) },
    { index: Math.floor(history.points.length / 2), label: formatDate(history.points[Math.floor(history.points.length / 2)].date) },
    { index: history.points.length - 1, label: formatDate(history.points[history.points.length - 1].date) },
  ];

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex justify-between items-end">
        <div>
          <h3
            className="text-xl font-extrabold tracking-tight"
            style={{ color: '#0f172a', fontFamily: 'Manrope, sans-serif' }}
          >
            Performance History
          </h3>
          <p
            className="text-sm mt-1"
            style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}
          >
            Portfolio growth over the selected period
          </p>
        </div>

        {/* Period tabs */}
        <div
          className="flex rounded-lg p-1"
          style={{ backgroundColor: '#e5eeff' }}
        >
          {PERIODS.map(p => (
            <button
              key={p}
              onClick={() => setActivePeriod(p)}
              className="px-4 py-1.5 text-xs font-bold rounded-md transition-all"
              style={{
                backgroundColor: activePeriod === p ? '#ffffff' : 'transparent',
                color: activePeriod === p ? '#0f172a' : '#64748b',
                boxShadow: activePeriod === p ? '0 1px 4px rgba(11,28,48,0.08)' : 'none',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div
        className="h-80 w-full rounded-xl p-8 relative overflow-hidden group"
        style={{ backgroundColor: '#ffffff', boxShadow: '24px 0 40px rgba(11,28,48,0.03)' }}
      >
        {/* Background bar decoration */}
        <div className="absolute inset-0 flex items-end px-4 gap-2 opacity-[0.06] pointer-events-none">
          {barHeights.map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t-sm"
              style={{ backgroundColor: '#000000', height: `${h}%` }}
            />
          ))}
        </div>

        {/* SVG chart */}
        <div className="relative z-10 w-full h-full">
          {/* Y-axis label */}
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 -rotate-90 origin-center text-xs font-semibold"
            style={{ color: '#64748b', fontFamily: 'Inter, sans-serif', left: '-40px' }}
          >
            Portfolio Value
          </div>

          {/* Y-axis values */}
          <div className="absolute left-0 top-0 h-full flex flex-col justify-between py-2" style={{ width: '60px' }}>
            {yAxisLabels.map((label, i) => (
              <div
                key={i}
                className="text-[10px] font-medium text-right pr-2"
                style={{ color: '#94a3b8', fontFamily: 'Inter, sans-serif' }}
              >
                {label.label}
              </div>
            ))}
          </div>

          <div className="relative w-full h-full border-l border-b ml-16" style={{ borderColor: '#f1f5f9' }}>
            <svg
              ref={svgRef}
              className="w-full h-64 overflow-visible cursor-crosshair"
              viewBox="0 0 1000 256"
              preserveAspectRatio="none"
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            >
              <defs>
                <linearGradient id="perfGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="rgba(57,184,253,0.22)" />
                  <stop offset="100%" stopColor="rgba(57,184,253,0)" />
                </linearGradient>
              </defs>

              {/* Area fill */}
              <path d={areaPath} fill="url(#perfGradient)" />

              {/* Line */}
              <path d={linePath} fill="none" stroke="#006591" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

              {/* Hover crosshair */}
              {tooltip.show && (
                <>
                  {/* Vertical line */}
                  <line
                    x1={tooltip.x}
                    y1="0"
                    x2={tooltip.x}
                    y2="256"
                    stroke="#94a3b8"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                    opacity="0.5"
                  />
                  {/* Horizontal line */}
                  <line
                    x1="0"
                    y1={tooltip.y}
                    x2="1000"
                    y2={tooltip.y}
                    stroke="#94a3b8"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                    opacity="0.5"
                  />
                  {/* Hover dot */}
                  <circle
                    cx={tooltip.x}
                    cy={tooltip.y}
                    r="5"
                    fill="#006591"
                    stroke="#ffffff"
                    strokeWidth="2"
                  />
                </>
              )}

              {/* Peak dot */}
              <circle
                cx={peakX}
                cy={peakY}
                r="6"
                fill="#006591"
                className="group-hover:scale-125 transition-transform"
                style={{ transformOrigin: `${peakX}px ${peakY}px` }}
              />
            </svg>

            {/* X-axis labels */}
            <div className="absolute bottom-0 left-0 w-full flex justify-between px-2 pb-1" style={{ transform: 'translateY(20px)' }}>
              {xAxisLabels.map((label, i) => (
                <div
                  key={i}
                  className="text-[10px] font-medium"
                  style={{ color: '#94a3b8', fontFamily: 'Inter, sans-serif' }}
                >
                  {label.label}
                </div>
              ))}
            </div>

            {/* X-axis label */}
            <div
              className="absolute bottom-0 left-1/2 -translate-x-1/2 text-xs font-semibold"
              style={{ color: '#64748b', fontFamily: 'Inter, sans-serif', transform: 'translate(-50%, 40px)' }}
            >
              Date
            </div>

            {/* Hover tooltip */}
            {tooltip.show && (
              <div
                className="absolute pointer-events-none z-50"
                style={{
                  left: `${(tooltip.x / 1000) * 100}%`,
                  top: `${(tooltip.y / 256) * 100}%`,
                  transform: 'translate(-50%, -120%)',
                }}
              >
                <div
                  className="px-3 py-2 rounded-lg shadow-lg"
                  style={{
                    backgroundColor: '#0f172a',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  <div className="text-white text-sm font-bold">
                    {formatValue(tooltip.value)}
                  </div>
                  <div className="text-gray-400 text-xs mt-0.5">
                    {formatDate(tooltip.date)}
                  </div>
                </div>
                {/* Tooltip arrow */}
                <div
                  className="absolute left-1/2 -translate-x-1/2"
                  style={{
                    bottom: '-4px',
                    width: 0,
                    height: 0,
                    borderLeft: '4px solid transparent',
                    borderRight: '4px solid transparent',
                    borderTop: '4px solid #0f172a',
                  }}
                />
              </div>
            )}

            {/* Peak label */}
            <div
              className="absolute top-4 right-4 text-white text-[10px] font-bold px-2 py-1 rounded"
              style={{ backgroundColor: '#000000', fontFamily: 'Inter, sans-serif' }}
            >
              PEAK: ₹{fmtPeak}M
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
