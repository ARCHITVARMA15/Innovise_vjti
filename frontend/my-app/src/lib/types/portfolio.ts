// ─── Portfolio Page Types ──────────────────────────────────────────────────────
// Backend alignment notes (base URL: http://localhost:8000):
//
// - Diversification score: computed server-side from holdings via POST /yf/batch-quotes
// - Allocation ratios: computed from holdings categories + fundamentals
//   GET /yf/fundamentals/{symbol} → sector info to bucket into asset classes
// - Rebalancing recommendations: derived from current vs target allocation deltas
// - Strategy: user profile data (stored in own DB, not yfinance)
// - Goals: user profile data (stored in own DB, not yfinance)
// ─────────────────────────────────────────────────────────────────────────────

// ─── Diversification ──────────────────────────────────────────────────────────

export type DiversificationGrade = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';

export interface DiversificationScore {
  score: number;               // 0–100
  grade: DiversificationGrade;
  headline: string;            // e.g. "Your portfolio is well-defended..."
  body: string;                // detailed explanation
  tags: string[];              // e.g. ["LOW RISK", "BALANCED GROWTH"]
  sectorCount: number;         // e.g. 12
  assetClassCount: number;     // e.g. 4
}

// ─── Current Strategy ────────────────────────────────────────────────────────

export interface CurrentStrategy {
  name: string;       // e.g. "Moderate Growth"
  description: string;
  ctaLabel: string;
  source?: string;
  accepted_at?: string;
}

export interface StrategyDraft {
  name: string;
  description: string;
  ctaLabel: string;
  source: string;
  status: 'draft';
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
  created_at?: string | null;
}

export interface StrategyEditorState {
  currentStrategy: CurrentStrategy;
  draftStrategy: StrategyDraft | null;
  hasDraft: boolean;
  updated_at: string;
}

// ─── Asset Allocation Ratios ──────────────────────────────────────────────────
// current values derived from POST /yf/batch-quotes → aggregate by asset class
// target values stored in user profile

export type AllocationStatus = 'OVERWEIGHT' | 'UNDERWEIGHT' | 'ALIGNED';

export interface AllocationCategory {
  id: string;
  label: string;               // e.g. "Domestic Equity"
  icon: string;                // material symbol name
  currentPercent: number;      // e.g. 52
  targetPercent: number;       // e.g. 45
  status: AllocationStatus;
}

// ─── Rebalancing Recommendations ─────────────────────────────────────────────
// Derived from allocation deltas; action amounts are computed values

export type RebalanceAction = 'SELL' | 'BUY' | 'REALLOC';

export interface RebalanceRecommendation {
  id: string;
  action: RebalanceAction;
  title: string;               // e.g. "Reduce Information Technology"
  subtitle: string;            // e.g. "Current overweight by 7.2% (₹14,500)"
  amount: number;              // currency amount (INR)
  ctaLabel: string;            // e.g. "VIEW POSITIONS"
}

// ─── Strategy Advisor ─────────────────────────────────────────────────────────

export interface StrategyAdvisorRecommendation {
  label: string;               // e.g. "Aggressive Growth"
  rationale: string;
  expectedReturnPA: number;    // e.g. 12.4
  riskLevel: 'Low' | 'Medium' | 'High';
  horizonYears: string;        // e.g. "15+ Years"
  equitySplit: number;         // e.g. 85 (equity %)
  bondSplit: number;           // e.g. 15 (bond %)
}

// ─── Goal Trackers ────────────────────────────────────────────────────────────

export type GoalStatus = 'On Track' | 'Early stage' | 'Behind' | 'Achieved';

export interface GoalTracker {
  id: string;
  icon: string;                // material symbol name
  iconBg: string;              // hex bg color for icon pill
  iconColor: string;           // hex color
  label: string;               // e.g. "RETIREMENT 2045"
  currentValue: number;        // e.g. 1240000
  targetValue: number;         // e.g. 3500000
  progressPercent: number;     // e.g. 35.4
  status: GoalStatus;
  statusColor: string;         // hex for status text
  ctaLabel?: string;           // optional nudge, e.g. "Increase contributions"
  progressBarColor: string;    // hex
}

// ─── Full Portfolio Page Payload ──────────────────────────────────────────────
// Aggregated shape for GET /api/portfolio (to be built on backend)
// Composed from:
//   - POST /yf/batch-quotes (all holding tickers) → diversification + allocation
//   - GET /yf/fundamentals/{symbol} → sector bucketing
//   - User profile DB → strategy, goals, targets

export interface PortfolioData {
  diversification: DiversificationScore;
  currentStrategy: CurrentStrategy;
  allocation: AllocationCategory[];
  rebalancing: RebalanceRecommendation[];
  strategyAdvisor: StrategyAdvisorRecommendation;
  goals: GoalTracker[];
}
