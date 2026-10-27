import { Clock } from 'lucide-react'
import type { Gate } from '../api/types'

export function GatePicker({ gates, value, onChange }: { gates: Gate[]; value: string; onChange: (t: string) => void }) {
  const isPreset = gates.some((g) => g.time === value)
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-slate-500">Decide at gate</span>
      <div className="inline-flex flex-wrap rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
        {gates.map((g) => (
          <button
            key={g.id}
            type="button"
            aria-label={`${g.label} ${g.time}`}
            aria-pressed={value === g.time}
            title={`${g.venue}: ${g.description}`}
            onClick={() => onChange(g.time)}
            className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
              value === g.time ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {g.label} <span className={`num ${value === g.time ? 'text-indigo-100' : 'text-slate-400'}`}>{g.time}</span>
          </button>
        ))}
        <label
          className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${
            isPreset ? 'text-slate-600' : 'bg-indigo-600 text-white'
          }`}
        >
          <Clock className="h-3.5 w-3.5" />
          <span className="sr-only">Custom gate time</span>
          <input
            type="time"
            step={1800}
            value={value}
            onChange={(e) => e.target.value && onChange(e.target.value.slice(0, 5))}
            className={`num w-[4.6rem] bg-transparent outline-none ${isPreset ? '' : '[color-scheme:dark]'}`}
          />
        </label>
      </div>
    </div>
  )
}
