# Analyst Watch: simulated provider updates and real WhatsApp delivery

> **Current configured demo: Trial delivery demo.** The new-console predefined sample request is configured separately from custom financial messaging. WhatsApp sends the permitted sample template; the financial alert details remain in Veritas. No legacy Sandbox is required for this mode. See [the current setup and judge walkthrough](analyst-watch-trial-demo.md). Research automation remains paused.

This increment is a local, single-process presentation demo. It is **not live financial-data monitoring**. No live feed, web-retrieval automation, scheduler, LLM, Redis or Celery is required. Existing Microsoft/Spirit cases, facts, receipts, approved reports, manual research and Insights are not edited by this feature.

## Two interfaces

- Analyst workspace: `http://localhost:3000/analyst-watch`. Watchlist membership, monitoring pause/resume, configurable rules, read-only KPIs/chart, saved alert investigation, acknowledgement and notification settings/history. There are no financial-editing or scenario-publishing controls here.
- Presenter console: `http://localhost:3000/analyst-watch/demo-console`. This separate demo provider publishes predefined snapshots through the backend ingestion path. Publishing works with the analyst workspace closed. Publishing an event while watch monitoring and real delivery are enabled authorizes the resulting consolidated alert message. A new event ID distinguishes each intentional replay; a failed browser request can be retried with the same ID.

Both pages permanently label **Simulated financial data / real notification delivery**. Custom financial-mode messages contain DEMO. Trial delivery demo sends the unmodified permitted Twilio sample; both interfaces explicitly disclose that it carries no financial alert details. The only company is **Aster Technologies — Demo**; its watch can be added/removed and monitored/paused. An optional user action creates an isolated Research Lab case for demo notes; nothing creates or changes a real-company case.

## Setup

Keep private values in `backend/.env`; the names and blank examples are in `backend/.env.example`:

- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`.
- `TWILIO_WHATSAPP_FROM`; existing `TWILIO_WHATSAPP_NUMBER` is supported as the sender alias when FROM is blank.
- `TWILIO_WHATSAPP_TO`: a single server-configured E.164 WhatsApp recipient. This is the allowlist; API bodies cannot supply another number or arbitrary message text. UI responses mask the destination and do not expose the account SID/token or full sender/recipient.
- Optional `TWILIO_CONTENT_SID` for a relevant approved financial DEMO template.
- Optional `PUBLIC_APP_URL`: HTTPS public base URL. Obvious local/private/credential-bearing URLs are rejected; otherwise messages include the alert ID without a link. The operator must supply a genuinely public hostname.

Start the existing backend with `uv run python main.py` and frontend with `npm run dev`. No dependency additions are needed. Watch data is in `analyst_watch.sqlite3` within the existing configured research directory, separate from `research.sqlite3`. Default state: watch present, monitoring enabled, **WhatsApp disabled**. Merely opening a page, enabling notifications, restarting the app or loading credentials does not manufacture a new send intent. Previously authorized pending intents can resume; sending intents interrupted by restart become UNKNOWN and cannot be automatically resent.

On the analyst page, click **Check account & session (no send)** to inspect the real account. Configuration presence alone does not establish delivery eligibility. Click **Send test notification** only when you intentionally want a real preflight message. Development and automated tests must not invoke a real send.

## Twilio restrictions and the checked account

The read-only account inspection during this implementation returned an **active Trial account**. Subsequent user-authorized real test attempts were rejected by Twilio with 21654 (ContentSid Required), including an attempt after a recent inbound message was verified. No real delivery has been confirmed. The adapter now verifies the recent inbound reply window for custom bodies regardless of account type; Trial status alone no longer blocks an attempt. Twilio still enforces its account/content restrictions when a message is submitted. The account check does not identify every Console entitlement or prove sandbox membership.

Official references checked on 25 October 2026:

- [Trial account restrictions](https://www.twilio.com/docs/usage/trials) and [Try out WhatsApp](https://www.twilio.com/docs/usage/trials/try-out-whatsapp): current trial flows restrict custom content and use provided templates. A financial alert must not be disguised as an appointment, verification or other unrelated template. Upgrade through Twilio yourself if required; this implementation does not change billing or buy services.
- [Legacy WhatsApp Sandbox](https://www.twilio.com/docs/whatsapp/sandbox): the recipient must join the particular account’s sandbox using its join code. The shared sender alone does not establish membership. The current Console trial flow and legacy Sandbox differ.
- [WhatsApp customer-service window](https://www.twilio.com/docs/whatsapp/key-concepts): free-form replies generally require a recent inbound user message within 24 hours. Outside that window use an eligible approved template. The adapter checks up to 20 matching recent inbound Message resources before allowing a custom Body. It does not claim that a local checkbox verifies the window or guarantees delivery.
- An eligible legacy Sandbox may permit custom replies. The earlier `TWILIO_LEGACY_SANDBOX_BODY` setting is accepted for compatibility but no longer controls a Trial-account gate. Active account and recent matching inbound message checks apply to every custom-body attempt; Twilio can still reject it based on content/account eligibility.
- [Send Content templates](https://www.twilio.com/docs/content/send-templates-created-with-the-content-template-builder): template requests use ContentSid/ContentVariables and never Body. For this small slice, use an approved `twilio/text` financial DEMO template with literal `DEMO` and `Analyst Watch` plus **exactly** `{{1}}` (company), `{{2}}` (saved financial summary) and `{{3}}` (alert/test reference). Example wording: `DEMO Analyst Watch: {{1}}. {{2}}. Reference {{3}}.` The adapter fetches the content and checks WhatsApp approval before sending. It rejects unrelated provided templates. Approval and account eligibility remain provider-controlled.
- [Message resource status definitions](https://www.twilio.com/docs/messaging/api/message-resource): API acceptance/queued is displayed as PROVIDER-ACCEPTED, not delivered. SENT, DELIVERED and READ are saved only from corresponding provider states. Read receipts depend on recipient settings.

No status callbacks are implemented, so no public webhook or signature configuration is needed. The backend polls up to two accepted/sent messages per cycle, no more often than every 15 seconds per message and for at most six hours after creation. The analyst can also explicitly inspect a Message resource. This is notification-status polling, not financial-data polling.

## Financial definitions

Baseline Q1 2025 (1 January–31 March): revenue USD 100m, net income USD 12m, quarter-end current assets USD 160m/current liabilities USD 100m. Earnings-shock Q2 (1 April–30 June): revenue USD 75m, net income USD −3m, quarter-end current assets USD 95m/current liabilities USD 100m. Monetary inputs are USD millions, consolidated fictional demo basis. Stock measures are balances at the reporting-period end; revenue/income cover the full quarter. `observed_at` records ingestion time and is distinct from both reporting dates.

Each published scenario is an alternative Q2 snapshot compared with the active Q1 baseline, not a claim that a new real quarter has elapsed. The stored baseline and current snapshots, rule settings, exact inputs/formulas and results accompany every alert. Replaying alternatives does not compare Q2 against another Q2 as if it were quarter-on-quarter growth.

Decimal calculations reuse the existing Research Lab `revenue_growth`, `net_profit_margin` and `current_ratio` functions:

| Measure | Previous | Current | Change |
|---|---:|---:|---:|
| Revenue, USD m | 100 | 75 | −25% |
| Net income, USD m | 12 | −3 | −15m; positive-to-negative transition |
| Net margin | 12% | −4% | −16 **percentage points**, not −16% relative growth |
| Current ratio | 1.60 | 0.95 | −0.65; crosses below 1.00 |

Default monitoring rules: revenue declines at least 15%; positive profit becomes negative; margin falls at least 5 pp; current ratio crosses from at/above 1.00 to below it. These are user-configured preferences, not universal financial health/default-probability ratings. Zero/missing denominators produce unavailable results with explicit reasons. Compatibility checks reject mismatched company, basis, currency, scale or period type and require adjacent full calendar quarters. The UI formats server receipts and never evaluates alert thresholds on rerender.

Additional predefined scenarios: positive results, liquidity deterioration and a stable quarter. Positive/stable updates produce no default adverse alert; liquidity deterioration produces the ratio-crossing alert. Reset publishes a new baseline snapshot and updates the active pointer. It never deletes history, evaluates an alert or creates a new notification intent; prior intents retain their own history.

## Backend flow and delivery guarantees

`DemoProvider.snapshot → WatchStore.ingest → compatibility validation → snapshot persistence → Decimal calculations → rules → consolidated alert → notification outbox → WatchWorker → Twilio REST`

The ingestion service is the provider boundary. A future real provider would adapt its own validated input into the service; no unused network-retrieval machinery is built here. The HTTP demo console accepts only predefined scenario IDs and bounded idempotency keys, never arbitrary financial edits.

Snapshot, event, alert and notification intent are created in one SQLite transaction with event uniqueness and event/recipient notification uniqueness. Repeated requests with the same event ID return the original receipt; the same ID with different financial content is rejected. Four shock breaches produce one consolidated alert/message. Subsequent similar events preserve separate publication evidence but suppress duplicate delivery for 60 seconds. The presenter can deliberately request a new replay to bypass that cooldown; a global 30-second notification interval and 20-intent daily limit still apply. Explicit retries of known failures are limited to three attempts. Pausing/removing the watch or disabling delivery prevents future dispatch and cancels unclaimed alert intents while preserving their history. Monitoring and notification enablement do not retroactively send old alerts.

The worker claims an intent as SENDING before contacting Twilio. Network timeouts, server errors or responses without a reliable Message SID become UNKNOWN; no blind resend occurs. Pending, sending, provider-accepted, sent, delivered, read, failed and unknown are distinct persisted states. Exact Body or ContentVariables, provider Message SID, safe error code/message, attempts, timestamps and history are retained. Raw provider errors, tokens and phone addresses are not logged or returned.

For UNKNOWN without a SID, inspect Twilio Console, obtain the matching Message SID, and use the reconciliation input. The adapter verifies sender, recipient and exact message body against the saved intent before associating it. Do not create another event to work around uncertainty. Only a known failed send without a Message SID can be explicitly retried. This design reduces duplicates but does **not** promise exactly-once external delivery.

The local service is single-user, single-process and unauthenticated, like the existing prototype. The new mutation paths reject foreign browser origins and bodies over 16 KiB. To use a different local presentation origin, configure an exact `ANALYST_WATCH_ALLOWED_ORIGINS` entry. This is not a production authentication or tenancy system.

## Judge-facing walkthrough

For the currently configured **Trial delivery demo**, follow [the mode-specific walkthrough](analyst-watch-trial-demo.md#presentation-walkthrough). The analyst dashboard and presenter console show the explicit sample-template disclosure. Publish a simulated earnings shock, inspect its genuine financial alert in Veritas, and inspect the separately tracked WhatsApp sample-template delivery state. The user triggers any real sample test from the UI.

Custom financial-message mode remains available through `TWILIO_NOTIFICATION_MODE=financial_alert`. Its sender/session/template requirements are documented above. The application never silently substitutes a sample template after a failed custom financial send.

## Validation recorded

- Offline backend: **122 tests passed**, including 16 Analyst Watch tests. Provider requests are mocked in the watch tests. Coverage includes exact shock receipts and all four breaches; positive/stable/liquidity behavior; missing/zero/incompatible inputs; concurrent event idempotency; cooldown/replay/rate limits; reset history; disabled/paused/removed watches; immutable alert evidence and acknowledgement; known/uncertain failures; restart recovery; provider acceptance versus delivery; Trial/custom/template checks; matched message reconciliation; safe public URLs/response redaction; write-origin/body limits; and backend dispatch without a dashboard GET or LLM.
- Existing frontend regression: **19 tests passed**. TypeScript and targeted Analyst Watch lint passed. `git diff --check` passed.
- Live read-only checks: backend watch API returned the seeded fictional baseline, enabled monitoring, disabled real delivery, no alerts and an empty outbox. Both page routes returned HTTP 200. The read-only account check returned active Trial. The later revised adapter verifies inbound windows without a blanket Trial block; a real request with a verified window was rejected with provider code 21654.
- **No real notification was sent, and no actual delivery is claimed.** Provider-accepted/delivered states in automated tests came from mocks only.
- Browser interaction/visual verification could not run: the computer-use tool reported no connected browsers and a client/server version mismatch. HTTP route checks do not prove interactive rendering. Existing production-build failures in unrelated routes were not changed by this increment.

### Local configuration reload fix

Analyst Watch re-reads `backend/.env` on configuration access. Local file values take precedence over startup-cached environment values, matching this project's editable local-demo workflow. Explicit blanks clear cached values. Process environment remains the fallback for keys not present in the local file. This prevents old credentials or a destination loaded by another service from shadowing edits. A regression test covers changing recipients without a restart, sender alias selection and clearing a template. The targeted watch suite passes 17 tests after this fix. Existing failed outbox entries retain their original intent/error history; configuration changes do not resend or retarget them.


### Trial gate removal and real attempt

At the user’s explicit request, the blanket Trial-account pre-send rejection was removed. Template validation, active-account checks, verified 24-hour inbound reply window, destination binding, outbox persistence, deduplication and uncertain-outcome safeguards remain. A recent inbound message was verified, and one real custom-body test was submitted through the revised adapter. Twilio rejected it with **21654: ContentSid Required**, with no Message SID. The failure was saved in the outbox; no delivery is claimed and no automatic resend was made. Safe error mapping now explains this provider rejection. All 17 targeted watch tests passed, including Trial accounts with verified versus absent reply windows.
