import { apiFetch, apiPost } from '@/lib/api/client';
import type { StrategyDraft, StrategyEditorState } from '@/lib/types/portfolio';

export async function getStrategyEditorState(): Promise<StrategyEditorState> {
  return apiFetch<StrategyEditorState>('/portfolio/strategy/editor', { revalidate: 15 });
}

export async function saveStrategyDraft(payload: {
  name: string;
  description: string;
  ctaLabel?: string;
  source?: string;
  notes?: string;
  objective?: string;
  time_horizon?: string;
  risk_profile?: string;
  rebalance_rule?: string;
  max_drawdown_pct?: number | null;
  max_single_position_pct?: number | null;
  max_sector_exposure_pct?: number | null;
  stop_loss_rule?: string;
  entry_rule?: string;
  validation_metrics?: string[];
  allocation_targets?: Record<string, number>;
  suggested_actions?: string[];
}): Promise<StrategyDraft> {
  return apiPost<StrategyDraft>('/portfolio/strategy/draft', payload);
}

export async function acceptStrategyDraft(): Promise<{
  currentStrategy: {
    name: string;
    description: string;
    ctaLabel: string;
    source?: string;
    accepted_at?: string;
  };
  allocation: Array<{
    id: string;
    label: string;
    icon: string;
    currentPercent: number;
    targetPercent: number;
    status: 'OVERWEIGHT' | 'UNDERWEIGHT' | 'ALIGNED';
  }>;
  message: string;
  error?: string;
}> {
  return apiPost('/portfolio/strategy/accept', {});
}
