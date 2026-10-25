'use client';

import { useState, useRef, useCallback } from 'react';
import { streamAgentChat } from '@/lib/api/agent';
import type {
  ChatMessage,
  ThinkingStep,
  SourceReference,
  DataSnapshot,
  EvidenceItem,
  LayerTrace,
  IterationOutput,
  RegulatoryResult,
  VerificationResult,
  WorkflowSummary,
} from '@/lib/types/agent';
import ChatPanel from './components/ChatPanel';
import ContextPanel from './components/ContextPanel';
import QuickActions from './components/QuickActions';

interface SendOptions {
  includePortfolioContext?: boolean;
}

export default function InsightsPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sources, setSources] = useState<SourceReference[]>([]);
  const [dataSnapshots, setDataSnapshots] = useState<DataSnapshot[]>([]);
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  const [layerTraces, setLayerTraces] = useState<LayerTrace[]>([]);
  const [iterationOutputs, setIterationOutputs] = useState<IterationOutput[]>([]);
  const [evidenceItems, setEvidenceItems] = useState<EvidenceItem[]>([]);
  const [workflowSummary, setWorkflowSummary] = useState<WorkflowSummary | null>(null);
  const [activeIntent, setActiveIntent] = useState<string>('general');
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [regulatory, setRegulatory] = useState<RegulatoryResult | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingAnswer, setStreamingAnswer] = useState('');

  const [sessionId, setSessionId] = useState(() => `veritas-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const abortRef = useRef<AbortController | null>(null);

  const handleSend = useCallback(async (query: string, options?: SendOptions) => {
    if (!query.trim() || isStreaming) return;

    // Reset context panel for new query
    setSources([]);
    setDataSnapshots([]);
    setThinkingSteps([]);
    setLayerTraces([]);
    setIterationOutputs([]);
    setEvidenceItems([]);
    setWorkflowSummary(null);
    setActiveIntent('general');
    setVerification(null);
    setRegulatory(null);
    setStreamingAnswer('');
    setIsStreaming(true);

    // Add user message
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);

    const controller = new AbortController();
    abortRef.current = controller;

    let answerBuffer = '';

    try {
      await streamAgentChat(query, sessionId, {
        onThinking: (step) => {
          setThinkingSteps(prev => {
            const existing = prev.findIndex(s => s.step === step.step);
            if (existing >= 0) {
              const updated = [...prev];
              updated[existing] = step;
              return updated;
            }
            return [...prev, step];
          });
        },
        onSource: (source) => {
          setSources(prev => [...prev, source]);
        },
        onDataSnapshot: (snapshot) => {
          setDataSnapshots(prev => [...prev, snapshot]);
        },
        onLayerTrace: (trace) => {
          setLayerTraces(prev => [...prev, trace]);
          if (trace.layer === 'router' && trace.intent) {
            setActiveIntent(trace.intent);
          }
        },
        onIterationOutput: (output) => {
          setIterationOutputs(prev => [...prev, output]);
        },
        onEvidenceItem: (evidence) => {
          setEvidenceItems(prev => {
            if (prev.some(item => item.id === evidence.id)) return prev;
            return [...prev, evidence];
          });
        },
        onAnswerStart: () => {
          setStreamingAnswer('');
        },
        onAnswerChunk: (content) => {
          answerBuffer += content;
          setStreamingAnswer(answerBuffer);
        },
        onAnswerEnd: () => {
          // Finalize assistant message
          const assistantMsg: ChatMessage = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: answerBuffer,
            timestamp: new Date().toISOString(),
          };
          setMessages(prev => [...prev, assistantMsg]);
          setStreamingAnswer('');
        },
        onVerification: (result) => {
          setVerification(result);
        },
        onRegulatory: (result) => {
          setRegulatory(result);
        },
        onWorkflowDone: (summary) => {
          setWorkflowSummary(summary);
        },
        onDone: () => {
          setIsStreaming(false);
        },
        onError: (message) => {
          const errMsg: ChatMessage = {
            id: `error-${Date.now()}`,
            role: 'assistant',
            content: `**Error:** ${message}`,
            timestamp: new Date().toISOString(),
          };
          setMessages(prev => [...prev, errMsg]);
          setIsStreaming(false);
        },
      }, { includePortfolioContext: Boolean(options?.includePortfolioContext) }, controller.signal);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setIsStreaming(false);
    }
  }, [isStreaming, sessionId]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const handleNewChat = useCallback(() => {
    setMessages([]);
    setSources([]);
    setDataSnapshots([]);
    setThinkingSteps([]);
    setLayerTraces([]);
    setIterationOutputs([]);
    setEvidenceItems([]);
    setWorkflowSummary(null);
    setActiveIntent('general');
    setVerification(null);
    setRegulatory(null);
    setStreamingAnswer('');
    setSessionId(`veritas-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  }, []);

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Quick actions bar */}
      <div className="px-6 pt-4 pb-2">
        <QuickActions onSend={handleSend} disabled={isStreaming} activeIntent={activeIntent} />
      </div>

      {/* Main split: Chat + Context */}
      <div className="flex flex-1 min-h-0 gap-4 px-6 pb-4">
        {/* Chat panel — 60% */}
        <div className="w-[60%] flex flex-col min-h-0">
          <ChatPanel
            messages={messages}
            thinkingSteps={thinkingSteps}
            streamingAnswer={streamingAnswer}
            isStreaming={isStreaming}
            activeIntent={activeIntent}
            onSend={handleSend}
            onStop={handleStop}
            onNewChat={handleNewChat}
          />
        </div>

        {/* Context panel — 40% */}
        <div className="w-[40%] flex flex-col min-h-0">
          <ContextPanel
            sources={sources}
            dataSnapshots={dataSnapshots}
            layerTraces={layerTraces}
            iterationOutputs={iterationOutputs}
            evidenceItems={evidenceItems}
            workflowSummary={workflowSummary}
            verification={verification}
            regulatory={regulatory}
            activeIntent={activeIntent}
          />
        </div>
      </div>
    </div>
  );
}
