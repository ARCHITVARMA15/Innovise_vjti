'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, FileText, Plus, Trash2, Upload, X } from 'lucide-react';
import { getCase, getDocument, listDocuments, pasteDocument, removeDocument, uploadDocument,
  MAX_DOCUMENT_BYTES, type ResearchCase, type ResearchDocument, type DocumentDetail } from '@/lib/api/research';
import { ErrorNotice, ResearchHeading, errorText, formatTimestamp } from './ResearchUI';
import FinancialsPanel from './FinancialsPanel';
import AnalysisPanel from './AnalysisPanel';
import SourceText from './SourceText';
import EvidencePanel from './EvidencePanel';
import ReportPanel from './ReportPanel';
import EcosystemPanel from './EcosystemPanel';
import AutomationPanel from './AutomationPanel';

export default function CaseWorkspace({ caseId }: { caseId: string }) {
  const [researchCase, setResearchCase] = useState<ResearchCase | null>(null);
  const [documents, setDocuments] = useState<ResearchDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [mode, setMode] = useState<'upload' | 'paste' | null>(null);
  const [busy, setBusy] = useState(false);
  const [inspecting, setInspecting] = useState(false);
  const [detail, setDetail] = useState<DocumentDetail | null>(null);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'documents' | 'financials' | 'analysis' | 'evidence' | 'report' | 'ecosystem' | 'automation'>('documents');
  const inspectorRef = useRef<HTMLElement>(null);

  const load = useCallback(async () => {
    setLoading(true); setLoadError('');
    try {
      const [record, sources] = await Promise.all([getCase(caseId), listDocuments(caseId)]);
      setResearchCase(record); setDocuments(sources);
    } catch (error) { setLoadError(errorText(error)); }
    finally { setLoading(false); }
  }, [caseId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const followHash = () => {
      const tab=window.location.hash.slice(1);
      if (['documents','financials','analysis','evidence','report','ecosystem','automation'].includes(tab)) setActiveTab(tab as typeof activeTab);
    };
    followHash();
    window.addEventListener('hashchange', followHash);
    return () => window.removeEventListener('hashchange', followHash);
  }, []);

  const refreshRecords = useCallback(async () => {
    const [record, sources] = await Promise.all([getCase(caseId), listDocuments(caseId)]);
    setResearchCase(record); setDocuments(sources);
  }, [caseId]);

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const value = (name: string) => String(values.get(name) ?? '').trim();
    setActionError(''); setNotice('');
    if (!value('title')) { setActionError('Document title is required.'); return; }
    const metadata = { title: value('title'), publication_date: value('publication_date') || null,
      reporting_period: value('reporting_period') || null, source_url: value('source_url') || null,
      document_type: value('document_type') || null };
    const file = values.get('file');
    const text = String(values.get('text') ?? '');
    if (mode === 'upload') {
      if (!(file instanceof File) || !file.size) { setActionError('Choose a non-empty PDF or UTF-8 TXT file.'); return; }
      if (!/\.(pdf|txt)$/i.test(file.name)) { setActionError('Only .pdf and .txt files are supported.'); return; }
      if (file.size > MAX_DOCUMENT_BYTES) { setActionError('Documents must be 10 MiB or smaller.'); return; }
    } else {
      if (!text.trim()) { setActionError('Paste some source text before saving.'); return; }
      if (new Blob([text]).size > MAX_DOCUMENT_BYTES) { setActionError('Pasted text must be 10 MiB or smaller.'); return; }
    }
    setBusy(true);
    let saved = false;
    try {
      const added = mode === 'upload' && file instanceof File
        ? await uploadDocument(caseId, file, metadata) : await pasteDocument(caseId, { ...metadata, text });
      saved = true;
      form.reset(); setMode(null); setDetail(added); setSectionIndex(0);
      setDocuments(previous => [added, ...previous]);
      setNotice('Document saved. Inspect the extracted source text below.');
      await refreshRecords();
    } catch (error) {
      setActionError(`${saved ? 'The document was saved, but the case could not refresh. Reload the page before adding it again. ' : ''}${errorText(error)}`);
    } finally { setBusy(false); }
  }

  async function inspect(documentId: string) {
    setInspecting(true); setActionError('');
    try {
      setDetail(await getDocument(caseId, documentId)); setSectionIndex(0);
      requestAnimationFrame(() => inspectorRef.current?.focus());
    } catch (error) { setActionError(errorText(error)); }
    finally { setInspecting(false); }
  }

  async function confirmRemove(documentId: string) {
    setBusy(true); setActionError(''); setNotice('');
    let removed = false;
    try {
      await removeDocument(caseId, documentId); removed = true;
      setDocuments(previous => previous.filter(item => item.id !== documentId));
      if (detail?.id === documentId) setDetail(null);
      setRemoveId(null); setNotice('Document removed from this case.');
      await refreshRecords();
    } catch (error) { setActionError(`${removed ? 'The document was removed, but the case could not refresh. ' : ''}${errorText(error)}`); }
    finally { setBusy(false); }
  }

  const section = detail?.pages[sectionIndex];

  return <div className="space-y-6">
    <Link href="/research" className="inline-flex items-center gap-2 text-sm font-semibold text-[#006591]"><ArrowLeft size={16} /> All research cases</Link>
    {loading ? <p role="status" className="rl-muted">Loading research case…</p> : loadError ? <><ErrorNotice message={loadError} /><button className="rl-secondary" onClick={load}>Retry loading case</button></> : researchCase && <>
      <header><ResearchHeading /><div className="flex flex-wrap items-center gap-3"><h1 className="break-words text-3xl font-extrabold tracking-tight">{researchCase.title}</h1><span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-bold text-[#006591]">Analyst workspace</span></div>
        <p className="mt-2 break-words font-semibold text-slate-600">{researchCase.company_name}{researchCase.ticker ? ` · ${researchCase.ticker}` : ''}</p>
      </header>
      <section className="rl-card p-5 md:p-6" aria-labelledby="question-heading">
        <h2 id="question-heading" className="text-sm font-bold uppercase tracking-wide text-[#006591]">Research question</h2>
        <p className="mt-3 whitespace-pre-wrap break-words text-lg">{researchCase.research_question}</p>
        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
          <div><dt className="text-slate-500">Reporting period</dt><dd className="mt-1 break-words font-medium">{researchCase.reporting_period || 'Not provided'}</dd></div>
          <div><dt className="text-slate-500">Research as of</dt><dd className="mt-1 font-medium">{researchCase.research_as_of_date || 'Not provided'}</dd></div>
          <div><dt className="text-slate-500">Created</dt><dd className="mt-1 font-medium">{formatTimestamp(researchCase.created_at)}</dd></div>
          <div><dt className="text-slate-500">Updated</dt><dd className="mt-1 font-medium">{formatTimestamp(researchCase.updated_at)}</dd></div>
        </dl>
      </section>

      <nav aria-label="Case sections" className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">{(['documents', 'financials', 'analysis', 'evidence', 'report', 'ecosystem', 'automation'] as const).map(tab => <button key={tab} aria-current={activeTab === tab ? 'page' : undefined} onClick={() => setActiveTab(tab)} className={activeTab === tab ? 'rl-primary capitalize' : 'rl-secondary capitalize'}>{tab === 'ecosystem' ? 'Ecosystem Risk' : tab}</button>)}</nav>
      {activeTab === 'automation' && <AutomationPanel caseId={caseId} onImported={refreshRecords} />}
      {activeTab === 'ecosystem' && <EcosystemPanel caseId={caseId} researchCase={researchCase} />}
      {['analysis','evidence'].includes(activeTab) && <button className="rl-secondary" onClick={() => setActiveTab('report')}>Open Report and human review</button>}
      {activeTab === 'report' && <ReportPanel caseId={caseId} onFinancials={() => setActiveTab('financials')} onEvidence={() => setActiveTab('evidence')} />}
      {activeTab === 'financials' && <FinancialsPanel caseId={caseId} documents={documents} />}
      {activeTab === 'analysis' && <AnalysisPanel caseId={caseId} researchCase={researchCase} documents={documents} onFinancials={() => setActiveTab('financials')} />}
      {activeTab === 'evidence' && <EvidencePanel caseId={caseId} documents={documents} />}

      <section hidden={activeTab !== 'documents'} className="space-y-4" aria-labelledby="documents-heading">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="documents-heading" className="text-2xl font-bold">Documents <span className="text-slate-400">({documents.length})</span></h2><p className="rl-muted mt-1">Keep original sources with this case. No analysis is run on intake.</p></div>
          <div className="flex flex-wrap gap-2"><button className="rl-primary" disabled={busy} onClick={() => { setMode('upload'); setActionError(''); }}><Upload size={16} /> Upload document</button><button className="rl-secondary" disabled={busy} onClick={() => { setMode('paste'); setActionError(''); }}><Plus size={16} /> Paste text</button></div>
        </div>
        {actionError && <ErrorNotice message={actionError} />}
        {notice && <p role="status" className="rounded-xl bg-sky-50 p-3 text-sm text-[#006591]">{notice}</p>}

        {mode && <form key={mode} onSubmit={handleAdd} className="rl-card space-y-4 p-5 md:p-6">
          <div className="flex items-center justify-between gap-3"><h3 className="text-lg font-bold">{mode === 'upload' ? 'Upload a source document' : 'Add pasted source text'}</h3><button type="button" className="rl-secondary" aria-label="Close document form" disabled={busy} onClick={() => setMode(null)}><X size={16} /></button></div>
          <p className="rl-muted">Text-based PDF or UTF-8 TXT only, up to 10 MiB. PDFs: up to 300 pages. Extracted text: up to 2 million characters. Scanned/image-only PDFs need pasted text; OCR is not available.</p>
          <fieldset disabled={busy} className="space-y-4">
            <label>Document title *<input name="title" autoFocus required maxLength={240} placeholder="e.g. Annual report — management discussion" /></label>
            {mode === 'upload' ? <label>Source file *<input name="file" type="file" required accept=".pdf,.txt,application/pdf,text/plain" className="rounded-lg border border-slate-300 p-3 text-sm font-normal" /></label> : <label>Source text *<textarea name="text" required rows={9} placeholder="Paste the source text exactly as provided…" /></label>}
            <div className="grid gap-4 md:grid-cols-2">
              <label>Publication date<input type="date" name="publication_date" /><span className="text-xs font-normal text-slate-500">Source publication date, separate from when you upload it.</span></label>
              <label>Reporting period<input name="reporting_period" maxLength={240} placeholder="Optional, e.g. Q4 FY 2025–26" /></label>
              <label>Source URL<input type="url" name="source_url" maxLength={2048} placeholder="https://… (optional)" /></label>
              <label>Document type<input name="document_type" maxLength={240} placeholder="e.g. Annual report, earnings transcript" /></label>
            </div>
          </fieldset>
          <button className="rl-primary" disabled={busy}>{busy ? 'Saving and extracting…' : 'Save document'}</button>
        </form>}

        {documents.length === 0 ? <div className="rl-card p-8 text-center"><FileText size={32} className="mx-auto mb-3 text-[#006591]" /><h3 className="font-bold">Build your source collection</h3><p className="rl-muted mt-2">Upload a document or paste text. Your sources and citation identifiers will be saved with this case.</p></div> : <div className="grid gap-4 xl:grid-cols-2">{documents.map(doc => <article key={doc.id} className="rl-card min-w-0 p-5">
          <div className="flex items-start gap-3"><FileText size={22} className="mt-1 shrink-0 text-[#006591]" /><div className="min-w-0 flex-1"><h3 className="break-words text-lg font-bold">{doc.title}</h3><p className="rl-muted mt-1 break-words">{doc.document_type || 'Type not provided'} · {doc.source_kind === 'pasted_text' ? 'Pasted text' : doc.source_kind.toUpperCase()}</p></div></div>
          <span className={`mt-3 inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${doc.extraction_status === 'partial' ? 'bg-amber-50 text-amber-800' : 'bg-cyan-50 text-cyan-800'}`}>{doc.extraction_status === 'partial' ? 'Partial extraction — review pages' : 'Text extracted'}</span>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-slate-500">Publication date</dt><dd>{doc.publication_date || 'Not provided'}</dd></div>
            <div><dt className="text-slate-500">Reporting period</dt><dd className="break-words">{doc.reporting_period || 'Not provided'}</dd></div>
            <div><dt className="text-slate-500">Uploaded</dt><dd>{formatTimestamp(doc.uploaded_at)}</dd></div>
            <div><dt className="text-slate-500">Content</dt><dd>{doc.page_count !== null ? `${doc.page_count} PDF pages` : `${doc.section_count} text section · no PDF page numbers`}</dd></div>
          </dl>
          {doc.original_filename && <p className="rl-muted mt-3 break-all">Original file: {doc.original_filename}</p>}
          {doc.source_url && <a className="mt-3 block break-all text-sm text-[#006591] underline" href={doc.source_url} target="_blank" rel="noopener noreferrer">{doc.source_url}</a>}
          {doc.extraction_message && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{doc.extraction_message}</p>}
          <div className="mt-4 flex flex-wrap gap-2"><button className="rl-secondary" disabled={busy || inspecting} onClick={() => inspect(doc.id)}>Inspect text</button><button className="rl-secondary" disabled={busy || inspecting} onClick={() => setRemoveId(doc.id)}><Trash2 size={14} /> Remove</button></div>
          {removeId === doc.id && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm"><p>Remove this document and its saved text from this case? This cannot be undone.</p><div className="mt-3 flex gap-2"><button className="rl-secondary" disabled={busy} onClick={() => confirmRemove(doc.id)}>{busy ? 'Removing…' : 'Confirm removal'}</button><button className="rl-secondary" disabled={busy} onClick={() => setRemoveId(null)}>Keep document</button></div></div>}
        </article>)}</div>}
        {inspecting && <p role="status" className="rl-muted">Loading saved text…</p>}
      </section>

      {activeTab === 'documents' && detail && section && <section ref={inspectorRef} tabIndex={-1} className="rl-card p-5 md:p-6" aria-labelledby="inspector-heading">
        <div className="flex items-start justify-between gap-3"><div><h2 id="inspector-heading" className="break-words text-xl font-bold">{detail.title}</h2><p className="rl-muted mt-1">Source text is untrusted reference material. It is displayed as plain text, never run as instructions.</p></div><button className="rl-secondary" aria-label="Close text inspector" onClick={() => setDetail(null)}><X size={16} /></button></div>
        <label className="mt-5 max-w-md">{detail.source_kind === 'pdf' ? 'PDF page' : 'Text section'}<select value={sectionIndex} onChange={event => setSectionIndex(Number(event.target.value))}>{detail.pages.map((page, index) => <option key={page.id} value={index}>{page.label}{page.extraction_status === 'no_text' ? ' — no extractable text' : ''}</option>)}</select></label>
        <div className="mt-4"><SourceText text={section.text} documentId={detail.id} sectionId={section.id} pageNumber={section.page_number} label={section.label} /></div>
      </section>}

      <aside className="rounded-xl border border-dashed border-slate-300 p-5"><h2 className="font-bold">Further analyst workflows</h2><p className="rl-muted mt-2">Analysis and selected-evidence checks are preliminary. Reports include evidence-based risk observations and versioned analyst review and approval. Approval records research review and does not authorize transactions. PDF export is not available.</p></aside>
    </>}
  </div>;
}
