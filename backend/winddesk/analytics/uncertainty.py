"""Calibrated forecast and P10-P90 band around the decision forecast, without look-ahead.

Multiplicative model: outturn ~= scale x published forecast. It fits wind well because
errors grow with the forecast level (high-wind hours are where curtailment and misses
are largest).
- calibrated_mw = forecast x scale, scale = least-squares slope (through the origin)
  of outturn on forecast over the trailing window.
- p10_mw / p90_mw = forecast x the 10th / 90th percentile of the outturn/forecast ratio.

For delivery day D the ratios come only from delivery days that had fully settled before
the decision was taken on D-1, i.e. [D-1-window, D-2]. The January back-test therefore
uses exactly what the desk could have known at the time.
"""

from __future__ import annotations

from datetime import date, timedelta

import numpy as np
import pandas as pd

from winddesk.config import BAND_HIGH_Q, BAND_LOW_Q, CALIBRATION_DAYS, MIN_BAND_SAMPLES

# Below this the ratio is dominated by noise, so those hours are left out of calibration.
MIN_RATIO_FORECAST_MW = 1000.0


def trailing_calibration(
    decisions: pd.DataFrame,
    delivery_dates: list[date],
    window_days: int = CALIBRATION_DAYS,
) -> pd.DataFrame:
    settled = decisions.dropna(subset=["actual_mw", "forecast_mw"])
    settled = settled[settled["forecast_mw"] >= MIN_RATIO_FORECAST_MW]
    rows = []
    for day in delivery_dates:
        first = day - timedelta(days=window_days + 1)
        last = day - timedelta(days=2)
        window = settled[(settled["delivery_date"] >= first) & (settled["delivery_date"] <= last)]
        f = window["forecast_mw"].to_numpy()
        a = window["actual_mw"].to_numpy()
        enough = len(f) >= MIN_BAND_SAMPLES
        q = np.quantile(a / f, [BAND_LOW_Q, BAND_HIGH_Q]) if enough else [np.nan] * 2
        rows.append(
            {
                "delivery_date": day,
                "scale": float(np.dot(a, f) / np.dot(f, f)) if enough else np.nan,
                "ratio_p10": float(q[0]),
                "ratio_p90": float(q[1]),
                "band_samples": len(f),
                "band_history_from": first,
                "band_history_to": last,
            }
        )
    return pd.DataFrame(rows)


def apply_band(decisions: pd.DataFrame, ratios: pd.DataFrame) -> pd.DataFrame:
    """Add calibrated_mw, p10_mw and p90_mw to each decision row."""
    df = decisions.merge(ratios, on="delivery_date", how="left")
    df["calibrated_mw"] = df["forecast_mw"] * df["scale"]
    df["p10_mw"] = df["forecast_mw"] * df["ratio_p10"]
    df["p90_mw"] = df["forecast_mw"] * df["ratio_p90"]
    return df


def band_coverage(df: pd.DataFrame) -> float | None:
    """Share of outturns that landed inside [p10, p90]. Nominal is 80%."""
    valid = df.dropna(subset=["actual_mw", "p10_mw", "p90_mw"])
    if valid.empty:
        return None
    inside = (valid["actual_mw"] >= valid["p10_mw"]) & (valid["actual_mw"] <= valid["p90_mw"])
    return float(inside.mean() * 100)
