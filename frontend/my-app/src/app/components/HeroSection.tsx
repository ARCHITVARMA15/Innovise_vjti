'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { gsap } from 'gsap';

export default function HeroSection() {
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    let mouseX = 0;
    let mouseY = 0;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    canvasRef.current.appendChild(renderer.domElement);

    const geometry = new THREE.PlaneGeometry(20, 15, 60, 60);
    const material = new THREE.MeshBasicMaterial({
      color: 0x00e5cc,
      wireframe: true,
      transparent: true,
      opacity: 0.15,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2.5;
    scene.add(mesh);

    const partGeo = new THREE.BufferGeometry();
    const partCount = 100;
    const posArray = new Float32Array(partCount * 3);
    for (let i = 0; i < partCount * 3; i++) {
      posArray[i] = (Math.random() - 0.5) * 20;
    }
    partGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const partMat = new THREE.PointsMaterial({ size: 0.05, color: 0x00e5cc, transparent: true, opacity: 0.8 });
    const particles = new THREE.Points(partGeo, partMat);
    scene.add(particles);

    const onMouseMove = (e: MouseEvent) => {
      mouseX = (e.clientX / window.innerWidth) - 0.5;
      mouseY = (e.clientY / window.innerHeight) - 0.5;
    };
    document.addEventListener('mousemove', onMouseMove);

    let animId: number;
    function animate(time: number) {
      animId = requestAnimationFrame(animate);

      const positions = mesh.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        const dist = Math.sqrt((x - mouseX * 10) ** 2 + (y + mouseY * 10) ** 2);
        const ripple = Math.sin(dist - time * 0.002) * 0.3;
        const wave = Math.sin(x * 0.5 + time * 0.001) * Math.cos(y * 0.5 + time * 0.001) * 0.5;
        positions.setZ(i, wave + ripple);
      }
      positions.needsUpdate = true;

      particles.rotation.y += 0.001;
      particles.position.y = Math.sin(time * 0.0005) * 0.5;

      mesh.rotation.z += 0.0005;
      mesh.rotation.y = mouseX * 0.1;
      mesh.rotation.x = -Math.PI / 2.5 + mouseY * 0.1;

      renderer.render(scene, camera);
    }
    animate(0);

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    gsap.to('.metric-float', {
      y: (i: number, target: Element) => parseFloat((target as HTMLElement).dataset.speed || '0') * 15,
      x: (i: number) => (i % 2 === 0 ? 10 : -10),
      duration: 4,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    });

    gsap.to('#hero-subtext', {
      opacity: 1,
      y: 0,
      duration: 1.2,
      delay: 0.5,
      ease: 'power4.out',
    });

    return () => {
      cancelAnimationFrame(animId);
      document.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      if (canvasRef.current && renderer.domElement.parentNode === canvasRef.current) {
        canvasRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <section
      id="hero"
      className="relative h-screen w-full flex flex-col items-center justify-center overflow-hidden"
    >
      <div className="absolute inset-0 z-0" id="canvas-container" ref={canvasRef}></div>

      <div className="relative z-10 text-center px-4">
        <div
          id="hero-headline"
          className="tracking-tighter leading-none mb-6"
          style={{ fontFamily: 'var(--font-bebas-neue)', fontSize: 'clamp(4rem, 12vw, 9rem)' }}
        >
          <span className="char-split">I</span>
          <span className="char-split">N</span>
          <span className="char-split">V</span>
          <span className="char-split">E</span>
          <span className="char-split">S</span>
          <span className="char-split">T</span>
          <span className="char-split">M</span>
          <span className="char-split">E</span>
          <span className="char-split">N</span>
          <span className="char-split">T</span>
          <span className="char-split">S</span>
          <br />
          <span className="char-split" style={{ color: '#00e5cc' }}>R</span>
          <span className="char-split" style={{ color: '#00e5cc' }}>E</span>
          <span className="char-split" style={{ color: '#00e5cc' }}>D</span>
          <span className="char-split" style={{ color: '#00e5cc' }}>E</span>
          <span className="char-split" style={{ color: '#00e5cc' }}>F</span>
          <span className="char-split" style={{ color: '#00e5cc' }}>I</span>
          <span className="char-split" style={{ color: '#00e5cc' }}>N</span>
          <span className="char-split" style={{ color: '#00e5cc' }}>E</span>
          <span className="char-split" style={{ color: '#00e5cc' }}>D</span>
        </div>

        <p
          id="hero-subtext"
          className="text-lg md:text-xl max-w-2xl mx-auto mb-10 opacity-0 translate-y-4"
          style={{ fontFamily: 'var(--font-dm-mono)', color: 'rgba(201,168,76,0.8)' }}
        >
          Advanced Volatility Surfaces &amp; AI Predictive Engines for the Modern Quantitative Trader.
        </p>

        <button
          id="cta-button"
          className="group relative px-10 py-4 text-2xl tracking-wide overflow-hidden transition-all"
          style={{
            fontFamily: 'var(--font-bebas-neue)',
            backgroundColor: '#00e5cc',
            color: '#050810',
            boxShadow: '0 0 20px rgba(0,229,204,0.3)',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 40px rgba(0,229,204,0.6)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 20px rgba(0,229,204,0.3)';
          }}
        >
          <span className="relative z-10">INITIALIZE VERITAS</span>
          <div className="absolute inset-0 bg-white/20 transform -translate-x-full group-hover:translate-x-full transition-transform duration-500"></div>
        </button>
      </div>

      {/* Floating Metrics */}
      <div
        className="absolute glass-card p-4 rounded-lg hidden lg:block metric-float"
        style={{ top: '33%', left: '5rem' }}
        data-speed="2"
      >
        <div className="text-xs mb-1" style={{ fontFamily: 'var(--font-dm-mono)', color: '#00e5cc' }}>REAL-TIME IV</div>
        <div className="text-2xl" style={{ fontFamily: 'var(--font-bebas-neue)' }}>
          18.42% <span className="text-xs text-red-500">▼ 0.2</span>
        </div>
      </div>

      <div
        className="absolute glass-card p-4 rounded-lg hidden lg:block metric-float"
        style={{ bottom: '25%', right: '5rem' }}
        data-speed="-1.5"
      >
        <div className="text-xs mb-1" style={{ fontFamily: 'var(--font-dm-mono)', color: '#C9A84C' }}>DELTA NEUTRAL</div>
        <div className="text-2xl" style={{ fontFamily: 'var(--font-bebas-neue)' }}>
          0.024 <span className="text-xs" style={{ color: '#00e5cc' }}>▲ 0.001</span>
        </div>
      </div>

      <div
        className="absolute glass-card p-3 rounded-lg hidden lg:block metric-float"
        style={{ top: '25%', right: '25%', borderColor: 'rgba(124,58,237,0.3)' }}
        data-speed="3"
      >
        <div className="text-[8px] mb-1" style={{ fontFamily: 'var(--font-dm-mono)', color: '#7c3aed' }}>ANOMALY DETECTED</div>
        <div className="text-xl" style={{ fontFamily: 'var(--font-bebas-neue)', color: '#7c3aed' }}>σ-SKEW +4.2</div>
      </div>

      {/* Floating Stock Cards */}
      <div
        className="absolute glass-card p-3 rounded-lg hidden lg:block metric-float glow-teal transition-all cursor-default"
        style={{ top: '25%', left: '25%' }}
        data-speed="1.2"
      >
        <div className="flex items-center gap-2 mb-1">
          <span style={{ fontFamily: 'var(--font-bebas-neue)', fontSize: '0.875rem' }}>SPY</span>
          <span className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ backgroundColor: '#00e5cc' }}></span>
        </div>
        <div className="text-lg text-white" style={{ fontFamily: 'var(--font-dm-mono)' }}>512.34</div>
        <div className="text-[10px]" style={{ fontFamily: 'var(--font-dm-mono)', color: '#00e5cc' }}>+1.24% ▲</div>
      </div>

      <div
        className="absolute glass-card p-3 rounded-lg hidden lg:block metric-float glow-red transition-all cursor-default"
        style={{ bottom: '33%', left: '33%' }}
        data-speed="-2.2"
      >
        <div className="flex items-center gap-2 mb-1">
          <span style={{ fontFamily: 'var(--font-bebas-neue)', fontSize: '0.875rem' }}>QQQ</span>
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 pulse-dot"></span>
        </div>
        <div className="text-lg text-white" style={{ fontFamily: 'var(--font-dm-mono)' }}>443.12</div>
        <div className="text-[10px] text-red-500" style={{ fontFamily: 'var(--font-dm-mono)' }}>-0.82% ▼</div>
      </div>

      <div
        className="absolute glass-card p-3 rounded-lg hidden lg:block metric-float glow-teal transition-all cursor-default"
        style={{ top: '50%', right: '2.5rem' }}
        data-speed="1.8"
      >
        <div className="flex items-center gap-2 mb-1">
          <span style={{ fontFamily: 'var(--font-bebas-neue)', fontSize: '0.875rem', color: '#C9A84C' }}>NVDA</span>
          <span className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ backgroundColor: '#00e5cc' }}></span>
        </div>
        <div className="text-lg text-white" style={{ fontFamily: 'var(--font-dm-mono)' }}>875.40</div>
        <div className="text-[10px]" style={{ fontFamily: 'var(--font-dm-mono)', color: '#00e5cc' }}>+4.12% ▲</div>
      </div>
    </section>
  );
}
