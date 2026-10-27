"""Loads the bundled Elexon snapshot into clean, typed DataFrames."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

import pandas as pd

from winddesk.config import DATA_DIR

UTC_NS = "datetime64[ns, UTC]"


def to_utc(values) -> pd.Series:
    """Parse timestamps as tz-aware UTC with a single resolution (merge_asof needs matching dtypes)."""
    return pd.to_datetime(values, utc=True).astype(UTC_NS)


@dataclass(frozen=True)
class Dataset:
    # start_time, generation_mw (one row per half-hour settlement period)
    actuals: pd.DataFrame
    # publish_time, start_time, generation_mw, horizon_h (one row per forecast value)
    forecasts: pd.DataFrame
    meta: dict = field(default_factory=dict)
    quality: dict = field(default_factory=dict)


def clean_actuals(raw: pd.DataFrame) -> tuple[pd.DataFrame, int]:
    df = raw.copy()
    df["start_time"] = to_utc(df["start_time"])
    df["publish_time"] = to_utc(df["publish_time"])
    df["generation_mw"] = pd.to_numeric(df["generation_mw"], errors="coerce")
    before = len(df)
    # Elexon can republish a settlement period; keep the latest revision.
    df = df.sort_values("publish_time").drop_duplicates("start_time", keep="last")
    df = df.dropna(subset=["generation_mw"]).sort_values("start_time").reset_index(drop=True)
    return df[["start_time", "generation_mw"]], before - len(df)


def clean_forecasts(raw: pd.DataFrame) -> tuple[pd.DataFrame, int]:
    df = raw.copy()
    df["start_time"] = to_utc(df["start_time"])
    df["publish_time"] = to_utc(df["publish_time"])
    df["generation_mw"] = pd.to_numeric(df["generation_mw"], errors="coerce")
    before = len(df)
    df = df.drop_duplicates(["publish_time", "start_time"], keep="last").dropna(subset=["generation_mw"])
    df["horizon_h"] = (df["start_time"] - df["publish_time"]).dt.total_seconds() / 3600
    df = df.sort_values(["publish_time", "start_time"]).reset_index(drop=True)
    return df[["publish_time", "start_time", "generation_mw", "horizon_h"]], before - len(df)


def quality_report(actuals: pd.DataFrame, forecasts: pd.DataFrame, dup_a: int, dup_f: int) -> dict:
    expected = pd.date_range(actuals["start_time"].min(), actuals["start_time"].max(), freq="30min")
    missing = expected.difference(pd.DatetimeIndex(actuals["start_time"]))
    publishes = forecasts["publish_time"].drop_duplicates()
    per_day = publishes.dt.date.value_counts()
    return {
        "actual_periods": int(len(actuals)),
        "actual_missing_periods": int(len(missing)),
        "actual_duplicates_removed": int(dup_a),
        "actual_negative_values": int((actuals["generation_mw"] < 0).sum()),
        "forecast_rows": int(len(forecasts)),
        "forecast_publishes": int(len(publishes)),
        "forecast_duplicates_removed": int(dup_f),
        "forecast_publishes_per_day_min": int(per_day.min()) if len(per_day) else 0,
        "forecast_publishes_per_day_max": int(per_day.max()) if len(per_day) else 0,
        "forecast_publish_slots_utc": sorted({t.strftime("%H:%M") for t in publishes}),
        "forecast_resolution_minutes": 60,
        "actual_resolution_minutes": 30,
    }


@lru_cache(maxsize=4)
def load_dataset(data_dir: Path = DATA_DIR) -> Dataset:
    actuals, dup_a = clean_actuals(pd.read_csv(data_dir / "actuals.csv.gz"))
    forecasts, dup_f = clean_forecasts(pd.read_csv(data_dir / "forecasts.csv.gz"))
    meta_path = data_dir / "meta.json"
    meta = json.loads(meta_path.read_text()) if meta_path.exists() else {}
    return Dataset(actuals, forecasts, meta, quality_report(actuals, forecasts, dup_a, dup_f))
