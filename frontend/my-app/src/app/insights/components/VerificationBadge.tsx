'use client';

import type { VerificationResult } from '@/lib/types/agent';

interface Props {
  result: VerificationResult;
}

export default function VerificationBadge({ result }: Props) {
  const analysis = result.raw_analysis || '';

  // Parse verdict from the analysis text
  let emoji = '🔍';
  let color = '#64748b';
  let bg = '#f1f5f9';
  let label = 'INCONCLUSIVE';

  const lower = analysis.toLowerCase();
  if (lower.includes('✅') || (lower.includes('verified') && !lower.includes('unverified') && !lower.includes('partially'))) {
    emoji = '✅';
    color = '#009668';
    bg = '#e6f9f1';
    label = 'VERIFIED';
  } else if (lower.includes('⚠️') || lower.includes('partially verified') || lower.includes('partial')) {
    emoji = '⚠️';
    color = '#c9a84c';
    bg = '#fef9e7';
    label = 'PARTIALLY VERIFIED';
  } else if (lower.includes('❌') || lower.includes('unverified') || lower.includes('false')) {
    emoji = '❌';
    color = '#ba1a1a';
    bg = 'rgba(255,218,214,0.3)';
    label = 'UNVERIFIED / FALSE';
  }

  // Try to extract confidence from text (look for patterns like "85%" or "Confidence: 85%")
  const confMatch = analysis.match(/(\d{1,3})%/);
  const confidence = confMatch ? parseInt(confMatch[1], 10) : null;

  return (
    <div
      className="p-4 rounded-xl"
      style={{ backgroundColor: bg, border: `1px solid ${color}22` }}
    >
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl">{emoji}</span>
        <div>
          <span
            className="text-[13px] font-extrabold tracking-wide block"
            style={{ color, fontFamily: 'Manrope, sans-serif' }}
          >
            {label}
          </span>
          {confidence !== null && (
            <span
              className="text-[11px] font-bold"
              style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}
            >
              Confidence: {confidence}%
            </span>
          )}
        </div>
      </div>

      {/* Confidence bar */}
      {confidence !== null && (
        <div
          className="w-full h-1.5 rounded-full overflow-hidden mb-2"
          style={{ backgroundColor: `${color}20` }}
        >
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${confidence}%`,
              backgroundColor: color,
            }}
          />
        </div>
      )}
    </div>
  );
}
