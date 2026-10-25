'use client';

import type { DiversificationScore, CurrentStrategy } from '@/lib/types/portfolio';

interface Props {
  score: DiversificationScore;
  strategy: CurrentStrategy;
}

const gradeColor: Record<string, string> = {
  EXCELLENT: '#006591',
  GOOD:      '#009668',
  FAIR:      '#C9A84C',
  POOR:      '#ba1a1a',
};

export default function DiversificationHero({ score, strategy }: Props) {
  // SVG gauge: circle r=54, circumference ≈ 339.3
  const CIRC = 339.3;
  const filled = (score.score / 100) * CIRC;
  const color = gradeColor[score.grade] ?? '#006591';

  return (
    <section className="grid grid-cols-1 lg:grid-cols-3 gap-0 rounded-xl overflow-hidden"
      style={{ boxShadow: '0 24px 40px rgba(11,28,48,0.06)' }}
    >
      {/* Left: gauge */}
      <div
        className="flex items-center justify-center p-10"
        style={{ backgroundColor: '#ffffff' }}
      >
        <div className="relative w-44 h-44 flex items-center justify-center">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
            {/* Track */}
            <circle cx="60" cy="60" r="54" fill="none" stroke="#e5eeff" strokeWidth="8" />
            {/* Progress arc */}
            <circle
              cx="60" cy="60" r="54"
              fill="none"
              stroke={color}
              strokeWidth="8"
              strokeDasharray={`${filled} ${CIRC - filled}`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className="text-4xl font-extrabold leading-none"
              style={{ color: '#0f172a', fontFamily: 'Manrope, sans-serif' }}
            >
              {score.score}
            </span>
            <span
              className="text-[10px] uppercase tracking-widest mt-1"
              style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}
            >
              {score.grade}
            </span>
          </div>
        </div>
      </div>

      {/* Middle: detail */}
      <div
        className="lg:col-span-1 p-10 flex flex-col justify-center"
        style={{ backgroundColor: '#ffffff' }}
      >
        <p
          className="text-[10px] font-bold uppercase tracking-[0.15em] mb-3"
          style={{ color: color, fontFamily: 'Inter, sans-serif' }}
        >
          Diversification Score
        </p>
        <h2
          className="text-2xl font-extrabold leading-snug mb-4"
          style={{ color: '#0f172a', fontFamily: 'Manrope, sans-serif' }}
        >
          {score.headline}
        </h2>
        <p
          className="text-sm leading-relaxed mb-6"
          style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}
        >
          {score.body}
        </p>
        <div className="flex gap-2 flex-wrap">
          {score.tags.map(tag => (
            <span
              key={tag}
              className="text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wide"
              style={{ backgroundColor: '#e5eeff', color: '#006591', fontFamily: 'Inter, sans-serif' }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Right: current strategy */}
      <div
        className="p-10 flex flex-col justify-between"
        style={{ backgroundColor: '#131b2e' }}
      >
        <div>
          <p
            className="text-[10px] uppercase tracking-[0.15em] font-bold mb-3"
            style={{ color: '#7c839b', fontFamily: 'Inter, sans-serif' }}
          >
            Current Strategy
          </p>
          <h3
            className="text-3xl font-extrabold leading-tight mb-4"
            style={{ color: '#ffffff', fontFamily: 'Manrope, sans-serif' }}
          >
            {strategy.name}
          </h3>
          <p
            className="text-sm leading-relaxed"
            style={{ color: '#7c839b', fontFamily: 'Inter, sans-serif' }}
          >
            {strategy.description}
          </p>
        </div>
        <button
          className="mt-8 px-5 py-2.5 rounded-lg text-sm font-bold transition-opacity hover:opacity-90 self-start"
          style={{ backgroundColor: '#006591', color: '#ffffff', fontFamily: 'Inter, sans-serif' }}
        >
          {strategy.ctaLabel}
        </button>
      </div>
    </section>
  );
}
