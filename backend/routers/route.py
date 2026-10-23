"""VICTOR — Route computation API router."""
from __future__ import annotations
import json
import logging
import uuid
from pathlib import Path
from typing import Annotated
from fastapi import APIRouter, HTTPException, Depends, Response
from ..models.schemas import (
    RouteComputeRequest, RouteComputeResponse,
    RouteComputeComparison, RouteRangeSummary, SegmentEvidenceResponse
)
from ..models.domain import MissionConstraints
from ..models.enums import ParetoStatus
from ..services.route_engine import RouteEngine, UnsafeEndpointError, OverEvaBudgetError
from ..services.evidence_engine import EvidenceEngine
from ..services.pareto_engine import compute_pareto_dominance
from ..services.science_engine import get_nearby_targets
from ..dependencies import get_data_service, get_route_engine, get_evidence_engine
from ..services.computation_store import build_store, route_cache_key

logger = logging.getLogger("victor.routes")

router = APIRouter(prefix="/api/v1/routes", tags=["routes"])

# computation_id → RouteComputeResponse + request context.
#
# Dict-like, but optionally Postgres-backed (set DATABASE_URL). That matters on
# the deployment target: a free-tier service spins down after 15 minutes idle,
# and with a plain dict every stored computation_id died with it — so segment
# evidence, science profiles and scenario comparisons all 404'd for anyone who
# left a tab open. It is also LRU-bounded, which the plain dict was not.
_computation_store = build_store()


def get_computation_store():
    """Accessor for computation store (used by scenario router)."""
    return _computation_store


@router.post("/compute", response_model=RouteComputeResponse)
async def compute_routes(
    req: RouteComputeRequest,
    data_service=Depends(get_data_service),
    engine: RouteEngine = Depends(get_route_engine),
):
    """Compute 4 competing route strategies with Pareto dominance analysis.

    Checks the route cache before running A*. A full 4-strategy computation
    takes 2.1-2.9 s per strategy on a desktop, and the deployment target gives
    0.1 shared CPU — so on a cache hit this returns an indexed read instead of
    a multi-second search. The cache is keyed on the inputs that determine the
    result, so a hit is always the answer the engine would have produced.
    """
    strategy_names = [s.value for s in req.strategies]

    if abs(req.start.lat - req.destination.lat) < 1e-4 and abs(req.start.lon - req.destination.lon) < 1e-4:
        raise HTTPException(
            status_code=400,
            detail="Start and destination coordinates must be distinct (at least 50m apart)."
        )

    manifest_id = getattr(data_service, "manifest_id", None)
    cache_key = route_cache_key(
        req.start.lat, req.start.lon,
        req.destination.lat, req.destination.lon,
        req.constraints.model_dump(),
        strategy_names,
        data_manifest_id=manifest_id,
    )
    cached = _computation_store.get_cached_route(cache_key)
    if cached is not None:
        try:
            response = RouteComputeResponse.model_validate(cached)
            # Re-register under the cached computation_id so segment evidence
            # and scenario lookups resolve against this response too.
            _computation_store[response.computation_id] = {
                "response": response,
                "routes": response.strategies,
                "request": req,
            }
            logger.info(f"Route cache HIT ({cache_key[:12]}…) — skipped A*")
            return response
        except Exception as exc:
            # A stale or malformed cache entry must never break a request;
            # fall through and recompute.
            logger.warning(f"Discarding unusable cache entry {cache_key[:12]}…: {exc}")

    try:
        routes = engine.compute_routes(
            req.start, req.destination, req.constraints, strategy_names,
            weight_overrides=req.weight_overrides,
            allow_infeasible=req.allow_infeasible
        )
    except (UnsafeEndpointError, OverEvaBudgetError, ValueError) as err:
        raise HTTPException(status_code=422, detail=str(err))

    if not routes:
        raise HTTPException(
            status_code=422,
            detail="No viable path found. Try increasing max_slope_deg or adjusting coordinates."
        )

    # Pareto analysis
    pareto = compute_pareto_dominance(routes)

    # Attach Pareto status and nearby science targets to each route
    all_targets = data_service.get_science_targets()
    detour_r = getattr(req.constraints, "science_detour_radius_m", 1000.0) or 1000.0
    for strategy_name, route in routes.items():
        route.pareto_status = pareto.get(strategy_name, ParetoStatus.NON_DOMINATED)
        route.science_targets_nearby = get_nearby_targets(
            route, all_targets,
            radius_m=detour_r,
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
        data_manifest_id="manifest-jezero-2026-v1",
        pipeline_version="1.0.0",
        effective_constraints=req.constraints,
    )

    # Store for evidence queries and scenario comparisons
    _computation_store[computation_id] = {
        "response": response,
        "routes": routes,
        "request": req,
    }

    # Persist to disk cache so restarts never drop user reports
    try:
        cache_dir = Path(__file__).parent.parent / "data" / "cache" / "computations"
        cache_dir.mkdir(parents=True, exist_ok=True)
        (cache_dir / f"{computation_id}.json").write_text(response.model_dump_json(), encoding="utf-8")
    except Exception as exc:
        logger.warning(f"Failed to persist computation {computation_id} to disk: {exc}")

    # Cache by inputs so an identical request skips A* next time. Stored after
    # the computation succeeds, so a failed search is never cached.
    _computation_store.put_cached_route(
        cache_key, json.loads(response.model_dump_json())
    )

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
    req_obj = None
    first_strat = next(iter(response.strategies.values()), None)
    if first_strat and len(first_strat.path) >= 2:
        req_obj = RouteComputeRequest(
            start=first_strat.path[0],
            destination=first_strat.path[-1],
            constraints=response.effective_constraints or MissionConstraints(),
            strategies=list(response.strategies.keys()),
        )
    # Also register in computation store so segment evidence and scenario queries work immediately
    _computation_store[response.computation_id] = {
        "response": response,
        "routes": response.strategies,
        "request": req_obj,
    }
    return response


