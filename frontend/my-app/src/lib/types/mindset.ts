export interface InvestorPersona {
  id: string;
  name: string;
  title: string;
  era: string;
  image_url?: string;
  core_style: string;
  persona_summary: string;
  stocks_focus: string[];
  sectors_focus: string[];
  risk_profile: string;
  time_horizon: string;
  net_worth_estimate?: string;
  famous_advice?: string;
  signature_bets?: string[];
  notable_facts?: string[];
  principles: string[];
  sample_prompts: string[];
}

export interface MindsetChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface MindsetThinkingEvent {
  type: 'thinking';
  step: string;
  status: 'running' | 'done' | 'error';
}

export type MindsetSSEEvent =
  | MindsetThinkingEvent
  | { type: 'answer_start' }
  | { type: 'answer_chunk'; content: string }
  | { type: 'answer_end' }
  | { type: 'done'; total_tokens: number; duration_ms: number }
  | { type: 'error'; message: string };
