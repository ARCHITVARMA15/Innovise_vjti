/* ── Veritas Agent SSE Client ─────────────────────────────────────────────── */

import type {
  DataSnapshot,
  EvidenceItem,
  IterationOutput,
  LayerTrace,
  RegulatoryResult,
  SourceReference,
  ThinkingStep,
  VerificationResult,
  WorkflowSummary,
} from '@/lib/types/agent';

const API_BASE = 'http://localhost:8000';

export interface AgentSSECallbacks {
  onThinking: (step: ThinkingStep) => void;
  onSource: (source: SourceReference) => void;
  onDataSnapshot: (snapshot: DataSnapshot) => void;
  onLayerTrace: (trace: LayerTrace) => void;
  onIterationOutput: (output: IterationOutput) => void;
  onEvidenceItem: (evidence: EvidenceItem) => void;
  onAnswerStart: () => void;
  onAnswerChunk: (content: string) => void;
  onAnswerEnd: () => void;
  onVerification: (result: VerificationResult) => void;
  onRegulatory: (result: RegulatoryResult) => void;
  onWorkflowDone: (summary: WorkflowSummary) => void;
  onDone: (info: { total_tokens: number; duration_ms: number }) => void;
  onError: (message: string) => void;
}

export async function streamAgentChat(
  query: string,
  sessionId: string,
  callbacks: AgentSSECallbacks,
  options?: { includePortfolioContext?: boolean },
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(`${API_BASE}/agent/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      session_id: sessionId,
      include_portfolio_context: Boolean(options?.includePortfolioContext),
    }),
    signal,
  });

  if (!response.ok) {
    callbacks.onError(`HTTP ${response.status}: ${response.statusText}`);
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    callbacks.onError('No response stream available');
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;

        const jsonStr = trimmed.slice(5).trim();
        if (!jsonStr || jsonStr === '[DONE]') continue;

        try {
          const event = JSON.parse(jsonStr);
          switch (event.type) {
            case 'thinking':
              callbacks.onThinking(event);
              break;
            case 'source':
              callbacks.onSource(event.source);
              break;
            case 'data_snapshot':
              callbacks.onDataSnapshot(event.snapshot);
              break;
            case 'layer_trace':
              callbacks.onLayerTrace(event.trace);
              break;
            case 'iteration_output':
              callbacks.onIterationOutput(event.output);
              break;
            case 'evidence_item':
              callbacks.onEvidenceItem(event.evidence);
              break;
            case 'answer_start':
              callbacks.onAnswerStart();
              break;
            case 'answer_chunk':
              callbacks.onAnswerChunk(event.content);
              break;
            case 'answer_end':
              callbacks.onAnswerEnd();
              break;
            case 'verification':
              callbacks.onVerification(event.result);
              break;
            case 'regulatory':
              callbacks.onRegulatory(event.result);
              break;
            case 'workflow_done':
              callbacks.onWorkflowDone(event.summary);
              break;
            case 'done':
              callbacks.onDone(event);
              break;
            case 'error':
              callbacks.onError(event.message);
              break;
          }
        } catch {
          // Skip malformed JSON lines
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
