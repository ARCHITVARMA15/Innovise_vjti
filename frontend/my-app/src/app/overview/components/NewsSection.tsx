'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { NewsArticle, NewsSentiment, NewsCategory } from '@/lib/types/overview';

interface Props {
  data: NewsArticle[];
}

type FilterTab = 'all' | NewsCategory;

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'all',       label: 'All' },
  { key: 'macro',     label: 'Macro' },
  { key: 'equity',    label: 'Equity' },
  { key: 'commodity', label: 'Commodity' },
  { key: 'crypto',    label: 'Crypto' },
];

const SENTIMENT_STYLE: Record<NewsSentiment, { label: string; color: string; border: string; bars: string[] }> = {
  bullish: {
    label: 'BULLISH',
    color: '#00e5cc',
    border: '#00e5cc',
    bars: ['#00e5cc', '#00e5cc', '#00e5cc', '#00e5cc', 'rgba(255,255,255,0.15)'],
  },
  bearish: {
    label: 'BEARISH',
    color: '#ef4444',
    border: '#ef4444',
    bars: ['#ef4444', '#ef4444', '#ef4444', '#ef4444', 'rgba(255,255,255,0.15)'],
  },
  neutral: {
    label: 'NEUTRAL',
    color: '#94a3b8',
    border: '#94a3b8',
    bars: ['#94a3b8', '#94a3b8', 'rgba(255,255,255,0.15)', 'rgba(255,255,255,0.15)', 'rgba(255,255,255,0.15)'],
  },
};

const TAG_COLOR: Record<string, { bg: string; color: string }> = {
  'tag-blue':  { bg: 'rgba(0,229,204,0.15)', color: '#00e5cc' },
  'tag-green': { bg: 'rgba(0,229,204,0.15)', color: '#00e5cc' },
  'tag-amber': { bg: 'rgba(239,68,68,0.15)', color: '#ef4444' },
  'tag-red':   { bg: 'rgba(239,68,68,0.15)', color: '#ef4444' },
  'tag-gray':  { bg: 'rgba(148,163,184,0.15)', color: '#94a3b8' },
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Individual carousel card ──────────────────────────────────────────────────
function NewsCard({ article }: { article: NewsArticle }) {
  const sentiment = SENTIMENT_STYLE[article.sentiment] ?? SENTIMENT_STYLE.neutral;
  const tagStyle  = TAG_COLOR[article.tag_class] ?? TAG_COLOR['tag-gray'];

  return (
    <div
      className="group flex-shrink-0 flex flex-col no-underline rounded-xl p-5 transition-all duration-200"
      style={{
        width: '300px',
        backgroundColor: '#131b2e',
        border: `1px solid rgba(255,255,255,0.07)`,
        textDecoration: 'none',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = `${sentiment.border}40`;
        (e.currentTarget as HTMLElement).style.backgroundColor = '#182236';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)';
        (e.currentTarget as HTMLElement).style.backgroundColor = '#131b2e';
      }}
    >
      {/* Top row: tag badge + time */}
      <div className="flex items-center justify-between mb-3">
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider"
          style={{ backgroundColor: tagStyle.bg, color: tagStyle.color, fontFamily: 'Inter, sans-serif' }}
        >
          {article.tag}
          {article.sentiment !== 'neutral' && (
            <span style={{ color: sentiment.color }}> · {sentiment.label}</span>
          )}
        </span>
        <span
          className="text-[10px]"
          style={{ color: '#475569', fontFamily: 'Inter, sans-serif' }}
        >
          {relativeTime(article.published_at)}
        </span>
      </div>

      {/* Headline */}
      <h4
        className="text-sm font-bold leading-snug mb-2 flex-1 line-clamp-3"
        style={{ color: '#e2e8f0', fontFamily: 'Manrope, sans-serif' }}
      >
        {article.headline}
      </h4>

      {/* Summary */}
      <p
        className="text-xs mb-4 line-clamp-2"
        style={{ color: '#64748b', fontFamily: 'Inter, sans-serif', lineHeight: '1.5' }}
      >
        {article.summary}
      </p>

      {/* Footer: IMPACT bars + source + tickers */}
      <div className="flex items-center gap-3 mt-auto mb-3">
        <div className="flex items-center gap-1.5">
          <span
            className="text-[9px] font-bold uppercase tracking-widest"
            style={{ color: '#475569', fontFamily: 'Inter, sans-serif' }}
          >
            IMPACT
          </span>
          <div className="flex gap-0.5 items-center">
            {sentiment.bars.map((barColor, i) => (
              <div
                key={i}
                className="rounded-sm"
                style={{ width: '10px', height: '6px', backgroundColor: barColor }}
              />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1.5 ml-auto flex-wrap justify-end">
          <span
            className="text-[10px]"
            style={{ color: '#475569', fontFamily: 'Inter, sans-serif' }}
          >
            {article.source_name}
          </span>
          {article.related_tickers.slice(0, 2).map(t => (
            <span
              key={t}
              className="text-[9px] font-bold"
              style={{ color: sentiment.color, fontFamily: 'Inter, sans-serif' }}
            >
              +${t.replace('.NS', '')}
            </span>
          ))}
        </div>
      </div>

      {/* Read More Button */}
      {article.url && article.url !== '#' && (
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-2 px-4 rounded-lg text-[11px] font-bold uppercase tracking-wider text-center transition-all flex items-center justify-center gap-1"
          style={{
            backgroundColor: 'rgba(0,229,204,0.1)',
            color: '#00e5cc',
            border: '1px solid rgba(0,229,204,0.2)',
            fontFamily: 'Inter, sans-serif',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0,229,204,0.15)';
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,229,204,0.4)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0,229,204,0.1)';
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,229,204,0.2)';
          }}
          onClick={e => e.stopPropagation()}
        >
          Read More
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
            open_in_new
          </span>
        </a>
      )}
    </div>
  );
}

