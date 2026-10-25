"""
Router node — classifies user intent using Llama 8B for fast, cheap classification.
"""

import json
import logging
from datetime import datetime, timezone

from app.agent.config import ROUTER_MODEL, ROUTER_MAX_TOKENS, ROUTER_TEMPERATURE, safe_llm_call
from app.agent.prompts.router_prompt import ROUTER_SYSTEM_PROMPT
from app.agent.state import AgentState

log = logging.getLogger("veritas.nodes.router")

_VALID_INTENTS = {"verify", "analyze", "strategy", "what_if", "regulatory", "general"}


async def router_node(state: AgentState) -> dict:
    """Classify user intent. ~300 tokens total."""

    context = ""
    if state.get("conversation_history"):
        last_turns = state["conversation_history"][-2:]
        context = "\nRecent conversation:\n" + "\n".join(
            f"{t['role'].upper()}: {t['content'][:150]}" for t in last_turns
        )

    user_message = f"{context}\nQuery: {state['query']}"

    try:
        result = await safe_llm_call(
            messages=[
                {"role": "system", "content": ROUTER_SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            model=ROUTER_MODEL,
            temperature=ROUTER_TEMPERATURE,
            max_tokens=ROUTER_MAX_TOKENS,
        )

        # Strip markdown fences if the model wraps its response
        cleaned = result.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[-1]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()

        parsed = json.loads(cleaned)
    except (json.JSONDecodeError, RuntimeError) as exc:
        log.warning("Router parse/call failed (%s). Defaulting to 'general'.", exc)
        parsed = {"intent": "general", "confidence": 0.5, "entities": [], "needs_portfolio": False}

    intent = parsed.get("intent", "general")
    if intent not in _VALID_INTENTS:
        intent = "general"

    return {
        "intent": intent,
        "intent_confidence": float(parsed.get("confidence", 0.8)),
        "entities": list(parsed.get("entities") or []),
        "needs_portfolio": bool(parsed.get("needs_portfolio", False)),
        "traces": [
            {
                "iteration": int(state.get("iteration", 0)) + 1,
                "layer": "router",
                "intent": intent,
                "summary": f"Router classified query as '{intent}'.",
                "confidence": float(parsed.get("confidence", 0.8)),
                "stop_reason": None,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        ],
        "iteration_outputs": [
            {
                "iteration": int(state.get("iteration", 0)) + 1,
                "layer": "router",
                "intent": intent,
                "entities": list(parsed.get("entities") or []),
                "needs_portfolio": bool(parsed.get("needs_portfolio", False)),
                "confidence": float(parsed.get("confidence", 0.8)),
            }
        ],
        "thinking_steps": [
            {"step": f"Intent: {intent} ({parsed.get('confidence', 0.8):.0%})", "tool": None, "status": "done"},
        ],
    }
