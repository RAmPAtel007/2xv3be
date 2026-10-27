// One colour per concept, used consistently by every chart.
export const COLORS = {
  forecast: '#0ea5e9', // published WINDFOR forecast
  calibrated: '#4f46e5', // WindDesk calibrated forecast
  band: '#a5b4fc', // P10-P90 range
  actual: '#0f172a', // metered outturn
  persistence: '#94a3b8',
  before: '#cbd5e1', // vintages published before the gate
  after: '#f59e0b', // vintages published after the gate (hindsight)
  over: '#f97316', // over-forecast = shortfall risk
  under: '#10b981', // under-forecast = surplus
  grid: '#e2e8f0',
} as const
