"""Typed provenance, analyst review and deterministic-calculation contracts."""
from datetime import date
from decimal import Decimal, InvalidOperation
import re
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator, model_validator

Metric = Literal["revenue", "net_income", "current_assets", "current_liabilities", "total_debt", "total_equity"]
Scale = Literal["units", "thousands", "millions", "billions", "lakh", "crore"]
FactStatus = Literal["candidate", "confirmed", "rejected", "needs_review"]
CalculationType = Literal["revenue_growth", "net_profit_margin", "current_ratio", "debt_to_equity"]
DECIMAL_PATTERN = r"[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?"

Label = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=240)]


class FactInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    document_id: Label
    section_id: Label
    metric: Metric
    entity: Label | None = None
    value: str = Field(max_length=100, pattern=r"^" + DECIMAL_PATTERN + r"$",
        description="Ungrouped finite decimal string, e.g. '281724'. No commas, spaces, currency symbols or numeric JSON values. At most 40 digits; exponent within ±30.")
    currency: Annotated[str, StringConstraints(pattern=r"^[A-Z]{3}$")] | None = None
    scale: Scale | None = None
    reporting_period: Label | None = None
    period_start: date | None = None
    period_end: date | None = None
    period_type: Literal["instant", "duration", "unknown"] = "unknown"
    accounting_scope: Label | None = None
    excerpt: str = Field(min_length=1, max_length=4000)
    context_span_ids: list[str] = Field(default_factory=list, max_length=4)
    span_id: str | None = None
    span_start: int | None = None
    span_end: int | None = None
    ambiguity_note: Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)] | None = None

    @field_validator("value")
    @classmethod
    def decimal_string(cls, value: str) -> str:
        if not re.fullmatch(DECIMAL_PATTERN, value):
            raise ValueError("Use an ungrouped decimal string without whitespace or currency symbols")
        try:
            parsed = Decimal(value)
        except InvalidOperation:
            raise ValueError("Use a decimal string without currency symbols or grouping commas") from None
        if not parsed.is_finite() or abs(parsed.adjusted()) > 30 or len(parsed.as_tuple().digits) > 40:
            raise ValueError("Value must be finite with at most 40 digits and exponent within ±30")
        return format(parsed, "f")

    @model_validator(mode="after")
    def ordered_dates(self):
        if self.period_start and self.period_end and self.period_start > self.period_end:
            raise ValueError("Reporting period start must not follow end")
        if self.period_type == "instant" and self.period_start and self.period_start != self.period_end:
            raise ValueError("An instant fact has one reporting date (period_end)")
        if not self.excerpt.strip():
            raise ValueError("A supporting excerpt is required")
        return self


class FactRevision(BaseModel):
    revision: int
    timestamp: str
    action: str
    reason: str
    values: dict


class ContextSpan(BaseModel):
    id: str
    section_id: str
    start_offset: int
    end_offset: int
    excerpt: str


class SourceSnapshot(BaseModel):
    structured_provenance: dict | None = None
    context_spans: list[ContextSpan] = Field(default_factory=list)
    document_id: str
    section_id: str
    document_title: str
    label: str
    page_number: int | None
    source_url: str | None
    excerpt: str


class FactSnapshot(FactInput):
    id: str
    case_id: str
    status: FactStatus
    origin: str
    created_at: str
    updated_at: str
    revision: int
    source_available: bool
    source_snapshot: SourceSnapshot
    original_values: FactInput
    removed_at: str | None = None


class Fact(FactSnapshot):
    history: list[FactRevision]


class FactUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    expected_revision: int = Field(ge=1)
    values: FactInput
    status: FactStatus
    reason: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]


class FactRemoval(BaseModel):
    model_config = ConfigDict(extra="forbid")
    expected_revision: int = Field(ge=1)


class FactDeleteResult(BaseModel):
    deleted: bool
    fact_id: str


class ExtractionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    document_ids: list[Label] = Field(min_length=1, max_length=20)
    # None selects all sections; an explicit selection must be nonempty.
    section_ids: list[Label] | None = Field(default=None, min_length=1, max_length=2000)


class ExtractionOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    facts: list[FactInput] = Field(max_length=60)


class SectionOutcome(BaseModel):
    document_id: str
    section_id: str
    label: str
    status: Literal["pending", "processed", "skipped", "failed"]
    message: str | None = None
    selected: bool = True
    page_number: int | None = None


class ExtractionRun(BaseModel):
    id: str
    case_id: str
    document_ids: list[str]
    status: Literal["running", "completed", "partial", "failed"]
    created_at: str
    finished_at: str | None = None
    sections: list[SectionOutcome]
    fact_ids: list[str]
    duplicate_count: int = 0
    errors: list[str]
    limitations: list[str]
    model: str


class CalculationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    calculation_type: CalculationType
    # Exact named roles, each assigned an explicitly chosen saved fact ID.
    inputs: dict[str, str] = Field(default_factory=dict, max_length=2, description=(
        "Saved fact IDs by role: revenue_growth=current/previous; net_profit_margin=net_income/revenue; "
        "current_ratio=current_assets/current_liabilities; debt_to_equity=total_debt/total_equity. No client results."))
    acknowledged_conflicts: dict[str, list[str]] = Field(default_factory=dict, max_length=2)


class UnitConversion(BaseModel):
    role: str
    from_scale: Scale
    to_scale: Literal["units"]
    multiplier: str
    original_value: str
    normalized_value: str
    currency: str | None


class ReceiptSource(SourceSnapshot):
    fact_id: str
    revision: int
    available_at_calculation: bool


class CalculationReceipt(BaseModel):
    id: str
    case_id: str
    calculation_type: CalculationType
    formula: str
    created_at: str
    status: Literal["valid", "stale", "unavailable"]
    result: str | None
    display_result: str | None
    result_unit: str
    precision: int
    rounding: str
    inputs: dict[str, FactSnapshot]
    conversions: list[UnitConversion]
    sources: list[ReceiptSource]
    warnings: list[str]
    missing_inputs: list[str]
    conflicts: dict[str, list[str]]
    acknowledged_conflicts: dict[str, list[str]]
    invalidated_at: str | None = None
    invalidation_reason: str | None = None
