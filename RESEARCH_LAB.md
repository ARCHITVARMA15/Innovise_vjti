# SEC Research Lab automation — Microsoft annual comparison (current)

This increment adds a narrow query-to-report path to the existing Research Lab. The manual Documents, Financials, Analysis, Evidence and Report workflows remain available. Existing cases, facts, calculations and report versions are retained. Earlier increment descriptions below are historical; this section supersedes their statements that filing retrieval is unavailable.

## Demo walkthrough

1. Open `/research` and use **Ask Dexter** with “Analyse Microsoft’s FY2025 financial performance compared with FY2024.” Use a research-as-of date on or after **2025-07-30**. Revenue growth, net profit margin and current ratio are the default scope.
2. Dexter resolves MSFT to official SEC CIK **0000789019**, selects each 10-K by reporting date and filing date, imports the original filing bytes and readable HTML sections, and prepares exact-accession SEC XBRL candidates. The case opens on **Automation**; scope, selection rationale, progress, source links and blockers are saved there.
3. Inspect each candidate's saved source/context. Values are USD units; fiscal flows cover the whole year, while balance-sheet facts use instant contexts. Metadata includes CIK, accession, taxonomy/tag, JSON pointer, filing date, original source URL/hash and retrieval time. HTML citations use stable section/character references, never invented PDF pages. Accounting-basis evidence links to the filing.
4. Select the candidates you have inspected, resolve any missing metadata or conflicts, enter a review note, acknowledge the review and click **Confirm selected reviewed facts**. No candidates are preselected or automatically confirmed. Equivalent unit conversions preserve the original source amount; conflicting values, dates, entity, currency or established accounting basis are rejected. Confirmation uses the existing fact revision/invalidation logic in one batch transaction.
Confirmation feedback appears beside the review button, including candidate-specific missing metadata and unresolved ambiguity. Rejected confirmation retains selection and edits. Successful confirmation scrolls/focuses **Continue from reviewed inputs** in the same Automation tab; it does not redirect to a report or start calculations. Source/revision validation remains enforced by the backend.

5. Click **Continue research — calculate, verify, draft**. The existing Decimal calculator creates/reuses exact fact/revision receipts: one growth comparison, two annual margins, two annual current ratios. Existing verification produces receipt-backed checks and the existing report pipeline saves an **unapproved draft**. Open Analysis, Evidence and Report to inspect it; final report submission and approval remain explicit, separate actions.

A prepared live-retrieval case is available at `/research/32535ef8-3a6b-4c61-83de-75b382c45c5c#automation`. Its latest query covers the three supported metrics and remains **awaiting analyst review**. An earlier query that also requested conditional debt/equity is preserved in history. Both reuse the same three documents and ten candidates. No financial facts in this saved case were confirmed by the implementation/testing process.

Debt/equity is optional but **unavailable in this automated slice**: no generic total-debt tag, overlapping borrowing sum or total-liabilities substitute is inferred. Use the existing manual Financials path for reviewed debt evidence. If unsupported or missing metrics were requested, inspect coverage and explicitly allow partial continuation; missing data never becomes zero. General web/news retrieval, international coverage and optional AI extraction/enhancements are deferred. This path uses no LLM for resolution, structured preparation or the deterministic metric report.

## Setup, architecture and recovery

Set `SEC_USER_AGENT` in private `backend/.env` to an application name and real contact email. The provided contact is configured locally; credentials and contact values are not exposed by `/research/automation/config`. Run the backend and frontend normally. The automation worker is installed through the existing application lifespan; no extra service is needed.

`automation/router.py` → persisted `AutomationStore` → `AutomationManager` → `SecProvider`/`SecClient` → existing `ResearchStore` document ingestion → exact structured-context candidates → atomic human batch review → existing calculations, analysis, verification and versioned reports. Migration **7** adds automation runs/events/source identities/context bindings/review records. It does not rewrite historical facts or reports. APIs live under `/research/automation` and `/research/cases/{case_id}/automation`.

Only approved SEC HTTPS hosts are accepted. Retrieval validates all DNS addresses, pins a public IP while verifying TLS for the original host, revalidates redirects, ignores proxy environment settings and blocks private-address destinations. Bounds: 24 requests including retries/redirects, four additional submissions-history files, 12 MiB per object, 48 MiB source bytes, 30 candidates, two concurrent local tasks and a 240-second execution deadline. SEC 403 responses and long Retry-After instructions are surfaced without bypass. Original source bytes and hashes are stored outside the public tree. Inline XBRL nested fiscal-date tags are parsed independently; explicit date formats are normalized before comparison with official submissions metadata.

Request IDs, source identity/hash and original proposal identity prevent repeated imports or confirmation retries from duplicating records. Continuation binds exact selected fact IDs/revisions and exact receipt IDs, and repeated continuation returns the linked analysis. Cancel/restart retains completed stages; interrupted tasks require explicit retry rather than automatic crash resume. Stale facts or removed sources block continuation. Failed structured retrieval is visibly blocked and can be retried; there is no fabricated or automatic AI substitute. Manual upload fallback is explicit and limited to a discovered accession, publication date and fiscal label. Supported fiscal scope is one or two annual fiscal years; one year proposes its previous year. Calendar aggregation, ambiguous entity resolution and eligible amendments require clarification/manual resolution.

## Additional PDF-backed comparison results

The Financials calculator also supports **net-income growth** (same comparable-duration and positive-prior-income rules as revenue growth) and **working capital** (current assets minus current liabilities, normalized to base currency units). Existing ratios and saved receipt values are unchanged. The comparison helper proposes five additional result cards from the periods/entity/basis of a valid revenue-growth receipt: current ratio and working capital for each year, plus net-income growth. It never treats candidate inputs as confirmed, chooses between competing amounts, or repeats an already valid matching receipt. Missing inputs remain reviewable pending cards.

For the original Microsoft case, the saved annual-report PDF's physical page **42**, printed page **40**, supplied exact two-column current-assets/current-liabilities rows with saved year/unit header spans. Four candidates were prepared, then the user explicitly confirmed all four in chat before confirmation revisions and calculation. The case now has **eight valid receipts**: its original three, FY2025 net-income growth **15.54%**, FY2024/FY2025 current ratios **1.27 / 1.35**, and FY2024/FY2025 working capital **USD 34,448,000,000 / 49,913,000,000**. All retain formula/input revisions and source citations. No report was approved. Regression verification after this extension: **144 backend tests**, **28 frontend tests**, TypeScript and focused lint passed.

## Compact amount presentation

Financial amounts use a shared display-only M/B formatter across Research Lab cards/tables/receipt selectors, reports, ecosystem financial evidence, Analyst Watch KPIs/charts, CSV analytics and portfolio/holdings summaries. It respects the saved source scale (including units/millions/billions/crore/lakh), retains currency, and rounds display to at most two decimals using integer arithmetic. Working capital therefore displays as **49.91B USD** and **34.45B USD**, while percentages and ratios keep their own units. Exact stored values, backend calculations, source excerpts, editable source-value fields, audit details and exports are preserved. Receipt/figure tooltips expose the exact source amounts. Unknown scale is labelled explicitly and never assumed. Presentation regression tests cover rounding at M/B boundaries, negative/zero values, scientific notation, source-unit conversion and values beyond JavaScript Number precision.

## Verification results — kept separate

**Actual live SEC retrieval (25 October 2026):** official ticker/submissions metadata, both primary 10-K HTML files and Microsoft companyfacts JSON were successfully fetched. Selected FY2024 accession **0000950170-24-087843**, report date **2024-06-30**, filed **2024-07-30**; FY2025 accession **0000950170-25-100235**, report date **2025-06-30**, filed **2025-07-30**. Ten candidates were imported, all unconfirmed: revenue 245,122 / 281,724; net income 88,136 / 101,832; current assets 159,734 / 191,131; current liabilities 125,286 / 141,218; equity 268,477 / 343,479 (FY2024 / FY2025, USD millions shown here; saved values are USD units). No real user report was automatically approved or generated from unreviewed facts.

**Preserved official-data replay (no new network calls):** `.venv/bin/python tests/replay_sec_microsoft.py` reads hash-verified cached official bytes and uses a disposable database. It checks every saved JSON pointer/value/accession, performs test-harness confirmation only in that temporary store, then runs the complete existing calculation/check/report path. It produced 14.93% revenue growth; margins 35.96% / 36.15%; current ratios 1.27 / 1.35; five valid receipts, five supported checks and a draft report. The temporary store is removed afterward. This replay is not a live retrieval test or a human analyst review.

**Mocked/offline regression tests:** `tests/test_automation.py` uses a fictional issuer and forbids networking. It covers scope/year ambiguity, older submissions history, as-of exclusions and amendments, annual/instant contexts, competing tags, atomic batch confirmation, equivalent unit conversion, source-bound metadata, stale review, deduplication, partial reports, persisted restart state, intake limits, nested inline dates, public-IP pinning, redirects, content types, rate limits and cache behavior. Full backend regression: **143 tests passed**. Frontend: **19 tests passed**, TypeScript check and focused Research Lab lint passed. HTTP checks served Research Lab and the saved case successfully. Interactive browser/visual testing was unavailable; repository-wide production build has previously documented unrelated Suspense/useSearchParams failures and is not claimed clean here.

---

# Research Lab — increment 5 (current)

Increment 5 extends the existing local case workspace with bounded investigation tasks, an evidence sufficiency gate, deterministic risk observations, immutable structured report versions, and an append-only human review loop. This section supersedes conflicting increment-4 descriptions below. Existing preliminary briefs, source/fact/claim IDs, revisions, receipts, runs, investor pages and Insights configuration remain intact. No dependencies were installed. The requested `Veritas_PS1_Build_Spec_for_Claude_Astra.md` and applicable repository `AGENTS.md` were not present in the inspected project; implementation follows the supplied increment brief and existing source contracts.

## Structure and reuse

- **Reuse:** `ResearchStore`, SQLite/Decimal calculator, Financials review/revision controls, local lexical retrieval, `AnalysisStore`/`AnalysisManager`, claim/evidence stores and managed verifier, lifespan interruption, shared frontend API client, source and receipt inspectors, polling and case tabs.
- **Modify:** shared research model calls, extraction provenance, existing LangGraph/state/models/store, financial input scope, verifier repair accounting, case router and case workspace.
- **Add:** `backend/app/research/investigation.py` (scope/allowlisted tasks and graph operations), `reports.py` (risks, evidence gate, immutable report versions and review), additive migration **5**, `frontend/.../ReportPanel.tsx`, `lib/api/reports.ts`, focused report tests and synthetic/live diagnostics.
- Persistence remains one local SQLite database plus source uploads, isolated from portfolio data. `research_reports` is insert-only application storage; `report_reviews` appends events keyed by report ID and revision. No historical payload migration or source deletion is performed.

## Reliability and provenance

Financial extraction now supplies stable `section_id:start:end` span IDs. A supplied ID resolves in Python to the exact saved excerpt and original Unicode-character offsets; a paraphrase is not fuzzy matched. Supplied spans overlap (3,500 characters, 3,000-character stride), within the existing 10,000-character section / 12,000-character batch caps. `context_span_ids` retain separate exact header/year/unit context slices in source snapshots and receipts; the leading context span is retained for a later extraction span. The backend validates these references and offsets. The model still receives the bounded full section, and all proposals require analyst review of column, year, units and basis. The offset/context fields are additive and do not change existing financial definitions or deduplication identity.

The original note extraction requested a complete numerical interpretation for every claim in a large nested response. A targeted live diagnosis reproduced a **provider HTTP 400** for that full-mapping request; no finer provider code was supplied. The exact rejected property/provider internal reason is **not established**. The replacement requests only supplied source span IDs. Python saves exact line excerpts and original offsets with **unknown, unreviewed mappings**; it never manufactures an interpretation. The targeted live check saved **five candidates**. This does not certify that every selected line is a well-formed claim. Limits are eight supplied nonempty line spans / 12,000 characters; lines over 2,000 characters are visibly omitted, and coverage remains partial when capped. Historical `processed_chunks`/`omitted_chunks` field names now count these note spans.

Failure categories distinguish schema/JSON/truncation/provenance/scope errors, timeout, provider error, bad request and rate limit. Provider diagnostics expose only a numeric HTTP status and a bounded machine code when present, never response bodies, failed generations, credentials or document text. Manual fact/claim entry remains available and is labelled analyst-entered.

