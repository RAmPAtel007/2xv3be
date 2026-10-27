import { ArrowDownUp, Download, Lightbulb } from 'lucide-react'
import { useMemo, useState } from 'react'
import { api, useApi } from '../api/client'
import type { Accuracy, DailyRow } from '../api/types'
import { DailyErrorChart, EnergyBadge, ErrorHistogram, HourOfDayChart, MonthChart } from '../components/charts/AccuracyCharts'
import { Callout, Card, ErrorBox, Kpi, Legend, Loading, Toggle } from '../components/ui'
import { fmtDay, fmtGW, fmtGWh, fmtMW, fmtPct, fmtTime, signedMW } from '../lib/format'
import { COLORS } from '../lib/theme'

const SERIES_LEGEND = [
  { label: 'Published forecast', color: COLORS.forecast, kind: 'bar' as const },
  { label: 'WindDesk calibrated', color: COLORS.calibrated, kind: 'bar' as const },
]

export function AccuracyPage({ gate, onOpenDay }: { gate: string; onOpenDay: (deliveryDate: string) => void }) {
  const acc = useApi<Accuracy>(api.accuracy(gate))
  const [showBand, setShowBand] = useState(true)

  if (acc.error) return <ErrorBox message={acc.error} />
  if (!acc.data) return <Loading label="Back-testing every January decision…" />

  const a = acc.data
  const { raw, calibrated: cal, persistence } = a.summary
  const overDays = a.daily.filter((d) => (d.forecast_error_mwh ?? 0) > 0).length

  return (
    <div className={`space-y-5 transition-opacity ${acc.loading ? 'opacity-60' : ''}`}>
      <Callout icon={<Lightbulb className="h-5 w-5" />}>
        Across {a.daily.length} January decisions at the <b>{a.gate_time}</b> gate, the published forecast promised more
        wind than arrived on <b>{overDays} days</b>. On average it ran <b>{fmtGW(raw.bias_mw)} high</b> (
        {fmtPct(((raw.bias_mw ?? 0) / (raw.mean_actual_mw ?? 1)) * 100)} of mean outturn). A desk that bought against it
        would have been short. WindDesk's calibration uses only data available at each decision. It removes that bias and
        cuts the typical hourly error by <b>{fmtPct(a.summary.calibration_gain_pct)}</b>.
      </Callout>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi
          label="MAE · published"
          value={fmtMW(raw.mae_mw)}
          detail={`${fmtPct(raw.nmae_pct, 1)} of mean outturn`}
          accent={COLORS.forecast}
          hint="Mean absolute error of the decision-time forecast over every hour of every January delivery day."
        />
        <Kpi
          label="MAE · calibrated"
          value={fmtMW(cal.mae_mw)}
          detail={`−${fmtPct(a.summary.calibration_gain_pct)} vs published`}
          tone="good"
          accent={COLORS.calibrated}
        />
        <Kpi
          label="Bias (forecast − outturn)"
          value={signedMW(raw.bias_mw)}
          detail={`Calibrated: ${signedMW(cal.bias_mw)}`}
          tone="bad"
          accent={COLORS.over}
          hint="Positive = over-forecast. The desk plans for wind that never arrives and has to buy the shortfall late."
        />
        <Kpi
          label="P90 absolute error"
          value={fmtMW(raw.p90_abs_error_mw)}
          detail={`Calibrated: ${fmtMW(cal.p90_abs_error_mw)}`}
          hint="9 hours out of 10 the error is smaller than this. A planning number for tail risk."
        />
        <Kpi
          label="P10–P90 band coverage"
          value={fmtPct(a.summary.band_coverage_pct)}
          detail={`Target ${a.summary.band_nominal_pct}% · back-tested`}
          tone="accent"
          accent={COLORS.band}
          hint="Share of outturns that fell inside the uncertainty band. Close to 80% means the band can be trusted for sizing risk."
        />
        <Kpi
          label="Skill vs persistence"
          value={fmtPct((a.summary.skill_vs_persistence ?? 0) * 100)}
          detail={`Calibrated: ${fmtPct((a.summary.calibrated_skill_vs_persistence ?? 0) * 100)} · naive MAE ${fmtGW(persistence.mae_mw)}`}
          tone="good"
          hint="1 − MAE / MAE of a naive forecast that holds the last known outturn flat. Shows the forecast adds real information."
        />
      </div>

      <Card
        title="January at a glance: forecast vs outturn"
        subtitle="Hourly decision-time forecasts for every delivery day. Drag the handles below the chart to zoom."
        actions={<Toggle checked={showBand} onChange={setShowBand} label="P10–P90 band" />}
      >
        <MonthChart series={a.timeseries} showBand={showBand} />
        <div className="mt-3">
          <Legend
            items={[
              { label: 'Published forecast', color: COLORS.forecast },
              { label: 'WindDesk calibrated', color: COLORS.calibrated },
              { label: 'Outturn', color: COLORS.actual },
              ...(showBand ? [{ label: 'P10–P90', color: COLORS.band, kind: 'area' as const }] : []),
            ]}
          />
        </div>
      </Card>

      <Card
        title="Daily energy error (GWh)"
        subtitle="Forecast minus outturn for each delivery day. Above zero = shortfall to buy. Click a day to open it in the Decision Desk."
      >
        <DailyErrorChart daily={a.daily} onSelect={onOpenDay} />
        <div className="mt-3">
          <Legend items={SERIES_LEGEND} />
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Error by hour of day" subtitle="MAE per delivery hour (UK time)">
          <HourOfDayChart byHour={a.by_hour} />
          <div className="mt-3">
            <Legend items={SERIES_LEGEND} />
          </div>
        </Card>
        <Card title="Error distribution" subtitle="Hours by forecast − outturn (500 MW bins). The published forecast sits right of zero.">
          <ErrorHistogram bins={a.histogram} />
          <div className="mt-3">
            <Legend items={SERIES_LEGEND} />
          </div>
        </Card>
      </div>

      <DailyTable daily={a.daily} gate={gate} onOpenDay={onOpenDay} />
    </div>
  )
}

