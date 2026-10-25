"""VICTOR — Mission briefing and report export router."""
from __future__ import annotations

import base64
import html
import json
import logging
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse, Response

from ..config import settings
from ..dependencies import get_data_service
from ..services.briefing import generate_briefing
from ..services.pdf_report import generate_nasa_pdf_report

router = APIRouter(prefix="/api/v1/report", tags=["report"])
logger = logging.getLogger("victor.report")

# Deep link back into the planner, shown in the report's toolbar. FRONTEND_URL
# is configuration, so a deployed frontend gets a working link instead of a
# hardcoded localhost one.
PLANNER_URL = f"{settings.FRONTEND_URL.rstrip('/')}/planner/?section=report"


def _load_computation(computation_id: str):
    """Fetch a stored computation or 404.

    Reads through the shared store, so this resolves even after a restart when
    Postgres persistence is configured. Falls back to the committed demo bundle
    so a report or briefing link for the demo route works on a cold process,
    without the client having had to call /routes/demo first.
    """
    from pathlib import Path

    from .route import _computation_store

    stored = _computation_store.get(computation_id)
    if stored:
        return stored

    # Check local disk cache
    cache_dir = Path(__file__).parent.parent / "data" / "cache" / "computations"
    cache_file = cache_dir / f"{computation_id}.json"
    if cache_file.exists():
        try:
            from ..models.schemas import RouteComputeResponse

            data = json.loads(cache_file.read_text(encoding="utf-8"))
            response = RouteComputeResponse.model_validate(data)
            entry = {
                "response": response,
                "routes": response.strategies,
                "request": None,
            }
            _computation_store[computation_id] = entry
            return entry
        except Exception as exc:
            logger.warning(f"Could not load disk cached computation {computation_id}: {exc}")

    demo_file = Path(__file__).parent.parent / "data" / "demo" / "precomputed_routes.json"
    if demo_file.exists():
        try:
            from ..models.schemas import RouteComputeResponse

            data = json.loads(demo_file.read_text(encoding="utf-8"))
            if data.get("computation_id") == computation_id or computation_id.startswith("demo-"):
                response = RouteComputeResponse.model_validate(data)
                entry = {
                    "response": response,
                    "routes": response.strategies,
                    "request": None,
                }
                _computation_store[computation_id] = entry
                return entry
        except Exception as exc:
            logger.warning(f"Could not load demo bundle: {exc}")

    raise HTTPException(
        status_code=404,
        detail=f"Unknown computation_id '{computation_id}'. Compute a route first.",
    )


@router.get("/briefing/{computation_id}")
async def get_briefing(
    computation_id: str,
    strategy: str = Query(..., description="Strategy to brief, e.g. BALANCED"),
    data_service=Depends(get_data_service),
):
    """Narrative mission briefing for one strategy of a computed route.

    Cached against the computation so a repeat view costs no CPU and no tokens.
    """
    from .route import _computation_store

    stored = _load_computation(computation_id)
    response = stored["response"]

    strat_upper = strategy.upper()
    if strat_upper != "ALL" and strat_upper not in response.strategies:
        raise HTTPException(
            status_code=422,
            detail=f"Strategy '{strategy}' not in this computation. "
                   f"Available: {sorted(response.strategies)} or ALL",
        )

    strat_key = "ALL" if strat_upper == "ALL" else strategy
    route = response.strategies.get(strat_key) or next(iter(response.strategies.values()))

    cache_key = f"briefing:{computation_id}:{strat_key}"
    cached = _computation_store.get_cached_route(cache_key)
    if cached is not None:
        return {**cached, "cached": True}

    result = generate_briefing(
        strategy=strat_key,
        route=route,
        all_routes=response.strategies,
        pareto=response.pareto,
        data_mode=response.data_mode.value,
        compliance=data_service.compliance,
        terrain_classes=data_service.terrain_classes,
        terrain_at=data_service.terrain_class_at,
    )
    payload = {
        "computation_id": computation_id,
        "strategy": strat_key,
        "briefing": result["briefing"],
        "generator": result["generator"],
    }
    _computation_store.put_cached_route(cache_key, payload)
    return {**payload, "cached": False}


