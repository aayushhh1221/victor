# PATHWISE — Complete Implementation Blueprint (Part 1)
# Architecture, Data, Science, Route Intelligence

## 1. Winning Architecture

**PATHWISE: Multi-Objective Marswalk Arbitration Engine**

A planetary mission planning platform that computes, compares, and explains competing EVA route strategies for Jezero Crater using fused NASA orbital data. The system generates 4 route strategies (SAFEST, FASTEST, SCIENCE-RICHEST, BALANCED), enables scenario comparison, and provides per-segment evidence provenance.

---

## 2. Why This Architecture Wins

| Requirement | How PATHWISE addresses it |
|---|---|
| Layered Mars map | Multi-layer map with toggle controls (MOLA, HiRISE, CRISM, THEMIS, hazards, science, routes) |
| Multi-mission data | Fuses 6 instrument datasets from 4 NASA Mars missions into unified computation grid |
| Safety planning | Terrain traversability, slope risk, hazard zones computed from real data |
| Science discovery | CRISM mineral-derived science value scores drive route optimization |
| Route/location focus | Jezero Crater — richest Mars dataset in existence |
| Innovation beyond map | Multi-objective route arbitration with trade-off analysis |
| Evidence/provenance | Per-segment decomposition of contributing NASA data layers |
| Scenario comparison | Modify priorities -> recompute -> see impact |

---

## 3. Architecture Diagram

```
                          ┌─────────────────┐
                          │    ASTRONAUT /   │
                          │  MISSION PLANNER │
                          └────────┬────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │        FRONTEND (Next.js)    │
                    │  ┌─────────────────────────┐ │
                    │  │    Mars Map (Leaflet)    │ │
                    │  │   + Layer Controls       │ │
                    │  │   + Route Comparison     │ │
                    │  │   + Evidence Inspector    │ │
                    │  │   + Scenario Panel        │ │
                    │  └─────────────────────────┘ │
                    └──────────────┬──────────────┘
                                   │ REST API
                    ┌──────────────▼──────────────┐
                    │      BACKEND (FastAPI)        │
                    │  ┌──────┐ ┌──────┐ ┌──────┐  │
                    │  │Route │ │Science│ │Scene │  │
                    │  │Engine│ │Engine │ │Engine│  │
                    │  └──┬───┘ └──┬───┘ └──┬───┘  │
                    │     └────────┼────────┘       │
                    │  ┌──────────▼──────────┐      │
                    │  │ GEOSPATIAL CORE     │      │
                    │  │ (Unified Cost Grid) │      │
                    │  └──────────┬──────────┘      │
                    │  ┌──────────▼──────────┐      │
                    │  │ DATA LAYER          │      │
                    │  │ (Normalized Cache)  │      │
                    │  └──────────┬──────────┘      │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │     NASA DATA SOURCES         │
                    │  MOLA | HiRISE | CRISM |      │
                    │  THEMIS | MCS | Perseverance   │
                    └─────────────────────────────┘
```

---

## 4. NASA Data Plan

All NASA datasets pre-downloaded and cached as GeoTIFF/JSON snapshots for Jezero Crater region.

| Dataset | Product | Format | Size | Processing |
|---|---|---|---|---|
| MOLA MEGDR | 128 ppd global DEM crop | GeoTIFF | ~5 MB | Crop, slope grid, traversability |
| HiRISE | Jezero mosaic tiles | JPEG/PNG | ~100 MB | Pre-tile for Leaflet |
| CRISM | Mineral parameter maps | GeoTIFF | ~20 MB | Mineral classification, science grid |
| THEMIS | Day/Night IR mosaic crop | GeoTIFF | ~10 MB | Thermal inertia, material class |
| MCS | Seasonal dust stats at 18N | JSON | ~100 KB | Seasonal averages |
| Perseverance | Traverse waypoints | JSON | ~500 KB | Point overlay |

