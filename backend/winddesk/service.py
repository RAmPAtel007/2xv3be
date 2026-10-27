"""Builds API payloads from the analytics layer. Pure functions of (data, inputs), cached."""

from __future__ import annotations

import math
from datetime import date, time, timedelta
from functools import lru_cache

import pandas as pd

from winddesk import __version__
from winddesk.analytics.calendar import date_range, day_bounds, decision_time, local_date
from winddesk.analytics.leadtime import error_by_horizon, forecast_actual_pairs
from winddesk.analytics.metrics import error_metrics, histogram, skill_score
from winddesk.analytics.selection import decision_forecasts, forecast_vintages
from winddesk.analytics.uncertainty import (
    MIN_RATIO_FORECAST_MW,
    apply_band,
    band_coverage,
    trailing_calibration,
)
from winddesk.config import (
    BAND_HIGH_Q,
    BAND_LOW_Q,
    CALIBRATION_DAYS,
    DECISION_END,
    DECISION_START,
    DEFAULT_DECISION_DATE,
    DEFAULT_GATE_TIME,
    GATES,
    SNAPSHOT_END,
    SNAPSHOT_START,
    UK_TZ,
)
from winddesk.data.repository import load_dataset

ONE_DAY = timedelta(days=1)
DELIVERY_DATES = date_range(DECISION_START + ONE_DAY, DECISION_END + ONE_DAY)
# Every delivery day in the snapshot; December only feeds the trailing calibration.
HISTORY_DATES = date_range(SNAPSHOT_START, SNAPSHOT_END)
# Every half-hour of D-1 plus the exact gate times, so the chart steps line up with the gates.
SWEEP_TIMES = sorted({time(h, m) for h in range(24) for m in (0, 30)} | {g.time for g in GATES})


# --- formatting helpers -------------------------------------------------------------


def num(value, digits: int = 1) -> float | None:
    if value is None:
        return None
    value = float(value)
    return None if math.isnan(value) else round(value, digits)


def iso(ts) -> str | None:
    if ts is None or pd.isna(ts):
        return None
    return pd.Timestamp(ts).tz_convert("UTC").strftime("%Y-%m-%dT%H:%M:%SZ")


def hhmm(t: time) -> str:
    return t.strftime("%H:%M")


def rounded_metrics(m: dict) -> dict:
    return {k: (v if k == "n" else num(v, 3 if k == "r2" else 1)) for k, v in m.items()}


# --- cached analytics -----------------------------------------------------------------


@lru_cache(maxsize=64)
def decision_frame(gate_time: time) -> pd.DataFrame:
    """Decision-time forecast, calibration and outturn for every hour of the January window."""
    ds = load_dataset()
    decisions = decision_forecasts(ds.forecasts, ds.actuals, HISTORY_DATES, gate_time)
    calibration = trailing_calibration(decisions, DELIVERY_DATES)
    in_window = decisions[decisions["delivery_date"].isin(DELIVERY_DATES)]
    return apply_band(in_window, calibration)


@lru_cache(maxsize=1)
def daily_actual_mwh() -> dict[date, float]:
    actuals = load_dataset().actuals
    by_day = actuals.groupby(local_date(actuals["start_time"]))["generation_mw"].sum() * 0.5
    return by_day.to_dict()


def frame_summary(frame: pd.DataFrame) -> dict:
    raw = error_metrics(frame["forecast_mw"], frame["actual_mw"])
    cal = error_metrics(frame["calibrated_mw"], frame["actual_mw"])
    pers = error_metrics(frame["persistence_mw"], frame["actual_mw"])
    return {
        "raw": rounded_metrics(raw),
        "calibrated": rounded_metrics(cal),
        "persistence": rounded_metrics(pers),
        "skill_vs_persistence": num(skill_score(raw.get("mae_mw"), pers.get("mae_mw")), 3),
        "calibrated_skill_vs_persistence": num(skill_score(cal.get("mae_mw"), pers.get("mae_mw")), 3),
        "calibration_gain_pct": num(
            (1 - cal["mae_mw"] / raw["mae_mw"]) * 100 if raw.get("mae_mw") and cal.get("mae_mw") else None
        ),
        "band_coverage_pct": num(band_coverage(frame)),
        "band_nominal_pct": round((BAND_HIGH_Q - BAND_LOW_Q) * 100),
        "horizon_min_h": num(frame["horizon_h"].min()),
        "horizon_max_h": num(frame["horizon_h"].max()),
    }


