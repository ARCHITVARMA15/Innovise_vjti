import re

from app.research.analysis_models import ResearchPlan
from app.research.analysis_llm import structured_call
from app.research.analysis_state import AnalystState


async def planning_node(state: AnalystState) -> ResearchPlan:
    snapshot = state["snapshot"]
    plan = await structured_call(ResearchPlan,
        "Interpret the research question and plan only available operations. The only calculations are revenue_growth, net_profit_margin, current_ratio and debt_to_equity. No valuation, cash-flow modelling, forecasts, claim verification, risk ratings or trade decisions. Record unsupported requests as limitations. Calculation periods are exact financial fact period labels; for growth use [previous,current], for other tools zero or one label. Only specify period labels explicitly requested in the question or saved case reporting period; otherwise leave periods empty for Python ambiguity checks. Do not select fact IDs, change facts or calculate numbers. Evidence queries should be short lexical terms from the question. Missing fields remain unknown; never invent dates.",
        {"question": state["question"], "case": snapshot.case.model_dump(mode="json"),
         "available_fact_metadata": [{"metric": f.metric, "entity": f.entity, "period": f.reporting_period,
            "period_start": str(f.period_start) if f.period_start else None, "period_end": str(f.period_end) if f.period_end else None,
            "status": f.status} for f in snapshot.facts]})
    if any(len(task.periods) > 1 and task.calculation_type != "revenue_growth" for task in plan.calculations):
        raise ValueError("Non-growth calculation plan must choose at most one period per operation.")
    if any(task.calculation_type == "revenue_growth" and len(task.periods) == 1 for task in plan.calculations):
        raise ValueError("Growth planning requires both previous/current period labels, or neither.")
    if re.search(r"\b(valuation|forecast\w*|dcf|cash.flow|price.target|risk.assessment|trust.score|trade|approval|verification)\b", state["question"], re.I):
        plan.unsupported_requests.append("Valuation, forecasts, cash-flow modelling, verification, risk assessment, trading and approval operations are unavailable; this run only covers the supported preliminary research scope.")
    return plan
