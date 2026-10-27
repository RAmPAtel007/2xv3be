"""Which forecast was actually available when the purchase decision was made?

The core rule of the product: for a delivery day D and a gate time G, the relevant
forecast for each target hour is the most recent one published at or before G on D-1.
Anything published later is hindsight and must not leak into the decision view.
"""

from __future__ import annotations

from datetime import date, time, timedelta

import pandas as pd

from winddesk.analytics.calendar import decision_time, hourly_targets

HALF_HOUR = pd.Timedelta(minutes=30)


def decision_forecasts(
    forecasts: pd.DataFrame,
    actuals: pd.DataFrame,
    delivery_dates: list[date],
    gate_time: time,
) -> pd.DataFrame:
    """Decision-time forecast vs outturn for every hourly target of the given delivery days.

    Columns: start_time, delivery_date, decision_time, publish_time, horizon_h,
    forecast_mw, actual_mw, error_mw (forecast - actual), persistence_mw.
    """
    targets = hourly_targets(delivery_dates)
    gates = {d: decision_time(d, gate_time) for d in delivery_dates}
    targets["decision_time"] = targets["delivery_date"].map(gates).astype("datetime64[ns, UTC]")

    # Latest publish <= decision time, matched per target hour.
    chosen = pd.merge_asof(
        targets.sort_values("decision_time"),
        forecasts[["publish_time", "start_time", "generation_mw"]].sort_values("publish_time"),
        left_on="decision_time",
        right_on="publish_time",
        by="start_time",
        direction="backward",
    ).rename(columns={"generation_mw": "forecast_mw"})
    chosen["horizon_h"] = (chosen["start_time"] - chosen["publish_time"]).dt.total_seconds() / 3600

    # Outturn for the settlement period starting at the same timestamp.
    chosen = chosen.merge(
        actuals[["start_time", "generation_mw"]].rename(columns={"generation_mw": "actual_mw"}),
        on="start_time",
        how="left",
    )
    chosen["error_mw"] = chosen["forecast_mw"] - chosen["actual_mw"]

    # Naive baseline: the last fully settled outturn known at decision time, held flat.
    settled = actuals.assign(end_time=actuals["start_time"] + HALF_HOUR)[["end_time", "generation_mw"]]
    chosen = pd.merge_asof(
        chosen.sort_values("decision_time"),
        settled.sort_values("end_time").rename(columns={"generation_mw": "persistence_mw"}),
        left_on="decision_time",
        right_on="end_time",
        direction="backward",
    ).drop(columns="end_time")

    return chosen.sort_values("start_time").reset_index(drop=True)


def forecast_vintages(forecasts: pd.DataFrame, day_start: pd.Timestamp, day_end: pd.Timestamp) -> pd.DataFrame:
    """All genuine forecasts (target after publish) for one delivery day, every publish."""
    mask = (
        (forecasts["start_time"] >= day_start)
        & (forecasts["start_time"] < day_end)
        & (forecasts["horizon_h"] >= 0)
        & (forecasts["publish_time"] >= day_start - timedelta(days=3))
    )
    return forecasts.loc[mask].sort_values(["publish_time", "start_time"]).reset_index(drop=True)
