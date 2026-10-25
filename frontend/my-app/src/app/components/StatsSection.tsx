'use client';

import { useEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const stats = [
  { target: 98, label: 'Accuracy %' },
  { target: 1.2, label: 'M Records/Sec' },
  { target: 450, label: 'Institutions' },
  { target: 12, label: 'Nodes Active' },
];

export default function StatsSection() {
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    document.querySelectorAll('.stat-number').forEach(el => {
      const stat = el as HTMLElement;
      const target = parseFloat(stat.dataset.target || '0');
      ScrollTrigger.create({
        trigger: stat,
        start: 'top 90%',
        onEnter: () => {
          const obj = { val: 0 };
          gsap.to(obj, {
            val: target,
            duration: 2,
            ease: 'power2.out',
            onUpdate: () => {
              stat.innerText = target % 1 === 0 ? String(Math.floor(obj.val)) : obj.val.toFixed(1);
            },
          });
        },
      });
    });
  }, []);

  return (
    <section className="py-32 relative overflow-hidden">
      {/* Background Grid Lines */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[1px] h-full" style={{ backgroundColor: '#00e5cc' }}></div>
        <div className="absolute top-0 left-2/4 w-[1px] h-full" style={{ backgroundColor: '#00e5cc' }}></div>
        <div className="absolute top-0 left-3/4 w-[1px] h-full" style={{ backgroundColor: '#00e5cc' }}></div>
        <div className="absolute top-1/4 left-0 w-full h-[1px]" style={{ backgroundColor: '#00e5cc' }}></div>
        <div className="absolute top-2/4 left-0 w-full h-[1px]" style={{ backgroundColor: '#00e5cc' }}></div>
        <div className="absolute top-3/4 left-0 w-full h-[1px]" style={{ backgroundColor: '#00e5cc' }}></div>
      </div>

      <div className="max-w-7xl mx-auto px-8 relative z-10 grid grid-cols-2 md:grid-cols-4 gap-12 text-center">
        {stats.map((s, i) => (
          <div key={i}>
            <div
              className="text-6xl stat-number"
              data-target={s.target}
              style={{ fontFamily: 'var(--font-bebas-neue)', color: '#00e5cc' }}
            >
              0
            </div>
            <div
              className="text-xs uppercase tracking-tighter text-gray-500"
              style={{ fontFamily: 'var(--font-dm-mono)' }}
            >
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
