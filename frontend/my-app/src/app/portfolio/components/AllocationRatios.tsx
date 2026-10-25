'use client';

import type { AllocationCategory, AllocationStatus } from '@/lib/types/portfolio';

interface Props {
  data: AllocationCategory[];
}

const statusStyle: Record<AllocationStatus, { bg: string; text: string; label: string }> = {
  OVERWEIGHT:  { bg: '#ffdad6', text: '#ba1a1a', label: 'OVERWEIGHT' },
  UNDERWEIGHT: { bg: '#eff4ff', text: '#006591', label: 'UNDERWEIGHT' },
  ALIGNED:     { bg: '#d7f4e8', text: '#005236', label: 'ALIGNED' },
};

export default function AllocationRatios({ data }: Props) {
  return (
    <section className="space-y-6">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div>
          <p
            className="text-[10px] uppercase tracking-[0.15em] font-bold mb-1"
            style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}
          >
            Asset Allocation
          </p>
          <h3
            className="text-2xl font-extrabold tracking-tight"
            style={{ color: '#0f172a', fontFamily: 'Manrope, sans-serif' }}
          >
            Current vs. Target Ratios
          </h3>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-5">
          {[
            { dot: '#0f172a', label: 'Current' },
            { dot: '#006591', label: 'Target' },
          ].map(({ dot, label }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: dot }} />
              <span
                className="text-xs font-medium"
                style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}
              >
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Category cards */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-0 rounded-xl overflow-hidden"
        style={{ backgroundColor: '#ffffff', boxShadow: '0 24px 40px rgba(11,28,48,0.05)' }}
      >
        {data.map((cat, i) => {
          const ss = statusStyle[cat.status];
          const isLast = i === data.length - 1;
          return (
            <div
              key={cat.id}
              className="p-8 flex flex-col gap-5"
              style={{
                borderRight: !isLast ? '1px solid rgba(226,232,240,0.5)' : 'none',
              }}
            >
              {/* Icon + status badge */}
              <div className="flex items-center justify-between">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: '#f8f9ff' }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{
                      fontSize: '18px',
                      color: '#475569',
                      fontVariationSettings: "'FILL' 0, 'wght' 300",
                    }}
                  >
                    {cat.icon}
                  </span>
                </div>
                <span
                  className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                  style={{ backgroundColor: ss.bg, color: ss.text, fontFamily: 'Inter, sans-serif' }}
                >
                  {ss.label}
                </span>
              </div>

              {/* Label */}
              <p
                className="text-xs font-medium"
                style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}
              >
                {cat.label}
              </p>

              {/* Current % + target */}
              <div>
                <div className="flex items-baseline gap-1">
                  <span
                    className="text-3xl font-extrabold leading-none"
                    style={{ color: '#0f172a', fontFamily: 'Manrope, sans-serif' }}
                  >
                    {cat.currentPercent}%
                  </span>
                  <span
                    className="text-xs font-medium"
                    style={{ color: '#94a3b8', fontFamily: 'Inter, sans-serif' }}
                  >
                    vs {cat.targetPercent}% target
                  </span>
                </div>
              </div>

              {/* Dual bar: current (dark) + target (blue) */}
              <div className="space-y-1.5">
                {/* Current bar */}
                <div
                  className="h-1.5 rounded-full overflow-hidden"
                  style={{ backgroundColor: '#f1f5f9' }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${cat.currentPercent}%`, backgroundColor: '#0f172a' }}
                  />
                </div>
                {/* Target bar */}
                <div
                  className="h-1.5 rounded-full overflow-hidden"
                  style={{ backgroundColor: '#f1f5f9' }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${cat.targetPercent}%`, backgroundColor: '#006591' }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
