"""HTTP routes. Thin: validate inputs, delegate to the service layer."""

from __future__ import annotations

from datetime import date, time

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import PlainTextResponse

from winddesk import service
from winddesk.config import DECISION_END, DECISION_START, DEFAULT_GATE_TIME

router = APIRouter(prefix="/api")

GateTime = Query(DEFAULT_GATE_TIME, description="Gate closure on the day before delivery, UK local (HH:MM)")


def _check_date(decision_date: date) -> None:
    if not DECISION_START <= decision_date <= DECISION_END:
        raise HTTPException(
            status_code=422,
            detail=f"decision_date must be between {DECISION_START} and {DECISION_END}",
        )


@router.get("/health")
def health() -> dict:
    return {"status": "ok"}


@router.get("/meta")
def meta() -> dict:
    """Decision window, auction gates, calibration settings and data provenance."""
    return service.get_meta()


@router.get("/decision")
def decision(
    decision_date: date = Query(..., description="Day the purchase decision is made (UK local)"),
    gate_time: time = GateTime,
) -> dict:
    """What the desk would have seen at gate closure, plus the hindsight outturn."""
    _check_date(decision_date)
    return service.get_decision(decision_date, gate_time)


@router.get("/accuracy")
def accuracy(gate_time: time = GateTime) -> dict:
    """Back-test of the decision-time forecast over every January decision."""
    return service.get_accuracy(gate_time)


@router.get("/lead-time")
def lead_time() -> dict:
    """Accuracy as a function of lead time and of the time the decision is taken."""
    return service.get_lead_time()


@router.get("/export.csv", response_class=PlainTextResponse)
def export(gate_time: time = GateTime) -> PlainTextResponse:
    """Hourly back-test table for the chosen gate, as CSV."""
    filename = f"winddesk_jan2026_gate_{gate_time.strftime('%H%M')}.csv"
    return PlainTextResponse(
        service.export_csv(gate_time),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
