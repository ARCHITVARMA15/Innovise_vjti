'use client';
import Link from 'next/link';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Radio,RotateCcw,Send} from 'lucide-react';
import {getWatch,publishDemo,type WatchEvent,type WatchView} from '@/lib/api/analyst-watch';
const scenarios=[
  {id:'earnings_shock',name:'Earnings shock',description:'Q2 revenue USD 75m; net loss USD 3m; current ratio 0.95. Four default monitoring rules breach.'},
  {id:'positive_results',name:'Positive results',description:'Q2 revenue USD 120m; net income USD 18m; current ratio 1.80. No default adverse-change rule breaches.'},
  {id:'liquidity_deterioration',name:'Liquidity deterioration',description:'Revenue and net income hold steady; current assets fall to USD 90m against USD 100m of current liabilities.'},
  {id:'stable',name:'Stable quarter',description:'Q2 values match the baseline. No default monitoring threshold is breached.'},
];
export default function DemoConsole(){
  const [data,setData]=useState<WatchView|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<WatchEvent|null>(null),[replay,setReplay]=useState(false);
  const [pending,setPending]=useState<{scenario:string;event_id:string;replay:boolean}|null>(null);
  const inFlight=useRef(false);
  const load=useCallback(async()=>{try{setData(await getWatch());}catch(e){setError(String(e));}},[]);
  useEffect(()=>{void load();const t=window.setInterval(()=>void load(),3000);return()=>clearInterval(t);},[load]);
  async function publish(scenario:string,retry=false){
    if(inFlight.current)return;inFlight.current=true;setBusy(true);setError('');
    const intent=retry&&pending?pending:{scenario,event_id:crypto.randomUUID(),replay};
    setPending(intent);
    try{setResult(await publishDemo(intent.scenario,intent.event_id,intent.replay));setPending(null);await load();}
    catch(e){setError(String(e));}finally{inFlight.current=false;setBusy(false);}
  }
  const trial=data?.notification_config.delivery_mode==='trial_delivery_demo';
  return <div className="aw-console">{trial&&<div className="aw-trial-notice" role="note"><strong>Trial delivery demo</strong><p>{data?.notification_config.trial_notice}</p></div>}<header className="aw-heading"><div><p className="aw-overline"><Radio size={14}/> PRESENTER TOOLS · SIMULATED PROVIDER</p><h1>Demo event console</h1><p>Publish a predefined snapshot through the backend ingestion boundary. This is a provider simulator, separate from the analyst workspace.</p></div><Link className="aw-button" href="/analyst-watch">Open analyst dashboard →</Link></header>
    {error&&<p role="alert" className="aw-error">{error}</p>}
    <section className="aw-card"><h2>Delivery preflight</h2><p><strong>Aster Technologies — Demo</strong> · source: simulated · comparison: Q2 2025 versus Q1 2025, consolidated USD millions.</p>{data?<><div className="aw-preflight-grid"><div><span>Watch</span><strong>{data.settings.watched?'In watchlist':'Removed'}</strong></div><div><span>Monitoring</span><strong>{data.settings.monitoring_enabled?'Enabled':'Paused'}</strong></div><div><span>Real WhatsApp delivery</span><strong>{data.settings.whatsapp_enabled?'Enabled':'Disabled'}</strong></div><div><span>Configured destination</span><strong>{data.notification_config.destination}</strong></div></div><p className="aw-muted">{data.notification_config.configuration_ready?'Backend configuration is present; use the dashboard’s read-only provider check to inspect account/session restrictions.':'Notification configuration is incomplete. Financial updates and alerts can still be demonstrated without sending.'}</p></>:<p>Loading backend state…</p>}
      <p className="aw-notice">When the watch, monitoring and WhatsApp delivery are enabled, publishing a scenario authorizes the backend to {trial?'send the permitted predefined sample template when a financial alert is raised':'dispatch its consolidated financial alert'} to the configured recipient. {trial&&'The actual financial changes and rule breaches remain available in Veritas.'} You can close the analyst dashboard; ingestion, rule evaluation and dispatch continue in the backend.</p>
    </section>
    <div className="aw-scenario-grid">{scenarios.map(s=><section className="aw-card" key={s.id}><span className="aw-overline">SIMULATED EXTERNAL UPDATE</span><h2>{s.name}</h2><p>{s.description}</p><button className="aw-primary" disabled={busy||!!pending||!data} onClick={()=>void publish(s.id)}><Send size={15}/>Publish {s.name.toLowerCase()}</button></section>)}</div>
    <section className="aw-card"><h2>Replay and reset</h2><label className="aw-check"><input type="checkbox" checked={replay} disabled={busy||!!pending} onChange={e=>setReplay(e.target.checked)}/>Deliberate new demo replay: allow a similar event to bypass the 60-second duplicate cooldown.</label><p className="aw-muted">Each new publication has a distinct event ID. Repeated browser requests for that ID cannot create another alert or message. Notification rate limits still apply: at least 30 seconds between intents/attempts and at most 20 intents/day.</p><button disabled={busy||!!pending||!data} onClick={()=>void publish('reset')}><RotateCcw size={15}/>Reset active simulation to baseline</button><p className="aw-muted">Reset is an audited provider event. It restores baseline values, preserves snapshots, alerts and delivery history, and never queues a WhatsApp notification.</p>
      {pending&&!busy&&<div className="aw-error"><p>The previous request did not return a confirmed result. Reuse event ID {pending.event_id}; do not publish a duplicate event.</p><button onClick={()=>void publish(pending.scenario,true)}>Retry the same publication request</button></div>}
    </section>
    {result&&<section className="aw-card" role="status"><p className="aw-overline">BACKEND PUBLICATION RECEIPT</p><h2>{result.scenario.replaceAll('_',' ')} published</h2><p>Event {result.id}</p><p>Received {new Date(result.observed_at).toLocaleString()} · snapshot {result.snapshot_id}</p><p>{result.analysis?.summary||'Baseline restored; no detection or notification on reset.'}</p><p>{result.notification_note}</p>{result.alert_id&&<p>Consolidated alert: {result.alert_id}</p>}<Link href="/analyst-watch">Investigate saved changes →</Link></section>}
    <section className="aw-card"><h2>Recent provider publications</h2>{data?.events.length?data.events.map(e=><article key={e.id} className="aw-timeline"><span className="aw-dot"/><div><strong>{e.scenario.replaceAll('_',' ')}</strong><p>{new Date(e.observed_at).toLocaleString()} · {e.id}</p><small>{e.notification_note}</small></div></article>):<p className="aw-muted">No published events yet. The baseline is already seeded.</p>}</section>
    <p className="aw-muted">This console publishes fictional snapshots; it is not live financial-data monitoring. No Microsoft or Spirit facts, research receipts or approved reports are edited.</p>
  </div>;
}
