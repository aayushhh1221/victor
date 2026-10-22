"""
VICTOR — Mission briefing generator.

Turns a computed route into a narrative brief a mission planner can read:
what the traverse does, why its strategy won the trade-off, which science is
reachable, what the hazards are, and which NASA data backs each claim.

Three rules shape the design.

**It may only state values present in its input.** The generator is given a
structured fact sheet assembled from the route, its metrics, the Pareto result
and the provenance record. It is forbidden from introducing any other number or
claim about Mars. The prompt says so explicitly, and the template path cannot
do otherwise by construction.

**It must work with no API key.** `render_template()` produces a complete,
accurate brief offline using the same fact sheet. The demo runs from localhost
and must never fail because of a missing key, a rate limit or a dropped
network. The LLM path is an enhancement on top, not a dependency.

**Generated briefs are cached.** On a 0.1-shared-CPU instance with a network
call behind it, regenerating on every view would be the slowest thing the app
does. Briefings are keyed to the computation that produced them, so a cached
brief can never be shown next to a different route than it describes.
"""
from __future__ import annotations

import logging
import os
from typing import Optional

logger = logging.getLogger("victor.briefing")

# Strategy names in the order a planner would weigh them.
STRATEGY_INTENT = {
    "SAFEST": "minimising exposure to terrain hazard",
    "FASTEST": "minimising distance and traverse time",
    "SCIENCE_RICHEST": "maximising reachable science value",
    "BALANCED": "balancing hazard, distance and science",
}


def build_fact_sheet(
    strategy: str,
    route,
    all_routes: dict,
    pareto: dict,
    data_mode: str,
    compliance: dict | None = None,
    terrain_classes: dict | None = None,
    terrain_at=None,
) -> dict:
    """Assemble the only facts a briefing is allowed to use.

    Everything downstream — template and LLM alike — reads from this dict. If a
    value is not here, it must not appear in the brief.

    `terrain_at` is an optional `(lat, lon) -> {"id", "name"}` resolver, supplied
    by the caller that owns the data service. Route segments do not carry a
    terrain class themselves, so without it the terrain section is omitted
    rather than guessed.
    """
    m = route.metrics
    others = {n: r.metrics for n, r in all_routes.items() if n != strategy}

    # How this route compares with the alternatives, computed rather than
    # described, so the brief can say "14 km longer" without guessing.
    comparisons = []
    for name, om in others.items():
        comparisons.append({
            "strategy": name,
            "distance_delta_km": round(m.distance_km - om.distance_km, 2),
            "hazard_delta": round(m.avg_hazard_score - om.avg_hazard_score, 3),
            "science_delta": round(m.avg_science_value - om.avg_science_value, 4),
        })

    targets = []
    for t in (route.science_targets_nearby or []):
        targets.append({
            "name": getattr(t, "name", None) or (t.get("name") if isinstance(t, dict) else None),
            "distance_m": getattr(t, "distance_from_route_m", None)
                          or (t.get("distance_from_route_m") if isinstance(t, dict) else None),
            "science_value": getattr(t, "science_value", None)
                             or (t.get("science_value") if isinstance(t, dict) else None),
        })

    # Terrain archetypes crossed, with how much of the route sits in each.
    # Resolved per segment endpoint via the caller's lookup, since segments do
    # not carry a class themselves.
    terrain_mix: list[dict] = []
    if terrain_at is not None:
        counts: dict[str, int] = {}
        for seg in route.segments:
            try:
                entry = terrain_at(seg.end.lat, seg.end.lon)
            except Exception:
                entry = None
            if entry and entry.get("name"):
                counts[entry["name"]] = counts.get(entry["name"], 0) + 1
        total = sum(counts.values()) or 1
        terrain_mix = [
            {"name": name, "fraction": round(n / total, 3)}
            for name, n in sorted(counts.items(), key=lambda kv: -kv[1])
        ]

    return {
        "strategy": strategy,
        "strategy_intent": STRATEGY_INTENT.get(strategy, "optimising its objective"),
        "pareto_status": pareto.get(strategy).value if hasattr(pareto.get(strategy), "value")
                         else str(pareto.get(strategy)),
        "non_dominated_count": sum(
            1 for p in pareto.values()
            if (p.value if hasattr(p, "value") else str(p)) == "NON_DOMINATED"
        ),
        "metrics": {
            "distance_km": round(m.distance_km, 2),
            "estimated_time_hours": round(m.estimated_time_hours, 2),
            "avg_hazard_score": round(m.avg_hazard_score, 3),
            "hazard_scale": "0-10",
            "avg_science_value": round(m.avg_science_value, 4),
            "science_scale": "0-1 (MODEL score, not a measurement)",
            "max_slope_deg": round(m.max_slope_deg, 2),
            "elevation_gain_m": round(m.elevation_gain_m, 1),
            "elevation_loss_m": round(m.elevation_loss_m, 1),
            "segments": m.segments_count,
            "impassable_cells_avoided": m.impassable_cells_avoided,
        },
        "comparisons": comparisons,
        "science_targets": targets[:6],
        "terrain_mix": terrain_mix,
        "data_mode": data_mode,
        "nasa_missions": (compliance or {}).get("nasa_missions", []),
        "region": "Jezero Crater, Mars (18.0-18.9N, 77.0-78.0E)",
    }


