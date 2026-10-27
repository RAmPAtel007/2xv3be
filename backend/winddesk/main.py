"""ASGI entrypoint: `uvicorn winddesk.main:app`."""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles

from winddesk import __version__
from winddesk.api import router
from winddesk.config import STATIC_DIR

# The snapshot is immutable, so let browsers and the Vercel edge cache API responses.
API_CACHE_CONTROL = "public, max-age=300, s-maxage=86400"


def create_app() -> FastAPI:
    app = FastAPI(
        title="WindDesk API",
        version=__version__,
        description="Day-ahead wind forecast intelligence for GB power procurement (Elexon BMRS data).",
        docs_url="/api/docs",
        redoc_url=None,
        openapi_url="/api/openapi.json",
    )
    app.add_middleware(GZipMiddleware, minimum_size=1024)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_methods=["GET"],
    )

    @app.middleware("http")
    async def cache_headers(request: Request, call_next):
        response = await call_next(request)
        path = request.url.path
        if path.startswith("/api/") and path not in ("/api/health", "/api/docs") and response.status_code == 200:
            response.headers.setdefault("Cache-Control", API_CACHE_CONTROL)
        return response

    app.include_router(router)

    # Single-container deployments (Docker / Heroku) serve the built React app too.
    if STATIC_DIR.is_dir():
        app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="web")

    return app


app = create_app()
