'use client';

import { useState, type FormEvent } from 'react';
import { calculateMetric, metricLabel, type Fact, type CalculationReceipt, type CalculationRequest, type CalculationType } from '@/lib/api/financials';
import { ErrorNotice, errorText, formatTimestamp } from './ResearchUI';

const roles: Record<CalculationType, Record<string, string>> = {
  revenue_growth: {current: 'revenue', previous: 'revenue'}, net_profit_margin: {net_income: 'net_income', revenue: 'revenue'},
  current_ratio: {current_assets: 'current_assets', current_liabilities: 'current_liabilities'},
  debt_to_equity: {total_debt: 'total_debt', total_equity: 'total_equity'},
};

export default function CalculationPanel({caseId, facts, receipts, onSaved}: {
  caseId: string; facts: Fact[]; receipts: CalculationReceipt[]; onSaved: () => Promise<void>;
}) {
  const [type, setType] = useState<CalculationType>('revenue_growth');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [conflictRequest, setConflictRequest] = useState<{request: CalculationRequest; receipt: CalculationReceipt} | null>(null);
  const eligible = facts.filter(fact => fact.status === 'confirmed' && fact.source_available && !fact.removed_at);

  async function run(request: CalculationRequest) {
    setBusy(true); setError('');
    let saved = false;
    try {
      const receipt = await calculateMetric(caseId, request); saved = true;
      setConflictRequest(receipt.status === 'unavailable' && Object.keys(receipt.conflicts).length ? {request, receipt} : null);
      await onSaved();
    } catch (failure) { setError(`${saved ? 'Receipt saved, but refresh failed. ' : ''}${errorText(failure)}`); }
    finally { setBusy(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const inputs = Object.fromEntries(Object.keys(roles[type]).map(role => [role, String(values.get(role) ?? '')]).filter(([, id]) => id));
    await run({calculation_type: type, inputs});
  }

  return <section className="space-y-4" aria-labelledby="calculations-heading">
    <div><h2 id="calculations-heading" className="text-xl font-bold">Calculated metrics</h2><p className="rl-muted mt-1">Select saved confirmed facts explicitly. Arithmetic runs on the server with Decimal; no currency conversion or universal ratio ratings.</p></div>
    <form onSubmit={submit} className="rl-card space-y-4 p-5">
      <label className="max-w-md">Calculation<select value={type} onChange={event => {setType(event.target.value as CalculationType); setConflictRequest(null);}}>{Object.keys(roles).map(value => <option key={value} value={value}>{metricLabel(value)}</option>)}</select></label>
      <div key={type} className="grid gap-4 md:grid-cols-2">{Object.entries(roles[type]).map(([role, metric]) => <label key={role}>{metricLabel(role)}<select name={role} defaultValue="" onChange={() => setConflictRequest(null)}><option value="">Choose confirmed fact (required)</option>{eligible.filter(fact => fact.metric === metric).map(fact => <option key={fact.id} value={fact.id}>{fact.value} {fact.currency || '?'} {fact.scale || '?'} · {fact.reporting_period || fact.period_end || 'unknown period'} · {fact.entity || '?'} · {fact.accounting_scope || '?'} · {fact.source_snapshot.document_title} · {fact.id.slice(0, 8)} r{fact.revision}</option>)}</select></label>)}</div>
      <button className="rl-primary" disabled={busy}>{busy ? 'Calculating…' : 'Calculate selected inputs'}</button>
      {error && <ErrorNotice message={error} />}
      {conflictRequest && <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm"><p className="font-semibold">Competing confirmed facts need explicit resolution</p><p className="mt-2">Inspect the selected facts and these alternatives in the fact table before continuing:</p>{Object.entries(conflictRequest.receipt.conflicts).map(([role, ids]) => <p key={role} className="mt-2 break-all">{role}: {ids.join(', ')}</p>)}<button type="button" className="rl-secondary mt-3" disabled={busy} onClick={() => run({...conflictRequest.request, acknowledged_conflicts: conflictRequest.receipt.conflicts})}>I reviewed the alternatives; use the selected facts</button></div>}
    </form>
    <h3 className="font-bold">Saved receipts and history</h3>
    {receipts.length === 0 && <p className="rl-muted">No calculations yet. Missing inputs produce an unavailable receipt explaining exactly what is needed.</p>}
    <div className="grid gap-4 xl:grid-cols-2">{receipts.map(receipt => <article key={receipt.id} className="rl-card min-w-0 p-5">
      <div className="flex flex-wrap justify-between gap-2"><h3 className="font-bold capitalize">{metricLabel(receipt.calculation_type)}</h3><span className={`rounded-full px-2 py-1 text-xs font-semibold ${receipt.status === 'valid' ? 'bg-cyan-50 text-cyan-800' : 'bg-amber-50 text-amber-900'}`}>{receipt.status}</span></div>
      <p className="mt-3 text-2xl font-bold">{receipt.status === 'valid' ? `${receipt.display_result}${receipt.result_unit === '%' ? '%' : ' ×'}` : receipt.status === 'stale' ? 'Recalculation required' : 'Unavailable'}</p>
      <p className="rl-muted mt-2">{formatTimestamp(receipt.created_at)}</p>
      {receipt.invalidation_reason && <p className="mt-3 text-sm text-amber-900">{receipt.invalidation_reason}</p>}
      {receipt.warnings.length > 0 && <ul className="mt-3 list-disc space-y-1 pl-4 text-sm text-amber-900">{receipt.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>}
      <details className="mt-4"><summary className="cursor-pointer text-sm font-bold text-[#006591]">Formula, inputs, conversions and citations</summary>
        <p className="mt-3 break-words rounded-lg bg-slate-50 p-3 font-mono text-sm">{receipt.formula}</p>
        <p className="rl-muted mt-2">Receipt {receipt.id} · Decimal precision {receipt.precision} · {receipt.rounding}</p>
        <p className="mt-2 break-all text-sm">{receipt.status === 'stale' ? 'Historical computational result (not current)' : 'Computational result'}: {receipt.result ?? 'Unavailable'}</p>
        {Object.entries(receipt.inputs).map(([role, input]) => <div key={role} className="mt-3 border-t border-slate-100 pt-3 text-sm"><p className="font-semibold">{role}: {input.value} {input.currency ?? 'unknown currency'} {input.scale ?? 'unknown scale'}</p><p>{input.entity ?? 'unknown entity'} · {input.accounting_scope ?? 'unknown basis'} · {input.period_start ?? '—'} to {input.period_end ?? 'unknown date'}</p><p className="break-all text-xs text-slate-500">Fact {input.id} · revision {input.revision}</p></div>)}
        {receipt.conversions.map(conversion => <p key={conversion.role} className="mt-2 break-all font-mono text-xs">{conversion.role}: {conversion.original_value} {conversion.from_scale} × {conversion.multiplier} = {conversion.normalized_value} {conversion.currency} {conversion.to_scale}</p>)}
        {receipt.sources.map((source, index) => <blockquote key={index} className="mt-3 border-l-2 border-cyan-400 pl-3 text-sm"><p>{source.document_title} · {source.label} (source snapshot at calculation time)</p><p className="mt-1 whitespace-pre-wrap break-words">{source.excerpt}</p><p className="mt-1 break-all text-xs text-slate-500">Document {source.document_id} · section {source.section_id}</p></blockquote>)}
        {Object.keys(receipt.acknowledged_conflicts).length > 0 && <pre className="mt-3 whitespace-pre-wrap break-all text-xs">Acknowledged competing fact IDs: {JSON.stringify(receipt.acknowledged_conflicts, null, 2)}</pre>}
      </details>
    </article>)}</div>
  </section>;
}
