export type AgentIntent = 'verify' | 'analyze' | 'strategy' | 'what_if' | 'regulatory' | 'general';

export interface IntentTheme {
  accent: string;
  softBg: string;
  softBorder: string;
  label: string;
}

export const INTENT_THEME: Record<AgentIntent, IntentTheme> = {
  verify: {
    accent: '#006591',
    softBg: '#e5eeff',
    softBorder: 'rgba(0,101,145,0.35)',
    label: 'Verification Mode',
  },
  analyze: {
    accent: '#7c3aed',
    softBg: '#f3e8ff',
    softBorder: 'rgba(124,58,237,0.35)',
    label: 'Analysis Mode',
  },
  strategy: {
    accent: '#009668',
    softBg: '#e6f9f1',
    softBorder: 'rgba(0,150,104,0.35)',
    label: 'Strategy Mode',
  },
  what_if: {
    accent: '#c9a84c',
    softBg: '#fef9e7',
    softBorder: 'rgba(201,168,76,0.35)',
    label: 'Scenario Mode',
  },
  regulatory: {
    accent: '#d14334',
    softBg: '#fff1ef',
    softBorder: 'rgba(209,67,52,0.35)',
    label: 'Regulatory Mode',
  },
  general: {
    accent: '#475569',
    softBg: '#f1f5f9',
    softBorder: 'rgba(71,85,105,0.35)',
    label: 'Research Mode',
  },
};

export function getTheme(intent: string | null | undefined): IntentTheme {
  if (!intent) return INTENT_THEME.general;
  return INTENT_THEME[(intent as AgentIntent)] || INTENT_THEME.general;
}
