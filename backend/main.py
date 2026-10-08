"""VICTOR — FastAPI application entry point."""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from .config import settings
from .services.data_service import DataService
from .dependencies import init_services
from .routers import route, science, scenario, environment, map as map_router

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s — %(message)s")
logger = logging.getLogger("victor")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load all NASA grids on startup."""
    logger.info("VICTOR starting — loading data grids...")
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
    logger.info("VICTOR shutting down.")


app = FastAPI(
    title="VICTOR API",
    description=(
        "Multi-Objective Marswalk Arbitration Engine for Jezero Crater, Mars. "
        "NASA Space Apps Challenge 2026. "
        "Data provenance — including whether the active grids are real NASA products "
        "or a synthetic demonstration set — is reported by /api/v1/health and "
        "/api/v1/map/layers. Science values are model-derived scores, not measurements."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# CORS. Origins come from config so a deployed frontend can be added by
# environment variable without a code change (see Settings.cors_origins).
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(route.router)
app.include_router(science.router)
app.include_router(scenario.router)
app.include_router(environment.router)
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
            "data_label": ds.data_label,
            "compliance": ds.compliance,
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
        "project": "VICTOR",
        "description": "Multi-Objective Marswalk Arbitration Engine",
        "challenge": "NASA Space Apps 2026 — Interplanetary Survival Guide: Martian Map",
        "docs": "/docs",
        "health": "/api/v1/health",
    }
