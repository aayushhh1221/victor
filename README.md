# VICTOR

### Voyage Intelligence for Terrain-aware Cartographic Optimization & Routing

> **NASA Space Apps Challenge 2026**  
> **Challenge:** *Interplanetary Survival Guide: Martian Map*  
> **Focus Region:** Jezero Crater, Mars (18.0–18.9°N, 77.0–78.0°E)  
> **Platform:** Next.js 14 (TypeScript) + FastAPI (Python 3.11) + Custom Multi-Objective A*  

---

## 🚀 Overview

**VICTOR** is a multi-objective planetary traversal arbitration engine built for future astronaut Extravehicular Activities (EVAs) across Jezero Crater. 

Unlike conventional navigation tools that simply calculate the shortest distance, **VICTOR recognizes that on Mars, optimizing a single objective is mission-fatal**. Mission commanders must balance four competing priorities:
- **Astronaut Safety:** Avoiding steep scarps, blocky crater ejecta, and loose dust mantles.
- **EVA Consumables:** Staying strictly within life-support envelopes (suit oxygen, battery, thermal).
- **Scientific Yield:** Maximizing access to high-value astrobiological targets (carbonates, deltaic sediments).
- **Terrain Traversability:** Navigating trafficable slopes and firm regolith.

VICTOR simultaneously evaluates four Pareto-optimal route strategies (**SAFEST**, **FASTEST**, **SCIENCE-RICHEST**, and **BALANCED**), mathematically proves their non-dominance, and delivers per-segment NASA instrument evidence with analytical counterfactual explanations.

---

## 🛰️ NASA Data Architecture

> ### ⚠️ Current data status: `DEMONSTRATION`
>
> **The grids this build computes over are synthetically generated, not real NASA products.**
> `scripts/data_pipeline.py` falls back to `scripts/generate_synthetic_fallback.py`, and the
> active mode is reported honestly at runtime by `/api/v1/health` and `/api/v1/map/layers`.
>
> Real data ingestion is the current priority — see
> [`docs/PROJECT_STATUS_REPORT.md`](docs/PROJECT_STATUS_REPORT.md) (BLOCKER-1). The table
> below is the **target** architecture; the Status column states what is actually wired today.

VICTOR is designed to fuse the following instrument datasets into a 300×300 non-square computation grid (~53.2 km × ~56.1 km):

| Dataset | Mission / Instrument | Role in VICTOR | Status |
|---|---|---|---|
| **MOLA** | Mars Global Surveyor (MGS) | Topography, slope, steep scarp avoidance | ⚠️ Synthetic proxy grid |
| **CRISM** | Mars Reconnaissance Orbiter (MRO) | Mineral identification & science tier scoring | ⚠️ Synthetic tier model |
| **THEMIS** | 2001 Mars Odyssey | Surface mantling & rock hazard refinement | ⚠️ Synthetic TI proxy |
| **Perseverance** | Mars 2020 | Reference traverse for orientation | ⚠️ 10 hardcoded waypoints |
| **HiRISE** | Mars Reconnaissance Orbiter (MRO) | Base visual context (display-only) | ❌ Not ingested — base map is a colormap of the elevation grid |
| **MCS** | Mars Reconnaissance Orbiter (MRO) | Regional/seasonal dust context | ❌ Not implemented |

**Science values are model-derived scores throughout, never direct measurements** — this is surfaced in the UI and in every API response that carries them.

---

## ⚡ Key Technical Innovations

1. **Non-Negative Multi-Objective A*:**  
   Standard pathfinders cannot seek rewards without risking negative-cost cycles. VICTOR parameterizes science-seeking as a non-negative penalty `weight * (1 - science_value)`, preserving strict A* optimality and admissibility.
2. **Deterministic Pareto Dominance Analysis:**  
   Every route calculation is evaluated across distance, time, hazard, and science. The engine proves which routes are **NON_DOMINATED**, guaranteeing authentic trade-offs.
3. **Per-Segment Evidence Inspector:**  
   Clicking any route segment exposes direct sensor provenance from MOLA, THEMIS, and CRISM with categorical confidence levels (**HIGH / MODERATE / LOW**).
4. **Analytical Counterfactual Attribution:**  
   Computes exact cost reductions in closed form (*"Without the hazard penalty, this segment's traversal cost decreases by 28%"*) without slow re-runs.
5. **Rigorous Mars Geodesy:**  
   Operates in IAU2000 planetocentric coordinates ($R_{\text{Mars}} = 3,389,500\text{ m}$) with an explicit affine projection into Leaflet pixel space.

---

## 🛠️ Quick Start & Setup

### Prerequisites
- Python 3.11+
- Node.js 18+ & npm 9+

### 1. Install dependencies and generate data

```bash
pip install -r backend/requirements.txt
```

The backend cannot serve routes without the computation grids, and the test suite
silently skips 24 of its 47 tests when they are missing. Generate them with:

```bash
python scripts/bootstrap.py
```

This generates the data grids and the map tile pyramid. Both steps are idempotent and
skip themselves if their output already exists. Pass `--skip-tiles` to generate grids
only — tile generation takes several minutes.

### 2. Start the backend

**Run from the repository root, not from `backend/`.** `backend/main.py` uses relative
imports, so it must be loaded as a package:

```bash
uvicorn backend.main:app --reload --port 8000
```

