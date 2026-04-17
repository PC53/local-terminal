from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from routers import quote, chart, news, financials, screen, article

app = FastAPI(title="Local Terminal", version="1.0.0")

# CORS — allow all localhost origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routers
for r in (quote, chart, news, financials, screen, article):
    app.include_router(r.router, prefix="/api")


# ── Frontend static files ────────────────────────────────────────────────────
FRONTEND_DIR = Path(__file__).parent.parent / "frontend"
_NO_CACHE = {"Cache-Control": "no-store, no-cache, must-revalidate", "Pragma": "no-cache"}

_STATIC_FILES = {
    "/":             ("index.html",   "text/html"),
    "/app.js":       ("app.js",       "application/javascript"),
    "/style.css":    ("style.css",    "text/css"),
    "/tickers.json": ("tickers.json", "application/json"),
}


def _register_static(route: str, filename: str, media_type: str) -> None:
    async def handler():
        return FileResponse(str(FRONTEND_DIR / filename), media_type=media_type, headers=_NO_CACHE)
    app.get(route)(handler)


for _route, (_file, _mime) in _STATIC_FILES.items():
    _register_static(_route, _file, _mime)


@app.get("/health")
async def health():
    from services.fetcher import active_provider
    return {"status": "ok", "provider": active_provider()}
