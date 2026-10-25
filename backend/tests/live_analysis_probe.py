"""Opt-in bounded live Groq check using ONLY temporary synthetic fixture data.

No secrets are printed. This script never changes the user's research store.
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.agent.config import _get_groq_api_key
from app.research.analysis_manager import AnalysisManager
from app.research.analysis_models import AnalysisStart
import test_financials as fixtures


async def main():
    if not _get_groq_api_key():
        print("NOT ATTEMPTED: GROQ_API_KEY is not configured. No live planning or synthesis call was made.")
        return
    fixture = fixtures.FinancialTests()
    fixture.setUp()
    manager = AnalysisManager(fixture.store)
    manager.startup()
    try:
        fixture.fact("revenue", 2024)
        fixture.fact("revenue", 2025)
        fixture.fact("net_income", 2025)
        run = manager.start(fixture.case["id"], AnalysisStart(document_ids=[fixture.doc["id"]],
            question_override="Compare FY2024 and FY2025 revenue growth and FY2025 net profit margin; summarize the source content qualitatively."))
        await asyncio.gather(*list(manager.tasks.values()))
        saved = manager.store.get(fixture.case["id"], run["id"])
        stages = saved["stage_outputs"]
        print("LIVE RUN STATUS:", saved["status"])
        print("Actual model planning:", "SUCCEEDED" if "planning" in stages else "FAILED")
        print("Actual model synthesis:", "SUCCEEDED" if saved.get("brief") and saved["brief"].get("qualitative_status")=="available" else "FAILED OR NOT REACHED")
        if saved.get('brief') and saved['brief'].get('synthesis_error'):
            print('Synthesis diagnostics:', saved['brief']['synthesis_error'])
        print("Persisted stages:", ', '.join(stages))
        if saved["financial"]:
            print("Saved deterministic observations:", ' | '.join(finding['text'] for finding in saved['financial']['findings']))
        for error in saved["errors"]:
            print("Sanitized run error:", error)
        print("Requested model configuration recorded; observed serving model is not claimed.")
    finally:
        await manager.shutdown()
        fixture.tearDown()


if __name__ == "__main__":
    asyncio.run(main())
