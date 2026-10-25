'use client';

interface RegulatoryResult {
  verdict?: string;
  risk_level?: string;
  confidence?: number;
  finding_count?: number;
  disclaimer?: string;
  raw_analysis?: string;
}

interface Props {
  result: RegulatoryResult;
}

export default function RegulatoryBadge({ result }: Props) {
  const risk = (result.risk_level || '').toLowerCase();

  let color = '#64748b';
  let bg = '#f1f5f9';
  let icon = 'shield';
  if (risk === 'high') {
    color = '#ba1a1a';
    bg = 'rgba(255,218,214,0.35)';
    icon = 'gpp_bad';
  } else if (risk === 'medium') {
    color = '#c9a84c';
    bg = '#fef9e7';
    icon = 'policy_alert';
  } else if (risk === 'low') {
    color = '#009668';
    bg = '#e6f9f1';
    icon = 'verified_user';
  }

  const confidence = Math.round((Number(result.confidence ?? 0) * 100));

  return (
    <div className="p-4 rounded-xl" style={{ backgroundColor: bg, border: `1px solid ${color}22` }}>
      <div className="flex items-center gap-3 mb-3">
        <span className="material-symbols-outlined" style={{ color, fontSize: '24px' }}>
          {icon}
        </span>
        <div>
          <span className="text-[13px] font-extrabold tracking-wide block" style={{ color, fontFamily: 'Manrope, sans-serif' }}>
            {result.verdict || 'REGULATORY CHECK'}
          </span>
          <span className="text-[11px]" style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}>
            Risk: {(result.risk_level || 'unknown').toUpperCase()} • Findings: {result.finding_count ?? 0}
          </span>
        </div>
      </div>

      <div className="w-full h-1.5 rounded-full overflow-hidden mb-2" style={{ backgroundColor: `${color}20` }}>
        <div className="h-full rounded-full" style={{ width: `${Math.max(8, confidence)}%`, backgroundColor: color }} />
      </div>

      <p className="text-[11px]" style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}>
        Confidence: {confidence}%
      </p>
      {result.disclaimer && (
        <p className="text-[10px] mt-2" style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}>
          {result.disclaimer}
        </p>
      )}
    </div>
  );
}
