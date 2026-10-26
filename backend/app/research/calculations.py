"""Deterministic tools: no model calls or client arithmetic. Decimal precision=80."""
import json
from datetime import date
from decimal import Decimal, ROUND_HALF_EVEN, localcontext
from uuid import uuid4

from fastapi import HTTPException

from app.research.financial_models import CalculationRequest
from app.research.financial_store import FinancialStore
from app.research.store import now

SCALES = {"units": Decimal(1), "thousands": Decimal(1000), "millions": Decimal(1_000_000),
          "billions": Decimal(1_000_000_000), "lakh": Decimal(100_000), "crore": Decimal(10_000_000)}
SPECS = {
    "revenue_growth": ({"current": "revenue", "previous": "revenue"}, "(current - previous) / previous * 100", "%"),
    "net_profit_margin": ({"net_income": "net_income", "revenue": "revenue"}, "net_income / revenue * 100", "%"),
    "current_ratio": ({"current_assets": "current_assets", "current_liabilities": "current_liabilities"}, "current_assets / current_liabilities", "ratio"),
    "debt_to_equity": ({"total_debt": "total_debt", "total_equity": "total_equity"}, "total_debt / total_equity", "ratio"),
    "net_income_growth": ({"current": "net_income", "previous": "net_income"}, "(current - previous) / previous * 100", "%"),
    "working_capital": ({"current_assets": "current_assets", "current_liabilities": "current_liabilities"}, "current_assets - current_liabilities", "currency"),
}


class CalculationUnavailable(ValueError):
    pass


def normalized_value(value: str, scale: str) -> Decimal:
    with localcontext() as context:
        context.prec = 80
        context.rounding = ROUND_HALF_EVEN
        return Decimal(value) * SCALES[scale]


def revenue_growth(current: Decimal, previous: Decimal) -> Decimal:
    if previous <= 0:
        raise CalculationUnavailable("Growth is not meaningful for zero or negative prior revenue in this MVP.")
    with localcontext() as context:
        context.prec = 80
        context.rounding = ROUND_HALF_EVEN
        return (current - previous) / previous * 100


def net_profit_margin(net_income: Decimal, revenue: Decimal) -> Decimal:
    if revenue == 0:
        raise CalculationUnavailable("Net profit margin is unavailable: revenue is zero.")
    with localcontext() as context:
        context.prec = 80
        context.rounding = ROUND_HALF_EVEN
        return net_income / revenue * 100


def current_ratio(current_assets: Decimal, current_liabilities: Decimal) -> Decimal:
    if current_liabilities == 0:
        raise CalculationUnavailable("Current ratio is unavailable: current liabilities are zero.")
    with localcontext() as context:
        context.prec = 80
        context.rounding = ROUND_HALF_EVEN
        return current_assets / current_liabilities


def debt_to_equity(total_debt: Decimal, total_equity: Decimal) -> Decimal:
    if total_equity <= 0:
        raise CalculationUnavailable("Debt-to-equity is unavailable: equity is nonpositive.")
    with localcontext() as context:
        context.prec = 80
        context.rounding = ROUND_HALF_EVEN
        return total_debt / total_equity


def working_capital(current_assets: Decimal, current_liabilities: Decimal) -> Decimal:
    with localcontext() as context:
        context.prec = 80
        context.rounding = ROUND_HALF_EVEN
        return current_assets - current_liabilities


def net_income_growth(current: Decimal, previous: Decimal) -> Decimal:
    if previous <= 0:
        raise CalculationUnavailable('Net-income growth is not meaningful for zero or negative prior net income in this MVP.')
    return revenue_growth(current, previous)


TOOLS = {"revenue_growth": revenue_growth, "net_profit_margin": net_profit_margin,
         "current_ratio": current_ratio, "debt_to_equity": debt_to_equity,
         "net_income_growth": net_income_growth, "working_capital": working_capital}


def canonical(value):
    return " ".join((value or "").split()).casefold()


def financial_identity(fact):
    return (fact["metric"], canonical(fact["entity"]), fact["currency"], canonical(fact["accounting_scope"]),
            fact["period_type"], fact["period_start"] if fact["period_type"] == "duration" else None, fact["period_end"])