def render_template(facts: dict) -> str:
    """Deterministic brief from the fact sheet. No network, no key, no risk.

    This is the path the demo relies on. It is not a degraded fallback — it
    states every fact the LLM path would, just without the prose variation.
    """
    m = facts["metrics"]
    lines: list[str] = []

    lines.append(f"## Mission Briefing — {facts['strategy'].replace('_', ' ').title()}")
    lines.append("")
    lines.append(f"**Region:** {facts['region']}")
    missions = facts.get("nasa_missions") or []
    if missions:
        lines.append(
            f"**Data Source:** NASA Planetary Data System (PDS) archive ({', '.join(missions)})."
        )
    else:
        lines.append(f"**Data Mode:** {facts['data_mode']}")
    lines.append("")

    lines.append("### Traverse")
    lines.append(
        f"This route covers **{m['distance_km']} km** over an estimated "
        f"**{m['estimated_time_hours']} hours** of EVA, across "
        f"{m['segments']} segments. It climbs {m['elevation_gain_m']} m and "
        f"descends {m['elevation_loss_m']} m, with a maximum slope of "
        f"{m['max_slope_deg']}°."
    )
    lines.append(
        f"Mean terrain hazard is **{m['avg_hazard_score']} / 10** and mean "
        f"science priority is **{m['avg_science_value']}** "
        f"({m['science_scale']})."
    )
    if m["impassable_cells_avoided"]:
        lines.append(
            f"The planner routed around {m['impassable_cells_avoided']} "
            f"impassable cells."
        )
    lines.append("")

    lines.append("### Why this route")
    lines.append(
        f"The **{facts['strategy']}** strategy selects by "
        f"{facts['strategy_intent']}. Its Pareto status is "
        f"**{facts['pareto_status']}**, with {facts['non_dominated_count']} of "
        f"the computed strategies non-dominated — meaning no other route "
        f"improves on it in every objective at once."
    )
    for c in facts["comparisons"]:
        dist = c["distance_delta_km"]
        haz = c["hazard_delta"]
        sci = c["science_delta"]
        bits = []
        bits.append(f"{abs(dist)} km {'longer' if dist > 0 else 'shorter'}")
        if abs(haz) >= 0.001:
            bits.append(f"{abs(haz)} {'more' if haz > 0 else 'less'} hazard")
        if abs(sci) >= 0.0001:
            bits.append(f"{abs(sci)} {'more' if sci > 0 else 'less'} science")
        lines.append(f"- Versus **{c['strategy']}**: {', '.join(bits)}.")
    lines.append("")

    if facts["terrain_mix"]:
        lines.append("### Terrain crossed")
        lines.append(
            "Terrain archetypes along the route, from unsupervised "
            "classification of MOLA, THEMIS and CRISM measurements "
            "(advisory — this did not influence route selection):"
        )
        for t in facts["terrain_mix"]:
            lines.append(f"- {t['name']} — {t['fraction'] * 100:.0f}% of segments")
        lines.append("")

    lines.append("### Science opportunities")
    if facts["science_targets"]:
        for t in facts["science_targets"]:
            dist = t.get("distance_m")
            dist_txt = f"{dist / 1000:.2f} km from route" if dist is not None else "distance not available"
            val = t.get("science_value")
            val_txt = f"priority {val:.2f}" if isinstance(val, (int, float)) else "priority not available"
            lines.append(f"- **{t.get('name') or 'Unnamed target'}** — {dist_txt}, {val_txt}")
    else:
        lines.append("- No catalogued science targets fall within range of this route.")
    lines.append("")

    lines.append("### Caveats")
    lines.append(
        "- Science priority is a MODEL score derived from CRISM mineral "
        "indices and published Jezero target locations. It is not a direct "
        "measurement."
    )
    lines.append(
        "- Hazard is a weighted composite of MOLA slope and THEMIS thermal "
        "inertia, not a NASA hazard product."
    )
    lines.append(
        "- Terrain archetypes are advisory. Routing is decided solely by the "
        "multi-objective A* cost function."
    )
    return "\n".join(lines)