# ── Mission report export ────────────────────────────────────────────────────

_REPORT_CSS = """
:root {
  --nasa-blue: #0B3D91;
  --nasa-red: #FC3D21;
  --ink: #0F172A;
  --text-secondary: #334155;
  --muted: #64748B;
  --line: #CBD5E1;
  --line-light: #E2E8F0;
  --bg-card: #F8FAFC;
  --bg-header: #F1F5F9;
  --accent: #0B3D91;
}
* { box-sizing: border-box; }
body {
  font: 13.5px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  color: var(--ink);
  max-width: 920px;
  margin: 0 auto;
  padding: 36px 32px 48px;
  background: #FFFFFF;
}
.nasa-banner {
  border-bottom: 3px solid var(--nasa-blue);
  padding-bottom: 12px;
  margin-bottom: 24px;
}
.agency-title {
  color: var(--nasa-blue);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin: 0 0 4px;
}
.subagency-title {
  color: var(--nasa-red);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin: 0 0 10px;
}
h1 {
  font-size: 24px;
  font-weight: 800;
  color: var(--ink);
  margin: 0 0 4px;
  letter-spacing: -0.02em;
}
.doc-subtitle {
  color: var(--muted);
  font-size: 12px;
  margin: 0;
}
h2 {
  font-size: 15px;
  font-weight: 700;
  color: var(--nasa-blue);
  margin: 28px 0 10px;
  padding-bottom: 6px;
  border-bottom: 1.5px solid var(--nasa-blue);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
h3 {
  font-size: 13px;
  font-weight: 700;
  color: var(--ink);
  margin: 16px 0 6px;
}
.sub { color: var(--muted); margin: 0 0 16px; font-size: 12px; }
table {
  width: 100%;
  border-collapse: collapse;
  margin: 10px 0 18px;
  font-size: 12px;
  border: 1px solid var(--line);
}
th, td {
  text-align: left;
  padding: 6px 10px;
  border: 1px solid var(--line-light);
}
th {
  background: var(--bg-header);
  font-weight: 700;
  color: var(--text-secondary);
}
td.num { text-align: right; font-variant-numeric: tabular-nums; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10.5px; font-weight: 700; text-transform: uppercase; }
.ok { background: #DCFCE7; color: #15803D; border: 1px solid #86EFAC; }
.warn { background: #FEF3C7; color: #B45309; border: 1px solid #FCD34D; }
.pill { background: #EFF6FF; color: var(--nasa-blue); border: 1px solid #BFDBFE; }
.note {
  background: var(--bg-card);
  border-left: 3px solid var(--nasa-blue);
  padding: 10px 14px;
  margin: 12px 0;
  font-size: 12px;
}
.caveat {
  background: #FFFBEB;
  border-left: 3px solid #D97706;
  padding: 10px 14px;
  margin: 12px 0;
  font-size: 12px;
}
code {
  background: #F1F5F9;
  color: #0F172A;
  padding: 1px 5px;
  border-radius: 3px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
}
footer {
  margin-top: 40px;
  padding-top: 14px;
  border-top: 1px solid var(--line);
  color: var(--muted);
  font-size: 11px;
  display: flex;
  justify-content: space-between;
}
@media print {
  body { padding: 0; max-width: none; font-size: 11px; }
  h2 { page-break-after: avoid; }
  table { page-break-inside: avoid; }
  .no-print { display: none !important; }
}
"""


def _esc(value) -> str:
    return html.escape(str(value)) if value is not None else "—"


