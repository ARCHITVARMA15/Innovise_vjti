/* ── Veritas Agent Types ─────────────────────────────────────────────────── */

export interface ThinkingStep {
  step: string;
  tool: string | null;
  status: 'running' | 'done' | 'error';
}

export interface SourceReference {
  type: 'news' | 'market_data' | 'web_search' | 'portfolio' | 'filing';
  title: string;
  url: string | null;
  snippet: string;
  confidence: number | null;
}

export interface DataSnapshot {
  type: 'stock_quote' | 'metric' | 'chart_data' | 'sentiment' | 'portfolio_summary';
  label: string;
  data: Record<string, unknown>;
}

export interface VerificationResult {
  raw_analysis: string;
}

export interface RegulatoryResult {
  verdict?: string;
  risk_level?: string;
  confidence?: number;
  finding_count?: number;
  disclaimer?: string;
  raw_analysis?: string;
}

export interface LayerTrace {
  iteration: number;
  layer: 'router' | 'execution' | 'synthesis';
  intent: string;
  summary: string;
  confidence: number | null;
  stop_reason: string | null;
  timestamp: string;
}

export interface IterationOutput {
  iteration: number;
  layer: 'router' | 'execution' | 'synthesis';
  intent: string;
  tools?: string[];
  tool_summaries?: string[];
  answer_preview?: string;
  entities?: string[];
  needs_portfolio?: boolean;
  confidence?: number;
  mode_plan?: {
    title: string;
    iteration: number;
    steps: Array<{ label: string; status: 'done' | 'pending'; index: number }>;
  };
}

export interface WorkflowSummary {
  iterations: number;
  stop_reason: string;
}

export interface EvidenceItem {
  id: string;
  iteration: number;
  intent: string;
  source_type: 'news' | 'market_data' | 'web_search' | 'portfolio' | 'filing';
  source_title: string;
  source_url: string | null;
  signal: 'supporting' | 'conflicting' | 'neutral';
  rating: 'high' | 'medium' | 'low';
  confidence: number;
  recency_days: number | null;
  quality_score: number;
  rationale: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  thinkingSteps?: ThinkingStep[];
  sources?: SourceReference[];
  dataSnapshots?: DataSnapshot[];
  verification?: VerificationResult | null;
}

/* ── SSE Event types ─────────────────────────────────────────────────────── */

export type SSEEvent =
  | { type: 'thinking'; step: string; tool: string | null; status: 'running' | 'done' | 'error' }
  | { type: 'source'; source: SourceReference }
  | { type: 'data_snapshot'; snapshot: DataSnapshot }
  | { type: 'layer_trace'; trace: LayerTrace }
  | { type: 'iteration_output'; output: IterationOutput }
  | { type: 'evidence_item'; evidence: EvidenceItem }
  | { type: 'answer_start' }
  | { type: 'answer_chunk'; content: string }
  | { type: 'answer_end' }
  | { type: 'verification'; result: VerificationResult }
  | { type: 'regulatory'; result: RegulatoryResult }
  | { type: 'workflow_done'; summary: WorkflowSummary }
  | { type: 'done'; total_tokens: number; duration_ms: number }
  | { type: 'error'; message: string };
