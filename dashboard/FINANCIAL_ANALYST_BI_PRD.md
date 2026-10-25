# Product Requirements Document (PRD)

## Financial Analyst BI Dashboard & Risk Alerting Feature

**Document status:** Ready for implementation planning  
**Version:** 1.0  
**Product type:** Modular feature for an existing application; build independently first, then integrate  
**Primary implementation agent:** OpenAI Codex  
**Default locale/currency:** en-IN / INR (configurable; never assume every uploaded company uses INR)  
**Primary users:** Financial analysts, finance managers, company administrators  

---

## 1. Executive summary

Build a self-contained Financial Analyst BI feature that lets an authorized user upload a company's financial data in CSV or Excel format, map the uploaded columns to a canonical data model, validate and import the records, and view an interactive dashboard that refreshes from the newly imported dataset. A configurable rules engine detects important financial changes—such as a period loss crossing a user-defined threshold, a high-value transaction, a spending spike, or a possible duplicate transaction—and creates a reviewable alert. When configured, alerts can be delivered to opted-in recipients through the official WhatsApp Business Platform Cloud API.

The feature must be developed with a clean boundary from the main application. Codex must first inspect the existing repository, framework, authentication, database, UI system, test conventions, and deployment setup. It must then implement the feature in an isolated module/package or feature branch, using the project's established conventions where possible. Only a small, documented integration layer should be required to add it to the main product.

This is an analytics and decision-support feature. It flags records for human review; it does not declare fraud, execute financial transactions, provide regulated investment advice, or replace accounting review.

## 2. Problem statement

Financial analysis often requires repeatedly cleaning spreadsheets, recalculating KPIs, checking for unusual transactions, and manually informing the relevant person when something crosses a threshold. This is slow, error-prone, and difficult to repeat across different companies or differently formatted files.

The feature should turn a valid upload into a repeatable workflow:

1. Upload data for a selected company.
2. Map and validate the file's columns.
3. Import a versioned, auditable dataset.
4. Refresh KPIs, visualisations, filters and transaction tables.
5. Evaluate configured rules against the newly imported data.
6. Show any triggered alerts in the product.
7. Send WhatsApp notifications when integration, recipient consent, and message-template requirements are configured.

## 3. Product goals and success criteria

### 3.1 Goals

- Make CSV/XLSX uploads the source of truth for refreshing the dashboard.
- Support data formats that differ between companies through a mapping and validation step.
- Make key financial indicators understandable, filterable and traceable to source data.
- Allow company-scoped alert thresholds to be configured without code changes.
- Prevent duplicate alerts and duplicate notification sends during retries or repeated processing.
- Support WhatsApp notifications through a provider adapter, with a safe local/mock mode when credentials are absent.
- Package the work so it can be developed, tested and reviewed before integration into the main project.

### 3.2 Proposed measurable acceptance targets

These are implementation acceptance targets, not claims about current performance:

- A user can upload a supported CSV/XLSX file, map columns, preview validation results, confirm import, and see updated dashboard data without a developer editing code.
- Validation errors identify the row and field where possible and do not silently coerce invalid financial values.
- Reprocessing the same upload or retrying a job does not create duplicate imported transactions or duplicate alert events.
- All company-owned records and API reads/writes are scoped to the authenticated user's authorized company access.
- For a sample dataset of 50,000 transaction rows, the import and dashboard-refresh flow completes without loading the entire file into browser memory. Performance must be measured and documented in the implementation environment; target a successful local test within 60 seconds on a typical development machine, excluding external WhatsApp delivery.
- Rule evaluation is deterministic for the same dataset version and same rule configuration.
- Notification failures are visible and retryable, but do not undo a successful financial data import.
- Automated tests cover the KPI calculations, rule boundaries, tenant isolation, import validation, idempotency, and notification adapter behavior.

## 4. Non-goals

The MVP does **not** need to:

- Replace an accounting system, general ledger, ERP, or audited financial statement.
- Automatically classify every transaction with generative AI.
- Make investment recommendations or guarantee that flagged entries are fraudulent.
- Initiate payments, block bank transfers, or alter source financial records.
- Scrape bank portals or connect directly to banking APIs.
- Deliver email, SMS, Slack, or Telegram notifications in the first release; the architecture can leave room for future channels.
- Build an advanced ML anomaly-detection model before deterministic rules and reliable data quality exist.
- Require Power BI or a separate BI licence to use the dashboard.
- Assume all companies share one schema, currency, fiscal year, timezone, or threshold.

## 5. Users, roles and permissions

The feature must plug into the main application's identity system rather than creating a second independent login system. If the main application has no authentication yet, Codex must document that gap and implement a minimal development-only auth boundary only if necessary; it must not silently present an unauthenticated production experience.

### 5.1 Roles

- **Company Admin:** Manage company profile, upload permissions, rule settings, notification recipients and WhatsApp connection settings.
- **Financial Analyst:** Upload or review data if permitted, view dashboards, inspect transactions, investigate alerts, acknowledge alerts and export filtered results.
- **Viewer:** Read dashboard and alerts only; cannot upload files or edit rules.
- **Platform Admin (if applicable in the host app):** Manage platform-level configuration; must not receive unrestricted financial data access by default.

### 5.2 Permission checks

- Every API request touching company data must check both authenticated identity and company membership/role.
- A company ID supplied in a request is not proof of access.
- File download, raw-row views, alert details, exports, notification recipients and rule updates must all enforce the same authorization boundary.
- If the host app supports organizations/tenants, map this feature onto that model instead of inventing another tenant concept.

## 6. Main user journeys

### 6.1 First-time setup

1. User opens **Financial Analytics** for a company they are authorized to access.
2. User sees an onboarding checklist: company currency/fiscal settings, upload data, define initial alert rules, optionally configure WhatsApp.
3. User uploads a CSV/XLSX file and chooses **Transactions** or **Monthly Financial Summary** as the dataset type.
4. The product detects likely column names and suggests mappings.
5. User reviews mappings, date format, amount format, currency and sign convention.
6. User previews a limited sample and sees row-level validation errors/warnings.
7. User confirms import.
8. Backend creates an import run, processes the file, commits valid records according to the import policy, updates the active data version, recalculates dashboard queries, and evaluates alert rules.
9. Dashboard shows the import status and updated KPI values. Triggered alert events appear in the alert centre.
10. If WhatsApp is configured and enabled, the notification worker sends eligible alerts and records provider response/status.

