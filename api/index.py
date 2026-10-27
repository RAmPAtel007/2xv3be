"""Vercel serverless entrypoint: exposes the FastAPI app as a Python function.

vercel.json rewrites /api/* here; FastAPI still sees the original path and routes it.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from winddesk.main import app  # noqa: E402,F401
