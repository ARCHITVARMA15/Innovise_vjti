'use client';

import type { IterationOutput, WorkflowSummary } from '@/lib/types/agent';
import { getTheme } from '../theme';

interface Props {
  outputs: IterationOutput[];
  activeIntent: string;
  workflowSummary: WorkflowSummary | null;
}

export default function ModePlanCard({ outputs, activeIntent, workflowSummary }: Props) {
  const latestWithPlan = [...outputs]
    .reverse()
    .find((o) => o.mode_plan && o.intent === activeIntent);

  if (!latestWithPlan?.mode_plan) return null;

  const plan = latestWithPlan.mode_plan;
  const theme = getTheme(activeIntent);
  const markAllDone = workflowSummary?.stop_reason === 'answer_ready';

  return (
    <div>
      <SectionLabel icon="route" label="Mode Plan" />
      <div className="p-3 rounded-lg" style={{ backgroundColor: '#ffffff', border: `1px solid ${theme.softBorder}` }}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[12px] font-extrabold" style={{ color: theme.accent, fontFamily: 'Manrope, sans-serif' }}>
            {plan.title}
          </p>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: theme.softBg, color: theme.accent, fontFamily: 'Inter, sans-serif' }}>
            Iteration {plan.iteration}
          </span>
        </div>

        <div className="space-y-1.5">
          {plan.steps.map((step) => {
            const done = markAllDone ? true : step.status === 'done';
            return (
              <div key={step.index} className="flex items-start gap-2 rounded-md p-2" style={{ backgroundColor: done ? '#f8fffb' : '#f8f9ff' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '14px', color: done ? theme.accent : '#94a3b8' }}>
                  {done ? 'check_circle' : 'radio_button_unchecked'}
                </span>
                <p className="text-[11px] leading-snug" style={{ color: done ? '#0f172a' : '#64748b', fontFamily: 'Inter, sans-serif' }}>
                  {step.label}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-2">
      <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#64748b' }}>
        {icon}
      </span>
      <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}>
        {label}
      </span>
    </div>
  );
}