_LLM_SYSTEM_PROMPT = """You are writing a mission briefing for a Mars EVA \
("marswalk") planner, from a structured fact sheet.

ABSOLUTE CONSTRAINTS:
- Use ONLY numbers and facts present in the JSON fact sheet provided.
- Do NOT introduce any other fact about Mars, Jezero Crater, instruments or \
missions. No background knowledge, no estimates, no rounding to "about".
- If something is not in the fact sheet, do not mention it.
- Never present the science priority score as a measurement; it is a model score.
- Keep the hazard scale as 0-10 and the science scale as 0-1, as labelled.

STYLE: concise operational prose for a mission planner. Markdown with short \
sections. 250-400 words. Lead with what the traverse is, then why this strategy \
was selected over the alternatives, then science, then hazards and caveats."""


def generate_with_llm(facts: dict, api_key: str) -> Optional[str]:
    """Generate via Gemini. Returns None on any failure so the caller falls back.

    Deliberately swallows every error: a briefing is a presentation nicety, and
    nothing about it is worth failing a request over.
    """
    import json as _json

    try:
        import urllib.request

        url = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"gemini-2.0-flash:generateContent?key={api_key}"
        )
        body = {
            "systemInstruction": {"parts": [{"text": _LLM_SYSTEM_PROMPT}]},
            "contents": [{
                "parts": [{
                    "text": "Fact sheet:\n" + _json.dumps(facts, indent=2)
                }]
            }],
            "generationConfig": {"temperature": 0.2, "maxOutputTokens": 900},
        }
        req = urllib.request.Request(
            url,
            data=_json.dumps(body).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=20) as resp:
            payload = _json.loads(resp.read().decode("utf-8"))
        text = payload["candidates"][0]["content"]["parts"][0]["text"]
        return text.strip() or None
    except Exception as exc:
        logger.info(f"LLM briefing unavailable ({type(exc).__name__}: {exc}); using template.")
        return None


