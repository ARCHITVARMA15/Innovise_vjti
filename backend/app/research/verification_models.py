from datetime import date
from typing import Annotated, Literal

from pydantic import Field, StringConstraints, field_validator

from app.research.analysis_models import StrictModel, AnalysisSnapshot, EvidencePassage
from app.research.financial_models import Metric, CalculationType, Scale, FactInput

Verdict = Literal["supported", "contradicted", "unsupported", "needs_review"]
Method = Literal["deterministic_numerical_check", "model_assessed_qualitative_support", "insufficient_evidence_or_unresolved_interpretation"]
Short = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=240)]
ClaimText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]


class ClaimMapping(StrictModel):
    assertion_type: Literal["numerical", "debt_free", "qualitative", "unknown"] = "unknown"
    target: Metric | CalculationType | None = None
    entity: Short | None = None
    asserted_value: str | None = None
    unit: Literal["percent", "percentage_points", "ratio", "currency", "unknown"] = "unknown"
    currency: Annotated[str, StringConstraints(pattern=r"^[A-Z]{3}$")] | None = None
    scale: Scale | None = None
    periods: list[Short] = Field(default_factory=list, max_length=2)
    period_start: date | None = None
    period_end: date | None = None
    accounting_scope: Short | None = None
    rounding_places: int | None = Field(default=None, ge=0, le=6)
    debt_definition: Literal["interest_bearing_borrowings", "unknown"] = "unknown"
    temporal_scope: Literal["historical", "current", "unknown"] = "unknown"
    ambiguity: Annotated[str, StringConstraints(max_length=1000)] | None = None

    @field_validator("asserted_value")
    @classmethod
    def decimal_value(cls, value):
        return FactInput.decimal_string(value) if value is not None else None


class ClaimInput(StrictModel):
    text: ClaimText
    mapping: ClaimMapping = Field(default_factory=ClaimMapping)
    mapping_reviewed: bool = False


class ClaimEdit(ClaimInput):
    expected_revision: int = Field(ge=1)
    reason: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1000)]


class ClaimSource(StrictModel):
    document_id: str
    section_id: str
    document_title: str
    page_number: int | None
    label: str
    excerpt: str
    start_offset: int
    end_offset: int
    document_hash: str


class Claim(ClaimInput):
    id: str
    case_id: str
    origin: Literal["analyst_entered", "analysis_finding", "document_extracted"]
    origin_reference: str | None
    source: ClaimSource | None
    revision: int
    created_at: str
    updated_at: str
    history: list[dict]
    source_available: bool = True


class ClaimExtraction(StrictModel):
    document_id: str


class ProposedClaim(StrictModel):
    span_id: str | None = None
    section_id: str
    excerpt: Annotated[str, StringConstraints(min_length=1, max_length=2000)]
    mapping: ClaimMapping


class ExtractedClaims(StrictModel):
    claims: list[ProposedClaim] = Field(max_length=8)


class ImportFindings(StrictModel):
    analysis_run_id: str


class VerificationStart(StrictModel):
    previous_run_id: str | None = None
    supporting_document_ids: list[str] = Field(min_length=1, max_length=10)
    receipt_ids: list[str] = Field(default_factory=list, max_length=8)


class QualitativeAssessment(StrictModel):
    status: Verdict
    supporting_ids: list[str] = Field(max_length=8)
    contradicting_ids: list[str] = Field(max_length=8)
    explanation: Annotated[str, StringConstraints(min_length=1, max_length=1000)]
    incompatible_evidence: Annotated[str, StringConstraints(max_length=600)] | None
    same_entity_period_basis: bool | None
    missing_evidence: list[Short] = Field(max_length=4)
    limitations: list[Short] = Field(max_length=4)


class VerificationResult(StrictModel):
    status: Verdict
    method: Method
    explanation: str
    supporting_ids: list[str] = Field(default_factory=list)
    contradicting_ids: list[str] = Field(default_factory=list)
    receipt_ids: list[str] = Field(default_factory=list)
    fact_ids: list[str] = Field(default_factory=list)
    comparison: dict | None = None
    mapping_proposal: ClaimMapping | None = None
    missing_evidence: list[str] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)
    label: str = "Supported means supported by selected evidence, not independent certification."


class VerificationRun(StrictModel):
    id: str
    case_id: str
    claim_id: str
    status: Literal["queued", "running", "completed", "failed", "interrupted"]
    stale: bool
    stale_reasons: list[str]
    created_at: str
    started_at: str | None
    finished_at: str | None
    claim_snapshot: Claim
    snapshot: AnalysisSnapshot
    requested_model: dict
    result: VerificationResult | None
    evidence: list[EvidencePassage]
    events: list[dict]
    errors: list[str]
    warnings: list[str]
    repairs: list[dict] = Field(default_factory=list)
    previous_run_id: str | None = None
    attempts: list[dict]
    source_availability: dict[str, bool]


class ClaimExtractionRun(StrictModel):
    id: str
    document_id: str
    processed_chunks: int
    omitted_chunks: int
    status: Literal["running", "completed", "partial", "failed"]
    claim_ids: list[str]
    errors: list[str]
    limitations: list[str]


class NoteSpanSelection(StrictModel):
    span_ids: list[str] = Field(max_length=8)
