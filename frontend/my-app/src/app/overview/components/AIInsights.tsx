'use client';

import type { AIInsight } from '@/lib/types/overview';
import { formatTimeAgo } from '@/lib/utils/format';

interface Props {
  data: AIInsight[];
  updatedAt: string;
}

export default function AIInsights({ data, updatedAt }: Props) {
  return (
    <section className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h3
          className="text-lg font-bold flex items-center gap-2"
          style={{ color: '#000000', fontFamily: 'Manrope, sans-serif' }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: '20px', color: '#006591', fontVariationSettings: "'FILL' 0, 'wght' 400" }}
          >
            auto_awesome
          </span>
          AI-Driven Insights
        </h3>
        <span
          className="text-[10px] uppercase font-bold tracking-widest px-3 py-1 rounded-full"
          style={{
            color: '#45464d',
            backgroundColor: '#e5eeff',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          Updated {formatTimeAgo(updatedAt)}
        </span>
      </div>

      {/* Bento grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {data.map((insight, i) => {
          const key = insight.id ?? i;
          if (insight.variant === 'report') return <ReportCard key={key} insight={insight} />;
          if (insight.variant === 'signal') return <SignalCard key={key} insight={insight} />;
          if (insight.variant === 'risk') return <RiskCard key={key} insight={insight} />;
          return null;
        })}
      </div>
    </section>
  );
}

// ─── Report Card (dark) ───────────────────────────────────────────────────────
function ReportCard({ insight }: { insight: AIInsight }) {
  return (
    <div
      className="group p-6 rounded-xl relative overflow-hidden flex flex-col"
      style={{
        backgroundColor: '#131b2e',
        boxShadow: '0 24px 40px rgba(11,28,48,0.05)',
      }}
    >
      {/* Ambient blob */}
      <div
        className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl transition-all duration-700"
        style={{
          backgroundColor: 'rgba(57,184,253,0.1)',
          marginRight: '-4rem',
          marginTop: '-4rem',
        }}
      />

      <span
        className="material-symbols-outlined mb-4"
        style={{ fontSize: '24px', color: '#39b8fd', fontVariationSettings: "'FILL' 0, 'wght' 300" }}
      >
        article
      </span>

      <h4
        className="text-lg font-bold leading-tight mb-2"
        style={{ color: '#ffffff', fontFamily: 'Manrope, sans-serif' }}
      >
        {insight.title}
      </h4>

      <p
        className="text-sm mb-6 flex-1"
        style={{ color: '#7c839b', fontFamily: 'Inter, sans-serif' }}
      >
        {insight.description}
      </p>

      {insight.cta && (
        <button
          className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider transition-opacity hover:opacity-80"
          style={{ color: '#39b8fd', fontFamily: 'Inter, sans-serif' }}
        >
          {insight.cta}
          <span
            className="material-symbols-outlined"
            style={{ fontSize: '14px', fontVariationSettings: "'FILL' 0, 'wght' 400" }}
          >
            arrow_forward
          </span>
        </button>
      )}
    </div>
  );
}

// ─── Signal Card (light) ──────────────────────────────────────────────────────
function SignalCard({ insight }: { insight: AIInsight }) {
  return (
    <div
      className="p-6 rounded-xl flex flex-col"
      style={{
        backgroundColor: '#ffffff',
        boxShadow: '0 24px 40px rgba(11,28,48,0.05)',
        border: '1px solid rgba(198,198,205,0.12)',
      }}
    >
      <div className="flex justify-between items-start mb-4">
        {insight.badge && (
          <span
            className="font-bold text-[10px] px-2 py-0.5 rounded uppercase tracking-wide"
            style={{ backgroundColor: '#4edea3', color: '#002113', fontFamily: 'Inter, sans-serif' }}
          >
            {insight.badge}
          </span>
        )}
        <span
          className="material-symbols-outlined ml-auto"
          style={{ fontSize: '20px', color: 'rgba(69,70,77,0.4)', fontVariationSettings: "'FILL' 0, 'wght' 300" }}
        >
          bookmark
        </span>
      </div>

      <h4
        className="text-lg font-bold leading-tight mb-2"
        style={{ color: '#000000', fontFamily: 'Manrope, sans-serif' }}
      >
        {insight.title}
      </h4>

      <p
        className="text-sm mb-6 flex-1"
        style={{ color: '#45464d', fontFamily: 'Inter, sans-serif' }}
      >
        {insight.description}
      </p>

      <div className="flex items-center justify-between mt-auto">
        {/* Analyst avatars (placeholder initials) */}
        <div className="flex -space-x-2">
          {['AM', 'KL'].map((initials, i) => (
            <div
              key={i}
              className="h-6 w-6 rounded-full border-2 border-white flex items-center justify-center text-[9px] font-bold"
              style={{ backgroundColor: i === 0 ? '#cbd5e1' : '#94a3b8', color: '#0f172a' }}
            >
              {initials}
            </div>
          ))}
        </div>
        {insight.analystCount && (
          <span
            className="text-[11px] font-medium italic"
            style={{ color: 'rgba(69,70,77,0.6)', fontFamily: 'Inter, sans-serif' }}
          >
            {insight.analystCount} analysts agree
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Risk Card (danger tint) ──────────────────────────────────────────────────
function RiskCard({ insight }: { insight: AIInsight }) {
  return (
    <div
      className="p-6 rounded-xl flex flex-col"
      style={{
        backgroundColor: 'rgba(255,218,214,0.2)',
        border: '1px solid rgba(186,26,26,0.08)',
        boxShadow: '0 24px 40px rgba(11,28,48,0.05)',
      }}
    >
      <div className="flex justify-between items-start mb-4">
        {insight.badge && (
          <span
            className="font-bold text-[10px] px-2 py-0.5 rounded uppercase tracking-wide text-white"
            style={{ backgroundColor: '#ba1a1a', fontFamily: 'Inter, sans-serif' }}
          >
            {insight.badge}
          </span>
        )}
        <span
          className="material-symbols-outlined ml-auto"
          style={{ fontSize: '20px', color: '#ba1a1a', fontVariationSettings: "'FILL' 0, 'wght' 400" }}
        >
          warning
        </span>
      </div>

      <h4
        className="text-lg font-bold leading-tight mb-2"
        style={{ color: '#000000', fontFamily: 'Manrope, sans-serif' }}
      >
        {insight.title}
      </h4>

      <p
        className="text-sm mb-6 flex-1"
        style={{ color: '#45464d', fontFamily: 'Inter, sans-serif' }}
      >
        {insight.description}
      </p>

      {insight.cta && (
        <button
          className="w-full py-3 text-[11px] font-bold uppercase tracking-widest rounded-lg transition-all"
          style={{
            border: '1px solid #ba1a1a',
            color: '#ba1a1a',
            backgroundColor: 'transparent',
            fontFamily: 'Inter, sans-serif',
          }}
          onMouseEnter={e => {
            const btn = e.currentTarget as HTMLButtonElement;
            btn.style.backgroundColor = '#ba1a1a';
            btn.style.color = '#ffffff';
          }}
          onMouseLeave={e => {
            const btn = e.currentTarget as HTMLButtonElement;
            btn.style.backgroundColor = 'transparent';
            btn.style.color = '#ba1a1a';
          }}
        >
          {insight.cta}
        </button>
      )}
    </div>
  );
}
