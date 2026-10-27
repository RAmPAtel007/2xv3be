// Mirrors the payloads built in backend/winddesk/service.py. Times are UTC ISO strings.

export type Num = number | null

export interface Gate {
  id: string
  label: string
  venue: string
  time: string
  description: string
}

export interface Meta {
  product: string
  version: string
  timezone: string
  decision_window: {
    first_decision_date: string
    last_decision_date: string
    first_delivery_date: string
    last_delivery_date: string
    default_decision_date: string
  }
  gates: Gate[]
  default_gate_time: string
  calibration: { window_days: number; band_low_q: number; band_high_q: number; min_forecast_mw: number }
  data: {
    fetched_at: string | null
    snapshot_start: string | null
    snapshot_end: string | null
    sources: Record<string, string>
    quality: Record<string, number | string | string[]>
  }
}

export interface Metrics {
  n: number
  mae_mw: Num
  rmse_mw: Num
  bias_mw: Num
  nmae_pct: Num
  p50_abs_error_mw: Num
  p90_abs_error_mw: Num
  p99_abs_error_mw: Num
  max_over_forecast_mw: Num
  max_under_forecast_mw: Num
  r2: Num
  mean_actual_mw: Num
}

export interface FrameSummary {
  raw: Metrics
  calibrated: Metrics
  persistence: Metrics
  skill_vs_persistence: Num
  calibrated_skill_vs_persistence: Num
  calibration_gain_pct: Num
  band_coverage_pct: Num
  band_nominal_pct: number
  horizon_min_h: Num
  horizon_max_h: Num
}

export interface HourlyPoint {
  time: string
  forecast_mw: Num
  calibrated_mw: Num
  p10_mw: Num
  p90_mw: Num
  actual_mw: Num
  horizon_h?: Num
  publish_time?: string | null
}

export interface Vintage {
  publish_time: string
  status: 'before' | 'decision' | 'after'
  points: { time: string; forecast_mw: Num }[]
}

export interface Decision {
  decision_date: string
  delivery_date: string
  gate_time: string
  decision_time: string
  forecast_publish_times: string[]
  minutes_since_publish: Num
  next_publish_time: string | null
  horizon_min_h: Num
  horizon_max_h: Num
  calibration: {
    scale: Num
    ratio_p10: Num
    ratio_p90: Num
    samples: number
    history_from: string | null
    history_to: string | null
  }
  summary: {
    forecast_mwh: Num
    calibrated_mwh: Num
    p10_mwh: Num
    p90_mwh: Num
    energy_at_risk_mwh: Num
    peak_forecast_mw: Num
    trough_forecast_mw: Num
    actual_mwh: Num
    forecast_error_mwh: Num
    calibrated_error_mwh: Num
    raw_mae_mw: Num
    calibrated_mae_mw: Num
    raw_bias_mw: Num
    band_coverage_pct: Num
  }
  hourly: HourlyPoint[]
  actuals: { time: string; actual_mw: Num }[]
  vintages: Vintage[]
}

export interface DailyRow {
  delivery_date: string
  publish_time: string | null
  forecast_mwh: Num
  calibrated_mwh: Num
  actual_mwh: Num
  forecast_error_mwh: Num
  calibrated_error_mwh: Num
  raw_mae_mw: Num
  calibrated_mae_mw: Num
  max_abs_error_mw: Num
  band_coverage_pct: Num
}

export interface Accuracy {
  gate_time: string
  first_delivery_date: string
  last_delivery_date: string
  summary: FrameSummary
  daily: DailyRow[]
  by_hour: { hour: number; raw_mae_mw: Num; calibrated_mae_mw: Num; raw_bias_mw: Num; calibrated_bias_mw: Num }[]
  histogram: { bin_start: number; bin_end: number; raw: number; calibrated: number }[]
  timeseries: HourlyPoint[]
}

export interface GateStats {
  id: string
  label: string
  time: string
  horizon_min_h: Num
  horizon_max_h: Num
  raw_mae_mw: Num
  calibrated_mae_mw: Num
  raw_bias_mw: Num
  raw_nmae_pct: Num
  p90_abs_error_mw: Num
  band_coverage_pct: Num
}

export interface LeadTime {
  first_delivery_date: string
  last_delivery_date: string
  by_horizon: { horizon_h: number; n: number; mae_mw: Num; rmse_mw: Num; bias_mw: Num; p90_abs_error_mw: Num }[]
  gates: GateStats[]
  decision_time_sweep: { gate_time: string; raw_mae_mw: Num; calibrated_mae_mw: Num; band_coverage_pct: Num }[]
}
