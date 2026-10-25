# Spirit AeroSystems historical ecosystem case

Open **Research Lab → Open real-evidence case**. The action creates or reopens a separate Spirit case, starts a curated investigation if none exists, and opens its Ecosystem Risk tab. Microsoft cases and saved investigations remain intact. This case works with synthetic demo mode disabled.

## Scope and what it demonstrates

Target: Spirit AeroSystems Holdings, Inc. Historical cutoff: **28 February 2025**. Financial period: FY2024, ending 31 December 2024. Two one-hop customer relationships: Boeing and Airbus. These are customer relationships, not subsidiary claims. Spirit was already financially stressed; this is not an otherwise healthy target example.

The case demonstrates a supported customer dependency and a documented operational response. The historical strike had ended before the cutoff, so the observed impact does **not** generate an active strike warning. No exact realized strike-loss amount is claimed. No discovery, model calls or web scraping occurs at runtime; the application checks curated primary-source summaries, identifiers, hashes, dates and structured annotations. The hash fingerprints the saved summary, not the complete original filing or a fresh remote download.

## Sources and reporting bases

- [Spirit FY2024 Form 10-K, filed 28 February 2025](https://www.sec.gov/Archives/edgar/data/1364885/000162828025009088/spr-20241231.htm): customer concentration, debt, going concern, historical strike resolution and pending acquisition context. Boeing and Airbus account for approximately 58% and 21% of Spirit consolidated net revenue. These percentages do not measure the customers’ procurement dependence on Spirit.
- [Spirit FY2024 results, 28 February 2025](https://www.sec.gov/Archives/edgar/data/1364885/000162828025009058/spr_20250228-8kex99.htm): financial and customer funding tables. The earnings release tables are unaudited; their figures correspond to the annual financial statements. USD million: revenue 6,316.6; consolidated net loss including noncontrolling interests 2,139.0; operating cash outflow 1,120.9; cash 537.0; current assets 3,760.5; current liabilities 3,567.4; total equity including noncontrolling interests −2,616.0. Debt is 4,394.2 from the 10-K. The common-shareholder loss (2,139.8) is a different basis and is not substituted in the margin calculation.
- [Spirit Q3 results, 23 October 2024, page 1](https://investor.spiritaero.com/files/doc_earnings/2024/q3/earnings-result/SPR_2024-Q3-Press-Release_Final.pdf): announced 21-day furlough for approximately 700 employees on the 767/777 programs, in response to the Boeing strike and inventory buildup. An announced measure is distinguished from proof of its eventual execution or a quantified revenue loss.
- [Boeing FY2024 results, 28 January 2025](https://investors.boeing.com/investors/news/press-release-details/2025/Boeing-Reports-Fourth-Quarter-Results/default.aspx): USD million consolidated net loss 11,829 and operating cash outflow 12,080. These are company-wide figures, not losses attributable solely to Spirit or the strike.
- [Airbus FY2024 results, 20 February 2025](https://www.airbus.com/en/newsroom/press-releases/2025-02-airbus-reports-full-year-fy-2024-results): EUR million revenue 69,230, net income attributable to equity owners 4,232 and free cash flow 4,461. Income attribution differs from Spirit’s consolidated net-income basis; a comparable Airbus margin is intentionally unavailable. Positive earnings alone do not establish low risk. No implicit currency conversion is performed.

The Boeing acquisition was pending at this cutoff. The historical report must not be presented as a current ownership report.

## Screening and sensitivity

Financial screening reuses existing Decimal financial tools. Spirit’s current ratio rounds to 1.05×; its explicit going-concern disclosure takes precedence and flags HIGH financial pressure. Debt/equity is unavailable with nonpositive equity. Matching-period loss plus negative operating cash flow flags MEDIUM pressure for Boeing, not insolvency or a default probability. Airbus lacks comparable liquidity inputs, so its overall distress remains UNKNOWN despite the positive reported results.

The existing reported affected-revenue scenario path is preserved. An additional, separately labelled **approximate annual customer-revenue sensitivity** is allowed only for a verified, nonsynthetic customer relationship viewed from the revenue-reporting target. It requires an eligible primary-source concentration assertion with matching full period, consolidated revenue, entity, currency, unambiguous values and provenance.

Example: USD 6,316.6m × 58% = approximately USD 3,663.628m annual Boeing-related revenue. Under explicit user assumptions of 10% disruption and 50% unmitigated exposure, the sensitivity is approximately USD 183.1814m. The input share is rounded; displayed arithmetic precision does not make the estimate exact. This is not reported affected revenue, an estimate of the historical strike’s loss, an event-duration calculation or a forecast. Do not seed it as an actual loss. The user must enter and save assumptions; source IDs, input basis, formula and amounts are stored in the scenario and exported report. Human review remains pending.

## Validation

Offline backend acceptance tests cover the real-case API with synthetic demo loading disabled, two verified real relationships, correct customer-share direction, full-period matching, financial values, the going-concern override, nonpositive equity, historical impact evidence, absence of an active strike alert, before-publication/stale evidence abstention, and exact Decimal scenario arithmetic. The existing Microsoft acceptance tests remain in place.
