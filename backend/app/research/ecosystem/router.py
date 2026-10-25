import asyncio
import os
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sse_starlette.sse import EventSourceResponse

from app.research.router import get_store
from app.research.store import ResearchStore
from .engine import calculate_scenario
from .models import InvestigationStart, ReviewInput, Run, ScenarioInput
from .store import EcosystemStore
from .workflow import TERMINAL

router = APIRouter(prefix='/research/cases/{case_id}/ecosystem', tags=['Ecosystem Risk'])
Research = Annotated[ResearchStore, Depends(get_store)]


def demo_enabled():
    return os.environ.get('VERITAS_ECOSYSTEM_DEMO') == '1'


def manager_for(request):
    manager = getattr(request.app.state, 'ecosystem_manager', None)
    if manager is None:
        raise HTTPException(503, 'Ecosystem worker is unavailable. Start the backend with application lifespan enabled.')
    return manager


@router.get('/config')
def config(case_id: str, research: Research):
    case = research.get_case(case_id)
    return {'demo_enabled': demo_enabled(), 'max_depth': 1, 'max_counterparties': 5, 'max_retries': 2,
            'supported_targets': ['Microsoft Corporation', 'LinkedIn Corporation', 'Spirit AeroSystems Holdings, Inc.'],
            'synthetic_demo_available': case['company_name'].strip().lower() in ('microsoft corporation', 'microsoft', 'linkedin corporation', 'linkedin'),
            'runtime_tools': ['curated_disclosures', 'confirmed_case_financials', 'deterministic_financial_calculations'],
            'network_tools': [], 'model_calls': False, 'demo_as_of_date': '2025-07-30'}


@router.get('/investigations', response_model=list[Run])
def investigations(case_id: str, research: Research):
    return EcosystemStore(research).list(case_id)


@router.post('/investigations', response_model=Run, status_code=202)
async def start(case_id: str, payload: InvestigationStart, request: Request, research: Research):
    research.get_case(case_id)
    return manager_for(request).start(case_id, payload)


@router.post('/demo/load', response_model=Run, status_code=202)
async def load_demo(case_id: str, payload: InvestigationStart, request: Request, research: Research):
    research.get_case(case_id)
    if not demo_enabled():
        raise HTTPException(403, 'Synthetic fixture loading is disabled on this server.')
    return manager_for(request).start(case_id, payload, mode='demo')


@router.get('/investigations/{run_id}', response_model=Run)
def investigation(case_id: str, run_id: str, research: Research):
    return EcosystemStore(research).get(case_id, run_id)


@router.post('/investigations/{run_id}/review', response_model=Run)
def review(case_id: str, run_id: str, payload: ReviewInput, research: Research):
    return EcosystemStore(research).review(case_id, run_id, payload)


@router.post('/investigations/{run_id}/scenarios', response_model=Run)
def scenario(case_id: str, run_id: str, payload: ScenarioInput, research: Research):
    store = EcosystemStore(research)
    return store.add_scenario(case_id, run_id, calculate_scenario(store.get(case_id, run_id), payload))


@router.get('/investigations/{run_id}/events')
async def events(case_id: str, run_id: str, request: Request, research: Research, after: int = Query(0, ge=0)):
    store = EcosystemStore(research)
    store.get(case_id, run_id)  # Fail with a normal case-scoped 404 before headers.
    async def stream():
        cursor = after
        while not await request.is_disconnected():
            run = store.get(case_id, run_id)
            for event in run.events:
                if event.id > cursor:
                    yield {'event': 'stage', 'id': str(event.id), 'data': event.model_dump_json()}
                    cursor = event.id
            if run.status in TERMINAL:
                yield {'event': 'done', 'data': '{"status":"'+run.status+'"}'}
                return
            await asyncio.sleep(.5)
    return EventSourceResponse(stream(), ping=15, send_timeout=10)
