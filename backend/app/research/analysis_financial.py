from uuid import uuid4
from datetime import date
import re

from app.research.analysis_models import FinancialOutput, Finding
from app.research.analysis_state import AnalystState
from app.research.analysis_store import AnalysisStore
from app.research.calculations import SPECS, calculate, canonical
from app.research.financial_models import CalculationRequest
from app.research.financial_store import FinancialStore


def matches_fact_period(fact, label, *, explicit=False):
    if canonical(fact.get("reporting_period")) == canonical(label):
        return True
    provenance=fact.get('source_snapshot',{}).get('structured_provenance') or {}
    if explicit and provenance.get('fiscal_label')==label and fact.get('period_end')==provenance.get('period_end'):
        return True
    # Only an explicitly chosen receipt may bind an FY label to its reviewed
    # annual dates. Automatic selection continues to require exact labels.
    fiscal = re.fullmatch(r"FY(\d{4})", label.strip(), re.I) if explicit else None
    if not fiscal or fact.get("period_type") != "duration" or re.fullmatch(r"FY\d{4}", (fact.get("reporting_period") or "").strip(), re.I):
        return False
    try:
        start, end = date.fromisoformat(fact["period_start"]), date.fromisoformat(fact["period_end"])
    except (KeyError, TypeError, ValueError):
        return False
    return end.year == int(fiscal[1]) and (end - start).days in (364, 365)


def matches_periods(receipt, task):
    periods = task.periods
    if not periods:
        return True
    if task.calculation_type == "revenue_growth":
        return len(periods) == 2 and all(matches_fact_period(receipt["inputs"].get(role, {}), label, explicit=True)
                   for role, label in zip(("previous", "current"), periods))
    if len(periods) != 1:
        return False
    inputs = list(receipt['inputs'].values())
    if inputs and all(matches_fact_period(f, periods[0], explicit=True) for f in inputs):
        return True
    # A valid explicitly chosen ratio receipt may have different saved labels
    # for the very same reviewed period. Require an exact label anchor and
    # identical complete period dates for every input; never infer new dates.
    anchors = [f for f in inputs if canonical(f.get('reporting_period')) == canonical(periods[0])]
    if not anchors:
        return False
    anchor = anchors[0]
    return bool(anchor.get('period_end') and anchor.get('period_type') in ('instant', 'duration')
        and (anchor['period_type'] != 'duration' or anchor.get('period_start'))
        and all(all(f.get(k) == anchor.get(k) for k in ('period_type', 'period_start', 'period_end')) for f in inputs))


