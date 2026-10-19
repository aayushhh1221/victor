"""VICTOR — Mission briefing and report export router."""
from __future__ import annotations

import html
import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse

from ..dependencies import get_data_service
from ..services.briefing import generate_briefing

router = APIRouter(prefix="/api/v1/report", tags=["report"])
logger = logging.getLogger("victor.report")


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

    demo_file = Path(__file__).parent.parent / "data" / "demo" / "precomputed_routes.json"
    if demo_file.exists():
        try:
            from ..models.schemas import RouteComputeResponse

            data = json.loads(demo_file.read_text(encoding="utf-8"))
            if data.get("computation_id") == computation_id:
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

    if strategy not in response.strategies:
        raise HTTPException(
            status_code=422,
            detail=f"Strategy '{strategy}' not in this computation. "
                   f"Available: {sorted(response.strategies)}",
        )

    cache_key = f"briefing:{computation_id}:{strategy}"
    cached = _computation_store.get_cached_route(cache_key)
    if cached is not None:
        return {**cached, "cached": True}

    result = generate_briefing(
        strategy=strategy,
        route=response.strategies[strategy],
        all_routes=response.strategies,
        pareto=response.pareto,
        data_mode=response.data_mode.value,
        compliance=data_service.compliance,
        terrain_classes=data_service.terrain_classes,
        terrain_at=data_service.terrain_class_at,
    )
    payload = {
        "computation_id": computation_id,
        "strategy": strategy,
        "briefing": result["briefing"],
        "generator": result["generator"],
    }
    _computation_store.put_cached_route(cache_key, payload)
    return {**payload, "cached": False}


# ── Mission report export ────────────────────────────────────────────────────

