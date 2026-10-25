import {apiFetch,apiPost} from './client';
import type {Fact,FactInput,CalculationType} from './financials';
export interface AutomationStart {query:string;request_id:string;as_of_date:string;company?:string|null;year_basis?:'fiscal'|'calendar'|null;metrics:CalculationType[]}
export interface Candidate {fact:Fact;values:FactInput;eligible:boolean;missing_fields:string[];source_error:string|null;conflicts:string[];equivalent_confirmed_ids:string[]}
export interface AutomationRun {
 id:string;case_id:string;original_query:string;request:AutomationStart;status:string;revision:number;stage:string;created_at:string;finished_at:string|null;
 scope:{entity:{name:string;ticker:string|null;cik:string;identity_source:string}|null;years:number[];periods:string[];research_as_of_date:string;year_basis:string;requested_metrics:CalculationType[];default_scope_note:string}|null;
 company_choices?:{name:string;ticker:string;cik:string}[];filings:{accessionNumber:string;form:string;reportDate:string;filingDate:string;url:string;requested_year:number;selection_rationale:string;amendments:unknown[]}[];
 imported_filings:{document_id:string;requested_year:number;basis:string|null;basis_evidence:unknown[];manual_fallback:boolean}[];
 document_ids:string[];candidate_ids:string[];candidates?:Candidate[];selected_fact_ids:string[];questions:string[];blockers:string[];record_issues:string[];limitations:string[];
 budgets:Record<string,number>;coverage:{tool:string;periods:string[];status:string;missing:string[];receipt_id?:string}[];
 analysis_run_id:string|null;receipt_ids:string[];report_id:string|null;extraction_run_id:string|null;cancel_requested:boolean;
 events?:{sequence:number;stage:string;transition:string;message:string;timestamp:string}[];
}
export interface AutomationConfig {configured:boolean;provider:string;notice:string;limits:Record<string,number>}
const root=(caseId:string)=>`/research/cases/${encodeURIComponent(caseId)}/automation`;
const path=(caseId:string,id:string)=>`${root(caseId)}/${encodeURIComponent(id)}`;
export const automationConfig=()=>apiFetch<AutomationConfig>('/research/automation/config',{cache:'no-store'});
export const startAutomation=(input:AutomationStart,caseId?:string)=>apiPost<AutomationRun>(caseId?root(caseId):'/research/automation',input);
export const listAutomations=(caseId:string)=>apiFetch<AutomationRun[]>(root(caseId),{cache:'no-store'});
export const getAutomation=(caseId:string,id:string)=>apiFetch<AutomationRun>(path(caseId,id),{cache:'no-store'});
export const automationAction=(caseId:string,id:string,action:string,input:unknown)=>apiPost<AutomationRun>(`${path(caseId,id)}/${action}`,input);