def calculate(store: FinancialStore, case_id: str, request: CalculationRequest) -> dict:
    roles, formula, unit = SPECS[request.calculation_type]
    unknown = set(request.inputs) - set(roles)
    if unknown or set(request.acknowledged_conflicts) - set(roles):
        raise HTTPException(422, f"Expected input roles: {', '.join(roles)}. Unknown roles are not accepted.")
    with store.store.connection() as db:
        # Serialize against analyst changes/document deletion until snapshots are saved.
        db.execute("BEGIN IMMEDIATE")
        store.store._case(db, case_id)
        receipt = {"id": str(uuid4()), "case_id": case_id, "calculation_type": request.calculation_type,
                   "formula": formula, "created_at": now(), "status": "unavailable", "result": None,
                   "display_result": None, "result_unit": unit, "precision": 80,
                   "rounding": "ROUND_HALF_EVEN to 2 decimal places for display; result retains Decimal precision (80 significant digits)",
                   "inputs": {}, "conversions": [], "sources": [], "warnings": [],
                   "missing_inputs": [], "conflicts": {}, "acknowledged_conflicts": request.acknowledged_conflicts,
                   "invalidated_at": None, "invalidation_reason": None}
        errors = receipt["warnings"]
        chosen = {}
        for role, metric in roles.items():
            fact_id = request.inputs.get(role)
            if not fact_id:
                receipt["missing_inputs"].append(f"{role} ({metric})")
                continue
            fact = store._fact(db, case_id, fact_id)  # Cross-case/missing IDs rejected, not trusted.
            chosen[role] = fact
            receipt["inputs"][role] = {key: value for key, value in fact.items() if key != "history"}
            receipt["sources"].append({**fact["source_snapshot"], "fact_id": fact_id,
                                       "revision": fact["revision"], "available_at_calculation": fact["source_available"]})
            if fact["metric"] != metric:
                errors.append(f"{role}: expected {metric}, got {fact['metric']}.")
            if fact["status"] != "confirmed" or fact["removed_at"] or not fact["source_available"]:
                errors.append(f"{role}: input must be confirmed, not removed, and linked to an available source.")
            if fact["ambiguity_note"]:
                errors.append(f"{role}: unresolved ambiguity requires analyst correction.")
            for field in ("entity", "currency", "scale", "accounting_scope", "period_end"):
                if not fact[field]:
                    receipt["missing_inputs"].append(f"{role}.{field}")
            if fact["scale"]:
                receipt["conversions"].append({"role": role, "from_scale": fact["scale"], "to_scale": "units",
                    "multiplier": str(SCALES[fact["scale"]]), "original_value": fact["value"],
                    "normalized_value": str(normalized_value(fact["value"], fact["scale"])), "currency": fact["currency"]})

        if len(chosen) == len(roles):
            values = list(chosen.values())
            if len({canonical(f["entity"]) for f in values}) != 1:
                errors.append("Inputs must belong to the same company/entity.")
            if len({f["currency"] for f in values}) != 1:
                errors.append("Currency mismatch. No implicit FX conversion is supported.")
            if len({canonical(f["accounting_scope"]) for f in values}) != 1:
                errors.append("Accounting scope/basis mismatch. Resolve consolidated/standalone or other basis differences.")
            income = request.calculation_type in ("revenue_growth", "net_profit_margin", "net_income_growth")
            for role, fact in chosen.items():
                if fact["period_type"] != ("duration" if income else "instant"):
                    errors.append(f"{role}: requires an explicit {'duration' if income else 'instant'} reporting period.")
                if income and not fact["period_start"]:
                    receipt["missing_inputs"].append(f"{role}.period_start")
            if income and all(f["period_start"] and f["period_end"] for f in values):
                if request.calculation_type in ("revenue_growth", "net_income_growth"):
                    current, previous = chosen["current"], chosen["previous"]
                    duration = lambda f: (date.fromisoformat(f["period_end"]) - date.fromisoformat(f["period_start"])).days + 1
                    if current["period_start"] <= previous["period_end"]:
                        errors.append("Growth periods must be nonoverlapping and in correct chronological order.")
                    if abs(duration(current) - duration(previous)) > 3:
                        errors.append("Growth periods have noncomparable durations (maximum difference is 3 calendar days).")
                elif len({(f["period_start"], f["period_end"]) for f in values}) != 1:
                    errors.append("Income-statement inputs must cover identical start/end dates.")
            if not income and len({f["period_end"] for f in values}) != 1:
                errors.append("Balance-sheet inputs must share the same reporting date.")

        rows = db.execute("SELECT payload FROM financial_facts WHERE case_id=?", (case_id,)).fetchall()
        all_facts = [json.loads(row["payload"]) for row in rows]
        for role, selected in chosen.items():
            conflicts = [f["id"] for f in all_facts if f["id"] != selected["id"] and f["status"] == "confirmed"
                         and not f["removed_at"] and f["source_available"] and financial_identity(f) == financial_identity(selected)
                         and f["scale"] and selected["scale"] and normalized_value(f["value"], f["scale"]) != normalized_value(selected["value"], selected["scale"])]
            if conflicts:
                receipt["conflicts"][role] = conflicts
                if set(request.acknowledged_conflicts.get(role, [])) != set(conflicts):
                    errors.append(f"{role}: competing confirmed values exist. Inspect and explicitly acknowledge the selected fact over all listed alternatives.")

        if receipt["missing_inputs"]:
            errors.append("Missing inputs/metadata: " + ", ".join(receipt["missing_inputs"]))
        if not errors:
            try:
                amounts = {role: normalized_value(fact["value"], fact["scale"]) for role, fact in chosen.items()}
                result = TOOLS[request.calculation_type](**amounts)
                with localcontext() as context:
                    context.prec = 100
                    display = format(result.quantize(Decimal("0.01"), rounding=ROUND_HALF_EVEN), "f")
                receipt.update(status="valid", result=format(result, "f"), display_result=display)
                if unit == 'currency':receipt['result_unit'] = next(iter(chosen.values()))['currency']
            except CalculationUnavailable as exc:
                errors.append(str(exc))
        db.execute("INSERT INTO calculation_receipts VALUES (?, ?, ?)", (receipt["id"], case_id, json.dumps(receipt)))
        for fact_id in set(request.inputs.values()) - {""}:
            fact = next(f for f in chosen.values() if f["id"] == fact_id)
            db.execute("INSERT INTO calculation_inputs VALUES (?, ?, ?)", (receipt["id"], fact_id, fact["revision"]))
        return receipt
