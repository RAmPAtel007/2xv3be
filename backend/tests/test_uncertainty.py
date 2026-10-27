from datetime import date, timedelta

import numpy as np
import pandas as pd
import pytest

from winddesk.analytics.uncertainty import apply_band, band_coverage, trailing_calibration

TARGET_DAY = date(2026, 1, 20)


def _decisions(ratio_by_day: dict[date, float], hours: int = 24) -> pd.DataFrame:
    rows = []
    for day, ratio in ratio_by_day.items():
        for h in range(hours):
            forecast = 5000.0 + 100 * h
            rows.append({"delivery_date": day, "forecast_mw": forecast, "actual_mw": forecast * ratio})
    return pd.DataFrame(rows)


def test_calibration_has_no_look_ahead():
    history = {TARGET_DAY - timedelta(days=d): 0.8 for d in range(2, 30)}
    # D-1 is not settled at decision time and D itself is the future: both wildly off.
    history[TARGET_DAY - timedelta(days=1)] = 5.0
    history[TARGET_DAY] = 5.0
    cal = trailing_calibration(_decisions(history), [TARGET_DAY], window_days=28).iloc[0]

    assert cal["scale"] == pytest.approx(0.8)
    assert cal["band_samples"] == 28 * 24
    assert cal["band_history_to"] == TARGET_DAY - timedelta(days=2)


def test_calibration_needs_enough_history():
    history = {TARGET_DAY - timedelta(days=2): 0.9}
    cal = trailing_calibration(_decisions(history, hours=10), [TARGET_DAY]).iloc[0]
    assert np.isnan(cal["scale"])


def test_band_brackets_calibrated_forecast():
    rng = np.random.default_rng(0)
    history = {TARGET_DAY - timedelta(days=d): float(rng.uniform(0.6, 1.1)) for d in range(2, 30)}
    decisions = _decisions(history | {TARGET_DAY: 0.85})
    cal = trailing_calibration(decisions, [TARGET_DAY])
    day = apply_band(decisions[decisions["delivery_date"] == TARGET_DAY], cal)

    assert (day["p10_mw"] <= day["calibrated_mw"]).all()
    assert (day["calibrated_mw"] <= day["p90_mw"]).all()


def test_band_coverage():
    df = pd.DataFrame({"actual_mw": [5, 15, 25, 10], "p10_mw": [0, 0, 0, 0], "p90_mw": [20, 20, 20, 20]})
    assert band_coverage(df) == 75.0