def _build_report_html(computation_id: str, response, ds, strategy: str,
                       briefing_text: str, generator: str) -> str:
    """Render a self-contained mission report.

    Everything is inlined — no external CSS, fonts or scripts — so the saved
    file remains complete and printable offline. The provenance appendix is the
    substantive part: it is what makes the report portable evidence that the
    entry used real NASA data from multiple missions.
    """
    is_all = (strategy.upper() == "ALL")
    route = response.strategies.get("BALANCED") if is_all else response.strategies[strategy]
    m = route.metrics
    compliance = ds.compliance or {}
    meta = ds.metadata
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    verified = response.data_mode.value == "VERIFIED_SNAPSHOT"
    if verified:
        mode_badge = '<span class="badge ok">NASA PDS ARCHIVE (JEZERO BASELINE)</span>'
    elif response.data_mode.value == "LIVE":
        mode_badge = '<span class="badge ok">LIVE NASA PDS STREAM</span>'
    else:
        mode_badge = '<span class="badge warn">SYNTHETIC TERRAIN DEMONSTRATION</span>'

    # Load logos as base64 if present
    logo_path = Path(__file__).parent.parent / "assets" / "nasa_logo.png"
    victor_path = Path(__file__).parent.parent / "assets" / "victor_logo.png"
    logo_html = ""
    victor_html = ""
    if logo_path.exists():
        try:
            b64_data = base64.b64encode(logo_path.read_bytes()).decode("ascii")
            logo_html = f'<img src="data:image/png;base64,{b64_data}" alt="NASA Insignia" style="width: 80px; height: 66px; object-fit: contain; flex-shrink: 0;" />'
        except Exception as exc:
            logger.warning(f"Failed to read logo image: {exc}")
    if victor_path.exists():
        try:
            b64_v = base64.b64encode(victor_path.read_bytes()).decode("ascii")
            victor_html = f'<img src="data:image/png;base64,{b64_v}" alt="VICTOR Mission Crest" style="width: 76px; height: 76px; object-fit: contain; flex-shrink: 0;" />'
        except Exception as exc:
            logger.warning(f"Failed to read victor logo image: {exc}")

    # Strategy comparison
    rows = []
    for name, r in response.strategies.items():
        rm = r.metrics
        status = response.pareto.get(name)
        status_txt = status.value if hasattr(status, "value") else str(status)
        raw_reserve = getattr(rm, "required_eva_time_with_reserve_hours", None)
        reserve_h = raw_reserve if raw_reserve is not None else ((rm.estimated_time_hours * 1.2) if rm.estimated_time_hours is not None else 0.0)
        mark = " ←" if name == strategy else ""
        rows.append(
            f"<tr><td><strong>{_esc(name)}</strong>{mark}</td>"
            f"<td class='num'>{rm.distance_km:.2f}</td>"
            f"<td class='num'>{rm.estimated_time_hours:.2f}</td>"
            f"<td class='num'>{reserve_h:.2f}</td>"
            f"<td class='num'>{rm.avg_hazard_score:.3f}</td>"
            f"<td class='num'>{rm.avg_science_value:.4f}</td>"
            f"<td class='num'>{rm.max_slope_deg:.1f}</td>"
            f"<td>{_esc(status_txt)}</td></tr>"
        )
    comparison_rows = "\n".join(rows)

    # Selected route safety margin & consumables
    budget_h = getattr(m, "effective_eva_budget_hours", None) or 8.0
    raw_req_reserve = getattr(m, "required_eva_time_with_reserve_hours", None)
    time_with_reserve = raw_req_reserve if raw_req_reserve is not None else ((m.estimated_time_hours * 1.2) if m.estimated_time_hours is not None else 0.0)
    raw_reserve_add = getattr(m, "eva_reserve_hours", None)
    reserve_add_h = raw_reserve_add if raw_reserve_add is not None else (time_with_reserve - m.estimated_time_hours)
    raw_margin = getattr(m, "eva_margin_hours", None)
    margin_h = raw_margin if raw_margin is not None else (budget_h - time_with_reserve)
    is_feasible = getattr(m, "is_feasible", None)
    if is_feasible is None:
        is_feasible = (time_with_reserve <= budget_h)

    feasibility_badge = (
        f'<span class="badge ok">FEASIBLE (+{margin_h:.2f} h margin)</span>'
        if is_feasible else
        f'<span class="badge warn">OVER BUDGET ({abs(margin_h):.2f} h deficit)</span>'
    )

    # Science targets along the selected route
    targets = route.science_targets_nearby or []
    if targets:
        t_rows = []
        for t in targets:
            name = getattr(t, "name", None)
            dist = getattr(t, "distance_from_route_m", None)
            val = getattr(t, "science_value", None)
            tier = getattr(t, "tier", None)
            t_rows.append(
                f"<tr><td>{_esc(name)}</td>"
                f"<td class='num'>{f'{dist / 1000:.2f}' if dist is not None else '—'}</td>"
                f"<td class='num'>{f'{val:.2f}' if val is not None else '—'}</td>"
                f"<td class='num'>{_esc(tier)}</td></tr>"
            )
        science_block = (
            "<table><thead><tr><th>Target</th><th>Distance from route (km)</th>"
            "<th>Priority (0-1)</th><th>Tier</th></tr></thead><tbody>"
            + "\n".join(t_rows) + "</tbody></table>"
        )
    else:
        science_block = "<p>No catalogued science targets fall within range of this route.</p>"

    # Provenance appendix — the point of the whole document
    prov_rows = []
    for p in ds.get_provenance():
        prov_rows.append(
            f"<tr><td><strong>{_esc(p.instrument)}</strong><br>"
            f"<span style='color:#6B7280;font-size:12px'>{_esc(p.mission)}</span></td>"
            f"<td><code>{_esc(p.pds_product_id)}</code></td>"
            f"<td>{_esc(p.confidence)}</td>"
            f"<td class='num'>{_esc(p.resolution_m)}</td>"
            f"<td style='font-size:12px'>{_esc(p.notes)[:400]}</td></tr>"
        )
    provenance_rows = "\n".join(prov_rows)

    missions = compliance.get("nasa_missions", [])
    mission_pills = " ".join(
        f'<span class="badge pill">{_esc(mn)}</span>' for mn in missions
    ) or "—"

    grid_class = ds._raw_metadata.get("grid_classification", {}) if getattr(ds, "_raw_metadata", None) else {}
    class_rows = "\n".join(
        f"<tr><td><code>{_esc(k)}</code></td><td>{_esc(v)}</td></tr>"
        for k, v in sorted(grid_class.items())
    ) or "<tr><td colspan='2'>—</td></tr>"

    # Markdown-ish briefing to simple HTML, without pulling in a dependency.
    brief_html = []
    for line in briefing_text.split("\n"):
        s = line.strip()
        if not s:
            continue
        if s.startswith("### "):
            brief_html.append(f"<h3>{_esc(s[4:])}</h3>")
        elif s.startswith("## "):
            brief_html.append(f"<h3>{_esc(s[3:])}</h3>")
        elif s.startswith("- "):
            brief_html.append(f"<li>{_bold(s[2:])}</li>")
        else:
            brief_html.append(f"<p>{_bold(s)}</p>")
    briefing_block = "\n".join(brief_html)

    strat_title = "All Cases" if is_all else strategy
    strat_display = "ALL EVALUATED CASES (SAFEST, FASTEST, SCIENCE_RICHEST, BALANCED)" if is_all else strategy

    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<title>NASA Operational Memorandum — VICTOR Jezero Traverse ({_esc(strat_title)})</title>
