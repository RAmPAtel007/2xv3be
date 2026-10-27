# Video script (max 10 min: 5 + 5)

Record at 1080p, browser zoomed to 110%. Open the live app before recording. Every number below comes from the app, so read it off the screen.

---

## Part 1: Client pitch (≤ 5 min)

**Audience:** the utility's day-ahead trading team. **Goal:** they leave wanting the pilot in production.

| Time | Screen | Say |
|---|---|---|
| 0:00–0:30 | Decision Desk, default day (decide Mon 26 Jan, 09:50) | "Every morning before 09:50 you commit tomorrow's position in the day-ahead auction. Wind is the biggest unknown in that position. WindDesk shows you what the wind forecast really says *at the moment you trade*, and how far you can trust it." |
| 0:30–1:15 | Decision brief and KPI cards | "At 09:50 on the 26th the latest forecast was published at 09:30, twenty minutes earlier, and it covers tomorrow 14 to 38 hours ahead. The next update lands at 11:30, after the auction, so WindDesk never shows it as available. The published forecast says 477 GWh of wind. Our calibrated view says 414. And on 9 days out of 10 you'll get at least 348, so about 66 GWh is energy at risk." |
| 1:15–1:50 | Delivery-day chart → toggle outturn on | "Here's the profile: published forecast dashed, calibrated in purple, the 80% range shaded. Now the hindsight. Outturn, in black, came in at 394 GWh. The published forecast was 83 GWh too high. Calibrated was within 20." |
| 1:50–2:20 | Forecast evolution chart | "Every forecast for that day, including the ones that came after the auction, stayed high. Waiting wouldn't have fixed this. It's a systematic bias, and that's exactly what calibration corrects." |
| 2:20–3:30 | Forecast Accuracy tab | "Across all of January the published forecast over-forecast on 28 of 31 days, by 1.7 GW on average. Buying against it leaves you structurally short. WindDesk cuts the typical hourly error by 39%, from about 2.0 GW to 1.2 GW. The P10–P90 range really holds 83% of outcomes against an 80% target, so you can size contingency on it. Click any day for a post-mortem." *(click the 28 Jan bar)* "We keep the bad days too. On the 28th even the calibrated view missed. Honest numbers build trust." |
| 3:30–4:20 | Timing & Lead Time tab | "Which auction should you lean on? Deciding at the 15:30 half-hourly auction instead of 09:20 cuts calibrated error by 20%. This chart shows the error if you decided at any minute of the day before. Each step down is a new forecast landing." |
| 4:20–5:00 | Back on the Decision Desk, switch gate, show URL and CSV | "Any gate time, any day. Every view is a shareable link, and the full back-test exports to CSV for your own models. Next step: switch on live mode for tomorrow's position, scale it to your PPA portfolio, and put a £ value on energy at risk." |

---

## Part 2: Tech lead review (≤ 5 min)

**Audience:** internal tech lead. **Goal:** fast review and clean knowledge transfer.

| Time | Screen | Say |
|---|---|---|
| 0:00–0:40 | README: architecture diagram | "React + TypeScript frontend, FastAPI + pandas backend, a single Docker image, and the same code deploys to Vercel as static files plus a Python function. Data is an immutable Elexon snapshot, so it's reproducible, fast, and doesn't depend on Elexon being up during a demo." |
| 0:40–1:30 | `analytics/selection.py` | "The core rule: for delivery day D and gate G, each hour uses the latest forecast with publishTime ≤ G on D-1. It's one `merge_asof` by target hour. WINDFOR includes hindcast points with targets before publish time, and those are never used. Comparison is like-for-like on startTime: hourly forecast vs the settlement period that starts at the same time." |
| 1:30–2:30 | `analytics/uncertainty.py` + ARCHITECTURE table | "The raw forecast had a 1.7 GW bias that grows with wind level, so I chose a multiplicative calibration: scale times forecast, with the 10th and 90th percentile ratios for the band. The key point is no look-ahead. For day D, calibration only uses days D-29 to D-2, because D-1 isn't settled at the gate. December is loaded only as warm-up history. I compared additive, linear and scale models. Scale was nearly as accurate as regression and much easier for a trader to understand." |
| 2:30–3:15 | `service.py`, `api.py`, `/api/docs` | "Layering: thin routes, a service that builds payloads, and pure analytics functions. Each gate's frame is `lru_cache`d, and responses carry `s-maxage`, so Vercel's edge serves repeat calls. OpenAPI docs are generated at /api/docs. Inputs are validated: out-of-range dates return 422." |
| 3:15–4:00 | `tests/` + CI run | "Tests encode the business invariants: never use a forecast published after the gate, the gate-equals-publish edge case, no look-ahead in calibration, DST days with 23 and 25 hours. API tests on the real snapshot assert calibrated beats raw beats persistence, and coverage stays between 70% and 95%. CI runs ruff, pytest, vitest, a strict tsc build, and a Docker build with a smoke test." |
| 4:00–4:40 | `frontend/src`: pages, `api/types.ts`, `useQueryState` | "Typed client mirroring the API, URL-driven state so every view is shareable, one colour per concept across all charts, and all times rendered in UK local time through Intl." |
| 4:40–5:00 | README limitations | "Limits: national level, transmission-metered wind only, a deliberately simple calibration. Next: live mode, portfolio scaling, price-aware hedging. I used Claude Code as an AI assistant, as the README says, and verified every number through the tests and the app." |
