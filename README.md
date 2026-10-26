# Veritas

**Investment research, portfolio tracking, and evidence-backed financial analysis in one workspace.**

Veritas combines an investment dashboard with an AI research assistant, a document-based Research Lab, interactive financial reports, and investing education. The Research Lab connects financial facts to their source documents, records reproducible calculations, and keeps analyst review explicit before reports are approved.

This repository is a local, single-user prototype. It combines live integrations, deterministic calculations, curated datasets, and illustrative dashboard data. Portfolio actions update local records; they do not execute brokerage trades.

## Features

| Area | What it provides |
| --- | --- |
| Portfolio and investments | Holdings, watchlists, allocation, local transaction records, portfolio summaries, and reports |
| Market exploration | Stock search, quotes, historical price charts, and experimental trend forecasts |
| AI Insights | Financial research chat, asset analysis, claim verification, regulatory checks, strategies, and what-if questions |
| Research Lab | Persistent research cases, document intake, source-linked facts, reviewed inputs, Decimal calculations, scoped verification, and versioned reports |
| SEC research automation | A guided Microsoft annual-comparison workflow using official SEC filings and XBRL data, with human review before calculation and drafting |
| Ecosystem Risk | Curated corporate relationship investigations, evidence-linked exposure assessments, and scenario calculations |
| Financial Analytics | An eight-page Microsoft FY2025 reporting workspace, source data, financial statements, ratios, and CSV exports |
| Transaction analytics | Browser-only CSV analysis with income/expense summaries, configurable alerts, and WhatsApp message drafts |
| Analyst Watch | Simulated financial events, rule-based alerts, and optional Twilio WhatsApp delivery |
| Learning and Mindset | Curated investing resources, quizzes, progress tracking, and investor-persona conversations |

## Technology

- **Frontend:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Recharts, Lightweight Charts, GSAP, and Three.js.
- **Backend:** Python 3.13+, FastAPI, Pydantic, Uvicorn, and server-sent events.
- **AI workflows:** LangGraph, LangChain, Groq, Tavily, and DuckDuckGo search fallback.
- **Financial data and documents:** yfinance, pandas, SEC filings/XBRL, pypdf, and ReportLab.
- **Persistence:** Local JSON records, SQLite research databases, and uploaded source files.
- **Optional integrations:** Finnhub news, SMTP report delivery, and Twilio WhatsApp.

The browser normally calls `/backend/*`; Next.js rewrites those requests to the FastAPI server at `http://localhost:8000`. Server-rendered API requests use an absolute backend URL.

## Quick start

### Prerequisites