### 6.2 Repeat upload

- The user can upload a newer file or a file containing a period of data.
- Before import, the UI clearly states whether the operation is **append**, **upsert by stable transaction identifier**, or **replace selected period**.
- Do not silently replace existing company records.
- Import mode must be explicit. For MVP, support append plus upsert when the source has a stable external transaction ID. A replace-period mode is optional only if its destructive consequences are made clear and covered by tests.
- Dashboard queries must use the committed active data, not partial in-progress rows.

### 6.3 Investigate alert

1. Analyst opens an alert card or WhatsApp dashboard link.
2. Product shows severity, rule, reason, measured value, threshold, affected period/transaction, first-seen time, source import, and notification delivery status.
3. Analyst drills into source transactions or period metrics.
4. Analyst acknowledges, marks as investigating, resolves, or dismisses the alert with an optional note.
5. All status changes are recorded in an audit log.

### 6.4 Configure thresholds

- Company Admin opens **Alert Rules**.
- They select a rule type, set a threshold, choose applicable period/direction/category filters, set minimum baseline conditions where relevant, and enable/disable the rule.
- The form explains units and boundary behavior; for example, whether `>= ₹10,00,000` means exactly ten lakh also triggers.
- The UI previews a plain-language rule summary before save.
- Rule changes affect future processing and must have a recorded version/change timestamp. The default MVP should not silently rescan all historical data unless the user explicitly runs a historical evaluation.

### 6.5 Configure WhatsApp alerts

- Admin provides a recipient phone number in E.164 format, records explicit opt-in, selects enabled alert severities/types, and configures the required WhatsApp Business Platform credentials via server-side secrets/settings.
- The product shows whether configuration is connected, unconfigured, test-only, or failing.
- A **Send test notification** action is available only to authorized admins and must not expose tokens to the browser.
- When provider credentials are missing, the feature still works in local development using a mock/log provider; the UI must not pretend a message was sent.

## 7. Functional requirements

Priority definitions: **P0** = required for MVP; **P1** = valuable next increment; **P2** = later enhancement.

### 7.1 Company financial profile

- **FR-001 (P0):** Store or reuse a company/tenant identifier, display name, reporting currency and timezone.
- **FR-002 (P0):** Allow a configurable fiscal-year start month where supported by host application.
- **FR-003 (P0):** Show the selected company clearly throughout the Financial Analytics experience.
- **FR-004 (P0):** Default currency display may be INR, but source currency must be explicitly stored or assigned by the user. Do not combine currencies in totals unless valid conversion rates and conversion policy are implemented; MVP should group/filter by currency and avoid cross-currency aggregation.

### 7.2 Upload, mapping and validation

- **FR-010 (P0):** Accept `.csv` and `.xlsx` files. Reject unsupported types. If `.xls` is not supported by the chosen library, communicate that clearly.
- **FR-011 (P0):** Enforce configured file-size and row-count limits. Show a useful error when limits are reached. Do not trust filename or client-supplied MIME type alone.
- **FR-012 (P0):** Detect the header row and suggest canonical field mappings using exact and fuzzy header aliases. User must review and confirm mappings.
- **FR-013 (P0):** Preview representative rows before confirmation; protect against formula execution by treating uploaded content as data.
- **FR-014 (P0):** Validate dates, amounts, numeric precision, direction/type, required columns, currency, duplicate identifiers and blank rows.
- **FR-015 (P0):** Show row-level errors and warnings, including row number, field, issue and recommended correction when possible.
- **FR-016 (P0):** Require confirmation before importing when invalid rows exist. The UI must state whether invalid rows will be rejected while valid rows are imported or whether the entire file must be fixed first. MVP default: fail validation for critical schema errors; after mapping is valid, allow row-level rejects only when the user explicitly confirms partial import.
- **FR-017 (P0):** Create an import-run record with status (`uploaded`, `validating`, `ready`, `processing`, `completed`, `completed_with_errors`, `failed`, `cancelled`), row counts, errors, timestamps, uploader and source file metadata.
- **FR-018 (P0):** Do not make partially processed rows visible in official dashboard queries. Use a staging/atomic activation design or equivalent transaction-safe approach.
- **FR-019 (P0):** Persist the mapping template so a company can reuse it for files with the same layout.
- **FR-020 (P1):** Provide a downloadable sample CSV/XLSX template for each supported dataset type.
- **FR-021 (P1):** Provide an upload history page with import status, row counts, and ability to inspect error report. Original files should have a retention policy configurable by the host application; do not keep originals indefinitely without a reason.

### 7.3 Supported input schema types

The uploader must require the user to choose one input type, which prevents the system from deriving misleading metrics from ambiguous columns.

#### Type A — Transaction Ledger (MVP)

Canonical fields:

| Field | Required | Type / rule | Notes |
|---|---|---|---|
| `transaction_date` | Yes | ISO date or explicitly mapped parseable date | Preserve source date interpretation and normalize for storage. |
| `amount` | Yes | Decimal, strictly parsed; non-negative by default | Currency amount; do not use binary floating point for persisted monetary values. |
| `direction` | Yes | `income` or `expense` | Must be mapped or confirmed by user. A sign-based source can be mapped only after user confirms the convention. |
| `currency` | Conditional | ISO 4217 code | Required if company doesn't have one unambiguous source currency. |
| `description` | No | Text, length-limited | Avoid exposing unnecessarily in WhatsApp messages. |
| `category` | No | Text or chosen category | Useful for grouping expenses and income. |
| `counterparty` | No | Text | Vendor/customer name if provided. |
| `external_transaction_id` | No | Text | Use as the stable idempotency key when reliable. |
| `reference` | No | Text | Invoice/reference number. |
| `account` | No | Text | Account/source label. |

The system may accept source schemas with separate `debit`/`credit` columns or signed amounts only through an explicit mapping transformation. If both debit and credit are present, reject rows where both are positive unless the user explicitly chooses a supported rule. Keep the original source row reference and mapping version for auditability.

