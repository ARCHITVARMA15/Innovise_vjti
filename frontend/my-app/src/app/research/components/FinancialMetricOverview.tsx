import {METRICS,metricLabel,type Fact,type CalculationReceipt,type CalculationType} from '@/lib/api/financials';
import {currentMetricReceipts,overviewFacts,receiptPeriod,displayReceiptResult,formatFinancialAmount} from '@/lib/financial-overview';

const calculations:CalculationType[]=['revenue_growth','net_profit_margin','current_ratio','debt_to_equity','net_income_growth','working_capital'];

export default function FinancialMetricOverview({facts,receipts,onInspectFact}:{facts:Fact[];receipts:CalculationReceipt[];onInspectFact:(fact:Fact)=>void}){
 const saved=currentMetricReceipts(receipts),confirmed=overviewFacts(facts);
 return <section aria-labelledby="metric-overview-heading" className="space-y-3">
  <div><h3 id="metric-overview-heading" className="text-lg font-bold">Financial metrics overview</h3><p className="rl-muted mt-1">Confirmed source figures and valid saved calculations, compared by financial period. Missing metrics remain unavailable.</p></div>
  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{calculations.map(type=>{
   const values=saved.filter(r=>r.calculation_type===type);
   return <article key={type} className="rl-card min-w-0 p-4"><h4 className="text-sm font-semibold capitalize">{metricLabel(type)}</h4>
    {!values.length&&<p className="mt-3 text-sm text-slate-500">No valid saved calculation</p>}
    {values.map(receipt=><div key={receipt.id} className="mt-3 border-t border-slate-100 pt-3"><p className="text-xs font-semibold text-slate-500">{receiptPeriod(receipt)}</p><p title={`Exact saved result: ${receipt.result} ${receipt.result_unit}`} className="mt-1 break-words text-xl font-bold tabular-nums">{displayReceiptResult(receipt)}</p><p className="mt-1 text-xs text-slate-500">{[...new Set(Object.values(receipt.inputs).map(f=>f.entity))].join(', ')}</p><button type="button" className="mt-2 inline-block text-xs font-semibold text-[#006591] underline" onClick={()=>{const target=document.getElementById(`receipt-${receipt.id}`);target?.focus({preventScroll:true});target?.scrollIntoView({behavior:'smooth',block:'center'});}}>View receipt and sources</button></div>)}
   </article>;
  })}</div>
  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{METRICS.map(metric=>{
   const values=confirmed.filter(f=>f.metric===metric);
   return <article key={metric} className="rl-card min-w-0 p-4"><h4 className="text-sm font-semibold capitalize">{metricLabel(metric)}</h4>
    {!values.length&&<p className="mt-3 text-sm text-slate-500">No confirmed source figure</p>}
    {values.map(fact=><div key={fact.id} className="mt-3 border-t border-slate-100 pt-3"><div className="flex flex-wrap items-baseline justify-between gap-2"><span className="text-xs font-semibold text-slate-500">{fact.reporting_period||fact.period_end||'Unknown period'}</span><strong title={`${fact.value} ${fact.currency} ${fact.scale}`} className="break-all text-base tabular-nums">{formatFinancialAmount(fact.value,fact.currency,fact.scale)}</strong></div><p className="mt-1 text-xs text-slate-500">Source scale: {fact.scale} · {fact.entity}</p><details className="mt-2 text-xs"><summary className="cursor-pointer text-[#006591]">Basis and source</summary><p className="mt-2">{fact.accounting_scope} · {fact.period_end}</p><button type="button" className="mt-2 text-left text-[#006591] underline" onClick={()=>onInspectFact(fact)}>{fact.source_snapshot.document_title} · {fact.source_snapshot.label}</button></details></div>)}
   </article>;
  })}</div>
 </section>;
}
