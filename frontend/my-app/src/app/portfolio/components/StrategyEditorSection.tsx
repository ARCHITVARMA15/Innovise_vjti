'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { acceptStrategyDraft, getStrategyEditorState, saveStrategyDraft } from '@/lib/api/strategy';
import type { CurrentStrategy, StrategyDraft } from '@/lib/types/portfolio';

interface Props {
  initialCurrentStrategy: CurrentStrategy;
}

export default function StrategyEditorSection({ initialCurrentStrategy }: Props) {
  const searchParams = useSearchParams();
  const sectionRef = useRef<HTMLElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [status, setStatus] = useState('');
  const [isFocusedEntry, setIsFocusedEntry] = useState(false);

  const [currentStrategy, setCurrentStrategy] = useState<CurrentStrategy>(initialCurrentStrategy);
  const [draft, setDraft] = useState<StrategyDraft | null>(null);

  const [name, setName] = useState(initialCurrentStrategy.name || '');
  const [description, setDescription] = useState(initialCurrentStrategy.description || '');
  const [notes, setNotes] = useState('');
  const [objective, setObjective] = useState('');
  const [timeHorizon, setTimeHorizon] = useState('');
  const [riskProfile, setRiskProfile] = useState('');
  const [rebalanceRule, setRebalanceRule] = useState('');
  const [maxDrawdownPct, setMaxDrawdownPct] = useState<number>(15);
  const [maxSinglePositionPct, setMaxSinglePositionPct] = useState<number>(10);
  const [maxSectorExposurePct, setMaxSectorExposurePct] = useState<number>(25);
  const [stopLossRule, setStopLossRule] = useState('');
  const [entryRule, setEntryRule] = useState('');
  const [validationMetricsText, setValidationMetricsText] = useState('CAGR, Sharpe Ratio, Max Drawdown');
  const [equityTarget, setEquityTarget] = useState(45);
  const [intlTarget, setIntlTarget] = useState(20);
  const [fixedTarget, setFixedTarget] = useState(25);
  const [cashTarget, setCashTarget] = useState(10);

  useEffect(() => {
    let cancelled = false;

    async function loadEditorState() {
      setLoading(true);
      try {
        const state = await getStrategyEditorState();
        if (cancelled) return;

        setCurrentStrategy(state.currentStrategy || initialCurrentStrategy);
        if (state.draftStrategy) {
          hydrateFromDraft(state.draftStrategy);
        }
      } catch {
        if (!cancelled) {
          setStatus('Could not load strategy editor state. You can still create a draft manually.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadEditorState();
    return () => {
      cancelled = true;
    };
  }, [initialCurrentStrategy]);

  useEffect(() => {
    if (searchParams.get('openStrategyMaker') !== '1') return;

    setIsFocusedEntry(true);
    setTimeout(() => {
      sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (draft) {
        setStatus('Loaded draft strategy. Review and accept when ready.');
      }
    }, 60);

    const timer = window.setTimeout(() => setIsFocusedEntry(false), 2200);
    return () => window.clearTimeout(timer);
  }, [searchParams, draft]);

  const targetTotal = useMemo(() => equityTarget + intlTarget + fixedTarget + cashTarget, [
    equityTarget,
    intlTarget,
    fixedTarget,
    cashTarget,
  ]);

  function hydrateFromDraft(d: StrategyDraft) {
    setDraft(d);
    setName(d.name || '');
    setDescription(d.description || '');
    setNotes(d.notes || '');
    setObjective(d.objective || '');
    setTimeHorizon(d.time_horizon || '');
    setRiskProfile(d.risk_profile || '');
    setRebalanceRule(d.rebalance_rule || '');
    setMaxDrawdownPct(Number(d.max_drawdown_pct ?? 15));
    setMaxSinglePositionPct(Number(d.max_single_position_pct ?? 10));
    setMaxSectorExposurePct(Number(d.max_sector_exposure_pct ?? 25));
    setStopLossRule(d.stop_loss_rule || '');
    setEntryRule(d.entry_rule || '');
    setValidationMetricsText((d.validation_metrics || []).join(', '));

    const t = d.allocation_targets || {};
    setEquityTarget(Number(t['domestic-equity'] ?? 45));
    setIntlTarget(Number(t['international-equity'] ?? 20));
    setFixedTarget(Number(t['fixed-income'] ?? 25));
    setCashTarget(Number(t['cash-alternatives'] ?? 10));
  }

  async function handleSaveDraft() {
    if (!name.trim() || !description.trim()) {
      setStatus('Name and description are required.');
      return;
    }

    if (targetTotal !== 100) {
      setStatus('Allocation targets must total 100%.');
      return;
    }

    setSaving(true);
    setStatus('');
    try {
      const saved = await saveStrategyDraft({
        name: name.trim(),
        description: description.trim(),
        ctaLabel: 'Apply Strategy',
        source: draft?.source && draft.source !== 'manual' ? draft.source : 'manual',
        notes: notes.trim(),
        objective: objective.trim(),
        time_horizon: timeHorizon.trim(),
        risk_profile: riskProfile.trim(),
        rebalance_rule: rebalanceRule.trim(),
        max_drawdown_pct: Number.isFinite(maxDrawdownPct) ? maxDrawdownPct : null,
        max_single_position_pct: Number.isFinite(maxSinglePositionPct) ? maxSinglePositionPct : null,
        max_sector_exposure_pct: Number.isFinite(maxSectorExposurePct) ? maxSectorExposurePct : null,
        stop_loss_rule: stopLossRule.trim(),
        entry_rule: entryRule.trim(),
        validation_metrics: validationMetricsText
          .split(',')
          .map((m) => m.trim())
          .filter(Boolean),
        allocation_targets: {
          'domestic-equity': equityTarget,
          'international-equity': intlTarget,
          'fixed-income': fixedTarget,
          'cash-alternatives': cashTarget,
        },
      });
      hydrateFromDraft(saved);
      setStatus('Draft strategy saved. Review and accept when ready.');
    } catch {
      setStatus('Failed to save draft strategy.');
    } finally {
      setSaving(false);
    }
  }

  async function handleAcceptDraft() {
    setAccepting(true);
    setStatus('');
    try {
      const result = await acceptStrategyDraft();
      if (result.error) {
        setStatus(result.error);
        return;
      }
      setCurrentStrategy(result.currentStrategy);
      setDraft(null);
      setStatus('Strategy accepted and applied to portfolio targets.');
    } catch {
      setStatus('Failed to accept strategy draft.');
    } finally {
      setAccepting(false);
    }
  }

  return (
    <section
      ref={sectionRef}
      className="rounded-xl p-6 transition-all"
      style={{
        backgroundColor: '#ffffff',
        boxShadow: isFocusedEntry
          ? '0 0 0 3px rgba(0,150,104,0.25), 0 24px 40px rgba(11,28,48,0.05)'
          : '0 24px 40px rgba(11,28,48,0.05)',
      }}
    >
      <div className="flex items-center justify-between gap-3 mb-5">
        <div>
          <h3 className="text-xl font-extrabold tracking-tight" style={{ color: '#0f172a', fontFamily: 'Manrope, sans-serif' }}>
            Strategy Maker
          </h3>
          <p className="text-sm mt-1" style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}>
            Create or edit a strategy draft. Veritas-applied drafts appear here for review and acceptance.
          </p>
        </div>
        {draft?.source && draft.source !== 'manual' ? (
          <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full" style={{ backgroundColor: '#e5eeff', color: '#006591' }}>
            Draft from {draft.source}
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-4">
          <div>
            <label className="text-xs font-semibold" style={{ color: '#475569' }}>Strategy Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full mt-1 rounded-lg px-3 py-2 text-sm"
              style={{ border: '1px solid rgba(148,163,184,0.4)', backgroundColor: '#f8fafc' }}
              placeholder="e.g. Balanced Quality Compounding"
            />
          </div>

          <div>
            <label className="text-xs font-semibold" style={{ color: '#475569' }}>Strategy Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full mt-1 rounded-lg px-3 py-2 text-sm min-h-28"
              style={{ border: '1px solid rgba(148,163,184,0.4)', backgroundColor: '#f8fafc' }}
              placeholder="Define risk style, timeframe, and execution rules."
            />
          </div>

          <div>
            <label className="text-xs font-semibold" style={{ color: '#475569' }}>Notes / Rationale</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full mt-1 rounded-lg px-3 py-2 text-sm min-h-20"
              style={{ border: '1px solid rgba(148,163,184,0.4)', backgroundColor: '#f8fafc' }}
              placeholder="Optional: why this strategy should be applied now."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold" style={{ color: '#475569' }}>Objective</label>
              <input
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                className="w-full mt-1 rounded-lg px-3 py-2 text-sm"
                style={{ border: '1px solid rgba(148,163,184,0.4)', backgroundColor: '#f8fafc' }}
                placeholder="e.g. Outperform Nifty by 3% annualized"
              />
            </div>
            <div>
              <label className="text-xs font-semibold" style={{ color: '#475569' }}>Time Horizon</label>
              <input
                value={timeHorizon}
                onChange={(e) => setTimeHorizon(e.target.value)}
                className="w-full mt-1 rounded-lg px-3 py-2 text-sm"
                style={{ border: '1px solid rgba(148,163,184,0.4)', backgroundColor: '#f8fafc' }}
                placeholder="e.g. 3-5 years"
              />
            </div>
            <div>
              <label className="text-xs font-semibold" style={{ color: '#475569' }}>Risk Profile</label>
              <input
                value={riskProfile}
                onChange={(e) => setRiskProfile(e.target.value)}
                className="w-full mt-1 rounded-lg px-3 py-2 text-sm"
                style={{ border: '1px solid rgba(148,163,184,0.4)', backgroundColor: '#f8fafc' }}
                placeholder="Low / Medium / High"
              />
            </div>
            <div>
              <label className="text-xs font-semibold" style={{ color: '#475569' }}>Rebalance Rule</label>
              <input
                value={rebalanceRule}
                onChange={(e) => setRebalanceRule(e.target.value)}
                className="w-full mt-1 rounded-lg px-3 py-2 text-sm"
                style={{ border: '1px solid rgba(148,163,184,0.4)', backgroundColor: '#f8fafc' }}
                placeholder="e.g. Quarterly or 5% drift"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <AllocationInput label="Max Drawdown %" value={maxDrawdownPct} onChange={setMaxDrawdownPct} />
            <AllocationInput label="Max Single Position %" value={maxSinglePositionPct} onChange={setMaxSinglePositionPct} />
            <AllocationInput label="Max Sector Exposure %" value={maxSectorExposurePct} onChange={setMaxSectorExposurePct} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold" style={{ color: '#475569' }}>Stop-loss Rule</label>
              <input
                value={stopLossRule}
                onChange={(e) => setStopLossRule(e.target.value)}
                className="w-full mt-1 rounded-lg px-3 py-2 text-sm"
                style={{ border: '1px solid rgba(148,163,184,0.4)', backgroundColor: '#f8fafc' }}
                placeholder="e.g. Cut at -8% unless thesis intact"
              />
            </div>
            <div>
              <label className="text-xs font-semibold" style={{ color: '#475569' }}>Entry Rule</label>
              <input
                value={entryRule}
                onChange={(e) => setEntryRule(e.target.value)}
                className="w-full mt-1 rounded-lg px-3 py-2 text-sm"
                style={{ border: '1px solid rgba(148,163,184,0.4)', backgroundColor: '#f8fafc' }}
                placeholder="e.g. Scale in 3 tranches near support"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold" style={{ color: '#475569' }}>Validation Metrics (comma separated)</label>
            <input
              value={validationMetricsText}
              onChange={(e) => setValidationMetricsText(e.target.value)}
              className="w-full mt-1 rounded-lg px-3 py-2 text-sm"
              style={{ border: '1px solid rgba(148,163,184,0.4)', backgroundColor: '#f8fafc' }}
              placeholder="CAGR, Sharpe Ratio, Max Drawdown, Hit Rate"
            />
          </div>
        </div>

        <div className="space-y-4">
          <AllocationInput label="Domestic Equity %" value={equityTarget} onChange={setEquityTarget} />
          <AllocationInput label="International Equity %" value={intlTarget} onChange={setIntlTarget} />
          <AllocationInput label="Fixed Income %" value={fixedTarget} onChange={setFixedTarget} />
          <AllocationInput label="Cash & Alternatives %" value={cashTarget} onChange={setCashTarget} />

          <div className="rounded-lg px-3 py-2" style={{ backgroundColor: '#f8fafc', border: '1px solid rgba(148,163,184,0.3)' }}>
            <p className="text-xs" style={{ color: '#64748b' }}>Target total</p>
            <p className="text-sm font-bold" style={{ color: targetTotal === 100 ? '#009668' : '#ba1a1a' }}>{targetTotal}%</p>
          </div>
        </div>
      </div>

      {status ? (
        <div className="mt-4 rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#f8fafc', color: '#334155', border: '1px solid rgba(148,163,184,0.3)' }}>
          {status}
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          onClick={handleSaveDraft}
          disabled={saving || loading}
          className="px-4 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-50"
          style={{ backgroundColor: '#006591' }}
        >
          {saving ? 'Saving...' : 'Save Draft'}
        </button>

        <button
          onClick={handleAcceptDraft}
          disabled={accepting || !draft}
          className="px-4 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-50"
          style={{ backgroundColor: '#009668' }}
        >
          {accepting ? 'Applying...' : 'Accept & Apply Strategy'}
        </button>

        <div className="ml-auto text-xs" style={{ color: '#64748b' }}>
          Active: <span style={{ color: '#0f172a', fontWeight: 700 }}>{currentStrategy.name}</span>
        </div>
      </div>
    </section>
  );
}

function AllocationInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <label className="text-xs font-semibold" style={{ color: '#475569' }}>{label}</label>
      <input
        type="number"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value || 0))}
        className="w-full mt-1 rounded-lg px-3 py-2 text-sm"
        style={{ border: '1px solid rgba(148,163,184,0.4)', backgroundColor: '#f8fafc' }}
      />
    </div>
  );
}
