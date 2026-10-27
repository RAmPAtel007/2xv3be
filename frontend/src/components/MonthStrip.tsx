import type { DailyRow } from '../api/types'
import { fmtDay, shiftDate, signedGWh } from '../lib/format'

/** Error as % of outturn mapped to a colour: orange = over-forecast (shortfall), green = under-forecast. */
function cellColor(errorMwh: number | null, actualMwh: number | null): string {
  if (errorMwh === null || !actualMwh) return '#f1f5f9'
  const pct = Math.min(Math.abs(errorMwh / actualMwh), 0.5) / 0.5
  const alpha = 0.12 + pct * 0.78
  return errorMwh > 0 ? `rgba(249, 115, 22, ${alpha})` : `rgba(16, 185, 129, ${alpha})`
}

/** One cell per decision day in the month, coloured by how wrong the published forecast turned out. */
export function MonthStrip({
  daily,
  selectedDecisionDate,
  onSelect,
  calibrated,
}: {
  daily: DailyRow[]
  selectedDecisionDate: string
  onSelect: (decisionDate: string) => void
  calibrated: boolean
}) {
  return (
    <div className="grid grid-cols-[repeat(16,minmax(0,1fr))] gap-1 sm:grid-cols-[repeat(31,minmax(0,1fr))]">
      {daily.map((d) => {
        const decision = shiftDate(d.delivery_date, -1)
        const err = calibrated ? d.calibrated_error_mwh : d.forecast_error_mwh
        const selected = decision === selectedDecisionDate
        return (
          <button
            key={d.delivery_date}
            type="button"
            onClick={() => onSelect(decision)}
            title={`Decide ${fmtDay(decision)} → deliver ${fmtDay(d.delivery_date)}\n${calibrated ? 'Calibrated' : 'Published'} error: ${signedGWh(err)}`}
            className={`num flex h-9 flex-col items-center justify-center rounded-md text-[11px] font-medium text-slate-800 transition ${
              selected ? 'ring-2 ring-indigo-600 ring-offset-1' : 'hover:ring-1 hover:ring-slate-400'
            }`}
            style={{ background: cellColor(err, d.actual_mwh) }}
          >
            {Number(decision.slice(8))}
          </button>
        )
      })}
    </div>
  )
}
