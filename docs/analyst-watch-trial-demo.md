# Analyst Watch — new-console Trial delivery demo

This mode demonstrates **financial detection in Veritas plus real delivery of a permitted Twilio sample template**. The sample is not the financial alert text. Both interfaces and every trial outbox record display:

> WhatsApp trial sends a sample template; financial alert details are available in Veritas.

## Configuration

The current backend `.env` has been configured from the user's supplied Console request. Existing account credentials were retained; credentials are never printed, returned in APIs or placed in browser code. The configured sender/recipient match that supplied request. All destinations remain server-configured and masked in the UI.

```dotenv
TWILIO_NOTIFICATION_MODE=trial_delivery_demo
TWILIO_TRIAL_CONTENT_SID=<the HX identifier from the successful Console request>
TWILIO_TRIAL_CONTENT_VARIABLES={}
```

The provided request specifies **no variables**. `{}` therefore causes the adapter to omit `ContentVariables`, producing only `To`, `From` and `ContentSid` in the URL-encoded message payload. Account SID/Auth Token are read from the existing backend `.env` for server-side Basic authentication. No `Body`, financial values, dashboard link or event reference is added to the trial template. If a different permitted Console request explicitly expects variables, configure its exact static string values as JSON. These are never populated from the financial analysis.

This mode does not require a legacy Sandbox, a 24-hour custom-reply window, Content API access or creation of a custom financial template. A read-only preflight checks account status and local request readiness; Twilio remains authoritative about the assigned sender, verified recipient, permitted template and actual delivery. A preflight pass is not a delivery claim.

## Presentation walkthrough

1. Open `http://localhost:3000/analyst-watch`. Confirm the **Trial delivery demo** notice, masked recipient and monitoring rules.
2. Enable WhatsApp delivery if desired. This alone creates no send intent.
3. Optionally click **Check account & session (no send)**. To deliberately send the configured sample, click **Send test sample template** yourself. Opening a page or checking configuration does not send.
4. Open `http://localhost:3000/analyst-watch/demo-console`, optionally closing the analyst dashboard. Publish **Earnings shock**. The backend stores the simulated snapshot and genuine rule breaches. With the watch and delivery enabled, it queues one sample-template notification linked to the consolidated financial alert.
5. Return to Analyst Watch. Inspect the changed KPIs, exact receipts and financial alert. Revenue/margin/liquidity details are retained here, not inserted into the WhatsApp sample. Use **Select linked financial alert** from its outbox entry to investigate it.
6. Inspect the actual provider state: pending → sending → provider-accepted → sent → delivered/read when reported by Twilio. A Message SID or API acceptance does not establish delivery. Failures and safe provider codes remain visible. The provider-rendered sample text is displayed only if returned by a real provider response.
7. Acknowledge the financial alert separately. Reset from the presenter console restores baseline values and preserves history without creating another message.

The existing 60-second duplicate cooldown, deliberate replay control, 30-second notification interval, 20-intent daily bound, event uniqueness and recipient restrictions apply unchanged. Old financial-mode failures are historical and cannot be retargeted into trial-template sends. Use the current test action to create a new explicit intent.

If a trial send times out without a known Message SID, its state is UNKNOWN. A fixed sample contains no unique event reference, so the app refuses to guess an association with another Message SID or automatically resend. Inspect the provider Console. For a SID returned by message creation, polling and explicit reconciliation use that exact immutable SID plus saved sender/recipient references; they do not require Content API access.

## Custom financial-message mode is separate

Set `TWILIO_NOTIFICATION_MODE=financial_alert` to retain the original mode. It sends the actual deterministic financial summary via custom Body when the sender/account permits custom replies, or a relevant approved financial DEMO template using `TWILIO_CONTENT_SID` and financial variables. It never silently falls back to the trial sample. Trial variables and the trial ContentSid are independent of the financial-template configuration.

The user's later request for one custom message was handled as an explicit one-off attempt, leaving the configured trial-demo mode and dashboard figures unchanged. The attempt contained only custom Body, described a calculated simulated earnings-shock preview, used no ContentSid and had no fallback. Twilio returned **21654 — ContentSid Required**, with no Message SID. The failure and calculation context are saved in the outbox. No delivery is claimed. Exact custom alert text still requires a sender/account that permits custom messages in a verified reply window, or an eligible approved financial template and sender setup. The trial sample mode demonstrates delivery only and cannot lift that restriction.

## Validation

- 24 watch tests passed using mocked provider calls. New coverage verifies the exact no-variable trial request; ContentSid without Body; optional static Console variables without financial substitution; no legacy/window/Content API requirement for trial samples; financial-alert persistence; one consolidated intent per event; cooldown/reset/disabled-delivery behavior; provider failures and uncertain outcomes; immutable SID/address matching for status polling; and configuration-change protection.
- 130 existing/Analyst Watch backend regression tests passed. The paused in-progress research-automation test module was excluded explicitly; that feature remains unfinished and is not claimed as validated here.
- 19 existing frontend tests, TypeScript and targeted watch lint passed. Browser interaction testing is unavailable due to the computer-use client/server mismatch.
- No sample template was sent during implementation. The separate custom-text send occurred only after the user explicitly requested it and was rejected by Twilio. The user will trigger a trial sample test through the UI; no live template-delivery success is claimed.
