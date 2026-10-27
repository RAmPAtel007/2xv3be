import math

import numpy as np
import pytest

from winddesk.analytics.metrics import error_metrics, histogram, skill_score


def test_error_metrics_known_values():
    forecast = [110, 90, 100, 120]
    actual = [100, 100, 100, 100]
    m = error_metrics(forecast, actual)
    assert m["n"] == 4
    assert m["mae_mw"] == pytest.approx(10)
    assert m["bias_mw"] == pytest.approx(5)  # positive = over-forecast
    assert m["rmse_mw"] == pytest.approx(math.sqrt((100 + 100 + 0 + 400) / 4))
    assert m["nmae_pct"] == pytest.approx(10)
    assert m["max_over_forecast_mw"] == 20
    assert m["max_under_forecast_mw"] == -10


def test_error_metrics_ignores_missing_pairs():
    m = error_metrics([1.0, np.nan, 3.0], [1.0, 2.0, np.nan])
    assert m["n"] == 1
    assert m["mae_mw"] == 0


def test_error_metrics_empty():
    assert error_metrics([], []) == {"n": 0}


def test_skill_score():
    assert skill_score(50, 100) == pytest.approx(0.5)
    assert skill_score(50, 0) is None


def test_histogram_shares_bins_between_series():
    rows = histogram({"a": np.array([-600.0, 100.0]), "b": np.array([900.0])}, bin_width=500)
    assert [r["bin_start"] for r in rows] == [-1000, -500, 0, 500]
    assert sum(r["a"] for r in rows) == 2
    assert sum(r["b"] for r in rows) == 1
