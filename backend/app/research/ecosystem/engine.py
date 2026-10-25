"""Curated evidence tools. No retrieved text is evaluated as code or instructions."""
import hashlib
import json
from datetime import date
from decimal import Decimal, localcontext
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException

from app.research.calculations import TOOLS, SPECS, CalculationUnavailable, canonical, normalized_value
from app.research.financial_store import FinancialStore, validate_excerpt
from app.research.store import now
from .models import Entity, EvidenceStatus as Status, Exposure, FinancialAssessment, Finding, Metric, Relationship, Run, Scenario, ScenarioInput, Source

FIXTURE = Path(__file__).parent / 'fixtures' / 'microsoft_demo.json'


def fixture_data():
    return json.loads(FIXTURE.read_text())


def curated_data():
    """Additive registry; the Microsoft scenario and existing snapshots stay intact."""
    datasets = [fixture_data(), json.loads(FIXTURE.with_name('spirit_2024_real.json').read_text())]
    return {key: [item for data in datasets for item in data[key]]
            for key in ('entities', 'sources', 'relationships', 'metrics')}


def resolve_entity(value, entities):
    matches = [e for e in entities if canonical(value) in {canonical(x) for x in [e.id, e.name, e.ticker, *e.aliases, *e.external_ids.values()] if x}]
    return matches[0] if len(matches) == 1 else None


def source_eligible(source: Source, run: Run):
    return source.published_at is not None and source.published_at <= run.request.as_of_date


def digest(source):
    return hashlib.sha256(source.text.encode()).hexdigest()


def discover(run: Run, research):
    data = curated_data()
    registry = [Entity.model_validate(e) for e in data['entities']]
    case = research.get_case(run.case_id)
    target_text = run.request.target or case['company_name']
    target = resolve_entity(target_text, registry)
    case_entity = resolve_entity(case['company_name'], registry)
    ticker_entity = resolve_entity(case.get('ticker'), registry) if case.get('ticker') else None
    if not target or target.id not in ('msft', 'linkedin', 'spirit') or target.synthetic:
        run.questions = ['Target is unsupported or ambiguous in the curated entity registry. Supported targets: Microsoft, LinkedIn and Spirit AeroSystems. No fuzzy entity match was assumed.']
        return
    if (case_entity and case_entity.id != target.id) or (ticker_entity and ticker_entity.id != target.id) or (case.get('ticker') and not ticker_entity):
        run.questions = ['The requested target and saved case company/ticker do not resolve to one entity. Use a matching case or correct the target explicitly.']
        return
    if not case_entity:
        run.questions = ['Saved case company is not an unambiguous match for this curated target. Create a matching company case.']
        return
    run.target_entity_id = target.id
    candidates = [Relationship.model_validate(r) for r in data['relationships']
                  if target.id in (r['source_entity_id'], r['target_entity_id']) and (run.mode == 'demo' or not r.get('synthetic'))]
    unique = {}
    for relation in candidates:
        identity = relation.source_entity_id, relation.target_entity_id, relation.relationship_type
        if relation.source_entity_id != relation.target_entity_id:
            unique.setdefault(identity, relation)
    if len(unique) > run.request.max_counterparties:
        run.limitations.append('Candidate relationships beyond the explicit counterparty limit were not investigated.')
    run.relationships = list(unique.values())[:run.request.max_counterparties]
    ids = {target.id, *[x for r in run.relationships for x in (r.source_entity_id, r.target_entity_id)]}
    run.entities = [e for e in registry if e.id in ids]
    run.metrics = [Metric.model_validate(m) for m in data['metrics'] if m['entity_id'] in ids and (run.mode == 'demo' or not m.get('synthetic'))]
    needed = {s for r in run.relationships for s in [*r.source_ids, *r.event_source_ids, *r.attribute_source_ids]} | {m.source_id for m in run.metrics}
    run.sources = [Source.model_validate(s) for s in data['sources'] if s['id'] in needed]
    for source in run.sources:
        source.content_hash = digest(source)
    read_financials(run, research)
    run.limitations.append('Curated discovery is not an exhaustive corporate/supply-chain search. Source assertions are server-owned extracted annotations, not autonomous web verification.')
    if run.mode == 'demo':
        run.limitations.append('All named Demo counterparties, dependencies, distress events and their financial metrics are fictional. Their pathways are hypotheses, not allegations about Microsoft.')
    if 'spirit' in ids:
        run.limitations.extend([
            'Historical FY2024 case. Customer concentrations are rounded shares of Spirit revenue, not Boeing/Airbus procurement shares. No multi-hop ownership is inferred.',
            'The Boeing strike was historical by the 28 February 2025 cutoff. Documented operational announcements do not establish a quantified realized loss or a currently active strike.',
            'Spirit was already financially stressed. This case demonstrates documented customer dependency and operational transmission, not a financially healthy target becoming distressed solely because of one customer.',
            'The announced Boeing acquisition was pending at the historical cutoff. This curated snapshot is not a current ownership or risk report.',
        ])