#### Type B — Monthly Financial Summary (MVP)

Canonical fields:

| Field | Required | Type / rule | Notes |
|---|---|---|---|
| `period_start` or `period` | Yes | Date/month period | Normalize to a canonical month or source fiscal period. |
| `revenue` | Conditional | Decimal | At least revenue and expenses are required for a derived operating result. |
| `expenses` | Conditional | Decimal | Must be non-negative unless user confirms otherwise. |
| `net_profit` | Conditional | Decimal, may be negative | If provided directly, label it as source-reported net profit. |
| `currency` | Conditional | ISO 4217 code | Same policy as transaction schema. |
| `business_unit` | No | Text | Optional analytical dimension. |
| `source_note` | No | Text | Optional note about data source. |

Require either (`revenue` and `expenses`) or `net_profit`. If both revenue and expenses exist but net_profit also exists, show reconciliation difference `revenue - expenses` versus reported net_profit when definitions are comparable; do not overwrite reported data. Metrics must indicate whether a value is **source-reported**, **derived**, or **not available**.

### 7.4 Financial calculations and dashboard

- **FR-030 (P0):** Provide a date-range filter and relevant dimension filters such as category, direction, account and business unit when the data supports them.
- **FR-031 (P0):** Transaction Ledger dashboard must show total income, total expenses, net transaction movement (`income - expenses`), transaction count, largest transactions and time trends. Label the net measure as a **transaction-derived net movement / operating cash view**, not audited net profit.
- **FR-032 (P0):** Monthly Financial Summary dashboard must show source-reported revenue, expenses, source-reported net profit where present, derived revenue-minus-expenses where appropriate, margin only when denominator/definition is valid, and period-over-period changes.
- **FR-033 (P0):** Every KPI must have a tooltip or info detail with formula, date range, selected filters, currency and provenance (reported vs derived).
- **FR-034 (P0):** Charts must respect global filters and update consistently; include loading, empty, stale/error and partial-data states.
- **FR-035 (P0):** Show the latest successful import time and the dataset version used for the displayed dashboard.
- **FR-036 (P0):** Drill down from a chart/KPI to the underlying source records where those records exist and the user's role permits access.
- **FR-037 (P0):** Use decimal arithmetic for money calculations; apply consistent currency formatting and configurable rounding for display only.
- **FR-038 (P0):** Avoid dividing by zero. If a prior-period baseline is zero or missing, display “not comparable” rather than an infinite percentage.
- **FR-039 (P0):** Avoid mixing rows from different currencies in one aggregated KPI unless converted under an explicit, documented conversion model. MVP does not need FX conversion.
- **FR-040 (P1):** Provide data export for filtered summaries or alert lists. Exports must be role-protected, audited and safely escaped for spreadsheet formula injection.
- **FR-041 (P1):** Add optional high-level scenario analysis controls (best/expected/worst) for revenue and cost assumptions, keeping scenario values separate from actual uploaded data.
- **FR-042 (P2):** Add forecasting and statistically based anomaly detection after deterministic rules are stable.

### 7.5 Configurable alert rules engine

- **FR-050 (P0):** Store alert rules per company/tenant; never share thresholds across companies by default.
- **FR-051 (P0):** Support the following MVP rule types:
  1. `HIGH_VALUE_TRANSACTION`: transaction amount is greater than or equal to configured amount; optional income/expense direction, category and currency filters.
  2. `PERIOD_LOSS_THRESHOLD`: loss amount for a monthly financial period is greater than or equal to a configured threshold; a loss exists when the applicable net-profit measure is negative. For reported net profit, use source-reported `net_profit`; for transaction ledger, use transaction-derived net movement and label it clearly.
  3. `EXPENSE_SPIKE`: current comparable-period expense total rises by at least a configured percentage versus an explicitly selected baseline (previous comparable period or rolling average). Require a minimum baseline amount; suppress percentage-based comparison when baseline is missing or zero.
  4. `POSSIBLE_DUPLICATE_TRANSACTION`: repeated transaction candidates based on stable ID where available, or a match key such as company + date + amount + direction + normalized counterparty/reference. This is a review signal only.
- **FR-052 (P0):** Use inclusive threshold behavior by default (`>=`); make it clear in UI.
- **FR-053 (P0):** Each rule must include `enabled`, severity, threshold, currency if monetary, filters, optional quiet period/cooldown, notification configuration and created/updated audit metadata.
- **FR-054 (P0):** Evaluate rules after successful activation of a dataset version and only against that version's records/periods.
- **FR-055 (P0):** Store each triggered event with the rule version and dataset/import version so the result can be reproduced.
- **FR-056 (P0):** Ensure deterministic event idempotency. Re-running an identical import/rule evaluation must not create duplicate alert events for the same condition. Define an event fingerprint using company + rule/version + triggering transaction or financial period + relevant dataset version/condition key. Document how corrected data creates an updated or new event.
- **FR-057 (P0):** Alert statuses: `new`, `acknowledged`, `investigating`, `resolved`, `dismissed`. Status transitions must be authorized and audited.
- **FR-058 (P0):** Alert detail includes rule, severity, reason, threshold, observed value, currency, period/transaction reference, source import, timestamps and notification state.
- **FR-059 (P0):** Rules flag potentially important events; they must not assert that fraud has occurred or automatically modify/block the underlying transaction.
- **FR-060 (P0):** Provide configurable notification cooldown/deduplication so repeated evaluations do not spam the same recipient. Cooldown defaults should be conservative and documented.
- **FR-061 (P1):** Allow company admins to run a one-off evaluation of historical data after changing a rule, with a preview/confirmation and separate deduplication policy.
- **FR-062 (P1):** Alert centre supports search, filters by severity/status/rule/date and pagination.

### 7.6 WhatsApp notifications

