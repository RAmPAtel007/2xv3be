import { Timer } from 'lucide-react'
import { api, useApi } from '../api/client'
import type { LeadTime } from '../api/types'
import { GATE_SHADES, HorizonChart, SweepChart } from '../components/charts/TimingCharts'
import { Callout, Card, ErrorBox, Legend, Loading } from '../components/ui'
import { fmtMW, fmtPct, pctChange, signedMW } from '../lib/format'
import { COLORS } from '../lib/theme'

export function TimingPage() {
  const lt = useApi<LeadTime>(api.leadTime())
  if (lt.error) return <ErrorBox message={lt.error} />
  if (!lt.data) return <Loading label="Replaying every possible decision time…" />

  const { gates, by_horizon, decision_time_sweep } = lt.data
  const earliest = gates[0]
  const latest = gates[gates.length - 1]
  const calGain = pctChange(earliest.calibrated_mae_mw, latest.calibrated_mae_mw)
  const rawGain = pctChange(earliest.raw_mae_mw, latest.raw_mae_mw)
  const nearest = by_horizon[0]
  const dayAhead = by_horizon.find((b) => b.horizon_h === 24)

  return (
    <div className="space-y-5">
      <Callout icon={<Timer className="h-5 w-5" />}>
        Timing matters. Deciding at <b>{latest.time}</b> ({latest.label}) instead of <b>{earliest.time}</b> (
        {earliest.label}) uses a forecast that is {(earliest.horizon_max_h ?? 0) - (latest.horizon_max_h ?? 0)} hours
        fresher. That cuts the published error by{' '}
        <b>{fmtPct(-(rawGain ?? 0))}</b> and the calibrated error by <b>{fmtPct(-(calGain ?? 0))}</b>. Wind forecasts
        also degrade slowly with lead time: MAE goes from {fmtMW(nearest?.mae_mw)} at 0–1 h to {fmtMW(dayAhead?.mae_mw)}{' '}
        at 24 h. Most of the day-ahead error is systematic bias, which calibration removes, not randomness.
      </Callout>

      <div className="grid gap-3 md:grid-cols-3">
        {gates.map((g, i) => (
          <div key={g.id} className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">{g.label}</div>
                <div className="num text-xs text-slate-500">Gate {g.time} D-1 · lead time {g.horizon_min_h}–{g.horizon_max_h} h</div>
              </div>
              <span className="h-3 w-3 rounded-sm" style={{ background: GATE_SHADES[i % GATE_SHADES.length] }} />
            </div>
            <dl className="num mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-sky-50 p-2">
                <dt className="text-[10px] uppercase tracking-wide text-sky-700">Published</dt>
                <dd className="text-sm font-semibold">{fmtMW(g.raw_mae_mw)}</dd>
              </div>
              <div className="rounded-lg bg-indigo-50 p-2">
                <dt className="text-[10px] uppercase tracking-wide text-indigo-700">Calibrated</dt>
                <dd className="text-sm font-semibold">{fmtMW(g.calibrated_mae_mw)}</dd>
              </div>
              <div className="rounded-lg bg-slate-50 p-2">
                <dt className="text-[10px] uppercase tracking-wide text-slate-600">Band hit</dt>
                <dd className="text-sm font-semibold">{fmtPct(g.band_coverage_pct)}</dd>
              </div>
            </dl>
            <div className="mt-2 text-xs text-slate-500">Published bias {signedMW(g.raw_bias_mw)}</div>
          </div>
        ))}
      </div>

      <Card
        title="When should the desk decide?"
        subtitle="MAE (January back-test) if the decision were taken at each half-hour of the day before delivery. Each step down is a new forecast publication."
      >
        <SweepChart sweep={decision_time_sweep} gates={gates} />
        <div className="mt-3">
          <Legend
            items={[
              { label: 'Published forecast', color: COLORS.forecast },
              { label: 'WindDesk calibrated', color: COLORS.calibrated },
              { label: 'Auction gate closures', color: '#64748b', kind: 'dash' },
            ]}
          />
        </div>
      </Card>

      <Card
        title="Forecast error vs lead time"
        subtitle="Every WINDFOR forecast for January delivery hours, grouped by how far ahead it was published. Shaded bands mark the lead times each auction trades on."
      >
        <HorizonChart buckets={by_horizon} gates={gates} />
        <div className="mt-3">
          <Legend
            items={[
              { label: 'MAE', color: COLORS.forecast },
              { label: 'P90 absolute error', color: COLORS.over },
              { label: 'Bias', color: COLORS.persistence, kind: 'dash' },
              ...gates.map((g, i) => ({ label: `${g.label} window`, color: GATE_SHADES[i % GATE_SHADES.length], kind: 'area' as const })),
            ]}
          />
        </div>
      </Card>
    </div>
  )
}
