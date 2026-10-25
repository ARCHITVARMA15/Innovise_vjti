"""
Mode-specific workflow plans for iterative Veritas execution.
"""

from __future__ import annotations


def get_mode_plan(intent: str, iteration: int, entities: list[str] | None = None) -> dict:
    names = ", ".join((entities or [])[:2]) if entities else "query scope"

    plans = {
        "verify": {
            "title": "Verification Workflow",
            "steps": [
                "Define the claim boundary and key assertions",
                "Gather independent web and financial-news evidence",
                "Cross-check against live market context",
                "Reconcile contradictions and issue confidence verdict",
            ],
        },
        "analyze": {
            "title": "Asset Analysis Workflow",
            "steps": [
                f"Load market/fundamental snapshot for {names}",
                "Gather catalyst and sentiment evidence",
                "Compare valuation and momentum signals",
                "Synthesize outlook with risk-aware conclusion",
            ],
        },
        "strategy": {
            "title": "Strategy Workflow",
            "steps": [
                "Profile portfolio structure and concentration",
                "Assess macro and sector regime context",
                "Evaluate rebalance actions and trade-offs",
                "Output prioritized buy/hold/sell strategy",
            ],
        },
        "what_if": {
            "title": "Scenario Workflow",
            "steps": [
                "Define scenario assumptions and transmission channels",
                "Retrieve historical analogs and stress episodes",
                "Map immediate, secondary, and long-horizon effects",
                "Summarize actionable implications and hedges",
            ],
        },
        "regulatory": {
            "title": "Regulatory Check Workflow",
            "steps": [
                "Interpret user action/claim and compliance context",
                "Screen against SEBI and tax red-flag rules",
                "Cross-reference public regulatory guidance",
                "Issue compliance verdict and safe alternatives",
            ],
        },
        "general": {
            "title": "Research Workflow",
            "steps": [
                "Clarify question intent and evidence needs",
                "Retrieve high-signal references",
                "Cross-check consistency across sources",
                "Synthesize concise, evidence-backed response",
            ],
        },
    }

    selected = plans.get(intent, plans["general"])
    completed = min(max(iteration, 1), len(selected["steps"]))

    return {
        "title": selected["title"],
        "iteration": iteration,
        "steps": [
            {
                "label": step,
                "status": "done" if idx < completed else "pending",
                "index": idx + 1,
            }
            for idx, step in enumerate(selected["steps"])
        ],
    }