# --- endpoints ------------------------------------------------------------------------


def get_meta() -> dict:
    ds = load_dataset()
    return {
        "product": "WindDesk",
        "version": __version__,
        "timezone": "Europe/London",
        "decision_window": {
            "first_decision_date": DECISION_START.isoformat(),
            "last_decision_date": DECISION_END.isoformat(),
            "first_delivery_date": DELIVERY_DATES[0].isoformat(),
            "last_delivery_date": DELIVERY_DATES[-1].isoformat(),
            "default_decision_date": DEFAULT_DECISION_DATE.isoformat(),
        },
        "gates": [
            {"id": g.id, "label": g.label, "venue": g.venue, "time": hhmm(g.time), "description": g.description}
            for g in GATES
        ],
        "default_gate_time": hhmm(DEFAULT_GATE_TIME),
        "calibration": {
            "window_days": CALIBRATION_DAYS,
            "band_low_q": BAND_LOW_Q,
            "band_high_q": BAND_HIGH_Q,
            "min_forecast_mw": MIN_RATIO_FORECAST_MW,
        },
        "data": {
            "fetched_at": ds.meta.get("fetched_at"),
            "snapshot_start": ds.meta.get("snapshot_start"),
            "snapshot_end": ds.meta.get("snapshot_end"),
            "sources": ds.meta.get("sources", {}),
            "quality": ds.quality,
        },
    }


