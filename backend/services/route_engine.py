"""
VICTOR — Multi-objective A* Route Engine.

ALL edge costs are non-negative.
Science-seeking is achieved via science_penalty = weight * (1 - science_value),
NOT via negative weights. A* optimality/consistency is preserved.
"""
from __future__ import annotations
import heapq
import logging
import math
import time
from dataclasses import dataclass, field
from typing import Optional
import numpy as np
from ..models.domain import (
    Coordinate, GridMetadata, MissionConstraints, Route, RouteSegment,
    RouteMetrics, EdgeCostBreakdown,
)
from ..models.enums import RouteStrategy, ConfidenceLevel
from ..utils.mars_geo import grid_to_latlon, latlon_to_grid, haversine_mars
from .data_service import DataService

logger = logging.getLogger(__name__)

# Approved weight profiles — all non-negative (post-audit correction)
WEIGHT_PROFILES: dict[str, dict[str, float]] = {
    "SAFEST":          {"distance": 0.30, "traversability": 0.10, "hazard": 0.50, "science_penalty": 0.10},
    "FASTEST":         {"distance": 0.60, "traversability": 0.30, "hazard": 0.10, "science_penalty": 0.00},
    "SCIENCE_RICHEST": {"distance": 0.15, "traversability": 0.10, "hazard": 0.05, "science_penalty": 0.70},
    "BALANCED":        {"distance": 0.25, "traversability": 0.15, "hazard": 0.30, "science_penalty": 0.30},
}

# 8-connected neighbourhood offsets (dr, dc)
NEIGHBOURS_8 = [(-1,-1),(-1,0),(-1,1),(0,-1),(0,1),(1,-1),(1,0),(1,1)]

IMPASSABLE_TRAVERSABILITY = 999.0
MAX_ITERATIONS = 500_000


@dataclass(order=True)
class _PQItem:
    f: float
    g: float = field(compare=False)
    row: int = field(compare=False)
    col: int = field(compare=False)
    parent: Optional[tuple] = field(default=None, compare=False)


