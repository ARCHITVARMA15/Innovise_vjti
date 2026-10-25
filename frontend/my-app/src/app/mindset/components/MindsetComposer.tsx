'use client';

import { useState } from 'react';

interface Props {
  disabled: boolean;
  selectedPersonaName: string;
  onSend: (query: string) => void;
}

export default function MindsetComposer({ disabled, selectedPersonaName, onSend }: Props) {
  const [input, setInput] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || disabled) return;
    onSend(input.trim());
    setInput('');
  }

  return (
    <form
      onSubmit={submit}
      className="w-full mx-auto rounded-3xl p-3 md:p-4"
      style={{
        background: 'linear-gradient(135deg, #ffffff 0%, #f8fbff 100%)',
        border: '1px solid rgba(148,163,184,0.25)',
        boxShadow: '0 14px 28px rgba(11,28,48,0.07)',
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span
          className="material-symbols-outlined"
          style={{ fontSize: '16px', color: '#006591', fontVariationSettings: "'FILL' 1, 'wght' 500" }}
        >
          psychology
        </span>
        <span className="text-xs font-bold" style={{ color: '#006591', fontFamily: 'Inter, sans-serif' }}>
          Thinking as {selectedPersonaName}
        </span>
      </div>

      <div className="flex gap-3 items-center">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={disabled}
          placeholder="Ask a portfolio or stock question. The selected investor persona will guide the reasoning style."
          className="w-full h-14 rounded-2xl px-5 outline-none text-base"
          style={{
            border: '1px solid rgba(148,163,184,0.3)',
            backgroundColor: '#ffffff',
            color: '#0f172a',
            fontFamily: 'Inter, sans-serif',
          }}
        />

        <button
          type="submit"
          disabled={disabled || !input.trim()}
          className="h-14 px-8 rounded-2xl text-sm font-bold transition-opacity disabled:opacity-50 shrink-0"
          style={{ backgroundColor: '#0f172a', color: '#ffffff', fontFamily: 'Inter, sans-serif' }}
        >
          Ask Mindset
        </button>
      </div>
    </form>
  );
}
