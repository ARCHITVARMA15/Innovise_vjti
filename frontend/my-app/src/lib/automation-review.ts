import type {Candidate} from './api/automation';
import type {FactInput} from './api/financials';

// Immediate feedback only; the backend still validates sources and revisions.
export function candidateReviewIssues(candidate:Candidate, values:FactInput):string[]{
 const issues:string[]=[];
 const required={entity:'entity',currency:'currency',scale:'scale',period_end:'period end',reporting_period:'reporting period',accounting_scope:'accounting basis'} as const;
 for(const [field,label] of Object.entries(required))if(!values[field as keyof typeof required]?.trim())issues.push(`Enter ${label}.`);
 if(values.period_type==='unknown')issues.push('Choose the financial period type in Financials.');
 if(values.period_type==='duration'&&!values.period_start)issues.push('Enter the annual period start.');
 if(values.ambiguity_note?.trim())issues.push('Resolve the ambiguity note against the source before clearing it.');
 if(!candidate.fact.source_available||candidate.fact.removed_at)issues.push('The source or candidate was removed; select an available source in Financials.');
 return issues;
}

export function batchReviewIssues(candidates:Candidate[],edits:Record<string,FactInput>):string[]{
 if(!candidates.length)return ['Select at least one reviewed candidate.'];
 return candidates.flatMap(candidate=>{
  const values=edits[candidate.fact.id]||candidate.values;
  const issues=candidateReviewIssues(candidate,values);
  return issues.length?[`${values.metric.replaceAll('_',' ')} · ${values.reporting_period||'unknown period'}: ${issues.join(' ')}`]:[];
 });
}
