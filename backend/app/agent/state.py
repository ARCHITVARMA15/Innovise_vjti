"""
Agent state schema — the single TypedDict that flows through the LangGraph.
"""

from typing import Any, Literal, TypedDict


class SourceReference(TypedDict):
    """A source the agent referenced during research."""
    type: Literal["news", "market_data", "web_search", "portfolio", "filing"]
    title: str
    url: str | None
    snippet: str
    confidence: float | None


class DataSnapshot(TypedDict):
    """A data card to display on the context panel."""
    type: Literal["stock_quote", "metric", "chart_data", "sentiment", "portfolio_summary"]
    label: str
    data: dict[str, Any]


class ThinkingStep(TypedDict):
    """An intermediate thinking step streamed to the frontend."""
    step: str
    tool: str | None
    status: Literal["running", "done", "error"]


class IterationTrace(TypedDict):
    """Structured trace item emitted per iteration/layer."""
    iteration: int
    layer: Literal["router", "execution", "synthesis"]
    intent: str
    summary: str
    confidence: float | None
    stop_reason: str | None
    timestamp: str


class EvidenceItem(TypedDict):
    """Structured evidence card for confidence and contradiction tracking."""
    id: str
    iteration: int
    intent: str
    source_type: Literal["news", "market_data", "web_search", "portfolio", "filing"]
    source_title: str
    source_url: str | None
    signal: Literal["supporting", "conflicting", "neutral"]
    rating: Literal["high", "medium", "low"]
    confidence: float
    recency_days: int | None
    quality_score: float
    rationale: str


class AgentState(TypedDict):
    # ── Input ──
    query: str
    session_id: str
    conversation_history: list[dict[str, str]]
    portfolio_context_enabled: bool

    # ── Router output ──
    intent: Literal["verify", "analyze", "strategy", "what_if", "regulatory", "general"]
    intent_confidence: float
    entities: list[str]
    needs_portfolio: bool

    # ── Scratchpad (accumulated by subgraph nodes) ──
    tool_results: list[dict[str, Any]]
    tool_summaries: list[str]
    sources: list[SourceReference]
    data_snapshots: list[DataSnapshot]
    thinking_steps: list[ThinkingStep]
    iteration: int
    max_iterations: int
    stop_reason: str | None
    traces: list[IterationTrace]
    iteration_outputs: list[dict[str, Any]]
    evidence_items: list[EvidenceItem]

    # ── Output ──
    answer: str
    verification_result: dict[str, Any] | None
    regulatory_result: dict[str, Any] | None
    error: str | None
