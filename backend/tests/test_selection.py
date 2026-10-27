from datetime import date, time

import pandas as pd

from winddesk.analytics.selection import decision_forecasts, forecast_vintages

DELIVERY = date(2026, 1, 15)
TARGET = "2026-01-15T12:00:00Z"


def _forecasts(forecasts_factory):
    # Three publishes for the same target hour: early, just before gate, after gate.
    rows = []
    for publish, value in [
        ("2026-01-13T22:30:00Z", 1000.0),
        ("2026-01-14T09:30:00Z", 2000.0),
        ("2026-01-14T11:30:00Z", 3000.0),
    ]:
        hours = pd.date_range("2026-01-15T00:00:00Z", periods=24, freq="h")
        rows += [(publish, h.isoformat(), value) for h in hours]
    return forecasts_factory(rows)


def test_uses_latest_forecast_published_before_gate(forecasts_factory, actuals_factory):
    actuals = actuals_factory("2026-01-14T00:00:00Z", 96, 1500.0)
    df = decision_forecasts(_forecasts(forecasts_factory), actuals, [DELIVERY], time(9, 50))

    row = df[df["start_time"] == pd.Timestamp(TARGET)].iloc[0]
    assert row["forecast_mw"] == 2000.0
    assert row["publish_time"] == pd.Timestamp("2026-01-14T09:30:00Z")
    assert row["horizon_h"] == 26.5
    assert row["error_mw"] == 500.0


def test_never_uses_a_forecast_published_after_gate(forecasts_factory, actuals_factory):
    actuals = actuals_factory("2026-01-14T00:00:00Z", 96, 1500.0)
    df = decision_forecasts(_forecasts(forecasts_factory), actuals, [DELIVERY], time(9, 20))

    assert (df["publish_time"] <= df["decision_time"]).all()
    assert set(df["forecast_mw"]) == {1000.0}


def test_gate_exactly_on_publish_time_includes_that_publish(forecasts_factory, actuals_factory):
    actuals = actuals_factory("2026-01-14T00:00:00Z", 96, 1500.0)
    df = decision_forecasts(_forecasts(forecasts_factory), actuals, [DELIVERY], time(9, 30))
    assert set(df["forecast_mw"]) == {2000.0}


def test_covers_every_hour_of_the_delivery_day(forecasts_factory, actuals_factory):
    actuals = actuals_factory("2026-01-14T00:00:00Z", 96, 1500.0)
    df = decision_forecasts(_forecasts(forecasts_factory), actuals, [DELIVERY], time(9, 50))
    assert len(df) == 24
    assert df["forecast_mw"].notna().all()


def test_persistence_is_last_settled_outturn_before_gate(forecasts_factory, actuals_factory):
    # Outturn rises 10 MW per half-hour from midnight on D-1.
    actuals = actuals_factory("2026-01-14T00:00:00Z", 96, [float(i * 10) for i in range(96)])
    df = decision_forecasts(_forecasts(forecasts_factory), actuals, [DELIVERY], time(9, 50))
    # At 09:50 the last complete period is 09:00-09:30 (index 18).
    assert set(df["persistence_mw"]) == {180.0}


def test_vintages_exclude_hindcast_points(forecasts_factory):
    f = forecasts_factory(
        [
            ("2026-01-15T07:30:00Z", "2026-01-15T06:00:00Z", 1.0),  # target before publish
            ("2026-01-15T07:30:00Z", "2026-01-15T08:00:00Z", 2.0),
        ]
    )
    start, end = pd.Timestamp("2026-01-15T00:00:00Z"), pd.Timestamp("2026-01-16T00:00:00Z")
    v = forecast_vintages(f, start, end)
    assert list(v["generation_mw"]) == [2.0]