All research model callers share one process-local asynchronous lock, including extraction, planning, synthesis and verification. Waiting for the lock counts toward the 35-second total call deadline. SDK retries remain disabled; the single shared helper has at most three transient-error attempts, with bounded `Retry-After` (seconds or HTTP date) / backoff. Nontransient bad requests are not blindly retried. Graph calls remain inside the overall 100-second investigation deadline; verification retains its 80-second standalone budget. A provider failure has no support verdict. Locking is local to one process, not distributed provider quota coordination.

## Actual conditional graph and scope

```text
scope_resolution -- questions --> needs_input / END
  |
  +--> planning (Python allowlist for new tasks)
         |
         + simple_metric ------> financial_analysis -> verification
         + claim_verification -> verification
         + document_comparison / risk_assessment / full_research
               -> evidence_retrieval
               -> financial_analysis when calculations requested (always for full_research)
               -> verification when needed
         |
         -> brief_assembly (deterministic for metric/claim/risk tasks)
         -> risk_assessment (full_research / risk_assessment only)
         -> report_composition (final qualitative finding gate, then structured rendering)
```

Stages actually executed and stages skipped, with reasons, are saved as events. `qualitative_synthesis: skipped` explicitly distinguishes a skipped model call from successful deterministic brief assembly. No AI plan is claimed for the Python plan. Existing callers omitting `task_type` retain the legacy preliminary planning/brief path; they do not silently become full investigations. Reports composed from legacy outputs must resolve scope before approval.

New `AnalysisStart` fields are `task_type`, `entity`, `periods`, `accounting_basis`, `research_as_of_date`, `calculations`, and `claim_ids`. Supported tasks are `simple_metric`, `document_comparison`, `claim_verification`, `risk_assessment`, `full_research`. Python validates tools, dependencies and caps (eight calculations and eight selected claims). Full research checks up to eight existing non-analysis case claims when no explicit claim IDs are provided; omitted claims remain visible with a processing-cap limitation. New runs require an as-of date and resolvable entity/periods/basis; ambiguity produces actionable `needs_input` questions. Document comparison requires two eligible sources. No ticker aliases or financial reporting dates are invented. Financial analysis and trends filter to the resolved entity/basis/periods/as-of scope. Sources published after the run as-of are excluded; unknown publication dates remain warnings.

The UI explicitly selects calculations rather than relying on an LLM to choose tools. Full research may produce a limited report when no eligible financial inputs/calculations exist; it does not invent ratios. The legacy LLM planner remains available through its existing API behavior. Automatic external filing/news retrieval, full amendment chains and automatic graph resume remain deferred.

## Evidence gate and bounded repairs

Every affirmative report finding must have a current eligible saved verification result with direct evidence/fact/receipt references. Synthesis citations alone do not establish support. Final qualitative synthesis findings are imported as claims and assessed against selected saved evidence before report entry as supported conclusions; a failed gate retains the claim with no verdict. Manually composed reports also import preliminary findings and retain unchecked findings as unresolved. Model-assessed support remains labelled accordingly.

The report includes contradicted, unsupported and needs-review claims and execution errors. It never substitutes provider failure for an unsupported verdict. The originating checked note is excluded from its own verification. Entity/period/basis mismatch cannot establish contradiction (including a report-scope mismatch); mixed support and contradiction requires review. Historical questions do not automatically make historical evidence stale. Unknown dates, coverage limits and unsearched information remain limitations.

Materiality uses inspectable conservative categories: numerical performance, liquidity/solvency, acquisition/risk assertions, and principal analysis conclusions. There is no monetary threshold. Analysts can adjust materiality with finding-level feedback explaining the reason; the machine result and affirmative-conclusion flag remain separate.

Typed report issue reasons include `extraction_error`, `source_stale`, `basis_mismatch`, `missing_evidence`, `numeric_error`, `unresolved_conflict`, `provider_error`. Missing evidence permits one targeted local retrieval retry per claim. The existing verifier retry consumes the **two-repair investigation-wide budget**, shared with final-finding gates and targeted recalculation. An analyst-initiated retry automatically links the preceding check, and may explicitly specify `previous_run_id`; the backend verifies case/claim linkage, creates a new snapshot, and records safe recalculation of stale receipts using only eligible confirmed inputs. Conflicts, ambiguous basis and unavailable eligible inputs stop for analyst review. Extraction failures flag affected source sections for review/manual entry; no automatic confirmation or invented excerpt is permitted. Repair records save reason/action, before/after outcomes and stopping reason. There are no nested investigation restarts.

## Risks, reports and review

Risk assessment is a modular deterministic function callable by the graph and report workflow. It separates:

1. Observed financial trends using real saved comparable current-ratio/debt-to-equity receipts and Decimal comparisons.
2. Source-grounded business/disclosure risk claims that have passed the qualitative evidence gate, explicitly labelled model-assessed when applicable.
3. Evidence limitations: missing comparable data, unknown publication dates, unresolved/rejected/candidate inputs, extraction/processing caps and provider failures.

Each observation has a stable ID, category, explanation of why it may matter, references, method, uncertainty and proposed checks. Ratios/direction never prove distress and have no universal safe/risky threshold. No independent AI risk proposal/synthesis call is implemented or claimed; assessment is labelled partial and preserves genuine deterministic results. Unsupported business allegations stay in unresolved claims, never established business risks.

The existing case workspace now includes **Report**, reachable directly from Analysis/Evidence. Reports contain scope/question/company/as-of, exact selected source/fact snapshots, claim revisions and verification IDs/results, saved receipt snapshots, executive supported findings, disputed/unresolved claims, risks, limitations/failures, next checks, sources, workflow events and repairs. Deterministic rendering works even when prose synthesis fails. Report payloads are immutable and versions link to their predecessor; review events are separate append-only records. Historical preliminary briefs remain historical.

States: `draft -> needs_review -> approved`, or `changes_requested` / `rejected` as allowed server-side. Comments and finding feedback are available on nonterminal versions. Corrections after `changes_requested` require a new report version. Approved/rejected versions accept no further events. Review uses `expected_revision`; stale writes fail with HTTP 409. New report creation can supply `predecessor_id` to reject a superseded predecessor.

Approval requires the latest nonstale report, resolved scope, explicit dispositions for every material unresolved/disputed finding (`exclude_from_affirmative_conclusions` or `retain_as_unresolved`), plus a comment and acknowledgement of retained limitations. Corrected evidence must be reverified to change a machine verdict; no reviewer checkbox can make an unsupported finding supported. An honestly limited report can be approved. Reviewer labels are explicitly **not authenticated identities**. Approval only records research review and never authorizes transactions.

Staleness is evaluated separately from review state against saved dependency signatures: case metadata, selected source hashes/availability, fact catalog/revisions/status, claim catalog/revisions, verification records and depended-on receipt records. The signature conservatively includes all case facts/claims, including competing facts; an unrelated fact/claim edit within the same case may therefore require a new version. Old approval events remain visible with `current_approval: false` after dependency changes; only the latest current version can have current approval.

### Case-scoped API additions

All paths remain under `/research/cases/{case_id}`; existing APIs are reused.

| Method/path | Purpose |
|---|---|
| `GET /reports` | Version/review history, with current computed stale status |
| `POST /reports` | Compose from `analysis_run_id`, optional `predecessor_id` |
| `GET /reports/{report_id}` | Inspect immutable structured version and review audit |
| `POST /reports/{report_id}/reviews` | Revision-checked submit/comment/request_correction/approve/reject |

Report responses and inputs are Pydantic-validated in FastAPI/OpenAPI. Review inputs include reviewer label/comment, finding feedback, materiality adjustments, dispositions and limitations acknowledgement. Verification starts accept optional `previous_run_id`; runs expose repair history. Fact/source snapshot schemas add optional exact-span and context references. Existing IDs/contracts remain usable.

### Changed files for increment 5

- Backend: `analysis_llm.py`, `fact_extraction.py`, `claim_intake.py`, `financial_models.py`, `financial_store.py`, `analysis_models.py`, `analysis_state.py`, `analysis_store.py`, `analysis_manager.py`, `analysis_graph.py`, `analysis_financial.py`, `analysis_brief.py`, `analysis_verification.py`, `verification_models.py`, `verification_store.py`, `verification_engine.py`, `migrations.py`, `store.py`, `router.py`; new `investigation.py`, `reports.py`.
- Frontend: `CaseWorkspace.tsx`, `AnalysisPanel.tsx`, `ReceiptInspector.tsx`, new `ReportPanel.tsx`; `lib/api/analysis.ts`, `financials.ts`, `verification.ts`, new `reports.ts`.
- Tests: new `test_reports.py`, `live_increment5_probe.py`, `live_note_diagnostic.py`, `fixtures/risk_limitations_synthetic.txt`; extended `smoke_research_server.py`. Existing regression assertions change only for the additional scope stage and migration version.
- Documentation: this current section and a notice in `PROJECT_DOCUMENTATION.md`.

## Verification — 24 October 2026

Storage check initially showed about **207 MiB available**. No user documents, databases, uploads or unrelated files were deleted. Later checks showed about 1.5 GiB available; no dependency installation or large production build was needed. Existing regression assets/environment were reused.

Commands (from backend/frontend respectively):

```bash
PYTHONDONTWRITEBYTECODE=1 .venv/bin/python -m unittest discover -s tests -p 'test_*.py' -q
PYTHONDONTWRITEBYTECODE=1 .venv/bin/python tests/smoke_research_server.py
PYTHONDONTWRITEBYTECODE=1 .venv/bin/python tests/live_increment5_probe.py
PYTHONDONTWRITEBYTECODE=1 .venv/bin/python tests/live_note_diagnostic.py
./node_modules/.bin/tsc --noEmit --pretty false --incremental false
./node_modules/.bin/eslint src/app/research src/lib/api/analysis.ts src/lib/api/financials.ts src/lib/api/verification.ts src/lib/api/reports.ts
git diff --check
```

- Offline regression: **67 tests passed** in 18.193 seconds in the complete run. Covers original intake/calculators/verification plus routing/model-call skipping, scope ambiguity, global and per-claim repair caps, safe later recalculation, final qualitative gating/provider failure, risk receipt provenance/unsupported allegations, typed reports, version history, invalid transitions/stale writes, corrections, limited approval, dependency invalidation, cross-case isolation and restart interruption. The schema remains additive.
- Real HTTP/restart smoke passed: manual candidate entry and explicit review; 10% growth / 12% margin; misleading 25% claim contradicted; report version 1/request correction; restart; input correction through the existing Financials API; 20% growth / 11% margin and corrected claim/reverification; linked report version 2 and approval; a second restart preserves both versions and review history; deleting the selected test source invalidates current approval while retaining the approval event. This uses temporary synthetic storage, no external model and no user DB writes.
- TypeScript and focused Research Lab ESLint pass. Diff checks include new untracked research files separately, because this workspace's earlier increments are themselves untracked. Full repository lint/build were not expanded into unrelated investor/Markets cleanup; the earlier recorded failures remain historical, not new passes.
- Browser interaction is **unverified**: the available computer-use service returned no apps/browsers and a client/server version mismatch. Relaunching Codex may restore browser access; no relaunch was performed.

### Bounded live synthetic results (one end-to-end probe, then targeted note diagnosis)

| Stage | Actual outcome |
|---|---|
| Financial extraction | **Completed, 12 candidates** with exact span resolution; no auto-confirmation |
| Financial input origin | Separate **manually entered, explicitly reviewed** synthetic facts; not the extraction candidates |
| Planning | **Python allowlist validation**, saved successfully; no AI planning call |
| Qualitative synthesis | **Unavailable**: scope guard rejected a financial quantity/certification/action output; no successful prose stage fabricated |
| Financials | Saved real receipts: **10% growth, 12% margin, current ratio 2.00→1.50, debt-to-equity 0.40→0.50** |
| Misleading growth claim | **Contradicted**, deterministic numerical method |
| Qualitative verification | **Completed, unsupported**, scoped model assessment; no provider failure substituted for a verdict |
| Risk | **Two deterministic receipt-backed trends**, partial assessment; AI risk synthesis not attempted |
| Report/review | Deterministic report saved; approved with explicit unresolved retention and limitation acknowledgement |
| Note extraction in combined probe | Provider failure, zero candidates |
| Targeted note diagnosis | Former full mapping request reproduced **HTTP 400** (no finer code); replacement ID-only request **completed with five exact-text candidates**, mappings unreviewed |

