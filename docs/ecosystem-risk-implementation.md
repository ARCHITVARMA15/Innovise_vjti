# Ecosystem Risk MVP: audit and implementation plan

## Verified repository audit

| Capability | Existing implementation | Reuse / gap |
|---|---|---|
| Case/document intake | FastAPI `/research/cases`, PDF/TXT/pasted sources, stable sections | Reuse case IDs, metadata and source snapshots. |
| Persistence | `ResearchStore`, SQLite `research.sqlite3`, additive JSON-payload migrations | Add ecosystem tables in the same database through an isolated store adapter. |
| Financial evidence | `FinancialStore`, reviewed facts, entity/period/currency/basis metadata | Read confirmed source-available facts; never silently confirm or mutate them. |
| Arithmetic | `calculations.TOOLS`, Decimal scales and financial identity checks | Reuse these tools for scoped counterparty ratios; calculate scenarios separately with Decimal. |
| Orchestration | `analysis_graph` with scope/planning/retrieval/financial/verification/risk/report nodes | Add an optional case-scoped ecosystem supervisor/subgraph with a distinct run lifecycle; preserve existing routes and task contracts. |
| Worker lifecycle | Analysis and verification managers attached through `research_lifespan` | Compose that lifespan with an ecosystem manager for bounded execution/restart recovery. |
| Verification | `validate_excerpt`, case-scoped source/fact retrieval, evidence statuses | Reuse exact-excerpt validation and scoped financial provenance; new relationship-direction/date/lineage audit is required. |
| Frontend | Research Lab case tabs, typed same-origin API client, error/status components | Add `EcosystemPanel` as an optional tab; keep existing uncommitted Analysis/Report changes. |
| Streaming | General app SSE exists; Research Lab mostly polls | Persist stage events and expose snapshot + SSE replay/polling. |
| Auth/tenancy | No account/company authorization | Case scope only. Reviewer label is explicitly unauthenticated. |

Actual application routing is `/research/cases/...`, proxied by Next.js under `/backend`. The spec's `/api/ecosystem` names are adapted to those conventions.

## Concrete files and architecture

- `backend/app/research/ecosystem/models.py`: strict typed entities, sources, claims, exposures, metrics, findings, runs, scenarios, events and reviews.
- `store.py`: additive run/object/review/event tables, atomic snapshots, case checks and optimistic review revisions.
- `fixtures/microsoft_demo.json`: one official disclosed subsidiary and three clearly synthetic supplier/logistics counterparts. Official relationship is based on SEC Exhibit 21, FY2025, not inferred from a brand name or rumor.
- `engine.py`: entity alias resolution, curated discovery, relationship/source verification, deterministic materiality, financial adapter, transmission/scenario and independent audit checks.
- `workflow.py`: one-hop, five-counterparty supervisor, bounded targeted rechecks (at most two), timeout/active-run limits, honest interrupted/needs-input states and real persisted progress.
- `router.py`: create/list/read runs, scenario calculation, persisted review and SSE events; demo routes gated by `VERITAS_ECOSYSTEM_DEMO=1`.
- `backend/app/main.py`: narrowly register the new router and compose the existing lifespan.
- `frontend/my-app/src/lib/api/ecosystem.ts`, `EcosystemPanel.tsx` and scoped CSS: relationship map/table, evidence drill-down, target/counterparty separation, scenario inputs, report/export, workflow trace and review history.
- Existing `CaseWorkspace.tsx`: add one tab/import without replacing existing changes.
- `backend/tests/test_ecosystem.py`: temporary SQLite unit/integration acceptance tests; no network/model keys.

Flow: optional supervisor → target/entity resolution → curated relationship discovery → exact evidence/date/direction verification → materiality → reused financial tools → causal transmission → independent audit → at most two targeted source rechecks → reviewable report.

The supplemental `Veritas_Ecosystem_Risk_MVP_Blueprint.docx` was read, including its three embedded diagrams. Its supervisor requirement is implemented through an application-owned `ecosystem_risk` dispatch in `create_research_graph`, followed by a dedicated bounded subgraph. Existing ordinary research still routes through scope resolution. Text in documents cannot choose branches. The blueprint's gate chain is preserved: relationship support → material exposure → plausible causal path → source audit → human review. LLM reasoning is optional in the blueprint; this reproducible demo uses structured rule templates with no model/network calls and labels that method explicitly.

## Demo scope and assumptions

One target, at most five direct counterparties, no recursive discovery and no trading. The fixture is a scenario demonstration, not a claim of actual Microsoft supplier distress. Synthetic relationships and metrics are always marked hypothetical; they cannot create confirmed alerts. Official subsidiary evidence verifies a dated disclosed corporate affiliation; it does not by itself prove direct legal shareholding, guarantees or financial dependence. All non-disclosed dependency shares remain unknown.

Ordinary runs may use the curated official Microsoft relationship and case-confirmed financial evidence. Demo fixture injection is available only with the explicit server flag. No source text can execute tools, change workflow limits or elevate news into official evidence. Runtime network/model tool allowlists are empty in this curated MVP. Missing material inputs produce qualitative paths, never invented loss numbers. The scenario formula is available only for a disclosed affected-revenue input with complete provenance and user-entered severity/unmitigated fractions.

## Validation plan

Run baseline Research Lab tests, new offline unit/API acceptance tests, frontend TypeScript and feature lint. Test correct parent direction, rumor exclusion, synthetic high/low/unknown mechanisms, missing percentages, incompatible financial scopes, amended/stale sources, prompt injection, exact source matching, retry termination, review persistence, cross-case IDs, mode gates, scenario validation and database restart recovery. Document actual commands/results and browser limitations after implementation.

