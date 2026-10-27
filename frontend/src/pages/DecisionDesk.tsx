import { ArrowRight, ChevronLeft, ChevronRight, Clock3, History, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { api, useApi } from '../api/client'
import type { Accuracy, Decision, Meta } from '../api/types'
import { DayProfileChart } from '../components/charts/DayProfileChart'
import { VintageChart } from '../components/charts/VintageChart'
import { MonthStrip } from '../components/MonthStrip'
import { Callout, Card, ErrorBox, Kpi, Legend, Loading, Toggle } from '../components/ui'
import {
  fmtDay,
  fmtDayTime,
  fmtGW,
  fmtGWh,
  fmtLongDay,
  fmtMW,
  fmtPct,
  fmtTime,
  pctChange,
  shiftDate,
  signedGWh,
} from '../lib/format'
import { COLORS } from '../lib/theme'

export function DecisionDesk({
  meta,
  date,
  gate,
  onDate,
}: {
  meta: Meta
  date: string
  gate: string
  onDate: (d: string) => void
}) {
  const dec = useApi<Decision>(api.decision(date, gate))
  const acc = useApi<Accuracy>(api.accuracy(gate))
  const [showActual, setShowActual] = useState(true)
  const [stripCalibrated, setStripCalibrated] = useState(false)

  const { first_decision_date: first, last_decision_date: last } = meta.decision_window
  const d = dec.data

  return (
    <div className="space-y-5">
      <Card
        title="Choose a decision day"
        subtitle="Each cell is a day-ahead decision in January 2026, shaded by how far the forecast missed: orange = less wind than forecast (shortfall), green = more."
        actions={
          <div className="flex items-center gap-3">
            <Toggle checked={stripCalibrated} onChange={setStripCalibrated} label="Shade by calibrated error" />
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Previous day"
                disabled={date <= first}
                onClick={() => onDate(shiftDate(date, -1))}
                className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <input
                type="date"
                min={first}
                max={last}
                value={date}
                onChange={(e) => e.target.value && onDate(e.target.value)}
                className="num rounded-md border border-slate-200 bg-white px-2 py-1 text-sm"
                aria-label="Decision date"
              />
              <button
                type="button"
                aria-label="Next day"
                disabled={date >= last}
                onClick={() => onDate(shiftDate(date, 1))}
                className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        }
      >
        {acc.data ? (
          <MonthStrip daily={acc.data.daily} selectedDecisionDate={date} onSelect={onDate} calibrated={stripCalibrated} />
        ) : (
          <div className="h-9 animate-pulse rounded-md bg-slate-100" />
        )}
      </Card>

      {dec.error && <ErrorBox message={dec.error} />}
      {!d && !dec.error && <Loading label="Rebuilding the decision view…" />}

      {d && (
        <div className={`space-y-5 transition-opacity ${dec.loading ? 'opacity-60' : ''}`}>
          <DecisionBrief d={d} />

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi
              label="Published wind forecast"
              value={fmtGWh(d.summary.forecast_mwh)}
              detail={`Peak ${fmtGW(d.summary.peak_forecast_mw)} · trough ${fmtGW(d.summary.trough_forecast_mw)}`}
              accent={COLORS.forecast}
              hint="Energy over the delivery day from the latest WINDFOR forecast available at the gate (hourly MW × 1 h)."
            />
            <Kpi
              label="WindDesk calibrated"
              value={fmtGWh(d.summary.calibrated_mwh)}
              detail={`${fmtPct(pctChange(d.summary.forecast_mwh, d.summary.calibrated_mwh), 1)} vs published · scale ×${d.calibration.scale?.toFixed(2)}`}
              tone="accent"
              accent={COLORS.calibrated}
              hint={`Published forecast × the outturn/forecast scale observed over the ${d.calibration.samples / 24} settled days before the decision (${d.calibration.history_from} to ${d.calibration.history_to}). No future data is used.`}
            />
            <Kpi
              label="P10 downside (90% confident)"
              value={fmtGWh(d.summary.p10_mwh)}
              detail={`P90 upside ${fmtGWh(d.summary.p90_mwh)}`}
              accent={COLORS.band}
              hint="On 9 days out of 10, wind should deliver at least this much energy, based on the spread of recent outturn/forecast ratios."
            />
            <Kpi
              label="Energy at risk"
              value={fmtGWh(d.summary.energy_at_risk_mwh)}
              detail="Calibrated − P10: volume to consider covering"
              tone="bad"
              accent={COLORS.over}
              hint="How much less wind energy could plausibly arrive than the calibrated expectation. A starting point for sizing extra purchases or a contingency."
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-3">
            <Card
              className="xl:col-span-2"
              title={`Delivery-day profile · ${fmtLongDay(d.delivery_date)}`}
              subtitle="What the desk saw at the gate, with the calibrated expectation and an 80% range"
              actions={<Toggle checked={showActual} onChange={setShowActual} label="Show outturn (hindsight)" />}
            >
              <DayProfileChart hourly={d.hourly} actuals={d.actuals} showActual={showActual} />
              <div className="mt-3">
                <Legend
                  items={[
                    { label: 'Published forecast (at gate)', color: COLORS.forecast, kind: 'dash' },
                    { label: 'WindDesk calibrated', color: COLORS.calibrated },
                    { label: 'P10 – P90 range', color: COLORS.band, kind: 'area' },
                    ...(showActual ? [{ label: 'Metered outturn (FUELHH)', color: COLORS.actual }] : []),
                  ]}
                />
              </div>
            </Card>
            <HindsightPanel d={d} />
          </div>

          <Card
            title="How the forecast for this day evolved"
            subtitle={`${d.vintages.length} forecasts were published for ${fmtDay(d.delivery_date)}. Only the grey ones and the highlighted one existed when the gate closed.`}
          >
            <VintageChart vintages={d.vintages} actuals={d.actuals} showActual={showActual} />
            <div className="mt-3">
              <Legend
                items={[
                  { label: 'Earlier forecasts', color: COLORS.before },
                  { label: `Latest at the gate (${fmtTime(d.forecast_publish_times.at(-1) ?? d.decision_time)})`, color: COLORS.forecast },
                  { label: 'Published after the gate (too late to trade on)', color: COLORS.after, kind: 'dash' },
                  ...(showActual ? [{ label: 'Outturn', color: COLORS.actual }] : []),
                ]}
              />
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

function DecisionBrief({ d }: { d: Decision }) {
  const published = d.forecast_publish_times.at(-1)
  return (
    <div className="card flex flex-col gap-4 p-5 lg:flex-row lg:items-center">
      <div className="flex items-center gap-3 text-sm">
        <div className="rounded-lg bg-slate-900 px-3 py-2 text-white">
          <div className="text-[10px] uppercase tracking-wider text-slate-400">Decide</div>
          <div className="num font-semibold">{fmtDayTime(d.decision_time)}</div>
        </div>
        <ArrowRight className="h-4 w-4 text-slate-400" />
        <div className="rounded-lg bg-indigo-600 px-3 py-2 text-white">
          <div className="text-[10px] uppercase tracking-wider text-indigo-200">Deliver</div>
          <div className="num font-semibold">{fmtDay(d.delivery_date)}, 00:00–24:00</div>
        </div>
      </div>
      <div className="grid flex-1 gap-2 text-sm text-slate-600 sm:grid-cols-3">
        <div className="flex items-start gap-2">
          <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" />
          <span>
            Latest forecast: published <b className="num text-slate-900">{published ? fmtTime(published) : '–'}</b>,{' '}
            {d.minutes_since_publish} min before the gate
          </span>
        </div>
        <div className="flex items-start gap-2">
          <History className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
          <span>
            Lead time <b className="num text-slate-900">{d.horizon_min_h}–{d.horizon_max_h} h</b> across the delivery day
          </span>
        </div>
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <span>
            Next update{' '}
            <b className="num text-slate-900">{d.next_publish_time ? fmtDayTime(d.next_publish_time) : '–'}</b>: after the
            gate, so not usable
          </span>
        </div>
      </div>
    </div>
  )
}

function HindsightPanel({ d }: { d: Decision }) {
  const s = d.summary
  const rows = [
    { label: 'Metered outturn', value: fmtGWh(s.actual_mwh), cls: 'text-slate-900' },
    {
      label: 'Published forecast error',
      value: signedGWh(s.forecast_error_mwh),
      cls: (s.forecast_error_mwh ?? 0) > 0 ? 'text-orange-600' : 'text-emerald-600',
    },
    {
      label: 'Calibrated forecast error',
      value: signedGWh(s.calibrated_error_mwh),
      cls: (s.calibrated_error_mwh ?? 0) > 0 ? 'text-orange-600' : 'text-emerald-600',
    },
    { label: 'Hourly MAE, published', value: fmtMW(s.raw_mae_mw), cls: 'text-slate-900' },
    { label: 'Hourly MAE, calibrated', value: fmtMW(s.calibrated_mae_mw), cls: 'text-indigo-600' },
    { label: 'Hours inside P10–P90', value: fmtPct(s.band_coverage_pct), cls: 'text-slate-900' },
  ]
  const improvement = pctChange(s.raw_mae_mw, s.calibrated_mae_mw)
  return (
    <Card title="Hindsight: what actually happened" subtitle="Settled outturn, which the desk could not see at the gate">
      <dl className="divide-y divide-slate-100">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between py-2 text-sm">
            <dt className="text-slate-500">{r.label}</dt>
            <dd className={`num font-semibold ${r.cls}`}>{r.value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4">
        <Callout>
          {improvement !== null && improvement < 0 ? (
            <>
              Calibration cut the hourly error by <b>{fmtPct(-improvement)}</b> on this day.
            </>
          ) : (
            <>
              Calibration did not help on this day. The trailing scale (×{d.calibration.scale?.toFixed(2)}) did not match
              this day's conditions. Check the Accuracy tab for the month-level result.
            </>
          )}{' '}
          Positive error = the forecast promised more wind than arrived, so the gap had to be bought.
        </Callout>
      </div>
    </Card>
  )
}
