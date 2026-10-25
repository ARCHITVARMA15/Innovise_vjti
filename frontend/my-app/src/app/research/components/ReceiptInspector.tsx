import type { CalculationReceipt } from '@/lib/api/financials';

export default function ReceiptInspector({receipt}: {receipt: CalculationReceipt}) {
  return <div className="space-y-3 text-sm">
    <p className="rounded-lg bg-slate-50 p-3 font-mono">{receipt.formula}</p>
    <p className="rl-muted break-all">Receipt {receipt.id} · {receipt.status} · Decimal precision {receipt.precision} · {receipt.rounding}</p>
    <p className="break-all">{receipt.status === 'stale' ? 'Historical computational result (not current)' : 'Computational result'}: {receipt.result ?? 'Unavailable'}</p>
    {receipt.invalidation_reason && <p className="text-amber-900">{receipt.invalidation_reason}</p>}
    {receipt.warnings.map((warning, index) => <p key={index} className="text-amber-900">{warning}</p>)}
    {Object.entries(receipt.inputs).map(([role, input]) => <div key={role} className="border-t border-slate-100 pt-3"><p className="font-semibold">{role}: {input.value} {input.currency ?? 'unknown currency'} {input.scale ?? 'unknown scale'}</p><p>{input.entity ?? 'unknown entity'} · {input.accounting_scope ?? 'unknown basis'} · {input.period_start ?? '—'} to {input.period_end ?? 'unknown date'}</p><p className="break-all text-xs text-slate-500">Fact {input.id} · revision {input.revision}</p></div>)}
    {receipt.conversions.map(conversion => <p key={conversion.role} className="break-all font-mono text-xs">{conversion.role}: {conversion.original_value} {conversion.from_scale} × {conversion.multiplier} = {conversion.normalized_value} {conversion.currency} {conversion.to_scale}</p>)}
    {receipt.sources.map((source, index) => <blockquote key={index} className="border-l-2 border-cyan-400 pl-3"><p>{source.document_title} · {source.label} (source snapshot at calculation time)</p><p className="mt-1 whitespace-pre-wrap break-words">{source.excerpt}</p>{source.context_spans?.map(span=><details key={span.id}><summary>Saved year/unit/table context · offsets {span.start_offset}–{span.end_offset}</summary><pre className="whitespace-pre-wrap break-words">{span.excerpt}</pre></details>)}<p className="mt-1 break-all text-xs text-slate-500">Document {source.document_id} · section {source.section_id}</p></blockquote>)}
    {Object.keys(receipt.acknowledged_conflicts).length > 0 && <pre className="whitespace-pre-wrap break-all text-xs">Analyst-acknowledged competing fact IDs: {JSON.stringify(receipt.acknowledged_conflicts, null, 2)}</pre>}
  </div>;
}
