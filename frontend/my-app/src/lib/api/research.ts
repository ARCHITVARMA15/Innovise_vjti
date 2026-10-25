import { apiFetch, apiPost } from './client';

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export interface CaseInput {
  title: string;
  company_name: string;
  ticker: string | null;
  research_question: string;
  reporting_period: string | null;
  research_as_of_date: string | null;
}

export interface ResearchCase extends CaseInput {
  id: string;
  created_at: string;
  updated_at: string;
  document_count: number;
}

export interface DocumentMetadata {
  title: string;
  publication_date: string | null;
  reporting_period: string | null;
  source_url: string | null;
  document_type: string | null;
}

export interface ResearchDocument extends DocumentMetadata {
  id: string;
  case_id: string;
  source_kind: 'pdf' | 'txt' | 'pasted_text' | 'html' | 'structured_json';
  retrieval?: Record<string,unknown> | null;
  original_filename: string | null;
  uploaded_at: string;
  extraction_status: 'extracted' | 'partial';
  extraction_message: string | null;
  page_count: number | null;
  section_count: number;
  size_bytes: number;
}

export interface DocumentPage {
  id: string;
  document_id: string;
  position: number;
  page_number: number | null;
  label: string;
  text: string;
  extraction_status: 'extracted' | 'no_text';
}

export interface DocumentDetail extends ResearchDocument {
  pages: DocumentPage[];
}

const root = '/research/cases';
const casePath = (id: string) => `${root}/${encodeURIComponent(id)}`;
const documentsPath = (id: string) => `${casePath(id)}/documents`;
export const listCases = () => apiFetch<ResearchCase[]>(root, { cache: 'no-store' });
export const createCase = (input: CaseInput) => apiPost<ResearchCase>(root, input);
export const getCase = (id: string) => apiFetch<ResearchCase>(casePath(id), { cache: 'no-store' });
export const listDocuments = (id: string) => apiFetch<ResearchDocument[]>(documentsPath(id), { cache: 'no-store' });
export const getDocument = (caseId: string, documentId: string) => apiFetch<DocumentDetail>(
  `${documentsPath(caseId)}/${encodeURIComponent(documentId)}`, { cache: 'no-store' },
);
export const pasteDocument = (caseId: string, input: DocumentMetadata & { text: string }) =>
  apiPost<DocumentDetail>(`${documentsPath(caseId)}/text`, input);
export const uploadDocument = (caseId: string, file: File, metadata: DocumentMetadata) => {
  const body = new FormData();
  body.set('file', file);
  body.set('metadata', JSON.stringify(metadata));
  return apiFetch<DocumentDetail>(`${documentsPath(caseId)}/upload`, { method: 'POST', body, cache: 'no-store' });
};
export const removeDocument = (caseId: string, documentId: string) => apiFetch<{ deleted: boolean }>(
  `${documentsPath(caseId)}/${encodeURIComponent(documentId)}`, { method: 'DELETE', cache: 'no-store' },
);
