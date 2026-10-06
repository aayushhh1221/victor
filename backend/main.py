"""PATHWISE — FastAPI application entry point."""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from .config import settings
from .services.data_service import DataService
from .dependencies import init_services
from .routers import route, science, scenario, map as map_router

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s — %(message)s")
logger = logging.getLogger("pathwise")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load all NASA grids on startup."""
    logger.info("PATHWISE starting — loading data grids...")
    ds = DataService()
    try:
        ds.load()
        init_services(ds)
        logger.info(f"Data loaded: mode={ds.data_mode}, grid={ds.metadata.rows}×{ds.metadata.cols}")
    except Exception as e:
        logger.error(f"Data load failed: {e}. Check that data pipeline has been run.")
        logger.warning("Starting in degraded mode — routes will not be available until data is loaded.")
        # We still start the app so the health endpoint responds
    yield
    logger.info("PATHWISE shutting down.")


app = FastAPI(
    title="PATHWISE API",
    description=(
        "Multi-Objective Marswalk Arbitration Engine. "
        "NASA Space Apps Challenge 2026. "
        "Real NASA data from 6 instrument datasets across 4 Mars missions."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(route.router)
app.include_router(science.router)
app.include_router(scenario.router)
app.include_router(map_router.router)


@app.get("/api/v1/health")
async def health():
    """Health check. Returns current data_mode."""
    try:
        from .dependencies import get_data_service
        ds = get_data_service()
        return {
            "status": "ok",
            "data_mode": ds.data_mode.value,
            "grid_loaded": ds.is_loaded(),
            "grid_shape": [ds.metadata.rows, ds.metadata.cols],
            "region": "Jezero Crater (18.0–18.9°N, 77.0–78.0°E)",
            "scientific_note": "All science values are MODEL scores, not direct measurements.",
        }
    except RuntimeError:
        return JSONResponse(
            status_code=503,
            content={
                "status": "degraded",
                "data_mode": "UNKNOWN",
                "grid_loaded": False,
                "message": "Data not yet loaded. Run data pipeline first.",
            }
        )


@app.get("/")
async def root():
    return {
        "project": "PATHWISE",
        "description": "Multi-Objective Marswalk Arbitration Engine",
        "challenge": "NASA Space Apps 2026 — Interplanetary Survival Guide: Martian Map",
        "docs": "/docs",
        "health": "/api/v1/health",
    }
