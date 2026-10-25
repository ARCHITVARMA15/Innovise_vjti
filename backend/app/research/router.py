import logging
import sqlite3
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, Request
from pydantic import ValidationError
from starlette.concurrency import run_in_threadpool

from app.research.extraction import MAX_UPLOAD_BYTES, extract_text, extract_upload
from app.research.models import (CaseCreate, DeleteResult, DocumentDetail, DocumentMetadata,
                                 ResearchCase, ResearchDocument, TextDocumentCreate)
from app.research.store import ResearchStore, research_directory
from app.research.financial_models import (Fact, FactInput, FactUpdate, FactRemoval, FactDeleteResult, ExtractionRequest,
    ExtractionRun, CalculationRequest, CalculationReceipt)
from app.research.financial_store import FinancialStore
from app.research.fact_extraction import extract_facts
from app.research.calculations import calculate
from app.research.analysis_models import AnalysisStart, AnalysisRun, AnalysisRunSummary
from app.research.analysis_store import AnalysisStore
from app.research.verification_store import VerificationStore
from app.research.verification_models import ClaimExtractionRun, Claim, ClaimInput, ClaimEdit, ClaimExtraction, ImportFindings, VerificationStart, VerificationRun
from app.research.claim_intake import extract_claims, import_run_findings

router = APIRouter(prefix="/research/cases", tags=["Research Lab"])
log = logging.getLogger(__name__)


def get_store():
    try:
        yield ResearchStore(research_directory())
    except (OSError, sqlite3.Error):
        log.exception("Research storage failure")
        raise HTTPException(503, "Research storage is unavailable. Please try again.") from None


Store = Annotated[ResearchStore, Depends(get_store)]


@router.get("", response_model=list[ResearchCase])
def list_cases(store: Store):
    return store.list_cases()


@router.post("", response_model=ResearchCase, status_code=201)
def create_case(payload: CaseCreate, store: Store):
    return store.create_case(payload)


@router.get("/{case_id}", response_model=ResearchCase)
def get_case(case_id: str, store: Store):
    return store.get_case(case_id)


@router.get("/{case_id}/documents", response_model=list[ResearchDocument])
def list_documents(case_id: str, store: Store):
    return store.list_documents(case_id)


@router.post("/{case_id}/documents/text", response_model=DocumentDetail, status_code=201)
def paste_document(case_id: str, payload: TextDocumentCreate, store: Store):
    store.get_case(case_id)
    data = payload.text.encode("utf-8")
    pages = extract_text(data)
    metadata = DocumentMetadata.model_validate(payload.model_dump(exclude={"text"}))
    return store.add_document(case_id, metadata, "pasted_text", None, data, pages)


@router.post("/{case_id}/documents/upload", response_model=DocumentDetail, status_code=201)
async def upload_document(
    case_id: str, store: Store, file: Annotated[UploadFile, File()],
    metadata: Annotated[str, Form(description="JSON-encoded DocumentMetadata: title required; publication_date, reporting_period, source_url, document_type optional.")],
):
    try:
        await run_in_threadpool(store.get_case, case_id)
        try:
            parsed = DocumentMetadata.model_validate_json(metadata)
        except ValidationError as exc:
            # Never return source text/input values in errors.
            message = "; ".join(f"{'.'.join(map(str, error['loc']))}: {error['msg']}" for error in exc.errors())
            raise HTTPException(422, f"Invalid document metadata: {message}") from None
        data = await file.read(MAX_UPLOAD_BYTES + 1)
        kind, pages = await run_in_threadpool(extract_upload, file.filename or "", data)
        # Handle both POSIX and Windows-style client names as display text only.
        display_name = (file.filename or "").replace("\\", "/").split("/")[-1][:240]
        return await run_in_threadpool(store.add_document, case_id, parsed, kind, display_name, data, pages)
    finally:
        await file.close()


@router.get("/{case_id}/documents/{document_id}", response_model=DocumentDetail)
def get_document(case_id: str, document_id: str, store: Store):
    return store.get_document(case_id, document_id)


@router.delete("/{case_id}/documents/{document_id}", response_model=DeleteResult)
def delete_document(case_id: str, document_id: str, store: Store):
    store.remove_document(case_id, document_id)
    return {"deleted": True, "document_id": document_id}


@router.get("/{case_id}/facts", response_model=list[Fact])
def list_facts(case_id: str, store: Store):
    return FinancialStore(store).list_facts(case_id)


@router.post("/{case_id}/facts", response_model=Fact, status_code=201)
def add_fact(case_id: str, payload: FactInput, store: Store):
    return FinancialStore(store).add_fact(case_id, payload)[0]


@router.patch("/{case_id}/facts/{fact_id}", response_model=Fact)
def review_fact(case_id: str, fact_id: str, payload: FactUpdate, store: Store):
    return FinancialStore(store).update_fact(case_id, fact_id, payload)


