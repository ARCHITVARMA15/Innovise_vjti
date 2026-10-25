import {apiFetch,apiPost} from './client';
import type {EvidencePassage,AnalysisRun} from './analysis';

export interface ClaimMapping {
  assertion_type:'numerical'|'debt_free'|'qualitative'|'unknown'; target:string|null; entity:string|null;
  asserted_value:string|null; unit:'percent'|'percentage_points'|'ratio'|'currency'|'unknown';
  currency:string|null; scale:string|null; periods:string[]; period_start:string|null; period_end:string|null;
  accounting_scope:string|null; rounding_places:number|null; debt_definition:'interest_bearing_borrowings'|'unknown';
  temporal_scope:'historical'|'current'|'unknown'; ambiguity:string|null;
}
export const emptyMapping:ClaimMapping={assertion_type:'unknown',target:null,entity:null,asserted_value:null,unit:'unknown',currency:null,
  scale:null,periods:[],period_start:null,period_end:null,accounting_scope:null,rounding_places:null,debt_definition:'unknown',temporal_scope:'unknown',ambiguity:null};
export interface Claim {
  id:string;case_id:string;text:string;mapping:ClaimMapping;mapping_reviewed:boolean;origin:string;origin_reference:string|null;
  source:{document_id:string;section_id:string;document_title:string;page_number:number|null;label:string;excerpt:string;start_offset:number;end_offset:number;document_hash:string}|null;
  revision:number;created_at:string;updated_at:string;history:Record<string,unknown>[];source_available:boolean;
}
export type Verdict='supported'|'contradicted'|'unsupported'|'needs_review';
export interface VerificationResult {
  status:Verdict;method:string;explanation:string;supporting_ids:string[];contradicting_ids:string[];receipt_ids:string[];fact_ids:string[];
  comparison:Record<string,unknown>|null;mapping_proposal:ClaimMapping|null;missing_evidence:string[];limitations:string[];label:string;
}
export interface VerificationRun {
  id:string;case_id:string;claim_id:string;status:'queued'|'running'|'completed'|'failed'|'interrupted';stale:boolean;stale_reasons:string[];
  created_at:string;started_at:string|null;finished_at:string|null;claim_snapshot:Claim;snapshot:AnalysisRun['snapshot'];requested_model:Record<string,unknown>;
  result:VerificationResult|null;evidence:EvidencePassage[];events:{timestamp:string;stage:string;message:string}[];
  errors:string[];warnings:string[];attempts:Record<string,unknown>[];source_availability:Record<string,boolean>;
}
const root=(id:string)=>`/research/cases/${encodeURIComponent(id)}`;
export const listClaims=(id:string)=>apiFetch<Claim[]>(`${root(id)}/claims`,{cache:'no-store'});
export const addClaim=(id:string,input:{text:string;mapping:ClaimMapping;mapping_reviewed:boolean})=>apiPost<Claim>(`${root(id)}/claims`,input);
export const editClaim=(id:string,claim:Claim,input:{text:string;mapping:ClaimMapping;mapping_reviewed:boolean;reason:string})=>apiFetch<Claim>(`${root(id)}/claims/${claim.id}`,{
  method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({...input,expected_revision:claim.revision}),cache:'no-store'});
export const extractClaims=(id:string,documentId:string)=>apiPost<{status:string;claim_ids:string[];processed_chunks:number;omitted_chunks:number;errors:string[]}>(`${root(id)}/claims/extract`,{document_id:documentId});
export const importFindings=(id:string,runId:string)=>apiPost<Claim[]>(`${root(id)}/claims/import-findings`,{analysis_run_id:runId});
export const listVerifications=(id:string)=>apiFetch<VerificationRun[]>(`${root(id)}/verifications`,{cache:'no-store'});
export const verifyClaim=(id:string,claimId:string,documentIds:string[],receiptIds:string[])=>apiPost<VerificationRun>(`${root(id)}/claims/${claimId}/verifications`,{supporting_document_ids:documentIds,receipt_ids:receiptIds});
export const getVerificationRun=(id:string,runId:string)=>apiFetch<VerificationRun>(`${root(id)}/verifications/${encodeURIComponent(runId)}`,{cache:'no-store'});
