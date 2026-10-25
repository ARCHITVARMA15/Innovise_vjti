# Codex Task: Build Financial Analyst BI as an Isolated Feature

Use the attached `FINANCIAL_ANALYST_BI_PRD.md` as the product and acceptance specification. Implement it as a modular feature that can be reviewed and merged into the main application later.

## Required approach

1. **Inspect before coding.** Read the repository README, architecture, package/lock files, application entry points, authentication and company/tenant model, database/migrations, route registration, frontend design system, job/queue infrastructure, tests, CI and deployment settings.
2. **Write the integration plan first.** Create `docs/financial-analytics-integration-plan.md` describing existing capabilities to reuse, proposed module boundary, files, migrations, API routes, dependencies, test plan, assumptions and how the feature will be integrated. Then implement unless a genuinely blocking decision requires clarification.
3. **Keep the work isolated.** Use a feature branch/worktree or a clearly separated module. Do not rewrite auth, replace existing frameworks, refactor unrelated code, commit credentials, or merge into the default branch automatically.
4. **Implement the P0 scope in the PRD:** CSV/XLSX upload, mapping/validation, import history and safe activation; transaction-ledger and monthly-summary datasets; correct, provenance-labelled KPIs and charts; company-scoped filtering; configurable high-value, period-loss, expense-spike and possible-duplicate rules; alert review/status history; idempotency; a mock notification provider; and an optional WhatsApp Cloud API adapter protected by server-side configuration, recipient consent and template requirements.
5. **Preserve financial correctness.** Use decimal-safe money calculations and centralized formulas. Label transaction-derived net movement as such—not audited net profit. Do not aggregate currencies without an explicit conversion policy. Alert for review; do not assert fraud or alter source transactions.
6. **Secure every layer.** Reuse host authentication and tenancy. Check company authorization on each API/resource/export. Validate uploads and all filters. Keep secrets out of source, logs and frontend. Use synthetic examples only.
7. **Make failures recoverable.** Imports must not display partial data as complete. WhatsApp failures must not roll back imports. Jobs, alert creation and delivery retries must be idempotent. In mock/unconfigured mode, never claim a real message was sent or delivered.
8. **Test and document.** Add migrations, unit/integration/UI tests, synthetic fixtures with independently calculated expected results, `.env.example` placeholders and setup instructions. Run the feature tests and existing project checks; fix regressions introduced by this feature. Report anything that could not be run exactly.

## Completion response

Before stopping, report:

- summary of what was implemented and how the module is isolated;
- new/changed files and migrations;
- local run and test commands plus actual test results;
- how to run the feature in mock notification mode;
- exact configuration and account prerequisites for enabling real WhatsApp notifications;
- security and tenant-isolation checks completed;
- known limitations and any unimplemented PRD requirements;
- a short integration/merge checklist.

Do not mark an unrun test as passing. Do not merge the feature into the default branch unless explicitly asked.