No second full live end-to-end run was made. The final optional financial header-context field and safe status-code diagnostics were added after the full probe and have offline coverage; the targeted note replacement was checked live separately. The full live report correction/restart loop uses the offline/HTTP acceptance tests, not a claim of successful model extraction-to-automatic-confirmation.

## Exact manual browser walkthrough (not yet verified)

1. Start backend from `backend`: `.venv/bin/python -m uvicorn app.main:app --reload`; frontend from `frontend/my-app`: `npm run dev`. Open `/research`; create a synthetic case for **Synthetic Fixture Co** with periods FY2024/FY2025 and as-of **2025-06-30**.
2. Upload `tests/fixtures/financials_synthetic.txt` and `research_note_synthetic.txt`. Inspect source sections. In Financials select the financial fixture and extract. Inspect actual status/errors and candidates; verify header/year/unit meaning before explicitly confirming. If extraction fails, use **Add fact manually**, preserving the analyst-entered label; follow the existing detailed Financials walkthrough below.
3. Calculate/save both years' current ratios/debt-to-equity and growth/margin. Expect **10%, 12%, 2.00/1.50, 0.40/0.50**; inspect receipts and source/context slices.
4. In Evidence extract candidates from the misleading note. Check exact source offsets, review interpretations, and select only the financial source as support. The note cannot support itself. Review the 25% growth mapping (FY2024/FY2025, consolidated / synthetic GAAP, INR/crore, percent precision 0), then verify: **contradicted**. Enter the labelled unsupported acquisition-risk allegation; keep provider failure distinct from unsupported evidence.
5. In Analysis select **Full research**, financial source, entity **Synthetic Fixture Co**, periods `FY2024, FY2025`, basis **consolidated / synthetic GAAP**, as-of **2025-06-30**. Select growth, margin, current ratio and debt-to-equity. Optionally paste selected Evidence claim IDs. Run, observe actual stage events/skips/partial errors, then click **Open Report and human review**.
6. Inspect supported conclusions, disputed/unresolved claims, numerical receipts, risk directions and limitations. Inspect saved checks and exact evidence. Try a Simple metric run and confirm unnecessary model synthesis/retrieval is marked skipped. Try missing as-of or ambiguous basis and confirm actionable `needs_input`.
7. Select a draft report; enter a reviewer label (not authenticated identity) and a comment. **Request correction**. Use **Correct Financials** / **Correct or recheck Evidence**. Correct the reviewed input through those controls, reconfirm explicitly, and rerun affected calculations/checks with the appropriate claim assertion. Start a new analysis snapshot; select its report or compose a new version linked to the latest predecessor.
8. **Submit** the new draft. Give explicit dispositions to every material unresolved/disputed claim, acknowledge retained limitations in the comment, then **Approve**, or **Reject**. Try approving without dispositions/acknowledgement and expect validation errors. Materiality changes require a finding-feedback reason and never alter machine support.
9. Refresh/restart backend using the same research directory. Verify both report versions, prior request-correction event, terminal approval/rejection, references and comments persist. Edit a relevant fact/claim or remove a source; the prior approval event must remain historical while current approval becomes false and stale. A new version/review is required. Verify a different case remains unchanged.
10. Verify desktop/narrow layout, selectors, feedback forms, error/loading states and source/receipt inspectors. Existing Insights and investor pages should remain usable. These UI interactions remain manual/unverified until browser access is restored.

## PS1 requirement matrix

| Area | Implemented | Tested offline / HTTP | Tested live | Manually verified | Remaining |
|---|---|---|---|---|---|
| A Reliability | Exact spans/context, diagnostics, shared call lock, bounded retries | Provenance, safe errors, lock, retry bounds, regression | 12 financial candidates; note ID selection 5 candidates; scoped verification | No browser | Provider-specific HTTP-400 detail unknown; final context extension offline only |
| B Routing/scope | Five tasks, Python plans, needs_input, saved ran/skipped stages | Metric/claim/comparison routes, ambiguity, no unnecessary model calls | Full selected-document route; deterministic plan | No browser | AI-proposed task planning optional, not added to new route |
| C Repairs | Claim-targeted retrieval, later eligible recalculation, budgets, linked history, extraction review flags | Per-claim/global caps and stopping outcomes | Qualitative probe bounded; no blanket live repair success claim | No browser | Basis/conflicts/current-source absence escalate to analyst |
| D Evidence gate | Final qualitative gate, eligible support, conservative materiality/dispositions | Self-source rejection, provider failure, basis mismatch, unresolved preservation | Contradicted 25% / unsupported acquisition; synthesis fallback | No browser | Model-assessed semantic quality still needs analyst review |
| E Risks | Saved-receipt trends, gated source risk claims, deterministic limitations | Comparable provenance and unsupported allegations | Two real saved-receipt trends | No browser | No independent AI risk synthesis; assessment partial |
| F Reports | Immutable structured versions, exact dependencies, partial rendering, Report tab | Persistence/subprocess and real HTTP restart | Partial numerical report saved | No browser | PDF/export not in this increment |
| G Review/audit | Server transitions/CAS, feedback/materiality, correction/approve/reject, stale approval history | Correction/reverification/new version/approval over HTTP; restart, stale writes, isolation | Limited report approved with explicit retention | No browser | Labels unauthenticated; single-user prototype |
| H UI/limits | Existing tabs/inspectors/client, clear Report route, stage/blocker/history displays | TypeScript/focused lint, API checks | No live UI claim | Unverified: tool mismatch | Browser responsive/interaction walkthrough; no external filings/news/amendment chain |
| I Acceptance | Extended regressions, synthetic fixtures, real HTTP/restart and bounded live scripts | Commands/results above | Outcomes separated above | Unverified | Whole target specification is not claimed complete |

---

# Historical increment notes (retained)

# Research Lab — increment 4

Research Lab is a local, single-user analyst workspace inside Veritas at `/research`. It combines durable research cases, source documents, reviewed financial facts, deterministic calculations, bounded Dexter analysis, and now claim verification with inspectable evidence. This section supersedes conflicting increment-3 behavior below. Existing Insights model configuration and graph are unchanged. Risk assessment, final approval, PDF export and web research remain unavailable.

## Reliability diagnosis and changes

A bounded reproduction returned valid JSON matching the old synthesis schema, then failed the old language guard. That guard rejected harmless dates, number words and accounting language as unsupported numerical/verification content. This was a confirmed false rejection; previous timeout and schema failures were separate categories, not all the same fault.