_REPORT_CSS = """
:root { --ink:#111827; --muted:#6B7280; --line:#E5E7EB; --accent:#1D4ED8; }
* { box-sizing:border-box; }
body { font:14px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
       color:var(--ink); max-width:900px; margin:0 auto; padding:32px; }
h1 { font-size:26px; margin:0 0 4px; }
h2 { font-size:18px; margin:28px 0 10px; padding-bottom:6px;
     border-bottom:2px solid var(--line); }
h3 { font-size:15px; margin:18px 0 6px; }
.sub { color:var(--muted); margin:0 0 20px; }
table { width:100%; border-collapse:collapse; margin:10px 0 18px; font-size:13px; }
th,td { text-align:left; padding:7px 9px; border-bottom:1px solid var(--line); }
th { background:#F9FAFB; font-weight:600; }
td.num { text-align:right; font-variant-numeric:tabular-nums; }
.badge { display:inline-block; padding:2px 8px; border-radius:10px; font-size:11px;
         font-weight:600; }
.ok { background:#DCFCE7; color:#166534; }
.warn { background:#FEF3C7; color:#92400E; }
.pill { background:#EFF6FF; color:var(--accent); }
.note { background:#F9FAFB; border-left:3px solid var(--accent); padding:10px 14px;
        margin:14px 0; font-size:13px; }
.caveat { background:#FFFBEB; border-left:3px solid #D97706; padding:10px 14px;
          margin:14px 0; font-size:13px; }
code { background:#F3F4F6; padding:1px 5px; border-radius:3px; font-size:12px; }
footer { margin-top:36px; padding-top:14px; border-top:1px solid var(--line);
         color:var(--muted); font-size:12px; }
@media print { body { padding:0; max-width:none; } h2 { page-break-after:avoid; }
               table { page-break-inside:avoid; } }
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
    route = response.strategies[strategy]
    m = route.metrics
    compliance = ds.compliance or {}
    meta = ds.metadata
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    verified = response.data_mode.value == "VERIFIED_SNAPSHOT"
    mode_badge = (
        f'<span class="badge ok">{_esc(response.data_mode.value)}</span>'
        if verified else
        f'<span class="badge warn">{_esc(response.data_mode.value)}</span>'
    )

    # Strategy comparison
    rows = []
    for name, r in response.strategies.items():
        rm = r.metrics
        status = response.pareto.get(name)
        status_txt = status.value if hasattr(status, "value") else str(status)
        mark = " ←" if name == strategy else ""
        rows.append(
            f"<tr><td><strong>{_esc(name)}</strong>{mark}</td>"
            f"<td class='num'>{rm.distance_km:.2f}</td>"
            f"<td class='num'>{rm.estimated_time_hours:.2f}</td>"
            f"<td class='num'>{rm.avg_hazard_score:.3f}</td>"
            f"<td class='num'>{rm.avg_science_value:.4f}</td>"
            f"<td class='num'>{rm.max_slope_deg:.1f}</td>"
            f"<td>{_esc(status_txt)}</td></tr>"
        )
    comparison_rows = "\n".join(rows)

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

    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<title>VICTOR Mission Report — {_esc(strategy)}</title>
<style>{_REPORT_CSS}</style></head><body>

<h1>VICTOR Mission Report</h1>
<p class="sub">Voyage Intelligence for Terrain-aware Cartographic Optimization
&amp; Routing &middot; Generated {_esc(now)}</p>

<table>
<tr><th>Region</th><td>Jezero Crater, Mars</td></tr>
<tr><th>Extent</th><td>{meta.lat_min}–{meta.lat_max}°N, {meta.lon_min}–{meta.lon_max}°E
    ({meta.coordinate_system})</td></tr>
<tr><th>Grid</th><td>{meta.rows}×{meta.cols}, cell {meta.cell_size_ns_m} m NS ×
    {meta.cell_size_ew_m} m EW ({meta.cell_shape})</td></tr>
<tr><th>Data mode</th><td>{mode_badge}</td></tr>
<tr><th>NASA missions</th><td>{mission_pills}</td></tr>
<tr><th>Computation</th><td><code>{_esc(computation_id)}</code></td></tr>
<tr><th>Selected strategy</th><td><strong>{_esc(strategy)}</strong></td></tr>
</table>

<h2>Mission Briefing</h2>
<p class="sub" style="margin:0 0 10px">
  Generated by: <strong>{_esc(generator)}</strong>
  {'(deterministic template — no external service)' if generator == 'template' else '(language model, constrained to the computed fact sheet)'}
</p>
{briefing_block}

<h2>Strategy Comparison</h2>
<table><thead><tr>
<th>Strategy</th><th>Distance (km)</th><th>Time (h)</th>
<th>Hazard (0-10)</th><th>Science (0-1)</th><th>Max slope (°)</th><th>Pareto</th>
</tr></thead><tbody>
{comparison_rows}
</tbody></table>
<div class="note">
  <strong>Pareto non-dominance</strong> means no other computed route is better
  in every objective simultaneously. {_esc(response.comparison.trade_off_summary)}
</div>

<h2>Route Profile</h2>
<table>
<tr><th>Distance</th><td class="num">{m.distance_km:.2f} km</td>
    <th>Estimated EVA time</th><td class="num">{m.estimated_time_hours:.2f} h</td></tr>
<tr><th>Mean hazard</th><td class="num">{m.avg_hazard_score:.3f} / 10</td>
    <th>Max slope</th><td class="num">{m.max_slope_deg:.2f}°</td></tr>
<tr><th>Elevation gain</th><td class="num">{m.elevation_gain_m:.0f} m</td>
    <th>Elevation loss</th><td class="num">{m.elevation_loss_m:.0f} m</td></tr>
<tr><th>Segments</th><td class="num">{m.segments_count}</td>
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
VICTOR &middot; NASA Mars Exploration &middot;
Autonomous Route Intelligence &middot;
Report generated {_esc(now)}
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
    strategy: str = Query("BALANCED", description="Strategy to report on"),
    download: bool = Query(False, description="Send as a file attachment"),
    data_service=Depends(get_data_service),
):
    """Self-contained HTML mission report. Print to PDF from the browser.

    Streamed straight to the client rather than written to disk: the deployment
    filesystem is ephemeral, so a server-side temp file would be both pointless
    and a quota risk.
    """
    stored = _load_computation(computation_id)
    response = stored["response"]

    if strategy not in response.strategies:
        raise HTTPException(
            status_code=422,
            detail=f"Strategy '{strategy}' not in this computation. "
                   f"Available: {sorted(response.strategies)}",
        )

    brief = generate_briefing(
        strategy=strategy,
        route=response.strategies[strategy],
        all_routes=response.strategies,
        pareto=response.pareto,
        data_mode=response.data_mode.value,
        compliance=data_service.compliance,
        terrain_classes=data_service.terrain_classes,
        terrain_at=data_service.terrain_class_at,
    )

    body = _build_report_html(
        computation_id, response, data_service, strategy,
        brief["briefing"], brief["generator"],
    )

    headers = {}
    if download:
        stamp = datetime.now(timezone.utc).strftime("%Y%m%d")
        headers["Content-Disposition"] = (
            f'attachment; filename="victor-mission-report-{strategy.lower()}-{stamp}.html"'
        )
    return HTMLResponse(content=body, headers=headers)