<style>{_REPORT_CSS}</style></head><body>

<div class="no-print" style="background:#FFFFFF;color:#1E293B;padding:12px 20px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;border-radius:8px;margin-bottom:24px;border:1px solid #CBD5E1;box-shadow:0 1px 3px rgba(0,0,0,0.06);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="display:flex;flex-wrap:wrap;align-items:center;gap:12px;">
    <span style="font-weight:700;font-size:12px;letter-spacing:0.04em;color:#0B3D91;">VICTOR TECHNICAL MEMORANDUM</span>
    <span style="color:#CBD5E1;">|</span>
    <div style="display:flex;align-items:center;gap:4px;font-size:11px;">
      <span style="color:#64748B;font-weight:500;margin-right:2px;">Case:</span>
      <a href="/api/v1/report/{computation_id}?strategy=ALL" style="padding:4px 9px;border-radius:4px;font-weight:600;text-decoration:none;background:{'#0B3D91' if strategy=='ALL' else '#F1F5F9'};color:{'#FFFFFF' if strategy=='ALL' else '#334155'};border:1px solid {'#0B3D91' if strategy=='ALL' else '#CBD5E1'};">All Cases</a>
      <a href="/api/v1/report/{computation_id}?strategy=SAFEST" style="padding:4px 9px;border-radius:4px;font-weight:600;text-decoration:none;background:{'#0B3D91' if strategy=='SAFEST' else '#F1F5F9'};color:{'#FFFFFF' if strategy=='SAFEST' else '#334155'};border:1px solid {'#0B3D91' if strategy=='SAFEST' else '#CBD5E1'};">Safest</a>
      <a href="/api/v1/report/{computation_id}?strategy=FASTEST" style="padding:4px 9px;border-radius:4px;font-weight:600;text-decoration:none;background:{'#0B3D91' if strategy=='FASTEST' else '#F1F5F9'};color:{'#FFFFFF' if strategy=='FASTEST' else '#334155'};border:1px solid {'#0B3D91' if strategy=='FASTEST' else '#CBD5E1'};">Fastest</a>
      <a href="/api/v1/report/{computation_id}?strategy=SCIENCE_RICHEST" style="padding:4px 9px;border-radius:4px;font-weight:600;text-decoration:none;background:{'#0B3D91' if strategy=='SCIENCE_RICHEST' else '#F1F5F9'};color:{'#FFFFFF' if strategy=='SCIENCE_RICHEST' else '#334155'};border:1px solid {'#0B3D91' if strategy=='SCIENCE_RICHEST' else '#CBD5E1'};">Science-Richest</a>
      <a href="/api/v1/report/{computation_id}?strategy=BALANCED" style="padding:4px 9px;border-radius:4px;font-weight:600;text-decoration:none;background:{'#0B3D91' if strategy=='BALANCED' else '#F1F5F9'};color:{'#FFFFFF' if strategy=='BALANCED' else '#334155'};border:1px solid {'#0B3D91' if strategy=='BALANCED' else '#CBD5E1'};">Balanced</a>
    </div>
  </div>
  <div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;">
    <a href="/api/v1/report/pdf/{computation_id}?strategy={strategy}" download style="background:#0B3D91;color:#FFFFFF;padding:6px 14px;border-radius:5px;font-size:12px;font-weight:600;text-decoration:none;border:1px solid #0B3D91;">
      Export PDF
    </a>
    <button onclick="window.print()" style="background:#FFFFFF;color:#1E293B;padding:6px 14px;border-radius:5px;font-size:12px;font-weight:600;cursor:pointer;border:1px solid #CBD5E1;">
      Print Document
    </button>
    <a href="/api/v1/report/{computation_id}?strategy={strategy}&download=true" style="background:#FFFFFF;color:#1E293B;padding:6px 14px;border-radius:5px;font-size:12px;font-weight:600;text-decoration:none;border:1px solid #CBD5E1;">
      Save HTML
    </a>
    <a href="{PLANNER_URL}" style="color:#64748B;font-size:11px;text-decoration:none;margin-left:6px;font-weight:500;">
      ← Return to Planner
    </a>
  </div>
