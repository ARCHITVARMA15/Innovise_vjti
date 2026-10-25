'use client';

import { useMemo, useState, useRef, forwardRef, useCallback } from 'react';
import Image from 'next/image';
import type { InvestorPersona } from '@/lib/types/mindset';

interface Props {
  persona: InvestorPersona;
  selected: boolean;
  onSelect: (personaId: string, rect: DOMRect) => void;
}

const PersonaCard = forwardRef<HTMLDivElement, Props>(function PersonaCard({ persona, selected, onSelect }, ref) {
  const imageUrl = useMemo(() => {
    const mappedById: Record<string, string> = {
      warren_buffett: '/personas/warren_buffet.png',
      ray_dalio: '/personas/ray_dalio.png',
      peter_lynch: '/personas/peter_lynch.png',
      charlie_munger: '/personas/charlie_munger.png',
      cathie_wood: '/personas/cathie_wood.png',
    };
    return persona.image_url?.trim() || mappedById[persona.id] || `/personas/${persona.id}.png`;
  }, [persona.id, persona.image_url]);

  const [hasValidImage, setHasValidImage] = useState(true);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [glare, setGlare] = useState({ x: 50, y: 50, opacity: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef<HTMLButtonElement>(null);

  const handleClick = () => {
    const rect = cardRef.current?.getBoundingClientRect();
    if (rect) onSelect(persona.id, rect);
  };

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const rotateY = ((x - cx) / cx) * 12;
    const rotateX = -((y - cy) / cy) * 10;
    const glareX = (x / rect.width) * 100;
    const glareY = (y / rect.height) * 100;
    setTilt({ x: rotateX, y: rotateY });
    setGlare({ x: glareX, y: glareY, opacity: 0.35 });
  }, []);

  const handleMouseEnter = useCallback(() => setIsHovered(true), []);

  const handleMouseLeave = useCallback(() => {
    setTilt({ x: 0, y: 0 });
    setGlare({ x: 50, y: 50, opacity: 0 });
    setIsHovered(false);
  }, []);

  return (
    <div
      ref={ref}
      style={{ perspective: '1000px' }}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        ref={cardRef}
        onClick={handleClick}
        className="group text-left rounded-2xl overflow-hidden flex flex-col h-full min-h-60 w-full relative"
        style={{
          /* ── Deep glassmorphism base ── */
          background: selected
            ? 'linear-gradient(145deg, rgba(0,80,130,0.12) 0%, rgba(255,255,255,0.88) 40%, rgba(57,184,253,0.1) 80%, rgba(160,100,255,0.06) 100%)'
            : 'linear-gradient(145deg, rgba(255,255,255,0.75) 0%, rgba(235,245,255,0.6) 40%, rgba(255,255,255,0.7) 80%, rgba(245,240,255,0.6) 100%)',
          backdropFilter: 'blur(36px) saturate(220%) brightness(1.05)',
          WebkitBackdropFilter: 'blur(36px) saturate(220%) brightness(1.05)',
          border: selected
            ? '1.5px solid rgba(0,101,145,0.5)'
            : '1px solid rgba(255,255,255,0.6)',
          boxShadow: selected
            ? '0 0 0 1px rgba(0,101,145,0.15), 0 0 50px rgba(0,101,145,0.35), 0 0 100px rgba(0,101,145,0.12), 0 24px 48px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.04)'
            : '0 8px 32px rgba(0,0,0,0.07), 0 2px 8px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.95), inset 0 -1px 0 rgba(0,0,0,0.03)',
          transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateY(${selected ? -4 : isHovered ? -2 : 0}px) scale(${isHovered ? 1.015 : 1})`,
          transition: isHovered
            ? 'transform 0.1s ease, box-shadow 0.3s ease, border-color 0.3s ease'
            : 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.4s ease, border-color 0.3s ease',
          transformStyle: 'preserve-3d',
          willChange: 'transform',
        }}
      >
        {/* ── Cursor-following glare ── */}
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none z-20"
          style={{
            background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, rgba(255,255,255,${glare.opacity}) 0%, rgba(255,255,255,${glare.opacity * 0.3}) 30%, transparent 65%)`,
            transition: isHovered ? 'none' : 'opacity 0.5s ease',
          }}
        />

        {/* ── Prismatic rainbow top-edge highlight ── */}
        <div
          className="absolute top-0 left-0 right-0 h-[2px] z-20 pointer-events-none rounded-t-2xl"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(120,200,255,0.9) 15%, rgba(100,150,255,0.85) 28%, rgba(160,80,255,0.8) 40%, rgba(255,80,180,0.75) 52%, rgba(255,150,60,0.8) 64%, rgba(80,220,180,0.85) 76%, rgba(120,200,255,0.9) 88%, transparent 100%)',
            opacity: isHovered ? 1 : 0.7,
            transition: 'opacity 0.3s ease',
          }}
        />

        {/* ── Left prismatic edge ── */}
        <div
          className="absolute top-0 left-0 bottom-0 w-[1.5px] z-20 pointer-events-none rounded-l-2xl"
          style={{
            background: 'linear-gradient(180deg, rgba(120,200,255,0.6) 0%, rgba(160,80,255,0.4) 40%, rgba(255,80,180,0.3) 70%, transparent 100%)',
            opacity: isHovered ? 0.9 : 0.5,
            transition: 'opacity 0.3s ease',
          }}
        />

        {/* ── Animated holographic shimmer sweep ── */}
        <div
          className="absolute inset-0 z-10 pointer-events-none overflow-hidden rounded-2xl"
          style={{ opacity: isHovered ? 0.5 : 0.3 }}
        >
          <div
            className="absolute"
            style={{
              top: '-50%',
              left: '-50%',
              width: '200%',
              height: '200%',
              background: 'linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.45) 43%, rgba(255,255,255,0.75) 50%, rgba(200,230,255,0.45) 57%, transparent 65%)',
              animation: 'shineSweep 4s ease-in-out infinite',
            }}
          />
        </div>

        {/* ── Holographic border glow on hover ── */}
        <div
          className="absolute inset-0 rounded-2xl z-0 pointer-events-none"
          style={{
            opacity: isHovered ? 1 : 0,
            transition: 'opacity 0.4s ease',
            background: 'linear-gradient(135deg, rgba(0,180,255,0.18), rgba(120,50,255,0.12), rgba(255,80,200,0.1), rgba(0,220,150,0.12), rgba(0,180,255,0.18))',
            backgroundSize: '400% 400%',
            animation: 'holoShift 5s ease infinite',
          }}
        />

        {/* ── Selected ring pulse ── */}
        {selected && (
          <div
            className="absolute inset-[-2px] rounded-[18px] pointer-events-none z-0"
            style={{
              background: 'linear-gradient(135deg, rgba(0,101,145,0.5), rgba(57,184,253,0.4), rgba(120,80,255,0.3))',
              animation: 'selectedRing 2.5s ease-in-out infinite',
              opacity: 0.6,
            }}
          />
        )}

        {/* Image Container */}
        <div className="relative h-32 overflow-hidden z-[1]" style={{ background: 'linear-gradient(135deg, rgba(230,240,255,0.5), rgba(245,248,255,0.3))' }}>
          {hasValidImage ? (
            <Image
              src={imageUrl}
              alt={persona.name}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-110"
              onError={() => setHasValidImage(false)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-6xl font-black opacity-20" style={{ color: '#0f172a', fontFamily: 'Manrope, sans-serif' }}>
                {persona.name.charAt(0)}
              </span>
            </div>
          )}

          {/* Glass overlay on image */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, transparent 35%, transparent 65%, rgba(0,0,0,0.2) 100%)',
            }}
          />

          {/* Selected blue tint overlay on image */}
          {selected && (
            <div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(135deg, rgba(0,101,145,0.25) 0%, rgba(57,184,253,0.15) 100%)',
              }}
            />
          )}

          {/* Bottom fade to content */}
          <div
            className="absolute bottom-0 left-0 right-0 h-10 pointer-events-none"
            style={{
              background: 'linear-gradient(0deg, rgba(245,250,255,0.95) 0%, transparent 100%)',
            }}
          />
        </div>

        {/* Content Container */}
        <div
          className="p-4 flex-1 flex flex-col relative z-[1]"
          style={{
            background: selected
              ? 'linear-gradient(180deg, rgba(230,245,255,0.5) 0%, rgba(240,250,255,0.3) 100%)'
              : 'transparent',
          }}
        >
          <div>
            <h3 className="text-[15px] font-extrabold leading-tight" style={{ color: '#0f172a', fontFamily: 'Manrope, sans-serif' }}>
              {persona.name}
            </h3>
            <p className="text-[10px] mt-0.5 leading-snug opacity-75 line-clamp-1" style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}>
              {persona.title}
            </p>
          </div>

          <div className="mt-2 flex items-start justify-between gap-2">
            <p className="text-[11px] leading-relaxed flex-1 line-clamp-2" style={{ color: '#334155', fontFamily: 'Inter, sans-serif' }}>
              {persona.core_style}
            </p>
            <span
              className="text-[9px] font-bold px-1.5 py-1 rounded-full whitespace-nowrap"
              style={{
                background: selected
                  ? 'linear-gradient(135deg, #006591, #0ea5e9)'
                  : 'rgba(241,245,249,0.85)',
                color: selected ? '#ffffff' : '#475569',
                fontFamily: 'Inter, sans-serif',
                backdropFilter: 'blur(6px)',
                boxShadow: selected ? '0 2px 8px rgba(0,101,145,0.4)' : 'none',
              }}
            >
              {persona.risk_profile}
            </span>
          </div>

          {/* Stock Focus */}
          <div className="mt-1.5 flex flex-wrap gap-1">
            {persona.stocks_focus.slice(0, 3).map((symbol) => (
              <span
                key={symbol}
                className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                style={{
                  background: 'linear-gradient(135deg, rgba(239,246,255,0.9), rgba(230,244,255,0.7))',
                  color: '#006591',
                  fontFamily: 'Inter, sans-serif',
                  backdropFilter: 'blur(6px)',
                  border: '0.5px solid rgba(0,101,145,0.15)',
                }}
              >
                {symbol}
              </span>
            ))}
          </div>
        </div>
      </button>
    </div>
  );
});

export default PersonaCard;
