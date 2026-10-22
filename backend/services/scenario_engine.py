"""VICTOR — Scenario comparison engine."""
from __future__ import annotations
import copy
from ..models.domain import MissionConstraints, Coordinate
from ..models.schemas import (
    ScenarioModification, ScenarioCompareResponse, ScenarioDiff
)
from ..models.enums import DataMode
from .route_engine import RouteEngine, WEIGHT_PROFILES
from .data_service import DataService


class ScenarioEngine:
    """
    Computes scenario comparisons by re-running route engine
    with modified constraints and diffing results.
    """

    def __init__(self, data_service: DataService) -> None:
        self.ds = data_service
        self.engine = RouteEngine(data_service)

    def compare_scenarios(
        self,
        base_routes: dict,
        start: Coordinate,
        dest: Coordinate,
        base_constraints: MissionConstraints,
        modifications: ScenarioModification,
        base_computation_id: str,
        modified_computation_id: str,
    ) -> ScenarioCompareResponse:
        """Re-run routes with modified constraints and diff."""
        # Build modified constraints
        mod_constraints = base_constraints.model_copy(update={
            k: v for k, v in {
                "max_slope_deg": modifications.max_slope_deg,
                "walking_speed_kmh": modifications.walking_speed_kmh,
                "max_eva_hours": modifications.max_eva_hours,
            }.items() if v is not None
        })

        # Apply custom weight overrides if provided
        weight_overrides = modifications.weight_overrides or {}

        modified_routes = self.engine.compute_routes(
            start, dest, mod_constraints, weight_overrides=weight_overrides, allow_infeasible=True
        )

        # Diff
        diffs: list[ScenarioDiff] = []
        for strategy_name in base_routes:
            if strategy_name not in modified_routes:
                diffs.append(ScenarioDiff(
                    strategy=strategy_name,
                    distance_change_km=0.0,
                    time_change_hours=0.0,
                    hazard_change=0.0,
                    science_change=0.0,
                    route_diverged=True,
                ))
                continue
            bm = base_routes[strategy_name].metrics
            mm = modified_routes[strategy_name].metrics
            # Check if route diverged (significant path change)
            route_diverged = abs(bm.distance_km - mm.distance_km) > 0.5
            diffs.append(ScenarioDiff(
                strategy=strategy_name,
                distance_change_km=round(mm.distance_km - bm.distance_km, 3),
                time_change_hours=round(mm.estimated_time_hours - bm.estimated_time_hours, 3),
                hazard_change=round(mm.avg_hazard_score - bm.avg_hazard_score, 3),
                science_change=round(mm.avg_science_value - bm.avg_science_value, 4),
                route_diverged=route_diverged,
            ))

        # Compute impassable change
        base_max = max((r.metrics.max_slope_deg for r in base_routes.values()), default=0)
        mod_max = max((r.metrics.max_slope_deg for r in modified_routes.values()), default=0)
        pct_change = ((mod_constraints.max_slope_deg - base_constraints.max_slope_deg)
                      / max(base_constraints.max_slope_deg, 1)) * 100

        diverged_count = sum(1 for d in diffs if d.route_diverged)
        impact_summary = (
            f"Max slope changed from {base_constraints.max_slope_deg}° to "
            f"{mod_constraints.max_slope_deg}° ({pct_change:+.0f}%). "
            f"{diverged_count} of {len(diffs)} routes significantly changed."
        )

        infeasible_routes = [s for s, r in modified_routes.items() if not r.is_feasible]
        if infeasible_routes:
            impact_summary += (
                f" ⚠️ {len(infeasible_routes)} modified route(s) exceed the {mod_constraints.max_eva_hours:.1f}h EVA ceiling "
                f"with 20% life-support reserve."
            )

        return ScenarioCompareResponse(
            base_computation_id=base_computation_id,
            modified_computation_id=modified_computation_id,
            data_mode=self.ds.data_mode,
            base_strategies=base_routes,
            modified_strategies=modified_routes,
            diffs=diffs,
            impact_summary=impact_summary,
            pct_impassable_change=round(pct_change, 1),
        )