type SortKey = 'delivery_date' | 'forecast_error_mwh' | 'raw_mae_mw'

function DailyTable({ daily, gate, onOpenDay }: { daily: DailyRow[]; gate: string; onOpenDay: (d: string) => void }) {
  const [sort, setSort] = useState<SortKey>('delivery_date')
  const rows = useMemo(() => {
    const out = [...daily]
    if (sort === 'delivery_date') return out
    return out.sort((x, y) => Math.abs(y[sort] ?? 0) - Math.abs(x[sort] ?? 0))
  }, [daily, sort])

  const head = (key: SortKey, label: string) => (
    <button
      type="button"
      onClick={() => setSort(key)}
      className={`inline-flex items-center gap-1 ${sort === key ? 'text-indigo-600' : ''}`}
    >
      {label} <ArrowDownUp className="h-3 w-3" />
    </button>
  )

  return (
    <Card
      title="Day-by-day back-test"
      subtitle="Sort by the largest misses to find the days worth a post-mortem"
      actions={
        <a
          href={api.exportCsv(gate)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <Download className="h-3.5 w-3.5" /> Export hourly CSV
        </a>
      }
    >
      <div className="-mx-4 overflow-x-auto sm:-mx-5">
        <table className="num w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs font-medium text-slate-500">
              <th className="px-4 py-2 sm:px-5">{head('delivery_date', 'Delivery day')}</th>
              <th className="px-3 py-2">Forecast used</th>
              <th className="px-3 py-2 text-right">Published</th>
              <th className="px-3 py-2 text-right">Calibrated</th>
              <th className="px-3 py-2 text-right">Outturn</th>
              <th className="px-3 py-2 text-right">{head('forecast_error_mwh', 'Published error')}</th>
              <th className="px-3 py-2 text-right">Calibrated error</th>
              <th className="px-3 py-2 text-right">{head('raw_mae_mw', 'MAE pub. / cal.')}</th>
              <th className="px-4 py-2 text-right sm:px-5">In band</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr
                key={d.delivery_date}
                onClick={() => onOpenDay(d.delivery_date)}
                className="cursor-pointer border-b border-slate-100 hover:bg-indigo-50/50"
              >
                <td className="px-4 py-2 font-medium sm:px-5">{fmtDay(d.delivery_date)}</td>
                <td className="px-3 py-2 text-slate-500">{d.publish_time ? `${fmtTime(d.publish_time)} D-1` : '–'}</td>
                <td className="px-3 py-2 text-right">{fmtGWh(d.forecast_mwh)}</td>
                <td className="px-3 py-2 text-right text-indigo-600">{fmtGWh(d.calibrated_mwh)}</td>
                <td className="px-3 py-2 text-right font-medium">{fmtGWh(d.actual_mwh)}</td>
                <td className="px-3 py-2 text-right">
                  <EnergyBadge mwh={d.forecast_error_mwh} />
                </td>
                <td className="px-3 py-2 text-right">
                  <EnergyBadge mwh={d.calibrated_error_mwh} />
                </td>
                <td className="px-3 py-2 text-right text-slate-600">
                  {fmtMW(d.raw_mae_mw).replace(' MW', '')} / <span className="text-indigo-600">{fmtMW(d.calibrated_mae_mw)}</span>
                </td>
                <td className="px-4 py-2 text-right sm:px-5">{fmtPct(d.band_coverage_pct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
