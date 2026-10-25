# Veritas — Financial Analytics MVP PRD (Hackathon Build)

**Purpose:** Add a focused, demo-ready financial analytics feature to Veritas without disrupting existing investment, portfolio, research, or reporting workflows.

**Target build window:** Approximately 60 minutes for a frontend-first MVP with Codex. This is a time-boxed target, not a guarantee.

**Product context:** The supplied Veritas documentation describes a Next.js App Router frontend using React, TypeScript, Tailwind CSS v4, Recharts, and Lucide React, with a FastAPI backend. The current `/reports` page is largely illustrative and reflects personal portfolio reporting. The backend uses local JSON files and has no authentication, database, or per-user data isolation. Existing report and portfolio code should not be repurposed as storage for uploaded company transactions.

## 1. Product decision

Build a **separate Financial Analytics page** for company transaction files. Prefer a new route such as `/financial-analytics`; follow the repository's actual route conventions after inspection. Keep the existing `/reports`, `/portfolio`, and investment workflows unchanged. Reuse the existing layout, typography, colors, cards, buttons, icons, and Recharts dependency where practical.

For the one-hour hackathon MVP, parse the selected CSV in the browser and keep the currently uploaded dataset and derived alerts in feature-local React state. This avoids a risky backend/schema change and keeps uploaded business data separate from the personal investment portfolio. Data is not durable after refresh in this MVP; make this limitation explicit in the UI or hand-off notes. Do not claim persistent storage.

## 2. Problem statement

A financial analyst needs to upload a company's transaction data, understand basic inflows and outflows immediately, identify large transactions or significant net outflow, and prepare an alert for review without manually inspecting every row.

## 3. Primary user and demo story

**Primary user:** An analyst or founder reviewing one company's financial CSV.

**Demo story:**
1. Open Financial Analytics.
2. Load the bundled sample CSV or upload a valid CSV.
3. See KPIs and the trend chart update from the uploaded data.
4. See a high-value transaction and/or negative net cash-flow alert appear.
5. Open the alert's WhatsApp action to prepare a message, clearly labelled as user-confirmed/prefilled delivery unless a real WhatsApp Business API is already configured.

## 4. In-scope MVP requirements

### 4.1 CSV upload
- Accept `.csv` files only for the hackathon MVP.
- Required exact header fields: `date,description,type,amount,category` (header matching can be case-insensitive after trimming whitespace).
- `type` must be `income` or `expense`, ignoring case and surrounding whitespace.
- `date` must parse as a valid date; `amount` must be a finite positive number; `description` and `category` must be non-empty after trimming.
- Show a clear error for an unreadable file, missing headers, invalid row values, or an empty dataset.
- The MVP may reject the whole file when a row is invalid, with the row number and reason. Do not silently discard invalid rows.
- Include a way to load the supplied sample file so the demo can proceed quickly.
- Use a simple parser appropriate to the available dependencies. Do not add a CSV dependency unless existing utilities cannot handle quoted fields safely within the available time.

### 4.2 Dashboard and calculations
Calculate metrics from the **currently loaded dataset only**:
- Total Income = sum of `amount` for rows whose `type` is `income`.
- Total Expenses = sum of `amount` for rows whose `type` is `expense`.
- Net Cash Flow = Total Income − Total Expenses.
- Transaction Count = number of valid loaded rows.
- Monthly cash-flow trend = monthly income, expenses, and net cash flow grouped by transaction date.

Use `Intl.NumberFormat` for display formatting. Default display to INR for the demo, and make it clear that the sample dataset assumes INR. Do not perform FX conversion. The amount field is stored as a number, without currency symbols in the CSV.

**Terminology guardrail:** This dataset does not include a full income statement or accounting adjustments. Label the KPI **Net Cash Flow**, not net profit. Do not claim that the dashboard calculates audited profit, fraud, or tax liabilities.

### 4.3 Visual dashboard
- Use existing Veritas visual conventions; do not redesign the product shell.
- KPI cards for Total Income, Total Expenses, Net Cash Flow, and Transactions.
- One responsive chart showing monthly income and expenses (net cash flow may be included if clear and not visually crowded).
- Recent transactions table containing date, description, category, type, amount, and alert state.
- A visible alert panel with severity, rule triggered, transaction/date or aggregate period, and review status.
- Include empty, loading/processing, success, and error states.
- Avoid fake data in the actual uploaded-data view. A sample dataset is allowed only when the user explicitly loads it and should be labelled “Demo data”.

### 4.4 Rule-based alerts
Use configurable thresholds with sensible defaults and controls in the page:
- **High-value transaction:** flag each row when `amount >= highValueThreshold`, regardless of income/expense type. The alert message must identify the row and value.
- **Negative net cash flow:** calculate Net Cash Flow across the currently loaded dataset. Trigger an alert when `netCashFlow <= -lossThreshold`, where `lossThreshold` is a positive configured number. Label it **Negative net cash flow** or **Cash-flow threshold breached**, not “accounting loss”.
- Threshold values must be valid positive numbers. Recalculate alerts when the file or threshold changes.
- Avoid generating duplicate alert cards for the same underlying rule/row within one loaded dataset. A new upload replaces the previous dataset for this MVP; do not append files together implicitly.
- Alerts are signals for analyst review, not fraud determinations or financial advice.

