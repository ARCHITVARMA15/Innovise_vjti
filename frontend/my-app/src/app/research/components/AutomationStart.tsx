'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {Sparkles} from 'lucide-react';
import {automationConfig,startAutomation,type AutomationRun} from '@/lib/api/automation';
import type {CalculationType} from '@/lib/api/financials';
import {ErrorNotice,errorText} from './ResearchUI';
import './automation.css';
function localDate(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
export default function AutomationStart({caseId,onStarted}:{caseId?:string;onStarted:(run:AutomationRun)=>void}){
 const [query,setQuery]=useState(''),[asOf,setAsOf]=useState(localDate),[company,setCompany]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[configured,setConfigured]=useState<boolean|null>(null);
 const [metrics,setMetrics]=useState<CalculationType[]>(['revenue_growth','net_profit_margin','current_ratio']);
 const intent=useRef<{signature:string;id:string}|null>(null);
 useEffect(()=>{void automationConfig().then(c=>setConfigured(c.configured)).catch(()=>setConfigured(null));},[]);
 async function submit(event:FormEvent){event.preventDefault();setBusy(true);setError('');
  const signature=JSON.stringify({query,asOf,company,metrics});if(intent.current?.signature!==signature)intent.current={signature,id:crypto.randomUUID()};
  try{onStarted(await startAutomation({query,as_of_date:asOf,company:company||null,request_id:intent.current.id,metrics},caseId));}
  catch(e){setError(errorText(e));}finally{setBusy(false);}
 }
 return <section className="rl-card p-5 md:p-6 auto-start"><div className="flex items-center gap-2"><Sparkles size={19} className="text-[#006591]"/><h2 className="text-xl font-bold">Ask Dexter</h2><span className="auto-label">SEC ANNUAL FILINGS</span></div><p className="rl-muted mt-2">Ask a financial question. Dexter locates official 10-Ks, prepares source-linked candidates, and pauses for your review before calculation and a draft report.</p>
 <form className="mt-4 space-y-4" onSubmit={submit}><label>Research question<textarea value={query} onChange={e=>setQuery(e.target.value)} required minLength={3} maxLength={4000} rows={3} placeholder="Analyse Microsoft’s FY2025 financial performance compared with FY2024."/></label>
 <div className="grid gap-4 md:grid-cols-2"><label>Research as of<input type="date" required value={asOf} onChange={e=>setAsOf(e.target.value)}/><span className="rl-muted">Only filings published on or before this date are eligible.</span></label><label>Company ticker or CIK (optional)<input value={company} maxLength={200} onChange={e=>setCompany(e.target.value)} placeholder="e.g. MSFT, or an exact SEC CIK"/><span className="rl-muted">Useful for ambiguous names or a blocked ticker-mapping endpoint.</span></label></div>
 <fieldset><legend className="text-sm font-semibold">Requested scope</legend><div className="mt-2 flex flex-wrap gap-4">{(['revenue_growth','net_profit_margin','current_ratio','debt_to_equity'] as CalculationType[]).map(metric=><label key={metric} className="auto-checkbox"><input type="checkbox" checked={metrics.includes(metric)} onChange={e=>setMetrics(e.target.checked?[...metrics,metric]:metrics.filter(m=>m!==metric))}/>{metric.replaceAll('_',' ')}{metric==='debt_to_equity'?' (conditional)':''}</label>)}</div><p className="rl-muted mt-2">Margins and ratios are separate operations for each year; growth compares the two years. Debt/equity is unavailable in this automation slice; calculate it in manual Financials using reviewed debt evidence. A single fiscal year proposes the preceding year as its comparison.</p></fieldset>
 {configured===false&&<p className="auto-warning">SEC_USER_AGENT needs an application name and real contact email in backend/.env. Manual research remains available.</p>}{error&&<ErrorNotice message={error}/>}
 <button className="rl-primary" disabled={busy||!metrics.length}>{busy?'Starting automation…':'Ask Dexter — find official sources'}</button><p className="rl-muted">US SEC 10-Ks only. Retrieved text is evidence data; it cannot authorize actions or confirm facts. Existing manual workflows remain available.</p></form></section>;
}