def read_financials(run: Run, research):
    """Read-only adapter to existing reviewed, source-linked financial facts."""
    facts = FinancialStore(research).list_facts(run.case_id)
    if len(facts) > 1000:
        run.limitations.append('Only the newest 1,000 saved financial facts were inspected under the snapshot budget.')
    snapshot_chars = 0
    for fact in facts[:1000]:
        if fact['status'] != 'confirmed' or not fact['source_available'] or fact['removed_at'] or fact.get('ambiguity_note'):
            continue
        entity = resolve_entity(fact['entity'], run.entities)
        if not entity or not all(fact.get(key) for key in ['period_end', 'currency', 'scale', 'reporting_period', 'accounting_scope']):
            continue
        if date.fromisoformat(fact['period_end']) > run.request.as_of_date:
            continue
        document = research.get_document(run.case_id, fact['document_id'])
        if not document['publication_date'] or date.fromisoformat(document['publication_date']) > run.request.as_of_date:
            continue
        section = next((p for p in document['pages'] if p['id'] == fact['section_id']), None)
        if not section:
            continue
        try:
            validate_excerpt(section['text'], fact['excerpt'])
        except HTTPException:
            run.uncertainties.append(f"Fact {fact['id']} no longer matches its source excerpt and was excluded.")
            continue
        snapshot_chars += len(fact['excerpt'])
        if snapshot_chars > 250000:
            run.limitations.append('The 250,000-character case financial excerpt budget was reached; remaining facts were not included.')
            break
        sid = f"case-{fact['document_id']}-{fact['section_id']}-{fact['id']}"
        if not any(s.id == sid for s in run.sources):
            source = Source(id=sid, title=document['title'], url=document['source_url'], publisher='Analyst-supplied case document',
                published_at=document['publication_date'], retrieved_at=document['uploaded_at'], document_page=section['label'],
                document_version=f"{document['id']}:{section['id']}", text=fact['excerpt'], kind='case_document', case_document_id=document['id'])
            source.content_hash = digest(source)
            run.sources.append(source)
        run.metrics.append(Metric(id='fact-'+fact['id'], entity_id=entity.id, metric=fact['metric'], value=fact['value'],
            currency=fact['currency'], units=fact['scale'], period=fact['reporting_period'], period_type=fact['period_type'],
            period_start=fact['period_start'], period_end=fact['period_end'], reporting_basis=fact['accounting_scope'],
            document_version=f"{fact['document_id']}:{fact['section_id']}", source_id=sid,
            provenance='Existing FinancialStore analyst-confirmed fact; confirmation is not independent source verification.',
            source_fact_id=fact['id'], source_fact_revision=fact['revision']))