// ── Main section ──────────────────────────────────────────────────────────────
export default function NewsSection({ data }: Props) {
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [isPaused,  setIsPaused]  = useState(false);
  const [now,       setNow]       = useState('');
  const trackRef = useRef<HTMLDivElement>(null);
  const posRef   = useRef(0);
  const rafRef   = useRef<number | null>(null);

  // Hydration-safe timestamp
  useEffect(() => {
    const fmt = () =>
      setNow(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }));
    fmt();
    const id = setInterval(fmt, 30_000);
    return () => clearInterval(id);
  }, []);

  const safeData  = data && data.length > 0 ? data : [];
  const filtered  = activeTab === 'all'
    ? safeData
    : safeData.filter(a => a.category === activeTab);
  const displayed = filtered.length > 0 ? filtered : safeData;

  // Duplicate for seamless infinite scroll
  const items = [...displayed, ...displayed];

  // Card width + gap
  const CARD_W = 300 + 16; // 300px card + 16px gap

  const animate = useCallback(() => {
    if (!trackRef.current) return;
    if (!isPaused) {
      posRef.current += 0.5;
      const loopAt = displayed.length * CARD_W;
      if (posRef.current >= loopAt) posRef.current = 0;
      trackRef.current.style.transform = `translateX(-${posRef.current}px)`;
    }
    rafRef.current = requestAnimationFrame(animate);
  }, [isPaused, displayed.length, CARD_W]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [animate]);

  // Reset position when tab changes
  useEffect(() => {
    posRef.current = 0;
    if (trackRef.current) trackRef.current.style.transform = 'translateX(0)';
  }, [activeTab]);

  if (safeData.length === 0) return null;

  return (
    <section className="space-y-4 min-w-0 w-full rounded-2xl p-6" style={{ backgroundColor: '#0b1c30' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="inline-block w-2 h-2 rounded-full animate-pulse"
            style={{ backgroundColor: '#00e5cc' }}
          />
          <h3
            className="text-sm font-bold uppercase tracking-widest"
            style={{ color: '#e2e8f0', fontFamily: 'Manrope, sans-serif', letterSpacing: '0.12em' }}
          >
            Market Intelligence Feed
          </h3>
        </div>
        <span
          className="text-[10px] font-bold uppercase tracking-widest"
          style={{ color: '#475569', fontFamily: 'Inter, sans-serif' }}
        >
          LIVE · {now || '--:--'}
        </span>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="text-[11px] font-bold px-3 py-1 rounded-full border transition-all duration-150"
            style={{
              fontFamily: 'Inter, sans-serif',
              backgroundColor: activeTab === tab.key ? '#00e5cc' : 'transparent',
              color:           activeTab === tab.key ? '#050810' : '#94a3b8',
              borderColor:     activeTab === tab.key ? '#00e5cc' : 'rgba(255,255,255,0.12)',
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Carousel */}
      <div
        className="relative w-full"
        style={{ overflow: 'hidden', WebkitMaskImage: 'linear-gradient(to right, transparent, black 6%, black 94%, transparent)', maskImage: 'linear-gradient(to right, transparent, black 6%, black 94%, transparent)' }}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <div
          ref={trackRef}
          className="flex gap-4"
          style={{ willChange: 'transform', width: 'max-content', paddingBottom: '4px' }}
        >
          {items.map((article, i) => (
            <NewsCard key={`${article.id ?? i}-${i}`} article={article} />
          ))}
        </div>
      </div>
    </section>
  );
}
