"""VICTOR — Scenario comparison API router."""
import uuid
from fastapi import APIRouter, HTTPException, Depends
from ..models.schemas import ScenarioCompareRequest, ScenarioCompareResponse
from ..services.route_engine import UnsafeEndpointError, OverEvaBudgetError
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
        raise HTTPException(
            status_code=422,
            detail="Base computation lacks persisted request context (legacy cache entry). Please recompute the route to enable scenario comparison."
        )

    start = original_req.start
    dest = original_req.destination
    base_constraints = original_req.constraints

    try:
        result = scenario_engine.compare_scenarios(
            base_routes=base_routes,
            start=start,
            dest=dest,
            base_constraints=base_constraints,
            modifications=req.modifications,
            base_computation_id=req.base_computation_id,
            modified_computation_id=modified_id,
        )
    except (UnsafeEndpointError, OverEvaBudgetError, ValueError) as e:
        raise HTTPException(status_code=422, detail=str(e))

    # Store modified computation for further queries
    store[modified_id] = {
        "response": result,
        "routes": result.modified_strategies,
        "request": original_req,
    }

    return result
