from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from app.research.financial_models import CalculationType, FactSnapshot, CalculationReceipt, Metric
from app.research.models import DocumentDetail, ResearchCase

Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]
Query = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
Stage = Literal["qualitative_synthesis", "scope_resolution", "risk_assessment", "report_composition", "planning", "evidence_retrieval", "financial_analysis", "verification", "brief_assembly"]
RunStatus = Literal["queued", "running", "needs_input", "completed", "partial", "failed", "interrupted"]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


TaskType = Literal["simple_metric", "document_comparison", "claim_verification", "risk_assessment", "full_research"]


class AnalysisStart(StrictModel):
    automation_run_id: str | None = None
    fact_ids: list[str] | None = Field(default=None, max_length=40)
    task_type: TaskType | None = None
    entity: Query | None = None
    periods: list[Query] = Field(default_factory=list, max_length=8)
    accounting_basis: Query | None = None
    research_as_of_date: date | None = None
    calculations: list["CalculationTask"] = Field(default_factory=list, max_length=8)
    claim_ids: list[str] = Field(default_factory=list, max_length=8)
    document_ids: list[str] = Field(min_length=1, max_length=10)
    question_override: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=10000)] | None = None
    receipt_ids: list[str] = Field(default_factory=list, max_length=8)


class CalculationTask(StrictModel):
    calculation_type: CalculationType
    # For growth: [previous, current]; otherwise at most one period label.
    periods: list[Query] = Field(default_factory=list, max_length=2)


class ResearchPlan(StrictModel):
    objective: Text
    supported_metrics: list[Metric] = Field(max_length=6)
    calculations: list[CalculationTask] = Field(max_length=8)
    evidence_queries: list[Query] = Field(min_length=1, max_length=6)
    required_periods: list[Query] = Field(max_length=8)
    missing_inputs: list[Text] = Field(max_length=8)
    unsupported_requests: list[Text] = Field(max_length=8)
    limitations: list[Text] = Field(max_length=8)


class SnapshotDocument(StrictModel):
    document: DocumentDetail
    content_hash: str
    included: bool
    exclusion_reason: str | None


class AnalysisSnapshot(StrictModel):
    research_as_of_date: date | None = None
    case: ResearchCase
    documents: list[SnapshotDocument]
    facts: list[FactSnapshot]
    selected_receipts: list[CalculationReceipt]


class EvidencePassage(StrictModel):
    id: str
    document_id: str
    section_id: str
    document_title: str
    page_number: int | None
    label: str
    start_offset: int
    end_offset: int
    excerpt: str
    query: str
    reason: str
    publication_date: date | None
    reporting_period: str | None
    unknown_publication_date: bool


class RetrievalOutput(StrictModel):
    passages: list[EvidencePassage]
    scanned_sections: int
    scanned_chunks: int
    total_chunks: int
    omitted_chunks: int
    limitations: list[str]


class Finding(StrictModel):
    id: str
    text: str
    finding_type: Literal["numerical_observation", "qualitative_interpretation"]
    model_generated: bool
    evidence_ids: list[str] = Field(default_factory=list)
    receipt_ids: list[str] = Field(default_factory=list)
    fact_ids: list[str] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)


class FinancialOutput(StrictModel):
    findings: list[Finding]
    receipt_ids: list[str]
    needs_input: list[str]
    limitations: list[str]


class QualitativeObservation(StrictModel):
    scope: Literal["document_content"] = "document_content"
    text: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=600)]
    evidence_ids: list[str] = Field(min_length=1, max_length=4)
    limitations: list[Query] = Field(max_length=2)


class QualitativeOutput(StrictModel):
    observations: list[QualitativeObservation] = Field(max_length=2)


class VerificationStageOutput(StrictModel):
    claim_ids: list[str]
    verification_ids: list[str]
    status_counts: dict[str, int]
    limitations: list[str]


class ResearchBrief(StrictModel):
    id: str
    question: str
    scope: str
    documents_considered: list[str]
    periods_considered: list[str]
    findings: list[Finding]
    missing_information: list[str]
    unsupported_requests: list[str]
    limitations: list[str]
    notice: Literal["Preliminary research — claim verification and analyst approval pending."]
    qualitative_status: Literal["available", "unavailable", "not_requested", "legacy_unknown"] = "legacy_unknown"
    synthesis_error: dict | None = None
    verification_ids: list[str] = Field(default_factory=list)


class StageEvent(StrictModel):
    id: str
    sequence: int
    stage: Stage | Literal["execution"]
    transition: Literal["queued", "started", "completed", "failed", "interrupted", "skipped"]
    timestamp: str
    message: str


class AnalysisRun(StrictModel):
    id: str
    case_id: str
    question: str
    request: dict = Field(default_factory=dict)
    scope: dict | None = None
    risks: dict | None = None
    report: dict | None = None
    question_overridden: bool
    status: RunStatus
    stale: bool
    stale_reasons: list[str]
    created_at: str
    started_at: str | None
    finished_at: str | None
    requested_model: dict
    snapshot: AnalysisSnapshot
    plan: ResearchPlan | None
    retrieval: RetrievalOutput | None
    financial: FinancialOutput | None
    verification: VerificationStageOutput | None = None
    brief: ResearchBrief | None
    receipt_ids: list[str]
    warnings: list[str]
    limitations: list[str]
    errors: list[str]
    stage_outputs: dict[str, dict]
    events: list[StageEvent]
    excluded_document_ids: list[str]
    source_availability: dict[str, bool]
    not_included_document_ids: list[str]


class AnalysisRunSummary(BaseModel):
    id: str
    case_id: str
    question: str
    status: RunStatus
    stale: bool
    stale_reasons: list[str]
    created_at: str
    started_at: str | None
    finished_at: str | None
    errors: list[str]