def get_decision(decision_date: date, gate_time: time) -> dict:
    ds = load_dataset()
    delivery = decision_date + ONE_DAY
    start, end = day_bounds(delivery)
    gate_ts = decision_time(delivery, gate_time)

    frame = decision_frame(gate_time)
    day = frame[frame["delivery_date"] == delivery]
    actual_hh = ds.actuals[(ds.actuals["start_time"] >= start) & (ds.actuals["start_time"] < end)]

    vintages = forecast_vintages(ds.forecasts, start, end)
    used = sorted(day["publish_time"].dropna().unique())
    later = sorted(p for p in vintages["publish_time"].unique() if p > gate_ts)
    first = day.iloc[0] if len(day) else None

    def mwh(col: str) -> float | None:
        return num(day[col].sum(), 0) if day[col].notna().any() else None

    calibrated_mwh = mwh("calibrated_mw")
    p10_mwh = mwh("p10_mw")
    actual_mwh = num(actual_hh["generation_mw"].sum() * 0.5, 0) if len(actual_hh) == 48 else None
    forecast_mwh = mwh("forecast_mw")
    raw = error_metrics(day["forecast_mw"], day["actual_mw"])
    cal = error_metrics(day["calibrated_mw"], day["actual_mw"])

    return {
        "decision_date": decision_date.isoformat(),
        "delivery_date": delivery.isoformat(),
        "gate_time": hhmm(gate_time),
        "decision_time": iso(gate_ts),
        "forecast_publish_times": [iso(p) for p in used],
        "minutes_since_publish": num((gate_ts - used[-1]).total_seconds() / 60, 0) if used else None,
        "next_publish_time": iso(later[0]) if later else None,
        "horizon_min_h": num(day["horizon_h"].min()),
        "horizon_max_h": num(day["horizon_h"].max()),
        "calibration": {
            "scale": num(first["scale"], 3) if first is not None else None,
            "ratio_p10": num(first["ratio_p10"], 3) if first is not None else None,
            "ratio_p90": num(first["ratio_p90"], 3) if first is not None else None,
            "samples": int(first["band_samples"]) if first is not None else 0,
            "history_from": first["band_history_from"].isoformat() if first is not None else None,
            "history_to": first["band_history_to"].isoformat() if first is not None else None,
        },
        "summary": {
            "forecast_mwh": forecast_mwh,
            "calibrated_mwh": calibrated_mwh,
            "p10_mwh": p10_mwh,
            "p90_mwh": mwh("p90_mw"),
            "energy_at_risk_mwh": num(calibrated_mwh - p10_mwh, 0) if calibrated_mwh and p10_mwh else None,
            "peak_forecast_mw": num(day["forecast_mw"].max(), 0),
            "trough_forecast_mw": num(day["forecast_mw"].min(), 0),
            "actual_mwh": actual_mwh,
            "forecast_error_mwh": num(forecast_mwh - actual_mwh, 0) if forecast_mwh and actual_mwh else None,
            "calibrated_error_mwh": num(calibrated_mwh - actual_mwh, 0) if calibrated_mwh and actual_mwh else None,
            "raw_mae_mw": num(raw.get("mae_mw")),
            "calibrated_mae_mw": num(cal.get("mae_mw")),
            "raw_bias_mw": num(raw.get("bias_mw")),
            "band_coverage_pct": num(band_coverage(day)),
        },
        "hourly": [
            {
                "time": iso(r.start_time),
                "forecast_mw": num(r.forecast_mw),
                "calibrated_mw": num(r.calibrated_mw),
                "p10_mw": num(r.p10_mw),
                "p90_mw": num(r.p90_mw),
                "actual_mw": num(r.actual_mw),
                "horizon_h": num(r.horizon_h),
                "publish_time": iso(r.publish_time),
            }
            for r in day.itertuples()
        ],
        "actuals": [{"time": iso(r.start_time), "actual_mw": num(r.generation_mw)} for r in actual_hh.itertuples()],
        "vintages": [
            {
                "publish_time": iso(publish),
                "status": "decision" if publish in used else ("before" if publish <= gate_ts else "after"),
                "points": [
                    {"time": iso(r.start_time), "forecast_mw": num(r.generation_mw)} for r in group.itertuples()
                ],
            }
            for publish, group in vintages.groupby("publish_time")
        ],
    }


def get_accuracy(gate_time: time) -> dict:
    frame = decision_frame(gate_time)
    actual_mwh = daily_actual_mwh()

    daily = []
    for day, g in frame.groupby("delivery_date"):
        raw = error_metrics(g["forecast_mw"], g["actual_mw"])
        cal = error_metrics(g["calibrated_mw"], g["actual_mw"])
        f_mwh, c_mwh, a_mwh = g["forecast_mw"].sum(), g["calibrated_mw"].sum(), actual_mwh.get(day)
        daily.append(
            {
                "delivery_date": day.isoformat(),
                "publish_time": iso(g["publish_time"].max()),
                "forecast_mwh": num(f_mwh, 0),
                "calibrated_mwh": num(c_mwh, 0),
                "actual_mwh": num(a_mwh, 0),
                "forecast_error_mwh": num(f_mwh - a_mwh, 0) if a_mwh else None,
                "calibrated_error_mwh": num(c_mwh - a_mwh, 0) if a_mwh else None,
                "raw_mae_mw": num(raw.get("mae_mw")),
                "calibrated_mae_mw": num(cal.get("mae_mw")),
                "max_abs_error_mw": num(g["error_mw"].abs().max()),
                "band_coverage_pct": num(band_coverage(g)),
            }
        )

    hours = frame["start_time"].dt.tz_convert(UK_TZ).dt.hour
    by_hour = []
    for hour, g in frame.groupby(hours):
        raw = error_metrics(g["forecast_mw"], g["actual_mw"])
        cal = error_metrics(g["calibrated_mw"], g["actual_mw"])
        by_hour.append(
            {
                "hour": int(hour),
                "raw_mae_mw": num(raw.get("mae_mw")),
                "calibrated_mae_mw": num(cal.get("mae_mw")),
                "raw_bias_mw": num(raw.get("bias_mw")),
                "calibrated_bias_mw": num(cal.get("bias_mw")),
            }
        )

    return {
        "gate_time": hhmm(gate_time),
        "first_delivery_date": DELIVERY_DATES[0].isoformat(),
        "last_delivery_date": DELIVERY_DATES[-1].isoformat(),
        "summary": frame_summary(frame),
        "daily": daily,
        "by_hour": by_hour,
        "histogram": histogram(
            {
                "raw": frame["forecast_mw"] - frame["actual_mw"],
                "calibrated": frame["calibrated_mw"] - frame["actual_mw"],
            },
            bin_width=500,
        ),
        "timeseries": [
            {
                "time": iso(r.start_time),
                "forecast_mw": num(r.forecast_mw, 0),
                "calibrated_mw": num(r.calibrated_mw, 0),
                "p10_mw": num(r.p10_mw, 0),
                "p90_mw": num(r.p90_mw, 0),
                "actual_mw": num(r.actual_mw, 0),
            }
            for r in frame.itertuples()
        ],
    }


