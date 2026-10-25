# Financial Analytics integration

> October 25 update: the Microsoft BI report now opens at `/financial-analytics` with eight report pages and an official-report CSV extraction. The original transaction MVP below is retained at `/financial-analytics/transactions`. See [Microsoft report documentation](microsoft-bi-report.md) for current routes, dataset provenance, formulas and validation.

The implemented scope follows `dashboard/VERITAS_FINANCIAL_ANALYTICS_MVP_PRD.md` and the supplied standalone demo. The broader BI PRD describes a later production phase; authentication, tenant storage, XLSX mapping, jobs and automatic notifications are not part of this browser-only feature.

## Repository findings and boundary

- Next.js App Router, React 19, Recharts and Lucide are already installed. Reuse Sidebar and SharedTopNav, with demo notifications disabled on this route.
- Existing portfolio/report APIs and Research Lab have independent storage and workflows. Keep company CSVs in route-local React state. No backend calls, migrations, secrets or new dependencies are needed.
- Add `/financial-analytics`, a local stylesheet, pure parsing/calculation/WhatsApp helpers, two public synthetic CSVs, and a sidebar/search link. Preserve existing uncommitted Research Lab changes.
- Use exact integer paise with safe-integer bounds, strict calendar dates, quoted-field CSV parsing, atomic replacement and explicit source labels. INR is assumed, with no conversion.
- Validate thresholds before deriving alerts. Review state is scoped to the import and rule configuration. WhatsApp is a prefilled draft requiring the user to send.

## Verification

Use Node's test runner and the installed TypeScript transpiler for fixture totals, decimal arithmetic, monthly grouping, threshold boundaries, CSV failures and message contents. Run ESLint, TypeScript and production build; record unrelated failures separately. Check the route in a browser when available, including upload replacement, review/reset, responsive layout and sample scenarios.

## Run and limitations

From `frontend/my-app`, run `npm run dev`, then open `/financial-analytics` from the sidebar. No backend or environment configuration is required. Select **Load demo data**, **Load cash-flow example**, or upload the five-column CSV template. Imports replace the active dataset only after complete validation; failed imports leave the previous dataset visible with an error. Data and review states clear on refresh. CSV uses valid YYYY-MM-DD dates and positive INR amounts with at most two decimal places; file limit is 5 MiB / 25,000 transactions.

Run `node --test tests/financial-analytics.test.cjs`, `npx tsc --noEmit`, `npm run lint`, and `npm run build`. Real WhatsApp delivery, XLSX, database persistence, account/company isolation, accounting profit, expense-spike/duplicate rules and monthly-summary imports remain outside this MVP. No message is automatically sent.

## Actual validation (25 October 2026)

- `node --test tests/*.test.cjs`: 11 passed (8 new financial analytics tests, 3 existing Research Lab tests).
- `npx eslint src/app/financial-analytics tests/financial-analytics.test.cjs`: passed.
- `npx tsc --noEmit`: passed.
- `npm run lint`: existing project failures remain, 34 errors and 33 warnings. None are in the new route/helpers/test file.
- `npm run build`: initial sandbox run could not fetch the existing Google Fonts. Retried with network access: compilation and TypeScript passed, then existing `/market` prerender failed because `useSearchParams()` lacks a Suspense boundary. Market files were not modified.
- Local GET `/financial-analytics`: HTTP 200, with the expected page title, upload/sample actions, empty dataset and schema instructions in the response.
- Fixture expectations: income sample ₹24,20,000 income, ₹7,52,000 expenses, ₹16,68,000 net, 8 transactions, 2 default high-value alerts. Expense-heavy sample ₹1,00,000 income, ₹4,25,000 expenses, −₹3,25,000 net, 4 transactions, 1 default cash-flow alert.
- No browser was connected to the available UI automation tool. Visual layout, actual file-picker interactions and review/reset actions require manual browser verification; they were not claimed as executed. Pure parsing, alert boundaries, exact money arithmetic and draft URL contents were tested.

## Manual review checklist

1. Open Financial Analytics from the sidebar and load each demo scenario.
2. Upload a downloaded template, change thresholds, mark/reopen an alert, and use table search/type filters.
3. Upload an invalid CSV: the error must explain the row/reason, while the prior dataset stays active. Upload a different valid CSV: totals, review state and table must be replaced.
4. Check the WhatsApp link opens a draft; send only if desired. Refresh to confirm browser-memory data clears.
5. Check narrow and wide layouts, and existing Overview, Portfolio and Reports screens with the backend running.