class RouteEngine:
    """
    Multi-objective A* pathfinder over the 300×300 Jezero computation grid.

    Weight semantics:
        distance      — penalises longer paths
        traversability — penalises difficult slope terrain
        hazard         — penalises hazardous cells
        science_penalty — penalises cells with LOW science value
                          (= weight * (1 - science_value))
                          Set to 0 when science is irrelevant (FASTEST).
    """

    def __init__(self, data_service: DataService) -> None:
        self.ds = data_service
        self.meta: GridMetadata = data_service.metadata
        self._elev = data_service.elevation
        self._slope = data_service.slope
        self._trav = data_service.traversability
        self._hazard = data_service.hazard
        self._sci = data_service.science_value

        # Precompute step distances for 8-connected grid (non-square cell geometry)
        ns = self.meta.cell_size_ns_m
        ew = self.meta.cell_size_ew_m
        diag = math.hypot(ns, ew)
        self._ns_m = ns
        self._ew_m = ew
        self._step_dist = {
            (0, 1): ew, (0, -1): ew,
            (1, 0): ns, (-1, 0): ns,
            (1, 1): diag, (1, -1): diag,
            (-1, 1): diag, (-1, -1): diag,
        }

    # ── Public API ─────────────────────────────────────────────────────────────

    def compute_routes(
        self,
        start: Coordinate,
        dest: Coordinate,
        constraints: MissionConstraints,
        strategies: Optional[list[str]] = None,
    ) -> dict[str, Route]:
        """Compute routes for requested strategies. Returns dict keyed by strategy name."""
        if strategies is None:
            strategies = list(WEIGHT_PROFILES.keys())

        start_cell = latlon_to_grid(start.lat, start.lon, self.meta)
        dest_cell = latlon_to_grid(dest.lat, dest.lon, self.meta)

        results: dict[str, Route] = {}
        for strategy_name in strategies:
            weights = WEIGHT_PROFILES[strategy_name]
            t0 = time.perf_counter()
            cell_path = self._astar(start_cell, dest_cell, weights, constraints)
            elapsed = time.perf_counter() - t0
            logger.info(f"{strategy_name}: {len(cell_path)} cells in {elapsed:.2f}s")

            if not cell_path:
                logger.warning(f"{strategy_name}: no path found")
                continue

            route = self._build_route(
                cell_path, RouteStrategy(strategy_name), constraints, weights
            )
            results[strategy_name] = route

        return results

    # ── A* core ───────────────────────────────────────────────────────────────

    def _astar(
        self,
        start: tuple[int, int],
        goal: tuple[int, int],
        weights: dict[str, float],
        constraints: MissionConstraints,
    ) -> list[tuple[int, int]]:
        """
        Weighted A* over the 300×300 grid.
        Heuristic: haversine to goal × distance_weight (admissible, consistent).
        Returns list of (row, col) tuples from start to goal, or [] if no path.
        """
        rows, cols = self.meta.rows, self.meta.cols
        max_slope = constraints.max_slope_deg

        # Distance scale for heuristic normalisation
        gr, gc = goal[0], goal[1]
        ns_m, ew_m = self._ns_m, self._ew_m
        w_dist_scale = weights["distance"] / 1000.0

        def heuristic(r: int, c: int) -> float:
            dr = (r - gr) * ns_m
            dc = (c - gc) * ew_m
            dist = math.hypot(dr, dc)
            # h(n) = w_distance * (dist_to_goal / 1000.0)
            # Admissible and consistent since dist_norm = dist / 1000.0 in _edge_cost
            return w_dist_scale * dist

        open_set: list[_PQItem] = []
        g_score: np.ndarray = np.full((rows, cols), np.inf)
        parent: dict[tuple, Optional[tuple]] = {}

        g_score[start[0], start[1]] = 0.0
        parent[start] = None
        h0 = heuristic(start[0], start[1])
        heapq.heappush(open_set, _PQItem(f=h0, g=0.0, row=start[0], col=start[1], parent=None))

        visited: set[tuple] = set()
        iterations = 0

        while open_set:
            iterations += 1
            if iterations > MAX_ITERATIONS:
                logger.warning("A* exceeded max iterations")
                break

            item = heapq.heappop(open_set)
            cur = (item.row, item.col)

            if cur in visited:
                continue
            visited.add(cur)

            if cur == goal:
                return self._reconstruct_path(parent, cur)

            cur_trav = float(self._trav[cur[0], cur[1]])
            # Skip impassable cells
            if cur_trav >= IMPASSABLE_TRAVERSABILITY:
                continue

            for dr, dc in NEIGHBOURS_8:
                nr, nc = cur[0] + dr, cur[1] + dc
                if not (0 <= nr < rows and 0 <= nc < cols):
                    continue
                nbr = (nr, nc)
                if nbr in visited:
                    continue

                nbr_slope = float(self._slope[nr, nc])
                # Enforce slope constraint
                if nbr_slope > max_slope:
                    continue
                nbr_trav = float(self._trav[nr, nc])
                if nbr_trav >= IMPASSABLE_TRAVERSABILITY:
                    continue

                cost, _ = self._edge_cost(cur, nbr, weights)
                tentative_g = g_score[cur[0], cur[1]] + cost

                if tentative_g < g_score[nr, nc]:
                    g_score[nr, nc] = tentative_g
                    parent[nbr] = cur
                    f = tentative_g + heuristic(nr, nc)
                    heapq.heappush(open_set, _PQItem(f=f, g=tentative_g, row=nr, col=nc))

        return []  # No path found

    def _edge_cost(
        self,
        a: tuple[int, int],
        b: tuple[int, int],
        weights: dict[str, float],
    ) -> tuple[float, EdgeCostBreakdown]:
        """
        Compute weighted edge cost (a → b). ALL terms non-negative.

        science_penalty = w * avg(1 - science_value) so that
        high-science cells have LOW penalty (A* prefers them).

        Every term is scaled by the step's distance, making the whole cost a
        "cost per kilometre travelled". This matters, and was previously wrong:
        traversability, hazard and science were charged PER STEP while distance
        was charged per metre. Two defects followed.

        First, a diagonal step covers 1.41x the ground of an orthogonal one but
        was charged the same terrain penalty, so diagonals were systematically
        under-penalised.

        Second, and worse, the per-step terms made total cost fall as step count
        fell, so the non-distance objectives were partly optimising for "fewer
        steps" rather than for their own criterion. That inverted the headline
        result: SCIENCE_RICHEST returned a 272-step route with LESS science
        (0.361) than SAFEST's 408-step route (0.446), because taking fewer steps
        beat finding science.

        Admissibility is preserved. The heuristic is w_distance * dist/1000, and
        since every term here is non-negative and path length is at least the
        straight-line distance, true remaining cost >= w_distance * dist/1000 = h.
        """
        dr = b[0] - a[0]
        dc = b[1] - a[1]
        dist = self._step_dist.get((dr, dc), 250.0)

        avg_trav = (float(self._trav[a[0], a[1]]) + float(self._trav[b[0], b[1]])) / 2.0
        avg_hazard = (float(self._hazard[a[0], a[1]]) + float(self._hazard[b[0], b[1]])) / 2.0
        avg_sci = (float(self._sci[a[0], a[1]]) + float(self._sci[b[0], b[1]])) / 2.0
        sci_penalty = 1.0 - avg_sci  # range [0,1], non-negative

        # Normalise distance to km so every term is a cost per kilometre.
        dist_norm = dist / 1000.0

        d_contrib = weights["distance"] * dist_norm
        t_contrib = weights["traversability"] * avg_trav * dist_norm
        h_contrib = weights["hazard"] * avg_hazard * dist_norm
        sp_contrib = weights["science_penalty"] * sci_penalty * dist_norm

        total = d_contrib + t_contrib + h_contrib + sp_contrib
        breakdown = EdgeCostBreakdown(
            distance_contribution=d_contrib,
            traversability_contribution=t_contrib,
            hazard_contribution=h_contrib,
            science_penalty_contribution=sp_contrib,
            total_edge_cost=total,
        )
        return total, breakdown

    def _reconstruct_path(
        self,
        parent: dict[tuple, Optional[tuple]],
        goal: tuple[int, int],
    ) -> list[tuple[int, int]]:
        path = []
        cur: Optional[tuple] = goal
        while cur is not None:
            path.append(cur)
            cur = parent[cur]
        path.reverse()
        return path

    # ── Post-processing ───────────────────────────────────────────────────────

    def _build_route(
        self,
        cell_path: list[tuple[int, int]],
        strategy: RouteStrategy,
        constraints: MissionConstraints,
        weights: dict[str, float],
    ) -> Route:
        """Convert cell path to a Route with full segment evidence."""
        segments: list[RouteSegment] = []
        total_distance_m = 0.0
        total_elevation_gain = 0.0
        total_elevation_loss = 0.0
        max_slope = 0.0

        coords = [
            Coordinate(lat=grid_to_latlon(r, c, self.meta)[0],
                       lon=grid_to_latlon(r, c, self.meta)[1])
            for r, c in cell_path
        ]

        for i in range(len(cell_path) - 1):
            a = cell_path[i]
            b = cell_path[i + 1]
            lat_a, lon_a = grid_to_latlon(a[0], a[1], self.meta)
            lat_b, lon_b = grid_to_latlon(b[0], b[1], self.meta)
            dist = haversine_mars(lat_a, lon_a, lat_b, lon_b)

            elev_a = float(self._elev[a[0], a[1]])
            elev_b = float(self._elev[b[0], b[1]])
            elev_change = elev_b - elev_a

            slope_b = float(self._slope[b[0], b[1]])
            trav_b = float(self._trav[b[0], b[1]])
            hazard_b = float(self._hazard[b[0], b[1]])
            sci_b = float(self._sci[b[0], b[1]])

            avg_sci = (float(self._sci[a[0], a[1]]) + sci_b) / 2

            _, breakdown = self._edge_cost(a, b, weights)

            seg = RouteSegment(
                segment_id=i,
                start=Coordinate(lat=lat_a, lon=lon_a),
                end=Coordinate(lat=lat_b, lon=lon_b),
                distance_m=dist,
                elevation_change_m=elev_change,
                slope_deg=slope_b,
                traversability_cost=trav_b,
                hazard_score=hazard_b,
                science_value=avg_sci,
                cost_breakdown=breakdown,
                contributing_layers={
                    "elevation": "MOLA/MGS",
                    "slope": "derived_from_MOLA",
                    "traversability": "derived_from_slope",
                    "hazard": "THEMIS+slope+rock_model",
                    "science_value": "CRISM/MRO_tier_model",
                },
            )
            segments.append(seg)
            total_distance_m += dist
            if elev_change > 0:
                total_elevation_gain += elev_change
            else:
                total_elevation_loss += abs(elev_change)
            max_slope = max(max_slope, slope_b)

        total_distance_km = total_distance_m / 1000.0

        # Time estimate: base_speed reduced by average traversability
        avg_trav = float(np.mean([s.traversability_cost for s in segments])) if segments else 1.0
        effective_speed_kmh = constraints.walking_speed_kmh / max(1.0, avg_trav / 3.0)
        est_time_h = total_distance_km / max(effective_speed_kmh, 0.1)

        avg_hazard = float(np.mean([s.hazard_score for s in segments])) if segments else 0.0
        total_sci = float(sum(s.science_value * s.distance_m for s in segments)) / total_distance_m if total_distance_m > 0 else 0.0
        avg_sci = float(np.mean([s.science_value for s in segments])) if segments else 0.0

        metrics = RouteMetrics(
            distance_km=round(total_distance_km, 3),
            estimated_time_hours=round(est_time_h, 3),
            avg_hazard_score=round(avg_hazard, 3),
            max_slope_deg=round(max_slope, 2),
            total_science_value=round(total_sci, 4),
            avg_science_value=round(avg_sci, 4),
            segments_count=len(segments),
            elevation_gain_m=round(total_elevation_gain, 1),
            elevation_loss_m=round(total_elevation_loss, 1),
            confidence=ConfidenceLevel.MODERATE,
        )

        return Route(
            strategy=strategy,
            path=coords,
            segments=segments,
            metrics=metrics,
        )
