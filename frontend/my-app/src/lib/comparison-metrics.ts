import type {CalculationReceipt,CalculationRequest,Fact} from './api/financials';

export interface ComparisonMetricPlan {key:string;type:CalculationRequest['calculation_type'];period:string;inputs:Record<string,string>;missing:string[];reviewFacts:Fact[];receiptId?:string}
const canonical=(s:string|null)=>s?.trim().replace(/\s+/g,' ').toLowerCase();

export function comparisonMetricPlans(facts:Fact[],receipts:CalculationReceipt[]):ComparisonMetricPlan[]{
 const baseline=receipts.filter(r=>r.status==='valid'&&r.calculation_type==='revenue_growth'&&r.inputs.current&&r.inputs.previous)
  .sort((a,b)=>(b.inputs.current.period_end||'').localeCompare(a.inputs.current.period_end||'')||b.created_at.localeCompare(a.created_at))[0];
 if(!baseline)return [];
 const plans:ComparisonMetricPlan[]=[];
 const find=(metric:Fact['metric'],period:typeof baseline.inputs.current)=>{
  const options=facts.filter(f=>f.metric===metric&&f.period_end===period.period_end&&f.period_type===(metric==='net_income'?'duration':'instant')&&
   (metric!=='net_income'||f.period_start===period.period_start)&&canonical(f.entity)===canonical(period.entity)&&f.currency===period.currency&&
   canonical(f.accounting_scope)===canonical(period.accounting_scope)&&f.source_available&&!f.removed_at&&f.status!=='rejected');
  const confirmed=options.filter(f=>f.status==='confirmed'&&!f.ambiguity_note);
  const pool=confirmed.length?confirmed:options;
  // Never choose silently between competing interpretations or units.
  return pool.length&&new Set(pool.map(f=>JSON.stringify([f.value,f.scale,f.ambiguity_note]))).size===1?pool[0]:undefined;
 };
 const add=(type:ComparisonMetricPlan['type'],period:string,roles:Record<string,{metric:Fact['metric'];scope:typeof baseline.inputs.current}>)=>{
  const inputs:Record<string,string>={},missing:string[]=[],reviewFacts:Fact[]=[];
  for(const [role,{metric,scope}] of Object.entries(roles)){
   const fact=find(metric,scope);
   if(!fact)missing.push(`Add or resolve ${metric.replaceAll('_',' ')} at ${scope.period_end}.`);
   else{inputs[role]=fact.id;if(fact.status!=='confirmed'||fact.ambiguity_note){missing.push(`Review and confirm ${metric.replaceAll('_',' ')} at ${scope.period_end}.`);reviewFacts.push(fact);}}
  }
  const saved=receipts.find(r=>r.status==='valid'&&r.calculation_type===type&&Object.keys(r.inputs).length===Object.keys(roles).length&&Object.entries(inputs).every(([role,id])=>r.inputs[role]?.id===id&&r.inputs[role]?.revision===facts.find(f=>f.id===id)?.revision));
  plans.push({key:type+':'+period,type,period,inputs,missing,reviewFacts,receiptId:!missing.length?saved?.id:undefined});
 };
 for(const scope of [baseline.inputs.previous,baseline.inputs.current]){
  const period=scope.reporting_period||scope.period_end||'Unknown period';
  for(const type of ['current_ratio','working_capital'] as const)add(type,period,{current_assets:{metric:'current_assets',scope},current_liabilities:{metric:'current_liabilities',scope}});
 }
 add('net_income_growth',`${baseline.inputs.previous.reporting_period||baseline.inputs.previous.period_end} → ${baseline.inputs.current.reporting_period||baseline.inputs.current.period_end}`,{current:{metric:'net_income',scope:baseline.inputs.current},previous:{metric:'net_income',scope:baseline.inputs.previous}});
 return plans;
}
