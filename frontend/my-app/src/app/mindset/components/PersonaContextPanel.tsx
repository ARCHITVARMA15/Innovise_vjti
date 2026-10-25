'use client';

import type { InvestorPersona } from '@/lib/types/mindset';

interface Props {
  persona: InvestorPersona | null;
  thinkingSteps: string[];
  isStreaming: boolean;
}

export default function PersonaContextPanel({ persona, thinkingSteps, isStreaming }: Props) {
  if (!persona) {
    return (
      <div className="rounded-2xl p-5" style={{ backgroundColor: '#ffffff', border: '1px solid rgba(203,213,225,0.7)' }}>
        <p style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}>Select an investor persona to begin.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-5 space-y-5" style={{ backgroundColor: '#ffffff', border: '1px solid rgba(203,213,225,0.7)' }}>
      <div>
        <h3 className="text-base font-extrabold" style={{ color: '#0f172a', fontFamily: 'Manrope, sans-serif' }}>
          {persona.name} Context
        </h3>
        <p className="text-xs mt-1" style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}>
          {persona.era} • {persona.time_horizon}
        </p>
      </div>

      <Section title="Mindset">
        <p className="text-xs leading-relaxed" style={{ color: '#334155', fontFamily: 'Inter, sans-serif' }}>
          {persona.persona_summary}
        </p>
      </Section>

      <Section title="Top Principles">
        <ul className="space-y-1">
          {persona.principles.slice(0, 4).map((item) => (
            <li key={item} className="text-xs" style={{ color: '#334155', fontFamily: 'Inter, sans-serif' }}>
              • {item}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Focus Symbols">
        <div className="flex flex-wrap gap-1.5">
          {persona.stocks_focus.map((symbol) => (
            <span key={symbol} className="px-2 py-1 text-[10px] font-bold rounded" style={{ backgroundColor: '#f1f5f9', color: '#0f172a', fontFamily: 'Inter, sans-serif' }}>
              {symbol}
            </span>
          ))}
        </div>
      </Section>

      <Section title="Engine Status">
        <div className="space-y-1.5">
          {thinkingSteps.length === 0 ? (
            <p className="text-xs" style={{ color: '#94a3b8', fontFamily: 'Inter, sans-serif' }}>Idle. Ask a question to start reasoning.</p>
          ) : (
            thinkingSteps.slice(-4).map((step) => (
              <div key={step} className="text-xs" style={{ color: '#475569', fontFamily: 'Inter, sans-serif' }}>
                • {step}
              </div>
            ))
          )}
          {isStreaming ? (
            <p className="text-[11px] font-bold mt-2" style={{ color: '#006591', fontFamily: 'Inter, sans-serif' }}>Generating answer...</p>
          ) : null}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}>
        {title}
      </h4>
      {children}
    </section>
  );
}