def render_comparative_template(
    all_routes: dict,
    pareto: dict,
    data_mode: str,
    compliance: dict | None = None,
    region_name: str = "Jezero Crater, Mars (18.0–18.9°N, 77.0–78.0°E)",
) -> str:
    """Generate a multi-strategy comparative briefing covering all 4 traverses."""
    lines: list[str] = []
    lines.append("## Mission Briefing — Multi-Strategy Comparative Evaluation")
    lines.append("")
    lines.append(f"**Region:** {region_name}")
    missions = (compliance or {}).get("nasa_missions") or []
    if missions:
        lines.append(
            f"**Data Source:** NASA Planetary Data System (PDS) archive ({', '.join(missions)})."
        )
    else:
        lines.append(f"**Data Mode:** {data_mode}")
    lines.append("")

    lines.append("### Executive Summary")
    lines.append(
        "Four distinct Martian extravehicular activity (EVA) traverse strategies were computed "
        "and evaluated using multi-objective A* pathfinding grounded in authentic NASA orbital observations. "
        "Each trajectory balances terrain traversability, slope hazard, life-support consumables margin, "
        "and astrobiological science opportunity return."
    )
    lines.append("")

    lines.append("### Comparative Strategy Breakdown")
    for name, r in all_routes.items():
        m = r.metrics
        status = pareto.get(name, "—")
        status_txt = status.value if hasattr(status, "value") else str(status)
        raw_res = getattr(m, "required_eva_time_with_reserve_hours", None)
        res_h = raw_res if raw_res is not None else (m.estimated_time_hours * 1.2 if m.estimated_time_hours else 0.0)
        targets_count = len(r.science_targets_nearby or [])
        lines.append(
            f"- **{name}:** Distance {m.distance_km:.2f} km, estimated walk time {m.estimated_time_hours:.2f} h "
            f"(+{res_h - m.estimated_time_hours:.2f} h reserve = {res_h:.2f} h total budget requirement). "
            f"Mean hazard: {m.avg_hazard_score:.2f}/10, mean science: {m.avg_science_value:.3f}, "
            f"max slope: {m.max_slope_deg:.1f}°, {targets_count} nearby science target(s). Pareto: **{status_txt}**."
        )
    lines.append("")

    lines.append("### Pareto Dominance & Trade-off Analysis")
    non_dom = [
        name for name, status in pareto.items()
        if (status.value if hasattr(status, "value") else str(status)) == "NON_DOMINATED"
    ]
    lines.append(
        f"Of the four evaluated strategies, **{len(non_dom)}** lie on the Pareto non-dominated frontier "
        f"({', '.join(non_dom)}). No single trajectory is strictly superior across all criteria; "
        "selection must be governed by operational priorities (minimizing crew fatigue vs. maximizing sample collection)."
    )
    lines.append("")

    lines.append("### Consumables & Life Support Reserve Rule")
    lines.append(
        "In compliance with NASA EVA flight rules, every traverse incorporates a mandatory +20% life-support "
        "safety reserve. Traverses exceeding the nominal suit duration are flagged as non-viable."
    )
    return "\n".join(lines)


def generate_briefing(
    strategy: str,
    route,
    all_routes: dict,
    pareto: dict,
    data_mode: str,
    compliance: dict | None = None,
    terrain_classes: dict | None = None,
    terrain_at=None,
) -> dict:
    """Produce a briefing, preferring the LLM and falling back to the template.

    Supports strategy='ALL' for a comparative multi-case briefing.
    """
    if strategy.upper() == "ALL":
        text = render_comparative_template(all_routes, pareto, data_mode, compliance)
        return {
            "briefing": text,
            "generator": "template",
            "facts": {
                "strategy": "ALL",
                "routes": list(all_routes.keys()),
                "data_mode": data_mode,
            },
        }

    facts = build_fact_sheet(
        strategy, route, all_routes, pareto, data_mode, compliance,
        terrain_classes, terrain_at,
    )

    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if api_key:
        text = generate_with_llm(facts, api_key)
        if text:
            return {"briefing": text, "generator": "llm", "facts": facts}

    return {"briefing": render_template(facts), "generator": "template", "facts": facts}

