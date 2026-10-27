import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { GateStats, LeadTime } from '../../api/types'
import { fmtMW, signedMW, tickGW } from '../../lib/format'
import { COLORS } from '../../lib/theme'
import { axisProps, gridProps, TooltipBox } from './common'

export const GATE_SHADES = ['#f59e0b', '#6366f1', '#10b981']

/** Error vs lead time, with each auction's traded lead-time window drawn as a strip along the top. */
export function HorizonChart({ buckets, gates }: { buckets: LeadTime['by_horizon']; gates: GateStats[] }) {
  const peak = Math.max(...buckets.map((b) => b.p90_abs_error_mw ?? 0))
  const top = Math.ceil((peak * 1.45) / 1000) * 1000
  const strip = top * 0.06

  return (
    <ResponsiveContainer width="100%" height={340}>
      <LineChart data={buckets} margin={{ top: 8, right: 12, bottom: 12, left: 0 }}>
        <CartesianGrid {...gridProps} />
        {gates.map((g, i) => {
          const y2 = top - i * strip * 1.25 - strip * 0.2
          return (
            <ReferenceArea
              key={g.id}
              x1={g.horizon_min_h ?? 0}
              x2={g.horizon_max_h ?? 0}
              y1={y2 - strip}
              y2={y2}
              fill={GATE_SHADES[i % GATE_SHADES.length]}
              fillOpacity={0.22}
              stroke={GATE_SHADES[i % GATE_SHADES.length]}
              strokeOpacity={0.5}
              label={{ value: `${g.label} ${g.time}`, fontSize: 10, fill: '#334155' }}
            />
          )
        })}
        <XAxis
          dataKey="horizon_h"
          type="number"
          domain={[0, 'dataMax']}
          ticks={[0, 6, 12, 18, 24, 30, 36, 42, 48, 54, 60, 66]}
          {...axisProps}
          label={{ value: 'Lead time (hours between publication and delivery)', position: 'insideBottom', dy: 14, fontSize: 11, fill: '#64748b' }}
        />
        <YAxis tickFormatter={tickGW} width={56} domain={[0, top]} {...axisProps} />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null
            const r = payload[0].payload
            return (
              <TooltipBox
                title={`${label}–${Number(label) + 1} h ahead · ${r.n} forecasts`}
                rows={[
                  { label: 'MAE', value: fmtMW(r.mae_mw), color: COLORS.forecast },
                  { label: 'P90 abs error', value: fmtMW(r.p90_abs_error_mw), color: COLORS.over },
                  { label: 'Bias', value: signedMW(r.bias_mw), color: COLORS.persistence },
                ]}
              />
            )
          }}
        />
        <Line dataKey="p90_abs_error_mw" stroke={COLORS.over} strokeWidth={2} dot={false} isAnimationActive={false} />
        <Line dataKey="mae_mw" stroke={COLORS.forecast} strokeWidth={2.5} dot={false} isAnimationActive={false} />
        <Line dataKey="bias_mw" stroke={COLORS.persistence} strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))
const fmtMinutes = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

export function SweepChart({ sweep, gates }: { sweep: LeadTime['decision_time_sweep']; gates: GateStats[] }) {
  const rows = sweep.map((s) => ({ ...s, m: toMinutes(s.gate_time) }))
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={rows} margin={{ top: 24, right: 16, bottom: 12, left: 0 }}>
        <CartesianGrid {...gridProps} />
        <XAxis
          dataKey="m"
          type="number"
          domain={[0, 1410]}
          ticks={[0, 120, 240, 360, 480, 600, 720, 840, 960, 1080, 1200, 1320]}
          tickFormatter={fmtMinutes}
          {...axisProps}
          label={{ value: 'Decision time on the day before delivery (UK)', position: 'insideBottom', dy: 14, fontSize: 11, fill: '#64748b' }}
        />
        <YAxis tickFormatter={tickGW} width={56} {...axisProps} domain={[0, 'auto']} />
        {gates.map((g, i) => (
          <ReferenceLine
            key={g.id}
            x={toMinutes(g.time)}
            stroke={GATE_SHADES[i % GATE_SHADES.length]}
            strokeDasharray="3 3"
            label={{ value: g.time, position: 'top', fontSize: 10, fill: '#475569', dx: i === 0 ? -14 : i === 1 ? 14 : 0 }}
          />
        ))}
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const r = payload[0].payload
            return (
              <TooltipBox
                title={`Decide at ${r.gate_time}`}
                rows={[
                  { label: 'Published MAE', value: fmtMW(r.raw_mae_mw), color: COLORS.forecast },
                  { label: 'Calibrated MAE', value: fmtMW(r.calibrated_mae_mw), color: COLORS.calibrated },
                ]}
              />
            )
          }}
        />
        <Line type="stepAfter" dataKey="raw_mae_mw" stroke={COLORS.forecast} strokeWidth={2.5} dot={false} isAnimationActive={false} />
        <Line type="stepAfter" dataKey="calibrated_mae_mw" stroke={COLORS.calibrated} strokeWidth={2.5} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}
