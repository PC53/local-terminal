import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from routers import quote, chart, news, financials, screen

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
app.include_router(quote.router, prefix="/api")
app.include_router(chart.router, prefix="/api")
app.include_router(news.router, prefix="/api")
app.include_router(financials.router, prefix="/api")
app.include_router(screen.router, prefix="/api")

# Serve frontend static files
FRONTEND_DIR = Path(__file__).parent.parent / "frontend"

# Mount static assets (css, js)
app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")


@app.get("/style.css")
async def serve_css():
    return FileResponse(str(FRONTEND_DIR / "style.css"), media_type="text/css")


@app.get("/app.js")
async def serve_js():
    return FileResponse(str(FRONTEND_DIR / "app.js"), media_type="application/javascript")


@app.get("/")
async def serve_index():
    return FileResponse(str(FRONTEND_DIR / "index.html"))


@app.get("/health")
async def health():
    from services.fetcher import active_provider
    return {"status": "ok", "provider": active_provider()}
