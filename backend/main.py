import os
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from backend.routers import comparison, anomaly, equipment, investigation, dashboard

app = FastAPI(title="EDRS — Electrode Defect Reduction System", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dashboard.router, prefix="/api")
app.include_router(comparison.router, prefix="/api")
app.include_router(anomaly.router, prefix="/api")
app.include_router(equipment.router, prefix="/api")
app.include_router(investigation.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "2.0.0"}


STATIC_DIR = Path(__file__).resolve().parent.parent / "static"


if STATIC_DIR.is_dir() and (STATIC_DIR / "index.html").is_file():
    if (STATIC_DIR / "assets").is_dir():
        app.mount("/assets", StaticFiles(directory=str(STATIC_DIR / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def spa_fallback(request: Request, full_path: str):
        if full_path.startswith("api/"):
            return JSONResponse({"detail": "Not found"}, status_code=404)
        file = STATIC_DIR / full_path
        if file.is_file():
            return FileResponse(str(file))
        return FileResponse(str(STATIC_DIR / "index.html"))
