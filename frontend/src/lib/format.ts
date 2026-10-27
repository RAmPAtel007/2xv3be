import type { Num } from '../api/types'

const TZ = 'Europe/London'

const timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: TZ })
const dayTimeFmt = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: TZ,
})
const dayFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
const longDayFmt = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

/** "09:30" in UK local time. */
export const fmtTime = (iso: string | number) => timeFmt.format(new Date(iso))
/** "Wed 14 Jan, 09:30" in UK local time. */
export const fmtDayTime = (iso: string | number) => dayTimeFmt.format(new Date(iso))

// Calendar dates (YYYY-MM-DD) are formatted at UTC noon so no timezone can shift them.
const atNoon = (d: string) => new Date(`${d}T12:00:00Z`)
/** "Thu 15 Jan" */
export const fmtDay = (d: string) => dayFmt.format(atNoon(d))
/** "Thursday 15 January 2026" */
export const fmtLongDay = (d: string) => longDayFmt.format(atNoon(d))

export function shiftDate(d: string, days: number): string {
  const x = atNoon(d)
  x.setUTCDate(x.getUTCDate() + days)
  return x.toISOString().slice(0, 10)
}

const nf0 = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 })
const nf1 = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

const missing = (v: Num | undefined): v is null | undefined => v === null || v === undefined || Number.isNaN(v)

export const fmtMW = (v: Num | undefined) => (missing(v) ? '–' : `${nf0.format(v)} MW`)
export const fmtGW = (mw: Num | undefined) => (missing(mw) ? '–' : `${nf1.format(mw / 1000)} GW`)
export const fmtGWh = (mwh: Num | undefined) => (missing(mwh) ? '–' : `${nf1.format(mwh / 1000)} GWh`)
export const fmtPct = (v: Num | undefined, digits = 0) => (missing(v) ? '–' : `${v.toFixed(digits)}%`)
export const fmtNum = (v: Num | undefined) => (missing(v) ? '–' : nf0.format(v))

export function signed(text: string, v: Num | undefined): string {
  if (missing(v)) return '–'
  return v > 0 ? `+${text}` : text.startsWith('-') ? `−${text.slice(1)}` : text
}

export const signedGWh = (mwh: Num | undefined) => signed(fmtGWh(mwh), mwh)
export const signedMW = (mw: Num | undefined) => signed(fmtMW(mw), mw)

/** Axis tick: 12,000 MW -> "12 GW". */
// Non-breaking space: Recharts wraps tick labels on normal spaces.
export const tickGW = (mw: number) => `${+(mw / 1000).toFixed(1)} GW`

export const pctChange = (from: Num | undefined, to: Num | undefined): number | null =>
  missing(from) || missing(to) || from === 0 ? null : ((to - from) / from) * 100
