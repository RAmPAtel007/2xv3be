from datetime import date, time

import pandas as pd

from winddesk.analytics.calendar import day_bounds, decision_time, hourly_targets


def test_decision_time_in_winter_is_utc():
    assert decision_time(date(2026, 1, 15), time(9, 50)) == pd.Timestamp("2026-01-14T09:50:00Z")


def test_decision_time_in_summer_shifts_for_bst():
    assert decision_time(date(2026, 7, 15), time(9, 50)) == pd.Timestamp("2026-07-14T08:50:00Z")


def test_clock_change_days_have_23_and_25_hours():
    assert len(hourly_targets([date(2026, 3, 29)])) == 23
    assert len(hourly_targets([date(2026, 10, 25)])) == 25


def test_day_bounds_are_uk_midnights():
    start, end = day_bounds(date(2026, 6, 1))
    assert start == pd.Timestamp("2026-05-31T23:00:00Z")
    assert end == pd.Timestamp("2026-06-01T23:00:00Z")