def verify_relationship(relation: Relationship, sources: list[Source], run: Run):
    relation.data_issues = []
    mapping = {s.id: s for s in sources}
    candidates = [mapping[sid] for sid in relation.source_ids if sid in mapping]
    superseded = {s.supersedes for s in sources if s.supersedes and source_eligible(s, run)}
    # Prefer eligible amendments; never mix an amendment published after as-of.
    amended = [s for s in sources if s.supersedes in relation.source_ids and source_eligible(s, run)]
    if amended:
        candidates.extend(amended)
        relation.source_ids = list(dict.fromkeys([*relation.source_ids, *[s.id for s in amended]]))
        relation.data_issues.append('A newer source version supersedes earlier evidence; earlier snapshots are retained.')
    candidates = [s for s in candidates if s.id not in superseded]
    if relation.effective_from and relation.effective_from > run.request.as_of_date or relation.effective_to and relation.effective_to < run.request.as_of_date:
        relation.status = Status.UNRESOLVED
        relation.rationale = 'Relationship validity dates do not cover the investigation as-of date.'
        return
    binding = '|'.join([relation.id, relation.source_entity_id, relation.target_entity_id, relation.relationship_type])
    eligible = []
    for source in candidates:
        if not source_eligible(source, run):
            relation.data_issues.append(f'{source.id}: publication date unknown or after as-of.')
            continue
        if (run.request.as_of_date - source.published_at).days > run.request.stale_after_days:
            relation.data_issues.append(f'{source.id}: stale evidence; a current disclosure is required.')
            continue
        if source.content_hash != digest(source):
            relation.data_issues.append(f'{source.id}: source snapshot hash mismatch.')
            continue
        eligible.append(source)
    if relation.synthetic:
        relation.status = Status.UNRESOLVED
        relation.rationale = 'Synthetic fixture connection. Used only to illustrate a hypothetical pathway; not a verified real-world relationship.'
        return
    official = [s for s in eligible if s.kind == 'official']
    if any('not:'+binding in s.assertions or any(a.startswith(relation.id+'|') and a != binding for a in s.assertions) for s in official):
        relation.status = Status.CONTRADICTED
        relation.rationale = 'Eligible primary-source structured evidence contradicts the claimed direction or relationship.'
        return
    support = [s for s in official if binding in s.assertions]
    if support:
        try:
            if not any(relation.excerpt and _excerpt_matches(s.text, relation.excerpt) for s in support):
                raise ValueError('Excerpt mismatch')
            relation.status = Status.VERIFIED
            relation.rationale = 'Curated primary-source relationship, entity IDs, direction and saved claim match. Source summaries are analyst-curated annotations; legal holding, guarantees and loss amounts are not inferred.'
            return
        except ValueError:
            relation.data_issues.append('Claim excerpt does not match the supporting source snapshot.')
    relation.status = Status.UNRESOLVED if relation.data_issues else Status.UNSUPPORTED
    relation.rationale = 'No temporally eligible primary-source structured assertion supports this exact entity pair and relationship. News/rumors alone cannot verify it.'


def _excerpt_matches(text, excerpt):
    try:
        validate_excerpt(text, excerpt)
        return True
    except HTTPException:
        return False


def evidence_for(run, ids, assertion, synthetic=False):
    return [s for s in run.sources if s.id in ids and source_eligible(s, run)
            and (run.request.as_of_date - s.published_at).days <= run.request.stale_after_days
            and s.kind == ('synthetic' if synthetic else 'official') and assertion in s.assertions
            and s.content_hash == digest(s)]


def materiality(relation: Relationship, run: Run):
    attrs = evidence_for(run, relation.attribute_source_ids, 'attributes:'+relation.id, relation.synthetic)
    known = bool(attrs) and (relation.synthetic or relation.status == Status.VERIFIED)
    level, reason = 'UNKNOWN', 'No supported dependency or substitutability attributes are available. Missing data is not low exposure.'
    if known and relation.replaceability == 'replaceable' and relation.criticality == 'noncritical' and relation.inventory_buffer == 'adequate':
        level, reason = 'LOW', 'Noncritical input, qualified replacement and adequate buffer support a limited operational pathway; counterparty distress alone does not raise target risk.'
    elif known and relation.criticality == 'critical' and relation.replaceability == 'sole_source':
        level, reason = 'HIGH', 'A critical sole-source input supports high qualitative dependency; inventory/qualification timing must still be checked.'
    elif known and relation.criticality == 'critical' and relation.replaceability == 'replaceable':
        level, reason = 'MEDIUM', 'Critical input has replacements, but switching interruption remains plausible.'
    elif known and relation.dependency_percent is not None:
        level = 'HIGH' if relation.dependency_percent >= 30 else 'MEDIUM' if relation.dependency_percent >= 10 else 'LOW'
        reason = 'Disclosed concentration classified under demo screening thresholds: ≥30% high, ≥10% medium, otherwise low. These thresholds are not universal financial standards.'
    return Exposure(relationship_id=relation.id, materiality=level, basis=('Hypothetical fixture assumptions. ' if relation.synthetic else '')+reason,
        facts={'dependency_percent': str(relation.dependency_percent) if known and relation.dependency_percent is not None else None,
               'criticality': relation.criticality if known else 'unknown', 'replaceability': relation.replaceability if known else 'unknown',
               'inventory_buffer': relation.inventory_buffer if known else 'unknown',
               'dependency_basis': relation.dependency_basis if known else None},
        mitigants=relation.mitigants if known else [], hypothetical=relation.synthetic, evidence_ids=[s.id for s in attrs])