- **FR-070 (P0):** Define a `NotificationProvider` interface; implement `MockNotificationProvider` for local development/test and a real WhatsApp Cloud API adapter behind feature/config flags.
- **FR-071 (P0):** Never hardcode provider secrets in code or expose them to frontend JavaScript, source maps, logs, or API responses. Read credentials from environment/secret manager.
- **FR-072 (P0):** Record recipient consent/opt-in status, opt-in timestamp/source, company, recipient, enabled alert categories and opt-out timestamp. Do not send proactive messages without valid consent.
- **FR-073 (P0):** Follow WhatsApp Business Platform rules for template messages, customer service windows and messaging policies. For proactively initiated notifications outside an open service window, use an approved template appropriate to the use case. Keep template name/language configurable; do not assume free-form messages will always be allowed.
- **FR-074 (P0):** Store API request correlation ID, provider message ID, send attempt number, status (`queued`, `sending`, `accepted`, `sent`, `delivered`, `read`, `failed`, `suppressed`) and safe failure code/message where available.
- **FR-075 (P0):** Send notifications asynchronously through a queue/background job when the host application supports it. A provider outage must not fail or roll back an import/dashboard refresh.
- **FR-076 (P0):** Add bounded retry with backoff for retryable failures and idempotency/deduplication to prevent duplicate sends. Permanent errors must stop retrying and be visible to the admin.
- **FR-077 (P0):** Handle WhatsApp provider delivery/status webhooks if the integration is enabled, validating the configured webhook verification/authentication mechanism and processing status updates idempotently.
- **FR-078 (P0):** WhatsApp content should be concise and privacy-conscious: company name if appropriate, alert type, amount/period, configured threshold and a secure authenticated dashboard link. Do not include a full transaction description or unnecessary personal/financial details by default.
- **FR-079 (P0):** If the provider is unconfigured, the system can still create alerts and show notifications as “not configured”/“mock only”. It must never report “delivered” unless provider evidence confirms it.
- **FR-080 (P0):** Provide a test-send operation that requires authorization and explicit user action; redact credentials and personal numbers in logs.
- **FR-081 (P1):** Allow administrators to mute selected rule types or severity levels per recipient and define quiet hours.

### 7.7 Auditability and operations

- **FR-090 (P0):** Audit important actions: upload started/confirmed, import completed/failed, mapping created/changed, rule created/changed/disabled, alert status changed, recipient added/removed, WhatsApp test sent, export requested, and relevant permission changes if owned by this feature.
- **FR-091 (P0):** Audit record should include actor, company, action, timestamp, resource ID and limited metadata. Do not store secrets or entire uploaded row contents in audit logs.
- **FR-092 (P0):** Provide structured logs and error responses with correlation IDs; redact authorization headers, API tokens, phone numbers where practical, and raw sensitive financial records.
- **FR-093 (P0):** Expose import job state and safe diagnostic details to authorized users without exposing stack traces or secrets.
- **FR-094 (P1):** Add operational metrics for import duration/row count/failure rate, rule evaluation duration, notification failure/retry counts and queue backlog.

## 8. Proposed UX / page structure

Codex should adapt these flows to the existing design system. Do not create a visually unrelated second application if the host product already has a design system.

1. **Financial Analytics Overview**
   - Company switcher/name and date range.
   - Last updated and dataset version.
   - KPI cards appropriate to available data type.
   - Trend charts, category breakdown, largest transactions.
   - Critical/open alert summary.
   - Upload/refresh action subject to permission.
2. **Upload Data Wizard**
   - Select dataset type, drop/select file, upload progress.
   - Mapping form and format settings.
   - Row preview with validation errors/warnings.
   - Import-mode choice and explicit confirmation.
   - Result report with accepted/rejected rows and import ID.
3. **Transactions / Financial Periods**
   - Filterable, paginated data table.
   - Numeric/currency formatting, sort order and drill-down source details.
4. **Alerts Centre**
   - Summary counts by severity/status.
   - Filterable alert list, alert detail drawer/page, acknowledge/investigate/resolve/dismiss actions.
5. **Alert Rules**
   - Rule type, enabled, threshold, currency, filters, severity, cooldown and a plain-language summary.
6. **Notification Settings**
   - WhatsApp configuration state, recipient/consent settings, template/language, alert categories, test-send control, recent delivery history.
7. **Import History**
   - Import runs, mapping used, data source, status, row counts, validation report and timestamps.

Visual direction: professional financial BI; data-dense but readable; neutral palette with restrained severity colors; accessible contrast; no decorative chart that doesn't represent actual query data. Tables must remain usable at laptop widths. Include skeleton/loading, no-data, partial-import, error and empty-alert states.

## 9. Data and calculation definitions

Codex must implement formulas in a central tested calculation layer, not duplicate them across UI components.

### 9.1 Transaction ledger metrics

For a selected time window, company, currency and filters:

- `total_income = SUM(amount WHERE direction = income)`
- `total_expenses = SUM(amount WHERE direction = expense)`
- `net_transaction_movement = total_income - total_expenses`
- `transaction_count = COUNT(valid imported transaction records)`
- `average_transaction_value = AVG(amount)` for a clearly stated population/filter.
- `expense_share_by_category = category expense total / total expenses`, only if total expenses > 0.

Do not label `net_transaction_movement` as accounting net profit. Ledger data may omit accruals, depreciation, tax, unpaid invoices or non-cash adjustments.

### 9.2 Monthly summary metrics

- `derived_revenue_minus_expenses = revenue - expenses`, only when both values are available and their definitions are comparable.
- `source_reported_net_profit = net_profit`, if provided by source.
- `profit_margin = net_profit / revenue * 100`, only when the selected net-profit definition is available and revenue > 0. Label the numerator/source.
- `period_change = current - prior`.
- `period_change_pct = (current - prior) / ABS(prior) * 100`, only if prior is non-zero and comparable. Otherwise return null with reason `baseline_zero_or_missing`.

### 9.3 Financial data integrity

- Use a decimal/numeric database type or integer minor units with explicit currency precision; do not persist money as binary floating-point.
- Preserve source precision and apply rounding only for presentation unless the currency requires a specified scale.
- Normalize dates using the user's mapping choice and company timezone; keep period semantics for financial summaries.
- Never compare amounts with different currencies as if they were the same currency.
- Store import/mapping lineage so a displayed measure can be traced to source rows/import versions.
- If rows are partially rejected, indicate incompleteness on the dashboard and offer the rejection report.