`analysis_llm.py` now shares research-only model settings across fact extraction, planning, synthesis, claim extraction/mapping and qualitative verification. The small synthesis schema bounds observations, text and citation lists. Calls provide the exact schema and allowed evidence IDs. The installed ChatGroq wrapper accepts but discards its structured-output `strict` argument; Research Lab therefore binds the provider response format directly. Strict JSON Schema is used in automatic mode for configured models with known support; JSON object mode otherwise still receives schema instructions and local Pydantic validation. See [Groq structured-output documentation](https://console.groq.com/docs/structured-outputs). No provider switch or new dependency was introduced.

Validation distinguishes invalid JSON, truncation, schema mismatch, invalid citations, scope violations, provider errors and timeouts. An enclosing Markdown JSON fence may be removed; missing evidence or fields are never fabricated. Narrow financial-quantity/action checks and a structured document-content scope replace the broad keyword ban. These checks are provenance/scope safeguards, not proof of semantic correctness or complete prompt-injection protection.

Numerical observations still come only from real calculator receipts. If qualitative synthesis fails after earlier stages succeed, an explicit `partial` run saves a numerical-only brief and diagnostic, preserving prior outputs and verification IDs. The overall execution deadline during synthesis also preserves this partial brief. Planning failures still fail; backend shutdown interrupts rather than fabricating completion. Older saved briefs default to `legacy_unknown` qualitative status without rewriting history.

### Configuration

Set optional variables in ignored `backend/.env` and restart the backend:

| Setting | Behavior |
|---|---|
| `GROQ_API_KEY` | Existing private provider credential; never expose in frontend or logs |
| `RESEARCH_MODEL` | Research-wide override; absent/empty uses existing primary model |
| `RESEARCH_FALLBACK_MODEL` | Existing router model by default; explicitly empty disables fallback |
| `RESEARCH_OUTPUT_MODE` | `auto` (default), `json_schema`, `json_object`, or `prompt`; forced modes require actual provider support |
| `RESEARCH_REASONING_EFFORT` | Defaults to `low` for configured GPT-OSS models |

The existing local override used for the bounded probe was `openai/gpt-oss-20b`, fallback disabled. This is a local configuration, not a newly hardcoded default or a guarantee of access. All research stages now use it consistently. Provider calls have a 35-second total call budget, no SDK retry multiplication, and at most three transient-error attempts. Analysis retains its 100-second overall budget. Authentication, schema and provenance errors are not blindly retried.

## Claims and Evidence workflow

The case's **Evidence** tab supports manual claims, import from a selected saved analysis run, and bounded extraction from an explicitly selected research-note document. Extracted claims retain exact original text, section/page IDs, offsets and source hash. Proposals are unreviewed; editing appends a revision with a reason and optimistic revision check. Analyst-entered claims have that origin and no invented source. Importing findings uses stable origin keys and never overwrites a historical analysis brief.

The checked note and supporting documents have explicit separate controls. A note cannot corroborate its own extracted assertion or supply its disputed financial inputs. Analysts select supporting documents and optionally valid receipts, review numerical interpretation, then start a verification. Saved claims/results survive restart. The UI shows actual verdict counts, method, scope, warnings, source/receipt inspectors, side-by-side supporting/contradicting passages, history, retrieval events and processing errors. There is no trust percentage.

Verdicts are `supported`, `contradicted`, `unsupported`, and `needs_review`. Execution status is separate: queued/running/completed/failed/interrupted. A provider failure has **no verdict**. Supported means support in the selected evidence, not independent certification. Unsupported means adequate support was not found in the searched selection, not that the claim is false.

### Numerical methods and comparison rules

Supported mappings: revenue growth, net profit margin, current ratio, debt-to-equity, direct confirmed financial metrics, and debt-free explicitly defined as zero interest-bearing borrowings. The existing Decimal calculator, confirmed fact revisions, unit conversions and receipt checks are reused. No claim becomes a fact; no fact or conflict is automatically confirmed/acknowledged.

Numerical mappings must be analyst-reviewed and identify entity, periods, units and accounting scope. Model mapping proposals require review before use. Ambiguous periods, competing inputs, missing metadata, invalid receipts, wrong entity/basis and percentage-point mappings abstain with `needs_review`. A 10% ratio is not assumed to mean a ten-percentage-point change.

The analyst explicitly declares display decimal places (0–6). Python quantizes the computed Decimal with `ROUND_HALF_EVEN` at that precision and compares it with the asserted value, which must fit that precision. The inspector records raw/rounded values, half-quantum tolerance, rule, periods, formula, input revisions, conversions and receipts. There is no arbitrary epsilon. Monetary values normalize equivalent supported scales. Debt-free uses exact zero: a positive amount never rounds down to debt-free; negative/ambiguous debt abstains.

### Qualitative method, retrieval and freshness

A separate prompt receives the claim plus selected source passages. Citations must belong to supplied exact source slices. Contradiction requires cited incompatible evidence with matching entity/period/basis; known period mismatch abstains. Mixed support and contradiction requires review. Qualitative verdicts are labelled **Model assessment — analyst review required**. Reusing the same model does not constitute independent verification.

Verification has an 80-second total budget, at most two retrieval passes (one targeted retry), up to eight passages per pass and twelve unique passages overall. Actual retry events/attempts are persisted. It reuses case-scoped local lexical retrieval, existing scan caps and as-of filtering; coverage can be incomplete. Claims extraction scans at most eight overlapping source chunks, with 12,000 characters total and accepts at most eight proposals; omitted coverage and failures are recorded. Exact source-excerpt mismatch rejects extraction rather than repairing provenance.

Sources published after research-as-of are excluded. Unknown publication dates warn explicitly; upload time never supplies publication time. Historical evidence for a current assertion warns about freshness; historical evidence answering a historical question is not inherently stale. Freshness warnings and support verdicts are separate.

## Persistence, graph and API

Additive SQLite migration 4 introduces `research_claims`, append-only `claim_revisions`, `verification_runs` and `claim_extractions`. Existing cases, sources, fact revisions, receipts and analysis runs are retained. Claim edits, selected-source changes/deletion, relevant fact changes/conflicts and receipt invalidation mark dependent checks stale while retaining historical snapshots/verdicts. Deleted/changed sources are identified as unavailable. Startup marks active local jobs interrupted; there is no automatic resume. This is a single-process prototype with at most two managed verification jobs and two analysis jobs, no authentication or multi-worker coordination.

New analysis graph:

```text
planning → evidence_retrieval → financial_analysis → verification → brief_assembly
```

The verification stage imports/checks receipt-backed numerical findings. Qualitative findings can be imported separately in Evidence. A partial synthesis does not prevent manual or receipt-backed checking.

All routes below are under `/research/cases/{case_id}` and use the existing frontend API client/base URL:

| Method/path | Purpose |
|---|---|
| `GET/POST /claims` | List/create claims |
| `PATCH /claims/{claim_id}` | Append claim revision |
| `POST /claims/import-findings` | Import selected saved-run findings |
| `POST /claims/extract` | Extract bounded proposals from selected note |
| `GET /verifications` | List persisted run history |
| `GET /verifications/{run_id}` | Inspect snapshot/result/evidence/events |
| `POST /claims/{claim_id}/verifications` | Queue scoped check (202) |

New modules: `verification_models.py`, `verification_store.py`, `verification_engine.py`, `verification_manager.py`, `claim_intake.py`, `analysis_verification.py`; frontend `EvidencePanel.tsx`, `ClaimEditor.tsx`, and `lib/api/verification.ts`. Existing model/call, graph, manager, store, migration, router, lifespan, case tabs and analysis displays integrate them. New fixtures/tests/probes live under `backend/tests`. No dependencies were added for increment 4. Existing stack remains Next.js/React/TypeScript/Tailwind, FastAPI/Pydantic, standard-library SQLite/Decimal, LangGraph and Groq via LangChain; PDF intake retains its existing extractor.

## Verification results — 24 October 2026

- `.venv/bin/python -m unittest discover -s tests -p 'test_*.py' -q`: **53 passed** in the complete regression run, including numerical comparisons/conversions, changed inputs changing verdicts, ambiguity, source separation, qualitative invalid citations/injection, bounded retry, freshness, cross-case rejection, durable restart, revisions/invalidation, typed ASGI endpoints and partial/schema/timeout regressions.
- `npx tsc --noEmit`: passed. Focused ESLint on Research Lab and analysis/verification clients: passed. `git diff --check`: passed.
- Real HTTP smoke (`.venv/bin/python tests/smoke_research_server.py`): passed; exercises temporary app intake/validation, PDF boundaries, case isolation, financial persistence across actual process restart, correction/invalidation and existing agent/health endpoints. It uses no external model. New verification endpoints additionally have ASGI tests; verification persistence has subprocess tests.
- One subsequent rerun encountered local disk exhaustion (`No space left on device`) during temporary SQLite writes. After space became available, the final rerun passed all 53 tests in 7.834 seconds, including the typed claim-extraction response. Local storage remains nearly full; no project data was deleted.
- Full repository lint (`npm run lint -- --quiet`) still reports 28 pre-existing investor/shared-page errors; focused checks do not imply a clean repository-wide build. The prior production build failed on `/market` missing a Suspense boundary. Browser automation was unavailable (no enabled browser and tool version mismatch); visual interaction remains unverified.

Bounded live probe (`.venv/bin/python tests/live_increment4_probe.py`, temporary synthetic data, one combined attempt after fixes):

| Stage | Actual outcome |
|---|---|
| Fact extraction | Failed provenance validation: supporting excerpt did not match saved text; zero accepted fact references |
| Planning | Succeeded |
| Qualitative synthesis | Succeeded; full analysis completed |
| Deterministic financial output | Revenue growth 10.00%; net profit margin 12.00%, from explicitly seeded reviewed synthetic facts |
| Note-claim extraction | Failed, zero proposals; exact provider cause was not established |
| Live qualitative verification | Failed due Groq rate limit, one retrieval pass; no verdict assigned |

Deterministic synthetic claim checks passed offline: asserted growth 25% contradicted by 10%, margin 12% supported, debt-free contradicted by INR 300 crore. Qualitative unsupported behavior is covered with mocked model output, **not** a successful live assessment. No production mock fallback is used. Live extraction and qualitative verification remain provider/provenance blockers; do not interpret a successful analysis as proof those stages succeeded. Probes were bounded, not retried indefinitely.

## Exact manual walkthrough

1. Run backend from `backend`: `.venv/bin/python -m uvicorn app.main:app --reload`; frontend from `frontend/my-app`: `npm run dev`. Open the displayed frontend URL, then Research Lab; create a case for Synthetic Fixture Co with question comparing FY2024 and FY2025 and optional as-of 2025-06-30.
2. Upload `backend/tests/fixtures/financials_synthetic.txt` as the supporting financial source, and `research_note_synthetic.txt` as the checked note. Inspect sections; neither TXT invents PDF pages. Optionally upload a two-page text PDF and inspect original page 1/2 references. Empty, oversized, unsupported and image-only files must show errors.
3. In Financials manually add/review the fixture's twelve facts (six metrics for each year), copying exact excerpts. Use entity Synthetic Fixture Co, INR/crore, the fixture dates and accounting scope `consolidated / synthetic GAAP`. Confirm explicitly. Calculate growth/margin and inspect receipts. Extraction may propose candidates but never auto-confirms them.
4. Open Evidence. Select the research note for extraction and the financial source as support; the note must not be selectable as its own support. Try bounded extraction; inspect errors if provider/provenance validation fails. Alternatively enter each fixture claim manually.
5. Review numerical mappings: growth target `revenue_growth`, periods FY2024/FY2025, asserted 25, percent, precision 0; margin target `net_profit_margin`, FY2025, asserted 12, percent, precision 0. Set entity, INR/crore and accounting scope as above, historical scope, and mark reviewed. Verify: expect contradicted (computed 10) and supported (12). Inspect formula, receipts and source text.
6. Set debt claim assertion type to `debt_free`, target `total_debt`, explicit interest-bearing-borrowings definition, FY2025, value zero, INR/crore and matching scope. Expect contradicted (300). Enter acquisition claim as qualitative and verify using only financial source. With a functioning model expect unsupported within scope; a provider failure must instead show failed with no verdict. Inspect retry history and exact evidence.
7. Edit a claim and save a reason; prior verification must become stale with preserved history. Correct FY2025 revenue to 1250 through the normal reviewed revision flow; rerun the 25% claim and expect supported. Try percentage_points or mismatched period/basis and expect needs_review.
8. Run Analysis on the supporting source; verify the new verification stage and receipt-backed findings. Import findings from a selected older run without changing its old brief. If synthesis fails, inspect the explicitly partial numerical-only brief/error. Deterministic tests exercise malformed and timeout paths without changing production configuration.
9. Refresh, stop/restart backend, reopen the case: claims, revisions, results and evidence remain. Delete the supporting source: old checks become stale and sources unavailable, snapshots remain. A different case must stay untouched. Publication after as-of is excluded; unknown dates warn separately from verdict.
10. Open Insights and investor sidebar routes to check their interaction manually. Risk/approval/PDF remain unavailable. This workspace has no authentication; case IDs and labels do not provide access control.

---

# Earlier increments — retained implementation history

Research Lab lives inside the existing Veritas application at `/research`. Increment 1 creates durable cases and collects source documents. Increment 2 adds source-linked facts, analyst review and deterministic calculations. Increment 3 adds a separate bounded Dexter analyst graph and an Analysis tab. The existing Insights graph is unchanged. Earlier-increment descriptions below are retained as history; the increment-3 section describes the current orchestration scope and verification limits.

## Increment 3 — bounded Dexter analyst workflow

### Implemented scope and graph

An analyst can select case documents, optionally override the question for one run, start research, inspect real persisted execution events, and reopen saved preliminary briefs. The override does not alter the saved case question. Documents and Financials remain independent and usable after a failed or needs-input analysis.

The separate LangGraph in `app/research/analysis_graph.py` executes exactly:

```text
START → planning → evidence_retrieval → financial_analysis → brief_assembly → END
```

- `analysis_state.py`: shared typed graph state containing the validated input snapshot and node outputs.
- `analysis_models.py`: Pydantic plan, operations, passages, findings, brief, event, run and API schemas.
- `analysis_planning.py`: model-assisted planning restricted to six supported metrics and the four increment-2 calculations. Unsupported operations are recorded as limitations; malformed plans fail the run.
- `analysis_retrieval.py`: deterministic local lexical retrieval with exact source slices and offsets.
- `analysis_financial.py`: confirmed-fact selection, explicit ambiguity handling and reuse of the existing Python calculator/receipts.
- `analysis_brief.py`: validated, source-linked qualitative synthesis and deterministic brief assembly. Numerical observation text is rendered by Python from saved receipts.
- `analysis_llm.py`: existing Groq safe-call helper and credentials, bounded structured output, optional Research Lab model settings and sanitized provider errors.
- `analysis_store.py`: transactional input snapshots, run history, stage outputs/events, evidence, briefs and stale-input detection.
- `analysis_manager.py`: managed asyncio tasks, duplicate prevention, time budgets and application-startup interruption handling.

No model-generated code is executed. No web/URL fetching, OCR, embeddings, vector database, automatic extraction or fact confirmation is invoked. Claim verification, risk assessment, approval and PDF export are outside this increment.

### Input snapshots, financial selection and provenance

Every run stores a UUID, question, override flag, case metadata, selected source snapshots and SHA-256 hashes, included/excluded status, fact IDs/revisions/review statuses, explicitly selected receipt snapshots, requested model settings, timestamps, warnings/errors, plan, stage outputs, receipt IDs and brief. A new run creates a new brief; old briefs are not overwritten.

Document hashes cover saved document metadata and ordered section text/IDs. Selected-input state is checked during stage persistence and before final completion, and again on reads. Execution status and `stale` are separate: a historical completed run may have stale inputs. Selected source deletion/content changes, fact catalog/revision/review changes, invalid selected receipts, relevant new confirmed alternatives, or relevant saved case-metadata changes mark results stale. The check is deliberately conservative for the selected fact catalog. Existing source/fact mutation paths also trigger persisted invalidation. New documents outside a run's selection are listed as not included; their addition alone does not imply the old run considered them or make it stale.

The financial node never changes facts. Automatic role assignment requires exactly one eligible confirmed choice per role and matching calculator metadata. Growth can use exactly two uniquely dated revenue facts in chronological order; extra or competing choices require resolution. Explicit planned period labels must occur in the question or saved case reporting-period label. Unknown/unconfirmed inputs, ambiguous periods, incompatible metadata, or conflicting values produce exact needs-input messages directing the analyst to Financials.

Analysts may calculate/review a receipt in Financials and explicitly select that valid receipt in Analysis to resolve an input choice. Selected receipts must belong to this case, use included selected sources, and match the snapshot's confirmed revisions. The workflow never acknowledges conflicts automatically. Otherwise it reuses valid identical-input/revision receipts where appropriate, or calls the existing server calculator without conflict acknowledgements. Calculator failures become needs-input explanations; their actual receipts remain saved.

Numerical findings reference actual saved calculation receipts and fact IDs. Qualitative findings must cite supplied evidence IDs and are labelled **model-generated, not independently verified**. Unknown citations and prohibited numerical/verification/rating/trading language are rejected, not repaired with invented content. These checks enforce provenance and output scope; they do not establish semantic correctness or eliminate all prompt-injection risk. Sources remain untrusted data throughout.

A saved brief includes the question/scope, documents and financial periods considered, numerical observations, source-linked qualitative observations, missing information, unsupported requests and processing limits. Every brief carries:

> Preliminary research — claim verification and analyst approval pending.

It is not a verified/approved final report and has no trust score, investment rating, autonomous trading action or generated business-risk assessment. If synthesis fails validation, no successful brief is substituted. Already persisted planning, retrieval, financial outputs and calculator receipts remain inspectable.

### Execution and retrieval limits

| Limit | Implementation |
|---|---|
| Selected documents | Up to 10; unavailable/cross-case IDs rejected |
| Source snapshot text | Up to 3 million characters; larger selections rejected clearly |
| Selected-source fact catalog | Up to 1,000 facts; larger selections rejected clearly |
| Explicit Financials receipts | Up to 8 per run |
| Plan operations | At most 8, selected from the four existing calculation types |
| Lexical queries | Up to 6 |
| Source chunks | 1,400 characters with 200-character overlap |
| Retrieval scan | Up to 4,000 chunks; omitted-chunk counts disclosed |
| Retrieved passages | Up to 8; each is an exact saved-source slice |
| Model calls | Planning and, when evidence exists, qualitative synthesis only |
| Provider-call timeout | 35 seconds per call, including existing helper retry waits |
| Overall execution budget | 100 seconds; bounded local synchronous work is not a hard CPU sandbox |
| Model output budget | 2,400 tokens per call; malformed/truncated output fails validation |
| Helper attempts | Existing safe-call helper allows at most 3 attempts; no outer retry loop |
| Active runs | One queued/running run per case, at most two managed runs per process |
| Frontend transport | Status/event polling, approximately every two seconds |

Unlike increment-2 extraction, analyst retrieval does not discard long sections wholesale. It searches overlapping chunks and preserves the original section UUID, PDF page number or Text section label, exact excerpt, query/reason and start/end offsets. Offsets count Python Unicode characters in saved extracted text, not bytes or visual PDF coordinates. Lexical search is not exhaustive semantic retrieval; scan/passages caps and misses are disclosed.

With a research-as-of date, known publication dates after that date exclude the document from retrieval and fact eligibility. Unknown publication dates are flagged; upload timestamps are never substituted for publication dates. Excluded documents remain visible in the run snapshot and source-coverage display.

### Schema, API, lifecycle and configuration

Additive schema version 3 creates `analysis_runs`, `analysis_events`, `analysis_stage_outputs`, `analysis_evidence` and `research_briefs`. Runs remain separate from `extraction_runs`. Existing cases, documents, facts, revision histories and calculation receipts retain their IDs/data. A partial unique SQLite index prevents two queued/running runs for the same case.

| Method | Path | Behavior |
|---|---|---|
| POST | `/research/cases/{case_id}/analysis-runs` | Accept document_ids, optional question_override and optional receipt_ids; return 202 promptly, without waiting for the model |
| GET | `/research/cases/{case_id}/analysis-runs` | Run summaries/history |
| GET | `/research/cases/{case_id}/analysis-runs/{run_id}` | Full snapshot, status, persisted events, stage outputs, selections and brief |

Statuses are `queued`, `running`, `needs_input`, `completed`, `failed` and `interrupted`. The FastAPI lifespan initializes the local manager and marks abandoned queued/running records interrupted on startup. Shutdown cancels tracked tasks and persists interruption where storage remains writable. Completed history is retained. There is **no automatic resume, resumable checkpoint system, distributed worker or external queue**. Run the prototype as one backend process against one research directory. Case IDs and workspace labels are not authentication.

The existing Dexter credential/safe-call configuration is reused. Optional `RESEARCH_MODEL` and `RESEARCH_FALLBACK_MODEL` override model names for **Analysis only**, without modifying the existing Insights graph/configuration. Leaving overrides absent uses Dexter defaults; an empty fallback value disables the analysis fallback. Each run records requested settings, while `observed_serving_model` stays null because the reused helper returns text rather than provider model metadata.

During live testing, the key loaded successfully but Groq returned model-not-found for the application's existing Llama primary. The provider catalog exposed `openai/gpt-oss-20b`; the local ignored `.env` was configured with:

```env
RESEARCH_MODEL=openai/gpt-oss-20b
RESEARCH_FALLBACK_MODEL=
```

This uses the same Groq provider and credential. Availability is account-dependent; see [Groq's model documentation](https://console.groq.com/docs/models). The API key itself was never printed or copied into documentation. The original Insights and increment-2 extraction model settings were not changed by this Analysis override.

### Increment 3 checks and live-provider outcome

Commands run from the corresponding backend/frontend directories:

```bash
.venv/bin/python -m unittest discover -s tests -v
.venv/bin/python tests/smoke_research_server.py
.venv/bin/python tests/live_analysis_probe.py
npx eslint src/app/research src/lib/api/analysis.ts src/lib/api/financials.ts src/lib/api/research.ts
npx tsc --noEmit --pretty false --incremental false
npm run lint
git diff --check
```

- **41 offline tests pass:** 16 analysis tests plus the original 25 research/financials tests. Analysis tests cover plan schema failures, exact scoped citations/offsets, long-section retrieval/caps, as-of filtering, confirmed-only input selection, missing inputs, ambiguity/conflicts, receipt-backed 10% growth and 12% margin, invalid citations/numerical synthesis, injected source instructions, prompt 202 starts and duplicate/cross-case rejection, provider failure/actual timeout bounds, restart interruption, durable history in a fresh interpreter, stale input changes during execution, source removal and newly confirmed alternatives.
- **The existing real-HTTP smoke test passes** with the new application lifespan: case/document intake, reviewed facts, four calculations, actual backend restart, receipt persistence, revenue correction/recalculation, source deletion and agent/health endpoints. Analysis start/poll/detail semantics are also tested through FastAPI's ASGI interface with mocked model responses.
- Focused lint, TypeScript and diff checks pass. Full repository lint still reports the existing **28 errors and 33 warnings** outside this increment. No unrelated cleanup was undertaken. The production build was not rerun; the earlier Markets prerender failure is documented below.
- **Actual live planning succeeded** after the Analysis model override. Local retrieval and deterministic financial analysis persisted the expected **10.00% growth** and **12.00% margin**.
- **Actual live synthesis did not succeed.** One bounded run timed out at synthesis; the final retry with a shorter synthesis prompt returned malformed structured output. The run was saved as failed and no successful brief was fabricated. A complete live-provider brief is therefore **not verified**. The successful complete-brief tests use mocked structured model responses and do not prove live provider reliability.
- The live probe used only a temporary store and the clearly labelled synthetic fixture; it did not seed or alter the user's saved cases. Provider error diagnostics were sanitized. No further open-ended provider retries were performed.
- Browser clicks, visual/responsive inspection and end-to-end browser polling/citation interaction were **not performed** for increment 3. Frontend validation is TypeScript/lint, not a claim of browser QA.

### Exact increment 3 manual verification

1. Start the backend (`uv run python main.py`) and frontend (`npm run dev`) using the existing setup. Open a research case and verify Documents/Financials/Analysis navigation.
2. For a synthetic test, upload `backend/tests/fixtures/financials_synthetic.txt` and manually enter/review the fixture facts using the increment-2 instructions below. Confirm at least FY2024 revenue 1000, FY2025 revenue 1100 and FY2025 net income 132, with matching INR/crore, entity/basis and annual dates.
3. Open Analysis. Select the fixture document and use the run-specific question `Compare FY2024 and FY2025 revenue growth and FY2025 net profit margin; summarize the source content qualitatively.` Confirm the saved case question does not change.
4. Click **Run Dexter research**. Check that the request returns promptly, history shows a queued/running run, actual stage transitions appear, and another active run for the case is rejected. Inspect requested model settings and stage outputs.
5. With a provider returning valid structured output, expect saved receipt-backed 10% growth and 12% margin and a preliminary brief with the pending-verification/approval notice. In the currently tested live environment, synthesis can instead fail; expect its visible error and no fabricated brief. Financial outputs/receipts should remain available.
6. Open an evidence link. Compare the exact excerpt, original PDF page/Text section, stable IDs, offsets, publication date and reporting-period metadata against the saved document. Open a calculation link and inspect the actual saved formula, values, conversions, revisions and citations.
7. Try a case with unconfirmed/missing facts or multiple possible periods/values. Expect `needs_input` and exact role/selection messages. Use **Resolve in Financials**, confirm/correct facts or calculate an explicitly chosen receipt, then return to Analysis and select that receipt if needed. Start a new run; the old run is not resumed or overwritten.
8. Use a research-as-of case with a source published afterward and another with an unknown publication date. Confirm known future sources are excluded and unknown dates are flagged independently of upload time. Try a long saved section and inspect chunk coverage/offsets and retrieval limits.
9. Correct/reject/remove a depended-on fact or remove a selected document. Reopen the old run and verify its stale warning, retained snapshots/brief, and source-unavailable indication. A new confirmed conflicting alternative must also stale the old result. Add an unrelated unselected document and confirm it is listed as not considered.
10. Refresh/restart the backend and reopen history. Completed/failed briefs and stage outputs must persist; a run interrupted during execution must show interrupted after restart, without automatic resume. Missing credentials, provider failure or malformed outputs must remain visible while Documents/Financials remain usable.

### Remaining increment 3 limitations and changed files

Live planning has been demonstrated, but complete live synthesis remains a provider/output-validation blocker. There is no fallback invented brief or deterministic replacement for a failed model plan/synthesis. Qualitative validation is conservative and cannot prove truth or fully eliminate prompt injection. Lexical retrieval and exact period-label matching may require analyst question refinement; fiscal comparability remains the increment-2 rule. Staleness checks conservatively invalidate selected fact-catalog changes. Snapshots consume local SQLite storage, and synchronous bounded retrieval/database work is not a hardened CPU/memory sandbox. This is a single-user, single-process prototype without authentication, automatic resume or durable job workers.

Changed/added files for this increment:

- `backend/app/research/analysis_{models,state,store,llm,planning,retrieval,financial,brief,graph,manager}.py`.
- `backend/app/research/{migrations,store,financial_store,router}.py` and `backend/app/main.py` for additive storage, invalidation hooks, APIs and lifespan.
- `frontend/my-app/src/lib/api/analysis.ts` and research components `AnalysisPanel.tsx`, `SourceText.tsx`, `ReceiptInspector.tsx`, plus `CaseWorkspace.tsx` for the tab and shared source inspection.
- `backend/tests/test_analysis.py`, `live_analysis_probe.py`, and the version expectation in `test_financials.py`.
- This document, the project-documentation update notice and local ignored `.env` model settings.

**No dependencies were added.** The workflow uses the existing LangGraph/FastAPI/Pydantic/Groq stack and increment-2 tools. Detailed claim verification, risk assessment, final report approval, PDF export, web research and changes to the Insights graph were not implemented.

## Increment 2 — Financials

Inside a saved case, **Documents** retains intake and text inspection. **Financials** adds selected-document extraction, persistent extraction status, manual fact entry, candidate review/correction, source inspection, and calculated metrics with receipts. Extraction is the only LLM-assisted operation. Review and calculation never invoke the LLM. No full analyst graph, claim verification, risk assessment, approval flow, or report generation is included.

### Facts and analyst review

Supported metrics are `revenue`, `net_income`, `current_assets`, `current_liabilities`, `total_debt`, and `total_equity`. Each fact stores a UUID, case/document/section IDs, decimal-string value, optional entity/currency/scale, reporting-period label and dates, instant/duration/unknown period type, optional accounting scope/basis, supporting excerpt, review status, extraction origin, timestamps, revision, original values, and append-only review history.

All extracted proposals begin as `candidate` or `needs_review`; none are automatically confirmed. Missing critical metadata or an ambiguity note makes extracted facts needs_review. Unknown fields remain null. Publication dates are not used as financial reporting dates. An excerpt match establishes provenance only; it does not prove the number/column/entity/unit interpretation is correct.

Analysts can inspect source text and original page/section, correct interpretation fields, confirm, reject, or soft-remove a fact. Manual entry requires an existing case source and a matching excerpt. Saving a correction returns the fact to candidate status for separate confirmation. Confirming a fact with an unresolved ambiguity note fails clearly; correct and clear the note first. Every update uses `expected_revision` to reject stale edits (409), appends history, and invalidates dependent receipts. Confirmation means **analyst-reviewed**, not independently verified.

`total_debt` means interest-bearing short-term plus long-term borrowings. This MVP supports a **directly supported total only**. It never substitutes total liabilities or derives debt from component facts. Component aggregation and its multi-source receipt are not implemented.

### Bounded model extraction

The isolated `fact_extraction.py` service reuses Dexter's `PRIMARY_MODEL`, Groq credentials, and `safe_llm_call` helper. It does not change the Insights graph. Selected saved document IDs are validated against the case before a run starts. Source text is sent as untrusted data with explicit document/section IDs; the prompt requests structured JSON matching the Pydantic schema. No generated code is executed and source URLs are never fetched.

- Up to 20 selected documents per request; duplicate selections are collapsed.
- Up to **6 batches**, each containing at most **3 sections and 12,000 source characters**.
- A section longer than **10,000 characters** is skipped in full, with an explicit reason. It is not silently truncated. For long TXT/pasted sections, add a shorter source document or use manual entry.
- Each batch has a **35-second timeout**; the run has a **120-second provider-call time budget**. The reused helper permits at most 3 attempts per call, within the timeout, and may use its configured fallback model. The run records the requested model, not a claimed observed serving model.
- A response contains at most 60 fact proposals and has a 6,000-token output limit. Incomplete/malformed JSON fails validation; no unvalidated values are accepted.
- Every returned document/section pair must be in that batch. Supporting excerpts must occur in its saved text after **only Unicode whitespace-run collapse and leading/trailing whitespace stripping**. Case, punctuation, digits, and other characters are not normalized.
- Structured/schema/provenance failure fails that batch. Completed, partial, and failed runs list each section as pending, processed, skipped, or failed, including limitations and errors. Processed means the section was supplied and the output validated, not that every possible fact was found.
- Status is persisted before and after calls and polled by the UI. A backend restart marks abandoned runs failed on the next status read while retaining any already saved facts. This is designed for one local backend process, not distributed workers.
- Missing credentials, provider errors, and timeouts show a clear failure. Existing facts remain; manual entry stays available. There are no invented extraction results or fallback financial facts.

Repeated proposals are deduplicated by their original source IDs and financial interpretation/value metadata. Decimal spelling differences and excerpt/ambiguity-note variations do not overwrite an existing proposal or analyst review. Different values remain separate facts. This is conservative deduplication; changes to period/entity/unit interpretation can produce distinct proposals requiring review.

### Calculations and receipts

The API takes explicit **saved fact IDs**, loads current records, and computes with Python Decimal at 80 significant digits. It does not accept client results. Display values use two decimal places with ROUND_HALF_EVEN; receipts retain the full computational result at the stated precision. Repeating decimals are bounded by that precision, not represented as infinite expansions.

| Tool | Formula |
|---|---|
| Revenue growth | `(current - previous) / previous * 100` |
| Net profit margin | `net_income / revenue * 100` |
| Current ratio | `current_assets / current_liabilities` |
| Debt-to-equity | `total_debt / total_equity` |

Only confirmed, nonremoved facts with available sources are eligible. Inputs must match their required metrics, company/entity, currency, and accounting scope/basis. Missing metadata is listed explicitly. No FX conversion, automatic source choice, or invented universal good/safe/risky threshold is used.

Scales are converted explicitly to base units: units ×1, thousands ×1,000, millions ×1,000,000, billions ×1,000,000, lakh ×100,000, crore ×10,000,000. Each receipt records original values, scales, multipliers, normalized values, and currency.

Income-statement inputs need explicit duration start/end dates. Margin requires identical periods. Growth requires nonoverlapping chronological periods with duration differences no greater than three calendar days (a deliberately simple comparability rule covering ordinary calendar/leap-year variation, not a fiscal-calendar inference engine). Balance-sheet inputs must be instant facts with the same reporting date. Unknown or incompatible metadata produces an unavailable receipt, never a guessed calculation.

Competing confirmed values for the same metric/entity/currency/scope/dates are listed. The analyst must inspect them and explicitly acknowledge the alternative fact IDs before the selected value can be used. Equivalent base-unit amounts do not count as conflicting values. Introducing a new confirmed conflict also invalidates earlier dependent receipts.

Zero denominators produce unavailable results with explanations. Revenue growth from nonpositive prior revenue is marked not meaningful for this MVP. Nonpositive equity makes debt-to-equity unavailable. Missing fact roles and metadata are listed by exact role/field.

Each receipt stores its UUID, type, formula, UTC timestamp, selected fact IDs and revisions, complete input snapshots, unit conversions, computational and display result, precision/rounding, citations/excerpts, warnings, missing fields, conflicts/acknowledgements, and valid/stale/unavailable status. Recalculation adds a new receipt; it does not rewrite the old result. Stale cards show “Recalculation required”; old values are only shown inside their explicitly historical receipt details.

Source deletion retains fact IDs, source-title/page/section/excerpt snapshots, originals and review history, but marks sources unavailable. Dependent receipts become stale, and those facts cannot supply new calculations. Fact correction/rejection/removal similarly invalidates dependent receipts. Historical provenance is retained without claiming the deleted source is still available.

### Additive migration and changed files

Schema version 2 adds `research_migrations`, `financial_facts`, `fact_revisions`, `extraction_runs`, `calculation_receipts`, and `calculation_inputs`. Existing case/document/page tables, rows, and citation IDs are untouched. New tables use parameterized SQL, indexes, foreign keys for durable case/fact relationships, and transactional review/calculation writes. Fact source IDs deliberately do not cascade-delete facts when a document is removed; provenance snapshots remain. Migrations are idempotent on store initialization.

- Backend additions: `app/research/financial_models.py`, `migrations.py`, `financial_store.py`, `fact_extraction.py`, and `calculations.py`.
- Backend updates: `app/research/store.py` (migration and source invalidation) and `router.py` (typed case-scoped financial APIs).
- Frontend additions: `src/lib/api/financials.ts`, `FinancialsPanel.tsx`, `FactEditor.tsx`, and `CalculationPanel.tsx` inside the research components directory.
- Frontend updates: `CaseWorkspace.tsx` (Documents/Financials tabs) and scoped `research.css` (checkbox styling).
- Tests: `tests/test_financials.py`, clearly labelled `tests/fixtures/financials_synthetic.txt`, and the extended `tests/smoke_research_server.py`.
- Documentation: this file and the project-documentation update notice.

**No dependencies were added for increment 2.** It reuses SQLite/Decimal from the standard library, Pydantic/FastAPI, existing Groq/LangChain integration, and the existing frontend stack. The research API client uses the shared configured API base/proxy; there are no new localhost URLs in feature code.

| Method | Case-scoped path | Purpose |
|---|---|---|
| GET / POST | `/research/cases/{case_id}/facts` | List facts (including historical removals) / manual candidate entry |
| PATCH | `/research/cases/{case_id}/facts/{fact_id}` | Revision-checked correction or status review |
| DELETE | `/research/cases/{case_id}/facts/{fact_id}` | Soft removal; JSON body includes expected_revision |
| GET / POST | `/research/cases/{case_id}/extractions` | Extraction-run history / extract selected document_ids |
| GET / POST | `/research/cases/{case_id}/calculations` | Saved receipts / calculate with named input fact IDs |

The FastAPI `/docs` schemas document the exact input roles and models. The calculator accepts `current`/`previous`, `net_income`/`revenue`, `current_assets`/`current_liabilities`, or `total_debt`/`total_equity` according to calculation_type. Unresolved conflicts return an unavailable receipt with `conflicts`; resubmission requires `acknowledged_conflicts` for those role/alternative-ID sets.

### Increment 2 verification

Commands (backend and frontend directories respectively):

```bash
.venv/bin/python -m unittest discover -s tests -v
.venv/bin/python tests/smoke_research_server.py
npx eslint src/app/research src/lib/api/financials.ts src/lib/api/research.ts
npx tsc --noEmit --pretty false --incremental false
npm run lint
git diff --check
```

The offline suite covers source and excerpt checks, Pydantic output validation with mocked model output, repeat extraction/deduplication, preservation of corrections, missing credentials/provider failure, ambiguity, partial/skipped extraction, cross-case rejection, legacy migration retention, restart persistence, crore/lakh conversions, period/scope/currency/entity mismatches, missing inputs, denominator/equity rules, conflicts, and stale receipts after correction/rejection/removal/source deletion. It includes all original intake tests.

The extended real-HTTP smoke test uses only a temporary research store. It creates and confirms facts, computes all four ratios, stops/restarts the full backend, verifies facts/receipts and citation IDs, corrects revenue, verifies stale status and 20%/11% recalculations, and checks source-deletion invalidation and existing agent/health endpoints. It makes **no live model calls**. Live LLM extraction and browser/visual interaction have not been verified for increment 2.

Results for increment 2: **25 offline tests pass** (18 financials tests plus the original 7 intake tests); the extended HTTP/restart smoke test passes; focused ESLint and TypeScript checks pass; `git diff --check` passes. Full-repository lint still reports the same **28 existing errors and 33 warnings** outside the new financials implementation. The production build was not rerun for increment 2; the increment-1 Markets prerender failure is recorded below rather than represented as a new successful build.

The labelled synthetic fixture contains exactly the requested FY2024/FY2025 values. Income periods are 2023-04-01–2024-03-31 and 2024-04-01–2025-03-31; balance-sheet dates are 2024-03-31 and 2025-03-31. Currency is INR, scale crore, entity Synthetic Fixture Co, basis consolidated / synthetic GAAP. Tests assert growth 10%, FY2025 margin 12%, current ratios 2.0/1.5, debt-to-equity 0.4/0.5; after correcting FY2025 revenue to 1200 and reconfirming, growth is 20% and margin 11%. This fixture is test data, never an automatic UI fallback.

### Exact increment 2 manual verification

1. Start the existing backend/frontend and open a saved case at `/research/<caseId>`. Confirm Documents still uploads/inspects sources and switch to **Financials**.
2. For a clearly synthetic test, upload `backend/tests/fixtures/financials_synthetic.txt` in Documents. Do not treat it as actual company research.
3. In Financials, select only that document and click **Extract financial facts**. With configured Groq credentials, inspect the actual run status, processed/skipped section details, model limitations, and returned proposals. A live provider can still fail or omit facts; do not assume the automated fixture assertions establish live extraction quality.
4. With missing credentials or provider failure, confirm a visible failed run, unchanged existing facts, and an available **Add fact manually** control. Manual entry is the deterministic verification route when live extraction is unavailable.
5. Manually enter the twelve fixture facts, selecting the saved document/Text section. Copy each supporting line exactly. Set entity, INR, crore, consolidated / synthetic GAAP, FY label, period type, and the explicit dates above. Income facts have duration start/end; balance-sheet facts have instant period_end and no start date. Save candidates.
6. Click each source to inspect the supporting text, section ID, original values, and review history. Correct any unit/year/column interpretation, providing a correction reason. Try an invented excerpt or source ID from another case through `/docs`; expect rejection. Clear ambiguity notes only after resolving them.
7. Confirm the reviewed facts. Calculate by explicitly selecting IDs: FY2025 vs FY2024 revenue; FY2025 net income/revenue; each year's assets/liabilities and debt/equity. Expect 10%, 12%, 2.0/1.5, and 0.4/0.5. Expand each receipt to inspect formula, revisions, base-unit conversions, input values, and citations.
8. Correct FY2025 revenue to 1200 with a reason. Confirm the original value 1100 remains in history, old dependent results are stale, and the edited fact is a candidate. Reconfirm and recalculate; expect 20% growth and 11% margin. Current/debt ratios should remain unaffected.
9. Add a different confirmed revenue value for the same entity/period/basis. Confirm the calculator lists competing IDs and requires an explicit acknowledgement of the selected fact over alternatives rather than choosing silently.
10. Try mismatched currencies/scopes/dates, unknown required metadata, a zero denominator, nonpositive prior revenue/equity, or a missing role. Confirm unavailable receipts explain the exact issue, with no numeric result or good/safe/risky label.
11. Reject or remove an input fact and confirm dependent saved receipts become stale. Remove the source document in Documents, return to Financials, and confirm historical facts show source unavailable, receipts become stale, and new calculations exclude those facts. Another case must remain unaffected.
12. Refresh and restart the backend against the same research directory. Reopen Financials and verify facts, statuses, original values, histories, runs and receipts persist. Verify existing Insights and investor navigation separately. Browser/visual verification is manual unless explicitly reported as performed.

### Increment 2 remaining limitations

No full analyst graph, verification, risk assessment, approval workflow, report generation, OCR, vector database, live filing/data integration, authentication, or component-derived debt is implemented. LLM extraction requires network/credentials and analyst validation. Oversized sections need a shorter source or manual entry. The time budget bounds provider waits, not all database work. The prototype uses one local backend process; it has no job queue or distributed worker recovery. Entity/scope normalization only collapses whitespace and case; aliases and complex accounting restatements need explicit analyst resolution. Fiscal comparability uses the documented simple date rule. Decimal results have finite 80-digit precision. Source files/SQLite retain the increment-1 crash/orphan-file limitations described below.

## Increment 1 — document intake (retained)

- A Research Lab sidebar link immediately below Insights; nested case routes remain highlighted.
- `/research`: list saved cases, show loading/empty/error states, and create a case.
- `/research/[caseId]`: reopen a case and inspect its research question, company, optional ticker/period/as-of date, and actual creation/update timestamps.
- PDF/TXT uploads and titled pasted text, optional document type, publication date, reporting period, and HTTP(S) source URL.
- Saved document metadata, extraction status, and selectable plain-text pages/sections.
- Stable UUID case, document, and section IDs. PDF pages keep original 1-based positions, including empty pages. TXT and pasted sources have a labelled `Text section` with `page_number: null`.
- Case-scoped document removal, with confirmation in the interface.
- Durable SQLite records and original source bytes outside `portfolio.json` and outside public assets.

Publication dates and research-as-of dates are user-provided optional values. They are never inferred from upload time. Research data has no mock fallback, and the shared header's existing demo investment notifications are disabled only in Research Lab. No full Start research action exists; Financials exposes only the increment-2 extraction/review/calculation controls.

## Storage and API

Default storage is `backend/research_data/research.sqlite3` and `backend/research_data/uploads/`. The whole directory is ignored by Git. Back up both the database and uploads together. `VERITAS_RESEARCH_DIR` can select another directory, including a temporary directory for tests. Restarting the backend against the same directory preserves records; an ephemeral deployment filesystem does not.

SQLite uses standard-library `sqlite3`, foreign keys, parameterized queries, and transactional record writes. Research tables are isolated from the existing JSON portfolio and learning stores. Uploads are stored using server-generated UUID names; the client filename is only sanitized display metadata. Uploaded originals are not served as HTML or exposed through a public download route. Source text is displayed with React's normal escaping; it is never evaluated, interpreted as HTML/Markdown, or followed as instructions. Document intake never sends text to a model; increment 2 sends only explicitly selected saved sections for extraction. Source URLs are stored links, not fetched automatically.

This remains a **local, single-user prototype without authentication**. A case ID or workspace label is not an access-control boundary. Case-scoping prevents accidental cross-case document access/removal within this prototype; it is not tenant authorization.

| Method | Path | Response |
|---|---|---|
| GET | `/research/cases` | Case list with document counts |
| POST | `/research/cases` | Created case (201) |
| GET | `/research/cases/{case_id}` | Saved case |
| GET | `/research/cases/{case_id}/documents` | Document metadata list |
| POST | `/research/cases/{case_id}/documents/text` | Document and section text (201) |
| POST | `/research/cases/{case_id}/documents/upload` | Document and extracted pages/sections (201) |
| GET | `/research/cases/{case_id}/documents/{document_id}` | Saved document and text |
| DELETE | `/research/cases/{case_id}/documents/{document_id}` | Deletion result |

The upload endpoint takes multipart `file` and `metadata`, where `metadata` is JSON matching the typed `DocumentMetadata` model (required title; optional publication_date, reporting_period, source_url, document_type). Paste uses the same metadata fields plus `text` in JSON. Case creation accepts title, company_name, research_question, optional ticker, reporting_period, and research_as_of_date. FastAPI `/docs` exposes the schemas. The frontend uses the shared API client's configured base URL and `/backend` proxy rather than hardcoded localhost calls.

## Dependencies and intake limits

Added runtime dependencies:

- `pypdf>=6.0,<7`, locked to 6.21.2 for page-based extraction.
- `python-multipart>=0.0.22`, locked to 0.0.32 for uploads.

Added explicit development dependency `httpx>=0.28.1` for FastAPI and live HTTP tests. No frontend dependency was added.

Limits enforced on the backend and explained by the UI:

- File/pasted UTF-8 source: **10 MiB** maximum (10 × 1024 × 1024 bytes).
- Entire intake request: 10 MiB plus 64 KiB for metadata/multipart overhead, counted before JSON/multipart parsing, including requests without Content-Length.
- PDF: 1–300 pages.
- Extracted text: at most 2 million characters.
- PDF and `.txt` extensions only; PDF signature/parser checks and strict UTF-8 text decoding. Empty/whitespace-only and NUL-containing text is rejected.
- Whitespace-only required titles/questions, invalid dates/URLs, and unsupported metadata are rejected.
- Encrypted and malformed PDFs fail visibly. PDFs with no extractable text are rejected with a suggestion to paste text.
- Mixed PDFs retain every page but show `partial` status and a warning when any page has no extracted text. Those pages are labelled `no_text`, never silently dropped or renumbered.

Extraction does not perform OCR or recover original table semantics/layout. The [pypdf extraction documentation](https://pypdf.readthedocs.io/en/stable/user/extract-text.html) explains the limits of extracting text from images and complex PDF layouts. A partially textual scanned document may still require manual review. File/page/text limits are useful local limits, not a hardened sandbox for hostile PDFs or a strict bound on decompression memory/CPU.

## Increment 1 checks (historical)

From `Veritas/backend`:

```bash
.venv/bin/python -m unittest discover -s tests -v
.venv/bin/python tests/smoke_research_server.py
```

- **Seven offline tests pass:** persistence in a new store and separate Python process; original TXT content and safe filenames; PDF page positions including a blank page; scoped read/delete and cascade cleanup; empty/invalid input and metadata; encrypted/image-only PDF rejection; request/file/extracted-text size limits and missing cases.
- **Live smoke test passes:** starts the real FastAPI app with a temporary research directory, creates two cases, saves paste/TXT/two-page PDF sources, rereads saved text and page references over HTTP, terminates the backend, starts a fresh backend process on the same directory, confirms all document/page IDs and text survive, rejects cross-case deletion, and removes only the intended document. Existing `/agent/sessions` and `/health` also return successfully. The smoke test cleans up only its own temporary data.

From `Veritas/frontend/my-app`:

```bash
npx eslint src/app/research src/lib/api/research.ts src/lib/api/client.ts
npx tsc --noEmit --pretty false
npm run lint
npm run build
```

- Focused lint and TypeScript checks pass.
- Full repository lint reports 28 errors and 33 warnings in existing code, including investment components, Sidebar's existing localStorage effect, reports, and mock data. These were not expanded into an unrelated cleanup.
- Initial production-build attempts were blocked by Google Fonts network restrictions and then host disk exhaustion. After disk space became available, a network-enabled retry **compiled successfully and passed TypeScript**, but failed prerendering the existing `/market` page: `useSearchParams() should be wrapped in a suspense boundary`. A full production build therefore **does not pass** because of that existing Markets issue; no Markets code was changed in this increment.
- The running development frontend serves `/research`, `/research/nonexistent-case` (client fetch then handles the missing case), `/insights`, and `/overview` with HTTP 200. Research SSR contains the new controls and the existing Insights/Overview/Investments links. The existing backend serves `/research/cases` successfully.
- Browser clicks, a visual/responsive inspection, actual browser refresh, and live Dexter answers were **not verified**: computer-use access reported a client/server version mismatch and no available browser. HTTP rereads and backend restarts were verified instead. No LLM calls were made.

## Exact increment 1 manual verification

1. Start backend (`cd Veritas/backend`, `uv sync`, `uv run python main.py`) and frontend (`cd Veritas/frontend/my-app`, `npm ci`, `npm run dev`). Open `http://localhost:3000/research`.
2. Check that Research Lab is immediately below Insights. Click **New research case**. Enter title `Cash generation review`, company `Example Co`, optional ticker `EXAMPLE`, question `How is cash generation changing?`, period `FY25`, and an as-of date. Submit **Create case**. Confirm it opens `/research/<UUID>` immediately and displays the values.
3. Click **Paste text**, title it `Management notes`, enter a few paragraphs (optionally include literal `<script>not executable</script>`), and provide a known publication date. Save. Confirm the date is separate from Uploaded and the inspector shows a Text section without PDF page numbers. Expand stable citation identifiers and note the document/section IDs.
4. Create a UTF-8 `notes.txt` containing multiple lines and a Unicode value such as `Revenue ₹100`. Upload it with a document title. Inspect text and confirm the lines and Unicode survive, with no invented PDF page numbers.
5. Upload a small text-based PDF with different text on pages 1 and 2. Inspect both page selections and citation identifiers. Confirm page 1 and page 2 match the source. If testing a PDF with a blank middle page, confirm it remains in the selector and later pages retain their original numbers.
6. Refresh the browser. Reopen the case from **All research cases**. Confirm the same three documents, metadata, text, and IDs remain.
7. Stop the backend with Ctrl+C, restart it using the same storage directory, and refresh the case. Confirm the records and IDs still exist.
8. Create another case and add a document to it. Return to the first case; remove one document and confirm removal. Reopen the second case and verify its document remains. Calling its document URL under the first case's ID should return 404.
9. Try whitespace-only titles/text, an empty TXT, a non-UTF-8 TXT, a `.docx`/`.exe`, a malformed PDF, an encrypted PDF, a file larger than 10 MiB, and an image-only PDF. Expect clear visible errors, no successful-extraction claim, and no saved document for rejected inputs. Use `/docs` or the automated tests to exercise server validation that browser controls prevent.
10. Open a nonexistent `/research/<id>` and stop the backend while trying to load/save a case. Confirm a visible API error and loading retry control, not demo content.
11. Navigate to Insights, Overview, and Investments. Confirm existing navigation/content still works. Test the sidebar expanded/collapsed and at narrow widths; confirm the Research Lab forms and inspector remain usable.
12. Confirm there is no full Start research action, verification/risk verdict, or analyst graph. Financials separately contains the explicit increment-2 extraction/review/calculation tools described above.

## Remaining limitations

Case editing/deletion, source editing/re-extraction, OCR, full filing ingestion, full analyst analysis, verification, risk, report review, vector search, and authentication remain outside these increments. Uploaded sources are not malware-scanned. Source files and SQLite are separate resources; an abrupt crash between filesystem and database operations can leave an orphan file requiring maintenance. There is no quota across all cases or background extraction worker. PDF source text requires human review before citations or calculations.

## Real-source financial extraction correction — 24 October 2026

The saved Microsoft FY2025 pasted income-statement excerpt contains 981 characters and exactly matches the saved annual report's original PDF page 40. Its pasted section retains its own stable ID and has no PDF page-number metadata; the title identifies the original page. No metadata was manufactured.

A bounded live diagnostic reproduced `schema_mismatch` at `facts.0.value`, Pydantic category `value_error`: the provider returned a string containing a comma thousands separator. `FactInput.value` required an ungrouped decimal string through a Python validator, but its generated JSON schema only advertised string/maximum length. Thus strict provider JSON-schema compliance did not guarantee acceptance by Pydantic. No source text, raw provider response, or credentials were printed or exposed in the browser.

Changes:

- The shared decimal pattern and a clear decimal-string description now appear in `FactInput`'s generated schema. The extraction prompt explicitly requires removing printed grouping separators from the decimal value, while preserving exact source excerpts. Invalid grouped strings still fail validation (`string_pattern_mismatch`); numeric JSON values remain invalid. There is no permissive response repair.
- The provider and prompt still use the same `ExtractionOutput`/`FactInput` schema: `facts` wrapper, exact metric/scale enums, nullable metadata, ISO dates, and span/context fields. Domain validators still enforce finite/bounded decimal values and ordered dates. Span references are resolved against supplied saved sections, and context references are checked even when no main span ID is supplied. Analyst confirmation remains explicit.
- Run errors retain bounded known field paths and Pydantic categories without raw output. Provider errors retain their existing sanitized explanation.
- Optional `section_ids` accompanies `document_ids`; the server validates the entire selection against the selected case documents before saving a run or calling a provider. Omission selects all pages as before; an empty explicit selection is rejected. The Financials UI offers page/section checkboxes. Runs record selected status and original PDF page numbers, and display selected, processed, and omitted coverage, including unselected pages and limit skips. Existing section IDs/citations and all 10,000-character section / 12,000-character batch / six-batch / 35-second batch / 120-second run limits remain.

Live result after the fix: one bounded extraction with configured `openai/gpt-oss-20b` completed with **one revenue proposal**, marked **needs_review**, with no errors. The proposal references saved section `10c77d65-0138-43bc-a241-0aa986eedc5b` in document `d16ed62d-5b18-47fb-8b5e-95709a323626`, and its resolved excerpt equals the exact saved span. This was a real provider call using a temporary SQLite backup with the original saved IDs/text, not a mock or seeded fact. The temporary result was not inserted into the user's case; all existing records and failed-run history remain intact. This establishes successful contract validation/provenance, not completeness or financial correctness.

Validation: **71 backend tests pass** (12.570 seconds); the HTTP/restart smoke test using temporary synthetic storage, TypeScript no-emit check, focused Financials ESLint, and diff whitespace checks pass. New extraction-contract regressions cover the observed response shape, nullable metadata/date/enum/wrapper/span contract, invalid references, selected original page 40 and cross-document rejection, empty selection, unchanged batch/section limits, and sanitized diagnostics. No Insights code was changed. Browser interaction was not exercised.

## Analysis selected-receipt and as-of correction — 25 October 2026

Read-only inspection of failed run `8594a2f9-d395-46f3-8226-ca93b1c6daf4` showed receipt `4a0fe08d-1c4d-4e44-bcde-dfe3ce4da1ea` present in both `request.receipt_ids` and `snapshot.selected_receipts`. The UI state, API helper, `AnalysisStart`, route and saved request did not drop it. The deterministic plan retained periods `[FY2024, FY2025]`. The selected receipt was valid, with previous fact `5db0fcfe-5372-4bc4-a41f-835c4f09f2ad` revision 2 (`FY2024`) and current fact `2640a1b7-824e-45fe-b150-52c7583c00f0` revision 4 (`Year Ended June 30, 2025`).

The financial executor compared display labels before resolving explicit receipts. It discarded the chosen receipt because `FY2025` did not equal the current label, and its scope filter also excluded that fact. Automatic selection then returned the misleading missing/ambiguous-current-period message. Explicit receipt resolution now precedes automatic selection, binds exact IDs/revisions, and checks included confirmed sources, valid receipt status, input roles/metrics, entity, basis, periods and as-of date. For explicit receipts only, an FY-year shorthand can match confirmed full-year duration dates ending in that year; incomplete dates, nonannual periods, conflicting FY labels and different years do not match. Automatic selection still requires exact labels, and incompatible/missing/stale chosen receipts cannot fall back to competing facts.

The original request did **not** contain a split date label, so commas did not cause that saved failure. However the existing form's comma splitter would split `Year Ended June 30, 2025` in a future request. The same period field now accepts one exact label per line or semicolon, preserving internal commas. Receipt selection still sends the unchanged selected IDs.

The run's entered research-as-of date (`2026-10-24`) was present in both its saved request and resolved scope, and controlled temporal filtering. The misleading “not provided” text read only `snapshot.case.research_as_of_date`, which was null. New snapshots explicitly retain the effective run date separately from unchanged case metadata. The UI reads that date, with saved request/scope/case fallbacks for historical runs. No history backfill or case-date mutation is performed, preserving the case metadata staleness checks.

Verification: **76 backend tests passed**, including five new selected-receipt regressions covering both FY shorthand and the exact comma-containing label through the complete model-free simple-metric graph, exact receipt/fact reuse without fact/receipt mutation, automatic-selection ambiguity, incompatible entity/basis/period/as-of scope, competing selected receipts, stale receipts at intake and after snapshot, and effective-date source filtering. Two focused frontend tests pass for period serialization and new/historical snapshot date display; TypeScript and focused Analysis ESLint pass. The existing temporary-store HTTP/restart smoke test also passes.

A read-only replay of the actual saved run's scope, planning and financial node returned **14.93%**, the exact selected receipt ID and its two exact fact IDs, with **no needs_input messages**. SQLite was opened in `mode=ro`, and no provider call or new user analysis run was made. The original failed run remains preserved as `needs_input`; start a new run to save a corrected result. Existing cases, documents, facts, receipts and Insights were not modified. Browser interaction was not exercised.

## Report verification applicability correction — 25 October 2026

For completed analysis `12b4cfce-b2aa-42ca-932a-0e701b777736` in case `ef7d0376-53c6-408c-b77b-98f110c472e2`, the exact imported claim is `c73f3003-19ca-448e-bbdb-146ffd028395`, revision **1**, originating from finding `17ba7b54-6d3a-4b70-9f33-ff0c04315bbb`. Its linked verification `ea85579c-1f1f-4549-8ed3-6e5069afa2b9` is completed, non-stale, and supported by the deterministic numerical method. The comparison uses receipt `4a0fe08d-1c4d-4e44-bcde-dfe3ce4da1ea`, current fact `2640a1b7-824e-45fe-b150-52c7583c00f0` revision **4**, and previous fact `5db0fcfe-5372-4bc4-a41f-835c4f09f2ad` revision **2**. Both analysis and verification included document `c88f7a1c-d771-4efa-b695-0e0ff649c80d` with the same saved content hash; original source references remain intact. Freshness checks reported no changes to the claim, source, fact catalog or receipt.

Report versions 4–7 already selected the correct check but then downgraded it to `needs_review` with `basis_mismatch`: their raw period-set comparison rejected `Year Ended June 30, 2025` against scope label `FY2025`, despite the exact annual input dates and selected receipt already accepted by Analysis. Entity and accounting basis matched; this was a report scope-comparison bug, not a genuine stale or incompatible check.

Report composition now prefers the analysis's own applicable completed verification for the exact claim revision. Other checks must pass the same claim-revision, freshness, selected-source/content-hash, fact ID/revision and scope checks. Newer failed, stale or wrong-revision retries cannot hide an applicable linked check. Numerical display-label compatibility uses the existing explicit-receipt period check only when the comparison inputs exactly bind to a valid receipt selected/used by this analysis and both report/verification fact snapshots. There is no unconditional status replacement or unrestricted period aliasing. Genuine mismatches retain a specific explanation and corrective next step, rendered in Report. Approval/dependency-signature checks remain unchanged. The workspace footer now describes implemented evidence-based risk observations and versioned analyst review/approval; PDF export remains unavailable.

Validation: **82 backend tests passed** in 20.282 seconds, including six new report regressions for exact supported binding, preserved earlier versions/draft approval state, stale checks, wrong claim revisions, incompatible evidence scopes, newer inapplicable retries, and wrong periods/fact revisions/receipts/content hashes/bases/as-of dates. TypeScript no-emit, focused Report/Workspace ESLint, whitespace checks, and the temporary-store HTTP/restart smoke test pass. Browser interaction was not exercised.

After verifying composition in a temporary copy of the actual database, one new real **report version 8** was composed: `daf4050d-af70-4b16-9c51-0412d447919b`. It shows the revision-1 claim as **supported**, linked to verification `ea85579c-1f1f-4549-8ed3-6e5069afa2b9`, with **zero material unresolved claims**. It is a non-stale **draft**, not approved. All earlier report rows were compared byte-for-byte and remain unchanged. Before/after comparisons also confirmed no changes to existing cases, documents/pages, financial facts/revisions, receipts, analysis runs, verification runs, claims/revisions or report reviews. Existing extraction limitations remain visible; no provider call, fact seeding, re-verification, automatic approval or Insights modification occurred.

## Two-period net-profit-margin correction — 25 October 2026

Read-only inspection of run `325bff3d-c35b-4bf3-a80d-19c7c7733437` established the submitted state: `request.periods` was `[FY2024, FY2025]`, and both margin receipts were present in the request and snapshot: FY2024 `bb723fb4-ddf0-4074-89cd-c670d06b4134` (**35.96%**) and FY2025 `ebc8ae7a-f6e3-42c0-aafa-079528583479` (**36.15%**). However, `request.calculations` contained only `net_profit_margin` for `FY2025`. The form used `periods.slice(-1)` for margin calculations. Its separate per-period handling applied only to current ratio and debt-to-equity.

The deterministic planner copied that one operation. Financial execution bound the FY2025 receipt and produced finding `05804bae-a0b4-4adf-99c1-9a90cf69ffae`; brief assembly retained it. Verification created claim `b49c2f64-5614-4b92-a6dd-3b9f5bc2b9e5`, revision 1, with check `95adc3cd-9ea8-43c6-96ac-6b1803542992`. Report version 13 (`2b60ed2a-cbaa-43fc-a589-3c1e3c943e01`) retained that single supported claim/receipt. These downstream stages did not drop a second result: no FY2024 operation reached them, and the completion check did not compare the selected margin-period coverage against the plan.

Corrections:

- The existing form now builds one margin/ratio operation for every entered period; revenue growth remains a previous/current comparison. Simple metric supports multiple margin periods; it has no intentional one-period limitation.
- Python planning splits margin periods into distinct operations, deduplicates equivalent margin tasks, and checks scope before normalization. A margin-only Simple metric request covers its explicitly requested periods, including older truncated payloads. In mixed requests, explicitly selected margin receipts can restore omitted margin periods; a broader growth scope alone cannot silently broaden an intentionally narrower margin task. The existing eight-operation limit is enforced after expansion, with no truncation.
- Each numerical finding passes its exact receipt to its claim verification snapshot. FY2024 uses income fact `b32c3313-a5b2-4cf1-987e-1c501792524f` revision 4 (`Year Ended June 30, 2024`) and revenue fact `5db0fcfe-5372-4bc4-a41f-835c4f09f2ad` revision 2 (`FY2024`). Explicit valid ratio receipts may bind different saved labels only through an exact label anchor and identical complete reviewed period dates for every input. Automatic selection remains strict. No dates, metadata or numerical results are invented, and conflict/staleness/provenance checks remain.
- Missing/stale inputs for one period preserve successful findings and verification for the other period, identify the missing period in `needs_input`/brief missing information/report next steps, and prevent full run completion. Partial report snapshots record `source_analysis_status=needs_input`. A defensive financial completion invariant checks that every planned operation produced a validated receipt-backed finding.

Validation uses six new backend regressions: original truncated payload with both receipts; correctly submitted separate operations without duplication; missing first-period receipt; stale first-period inputs; mixed-scope compatibility; and scope/operation-budget rejection. Frontend regressions cover both-period operation serialization and receipt-ID retention. The original saved request was also executed through the full model-free graph in an isolated copy of the real database: **35.96% and 36.15%**, the two original receipt IDs, **two supported persisted claim checks**, and **two supported report findings**. Original run/report rows were compared unchanged, and facts/receipts were unchanged. The actual user database was opened read-only; no replacement run/report, facts, or claims were inserted there. Start a new Analysis run to save corrected outputs. Insights was not changed.

Final verification: **88 backend tests passed** in 26.012 seconds. The existing HTTP/restart smoke test, three frontend tests, TypeScript and focused Analysis ESLint pass. An initial smoke repeat exposed and helped correct overbroad normalization of mixed growth/margin requests. A later full-suite repeat encountered disk-full errors in temporary test databases; only the regenerable `.next/dev/cache/turbopack` build cache (about 611 MiB) was cleared before final verification. No research records, source files, uploads or reports were removed. Browser interaction was not exercised.

### Insights judge-demo readiness (25 October 2026)

The separate `/insights` agent originally used unavailable hardcoded Llama models. It now accepts private `INSIGHTS_MODEL`, `INSIGHTS_ROUTER_MODEL`, and `INSIGHTS_FALLBACK_MODEL` overrides; local configuration uses provider-available `openai/gpt-oss-20b`. Its health endpoint checks the configured router model. GPT-OSS calls use low reasoning effort and an adequate output-token allowance. Research Lab model settings are unchanged.

A real `/agent/chat` test using supplied Microsoft annual-report figures completed in 3.285 seconds with 14.93% growth, 36.15% margin and 1.35 current ratio. This demonstrates reasoning over supplied inputs, not independent source verification. A separate open-ended what-if test produced unsupported numerical forecasts and no web-source events, so it is not a recommended evidence-backed judge demo. Use Research Lab for audited source-linked calculations. No unsupported forecast was imported into saved research records. Full offline backend regression after model-configuration changes: 144 tests passed.
