"""
VICTOR — Regenerate the precomputed demo route bundle.

Writes backend/data/demo/precomputed_routes.json, which `GET /api/v1/routes/demo`
serves directly. This matters for more than startup latency: the deployment
target is Render's free tier at 0.1 shared CPU, where a live 4-strategy A* run
is projected at tens of seconds. Serving the demo from this file makes the
primary demo path cost zero computation.

Route selection is deliberate. Across Jezero's flat crater floor the four
strategies converge — on real MOLA terrain a landing-site-to-delta traverse
separates them by only a few percent on hazard. That is a true property of
benign terrain, not a bug, but it makes for a weak demonstration of a
multi-objective engine. The default traverse therefore crosses the crater floor
from near the Carbonate Deposit Gamma margin (18.44, 77.34) northeast to
(18.60, 77.45): measured spread across the four strategies is ~18% on hazard,
~16% on science and ~10% on distance, with all four routes Pareto non-dominated
and a catalogued science target in range — same real data, same untouched
weight profiles. Rim-climbing traverses separate harder still, but every one
within this window blows the 6 h EVA budget, so none can serve as the demo.

Usage (from the repository root):
    python scripts/generate_demo_routes.py
    python scripts/generate_demo_routes.py --start 18.15,77.20 --dest 18.80,77.80
"""
import argparse
import json
import logging
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s — %(message)s")
logger = logging.getLogger("victor.demo_routes")

# Crater-floor crossing near the Carbonate Deposit Gamma margin, chosen for the
# widest measured trade-off spread that still fits the 6 h EVA budget (see the
# module docstring above).
DEFAULT_START = (18.44, 77.34)
DEFAULT_DEST = (18.60, 77.45)

OUT_PATH = ROOT / "backend" / "data" / "demo" / "precomputed_routes.json"


def parse_coord(text: str) -> tuple[float, float]:
    lat, lon = (float(p) for p in text.split(","))
    return lat, lon


def main() -> int:
    parser = argparse.ArgumentParser(description="Regenerate demo routes.")
    parser.add_argument("--start", type=parse_coord, default=DEFAULT_START,
                        help="lat,lon of the traverse start")
    parser.add_argument("--dest", type=parse_coord, default=DEFAULT_DEST,
                        help="lat,lon of the traverse destination")
    args = parser.parse_args()

    from backend.services.data_service import DataService
    from backend.services.route_engine import RouteEngine
    from backend.services.pareto_engine import compute_pareto_dominance
    from backend.models.schemas import (
        Coordinate, MissionConstraints, RouteComputeResponse,
    )

    ds = DataService()
    ds.load()
    logger.info(f"Data mode: {ds.data_mode.value}")

    engine = RouteEngine(ds)
    start = Coordinate(lat=args.start[0], lon=args.start[1])
    dest = Coordinate(lat=args.dest[0], lon=args.dest[1])
    constraints = MissionConstraints()

    logger.info(f"Computing {start.lat},{start.lon} -> {dest.lat},{dest.lon} …")
    routes = engine.compute_routes(start, dest, constraints)
    if len(routes) < 4:
        logger.error(f"Only {len(routes)} strategies produced a route; aborting.")
        return 1

    pareto = compute_pareto_dominance(routes)
    for name, route in routes.items():
        route.pareto_status = pareto[name]

    # Attach nearby science targets, exactly as /routes/compute does. Without
    # this the demo bundle ships with an empty science_targets_nearby, and the
    # briefing and report then correctly but unhelpfully report "no catalogued
    # science targets" — which undersells a core challenge requirement.
    from backend.services.science_engine import get_nearby_targets

    all_targets = ds.get_science_targets()
    for route in routes.values():
        route.science_targets_nearby = get_nearby_targets(
            route, all_targets, walking_speed_kmh=constraints.walking_speed_kmh
        )
    found = {n: len(r.science_targets_nearby or []) for n, r in routes.items()}
    logger.info(f"Science targets in range per strategy: {found}")

    response = RouteComputeResponse(
        computation_id="demo-jezero-001",
        data_mode=ds.data_mode,
        strategies=routes,
        comparison=_build_comparison(routes),
        pareto=pareto,
        provenance=ds.get_provenance(),
        effective_constraints=constraints,
    )

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(
        json.dumps(json.loads(response.model_dump_json()), indent=2),
        encoding="utf-8",
    )

    km = [r.metrics.distance_km for r in routes.values()]
    hz = [r.metrics.avg_hazard_score for r in routes.values()]
    sc = [r.metrics.avg_science_value for r in routes.values()]
    logger.info(f"Wrote {OUT_PATH.relative_to(ROOT)}")
    logger.info("Trade-off spread across strategies (higher = clearer trade-off):")
    logger.info(f"  distance {(max(km)-min(km))/max(km)*100:5.1f}%")
    logger.info(f"  hazard   {(max(hz)-min(hz))/max(hz)*100:5.1f}%")
    logger.info(f"  science  {(max(sc)-min(sc))/max(sc)*100:5.1f}%")
    for name, route in routes.items():
        m = route.metrics
        logger.info(
            f"  {name:16s} {m.distance_km:6.2f} km  haz {m.avg_hazard_score:5.3f}  "
            f"sci {m.avg_science_value:.4f}  {pareto[name].value}"
        )
    return 0


def _build_comparison(routes):
    """Build the comparison summary, mirroring the /routes/compute endpoint.

    Kept identical in shape to backend/routers/route.py so the demo payload and
    a live computation are indistinguishable to the client.
    """
    from backend.models.schemas import RouteComputeComparison, RouteRangeSummary
    from backend.models.enums import ParetoStatus

    distances = [r.metrics.distance_km for r in routes.values()]
    times = [r.metrics.estimated_time_hours for r in routes.values()]
    sciences = [r.metrics.total_science_value for r in routes.values()]
    hazards = [r.metrics.avg_hazard_score for r in routes.values()]
    non_dominated = sum(
        1 for r in routes.values() if r.pareto_status == ParetoStatus.NON_DOMINATED
    )

    return RouteComputeComparison(
        distance_range=RouteRangeSummary(min=round(min(distances), 3), max=round(max(distances), 3)),
        time_range=RouteRangeSummary(min=round(min(times), 3), max=round(max(times), 3)),
        science_range=RouteRangeSummary(min=round(min(sciences), 4), max=round(max(sciences), 4)),
        hazard_range=RouteRangeSummary(min=round(min(hazards), 3), max=round(max(hazards), 3)),
        trade_off_summary=(
            f"Distance range: {min(distances):.1f}–{max(distances):.1f} km. "
            f"Time range: {min(times):.1f}–{max(times):.1f} h. "
            f"Science range: {min(sciences):.3f}–{max(sciences):.3f}. "
            f"Non-dominated routes: {non_dominated}."
        ),
    )


if __name__ == "__main__":
    sys.exit(main())
