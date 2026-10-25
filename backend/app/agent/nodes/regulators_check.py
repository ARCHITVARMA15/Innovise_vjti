"""
Regulators check node — screens for possible SEBI/tax/legal red flags.
"""

import logging
from datetime import datetime, timezone

from app.agent.config import PRIMARY_MODEL, safe_llm_call
from app.agent.prompts.regulatory_prompt import REGULATORY_SYSTEM_PROMPT
from app.agent.prompts.system import get_veritas_system_prompt
from app.agent.state import AgentState
from app.agent.tools.evidence_tools import build_evidence_items
from app.agent.tools.regulatory_tools import evaluate_regulatory_risks
from app.agent.tools.web_search import summarize_search_results, web_search
from app.agent.tools.workflow_plan import get_mode_plan

log = logging.getLogger("veritas.nodes.regulators_check")


async def regulators_check_node(state: AgentState) -> dict:
    query = state["query"]
    iteration = int(state.get("iteration", 0)) + 1

    rule_scan = evaluate_regulatory_risks(query)

    q_lower = query.lower()
    crypto_hint = any(
        term in q_lower
        for term in [
            "crypto", "bitcoin", "ethereum", "token", "vda", "virtual digital asset",
            "wallet", "exchange", "defi", "stablecoin",
        ]
    )

    search_queries: list[str] = [f"SEBI compliance guidance India {query}"]
    if crypto_hint:
        search_queries.extend(
            [
                f"India crypto VDA compliance Section 115BBH 194S {query}",
                f"India PMLA FIU virtual digital assets compliance {query}",
            ]
        )

    if not rule_scan.get("findings"):
        search_queries.extend(
            [
                f"India legal interpretation compliance checklist {query}",
                f"Indian securities tax regulatory clarification {query}",
            ]
        )

    web_results: list[dict] = []
    for sq in search_queries:
        web_results += web_search(sq, max_results=4)

    if iteration > 1:
        web_results += web_search(f"Indian tax compliance red flags {query}", max_results=3)

    if not web_results:
        web_results = web_search(f"India legal regulatory analysis {query}", max_results=6)

    web_summary = summarize_search_results(web_results, max_items=5)

    system_prompt = f"{get_veritas_system_prompt()}\n\n{REGULATORY_SYSTEM_PROMPT}"
    user_message = (
        f"User query:\n{query}\n\n"
        f"Rule-based pre-check:\n{rule_scan}\n\n"
        f"Applicable statute references:\n{rule_scan.get('statute_refs') or []}\n\n"
        f"Regulatory references:\n{web_summary}\n\n"
        "Provide a clear compliance verdict and safe next steps."
    )

    answer = await safe_llm_call(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        model=PRIMARY_MODEL,
        max_tokens=1000,
        fallback_model="llama-3.1-8b-instant",
    )

    evidence_items = build_evidence_items(
        iteration=iteration,
        intent="regulatory",
        source_type="web_search",
        raw_items=web_results,
    )

    sources: list[dict] = [
        {
            "type": "filing",
            "title": "Regulatory Rule Scan",
            "url": None,
            "snippet": f"Verdict {rule_scan.get('verdict')} | High {rule_scan.get('high_count')} | Medium {rule_scan.get('medium_count')}",
            "confidence": float(rule_scan.get("confidence", 0.7)),
        }
    ]
    for r in web_results[:4]:
        sources.append(
            {
                "type": "web_search",
                "title": r.get("title", "Regulatory reference"),
                "url": r.get("url"),
                "snippet": (r.get("snippet") or "")[:150],
                "confidence": None,
            }
        )

    summary_snapshot = {
        "type": "metric",
        "label": "Regulatory Risk Summary",
        "data": {
            "verdict": rule_scan.get("verdict"),
            "risk_level": rule_scan.get("risk_level"),
            "confidence": rule_scan.get("confidence"),
            "high_flags": rule_scan.get("high_count"),
            "medium_flags": rule_scan.get("medium_count"),
            "finding_count": len(rule_scan.get("findings") or []),
            "statute_refs": rule_scan.get("statute_refs") or [],
        },
    }

    mode_plan = get_mode_plan("regulatory", iteration, state.get("entities") or [])

    return {
        "tool_results": [
            {"tool": "regulatory_rules", "data": rule_scan},
            {"tool": "web_search", "data": web_summary},
        ],
        "tool_summaries": [
            "Ran SEBI/tax keyword risk pre-check",
            f"Collected {len(web_results)} regulatory references",
            *(["Applied crypto/VDA regulatory sweep"] if crypto_hint else []),
            *(["Applied broad legal fallback search due to low rule matches"] if not rule_scan.get("findings") else []),
            f"Mapped statute refs: {', '.join((rule_scan.get('statute_refs') or [])[:3]) or 'none'}",
        ],
        "sources": sources,
        "data_snapshots": [summary_snapshot],
        "traces": [
            {
                "iteration": iteration,
                "layer": "execution",
                "intent": "regulatory",
                "summary": "Screened query for potential SEBI/tax red flags and mapped safe actions.",
                "confidence": float(state.get("intent_confidence", 0.0)) if state.get("intent_confidence") is not None else None,
                "stop_reason": None,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        ],
        "iteration_outputs": [
            {
                "iteration": iteration,
                "layer": "execution",
                "intent": "regulatory",
                "tools": ["regulatory_rules", "web_search"],
                "tool_summaries": [
                    f"Rule scan flags: high={rule_scan.get('high_count', 0)}, medium={rule_scan.get('medium_count', 0)}",
                    f"Regulatory references gathered: {len(web_results)}",
                ],
                "mode_plan": mode_plan,
                "answer_preview": answer[:220],
            }
        ],
        "evidence_items": evidence_items,
        "thinking_steps": [
            {"step": "Checking SEBI/tax rule triggers...", "tool": "regulatory_rules", "status": "done"},
            {"step": "Retrieving compliance references...", "tool": "web_search", "status": "done"},
            {"step": "Preparing compliance verdict...", "tool": None, "status": "done"},
        ],
        "regulatory_result": {
            "verdict": rule_scan.get("verdict"),
            "risk_level": rule_scan.get("risk_level"),
            "confidence": rule_scan.get("confidence"),
            "finding_count": len(rule_scan.get("findings") or []),
            "statute_refs": rule_scan.get("statute_refs") or [],
            "disclaimer": rule_scan.get("disclaimer"),
            "raw_analysis": answer,
        },
        "answer": answer,
    }
