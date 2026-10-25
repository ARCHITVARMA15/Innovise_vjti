'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Area, Bar, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowLeft, ArrowUpRight, Bookmark, Check, ChevronRight, Download, ExternalLink, Filter, FileSpreadsheet, Focus, LayoutDashboard, Maximize2, Minimize2, PanelLeftClose, PanelLeftOpen, Printer, RotateCcw, Search, Table2, X } from 'lucide-react';
import snapshot from '../data/microsoft-fy2025.json';
import { COLORS, csvText, Fact, factValue, formatMeasure, growth, Measure, measures, quarterly, reconciliations, SEGMENTS, segmentData } from './model';
import './microsoft-bi.css';

const FACTS: Fact[] = snapshot.facts;
const SHEETS = [
  { id: 'overview', title: 'Executive overview', short: 'Overview', icon: '01' },
  { id: 'earnings', title: 'Earnings & margins', short: 'Earnings', icon: '02' },
  { id: 'quarters', title: 'Quarterly performance', short: 'Quarterly', icon: '03' },
  { id: 'cash', title: 'Cash flow & allocation', short: 'Cash flow', icon: '04' },
  { id: 'mix', title: 'Business & revenue mix', short: 'Business mix', icon: '05' },
  { id: 'balance', title: 'Financial position', short: 'Balance sheet', icon: '06' },
  { id: 'ratios', title: 'Ratios & efficiency', short: 'Ratios', icon: '07' },
  { id: 'sources', title: 'Source data & methodology', short: 'Source data', icon: '08' },
] as const;
type Sheet = typeof SHEETS[number]['id'];
type Row = Record<string, string | number | null>;
type Series = { key: string; label: string; color: string; kind?: 'bar' | 'line' | 'area'; stack?: string };
function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}
function Visual({ title, subtitle, rows, keys, children, note, className = '' }: {
  title: string; subtitle: string; rows: Row[]; keys: { key: string; label: string }[];
  children: React.ReactNode; note?: string; className?: string;
}) {
  const [table, setTable] = useState(false);
  const [expanded, setExpanded] = useState(false);
  return <section className={`bi-visual ${className} ${expanded ? 'bi-visual-expanded' : ''}`} onKeyDown={e => { if (e.key === 'Escape') setExpanded(false); }}>
    <header><div><h3>{title}</h3><p>{subtitle}</p></div><div className="bi-visual-tools">
      <button title={table ? 'Show chart' : 'View underlying data'} aria-label={`${table ? 'Show chart' : 'View data'}: ${title}`} aria-pressed={table} onClick={() => setTable(!table)}><Table2 size={14} /></button>
      <button title="Export visual data" aria-label={`Export data: ${title}`} onClick={() => download(`${title.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}.csv`, csvText(keys.map(k => k.label), rows.map(row => keys.map(k => row[k.key]))))}><Download size={14} /></button>
      <button title={expanded ? 'Exit focus' : 'Focus visual'} aria-label={`${expanded ? 'Exit focus' : 'Focus'}: ${title}`} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}</button>
    </div></header>
    <div className={`bi-plot ${table ? 'bi-plot-table' : ''}`}>{rows.length ? table ? <DataTable rows={rows} columns={keys} /> : children : <div className="bi-no-data">This period is not included in the source extract.</div>}</div>
    {note && <p className="bi-visual-note">{note}</p>}
  </section>;
}
function DataTable({ rows, columns }: { rows: Row[]; columns: { key: string; label: string }[] }) {
  return <div className="bi-table-scroll"><table className="bi-table"><thead><tr>{columns.map(col => <th key={col.key}>{col.label}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i}>{columns.map(col => <td key={col.key} className={typeof row[col.key] === 'number' ? 'numeric' : ''}>{typeof row[col.key] === 'number' ? Number(row[col.key]).toLocaleString('en-US', { maximumFractionDigits: 4 }) : row[col.key] ?? 'n/a'}</td>)}</tr>)}</tbody></table></div>;
}
function Plot({ rows, x, series, unit, percent = false, horizontal = false, onSelect }: { rows: Row[]; x: string; series: Series[]; unit: 'B' | 'M'; percent?: boolean; horizontal?: boolean; onSelect?: (row: Row) => void }) {
  const [hidden, setHidden] = useState<string[]>([]);
  const scale = (value: number) => percent ? `${(value * 100).toFixed(0)}%` : `${(value / (unit === 'B' ? 1000 : 1)).toLocaleString('en-US', { maximumFractionDigits: 1 })}`;
  return <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 600, height: 250 }}><ComposedChart data={rows} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 14, right: 16, bottom: 4, left: horizontal ? 0 : 4 }}>
    <CartesianGrid stroke="#e8edf2" strokeDasharray="2 3" vertical={!horizontal ? false : true} horizontal={!horizontal} />
    <XAxis type={horizontal ? 'number' : 'category'} dataKey={horizontal ? undefined : x} tickFormatter={horizontal ? scale : undefined} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#6d7b8b' }} />
    <YAxis type={horizontal ? 'category' : 'number'} dataKey={horizontal ? x : undefined} width={horizontal ? 135 : 55} tickFormatter={horizontal ? undefined : scale} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#6d7b8b' }} />
    <Tooltip formatter={(value, name) => [formatMeasure(Number(value), percent ? 'percent' : 'money', unit), name]} contentStyle={{ border: '1px solid #dce3eb', borderRadius: 5, fontSize: 11, boxShadow: '0 8px 24px #132a4412' }} cursor={{ fill: '#edf3f85c' }} />
    <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 10, paddingTop: 12, cursor: 'pointer' }} onClick={item => {
      const key = series.find(s => s.label === item.value)?.key; if (key) setHidden(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
    }} />
    <ReferenceLine y={horizontal ? undefined : 0} x={horizontal ? 0 : undefined} stroke="#cfd8e2" />
    {series.map(s => s.kind === 'line' ? <Line key={s.key} dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2.5} dot={{ r: 3 }} hide={hidden.includes(s.key)} connectNulls={false} /> : s.kind === 'area' ? <Area key={s.key} dataKey={s.key} name={s.label} stroke={s.color} fill={s.color} fillOpacity={.12} strokeWidth={2} hide={hidden.includes(s.key)} /> :
      <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={s.stack ? 0 : horizontal ? [0, 3, 3, 0] : [3, 3, 0, 0]} stackId={s.stack} maxBarSize={horizontal ? 22 : 38} hide={hidden.includes(s.key)} cursor={onSelect ? 'pointer' : undefined} onClick={(_, index) => onSelect?.(rows[index])} />)}
  </ComposedChart></ResponsiveContainer>;
}
function Ring({ rows, unit, onSelect }: { rows: Row[]; unit: 'B' | 'M'; onSelect?: (row: Row) => void }) {
  return <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 600, height: 250 }}><PieChart><Pie data={rows} dataKey="value" nameKey="name" innerRadius="57%" outerRadius="82%" paddingAngle={3} stroke="none" onClick={(_, index) => onSelect?.(rows[index])} cursor={onSelect ? 'pointer' : undefined}>{rows.map((row, i) => <Cell key={i} fill={String(row.color || COLORS[i % COLORS.length])} />)}</Pie><Tooltip formatter={value => formatMeasure(Number(value), 'money', unit)} contentStyle={{ fontSize: 11, borderRadius: 5 }} /><Legend iconSize={7} iconType="circle" wrapperStyle={{ fontSize: 10 }} /></PieChart></ResponsiveContainer>;
}
function Waterfall({ rows, unit }: { rows: Row[]; unit: 'B' | 'M' }) {
  return <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 600, height: 250 }}><ComposedChart data={rows} margin={{ left: 0, right: 12, top: 16, bottom: 12 }}><CartesianGrid vertical={false} strokeDasharray="2 3" stroke="#e8edf2" /><XAxis dataKey="name" tick={{ fontSize: 9, fill: '#6d7b8b' }} interval={0} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 10, fill: '#6d7b8b' }} tickFormatter={v => String(Number(v) / (unit === 'B' ? 1000 : 1))} width={55} axisLine={false} tickLine={false} /><Tooltip formatter={(_, __, item) => formatMeasure(Number(item.payload.change), 'money', unit)} contentStyle={{ fontSize: 11, borderRadius: 5 }} /><Bar dataKey="base" stackId="bridge" fill="transparent" tooltipType="none" /><Bar dataKey="height" stackId="bridge" radius={[2, 2, 0, 0]} maxBarSize={60}>{rows.map((r, i) => <Cell key={i} fill={String(r.color)} />)}</Bar></ComposedChart></ResponsiveContainer>;
}
function bridge(items: { name: string; value: number; total?: boolean }[]): Row[] {
  let balance = 0;
  return items.map(item => {
    const start = item.total ? 0 : balance, end = item.total ? item.value : balance + item.value;
    balance = end;
    return { name: item.name, change: item.value, base: Math.min(start, end), height: Math.abs(end - start), color: item.total ? '#2979c7' : item.value < 0 ? '#d48b79' : '#21a394' };
  });
}

