"""Refresh the bundled Elexon snapshot in backend/data.

Usage (from backend/):  python -m scripts.fetch_data
"""

from __future__ import annotations

import json
import sys
from datetime import UTC, datetime, time, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from winddesk.config import DATA_DIR, SNAPSHOT_END, SNAPSHOT_START, UK_TZ  # noqa: E402
from winddesk.data.elexon import fetch_wind_actuals, fetch_wind_forecasts  # noqa: E402

# Forecasts reach ~66h ahead, so start early enough to cover the first snapshot day.
FORECAST_LOOKBACK = timedelta(days=3)


def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    print(f"Fetching FUELHH wind actuals {SNAPSHOT_START} .. {SNAPSHOT_END}")
    actuals = fetch_wind_actuals(SNAPSHOT_START, SNAPSHOT_END)
    actuals.to_csv(DATA_DIR / "actuals.csv.gz", index=False)
    print(f"  {len(actuals):,} rows")

    publish_from = datetime.combine(SNAPSHOT_START, time(0), tzinfo=UK_TZ).astimezone(UTC) - FORECAST_LOOKBACK
    publish_to = datetime.combine(SNAPSHOT_END + timedelta(days=1), time(0), tzinfo=UK_TZ).astimezone(UTC)
    print(f"Fetching WINDFOR forecasts published {publish_from:%Y-%m-%d %H:%M} .. {publish_to:%Y-%m-%d %H:%M} UTC")
    forecasts = fetch_wind_forecasts(publish_from, publish_to)
    forecasts.to_csv(DATA_DIR / "forecasts.csv.gz", index=False)
    print(f"  {len(forecasts):,} rows, {forecasts['publish_time'].nunique():,} publishes")

    meta = {
        "fetched_at": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "snapshot_start": SNAPSHOT_START.isoformat(),
        "snapshot_end": SNAPSHOT_END.isoformat(),
        "sources": {
            "actuals": "https://data.elexon.co.uk/bmrs/api/v1/datasets/FUELHH/stream",
            "forecasts": "https://data.elexon.co.uk/bmrs/api/v1/datasets/WINDFOR/stream",
        },
    }
    (DATA_DIR / "meta.json").write_text(json.dumps(meta, indent=2) + "\n")
    print("Done.")


if __name__ == "__main__":
    main()
