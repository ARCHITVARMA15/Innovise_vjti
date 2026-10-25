'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export default function DemoSection() {
  const tw1Ref = useRef<HTMLSpanElement>(null);
  const tw2Ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const runTypewriter = (el: HTMLSpanElement, text: string) => {
      ScrollTrigger.create({
        trigger: el,
        start: 'top 90%',
        onEnter: () => {
          let i = 0;
          el.innerText = '';
          const timer = setInterval(() => {
            el.innerText += text[i];
            i++;
            if (i >= text.length) clearInterval(timer);
          }, 30);
        },
      });
    };

    if (tw1Ref.current) runTypewriter(tw1Ref.current, 'Analyzing SPY 450P block trades... IV spike detected at 14:02 EST.');
    if (tw2Ref.current) runTypewriter(tw2Ref.current, 'Call-Put Skew in Tech sector reaching 95th percentile historical deviation.');

    gsap.from('#demo > *', {
      scrollTrigger: { trigger: '#demo', start: 'top 80%', toggleActions: 'play none none none' },
      y: 60,
      opacity: 0,
      duration: 1,
      stagger: 0.2,
      ease: 'power4.out',
    });
  }, []);

  return (
    <section
      id="demo"
      className="py-32 border-y overflow-hidden"
      style={{ backgroundColor: 'rgba(5,8,16,0.5)', borderColor: 'rgba(255,255,255,0.05)' }}
    >
      <div className="max-w-7xl mx-auto px-8 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <div>
          <h2
            className="text-5xl md:text-6xl mb-8 leading-none"
            style={{ fontFamily: 'var(--font-bebas-neue)' }}
          >
            DYNAMIC<br />
            <span style={{ color: '#00e5cc' }}>SKEW MAPPING</span>
          </h2>
          <p className="text-gray-400 mb-8" style={{ fontFamily: 'var(--font-dm-mono)' }}>
            Interact with the multi-dimensional Greeks visualization. Drag to rotate the surface and identify convex opportunities.
          </p>

          <div className="space-y-4" id="ai-feed">
            <div
              className="glass-card p-4 text-xs border-l-2"
              style={{ fontFamily: 'var(--font-dm-mono)', borderLeftColor: '#00e5cc' }}
            >
              <span style={{ color: '#00e5cc' }}>[SYSTEM]:</span>{' '}
              <span ref={tw1Ref}></span>
            </div>
            <div
              className="glass-card p-4 text-xs border-l-2"
              style={{ fontFamily: 'var(--font-dm-mono)', borderLeftColor: '#C9A84C' }}
            >
              <span style={{ color: '#C9A84C' }}>[ALPHA]:</span>{' '}
              <span ref={tw2Ref}></span>
            </div>
          </div>
        </div>

        <div
          className="relative glass-card rounded-full overflow-hidden flex items-center justify-center"
          style={{ aspectRatio: '1 / 1', borderColor: 'rgba(0,229,204,0.2)' }}
        >
          <div
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(circle at center, rgba(0,229,204,0.05) 0%, transparent 70%)',
            }}
          ></div>
          <div
            className="text-8xl opacity-10 select-none"
            style={{ fontFamily: 'var(--font-bebas-neue)' }}
          >
            DATA_VIZ
          </div>

          <div
            className="absolute w-48 h-48 rounded-full animate-spin-slow"
            style={{ border: '1px solid rgba(0,229,204,0.3)' }}
          ></div>
          <div
            className="absolute w-72 h-72 rounded-full animate-spin-slow-reverse"
            style={{ border: '1px solid rgba(201,168,76,0.2)' }}
          ></div>

          <div
            className="absolute bottom-8 right-8 glass-card px-4 py-2 flex items-center gap-3 hover:scale-110 transition-transform cursor-pointer"
            style={{ border: '1px solid rgba(0,229,204,0.4)' }}
          >
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: '#00e5cc', animation: 'pulse-anim 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}
            ></div>
            <div>
              <div
                className="text-[10px] text-gray-400 uppercase leading-none"
                style={{ fontFamily: 'var(--font-dm-mono)' }}
              >
                Active Node
              </div>
              <div
                className="text-xl text-white leading-none mt-1"
                style={{ fontFamily: 'var(--font-bebas-neue)' }}
              >
                TSLA ₹175.66 <span className="text-xs" style={{ color: '#00e5cc' }}>+2.3%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
