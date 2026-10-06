"""PATHWISE — Route computation API router."""
from __future__ import annotations
import uuid
from typing import Annotated
from fastapi import APIRouter, HTTPException, Depends
from ..models.schemas import (
    RouteComputeRequest, RouteComputeResponse,
    RouteComputeComparison, RouteRangeSummary, SegmentEvidenceResponse
)
from ..models.enums import ParetoStatus
from ..services.route_engine import RouteEngine
from ..services.evidence_engine import EvidenceEngine
from ..services.pareto_engine import compute_pareto_dominance
from ..services.science_engine import get_nearby_targets
from ..dependencies import get_data_service, get_route_engine, get_evidence_engine

router = APIRouter(prefix="/api/v1/routes", tags=["routes"])

# In-memory store: computation_id → RouteComputeResponse + request context
_computation_store: dict[str, dict] = {}


@router.post("/compute", response_model=RouteComputeResponse)
async def compute_routes(
    req: RouteComputeRequest,
    data_service=Depends(get_data_service),
    engine: RouteEngine = Depends(get_route_engine),
):
    """Compute 4 competing route strategies with Pareto dominance analysis."""
    strategy_names = [s.value for s in req.strategies]
    routes = engine.compute_routes(
        req.start, req.destination, req.constraints, strategy_names
    )

    if not routes:
        raise HTTPException(
            status_code=422,
            detail="No viable path found. Try increasing max_slope_deg or adjusting coordinates."
        )

    # Pareto analysis
    pareto = compute_pareto_dominance(routes)

    # Attach Pareto status and nearby science targets to each route
    all_targets = data_service.get_science_targets()
    for strategy_name, route in routes.items():
        route.pareto_status = pareto.get(strategy_name, ParetoStatus.NON_DOMINATED)
        route.science_targets_nearby = get_nearby_targets(
            route, all_targets,
            walking_speed_kmh=req.constraints.walking_speed_kmh
        )

    # Comparison summary
    distances = [r.metrics.distance_km for r in routes.values()]
    times = [r.metrics.estimated_time_hours for r in routes.values()]
    sciences = [r.metrics.total_science_value for r in routes.values()]
    hazards = [r.metrics.avg_hazard_score for r in routes.values()]

    comparison = RouteComputeComparison(
        distance_range=RouteRangeSummary(min=round(min(distances), 3), max=round(max(distances), 3)),
        time_range=RouteRangeSummary(min=round(min(times), 3), max=round(max(times), 3)),
        science_range=RouteRangeSummary(min=round(min(sciences), 4), max=round(max(sciences), 4)),
        hazard_range=RouteRangeSummary(min=round(min(hazards), 3), max=round(max(hazards), 3)),
        trade_off_summary=(
            f"Distance range: {min(distances):.1f}–{max(distances):.1f} km. "
            f"Time range: {min(times):.1f}–{max(times):.1f} h. "
            f"Science range: {min(sciences):.3f}–{max(sciences):.3f}. "
            f"Non-dominated routes: {sum(1 for p in pareto.values() if p == ParetoStatus.NON_DOMINATED)}."
        )
    )

    computation_id = str(uuid.uuid4())
    response = RouteComputeResponse(
        computation_id=computation_id,
        data_mode=data_service.data_mode,
        strategies={k: v for k, v in routes.items()},
        comparison=comparison,
        pareto={k: v for k, v in pareto.items()},
        provenance=data_service.get_provenance(),
    )

    # Store for evidence queries and scenario comparisons
    _computation_store[computation_id] = {
        "response": response,
        "routes": routes,
        "request": req,
    }

    return response


@router.get("/{computation_id}/segments/{segment_id}/evidence",
            response_model=SegmentEvidenceResponse)
async def get_segment_evidence(
    computation_id: str,
    segment_id: int,
    strategy: str = "BALANCED",
    data_service=Depends(get_data_service),
    ev_engine: EvidenceEngine = Depends(get_evidence_engine),
):
    """Get per-segment evidence for the evidence inspector (KILLER FEATURE)."""
    stored = _computation_store.get(computation_id)
    if not stored:
        raise HTTPException(status_code=404, detail="Computation not found")

    route = stored["routes"].get(strategy)
    if not route:
        raise HTTPException(status_code=404, detail=f"Strategy '{strategy}' not found")

    if segment_id < 0 or segment_id >= len(route.segments):
        raise HTTPException(status_code=404, detail=f"Segment {segment_id} out of range")

    segment = route.segments[segment_id]
    return ev_engine.get_segment_evidence(segment, computation_id)


@router.get("/demo", response_model=RouteComputeResponse)
async def get_demo_routes(data_service=Depends(get_data_service)):
    """Return precomputed demo routes for instant app startup."""
    from pathlib import Path
    import json
    demo_file = Path(__file__).parent.parent / "data" / "demo" / "precomputed_routes.json"
    if not demo_file.exists():
        raise HTTPException(status_code=404, detail="Demo precomputed routes not found.")

    with open(demo_file, "r") as f:
        data = json.load(f)

    response = RouteComputeResponse.model_validate(data)
    # Also register in computation store so segment evidence queries work immediately
    _computation_store[response.computation_id] = {
        "response": response,
        "routes": response.strategies,
        "request": None,
    }
    return response


def get_computation_store() -> dict:
    """Expose computation store for scenario engine."""
    return _computation_store
