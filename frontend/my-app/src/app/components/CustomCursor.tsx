'use client';

import { useEffect } from 'react';
import { gsap } from 'gsap';

export default function CustomCursor() {
  useEffect(() => {
    const cursor = document.getElementById('custom-cursor');
    const ring = document.getElementById('cursor-ring');
    if (!cursor || !ring) return;

    const onMouseMove = (e: MouseEvent) => {
      gsap.to(cursor, { x: e.clientX, y: e.clientY, duration: 0.1 });
      gsap.to(ring, { x: e.clientX, y: e.clientY, duration: 0.3 });
    };
    document.addEventListener('mousemove', onMouseMove);

    const interactables = 'a, button, .feature-card, .logo';
    const elements = document.querySelectorAll(interactables);
    const enterHandlers: Array<() => void> = [];
    const leaveHandlers: Array<() => void> = [];

    elements.forEach(el => {
      const enter = () => {
        gsap.to(ring, { width: 80, height: 80, borderColor: '#00e5cc', backgroundColor: 'rgba(0,229,204,0.1)', duration: 0.3 });
        gsap.to(cursor, { scale: 1.5, duration: 0.3 });
      };
      const leave = () => {
        gsap.to(ring, { width: 32, height: 32, borderColor: 'rgba(0,229,204,0.5)', backgroundColor: 'transparent', duration: 0.3 });
        gsap.to(cursor, { scale: 1, duration: 0.3 });
      };
      el.addEventListener('mouseenter', enter);
      el.addEventListener('mouseleave', leave);
      enterHandlers.push(enter);
      leaveHandlers.push(leave);
    });

    const magneticEls = document.querySelectorAll('.nav-link, #cta-button, #main-logo');
    magneticEls.forEach(el => {
      el.addEventListener('mousemove', (e: Event) => {
        const me = e as MouseEvent;
        const rect = (el as HTMLElement).getBoundingClientRect();
        const x = me.clientX - rect.left - rect.width / 2;
        const y = me.clientY - rect.top - rect.height / 2;
        gsap.to(el, { x: x * 0.3, y: y * 0.3, duration: 0.4, ease: 'power2.out' });
      });
      el.addEventListener('mouseleave', () => {
        gsap.to(el, { x: 0, y: 0, duration: 0.6, ease: 'elastic.out(1, 0.3)' });
      });
    });

    return () => {
      document.removeEventListener('mousemove', onMouseMove);
    };
  }, []);

  return (
    <>
      <div id="custom-cursor"></div>
      <div id="cursor-ring"></div>
    </>
  );
}