def assess_entity(entity: Entity, run: Run):
    result = FinancialAssessment(entity_id=entity.id, synthetic=entity.synthetic)
    eligible = {s.id for s in run.sources if source_eligible(s, run) and s.content_hash == digest(s)
                and (run.request.as_of_date - s.published_at).days <= run.request.stale_after_days}
    metrics = [m for m in run.metrics if m.entity_id == entity.id and m.source_id in eligible and m.period_end <= run.request.as_of_date]
    ratios = {}
    for tool_name in ('current_ratio', 'debt_to_equity', 'net_profit_margin'):
        roles = SPECS[tool_name][0]
        groups = {}
        for metric in metrics:
            if metric.metric in roles.values():
                key = (metric.currency, metric.period_type, metric.period_start, metric.period_end, canonical(metric.reporting_basis))
                groups.setdefault(key, {}).setdefault(metric.metric, []).append(metric)
        complete = [(k, g) for k, g in groups.items() if all(key in g for key in roles.values())
                    and k[1] == ('duration' if tool_name == 'net_profit_margin' else 'instant')
                    and (tool_name != 'net_profit_margin' or k[2] is not None)]
        if not complete:
            result.limitations.append(f'{tool_name}: no complete matching entity/period/currency/basis input pair. Different scopes are not treated as contradictions.')
            continue
        latest = max(k[3] for k, _ in complete)
        current = [(k, g) for k, g in complete if k[3] == latest]
        if len(current) != 1 or any(len({normalized_value(m.value, m.units) for m in options}) > 1 for options in current[0][1].values()):
            result.limitations.append(f'{tool_name}: competing values/bases require analyst selection; no ratio was chosen.')
            continue
        _, candidates = current[0]
        selected = {role: candidates[key][0] for role, key in roles.items()}
        if any(m.synthetic for m in selected.values()):
            result.synthetic = True
        try:
            answer = TOOLS[tool_name](**{role: normalized_value(m.value, m.units) for role, m in selected.items()})
        except CalculationUnavailable as error:
            result.limitations.append(str(error))
            continue
        result.calculations.append({'tool': tool_name, 'formula': SPECS[tool_name][1], 'result': str(answer),
            'display_result': f'{answer:.2f}', 'unit': SPECS[tool_name][2], 'inputs': {role: m.model_dump(mode='json') for role, m in selected.items()},
            'provenance': 'Existing app.research.calculations Decimal tool; source snapshots retained.'})
        result.metric_ids.extend(m.id for m in selected.values())
        ratios[tool_name] = answer
    current = ratios.get('current_ratio')
    leverage = ratios.get('debt_to_equity')
    if current is not None:
        result.distress = 'HIGH' if current < 1 else 'MEDIUM' if leverage is not None and leverage >= 2 else 'LOW'
        result.observations.append('Screening rule: current ratio <1 flags liquidity pressure; otherwise debt/equity ≥2 flags leverage attention. This is not a default probability or a comprehensive health verdict.')
    else:
        result.observations.append('Counterparty financial distress cannot be established from the available comparable metrics.')
    cash_pairs = [(income, cash) for income in metrics for cash in metrics
                  if income.metric == 'net_income' and cash.metric == 'operating_cash_flow'
                  and income.period_type == cash.period_type == 'duration' and income.period_start
                  and (income.currency, income.period_start, income.period_end, canonical(income.reporting_basis))
                  == (cash.currency, cash.period_start, cash.period_end, canonical(cash.reporting_basis))]
    if cash_pairs:
        latest = max(i.period_end for i, _ in cash_pairs)
        latest_pairs = [(i, c) for i, c in cash_pairs if i.period_end == latest]
        if all(i.value < 0 and c.value < 0 for i, c in latest_pairs):
            if result.distress in ('UNKNOWN', 'LOW'):
                result.distress = 'MEDIUM'
            result.observations.append('Matching-period net loss and negative operating cash flow flag financial pressure under a screening rule. They do not establish insolvency or attribute losses to one event.')
            for income, cash in latest_pairs:
                result.metric_ids.extend([income.id, cash.id])
                result.synthetic |= income.synthetic or cash.synthetic
    # A current ratio above one cannot override an explicit, eligible going-concern disclosure.
    going_concern = evidence_for(run, list(eligible), 'going_concern:'+entity.id)
    if going_concern:
        result.distress = 'HIGH'
        result.evidence_ids = [s.id for s in going_concern]
        result.observations.append('HIGH financial pressure: the primary disclosure explicitly raises substantial doubt about continuing as a going concern. This overrides the limited ratio screen; it is not a default probability.')
    equity = [m for m in metrics if m.metric == 'total_equity']
    if equity and any(m.value <= 0 for m in equity):
        if result.distress == 'LOW':
            result.distress = 'UNKNOWN'
        result.observations.append('Nonpositive equity: debt/equity is not meaningful. A current ratio above one does not establish financial health.')
    if result.synthetic:
        result.limitations.append('All financial values and screening outcomes for this entity are synthetic demo inputs.')
    result.metric_ids = list(dict.fromkeys(result.metric_ids))
    return result