export default function MicrosoftBI() {
  const [sheet, setSheet] = useState<Sheet>('overview');
  const [year, setYear] = useState(2025);
  const [unit, setUnit] = useState<'B' | 'M'>('B');
  const [compare, setCompare] = useState(true);
  const [segment, setSegment] = useState('All segments');
  const [filters, setFilters] = useState(true);
  const [filtersTouched, setFiltersTouched] = useState(false);
  const [pages, setPages] = useState(true);
  const [presentation, setPresentation] = useState(false);
  const [search, setSearch] = useState('');
  const [statement, setStatement] = useState('all');
  const [sourcePage, setSourcePage] = useState(1);
  const [notice, setNotice] = useState('');
  const ms = useMemo(() => measures(FACTS, year), [year]);
  const priorMs = useMemo(() => measures(FACTS, year - 1), [year]);
  const get = (id: string) => ms.find(m => m.id === id)!;
  const v = (group: string, metric: string, y = year) => factValue(FACTS, y, group, metric);
  const fmt = (value: number | null, format: Measure['format'] = 'money') => formatMeasure(value, format, unit);
  const annual: Row[] = [2023, 2024, 2025].filter(y => y <= year).map(y => {
    const m = measures(FACTS, y), value = (id: string) => m.find(row => row.id === id)!.value;
    return { year: `FY${y}`, fiscalYear: y, revenue: value('revenue'), operating: value('operating_income'), net: value('net_income'), gross: value('gross_margin'), operatingMargin: value('operating_margin'), netMargin: value('net_margin'), cfo: value('operating_cash'), fcf: value('free_cash_flow'), capex: value('cash_capex') };
  });
  const quarters = quarterly(FACTS, year);
  const segments = segmentData(FACTS, year);
  const chosenSegments = segments.filter(s => segment === 'All segments' || s.name === segment);
  const sourceRows = useMemo(() => FACTS.filter(f => f.fiscal_year === year && (statement === 'all' || f.statement === statement) && `${f.label} ${f.dimension} ${f.metric} ${f.period}`.toLowerCase().includes(search.toLowerCase())), [year, statement, search]);
  const sourcePages = Math.max(1, Math.ceil(sourceRows.length / 20));
  const activeSourcePage = Math.min(sourcePage, sourcePages);
  const checks = reconciliations(FACTS, year);
  const currentSheet = SHEETS.find(s => s.id === sheet)!;
  const cols = (x: string, series: Series[], label = x) => [{ key: x, label }, ...series.map(s => ({ key: s.key, label: `${s.label} (USD millions)` }))];
  const selectYear = (row: Row) => { if (typeof row.fiscalYear === 'number') setYear(row.fiscalYear); };
  const selectSegment = (row: Row) => { const value = String(row.name); setSegment(previous => previous === value ? 'All segments' : value); setSheet('mix'); };
  const saveView = () => {
    try { localStorage.setItem('veritas_microsoft_bi_view', JSON.stringify({ sheet, year, unit, compare, segment, search, statement, sourcePage })); setNotice('Current page and filters saved in this browser.'); }
    catch { setNotice('Browser storage is unavailable.'); }
  };
  const restoreView = () => {
    try {
      const saved = JSON.parse(localStorage.getItem('veritas_microsoft_bi_view') || 'null');
      if (!saved) { setNotice('No saved view yet. Use Bookmark view first.'); return; }
      if (SHEETS.some(s => s.id === saved.sheet)) setSheet(saved.sheet);
      if ([2023, 2024, 2025].includes(saved.year)) setYear(saved.year);
      if (['B', 'M'].includes(saved.unit)) setUnit(saved.unit);
      setCompare(saved.compare === true); setSegment(SEGMENTS.includes(saved.segment) ? saved.segment : 'All segments');
      setSearch(typeof saved.search === 'string' ? saved.search : '');
      setStatement(['all', ...new Set(FACTS.map(f => f.statement))].includes(saved.statement) ? saved.statement : 'all');
      setSourcePage(Number.isInteger(saved.sourcePage) && saved.sourcePage > 0 ? saved.sourcePage : 1);
      setNotice('Saved view restored.');
    } catch { setNotice('Unable to restore the saved view.'); }
  };
  function exportMeasures() {
    download(`microsoft-fy${year}-metrics.csv`, csvText(['Metric', 'Value', 'Unit', 'Basis', 'Formula', 'Fiscal year'], ms.map(m => [m.label, m.value, m.format === 'money' ? 'USD_millions' : m.format === 'percent' ? 'fraction' : m.format === 'eps' ? 'USD/share' : 'ratio', m.basis, m.formula, year])));
  }
  const kpis = (ids: string[]) => <div className="bi-kpis">{ids.map(id => {
    const m = get(id), prior = priorMs.find(p => p.id === id)?.value ?? null;
    const delta = growth(m.value, prior);
    return <article className="bi-kpi" key={id} title={m.formula}><div><span>{m.label}</span><span className="bi-kpi-info">i</span></div><strong>{fmt(m.value, m.format)}</strong>
      <p>{compare && delta !== null && m.format !== 'percent' && m.format !== 'ratio' ? <><span className={delta >= 0 ? 'bi-up' : 'bi-down'}>{delta >= 0 ? '↗' : '↘'} {Math.abs(delta * 100).toFixed(1)}%</span> vs FY{year - 1}</> : compare && prior !== null && m.value !== null && m.format === 'percent' ? <><span className={m.value - prior >= 0 ? 'bi-up' : 'bi-down'}>{((m.value - prior) * 100).toFixed(1)} pp</span> vs FY{year - 1}</> : m.basis === 'Reported' ? 'Reported in financial statements' : m.value === null ? 'Required source period unavailable' : 'Calculated from reported figures'}</p>
    </article>;
  })}</div>;
  const trendSeries: Series[] = [{ key: 'revenue', label: 'Revenue', color: COLORS[0] }, { key: 'operating', label: 'Operating income', color: COLORS[1] }, { key: 'net', label: 'Net income', color: COLORS[2] }];
  const marginSeries: Series[] = [{ key: 'gross', label: 'Gross margin', color: COLORS[0], kind: 'line' }, { key: 'operatingMargin', label: 'Operating margin', color: COLORS[1], kind: 'line' }, { key: 'netMargin', label: 'Net margin', color: COLORS[2], kind: 'line' }];
  const waterfall = bridge([
    { name: 'Revenue', value: v('income', 'revenue')!, total: true },
    { name: 'Cost of sales', value: -v('income', 'cost_of_revenue')! },
    { name: 'R&D', value: -v('income', 'research_development')! },
    { name: 'Sales & mktg', value: -v('income', 'sales_marketing')! },
    { name: 'G&A', value: -v('income', 'general_administrative')! },
    { name: 'Other', value: v('income', 'other_income')! },
    { name: 'Income tax', value: -v('income', 'income_tax')! },
    { name: 'Net income', value: v('income', 'net_income')!, total: true },
  ]);
  const segmentRing = segments.map(s => ({ name: s.name, value: s.revenue, color: s.color }));
  const relevantChecks = checks.filter(c => c.difference !== null);
  const relevantChecksPass = relevantChecks.every(c => Math.abs(c.difference!) < .01);

  return <div className={`bi-workspace ${presentation ? 'bi-presentation' : ''} ${filtersTouched ? '' : 'bi-auto-filters'}`}>
    <header className="bi-commandbar"><div className="bi-document"><div className="bi-report-icon"><LayoutDashboard size={20} /></div><div><div className="bi-document-path"><Link href="/financial-analytics">Financial Analytics</Link><ChevronRight size={12} /><span>Company reports</span></div><strong>Microsoft · Financial Performance</strong></div><span className="bi-filetype">REPORT</span></div>
      <div className="bi-command-actions"><Link className="bi-transaction-link" href="/financial-analytics/transactions" title="CSV transaction workspace"><FileSpreadsheet size={15} /><span>Transactions</span></Link><button title="Bookmark current view" onClick={saveView}><Bookmark size={15} /><span>Bookmark view</span></button><button title="Restore bookmark" onClick={restoreView}><RotateCcw size={14} /></button><button onClick={exportMeasures}><Download size={15} /><span>Export metrics</span></button><button onClick={() => window.print()} title="Print report / save as PDF"><Printer size={15} /></button><button onClick={() => setPresentation(!presentation)} title={presentation ? 'Exit presentation mode' : 'Presentation mode'} aria-pressed={presentation}>{presentation ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button></div>
    </header>
    <div className="bi-toolbar"><div><button className="bi-toggle-pages" onClick={() => setPages(!pages)} aria-label="Toggle report pages" aria-expanded={pages}>{pages ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}</button><span>Reading view</span><span className="bi-toolbar-divider" /><span className="bi-source-dot" /> <span>Official filing snapshot</span></div><div><span>Display</span><select aria-label="Display units" value={unit} onChange={e => setUnit(e.target.value as 'B' | 'M')}><option value="B">USD billions</option><option value="M">USD millions</option></select><button onClick={() => { setFilters(!filtersTouched && window.matchMedia('(max-width:1000px)').matches ? true : !filters); setFiltersTouched(true); }} aria-label="Toggle filters"><Filter size={14} />Filters</button></div></div>
    {notice && <div className="bi-notification" role="status"><Check size={14} />{notice}<button aria-label="Dismiss notification" onClick={() => setNotice('')}><X size={14} /></button></div>}
    <div className="bi-body">
      {pages && <aside className="bi-pages"><h2>REPORT PAGES <span>8</span></h2><nav aria-label="Report pages">{SHEETS.map(s => <button key={s.id} className={s.id === sheet ? 'active' : ''} onClick={() => setSheet(s.id)} aria-current={s.id === sheet ? 'page' : undefined}><span className="bi-page-number">{s.icon}</span><span>{s.title}</span></button>)}</nav><div className="bi-pages-bottom"><div className="bi-ms-logo" aria-hidden="true"><i /><i /><i /><i /></div><strong>Microsoft Corporation</strong><span>NASDAQ: MSFT</span><p>FY2025 annual report<br />and quarterly earnings</p><Link href="/financial-analytics/transactions"><ArrowLeft size={12} />Transaction workspace</Link></div></aside>}
      <article className="bi-report" aria-label="Report canvas" key={sheet}>
        <div className="bi-page-heading"><div><p>MICROSOFT CORPORATION</p><h1>{currentSheet.title}</h1><span>{year === 2025 ? 'July 1, 2024 – June 30, 2025' : `July 1, ${year - 1} – June 30, ${year}`}<span className="bi-heading-dot">·</span>Fiscal year {year}<span className="bi-heading-dot">·</span>USD {unit === 'B' ? 'billions' : 'millions'}, except ratios and EPS</span></div><div className="bi-year-mark">FY<span>{String(year).slice(-2)}</span></div></div>
        <div className="bi-applied"><span className="bi-filter-chip"><Filter size={11} />Fiscal year: {year}</span>{sheet === 'mix' && segment !== 'All segments' && <button className="bi-filter-chip" onClick={() => setSegment('All segments')}>{segment}<X size={11} /></button>}<span className="bi-applied-note">{sheet === 'mix' ? 'Select a segment to filter its detail' : sheet === 'overview' ? 'Select a year in the chart to change the report' : 'Use visual headers to inspect, export or focus data'}</span></div>
        {sheet === 'overview' && <>
          {kpis(['revenue', 'operating_income', 'net_income', 'free_cash_flow'])}
          <div className="bi-grid bi-grid-wide"><Visual title="Revenue and earnings" subtitle={`FY2023–FY${year} · USD ${unit === 'B' ? 'billions' : 'millions'}`} rows={annual} keys={cols('year', trendSeries, 'Fiscal year')} note="Select a year bar to filter every report page. Click a legend item to hide a series."><Plot rows={annual} x="year" series={trendSeries} unit={unit} onSelect={selectYear} /></Visual>
            <Visual title="Revenue by business segment" subtitle={`FY${year} · share of consolidated revenue`} rows={segmentRing} keys={[{ key: 'name', label: 'Segment' }, { key: 'value', label: 'Revenue (USD millions)' }]} note="Select a segment to explore Business mix."><Ring rows={segmentRing} unit={unit} onSelect={selectSegment} /></Visual></div>
          <div className="bi-grid"><Visual title="Profitability profile" subtitle="Margins as a percentage of consolidated revenue" rows={annual} keys={[{ key: 'year', label: 'Fiscal year' }, ...marginSeries.map(s => ({ key: s.key, label: `${s.label} (fraction)` }))]}><Plot rows={annual} x="year" series={marginSeries} unit={unit} percent /></Visual>
            <Visual title="Cash generation and reinvestment" subtitle="Operating cash flow, cash capex and free cash flow" rows={annual} keys={cols('year', [{ key: 'cfo', label: 'Operating cash flow', color: '' }, { key: 'capex', label: 'Cash capex', color: '' }, { key: 'fcf', label: 'Free cash flow', color: '' }], 'Fiscal year')}><Plot rows={annual} x="year" series={[{ key: 'cfo', label: 'Operating cash flow', color: COLORS[0] }, { key: 'capex', label: 'Cash capex', color: COLORS[3] }, { key: 'fcf', label: 'Free cash flow', color: COLORS[1], kind: 'line' }]} unit={unit} /></Visual></div>
          <div className="bi-insights"><div><span>ANALYST NOTES</span><h3>What changed in FY{year}?</h3></div><p><strong>{fmt(get('revenue_growth').value, 'percent')}</strong> revenue growth from the prior fiscal year.</p><p><strong>{fmt(get('capex_cfo').value, 'percent')}</strong> of operating cash flow invested in cash capex.</p><p><strong>{fmt(get('cash_conversion').value, 'ratio')}</strong> operating cash flow relative to net income.</p></div>
        </>}
        {sheet === 'earnings' && <>
          {kpis(['gross_profit', 'gross_margin', 'operating_margin', 'diluted_eps'])}
          <Visual title="Revenue to net income" subtitle={`FY${year} income statement bridge · USD ${unit === 'B' ? 'billions' : 'millions'}`} rows={waterfall} keys={[{ key: 'name', label: 'Component' }, { key: 'change', label: 'Signed value (USD millions)' }]} note="Blue bars are totals. Each intermediate bar adds or subtracts a reported line item."><Waterfall rows={waterfall} unit={unit} /></Visual>
          <div className="bi-grid"><Visual title="Operating expense composition" subtitle="R&D, sales and marketing, general and administrative" rows={annual.map(r => ({ year: r.year, rd: v('income', 'research_development', Number(r.fiscalYear)), sm: v('income', 'sales_marketing', Number(r.fiscalYear)), ga: v('income', 'general_administrative', Number(r.fiscalYear)) }))} keys={[{ key: 'year', label: 'Year' }, { key: 'rd', label: 'R&D (USD millions)' }, { key: 'sm', label: 'Sales and marketing (USD millions)' }, { key: 'ga', label: 'G&A (USD millions)' }]}><Plot rows={annual.map(r => ({ year: r.year, rd: v('income', 'research_development', Number(r.fiscalYear)), sm: v('income', 'sales_marketing', Number(r.fiscalYear)), ga: v('income', 'general_administrative', Number(r.fiscalYear)) }))} x="year" series={[{ key: 'rd', label: 'R&D', color: COLORS[0], stack: 'opex' }, { key: 'sm', label: 'Sales & marketing', color: COLORS[1], stack: 'opex' }, { key: 'ga', label: 'G&A', color: COLORS[2], stack: 'opex' }]} unit={unit} /></Visual>
            <Visual title="Margin trends" subtitle="Percentage of consolidated revenue" rows={annual} keys={[{ key: 'year', label: 'Year' }, ...marginSeries.map(s => ({ key: s.key, label: `${s.label} (fraction)` }))]}><Plot rows={annual} x="year" series={marginSeries} unit={unit} percent /></Visual></div>
          <StatementTable facts={FACTS} year={year} group="income" compare={compare} unit={unit} />
        </>}
        {sheet === 'quarters' && <>
          <div className="bi-context-note">Standalone fiscal quarters. Q1 ends in September {year - 1}; Q4 ends in June {year}. Quarterly earnings releases are unaudited. KPI cards compare full fiscal years; charts show standalone quarters. Annual comparatives come from the FY2025 report.</div>
          {kpis(['revenue_growth', 'operating_growth', 'net_growth', 'eps_growth'])}
          <div className="bi-grid"><Visual title="Quarterly revenue" subtitle={compare ? `FY${year} compared with FY${year - 1}` : `FY${year}`} rows={quarters} keys={[{ key: 'period', label: 'Period' }, { key: 'end', label: 'Period end' }, { key: 'revenue', label: 'Revenue (USD millions)' }, ...(compare ? [{ key: 'priorRevenue', label: 'Prior year (USD millions)' }] : [])]}><Plot rows={quarters} x="quarter" series={[{ key: 'revenue', label: `FY${year}`, color: COLORS[0] }, ...(compare ? [{ key: 'priorRevenue', label: `FY${year - 1}`, color: '#b8ccdf' }] : [])]} unit={unit} /></Visual>
            <Visual title="Quarterly operating and net margins" subtitle="Margins calculated from each standalone quarter" rows={quarters} keys={[{ key: 'period', label: 'Period' }, { key: 'operatingMargin', label: 'Operating margin (fraction)' }, { key: 'netMargin', label: 'Net margin (fraction)' }]}><Plot rows={quarters} x="quarter" series={[{ key: 'operatingMargin', label: 'Operating margin', color: COLORS[1], kind: 'line' }, { key: 'netMargin', label: 'Net margin', color: COLORS[2], kind: 'line' }]} unit={unit} percent /></Visual></div>
          <div className="bi-data-card"><h3>Quarterly performance matrix</h3><DataTable rows={quarters.map(q => ({ period: q.period, end: q.end, revenue: fmt(q.revenue), operating: fmt(q.operating), net: fmt(q.net), growth: fmt(q.revenueGrowth, 'percent'), eps: fmt(q.eps, 'eps') }))} columns={[{ key: 'period', label: 'Fiscal quarter' }, { key: 'end', label: 'Quarter end' }, { key: 'revenue', label: 'Revenue' }, { key: 'operating', label: 'Operating income' }, { key: 'net', label: 'Net income' }, { key: 'growth', label: 'Revenue YoY' }, { key: 'eps', label: 'Diluted EPS' }]} />{!quarters.length && <p className="bi-context-note">FY2023 quarterly observations are not included in this extract. Select FY2024 or FY2025.</p>}</div>
        </>}
        {sheet === 'cash' && <>
          {kpis(['operating_cash', 'cash_capex', 'free_cash_flow', 'capital_returns'])}
          <div className="bi-grid"><Visual title="Cash generation versus cash capex" subtitle="Cash capital expenditure excludes noncash lease additions" rows={annual} keys={[{ key: 'year', label: 'Year' }, { key: 'cfo', label: 'Operating cash flow (USD millions)' }, { key: 'capex', label: 'Cash capex (USD millions)' }, { key: 'fcf', label: 'Free cash flow (USD millions)' }]}><Plot rows={annual} x="year" series={[{ key: 'cfo', label: 'Operating cash flow', color: COLORS[0] }, { key: 'capex', label: 'Cash capex', color: COLORS[3] }, { key: 'fcf', label: 'Free cash flow', color: COLORS[1], kind: 'line' }]} unit={unit} /></Visual>
            <Visual title="Cash balance reconciliation" subtitle={`FY${year} · opening to closing cash and equivalents`} rows={bridge([{ name: 'Opening cash', value: v('cash', 'beginning_cash')!, total: true }, { name: 'Operations', value: v('cash', 'operating_cash')! }, { name: 'Investing', value: v('cash', 'investing_cash')! }, { name: 'Financing', value: v('cash', 'financing_cash')! }, { name: 'FX', value: v('cash', 'fx_effect')! }, { name: 'Closing cash', value: v('cash', 'ending_cash')!, total: true }])} keys={[{ key: 'name', label: 'Component' }, { key: 'change', label: 'Signed value (USD millions)' }]}><Waterfall rows={bridge([{ name: 'Opening cash', value: v('cash', 'beginning_cash')!, total: true }, { name: 'Operations', value: v('cash', 'operating_cash')! }, { name: 'Investing', value: v('cash', 'investing_cash')! }, { name: 'Financing', value: v('cash', 'financing_cash')! }, { name: 'FX', value: v('cash', 'fx_effect')! }, { name: 'Closing cash', value: v('cash', 'ending_cash')!, total: true }])} unit={unit} /></Visual></div>
          <div className="bi-grid"><Visual title="Capital deployment" subtitle="Selected cash outflows; not a complete use-of-cash reconciliation" rows={[{ name: 'Cash capex', value: -v('cash', 'capex')! }, { name: 'Acquisitions & other assets', value: -v('cash', 'acquisitions')! }, { name: 'Dividends paid', value: -v('cash', 'dividends')! }, { name: 'Stock repurchases', value: -v('cash', 'buybacks')! }, { name: 'Debt repayments', value: -v('cash', 'debt_repaid')! }]} keys={[{ key: 'name', label: 'Use of cash' }, { key: 'value', label: 'Cash outflow (USD millions)' }]}><Plot rows={[{ name: 'Cash capex', value: -v('cash', 'capex')! }, { name: 'Acquisitions & assets', value: -v('cash', 'acquisitions')! }, { name: 'Dividends paid', value: -v('cash', 'dividends')! }, { name: 'Stock repurchases', value: -v('cash', 'buybacks')! }, { name: 'Debt repayments', value: -v('cash', 'debt_repaid')! }]} x="name" series={[{ key: 'value', label: 'Cash outflow', color: COLORS[0] }]} unit={unit} horizontal /></Visual>
            <div className="bi-data-card bi-formula-card"><p className="bi-overline">CASH FLOW DEFINITIONS</p><h3>From earnings to cash</h3>{['free_cash_flow', 'cash_conversion', 'fcf_payout'].map(id => <div key={id}><span>{get(id).label}</span><strong>{fmt(get(id).value, get(id).format)}</strong><p>{get(id).formula}</p></div>)}</div></div>
          <StatementTable facts={FACTS} year={year} group="cash" compare={compare} unit={unit} />
        </>}
        {sheet === 'mix' && <>
          <div className="bi-segment-slicer"><span>Segment detail</span>{['All segments', ...SEGMENTS].map(s => <button key={s} className={segment === s ? 'active' : ''} onClick={() => setSegment(s)} aria-pressed={segment === s}>{s}</button>)}</div>
          <div className="bi-kpis">{[['Selected segment revenue', chosenSegments.reduce((s, r) => s + r.revenue, 0), 'money'], ['Selected operating income', chosenSegments.reduce((s, r) => s + r.operating, 0), 'money'], ['Selected operating margin', chosenSegments.reduce((s, r) => s + r.operating, 0) / chosenSegments.reduce((s, r) => s + r.revenue, 0), 'percent'], ['Share of consolidated revenue', chosenSegments.reduce((s, r) => s + r.revenue, 0) / v('income', 'revenue')!, 'percent']].map(([label, value, format]) => <article className="bi-kpi" key={String(label)}><div><span>{label}</span></div><strong>{fmt(Number(value), format as Measure['format'])}</strong><p>FY{year} · {segment}</p></article>)}</div>
          <div className="bi-grid"><Visual title="Segment revenue and operating income" subtitle="Select a bar to filter the segment detail" rows={segments} keys={[{ key: 'name', label: 'Segment' }, { key: 'revenue', label: 'Revenue (USD millions)' }, { key: 'operating', label: 'Operating income (USD millions)' }]}><Plot rows={segments} x="short" series={[{ key: 'revenue', label: 'Revenue', color: COLORS[0] }, { key: 'operating', label: 'Operating income', color: COLORS[1] }]} unit={unit} onSelect={selectSegment} /></Visual>
            <Visual title="Selected segment revenue composition" subtitle={`${segment} · cost of revenue, operating expense and income`} rows={chosenSegments} keys={[{ key: 'name', label: 'Segment' }, { key: 'cost', label: 'Cost of revenue (USD millions)' }, { key: 'opex', label: 'Operating expenses (USD millions)' }, { key: 'operating', label: 'Operating income (USD millions)' }]}><Plot rows={chosenSegments} x="short" series={[{ key: 'cost', label: 'Cost of revenue', color: '#b8ccdf', stack: 'revenue' }, { key: 'opex', label: 'Operating expenses', color: COLORS[2], stack: 'revenue' }, { key: 'operating', label: 'Operating income', color: COLORS[1], stack: 'revenue' }]} unit={unit} /></Visual></div>
          <div className="bi-data-card"><h3>Segment performance detail</h3><DataTable rows={chosenSegments.map(s => ({ segment: s.name, revenue: fmt(s.revenue), operating: fmt(s.operating), margin: fmt(s.margin, 'percent'), growth: fmt(s.growth, 'percent'), share: fmt(s.contribution, 'percent') }))} columns={[{ key: 'segment', label: 'Segment' }, { key: 'revenue', label: 'Revenue' }, { key: 'operating', label: 'Operating income' }, { key: 'margin', label: 'Operating margin' }, { key: 'growth', label: 'Revenue YoY' }, { key: 'share', label: 'Revenue share' }]} /></div>
          <div className="bi-context-note">The visuals below show consolidated product and geographic data. Segment selections apply to segment detail above. Historical segment and offering data uses Microsoft’s FY2025 recast comparatives.</div>
          <div className="bi-grid bi-grid-wide"><Visual title="Revenue by product and service offering" subtitle="Consolidated · significant offerings reported in Note 18" rows={FACTS.filter(f => f.statement === 'offerings' && f.fiscal_year === year).map(f => ({ name: f.dimension, value: f.value }))} keys={[{ key: 'name', label: 'Offering' }, { key: 'value', label: 'Revenue (USD millions)' }]} className="bi-tall"><Plot rows={FACTS.filter(f => f.statement === 'offerings' && f.fiscal_year === year).map(f => ({ name: f.dimension.replace(' products and cloud services', '').replace('Server products and cloud services', 'Server & cloud').replace('Enterprise and partner services', 'Enterprise services').replace('Search and news advertising', 'Search & advertising'), value: f.value }))} x="name" series={[{ key: 'value', label: 'Revenue', color: COLORS[0] }]} unit={unit} horizontal /></Visual>
            <Visual title="Revenue by geography" subtitle="Consolidated · customer location, subject to filing conventions" rows={FACTS.filter(f => f.statement === 'geography' && f.fiscal_year === year).map(f => ({ name: f.dimension, value: f.value }))} keys={[{ key: 'name', label: 'Geography' }, { key: 'value', label: 'Revenue (USD millions)' }]} note="US revenue includes certain OEM and multinational billings per Note 18."><Ring rows={FACTS.filter(f => f.statement === 'geography' && f.fiscal_year === year).map(f => ({ name: f.dimension, value: f.value }))} unit={unit} /></Visual></div>
          <div className="bi-context-note">Microsoft Cloud revenue of {fmt(factValue(FACTS, year, 'cloud', 'revenue', 'Microsoft Cloud (overlapping measure)'))} is an overlapping disclosure across several offerings. It is not an additional segment and is not added to the totals.</div>
        </>}
        {sheet === 'balance' && <>
          <div className="bi-context-note">Balance sheet amounts are as of June 30, {year}. This report contains FY2024 and FY2025 closing balances. Borrowings exclude lease liabilities.</div>
          {kpis(['assets', 'liquid_assets', 'working_capital', 'current_ratio'])}
          {v('balance', 'assets') === null ? <div className="bi-data-card bi-no-data">FY2023 balance sheet data is outside this report extract. Select FY2024 or FY2025.</div> : <>
            <div className="bi-grid"><Visual title="Asset composition" subtitle={`June 30, ${year} · reported asset categories`} rows={['current_assets', 'property_equipment', 'lease_assets', 'equity_investments', 'goodwill', 'intangibles', 'other_long_assets'].map(key => ({ name: FACTS.find(f => f.statement === 'balance' && f.metric === key)!.label.split(',')[0], value: v('balance', key) }))} keys={[{ key: 'name', label: 'Asset category' }, { key: 'value', label: 'USD millions' }]}><Ring rows={['current_assets', 'property_equipment', 'lease_assets', 'equity_investments', 'goodwill', 'intangibles', 'other_long_assets'].map((key, i) => ({ name: ['Current assets', 'Property & equipment', 'Lease assets', 'Investments', 'Goodwill', 'Intangibles', 'Other long-term'][i], value: v('balance', key) }))} unit={unit} /></Visual>
              <Visual title="Funding structure" subtitle="Liabilities and equity reconcile to total assets" rows={[2024, 2025].filter(y => y <= year).map(y => ({ year: `FY${y}`, current: v('balance', 'current_liabilities', y), noncurrent: v('balance', 'liabilities', y)! - v('balance', 'current_liabilities', y)!, equity: v('balance', 'equity', y) }))} keys={[{ key: 'year', label: 'Year' }, { key: 'current', label: 'Current liabilities (USD millions)' }, { key: 'noncurrent', label: 'Noncurrent liabilities (USD millions)' }, { key: 'equity', label: 'Equity (USD millions)' }]}><Plot rows={[2024, 2025].filter(y => y <= year).map(y => ({ year: `FY${y}`, current: v('balance', 'current_liabilities', y), noncurrent: v('balance', 'liabilities', y)! - v('balance', 'current_liabilities', y)!, equity: v('balance', 'equity', y) }))} x="year" series={[{ key: 'current', label: 'Current liabilities', color: '#a7bdd0', stack: 'funding' }, { key: 'noncurrent', label: 'Noncurrent liabilities', color: COLORS[2], stack: 'funding' }, { key: 'equity', label: 'Equity', color: COLORS[0], stack: 'funding' }]} unit={unit} /></Visual></div>
            {kpis(['net_cash', 'debt', 'debt_equity', 'roe'])}
            <StatementTable facts={FACTS} year={year} group="balance" compare={compare} unit={unit} />
          </>}
        </>}
        {sheet === 'ratios' && <>
          {kpis(['cash_conversion', 'capex_intensity', 'roa', 'roe'])}
          <div className="bi-ratio-grid">{['Profitability', 'Liquidity', 'Leverage', 'Returns', 'Efficiency', 'Growth', 'Cash flow', 'Capital allocation', 'Business mix'].map(group => <section className="bi-data-card" key={group}><h3>{group}</h3>{ms.filter(m => m.group === group && m.format !== 'money' && m.format !== 'eps').map(m => <div className="bi-ratio-row" key={m.id} title={m.formula}><div><span>{m.label}</span><small>{m.formula}</small></div><strong>{fmt(m.value, m.format)}</strong></div>)}</section>)}</div>
          <div className="bi-context-note">Return on assets, return on equity and asset turnover use average opening and closing balances. Missing periods are shown as n/a. Valuation multiples, market returns, standalone Azure margins, monthly sales and forecasts require additional inputs and are not inferred from these statements.</div>
        </>}
        {sheet === 'sources' && <>
          <div className="bi-data-card"><div className="bi-data-heading"><div><p className="bi-overline">DATA PROVENANCE</p><h3>454 reported observations. Five official sources.</h3><p className="bi-subtitle">Prepared CSV extracted by Veritas from Microsoft’s public reports. Financial statement observations are not transaction records.</p></div><a className="bi-primary-action" href="/financial-analytics/microsoft/microsoft_fy2025_financials.csv" download><Download size={14} />Download source CSV</a></div>
            <div className="bi-source-list">{snapshot.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /><span>{source.title}</span><ArrowUpRight size={13} /></a>)}</div>
          </div>
          <div className="bi-grid"><div className="bi-data-card"><h3>Reconciliation checks · FY{year}</h3><p className="bi-subtitle">Differences in USD millions. Unavailable comparisons remain n/a.</p><div className="bi-checks">{checks.map(check => <div key={check.name}><span>{check.name}</span><strong className={check.difference !== null && Math.abs(check.difference) > .01 ? 'bi-down' : ''}>{check.difference === null ? 'n/a' : check.difference.toFixed(2)}</strong></div>)}</div></div><div className="bi-data-card bi-methodology"><h3>Period, units and calculation rules</h3><p>FY2025 runs from July 1, 2024 to June 30, 2025. Financial amounts in the source CSV remain in USD millions, EPS in USD per share, and share counts in millions.</p><p>Annual income and cash flow cover FY2023–FY2025. Balance sheets cover June 2024–June 2025. Quarterly income statements cover FY2024–FY2025 and use three-month figures, never cumulative year-to-date amounts.</p><p>Free cash flow is calculated as operating cash flow less cash additions to property and equipment. It excludes noncash lease additions. Borrowings exclude lease liabilities.</p><p>Segment and product comparatives use the FY2025 annual report’s recast presentation. Microsoft Cloud overlaps these categories. Cash dividends paid and stock repurchases use the cash flow statement, not declared dividends or repurchase authorization totals.</p><p>No live feed, exchange-rate conversion, forecasts or valuation inputs are included. n/a means a necessary input is absent or a denominator is zero.</p><a href="/financial-analytics/microsoft/sources.json" target="_blank" rel="noopener noreferrer">View source URLs and SHA-256 manifest <ExternalLink size={12} /></a></div></div>
          <div className="bi-data-card"><div className="bi-data-heading"><h3>Source explorer · FY{year}</h3><div className="bi-explorer-filters"><label><Search size={13} /><input aria-label="Search source observations" placeholder="Search metrics or dimensions" value={search} onChange={e => { setSearch(e.target.value); setSourcePage(1); }} /></label><select aria-label="Source statement" value={statement} onChange={e => { setStatement(e.target.value); setSourcePage(1); }}><option value="all">All statements</option>{[...new Set(FACTS.map(f => f.statement))].map(s => <option key={s} value={s}>{s}</option>)}</select><button onClick={() => download(`microsoft-fy${year}-source-selection.csv`, csvText(['Statement', 'Metric', 'Dimension', 'Period', 'Value', 'Unit', 'Source URL'], sourceRows.map(f => [f.statement, f.label, f.dimension, f.period, f.value, f.unit, f.source_url])))}><Download size={14} />Export selection</button></div></div>
            <div className="bi-table-scroll"><table className="bi-table"><thead><tr>{['Statement', 'Metric', 'Dimension', 'Period', 'Value', 'Unit', 'Source'].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{sourceRows.slice((activeSourcePage - 1) * 20, activeSourcePage * 20).map(f => <tr key={`${f.statement}-${f.metric}-${f.dimension}-${f.period}`}><td>{f.statement}</td><td>{f.label}</td><td>{f.dimension}</td><td>{f.period}</td><td className="numeric">{f.value.toLocaleString('en-US', { maximumFractionDigits: 2 })}</td><td>{f.unit}</td><td><a href={f.source_url} target="_blank" rel="noopener noreferrer" aria-label={`Source for ${f.label} ${f.period}`}><ExternalLink size={12} /></a></td></tr>)}</tbody></table>{!sourceRows.length && <p className="bi-context-note">No observations match these filters.</p>}</div>
            <div className="bi-pagination"><span>{sourceRows.length} observations · page {activeSourcePage} of {sourcePages}</span><div><button disabled={activeSourcePage <= 1} onClick={() => setSourcePage(activeSourcePage - 1)}>Previous</button><button disabled={activeSourcePage >= sourcePages} onClick={() => setSourcePage(activeSourcePage + 1)}>Next</button></div></div>
          </div>
        </>}
        <footer className="bi-report-footer"><span>Microsoft FY2025 annual report · Historical filing snapshot</span><button onClick={() => setSheet('sources')}><span className={`bi-source-dot ${!relevantChecksPass ? 'bi-check-failed' : ''}`} />{relevantChecksPass ? `${relevantChecks.length} reconciliations agree` : 'Reconciliation differences found'}<ChevronRight size={12} /></button></footer>
      </article>
      {filters && <aside className="bi-filters"><div><h2><Filter size={14} />Filters</h2><button title="Close filters" aria-label="Close filters" onClick={() => { setFilters(false); setFiltersTouched(true); }}><X size={14} /></button></div><p>Filters on all report pages</p><section><h3>Company</h3><span className="bi-locked-filter">Microsoft Corporation</span><small>Public financial statements</small></section><section><h3>Fiscal year</h3>{[2025, 2024, 2023].map(y => <label className="bi-year-option" key={y}><input type="radio" name="fiscal-year" checked={year === y} onChange={() => { setYear(y); setSourcePage(1); }} /><span>FY{y}</span><small>Jun 30, {y}</small></label>)}</section><section><h3>Comparison</h3><label className="bi-comparison"><input type="checkbox" checked={compare} onChange={e => setCompare(e.target.checked)} />Show prior-year comparison</label><small>Changes KPI comparisons, statement columns and quarterly revenue comparison.</small></section>{sheet === 'mix' && <section><h3>Business segment</h3><select aria-label="Business segment" value={segment} onChange={e => setSegment(e.target.value)}>{['All segments', ...SEGMENTS].map(s => <option key={s}>{s}</option>)}</select><small>Filters segment detail only. Geography and product offerings stay consolidated.</small></section>}<button className="bi-reset" onClick={() => { setYear(2025); setUnit('B'); setCompare(true); setSegment('All segments'); setSearch(''); setStatement('all'); setSourcePage(1); }}><RotateCcw size={13} />Reset filters</button><div className="bi-filter-info"><Focus size={18} /><h3>Explore any visual</h3><p>Inspect underlying values, export CSV, or open focus mode from the visual header.</p></div><a className="bi-dataset-link" href="/financial-analytics/microsoft/microsoft_fy2025_financials.csv" download><Download size={13} />Download financial dataset</a></aside>}
    </div>
    <nav className="bi-sheet-tabs" aria-label="Workbook sheets">{SHEETS.map((s, index) => <button key={s.id} aria-current={sheet === s.id ? 'page' : undefined} className={sheet === s.id ? 'active' : ''} onClick={() => setSheet(s.id)}><span>{String(index + 1).padStart(2, '0')}</span>{s.short}</button>)}<span className="bi-sheet-count">{SHEETS.findIndex(s => s.id === sheet) + 1} / 8 pages</span></nav>
  </div>;
}

function StatementTable({ facts, year, group, compare, unit }: { facts: Fact[]; year: number; group: string; compare: boolean; unit: 'B' | 'M' }) {
  const rows = facts.filter(f => f.statement === group && f.fiscal_year === year);
  return <section className="bi-data-card"><div className="bi-data-heading"><div><h3>{group === 'income' ? 'Income statement' : group === 'cash' ? 'Cash flow statement' : 'Balance sheet'} detail</h3><p className="bi-subtitle">Reported values · change % shown for positive prior-year bases · source icons open the filing</p></div></div><div className="bi-table-scroll"><table className="bi-table bi-financial-table"><thead><tr><th>Line item</th><th>FY{year}</th>{compare && <><th>FY{year - 1}</th><th>Change</th><th>Change %</th></>}<th>Source</th></tr></thead><tbody>{rows.map(f => {
    const before = factValue(facts, year - 1, group, f.metric), delta = before === null ? null : f.value - before;
    const format = f.unit === 'USD/share' ? 'eps' : 'money';
    const value = (n: number | null) => f.unit === 'shares_millions' ? n === null ? 'n/a' : `${n.toLocaleString('en-US')}M shares` : formatMeasure(n, format, unit);
    return <tr key={f.metric} className={['revenue', 'gross_profit', 'operating_income', 'net_income', 'assets', 'equity', 'liabilities', 'current_assets', 'current_liabilities', 'operating_cash', 'financing_cash', 'investing_cash', 'ending_cash'].includes(f.metric) ? 'bi-total-row' : ''}><td>{f.label}{['basic_eps', 'diluted_eps'].includes(f.metric) ? ' (per share)' : ['basic_shares', 'diluted_shares'].includes(f.metric) ? ' (weighted average shares)' : ''}</td><td className="numeric">{value(f.value)}</td>{compare && <><td className="numeric">{value(before)}</td><td className="numeric">{value(delta)}</td><td className="numeric">{formatMeasure(growth(f.value, before), 'percent')}</td></>}<td><a href={f.source_url} target="_blank" rel="noopener noreferrer" aria-label={`Open filing for ${f.label}`}><ExternalLink size={12} /></a></td></tr>;
  })}</tbody></table></div></section>;
}
