"""VICTOR — Science analysis API router."""
from fastapi import APIRouter, HTTPException, Depends, Query
from ..models.schemas import ScienceProfileResponse
from ..services.science_engine import (
    compute_route_science_profile, compare_science_value, science_discovery_analysis
)
from ..dependencies import get_data_service
from .route import get_computation_store

router = APIRouter(prefix="/api/v1/science", tags=["science"])


@router.get("/targets")
async def get_science_targets(data_service=Depends(get_data_service)):
    """Get all science targets. science_value is a MODEL score, not a direct measurement."""
    targets = data_service.get_science_targets()
    return {
        "count": len(targets),
        "label": "MODEL — Science Priority Scores. NOT direct NASA measurements.",
        "tier_guide": {
            "1": "Biosignature-relevant (0.8–1.0): Carbonates, Phyllosilicates, Hydrated silica",
            "2": "Water interaction (0.5–0.8): Altered olivine, Sulfates",
            "3": "Geological context (0.2–0.5): Pyroxene, Iron oxides",
            "4": "Baseline (0.0–0.2): Unaltered basalt, Unknown",
        },
        "targets": [t.model_dump() for t in targets],
    }


@router.get("/profile", response_model=ScienceProfileResponse)
async def get_science_profile(
    computation_id: str = Query(...),
    strategy: str = Query("BALANCED"),
    data_service=Depends(get_data_service),
):
    """Get per-segment science profile for a computed route with authentic MOLA elevation."""
    store = get_computation_store()
    stored = store.get(computation_id)
    if not stored:
        raise HTTPException(status_code=404, detail="Computation not found")
    route = stored["routes"].get(strategy)
    if not route:
        raise HTTPException(status_code=404, detail=f"Strategy '{strategy}' not in computation")
    return compute_route_science_profile(route, computation_id, strategy, data_service=data_service)


@router.get("/compare/{computation_id}")
async def compare_science(computation_id: str):
    """Compare science metrics across all strategies in a computation."""
    store = get_computation_store()
    stored = store.get(computation_id)
    if not stored:
        raise HTTPException(status_code=404, detail="Computation not found")
    routes = stored["routes"]
    return {
        "computation_id": computation_id,
        "comparison": compare_science_value(routes),
        "discovery_analysis": science_discovery_analysis(routes),
        "label": "Science values are MODEL scores, not direct measurements.",
    }