@router.get("/presets")
async def get_route_presets():
    """Return authoritative historical traverse presets for Jezero Crater."""
    return [
        {
            "id": "seitah-delta",
            "name": "Séítah → Ancient Delta",
            "type": "Historic Traverse",
            "desc": "Perseverance landing site traverse across crater floor toward river delta (4.2 km).",
            "start": {"lat": 18.4447, "lon": 77.4508},
            "destination": {"lat": 18.4812, "lon": 77.2415},
            "historical_context": "Traverses the rugged olivine-bearing Séítah formation toward the Hawksbill Gap sedimentary delta fan.",
        },
        {
            "id": "crater-floor-fan",
            "name": "Crater Floor → Delta Fan",
            "type": "Sedimentary Stratigraphy",
            "desc": "Traverse across basaltic sands to Hawksbill Gap layered delta deposits (3.1 km).",
            "start": {"lat": 18.4320, "lon": 77.4250},
            "destination": {"lat": 18.4610, "lon": 77.3300},
            "historical_context": "Crosses the low-albedo crater floor to inspect mudstone and clay layers preserving biosignature potential.",
        },
        {
            "id": "three-forks-margin",
            "name": "Three Forks → Margin Unit",
            "type": "Carbonate Exploration",
            "desc": "Sample cache depot route ascending to carbonate-bearing rim margin (3.8 km).",
            "start": {"lat": 18.4520, "lon": 77.3520},
            "destination": {"lat": 18.4980, "lon": 77.2400},
            "historical_context": "Ascends from the Three Forks sample cache depot to the high-priority carbonate margin unit at the crater rim.",
        },
        {
            "id": "kodiak-rim",
            "name": "Kodiak Butte Pass → Crater Rim",
            "type": "Geomorphology Scouting",
            "desc": "Geological scouting mission toward Jezero crater northern rim (3.4 km).",
            "start": {"lat": 18.4400, "lon": 77.3850},
            "destination": {"lat": 18.4900, "lon": 77.3600},
            "historical_context": "Examines the Kodiak isolated butte delta remnant before ascending the steep ejecta slopes of the northern rim.",
        },
    ]


