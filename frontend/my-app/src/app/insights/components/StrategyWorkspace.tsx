'use client';

import { useMemo, useState } from 'react';
import type { DataSnapshot, IterationOutput } from '@/lib/types/agent';
import { saveStrategyDraft } from '@/lib/api/strategy';
import { getTheme } from '../theme';

interface Props {
  activeIntent: string;
  dataSnapshots: DataSnapshot[];
  iterationOutputs: IterationOutput[];
}

interface AllocationItem {
  label: string;
  currentPercent: number;
  targetPercent: number;
  status: string;
}

interface ParsedStrategyPayload {
  strategy_name?: string;
  strategy_description?: string;
  objective?: string;
  time_horizon?: string;
  risk_profile?: string;
  rebalance_rule?: string;
  max_drawdown_pct?: number;
  max_single_position_pct?: number;
  max_sector_exposure_pct?: number;
  stop_loss_rule?: string;
  entry_rule?: string;
  validation_metrics?: string[];
  recommended_actions?: string[];
  allocation_targets?: Record<string, number>;
}

export default function StrategyWorkspace({ activeIntent, dataSnapshots, iterationOutputs }: Props) {
  const isStrategyIntent = activeIntent === 'strategy';

  const [isApplying, setIsApplying] = useState(false);
  const [applyStatus, setApplyStatus] = useState('');

  const theme = getTheme(activeIntent);
  const summary = dataSnapshots.find((s) => s.type === 'portfolio_summary')?.data || {};
  const allocationData = dataSnapshots.find((s) => s.label === 'Allocation Mix')?.data || {};
  const riskProfile = dataSnapshots.find((s) => s.label === 'Risk Profile')?.data || {};
  const allocations = (allocationData.allocations as AllocationItem[] | undefined) || [];
  const hasSummary = !!summary && Object.keys(summary).length > 0;

  const latestStrategyOutput = [...iterationOutputs]
    .reverse()
    .find((o) => o.intent === 'strategy' && o.layer === 'execution');

  const allocationTargets = useMemo(() => {
    const out: Record<string, number> = {};
    for (const item of allocations) {
      const target = Number(item.targetPercent || 0);
      if (Number.isFinite(target)) {
        const id = item.label.toLowerCase().includes('domestic')
          ? 'domestic-equity'
          : item.label.toLowerCase().includes('international')
            ? 'international-equity'
            : item.label.toLowerCase().includes('fixed')
              ? 'fixed-income'
              : item.label.toLowerCase().includes('cash')
                ? 'cash-alternatives'
                : '';
        if (id) out[id] = target;
      }
    }
    return out;
  }, [allocations]);

  async function handleApplyToStrategyEditor() {
    if (!latestStrategyOutput) return;

    const parsed = parseStrategyPayload(latestStrategyOutput.answer_preview);

    const score = Number(riskProfile.score ?? 0);
    const grade = String(riskProfile.grade ?? 'N/A');
    const totalValue = Number(summary.total_value ?? 0);
    const pnlPct = Number(summary.total_pnl_percent ?? 0);

    const generatedName =
      parsed.strategy_name?.trim() ||
      `Veritas Strategy ${new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })}`;

    const generatedDescription =
      parsed.strategy_description?.trim() ||
      latestStrategyOutput.answer_preview?.trim() ||
      (hasSummary
        ? `Risk profile ${grade} (${score}). Portfolio value ${formatLargeNumber(totalValue)} with PnL ${pnlPct.toFixed(1)}%.`
        : 'Strategy draft generated from Veritas market research output.');

    const suggestedActions =
      (parsed.recommended_actions && parsed.recommended_actions.length > 0
        ? parsed.recommended_actions
        : (latestStrategyOutput.tool_summaries || [])).slice(0, 6);

    const mergedAllocationTargets =
      parsed.allocation_targets && Object.keys(parsed.allocation_targets).length > 0
        ? parsed.allocation_targets
        : (hasSummary ? allocationTargets : {});

    setIsApplying(true);
    setApplyStatus('');
    try {
      await saveStrategyDraft({
        name: generatedName,
        description: generatedDescription,
        ctaLabel: 'Apply Strategy',
        source: 'veritas',
        notes: 'Draft created from Veritas strategy workspace.',
        objective: parsed.objective || '',
        time_horizon: parsed.time_horizon || '',
        risk_profile: parsed.risk_profile || (hasSummary ? grade : ''),
        rebalance_rule: parsed.rebalance_rule || '',
        max_drawdown_pct: parsed.max_drawdown_pct ?? null,
        max_single_position_pct: parsed.max_single_position_pct ?? null,
        max_sector_exposure_pct: parsed.max_sector_exposure_pct ?? null,
        stop_loss_rule: parsed.stop_loss_rule || '',
        entry_rule: parsed.entry_rule || '',
        validation_metrics: parsed.validation_metrics || [],
        allocation_targets: mergedAllocationTargets,
        suggested_actions: suggestedActions,
      });
      setApplyStatus('Saved. Opening Strategy Maker...');
      window.location.href = '/portfolio?openStrategyMaker=1';
    } catch {
      setApplyStatus('Failed to save strategy draft.');
    } finally {
      setIsApplying(false);
    }
  }

  const score = Number(riskProfile.score ?? 0);
  const grade = String(riskProfile.grade ?? 'N/A');

  if (!isStrategyIntent) return null;

  return (
    <div>
      <SectionLabel icon="dashboard" label="Strategy Workspace" />
      <div className="space-y-3">
        {hasSummary ? (
          <div className="p-3 rounded-lg" style={{ backgroundColor: '#ffffff', border: `1px solid ${theme.softBorder}` }}>
            <p className="text-[12px] font-extrabold mb-2" style={{ color: theme.accent, fontFamily: 'Manrope, sans-serif' }}>
              Portfolio Pulse
            </p>
            <div className="grid grid-cols-3 gap-2">
              <Metric label="Value" value={formatLargeNumber(Number(summary.total_value ?? 0))} />
              <Metric
                label="PnL"
                value={`${Number(summary.total_pnl_percent ?? 0) >= 0 ? '+' : ''}${Number(summary.total_pnl_percent ?? 0).toFixed(1)}%`}
                valueColor={Number(summary.total_pnl_percent ?? 0) >= 0 ? '#009668' : '#ba1a1a'}
              />
              <Metric label="Cash" value={formatLargeNumber(Number(summary.cash ?? 0))} />
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-lg" style={{ backgroundColor: '#ffffff', border: `1px solid ${theme.softBorder}` }}>
            <p className="text-[12px] font-extrabold" style={{ color: theme.accent, fontFamily: 'Manrope, sans-serif' }}>
              Portfolio context is OFF
            </p>
            <p className="text-[11px] mt-1" style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}>
              You can still send this strategy output to Strategy Maker as a draft.
            </p>
          </div>
        )}

        {hasSummary && allocations.length > 0 && (
          <div className="p-3 rounded-lg" style={{ backgroundColor: '#ffffff', border: `1px solid ${theme.softBorder}` }}>
            <p className="text-[12px] font-extrabold mb-2" style={{ color: '#0f172a', fontFamily: 'Manrope, sans-serif' }}>
              Allocation vs Target
            </p>
            <div className="space-y-2">
              {allocations.slice(0, 5).map((item) => {
                const current = Number(item.currentPercent || 0);
                const target = Number(item.targetPercent || 0);
                const diff = current - target;
                const diffColor = diff > 0 ? '#c9a84c' : diff < 0 ? '#7c3aed' : '#009668';

                return (
                  <div key={item.label} className="rounded-md p-2" style={{ backgroundColor: '#f8f9ff' }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold" style={{ color: '#0f172a', fontFamily: 'Inter, sans-serif' }}>
                        {item.label}
                      </span>
                      <span className="text-[10px]" style={{ color: diffColor, fontFamily: 'Inter, sans-serif' }}>
                        {diff >= 0 ? '+' : ''}{diff.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full relative" style={{ backgroundColor: '#e2e8f0' }}>
                      <div className="h-2 rounded-full" style={{ width: `${Math.max(2, current)}%`, backgroundColor: theme.accent }} />
                      <div
                        className="absolute -top-0.5 w-1 h-3 rounded"
                        style={{ left: `${Math.min(98, Math.max(1, target))}%`, backgroundColor: '#131b2e' }}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-[10px]" style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}>Current {current.toFixed(0)}%</span>
                      <span className="text-[10px]" style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}>Target {target.toFixed(0)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {hasSummary && (
          <div className="p-3 rounded-lg" style={{ backgroundColor: '#ffffff', border: `1px solid ${theme.softBorder}` }}>
            <p className="text-[12px] font-extrabold mb-2" style={{ color: '#0f172a', fontFamily: 'Manrope, sans-serif' }}>
              Risk Gauge
            </p>
            <div className="flex items-center gap-3">
              <Gauge score={score} accent={theme.accent} />
              <div>
                <p className="text-[12px] font-extrabold" style={{ color: theme.accent, fontFamily: 'Manrope, sans-serif' }}>
                  {grade} ({score})
                </p>
                <p className="text-[11px]" style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}>
                  Strategy: {String(riskProfile.strategyName ?? 'N/A')}
                </p>
                <p className="text-[11px]" style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}>
                  Sectors {String(riskProfile.sectorCount ?? 'N/A')} • Asset classes {String(riskProfile.assetClassCount ?? 'N/A')}
                </p>
              </div>
            </div>
          </div>
        )}

        {latestStrategyOutput ? (
          <div className="p-3 rounded-lg" style={{ backgroundColor: '#ffffff', border: `1px solid ${theme.softBorder}` }}>
            <p className="text-[12px] font-extrabold mb-2" style={{ color: '#0f172a', fontFamily: 'Manrope, sans-serif' }}>
              Rebalance Signals
            </p>
            <div className="space-y-1.5">
              {(latestStrategyOutput.tool_summaries || []).slice(0, 4).map((summary, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="material-symbols-outlined" style={{ fontSize: '13px', color: theme.accent }}>
                    bolt
                  </span>
                  <p className="text-[11px]" style={{ color: '#334155', fontFamily: 'Inter, sans-serif' }}>
                    {summary}
                  </p>
                </div>
              ))}
              {(!latestStrategyOutput.tool_summaries || latestStrategyOutput.tool_summaries.length === 0) && (
                <p className="text-[11px]" style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}>
                  Strategy generated. You can still send it to Strategy Maker.
                </p>
              )}
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={handleApplyToStrategyEditor}
                disabled={isApplying}
                className="px-3 py-2 rounded-md text-[11px] font-bold text-white disabled:opacity-60"
                style={{ backgroundColor: theme.accent, fontFamily: 'Inter, sans-serif' }}
              >
                {isApplying ? 'Saving...' : 'Apply to Strategy Maker'}
              </button>
              {applyStatus ? (
                <span className="text-[10px]" style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}>
                  {applyStatus}
                </span>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-lg" style={{ backgroundColor: '#ffffff', border: `1px solid ${theme.softBorder}` }}>
            <p className="text-[11px]" style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}>
              Generate a strategy response to enable sending it to Strategy Maker.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function parseStrategyPayload(text?: string): ParsedStrategyPayload {
  if (!text) return {};

  const codeBlockMatch = text.match(/```json\s*([\s\S]*?)```/i);
  const jsonCandidate = codeBlockMatch?.[1];
  if (!jsonCandidate) return {};

  try {
    const parsed = JSON.parse(jsonCandidate);
    if (parsed && typeof parsed === 'object') {
      return parsed as ParsedStrategyPayload;
    }
  } catch {
    return {};
  }
  return {};
}

function Metric({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="rounded-md p-2" style={{ backgroundColor: '#f8f9ff' }}>
      <p className="text-[10px] uppercase tracking-wider" style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}>{label}</p>
      <p className="text-[13px] font-extrabold" style={{ color: valueColor ?? '#0f172a', fontFamily: 'Manrope, sans-serif' }}>{value}</p>
    </div>
  );
}

function Gauge({ score, accent }: { score: number; accent: string }) {
  const normalized = Math.min(100, Math.max(0, score));
  const dash = 220;
  const progress = (normalized / 100) * dash;

  return (
    <svg width="92" height="64" viewBox="0 0 120 80">
      <path d="M10 70 A50 50 0 0 1 110 70" fill="none" stroke="#e2e8f0" strokeWidth="10" strokeLinecap="round" />
      <path
        d="M10 70 A50 50 0 0 1 110 70"
        fill="none"
        stroke={accent}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${progress} ${dash - progress}`}
      />
      <text x="60" y="54" textAnchor="middle" style={{ fontFamily: 'Manrope, sans-serif', fontSize: '16px', fontWeight: 800, fill: '#0f172a' }}>
        {normalized}
      </text>
    </svg>
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

function formatLargeNumber(n: number): string {
  if (!Number.isFinite(n)) return 'N/A';
  const abs = Math.abs(n);
  if (abs >= 1e12) return `${(n / 1e12).toFixed(1)}T`;
  if (abs >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
}