API documentation: `http://localhost:8000/docs`
Health check (reports the active data mode): `http://localhost:8000/api/v1/health`

### 3. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000` (redirects to `/planner`).

---

## 🧪 Automated Test Suite

The suite contains **47 tests across four modules**. Run from the repository root:

```bash
pytest backend/tests -v
```

**All 47 pass only when the data grids are present** — run `python scripts/bootstrap.py`
first. Without them the suite reports `16 passed, 24 skipped, 7 errors`, which looks
far healthier than it is. One performance test is also marginal and may fail on a
full-suite run; both issues are documented in
[`docs/PROJECT_STATUS_REPORT.md`](docs/PROJECT_STATUS_REPORT.md) (HIGH-6, HIGH-7).

### Test suite coverage:
- `backend/tests/test_mars_geo.py`: Mars haversine accuracy, bearing, and grid round-trip transformations.
- `backend/tests/test_route_engine.py`: A* feasibility, constraint compliance (slope thresholds), determinism, metric consistency, and non-negative cost decomposition.
- `backend/tests/test_science_engine.py`: Runtime detour calculation, monotonic distance profiles, and science discovery analysis.
- `backend/tests/test_api.py`: FastAPI endpoints, health checks, route computation lifecycle, evidence inspection, and scenario diffing.

To verify frontend TypeScript compilation and the production bundle:
```bash
cd frontend
npm run build
```

---

## 📂 Repository Structure

```
NSAC 2026/
├── backend/
│   ├── main.py                    # FastAPI application entry point
│   ├── config.py                  # App configuration & CORS settings
│   ├── dependencies.py            # Dependency injection singletons
│   ├── models/
│   │   ├── domain.py              # Core dataclasses (Coordinate, Route, etc.)
│   │   ├── schemas.py             # Pydantic v2 request & response schemas
│   │   └── enums.py               # RouteStrategy, DataMode, MineralClass, etc.
│   ├── routers/
│   │   ├── map.py                 # Tile serving & region metadata
│   │   ├── route.py               # Route computation & evidence inspector
│   │   ├── science.py             # Science targets & route profiles
│   │   └── scenario.py            # Mission scenario diffing & sensitivity
│   ├── services/
│   │   ├── data_service.py        # Grid loader & spatial indexing
│   │   ├── route_engine.py        # Multi-objective A* pathfinding
│   │   ├── evidence_engine.py     # Per-segment cost decomposition
│   │   ├── pareto_engine.py       # Deterministic dominance analysis
│   │   ├── science_engine.py      # Science target scoring & detours
│   │   └── scenario_engine.py     # Constraint sensitivity engine
│   ├── utils/
│   │   └── mars_geo.py            # Planetocentric geodesy math
│   ├── data/
│   │   ├── cache/                 # 300×300 NumPy grids (.npy) & metadata — committed
│   │   ├── tiles/                 # Pre-rendered PNG map tiles (zoom 1–5) — generated
│   │   └── demo/                  # Precomputed demo scenarios
│   └── tests/                     # 47 pytest test cases across 4 modules
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx         # Root layout with NASA metadata
│   │   │   ├── page.tsx           # Redirect to /planner
│   │   │   ├── globals.css        # VICTOR design system & CSS tokens
│   │   │   └── planner/page.tsx   # Interactive Mars mission planner shell
│   │   ├── components/
│   │   │   ├── common/Header.tsx  # Brand header & active DataMode badge
│   │   │   ├── sidebar/Sidebar.tsx# Navigation & telemetry sections
│   │   │   ├── map/
│   │   │   │   ├── MarsMap.tsx    # Leaflet map with Mars CRS projection
│   │   │   │   └── LayerControl.tsx# Layer opacity & visibility controls
│   │   │   └── panels/
│   │   │       ├── RouteComparisonTable.tsx # Pareto arbitration table
│   │   │       └── EvidencePopup.tsx        # Per-segment evidence inspector
│   │   ├── services/api.ts        # Typed API client
│   │   ├── types/index.ts         # TypeScript domain definitions
│   │   └── utils/marsProjection.ts# Mars pixel ↔ lat/lon affine mapping
│   ├── package.json
│   └── tsconfig.json
├── docs/
│   ├── PROJECT_STATUS_REPORT.md   # Current status, ranked findings, compliance matrix
│   ├── BUILD_STATE.md             # Implementation milestone tracker
│   ├── challenge-contract.md      # Binding challenge requirements
│   ├── demo-script.md             # 7-minute presentation walkthrough
│   ├── judge-qa.md                # Technical defense & FAQ
│   ├── VICTOR-blueprint-part1.md# System architecture blueprint
│   ├── VICTOR-blueprint-part2.md# Implementation prompts & interfaces
│   ├── geospatial-methodology.md  # Mars coordinate math documentation
│   └── nasa-data-catalog.md       # Instrument provenance specifications
└── scripts/
    ├── bootstrap.py               # One-command setup for a fresh clone
    ├── data_pipeline.py           # NASA data acquisition pipeline
    ├── generate_synthetic_fallback.py # Synthetic Jezero grid generator
    └── generate_tiles.py          # Multiscale PNG tile generator
```

---

## 🏆 NASA Space Apps 2026 Presentation

See [`docs/demo-script.md`](docs/demo-script.md) for the complete 7-minute mission walkthrough and [`docs/judge-qa.md`](docs/judge-qa.md) for detailed technical defense questions and answers.