</div>

<div class="nasa-banner" style="display:flex;align-items:center;justify-content:space-between;gap:18px;">
  <div style="display:flex;align-items:center;gap:16px;">
    {logo_html}
    <div>
      <div class="agency-title">National Aeronautics and Space Administration</div>
      <div class="subagency-title">Mars Exploration Program &middot; Surface Traverse &amp; Cartographic Intelligence</div>
      <h1>Operational Memorandum: Jezero Crater Surface Traversal</h1>
      <p class="doc-subtitle">Voyage Intelligence for Terrain-aware Cartographic Optimization &amp; Routing (VICTOR) &middot; NASA Space Apps Challenge 2026 &middot; Generated {_esc(now)}</p>
    </div>
  </div>
  {victor_html}
</div>

<table>
<tr><th>Region</th><td>Jezero Crater, Mars</td></tr>
<tr><th>Extent</th><td>{meta.lat_min}–{meta.lat_max}°N, {meta.lon_min}–{meta.lon_max}°E
    ({meta.coordinate_system})</td></tr>
<tr><th>Grid</th><td>{meta.rows}×{meta.cols}, cell {meta.cell_size_ns_m} m NS ×
    {meta.cell_size_ew_m} m EW ({meta.cell_shape})</td></tr>
<tr><th>Data mode</th><td>{mode_badge}</td></tr>
<tr><th>NASA missions</th><td>{mission_pills}</td></tr>
<tr><th>Computation</th><td><code>{_esc(computation_id)}</code></td></tr>
<tr><th>Selected strategy</th><td><strong>{_esc(strat_display)}</strong></td></tr>
</table>

