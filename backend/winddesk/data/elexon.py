"""Client for the public Elexon BMRS Insights API (no key required).

Only two datasets are used:
- FUELHH: half-hourly outturn generation by fuel type (we keep fuelType == WIND).
- WINDFOR: national wind generation forecasts, hourly resolution, published 8x a day.
"""

from __future__ import annotations

import time as _time
from contextlib import nullcontext
from datetime import date, datetime, timedelta

import httpx
import pandas as pd

BASE_URL = "https://data.elexon.co.uk/bmrs/api/v1/datasets"
CHUNK_DAYS = 7
RETRIES = 3

ACTUAL_COLUMNS = ["start_time", "settlement_date", "settlement_period", "generation_mw", "publish_time"]
FORECAST_COLUMNS = ["publish_time", "start_time", "generation_mw"]


def _get(client: httpx.Client, url: str, params: dict[str, str]) -> list[dict]:
    for attempt in range(RETRIES):
        try:
            response = client.get(url, params=params, timeout=60)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError:
            if attempt == RETRIES - 1:
                raise
            _time.sleep(2**attempt)
    return []


def _client(client: httpx.Client | None):
    return nullcontext(client) if client is not None else httpx.Client()


def fetch_wind_actuals(start: date, end: date, client: httpx.Client | None = None) -> pd.DataFrame:
    """Wind outturn for settlement dates in [start, end] (inclusive)."""
    rows: list[dict] = []
    with _client(client) as c:
        day = start
        while day <= end:
            chunk_end = min(day + timedelta(days=CHUNK_DAYS - 1), end)
            params = {
                "settlementDateFrom": day.isoformat(),
                "settlementDateTo": chunk_end.isoformat(),
                "fuelType": "WIND",
            }
            rows += _get(c, f"{BASE_URL}/FUELHH/stream", params)
            day = chunk_end + timedelta(days=1)

    if not rows:
        return pd.DataFrame(columns=ACTUAL_COLUMNS)
    df = pd.DataFrame(rows)
    df = df[df["fuelType"] == "WIND"].rename(
        columns={
            "startTime": "start_time",
            "settlementDate": "settlement_date",
            "settlementPeriod": "settlement_period",
            "generation": "generation_mw",
            "publishTime": "publish_time",
        }
    )
    return df[ACTUAL_COLUMNS].reset_index(drop=True)


def fetch_wind_forecasts(
    publish_from: datetime, publish_to: datetime, client: httpx.Client | None = None
) -> pd.DataFrame:
    """Every WINDFOR forecast published in [publish_from, publish_to)."""
    rows: list[dict] = []
    with _client(client) as c:
        cursor = publish_from
        while cursor < publish_to:
            chunk_end = min(cursor + timedelta(days=CHUNK_DAYS), publish_to)
            params = {
                "publishDateTimeFrom": cursor.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "publishDateTimeTo": chunk_end.strftime("%Y-%m-%dT%H:%M:%SZ"),
            }
            rows += _get(c, f"{BASE_URL}/WINDFOR/stream", params)
            cursor = chunk_end

    if not rows:
        return pd.DataFrame(columns=FORECAST_COLUMNS)
    df = pd.DataFrame(rows).rename(
        columns={"publishTime": "publish_time", "startTime": "start_time", "generation": "generation_mw"}
    )
    # Chunk boundaries are inclusive on the API side, so drop the overlap.
    return df[FORECAST_COLUMNS].drop_duplicates().reset_index(drop=True)