def transmit(relation: Relationship, exposure: Exposure, assessment: FinancialAssessment, run: Run):
    event_sources = evidence_for(run, relation.event_source_ids, 'event:'+relation.id, relation.synthetic)
    event_supported = bool(relation.risk_event and event_sources)
    historical = bool(event_supported and relation.event_effective_to and relation.event_effective_to < run.request.as_of_date)
    impact_supported = (relation.status == Status.VERIFIED and not relation.synthetic
                        and evidence_for(run, relation.event_source_ids, 'observed_impact:'+relation.id))
    risk = 'NOT_ESTABLISHED'
    if relation.status == Status.CONTRADICTED or not relation.synthetic and relation.status != Status.VERIFIED:
        risk = 'NOT_ESTABLISHED'
    elif exposure.materiality == 'LOW':
        risk = 'LOW'
    elif not event_supported or exposure.materiality == 'UNKNOWN' or assessment.distress == 'UNKNOWN':
        risk = 'UNKNOWN'
    elif exposure.materiality == 'HIGH' and assessment.distress == 'HIGH':
        risk = 'ELEVATED'
    elif exposure.materiality == 'MEDIUM' and assessment.distress in ('HIGH', 'MEDIUM'):
        risk = 'MODERATE'
    if historical:
        risk = 'NOT_ESTABLISHED'
    mechanism = {
        'supplier': 'Liquidity stress could constrain input production or delivery; target impact depends on component criticality, inventory and substitution time.',
        'manufacturing': 'A production interruption could delay target deliveries if alternate manufacturing cannot be qualified in time.',
        'customer': 'Payment delays or demand contraction could affect target collections or revenue, conditional on documented concentration and contract terms.',
        'logistics': 'Route disruption could delay shipments; exposure depends on route dependence, buffer stock and alternate capacity.',
        'parent_subsidiary': 'Funding, guarantees or cash-pooling could transmit distress only if documented; ownership affiliation alone establishes no such exposure.',
    }[relation.relationship_type]
    consequence = {'ELEVATED': 'Elevated plausible operational exposure under the stated dependency/event assumptions; financial impact is not quantified.',
                   'MODERATE': 'A plausible interruption pathway needs further checks on replacement timing and contracts.',
                   'LOW': 'No target warning: supported replacement and buffer assumptions limit the pathway, even where counterparty distress is high.',
                   'UNKNOWN': 'Target impact is unknown: confirm the event and dependency before raising an exposure warning.',
                   'NOT_ESTABLISHED': 'No confirmed exposure warning: the relationship is unsupported or contradicted.'}[risk]
    if historical:
        consequence = 'The disclosed operational response is historical. It supports an observed transmission pathway; it does not establish a currently active disruption or a quantified loss.'
    metrics = [m for m in run.metrics if m.id in assessment.metric_ids]
    hypothetical = relation.synthetic or exposure.hypothetical or assessment.synthetic or any(m.synthetic for m in metrics)
    ids = list(dict.fromkeys([*relation.source_ids, *exposure.evidence_ids, *assessment.evidence_ids, *[s.id for s in event_sources], *[m.source_id for m in metrics]]))
    return Finding(id='finding-'+relation.id, relationship_id=relation.id, counterparty_id=assessment.entity_id,
        triggering_event=relation.risk_event if event_supported else 'No primary-source counterparty event is established.',
        causal_mechanism=mechanism, target_consequence=consequence, mitigants=exposure.mitigants,
        assumptions=['Scenario pathways are conditional, not loss forecasts.', 'Dependency share remains unknown.' if exposure.facts['dependency_percent'] is None else 'Disclosed dependency uses the source definition.'] + (['Synthetic relationship, event, financials and mitigants are assumed only for this demo.'] if relation.synthetic else []),
        disconfirming_checks=['Confirm the event in a current primary disclosure.', 'Check substitutability, inventory, guarantees and contract termination rights.', 'Check whether new or amended evidence breaks the proposed causal path.'],
        evidence_ids=ids, evidence_status=relation.status if not relation.synthetic else Status.UNRESOLVED,
        counterparty_distress=assessment.distress, target_materiality=exposure.materiality, scenario_risk=risk,
        hypothetical=hypothetical, observed_impact=relation.observed_impact if impact_supported else None,
        confirmed_alert=bool(risk in ('ELEVATED', 'MODERATE') and relation.status == Status.VERIFIED and not hypothetical and event_supported and exposure.evidence_ids))


