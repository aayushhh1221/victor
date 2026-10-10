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

> ### ✅ Current data status: `VERIFIED_SNAPSHOT` — 4 NASA missions
>
> VICTOR runs on **real NASA data from four missions**, satisfying the challenge's
> mandatory real-data and multi-mission requirements. The condition is **enforced in
> code**, not asserted: `backend/utils/provenance.py` reports `VERIFIED_SNAPSHOT` only
> when no source is synthetic *and* at least two distinct NASA missions contributed.
> Verify it yourself at `/api/v1/health`.

Five NASA products are fused into a 300×300 non-square computation grid (~53.2 km × ~56.1 km):

| Dataset | Mission / Instrument | Role in VICTOR | Status |
|---|---|---|---|
| **MOLA** | Mars Global Surveyor | Topography → slope → traversability | ✅ Real, 463 m/px |
| **THEMIS** | 2001 Mars Odyssey | Night-IR thermal inertia proxy, hazard | ✅ Real, 100 m/px |
| **CTX** | Mars Reconnaissance Orbiter | Orbital basemap imagery | ✅ Real, ~5 m/px |
| **CRISM** | Mars Reconnaissance Orbiter | Olivine + carbonate mineralogy | ✅ Real, 181 m/px (66% coverage) |
| **Perseverance** | Mars 2020 | Published science target locations | ✅ Real, from literature |
| **MCS** | Mars Reconnaissance Orbiter | Atmospheric dust / temperature | ❌ No gridded NASA product exists — reported as `null`, never estimated |

### How the data is acquired

Products are read with **windowed HTTP range requests** (GDAL `/vsicurl/`), so only the
bytes covering the Jezero window transfer:

| Source | Transferred | Of total |
|---|---|---|
| MOLA global DEM | ~10.6 MB | 2 GB |
| CRISM mineral cube | 1.8 MB | 576 MB |

### Honest classification

Every grid carries one of four labels, and the API reports them per layer:

| Class | Meaning |
|---|---|
| `MEASURED` | Read from a published NASA product |
| `DERIVED` | Computed from measured inputs by a documented transform |
| `MODELLED` | Assigned by a VICTOR model, not a measurement of that quantity |
| `SYNTHETIC` | Generated with no NASA input — **none present** |

**Science values are model-derived scores, never direct measurements** — surfaced in the UI
and in every API response that carries them. CRISM swath gaps (~34% of the window) are kept
as no-data and render transparent: unmeasured, not mineral-free.

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

## 🧠 Intelligence & Reporting

### Unsupervised terrain classification (AI/ML)

`scripts/classify_terrain.py` runs k-means over the real ingested feature stack — MOLA
slope and roughness, THEMIS thermal inertia, CRISM olivine and carbonate indices — with the
cluster count chosen by **silhouette score** (k=4 selected from candidates 3–7).

It is **fitted offline** and only the resulting label grid is committed, so scikit-learn
never ships to the 512 MB production instance. The result is deterministic and costs nothing
at runtime.

A useful sanity check: the classifier independently assigns **34.5% of the window to
olivine-bearing bedrock**, which corresponds to Jezero's known olivine-carbonate unit — and
the `SCIENCE_RICHEST` route crosses 60% of that terrain versus the 34.5% window average.

**It is advisory.** It does not feed `traversability.npy` and does not touch any routing
cost. The A*/Pareto engine remains the sole decision authority, which is what keeps the
optimiser fully explainable.

### Mission briefing

`GET /api/v1/report/briefing/{computation_id}?strategy=...` produces a narrative brief from
a structured fact sheet assembled from the route, its metrics, the Pareto result and the
provenance record. It may state **only** values present in that fact sheet.

A deterministic template generator produces a complete brief with **no API key and no
network**, so the demo cannot fail on a quota or connectivity error. An LLM path layers on
top when `GEMINI_API_KEY` is set. The response reports which generator was used.

### Mission report export

`GET /api/v1/report/{computation_id}?strategy=...&download=true` streams a self-contained
HTML report — briefing, four-strategy comparison, route profile, science targets, and a
**data-provenance appendix** listing every product ID, checksum and classification. That
appendix is the point: it makes the report portable evidence that the entry used real NASA
data from four missions. Print to PDF from the browser.

### Data confidence layer

Uncertainty made explicit rather than implicit. A 0–1 completeness index driven by real
signals: CRISM swath gaps (~34% of the window unmeasured) and source resolution being
coarser than the grid cell. It is **not** a probability or an error bar, and the provenance
record says so.

---

## 🛠️ Quick Start & Setup

### Prerequisites
- Python 3.11+
- Node.js 18+ & npm 9+

### 1. Install dependencies and generate data

```bash
pip install -r backend/requirements.txt
```

> ### ⚠️ Run this before anything else
>
> Map tiles are gitignored generated artefacts, so a fresh clone has none. Skip
> this and the backend will start, `/api/v1/health` will report healthy, every
> API endpoint will return 200 — and **the map will be blank with tile routes
> returning 404**. Nothing is broken; the tiles just have not been built.

```bash
python scripts/bootstrap.py
```

This generates the real NASA data grids, the terrain classification, 12,277 map
tiles (~211 MB) and the precomputed demo routes. It is idempotent, so re-running
skips whatever is already done. First run takes 10–25 minutes; the tiles are
most of it.

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

## 🚀 Deployment

Fully configured and ready to deploy — **no code changes needed**, only accounts and
environment variables.

> ### 📘 Deploying this? Read [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)
>
> A complete step-by-step walkthrough of Render and Supabase: project creation,
> the database migration, tile upload, every environment variable, verification
> steps, free-tier pitfalls, troubleshooting and a pre-demo checklist.
> The summary below is orientation only.

### Architecture

| Component | Target | Why |
|---|---|---|
| `victor-api` | Render Web Service (free) | FastAPI backend |
| `victor-web` | Render **Static Site** (free) | Always-on and CDN-backed, so the UI loads instantly even while the API is cold |
| Database | Supabase Postgres (free) | Persists route computations and the route cache |
| Map tiles | Supabase Storage (free) | Render's filesystem is ephemeral; tiles would vanish on redeploy |

### Steps

```bash
# 1. Apply the database schema (use the DIRECT connection, port 5432)
psql "$DIRECT_DATABASE_URL" -f supabase/migrations/0001_init.sql

# 2. Upload the map tiles to Supabase Storage (12,277 PNGs, ~211 MB)
python scripts/upload_tiles.py --create-bucket

# 3. Deploy both services from render.yaml, then set:
#    victor-api  ->  DATABASE_URL (use the POOLER on port 6543), FRONTEND_URL
#    victor-web  ->  NEXT_PUBLIC_API_URL, NEXT_PUBLIC_TILE_BASE_URL
```

### Free-tier constraints already handled

- **Ephemeral filesystem** — nothing is generated at runtime; grids are committed and tiles pre-rendered
- **512 MB RAM** — production dependencies are 7 packages; GDAL, scipy, Pillow and scikit-learn are pipeline-only
- **15-minute spin-down** — route computations persist to Postgres, so `computation_id` lookups survive it
- **0.1 shared CPU** — a route cache turns a repeat computation from ~13 s into ~0.2 s, and the demo route is precomputed
- **750 instance-hours/month** ≈ 744 h in a 31-day month, so enable any uptime pinger only shortly before the event
- **Supabase 7-day idle pause** — verify the project is awake before demoing

Everything runs **fully offline** with no environment variables set, which is the intended
demo path. `/api/v1/health` reports whether persistence is actually live.

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
