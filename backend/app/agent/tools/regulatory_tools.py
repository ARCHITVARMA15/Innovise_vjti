"""
Regulatory checks utility for SEBI/tax-related red-flag screening.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

CHECKLIST_PATH = Path(__file__).resolve().parents[3] / "data" / "regulatory_checklist.json"


def load_regulatory_checklist() -> dict[str, Any]:
    if not CHECKLIST_PATH.exists():
        return {"categories": [], "disclaimer": "Checklist unavailable."}
    try:
        with open(CHECKLIST_PATH, encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, dict) else {"categories": [], "disclaimer": "Invalid checklist format."}
    except Exception:
        return {"categories": [], "disclaimer": "Failed to load checklist."}


def evaluate_regulatory_risks(query: str) -> dict[str, Any]:
    """Rule-based compliance pre-screen from user query text."""
    checklist = load_regulatory_checklist()
    categories = checklist.get("categories") or []
    q = (query or "").lower()

    findings: list[dict[str, Any]] = []
    statute_refs: set[str] = set()
    high = 0
    medium = 0

    for cat in categories:
        keywords = [str(k).lower() for k in (cat.get("keywords") or [])]
        matches = [k for k in keywords if k in q]
        if not matches:
            continue

        severity = str(cat.get("severity") or "medium").lower()
        if severity == "high":
            high += 1
        else:
            medium += 1

        findings.append(
            {
                "category_id": cat.get("id"),
                "category": cat.get("label"),
                "severity": severity,
                "matches": matches[:5],
                "statute_refs": list(cat.get("statute_refs") or []),
            }
        )
        for ref in (cat.get("statute_refs") or []):
            if ref:
                statute_refs.add(str(ref))

    if high > 0:
        risk_level = "high"
        verdict = "POTENTIAL VIOLATION"
        confidence = 0.85
    elif medium > 0:
        risk_level = "medium"
        verdict = "CAUTION"
        confidence = 0.72
    else:
        risk_level = "low"
        verdict = "COMPLIANT / NO MAJOR RED FLAG"
        confidence = 0.8

    return {
        "verdict": verdict,
        "risk_level": risk_level,
        "confidence": confidence,
        "high_count": high,
        "medium_count": medium,
        "findings": findings,
        "statute_refs": sorted(statute_refs),
        "disclaimer": checklist.get("disclaimer") or "Educational compliance signal only.",
    }
