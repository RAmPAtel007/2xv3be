"""End-to-end checks against the bundled January 2026 snapshot."""

import pytest
from fastapi.testclient import TestClient

from winddesk.main import app


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_meta_describes_window_and_data_quality(client):
    meta = client.get("/api/meta").json()
    assert meta["decision_window"]["first_decision_date"] == "2026-01-01"
    assert meta["decision_window"]["last_delivery_date"] == "2026-02-01"
    assert {g["time"] for g in meta["gates"]} == {"09:20", "09:50", "15:30"}
    assert meta["data"]["quality"]["actual_missing_periods"] == 0


def test_decision_view(client):
    body = client.get("/api/decision", params={"decision_date": "2026-01-14", "gate_time": "09:50"}).json()
    assert body["delivery_date"] == "2026-01-15"
    assert len(body["hourly"]) == 24
    assert len(body["actuals"]) == 48
    assert all(p <= body["decision_time"] for p in body["forecast_publish_times"])
    assert body["next_publish_time"] > body["decision_time"]
    statuses = {v["status"] for v in body["vintages"]}
    assert statuses == {"before", "decision", "after"}
    s = body["summary"]
    assert s["p10_mwh"] < s["calibrated_mwh"] < s["p90_mwh"]


def test_decision_rejects_dates_outside_january(client):
    assert client.get("/api/decision", params={"decision_date": "2026-02-01"}).status_code == 422
    assert client.get("/api/decision", params={"decision_date": "2025-12-31"}).status_code == 422


def test_accuracy_backtest(client):
    body = client.get("/api/accuracy", params={"gate_time": "09:50"}).json()
    assert len(body["daily"]) == 31
    assert len(body["by_hour"]) == 24
    s = body["summary"]
    assert s["raw"]["n"] == 31 * 24
    # The calibrated forecast must beat the raw forecast, which must beat persistence.
    assert s["calibrated"]["mae_mw"] < s["raw"]["mae_mw"] < s["persistence"]["mae_mw"]
    assert 70 <= s["band_coverage_pct"] <= 95


def test_later_gates_are_never_less_informed(client):
    gates = {g["time"]: g for g in client.get("/api/lead-time").json()["gates"]}
    assert gates["15:30"]["horizon_max_h"] < gates["09:50"]["horizon_max_h"] < gates["09:20"]["horizon_max_h"]


def test_export_csv(client):
    r = client.get("/api/export.csv", params={"gate_time": "09:20"})
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/csv")
    lines = r.text.strip().splitlines()
    assert lines[0].startswith("delivery_date,start_time_utc")
    assert len(lines) == 31 * 24 + 1
