'use client';

import type { EvidenceItem } from '@/lib/types/agent';

interface Props {
  evidence: EvidenceItem[];
}

const SIGNAL_STYLES = {
  supporting: { icon: 'north_east', color: '#009668', bg: '#e6f9f1', label: 'Supporting' },
  conflicting: { icon: 'south_west', color: '#ba1a1a', bg: 'rgba(255,218,214,0.35)', label: 'Conflicting' },
  neutral: { icon: 'drag_handle', color: '#64748b', bg: '#f1f5f9', label: 'Neutral' },
} as const;

export default function EvidenceLedger({ evidence }: Props) {
  if (evidence.length === 0) return null;

  const sorted = [...evidence].sort((a, b) => b.confidence - a.confidence);
  const high = sorted.filter((e) => e.rating === 'high').length;
  const conflicting = sorted.filter((e) => e.signal === 'conflicting').length;
  const avg = Math.round((sorted.reduce((acc, e) => acc + e.confidence, 0) / sorted.length) * 100);

  return (
    <div>
      <SectionLabel icon="fact_check" label={`Evidence Ledger (${sorted.length})`} />

      <div
        className="mb-3 p-3 rounded-lg"
        style={{ backgroundColor: '#ffffff', border: '1px solid rgba(198,198,205,0.22)' }}
      >
        <div className="grid grid-cols-3 gap-2">
          <Metric label="Avg Confidence" value={`${avg}%`} color="#006591" />
          <Metric label="High Quality" value={`${high}`} color="#009668" />
          <Metric label="Conflicts" value={`${conflicting}`} color={conflicting > 0 ? '#ba1a1a' : '#64748b'} />
        </div>
      </div>

      <div className="space-y-2.5">
        {sorted.map((item) => {
          const style = SIGNAL_STYLES[item.signal];
          const width = Math.max(6, Math.min(100, Math.round(item.confidence * 100)));
          return (
            <div
              key={item.id}
              className="p-3 rounded-lg"
              style={{ backgroundColor: '#ffffff', border: '1px solid rgba(198,198,205,0.2)' }}
            >
              <div className="flex items-start gap-2">
                <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: style.bg }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '14px', color: style.color }}>
                    {style.icon}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ backgroundColor: style.bg, color: style.color, fontFamily: 'Inter, sans-serif' }}>
                      {style.label}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ backgroundColor: '#f1f5f9', color: '#64748b', fontFamily: 'Inter, sans-serif' }}>
                      {item.rating}
                    </span>
                    <span className="text-[10px] ml-auto" style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}>
                      Iteration {item.iteration}
                    </span>
                  </div>

                  <p className="text-[12px] font-semibold mt-1 leading-tight" style={{ color: '#0f172a', fontFamily: 'Inter, sans-serif' }}>
                    {item.source_title}
                  </p>

                  <div className="mt-2">
                    <div className="h-1.5 rounded-full" style={{ backgroundColor: '#e2e8f0' }}>
                      <div className="h-1.5 rounded-full" style={{ width: `${width}%`, backgroundColor: style.color }} />
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px]" style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}>
                        Confidence {Math.round(item.confidence * 100)}%
                      </span>
                      <span className="text-[10px]" style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}>
                        {item.recency_days == null ? 'Recency N/A' : `${item.recency_days}d old`}
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] mt-1.5" style={{ color: '#475569', fontFamily: 'Inter, sans-serif' }}>
                    {item.rationale}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-md p-2" style={{ backgroundColor: '#f8f9ff' }}>
      <p className="text-[10px] uppercase tracking-wider" style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}>
        {label}
      </p>
      <p className="text-[13px] font-extrabold" style={{ color, fontFamily: 'Manrope, sans-serif' }}>
        {value}
      </p>
    </div>
  );
}

function SectionLabel({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-2">
      <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#64748b' }}>
        {icon}
      </span>
      <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}>
        {label}
      </span>
    </div>
  );
}
