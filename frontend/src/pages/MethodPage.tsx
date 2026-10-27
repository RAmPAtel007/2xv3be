import { CheckCircle2, Database, ExternalLink, FlaskConical, Map as MapIcon, Scale } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Meta } from '../api/types'
import { Card } from '../components/ui'
import { fmtDay, fmtDayTime } from '../lib/format'

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="num flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
        {n}
      </span>
      <div>
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <div className="mt-0.5 text-sm leading-relaxed text-slate-600">{children}</div>
      </div>
    </li>
  )
}

export function MethodPage({ meta }: { meta: Meta }) {
  const q = meta.data.quality
  const w = meta.decision_window
  const checks: [string, string | number, boolean][] = [
    ['Half-hourly outturn periods', q.actual_periods as number, true],
    ['Missing outturn periods', q.actual_missing_periods as number, q.actual_missing_periods === 0],
    ['Duplicate outturn revisions removed', q.actual_duplicates_removed as number, true],
    ['Forecast publications', q.forecast_publishes as number, true],
    ['Publications per day (min–max)', `${q.forecast_publishes_per_day_min}–${q.forecast_publishes_per_day_max}`, q.forecast_publishes_per_day_min === 8],
    ['Forecast rows', q.forecast_rows as number, true],
  ]

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <Card title="How WindDesk answers the two questions" subtitle="Design principles for the January 2026 pilot">
          <ol className="space-y-4">
            <Step n={1} title="Only what was knowable at the gate">
              For delivery day D and gate time G (UK local, on D-1), each delivery hour uses the most recent WINDFOR forecast
              with <code className="rounded bg-slate-100 px-1">publishTime ≤ G</code>. Later forecasts are shown separately
              as hindsight and are never mixed in. Decision days run from {fmtDay(w.first_decision_date)} to{' '}
              {fmtDay(w.last_decision_date)}, so delivery days run from {fmtDay(w.first_delivery_date)} to{' '}
              {fmtDay(w.last_delivery_date)}.
            </Step>
            <Step n={2} title="Like-for-like comparison">
              WINDFOR is hourly and FUELHH is half-hourly. Each hourly forecast is compared with the settlement period that
              starts at the same <code className="rounded bg-slate-100 px-1">startTime</code>. Daily energy uses every
              half-hour of outturn (MW × 0.5 h) and every hourly forecast (MW × 1 h).
            </Step>
            <Step n={3} title="Error convention">
              <b>error = forecast − outturn</b>. Positive means over-forecast: less wind than planned, so the desk is short.
              MAE, RMSE, bias, P90/P99 absolute error, nMAE (MAE ÷ mean outturn) and R² are reported. Skill is measured
              against a naive persistence forecast (last settled outturn at the gate, held flat).
            </Step>
            <Step n={4} title="Calibration without look-ahead">
              Outturn ≈ scale × forecast. For each delivery day the scale (least squares through the origin) and the 10th and
              90th percentile outturn/forecast ratios come only from the previous {meta.calibration.window_days} fully
              settled days (D-29 to D-2). December 2025 is loaded only as that warm-up history. Hours forecast below{' '}
              {meta.calibration.min_forecast_mw.toLocaleString()} MW are excluded from the ratios, because there the ratio
              is mostly noise.
            </Step>
            <Step n={5} title="Honest evaluation">
              The P10–P90 band is back-tested: its coverage over January is reported next to the 80% target. Days where it
              fails, such as 28 Jan, stay in the record.
            </Step>
          </ol>
        </Card>

        <Card title="Assumptions & limitations">
          <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-600">
            <li>
              National level only, using just these two Elexon datasets. FUELHH WIND is transmission-metered wind.
              Embedded (distribution-connected) wind is not in the outturn.
            </li>
            <li>
              The persistent over-forecast is consistent with curtailment, where wind farms are paid to turn down during
              grid constraints. The pilot does not use constraint data to confirm this.
            </li>
            <li>
              The calibration is deliberately simple (one scale, two ratios) so traders can explain it. Conditioning on
              wind level, season or weather regime is a natural next step.
            </li>
            <li>
              Gate times: EPEX GB day-ahead 09:20, Nord Pool N2EX 09:50, EPEX GB half-hourly 15:30 (UK time). Any custom
              time can be tested with the clock input.
            </li>
          </ul>
        </Card>

        <Card title="Roadmap beyond the pilot">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ['Live mode', "Poll Elexon every 30 min and show tomorrow's position with a gate countdown and alerts."],
              ['Portfolio view', "Scale national wind to the client's PPA share and net it against their demand forecast."],
              ['Price-aware hedging', 'Turn the P10 shortfall into £ exposure using imbalance and intraday prices.'],
              ['Smarter calibration', 'Level-dependent and regime-aware models, with solar and other renewables.'],
            ].map(([t, d]) => (
              <div key={t} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                  <MapIcon className="h-4 w-4 text-indigo-500" />
                  {t}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">{d}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="space-y-5">
        <Card title="Data sources" subtitle="Elexon BMRS Insights API, public and keyless">
          <ul className="space-y-3 text-sm">
            {[
              ['Outturn', 'FUELHH, fuelType = WIND, 30-min', meta.data.sources.actuals],
              ['Forecast', 'WINDFOR, hourly, 8 publications/day', meta.data.sources.forecasts],
            ].map(([label, desc, href]) => (
              <li key={label} className="flex items-start gap-2">
                <Database className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <div>
                  <div className="font-medium text-slate-900">{label}</div>
                  <div className="text-xs text-slate-500">{desc}</div>
                  {href && (
                    <a href={href} target="_blank" rel="noreferrer" className="mt-0.5 inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline">
                      API endpoint <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-slate-500">
            Snapshot {meta.data.snapshot_start} to {meta.data.snapshot_end}
            {meta.data.fetched_at && <>, fetched {fmtDayTime(meta.data.fetched_at)}</>}. Refresh with{' '}
            <code className="rounded bg-slate-100 px-1">python -m scripts.fetch_data</code>.
          </p>
        </Card>

        <Card title="Data quality checks" subtitle="Run on every load of the snapshot">
          <ul className="divide-y divide-slate-100 text-sm">
            {checks.map(([label, value, ok]) => (
              <li key={label} className="flex items-center justify-between py-2">
                <span className="flex items-center gap-2 text-slate-600">
                  <CheckCircle2 className={`h-4 w-4 ${ok ? 'text-emerald-500' : 'text-orange-500'}`} />
                  {label}
                </span>
                <span className="num font-medium text-slate-900">{typeof value === 'number' ? value.toLocaleString() : value}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            Publication slots (UTC): {(q.forecast_publish_slots_utc as string[]).join(', ')}
          </p>
        </Card>

        <Card title="For engineers">
          <ul className="space-y-2 text-sm text-slate-600">
            <li className="flex gap-2">
              <FlaskConical className="h-4 w-4 shrink-0 text-indigo-500" /> Backend: FastAPI + pandas, pytest suite, ruff.
            </li>
            <li className="flex gap-2">
              <Scale className="h-4 w-4 shrink-0 text-indigo-500" /> Frontend: React + TypeScript + Recharts, vitest.
            </li>
            <li className="flex gap-2">
              <ExternalLink className="h-4 w-4 shrink-0 text-indigo-500" />
              <a className="text-indigo-600 hover:underline" href="/api/docs" target="_blank" rel="noreferrer">
                Interactive API docs (OpenAPI)
              </a>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  )
}
