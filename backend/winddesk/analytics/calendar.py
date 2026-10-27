"""Market calendar: delivery days, decision times and UK local/UTC conversion."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta

import pandas as pd

from winddesk.config import UK_TZ


def _utc(local: datetime) -> pd.Timestamp:
    return pd.Timestamp(local).tz_convert("UTC").as_unit("ns")


def decision_time(delivery_date: date, gate_time: time) -> pd.Timestamp:
    """Gate closure for a delivery day: gate_time (UK local) on the previous day, in UTC."""
    return _utc(datetime.combine(delivery_date - timedelta(days=1), gate_time, tzinfo=UK_TZ))


def day_bounds(day: date) -> tuple[pd.Timestamp, pd.Timestamp]:
    """[start, end) of a UK local day in UTC. Handles 23h/25h clock-change days."""
    start = _utc(datetime.combine(day, time(0), tzinfo=UK_TZ))
    end = _utc(datetime.combine(day + timedelta(days=1), time(0), tzinfo=UK_TZ))
    return start, end


def date_range(first: date, last: date) -> list[date]:
    return [first + timedelta(days=i) for i in range((last - first).days + 1)]


def hourly_targets(delivery_dates: list[date]) -> pd.DataFrame:
    """One row per hourly target (the forecast's native resolution) for each delivery day."""
    frames = []
    for day in delivery_dates:
        start, end = day_bounds(day)
        times = pd.date_range(start, end, freq="h", inclusive="left")
        frames.append(pd.DataFrame({"start_time": times, "delivery_date": day}))
    df = pd.concat(frames, ignore_index=True)
    df["start_time"] = df["start_time"].astype("datetime64[ns, UTC]")
    return df


def local_date(ts: pd.Series) -> pd.Series:
    return ts.dt.tz_convert(UK_TZ).dt.date
