'use client';

import { useCallback, useEffect, useState } from 'react';
import { extractFacts, listExtractions, listFacts, listCalculations, updateFact, deleteFact, factValues, metricLabel,
  type Fact, type FactStatus, type ExtractionRun, type CalculationReceipt } from '@/lib/api/financials';
import { getDocument, type ResearchDocument, type DocumentPage } from '@/lib/api/research';
import { ErrorNotice, errorText, formatTimestamp } from './ResearchUI';
import FactEditor from './FactEditor';
import CalculationPanel from './CalculationPanel';

export default function FinancialsPanel({caseId, documents}: {caseId: string; documents: ResearchDocument[]}) {
  const [facts, setFacts] = useState<Fact[]>([]);
  const [runs, setRuns] = useState<ExtractionRun[]>([]);
  const [receipts, setReceipts] = useState<CalculationReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [sectionOptions, setSectionOptions] = useState<Record<string, DocumentPage[]>>({});
  const [selectedSections, setSelectedSections] = useState<Record<string, string[]>>({});
  const [selectionLoading, setSelectionLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState<{fact: Fact | null} | null>(null);
  const [sourceFact, setSourceFact] = useState<Fact | null>(null);
  const [sourceText, setSourceText] = useState('');
  const [sourceError, setSourceError] = useState('');
  const [sourceLoading, setSourceLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [removeId, setRemoveId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [savedFacts, savedRuns, savedReceipts] = await Promise.all([listFacts(caseId), listExtractions(caseId), listCalculations(caseId)]);
    setFacts(savedFacts); setRuns(savedRuns); setReceipts(savedReceipts);
    setSourceFact(previous => previous ? savedFacts.find(fact => fact.id === previous.id) ?? null : null);
  }, [caseId]);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { await refresh(); } catch (failure) { setError(errorText(failure)); }
    finally { setLoading(false); }
  }, [refresh]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!extracting && !runs.some(run => run.status === 'running')) return;
    const timer = setInterval(() => {
      refresh().catch(failure => setError(`Progress could not refresh: ${errorText(failure)}`));
    }, 2000);
    return () => clearInterval(timer);
  }, [refresh, extracting, runs]);

  async function chooseSections(documentId: string) {
    setSelectionLoading(true); setError('');
    try {
      const detail = await getDocument(caseId, documentId);
      setSectionOptions(previous => ({...previous, [documentId]: detail.pages}));
      setSelectedSections(previous => ({...previous, [documentId]: previous[documentId] ?? detail.pages.map(page => page.id)}));
    } catch (failure) { setError(errorText(failure)); }
    finally { setSelectionLoading(false); }
  }

  async function extract() {
    setExtracting(true); setError(''); setNotice('');
    try {
      const explicit = selectedDocuments.some(id => selectedSections[id] !== undefined);
      let sectionIds: string[] | undefined;
      if (explicit) {
        const groups = await Promise.all(selectedDocuments.map(async id => selectedSections[id] ?? (await getDocument(caseId, id)).pages.map(page => page.id)));
        sectionIds = groups.flat();
        if (!sectionIds.length) throw new Error('Select at least one page or section.');
      }
      const run = await extractFacts(caseId, selectedDocuments, sectionIds);
      setNotice(`Extraction ${run.status}. ${run.fact_ids.length} saved fact references; ${run.duplicate_count} duplicates skipped. Review every proposal before confirmation.`);
      await refresh();
    } catch (failure) { setError(`${errorText(failure)} Previously saved facts are retained. Refresh status before retrying.`); }
    finally { setExtracting(false); }
  }

  async function review(fact: Fact, status: FactStatus) {
    setBusy(true); setError(''); setNotice('');
    try {
      await updateFact(caseId, fact, factValues(fact), status, `Analyst explicitly ${status === 'confirmed' ? 'confirmed after source review' : 'rejected'} this interpretation.`);
      setNotice(status === 'confirmed' ? 'Fact confirmed by analyst. This is not independent verification.' : 'Fact rejected. Dependent receipts have been invalidated.');
      await refresh();
    } catch (failure) { setError(errorText(failure)); }
    finally { setBusy(false); }
  }

  async function inspect(fact: Fact) {
    setSourceFact(fact); setSourceText(''); setSourceError('');
    if (!fact.source_available) return;
    setSourceLoading(true);
    try {
      const doc = await getDocument(caseId, fact.document_id);
      const section = doc.pages.find(item => item.id === fact.section_id);
      if (!section) throw new Error('Source section is no longer available.');
      setSourceText(section.text);
    } catch (failure) { setSourceError(errorText(failure)); }
    finally { setSourceLoading(false); }
  }

  async function remove(fact: Fact) {
    setBusy(true); setError('');
    try { await deleteFact(caseId, fact); setRemoveId(null); setNotice('Fact removed from use; revision history and dependent stale receipts are retained.'); await refresh(); }
    catch (failure) { setError(errorText(failure)); }
    finally { setBusy(false); }
  }

  if (loading) return <p role="status" className="rl-muted">Loading financial facts and receipts…</p>;
  const visibleFacts = facts.filter(fact => filter === 'removed' ? !!fact.removed_at : !fact.removed_at && (filter === 'all' || fact.status === filter));

  return <div className="space-y-6">
    <div className="rounded-xl border border-sky-100 bg-sky-50 p-4 text-sm text-[#006591]">Extracted facts are proposals. An excerpt match establishes provenance, not semantic correctness. Confirmation means analyst-reviewed, not independently verified. Only confirmed facts with resolved metadata can be calculated.</div>
    {error && <><ErrorNotice message={error} /><button className="rl-secondary" onClick={load}>Reload saved financials</button></>}
    {notice && <p role="status" className="rounded-lg bg-cyan-50 p-3 text-sm text-cyan-900">{notice}</p>}

    <section className="rl-card space-y-4 p-5" aria-labelledby="extraction-heading">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="extraction-heading" className="text-xl font-bold">Extract financial facts</h2><button className="rl-secondary" disabled={busy || extracting} onClick={load}>Refresh saved facts and receipts</button></div>
      <p className="rl-muted">Choose saved documents. Their text is sent to Dexter’s configured Groq model for candidate extraction only. No URLs are fetched. Up to 6 bounded batches are processed; oversized or unprocessed sections are listed explicitly.</p>
      {documents.length === 0 && <p className="rl-muted">Add source documents in Documents first. Manual entry also requires a saved source section.</p>}
      <div className="grid gap-2 md:grid-cols-2">{documents.map(doc => <label key={doc.id} className="!flex-row items-start rounded-lg border border-slate-200 p-3"><input type="checkbox" className="mt-1" checked={selectedDocuments.includes(doc.id)} disabled={extracting || busy} onChange={event => setSelectedDocuments(previous => event.target.checked ? [...previous, doc.id] : previous.filter(id => id !== doc.id))} /><span className="break-words">{doc.title}<span className="mt-1 block text-xs font-normal text-slate-500">{doc.page_count === null ? 'Text section' : `${doc.page_count} PDF pages`}</span></span></label>)}</div>
      {documents.filter(doc => selectedDocuments.includes(doc.id)).map(doc => <div key={doc.id} className="rounded-lg border border-slate-200 p-3">
        <p className="text-sm font-semibold">{doc.title} · {selectedSections[doc.id] === undefined ? 'All pages/sections selected' : `${selectedSections[doc.id].length} selected`}</p>
        <button className="rl-secondary mt-2" disabled={extracting || selectionLoading} onClick={() => chooseSections(doc.id)}>Choose pages / sections</button>
        {selectedSections[doc.id] !== undefined && <><button className="rl-secondary ml-2" disabled={extracting} onClick={() => setSelectedSections(previous => ({...previous, [doc.id]: []}))}>Clear selection</button><button className="rl-secondary ml-2" disabled={extracting} onClick={() => setSelectedSections(previous => ({...previous, [doc.id]: sectionOptions[doc.id].map(page => page.id)}))}>Select all</button>
        <div className="mt-3 grid max-h-64 gap-2 overflow-auto md:grid-cols-3">{sectionOptions[doc.id]?.map(page => <label key={page.id} className="!flex-row items-center text-sm"><input type="checkbox" disabled={extracting} checked={selectedSections[doc.id].includes(page.id)} onChange={event => setSelectedSections(previous => ({...previous, [doc.id]: event.target.checked ? [...previous[doc.id], page.id] : previous[doc.id].filter(id => id !== page.id)}))}/>{page.label}{page.page_number !== null ? ` · original PDF page ${page.page_number}` : ''}</label>)}</div></>}
      </div>)}
      <div className="flex flex-wrap gap-2"><button className="rl-primary" disabled={extracting || busy || selectionLoading || selectedDocuments.length === 0} onClick={extract}>{extracting ? 'Extracting… status updates below' : 'Extract financial facts'}</button><button className="rl-secondary" disabled={extracting || busy || documents.length === 0} onClick={() => setEditor({fact: null})}>Add fact manually</button></div>
      {runs.map((run, index) => <details key={run.id} open={index === 0} className="rounded-lg border border-slate-200 p-3"><summary className="cursor-pointer text-sm font-semibold">{run.status} · {run.sections.filter(section => section.selected !== false).length} selected · {run.sections.filter(section => section.status === 'processed').length} processed · {run.sections.filter(section => section.status === 'skipped').length} omitted · {run.fact_ids.length} fact references · {formatTimestamp(run.created_at)}</summary>
        <p className="rl-muted mt-2">Requested model: {run.model} (configured fallback may be used). Duplicates skipped: {run.duplicate_count}.</p>
        {run.errors.map((message, i) => <p key={i} className="mt-2 text-sm text-red-800">{message}</p>)}
        <ul className="mt-3 space-y-2 text-xs">{run.sections.map(section => <li key={section.section_id} className="break-all"><strong>{section.label} · {section.status}</strong> · {section.section_id}{section.message ? ` — ${section.message}` : ''}</li>)}</ul>
        <ul className="rl-muted mt-3 list-disc space-y-1 pl-4">{run.limitations.map((limitation, i) => <li key={i}>{limitation}</li>)}</ul>
      </details>)}
    </section>

    {editor && <FactEditor key={editor.fact?.id ?? 'manual'} caseId={caseId} documents={documents} fact={editor.fact} onCancel={() => setEditor(null)} onSaved={async () => {await refresh(); setEditor(null); setSourceFact(null); setSourceText(''); setNotice('Candidate saved. Review and confirm it before calculation.');}} />}

    <section className="space-y-3" aria-labelledby="facts-heading">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 id="facts-heading" className="text-xl font-bold">Financial facts</h2><p className="rl-muted mt-1">Inspect the source, correct interpretations, then confirm or reject. Total debt excludes non-interest-bearing liabilities.</p></div><label>Status filter<select value={filter} onChange={event => setFilter(event.target.value)}>{['all', 'candidate', 'needs_review', 'confirmed', 'rejected', 'removed'].map(status => <option key={status} value={status}>{metricLabel(status)}</option>)}</select></label></div>
      {visibleFacts.length === 0 ? <p className="rl-muted">No facts in this view. Extract from selected documents or add a supported fact manually.</p> : <div className="rl-card overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{['Metric / entity', 'Value / unit', 'Financial period / basis', 'Source', 'Status', 'Review'].map(title => <th key={title} className="p-3">{title}</th>)}</tr></thead><tbody>{visibleFacts.map(fact => <tr key={fact.id} className="border-t border-slate-100 align-top">
        <td className="p-3"><p className="font-semibold capitalize">{metricLabel(fact.metric)}</p><p>{fact.entity ?? 'Unknown entity'}</p><p className="mt-1 break-all text-xs text-slate-500">{fact.id} · r{fact.revision}</p></td>
        <td className="p-3"><p className="font-semibold">{fact.value}</p><p>{fact.currency ?? 'Unknown currency'} · {fact.scale ?? 'unknown scale'}</p></td>
        <td className="p-3"><p>{fact.reporting_period ?? 'Unknown label'} · {fact.period_type}</p><p>{fact.period_start ? `${fact.period_start} to ` : ''}{fact.period_end ?? 'Unknown date'}</p><p className="mt-1 text-slate-500">{fact.accounting_scope ?? 'Unknown scope/basis'}</p></td>
        <td className="max-w-48 break-words p-3"><button className="text-left text-[#006591] underline" disabled={sourceLoading} onClick={() => inspect(fact)}>{fact.source_snapshot.document_title} · {fact.source_snapshot.label}</button>{!fact.source_available && <p className="mt-1 text-amber-900">Source removed; historical excerpt only</p>}</td>
        <td className="p-3"><span className="rounded-full bg-sky-50 px-2 py-1 text-xs font-semibold">{fact.removed_at ? 'removed' : metricLabel(fact.status)}</span>{fact.ambiguity_note && <p className="mt-2 max-w-48 text-xs text-amber-900">{fact.ambiguity_note}</p>}</td>
        <td className="p-3"><div className="flex max-w-52 flex-wrap gap-2"><button className="rl-secondary" disabled={busy || extracting || !fact.source_available || !!fact.removed_at} onClick={() => setEditor({fact})}>Correct</button><button className="rl-secondary" disabled={busy || extracting || !fact.source_available || !!fact.removed_at || fact.status === 'confirmed'} onClick={() => review(fact, 'confirmed')}>Confirm</button><button className="rl-secondary" disabled={busy || extracting || !fact.source_available || !!fact.removed_at || fact.status === 'rejected'} onClick={() => review(fact, 'rejected')}>Reject</button><button className="rl-secondary" disabled={busy || extracting || !!fact.removed_at} onClick={() => setRemoveId(fact.id)}>Remove</button></div>{removeId === fact.id && <div className="mt-2 space-y-2 text-xs"><p>Remove this fact from use and invalidate dependent results? History is retained.</p><button className="rl-secondary" disabled={busy} onClick={() => remove(fact)}>Confirm removal</button><button className="rl-secondary" onClick={() => setRemoveId(null)}>Cancel</button></div>}</td>
      </tr>)}</tbody></table></div>}
    </section>

    {sourceFact && <section className="rl-card space-y-3 p-5" aria-labelledby="fact-source-heading"><div className="flex justify-between gap-3"><h2 id="fact-source-heading" className="text-lg font-bold">Fact source and review history</h2><button className="rl-secondary" onClick={() => setSourceFact(null)}>Close</button></div>
      <p className="font-semibold">{sourceFact.source_snapshot.document_title} · {sourceFact.source_snapshot.label}</p>
      <p className="rl-muted break-all">Document {sourceFact.document_id} · section {sourceFact.section_id} · {sourceFact.origin}</p>
      <blockquote className="whitespace-pre-wrap break-words border-l-2 border-cyan-400 pl-3 text-sm">{sourceFact.excerpt}</blockquote>
      {sourceFact.source_snapshot.structured_provenance && <details open><summary className="cursor-pointer text-sm font-bold">Structured SEC provenance: tag, accession and exact JSON context</summary><pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 text-xs">{JSON.stringify(sourceFact.source_snapshot.structured_provenance,null,2)}</pre></details>}
      {!sourceFact.source_available && <p className="text-sm text-amber-900">The original source has been removed. This is a preserved historical excerpt, not a currently available source.</p>}
      {sourceLoading && <p role="status">Loading saved source…</p>}
      {sourceError && <ErrorNotice message={sourceError} />}
      {sourceFact.source_available && sourceText && <details open><summary className="cursor-pointer text-sm font-bold">Saved page / section text</summary><pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-4 text-xs">{sourceText}</pre></details>}
      <details><summary className="cursor-pointer text-sm font-bold">Original extraction and revision history</summary><p className="rl-muted mt-2">Original values never change. Analyst edits and status decisions create a new revision.</p><pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 text-xs">{JSON.stringify({original_values: sourceFact.original_values, history: sourceFact.history}, null, 2)}</pre></details>
    </section>}

    <CalculationPanel caseId={caseId} facts={facts} receipts={receipts} onSaved={refresh} />
  </div>;
}
