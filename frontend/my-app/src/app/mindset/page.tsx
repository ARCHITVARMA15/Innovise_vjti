'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { getMindsetPersonas, streamMindsetChat } from '@/lib/api/mindset';
import type { InvestorPersona, MindsetChatMessage } from '@/lib/types/mindset';
import PersonaCard from './components/PersonaCard';
import PersonaDetailModal from './components/PersonaDetailModal';
import MindsetComposer from './components/MindsetComposer';
import MindsetMessageBubble from './components/MindsetMessageBubble';


// ── 2-state transition: 'start' (card position) → 'animate' (center, full-size, flipped) ──
// Uses ONLY transform changes so the browser stays on the GPU compositor thread.
interface ExpandState {
  active: boolean;
  rect: DOMRect | null;
  persona: InvestorPersona | null;
  // 'start': cloned card visually sits on top of the source card
  // 'animate': single CSS transition moves it to center + flips + scales up
  phase: 'start' | 'animate' | 'done';
}

const MODAL_W = () => Math.min(960, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 64);
const MODAL_H = () => Math.min(600, (typeof window !== 'undefined' ? window.innerHeight : 800) - 80);

export default function MindsetPage() {
  const [personas, setPersonas] = useState<InvestorPersona[]>([]);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>('');

  const [messages, setMessages] = useState<MindsetChatMessage[]>([]);
  const [thinkingSteps, setThinkingSteps] = useState<string[]>([]);
  const [streamingAnswer, setStreamingAnswer] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isPersonaModalOpen, setIsPersonaModalOpen] = useState(false);
  const [modalPersona, setModalPersona] = useState<InvestorPersona | null>(null);

  const [expand, setExpand] = useState<ExpandState>({
    active: false, rect: null, persona: null, phase: 'done',
  });

  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let active = true;
    getMindsetPersonas()
      .then((rows) => {
        if (!active) return;
        setPersonas(rows);
        if (rows.length > 0) setSelectedPersonaId(rows[0].id);
      })
      .catch(() => { if (!active) return; setPersonas([]); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, streamingAnswer]);

  const selectedPersona = useMemo(
    () => personas.find((p) => p.id === selectedPersonaId) ?? null,
    [personas, selectedPersonaId],
  );

  function handlePersonaSelect(personaId: string, rect: DOMRect) {
    setSelectedPersonaId(personaId);
    const selected = personas.find((p) => p.id === personaId) ?? null;
    if (!selected) return;
    setModalPersona(selected);

    // Mount the clone at the card's visual position (phase = 'start', no transition yet)
    setExpand({ active: true, rect, persona: selected, phase: 'start' });

    // Two rAFs: first lets React paint the 'start' state, second triggers the CSS transition
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setExpand((p) => ({ ...p, phase: 'animate' }));
      });
    });

    // Remove overlay AND open modal in the same tick — no gap, no flash
    setTimeout(() => {
      setIsPersonaModalOpen(true);
      setExpand({ active: false, rect: null, persona: null, phase: 'done' });
    }, 750);
  }

  async function handleSend(query: string) {
    if (!selectedPersona || isStreaming) return;

    const recentHistory = messages
      .slice(-6)
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n');

    const extraContext = [
      `Current persona: ${selectedPersona.name} (${selectedPersona.era})`,
      `Persona time horizon: ${selectedPersona.time_horizon}`,
      recentHistory ? `Recent conversation history:\n${recentHistory}` : '',
    ].filter(Boolean).join('\n\n');

    const userMessage: MindsetChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setThinkingSteps([]);
    setStreamingAnswer('');
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;
    let answerBuffer = '';

    try {
      await streamMindsetChat(query, selectedPersona.id, {
        onThinking: (step) => setThinkingSteps((prev) => [...prev, step]),
        onAnswerStart: () => setStreamingAnswer(''),
        onAnswerChunk: (content) => { answerBuffer += content; setStreamingAnswer(answerBuffer); },
        onAnswerEnd: () => {
          const assistantMessage: MindsetChatMessage = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: answerBuffer,
            timestamp: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, assistantMessage]);
          setStreamingAnswer('');
        },
        onDone: () => setIsStreaming(false),
        onError: (message) => {
          const assistantError: MindsetChatMessage = {
            id: `assistant-error-${Date.now()}`,
            role: 'assistant',
            content: `Error: ${message}`,
            timestamp: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, assistantError]);
          setIsStreaming(false);
        },
      }, controller.signal, extraContext);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') { setIsStreaming(false); return; }
      setIsStreaming(false);
    }
  }

  // ── Compute the overlay card transform for each phase ───────────────────────
  // The card clone is ALWAYS positioned at the modal's final resting place (centered).
  // We use transform to visually move it back to the card's position (phase='start')
  // then transition to identity (phase='animate'). This keeps everything on the GPU.
  function getOverlayTransform(): string {
    if (!expand.rect) return '';
    const mw = MODAL_W();
    const mh = MODAL_H();
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;

    // Center of the source card
    const cardCX = expand.rect.left + expand.rect.width / 2;
    const cardCY = expand.rect.top  + expand.rect.height / 2;
    // Center of the viewport (where the modal will sit)
    const modalCX = vw / 2;
    const modalCY = vh / 2;

    // Offset needed to move the centered modal element onto the card
    const tx = cardCX - modalCX;
    const ty = cardCY - modalCY;
    // Scale needed to shrink the modal element down to card size
    const sx = expand.rect.width  / mw;
    const sy = expand.rect.height / mh;

    if (expand.phase === 'start') {
      // No perspective yet — just jump to card position, no rotation
      return `perspective(700px) translate(${tx}px, ${ty}px) scale(${sx}, ${sy}) rotateY(0deg)`;
    }
    // 'animate' phase: fly to center + spin 360°
    // perspective() is baked in so the flip depth is visible
    return `perspective(700px) translate(0px, 0px) scale(1, 1) rotateY(360deg)`;
  }

  return (
    <div
      className="flex flex-col gap-0 bg-white border rounded-2xl overflow-y-auto"
      style={{
        height: 'calc(100vh - 122px)',
        borderColor: 'rgba(203,213,225,0.45)',
      }}
    >
      {/* TOP — Persona Selection */}
      <section
        className="shrink-0 border-b overflow-hidden"
        style={{
          minHeight: '390px',
          borderColor: 'rgba(203,213,225,0.4)',
          background: 'linear-gradient(135deg, #f8fbff 0%, #eef6ff 50%, #f7fbff 100%)',
        }}
      >
        <div className="px-6 pt-3 pb-4 md:px-8 md:pt-4 md:pb-5">
          <div>
            <h1
              className="text-3xl md:text-4xl font-black tracking-tight leading-none"
              style={{ color: '#0f172a', fontFamily: 'Manrope, sans-serif' }}
            >
              Pick Your Mindset
            </h1>
            <p className="text-sm md:text-base mt-2 opacity-80" style={{ color: '#334155', fontFamily: 'Inter, sans-serif' }}>
              Select an investor&apos;s mental model to guide your analysis
            </p>
          </div>

          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 items-stretch">
            {personas.slice(0, 5).map((persona) => (
              <div key={persona.id} className="min-w-0">
                <PersonaCard
                  persona={persona}
                  selected={persona.id === selectedPersonaId}
                  onSelect={handlePersonaSelect}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BOTTOM — Chat */}
      <section className="flex flex-col min-h-105">
        <div
          ref={listRef}
          className="relative flex-1 overflow-y-auto px-6 md:px-8 py-4 min-h-55"
          style={{ background: '#ffffff', scrollBehavior: 'smooth' }}
        >
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
            style={{ zIndex: 0 }}
            aria-hidden="true"
          >
            <span
              className="select-none font-semibold"
              style={{
                fontFamily: 'Manrope, sans-serif',
                fontSize: 'clamp(18px, 2.5vw, 28px)',
                color: 'rgba(71, 85, 105, 0.55)',
              }}
            >
              {selectedPersona ? `${selectedPersona.name} Mindset` : 'Veritas Mindset'}
            </span>
          </div>

          {messages.length === 0 && !isStreaming ? (
            <div className="relative z-10 h-24" />
          ) : (
            <div className="relative z-10 space-y-4 max-w-6xl mx-auto">
              {messages.map((msg) => (
                <MindsetMessageBubble key={msg.id} role={msg.role} content={msg.content} />
              ))}
              {isStreaming && streamingAnswer && (
                <MindsetMessageBubble role="assistant" content={streamingAnswer} isStreaming={true} />
              )}
            </div>
          )}
        </div>

        <div
          className="shrink-0 border-t px-6 md:px-8 py-3 md:py-4"
          style={{ backgroundColor: '#ffffff', borderColor: 'rgba(203,213,225,0.4)' }}
        >
          <div className="max-w-6xl mx-auto">
            <MindsetComposer
              disabled={!selectedPersona || isStreaming}
              selectedPersonaName={selectedPersona?.name || ''}
              onSend={handleSend}
            />
          </div>
        </div>
      </section>

      {/* ── Cinematic Transition Overlay — pure transform, GPU composited ── */}
      {expand.active && expand.rect && expand.persona && (
        <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 60 }}>

          {/* Backdrop — fades in with the animation */}
          <div
            className="absolute inset-0"
            style={{
              backgroundColor: expand.phase === 'animate' ? 'rgba(7,11,25,0.72)' : 'rgba(7,11,25,0)',
              backdropFilter: expand.phase === 'animate' ? 'blur(18px)' : 'blur(0px)',
              transition: 'background-color 0.7s ease, backdrop-filter 0.7s ease',
            }}
          />

          {/* Burst ring — appears when animation starts */}
          {expand.phase === 'animate' && (
            <div
              className="absolute pointer-events-none"
              style={{
                left: '50%', top: '50%',
                width: '500px', height: '500px',
                borderRadius: '50%',
                boxShadow: '0 0 0 0 rgba(57,184,253,0.7)',
                animation: 'burstRing 0.8s ease-out forwards',
                zIndex: 59,
              }}
            />
          )}

          {/*
            The card clone — always rendered at modal size, centered in the viewport.
            'start' phase: transform moves it back onto the source card (no transition = instant).
            'animate' phase: CSS transition flies it to center + rotates 360° on Y axis.
            Only 'transform' changes → 100% GPU compositor, zero layout reflow.
          */}
          {/* Card clone — pure visual shell, no content inside */}
          <div
            style={{
              position: 'fixed',
              left: '50%',
              top: '50%',
              width: MODAL_W(),
              height: MODAL_H(),
              marginLeft: -MODAL_W() / 2,
              marginTop:  -MODAL_H() / 2,
              transform: getOverlayTransform(),
              transition: expand.phase === 'animate'
                ? 'transform 0.7s cubic-bezier(0.25, 0.8, 0.25, 1)'
                : 'none',
              transformOrigin: 'center center',
              willChange: 'transform',
              overflow: 'hidden',
              zIndex: 61,
              borderRadius: '24px',
              animation: expand.phase === 'animate' ? 'flipColorFlash 0.7s ease-in-out forwards' : 'none',
              border: '1.5px solid rgba(0,101,145,0.35)',
              boxShadow: expand.phase === 'animate'
                ? '0 0 100px rgba(0,101,145,0.4), 0 0 200px rgba(57,184,253,0.2), 0 50px 100px rgba(0,0,0,0.25)'
                : '0 0 40px rgba(0,101,145,0.25), 0 16px 40px rgba(0,0,0,0.12)',
            }}
          >
            {/* Prismatic top edge */}
            <div
              className="absolute top-0 left-0 right-0 h-[2px] pointer-events-none z-20"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(120,200,255,1) 15%, rgba(100,120,255,0.9) 30%, rgba(180,80,255,0.85) 45%, rgba(255,80,180,0.8) 60%, rgba(80,220,180,0.85) 75%, rgba(120,200,255,1) 88%, transparent 100%)',
              }}
            />
            {/* Shine sweep — plays once */}
            <div className="absolute inset-0 overflow-hidden z-10 pointer-events-none">
              <div
                className="absolute"
                style={{
                  top: '-50%', left: '-50%', width: '200%', height: '200%',
                  background: 'linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.55) 43%, rgba(255,255,255,0.9) 50%, rgba(200,230,255,0.55) 57%, transparent 65%)',
                  animation: 'shineSweep 1s ease-in-out',
                }}
              />
            </div>
            {/* Inner radial glow */}
            <div
              className="absolute inset-0 pointer-events-none z-0"
              style={{
                background: 'radial-gradient(ellipse at center, rgba(0,101,145,0.12) 0%, rgba(57,184,253,0.06) 40%, transparent 70%)',
              }}
            />
          </div>
        </div>
      )}

      <PersonaDetailModal
        open={isPersonaModalOpen}
        persona={modalPersona}
        onClose={() => setIsPersonaModalOpen(false)}
      />

      {/* ── Global keyframes ── */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes shineSweep {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes holoShift {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes selectedRing {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50%       { opacity: 0.7; transform: scale(1.02); }
        }
        @keyframes burstRing {
          0%   { transform: translate(-50%, -50%) scale(0.1); opacity: 1; box-shadow: 0 0 0 0 rgba(57,184,253,0.8); }
          100% { transform: translate(-50%, -50%) scale(1.6); opacity: 0; box-shadow: 0 0 0 80px rgba(57,184,253,0); }
        }
        @keyframes flipColorFlash {
          0%   { background: linear-gradient(145deg, rgba(255,255,255,0.92), rgba(240,250,255,0.88)); }
          42%  { background: linear-gradient(145deg, rgba(0,80,160,0.95), rgba(10,140,255,0.9)); }
          50%  { background: linear-gradient(145deg, rgba(0,60,140,0.98), rgba(57,184,253,0.95)); }
          58%  { background: linear-gradient(145deg, rgba(0,80,160,0.95), rgba(10,140,255,0.9)); }
          100% { background: linear-gradient(145deg, rgba(255,255,255,0.97), rgba(245,251,255,0.94)); }
        }
      `}} />
    </div>
  );
}

