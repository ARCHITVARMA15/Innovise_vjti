'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Check, FileSpreadsheet, LoaderCircle, MessageCircle, Upload, Wallet } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { deriveAlerts, MAX_FILE_BYTES, money, parseMoney, parseTransactions, summarize, Transaction, whatsappDraft } from './lib/analytics';

const PAGE_SIZE = 20;
export default function FinancialAnalyticsDashboard() {
  const [dataset, setDataset] = useState<{ rows: Transaction[]; source: string; demo: boolean } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [highInput, setHighInput] = useState('500000');
  const [lossInput, setLossInput] = useState('100000');
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [page, setPage] = useState(1);
  const [range, setRange] = useState('all');
  const fileInput = useRef<HTMLInputElement>(null);
  const busy = useRef(false);
  const rows = useMemo(() => dataset?.rows ?? [], [dataset]);
  const summary = useMemo(() => summarize(rows), [rows]);
  const thresholds = useMemo(() => {
    try { return { high: parseMoney(highInput), loss: parseMoney(lossInput), error: '' }; }
    catch { return { high: 0, loss: 0, error: 'Both thresholds must be positive INR amounts with at most two decimal places.' }; }
  }, [highInput, lossInput]);
  const alerts = useMemo(() => thresholds.error ? [] : deriveAlerts(rows, thresholds.high, thresholds.loss), [rows, thresholds]);
  const flagged = new Set(alerts.flatMap(alert => alert.rowId ? [alert.rowId] : []));
  const filtered = useMemo(() => rows.filter(row => (type === 'all' || row.type === type) &&
    `${row.description} ${row.category} ${row.date}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.date.localeCompare(a.date) || a.sourceRow - b.sourceRow), [rows, type, search]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const chartData = range === 'all' ? summary.months : summary.months.slice(-Number(range));

  async function load(source: string, demo: boolean, read: () => Promise<string>) {
    if (busy.current) return;
    busy.current = true; setProcessing(true); setError('');
    try {
      const contents = await read();
      if (new Blob([contents]).size > MAX_FILE_BYTES) throw new Error('Choose a CSV no larger than 5 MiB.');
      const nextRows = parseTransactions(contents);
      setDataset({ rows: nextRows, source, demo }); setReviewed(new Set()); setSearch(''); setType('all'); setPage(1); setRange('all');
    } catch (cause) {
      setError(`${cause instanceof Error ? cause.message : 'Unable to read this file.'}${dataset ? ' Previous dataset remains active.' : ''}`);
    } finally { busy.current = false; setProcessing(false); }
  }
  function loadSample(expenseHeavy = false) {
    const name = expenseHeavy ? 'expense_heavy_transactions.csv' : 'sample_transactions.csv';
    void load(name, true, async () => {
      const response = await fetch(`/financial-analytics/${name}`);
      if (!response.ok) throw new Error('Could not load demo CSV. Try uploading the downloaded template.');
      return response.text();
    });
  }
  function toggleReview(id: string) {
    setReviewed(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  const metrics = [
    { label: 'Total Income', value: summary.income, icon: ArrowDownLeft, note: 'Sum of income transactions', color: 'positive' },
    { label: 'Total Expenses', value: summary.expenses, icon: ArrowUpRight, note: 'Sum of expense transactions', color: '' },
    { label: 'Net Cash Flow', value: summary.net, icon: Wallet, note: 'Income less expenses · not net profit', color: summary.net < 0 ? 'negative' : 'positive' },
    { label: 'Transactions', value: summary.count, icon: FileSpreadsheet, note: 'Valid rows in the active dataset', color: '' },
  ];
  return <div className="fa-dashboard" aria-busy={processing}>
    <Link className="fa-report-link" href="/financial-analytics">← Microsoft FY2025 BI report</Link>
    <div className="fa-breadcrumb">Workspace <span>/</span> Company performance</div>
    <header className="fa-intro">
      <div><p className="fa-eyebrow">FINANCIAL INTELLIGENCE</p><h1>Financial Analytics</h1><p>One clear view of your transactions, cash flow and review signals.</p></div>
      <div className="fa-actions">
        <button className="fa-button" disabled={processing} onClick={() => loadSample()}>Load demo data</button>
        <button className="fa-button" disabled={processing} onClick={() => loadSample(true)}>Load cash-flow example</button>
        <button className="fa-button fa-primary" disabled={processing} onClick={() => fileInput.current?.click()}>{processing ? <LoaderCircle className="fa-spin" size={16} /> : <Upload size={16} />} {processing ? 'Processing…' : 'Upload CSV'}</button>
        <input ref={fileInput} className="sr-only" aria-label="Upload transaction CSV" type="file" accept=".csv,text/csv" disabled={processing} onChange={event => {
          const file = event.target.files?.[0]; event.target.value = '';
          if (!file) return;
          if (!/\.csv$/i.test(file.name)) { setError('Choose a .csv file.'); return; }
          if (file.size > MAX_FILE_BYTES) { setError('Choose a CSV no larger than 5 MiB.'); return; }
          void load(file.name, false, () => file.text());
        }} />
      </div>
    </header>
    <div className="fa-notice"><span className="fa-dot" /><p><strong>Browser workspace.</strong> Data and review states clear on refresh. All amounts assume INR; no currency conversion.</p><span className="fa-badge" role="status">{processing ? 'Validating CSV…' : dataset ? `${dataset.demo ? 'Demo data' : 'Uploaded data'} · ${rows.length} rows loaded` : 'No active dataset'}</span></div>
    {error && <div role="alert" className="fa-error"><AlertTriangle size={18} /><span>{error}</span><button aria-label="Dismiss error" onClick={() => setError('')}>×</button></div>}
    <section className="fa-metrics" aria-label="Financial summary">{metrics.map(({ label, value, icon: Icon, note, color }) => <article className="fa-card fa-metric" key={label}>
      <div className="fa-metric-label">{label}<Icon size={17} /></div>
      <p className={`fa-value ${color}`}>{dataset ? label === 'Transactions' ? value.toLocaleString('en-IN') : money(value) : '—'}</p><p className="fa-hint">{note}</p>
    </article>)}</section>
    <div className="fa-content">
      <section className="fa-card fa-section">
        <div className="fa-section-head"><div><h2>Cash flow trend</h2><p className="fa-hint">Monthly income and expenses · transaction date</p></div><select aria-label="Trend range" value={range} onChange={e => setRange(e.target.value)}><option value="all">All periods</option><option value="6">Last 6 recorded months</option><option value="3">Last 3 recorded months</option></select></div>
        <div className="fa-chart" role="img" aria-label="Monthly income and expenses in INR">
          {rows.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ top: 12, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#e9eef2" /><XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis width={70} tickFormatter={value => new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value) / 100)} tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip formatter={value => money(Number(value))} cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0' }} /><Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 14 }} />
            <Bar dataKey="income" name="Income" fill="#009668" radius={[5, 5, 0, 0]} maxBarSize={44} /><Bar dataKey="expenses" name="Expenses" fill="#80aac6" radius={[5, 5, 0, 0]} maxBarSize={44} />
          </BarChart></ResponsiveContainer> : <div className="fa-empty"><FileSpreadsheet size={30} /><h3>Your cash-flow story starts here</h3><p>Upload a CSV or load a demo to see your monthly trend.</p><a href="/financial-analytics/sample_transactions.csv" download>Download CSV template</a></div>}
        </div>
        <p className="fa-source">{dataset ? `${dataset.demo ? 'DEMO DATA' : 'UPLOADED DATA'} · ${dataset.source} · ${summary.period}` : 'Required columns: date, description, type, amount, category'}</p>
      </section>
      <section className="fa-card fa-section">
        <div className="fa-section-head"><div><h2>Review alerts</h2><p className="fa-hint">Rule-based signals · analyst review required</p></div><span className="fa-badge">{thresholds.error ? 'Rules paused' : `${alerts.length} alerts`}</span></div>
        <div className="fa-thresholds">
          <label>High-value threshold · INR<input type="number" min="0.01" step="0.01" value={highInput} aria-invalid={!!thresholds.error} aria-describedby={thresholds.error ? 'threshold-error' : undefined} onChange={e => { setHighInput(e.target.value); setReviewed(new Set()); }} /></label>
          <label>Negative cash-flow threshold · INR<input type="number" min="0.01" step="0.01" value={lossInput} aria-invalid={!!thresholds.error} aria-describedby={thresholds.error ? 'threshold-error' : undefined} onChange={e => { setLossInput(e.target.value); setReviewed(new Set()); }} /></label>
        </div>
        {thresholds.error && <p id="threshold-error" role="alert" className="negative fa-hint">{thresholds.error}</p>}
        <p className="fa-rules">Flag amounts ≥ high-value threshold, or dataset net cash flow ≤ negative threshold. Signals are for review, not fraud findings or financial advice.</p>
        <div className="fa-alerts">{alerts.length ? alerts.map(alert => <article className={`fa-alert ${alert.severity === 'Critical' ? 'critical' : ''}`} key={alert.id}>
          <div className="fa-alert-head"><h3>{alert.title}</h3><span>{alert.severity}</span></div><p>{alert.body}</p>
          <div className="fa-alert-foot"><button className="fa-review" aria-pressed={reviewed.has(alert.id)} onClick={() => toggleReview(alert.id)}>{reviewed.has(alert.id) ? <Check size={13} /> : <span className="fa-review-dot" />}{reviewed.has(alert.id) ? 'Reviewed · reopen' : 'Mark reviewed'}</button>
            <a href={whatsappDraft(alert)} target="_blank" rel="noopener noreferrer"><MessageCircle size={13} />Open WhatsApp to send</a></div>
        </article>) : <div className="fa-alert-empty">{thresholds.error ? 'Correct the thresholds to evaluate rules.' : rows.length ? 'No alerts at the current thresholds.' : 'Load transactions to evaluate review rules.'}</div>}</div>
        <p className="fa-rules">WhatsApp opens a prefilled draft. You choose the recipient and confirm Send. No automatic delivery.</p>
      </section>
    </div>
    <section className="fa-card fa-section fa-table-section">
      <div className="fa-section-head"><div><h2>Transactions</h2><p className="fa-hint">Most recent first · filters apply to this table only</p></div><div className="fa-actions"><input aria-label="Search transactions" placeholder="Search transactions…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /><select aria-label="Transaction type" value={type} onChange={e => { setType(e.target.value); setPage(1); }}><option value="all">All types</option><option value="income">Income</option><option value="expense">Expense</option></select></div></div>
      <div className="fa-table-wrap"><table><thead><tr>{['Date', 'Description', 'Category', 'Type', 'Amount · INR', 'Alert state'].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>
        {filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).map(row => <tr key={row.id}><td>{row.date}</td><td><strong>{row.description}</strong><small>Source row {row.sourceRow}</small></td><td>{row.category}</td><td><span className={`fa-type ${row.type}`}>{row.type}</span></td><td className="fa-amount">{money(row.amountPaise)}</td><td>{thresholds.error ? 'Rules paused' : flagged.has(row.id) ? <span className="fa-flag">{alerts.filter(alert => alert.rowId === row.id).every(alert => reviewed.has(alert.id)) ? 'Reviewed' : 'High value'}</span> : <span className="fa-hint">No row alert</span>}</td></tr>)}
        {!filtered.length && <tr><td colSpan={6} className="fa-table-empty">{dataset ? 'No transactions match your filters.' : 'Your validated transaction data will appear here.'}</td></tr>}
      </tbody></table></div>
      <div className="fa-pagination"><span>{filtered.length.toLocaleString()} of {rows.length.toLocaleString()} transactions · Page {currentPage} of {pageCount}</span><div className="fa-actions"><button className="fa-button" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Previous</button><button className="fa-button" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>Next</button></div></div>
    </section>
    <footer className="fa-footer"><a href="/financial-analytics/sample_transactions.csv" download>Download CSV template</a><span>CSV only · YYYY-MM-DD dates · up to 5 MiB / 25,000 rows · INR with up to 2 decimals</span><span>Uploaded transactions stay in browser memory and replace the previous dataset.</span></footer>
  </div>;
}
