'use client';

import { useState, useRef, useEffect } from 'react';
import type { ChatMessage, ThinkingStep } from '@/lib/types/agent';
import MessageBubble from './MessageBubble';
import ThinkingStepRow from './ThinkingStep';
import { getTheme } from '../theme';

interface Props {
  messages: ChatMessage[];
  thinkingSteps: ThinkingStep[];
  streamingAnswer: string;
  isStreaming: boolean;
  activeIntent: string;
  onSend: (query: string, options?: { includePortfolioContext?: boolean }) => void;
  onStop: () => void;
  onNewChat: () => void;
}

export default function ChatPanel({
  messages,
  thinkingSteps,
  streamingAnswer,
  isStreaming,
  activeIntent,
  onSend,
  onStop,
  onNewChat,
}: Props) {
  const [input, setInput] = useState('');
  const [includePortfolioContext, setIncludePortfolioContext] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages / streaming
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, thinkingSteps, streamingAnswer]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    onSend(input.trim(), { includePortfolioContext });
    setInput('');
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  const isEmpty = messages.length === 0 && !isStreaming;
  const theme = getTheme(activeIntent);

  return (
    <div
      className="flex flex-col flex-1 min-h-0 rounded-xl overflow-hidden"
      style={{
        backgroundColor: '#ffffff',
        border: `1px solid ${theme.softBorder}`,
        boxShadow: '0 8px 32px rgba(11,28,48,0.04)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ borderBottom: `1px solid ${theme.softBorder}`, backgroundColor: theme.softBg }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center"
            style={{ backgroundColor: '#131b2e' }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '14px', color: theme.accent, fontVariationSettings: "'FILL' 1, 'wght' 400" }}
            >
              neurology
            </span>
          </div>
          <span
            className="text-sm font-bold"
            style={{ color: '#0f172a', fontFamily: 'Manrope, sans-serif' }}
          >
            Veritas
          </span>
          {isStreaming && (
            <span
              className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{ backgroundColor: '#ffffff', color: theme.accent, fontFamily: 'Inter, sans-serif', border: `1px solid ${theme.softBorder}` }}
            >
              Researching...
            </span>
          )}
        </div>
        <button
          onClick={onNewChat}
          className="text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors"
          style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          New Chat
        </button>
      </div>

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {isEmpty && (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{ backgroundColor: '#131b2e' }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: '28px', color: '#39b8fd', fontVariationSettings: "'FILL' 1, 'wght' 300" }}
              >
                neurology
              </span>
            </div>
            <h3
              className="text-lg font-bold mb-1"
              style={{ color: '#0f172a', fontFamily: 'Manrope, sans-serif' }}
            >
              Veritas Research Agent
            </h3>
            <p
              className="text-sm max-w-sm"
              style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}
            >
              Verify news, analyze assets, get strategy advice, or explore what-if scenarios.
              Use the quick actions above or type a question below.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Thinking steps while streaming */}
        {isStreaming && thinkingSteps.length > 0 && (
          <div className="space-y-1.5 pl-2">
            {thinkingSteps.map((step, i) => (
              <ThinkingStepRow key={i} step={step} />
            ))}
          </div>
        )}

        {/* Streaming answer preview */}
        {streamingAnswer && (
          <MessageBubble
            message={{
              id: 'streaming',
              role: 'assistant',
              content: streamingAnswer,
              timestamp: new Date().toISOString(),
            }}
            isStreaming
          />
        )}
      </div>

      {/* Input area */}
      <form
        onSubmit={handleSubmit}
        className="px-4 py-3 flex gap-2 items-end"
        style={{ borderTop: '1px solid rgba(226,232,240,0.5)' }}
      >
        <button
          type="button"
          onClick={() => setIncludePortfolioContext((prev) => !prev)}
          disabled={isStreaming}
          className="shrink-0 px-2.5 py-2.5 rounded-lg text-[11px] font-bold transition-colors disabled:opacity-50 flex items-center gap-1"
          style={{
            backgroundColor: includePortfolioContext ? '#e6f9f1' : '#f1f5f9',
            color: includePortfolioContext ? '#009668' : '#64748b',
            border: `1px solid ${includePortfolioContext ? '#00966855' : '#cbd5e1'}`,
            fontFamily: 'Inter, sans-serif',
          }}
          title="When on, strategy mode can use your portfolio as context"
        >
          <span className="material-symbols-outlined align-middle" style={{ fontSize: '16px' }}>
            account_balance_wallet
          </span>
          <span>{includePortfolioContext ? 'Portfolio On' : 'Portfolio Off'}</span>
        </button>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Veritas anything..."
          rows={1}
          className="flex-1 resize-none px-4 py-2.5 rounded-lg text-sm outline-none"
          style={{
            backgroundColor: '#f8f9ff',
            border: '1px solid rgba(198,198,205,0.2)',
            color: '#0f172a',
            fontFamily: 'Inter, sans-serif',
            maxHeight: '120px',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = theme.accent;
            e.currentTarget.style.boxShadow = `0 0 0 2px ${theme.accent}22`;
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'rgba(198,198,205,0.2)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
        {isStreaming ? (
          <button
            type="button"
            onClick={onStop}
            className="px-4 py-2.5 rounded-lg text-[12px] font-bold text-white transition-opacity"
            style={{ backgroundColor: '#ba1a1a', fontFamily: 'Inter, sans-serif' }}
          >
            Stop
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="px-4 py-2.5 rounded-lg text-[12px] font-bold text-white transition-opacity disabled:opacity-40"
            style={{ backgroundColor: theme.accent, fontFamily: 'Inter, sans-serif' }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '18px', fontVariationSettings: "'FILL' 1, 'wght' 400" }}
            >
              send
            </span>
          </button>
        )}
      </form>
    </div>
  );
}
