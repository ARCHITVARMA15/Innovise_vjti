"""Python-validated bounded tasks. No external retrieval or autonomous fact changes."""
import asyncio
from app.research.analysis_models import ResearchPlan, CalculationTask
from app.research.calculations import canonical


def resolve_scope(state):
    request, snapshot = state.get('request', {}), state['snapshot']
    eligible = [f for f in snapshot.facts if f.status == 'confirmed' and f.source_available and not f.removed_at]
    entities = {canonical(f.entity) for f in eligible if f.entity}
    bases = {f.accounting_scope for f in eligible if f.accounting_scope}
    entity = request.get('entity') or snapshot.case.company_name
    basis = request.get('accounting_basis') or (next(iter(bases)) if len(bases) == 1 else None)
    periods = request.get('periods') or sorted({f.reporting_period for f in eligible if f.reporting_period})
    as_of = request.get('research_as_of_date') or snapshot.case.research_as_of_date
    questions = []
    if request.get('task_type'):
        if entities and canonical(entity) not in entities:
            questions.append('Specify the entity matching the reviewed facts; no ticker/entity alias is inferred.')
        if len(entities) > 1 and not request.get('entity'):
            questions.append('Select one entity explicitly from the reviewed facts.')
        if basis and bases and canonical(basis) not in {canonical(b) for b in bases}:
            questions.append('No reviewed facts match accounting_basis; review selected facts or explicitly correct the basis.')
        if request['task_type']=='document_comparison' and len([d for d in snapshot.documents if d.included])<2:
            questions.append('Select at least two temporally eligible documents for document comparison.')
        if not basis:
            questions.append('Specify accounting_basis (for example the exact consolidated or standalone basis).')
        if not periods:
            questions.append('Specify reporting periods; dates are not inferred from upload/publication time.')
        if not as_of:
            questions.append('Specify research_as_of_date to establish temporal eligibility.')
        if request['task_type'] == 'simple_metric' and not request.get('calculations'):
            questions.append('Select at least one supported calculation for the simple metric task.')
        if request['task_type'] == 'claim_verification' and not request.get('claim_ids'):
            questions.append('Select the saved claims to verify in Evidence.')
    return dict(entity=entity, periods=periods, accounting_basis=basis,
                research_as_of_date=str(as_of) if as_of else None, questions=questions,
                task_type=request.get('task_type') or 'legacy_preliminary',
                method='Python scope validation; no inferred aliases or reporting dates',
                budgets={'claim_additional_repairs':1,'investigation_additional_repairs':2,'overall_seconds':100})


def bounded_plan(state):
    request, scope = state['request'], state['scope']
    tasks = []
    margin_only = bool(request.get('calculations')) and all(
        t['calculation_type'] == 'net_profit_margin' for t in request['calculations'])
    for raw in request.get('calculations', []):
        task = CalculationTask.model_validate(raw)
        if any(p not in scope['periods'] for p in task.periods):
            raise ValueError('Calculation period is outside the explicit investigation scope.')
        if task.calculation_type == 'net_profit_margin':
            periods = task.periods
            if request.get('task_type') == 'simple_metric' and request.get('periods'):
                from app.research.analysis_financial import matches_periods
                # A margin-only Simple metric request covers its explicit periods.
                # In mixed requests scope may belong to growth; only selected margin
                # receipts may establish additional omitted margin operations.
                periods = [p for p in request['periods'] if margin_only or p in task.periods or any(
                    r.calculation_type == 'net_profit_margin' and matches_periods(r.model_dump(mode='json'),
                        CalculationTask(calculation_type='net_profit_margin', periods=[p]))
                    for r in state['snapshot'].selected_receipts)]
            for period in periods or [None]:
                separate = task.model_copy(update={'periods': [period] if period else []})
                if separate not in tasks:
                    tasks.append(separate)
        else:
            tasks.append(task)
    if len(tasks) > 8:
        raise ValueError('At most eight calculation operations per run, including separate margin periods. Select fewer periods or calculations.')
    # Only explicit analyst tasks; schema restricts tools and operation count.
    for task in tasks:
        if task.calculation_type != 'revenue_growth' and len(task.periods) > 1:
            raise ValueError('A ratio/margin task requires at most one period.')
        if task.calculation_type == 'revenue_growth' and len(task.periods) == 1:
            raise ValueError('Growth needs both comparable periods or unambiguous reviewed inputs.')
        if any(p not in scope['periods'] for p in task.periods):
            raise ValueError('Calculation period is outside the explicit investigation scope.')
    return ResearchPlan(objective=state['question'][:2000], supported_metrics=[], calculations=tasks,
        evidence_queries=[state['question'][:200]], required_periods=scope['periods'], missing_inputs=[],
        unsupported_requests=[], limitations=['Deterministic allowlisted task plan; no AI planning call was made.'])


def risk_node(state, store):
    from app.research.reports import assess_risks, scoped_snapshot
    from app.research.financial_store import FinancialStore
    if state['request']['task_type'] not in ('risk_assessment', 'full_research'):
        store.update(state['case_id'],state['run_id'],event=('risk_assessment','skipped','Risk synthesis not required by this task. Deterministic limitations remain in report.'))
        return {'items': [], 'status':'not_requested','method':'not_requested'}
    return assess_risks(scoped_snapshot(state['snapshot'].model_dump(mode='json'),state['scope']),
                        FinancialStore(store.store).list_receipts(state['case_id']),
                        (state.get('retrieval').limitations if state.get('retrieval') else []))


async def report_node(state, store):
    from app.research.verification_store import VerificationStore
    from app.research.verification_models import VerificationStart
    from app.research.reports import ReportStore, ReportCreate
    verifier = VerificationStore(store.store)
    # Synthesis findings are claims too. A citation alone is not a support verdict.
    for finding in state['brief'].findings:
        if not finding.model_generated:
            continue
        claim = verifier.import_finding(state['case_id'],state['run_id'],finding.model_dump(mode='json'))
        selected=[d.document.id for d in state['snapshot'].documents if d.included]
        if selected:
            run=verifier.create_run(state['case_id'],claim['id'],VerificationStart(supporting_document_ids=selected))
            from app.research.verification_engine import qualitative_check
            from app.research.verification_models import ClaimMapping
            from app.research.store import now
            run.update(status='running',started_at=now())
            verifier.save_run(run,('started','Final qualitative finding gate started.'))
            try:
                result=await qualitative_check(verifier,run,state['snapshot'],ClaimMapping(assertion_type='qualitative'))
                run.update(status='completed',finished_at=now(),result=result.model_dump(mode='json'))
            except asyncio.CancelledError:
                run.update(status='interrupted',finished_at=now(),result=None)
                run['errors'].append('Final finding gate interrupted by overall budget or shutdown; no verdict assigned.')
                verifier.save_run(run,('interrupted','Final finding gate interrupted.'))
                raise
            except Exception as error:
                from app.research.analysis_llm import StructuredOutputError, ModelCallError
                category=error.category if isinstance(error,(StructuredOutputError,ModelCallError)) else 'timeout' if isinstance(error,TimeoutError) else 'processing_error'
                run.update(status='failed',finished_at=now(),result=None)
                run['errors'].append(f'{category}: Final qualitative finding gate unavailable; no verdict assigned.')
            verifier.save_run(run,('final_finding_gate','Final qualitative finding assessed against selected saved evidence.'))
    report=ReportStore(store.store).create(state['case_id'],ReportCreate(analysis_run_id=state['run_id']))
    return {'report_id':report['id'],'version':report['version'],'rendering_method':report['rendering_method']}