## 10. Suggested architecture and integration boundary

These are logical boundaries, not a mandate to impose a new framework. Codex must first inspect and then adapt them to existing conventions.

### 10.1 Logical components

- **Feature UI:** overview/dashboard, upload wizard, transactions/periods, alerts, rules, notification settings and import history.
- **Import service:** file validation, parser, mapping, normalization, row validation, staging, idempotent commit, import run status.
- **Financial calculations service:** central formulas for metrics and comparisons.
- **Dashboard query service:** date-filtered aggregations and drill-down queries.
- **Alert rules engine:** evaluate rules against a committed dataset version and emit alert events.
- **Notification service:** queue, provider interface, WhatsApp adapter, retry/deduplication and status reconciliation.
- **Persistence layer:** tenant-scoped entities/migrations using existing database patterns.
- **Integration layer:** route registration, nav item, permissions, background-job registration and environment settings needed by the host app.

### 10.2 Module boundary

Create a feature module/package with its own domain/service/API/UI boundaries. Use existing auth, database session, logging, queue, UI components and design system by dependency injection/adapters rather than copying them. Do not fork or duplicate the host app's auth or database setup.

Suggested logical folder layout (adapt to project; do not blindly create if repo differs):

```text
financial_analytics/
  domain/                 # models, rules, formulas, validation contracts
  services/               # import, calculations, dashboard queries, alerting
  api/                    # routes/controllers/schemas
  persistence/            # repositories and feature migrations, if project pattern supports it
  notifications/          # provider interface, mock provider, WhatsApp adapter
  jobs/                   # imports, rule evaluation, notification delivery
  frontend/               # only if the repo supports isolated frontend modules
  tests/
  docs/
```

If the main repository is a monorepo, use its standard package layout. If frontend and backend are separate repositories, build the feature in the correct existing service boundary and document the dependency contract.

### 10.3 Background processing

- For small uploads, synchronous parsing may be used if it doesn't block the web process beyond the project's established limits; still use import-run status consistently.
- For larger uploads or existing queue infrastructure, enqueue a job and poll/subscribe for status.
- Do not add an entirely new queue technology for MVP if the host project already has an adequate background task mechanism.
- Jobs must be idempotent, retry-safe and observably failed. Do not run duplicate rule evaluations after a retry without event deduplication.

## 11. Suggested API contract

These endpoint names are illustrative. Follow current route naming and versioning conventions. Every endpoint must use the host app's auth and company authorization.

### Imports

- `POST /api/financial-analytics/imports` — upload file plus dataset type, company, import mode and mapping settings; returns `import_id`.
- `GET /api/financial-analytics/imports/{import_id}` — status and row counts.
- `GET /api/financial-analytics/imports/{import_id}/preview` — validation/preview results.
- `POST /api/financial-analytics/imports/{import_id}/confirm` — confirm mapping/import after validation.
- `GET /api/financial-analytics/imports/{import_id}/errors` — validation/rejection report.
- `GET /api/financial-analytics/imports` — paginated history.

### Dashboard and data

- `GET /api/financial-analytics/dashboard` — aggregate KPIs, trends, alert summary and active data version; filters via validated query params.
- `GET /api/financial-analytics/transactions` — paginated transaction query, only when ledger data exists.
- `GET /api/financial-analytics/periods` — paginated financial summary query, only when summary data exists.
- `GET /api/financial-analytics/transactions/{id}` — authorized source-row details.

### Rules and alerts

- `GET /api/financial-analytics/rules`
- `POST /api/financial-analytics/rules`
- `PATCH /api/financial-analytics/rules/{rule_id}`
- `POST /api/financial-analytics/rules/{rule_id}/evaluate` — optional explicit evaluation with safeguards.
- `GET /api/financial-analytics/alerts`
- `GET /api/financial-analytics/alerts/{alert_id}`
- `PATCH /api/financial-analytics/alerts/{alert_id}` — status, note and review metadata.

### Notifications

- `GET /api/financial-analytics/notifications/settings`
- `PATCH /api/financial-analytics/notifications/settings`
- `POST /api/financial-analytics/notifications/test`
- `GET /api/financial-analytics/notifications/deliveries`
- `POST /api/financial-analytics/notifications/whatsapp/webhook` — only if using provider callbacks; implement the provider's required webhook verification and signature/authentication pattern.

### API behavior requirements

- Define request/response schemas and consistent error format in the project's existing style.
- Use pagination for lists and a maximum page size.
- Validate currency codes, date ranges, enums, threshold signs and numeric limits.
- Return `401` when unauthenticated and `403` for unauthorized company access according to host conventions; do not disclose whether inaccessible resource IDs exist if that would leak tenant data.
- Do not return internal stack traces or secrets.
- Add OpenAPI docs if the backend framework already supports it.

## 12. Proposed data model

Codex must adapt to the existing schema and avoid duplicating existing company, user, membership, or audit entities. Names below are conceptual.

### `financial_import_runs`

- `id`, `company_id`, `dataset_type`, `status`, `source_filename`, `source_file_hash`, `mapping_id` or mapping snapshot, `import_mode`, `dataset_version`, `rows_seen`, `rows_valid`, `rows_rejected`, `started_by`, `created_at`, `started_at`, `completed_at`, `failure_code`, `failure_summary`.
- Store a file hash to identify repeated uploads but do not rely on the hash as the sole deduplication mechanism.

### `financial_transactions`

- `id`, `company_id`, `import_run_id`, `dataset_version`, `transaction_date`, `amount_decimal`, `currency`, `direction`, `description`, `category`, `counterparty`, `external_transaction_id`, `reference`, `account`, `source_row_number`, `normalized_match_key`, timestamps.
- Unique constraint strategy must be documented and aligned to the chosen import mode; a nullable external ID alone may not be sufficient for deduplication.

### `financial_period_summaries`

- `id`, `company_id`, `import_run_id`, `dataset_version`, `period_start`, `period_end` or normalized period, `currency`, `revenue_decimal`, `expenses_decimal`, `reported_net_profit_decimal`, `business_unit`, `source_row_number`, timestamps.
- Decide and document whether each period is upserted by `(company_id, period, currency, business_unit)` or versioned alongside all imports. Avoid silent duplicate-period aggregation.

