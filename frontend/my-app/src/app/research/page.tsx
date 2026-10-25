'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, FileText, FolderOpen, Plus } from 'lucide-react';
import { createCase, listCases, type ResearchCase } from '@/lib/api/research';
import { listEcosystemRuns, startEcosystemRun } from '@/lib/api/ecosystem';
import AutomationStart from './components/AutomationStart';
import { ErrorNotice, ResearchHeading, errorText, formatTimestamp } from './components/ResearchUI';

export default function ResearchPage() {
  const router = useRouter();
  const [cases, setCases] = useState<ResearchCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [formError, setFormError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [openingCase, setOpeningCase] = useState(false);
  const [caseError, setCaseError] = useState('');

  async function openRealCase() {
    setOpeningCase(true); setCaseError('');
    try {
      const saved = await listCases();
      const existing = saved.find(c => c.company_name === 'Spirit AeroSystems Holdings, Inc.' && c.research_as_of_date === '2025-02-28');
      const record = existing || await createCase({
        title: 'Spirit AeroSystems · customer dependency and the Boeing strike',
        company_name: 'Spirit AeroSystems Holdings, Inc.', ticker: 'SPR', reporting_period: 'FY2024',
        research_as_of_date: '2025-02-28',
        research_question: 'How did Spirit’s documented Boeing and Airbus customer concentrations expose it to operational disruption? Review the 2024 Boeing strike response, liquidity constraints, financial statements and primary-source evidence. Separate historical facts from assumed revenue sensitivity.',
      });
      if (!(await listEcosystemRuns(record.id)).length) {
        await startEcosystemRun(record.id, {target: record.company_name, as_of_date: '2025-02-28', max_depth: 1, max_counterparties: 5, retry_budget: 2});
      }
      router.push(`/research/${record.id}#ecosystem`);
    } catch (error) { setCaseError(errorText(error)); setOpeningCase(false); }
  }

  async function load() {
    setLoading(true);
    setLoadError('');
    try { setCases(await listCases()); }
    catch (error) { setLoadError(errorText(error)); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const value = (name: string) => String(values.get(name) ?? '').trim();
    if (!value('title') || !value('company_name') || !value('research_question')) {
      setFormError('Title, company name, and research question are required.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const created = await createCase({
        title: value('title'), company_name: value('company_name'), ticker: value('ticker') || null,
        research_question: value('research_question'), reporting_period: value('reporting_period') || null,
        research_as_of_date: value('research_as_of_date') || null,
      });
      router.push(`/research/${created.id}`);
    } catch (error) { setFormError(errorText(error)); setSaving(false); }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><ResearchHeading /><h1 className="text-3xl font-extrabold tracking-tight">Your research cases</h1>
          <p className="mt-2 max-w-2xl text-slate-600">Give each question a home. Collect source documents and preserve their text for the research ahead.</p>
        </div>
        <button className="rl-primary" onClick={() => { setShowForm(true); setFormError(''); }}><Plus size={18} /> New research case</button>
      </header>

      <p className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-[#006591]">Local, single-user prototype. Cases are saved on this backend; workspace labels and case IDs do not provide authentication.</p>

      <section className="rl-card p-5 md:p-6" aria-labelledby="real-case-heading">
        <p className="text-xs font-bold uppercase tracking-wide text-[#006591]">Real evidence · historical case · 28 February 2025</p>
        <h2 id="real-case-heading" className="mt-2 text-xl font-bold">Spirit AeroSystems, Boeing &amp; Airbus</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">Explore disclosed customer concentrations of approximately 58% and 21%, Spirit’s response to the Boeing strike, and FY2024 financial results. Inspect primary sources and distinguish documented impact from assumption-based sensitivity.</p>
        <button className="rl-primary mt-4" disabled={openingCase || loading} onClick={() => void openRealCase()}>{openingCase ? 'Opening case…' : 'Open real-evidence case'}<ArrowRight size={16}/></button>
        {caseError && <ErrorNotice message={caseError}/>}
      </section>

      <AutomationStart onStarted={run => router.push(`/research/${run.case_id}#automation`)} />

      {showForm && <section className="rl-card p-5 md:p-6" aria-labelledby="create-heading">
        <h2 id="create-heading" className="text-xl font-bold">New research case</h2>
        <p className="rl-muted mt-1">Start with a company and a focused question. Optional dates remain blank unless you provide them.</p>
        <form className="mt-5 space-y-4" onSubmit={handleCreate}>
          <div className="grid gap-4 md:grid-cols-2">
            <label>Case title *<input autoFocus name="title" required maxLength={240} placeholder="Cash generation and expansion plans" /></label>
            <label>Company name *<input name="company_name" required maxLength={240} placeholder="Company being researched" /></label>
            <label>Ticker <span className="sr-only">(optional)</span><input name="ticker" maxLength={40} placeholder="Optional" /></label>
            <label>Reporting period<input name="reporting_period" maxLength={240} placeholder="e.g. FY 2025–26" /></label>
          </div>
          <label>Research question *<textarea name="research_question" required maxLength={10000} rows={3} placeholder="What would you like to understand about this company?" /></label>
          <label className="max-w-sm">Research as-of date<input name="research_as_of_date" type="date" /></label>
          {formError && <ErrorNotice message={formError} />}
          <div className="flex flex-wrap gap-3"><button className="rl-primary" disabled={saving}>{saving ? 'Creating…' : 'Create case'}</button><button type="button" className="rl-secondary" disabled={saving} onClick={() => setShowForm(false)}>Cancel</button></div>
        </form>
      </section>}

      <section aria-labelledby="saved-heading" className="space-y-4">
        <h2 id="saved-heading" className="text-lg font-bold">Saved cases</h2>
        {loading ? <p role="status" className="rl-muted">Loading cases…</p> : loadError ? <><ErrorNotice message={loadError} /><button className="rl-secondary" onClick={load}>Retry loading cases</button></> : cases.length === 0 ?
          <div className="rl-card p-10 text-center"><FolderOpen size={36} className="mx-auto mb-4 text-[#006591]" /><h3 className="text-lg font-bold">A clear question is a good beginning</h3><p className="rl-muted mt-2">No research cases yet. Create your first case to start collecting documents.</p></div> :
          <div className="grid gap-4 lg:grid-cols-2">{cases.map(item => <Link key={item.id} href={`/research/${item.id}`} className="rl-card block p-5 transition hover:border-sky-300 hover:shadow-md">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#006591]">{item.company_name}{item.ticker ? ` · ${item.ticker}` : ''}</p><h3 className="break-words text-xl font-bold">{item.title}</h3></div><ArrowRight size={20} className="shrink-0 text-[#006591]" /></div>
            <p className="mt-3 line-clamp-2 whitespace-pre-wrap break-words text-sm text-slate-600">{item.research_question}</p>
            <div className="rl-muted mt-5 flex flex-wrap items-center gap-3"><span className="inline-flex items-center gap-1"><FileText size={15} />{item.document_count} documents</span><span>Updated {formatTimestamp(item.updated_at)}</span></div>
          </Link>)}</div>}
      </section>
    </div>
  );
}
