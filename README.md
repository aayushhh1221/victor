# PATHWISE — Multi-Objective Marswalk Arbitration Engine

> **NASA Space Apps Challenge 2026**  
> **Challenge:** *Interplanetary Survival Guide: Martian Map*  
> **Focus Region:** Jezero Crater, Mars (18.0–18.9°N, 77.0–78.0°E)  
> **Platform:** Next.js 14 (TypeScript) + FastAPI (Python 3.11) + Custom Multi-Objective A*  

---

## 🚀 Overview

**PATHWISE** is a multi-objective planetary traversal arbitration engine built for future astronaut Extravehicular Activities (EVAs) across Jezero Crater. 

Unlike conventional navigation tools that simply calculate the shortest distance, **PATHWISE recognizes that on Mars, optimizing a single objective is mission-fatal**. Mission commanders must balance four competing priorities:
- **Astronaut Safety:** Avoiding steep scarps, blocky crater ejecta, and loose dust mantles.
- **EVA Consumables:** Staying strictly within life-support envelopes (suit oxygen, battery, thermal).
- **Scientific Yield:** Maximizing access to high-value astrobiological targets (carbonates, deltaic sediments).
- **Terrain Traversability:** Navigating trafficable slopes and firm regolith.

PATHWISE simultaneously evaluates four Pareto-optimal route strategies (**SAFEST**, **FASTEST**, **SCIENCE-RICHEST**, and **BALANCED**), mathematically proves their non-dominance, and delivers per-segment NASA instrument evidence with analytical counterfactual explanations.

---

## 🛰️ NASA Data Architecture

PATHWISE fuses **6 instrument datasets across 4 NASA Mars missions** into a 300×300 non-square computation grid (~53.2 km × ~56.1 km):

| Dataset | Mission / Instrument | Processing / Resolution | Role in PATHWISE |
|---|---|---|---|
| **MOLA** | Mars Global Surveyor (MGS) | 128 ppd MEGDR digital elevation model | Topography, slope computation, steep scarp avoidance |
| **HiRISE** | Mars Reconnaissance Orbiter (MRO) | High-resolution visual imagery | Base visual context (display-only) |
| **CRISM** | Mars Reconnaissance Orbiter (MRO) | Targeted hyperspectral cubes | Mineral identification & science tier scoring |
| **THEMIS** | 2001 Mars Odyssey | Thermal inertia (TI) infrared mosaic | Surface mantling characterization & rock hazard refinement |
| **MCS** | Mars Reconnaissance Orbiter (MRO) | Limb atmospheric sounding | Regional/seasonal dust context (labeled as contextual) |
| **Perseverance** | Mars 2020 | Sol 1–1000 rover traverse telemetry | Ground-truth reference traverse for validation |

---

## ⚡ Key Technical Innovations

1. **Non-Negative Multi-Objective A*:**  
   Standard pathfinders cannot seek rewards without risking negative-cost cycles. PATHWISE parameterizes science-seeking as a non-negative penalty `weight * (1 - science_value)`, preserving strict A* optimality and admissibility.
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

### 1. Backend Setup
```bash
# Navigate to backend directory
cd backend

# Install Python dependencies
pip install -r requirements.txt

# Start the FastAPI server (runs on port 8000)
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
API Documentation will be live at: `http://localhost:8000/docs`  
Health check endpoint: `http://localhost:8000/api/v1/health`

### 2. Frontend Setup
```bash
# Navigate to frontend directory in a new terminal
cd frontend

# Install dependencies (using legacy peer deps for Leaflet compatibility)
npm install --legacy-peer-deps

# Start the Next.js development server
npm run dev
```
Open `http://localhost:3000` (automatically redirects to `http://localhost:3000/planner`).

---

## 🧪 Automated Test Suite

All 47 backend integration and unit tests pass with 100% coverage across geodesy, pathfinding, science analysis, and REST APIs:

```bash
# Run pytest from repository root
pytest backend/tests -v
```

### Test Suite Highlights:
- `backend/tests/test_mars_geo.py`: Mars haversine accuracy, bearing, and grid round-trip transformations.
- `backend/tests/test_route_engine.py`: A* feasibility, constraint compliance (slope thresholds), determinism, metric consistency, and non-negative cost decomposition.
- `backend/tests/test_science_engine.py`: Runtime detour calculation, monotonic distance profiles, and science discovery analysis.
- `backend/tests/test_api.py`: FastAPI endpoints, health checks, route computation lifecycle, evidence inspection, and scenario diffing.

To verify frontend TypeScript compilation and production bundle:
```bash
cd frontend
npm run build
```

---

## 📂 Repository Structure

```
d:/NSAC 2026/
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
│   │   ├── mars_geo.py            # Planetocentric geodesy math
│   │   └── provenance.py          # NASA instrument attribution tracking
│   ├── data/
│   │   ├── cache/                 # 300×300 NumPy grids (.npy) & metadata
│   │   ├── tiles/                 # Pre-rendered PNG map tiles (zoom 1–5)
│   │   └── demo/                  # Precomputed demo scenarios
│   └── tests/                     # 47 comprehensive pytest test cases
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx         # Root layout with NASA metadata
│   │   │   ├── page.tsx           # Redirect to /planner
│   │   │   ├── globals.css        # PATHWISE design system & CSS tokens
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
│   ├── BUILD_STATE.md             # Implementation milestone tracker
│   ├── demo-script.md             # 7-minute presentation walkthrough
│   ├── judge-qa.md                # Technical defense & FAQ
│   ├── PATHWISE-blueprint-part1.md# System architecture blueprint
│   ├── PATHWISE-blueprint-part2.md# Implementation prompts & interfaces
│   ├── geospatial-methodology.md  # Mars coordinate math documentation
│   └── nasa-data-catalog.md       # Instrument provenance specifications
└── scripts/
    ├── data_pipeline.py           # NASA data acquisition pipeline
    ├── generate_synthetic_fallback.py # High-fidelity Jezero grid generator
    └── generate_tiles.py          # Multiscale PNG tile generator
```

---

## 🏆 NASA Space Apps 2026 Presentation

See [`docs/demo-script.md`](docs/demo-script.md) for the complete 7-minute mission walkthrough and [`docs/judge-qa.md`](docs/judge-qa.md) for detailed technical defense questions and answers.