def financial_node(state: AnalystState, store: AnalysisStore) -> FinancialOutput:
    snapshot = state["snapshot"]
    facts = [f.model_dump(mode="json") for f in snapshot.facts if f.status == "confirmed" and f.source_available and not f.removed_at and not f.ambiguity_note]
    confirmed = facts
    scope=state.get('scope',{}) if state.get('request',{}).get('task_type') else {}
    if scope:
        facts=[f for f in facts if canonical(f['entity'])==canonical(scope['entity'])
            and canonical(f['accounting_scope'])==canonical(scope['accounting_basis'])
            and f['reporting_period'] in scope['periods']
            and (not scope.get('research_as_of_date') or not f['period_end'] or f['period_end']<=scope['research_as_of_date'])]
    fact_map = {f["id"]: f for f in confirmed}
    financial_store = FinancialStore(store.store)
    receipts = financial_store.list_receipts(state["case_id"])
    findings, used, needs = [], [], []
    for index, task in enumerate(state["plan"].calculations):
        prefix = f"Operation {index + 1} ({task.calculation_type})" + (f" [{', '.join(task.periods)}]" if task.periods else "")
        roles, _, _ = SPECS[task.calculation_type]
        chosen_snapshots = [r for r in snapshot.selected_receipts if r.calculation_type == task.calculation_type
            and matches_periods(r.model_dump(mode="json"), task)]
        if any(r.id not in {live['id'] for live in receipts} for r in chosen_snapshots):
            needs.append(f"{prefix}: selected Financials receipt is no longer available.")
            continue
        explicit = [r for r in receipts if r["id"] in {s.id for s in snapshot.selected_receipts}
            and r["calculation_type"] == task.calculation_type]
        selected_receipts = [r for r in explicit if matches_periods(r, task)]
        if explicit and not selected_receipts:
            needs.append(f"{prefix}: selected Financials receipt periods are incompatible with this operation. Use its exact reviewed period labels.")
            continue
        if len(selected_receipts) > 1:
            needs.append(f"{prefix}: select one Financials receipt for this operation/period, not multiple alternatives.")
            continue
        selected = {}
        receipt = selected_receipts[0] if selected_receipts else None
        if receipt:
            if receipt["status"] != "valid" or any(f["id"] not in fact_map or f["revision"] != fact_map[f["id"]]["revision"] for f in receipt["inputs"].values()):
                needs.append(f"{prefix}: selected Financials receipt is stale or does not match confirmed snapshot revisions.")
                continue
            if set(receipt["inputs"]) != set(roles) or any(
                    f["metric"] != roles[role] for role, f in receipt["inputs"].items()):
                needs.append(f"{prefix}: selected Financials receipt has incompatible input roles or metrics.")
                continue
            if scope and any(canonical(f['entity']) != canonical(scope['entity'])
                    or canonical(f['accounting_scope']) != canonical(scope['accounting_basis'])
                    or not any(matches_fact_period(f, label, explicit=True) for label in scope['periods'])
                    or (scope.get('research_as_of_date') and (not f['period_end'] or f['period_end'] > scope['research_as_of_date']))
                    for f in receipt['inputs'].values()):
                needs.append(f"{prefix}: selected Financials receipt is outside the entity, basis, period or as-of scope.")
                continue
            selected = {role: f["id"] for role, f in receipt["inputs"].items()}
        else:
            if any(canonical(period) not in canonical(state["question"] + " " + (snapshot.case.reporting_period or "") + " " + " ".join(scope.get("periods",[]))) for period in task.periods):
                needs.append(f"{prefix}: requested period labels must be explicit in the question or case reporting period. Provide a run question with exact periods.")
                continue
            for role, metric in roles.items():
                options = [f for f in facts if f["metric"] == metric]
                if task.periods:
                    label = task.periods[0 if role == "previous" else -1]
                    options = [f for f in options if canonical(f["reporting_period"]) == canonical(label)]
                elif task.calculation_type == "revenue_growth":
                    revenues = sorted(options, key=lambda f: f["period_end"] or "")
                    options = ([revenues[0 if role == "previous" else 1]] if len(revenues) == 2
                               and revenues[0]["period_end"] and revenues[1]["period_end"]
                               and revenues[0]["period_end"] != revenues[1]["period_end"] else [])
                if len(options) != 1:
                    alternatives = ", ".join(f"{f['id']} ({f['reporting_period'] or 'unknown period'})" for f in options)
                    needs.append(f"{prefix}.{role}: {'missing or ambiguous confirmed periods' if not options else 'multiple confirmed choices: ' + alternatives}. Resolve in Financials and select one valid receipt, or provide explicit periods in a new run.")
                else:
                    selected[role] = options[0]["id"]
            if len(selected) != len(roles):
                continue
            reusable = [r for r in receipts if r["status"] == "valid" and r["calculation_type"] == task.calculation_type
                and {role: f["id"] for role, f in r["inputs"].items()} == selected
                and all(f["revision"] == fact_map[f["id"]]["revision"] for f in r["inputs"].values())
                and not r["acknowledged_conflicts"]]
            # Identical input/revision receipts are interchangeable; no competing financial input is chosen.
            receipt = reusable[0] if reusable else calculate(financial_store, state["case_id"], CalculationRequest(
                calculation_type=task.calculation_type, inputs=selected))
        used.append(receipt["id"])
        if receipt["status"] != "valid" or any(f["revision"] != fact_map[f["id"]]["revision"] for f in receipt["inputs"].values()):
            needs.append(f"{prefix}: " + "; ".join(receipt["warnings"] or ["Input revisions changed during execution."]))
            continue
        periods = sorted({f["reporting_period"] or f["period_end"] or "unknown period" for f in receipt["inputs"].values()})
        text = f"{task.calculation_type.replace('_', ' ').capitalize()} ({', '.join(periods)}): {receipt['display_result']}{'%' if receipt['result_unit'] == '%' else ' ×'}."
        findings.append(Finding(id=str(uuid4()), text=text, finding_type="numerical_observation", model_generated=False,
            receipt_ids=[receipt["id"]], fact_ids=list(selected.values()), limitations=["Based on analyst-confirmed facts and the saved deterministic calculation; not independently verified."]))
    if len(findings) != len(state['plan'].calculations) and not needs:
        needs.append('Not every planned financial operation produced a validated receipt-backed finding. Review the missing periods and start a new run.')
    return FinancialOutput(findings=findings, receipt_ids=list(dict.fromkeys(used)), needs_input=needs,
        limitations=["Only the four supported tools are available. No extraction, fact confirmation, conflict acknowledgement or fact mutation is performed by this workflow."])
