"""How forecast accuracy depends on lead time (target time - publish time)."""

from __future__ import annotations

import numpy as np
import pandas as pd

from winddesk.analytics.metrics import error_metrics


def forecast_actual_pairs(
    forecasts: pd.DataFrame, actuals: pd.DataFrame, start: pd.Timestamp, end: pd.Timestamp
) -> pd.DataFrame:
    """Every genuine forecast (horizon >= 0) for targets in [start, end), joined to outturn."""
    f = forecasts[(forecasts["start_time"] >= start) & (forecasts["start_time"] < end) & (forecasts["horizon_h"] >= 0)]
    pairs = f.merge(
        actuals[["start_time", "generation_mw"]].rename(columns={"generation_mw": "actual_mw"}),
        on="start_time",
        how="inner",
    ).rename(columns={"generation_mw": "forecast_mw"})
    pairs["error_mw"] = pairs["forecast_mw"] - pairs["actual_mw"]
    return pairs


def error_by_horizon(pairs: pd.DataFrame) -> list[dict]:
    """Metrics per whole-hour lead-time bucket [h, h+1)."""
    bucket = np.floor(pairs["horizon_h"]).astype(int)
    out = []
    for h, group in pairs.groupby(bucket):
        m = error_metrics(group["forecast_mw"], group["actual_mw"])
        out.append(
            {
                "horizon_h": int(h),
                "n": m["n"],
                "mae_mw": m["mae_mw"],
                "rmse_mw": m["rmse_mw"],
                "bias_mw": m["bias_mw"],
                "p90_abs_error_mw": m["p90_abs_error_mw"],
            }
        )
    return out