### `financial_column_mappings`

- `id`, `company_id`, `dataset_type`, `name`, `mapping_json`, format settings (date format, decimal/thousands separator, sign convention), created/updated by and timestamps.

### `financial_alert_rules`

- `id`, `company_id`, `rule_type`, `name`, `enabled`, `severity`, `threshold_json`, `filters_json`, `cooldown_seconds` or equivalent, rule version, created_by, updated_by, timestamps.

### `financial_alert_events`

- `id`, `company_id`, `rule_id`, `rule_version`, `dataset_version`, `event_fingerprint`, `severity`, `status`, `title`, `reason`, `observed_value_decimal`, `threshold_value_decimal`, `currency`, `period_reference` or `transaction_reference`, `first_seen_at`, `last_seen_at`, `acknowledged_by`, `resolved_by`, `resolution_note`, timestamps.
- Enforce uniqueness with an appropriate event fingerprint/constraint.

### `financial_notification_recipients`

- `id`, `company_id`, `user_id` or managed recipient, `phone_number_encrypted_or_protected`, `phone_number_last4`, `opt_in_status`, `opt_in_timestamp`, `opt_in_source`, `opt_out_timestamp`, enabled categories/severities, created/updated by and timestamps.
- Do not reveal full phone numbers broadly. If encryption is available in host conventions, use it; otherwise minimize exposure and log only masked values.

### `financial_notification_deliveries`

- `id`, `company_id`, `alert_event_id`, `recipient_id`, `provider`, `provider_message_id`, `status`, `attempt_count`, `idempotency_key`, `last_error_code`, safe `last_error_summary`, `queued_at`, `sent_at`, `delivered_at`, `failed_at`, timestamps.

### `financial_audit_events`

Prefer the existing application audit log if available. If feature-owned, record actor/company/action/resource/time/correlation ID and minimal metadata with access controls and retention policy.

## 13. Security, privacy and compliance requirements

- Treat uploaded files and rows as untrusted input.
- Validate file type, size, workbook sheets and values; defend against ZIP bombs/oversized spreadsheets if applicable to the chosen parser.
- Prevent spreadsheet formula injection in exports by escaping or prefixing risky cell values according to safe CSV/XLSX export practices.
- Prevent CSV formula execution and never execute uploaded formulas/macros. Do not accept macro-enabled files in MVP.
- Use parameterized queries/ORM; validate sort/filter fields against an allowlist.
- Enforce tenant scoping at repository/service boundaries and test cross-tenant access attempts for every resource type.
- Keep secrets in server-side environment/secret-management configuration; provide a `.env.example` with placeholders only.
- Redact phone numbers, tokens, raw financial data and file content from logs/errors wherever practical.
- Apply the host application's CSRF, CORS, session, rate limit and authentication policies.
- Protect file upload and export endpoints against unauthorized access and excessive resource use.
- Add reasonable request size limits, pagination, timeouts and import row limits.
- Use a retention/deletion policy for source files, staging data, imported records and notification history. Honor the host application's legal and account deletion workflows where relevant.
- WhatsApp: collect explicit recipient opt-in, provide a way to disable/opt out, use approved templates where required, and keep delivery state/retries auditable. Review and comply with current official platform rules before release.
- Financial confidentiality: notifications should reveal the minimum needed; default message should not include full account numbers, sensitive descriptions, or personally identifying data from transaction rows.
- Do not state that a message was delivered based solely on an accepted API request; reconcile provider status when available.

## 14. WhatsApp message specification

Use a short notification that works with an approved provider template. Keep template name, locale, and parameter mapping configurable.

Example conceptual content:

> Financial alert for {{company_name}}: {{alert_type}} detected. Observed value: {{observed_value}} {{currency}}. Threshold: {{threshold}} {{currency}}. Period/transaction: {{reference}}. Review securely: {{dashboard_link}}

The exact final wording and category must align with the currently approved WhatsApp template and policy classification. Avoid marketing content. Do not include sensitive transaction descriptions unless the company explicitly configures and accepts the exposure risk.

Delivery flow:

1. Alert event is committed.
2. Notification job is created transactionally or via a transactional outbox pattern where available.
3. Worker checks recipient consent, enabled rule/severity, cooldown and configuration.
4. Worker sends using configured provider/template.
5. Delivery attempt and provider identifiers are stored.
6. Retries occur only for retryable errors, with bounded exponential backoff and idempotency protection.
7. Provider webhook updates delivery status idempotently.
8. UI shows actual provider status, or `unknown/pending` if no confirmation is available.

## 15. Failure modes and expected behavior

| Failure | Expected behavior |
|---|---|
| Unsupported file / corrupt workbook | Reject before processing and explain accepted types. |
| Missing required columns | Return to mapping step; do not create financial records. |
| Some malformed rows | Show row-level errors; partial import only after explicit user confirmation. |
| Database failure during activation | No partially activated dataset; import marked failed/retryable as appropriate. |
| Dashboard query failure | Show existing last-known state only if labelled stale; never imply it includes the latest import. |
| Alert rule evaluation failure | Preserve successful import; mark evaluation job failed and surface a retry/diagnostic state. |
| WhatsApp credentials missing | Store alerts locally and mark notifications unconfigured/mock-only. |
| WhatsApp API outage | Keep alert and delivery attempt; retry safely; do not roll back imports. |
| Invalid phone number/no consent/template unavailable | Suppress send with a visible reason; do not retry indefinitely. |
| Duplicate webhook callback | Idempotently update the same delivery record. |
| Unauthorized cross-company access | Deny access and add a security test. |
| Alert threshold changed | Version the rule; don't rewrite historical alert rationale. |

## 16. Non-functional requirements