@lru_cache(maxsize=1)
def get_lead_time() -> dict:
    ds = load_dataset()
    start, _ = day_bounds(DELIVERY_DATES[0])
    _, end = day_bounds(DELIVERY_DATES[-1])
    buckets = error_by_horizon(forecast_actual_pairs(ds.forecasts, ds.actuals, start, end))

    gates = []
    for g in GATES:
        s = frame_summary(decision_frame(g.time))
        gates.append(
            {
                "id": g.id,
                "label": g.label,
                "time": hhmm(g.time),
                "horizon_min_h": s["horizon_min_h"],
                "horizon_max_h": s["horizon_max_h"],
                "raw_mae_mw": s["raw"]["mae_mw"],
                "calibrated_mae_mw": s["calibrated"]["mae_mw"],
                "raw_bias_mw": s["raw"]["bias_mw"],
                "raw_nmae_pct": s["raw"]["nmae_pct"],
                "p90_abs_error_mw": s["raw"]["p90_abs_error_mw"],
                "band_coverage_pct": s["band_coverage_pct"],
            }
        )

    sweep = []
    for t in SWEEP_TIMES:
        s = frame_summary(decision_frame(t))
        sweep.append(
            {
                "gate_time": hhmm(t),
                "raw_mae_mw": s["raw"]["mae_mw"],
                "calibrated_mae_mw": s["calibrated"]["mae_mw"],
                "band_coverage_pct": s["band_coverage_pct"],
            }
        )

    return {
        "first_delivery_date": DELIVERY_DATES[0].isoformat(),
        "last_delivery_date": DELIVERY_DATES[-1].isoformat(),
        "by_horizon": [{k: num(v) if k.endswith("_mw") else v for k, v in b.items()} for b in buckets],
        "gates": gates,
        "decision_time_sweep": sweep,
    }


def export_csv(gate_time: time) -> str:
    frame = decision_frame(gate_time)
    out = pd.DataFrame(
        {
            "delivery_date": frame["delivery_date"].astype(str),
            "start_time_utc": frame["start_time"].map(iso),
            "start_time_uk": frame["start_time"].dt.tz_convert(UK_TZ).dt.strftime("%Y-%m-%d %H:%M"),
            "decision_time_utc": frame["decision_time"].map(iso),
            "forecast_publish_time_utc": frame["publish_time"].map(iso),
            "lead_time_h": frame["horizon_h"].round(1),
            "forecast_mw": frame["forecast_mw"].round(1),
            "calibrated_mw": frame["calibrated_mw"].round(1),
            "p10_mw": frame["p10_mw"].round(1),
            "p90_mw": frame["p90_mw"].round(1),
            "actual_mw": frame["actual_mw"].round(1),
            "error_mw": frame["error_mw"].round(1),
        }
    )
    return out.to_csv(index=False)
