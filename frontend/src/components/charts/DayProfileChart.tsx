import { useMemo } from 'react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { HourlyPoint, Num } from '../../api/types'
import { fmtMW, fmtTime, tickGW } from '../../lib/format'
import { COLORS } from '../../lib/theme'
import { axisProps, gridProps, type TipRow, timeTicks, timeTitle, toMs, TooltipBox } from './common'

interface Row {
  t: number
  forecast?: Num
  calibrated?: Num
  band?: [number, number]
  actual?: Num
}

/** Hourly forecasts and half-hourly outturn on one time axis. */
export function mergeProfile(hourly: HourlyPoint[], actuals: { time: string; actual_mw: Num }[]): Row[] {
  const rows = new Map<number, Row>()
  const at = (t: number) => rows.get(t) ?? rows.set(t, { t }).get(t)!
  for (const h of hourly) {
    const r = at(toMs(h.time))
    r.forecast = h.forecast_mw
    r.calibrated = h.calibrated_mw
    if (h.p10_mw !== null && h.p90_mw !== null) r.band = [h.p10_mw, h.p90_mw]
  }
  for (const a of actuals) at(toMs(a.time)).actual = a.actual_mw
  return [...rows.values()].sort((a, b) => a.t - b.t)
}

export function DayProfileChart({
  hourly,
  actuals,
  showActual,
  height = 340,
}: {
  hourly: HourlyPoint[]
  actuals: { time: string; actual_mw: Num }[]
  showActual: boolean
  height?: number
}) {
  const rows = useMemo(() => mergeProfile(hourly, actuals), [hourly, actuals])
  if (!rows.length) return null
  const start = rows[0].t
  const end = start + 24 * 3_600_000

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid {...gridProps} />
        <XAxis
          dataKey="t"
          type="number"
          scale="time"
          domain={[start, end]}
          ticks={timeTicks(start, end, 3)}
          tickFormatter={fmtTime}
          {...axisProps}
        />
        <YAxis tickFormatter={tickGW} width={56} {...axisProps} />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null
            const r = payload[0].payload as Row
            const tips: TipRow[] = []
            if (r.forecast != null) tips.push({ label: 'Published forecast', value: fmtMW(r.forecast), color: COLORS.forecast })
            if (r.calibrated != null) tips.push({ label: 'Calibrated', value: fmtMW(r.calibrated), color: COLORS.calibrated })
            if (r.band) tips.push({ label: 'P10 – P90', value: `${fmtMW(r.band[0])} – ${fmtMW(r.band[1])}`, color: COLORS.band })
            if (showActual && r.actual != null) tips.push({ label: 'Outturn', value: fmtMW(r.actual), color: COLORS.actual })
            return tips.length ? <TooltipBox title={timeTitle(label as number)} rows={tips} /> : null
          }}
        />
        <ReferenceLine y={0} stroke="#cbd5e1" />
        <Area dataKey="band" stroke="none" fill={COLORS.band} fillOpacity={0.35} connectNulls isAnimationActive={false} />
        <Line dataKey="forecast" stroke={COLORS.forecast} strokeWidth={2} strokeDasharray="6 4" dot={false} connectNulls isAnimationActive={false} />
        <Line dataKey="calibrated" stroke={COLORS.calibrated} strokeWidth={2.5} dot={false} connectNulls isAnimationActive={false} />
        {showActual && (
          <Line dataKey="actual" stroke={COLORS.actual} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  )
}
