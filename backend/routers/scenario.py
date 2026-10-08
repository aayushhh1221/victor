"""VICTOR — Scenario comparison API router."""
import uuid
from fastapi import APIRouter, HTTPException, Depends
from ..models.schemas import ScenarioCompareRequest, ScenarioCompareResponse
from ..services.scenario_engine import ScenarioEngine
from ..dependencies import get_data_service, get_scenario_engine
from .route import get_computation_store

router = APIRouter(prefix="/api/v1/scenarios", tags=["scenarios"])


@router.post("/compare", response_model=ScenarioCompareResponse)
async def compare_scenarios(
    req: ScenarioCompareRequest,
    data_service=Depends(get_data_service),
    scenario_engine: ScenarioEngine = Depends(get_scenario_engine),
):
    """Re-compute routes with modified constraints and return scenario diff."""
    store = get_computation_store()
    stored = store.get(req.base_computation_id)
    if not stored:
        raise HTTPException(status_code=404, detail="Base computation not found")

    original_req = stored.get("request")
    base_routes = stored["routes"]
    modified_id = str(uuid.uuid4())

    if original_req is None:
        from ..models.domain import MissionConstraints
        first_route = next(iter(base_routes.values()))
        start = first_route.path[0]
        dest = first_route.path[-1]
        base_constraints = MissionConstraints(max_slope_deg=20, max_eva_hours=6, walking_speed_kmh=3.0)
    else:
        start = original_req.start
        dest = original_req.destination
        base_constraints = original_req.constraints

    result = scenario_engine.compare_scenarios(
        base_routes=base_routes,
        start=start,
        dest=dest,
        base_constraints=base_constraints,
        modifications=req.modifications,
        base_computation_id=req.base_computation_id,
        modified_computation_id=modified_id,
    )

    # Store modified computation for further queries
    store[modified_id] = {
        "response": result,
        "routes": result.modified_strategies,
        "request": original_req,
    }

    return result
