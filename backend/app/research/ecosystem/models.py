"""Strict contracts. Evidence verdicts and human dispositions remain independent."""
from datetime import date
from decimal import Decimal
from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)


class EvidenceStatus(str, Enum):
    VERIFIED = 'VERIFIED'
    CONTRADICTED = 'CONTRADICTED'
    UNSUPPORTED = 'UNSUPPORTED'
    UNRESOLVED = 'UNRESOLVED'


Level = Literal['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN']


class Entity(StrictModel):
    id: str
    name: str
    jurisdiction: str | None = None
    ticker: str | None = None
    aliases: list[str] = Field(default_factory=list)
    external_ids: dict[str, str] = Field(default_factory=dict)
    synthetic: bool = False


class Source(StrictModel):
    id: str
    title: str
    url: str | None = None
    publisher: str
    published_at: date | None = None
    retrieved_at: str
    document_page: str
    document_version: str
    text: str = Field(max_length=12000)
    kind: Literal['official', 'case_document', 'news', 'synthetic']
    # Server-owned curated assertions, never derived from instructions in text.
    assertions: list[str] = Field(default_factory=list)
    supersedes: str | None = None
    content_hash: str = ''
    case_document_id: str | None = None


class Relationship(StrictModel):
    id: str
    source_entity_id: str
    target_entity_id: str
    relationship_type: Literal['parent_subsidiary', 'supplier', 'customer', 'manufacturing', 'logistics']
    source_ids: list[str] = Field(default_factory=list)
    excerpt: str
    effective_from: date | None = None
    effective_to: date | None = None
    last_confirmed: date | None = None
    status: EvidenceStatus = EvidenceStatus.UNRESOLVED
    rationale: str = ''
    synthetic: bool = False
    criticality: Literal['critical', 'noncritical', 'unknown'] = 'unknown'
    replaceability: Literal['sole_source', 'replaceable', 'unknown'] = 'unknown'
    inventory_buffer: Literal['adequate', 'limited', 'unknown'] = 'unknown'
    dependency_percent: Decimal | None = Field(default=None, ge=0, le=100)
    mitigants: list[str] = Field(default_factory=list)
    risk_event: str | None = None
    event_source_ids: list[str] = Field(default_factory=list)
    data_issues: list[str] = Field(default_factory=list)
    # Relationship verification does not automatically verify these attributes.
    attribute_source_ids: list[str] = Field(default_factory=list)
    affected_revenue_metric_id: str | None = None
    dependency_basis: str | None = None
    dependency_period_end: date | None = None
    dependency_period_start: date | None = None
    observed_impact: str | None = None
    event_effective_to: date | None = None


class Metric(StrictModel):
    id: str
    entity_id: str
    metric: str
    value: Decimal
    currency: str
    units: Literal['units', 'thousands', 'millions', 'billions', 'lakh', 'crore']
    period: str
    period_type: Literal['instant', 'duration', 'unknown']
    period_start: date | None = None
    period_end: date
    reporting_basis: str
    document_version: str
    source_id: str
    provenance: str
    synthetic: bool = False
    source_fact_id: str | None = None
    source_fact_revision: int | None = None

    @field_validator('value')
    @classmethod
    def finite(cls, v):
        if not v.is_finite() or len(v.as_tuple().digits) > 40 or abs(v.adjusted()) > 30:
            raise ValueError('Metric must be a finite bounded decimal.')
        return v

    @model_validator(mode='after')
    def ordered_period(self):
        if self.period_start and self.period_start > self.period_end:
            raise ValueError('Metric period start cannot follow period end.')
        if self.period_type == 'instant' and self.period_start and self.period_start != self.period_end:
            raise ValueError('An instant metric has one reporting date.')
        return self


class Exposure(StrictModel):
    relationship_id: str
    materiality: Level
    basis: str
    facts: dict[str, str | None] = Field(default_factory=dict)
    mitigants: list[str] = Field(default_factory=list)
    hypothetical: bool = False
    evidence_ids: list[str] = Field(default_factory=list)


class FinancialAssessment(StrictModel):
    entity_id: str
    distress: Level = 'UNKNOWN'
    observations: list[str] = Field(default_factory=list)
    calculations: list[dict] = Field(default_factory=list)
    metric_ids: list[str] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)
    synthetic: bool = False
    evidence_ids: list[str] = Field(default_factory=list)


