# Veritas Research Agent — Complete System Architecture

> **Source of Truth** for the Veritas AI Research Agent. Read this fully before implementing.
> Last updated: 2026-03-28

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Design Decisions Summary](#2-design-decisions-summary)
3. [Tech Stack & Dependencies](#3-tech-stack--dependencies)
4. [Project Structure](#4-project-structure)
5. [LangGraph Agent Architecture](#5-langgraph-agent-architecture)
6. [Agent State Schema](#6-agent-state-schema)
7. [Router Node](#7-router-node--intent-classification)
8. [Subgraph Definitions](#8-subgraph-definitions)
9. [Tool Definitions](#9-tool-definitions)
10. [System Prompts](#10-system-prompts)
11. [Token Budget & Optimization](#11-token-budget--optimization)
12. [SSE Streaming Protocol](#12-sse-streaming-protocol)
13. [FastAPI Endpoints](#13-fastapi-endpoints)
14. [Frontend Command Center UI](#14-frontend--command-center-ui)
15. [Multi-Turn Session Memory](#15-multi-turn-session-memory)
16. [Error Handling & Resilience](#16-error-handling--resilience)
17. [Caching Strategy](#17-caching-strategy)
18. [Environment Variables](#18-environment-variables)
19. [Implementation Order](#19-implementation-order)

---

## 1. System Overview

**Veritas** is an autonomous financial research agent embedded in the CodeCrafters platform. It lives on the **Insights page** as a command-center UI: chat panel on the left, dynamic context panel on the right showing sources/charts/data the agent references.

### Core Capabilities

| # | Capability | Description |
|---|-----------|-------------|
| 1 | **False Information Verification** | Cross-references news from multiple sources, flags contradictions, assigns confidence |
| 2 | **Stock/Commodity/Bond Analysis** | Fundamental + technical overview using live market data |
| 3 | **Investment Strategy Advisor** | Personalized strategy using user's portfolio context |
| 4 | **What-If / Cause Chain Analysis** | Scenario simulation with historical precedents and causal chains |

### High-Level Data Flow

```
Frontend (Next.js)                    Backend (FastAPI)
┌────────────────┐                   ┌──────────────────────────────┐
│ Insights Page   │  POST /agent/chat │  LangGraph Agent Graph       │
│ Command Center  │ ──── SSE ───────> │                              │
│                 │ <──── stream ──── │  [ROUTER] → [SUBGRAPH] → END │
│ Chat | Context  │                   │       │                      │
└────────────────┘                   │       ├── verify_news         │
                                      │       ├── analyze_asset       │
                                      │       ├── strategy_advisor    │
                                      │       ├── what_if             │
                                      │       └── general_research    │
                                      │                              │
                                      │  TOOLS (Python functions):   │
                                      │  - yfinance_service          │
                                      │  - news_service (Finnhub)    │
                                      │  - DuckDuckGo search         │
                                      │  - portfolio_service         │
                                      │  - markets_service           │
                                      │  - nse_service               │
                                      │                              │
                                      │  EXTERNAL (all free):        │
                                      │  - Groq API (Llama 3.3 70B) │
                                      │  - yfinance (no key)         │
                                      │  - Finnhub (free tier)       │
                                      │  - NSE India API (no key)    │
                                      │  - DuckDuckGo (no key)       │
                                      └──────────────────────────────┘
```

---

## 2. Design Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Primary LLM | **Llama 3.3 70B** via Groq | Best free reasoning quality |
| Router LLM | **Llama 3.1 8B** via Groq | Fast, cheap intent classification |
| Agent framework | **LangGraph** | Explicit state graph, token control, conditional routing |
| Streaming | **SSE (Server-Sent Events)** | Simple, works with fetch(), standard for AI chat |
| Portfolio context | **Only when relevant** | Router detects need. Saves ~300 tokens on non-portfolio queries |
| Conversation memory | **Multi-turn session** | Server-side dict, last 3 turns injected. Session TTL = 2 hours |
| Web search | **DuckDuckGo** | Free, no API key needed |
| Agent name | **Veritas** | Latin for "truth" — aligns with verification USP |
| UI layout | **Command Center** | Split: chat (60% left) + context panel (40% right) |
| Token budget | **10,000–12,000 per full run** | Fits 3–4 tool iterations + synthesis |

---

## 3. Tech Stack & Dependencies

### New Backend Dependencies (add via `uv add`)

```
langgraph>=0.4.1
langchain-groq>=0.3.2
langchain-core>=0.3.40
duckduckgo-search>=7.5.0
sse-starlette>=2.2.1
```

| Package | Why |
|---------|-----|
| `langgraph` 0.4.1+ | StateGraph, conditional edges, async streaming |
| `langchain-groq` 0.3.2+ | ChatGroq with tool calling + JSON mode |
| `langchain-core` 0.3.40+ | @tool decorator, message types |
| `duckduckgo-search` 7.5+ | Free web search, no API key |
| `sse-starlette` 2.2+ | SSE support for FastAPI |

### Frontend — No new npm packages needed

SSE consumed via native `fetch()` + `ReadableStream`. Markdown rendering via existing setup or add `react-markdown` if not present.

---

## 4. Project Structure

### New Backend Files

```
backend/app/agent/                    # NEW directory
├── __init__.py                       # Exports create_agent_graph()
├── graph.py                          # LangGraph StateGraph definition
├── state.py                          # AgentState TypedDict
├── config.py                         # Constants, model names, safe_llm_call helper
├── session.py                        # In-memory session store for multi-turn
├── nodes/
│   ├── __init__.py
│   ├── router.py                     # Intent classification (Llama 8B)
│   ├── verify_news.py                # News verification subgraph
│   ├── analyze_asset.py              # Asset analysis subgraph
│   ├── strategy_advisor.py           # Portfolio strategy subgraph
│   ├── what_if.py                    # What-if / cause chain subgraph
│   └── general_research.py           # Catch-all general queries
├── tools/
│   ├── __init__.py
│   ├── market_data.py                # Wraps yfinance_service + nse_service
│   ├── news_tools.py                 # Wraps news_service
│   ├── web_search.py                 # DuckDuckGo wrapper
│   ├── portfolio_tools.py            # Wraps portfolio_service
│   └── market_overview.py            # Wraps markets_service
└── prompts/
    ├── __init__.py
    ├── system.py                     # Veritas identity prompt
    ├── router_prompt.py              # Intent classifier prompt
    ├── verify_prompt.py              # Verification prompt
    ├── analyze_prompt.py             # Analysis prompt
    ├── strategy_prompt.py            # Strategy prompt
    └── what_if_prompt.py             # What-if prompt
```

### New Frontend Files

```
frontend/my-app/src/app/insights/     # NEW directory
├── layout.tsx                        # Insights page layout
├── page.tsx                          # Main command center page
└── components/
    ├── ChatPanel.tsx                 # Left panel: messages + input
    ├── ContextPanel.tsx              # Right panel: sources + data
    ├── MessageBubble.tsx             # Single chat message
    ├── ThinkingStep.tsx              # Agent thinking indicator
    ├── QuickActions.tsx              # Preset action buttons
    ├── SourceCard.tsx                # Source reference card
    ├── DataCard.tsx                  # Live data card
    └── VerificationBadge.tsx         # Verified/false badge

frontend/my-app/src/lib/
├── api/agent.ts                      # NEW: SSE client
└── types/agent.ts                    # NEW: TypeScript types
```

---

## 5. LangGraph Agent Architecture

### Graph Topology

```
START
  │
  ▼
[ROUTER] ──── Llama 8B classifies intent (~300 tokens)
  │
  ├── "verify"   → [VERIFY_NEWS]
  ├── "analyze"  → [ANALYZE_ASSET]
  ├── "strategy" → [STRATEGY_ADVISOR]
  ├── "what_if"  → [WHAT_IF]
  └── "general"  → [GENERAL_RESEARCH]
  │
  ▼
END (answer is produced inside the subgraph node itself)
```

**Key design choice**: Each subgraph node produces the final answer directly. There is NO separate "synthesize" node. This saves one entire LLM call (~1500 tokens). The subgraph node calls tools in Python, then makes ONE Llama 70B call that both reasons and produces the answer.

### Graph Definition

```python
# app/agent/graph.py
from langgraph.graph import StateGraph, START, END
from app.agent.state import AgentState

def create_agent_graph():
    graph = StateGraph(AgentState)

    graph.add_node("router", router_node)
    graph.add_node("verify_news", verify_news_node)
    graph.add_node("analyze_asset", analyze_asset_node)
    graph.add_node("strategy_advisor", strategy_advisor_node)
    graph.add_node("what_if", what_if_node)
    graph.add_node("general_research", general_research_node)

    graph.add_edge(START, "router")
    graph.add_conditional_edges("router", route_by_intent, {
        "verify": "verify_news",
        "analyze": "analyze_asset",
        "strategy": "strategy_advisor",
        "what_if": "what_if",
        "general": "general_research",
    })

    # All subgraphs go directly to END
    for node in ["verify_news","analyze_asset","strategy_advisor","what_if","general_research"]:
        graph.add_edge(node, END)

    return graph.compile()

def route_by_intent(state: AgentState) -> str:
    return state["intent"]
```

---

## 6. Agent State Schema

```python
# app/agent/state.py
from typing import TypedDict, Literal, Any

class SourceReference(TypedDict):
    type: Literal["news", "market_data", "web_search", "portfolio", "filing"]
    title: str
    url: str | None
    snippet: str
    confidence: float | None

class DataSnapshot(TypedDict):
    type: Literal["stock_quote", "metric", "chart_data", "sentiment", "portfolio_summary"]
    label: str
    data: dict[str, Any]

class ThinkingStep(TypedDict):
    step: str
    tool: str | None
    status: Literal["running", "done", "error"]

class AgentState(TypedDict):
    # Input
    query: str
    session_id: str
    conversation_history: list[dict[str, str]]

    # Router output
    intent: Literal["verify", "analyze", "strategy", "what_if", "general"]
    intent_confidence: float
    entities: list[str]
    needs_portfolio: bool

    # Scratchpad (accumulated by subgraph nodes)
    tool_results: list[dict[str, Any]]
    tool_summaries: list[str]
    sources: list[SourceReference]
    data_snapshots: list[DataSnapshot]
    thinking_steps: list[ThinkingStep]

    # Output
    answer: str
    verification_result: dict[str, Any] | None
    error: str | None
```

---

## 7. Router Node — Intent Classification

Uses **Llama 3.1 8B** for fast, cheap classification (~300 tokens total).

### Router Prompt

```python
# app/agent/prompts/router_prompt.py
ROUTER_SYSTEM_PROMPT = """You are an intent classifier for a financial research assistant.
Classify the query into exactly ONE intent:

- "verify": Check if news/info is true or false. Keywords: verify, true, fake, confirm, rumor.
- "analyze": Analysis of stock/commodity/bond/market. Keywords: analyze, overview, fundamentals, price.
- "strategy": Investment advice, portfolio changes. Keywords: strategy, invest, rebalance, allocation.
- "what_if": Hypothetical scenarios, causal chains. Keywords: what if, what would happen, why is, impact.
- "general": Anything else.

Extract entities (tickers, company names, topics).
Determine if portfolio context is needed (only for strategy/personalized questions).

Respond ONLY with this JSON, no other text:
{"intent":"...","confidence":0.0,"entities":["..."],"needs_portfolio":false}"""
```

### Router Node Implementation

```python
# app/agent/nodes/router.py
from app.agent.config import safe_llm_call, ROUTER_MODEL
import json

async def router_node(state: AgentState) -> dict:
    context = ""
    if state.get("conversation_history"):
        last = state["conversation_history"][-2:]
        context = "\nRecent:\n" + "\n".join(f"{t['role']}: {t['content'][:150]}" for t in last)

    result = await safe_llm_call(
        messages=[
            {"role": "system", "content": ROUTER_SYSTEM_PROMPT},
            {"role": "user", "content": f"{context}\nQuery: {state['query']}"},
        ],
        model=ROUTER_MODEL,
        max_tokens=100,
    )

    try:
        parsed = json.loads(result.strip())
    except json.JSONDecodeError:
        parsed = {"intent": "general", "confidence": 0.5, "entities": [], "needs_portfolio": False}

    return {
        "intent": parsed["intent"],
        "intent_confidence": parsed.get("confidence", 0.8),
        "entities": parsed.get("entities", []),
        "needs_portfolio": parsed.get("needs_portfolio", False),
        "thinking_steps": [{"step": f"Intent: {parsed['intent']} ({parsed.get('confidence',0.8):.0%})", "tool": None, "status": "done"}],
    }
```

---

## 8. Subgraph Definitions

**Every subgraph follows the same pattern:**
1. Call 1-3 tools via Python (zero LLM tokens)
2. Summarize tool results in Python (truncation/extraction)
3. Make ONE Llama 70B call with summarized data → produces the answer
4. Return sources, data_snapshots, thinking_steps, and answer

### 8.1 Verify News Node

```
Pipeline:
1. get_news_for_entities(entities) → Finnhub news → summarize (~300 tokens)
2. web_search(query) → DuckDuckGo → summarize (~300 tokens)
3. ONE Llama 70B call: system=VERIFY_PROMPT, user=[news_summary + web_summary + claim]
   max_tokens=800, output: verdict + confidence + evidence
```

The LLM output must include: verdict emoji (✅/⚠️/❌/🔍), confidence %, supporting evidence, contradicting evidence.

### 8.2 Analyze Asset Node

```
Pipeline:
1. get_asset_data(entities) → yfinance quote + fundamentals → summarize (~400 tokens)
2. get_news_for_entities(entities, limit=3) → recent news → summarize (~150 tokens)
3. ONE Llama 70B call: system=ANALYZE_PROMPT, user=[market_data + news_brief + query]
   max_tokens=1000, output: price action, fundamentals, catalysts, outlook
```

### 8.3 Strategy Advisor Node

```
Pipeline:
1. get_portfolio_context() → holdings + summary + allocation → summarize (~300 tokens)
2. get_market_conditions() → indices + sectors + signals → summarize (~200 tokens)
3. ONE Llama 70B call: system=STRATEGY_PROMPT, user=[portfolio + market + query]
   max_tokens=1200, output: assessment, recommendations, action items
```

### 8.4 What-If / Cause Chain Node

```
Pipeline:
1. web_search("historical impact {scenario}") → DuckDuckGo → summarize (~400 tokens)
2. get_asset_data(entities) if any → yfinance → summarize (~300 tokens)
3. ONE Llama 70B call: system=WHAT_IF_PROMPT, user=[precedents + market_data + scenario]
   max_tokens=1200, output: cause chain (immediate → secondary → long-term), affected assets
```

### 8.5 General Research Node

```
Pipeline:
1. web_search(query, max=3) → DuckDuckGo → summarize (~200 tokens)
2. get_asset_data(entities) if tickers found → summarize (~200 tokens)
3. ONE Llama 70B call: system=GENERAL_PROMPT, user=[search + data + query]
   max_tokens=800
```

---

## 9. Tool Definitions

Tools are **Python functions** called directly by subgraph nodes. NOT LangChain tools invoked via LLM function-calling (saves token overhead).

### 9.1 market_data.py

```python
# Key functions:
def get_asset_data(entities: list[str]) -> dict
    # Calls yfinance_service.get_stock_quote() + get_stock_fundamentals()
    # Falls back to nse_service for Indian tickers
    # Returns normalized dict with key metrics

def summarize_market_data(data: dict) -> str
    # Extracts: price, change%, volume, mcap, PE, EPS, 52wH/L, sector
    # One line per ticker. Target: ~300-400 tokens

def normalize_ticker(entity: str) -> str
    # "RELIANCE" → "RELIANCE.NS", "Apple" → "AAPL"
    # Common Indian stocks list for auto-suffix
```

### 9.2 news_tools.py

```python
def get_news_for_entities(entities: list[str], limit=5) -> list[dict]
    # Calls news_service.get_ticker_news() for each entity
    # Falls back to news_service.get_news() if no ticker matches
    # Deduplicates by article id

def summarize_news_results(news: list[dict], max_items=5) -> str
    # Format: "1. [Source, Date] Headline (Sentiment: X) — Summary"
    # Target: ~200-300 tokens
```

### 9.3 web_search.py

```python
async def web_search(query: str, max_results=5) -> list[dict]
    # Uses duckduckgo_search.DDGS().text()
    # Returns [{title, url, snippet}]
    # Wrapped in try/except, returns error dict on failure

def summarize_search_results(results: list[dict], max_items=5) -> str
    # Format: "1. Title\n   Snippet\n   Source: URL"
    # Target: ~200-400 tokens
```

### 9.4 portfolio_tools.py

```python
def get_portfolio_context() -> dict
    # Calls portfolio_service + portfolio_analysis_service
    # Returns: {holdings, summary, strategy, allocation, diversification}

def summarize_portfolio(portfolio: dict) -> str
    # Extracts: total value, P&L, cash, strategy, diversification, top 8 holdings
    # Target: ~250-350 tokens
```

### 9.5 market_overview.py

```python
def get_market_conditions() -> dict
    # Calls markets_service: indices, sectors, signals
    # Returns combined dict

def summarize_market_conditions(data: dict) -> str
    # Extracts: 4 indices + 3 top sectors + active signals
    # Target: ~150-200 tokens
```

---

## 10. System Prompts

### Veritas Identity (base, injected into all 70B calls)

```
You are Veritas, an autonomous financial research agent.
Core traits:
- Verify before you trust. Cross-reference data, question narratives.
- Concise and direct. No filler. State findings clearly.
- Cite sources. Mention where data came from.
- Acknowledge uncertainty. Say so if data is insufficient.
- Think like an investor. Focus on risk, opportunity, timing.

Current date: {date}

Format: markdown, under 300 words, bullet points, tables for comparisons.
Always end with a clear takeaway.
```

### Verify Prompt

```
You are Veritas in VERIFICATION MODE.
Determine if a claim is:
✅ VERIFIED | ⚠️ PARTIALLY VERIFIED | ❌ UNVERIFIED/FALSE | 🔍 INCONCLUSIVE

For each verdict provide:
1. Verdict with emoji
2. Confidence percentage (0-100%)
3. Supporting evidence with source names
4. Contradicting evidence if any
5. Caveats or limitations
```

### Analyze Prompt

```
Provide structured analysis:
1. Current Price Action (price, change, vs 52-week range)
2. Key Fundamentals (PE, EPS, mcap — over/undervalued?)
3. Recent Catalysts (news/events driving the stock)
4. Technical View (bullish/bearish/neutral from data)
5. Outlook (short 1-4 weeks, medium 1-6 months)
```

### Strategy Prompt

```
You have the user's portfolio. Give PERSONALIZED advice:
1. Portfolio Assessment (strengths/weaknesses)
2. Market Context (conditions influencing decisions)
3. Specific Recommendations (buy/sell/hold with exact tickers and reasons)
4. Risk Considerations
5. Numbered Action Items
Be specific: "reduce RELIANCE.NS from 45% to 30%" not "consider diversifying".
```

### What-If Prompt

```
Build a CAUSE-EFFECT CHAIN:
1. Scenario Summary
2. Historical Parallel (closest precedent, what happened)
3. Immediate Impact (0-1 week)
4. Secondary Effects (1-4 weeks)
5. Long-term Implications (1-6 months)
6. Most Affected Assets (tickers, positive and negative)
7. Probability Assessment
```

---

## 11. Token Budget & Optimization

### Per-Run Breakdown

| Phase | Tokens | Notes |
|-------|--------|-------|
| Router (Llama 8B) | ~300 | System + query → JSON |
| Tool calls (Python) | 0 | No LLM tokens |
| Tool summarization (Python) | 0 | String processing |
| Subgraph LLM reasoning (70B) | ~2000-3000 | System + summaries → answer |
| History context (if multi-turn) | ~150-300 | Last 2 exchanges |
| **TOTAL (simple)** | **~2500-3300** | Router + 1 subgraph |
| **TOTAL (with history)** | **~3500-4500** | + multi-turn context |
| **TOTAL (worst case)** | **~6000-8000** | Strategy with full portfolio |

**Well within 10-12k budget.** Leaves room for longer conversations.

### Key Optimization Techniques

1. **Python-side summarization**: Raw yfinance JSON (~5000 tokens) → `summarize_market_data()` → ~300 tokens
2. **No LLM tool-calling schema overhead**: Tools called directly in Python, not via function-calling protocol
3. **Router uses 8B model**: Classification costs ~300 tokens, not ~2000
4. **Single LLM call per subgraph**: ONE 70B call that both reasons and produces answer
5. **max_tokens caps on every call**: Router=100, Subgraph=800-1200
6. **History truncation**: MAX_TURN_CHARS=500, last 3 turns only
7. **Entity limit**: Max 3 tickers per query to limit tool call volume

---

## 12. SSE Streaming Protocol

### Event Types (JSON over SSE)

```typescript
type SSEEvent =
  | { type: "thinking"; step: string; tool: string|null; status: "running"|"done"|"error" }
  | { type: "source"; source: SourceReference }
  | { type: "data_snapshot"; snapshot: DataSnapshot }
  | { type: "answer_start" }
  | { type: "answer_chunk"; content: string }
  | { type: "answer_end" }
  | { type: "verification"; result: { verdict: string; confidence: number } }
  | { type: "done"; total_tokens: number; duration_ms: number }
  | { type: "error"; message: string }
```

### Event Sequence Example (Verify Query)

```
→ thinking: "Classifying query..." (running)
→ thinking: "Intent: verify (92%)" (done)
→ thinking: "Searching news for RELIANCE..." (running)
→ source: {type:"news", title:"RELIANCE Q4 beats estimates", ...}
→ thinking: "Searching news..." (done)
→ thinking: "Cross-referencing web sources..." (running)
→ source: {type:"web_search", title:"Moneycontrol report", ...}
→ thinking: "Cross-referencing..." (done)
→ thinking: "Analyzing consistency..." (running)
→ answer_start
→ answer_chunk: "## ✅ VERIFIED (87%)\n\n"
→ answer_chunk: "The claim that RELIANCE..."
→ answer_end
→ verification: {verdict:"verified", confidence:87}
→ done: {total_tokens:4200, duration_ms:3400}
```

### Backend SSE Endpoint

```python
# Uses sse-starlette EventSourceResponse
# Graph runs with astream(stream_mode="updates")
# Each node_output is inspected for thinking_steps, sources, data_snapshots
# Answer is chunked into 50-char pieces for typewriter effect
# Session history updated after completion
```

### Frontend SSE Client

```typescript
// lib/api/agent.ts
// Uses fetch() POST with ReadableStream reader
// Parses "data: {...}" lines from SSE stream
// Dispatches to callbacks: onThinking, onSource, onAnswerChunk, etc.
// Supports AbortSignal for cancellation
```

---

## 13. FastAPI Endpoints

### New Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/agent/chat` | SSE stream — main agent endpoint |
| GET | `/agent/sessions` | List active sessions |
| DELETE | `/agent/session/{id}` | Clear a session |
| GET | `/agent/health` | Check Groq connectivity |

### Request/Response

```python
class AgentChatRequest(BaseModel):
    query: str                          # User's question
    session_id: str = "default"         # For multi-turn

# Response: SSE stream (EventSourceResponse)
```

---

## 14. Frontend — Command Center UI

### Layout

```
┌─────────────────────────────────────────────────────────┐
│ SharedTopNav                                             │
├─────────────────────────────────────────────────────────┤
│ ┌─ Quick Actions ──────────────────────────────────────┐│
│ │ [🔍 Verify News] [📊 Analyze] [🎯 Strategy] [🔮 What If] ││
│ └──────────────────────────────────────────────────────┘│
│ ┌── Chat (60%) ───────────┐ ┌── Context (40%) ────────┐│
│ │ Veritas status bar       │ │ 📌 Sources (N)          ││
│ │                          │ │ ┌─SourceCard──────────┐ ││
│ │ User: message            │ │ │ Reuters · 92%       │ ││
│ │                          │ │ └────────────────────┘ ││
│ │ 🔄 Thinking steps...     │ │ 📊 Live Data            ││
│ │                          │ │ ┌─DataCard───────────┐ ││
│ │ Veritas: answer (md)     │ │ │ RELIANCE ₹2450     │ ││
│ │                          │ │ └────────────────────┘ ││
│ ├──────────────────────────┤ │                         ││
│ │ [Type question...]     ⏎ │ │ VerificationBadge      ││
│ └──────────────────────────┘ └─────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

### Components

| Component | Responsibility |
|-----------|---------------|
| `page.tsx` | Two-column layout, shared state (messages, sources, isStreaming), session_id generation |
| `ChatPanel.tsx` | Message history, thinking steps, input field, auto-scroll, markdown rendering |
| `ContextPanel.tsx` | Sources list, data cards, verification badge. Animates new items in |
| `MessageBubble.tsx` | Single message. User = right-aligned dark. Agent = left-aligned with markdown |
| `ThinkingStep.tsx` | Animated dot + step text. Green check when done, red X on error |
| `QuickActions.tsx` | 4 preset buttons. Each opens mini-input or sends preset query |
| `SourceCard.tsx` | Title, snippet, confidence bar, link icon. Colored by source type |
| `DataCard.tsx` | Ticker, price, change%, key metrics. Compact card format |
| `VerificationBadge.tsx` | Large verdict badge (✅/❌/⚠️) with confidence ring. Only for verify intent |

### Styling

Follow existing project patterns:
- Manrope for headings, Inter for body
- Color palette: `#131b2e` dark, `#006591` accent, `#39b8fd` highlight, `#4edea3` positive, `#ba1a1a` negative
- Rounded corners (xl), subtle shadows, white cards

---

## 15. Multi-Turn Session Memory

### Server-Side Session Store

```python
# app/agent/session.py
# In-memory dict keyed by session_id
# Config:
#   MAX_HISTORY_TURNS = 6 (3 user + 3 assistant)
#   MAX_TURN_CHARS = 500 (truncate each message)
#   SESSION_TTL_HOURS = 2

# Methods:
#   get_history(session_id) → list[{role, content}]
#   add_turn(session_id, role, content)
#   clear(session_id)
#   list_sessions()
#   _cleanup_expired()
```

### How History is Injected

History is added to the **subgraph LLM call** user message (not system prompt):

```
Conversation context:
User: {previous question, truncated to 200 chars}
Veritas: {previous answer, truncated to 200 chars}

Current query: {current question}
```

Token cost: ~150-300 tokens for 2 previous exchanges.

### Frontend Session Management

- `session_id` generated on page mount: `veritas-{Date.now()}-{random}`
- Stored in React state (not localStorage — fresh session per page visit)
- "New Chat" button clears session via `DELETE /agent/session/{id}`

---

## 16. Error Handling & Resilience

| Error | Handling |
|-------|----------|
| Groq 429 (rate limit) | Retry 2x with exponential backoff. Emit thinking: "Rate limited, retrying..." |
| Groq 503 (overloaded) | Fallback to Llama 8B for reasoning (lower quality but works) |
| Groq timeout | SSE error event. Frontend shows "Agent timed out" |
| yfinance failure | Return partial results. Note "Could not fetch data for {ticker}" |
| Finnhub failure | Skip news, use web search only. Note limitation |
| DuckDuckGo failure | Skip web search. Proceed with available data |
| Router JSON parse error | Default to intent="general". Log error |
| Invalid session_id | Create new session automatically |

### safe_llm_call helper

```python
# app/agent/config.py
# Wraps every LLM call with:
# - try/except
# - 2 retries on rate limit (429)
# - fallback_model option for 503
# - explicit timeout
# - Returns content string or error message string
```

---

## 17. Caching Strategy

| Data | Cache Duration | Where |
|------|---------------|-------|
| News articles | 15 min (existing Finnhub TTL) | `news_data/` JSON files (already implemented) |
| Market data (yfinance) | 5 min (existing) | `portfolio.json` cache (already implemented) |
| Web search results | No cache | Fresh every query (queries are unique) |
| Portfolio data | No cache | Always fresh from `portfolio.json` |
| Router classification | No cache | Different every query |
| Agent sessions | 2 hour TTL | In-memory dict |

No new caching infrastructure needed. Existing caches in news_service and markets_service are reused.

---

## 18. Environment Variables

### New Variables (add to `.env`)

```env
# Required
GROQ_API_KEY=gsk_xxxxxxxxxxxxx

# Already existing (no changes)
FINNHUB_API_KEY=xxxxx
```

That's it. Only **one new env var**: `GROQ_API_KEY`. DuckDuckGo needs no key. yfinance needs no key. NSE needs no key.

### Config Constants

```python
# app/agent/config.py
PRIMARY_MODEL = "llama-3.3-70b-versatile"     # Main reasoning
ROUTER_MODEL = "llama-3.1-8b-instant"         # Fast classification
PRIMARY_MAX_TOKENS = 1200                       # Max output per subgraph
ROUTER_MAX_TOKENS = 100                         # Max output for router
MAX_ENTITIES_PER_QUERY = 3                      # Limit tool calls
MAX_RETRIES = 2                                 # LLM retry count
RETRY_DELAY_BASE = 2                            # Seconds, exponential
```

---

## 19. Implementation Order

Build and test in this exact sequence:

### Phase 1: Backend Agent Core (Day 1)

```
1. uv add langgraph langchain-groq langchain-core duckduckgo-search sse-starlette
2. Create app/agent/config.py (constants + safe_llm_call)
3. Create app/agent/state.py (AgentState TypedDict)
4. Create app/agent/prompts/ (all prompt files)
5. Create app/agent/tools/ (all tool wrappers — test each independently)
6. Create app/agent/nodes/router.py (test with sample queries)
7. Create app/agent/nodes/ (all 5 subgraph nodes)
8. Create app/agent/graph.py (wire everything together)
9. Create app/agent/session.py (session store)
10. Test graph end-to-end: python -c "import asyncio; from app.agent.graph import ..."
```

### Phase 2: FastAPI Integration (Day 1-2)

```
11. Add AgentChatRequest model to main.py
12. Add POST /agent/chat SSE endpoint
13. Add GET /agent/health endpoint
14. Add GET /agent/sessions + DELETE /agent/session/{id}
15. Test with curl: curl -N -X POST localhost:8000/agent/chat -d '{"query":"Analyze RELIANCE"}'
16. Update backend_doc.md with new endpoints
```

### Phase 3: Frontend Command Center (Day 2-3)

```
17. Create lib/types/agent.ts (TypeScript types)
18. Create lib/api/agent.ts (SSE client)
19. Create app/insights/layout.tsx
20. Create app/insights/page.tsx (main layout + state management)
21. Create ChatPanel.tsx + MessageBubble.tsx
22. Create ContextPanel.tsx + SourceCard.tsx + DataCard.tsx
23. Create ThinkingStep.tsx
24. Create QuickActions.tsx
25. Create VerificationBadge.tsx
26. Add "Insights" link to SharedTopNav
27. End-to-end test: all 4 capabilities through the UI
```

### Phase 4: Polish (Day 3)

```
28. Test all 4 demo scenarios thoroughly
29. Handle edge cases (empty portfolio, no news, rate limits)
30. Tune prompts for best output quality
31. Verify token usage stays within budget
32. Final UI polish (animations, loading states, empty states)
```

---

## Appendix: Demo Scenarios to Test

| # | Query | Expected Intent | Expected Tools | Token Estimate |
|---|-------|----------------|----------------|---------------|
| 1 | "Is it true that RELIANCE Q4 earnings beat estimates?" | verify | news + web_search | ~4000 |
| 2 | "Analyze NVDA stock for me" | analyze | yfinance + news | ~3500 |
| 3 | "Should I rebalance my portfolio?" | strategy | portfolio + markets | ~5000 |
| 4 | "What if a war starts in Saudi Arabia?" | what_if | web_search + yfinance | ~5000 |
| 5 | "What is a PE ratio?" | general | web_search | ~2500 |
| 6 | Follow-up: "How does it compare to TCS?" | analyze | yfinance (uses history) | ~4000 |

---

*This document is the single source of truth. Do not implement anything that contradicts it without updating it first.*
