'use client';

import type { IterationOutput, LayerTrace, WorkflowSummary } from '@/lib/types/agent';

interface Props {
  traces: LayerTrace[];
  outputs: IterationOutput[];
  summary: WorkflowSummary | null;
}

function groupByIteration<T extends { iteration: number }>(items: T[]): Map<number, T[]> {
  const grouped = new Map<number, T[]>();
  for (const item of items) {
    const existing = grouped.get(item.iteration) || [];
    existing.push(item);
    grouped.set(item.iteration, existing);
  }
  return grouped;
}

export default function IterationTimeline({ traces, outputs, summary }: Props) {
  if (traces.length === 0 && outputs.length === 0) return null;

  const traceMap = groupByIteration(traces);
  const outputMap = groupByIteration(outputs);
  const iterations = Array.from(new Set([...traceMap.keys(), ...outputMap.keys()])).sort((a, b) => a - b);

  return (
    <div>
      <SectionLabel icon="layers" label="Workflow Timeline" />

      {summary && (
        <div
          className="mb-3 p-2.5 rounded-lg"
          style={{ backgroundColor: '#e5eeff', border: '1px solid rgba(0,101,145,0.2)' }}
        >
          <p className="text-[11px] font-bold" style={{ color: '#006591', fontFamily: 'Inter, sans-serif' }}>
            Completed in {summary.iterations} iteration{summary.iterations > 1 ? 's' : ''} ({summary.stop_reason})
          </p>
        </div>
      )}

      <div className="space-y-3">
        {iterations.map((iteration) => {
          const t = traceMap.get(iteration) || [];
          const o = outputMap.get(iteration) || [];

          return (
            <div
              key={iteration}
              className="p-3 rounded-lg"
              style={{ backgroundColor: '#ffffff', border: '1px solid rgba(198,198,205,0.18)' }}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className="text-[11px] font-extrabold uppercase tracking-wider"
                  style={{ color: '#131b2e', fontFamily: 'Inter, sans-serif' }}
                >
                  Iteration {iteration}
                </span>
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: '#f1f5f9', color: '#64748b', fontFamily: 'Inter, sans-serif' }}
                >
                  {t.length + o.length} updates
                </span>
              </div>

              {t.length > 0 && (
                <div className="space-y-1.5 mb-2">
                  {t.map((trace, idx) => (
                    <div key={`${trace.layer}-${idx}`} className="rounded-md p-2" style={{ backgroundColor: '#f8f9ff' }}>
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="text-[10px] font-bold uppercase tracking-wider"
                          style={{ color: '#006591', fontFamily: 'Inter, sans-serif' }}
                        >
                          {trace.layer}
                        </span>
                        <span
                          className="text-[10px]"
                          style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}
                        >
                          {trace.intent}
                        </span>
                        {trace.confidence != null && (
                          <span
                            className="text-[10px] font-bold ml-auto"
                            style={{ color: '#009668', fontFamily: 'Inter, sans-serif' }}
                          >
                            {Math.round(trace.confidence * 100)}%
                          </span>
                        )}
                      </div>
                      <p className="text-[11px]" style={{ color: '#0f172a', fontFamily: 'Inter, sans-serif' }}>
                        {trace.summary}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {o.length > 0 && (
                <div className="space-y-1.5">
                  {o.map((out, idx) => (
                    <div key={`${out.layer}-${idx}`} className="rounded-md p-2" style={{ backgroundColor: '#f6f8fc' }}>
                      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}>
                        {out.layer} output
                      </p>
                      {out.tools && out.tools.length > 0 && (
                        <p className="text-[11px] mt-1" style={{ color: '#334155', fontFamily: 'Inter, sans-serif' }}>
                          Tools: {out.tools.join(', ')}
                        </p>
                      )}
                      {out.tool_summaries && out.tool_summaries.length > 0 && (
                        <div className="mt-1.5 space-y-1">
                          {out.tool_summaries.slice(0, 3).map((item, i) => (
                            <p key={i} className="text-[11px]" style={{ color: '#475569', fontFamily: 'Inter, sans-serif' }}>
                              • {item}
                            </p>
                          ))}
                        </div>
                      )}
                      {out.answer_preview && (
                        <p className="text-[11px] mt-1.5" style={{ color: '#0f172a', fontFamily: 'Inter, sans-serif' }}>
                          {out.answer_preview}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SectionLabel({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-2">
      <span
        className="material-symbols-outlined"
        style={{ fontSize: '14px', color: '#64748b', fontVariationSettings: "'FILL' 0, 'wght' 400" }}
      >
        {icon}
      </span>
      <span
        className="text-[11px] font-bold uppercase tracking-wider"
        style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}
      >
        {label}
      </span>
    </div>
  );
}