Data Normalization: `NASA_SOURCE -> ADAPTER -> VALIDATE -> NORMALIZE -> GRID_RESAMPLE -> CACHE + PROVENANCE_RECORD`

---

## 5. Scientific Methodology

### Layer 1: Traversability Cost (from MOLA + THEMIS)

```
slope_deg = arctan(delta_elevation / horizontal_distance)

traversability_cost(slope):
    if slope > 25 deg: IMPASSABLE (999)
    if slope > 20 deg: EXTREME (10.0)
    if slope > 15 deg: DIFFICULT (5.0)
    if slope > 10 deg: MODERATE (2.5)
    if slope > 5 deg:  EASY (1.5)
    else:              FLAT (1.0)

material_modifier(thermal_inertia):
    if TI < 100: 1.5  (fine dust)
    if TI > 800: 1.3  (rocky)
    else: 1.0         (nominal)

final_traversability = traversability_cost(slope) * material_modifier(TI)
```

### Layer 2: Hazard Score
```
hazard_score = 0.5 * normalized_slope_risk + 0.3 * rock_hazard + 0.2 * surface_dust_risk
```

**Note:** `surface_dust_risk` is derived from THEMIS thermal inertia surface material classification (low TI = fine dust = low traction risk). It is NOT derived from MCS atmospheric dust data. MCS provides regional/seasonal atmospheric context only and is not used in per-cell hazard computation.

### Layer 3: Science Value (from CRISM minerals)

**Classification: MODEL — Science Priority Score (NOT a direct NASA measurement)**

Science values are assigned based on astrobiological and geological significance tiers, following published Mars 2020 science priorities (Farley et al. 2020).

| Tier | Score Range | Minerals | Rationale |
|---|---|---|---|
| Tier 1 | 0.8–1.0 | Carbonates, Phyllosilicates, Hydrated silica | Biosignature-relevant; primary targets for Mars 2020 sample return |
| Tier 2 | 0.5–0.8 | Altered olivine, Sulfates in geological context | Water interaction indicators; secondary astrobiological interest |
| Tier 3 | 0.2–0.5 | Pyroxene, Iron oxides | Geological context minerals; igneous history |
| Tier 4 | 0.0–0.2 | Unaltered basalt, Unknown/unclassified | Baseline geological material |

| Mineral | Representative Value | Tier |
|---|---|---|
| CARBONATE | 0.95 | 1 |
| PHYLLOSILICATE | 0.90 | 1 |
| HYDRATED_SILICA | 0.85 | 1 |
| OLIVINE_ALTERED | 0.70 | 2 |
| SULFATE | 0.60 | 2 |
| PYROXENE | 0.40 | 3 |
| IRON_OXIDE | 0.30 | 3 |
| BASALT | 0.10 | 4 |
| UNKNOWN | 0.05 | 4 |

### Data Type Separation

| Category | Source | Type |
|---|---|---|
| Elevation | MOLA | OBSERVED |
| Slope | Derived from MOLA | DERIVED |
| Traversability | Derived from slope + TI | DERIVED |
| Mineral classification | CRISM | OBSERVED + INTERPRETED |
| Science value | Derived from minerals | MODEL |
| Route recommendation | From optimization | RECOMMENDATION |

---

## 6. AI/ML Architecture

### Where AI IS used (justified):
1. **Explanation Generator:** LLM generates natural-language explanations of WHY routes differ, using ONLY computed route metrics as input
2. **Science Target Summarization:** LLM generates descriptions from structured geological metadata

### Where AI is NOT used:
- Distance calculation, slope computation, route finding, science scoring, hazard scoring, traversability cost — all deterministic

### AI Grounding Protocol
LLM receives only structured computed data. Never invents terrain, minerals, or metrics.

---

## 7. Route Intelligence Design

### Multi-Objective Weighted A* — 4 Strategy Profiles

All edge costs are **non-negative**. Science-seeking behavior is achieved via a `science_penalty` formulation:

