# Veritas Financial Analytics — One-Hour Runbook

This runbook assumes the codebase matches the supplied project documentation. Always check the actual repository and current branch before acting.

## Before Codex edits (0–5 minutes)
1. Open the **same Veritas repository** your teammate is using.
2. Check Git status and save/commit your own work. If possible create a separate branch, e.g. `feat/financial-analytics-mvp`.
3. Tell your teammate you're adding a dedicated `/financial-analytics` route and ask whether they are editing the sidebar/navigation at the same time.
4. Attach `VERITAS_FINANCIAL_ANALYTICS_MVP_PRD.md`, `CODEX_VERITAS_ONE_HOUR_PROMPT.md`, and `sample_transactions.csv` to Codex.

## Build (5–40 minutes)
1. Ask Codex to inspect the frontend route layout, Git diff, available components and dependency scripts.
2. Require a frontend-first route that uses existing Next.js, React, Tailwind and Recharts. Avoid backend/database changes for this demo.
3. Let it implement upload, CSV validation, calculations, chart, table, thresholds and alert panel.
4. Do not spend the hour on Excel support, authentication, cloud persistence, forecasting or automated WhatsApp setup.

## Test (40–52 minutes)
1. Start the app using the repository's own commands. The supplied docs list:
   - Backend: `cd Veritas/backend && uv run python main.py`
   - Frontend: `cd Veritas/frontend/my-app && npm run dev`
   A frontend-only MVP may not need the backend for this feature, though other app screens might.
2. Open the actual route Codex reports, preferably `/financial-analytics`.
3. Load `sample_transactions.csv` and verify income, expenses, net cash flow, row count, trend chart and high-value alert.
4. Lower the high-value threshold and verify flags update; raise it and verify they disappear as expected.
5. Upload an expense-heavy file to trigger the net cash-flow threshold.
6. Try a bad header or invalid amount and verify a useful error appears.
7. Check the existing Overview, Portfolio and Reports pages still load.

## Demo polish (52–60 minutes)
- Use the sample file rather than typing amounts live.
- Set a high-value threshold that visibly flags the large payment.
- Show the chart and table updating from the uploaded file.
- Demonstrate the threshold control and alert panel.
- If WhatsApp is implemented with a prefilled `wa.me` link, explain that it opens a draft and the person must press Send. It is not automatic delivery.
- State clearly that the uploaded dataset is held in browser state and is lost after refresh in this MVP.

## Escalation rules if time is running out
- If sidebar integration conflicts with teammate changes, leave the route implemented and provide the URL for manual navigation.
- If CSV parsing takes too long, support only the supplied documented schema and fail clearly on unsupported data.
- If the chart causes dependency/type issues, show the KPI cards, alert list and transaction table first; use existing Recharts rather than installing a new library.
- If real WhatsApp credentials are unavailable, keep the prefilled-message demo. Never show false “sent successfully” confirmation.
- If build checks show pre-existing failures, do not rewrite unrelated code to fix them. Record the exact command and error.

## Post-hackathon integration notes
The current project documentation says there is no authentication, database or per-user portfolio isolation. Before making this feature persistent or multi-company in production, add proper authentication/authorization, durable company-scoped storage, audit logging, safe file processing, alert history, retention controls and server-side notification credentials. Do not store company uploads in the personal portfolio JSON file.
