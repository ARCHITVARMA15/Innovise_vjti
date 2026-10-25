'use client';

import { useEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const features = [
  {
    badge: 'Live Stream',
    badgeColor: '#00e5cc',
    ticker: 'FLOW: GME',
    tickerVal: '+8.2%',
    tickerColor: '#00e5cc',
    iconColor: '#00e5cc',
    borderColor: '#00e5cc',
    hoverBg: 'rgba(0,229,204,0.1)',
    title: 'Hyper-Gamma Detection',
    desc: 'Scan million-row order flows for gamma exposure imbalances in nanoseconds.',
    bottomHoverColor: '#00e5cc',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    badge: 'Signal Active',
    badgeColor: '#C9A84C',
    ticker: 'SENT: AMD',
    tickerVal: '-2.1%',
    tickerColor: '#ef4444',
    iconColor: '#C9A84C',
    borderColor: '#C9A84C',
    hoverBg: 'rgba(201,168,76,0.1)',
    title: 'AI Sentiment Flux',
    desc: 'Natural Language Processing engines parsing dark pool activity and institutional chatter.',
    bottomHoverColor: '#C9A84C',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </svg>
    ),
  },
  {
    badge: 'Arb Found',
    badgeColor: '#00e5cc',
    ticker: 'VOL: JPM',
    tickerVal: '+0.4%',
    tickerColor: '#00e5cc',
    iconColor: '#00e5cc',
    borderColor: '#00e5cc',
    hoverBg: 'rgba(0,229,204,0.1)',
    title: 'Volatility Arb',
    desc: 'Automated identification of implied vs realized volatility skew mispricing.',
    bottomHoverColor: '#00e5cc',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        <path d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      </svg>
    ),
  },
];

export default function FeaturesSection() {
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    gsap.from('#features .feature-card', {
      scrollTrigger: {
        trigger: '#features',
        start: 'top 80%',
        toggleActions: 'play none none none',
      },
      y: 60,
      opacity: 0,
      duration: 1,
      stagger: 0.2,
      ease: 'power4.out',
    });

    document.querySelectorAll('.feature-card').forEach(card => {
      const el = card as HTMLElement;
      el.addEventListener('mousemove', (e: MouseEvent) => {
        const rect = el.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        gsap.to(el, {
          rotateY: x * 20,
          rotateX: -y * 20,
          transformPerspective: 1000,
          ease: 'power2.out',
          duration: 0.5,
        });
      });
      el.addEventListener('mouseleave', () => {
        gsap.to(el, { rotateY: 0, rotateX: 0, duration: 1, ease: 'elastic.out(1, 0.3)' });
      });
    });
  }, []);

  return (
    <section id="features" className="py-32 px-8 md:px-16 relative" style={{ backgroundColor: '#050810' }}>
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
        {features.map((f, i) => (
          <div
            key={i}
            className="feature-card glass-card p-10 flex flex-col justify-end group cursor-default"
            style={{ height: '400px' }}
          >
            <div className="mb-auto">
              <div className="flex justify-between items-center mb-4">
                <span
                  className="px-2 py-0.5 border text-[10px] uppercase"
                  style={{ borderColor: f.badgeColor, color: f.badgeColor, fontFamily: 'var(--font-dm-mono)' }}
                >
                  {f.badge}
                </span>
                <span className="text-[10px] text-gray-500" style={{ fontFamily: 'var(--font-dm-mono)' }}>
                  {f.ticker} <span style={{ color: f.tickerColor }}>{f.tickerVal}</span>
                </span>
              </div>

              <div
                className="w-12 h-12 border flex items-center justify-center mb-6 transition-colors"
                style={{
                  borderColor: f.iconColor,
                  color: f.iconColor,
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.backgroundColor = f.hoverBg; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent'; }}
              >
                {f.icon}
              </div>

              <h3
                className="text-3xl mb-4"
                style={{ fontFamily: 'var(--font-bebas-neue)' }}
              >
                {f.title}
              </h3>
              <p className="text-sm text-gray-400" style={{ fontFamily: 'var(--font-dm-mono)' }}>
                {f.desc}
              </p>
            </div>
            <div
              className="h-[1px] w-full transition-all duration-500"
              style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.backgroundColor = f.bottomHoverColor; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'rgba(255,255,255,0.1)'; }}
            ></div>
          </div>
        ))}
      </div>
    </section>
  );
}