```
science_penalty = weight * (1 - science_value)
```

High-science cells have low penalty (near 0); low-science cells have high penalty (near weight). This encourages science-rich routes while keeping all edge costs ≥ 0.

```python
STRATEGIES = {
    "SAFEST":          {"distance": 0.30, "traversability": 0.10, "hazard": 0.50, "science_penalty": 0.10},
    "FASTEST":         {"distance": 0.60, "traversability": 0.30, "hazard": 0.10, "science_penalty": 0.00},
    "SCIENCE_RICHEST": {"distance": 0.15, "traversability": 0.10, "hazard": 0.05, "science_penalty": 0.70},
    "BALANCED":        {"distance": 0.25, "traversability": 0.15, "hazard": 0.30, "science_penalty": 0.30}
}
```

### Cost Function per Edge
```
edge_cost(a, b, weights) =
    w.distance        * haversine_distance(a, b) +
    w.traversability  * avg(traversability[a], traversability[b]) +
    w.hazard          * avg(hazard[a], hazard[b]) +
    w.science_penalty * avg(1 - science_value[a], 1 - science_value[b])
```

All four terms are non-negative. A* correctness is preserved.

### Per-Segment Evidence Decomposition
Each segment stores: coordinates, distance, elevation change, slope, traversability cost, hazard score, science value, contributing_layers (MOLA, CRISM, THEMIS), and cost_breakdown showing how much each layer contributed.

---

## 8. Science Opportunity Design

### Pre-populated Science Target Catalog

Target records contain source-derived coordinates and features. `distance_from_route_m` and `detour_cost_minutes` are **computed at runtime** from the actual selected route — they are NOT hardcoded.

| Target | Type | Location | Science Value (MODEL) |
|---|---|---|---|
| Western Delta Front | Deltaic sediments | 18.43N, 77.38E | 0.95 (Tier 1) |
| Carbonate Floor Deposits | Carbonates | 18.38N, 77.45E | 0.90 (Tier 1) |
| Seitah Olivine | Altered olivine | 18.35N, 77.50E | 0.70 (Tier 2) |
| Ancient Shoreline Contact | Geological boundary | 18.41N, 77.55E | 0.85 (Tier 1) |
| Crater Rim Phyllosilicates | Clay minerals | 18.52N, 77.42E | 0.88 (Tier 1) |

> **Note:** Target coordinates are approximate, derived from published Jezero geological maps. Detour distances and costs are always calculated dynamically relative to the generated route.

For each route: identify targets within 500m, targets requiring <1km detour, total science value, unique-to-strategy targets.

---

## 9. Uncertainty / Evidence Design

### Confidence Levels per Layer
- MOLA elevation: HIGH
- Slope (derived): MODERATE (±2° at ~177–187m cell size)
- CRISM minerals: varies (per-pixel confidence)
- THEMIS TI: MODERATE
- Science value: LOW-MODERATE (model-based)

### Rules
- Never show fake confidence percentage
- Confidence is categorical: HIGH / MODERATE / LOW
- Always show data freshness (observation dates)
- Always show spatial resolution
- Link to methodology

---

## 10-12. Frontend Architecture

### Layout: Header + Left Sidebar + Central Map + Right Panel + Bottom 3-Panel

Key Components:
1. MarsMap (Leaflet, custom CRS)
2. LayerControl (toggles + opacity)
3. InfoBar (region metrics)
4. RouteProfile (Recharts chart)
5. RiskAssessment (hazard scores)
6. ScienceOpportunities (target carousel)
7. RouteComparison (4-strategy table)
8. EvidencePopup (per-segment NASA data — KILLER FEATURE)
9. ScenarioPanel (modify weights, recompute)
10. MissionReport (generated summary)

### Design Language (from reference.png)
- Clean white/light background
- Institutional blue (#0B3D91) accents
- Professional sans-serif typography (Inter)
- Mars imagery as map base
- Metric scale bars
- No gamification, no neon
