import { apiFetch, apiPost } from './client';

export type EvidenceStatus = 'VERIFIED' | 'CONTRADICTED' | 'UNSUPPORTED' | 'UNRESOLVED';
export type Level = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
export interface EcosystemEntity { id: string; name: string; jurisdiction: string | null; ticker: string | null; aliases: string[]; external_ids: Record<string,string>; synthetic: boolean }
export interface EcosystemSource { id: string; title: string; url: string | null; publisher: string; published_at: string | null; retrieved_at: string; document_page: string; document_version: string; text: string; kind: string; content_hash: string; supersedes: string | null }
export interface Relationship {
  id: string; source_entity_id: string; target_entity_id: string; relationship_type: string;
  source_ids: string[]; excerpt: string; effective_from: string | null; effective_to: string | null; last_confirmed: string | null;
  status: EvidenceStatus; rationale: string; synthetic: boolean; data_issues: string[];
}
export interface EcosystemMetric {
  id: string; entity_id: string; metric: string; value: string; currency: string; units: string; period: string; period_type: string;
  period_start: string | null; period_end: string; reporting_basis: string; document_version: string; source_id: string;
  provenance: string; synthetic: boolean; source_fact_id: string | null;
}
export interface Exposure { relationship_id: string; materiality: Level; basis: string; facts: Record<string,string | null>; mitigants: string[]; hypothetical: boolean; evidence_ids: string[] }
export interface FinancialAssessment {
  entity_id: string; distress: Level; observations: string[]; metric_ids: string[]; limitations: string[]; synthetic: boolean; evidence_ids?: string[];
  calculations: { tool: string; formula: string; result: string; display_result: string; unit: string; provenance: string; inputs: Record<string, EcosystemMetric> }[];
}
export interface TransmissionFinding {
  id: string; relationship_id: string; counterparty_id: string; triggering_event: string; causal_mechanism: string; target_consequence: string;
  mitigants: string[]; assumptions: string[]; disconfirming_checks: string[]; evidence_ids: string[];
  evidence_status: EvidenceStatus; counterparty_distress: Level; target_materiality: Level;
  scenario_risk: 'ELEVATED' | 'MODERATE' | 'LOW' | 'UNKNOWN' | 'NOT_ESTABLISHED'; hypothetical: boolean; confirmed_alert: boolean; quantification_note: string; observed_impact?: string | null;
}
export interface EcosystemReview { id: string; expected_revision: number; decision: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES'; reviewer_label: string; reviewer_notes: string; acknowledge_limitations: boolean; created_at: string }
export interface EcosystemScenario { id: string; relationship_id: string; disruption_severity: string; unmitigated_fraction: string; assumption_notes: string; created_at: string; status: string; affected_revenue: string | null; revenue_at_risk: string | null; currency: string | null; units: string; period: string | null; metric_id: string | null; source_ids: string[]; formula: string; explanation: string; label: string; base_kind?: string; base_inputs?: Record<string,string> }
export interface EcosystemEvent { id: number; stage: string; transition: string; message: string; created_at: string }
export interface EcosystemRun {
  id: string; case_id: string; request: { target: string | null; as_of_date: string; max_depth: number; max_counterparties: number; retry_budget: number; stale_after_days: number };
  mode: 'curated' | 'demo'; status: 'queued' | 'running' | 'completed' | 'partial' | 'needs_input' | 'failed' | 'interrupted';
  revision: number; created_at: string; finished_at: string | null; target_entity_id: string | null;
  entities: EcosystemEntity[]; sources: EcosystemSource[]; relationships: Relationship[]; metrics: EcosystemMetric[];
  exposures: Exposure[]; assessments: FinancialAssessment[]; findings: TransmissionFinding[];
  uncertainties: string[]; questions: string[]; limitations: string[]; audit: string[]; retry_count: number;
  review_state: 'NEEDS_REVIEW' | 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED'; reviews: EcosystemReview[]; scenarios: EcosystemScenario[]; events: EcosystemEvent[]; errors: string[]; source_state: 'current' | 'stale';
}
export interface EcosystemConfig { demo_enabled: boolean; synthetic_demo_available?: boolean; supported_targets: string[]; demo_as_of_date: string; max_depth: number; max_counterparties: number; max_retries: number; model_calls: boolean; network_tools: string[] }
export interface EcosystemStart { target: string; as_of_date: string; max_depth: 1; max_counterparties: number; retry_budget: number }
const root = (caseId: string) => `/research/cases/${encodeURIComponent(caseId)}/ecosystem`;
const path = (caseId: string, runId: string) => `${root(caseId)}/investigations/${encodeURIComponent(runId)}`;
export const ecosystemConfig = (caseId: string) => apiFetch<EcosystemConfig>(`${root(caseId)}/config`, {cache:'no-store'});
export const listEcosystemRuns = (caseId: string) => apiFetch<EcosystemRun[]>(`${root(caseId)}/investigations`, {cache:'no-store'});
export const getEcosystemRun = (caseId: string, id: string) => apiFetch<EcosystemRun>(path(caseId,id), {cache:'no-store'});
export const startEcosystemRun = (caseId: string, input: EcosystemStart, demo = false) => apiPost<EcosystemRun>(`${root(caseId)}/${demo ? 'demo/load' : 'investigations'}`,input);
export const reviewEcosystem = (caseId: string,id: string,input: Omit<EcosystemReview,'id'|'created_at'>) => apiPost<EcosystemRun>(`${path(caseId,id)}/review`,input);
export const runEcosystemScenario = (caseId: string,id: string,input: Pick<EcosystemScenario,'relationship_id'|'disruption_severity'|'unmitigated_fraction'|'assumption_notes'>) => apiPost<EcosystemRun>(`${path(caseId,id)}/scenarios`,input);
