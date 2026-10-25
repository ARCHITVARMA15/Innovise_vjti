import { apiFetch, apiPost } from './client';
import type { ResearchCase, DocumentDetail } from './research';
import type { Fact, CalculationReceipt } from './financials';

export type AnalysisStatus = 'queued' | 'running' | 'needs_input' | 'completed' | 'partial' | 'failed' | 'interrupted';
export interface AnalysisRunSummary {
  id: string; case_id: string; question: string; status: AnalysisStatus; stale: boolean;
  stale_reasons: string[]; created_at: string; started_at: string | null; finished_at: string | null; errors: string[];
}
export interface EvidencePassage {
  id: string; document_id: string; section_id: string; document_title: string; page_number: number | null;
  label: string; start_offset: number; end_offset: number; excerpt: string; query: string; reason: string;
  publication_date: string | null; reporting_period: string | null; unknown_publication_date: boolean;
}
export interface AnalysisFinding {
  id: string; text: string; finding_type: 'numerical_observation' | 'qualitative_interpretation';
  model_generated: boolean; evidence_ids: string[]; receipt_ids: string[]; fact_ids: string[]; limitations: string[];
}
export interface ResearchBrief {
  id: string; question: string; scope: string; documents_considered: string[]; periods_considered: string[];
  findings: AnalysisFinding[]; missing_information: string[]; unsupported_requests: string[]; limitations: string[]; notice: string;
  qualitative_status?:'available'|'unavailable'|'not_requested'|'legacy_unknown';synthesis_error?:{category:string;message:string}|null;verification_ids?:string[];
}
export interface AnalysisRun extends AnalysisRunSummary {
  question_overridden: boolean;
  requested_model: Record<string, unknown>;
  request?: {research_as_of_date?: string | null};
  scope?: {research_as_of_date?: string | null} | null;
  snapshot: {research_as_of_date?: string | null; case: ResearchCase; documents: {document: DocumentDetail; content_hash: string; included: boolean; exclusion_reason: string | null}[];
    facts: Omit<Fact, 'history'>[]; selected_receipts: CalculationReceipt[]};
  plan: {objective: string; supported_metrics: string[]; calculations: {calculation_type: string; periods: string[]}[];
    evidence_queries: string[]; required_periods: string[]; missing_inputs: string[]; unsupported_requests: string[]; limitations: string[]} | null;
  retrieval: {passages: EvidencePassage[]; scanned_sections: number; scanned_chunks: number; total_chunks: number; omitted_chunks: number; limitations: string[]} | null;
  financial: {findings: AnalysisFinding[]; receipt_ids: string[]; needs_input: string[]; limitations: string[]} | null;
  brief: ResearchBrief | null;
  receipt_ids: string[]; warnings: string[]; limitations: string[];
  events: {id: string; sequence: number; stage: string; transition: string; timestamp: string; message: string}[];
  stage_outputs: Record<string, Record<string, unknown>>;
  excluded_document_ids: string[]; source_availability: Record<string, boolean>; not_included_document_ids: string[];
}

const path = (caseId: string) => `/research/cases/${encodeURIComponent(caseId)}/analysis-runs`;
export const listAnalysisRuns = (caseId: string) => apiFetch<AnalysisRunSummary[]>(path(caseId), {cache: 'no-store'});
export const getAnalysisRun = (caseId: string, runId: string) => apiFetch<AnalysisRun>(`${path(caseId)}/${encodeURIComponent(runId)}`, {cache: 'no-store'});
export const startAnalysisRun = (caseId: string, input: {task_type?:string;entity?:string;periods?:string[];accounting_basis?:string|null;research_as_of_date?:string|null;calculations?:{calculation_type:string;periods:string[]}[];claim_ids?:string[];document_ids: string[]; question_override: string | null; receipt_ids: string[]}) =>
  apiPost<AnalysisRun>(path(caseId), input);