- **Correctness:** KPI formulas and thresholds are centrally implemented and unit-tested.
- **Security:** Tenant isolation, permission checks, secure secret handling and safe import/export are release blockers.
- **Reliability:** Import success is independent from WhatsApp availability. Retriable jobs are idempotent.
- **Performance:** Use server-side aggregation/pagination; do not return entire datasets to the browser. Measure against the proposed 50,000-row target.
- **Maintainability:** Keep parsing, normalization, calculation, rule evaluation, persistence and notification concerns separate.
- **Observability:** Each upload/import/job/alert/delivery has a correlation or resource ID for support.
- **Accessibility:** Keyboard-accessible forms/tables, labels for controls, proper color contrast, and severity not represented by color alone.
- **Compatibility:** Follow the existing application's runtime/framework/dependency policies. Avoid adding overlapping charting/auth/queue libraries without justification.
- **Localization:** Store currency and timezone explicitly; centralize currency/date formatting so locale can change.

## 17. Test strategy

### 17.1 Unit tests

- Decimal calculations and currency rounding/display.
- Date parsing and timezone boundaries.
- Signed amounts, debit/credit mapping and invalid number formats.
- Monthly aggregation and period comparison.
- Profit/loss boundary conditions: threshold exactly equals observed loss; positive result; zero; missing baseline.
- Expense spike with zero/missing/negative baseline and minimum-baseline requirement.
- High-value transaction at just below, equal to and above threshold.
- Duplicate matching with stable ID and without ID; avoid overclaiming definite duplicates.
- Event fingerprint/idempotency under repeated evaluation.
- Notification cooldown and retryability classifications.

### 17.2 Integration tests

- CSV/XLSX import for both supported schema types.
- Mapping persistence and reuse.
- Partial rejection and import status/counts.
- Active dataset version switches atomically only after successful commit.
- Dashboard API reflects committed version and correct filters.
- Rule evaluation creates expected alert events and does not duplicate them on retries.
- Mock provider records a notification attempt; provider failure doesn't fail import.
- Webhook signature/verification and idempotent status updates, if enabled.
- Role and company scoping for imports, transactions, rules, alerts, phone recipients, export and notification deliveries.

### 17.3 UI tests

- Upload and mapping wizard happy path and validation path.
- Dashboard loading, no-data, partial-import and stale states.
- Rule editor boundary feedback and confirmation.
- Alert acknowledgement/resolution and audit note.
- WhatsApp unconfigured state, test-send confirmation and failed-delivery display.

### 17.4 End-to-end acceptance scenarios

1. Upload a valid ledger with income and expense rows. Dashboard totals match a manually calculated fixture.
2. Upload a summary where reported net profit is negative and its loss magnitude equals the configured threshold. Exactly one period-loss alert is created.
3. Upload a transaction exactly at the high-value threshold. It is flagged because the boundary is inclusive.
4. Retry processing the same upload/job. Transaction records and alert events are not duplicated.
5. Disable WhatsApp configuration. Alert appears in the dashboard; UI says delivery is not configured and claims no message was sent.
6. Configure the mock provider. An eligible opted-in recipient receives a mock delivery record with clear mock status.
7. Trigger a provider failure. Data import remains successful, delivery failure is visible, and a retry can recover without duplicate sends.
8. Attempt to read another company's import/alert/transaction by ID. Request is denied.
9. Change a filter and verify that KPI cards and charts use the same filter context.
10. Upload a financial summary with currencies mixed or missing. The system blocks ambiguous aggregation and asks for correction/segregation.

## 18. Implementation phases and definition of done

### Phase 0 — Repository reconnaissance (mandatory)

Before changing code, Codex must:

1. Inspect repository structure, README, package/lock files, environment settings, entry points, routes, models/migrations, auth/tenant model, background jobs, frontend routing/components, tests, CI and deployment config.
2. Identify existing reusable services: company/tenant records, user roles, database, file storage, chart libraries, logging, queue, secrets and navigation.
3. Write a short `docs/financial-analytics-integration-plan.md` describing proposed files, dependencies, migrations, routes, tests, assumptions and integration strategy.
4. State any missing assumptions or decisions. Continue with sensible defaults when safe; don't ask unnecessary questions if repository evidence can answer them.
5. Do not make broad unrelated refactors or overwrite existing project files.

### Phase 1 — Isolated domain and backend

- Implement canonical schemas, validation, import-run state machine, mapping, staged/atomic persistence and import history.
- Implement decimal-based calculations and dashboard aggregation APIs.
- Implement tenant-scoped repositories and authorization.
- Add migrations via the host project's migration tool.
- Add unit and integration tests before UI integration.

### Phase 2 — Rules and alerts

- Implement the four P0 rules, rule versions, event fingerprints, alert statuses and audit trail.
- Add alert list/detail/update APIs and tests for boundaries/idempotency.

### Phase 3 — UI

- Implement pages and flows using existing routing/design system.
- Add empty/error/loading states and role-based controls.
- Wire chart data to actual API responses; do not use fabricated production metrics or placeholder rows.

### Phase 4 — Notifications

- Implement provider interface and mock provider first.
- Implement WhatsApp Cloud API adapter behind explicit feature flag and server-side configuration.
- Add recipient consent, template config, async retry, status persistence and webhook verification if applicable.
- Do not require live WhatsApp credentials for CI; test with mock provider.

### Phase 5 — Integration and review

- Integrate navigation and API route registration with minimal changes.
- Verify migrations and dependency locking.
- Run formatting/lint/type checks, unit tests, integration tests and existing project tests.
- Provide a file-by-file summary and commands to run locally.
- Document environment variables, sample data, setup for mock mode, real WhatsApp setup, security considerations and known limitations.
- If Git is available, work on a dedicated feature branch or isolated worktree; do not merge to the default branch automatically unless explicitly requested by the user.

### Definition of done

The feature is done when all P0 requirements are implemented; all P0 tests pass; the UI uses real backend data; no secrets are committed; data is tenant-scoped; a mocked end-to-end alert flow works without external credentials; the optional WhatsApp adapter is isolated/configurable; documentation exists; and the integration diff is small, reviewable and does not break existing tests.

## 19. Environment configuration

Codex must adapt variable naming to project conventions. Provide `.env.example` placeholders only, never real values. Likely configuration categories:

