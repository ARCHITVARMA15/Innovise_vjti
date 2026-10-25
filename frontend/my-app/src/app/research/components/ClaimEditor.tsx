'use client';
import {useState,type FormEvent} from 'react';
import {addClaim,editClaim,emptyMapping,type Claim,type ClaimMapping} from '@/lib/api/verification';
import {METRICS,SCALES,metricLabel} from '@/lib/api/financials';
import {ErrorNotice,errorText} from './ResearchUI';

export default function ClaimEditor({caseId,claim,proposal,onSaved,onCancel}:{caseId:string;claim:Claim|null;proposal?:ClaimMapping;onSaved:()=>Promise<void>;onCancel:()=>void}) {
  const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  const mapping=proposal??claim?.mapping??emptyMapping;
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setBusy(true);setError('');
    const form=new FormData(event.currentTarget);const text=(name:string)=>String(form.get(name)??'').trim();
    const input={text:text('text'),mapping_reviewed:form.get('reviewed')==='on',mapping:{
      assertion_type:text('assertion_type'),target:text('target')||null,entity:text('entity')||null,asserted_value:text('asserted_value')||null,
      unit:text('unit'),currency:text('currency').toUpperCase()||null,scale:text('scale')||null,
      periods:text('periods').split(',').map(s=>s.trim()).filter(Boolean),period_start:text('period_start')||null,period_end:text('period_end')||null,
      accounting_scope:text('accounting_scope')||null,rounding_places:text('rounding_places')===''?null:Number(text('rounding_places')),
      debt_definition:text('debt_definition'),temporal_scope:text('temporal_scope'),ambiguity:text('ambiguity')||null} as ClaimMapping};
    try {if(claim) await editClaim(caseId,claim,{...input,reason:text('reason')});else await addClaim(caseId,input);await onSaved();}
    catch(failure){setError(errorText(failure));}finally{setBusy(false);}
  }
  return <form onSubmit={submit} className="rl-card space-y-4 p-5"><h3 className="text-lg font-bold">{claim?'Review/edit claim interpretation':'Analyst-entered claim'}</h3>
    <p className="rl-muted">Manual claims have no invented source. Proposed mappings need analyst review. Editing creates a revision and makes old verifications stale.</p>
    <fieldset disabled={busy} className="grid gap-4 md:grid-cols-2">
      <label className="md:col-span-2">Claim text *<textarea name="text" required maxLength={2000} rows={3} defaultValue={claim?.text??''}/></label>
      <label>Assertion type<select name="assertion_type" defaultValue={mapping.assertion_type}>{['unknown','numerical','debt_free','qualitative'].map(v=><option key={v} value={v}>{metricLabel(v)}</option>)}</select></label>
      <label>Metric/calculation<select name="target" defaultValue={mapping.target??''}><option value="">Unknown / qualitative</option>{[...METRICS,'revenue_growth','net_profit_margin','current_ratio','debt_to_equity'].map(v=><option key={v} value={v}>{metricLabel(v)}</option>)}</select></label>
      <label>Entity<input name="entity" maxLength={240} defaultValue={mapping.entity??''}/></label>
      <label>Asserted decimal value<input name="asserted_value" maxLength={100} defaultValue={mapping.asserted_value??''}/></label>
      <label>Assertion unit<select name="unit" defaultValue={mapping.unit}>{['unknown','percent','percentage_points','ratio','currency'].map(v=><option key={v} value={v}>{metricLabel(v)}</option>)}</select></label>
      <label>Currency<input name="currency" maxLength={3} defaultValue={mapping.currency??''}/></label>
      <label>Asserted monetary scale<select name="scale" defaultValue={mapping.scale??''}><option value="">Unknown / ratio</option>{SCALES.map(v=><option key={v}>{v}</option>)}</select></label>
      <label>Financial periods (comma-separated; growth: previous, current)<input name="periods" defaultValue={mapping.periods.join(', ')} placeholder="FY2024, FY2025"/></label>
      <label>Period start (if explicitly known)<input type="date" name="period_start" defaultValue={mapping.period_start??''}/></label>
      <label>Period end / reporting date<input type="date" name="period_end" defaultValue={mapping.period_end??''}/></label>
      <label>Accounting scope/basis<input name="accounting_scope" maxLength={240} defaultValue={mapping.accounting_scope??''}/></label>
      <label>Asserted display decimals (0–6)<input name="rounding_places" type="number" min={0} max={6} defaultValue={mapping.rounding_places??''}/><span className="text-xs font-normal">Explicit ROUND_HALF_EVEN comparison; no hidden tolerance.</span></label>
      <label>Debt-free definition<select name="debt_definition" defaultValue={mapping.debt_definition}><option value="unknown">Unknown / not applicable</option><option value="interest_bearing_borrowings">Zero interest-bearing short/long-term borrowings</option></select></label>
      <label>Temporal scope<select name="temporal_scope" defaultValue={mapping.temporal_scope}>{['unknown','historical','current'].map(v=><option key={v}>{v}</option>)}</select></label>
      <label className="md:col-span-2">Unresolved interpretation<textarea name="ambiguity" rows={2} maxLength={1000} defaultValue={mapping.ambiguity??''}/></label>
      {claim&&<label className="md:col-span-2">Reason for edit/review *<input name="reason" required maxLength={1000}/></label>}
      <label className="!flex-row items-start md:col-span-2"><input type="checkbox" name="reviewed" className="mt-1" defaultChecked={!proposal&&claim?.mapping_reviewed}/><span>I reviewed the interpretation, periods, basis and units. This does not certify the claim.</span></label>
    </fieldset>
    {error&&<ErrorNotice message={error}/>}<div className="flex gap-2"><button className="rl-primary" disabled={busy}>{busy?'Saving…':'Save claim revision'}</button><button type="button" className="rl-secondary" disabled={busy} onClick={onCancel}>Cancel</button></div>
  </form>;
}