def audit_run(run: Run):
    """Independent gate over saved output; findings cannot promote their own support."""
    source_ids = {s.id for s in run.sources}
    edges = {r.id: r for r in run.relationships}
    issues = []
    for finding in run.findings:
        edge = edges.get(finding.relationship_id)
        exposure = next((e for e in run.exposures if e.relationship_id == finding.relationship_id), None)
        assessment = next((a for a in run.assessments if a.entity_id == finding.counterparty_id), None)
        if not edge or any(s not in source_ids for s in finding.evidence_ids):
            finding.confirmed_alert = False
            finding.evidence_status = Status.UNRESOLVED
            finding.scenario_risk = 'NOT_ESTABLISHED'
            issues.append(f'{finding.relationship_id}: missing source or relationship reference.')
        confirmable = (edge and exposure and assessment and not assessment.synthetic and not edge.synthetic and not finding.hypothetical and edge.status == Status.VERIFIED
            and not (edge.event_effective_to and edge.event_effective_to < run.request.as_of_date)
            and assessment.distress == finding.counterparty_distress
            and all(not m.synthetic for m in run.metrics if m.id in assessment.metric_ids)
            and exposure.materiality in ('HIGH', 'MEDIUM') and finding.counterparty_distress in ('HIGH', 'MEDIUM')
            and finding.scenario_risk in ('ELEVATED', 'MODERATE') and finding.causal_mechanism.strip()
            and evidence_for(run, edge.attribute_source_ids, 'attributes:'+edge.id)
            and evidence_for(run, edge.event_source_ids, 'event:'+edge.id))
        if finding.confirmed_alert and not confirmable:
            finding.confirmed_alert = False
            issues.append(f'{finding.relationship_id}: unsupported confirmed warning blocked by independent audit.')
        if finding.observed_impact and (not edge or edge.synthetic or edge.status != Status.VERIFIED or
                not evidence_for(run, edge.event_source_ids, 'observed_impact:'+edge.id)):
            finding.observed_impact = None
            issues.append(f'{finding.relationship_id}: unsupported historical impact blocked.')
        if edge and not edge.synthetic and edge.status != Status.VERIFIED:
            finding.scenario_risk = 'NOT_ESTABLISHED'
            finding.evidence_status = edge.status
        if edge and not edge.synthetic and edge.status in (Status.UNRESOLVED, Status.UNSUPPORTED):
            issues.append(f'{edge.id}: current primary relationship evidence remains insufficient.')
        if finding.target_materiality == 'UNKNOWN':
            issues.append(f'{finding.relationship_id}: dependency evidence is unknown; quantify no financial impact.')
    run.audit = list(dict.fromkeys(issues))
    run.uncertainties = list(dict.fromkeys([*run.uncertainties, *issues, *[f'{r.id}: {issue}' for r in run.relationships for issue in r.data_issues]]))
    return [r.id for r in run.relationships if not r.synthetic and r.status in (Status.UNRESOLVED, Status.UNSUPPORTED)]