## Actual implementation and validation

Completed on October 25, 2026. Run instructions, architecture, APIs, demo script and limits are in [the module README](../backend/app/research/ecosystem/README.md). Public configuration is in `backend/.env.ecosystem.example`; private `.env` contents were not read or edited. Fixture licensing and disclosure URLs are in `backend/app/research/ecosystem/fixtures/README.md`.

New files: the `backend/app/research/ecosystem` package (models, store, engine, workflow, router, limits, fixture and READMEs), `backend/tests/test_ecosystem.py`, the public configuration example, frontend `EcosystemPanel.tsx`/`ecosystem.css` and `src/lib/api/ecosystem.ts`. Shared-file edits: router/lifespan/middleware registration in `app/main.py`, optional supervisor dispatch in `analysis_graph.py`, two state fields in `analysis_state.py`, and one tab/import in `CaseWorkspace.tsx`. All prior Research Lab and financial dashboard work was retained.

The additive SQLite migration is version **6**. It preserves original case/document/fact/report tables and adds isolated ecosystem runs, objects, events, reviews and scenarios. There are no package/dependency changes. Case-financial excerpts are bounded at 250,000 characters and snapshotted exactly; POST bodies are bounded at 64 KiB before JSON parsing.

| Check actually run | Result |
|---|---|
| Baseline: `.venv/bin/python -m unittest discover -s tests -p 'test_*.py'` before implementation | 88 tests passed |
| Feature: `.venv/bin/python -m unittest discover -s tests -p 'test_ecosystem.py'` | 14 tests passed |
| Final backend regression: `.venv/bin/python -m unittest discover -s tests -p 'test_*.py'` | 102 tests passed |
| Frontend: `node --test tests/*.test.cjs` | 19 tests passed |
| Frontend: `./node_modules/.bin/tsc --noEmit` | Passed |
| Feature lint: `./node_modules/.bin/eslint src/app/research/components/EcosystemPanel.tsx src/lib/api/ecosystem.ts` | Passed |
| `npm run build` with access to the existing Google Fonts | Compiled and passed TypeScript, then stopped at the pre-existing `/portfolio` `useSearchParams()` missing Suspense boundary |
| `git diff --check` | Passed |

The end-to-end acceptance test loads the real `app.main` application with its composed lifespan and temporary SQLite, creates a Microsoft case through the real API, starts the supervisor branch, reads all four relationships/findings and persists a human request-for-changes. It does not call an external model or network service. API tests also replay saved stages through the SSE endpoint.

Acceptance coverage includes the documented parent-to-subsidiary direction; news-only edges rejected; critical versus replaceable supplier paths; unknown dependency share; incompatible financial basis abstention; stale-source retry termination and eligible amendment preference; ignored prompt-injection text; independent rejection of an unsupported confirmed warning; precise Decimal scenario arithmetic with a test-only disclosed input; disabled demo mode; case isolation; timeout/concurrent-run limits; oversized bodies; restart interruption; approval/rejection/request-changes persistence; scenario edits reopening approval; and removed case evidence blocking approval. The real-company fixture deliberately has no disclosed affected-revenue input, so its numeric impact remains unavailable.

Visual/browser interaction testing remains unrun: the UI tool returned no connected browsers and reported a client/server version mismatch, requesting a Codex relaunch. Manual checks still needed: open a Microsoft case → Ecosystem Risk, load the historical scenario demo, select each graph node, inspect source links, save a scenario, export the report, and approve/reject/request changes. No screenshot or interactive browser test is claimed as passing.

The implementation is deliberately a curated offline demo with Microsoft/LinkedIn entity support. There is no autonomous discovery for arbitrary targets, live monitoring, authenticated/tenant-isolated review, numerical forecast, external notification or trade execution. Rechecks revisit failed saved evidence only; they do not pretend to search the web. Standalone company report contracts stay unchanged; ecosystem findings have a separate auditable run/report snapshot and review ledger.

## Real-evidence extension: Spirit, Boeing and Airbus

The additional case is implemented and documented in [Spirit historical case](spirit-real-evidence-case.md). Research Lab has a create/reopen action; the case opens directly in Ecosystem Risk and uses the normal curated endpoint with no synthetic-demo flag. The source registry additionally supports Spirit as target, with Boeing and Airbus as real counterparties. The Microsoft fixture remains unchanged.

New persisted fields have backward-compatible defaults: concentration basis/full-period dates, historical observed impact/event end, assessment evidence references, and scenario base-kind/input provenance. Existing schema version 6 stores these additive fields in its JSON payloads; no table replacement is required. Historical observed impacts require a verified real relationship plus explicit eligible primary evidence and survive independently from active warning status. The financial screen now respects primary-source going-concern disclosures, rejects a LOW health interpretation of nonpositive equity, and flags matching loss plus negative operating cash flow as pressure without claiming insolvency.

Validation after this extension: **106 backend tests passed** (18 ecosystem tests), **19 frontend tests passed**, TypeScript and targeted lint passed. The live local API created and completed a separate Spirit case with **2 VERIFIED relationships, 13 reported metrics, 1 documented historical impact, 0 active exposure warnings and NEEDS_REVIEW**; its frontend route returned HTTP 200. No human approval or scenario assumptions were submitted on behalf of the user. Interactive browser validation remains unavailable; no visual QA is claimed. During validation, disk exhaustion was resolved by stopping the project’s frontend, removing only its generated Next.js development cache, and restarting it on port 3000.