@router.get("/{computation_id}/geojson")
async def export_routes_geojson(
    computation_id: str,
    strategy: str | None = None,
    data_service=Depends(get_data_service),
):
    """Export computed routes as standard RFC 7946 GeoJSON FeatureCollection.

    Compatible with QGIS, ArcGIS, Google Earth, Cesium, and standard GIS tools.
    Coordinates are formatted as [longitude, latitude, elevation_m] in IAU2000 Mars frame.
    """
    stored = _computation_store.get(computation_id)
    if not stored:
        raise HTTPException(status_code=404, detail="Computation not found")

    response: RouteComputeResponse = stored["response"]
    strategies = response.strategies

    # Filter by strategy if requested
    if strategy and strategy.upper() != "ALL":
        strat_key = strategy.upper()
        if strat_key not in strategies:
            raise HTTPException(status_code=404, detail=f"Strategy '{strategy}' not found in computation")
        target_strats = {strat_key: strategies[strat_key]}
    else:
        target_strats = strategies

    features = []
    strat_colors = {
        "SAFEST": "#16A34A",
        "FASTEST": "#2563EB",
        "SCIENCE_RICHEST": "#D97706",
        "BALANCED": "#7C3AED",
    }

    for strat_name, route in target_strats.items():
        coords_3d = []
        for pt in route.path:
            elev = float(data_service.get_elevation(pt.lat, pt.lon))
            coords_3d.append([round(pt.lon, 6), round(pt.lat, 6), round(elev, 1)])

        features.append({
            "type": "Feature",
            "id": f"{computation_id}_{strat_name}",
            "geometry": {
                "type": "LineString",
                "coordinates": coords_3d,
            },
            "properties": {
                "strategy": strat_name,
                "computation_id": computation_id,
                "total_distance_km": round(route.metrics.distance_km, 3),
                "estimated_duration_hours": round(route.metrics.estimated_time_hours, 2),
                "required_eva_with_reserve_hours": round(
                    route.metrics.required_eva_time_with_reserve_hours or (route.metrics.estimated_time_hours * 1.2), 2
                ),
                "max_slope_deg": round(route.metrics.max_slope_deg, 1),
                "avg_hazard_score": round(route.metrics.avg_hazard_score, 2),
                "avg_science_value": round(route.metrics.avg_science_value, 3),
                "elevation_gain_m": round(route.metrics.elevation_gain_m, 1),
                "elevation_loss_m": round(route.metrics.elevation_loss_m, 1),
                "segments_count": len(route.segments),
                "is_feasible": route.is_feasible,
                "pareto_status": route.pareto_status.value if hasattr(route.pareto_status, "value") else str(route.pareto_status),
                "confidence": route.metrics.confidence.value if hasattr(route.metrics.confidence, "value") else str(route.metrics.confidence),
                "stroke": strat_colors.get(strat_name, "#1565C0"),
                "stroke-width": 4,
            },
        })

    geojson_doc = {
        "type": "FeatureCollection",
        "name": f"VICTOR_Traverse_{computation_id[:8]}",
        "crs": {
            "type": "name",
            "properties": {
                "name": "urn:ogc:def:crs:OGC:1.3:CRS84",
                "datum": "IAU2000_Mars",
            },
        },
        "properties": {
            "generator": "NASA Space Apps 2026 - Project VICTOR Cartographic Engine",
            "study_region": "Jezero Crater, Mars (18.0N-18.9N, 77.0E-78.0E)",
            "pds_provenance": "NASA PDS Multi-Mission Baseline (MGS MOLA, Odyssey THEMIS, MRO CTX, Mars 2020 MEDA)",
            "computation_id": computation_id,
        },
        "features": features,
    }

    filename = f"VICTOR_Traverse_{computation_id[:8]}.geojson"
    return Response(
        content=json.dumps(geojson_doc, indent=2),
        media_type="application/geo+json",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Type": "application/geo+json",
        },
    )

