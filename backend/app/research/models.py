from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, StringConstraints

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=240)]
ShortText = Annotated[str, StringConstraints(strip_whitespace=True, max_length=240)]


class CaseCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: Title
    company_name: Title
    ticker: Annotated[str, StringConstraints(strip_whitespace=True, max_length=40)] | None = None
    research_question: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=10000)]
    reporting_period: ShortText | None = None
    research_as_of_date: date | None = None


class ResearchCase(CaseCreate):
    id: str
    created_at: datetime
    updated_at: datetime
    document_count: int = 0


class DocumentMetadata(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: Title
    publication_date: date | None = None
    reporting_period: ShortText | None = None
    source_url: HttpUrl | None = Field(default=None, max_length=2048)
    document_type: ShortText | None = None


class TextDocumentCreate(DocumentMetadata):
    # Byte limit is also checked in the service, since Unicode size differs.
    text: str = Field(min_length=1, max_length=10 * 1024 * 1024)


class DocumentPage(BaseModel):
    id: str
    document_id: str
    position: int
    page_number: int | None
    label: str
    text: str
    extraction_status: Literal["extracted", "no_text"]


class ResearchDocument(DocumentMetadata):
    retrieval: dict | None = None
    id: str
    case_id: str
    source_kind: Literal["pdf", "txt", "pasted_text", "html", "structured_json"]
    original_filename: str | None
    uploaded_at: datetime
    extraction_status: Literal["extracted", "partial"]
    extraction_message: str | None
    page_count: int | None
    section_count: int
    size_bytes: int


class DocumentDetail(ResearchDocument):
    pages: list[DocumentPage]


class DeleteResult(BaseModel):
    deleted: bool
    document_id: str
