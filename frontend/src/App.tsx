import { BookOpen, Gauge, LayoutDashboard, Timer } from 'lucide-react'
import { api, useApi } from './api/client'
import type { Meta } from './api/types'
import { GatePicker } from './components/GatePicker'
import { ErrorBox, Loading } from './components/ui'
import { shiftDate } from './lib/format'
import { useQueryState } from './lib/useQueryState'
import { AccuracyPage } from './pages/AccuracyPage'
import { DecisionDesk } from './pages/DecisionDesk'
import { MethodPage } from './pages/MethodPage'
import { TimingPage } from './pages/TimingPage'

const TABS = [
  { id: 'decision', label: 'Decision Desk', icon: LayoutDashboard, blurb: 'What to expect from wind tomorrow, at the moment you trade' },
  { id: 'accuracy', label: 'Forecast Accuracy', icon: Gauge, blurb: 'How far to trust the forecast: January back-test' },
  { id: 'timing', label: 'Timing & Lead Time', icon: Timer, blurb: 'How much a later decision buys you' },
  { id: 'method', label: 'Data & Method', icon: BookOpen, blurb: 'Sources, rules and quality checks' },
] as const

type TabId = (typeof TABS)[number]['id']

export default function App() {
  const meta = useApi<Meta>(api.meta())
  const [q, setQ] = useQueryState()

  const tab = (TABS.find((t) => t.id === q.get('tab'))?.id ?? 'decision') as TabId
  const m = meta.data
  const gate = q.get('gate') ?? m?.default_gate_time ?? '09:50'
  const date = q.get('date') ?? m?.decision_window.default_decision_date ?? '2026-01-26'

  const openDay = (deliveryDate: string) => setQ({ tab: 'decision', date: shiftDate(deliveryDate, -1) }, true)

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <img src="/favicon.svg" alt="" className="h-8 w-8" />
            <div>
              <div className="text-base font-semibold tracking-tight text-slate-900">WindDesk</div>
              <div className="text-xs text-slate-500">Day-ahead wind forecast intelligence · GB national wind</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="pill bg-indigo-50 text-indigo-700">Pilot · January 2026 decisions</span>
            <span className="pill hidden bg-slate-100 text-slate-600 sm:inline-flex">Elexon BMRS · FUELHH + WINDFOR</span>
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 sm:px-6" aria-label="Views">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setQ({ tab: t.id }, true)}
              className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                tab === t.id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
              aria-current={tab === t.id ? 'page' : undefined}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500">{TABS.find((t) => t.id === tab)?.blurb}</p>
          {m && (tab === 'decision' || tab === 'accuracy') && (
            <GatePicker gates={m.gates} value={gate} onChange={(g) => setQ({ gate: g })} />
          )}
        </div>

        {meta.error && <ErrorBox message={meta.error} />}
        {!m && !meta.error && <Loading />}
        {m && tab === 'decision' && <DecisionDesk meta={m} date={date} gate={gate} onDate={(d) => setQ({ date: d })} />}
        {m && tab === 'accuracy' && <AccuracyPage gate={gate} onOpenDay={openDay} />}
        {m && tab === 'timing' && <TimingPage />}
        {m && tab === 'method' && <MethodPage meta={m} />}
      </main>

      <footer className="mx-auto max-w-7xl px-4 pb-8 pt-2 text-xs text-slate-400 sm:px-6">
        Contains BMRS data © Elexon Limited copyright and database right 2026. Times shown in UK local time. Pilot for
        evaluation, not trading advice.
      </footer>
    </div>
  )
}