- Python **3.13 or newer**; the backend pins Python 3.13 in `.python-version`.
- [uv](https://docs.astral.sh/uv/) for Python dependency management.
- Node.js **20.9 or newer** and npm, compatible with the pinned Next.js 16 dependency.
- Internet access for dependency installation and any live data or provider features.

Run the following commands from the repository root unless a different directory is shown.

### 1. Start the backend

```bash
cd backend
uv sync
```

For a fresh checkout, create the local environment file:

```bash
cp .env.example .env
```

If `.env` already exists, retain it and add any missing settings manually. Configure the integrations you want to use as described below, then start the API:

```bash
uv run python main.py
```

The API runs on **http://localhost:8000** with development reload enabled.

### 2. Start the frontend

In a second terminal, from the repository root:

```bash
cd frontend/my-app
npm ci
npm run dev
```

Open **http://localhost:3000**. No frontend environment file is required for the default local setup.

### 3. Check the connection

```bash
curl http://localhost:8000/health
```

Expected response:

```json
{"status":"ok"}
```

- **Application:** http://localhost:3000
- **Interactive API reference:** http://localhost:8000/docs
- **OpenAPI schema:** http://localhost:8000/openapi.json

The API documentation retains the legacy title **CodeCrafters API**; it is the backend for Veritas.

## Configuration

Backend settings belong in **`backend/.env`**. The checked-in [environment example](backend/.env.example) covers SEC retrieval, Analyst Watch, and Insights model overrides; add the other settings below when needed. Keep API keys and messaging credentials on the backend.

| Setting | Purpose |
| --- | --- |
| `GROQ_API_KEY` | Required for Groq-backed AI chat, extraction, and model-driven research |
| `INSIGHTS_MODEL`, `INSIGHTS_ROUTER_MODEL`, `INSIGHTS_FALLBACK_MODEL` | Model overrides for the Insights agent; use model IDs available to your Groq account |
| `RESEARCH_MODEL`, `RESEARCH_FALLBACK_MODEL` | Research Lab model overrides; otherwise the code uses its shared model defaults |
| `TAVILY_API_KEY` | Optional Tavily search; the search tool falls back to DuckDuckGo when unavailable |
| `FINNHUB_API_KEY` | Enables Finnhub news fetching |
| `SEC_USER_AGENT` | Application name plus a real contact email for official SEC retrieval |
| `VERITAS_RESEARCH_DIR` | Optional alternate research storage directory; use an absolute path |
| `VERITAS_ECOSYSTEM_DEMO=1` | Enables the curated Microsoft ecosystem demo |
| `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM`, `MAIL_SERVER`, `MAIL_PORT` | SMTP configuration for report email; port defaults to `587` |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`, `TWILIO_WHATSAPP_TO` | Optional Analyst Watch messaging configuration |
| `TWILIO_NOTIFICATION_MODE` | Selects `financial_alert` or the separately labelled `trial_delivery_demo` mode |

For example, add your own values to `backend/.env`:

```dotenv
GROQ_API_KEY=your-groq-api-key
SEC_USER_AGENT=Veritas Research your-contact@example.com
```

Restart the backend after changing settings. See the [Analyst Watch guide](docs/analyst-watch.md) for sender, recipient, template, origin, and delivery requirements, and the [trial demo guide](docs/analyst-watch-trial-demo.md) for sample-template behavior.

If the backend runs elsewhere, create `frontend/my-app/.env.local`:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:8000
API_BASE_URL=http://localhost:8000
```

`NEXT_PUBLIC_API_URL` controls the browser API base and rewrite destination. `API_BASE_URL` supplies the server-side API base; `BACKEND_URL` is also supported as a server-side fallback. Restart Next.js after changing these settings. Values prefixed with `NEXT_PUBLIC_` are exposed to the browser and must not contain secrets.

## Try the main workflows

### Research a company

1. Open `/research` and create a research case.
2. Add source documents and inspect their extracted text.
3. Review financial fact candidates and confirm the inputs you have checked.
4. Run calculations and inspect receipts containing formulas, fact revisions, and source references.
5. Use Analysis, Evidence, and Report to inspect findings, verify claims, and review a saved draft.

For the supported SEC workflow, configure `SEC_USER_AGENT`, then use **Ask Dexter** with “Analyse Microsoft's FY2025 financial performance compared with FY2024.” Choose a research-as-of date on or after **2025-07-30**. Inspect the imported candidates, confirm reviewed facts, then explicitly continue to calculate, verify, and draft. Approval remains a separate action. This automated slice does not require an LLM; model-driven Research Lab features require Groq configuration.

See [Research Lab documentation](RESEARCH_LAB.md) for supported scope, calculations, API contracts, and recovery behavior.

### Explore financial reports without backend setup

Open `/financial-analytics` for the bundled Microsoft FY2025 report. It includes eight report pages, statement comparisons, ratios, source links, underlying data, and CSV downloads. The dataset is a Veritas-prepared extraction of Microsoft's public disclosures.

Open `/financial-analytics/transactions` to load sample transactions or upload a CSV for income/expense analysis. Uploaded transaction data stays in browser memory and clears on refresh. WhatsApp links open message drafts for the user to send.

### Inspect ecosystem risk or financial alerts

- **Ecosystem Risk:** Open a Research Lab case and its Ecosystem Risk tab. The Microsoft demo requires `VERITAS_ECOSYSTEM_DEMO=1`; the separate **Open real-evidence case** workflow covers Spirit AeroSystems, Boeing, and Airbus. These are curated investigations.
- **Analyst Watch:** Open `/analyst-watch`; use `/analyst-watch/demo-console` to publish simulated events. Optional WhatsApp delivery requires backend Twilio configuration. Trial mode delivers a disclosed sample template, separate from the financial alert displayed in Veritas.

## Application routes

| Route | Screen |
| --- | --- |
| `/` | Product landing page |
| `/overview` | Portfolio overview |
| `/investment` | Holdings, watchlist, and forecasts |
| `/market` | Stock search and market charts |
| `/insights` | AI research assistant |
| `/research` | Research case workspace |
| `/research/[caseId]` | Individual research case |
| `/financial-analytics` | Microsoft financial report |
| `/financial-analytics/microsoft` | Alternate entry to the Microsoft report |
| `/financial-analytics/transactions` | CSV transaction analytics |
| `/analyst-watch` | Financial alert dashboard |
| `/analyst-watch/demo-console` | Simulated event presenter console |
| `/portfolio` | Diversification, strategy, and goals |
| `/reports` | Portfolio reports and exports |
| `/mindset` | Investor-persona conversations |
| `/learners` | Investing education and quizzes |

## Repository structure

```text
.
├── README.md
├── backend/
│   ├── main.py                    # Development API entry point
│   ├── pyproject.toml             # Python dependencies
│   ├── uv.lock
│   ├── app/
│   │   ├── main.py                # FastAPI app and core routes
│   │   ├── agent/                 # Insights agent, prompts, and tools
│   │   ├── research/              # Cases, facts, calculations, and reports
│   │   │   ├── automation/        # SEC retrieval and review workflow
│   │   │   └── ecosystem/         # Corporate ecosystem investigations
│   │   ├── analyst_watch/         # Alert rules, storage, and delivery
│   │   ├── services/              # Market, portfolio, learning, and report services
│   │   └── ml/                    # Experimental trend models
│   ├── data/                      # Local application data
│   └── tests/                     # Backend regression tests and diagnostic scripts
├── frontend/my-app/
│   ├── src/app/                   # Next.js routes and feature components
│   ├── src/components/            # Shared UI components
│   ├── src/lib/                   # API clients, types, and calculation helpers
│   ├── public/                    # Static assets and bundled datasets
│   └── tests/                     # Node-based regression tests
├── docs/                          # Feature guides and implementation notes
├── scripts/                       # Dataset generation tools
└── dashboard/                     # BI specifications and a standalone HTML demo
```

The main application is `frontend/my-app`; `dashboard/` contains supporting specifications and a separate demo.

## Development and validation

Backend tests, from `backend/`:

```bash
uv run python -m unittest discover -s tests -p 'test_*.py' -v
```

Frontend checks, from `frontend/my-app/`:

```bash
node --test tests/*.test.cjs
npx tsc --noEmit
npm run lint
npm run build
```

To serve a successfully built frontend:

```bash
npm run start
```

The `test_*.py` suite includes offline tests with temporary stores and mocked providers. Separately named live probes and replay scripts in `backend/tests/` have their own prerequisites. See the feature documentation before running them. The commands above describe the available checks; historical validation results and limitations are recorded in the linked documentation.

## Data and current limitations

- Research cases, facts, receipts, and reports use SQLite. The default Research Lab location is `backend/research_data/research.sqlite3`, with source files in `backend/research_data/uploads/`. Back up the database and uploads together; an ephemeral filesystem will not preserve them.
- Portfolio and other application records use local files under `backend/data/`. Financial Analytics uses bundled report data; transaction CSV uploads remain in browser memory.
- Several dashboard panels use illustrative data or sample fallbacks. A populated screen does not establish a successful live provider connection.
- Live quotes, search, news, AI responses, SEC retrieval, email, and messaging depend on provider availability and applicable configuration. Experimental price forecasts do not establish predictive trading performance.
- The app has no production authentication or tenant isolation. Research workflows assume one local backend process; case IDs and session labels are not access controls.
- SEC automation currently supports a narrow annual-comparison scope, and ecosystem investigations use curated evidence rather than general autonomous supply-chain discovery.
- Document extraction and model-generated output require analyst review. Research drafts are not automatically approved.

## Troubleshooting

| Problem | Check |
| --- | --- |
| API connection errors | Start the backend, check `/health`, and confirm port `8000` or your configured API URLs |
| AI requests fail | Set `GROQ_API_KEY` in `backend/.env` and choose model IDs enabled for that account |
| SEC retrieval is blocked | Configure a real contact in `SEC_USER_AGENT`; inspect the recorded provider error and retry guidance |
| News is empty | Configure `FINNHUB_API_KEY` and check provider availability |
| WhatsApp delivery fails | Check the selected notification mode, allowlisted recipient, sender setup, and Twilio delivery state using the Analyst Watch guide |
| Build cannot fetch fonts | The frontend uses `next/font` with Google Fonts; ensure the build environment can reach the font service |
| Records disappear after restart | Check that the same persistent storage directory is used and that transaction CSVs were not only held in browser memory |

## Further documentation

- [Project and feature documentation](PROJECT_DOCUMENTATION.md)
- [System architecture](ARCHITECTURE.md)
- [Research Lab and SEC automation](RESEARCH_LAB.md)
- [Backend API reference](backend/backend_doc.md) — use `/docs` for the running API schema
- [Microsoft financial report: sources and methodology](docs/microsoft-bi-report.md)
- [Transaction analytics implementation](docs/financial-analytics-integration-plan.md)
- [Ecosystem Risk implementation](docs/ecosystem-risk-implementation.md)
- [Spirit AeroSystems real-evidence case](docs/spirit-real-evidence-case.md)
- [Analyst Watch setup and behavior](docs/analyst-watch.md)
- [Analyst Watch trial delivery demo](docs/analyst-watch-trial-demo.md)
