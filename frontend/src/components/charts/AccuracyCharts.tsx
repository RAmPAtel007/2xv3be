import { useMemo } from 'react'
import {
  Area,
  Bar,
  BarChart,
  Brush,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Accuracy, DailyRow, HourlyPoint } from '../../api/types'
import { fmtDay, fmtMW, signedGWh, signedMW, tickGW } from '../../lib/format'
import { COLORS } from '../../lib/theme'
import { axisProps, gridProps, type TipRow, timeTitle, toMs, TooltipBox } from './common'

const dayTick = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/London' })

export function MonthChart({ series, showBand }: { series: HourlyPoint[]; showBand: boolean }) {
  const rows = useMemo(
    () =>
      series.map((p) => ({
        t: toMs(p.time),
        forecast: p.forecast_mw,
        calibrated: p.calibrated_mw,
        actual: p.actual_mw,
        band: p.p10_mw !== null && p.p90_mw !== null ? [p.p10_mw, p.p90_mw] : undefined,
      })),
    [series],
  )
  return (
    <ResponsiveContainer width="100%" height={360}>
      <ComposedChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid {...gridProps} />
        <XAxis
          dataKey="t"
          type="number"
          scale="time"
          domain={['dataMin', 'dataMax']}
          tickFormatter={(t) => dayTick.format(t)}
          minTickGap={24}
          {...axisProps}
        />
        <YAxis tickFormatter={tickGW} width={56} {...axisProps} />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null
            const r = payload[0].payload
            return (
              <TooltipBox
                title={timeTitle(label as number)}
                rows={[
                  { label: 'Published', value: fmtMW(r.forecast), color: COLORS.forecast },
                  { label: 'Calibrated', value: fmtMW(r.calibrated), color: COLORS.calibrated },
                  { label: 'Outturn', value: fmtMW(r.actual), color: COLORS.actual },
                ]}
              />
            )
          }}
        />
        {showBand && <Area dataKey="band" stroke="none" fill={COLORS.band} fillOpacity={0.35} isAnimationActive={false} />}
        <Line dataKey="forecast" stroke={COLORS.forecast} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        <Line dataKey="calibrated" stroke={COLORS.calibrated} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        <Line dataKey="actual" stroke={COLORS.actual} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        <Brush dataKey="t" height={26} stroke="#a5b4fc" travellerWidth={8} tickFormatter={(t) => dayTick.format(t)} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

export function DailyErrorChart({ daily, onSelect }: { daily: DailyRow[]; onSelect: (deliveryDate: string) => void }) {
  const rows = daily.map((d) => ({
    date: d.delivery_date,
    raw: d.forecast_error_mwh,
    calibrated: d.calibrated_error_mwh,
  }))
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart
        data={rows}
        margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
        barGap={1}
        onClick={(e) => e?.activeLabel && onSelect(String(e.activeLabel))}
        className="cursor-pointer"
      >
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="date" tickFormatter={(d) => fmtDay(d).split(' ').slice(1).join(' ')} minTickGap={16} {...axisProps} />
        <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}`} width={40} {...axisProps} />
        <ReferenceLine y={0} stroke="#94a3b8" />
        <Tooltip
          cursor={{ fill: '#eef2ff' }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null
            const r = payload[0].payload
            return (
              <TooltipBox
                title={`Delivery ${fmtDay(String(label))} · click to open`}
                rows={[
                  { label: 'Published error', value: signedGWh(r.raw), color: COLORS.forecast },
                  { label: 'Calibrated error', value: signedGWh(r.calibrated), color: COLORS.calibrated },
                ]}
              />
            )
          }}
        />
        <Bar dataKey="raw" fill={COLORS.forecast} radius={[2, 2, 0, 0]} isAnimationActive={false} />
        <Bar dataKey="calibrated" fill={COLORS.calibrated} radius={[2, 2, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function HourOfDayChart({ byHour }: { byHour: Accuracy['by_hour'] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={byHour} margin={{ top: 8, right: 12, bottom: 0, left: 0 }} barGap={1}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="hour" tickFormatter={(h) => `${String(h).padStart(2, '0')}`} interval={2} {...axisProps} />
        <YAxis tickFormatter={tickGW} width={56} {...axisProps} />
        <Tooltip
          cursor={{ fill: '#f1f5f9' }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null
            const r = payload[0].payload
            const tips: TipRow[] = [
              { label: 'Published MAE', value: fmtMW(r.raw_mae_mw), color: COLORS.forecast },
              { label: 'Calibrated MAE', value: fmtMW(r.calibrated_mae_mw), color: COLORS.calibrated },
              { label: 'Published bias', value: signedMW(r.raw_bias_mw), color: COLORS.over },
            ]
            return <TooltipBox title={`${String(label).padStart(2, '0')}:00 – ${String(Number(label) + 1).padStart(2, '0')}:00`} rows={tips} />
          }}
        />
        <Bar dataKey="raw_mae_mw" fill={COLORS.forecast} radius={[2, 2, 0, 0]} isAnimationActive={false} />
        <Bar dataKey="calibrated_mae_mw" fill={COLORS.calibrated} radius={[2, 2, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function ErrorHistogram({ bins }: { bins: Accuracy['histogram'] }) {
  const rows = bins.map((b) => ({ ...b, mid: (b.bin_start + b.bin_end) / 2 }))
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }} barGap={0} barCategoryGap={1}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="mid" tickFormatter={(v) => `${v > 0 ? '+' : ''}${(v / 1000).toFixed(1)}k`} interval={3} {...axisProps} />
        <YAxis width={32} {...axisProps} />
        <ReferenceLine x={rows.find((r) => r.bin_start <= 0 && r.bin_end > 0)?.mid} stroke="#64748b" strokeDasharray="3 3" />
        <Tooltip
          cursor={{ fill: '#f1f5f9' }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const r = payload[0].payload
            return (
              <TooltipBox
                title={`Error ${fmtMW(r.bin_start)} to ${fmtMW(r.bin_end)}`}
                rows={[
                  { label: 'Published (hours)', value: String(r.raw), color: COLORS.forecast },
                  { label: 'Calibrated (hours)', value: String(r.calibrated), color: COLORS.calibrated },
                ]}
              />
            )
          }}
        />
        <Bar dataKey="raw" fill={COLORS.forecast} fillOpacity={0.75} isAnimationActive={false} />
        <Bar dataKey="calibrated" fill={COLORS.calibrated} fillOpacity={0.85} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function EnergyBadge({ mwh }: { mwh: number | null }) {
  if (mwh === null) return <span className="text-slate-400">–</span>
  const over = mwh > 0
  return (
    <span className={`num font-medium ${over ? 'text-orange-600' : 'text-emerald-600'}`} title={over ? 'Over-forecast: shortfall' : 'Under-forecast: surplus'}>
      {signedGWh(mwh)}
    </span>
  )
}