<h2>Mission Briefing</h2>
<p class="sub" style="margin:0 0 10px">
  Generated by: <strong>{_esc(generator)}</strong>
  {'(deterministic template — no external service)' if generator == 'template' else '(language model, constrained to the computed fact sheet)'}
</p>
{briefing_block}

<h2>Strategy Comparison</h2>
<table><thead><tr>
<th>Strategy</th><th>Distance (km)</th><th>Time (h)</th><th>+20% Reserve (h)</th>
<th>Hazard (0-10)</th><th>Science (0-1)</th><th>Max slope (°)</th><th>Pareto</th>
</tr></thead><tbody>
{comparison_rows}
</tbody></table>
<div class="note">
  <strong>Pareto non-dominance</strong> means no other computed route is better
  in every objective simultaneously. {_esc(response.comparison.trade_off_summary)}
</div>

<h2>Route Profile &amp; Consumables</h2>
<table>
<tr><th>Distance</th><td class="num">{m.distance_km:.2f} km</td>
    <th>Raw estimated EVA time</th><td class="num">{m.estimated_time_hours:.2f} h</td></tr>
<tr><th>Life-Support Reserve (+20%)</th><td class="num">+{reserve_add_h:.2f} h</td>
    <th>Total Required Budget</th><td class="num"><strong>{time_with_reserve:.2f} h</strong> (Ceiling: {budget_h:.1f} h)</td></tr>
<tr><th>Consumables Feasibility</th><td>{feasibility_badge}</td>
    <th>Mean hazard</th><td class="num">{m.avg_hazard_score:.3f} / 10</td></tr>
<tr><th>Max slope</th><td class="num">{m.max_slope_deg:.2f}°</td>
    <th>Elevation change</th><td class="num">+{m.elevation_gain_m:.0f} m / -{m.elevation_loss_m:.0f} m</td></tr>
<tr><th>Discrete route links</th><td class="num">{m.segments_count}</td>
    <th>Impassable cells avoided</th><td class="num">{m.impassable_cells_avoided}</td></tr>
</table>

<h2>Science Opportunities</h2>
{science_block}
<div class="caveat">
  Science priority is a <strong>MODEL score</strong> derived from CRISM mineral
  indices and published Jezero target locations. It is not a direct measurement
  of scientific value.
</div>

<h2>Appendix A — Data Provenance</h2>
<p>Every grid this report rests on, traced to its source product.</p>
<table><thead><tr>
<th>Instrument / Mission</th><th>Product ID</th><th>Confidence</th>
<th>Resolution (m)</th><th>Processing &amp; caveats</th>
</tr></thead><tbody>
{provenance_rows}
</tbody></table>

<h3>Per-grid classification</h3>
<table><thead><tr><th>Grid</th><th>Classification</th></tr></thead><tbody>
{class_rows}
</tbody></table>
<div class="note">
  <strong>MEASURED</strong> — read from a published NASA product.
  <strong>DERIVED</strong> — computed from measured inputs by a documented
  transformation. <strong>MODELLED</strong> — assigned by a VICTOR model, not a
  measurement of that quantity.
</div>

