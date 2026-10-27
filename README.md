# WindDesk: day-ahead wind forecast intelligence

A web app for a UK utility's day-ahead power desk. At the moment the team has to bid into the GB day-ahead auction, it answers two questions:

1. **What does the latest wind forecast say about tomorrow?** It shows exactly the forecast that was available at gate closure, nothing published later.
2. **How far can we trust it?** It back-tests every January 2026 decision and turns the measured error into a calibrated forecast and a P10–P90 range the desk can size purchases against.

| | |
|---|---|
| **Live app** | https://2xv3be.vercel.app |
| **Video walkthrough** | `https://youtu.be/<unlisted-id>` |
| **API docs** | https://2xv3be.vercel.app/api/docs (OpenAPI) |

Data: [Elexon BMRS](https://bmrs.elexon.co.uk/) `FUELHH` (wind outturn, 30 min) and `WINDFOR` (wind forecast, hourly, 8 publishes a day). No other data is used.

---

## What the January 2026 back-test shows

Decision-time forecast at the **N2EX 09:50** gate vs metered outturn, every hour of 31 delivery days (2 Jan to 1 Feb):

| | Published forecast | WindDesk calibrated |
|---|---:|---:|
| MAE | 1,996 MW (17.7% of mean outturn) | **1,218 MW (−39%)** |
| Bias (forecast − outturn) | **+1,728 MW** | +24 MW |
| P90 absolute error | 4,184 MW | 2,602 MW |
| Skill vs naive persistence | 51% | 70% |
| P10–P90 band coverage (target 80%) | – | 83% |

* The published forecast **over-forecast on 28 of 31 days**. A desk buying against it would have been structurally short. The pattern is consistent with curtailment of high-wind output, but this pilot doesn't have the data to prove it.
* **Timing matters.** Deciding at 15:30 (EPEX half-hourly auction) instead of 09:20 cuts calibrated MAE from 1,215 to 971 MW (−20%).
* Error grows only slowly with lead time (1.67 GW at 0–1 h to 1.95 GW at 24 h). Most day-ahead error is systematic bias, which calibration removes.

## Features

**Required by the brief**
* **Decision Desk.** Pick a decision day and a gate time. You see the latest forecast published before that gate, when it was published, its lead time and when the next (too-late) update arrives.
* **Forecast Accuracy.** Quantitative back-test over every January decision: MAE, RMSE, bias, nMAE, P50/P90/P99 error, R², error by hour of day, error distribution, daily energy error, and a sortable day-by-day table.

**Beyond the brief**
* **Calibrated forecast and P10–P90 range** built only from data known at decision time (no look-ahead), and back-tested for coverage.
* **Energy at risk.** Calibrated minus P10 energy (GWh): a direct sizing input for extra purchases.
* **Forecast evolution chart.** Every forecast published for the delivery day, split into before the gate, at the gate, and after the gate (hindsight).
* **Gate comparison and "when to decide" sweep.** Error if the decision were taken at any time on D-1, with EPEX 09:20, N2EX 09:50 and EPEX HH 15:30 marked. Any custom gate time can be tested.
* **Error vs lead time** across all 0–66 h forecasts.
* **Month heat strip.** Each decision day shaded by how wrong the forecast was. Click any day or bar to drill in.
* **Shareable state and CSV export.** Every view is a URL (`?tab=&date=&gate=`), and the hourly back-test downloads as CSV.
* **Data quality report.** Missing periods, revisions and publish cadence are checked on load.

## Quick start

### Docker (one command)

```bash
docker compose up --build
# open http://localhost:8000
```

The single image builds the React app and serves it from FastAPI, alongside the API under `/api`.

### Local development

Prerequisites: Python 3.11+, Node 20+.

```bash
# backend (terminal 1)
cd backend
python -m venv ../.venv && source ../.venv/bin/activate   # Windows: ..\.venv\Scripts\activate
pip install -r requirements-dev.txt
uvicorn winddesk.main:app --reload --port 8000

# frontend (terminal 2)
cd frontend
npm ci
npm run dev        # http://localhost:5173, proxies /api to :8000
```

### Tests and lint

```bash
cd backend && pytest -q && ruff check . && ruff format --check .
cd frontend && npm test && npm run build      # build includes a strict TypeScript check
```

### Refresh the data snapshot

```bash
cd backend && python -m scripts.fetch_data
```

This pulls Dec 2025 to 1 Feb 2026 from Elexon. December is only used as calibration history that was already known before the January decisions.

## Deploy

**Vercel (recommended, free tier).** `vercel.json` builds the React app as static files and deploys `api/index.py` (the same FastAPI app) as a Python serverless function. API responses carry `s-maxage` so the edge caches them.

```bash
npm i -g vercel
vercel          # first run links the project; accept the defaults
vercel --prod
```

**Heroku (container).** `heroku stack:set container`, then `git push heroku main`. This uses `heroku.yml` and the same Dockerfile.

## Repository layout

```
.
├── api/index.py               Vercel entrypoint: imports the FastAPI app
├── backend/
│   ├── winddesk/
│   │   ├── main.py            App factory: CORS, gzip, cache headers, static mount
│   │   ├── api.py             HTTP routes (thin: validate, delegate)
│   │   ├── service.py         Builds payloads; caches per-gate computations
│   │   ├── config.py          Decision window, auction gates, calibration settings
│   │   ├── data/
│   │   │   ├── elexon.py      BMRS client (chunked, retried)
│   │   │   └── repository.py  Loads and cleans the snapshot, quality report
│   │   └── analytics/
│   │       ├── calendar.py    UK delivery days, gate times, DST-safe UTC conversion
│   │       ├── selection.py   Decision-time forecast selection (merge_asof), persistence baseline
│   │       ├── metrics.py     MAE/RMSE/bias/percentiles/skill/histogram
│   │       ├── uncertainty.py Trailing calibration and P10–P90 band (no look-ahead)
│   │       └── leadtime.py    Error by lead time
│   ├── data/                  Bundled Elexon snapshot (csv.gz) and fetch metadata
│   ├── scripts/fetch_data.py  Refreshes the snapshot from Elexon
│   └── tests/                 pytest: selection, calibration, metrics, calendar, API
├── frontend/
│   └── src/
│       ├── App.tsx            Shell, tabs, URL state
│       ├── api/               Typed client and response types
│       ├── pages/             DecisionDesk, AccuracyPage, TimingPage, MethodPage
│       ├── components/        UI kit, gate picker, month strip, Recharts charts
│       └── lib/               Formatting (UK time), theme, URL-state hook
├── docs/
│   ├── ARCHITECTURE.md        Design decisions and data flow
│   └── VIDEO_SCRIPT.md        Script for the two-part demo video
├── Dockerfile                 Multi-stage: node build, then python runtime serving both
├── docker-compose.yml
├── vercel.json / requirements.txt / .vercelignore   Vercel deployment
├── heroku.yml                 Optional Heroku container deployment
└── .github/workflows/ci.yml   Lint, tests, build, Docker smoke test
```

## Method in brief

* **Decision time:** gate time G (UK local) on D-1, converted to UTC per day, so it is DST-safe.
* **Forecast used:** for each delivery hour, the latest `WINDFOR` row with `publishTime ≤ G` (`pandas.merge_asof`). Later forecasts appear only as hindsight.
* **Comparison:** hourly forecast vs the `FUELHH` settlement period with the same `startTime`. Daily energy uses all 48 half-hours.
* **Error:** forecast − outturn. Positive means over-forecast, i.e. a shortfall to buy.
* **Calibration:** outturn ≈ scale × forecast. The scale (least squares) and the P10/P90 outturn/forecast ratios come from the previous 28 *fully settled* days (D-29 to D-2). That is exactly what was knowable at the gate.

More in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Development practices

* Layering: `api` → `service` → `analytics` / `data`. The analytics layer is pure pandas functions, so it is easy to unit test.
* Look-ahead safety is tested explicitly (`test_never_uses_a_forecast_published_after_gate`, `test_calibration_has_no_look_ahead`).
* DST correctness is tested (23 h and 25 h days, BST gate conversion).
* Typed end to end: Python type hints, strict TypeScript, response types mirrored in `frontend/src/api/types.ts`.
* CI: ruff, pytest, vitest, `tsc`, production build, plus a Docker build and container smoke test.

## Use of AI tools

This project was built with help from an AI coding assistant (Anthropic's Claude, via Claude Code). It assisted with code generation, data exploration and documentation. The design decisions, methodology and results were reviewed and verified by me. Every number in this README is reproduced by the test suite or the running app.

## Limitations and next steps

National level only. Transmission-metered wind, no embedded generation. The calibration is deliberately simple and explainable. Natural next steps are a live mode with gate-closure alerts, portfolio scaling (the client's PPA share and their demand), price-aware hedging, and level- or regime-dependent calibration.

---

Contains BMRS data © Elexon Limited copyright and database right 2026.