def calculate_scenario(run: Run, payload: ScenarioInput):
    edge = next((r for r in run.relationships if r.id == payload.relationship_id), None)
    if not edge:
        raise HTTPException(404, 'Relationship not found in this investigation.')
    result = Scenario(**payload.model_dump(), id=str(uuid4()), created_at=now(), status='unavailable',
        explanation='Financial impact cannot be quantified: no eligible disclosed affected-revenue input for this verified relationship. A total company revenue value is not substituted.')
    metric = next((m for m in run.metrics if m.id == edge.affected_revenue_metric_id), None)
    if not metric:
        return customer_sensitivity(run, edge, payload, result)
    source = next((s for s in run.sources if metric and s.id == metric.source_id), None)
    if edge.synthetic or edge.status != Status.VERIFIED or not metric or metric.synthetic or metric.entity_id != run.target_entity_id or metric.metric != 'affected_revenue' or metric.period_type != 'duration' or not metric.period_start or not source or source.kind != 'official' or not source_eligible(source, run) or metric.value < 0 or metric.period_end > run.request.as_of_date:
        return result
    if 'affected_revenue:'+edge.id not in source.assertions or source.content_hash != digest(source) or (run.request.as_of_date - source.published_at).days > run.request.stale_after_days:
        return result
    with localcontext() as context:
        context.prec = 80
        revenue = normalized_value(metric.value, metric.units)
        amount = revenue * payload.disruption_severity * payload.unmitigated_fraction
    result.status = 'calculated'
    result.affected_revenue = str(revenue)
    result.revenue_at_risk = str(amount)
    result.currency, result.period, result.metric_id = metric.currency, metric.period, metric.id
    result.source_ids = [source.id]
    result.explanation = 'Disclosed affected revenue multiplied by explicit user assumptions. This is scenario sensitivity, not expected loss, probability or investment advice.'
    return result


def customer_sensitivity(run, edge, payload, result):
    """Approximate annual customer bucket, explicitly distinct from reported losses.

    Never reverse a customer's revenue share into a supplier's procurement share.
    Never use total revenue without the matched, supported customer concentration.
    """
    if (edge.synthetic or edge.status != Status.VERIFIED or edge.relationship_type != 'customer'
            or edge.source_entity_id != run.target_entity_id or edge.dependency_percent is None
            or not edge.dependency_basis or not edge.dependency_period_end or not edge.dependency_period_start):
        return result
    assertion = f'customer_revenue_share:{edge.id}|{edge.dependency_period_start}|{edge.dependency_period_end}|{edge.dependency_percent}'
    shares = evidence_for(run, edge.attribute_source_ids, assertion)
    if not shares:
        return result
    revenues = [m for m in run.metrics if m.entity_id == run.target_entity_id and m.metric == 'revenue'
                and not m.synthetic and m.period_type == 'duration' and m.period_start == edge.dependency_period_start
                and m.period_end == edge.dependency_period_end and m.period_end <= run.request.as_of_date
                and canonical(m.reporting_basis) == 'consolidated' and m.value >= 0]
    eligible_sources = {s.id: s for s in run.sources if source_eligible(s, run) and s.kind == 'official'
                        and s.content_hash == digest(s)
                        and (run.request.as_of_date - s.published_at).days <= run.request.stale_after_days}
    revenues = [m for m in revenues if m.source_id in eligible_sources]
    # Multiple bases, currencies, values or period starts require analyst resolution.
    if not revenues or len({(m.currency, m.period_start, normalized_value(m.value, m.units)) for m in revenues}) != 1:
        return result
    metric = revenues[0]
    with localcontext() as context:
        context.prec = 80
        total = normalized_value(metric.value, metric.units)
        customer_base = total * edge.dependency_percent / 100
        amount = customer_base * payload.disruption_severity * payload.unmitigated_fraction
    result.status = 'calculated'
    result.base_kind = 'derived_customer_revenue'
    result.affected_revenue = str(customer_base)
    result.revenue_at_risk = str(amount)
    result.currency, result.period, result.metric_id = metric.currency, metric.period, metric.id
    result.source_ids = list(dict.fromkeys([metric.source_id, *[s.id for s in shares]]))
    result.base_inputs = {'total_revenue': str(total), 'customer_share_percent': str(edge.dependency_percent),
                          'share_basis': edge.dependency_basis, 'period_end': str(metric.period_end)}
    result.formula = 'annual_revenue × approximate_customer_share / 100 × disruption_severity × unmitigated_fraction'
    result.label = 'Approximate annual customer-revenue sensitivity; not reported affected revenue or realized loss'
    result.explanation = ('Derived from the rounded disclosed customer share and matching annual consolidated revenue. '
        'This is an approximate annual sensitivity under your assumptions, not the amount lost in the historical strike, '
        'an event-duration estimate, expected loss or a forecast. Shares do not measure customer procurement dependence.')
    return result