<h2>Appendix B — Method</h2>
<p>Routes are computed by multi-objective A* over the {meta.rows}×{meta.cols}
grid. Science-seeking is expressed as a <strong>non-negative penalty</strong>
(<code>1 − science_value</code>) rather than a negative reward, which keeps all
edge costs non-negative and preserves A*'s optimality guarantee. Every cost term
is scaled by step distance, so the cost is a cost-per-kilometre and diagonal
steps are charged for the extra ground they cover.</p>
<p>The heuristic is <code>w_distance × distance/1000</code>. Since all terms are
non-negative and any path is at least as long as the straight line, the true
remaining cost is never less than the heuristic — so it never overestimates,
which is the admissibility condition A* requires for optimality.</p>

<footer>
  <div>NASA SPACE APPS CHALLENGE 2026 &middot; VICTOR JEZERO PATHFINDER &middot; UNCLASSIFIED / PUBLIC RELEASE</div>
  <div>Report generated {_esc(now)}</div>
</footer>
</body></html>"""


def _bold(text: str) -> str:
    """Render **bold** spans, escaping everything else."""
    parts = text.split("**")
    out = []
    for i, part in enumerate(parts):
        out.append(f"<strong>{html.escape(part)}</strong>" if i % 2 else html.escape(part))
    return "".join(out)


@router.get("/{computation_id}", response_class=HTMLResponse)
async def export_report(
    computation_id: str,
    strategy: str = Query("BALANCED", description="Strategy to report on, or ALL for comparative evaluation"),
    download: bool = Query(False, description="Send as a file attachment"),
    data_service=Depends(get_data_service),
):
    """Self-contained HTML mission report. Print to PDF from the browser."""
    stored = _load_computation(computation_id)
    response = stored["response"]

    strat_upper = strategy.upper()
    if strat_upper != "ALL" and strat_upper not in response.strategies:
        raise HTTPException(
            status_code=422,
            detail=f"Strategy '{strategy}' not in this computation. "
                   f"Available: {sorted(response.strategies)} or ALL",
        )

    strat_key = "ALL" if strat_upper == "ALL" else strategy
    route = response.strategies.get(strat_key) or next(iter(response.strategies.values()))

    brief = generate_briefing(
        strategy=strat_key,
        route=route,
        all_routes=response.strategies,
        pareto=response.pareto,
        data_mode=response.data_mode.value,
        compliance=data_service.compliance,
        terrain_classes=data_service.terrain_classes,
        terrain_at=data_service.terrain_class_at,
    )

    body = _build_report_html(
        computation_id, response, data_service, strat_key,
        brief["briefing"], brief["generator"],
    )

    headers = {}
    if download:
        stamp = datetime.now(timezone.utc).strftime("%Y%m%d")
        headers["Content-Disposition"] = (
            f'attachment; filename="victor-mission-report-{strat_key.lower()}-{stamp}.html"'
        )
    return HTMLResponse(content=body, headers=headers)


@router.get("/pdf/{computation_id}")
async def export_pdf_report(
    computation_id: str,
    strategy: str = Query("BALANCED", description="Strategy to report on, or ALL for comparative evaluation"),
    data_service=Depends(get_data_service),
):
    """Publication-grade NASA Technical Memorandum PDF mission report."""
    stored = _load_computation(computation_id)
    response = stored["response"]

    strat_upper = strategy.upper()
    if strat_upper != "ALL" and strat_upper not in response.strategies:
        raise HTTPException(
            status_code=422,
            detail=f"Strategy '{strategy}' not in this computation. Available: {sorted(response.strategies)} or ALL",
        )

    strat_key = "ALL" if strat_upper == "ALL" else strategy
    route = response.strategies.get(strat_key) or next(iter(response.strategies.values()))

    brief = generate_briefing(
        strategy=strat_key,
        route=route,
        all_routes=response.strategies,
        pareto=response.pareto,
        data_mode=response.data_mode.value,
        compliance=data_service.compliance,
        terrain_classes=data_service.terrain_classes,
        terrain_at=data_service.terrain_class_at,
    )

    pdf_bytes = generate_nasa_pdf_report(
        computation_id=computation_id,
        response=response,
        ds=data_service,
        strategy=strat_key,
        briefing_text=brief["briefing"],
        generator=brief["generator"],
    )

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d")
    filename = f"NASA_TM_VICTOR_{strat_key}_{stamp}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Type": "application/pdf",
        },
    )
