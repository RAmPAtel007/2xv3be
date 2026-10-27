from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from winddesk.data.repository import to_utc  # noqa: E402


def make_forecasts(rows: list[tuple[str, str, float]]) -> pd.DataFrame:
    """rows: (publish_time, start_time, generation_mw), UTC ISO strings."""
    df = pd.DataFrame(rows, columns=["publish_time", "start_time", "generation_mw"])
    df["publish_time"] = to_utc(df["publish_time"])
    df["start_time"] = to_utc(df["start_time"])
    df["horizon_h"] = (df["start_time"] - df["publish_time"]).dt.total_seconds() / 3600
    return df


def make_actuals(start: str, periods: int, value: float | list[float]) -> pd.DataFrame:
    times = pd.date_range(start, periods=periods, freq="30min", tz="UTC")
    values = value if isinstance(value, list) else [value] * periods
    return pd.DataFrame({"start_time": times.astype("datetime64[ns, UTC]"), "generation_mw": values})


@pytest.fixture
def forecasts_factory():
    return make_forecasts


@pytest.fixture
def actuals_factory():
    return make_actuals
