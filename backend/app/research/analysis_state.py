from typing import TypedDict

from app.research.analysis_models import AnalysisSnapshot, ResearchPlan, RetrievalOutput, FinancialOutput, ResearchBrief, VerificationStageOutput


class AnalystState(TypedDict, total=False):
    workflow: str
    ecosystem_run: dict
    request: dict
    scope: dict
    risks: dict
    report: dict
    run_id: str
    case_id: str
    question: str
    snapshot: AnalysisSnapshot
    plan: ResearchPlan
    retrieval: RetrievalOutput
    financial: FinancialOutput
    verification: VerificationStageOutput
    brief: ResearchBrief
