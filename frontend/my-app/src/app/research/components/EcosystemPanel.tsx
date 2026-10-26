'use client';

import {formatFinancialAmount} from '@/lib/financial-overview';
import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Download, ExternalLink, GitBranch, LoaderCircle, Play, RefreshCw, ShieldCheck } from 'lucide-react';
import type { ResearchCase } from '@/lib/api/research';
import { ecosystemConfig, getEcosystemRun, listEcosystemRuns, reviewEcosystem, runEcosystemScenario, startEcosystemRun,
  type EcosystemConfig, type EcosystemRun, type EcosystemReview } from '@/lib/api/ecosystem';
import { ErrorNotice, errorText, formatTimestamp } from './ResearchUI';
import './ecosystem.css';

const active = (run: EcosystemRun | null) => !!run && ['queued','running'].includes(run.status);
function Badge({ value, synthetic = false }: { value: string; synthetic?: boolean }) {
  return <span className={`eco-badge eco-${value.toLowerCase()}`}>{synthetic ? 'Scenario · ' : ''}{value.replaceAll('_',' ')}</span>;
}
function ageAt(source: string | null, asOf: string) {
  if (!source) return 'Publication date unknown';
  const days = Math.floor((Date.parse(asOf) - Date.parse(source)) / 86400000);
  return days < 0 ? 'Published after investigation as-of date' : `${days} days old at investigation as-of date`;
}
export default function EcosystemPanel({ caseId, researchCase }: { caseId: string; researchCase: ResearchCase }) {
  const [config, setConfig] = useState<EcosystemConfig | null>(null);
  const [runs, setRuns] = useState<EcosystemRun[]>([]);
  const [run, setRun] = useState<EcosystemRun | null>(null);
  const [target, setTarget] = useState(researchCase.company_name);
  const [asOf, setAsOf] = useState(researchCase.research_as_of_date || '2025-07-30');
  const [maxParties, setMaxParties] = useState(5);
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reviewer, setReviewer] = useState('');
  const [notes, setNotes] = useState('');
  const [ack, setAck] = useState(false);
  const [severity, setSeverity] = useState('0.5');
  const [unmitigated, setUnmitigated] = useState('0.5');
  const [assumptions, setAssumptions] = useState('');
  const [sourceFocus, setSourceFocus] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [configuration, history] = await Promise.all([ecosystemConfig(caseId), listEcosystemRuns(caseId)]);
      setConfig(configuration); setRuns(history);
      setRun(previous => previous ? history.find(r => r.id === previous.id) ?? history[0] ?? null : history[0] ?? null);
    } catch (cause) { setError(errorText(cause)); }
    finally { setLoading(false); }
  }, [caseId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!run || !active(run)) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try { const next = await getEcosystemRun(caseId,run.id); if (!cancelled) { setRun(next); setError(''); } }
      catch (cause) { if (!cancelled) setError(`Progress refresh failed. Use Refresh to reconnect. ${errorText(cause)}`); }
    }, 700);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [caseId,run]);
  const selectedId = run?.relationships.some(r => r.id === selected) ? selected : run?.relationships[0]?.id || '';
  const edge = run?.relationships.find(r => r.id === selectedId);
  const finding = run?.findings.find(f => f.relationship_id === selectedId);
  const exposure = run?.exposures.find(e => e.relationship_id === selectedId);
  const assessment = run?.assessments.find(a => a.entity_id === finding?.counterparty_id);
  const entityName = (id: string) => run?.entities.find(e => e.id === id)?.name ?? id;
  const sourceName = (id: string) => run?.sources.find(s => s.id === id)?.title ?? `Missing source: ${id}`;
  async function start(demo: boolean) {
    setBusy(true); setError(''); setNotice(''); setSelected(''); setSourceFocus('');
    try {
      const date = demo ? config?.demo_as_of_date || '2025-07-30' : asOf;
      if (demo) setAsOf(date);
      const next = await startEcosystemRun(caseId,{target, as_of_date:date,max_depth:1,max_counterparties:maxParties,retry_budget:2},demo);
      setRun(next); setRuns(previous => [next,...previous]);
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  }
  async function selectRun(id: string) {
    setBusy(true); setError(''); setSelected(''); setSourceFocus('');
    try { setRun(await getEcosystemRun(caseId,id)); } catch (cause) { setError(errorText(cause)); } finally { setBusy(false); }
  }
  async function review(decision: EcosystemReview['decision']) {
    if (!run) return;
    setBusy(true); setError('');
    try {
      setRun(await reviewEcosystem(caseId,run.id,{expected_revision:run.revision,decision,reviewer_label:reviewer,reviewer_notes:notes,acknowledge_limitations:ack}));
      setNotice('Review saved. Evidence support verdicts remain unchanged.'); setNotes(''); setAck(false);
    } catch (cause) { setError(errorText(cause)); } finally { setBusy(false); }
  }
  async function scenario() {
    if (!run || !edge) return;
    setBusy(true); setError('');
    try {
      setRun(await runEcosystemScenario(caseId,run.id,{relationship_id:edge.id,disruption_severity:severity,unmitigated_fraction:unmitigated,assumption_notes:assumptions}));
      setNotice('Scenario inputs and result saved. The current report requires human review again.');
    } catch (cause) { setError(errorText(cause)); } finally { setBusy(false); }
  }
  function exportReport() {
    if (!run) return;
    const text = [
      `# Ecosystem risk investigation: ${entityName(run.target_entity_id || '')}`,
      `As of ${run.request.as_of_date}. Mode: ${run.mode}. Status: ${run.status}. Review: ${run.review_state}. Source state: ${run.source_state}.`,
      'Research snapshot; human review state is shown above. No trades, loss predictions or live monitoring.',
      ...run.findings.flatMap(f => [`\n## ${entityName(f.counterparty_id)} ${f.hypothetical ? '(SYNTHETIC SCENARIO)' : ''}`,
        `Historical impact: ${f.observed_impact || 'Not established'}.`,
        `Relationship evidence: ${f.evidence_status}; counterparty distress: ${f.counterparty_distress}; target materiality: ${f.target_materiality}; scenario risk: ${f.scenario_risk}; confirmed alert: ${f.confirmed_alert}.`,
        `Event: ${f.triggering_event}`,`Mechanism: ${f.causal_mechanism}`,`Target consequence: ${f.target_consequence}`,`Mitigants: ${f.mitigants.join(' ') || 'Unknown'}`,
        `Assumptions: ${f.assumptions.join(' ')}`,`Next checks: ${f.disconfirming_checks.join(' ')}`,f.quantification_note,`Evidence: ${f.evidence_ids.join(', ')}`]),
      '\n## Reported financial observations', ...run.metrics.map(m => `${entityName(m.entity_id)}: ${m.metric} = ${m.value} ${m.currency} ${m.units}; ${m.period_start || m.period_end} to ${m.period_end}; ${m.reporting_basis}; ${m.document_version}; source=${m.source_id}; ${m.provenance}`),
      '\n## Financial tools and provenance', ...run.assessments.flatMap(a => [`${entityName(a.entity_id)}: ${a.distress}; synthetic=${a.synthetic}.`, ...a.observations, ...a.calculations.map(c => `${c.tool}: ${c.result} ${c.unit}; formula: ${c.formula}; ${c.provenance}\nInputs: ${JSON.stringify(c.inputs)}`), ...a.limitations]),
      '\n## Scenario calculations', ...run.scenarios.map(s => `${s.status}: ${s.label}; ${s.revenue_at_risk ?? 'Unavailable'} ${s.currency ?? ''}; ${s.explanation}; formula=${s.formula}; base=${s.affected_revenue}; base inputs=${JSON.stringify(s.base_inputs || {})}; sources=${s.source_ids.join(', ')}; user assumptions: ${s.assumption_notes}; severity=${s.disruption_severity}, unmitigated=${s.unmitigated_fraction}`),
      '\n## Uncertainties and limitations',...run.questions,...run.uncertainties,...run.limitations,
      '\n## Sources',...run.sources.map(s => `${s.id}: ${s.title}; ${s.kind}; published ${s.published_at || 'unknown'}; retrieved ${s.retrieved_at}; ${s.document_version}; ${s.document_page}; ${s.url || 'Synthetic/local source'}; SHA-256 ${s.content_hash}\n${s.text}`),
      '\n## Review history',...run.reviews.map(r => `${r.created_at}: ${r.reviewer_label} ${r.decision}; acknowledged=${r.acknowledge_limitations}; ${r.reviewer_notes}`),
      '\n## Execution trace',...run.events.map(e => `${e.created_at}: ${e.stage} ${e.transition} ${e.message}`),
    ].join('\n\n');
    const url = URL.createObjectURL(new Blob([text],{type:'text/markdown;charset=utf-8'}));
    const a = document.createElement('a');a.href=url;a.download=`ecosystem-${run.id}.md`;a.click();URL.revokeObjectURL(url);
  }
  const realCase = !!run?.entities.some(e => e.id === 'spirit');
  const terminal = !!run && ['completed','partial'].includes(run.status);
  return <div className="eco-panel">
    <header className="eco-heading"><div><p className="eco-overline"><GitBranch size={14}/>CORPORATE ECOSYSTEM INTELLIGENCE</p><h2>Ecosystem Risk</h2><p>Understand how a connected company’s distress could reach the target.</p></div><button className="rl-secondary" onClick={() => void load()} disabled={busy || loading}><RefreshCw size={14}/>Refresh</button></header>
    {error && <ErrorNotice message={error}/>}{notice && <p role="status" className="eco-notice">{notice}</p>}
    <section className="rl-card eco-controls"><div><label>Target company<input value={target} onChange={e=>setTarget(e.target.value)} maxLength={240}/></label><label>Investigation as of<input type="date" value={asOf} onChange={e=>setAsOf(e.target.value)}/></label><label>Direct counterparties<select value={maxParties} onChange={e=>setMaxParties(Number(e.target.value))}>{[1,2,3,4,5].map(n=><option key={n} value={n}>Up to {n}</option>)}</select></label></div><div className="eco-control-actions"><button className="rl-primary" disabled={busy||loading||active(run)||!target.trim()||!asOf} onClick={()=>void start(false)}><Play size={14}/>Investigate curated evidence</button><button className="rl-secondary" disabled={busy||loading||active(run)||!config?.demo_enabled||config?.synthetic_demo_available===false||!target.trim()} onClick={()=>void start(true)}>Load historical scenario demo</button><span>One hop · maximum 5 counterparties · maximum 2 targeted retries</span></div><p className="eco-muted">Supported curated targets: {config?.supported_targets.join(', ') || 'loading…'}. The historical demo uses 30 July 2025, a documented subsidiary, and three explicitly fictional counterparties.{config && !config.demo_enabled && ' Synthetic fixture loading is disabled on this server.'}</p></section>
    {runs.length>0 && <label className="eco-run-picker">Saved investigations<select value={run?.id||''} onChange={e=>void selectRun(e.target.value)} disabled={busy}>{runs.map(r=><option key={r.id} value={r.id}>{formatTimestamp(r.created_at)} · {r.mode} · {r.id.slice(0,8)}</option>)}</select></label>}
    {loading && <p role="status" className="eco-muted">Loading saved investigations…</p>}
    {!loading && !run && <div className="eco-empty rl-card"><GitBranch size={35}/><h3>Investigate the connections around this company</h3><p>Start a curated investigation, or load the historical scenario demo. Original company analysis and ecosystem exposure stay separate.</p></div>}
    {run && <>
      <div className="eco-run-status"><div><Badge value={run.status}/><Badge value={run.review_state}/><span>As of {run.request.as_of_date} · revision {run.revision}</span></div><button className="rl-secondary" onClick={exportReport} disabled={!terminal}><Download size={14}/>Export auditable report</button></div>
      {active(run) && <p role="status" className="eco-notice"><LoaderCircle className="eco-spin" size={15}/>Investigation running. Progress below reflects saved stages.</p>}
      {run.errors.map((e,i)=><ErrorNotice key={i} message={e}/>)}
      {run.questions.length>0 && <section className="rl-card eco-gap"><h3>Analyst input needed</h3>{run.questions.map(q=><p key={q}>{q}</p>)}</section>}
      {run.source_state==='stale' && <p role="alert" className="eco-warning">Case evidence changed or was removed after this snapshot. Historical findings remain visible, but current approval and scenario calculation are blocked. Start a new investigation.</p>}
      {run.mode==='demo' && <p className="eco-demo-note"><ShieldCheck size={17}/><span><strong>Historical scenario demonstration.</strong> Entities marked Demo, their distress events, exposure attributes and financials are synthetic. They describe no actual Microsoft supplier or logistics event. Machine evidence verdicts stay unresolved.</span></p>}
      {run.relationships.length>0 && <>
        <div className="eco-summary">{[['Direct relationships',run.relationships.length],['Documented relationships',run.relationships.filter(r=>r.status==='VERIFIED').length],[realCase?'Documented historical impacts':'Hypothetical elevated paths',realCase?run.findings.filter(f=>f.observed_impact).length:run.findings.filter(f=>f.hypothetical&&f.scenario_risk==='ELEVATED').length],['Confirmed exposure warnings',run.findings.filter(f=>f.confirmed_alert).length]].map(([label,value])=><article className="rl-card" key={String(label)}><p>{label}</p><strong>{value}</strong></article>)}</div>
        {realCase && <section className="rl-card eco-real-context">
          <p className="eco-overline">HISTORICAL CASE · FY2024 · EVIDENCE AVAILABLE BY 28 FEBRUARY 2025</p>
          <h3>What this case establishes</h3>
          <p>Spirit had two major customers with documented revenue concentrations. The Boeing strike led Spirit to announce furloughs and cost restrictions. Spirit also had its own financial difficulties; its annual loss cannot be attributed entirely to the strike.</p>
          <div className="eco-concentrations">{run.exposures.filter(e=>e.facts.dependency_percent).map(e=><div key={e.relationship_id}><span>{entityName(run.relationships.find(r=>r.id===e.relationship_id)?.target_entity_id||'')} · approximately {e.facts.dependency_percent}% of Spirit revenue</span><div role="meter" aria-label="Share of Spirit FY2024 revenue" aria-valuenow={Number(e.facts.dependency_percent)} aria-valuemin={0} aria-valuemax={100}><i style={{width:`${e.facts.dependency_percent}%`}}/></div></div>)}</div>
          <p className="eco-warning">This is a historical reconstruction. The strike had ended by the cutoff, and the announced Boeing acquisition was still pending. Customer revenue shares do not measure Boeing or Airbus procurement dependence. Sources are curated summaries with disclosure links; each investigation rechecks saved evidence.</p>
        </section>}
        {realCase && <section className="rl-card eco-financial-evidence"><h3>Reported financial evidence</h3><p className="eco-muted">FY2024 · all amounts in millions of the stated currency. Preserve the reporting basis; USD and EUR are not combined. Select a source to inspect its saved summary.</p>
          {run.entities.map(entity=>{const a=run.assessments.find(item=>item.entity_id===entity.id);return <div key={entity.id} className="eco-financial-company"><div className="eco-section-head"><h4>{entity.name}</h4><span>Financial pressure <Badge value={a?.distress||'UNKNOWN'}/></span></div>{a?.observations.map(t=><p className="eco-muted" key={t}>{t}</p>)}{a?.evidence_ids?.map(id=><button key={id} className="eco-text-button" onClick={()=>setSourceFocus(id)}>{sourceName(id)}</button>)}<div className="eco-table-wrap"><table><thead><tr><th>Reported measure</th><th>Value (M/B)</th><th>Basis / period</th><th>Source</th></tr></thead><tbody>{run.metrics.filter(m=>m.entity_id===entity.id).map(m=><tr key={m.id}><td>{m.metric.replaceAll('_',' ')}</td><td>{formatFinancialAmount(m.value,m.currency,m.units)}</td><td>{m.reporting_basis} · {m.period}</td><td><button className="eco-text-button" onClick={()=>setSourceFocus(m.source_id)}>{sourceName(m.source_id)}</button></td></tr>)}</tbody></table></div>{a?.calculations.map(c=><p key={c.tool}><strong>{c.tool.replaceAll('_',' ')}: {c.display_result} {c.unit}</strong> · {c.formula}</p>)}{a?.limitations.map(t=><p className="eco-muted" key={t}>{t}</p>)}</div>;})}
        </section>}
        <section className="rl-card eco-network"><div className="eco-section-head"><div><h3>One-hop relationship map</h3><p>Solid = documented relationship. Dashed = synthetic or unverified. Arrows show relationship direction, not guaranteed financial loss.</p></div><span>{run.relationships.length} connections</span></div><div className="eco-target"><span>TARGET COMPANY</span><strong>{entityName(run.target_entity_id||'')}</strong><p>{run.assessments.find(a=>a.entity_id===run.target_entity_id)?.calculations.map(c=>`${c.tool.replaceAll('_',' ')} ${c.display_result}${c.unit==='%'?'%':'×'}`).join(' · ')||'Standalone financial evidence is incomplete'}</p></div><div className="eco-connectors"><span/><span>DIRECT CONNECTIONS</span><span/></div><div className="eco-nodes">{run.relationships.map(r=>{
          const party = r.source_entity_id===run.target_entity_id?r.target_entity_id:r.source_entity_id;
          const f = run.findings.find(item=>item.relationship_id===r.id);
          return <button key={r.id} aria-pressed={selectedId===r.id} className={`eco-node ${r.status==='VERIFIED'?'documented':'unverified'} ${selectedId===r.id?'selected':''}`} onClick={()=>{setSelected(r.id);setSourceFocus('');}}><span className="eco-node-type">{r.relationship_type.replaceAll('_',' ')} {r.source_entity_id===run.target_entity_id?' · Target → counterparty':' · Counterparty → target'}</span><strong>{entityName(party)}</strong><Badge value={f?.scenario_risk||'UNKNOWN'} synthetic={r.synthetic}/>{f?.observed_impact&&<span className="eco-badge eco-verified">HISTORICAL IMPACT DOCUMENTED</span>}<span className="eco-muted">Evidence: {r.status}</span></button>;
        })}</div></section>
        <section className="rl-card eco-relationship-table"><h3>Relationship register</h3><div className="eco-table-wrap"><table><thead><tr>{['Relationship direction','Type','Evidence','Validity','Exposure','Inspect'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{run.relationships.map(r=><tr key={r.id}><td>{entityName(r.source_entity_id)} <ArrowRight size={12}/> {entityName(r.target_entity_id)}{r.synthetic&&<small>Synthetic scenario only</small>}</td><td>{r.relationship_type.replaceAll('_',' ')}</td><td><Badge value={r.status}/></td><td>{r.effective_from||'Start unknown'} – {r.effective_to||'End unknown'}<small>Last disclosed: {r.last_confirmed||'Unknown'}</small></td><td>{run.exposures.find(e=>e.relationship_id===r.id)?.materiality||'UNKNOWN'}</td><td><button className="eco-text-button" onClick={()=>{setSelected(r.id);setSourceFocus('');}}>View path</button></td></tr>)}</tbody></table></div></section>
        {edge && <div className="eco-detail-grid"><section className="rl-card eco-path"><div className="eco-section-head"><h3>{entityName(finding?.counterparty_id||'')} → target</h3><Badge value={edge.status}/></div><p className="eco-muted">{edge.rationale}</p><div className="eco-risk-dimensions"><div><span>Counterparty distress</span><Badge value={finding?.counterparty_distress||'UNKNOWN'}/></div><div><span>Target exposure</span><Badge value={finding?.target_materiality||'UNKNOWN'}/></div><div><span>{finding?.observed_impact?'Active disruption warning':'Scenario risk'}</span><Badge value={finding?.scenario_risk||'UNKNOWN'} synthetic={edge.synthetic}/></div></div>
          {finding?.observed_impact && <div className="eco-notice"><strong>Documented historical operational response</strong><p>{finding.observed_impact}</p></div>}
          {finding && <><ol className="eco-causal-chain">{[['Triggering event',finding.triggering_event],['Dependency and materiality',exposure?.basis||'Unknown'],['Transmission mechanism',finding.causal_mechanism],['Target consequence',finding.target_consequence],['Mitigants',finding.mitigants.join(' ')||'No source-backed mitigants are established.']].map(([label,text])=><li key={label}><span>{label}</span><p>{text}</p></li>)}</ol><p className="eco-warning">{finding.quantification_note}</p><details><summary>Assumptions and disconfirming checks</summary>{finding.assumptions.map(a=><p key={a}>{a}</p>)}<h4>Next checks</h4>{finding.disconfirming_checks.map(c=><p key={c}>{c}</p>)}</details></>}
          <h4>Evidence supporting this path</h4><div className="eco-evidence-buttons">{(finding?.evidence_ids||edge.source_ids).map(id=><button key={id} onClick={()=>setSourceFocus(id)} className={sourceFocus===id?'selected':''}>{sourceName(id)}</button>)}</div><p className="eco-muted">Dependency percentage: {exposure?.facts.dependency_percent ? `${exposure.facts.dependency_percent}% (approximately)` : 'Unknown; no percentage inferred'}. {exposure?.facts.dependency_basis}</p>
        </section><aside className="rl-card eco-evidence"><h3>Source inspector</h3><label>Evidence<select value={sourceFocus || edge.source_ids[0] || ''} onChange={e=>setSourceFocus(e.target.value)}>{run.sources.map(s=><option key={s.id} value={s.id}>{s.title}</option>)}</select></label>{(()=>{const source=run.sources.find(s=>s.id===(sourceFocus||edge.source_ids[0]));return source?<><div className="eco-source-meta"><Badge value={source.kind}/><strong>{source.publisher}</strong><span>Published {source.published_at||'unknown'} · {ageAt(source.published_at,run.request.as_of_date)}</span><span>Retrieved {formatTimestamp(source.retrieved_at)}</span><span>{source.document_page}</span><span>Version: {source.document_version}</span>{source.url&&/^https?:\/\//i.test(source.url)&&<a href={source.url} target="_blank" rel="noopener noreferrer">Open original disclosure <ExternalLink size={12}/></a>}</div><pre>{source.text}</pre><p className="eco-hash">SHA-256 {source.content_hash}</p></>:<p>Source unavailable.</p>;})()}
          {assessment && <details><summary>Financial investigation · {assessment.distress}</summary>{assessment.observations.map(t=><p key={t}>{t}</p>)}{assessment.calculations.map(c=><div className="eco-receipt" key={c.tool}><strong>{c.tool.replaceAll('_',' ')}: {c.display_result} {c.unit}</strong><p>{c.formula}</p><p>{c.provenance}</p>{Object.values(c.inputs).map(m=><p key={m.id}>{m.metric}: {formatFinancialAmount(m.value,m.currency,m.units)} · {m.period} · {m.reporting_basis} · {m.document_version}{m.synthetic?' · SYNTHETIC':''}</p>)}</div>)}{assessment.limitations.map(t=><p className="eco-muted" key={t}>{t}</p>)}</details>}
        </aside></div>}
        {edge && terminal && <section className="rl-card eco-scenario"><div><h3>Assumption-based stress scenario</h3><p>For a documented customer concentration, annual sensitivity = matching annual revenue × approximate customer share × disruption severity × unmitigated fraction. This is a derived annual customer bucket, not reported strike losses. Other paths require disclosed affected revenue; missing inputs produce an unavailable result.</p></div><div className="eco-scenario-fields"><label>Disruption severity (0–1)<input type="number" min="0" max="1" step="0.01" value={severity} onChange={e=>setSeverity(e.target.value)}/></label><label>Unmitigated fraction (0–1)<input type="number" min="0" max="1" step="0.01" value={unmitigated} onChange={e=>setUnmitigated(e.target.value)}/></label><label>Basis for your assumptions<textarea value={assumptions} onChange={e=>setAssumptions(e.target.value)} maxLength={2000} placeholder="Explain the scenario assumptions; these are not forecasts."/></label></div><button className="rl-secondary" disabled={busy||!assumptions.trim()||!severity||!unmitigated||run.source_state==='stale'} onClick={()=>void scenario()}>Evaluate and save scenario</button>{run.scenarios.filter(s=>s.relationship_id===edge.id).map(s=><article key={s.id}><Badge value={s.status}/><strong>{s.status==='calculated'?formatFinancialAmount(s.revenue_at_risk,s.currency,s.units):'Financial impact unavailable'}</strong><p>{s.explanation}</p><p className="eco-muted">{s.formula} · Base: {formatFinancialAmount(s.affected_revenue,s.currency,s.units)}{s.base_inputs?.customer_share_percent ? ` · approximate customer share ${s.base_inputs.customer_share_percent}%` : ''}</p><p className="eco-muted">{s.label} · severity {s.disruption_severity} · unmitigated {s.unmitigated_fraction} · {s.assumption_notes}</p></article>)}</section>}
      </>}
      <section className="rl-card eco-audit"><div className="eco-section-head"><h3><ShieldCheck size={17}/>Evidence audit and open questions</h3><span>{run.retry_count} / {run.request.retry_budget} targeted retries</span></div>{run.uncertainties.map((t,i)=><p key={i} className="eco-audit-issue">{t}</p>)}<details><summary>Scope and retained limitations</summary>{run.limitations.map((t,i)=><p key={i}>{t}</p>)}</details></section>
      {terminal && <section className="rl-card eco-review"><div className="eco-section-head"><h3><CheckCircle2 size={17}/>Human review</h3><Badge value={run.review_state}/></div><p>Review applies to this report revision. It does not turn a synthetic or unresolved relationship into verified evidence. Reviewer labels are not authenticated accounts.</p><div className="eco-review-fields"><label>Reviewer label<input value={reviewer} onChange={e=>setReviewer(e.target.value)} maxLength={120}/></label><label>Review notes<textarea value={notes} onChange={e=>setNotes(e.target.value)} maxLength={4000}/></label></div><label className="eco-checkbox"><input type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)}/>I acknowledge the retained uncertainties, scenario assumptions and limitations.</label><div className="eco-control-actions"><button className="rl-primary" disabled={busy||!reviewer.trim()||!notes.trim()||!ack||run.source_state==='stale'} onClick={()=>void review('APPROVE')}>Approve research</button><button className="rl-secondary" disabled={busy||!reviewer.trim()||!notes.trim()} onClick={()=>void review('REJECT')}>Reject</button><button className="rl-secondary" disabled={busy||!reviewer.trim()||!notes.trim()} onClick={()=>void review('REQUEST_CHANGES')}>Request changes</button></div>{run.reviews.map(r=><article key={r.id} className="eco-review-record"><Badge value={r.decision}/><span>{r.reviewer_label} · {formatTimestamp(r.created_at)}</span><p>{r.reviewer_notes}</p></article>)}</section>}
      <details className="rl-card eco-trace" open={active(run)}><summary>Investigation execution trace · {run.events.length} saved events</summary>{run.events.map(e=><div key={e.id}><span>{formatTimestamp(e.created_at)}</span><strong>{e.stage.replaceAll('_',' ')} · {e.transition}</strong><p>{e.message}</p></div>)}</details>
    </>}
  </div>;
}
