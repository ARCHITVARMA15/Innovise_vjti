'use client';

import type { AssetBreakdown } from '@/lib/types/investment';

interface Props {
  data: AssetBreakdown;
}

export default function AssetBreakdownCard({ data }: Props) {
  // Build SVG donut arcs: circumference of r=16 circle = 2π*16 ≈ 100.53
  // We use stroke-dasharray to represent each segment on the same circle,
  // offset by the cumulative sum of previous segments.
  const CIRC = 100.53;
  let offset = 0;

  const arcs = data.items.map(item => {
    const dash = (item.percentage / 100) * CIRC;
    const dashOffset = -offset;
    offset += dash;
    return { ...item, dash, dashOffset };
  });

  return (
    <div className="space-y-6">
      <h3
        className="text-xl font-extrabold tracking-tight"
        style={{ color: '#0f172a', fontFamily: 'Manrope, sans-serif' }}
      >
        Asset Breakdown
      </h3>

      <div
        className="p-8 rounded-xl space-y-8 flex flex-col justify-center"
        style={{
          backgroundColor: '#ffffff',
          boxShadow: '24px 0 40px rgba(11,28,48,0.03)',
        }}
      >
        {/* SVG Donut */}
        <div className="relative w-48 h-48 mx-auto flex items-center justify-center">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
            {/* Track */}
            <circle cx="18" cy="18" r="16" fill="none" stroke="#eff4ff" strokeWidth="4" />
            {/* Segments */}
            {arcs.map((arc, i) => (
              <circle
                key={i}
                cx="18"
                cy="18"
                r="16"
                fill="none"
                stroke={arc.color}
                strokeWidth="4"
                strokeDasharray={`${arc.dash} ${CIRC - arc.dash}`}
                strokeDashoffset={arc.dashOffset}
              />
            ))}
          </svg>
          {/* Center label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span
              className="text-xs uppercase tracking-widest"
              style={{ color: '#94a3b8', fontFamily: 'Inter, sans-serif' }}
            >
              Target
            </span>
            <span
              className="text-lg font-bold"
              style={{ color: '#0f172a', fontFamily: 'Manrope, sans-serif' }}
            >
              {data.targetPercent}%
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="space-y-4">
          {data.items.map((item, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span
                  className="text-sm font-medium"
                  style={{ color: '#334155', fontFamily: 'Inter, sans-serif' }}
                >
                  {item.label}
                </span>
              </div>
              <span
                className="text-sm font-bold"
                style={{ color: '#0f172a', fontFamily: 'Inter, sans-serif' }}
              >
                {item.percentage.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
