"""Forecast error metrics. Convention: error = forecast - actual.

Positive error = over-forecast = less wind than planned = shortfall the desk must cover.
"""

from __future__ import annotations

import math

import numpy as np


def _finite_pairs(forecast, actual) -> tuple[np.ndarray, np.ndarray]:
    f = np.asarray(forecast, dtype=float)
    a = np.asarray(actual, dtype=float)
    mask = np.isfinite(f) & np.isfinite(a)
    return f[mask], a[mask]


def error_metrics(forecast, actual) -> dict:
    f, a = _finite_pairs(forecast, actual)
    n = len(f)
    if n == 0:
        return {"n": 0}
    err = f - a
    abs_err = np.abs(err)
    sst = float(np.sum((a - a.mean()) ** 2))
    return {
        "n": n,
        "mae_mw": float(abs_err.mean()),
        "rmse_mw": float(math.sqrt(np.mean(err**2))),
        "bias_mw": float(err.mean()),
        "nmae_pct": float(abs_err.mean() / a.mean() * 100) if a.mean() else None,
        "p50_abs_error_mw": float(np.percentile(abs_err, 50)),
        "p90_abs_error_mw": float(np.percentile(abs_err, 90)),
        "p99_abs_error_mw": float(np.percentile(abs_err, 99)),
        "max_over_forecast_mw": float(err.max()),
        "max_under_forecast_mw": float(err.min()),
        "r2": float(1 - np.sum(err**2) / sst) if sst else None,
        "mean_actual_mw": float(a.mean()),
    }


def skill_score(model_mae: float | None, reference_mae: float | None) -> float | None:
    """1 - MAE_model / MAE_reference. 0 = no better than the reference, 1 = perfect."""
    if not model_mae or not reference_mae:
        return None
    return 1 - model_mae / reference_mae


def histogram(series: dict[str, np.ndarray], bin_width: float = 500.0) -> list[dict]:
    """Counts per bin for several error series on shared bin edges."""
    clean = {k: np.asarray(v, dtype=float) for k, v in series.items()}
    clean = {k: v[np.isfinite(v)] for k, v in clean.items()}
    values = np.concatenate([v for v in clean.values() if len(v)]) if clean else np.array([])
    if len(values) == 0:
        return []
    lo = math.floor(values.min() / bin_width) * bin_width
    hi = math.ceil(values.max() / bin_width) * bin_width
    if hi == lo:
        hi = lo + bin_width
    edges = np.arange(lo, hi + bin_width, bin_width)
    counts = {k: np.histogram(v, bins=edges)[0] for k, v in clean.items()}
    return [
        {"bin_start": float(edges[i]), "bin_end": float(edges[i + 1]), **{k: int(c[i]) for k, c in counts.items()}}
        for i in range(len(edges) - 1)
    ]
