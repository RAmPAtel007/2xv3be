import { AlertTriangle, Info, Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'

export function Card({
  title,
  subtitle,
  actions,
  children,
  className = '',
}: {
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`card p-4 sm:p-5 ${className}`}>
      {(title || actions) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <h2 className="card-title">{title}</h2>}
            {subtitle && <p className="card-sub">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  )
}

type Tone = 'neutral' | 'good' | 'bad' | 'accent'

const toneClass: Record<Tone, string> = {
  neutral: 'text-slate-500',
  good: 'text-emerald-600',
  bad: 'text-orange-600',
  accent: 'text-indigo-600',
}

export function Kpi({
  label,
  value,
  detail,
  tone = 'neutral',
  accent,
  hint,
}: {
  label: string
  value: ReactNode
  detail?: ReactNode
  tone?: Tone
  accent?: string
  hint?: string
}) {
  return (
    <div className="card relative overflow-hidden p-4">
      {accent && <span className="absolute inset-y-0 left-0 w-1" style={{ background: accent }} />}
      <div className="flex items-center gap-1 text-xs font-medium text-slate-500">
        {label}
        {hint && <InfoTip text={hint} />}
      </div>
      <div className="num mt-1.5 text-2xl font-semibold tracking-tight text-slate-900">{value}</div>
      {detail && <div className={`num mt-1 text-xs ${toneClass[tone]}`}>{detail}</div>}
    </div>
  )
}

export function InfoTip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex">
      <Info className="h-3.5 w-3.5 text-slate-400" aria-hidden />
      <span className="sr-only">{text}</span>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-5 z-20 hidden w-64 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-normal leading-relaxed text-white shadow-lg group-hover:block"
      >
        {text}
      </span>
    </span>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="inline-flex cursor-pointer select-none items-center gap-2 text-xs font-medium text-slate-600">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 rounded-full transition-colors ${checked ? 'bg-indigo-600' : 'bg-slate-300'}`}
      >
        <span
          className={`absolute left-0 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`}
        />
      </button>
      {label}
    </label>
  )
}

export interface LegendItem {
  label: string
  color: string
  kind?: 'line' | 'dash' | 'area' | 'bar'
}

export function Legend({ items }: { items: LegendItem[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-600">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-1.5">
          {it.kind === 'area' || it.kind === 'bar' ? (
            <span className="h-3 w-3 rounded-sm" style={{ background: it.color, opacity: it.kind === 'area' ? 0.5 : 1 }} />
          ) : (
            <svg width="18" height="6" aria-hidden>
              <line
                x1="0"
                y1="3"
                x2="18"
                y2="3"
                stroke={it.color}
                strokeWidth={2.5}
                strokeDasharray={it.kind === 'dash' ? '4 3' : undefined}
              />
            </svg>
          )}
          {it.label}
        </li>
      ))}
    </ul>
  )
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex h-64 items-center justify-center gap-2 text-sm text-slate-500">
      <Loader2 className="h-4 w-4 animate-spin" /> {label}
    </div>
  )
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>Could not load data: {message}</span>
    </div>
  )
}

export function Callout({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 text-sm leading-relaxed text-slate-700">
      {icon && <span className="mt-0.5 shrink-0 text-indigo-600">{icon}</span>}
      <div>{children}</div>
    </div>
  )
}