@router.delete("/{case_id}/facts/{fact_id}", response_model=FactDeleteResult)
def remove_fact(case_id: str, fact_id: str, payload: FactRemoval, store: Store):
    FinancialStore(store).remove_fact(case_id, fact_id, payload.expected_revision)
    return {"deleted": True, "fact_id": fact_id}


@router.get("/{case_id}/extractions", response_model=list[ExtractionRun])
def list_extractions(case_id: str, store: Store):
    return FinancialStore(store).list_runs(case_id)


@router.post("/{case_id}/extractions", response_model=ExtractionRun, status_code=201)
async def extract_financial_facts(case_id: str, payload: ExtractionRequest, store: Store):
    return await extract_facts(FinancialStore(store), case_id, payload.document_ids, payload.section_ids)


@router.get("/{case_id}/calculations", response_model=list[CalculationReceipt])
def list_calculations(case_id: str, store: Store):
    return FinancialStore(store).list_receipts(case_id)


@router.post("/{case_id}/calculations", response_model=CalculationReceipt, status_code=201)
def calculate_financial_metric(case_id: str, payload: CalculationRequest, store: Store):
    return calculate(FinancialStore(store), case_id, payload)


@router.post("/{case_id}/analysis-runs", response_model=AnalysisRun, status_code=202)
async def start_analysis(case_id: str, payload: AnalysisStart, request: Request):
    manager = getattr(request.app.state, "analysis_manager", None)
    if manager is None:
        raise HTTPException(503, "Research worker is not initialized. Restart the backend with application lifespan enabled.")
    return manager.start(case_id, payload)


@router.get("/{case_id}/analysis-runs", response_model=list[AnalysisRunSummary])
def list_analysis(case_id: str, store: Store):
    return AnalysisStore(store).list(case_id)


@router.get("/{case_id}/analysis-runs/{run_id}", response_model=AnalysisRun)
def read_analysis(case_id: str, run_id: str, store: Store):
    return AnalysisStore(store).get(case_id, run_id)


@router.get('/{case_id}/claims',response_model=list[Claim])
def list_claims(case_id:str,store:Store):
    return VerificationStore(store).claims(case_id)


@router.post('/{case_id}/claims',response_model=Claim,status_code=201)
def create_claim(case_id:str,payload:ClaimInput,store:Store):
    return VerificationStore(store).add(case_id,payload)


@router.patch('/{case_id}/claims/{claim_id}',response_model=Claim)
def edit_claim(case_id:str,claim_id:str,payload:ClaimEdit,store:Store):
    return VerificationStore(store).edit(case_id,claim_id,payload)


@router.post('/{case_id}/claims/import-findings',response_model=list[Claim])
def import_claims(case_id:str,payload:ImportFindings,store:Store):
    return import_run_findings(VerificationStore(store),case_id,payload.analysis_run_id)


@router.post('/{case_id}/claims/extract', response_model=ClaimExtractionRun)
async def extract_note_claims(case_id:str,payload:ClaimExtraction,store:Store):
    return await extract_claims(VerificationStore(store),case_id,payload.document_id)


@router.get('/{case_id}/verifications',response_model=list[VerificationRun])
def list_verifications(case_id:str,store:Store):
    return VerificationStore(store).runs(case_id)


@router.get('/{case_id}/verifications/{run_id}',response_model=VerificationRun)
def get_verification(case_id:str,run_id:str,store:Store):
    return VerificationStore(store).get_run(case_id,run_id)


@router.post('/{case_id}/claims/{claim_id}/verifications',response_model=VerificationRun,status_code=202)
async def start_verification(case_id:str,claim_id:str,payload:VerificationStart,request:Request):
    manager=getattr(request.app.state,'verification_manager',None)
    if manager is None:
        raise HTTPException(503,'Verification worker is not initialized. Restart the backend.')
    return manager.start(case_id,claim_id,payload)


from app.research.reports import ReportStore, ReportCreate, ReviewRequest, ResearchReport


@router.get('/{case_id}/reports', response_model=list[ResearchReport])
def list_reports(case_id: str, store: Store):
    return ReportStore(store).list(case_id)


@router.post('/{case_id}/reports', response_model=ResearchReport, status_code=201)
def compose_report(case_id: str, payload: ReportCreate, store: Store):
    return ReportStore(store).create(case_id, payload)


@router.get('/{case_id}/reports/{report_id}', response_model=ResearchReport)
def get_report(case_id: str, report_id: str, store: Store):
    return ReportStore(store).get(case_id, report_id)


@router.post('/{case_id}/reports/{report_id}/reviews', response_model=ResearchReport)
def review_report(case_id: str, report_id: str, payload: ReviewRequest, store: Store):
    return ReportStore(store).review(case_id, report_id, payload)
