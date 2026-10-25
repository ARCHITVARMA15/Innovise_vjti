'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { addFact, updateFact, METRICS, SCALES, metricLabel, type Fact, type FactInput } from '@/lib/api/financials';
import { getDocument, type DocumentPage, type ResearchDocument } from '@/lib/api/research';
import { ErrorNotice, errorText } from './ResearchUI';

export default function FactEditor({caseId, documents, fact, onSaved, onCancel}: {
  caseId: string; documents: ResearchDocument[]; fact: Fact | null; onSaved: () => Promise<void>; onCancel: () => void;
}) {
  const [documentId, setDocumentId] = useState(fact?.document_id ?? '');
  const [sectionId, setSectionId] = useState(fact?.section_id ?? '');
  const [sections, setSections] = useState<DocumentPage[]>([]);
  const [error, setError] = useState('');
  const [sourceError, setSourceError] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!documentId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true); setSourceError(''); setSections([]);
      try { const doc = await getDocument(caseId, documentId); if (!cancelled) setSections(doc.pages); }
      catch (failure) { if (!cancelled) setSourceError(errorText(failure)); }
      finally { if (!cancelled) setLoading(false); }
    };
    void load();
    return () => { cancelled = true; };
  }, [caseId, documentId]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setBusy(true);
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? '').trim();
    const values: FactInput = {document_id: documentId, section_id: sectionId,
      metric: value('metric') as FactInput['metric'], entity: value('entity') || null, value: value('value'),
      currency: value('currency').toUpperCase() || null, scale: (value('scale') || null) as FactInput['scale'],
      reporting_period: value('reporting_period') || null, period_start: value('period_start') || null,
      period_end: value('period_end') || null, period_type: value('period_type') as FactInput['period_type'],
      accounting_scope: value('accounting_scope') || null, excerpt: String(form.get('excerpt') ?? ''),
      ambiguity_note: value('ambiguity_note') || null};
    let saved = false;
    try {
      if (fact) await updateFact(caseId, fact, values, 'candidate', value('reason'));
      else await addFact(caseId, values);
      saved = true;
      await onSaved();
    } catch (failure) { setError(`${saved ? 'Saved, but refresh failed. Reload before resubmitting. ' : ''}${errorText(failure)}`); }
    finally { setBusy(false); }
  }

  const selected = sections.find(section => section.id === sectionId);
  return <form onSubmit={save} className="rl-card space-y-4 p-5" aria-label={fact ? 'Correct financial fact' : 'Manual financial fact'}>
    <h3 className="text-lg font-bold">{fact ? `Correct fact · revision ${fact.revision}` : 'Add a source-linked fact manually'}</h3>
    <p className="rl-muted">Unknown fields may remain blank. Calculations require complete, matching metadata. Saving corrections returns the fact to candidate status; confirm it separately after review.</p>
    <fieldset disabled={busy} className="grid gap-4 md:grid-cols-2">
      <label>Document *<select required value={documentId} onChange={event => {setDocumentId(event.target.value); setSectionId('');}}><option value="">Choose source</option>{documents.map(doc => <option key={doc.id} value={doc.id}>{doc.title}</option>)}</select></label>
      <label>Original page / text section *<select required disabled={loading || !documentId} value={sectionId} onChange={event => setSectionId(event.target.value)}><option value="">{loading ? 'Loading…' : 'Choose section'}</option>{sections.map(section => <option key={section.id} value={section.id}>{section.label}</option>)}</select></label>
      <label>Metric *<select name="metric" defaultValue={fact?.metric ?? 'revenue'}>{METRICS.map(metric => <option key={metric} value={metric}>{metricLabel(metric)}</option>)}</select></label>
      <label>Company / entity<input name="entity" maxLength={240} defaultValue={fact?.entity ?? ''} /></label>
      <label>Numeric value *<input name="value" required inputMode="decimal" maxLength={100} placeholder="Decimal string, e.g. 1100" defaultValue={fact?.value ?? ''} /></label>
      <label>Currency<input name="currency" maxLength={3} pattern="[a-zA-Z]{3}" placeholder="e.g. INR; blank if unknown" defaultValue={fact?.currency ?? ''} /></label>
      <label>Scale / unit<select name="scale" defaultValue={fact?.scale ?? ''}><option value="">Unknown</option>{SCALES.map(scale => <option key={scale}>{scale}</option>)}</select></label>
      <label>Reporting-period label<input name="reporting_period" maxLength={240} defaultValue={fact?.reporting_period ?? ''} placeholder="Financial period, not publication date" /></label>
      <label>Period type<select name="period_type" defaultValue={fact?.period_type ?? 'unknown'}><option value="unknown">Unknown</option><option value="duration">Duration (income statement)</option><option value="instant">Instant (balance sheet)</option></select></label>
      <label>Period start<input name="period_start" type="date" defaultValue={fact?.period_start ?? ''} /></label>
      <label>Period end / balance-sheet date<input name="period_end" type="date" defaultValue={fact?.period_end ?? ''} /></label>
      <label>Accounting scope / basis<input name="accounting_scope" maxLength={240} placeholder="e.g. consolidated / IFRS" defaultValue={fact?.accounting_scope ?? ''} /></label>
      <label className="md:col-span-2">Exact supporting excerpt *<textarea name="excerpt" required rows={3} maxLength={4000} defaultValue={fact?.excerpt ?? ''} placeholder="Copy the supporting text from the selected section. Only whitespace normalization is allowed." /></label>
      <label className="md:col-span-2">Unresolved ambiguity<textarea name="ambiguity_note" maxLength={2000} rows={2} defaultValue={fact?.ambiguity_note ?? ''} placeholder="Describe ambiguous columns, dates or units; resolve and clear this before confirmation." /></label>
      {fact && <label className="md:col-span-2">Reason for correction *<input name="reason" required maxLength={2000} /></label>}
    </fieldset>
    <p className="rounded-lg bg-sky-50 p-3 text-sm text-[#006591]">Total debt means interest-bearing short-term plus long-term borrowings. Do not substitute total liabilities. This increment accepts directly supported totals only.</p>
    {sourceError && <ErrorNotice message={sourceError} />}
    {selected && <details open><summary className="text-sm font-semibold">Selected source: {selected.label}</summary><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 text-xs">{selected.text || 'No extractable text.'}</pre></details>}
    {error && <ErrorNotice message={error} />}
    <div className="flex gap-2"><button className="rl-primary" disabled={busy || loading || !selected}>{busy ? 'Saving…' : 'Save candidate'}</button><button type="button" className="rl-secondary" disabled={busy} onClick={onCancel}>Cancel</button></div>
  </form>;
}