class Finding(StrictModel):
    id: str
    relationship_id: str
    counterparty_id: str
    triggering_event: str
    causal_mechanism: str
    target_consequence: str
    mitigants: list[str]
    assumptions: list[str]
    disconfirming_checks: list[str]
    evidence_ids: list[str]
    evidence_status: EvidenceStatus
    counterparty_distress: Level
    target_materiality: Level
    scenario_risk: Literal['ELEVATED', 'MODERATE', 'LOW', 'UNKNOWN', 'NOT_ESTABLISHED']
    hypothetical: bool
    confirmed_alert: bool = False
    observed_impact: str | None = None
    quantification_note: str = 'Financial impact cannot be quantified without disclosed affected revenue and defensible scenario assumptions.'


class InvestigationStart(StrictModel):
    target: str | None = Field(default=None, min_length=1, max_length=240)
    as_of_date: date
    max_depth: Literal[1] = 1
    max_counterparties: int = Field(default=5, ge=1, le=5)
    retry_budget: int = Field(default=2, ge=0, le=2)
    stale_after_days: int = Field(default=365, ge=30, le=3650)


class ReviewInput(StrictModel):
    expected_revision: int = Field(ge=1)
    decision: Literal['APPROVE', 'REJECT', 'REQUEST_CHANGES']
    reviewer_label: str = Field(min_length=1, max_length=120)
    reviewer_notes: str = Field(min_length=1, max_length=4000)
    acknowledge_limitations: bool = False


class Review(ReviewInput):
    id: str
    created_at: str


class ScenarioInput(StrictModel):
    relationship_id: str = Field(min_length=1, max_length=120)
    disruption_severity: Decimal = Field(ge=0, le=1)
    unmitigated_fraction: Decimal = Field(ge=0, le=1)
    assumption_notes: str = Field(min_length=1, max_length=2000)

    @field_validator('disruption_severity', 'unmitigated_fraction')
    @classmethod
    def bounded_fraction(cls, value):
        if not value.is_finite() or len(value.as_tuple().digits) > 12:
            raise ValueError('Use a finite fraction between zero and one, with at most 12 digits.')
        return value


class Scenario(ScenarioInput):
    id: str
    created_at: str
    status: Literal['calculated', 'unavailable']
    affected_revenue: str | None = None
    revenue_at_risk: str | None = None
    currency: str | None = None
    units: str = 'units'
    period: str | None = None
    metric_id: str | None = None
    source_ids: list[str] = Field(default_factory=list)
    base_kind: Literal['reported_affected_revenue', 'derived_customer_revenue'] = 'reported_affected_revenue'
    base_inputs: dict[str, str] = Field(default_factory=dict)
    formula: str = 'affected_revenue × disruption_severity × unmitigated_fraction'
    explanation: str
    label: str = 'Assumption-based revenue at risk; not predicted losses'


class Event(StrictModel):
    id: int
    stage: str
    transition: str
    message: str
    created_at: str


class Run(StrictModel):
    id: str
    case_id: str
    request: InvestigationStart
    mode: Literal['curated', 'demo']
    status: Literal['queued', 'running', 'completed', 'partial', 'needs_input', 'failed', 'interrupted']
    revision: int = 1
    created_at: str
    finished_at: str | None = None
    target_entity_id: str | None = None
    entities: list[Entity] = Field(default_factory=list)
    sources: list[Source] = Field(default_factory=list)
    relationships: list[Relationship] = Field(default_factory=list)
    metrics: list[Metric] = Field(default_factory=list)
    exposures: list[Exposure] = Field(default_factory=list)
    assessments: list[FinancialAssessment] = Field(default_factory=list)
    findings: list[Finding] = Field(default_factory=list)
    uncertainties: list[str] = Field(default_factory=list)
    questions: list[str] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)
    audit: list[str] = Field(default_factory=list)
    retry_count: int = 0
    review_state: Literal['NEEDS_REVIEW', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED'] = 'NEEDS_REVIEW'
    reviews: list[Review] = Field(default_factory=list)
    scenarios: list[Scenario] = Field(default_factory=list)
    events: list[Event] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)
    source_state: Literal['current', 'stale'] = 'current'

    @model_validator(mode='after')
    def bounds(self):
        if len(self.relationships) > self.request.max_counterparties or len(self.entities) > self.request.max_counterparties + 1:
            raise ValueError('One-hop counterparty bounds exceeded.')
        return self