### 4.5 WhatsApp action
- Isolate WhatsApp behavior behind a small helper/adapter.
- If valid real WhatsApp Business API credentials and an existing secure server integration are already configured, inspect and reuse them only if doing so fits safely within the time box.
- Otherwise, provide a button that opens a `wa.me` link with a prefilled alert message, requiring the user to confirm/send it. Clearly label this **Open WhatsApp to send**; it is not automatic delivery.
- Do not expose access tokens in frontend code, commit secrets, add fake success messages, or claim a message has been sent when the user has only opened a link.
- The message should include the alert type, amount/threshold where applicable, date or reporting period, and a short instruction to review the dashboard.

## 5. Out of scope for the one-hour MVP

- XLSX/Excel files, arbitrary column mapping, multiple currencies or FX conversion.
- Authentication, multi-tenant accounts, company data persistence, database tables, file uploads to cloud storage, or backend jobs.
- Automated WhatsApp API delivery if Meta credentials are not already configured.
- Email/SMS alerts, scheduled monitoring, recurring alerts, forecasting, ML anomaly detection, fraud conclusions, accounting/tax calculations, or approval workflows.
- Editing the current portfolio JSON or changing existing portfolio/report business logic.
- Broad refactors, new design systems, a replacement app, or unrelated cleanup.

## 6. Integration design

### Preferred implementation
- Frontend route/page under the actual Next.js App Router structure.
- Feature-local components and helpers under the existing source conventions, for example a dedicated `financial-analytics` route plus a local `components` or `lib` folder if that matches the repo.
- Reuse existing Tailwind classes, card/button styles, Lucide icons, and Recharts. Do not add a chart library.
- Use feature-local React state for the active dataset, thresholds, parsing errors, alerts and review states.
- Do not call the backend or write uploaded company transactions to `backend/data/portfolio.json`.
- Add one sidebar/navigation entry only if the relevant nav component can be changed narrowly and without conflicting with teammate work. Otherwise leave the page reachable directly by URL and document the link-in step.

### Repository safety
- Inspect Git status before editing. Never overwrite or revert uncommitted teammate work.
- Do not modify shared API contracts, `portfolio_service.py`, existing report endpoints, global state, or shared theme files unless absolutely required.
- Minimize package changes. Reuse installed dependencies.
- If adding a navigation link causes shared-file merge risk, keep route implementation independent and tell the user which single link can be added later.

## 7. Suggested CSV schema and sample

```csv
date,description,type,amount,category
2026-10-01,Client payment,income,850000,Sales
2026-10-03,Office rent,expense,95000,Operations
2026-10-05,Cloud infrastructure,expense,42000,Technology
2026-10-08,Consulting revenue,income,320000,Services
2026-10-12,Equipment purchase,expense,275000,Capital expenditure
2026-10-15,Enterprise payment,income,1250000,Sales
2026-10-18,Emergency repair,expense,160000,Operations
2026-10-20,Marketing campaign,expense,180000,Marketing
```

Suggested demo defaults: high-value threshold ₹5,00,000; negative net cash-flow threshold ₹1,00,000. These are demonstration settings, not universal standards. The sample is constructed to show at least one high-value transaction; the aggregate net-cash-flow alert depends on the threshold and sample totals.

## 8. Acceptance criteria

The MVP is acceptable when all of these pass:
1. Existing Veritas app still starts and the new route loads.
2. Valid CSV upload updates all four KPI cards, the chart, table and alerts.
3. Loading the sample data demonstrably triggers the high-value transaction rule.
4. A test dataset with expenses greater than income by the configured threshold triggers the negative net cash-flow rule.
5. Increasing/decreasing thresholds updates flags without re-uploading.
6. Missing headers, invalid type, invalid date, zero/negative amount, malformed row and empty CSV show useful errors rather than crashing.
7. Uploading a new file replaces the old dataset instead of silently accumulating rows.
8. WhatsApp action either uses an existing secure real integration correctly or opens a prefilled `wa.me` link and accurately describes the action.
9. No existing `/reports`, `/portfolio`, or investment behavior was intentionally modified.
10. Available lint/type-check/build commands are run; errors introduced by this feature are fixed, or existing failures are documented.

## 9. Demo checklist

- Open `/financial-analytics` (or the route Codex actually creates and documents).
- Load `sample_transactions.csv`.
- Show Total Income, Total Expenses, Net Cash Flow and Transaction Count.
- Point to the flagged high-value payment.
- Adjust the threshold and show the flag changing.
- Use a second dataset or change sample records temporarily to demonstrate a negative net cash-flow alert.
- Open the WhatsApp action and explain that the user confirms the prefilled message if no real API is configured.
- State honestly that the current hackathon version processes data in browser memory and does not persist it after refresh.

## 10. Post-hackathon extension path

If the feature is selected for ongoing development, plan a separate phase for backend upload/validation, durable database tables scoped to a company, authentication/authorization, audit history, durable alerts, secure WhatsApp API delivery and retries, configurable currency, import idempotency, data retention, and automated tests. Those are not prerequisites for this demo-only MVP.
