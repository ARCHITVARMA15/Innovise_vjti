'use client';

import type { SourceReference } from '@/lib/types/agent';

interface Props {
  source: SourceReference;
}

const TYPE_CONFIG: Record<string, { icon: string; color: string; bg: string; label: string }> = {
  news: { icon: 'newspaper', color: '#006591', bg: '#e5eeff', label: 'News' },
  web_search: { icon: 'travel_explore', color: '#7c3aed', bg: '#f3e8ff', label: 'Web' },
  market_data: { icon: 'candlestick_chart', color: '#009668', bg: '#e6f9f1', label: 'Market' },
  portfolio: { icon: 'account_balance_wallet', color: '#c9a84c', bg: '#fef9e7', label: 'Portfolio' },
  filing: { icon: 'description', color: '#64748b', bg: '#f1f5f9', label: 'Filing' },
};

export default function SourceCard({ source }: Props) {
  const config = TYPE_CONFIG[source.type] || TYPE_CONFIG.web_search;

  return (
    <div
      className="p-3 rounded-lg transition-all cursor-pointer"
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid rgba(198,198,205,0.15)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = config.color + '40'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(198,198,205,0.15)'; }}
      onClick={() => {
        if (source.url) window.open(source.url, '_blank', 'noopener');
      }}
    >
      <div className="flex items-start gap-2.5">
        <div
          className="w-7 h-7 rounded-md shrink-0 flex items-center justify-center mt-0.5"
          style={{ backgroundColor: config.bg }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: '14px', color: config.color, fontVariationSettings: "'FILL' 0, 'wght' 400" }}
          >
            {config.icon}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span
              className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{ backgroundColor: config.bg, color: config.color, fontFamily: 'Inter, sans-serif' }}
            >
              {config.label}
            </span>
            {source.confidence !== null && source.confidence !== undefined && (
              <span
                className="text-[10px] font-bold"
                style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}
              >
                {Math.round(source.confidence * 100)}%
              </span>
            )}
          </div>
          <p
            className="text-[12px] font-semibold leading-tight truncate"
            style={{ color: '#0f172a', fontFamily: 'Inter, sans-serif' }}
          >
            {source.title}
          </p>
          {source.snippet && (
            <p
              className="text-[11px] mt-1 line-clamp-2 leading-relaxed"
              style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}
            >
              {source.snippet}
            </p>
          )}
        </div>
        {source.url && (
          <span
            className="material-symbols-outlined shrink-0 mt-1"
            style={{ fontSize: '12px', color: '#94a3b8', fontVariationSettings: "'FILL' 0, 'wght' 300" }}
          >
            open_in_new
          </span>
        )}
      </div>
    </div>
  );
}
