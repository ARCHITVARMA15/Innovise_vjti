'use client';

import type { ThinkingStep } from '@/lib/types/agent';

interface Props {
  step: ThinkingStep;
}

export default function ThinkingStepRow({ step }: Props) {
  const isDone = step.status === 'done';
  const isError = step.status === 'error';
  const isRunning = step.status === 'running';

  const iconName = isDone ? 'check_circle' : isError ? 'error' : 'progress_activity';
  const iconColor = isDone ? '#009668' : isError ? '#ba1a1a' : '#006591';

  return (
    <div className="flex items-center gap-2 py-1">
      <span
        className={`material-symbols-outlined ${isRunning ? 'animate-spin' : ''}`}
        style={{
          fontSize: '14px',
          color: iconColor,
          fontVariationSettings: "'FILL' 1, 'wght' 400",
        }}
      >
        {iconName}
      </span>
      <span
        className="text-[12px]"
        style={{
          color: isDone ? '#64748b' : '#0f172a',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        {step.step}
      </span>
      {step.tool && (
        <span
          className="text-[10px] font-bold px-1.5 py-0.5 rounded"
          style={{
            backgroundColor: '#f1f5f9',
            color: '#64748b',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          {step.tool}
        </span>
      )}
    </div>
  );
}
