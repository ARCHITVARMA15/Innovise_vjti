# Microsoft FY2025 BI report

Financial Analytics now opens an eight-page financial reporting workspace at `/financial-analytics`. `/financial-analytics/microsoft` opens the same report. The original browser-only CSV upload and alert workspace remains at `/financial-analytics/transactions`, available from the report toolbar.

## Dataset and web research

The canonical downloadable dataset is `frontend/my-app/public/financial-analytics/microsoft/microsoft_fy2025_financials.csv`. It is a **Veritas-prepared extraction of real Microsoft disclosures**, not a CSV published by Microsoft and not internal Microsoft transaction data. Every observation has a metric, dimension, fiscal year, period type, start/end dates, numeric value, unit, source URL and reported basis. The app's JSON snapshot is generated from the same extraction. Tests verify exact CSV/snapshot parity.

Primary sources:

- [Microsoft FY2025 annual report](https://www.microsoft.com/investor/reports/ar25/index.html): consolidated income statements, cash flows, June 2024/2025 balance sheets, and Note 18 segments, product offerings and geography.
- [FY2025 Q1 earnings](https://www.microsoft.com/en-us/investor/earnings/fy-2025-q1/press-release-webcast)
- [FY2025 Q2 earnings](https://www.microsoft.com/en-us/investor/earnings/fy-2025-q2/press-release-webcast)
- [FY2025 Q3 earnings](https://www.microsoft.com/en-us/investor/earnings/fy-2025-q3/press-release-webcast)
- [FY2025 Q4 earnings](https://www.microsoft.com/en-us/investor/earnings/fy-2025-q4/press-release-webcast)

The dataset contains **454 reported observations**. FY2025 means July 1, 2024–June 30, 2025. Annual income/cash flow and recast business mix cover FY2023–FY2025. Quarterly income covers FY2024–FY2025; the extraction uses the first two three-month columns, never the cumulative YTD columns. Balance sheets cover June 2024 and June 2025 only. The source manifest includes source URLs and downloaded-content SHA-256 hashes. Research/extraction date: October 25, 2026.

## Report experience

1. **Overview**: revenue, operating income, net income, free cash flow, annual trends, segment revenue mix, margins and cash generation.
2. **Earnings**: revenue-to-net-income waterfall, operating expense composition, margins and the income statement comparison matrix.
3. **Quarterly**: actual quarterly revenue/prior-year comparison, quarterly margins and period/EPS matrix. The KPI cards are explicitly full-year comparisons.
4. **Cash flow**: cash capex and free cash flow, opening-to-closing cash waterfall, selected capital deployment and full cash flow statement.
5. **Business mix**: segment drill-down, revenue/cost/operating-income decomposition, significant product/service offerings and geography.
6. **Balance sheet**: asset composition, funding structure, liquidity, leverage, average-equity returns and full balance sheet.
7. **Ratios**: profitability, liquidity, leverage, returns, efficiency, growth, cash flow and business-mix measures, each with its formula.
8. **Source data**: primary links, methodology, statement reconciliations, searchable/filterable observation table and source CSV downloads.

There are **46 central reported/calculated measures**. The report supports global year/display-unit filters, comparison controls, segment-only slicers, annual-year and segment chart selection, legend series toggling, visual-level underlying-data tables, visual CSV downloads, focus mode, browser-local view bookmarks/restore, source-table pagination, a presentation view and printing the current report page to PDF. Print outputs the current sheet, not every hidden report page.

The layout uses compact report chrome, report-page navigation, a separate filter pane, bottom sheet tabs, consistent chart colors, financial statement matrices and restrained typography. Narrow screens use bottom tabs and an on-demand filter pane. Presentation mode removes the host shell from view. No Power BI or Tableau service/dependency is involved.

## Financial definitions

- Financial source values are USD millions. Display switching to billions does not change calculations. EPS stays USD/share and share counts stay millions of shares.
- Free cash flow = operating cash flow − cash additions to property and equipment. It is a Veritas calculation, excludes noncash lease additions, and is not substituted for reported net income.
- Borrowings = short-term debt + current portion of long-term debt + long-term debt. Lease liabilities are excluded and labelled accordingly. Net cash includes short-term investments.
- ROA, ROE and asset turnover use average opening/closing balances. Missing historical balances remain unavailable, not zero or a closing-balance substitute.
- Microsoft Cloud is an overlapping disclosure and is not added to segments/offerings. Segment/offerings history uses FY2025 recast comparatives.
- Cash dividends paid and cash stock repurchases use the cash flow statement. They differ from dividends declared and board-authorized repurchase totals.
- Percentage changes require a positive prior-year denominator. Missing/zero/negative prior bases show n/a. Absolute changes remain visible in statements.
- No synthetic monthly allocation, stock-price series, live market feed, FX conversion, forecasts, standalone Azure margins or valuation multiples are fabricated.

## Reproduce and run

The frontend needs no new dependencies, backend setup or environment variables:

```sh
cd frontend/my-app
npm run dev
```

Open `/financial-analytics`; the sidebar and page search link directly to the report.

For data regeneration, download the five source URLs to a chosen local directory with the names `veritas-msft-ar25.html`, `veritas-msft-q1.html` through `veritas-msft-q4.html`. Use a Python environment with Beautiful Soup 4, then run from the repository root:

```sh
python scripts/build_microsoft_dataset.py --source-dir /path/to/downloaded-sources
```

The script writes the canonical CSV, frontend JSON snapshot and public source/hash manifest. Table shapes are asserted; after a source refresh, run the independently specified totals and reconciliation tests before using the output. Raw source HTML files and Python scraping dependencies are not needed at frontend runtime.

## Verification

From `frontend/my-app`:

```sh
node --test tests/*.test.cjs
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/eslint src/app/financial-analytics tests/microsoft-bi.test.cjs
npm run build
```

- 19 tests pass, including 8 Microsoft dataset/model tests, 8 transaction analytics tests and 3 existing analysis-input tests.
- TypeScript and feature-specific ESLint pass.
- All 16 FY2025 statement/segment/geography/offerings/quarterly reconciliations agree exactly in USD millions. Tests also verify every available reconciliation in FY2023/FY2024, explicit missing-period handling, ratio formulas, CSV parity, period boundaries, sources and export escaping.
- Production compilation and TypeScript pass. One full build stopped at the existing `/market` missing Suspense boundary around `useSearchParams()`; the final build stopped at the same existing issue on `/portfolio`. Neither route was changed. Full-project lint has previously identified unrelated failures.
- Local HTTP GETs of `/financial-analytics`, `/financial-analytics/microsoft`, `/financial-analytics/transactions` and the downloadable financial CSV all return 200. The overview contains FY2025 expected values and the 16-reconciliation status. The served CSV matches the local canonical dataset byte for byte.
- Visual browser verification is blocked: no connected browser is available and the native UI tool reports an app/client version mismatch. Actual chart interactions, downloaded files, narrow-screen appearance, print layout and bookmarks still need a manual browser pass. Relaunching Codex may restore UI automation.

## Demo sequence

Open the overview, enter presentation mode, point out the four KPIs, then select Intelligent Cloud in the segment donut. Show the segment decomposition and underlying data, move to the earnings/cash waterfalls, compare quarterly performance, and finish on Source Data with the official URLs and reconciliations. Export a visual or the full dataset. Use Transactions in the toolbar for the separate CSV upload/WhatsApp draft demo.
