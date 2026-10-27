import type { ReactNode } from 'react'
import { fmtDayTime } from '../../lib/format'

export const axisProps = {
  tickLine: false,
  axisLine: { stroke: '#e2e8f0' },
  tickMargin: 6,
} as const

export const gridProps = { stroke: '#e2e8f0', strokeDasharray: '3 3', vertical: false } as const

export const toMs = (iso: string) => new Date(iso).getTime()

/** Evenly spaced time ticks (ms) between start and end. */
export function timeTicks(start: number, end: number, stepHours: number): number[] {
  const out: number[] = []
  for (let t = start; t <= end; t += stepHours * 3_600_000) out.push(t)
  return out
}

export interface TipRow {
  label: string
  value: string
  color: string
}

export function TooltipBox({ title, rows }: { title: ReactNode; rows: TipRow[] }) {
  return (
    <div className="min-w-[180px] rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
      <div className="mb-1.5 font-semibold text-slate-800">{title}</div>
      <table className="w-full">
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td className="py-0.5 pr-3 text-slate-500">
                <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: r.color }} />
                {r.label}
              </td>
              <td className="num py-0.5 text-right font-medium text-slate-900">{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export const timeTitle = (t: number) => fmtDayTime(t)
