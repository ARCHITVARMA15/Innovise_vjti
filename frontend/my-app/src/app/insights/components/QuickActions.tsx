'use client';

import { useState } from 'react';
import { getTheme } from '../theme';

interface Props {
  onSend: (query: string, options?: { includePortfolioContext?: boolean }) => void;
  disabled: boolean;
  activeIntent: string;
}

const ACTIONS = [
  {
    icon: 'fact_check',
    label: 'Verify News',
    color: '#006591',
    bg: '#e5eeff',
    placeholder: 'Paste a claim or headline to verify...',
  },
  {
    icon: 'query_stats',
    label: 'Analyze Asset',
    color: '#7c3aed',
    bg: '#f3e8ff',
    placeholder: 'Enter a ticker or asset name (e.g. RELIANCE, NVDA)...',
  },
  {
    icon: 'strategy',
    label: 'Strategy Advice',
    color: '#009668',
    bg: '#e6f9f1',
    prompt: 'Build a strategy based on current market conditions with clear buy/sell/hold actions.',
  },
  {
    icon: 'device_hub',
    label: 'What If...',
    color: '#c9a84c',
    bg: '#fef9e7',
  placeholder: 'Describe a scenario (e.g. "What if oil prices spike to ₹150?")',
  },
  {
    icon: 'gavel',
    label: 'Regulators Check',
    color: '#d14334',
    bg: '#fff1ef',
    placeholder: 'Describe an action/plan to check SEBI/tax compliance risk...',
  },
];

export default function QuickActions({ onSend, disabled, activeIntent }: Props) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [inputVal, setInputVal] = useState('');
  const theme = getTheme(activeIntent);

  function handleClick(idx: number) {
    const action = ACTIONS[idx];
    if (action.prompt) {
      onSend(action.prompt);
      return;
    }
    setActiveIdx(activeIdx === idx ? null : idx);
    setInputVal('');
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!inputVal.trim()) return;
    const prefix =
      activeIdx === 0 ? 'Verify: '
      : activeIdx === 1 ? 'Analyze '
      : activeIdx === 2 ? 'Strategy: '
      : activeIdx === 3 ? 'What if '
      : 'Regulatory check: ';
    onSend(`${prefix}${inputVal.trim()}`);
    setActiveIdx(null);
    setInputVal('');
  }

  return (
    <div className="space-y-2 p-2 rounded-xl" style={{ border: `1px solid ${theme.softBorder}`, backgroundColor: theme.softBg }}>
      <div className="flex gap-2">
        {ACTIONS.map((action, idx) => (
          <button
            key={action.label}
            disabled={disabled}
            onClick={() => handleClick(idx)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-bold transition-all disabled:opacity-50"
            style={{
              backgroundColor: activeIdx === idx ? action.color : action.bg,
              color: activeIdx === idx ? '#ffffff' : action.color,
              fontFamily: 'Inter, sans-serif',
              border: `1px solid ${activeIdx === idx ? action.color : 'transparent'}`,
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '16px', fontVariationSettings: "'FILL' 0, 'wght' 400" }}
            >
              {action.icon}
            </span>
            {action.label}
          </button>
        ))}
      </div>

      {activeIdx !== null && ACTIONS[activeIdx].placeholder && (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            autoFocus
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder={ACTIONS[activeIdx].placeholder}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm outline-none"
            style={{
              backgroundColor: '#ffffff',
              border: `1px solid ${theme.softBorder}`,
              color: '#0f172a',
              fontFamily: 'Inter, sans-serif',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = ACTIONS[activeIdx!].color;
              e.currentTarget.style.boxShadow = `0 0 0 2px ${ACTIONS[activeIdx!].color}22`;
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'rgba(198,198,205,0.3)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
          <button
            type="submit"
            disabled={!inputVal.trim()}
            className="px-5 py-2.5 rounded-lg text-[12px] font-bold text-white transition-opacity disabled:opacity-40"
            style={{ backgroundColor: ACTIONS[activeIdx].color, fontFamily: 'Inter, sans-serif' }}
          >
            Go
          </button>
          <button
            type="button"
            onClick={() => setActiveIdx(null)}
            className="px-3 py-2.5 rounded-lg text-[12px] font-medium transition-colors"
            style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}
          >
            Cancel
          </button>
        </form>
      )}
    </div>
  );
}
