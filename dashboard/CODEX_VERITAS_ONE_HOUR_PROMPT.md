# Codex Task Prompt — Veritas Financial Analytics (One-Hour MVP)

Implement the attached `VERITAS_FINANCIAL_ANALYTICS_MVP_PRD.md` in the existing Veritas repository. This is a time-boxed hackathon feature, not a greenfield application.

## Repository facts from the project documentation
- Frontend: Next.js App Router, React, TypeScript, Tailwind CSS v4.
- Charts: Recharts is already declared; Lucide React is available.
- Backend: FastAPI, with local JSON persistence and no database/authentication in the documented current implementation.
- Existing routes include `/reports`, `/portfolio`, `/investment`, `/overview`, `/market`, and `/insights`.
- `/reports` is primarily illustrative and describes the personal investment portfolio; uploaded company transaction data is a separate domain.
- The shared frontend API client is `frontend/my-app/src/lib/api/client.ts`; API rewrites exist in `frontend/my-app/next.config.ts`.
- Backend startup is documented as `cd Veritas/backend && uv run python main.py`; frontend startup as `cd Veritas/frontend/my-app && npm run dev`.

## Important working rules
1. First inspect the actual repository layout, Git status, available dependencies, existing theme/components and the navigation component. Do not assume paths beyond those confirmed by inspection.
2. Do not overwrite, discard, reset or revert uncommitted work. The app is being developed with a teammate; minimize shared-file edits.
3. Build the feature as a dedicated route, preferably `/financial-analytics`, using the existing shell and design system. Do not redesign the entire app.
4. For the one-hour MVP, parse CSV in the browser and keep data in feature-local React state. Do not modify backend portfolio/report endpoints, do not write uploaded company records to `portfolio.json`, and do not add a database or backend unless the actual repository makes a frontend-only solution impossible.
5. Reuse Recharts and existing styles. Avoid adding dependencies unless required, and explain any addition.
6. Follow the attached PRD as the functional source of truth. In particular, label the aggregate as **Net Cash Flow**, not net profit; this CSV is not a full accounting ledger.
7. High-value rule: flag a transaction when `amount >= highValueThreshold`. Cash-flow rule: trigger when `totalIncome - totalExpenses <= -lossThreshold`. Both thresholds are positive configured amounts. Recompute as thresholds change and avoid duplicates within the active upload.
8. Use INR formatting for the demo only, and disclose that the sample data assumes INR. Do not perform currency conversion.
9. WhatsApp: use an existing secure server-side Cloud API integration only if it already exists and can be reused safely. Otherwise implement a clearly labelled “Open WhatsApp to send” action that opens a prefilled `wa.me` message requiring user confirmation. Never put Meta tokens in client code and never claim delivery occurred when it did not.
10. Include valid/invalid upload states, empty state, sample CSV loading, KPI cards, monthly income/expense chart, transaction table, alert panel, editable thresholds and a demo disclaimer stating browser memory is not persistent.

## Implementation plan
- Inspect route conventions and current changes; identify the smallest file set.
- Implement the feature page and feature-local parsing/calculation/alert helpers.
- Reuse existing UI and chart packages.
- Add a navigation link only if it is a narrow, safe change; otherwise document the URL and the exact link-in step.
- Test using the included `sample_transactions.csv` and an expense-heavy test dataset. Verify invalid headers, invalid types/dates/amounts, threshold changes, and replace-on-new-upload behavior.
- Run available frontend lint, type-check and build checks (inspect package scripts first). Fix feature-introduced errors. Avoid time-consuming unrelated fixes; report pre-existing failures separately.

## Definition of done
Return:
1. Changed files and the route URL.
2. Exact run/test commands and their results.
3. Confirmation of upload, calculation, alert and validation tests actually executed.
4. Whether WhatsApp is real API delivery or a prefilled-link demo.
5. Known limitations, especially no persistence after refresh and no multi-company authentication.
6. Any single manual step needed to expose the route in the sidebar.

Start by inspecting the repository and Git status. Then implement the smallest safe end-to-end MVP. Do not stop after producing a plan or scaffold; proceed with code changes and tests.
