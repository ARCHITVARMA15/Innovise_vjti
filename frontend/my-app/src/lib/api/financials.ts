import { apiFetch, apiPost } from './client';

export const METRICS = ['revenue', 'net_income', 'current_assets', 'current_liabilities', 'total_debt', 'total_equity'] as const;
export const SCALES = ['units', 'thousands', 'millions', 'billions', 'lakh', 'crore'] as const;
export type FactStatus = 'candidate' | 'confirmed' | 'rejected' | 'needs_review';
export type CalculationType = 'revenue_growth' | 'net_profit_margin' | 'current_ratio' | 'debt_to_equity';
export interface FactInput {
  document_id: string;
  section_id: string;
  metric: typeof METRICS[number];
  entity: string | null;
  value: string;
  currency: string | null;
  scale: typeof SCALES[number] | null;
  reporting_period: string | null;
  period_start: string | null;
  period_end: string | null;
  period_type: 'instant' | 'duration' | 'unknown';
  accounting_scope: string | null;
  excerpt: string;
  ambiguity_note: string | null;
}
export interface SourceSnapshot {
  structured_provenance?: Record<string,unknown> | null;
  context_spans?:{id:string;section_id:string;start_offset:number;end_offset:number;excerpt:string}[];
  document_id: string;
  section_id: string;
  document_title: string;
  label: string;
  page_number: number | null;
  source_url: string | null;
  excerpt: string;
}
export interface Fact extends FactInput {
  id: string;
  case_id: string;
  status: FactStatus;
  origin: string;
  created_at: string;
  updated_at: string;
  revision: number;
  source_available: boolean;
  source_snapshot: SourceSnapshot;
  original_values: FactInput;
  history: {revision: number; timestamp: string; action: string; reason: string; values: Record<string, unknown>}[];
  removed_at: string | null;
}
export interface ExtractionRun {
  id: string;
  status: 'running' | 'completed' | 'partial' | 'failed';
  created_at: string;
  finished_at: string | null;
  sections: {document_id: string; section_id: string; label: string; selected?: boolean; page_number?: number | null; status: string; message: string | null}[];
  fact_ids: string[];
  duplicate_count: number;
  errors: string[];
  limitations: string[];
  model: string;
}
export interface CalculationRequest {
  calculation_type: CalculationType;
  inputs: Record<string, string>;
  acknowledged_conflicts?: Record<string, string[]>;
}
export interface CalculationReceipt {
  id: string;
  calculation_type: CalculationType;
  formula: string;
  created_at: string;
  status: 'valid' | 'stale' | 'unavailable';
  result: string | null;
  display_result: string | null;
  result_unit: string;
  inputs: Record<string, Omit<Fact, 'history'>>;
  conversions: {role: string; from_scale: string; to_scale: string; multiplier: string; original_value: string; normalized_value: string; currency: string}[];
  sources: (SourceSnapshot & {fact_id: string; revision: number; available_at_calculation: boolean})[];
  warnings: string[];
  missing_inputs: string[];
  conflicts: Record<string, string[]>;
  acknowledged_conflicts: Record<string, string[]>;
  rounding: string;
  precision: number;
  invalidation_reason: string | null;
  invalidated_at: string | null;
}

const path = (id: string) => `/research/cases/${encodeURIComponent(id)}`;
export const listFacts = (id: string) => apiFetch<Fact[]>(`${path(id)}/facts`, {cache: 'no-store'});
export const addFact = (id: string, values: FactInput) => apiPost<Fact>(`${path(id)}/facts`, values);
export const updateFact = (caseId: string, fact: Fact, values: FactInput, status: FactStatus, reason: string) =>
  apiFetch<Fact>(`${path(caseId)}/facts/${encodeURIComponent(fact.id)}`, {method: 'PATCH', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({expected_revision: fact.revision, values, status, reason}), cache: 'no-store'});
export const deleteFact = (caseId: string, fact: Fact) => apiFetch(`${path(caseId)}/facts/${encodeURIComponent(fact.id)}`, {
  method: 'DELETE', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({expected_revision: fact.revision}), cache: 'no-store',
});
export const listExtractions = (id: string) => apiFetch<ExtractionRun[]>(`${path(id)}/extractions`, {cache: 'no-store'});
export const extractFacts = (id: string, documentIds: string[], sectionIds?: string[]) => apiPost<ExtractionRun>(`${path(id)}/extractions`, {document_ids: documentIds, ...(sectionIds ? {section_ids: sectionIds} : {})});
export const listCalculations = (id: string) => apiFetch<CalculationReceipt[]>(`${path(id)}/calculations`, {cache: 'no-store'});
export const calculateMetric = (id: string, request: CalculationRequest) => apiPost<CalculationReceipt>(`${path(id)}/calculations`, request);
export function factValues(fact: Fact): FactInput {
  const {document_id, section_id, metric, entity, value, currency, scale, reporting_period, period_start, period_end,
    period_type, accounting_scope, excerpt, ambiguity_note} = fact;
  return {document_id, section_id, metric, entity, value, currency, scale, reporting_period, period_start, period_end,
    period_type, accounting_scope, excerpt, ambiguity_note};
}
export const metricLabel = (value: string) => value.replaceAll('_', ' ');
