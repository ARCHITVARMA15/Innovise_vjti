'use client';

import {displayReceiptResult} from '@/lib/financial-overview';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { listAnalysisRuns, getAnalysisRun, startAnalysisRun, type AnalysisRun, type AnalysisRunSummary, type EvidencePassage } from '@/lib/api/analysis';
import { listCalculations, type CalculationReceipt, metricLabel } from '@/lib/api/financials';
import type { ResearchCase, ResearchDocument } from '@/lib/api/research';
import { ErrorNotice, errorText, formatTimestamp } from './ResearchUI';
import { parseAnalysisPeriods, analysisAsOf, analysisCalculations } from '@/lib/analysis-input';
import SourceText from './SourceText';
import ReceiptInspector from './ReceiptInspector';

const active = (run: AnalysisRunSummary) => ['queued', 'running'].includes(run.status);

export default function AnalysisPanel({caseId, researchCase, documents, onFinancials}: {
  caseId: string; researchCase: ResearchCase; documents: ResearchDocument[]; onFinancials: () => void;
}) {
  const [runs, setRuns] = useState<AnalysisRunSummary[]>([]);
  const [run, setRun] = useState<AnalysisRun | null>(null);
  const [receipts, setReceipts] = useState<CalculationReceipt[]>([]);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [selectedReceipts, setSelectedReceipts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [evidence, setEvidence] = useState<EvidencePassage | null>(null);
  const [receipt, setReceipt] = useState<CalculationReceipt | null>(null);
  const inspector = useRef<HTMLElement>(null);

  const refresh = useCallback(async (selectedId?: string) => {
    const [history, savedReceipts] = await Promise.all([listAnalysisRuns(caseId), listCalculations(caseId)]);
    setRuns(history); setReceipts(savedReceipts);
    const id = selectedId || history[0]?.id;
    setRun(id ? await getAnalysisRun(caseId, id) : null);
  }, [caseId]);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { await refresh(); } catch (failure) { setError(errorText(failure)); }
    finally { setLoading(false); }
  }, [refresh]);
  useEffect(() => { void load(); }, [load]);
  const hasActive = runs.some(active);
  useEffect(() => {
    if (!hasActive) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const history = await listAnalysisRuns(caseId);
        const detail = run?.id ? await getAnalysisRun(caseId, run.id) : null;
        if (!disposed) {
          setRuns(history); if (detail) setRun(detail);
          setReceipts(await listCalculations(caseId));
        }
      } catch (failure) { if (!disposed) setError(`Status polling failed: ${errorText(failure)}`); }
      if (!disposed) timer = setTimeout(poll, 2000);
    }
    timer = setTimeout(poll, 1000);
    return () => { disposed = true; clearTimeout(timer); };
  }, [caseId, hasActive, run?.id]);

  async function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setStarting(true); setError(''); setEvidence(null); setReceipt(null);
    const form = new FormData(event.currentTarget);
    const override = String(form.get('question_override') ?? '').trim();
    try {
      const periods=parseAnalysisPeriods(String(form.get('periods')||''));
      const calculations=analysisCalculations(form.getAll('calculations').map(String), periods);
      const created = await startAnalysisRun(caseId, {task_type:String(form.get('task_type')),entity:String(form.get('entity')||researchCase.company_name),
        periods,accounting_basis:String(form.get('basis')||'').trim()||null,research_as_of_date:String(form.get('as_of')||'')||null,calculations,
        claim_ids:String(form.get('claim_ids')||'').split(',').map(p=>p.trim()).filter(Boolean),document_ids: selectedDocuments, question_override: override || null, receipt_ids: selectedReceipts});
      setRun(created); setRuns(previous => [created, ...previous]);
    } catch (failure) { setError(`${errorText(failure)} Refresh run history before retrying if the request was interrupted.`); }
    finally { setStarting(false); }
  }

  async function openRun(id: string) {
    setError(''); setEvidence(null); setReceipt(null);
    try { setRun(await getAnalysisRun(caseId, id)); }
    catch (failure) { setError(errorText(failure)); }
  }

  function openEvidence(id: string) {
    const found = run?.retrieval?.passages.find(passage => passage.id === id);
    if (!found) { setError('Saved evidence reference is not available in this run.'); return; }
    setEvidence(found); setReceipt(null);
    requestAnimationFrame(() => {inspector.current?.focus(); inspector.current?.scrollIntoView({behavior: 'smooth', block: 'start'});});
  }

  async function openReceipt(id: string) {
    setError('');
    try {
      const saved = await listCalculations(caseId);
      const found = saved.find(item => item.id === id);
      if (!found) throw new Error('The saved calculation receipt is unavailable.');
      setReceipt(found); setEvidence(null);
      requestAnimationFrame(() => {inspector.current?.focus(); inspector.current?.scrollIntoView({behavior: 'smooth', block: 'start'});});
    } catch (failure) { setError(errorText(failure)); }
  }

  if (loading) return <p role="status" className="rl-muted">Loading saved analysis runs…</p>;
  const evidenceDocument = run?.snapshot.documents.find(item => item.document.id === evidence?.document_id)?.document;
  const evidenceSection = evidenceDocument?.pages.find(item => item.id === evidence?.section_id);

  return <div className="space-y-6">
    <div className="rounded-xl border border-sky-100 bg-sky-50 p-4 text-sm text-[#006591]">Dexter uses selected local documents and confirmed facts for preliminary research and scoped claim checks. Reports include deterministic risk observations and a separate human review loop. No external retrieval, automatic fact confirmation or trading action is performed.</div>
    {error && <ErrorNotice message={error} />}
    <form onSubmit={start} className="rl-card space-y-4 p-5">
      <div className="flex flex-wrap justify-between gap-3"><h2 className="text-xl font-bold">Run Dexter research</h2><button type="button" className="rl-secondary" onClick={load}>Refresh run history</button></div>
      <p className="whitespace-pre-wrap break-words text-sm"><strong>Saved case question:</strong> {researchCase.research_question}</p>
      <div className="grid gap-3 md:grid-cols-2">
        <label>Task<select name="task_type" defaultValue="full_research"><option value="simple_metric">Simple metric</option><option value="document_comparison">Document comparison</option><option value="claim_verification">Claim verification</option><option value="risk_assessment">Risk assessment</option><option value="full_research">Full research</option></select></label>
        <label>Entity<input name="entity" defaultValue={researchCase.company_name}/></label>
        <label>Reporting periods, previous then current (one per line or separated by semicolons)<textarea name="periods" rows={2} defaultValue={researchCase.reporting_period||''} placeholder={'FY2024\nYear Ended June 30, 2025'}/></label>
        <label>Accounting basis (exact saved label)<input name="basis" placeholder="consolidated / synthetic GAAP"/></label>
        <label>Research as of<input name="as_of" type="date" defaultValue={researchCase.research_as_of_date||''}/></label>
        <label>Saved claim IDs to check (comma separated)<input name="claim_ids"/></label>
      </div>
      <fieldset className="flex flex-wrap gap-3"><legend>Supported calculations</legend>{['revenue_growth','net_profit_margin','current_ratio','debt_to_equity'].map(c=><label key={c} className="!flex-row gap-2"><input type="checkbox" name="calculations" value={c}/>{metricLabel(c)}</label>)}</fieldset>
      <p className="rl-muted">Margins and ratios are calculated separately for each entered period; revenue growth compares previous and current. Plans are validated in Python. Ambiguous scope asks for input. Risk trends require saved comparable receipts; select ratio calculations for both periods when needed.</p>
      <label>Question override for this run (optional)<textarea name="question_override" rows={3} maxLength={10000} placeholder="Leave blank to use the saved question. Include exact financial-period labels to resolve period ambiguity." /></label>
      <p className="rl-muted">An override is saved with the run and does not change the case question. Select up to ten sources; snapshots are limited to three million text characters. Dates after the research-as-of date are excluded; unknown publication dates are flagged.</p>
      <fieldset disabled={starting || hasActive} className="grid gap-2 md:grid-cols-2"><legend className="mb-2 text-sm font-semibold">Selected documents *</legend>{documents.map(doc => <label key={doc.id} className="!flex-row items-start rounded-lg border border-slate-200 p-3"><input type="checkbox" className="mt-1" checked={selectedDocuments.includes(doc.id)} onChange={event => setSelectedDocuments(previous => event.target.checked ? [...previous, doc.id] : previous.filter(id => id !== doc.id))} /><span className="break-words">{doc.title}<span className="mt-1 block text-xs font-normal text-slate-500">Published {doc.publication_date ?? 'unknown'} · {doc.reporting_period ?? 'reporting period unknown'}</span></span></label>)}</fieldset>
      {!documents.length && <p className="rl-muted">Add saved source documents in Documents first.</p>}
      <details><summary className="cursor-pointer text-sm font-semibold">Use explicitly selected Financials receipts (optional)</summary><p className="rl-muted mt-2">When automatic input selection is ambiguous, calculate and review a receipt in Financials, then explicitly select it here. Dexter will not acknowledge competing facts automatically.</p><div className="mt-3 space-y-2">{receipts.filter(item => item.status === 'valid').map(item => <label key={item.id} className="!flex-row items-start gap-2"><input type="checkbox" className="mt-1" disabled={hasActive || starting} checked={selectedReceipts.includes(item.id)} onChange={event => setSelectedReceipts(previous => event.target.checked ? [...previous, item.id] : previous.filter(id => id !== item.id))} /><span className="break-all text-sm">{metricLabel(item.calculation_type)} · {displayReceiptResult(item)} · {Object.values(item.inputs).map(input => input.reporting_period ?? input.period_end ?? 'unknown period').join(' / ')} · {item.id}</span></label>)}</div><button type="button" className="rl-secondary mt-3" onClick={onFinancials}>Open Financials</button></details>
      <button className="rl-primary" disabled={starting || hasActive || !selectedDocuments.length}>{starting ? 'Saving run…' : hasActive ? 'A case run is queued or running' : 'Run Dexter research'}</button>
    </form>

    <div className="grid items-start gap-5 xl:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="rl-card space-y-3 p-4"><h2 className="font-bold">Run history</h2>{!runs.length && <p className="rl-muted">No analysis runs yet.</p>}{runs.map(item => <button key={item.id} className={`block w-full rounded-lg border p-3 text-left text-sm ${run?.id === item.id ? 'border-cyan-400 bg-sky-50' : 'border-slate-200'}`} onClick={() => openRun(item.id)}><strong className="block">{metricLabel(item.status)}{item.stale ? ' · stale inputs' : ''}</strong><span className="mt-1 block text-xs text-slate-500">{formatTimestamp(item.created_at)}</span><span className="mt-2 line-clamp-2 break-words">{item.question}</span></button>)}</aside>
      {run && <div className="min-w-0 space-y-5">
        <section className="rl-card space-y-3 p-5"><div className="flex flex-wrap justify-between gap-2"><h2 className="text-xl font-bold">{metricLabel(run.status)}</h2><span className="rl-muted break-all">Run {run.id}</span></div><p className="whitespace-pre-wrap break-words text-sm">{run.question}{run.question_overridden ? ' (run-specific question)' : ''}</p>
          {run.stale && <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><strong>Stale input snapshot — this brief is historical, not current.</strong><ul className="mt-2 list-disc pl-4">{run.stale_reasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul></div>}
          {run.errors.map((message, index) => <ErrorNotice key={index} message={message} />)}
          {run.warnings.map((message, index) => <p key={index} className="text-sm text-amber-900">{message}</p>)}
          <ol className="space-y-3 border-l-2 border-cyan-100 pl-4" aria-label="Actual execution events">{run.events.map(event => <li key={event.id}><p className="text-sm font-semibold">{metricLabel(event.stage)} · {event.transition}</p><p className="rl-muted">{formatTimestamp(event.timestamp)} — {event.message}</p></li>)}</ol>
          <details><summary className="cursor-pointer text-sm font-semibold">Requested model and saved stage outputs</summary><pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 text-xs">{JSON.stringify({requested_model: run.requested_model, stage_outputs: run.stage_outputs}, null, 2)}</pre></details>
        </section>

        {run.financial?.needs_input.length ? <section className="rounded-xl border border-amber-200 bg-amber-50 p-5"><h2 className="font-bold text-amber-900">Analyst input needed</h2><ul className="mt-3 list-disc space-y-2 pl-4 text-sm">{run.financial.needs_input.map((message, index) => <li key={index}>{message}</li>)}</ul><button className="rl-secondary mt-4" onClick={onFinancials}>Resolve in Financials</button><p className="rl-muted mt-2">Start a new run after resolution. Automatic resume is not implemented.</p></section> : null}

        <section className="rl-card space-y-3 p-5"><h2 className="font-bold">Source snapshot and coverage</h2><p className="rl-muted">Research as-of date in this snapshot: {analysisAsOf(run) ?? 'not provided'}</p>{run.snapshot.documents.map(selected => <div key={selected.document.id} className="border-b border-slate-100 pb-3 text-sm"><p className="font-semibold">{selected.document.title} · {selected.included ? 'included' : 'excluded'}{run.source_availability[selected.document.id] ? '' : ' · original source unavailable'}</p><p>Published: {selected.document.publication_date ?? 'unknown'} · Reporting period: {selected.document.reporting_period ?? 'unknown'}</p>{selected.exclusion_reason && <p className="text-amber-900">{selected.exclusion_reason}</p>}<details className="rl-muted"><summary className="cursor-pointer">Content hash</summary><p className="break-all">{selected.content_hash}</p></details></div>)}
          {run.not_included_document_ids.length > 0 && <p className="break-all text-sm text-amber-900">Current documents not considered by this run: {run.not_included_document_ids.map(id => documents.find(doc => doc.id === id)?.title ?? id).join(', ')}</p>}
          {run.retrieval && <p className="rl-muted">Scanned {run.retrieval.scanned_chunks} of {run.retrieval.total_chunks} chunks across {run.retrieval.scanned_sections} sections; {run.retrieval.omitted_chunks} chunks omitted by limits. Retrieved {run.retrieval.passages.length} passages.</p>}
        </section>

        {run.brief && <article className="rl-card space-y-4 p-5" aria-label="Saved preliminary research brief"><h2 className="text-2xl font-bold">{run.brief.qualitative_status==='unavailable'?'Partial numerical research brief':'Preliminary research brief'}</h2><p className="rounded-lg bg-sky-50 p-3 font-semibold text-[#006591]">{run.brief.notice}</p>{run.brief.synthesis_error&&<ErrorNotice message={`Qualitative synthesis unavailable (${run.brief.synthesis_error.category}): ${run.brief.synthesis_error.message}`}/>}<p className="whitespace-pre-wrap break-words">{run.brief.scope}</p><p className="rl-muted">Financial periods considered: {run.brief.periods_considered.join(', ') || 'No confirmed financial periods'}</p>{!!run.brief.verification_ids?.length&&<p className="rl-muted">{run.brief.verification_ids.length} persisted numerical claim checks; open Evidence to inspect methods and verdicts.</p>}
          {run.brief.findings.map(finding => <section key={finding.id} className="space-y-2 border-t border-slate-100 pt-4"><p className="text-xs font-bold uppercase tracking-wide text-[#006591]">{finding.model_generated ? 'Model-generated qualitative interpretation — not independently verified' : 'Numerical observation from saved calculation'}</p><p className="whitespace-pre-wrap break-words">{finding.text}</p><div className="flex flex-wrap gap-2">{finding.evidence_ids.map(id => <button key={id} className="rl-secondary" onClick={() => openEvidence(id)}>Open evidence {run.retrieval?.passages.find(passage => passage.id === id)?.label ?? id.slice(0, 8)}</button>)}{finding.receipt_ids.map(id => <button key={id} className="rl-secondary" onClick={() => openReceipt(id)}>Open calculation receipt</button>)}</div>{finding.limitations.map((limitation, index) => <p key={index} className="rl-muted">{limitation}</p>)}</section>)}
          {run.brief.missing_information.length > 0 && <div><h3 className="font-bold">Missing information</h3><ul className="mt-2 list-disc space-y-1 pl-4 text-sm">{run.brief.missing_information.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
          {run.brief.unsupported_requests.length > 0 && <div><h3 className="font-bold">Unsupported requests</h3><ul className="mt-2 list-disc pl-4 text-sm">{run.brief.unsupported_requests.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
          <details><summary className="cursor-pointer font-bold">Processing and research limitations</summary><ul className="rl-muted mt-3 list-disc space-y-2 pl-4">{[...run.limitations, ...run.brief.limitations].map((item, index) => <li key={index}>{item}</li>)}</ul></details>
        </article>}
        {run.retrieval && <details className="rl-card p-5"><summary className="cursor-pointer font-bold">Saved evidence selections</summary><div className="mt-3 space-y-3">{run.retrieval.passages.map(passage => <button key={passage.id} className="rl-secondary !block w-full text-left" onClick={() => openEvidence(passage.id)}>{passage.document_title} · {passage.label} · offsets {passage.start_offset}–{passage.end_offset}</button>)}</div></details>}
        {(evidence || receipt) && <section ref={inspector} tabIndex={-1} className="rl-card space-y-4 p-5" aria-label="Analysis citation inspector"><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-bold">{evidence ? 'Saved evidence source' : 'Actual saved calculation receipt'}</h2><button className="rl-secondary" onClick={() => {setEvidence(null); setReceipt(null);}}>Close</button></div>
          {evidence && <><h3 className="font-semibold">{evidence.document_title} · {evidence.label}</h3><p className="rl-muted">Exact source slice, Unicode-character offsets {evidence.start_offset}–{evidence.end_offset}. Query: {evidence.query}. Published {evidence.publication_date ?? 'unknown'}; reporting period {evidence.reporting_period ?? 'unknown'}.</p><blockquote className="whitespace-pre-wrap break-words border-l-2 border-cyan-400 pl-3 text-sm">{evidence.excerpt}</blockquote><SourceText text={evidenceSection?.text ?? evidence.excerpt} documentId={evidence.document_id} sectionId={evidence.section_id} pageNumber={evidence.page_number} label={evidence.label} historical={!run.source_availability[evidence.document_id] || run.stale} /></>}
          {receipt && <ReceiptInspector receipt={receipt} />}
        </section>}
      </div>}
    </div>
  </div>;
}