- `FINANCIAL_ANALYTICS_ENABLED`
- `FINANCIAL_ANALYTICS_MAX_UPLOAD_MB`
- `FINANCIAL_ANALYTICS_MAX_ROWS`
- `FINANCIAL_ANALYTICS_DEFAULT_CURRENCY=INR`
- `FINANCIAL_ANALYTICS_NOTIFICATION_PROVIDER=mock|whatsapp_cloud`
- `WHATSAPP_CLOUD_API_VERSION`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_BUSINESS_ACCOUNT_ID` (only if needed by the implemented workflows)
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
- `WHATSAPP_APP_SECRET` (only if required to verify provider webhook signatures)
- `WHATSAPP_TEMPLATE_NAME`
- `WHATSAPP_TEMPLATE_LANGUAGE`

Do not require every variable in local/mock mode. Fail safely with a clear readiness status if a required real-provider setting is absent. Never return raw values through a frontend configuration endpoint.

## 20. Demo fixtures

Provide synthetic sample data only. Clearly label it as demo data. Do not use real personal, bank, or customer information in test fixtures.

Suggested files:

- `sample_transactions.csv`: 100–500 rows over several months with income, expenses, categories, currencies (prefer one currency per fixture unless testing mixed-currency safeguards), a high-value transaction, a potential duplicate candidate and an expense-spike period.
- `sample_monthly_financials.csv`: 12–24 monthly periods with revenue, expenses and some source-reported negative net-profit periods.
- `sample_invalid_transactions.csv`: invalid dates, missing directions, malformed amounts, duplicate IDs and blank required values.

Expected output calculations for the primary fixture must be documented so tests do not validate code against itself.

## 21. Open implementation decisions Codex must resolve from repository evidence

Codex must record its decision and rationale for each item in the integration plan:

1. Existing company/tenant model to reuse.
2. Existing auth/role conventions and permission names.
3. Database engine and migration tooling.
4. Frontend framework, route registration and chart library.
5. Existing queue/background-job mechanism, if any.
6. How uploaded source files are stored and retained.
7. Whether to version all financial rows or use append/upsert semantics; how to avoid double counting.
8. How main dashboard caches are invalidated after the dataset version changes.
9. Whether WhatsApp provider support can be enabled in the target deployment and who supplies Meta credentials/templates.
10. How financial analytics is enabled/disabled for a tenant and via feature flags.

If the codebase lacks a capability, prefer a small, well-scoped abstraction over adding a new infrastructure dependency without need.

## 22. Codex execution instructions (copy into the implementation task)

> Implement this PRD as a standalone, modular Financial Analyst BI feature that can later be merged into the existing main project.
>
> Start with repository reconnaissance. Read the existing README, architecture, package/lock files, auth, database models/migrations, route structure, UI conventions, tests and deployment configuration. Do not assume a stack based on this PRD. Reuse existing auth, tenants, data access, design system, queue and logging where suitable. Create `docs/financial-analytics-integration-plan.md` before substantive changes.
>
> Build in a dedicated feature branch/worktree or isolated module if available. Keep changes scoped. Do not modify unrelated features, rewrite the authentication system, replace the chart library, add a second application shell, or introduce infrastructure dependencies unless the repository requires it and the integration plan explains why. Do not merge into the default branch automatically.
>
> Implement MVP requirements in this document: CSV/XLSX ingestion and column mapping; validation and import history; transaction-ledger and monthly-summary schemas; correct and clearly labelled KPIs; interactive dashboard; configurable high-value, period-loss, expense-spike and possible-duplicate rules; reviewable alert centre; idempotent event processing; mock notification provider; and an optional WhatsApp Cloud API adapter behind server-side configuration and explicit consent/template requirements.
>
> Financial calculations must use decimal-safe money handling and central tested formulas. Do not call transaction-ledger net movement “audited net profit.” Never aggregate multiple currencies without an explicit conversion policy. Never declare fraud automatically. Every tenant-owned resource and export must be company-scoped and permission-checked.
>
> Use real API responses in the UI; demo fixtures must be clearly labeled. Do not claim messages were sent/delivered in mock or unconfigured mode. Provider failure must not roll back a successful import. Keep secrets out of source control, logs and frontend bundles.
>
> Add migrations, unit/integration/UI tests following the repository's conventions, and synthetic fixtures with expected results. Run the relevant checks and existing tests. Fix regressions introduced by this feature. If a check cannot run, report the exact blocker rather than claiming it passed.
>
> Before finishing, provide: (1) the implemented feature summary; (2) changed/new files; (3) migration and environment setup steps; (4) commands to run/test; (5) test results; (6) how to run in mock notification mode; (7) steps and prerequisites for enabling WhatsApp; (8) remaining limitations; and (9) an integration/merge checklist. Do not commit credentials or automatically merge the feature.

## 23. Release checklist

- [ ] Feature module isolated and integration plan committed to the working branch.
- [ ] Upload supports CSV and XLSX and reports mapping/validation errors clearly.
- [ ] Both ledger and monthly summary input types are supported.
- [ ] Dashboard formulas and provenance labels match the input type.
- [ ] No invalid cross-currency totals.
- [ ] Rule boundary and repeat-processing tests pass.
- [ ] Alert status transitions and audit events work.
- [ ] Notification mock mode works without secrets.
- [ ] WhatsApp path is gated by configuration, consent and template requirements.
- [ ] Tenant isolation and permission tests pass.
- [ ] Import activation is atomic or demonstrably prevents partial results from being presented as complete.
- [ ] Existing project tests/lint/type checks pass, or blockers are documented exactly.
- [ ] Documentation, `.env.example`, and synthetic sample data are included.
- [ ] Feature is not merged to the default branch without explicit approval.

## 24. External integration references

Check current official documentation and terms immediately before enabling a real WhatsApp integration; provider API versions and platform rules can change.

- Meta WhatsApp Business Platform / Cloud API documentation entry point: https://developers.facebook.com/docs/whatsapp/cloud-api/overview
- Meta-hosted WhatsApp Business Platform API collection, including webhook examples: https://www.postman.com/meta/whatsapp-business-platform/overview
- Meta WhatsApp Cloud API documentation collection: https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api
- WhatsApp messaging policy concepts, templates and customer-service windows overview: https://www.twilio.com/docs/whatsapp/key-concepts

These references are implementation starting points, not a substitute for checking the current Meta account setup, template approval status, message category and consent requirements at deployment time.
