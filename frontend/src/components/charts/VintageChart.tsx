import { useMemo } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Num, Vintage } from '../../api/types'
import { fmtDayTime, fmtMW, fmtTime, tickGW } from '../../lib/format'
import { COLORS } from '../../lib/theme'
import { axisProps, gridProps, type TipRow, timeTicks, timeTitle, toMs, TooltipBox } from './common'

type Row = Record<string, number | null> & { t: number }

const style = {
  before: { stroke: COLORS.before, width: 1.25, dash: undefined },
  after: { stroke: COLORS.after, width: 1.5, dash: '4 3' },
  decision: { stroke: COLORS.forecast, width: 3, dash: undefined },
} as const

/** Every forecast published for the delivery day, coloured by when it arrived relative to the gate. */
export function VintageChart({
  vintages,
  actuals,
  showActual,
  height = 300,
}: {
  vintages: Vintage[]
  actuals: { time: string; actual_mw: Num }[]
  showActual: boolean
  height?: number
}) {
  const { rows, start, end } = useMemo(() => {
    const map = new Map<number, Row>()
    const at = (t: number) => map.get(t) ?? map.set(t, { t } as Row).get(t)!
    vintages.forEach((v, i) => v.points.forEach((p) => (at(toMs(p.time))[`v${i}`] = p.forecast_mw)))
    actuals.forEach((a) => (at(toMs(a.time)).actual = a.actual_mw))
    const rows = [...map.values()].sort((a, b) => a.t - b.t)
    const start = actuals.length ? toMs(actuals[0].time) : rows[0]?.t ?? 0
    return { rows, start, end: start + 24 * 3_600_000 }
  }, [vintages, actuals])

  // Draw order: earlier vintages underneath, the decision forecast on top.
  const order = vintages
    .map((v, i) => ({ v, i }))
    .sort((a, b) => ['before', 'after', 'decision'].indexOf(a.v.status) - ['before', 'after', 'decision'].indexOf(b.v.status))

  const decisionIdx = vintages.findIndex((v) => v.status === 'decision')
  const lastIdx = vintages.length - 1

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
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
            const first = vintages.findIndex((_, i) => r[`v${i}`] != null)
            if (first >= 0)
              tips.push({ label: `Earliest (${fmtDayTime(vintages[first].publish_time)})`, value: fmtMW(r[`v${first}`]), color: COLORS.before })
            if (decisionIdx >= 0 && r[`v${decisionIdx}`] != null)
              tips.push({ label: 'At the gate', value: fmtMW(r[`v${decisionIdx}`]), color: COLORS.forecast })
            const latest = [...vintages.keys()].reverse().find((i) => r[`v${i}`] != null)
            if (latest !== undefined && latest !== decisionIdx && vintages[latest].status === 'after')
              tips.push({ label: `Latest (${fmtDayTime(vintages[latest].publish_time)})`, value: fmtMW(r[`v${latest}`]), color: COLORS.after })
            if (showActual && r.actual != null) tips.push({ label: 'Outturn', value: fmtMW(r.actual), color: COLORS.actual })
            return tips.length ? <TooltipBox title={timeTitle(label as number)} rows={tips} /> : null
          }}
        />
        {order.map(({ v, i }) => (
          <Line
            key={v.publish_time}
            dataKey={`v${i}`}
            stroke={style[v.status].stroke}
            strokeWidth={i === lastIdx && v.status === 'after' ? 2 : style[v.status].width}
            strokeDasharray={style[v.status].dash}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
        ))}
        {showActual && <Line dataKey="actual" stroke={COLORS.actual} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />}
      </LineChart>
    </ResponsiveContainer>
  )
}
