"""Static configuration for the WindDesk pilot."""

from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import date, time
from pathlib import Path
from zoneinfo import ZoneInfo

UK_TZ = ZoneInfo("Europe/London")

PACKAGE_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get("WINDDESK_DATA_DIR", PACKAGE_DIR.parent / "data"))
STATIC_DIR = Path(os.environ.get("WINDDESK_STATIC_DIR", PACKAGE_DIR.parent / "static"))

# Purchase decisions in scope: made on these dates (UK local) for delivery the next day.
DECISION_START = date(2026, 1, 1)
DECISION_END = date(2026, 1, 31)
# Opens on a day that shows the value of calibration (published forecast missed by ~83 GWh).
DEFAULT_DECISION_DATE = date(2026, 1, 26)

# Range pulled from Elexon. December is included only as history that would already
# have been known when the January decisions were made (used to calibrate the band).
SNAPSHOT_START = date(2025, 12, 1)
SNAPSHOT_END = date(2026, 2, 1)

# Calibration: scale factor and P10-P90 outturn/forecast ratios from a trailing window of settled days.
CALIBRATION_DAYS = 28
BAND_LOW_Q = 0.10
BAND_HIGH_Q = 0.90
MIN_BAND_SAMPLES = 48


@dataclass(frozen=True)
class Gate:
    id: str
    label: str
    venue: str
    time: time
    description: str


# GB day-ahead auction gate closures (UK local time on D-1).
GATES: tuple[Gate, ...] = (
    Gate(
        "epex-da",
        "EPEX Day-Ahead",
        "EPEX SPOT GB hourly auction",
        time(9, 20),
        "Earliest GB day-ahead auction. Hourly products for the next delivery day.",
    ),
    Gate(
        "n2ex-da",
        "N2EX Day-Ahead",
        "Nord Pool GB hourly auction",
        time(9, 50),
        "Most liquid GB day-ahead auction. Hourly products for the next delivery day.",
    ),
    Gate(
        "epex-hh",
        "EPEX Half-Hourly",
        "EPEX SPOT GB 30-min auction",
        time(15, 30),
        "Afternoon half-hourly auction used to re-shape the position.",
    ),
)
DEFAULT_GATE_TIME = time(9, 50)
