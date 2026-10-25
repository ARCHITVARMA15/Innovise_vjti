'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import type { InvestorPersona } from '@/lib/types/mindset';

interface Props {
  open: boolean;
  persona: InvestorPersona | null;
  onClose: () => void;
}

export default function PersonaDetailModal({ open, persona, onClose }: Props) {
  const [closing, setClosing] = useState(false);

  // Reset closing state whenever modal opens
  useEffect(() => {
    if (open) setClosing(false);
  }, [open]);

  // Escape key handler
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleClose() {
    setClosing(true);
    // Wait for close animation then actually close
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, 320);
  }

  if (!open || !persona) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 md:p-8">
      {/* ── Backdrop ── */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: 'rgba(7, 11, 25, 0.72)',
          backdropFilter: 'blur(20px) saturate(150%)',
          WebkitBackdropFilter: 'blur(20px) saturate(150%)',
          animation: closing ? 'personaBackdropOut 300ms ease-in forwards' : 'personaBackdropIn 250ms ease-out',
        }}
        onClick={handleClose}
      />

      {/* ── Modal card ── */}
      <div
        className="relative w-full max-w-5xl max-h-[88vh] overflow-y-auto rounded-3xl"
        style={{
          background: 'linear-gradient(155deg, rgba(255,255,255,0.96) 0%, rgba(245,251,255,0.93) 50%, rgba(255,255,255,0.96) 100%)',
          backdropFilter: 'blur(40px) saturate(200%)',
          WebkitBackdropFilter: 'blur(40px) saturate(200%)',
          border: '1.5px solid rgba(255,255,255,0.7)',
          boxShadow:
            '0 0 0 1px rgba(0,101,145,0.12), 0 0 80px rgba(0,101,145,0.2), 0 0 160px rgba(57,184,253,0.1), 0 40px 80px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,1)',
          animation: closing
            ? 'personaModalClose 320ms cubic-bezier(0.4, 0, 1, 1) forwards'
            : 'personaModalBloom 500ms cubic-bezier(0.34, 1.4, 0.64, 1)',
        }}
      >
        {/* ── Prismatic top-edge highlight ── */}
        <div
          className="absolute top-0 left-0 right-0 h-[2px] rounded-t-3xl pointer-events-none z-10"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, rgba(120,200,255,1) 15%, rgba(100,120,255,0.9) 30%, rgba(180,80,255,0.85) 45%, rgba(255,80,180,0.8) 60%, rgba(80,220,180,0.85) 75%, rgba(120,200,255,1) 88%, transparent 100%)',
          }}
        />

        {/* ── Shine sweep on open ── */}
        <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none z-10">
          <div
            className="absolute"
            style={{
              top: '-50%', left: '-50%', width: '200%', height: '200%',
              background:
                'linear-gradient(105deg, transparent 38%, rgba(255,255,255,0.6) 46%, rgba(255,255,255,0.85) 50%, rgba(200,230,255,0.6) 54%, transparent 62%)',
              animation: 'shineSweep 3.5s ease-in-out',
            }}
          />
        </div>

        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 w-10 h-10 rounded-full border flex items-center justify-center z-20"
          style={{
            borderColor: 'rgba(148,163,184,0.4)',
            background: 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(12px)',
            color: '#334155',
            boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.1) rotate(90deg)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.15)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1) rotate(0deg)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)';
          }}
          aria-label="Close persona details"
        >
          <span className="material-symbols-outlined">close</span>
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 md:p-8">
          {/* Left column */}
          <div className="lg:col-span-5">
            <div
              className="relative h-72 rounded-2xl overflow-hidden"
              style={{
                border: '1px solid rgba(148,163,184,0.3)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.5)',
              }}
            >
              <Image
                src={persona.image_url || `/personas/${persona.id}.png`}
                alt={persona.name}
                fill
                className="object-cover"
              />
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, transparent 40%, rgba(0,0,0,0.2) 100%)',
                }}
              />
            </div>

            <div
              className="mt-4 rounded-2xl p-4"
              style={{
                background: 'linear-gradient(135deg, rgba(239,246,255,0.9), rgba(224,242,254,0.7))',
                border: '1px solid rgba(0,101,145,0.15)',
                backdropFilter: 'blur(12px)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8), 0 4px 16px rgba(0,101,145,0.08)',
              }}
            >
              <p className="text-xs font-bold uppercase tracking-wide" style={{ color: '#0369a1', fontFamily: 'Inter, sans-serif' }}>
                Estimated Net Worth
              </p>
              <p className="text-2xl font-black mt-1" style={{ color: '#0f172a', fontFamily: 'Manrope, sans-serif' }}>
                {persona.net_worth_estimate || 'N/A'}
              </p>
              <p className="text-xs mt-2" style={{ color: '#475569', fontFamily: 'Inter, sans-serif' }}>
                Risk profile: {persona.risk_profile} • Horizon: {persona.time_horizon}
              </p>
            </div>
          </div>

          {/* Right column */}
          <div className="lg:col-span-7 space-y-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide" style={{ color: '#0369a1', fontFamily: 'Inter, sans-serif' }}>
                {persona.era}
              </p>
              <h2 className="text-3xl font-black mt-1" style={{ color: '#0f172a', fontFamily: 'Manrope, sans-serif' }}>
                {persona.name}
              </h2>
              <p className="text-sm mt-1" style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}>
                {persona.title}
              </p>
            </div>

            <p className="text-base leading-relaxed" style={{ color: '#1e293b', fontFamily: 'Inter, sans-serif' }}>
              {persona.persona_summary}
            </p>

            <div
              className="rounded-2xl p-4"
              style={{
                background: 'linear-gradient(135deg, rgba(248,250,252,0.95), rgba(241,248,255,0.85))',
                border: '1px solid rgba(148,163,184,0.25)',
                backdropFilter: 'blur(8px)',
              }}
            >
              <p className="text-xs font-bold uppercase tracking-wide" style={{ color: '#334155', fontFamily: 'Inter, sans-serif' }}>
                Famous Advice
              </p>
              <p className="text-lg italic mt-2" style={{ color: '#0f172a', fontFamily: 'Manrope, sans-serif' }}>
                &ldquo;{persona.famous_advice || 'Focus on discipline, process, and long-term thinking.'}&rdquo;
              </p>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: '#334155', fontFamily: 'Inter, sans-serif' }}>
                Signature Bets / Focus
              </p>
              <div className="flex flex-wrap gap-2">
                {(persona.signature_bets && persona.signature_bets.length > 0 ? persona.signature_bets : persona.stocks_focus).slice(0, 6).map((item) => (
                  <span
                    key={item}
                    className="px-3 py-1.5 rounded-full text-xs font-bold"
                    style={{
                      background: 'linear-gradient(135deg, rgba(226,232,240,0.9), rgba(241,245,249,0.8))',
                      color: '#0f172a',
                      fontFamily: 'Inter, sans-serif',
                      backdropFilter: 'blur(6px)',
                      border: '0.5px solid rgba(148,163,184,0.3)',
                    }}
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: '#334155', fontFamily: 'Inter, sans-serif' }}>
                Notable Facts
              </p>
              <ul className="space-y-2">
                {(persona.notable_facts || persona.principles.slice(0, 3)).slice(0, 3).map((fact) => (
                  <li key={fact} className="text-sm leading-relaxed" style={{ color: '#1e293b', fontFamily: 'Inter, sans-serif' }}>
                    • {fact}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes personaBackdropIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes personaBackdropOut {
          from { opacity: 1; }
          to   { opacity: 0; }
        }
        @keyframes personaModalBloom {
          0%   { opacity: 0; transform: scale(0.6) translateY(20px); filter: blur(8px); }
          60%  { opacity: 1; filter: blur(0px); }
          80%  { transform: scale(1.02) translateY(-2px); }
          100% { transform: scale(1) translateY(0); filter: blur(0px); }
        }
        @keyframes personaModalClose {
          0%   { opacity: 1; transform: scale(1) translateY(0); filter: blur(0px); }
          100% { opacity: 0; transform: scale(0.85) translateY(12px); filter: blur(4px); }
        }
      `}</style>
    </div>
  );
}
