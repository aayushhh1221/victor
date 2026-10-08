"""VICTOR — Science opportunity engine."""
from __future__ import annotations
import math
from ..models.domain import Route, ScienceTarget, Coordinate
from ..models.schemas import ScienceProfilePoint, ScienceProfileResponse
from ..services.data_service import DataService
from ..utils.mars_geo import haversine_mars


def _point_to_segment_dist_m(
    pt: Coordinate,
    seg_start: Coordinate,
    seg_end: Coordinate,
) -> float:
    """Approximate minimum distance from point to segment (flat-Mars approximation)."""
    # Use lat/lon as Cartesian — valid for small regions (~53×56 km)
    ax, ay = seg_start.lon, seg_start.lat
    bx, by = seg_end.lon, seg_end.lat
    px, py = pt.lon, pt.lat
    abx, aby = bx - ax, by - ay
    ab2 = abx * abx + aby * aby
    if ab2 < 1e-12:
        return haversine_mars(pt.lat, pt.lon, seg_start.lat, seg_start.lon)
    t = max(0.0, min(1.0, ((px - ax) * abx + (py - ay) * aby) / ab2))
    cx, cy = ax + t * abx, ay + t * aby
    return haversine_mars(pt.lat, pt.lon, cy, cx)


def get_nearby_targets(
    route: Route,
    all_targets: list[ScienceTarget],
    radius_m: float = 500.0,
    walking_speed_kmh: float = 3.0,
) -> list[ScienceTarget]:
    """
    Find science targets within radius_m of any route segment.
    Computes distance_from_route_m and detour_cost_minutes at runtime.
    These values are NEVER hardcoded in the target catalog.
    """
    nearby: list[ScienceTarget] = []
    for target in all_targets:
        min_dist = math.inf
        for seg in route.segments:
            d = _point_to_segment_dist_m(target.location, seg.start, seg.end)
            min_dist = min(min_dist, d)
            if min_dist < radius_m:
                break

        if min_dist < radius_m:
            # Detour cost: distance there and back at walking speed
            detour_km = (min_dist * 2) / 1000.0
            detour_minutes = (detour_km / walking_speed_kmh) * 60.0
            t_copy = target.model_copy(update={
                "distance_from_route_m": round(min_dist, 1),
                "detour_cost_minutes": round(detour_minutes, 1),
            })
            nearby.append(t_copy)

    nearby.sort(key=lambda t: t.science_value, reverse=True)
    return nearby


def compute_route_science_profile(
    route: Route,
    computation_id: str,
    strategy: str,
) -> ScienceProfileResponse:
    """Generate per-segment science profile for charting."""
    profile: list[ScienceProfilePoint] = []
    cumulative_km = 0.0

    for seg in route.segments:
        cumulative_km += seg.distance_m / 1000.0
        profile.append(ScienceProfilePoint(
            distance_km=round(cumulative_km, 3),
            science_value=round(seg.science_value, 4),
            hazard_score=round(seg.hazard_score, 3),
        ))

    sci_values = [p.science_value for p in profile]
    return ScienceProfileResponse(
        computation_id=computation_id,
        strategy=strategy,
        profile=profile,
        total_science_value=round(sum(sci_values), 4),
        peak_science_value=round(max(sci_values) if sci_values else 0.0, 4),
    )


def compare_science_value(routes: dict[str, Route]) -> dict:
    """Compare science metrics across strategies."""
    result = {}
    for name, route in routes.items():
        sci_vals = [s.science_value for s in route.segments]
        result[name] = {
            "total_science_value": round(route.metrics.total_science_value, 4),
            "avg_science_value": round(route.metrics.avg_science_value, 4),
            "peak_science_value": round(max(sci_vals) if sci_vals else 0.0, 4),
            "science_per_km": round(
                route.metrics.total_science_value / max(route.metrics.distance_km, 0.01), 4
            ),
        }
    return result


def science_discovery_analysis(routes: dict[str, Route]) -> str:
    """
    Identify best detour opportunity using computed values.
    Text uses runtime template variables — no hardcoded distances or percentages.
    """
    best_strategy = max(routes, key=lambda n: routes[n].metrics.avg_science_value)
    best = routes[best_strategy]
    base_strategy = min(routes, key=lambda n: routes[n].metrics.avg_science_value)
    base = routes[base_strategy]

    sci_delta_pct = 0.0
    if base.metrics.avg_science_value > 0:
        sci_delta_pct = (
            (best.metrics.avg_science_value - base.metrics.avg_science_value)
            / base.metrics.avg_science_value * 100
        )

    dist_diff_km = abs(best.metrics.distance_km - base.metrics.distance_km)

    return (
        f"{best_strategy} route adds {dist_diff_km:.1f} km compared to {base_strategy} "
        f"but achieves {sci_delta_pct:.1f}% higher science value. "
        f"Science efficiency: {best.metrics.total_science_value / max(best.metrics.distance_km, 0.01):.3f} "
        f"science-value/km vs {base.metrics.total_science_value / max(base.metrics.distance_km, 0.01):.3f}."
    )
