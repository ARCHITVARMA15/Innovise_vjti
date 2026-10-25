# Financial Analytics Demo and Integration Plan

## Repository finding

`C:\vjti` contains the Veritas specifications and documentation, but no application source tree, package manifest, or Git repository. The nearby folders named `DI1_19_AsteriX` are a different product and have unrelated uncommitted changes, so they are not modified. The demo is therefore a standalone, dependency-free browser feature in `financial-analytics-demo/`. It is runnable immediately and can be ported into the documented Next.js application when that source checkout is available.

## Run the demo

Open `financial-analytics-demo/index.html` in a modern browser. Use **Load demo data** for the high-value scenario, **Load cash-flow example** for a negative cash-flow alert, or upload a CSV using this exact schema:

```csv
date,description,type,amount,category
2026-10-01,Client payment,income,850000,Sales
```

The demo accepts CSV only. Header comparison is case-insensitive and trims whitespace; fields support quoted commas and escaped quotes. Any invalid record rejects the whole file and displays its source row and reason. Selecting a new valid file replaces the active dataset. The sample assumes INR. All upload data and alert review statuses live in browser memory and clear on refresh.

## Implemented demo behavior

- Income, expenses, net cash flow and transaction count from active rows.
- Monthly inflow/outflow chart and searchable, sortable-by-date transaction table.
- Adjustable positive high-value and negative-cash-flow thresholds.
- Per-transaction high-value alerts and one aggregate cash-flow alert, with in-memory review status.
- WhatsApp `wa.me` draft action; the user must review and press Send. It does not send automatically.
- Empty, processing, success, and validation-error states.

## Next.js integration steps

1. In the actual Veritas source checkout, inspect `git status`, `frontend/my-app/src/app`, the root layout/sidebar, package scripts, and installed Recharts/Lucide dependencies.
2. Add a route at `frontend/my-app/src/app/financial-analytics/page.tsx` (or the repo's confirmed route convention) and move the UI into a feature-local client component such as `src/app/financial-analytics/FinancialAnalyticsDashboard.tsx`.
3. Port the isolated CSV parser, calculations and alert derivation from the demo into `src/app/financial-analytics/lib/analytics.ts`. Keep upload rows, threshold values and review states in this feature's local React state. Use decimal-safe arithmetic (integer minor units or a decimal library already installed) if this becomes a persisted financial workflow.
4. Replace the demo's inline SVG chart with installed Recharts components and use the host app's existing shell, cards, buttons, typography and icons. Do not edit portfolio/report APIs or personal portfolio storage.
5. Add one sidebar link only after confirming the correct nav component and that the checkout has no conflicting edits. If not safe, leave the page at `/financial-analytics` and document direct navigation.
6. Copy `financial-analytics-demo/sample_transactions.csv` to the app's public assets (for example `public/sample_transactions.csv`) and keep a **Load demo data** action that clearly labels the data as demo data.
7. Preserve the distinction between this demo and production: no authentication, tenant isolation, database, audit trail, durable imports, XLSX support, or server-side WhatsApp integration exists here. Production use requires host authentication/company authorization, transactional import staging, durable company-scoped records and server-side notification credentials/consent.
8. Inspect `package.json` scripts before running checks. In the real app, run its documented lint/type-check/build scripts and verify the existing Overview, Portfolio and Reports routes. These checks cannot run from this docs-only folder.

## Files

- `financial-analytics-demo/index.html`: complete standalone implementation with inline styling and logic; no install or build step.
- `financial-analytics-demo/sample_transactions.csv`: synthetic INR demonstration transactions.
- `financial-analytics-demo/expense_heavy_transactions.csv`: synthetic expense-heavy scenario to demonstrate the aggregate cash-flow rule.
- `docs/financial-analytics-integration-plan.md`: repository findings, run instructions and integration steps.

## Boundaries and limitations

The standalone demo follows the hackathon MVP PRD rather than the broader BI PRD's production-oriented requirements. It handles only the exact five-column transaction CSV format, processes files in browser memory, assumes INR and a single analyst/company, and has no persistence or authentication. It is for a hackathon demonstration, not a secure multi-company financial system. WhatsApp is a prefilled user-confirmed draft only.
