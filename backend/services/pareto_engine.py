"""PATHWISE — Pareto dominance analysis engine."""
from __future__ import annotations
from ..models.domain import Route
from ..models.enums import ParetoStatus


def compute_pareto_dominance(routes: dict[str, Route]) -> dict[str, ParetoStatus]:
    """
    Determine Pareto dominance status for each route.

    Objectives:
        distance      → minimise
        time          → minimise
        hazard        → minimise
        science_value → maximise

    Route A dominates Route B iff:
        A is no worse on ALL objectives AND strictly better on at least one.

    Returns dict: strategy_name → ParetoStatus.NON_DOMINATED | DOMINATED

    This is deterministic comparison — no ML, no approximation.
    """
    names = list(routes.keys())
    status: dict[str, ParetoStatus] = {n: ParetoStatus.NON_DOMINATED for n in names}

    def dominates(a: Route, b: Route) -> bool:
        """Return True if route a dominates route b."""
        ma, mb = a.metrics, b.metrics
        # a must be no worse on all objectives
        no_worse = (
            ma.distance_km <= mb.distance_km and
            ma.estimated_time_hours <= mb.estimated_time_hours and
            ma.avg_hazard_score <= mb.avg_hazard_score and
            ma.avg_science_value >= mb.avg_science_value
        )
        if not no_worse:
            return False
        # a must be strictly better on at least one
        strictly_better = (
            ma.distance_km < mb.distance_km or
            ma.estimated_time_hours < mb.estimated_time_hours or
            ma.avg_hazard_score < mb.avg_hazard_score or
            ma.avg_science_value > mb.avg_science_value
        )
        return strictly_better

    for i, a_name in enumerate(names):
        for j, b_name in enumerate(names):
            if i == j:
                continue
            if dominates(routes[a_name], routes[b_name]):
                status[b_name] = ParetoStatus.DOMINATED

    return status
