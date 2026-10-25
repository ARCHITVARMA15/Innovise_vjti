import { apiFetch, apiPost } from './client';
import type { CalculationReceipt } from './financials';
import type { AnalysisRun } from './analysis';
export interface ReportFinding {
  id:string; text:string; claim_revision:number; origin:string; verdict:string|null;
  materiality:{material:boolean;reason:string}; execution_status:string; label:string;
  reason_detail?:string|null; resolution?:string|null;
  reason_code:string|null; verification_id:string|null; errors:string[]; warnings:string[];
  machine_result:{explanation:string;method:string;supporting_ids:string[];contradicting_ids:string[]}|null;
}
export interface Report {
  id:string; version:number; predecessor_id:string|null; revision:number; state:string; stale:boolean;
  stale_reasons:string[]; current_approval:boolean; question:string; analysis_run_id:string;
  rendering_method:string; snapshot:AnalysisRun['snapshot']; scope:Record<string,unknown>;
  findings:ReportFinding[]; material_unresolved:string[]; limitations:string[]; failures:string[];
  unresolved_questions:string[]; metrics:CalculationReceipt[]; notice:string;
  risks:{status:string;method:string;items:{id:string;category:string;observation:string;why_it_may_matter:string;
    receipt_ids:string[];fact_ids:string[];evidence_ids:string[];assessment_method:string;uncertainty:string;open_questions:string[]}[]};
  reviews:{timestamp:string;reviewer_label:string;action:string;comment:string;finding_feedback:Record<string,string>}[];
  materiality_adjustments:Record<string,boolean>; dispositions:Record<string,string>; repairs:Record<string,unknown>[];
  workflow:AnalysisRun['events'];
}
const path=(caseId:string)=>`/research/cases/${encodeURIComponent(caseId)}/reports`;
export const listReports=(caseId:string)=>apiFetch<Report[]>(path(caseId),{cache:'no-store'});
export const createReport=(caseId:string,analysis_run_id:string,predecessor_id?:string)=>apiPost<Report>(path(caseId),{analysis_run_id,predecessor_id:predecessor_id||null});
export const reviewReport=(caseId:string,id:string,input:unknown)=>apiPost<Report>(`${path(caseId)}/${encodeURIComponent(id)}/reviews`,input);
