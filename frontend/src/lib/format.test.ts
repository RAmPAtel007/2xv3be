import { describe, expect, it } from 'vitest'
import { fmtDay, fmtGWh, fmtMW, fmtTime, pctChange, shiftDate, signedGWh } from './format'

describe('format', () => {
  it('formats power and energy', () => {
    expect(fmtMW(12345.6)).toBe('12,346 MW')
    expect(fmtGWh(243534)).toBe('243.5 GWh')
    expect(fmtMW(null)).toBe('–')
  })

  it('signs energy errors', () => {
    expect(signedGWh(26646)).toBe('+26.6 GWh')
    expect(signedGWh(-10092)).toBe('−10.1 GWh')
  })

  it('shows times in UK local time across the clock change', () => {
    expect(fmtTime('2026-01-14T09:30:00Z')).toBe('09:30')
    expect(fmtTime('2026-07-14T08:50:00Z')).toBe('09:50')
  })

  it('handles calendar dates without timezone drift', () => {
    expect(fmtDay('2026-01-15')).toBe('Thu 15 Jan')
    expect(shiftDate('2026-01-31', 1)).toBe('2026-02-01')
  })

  it('computes percentage change', () => {
    expect(pctChange(2000, 1500)).toBe(-25)
    expect(pctChange(0, 5)).toBeNull()
  })
})
