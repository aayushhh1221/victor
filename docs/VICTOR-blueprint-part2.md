# VICTOR — Implementation Blueprint (Part 2)
# Backend, API, Models, Repository, Implementation Prompts

---

## 13. Backend Architecture

### Tech Stack

| Component | Technology | Justification |
|---|---|---|
| **Language** | Python 3.11+ | Scientific computing ecosystem |
| **Framework** | FastAPI | Async, typed, fast, OpenAPI docs |
| **Geospatial** | numpy, scipy, Pillow | Grid computation, image processing |
| **Pathfinding** | Custom A* on numpy grid | Full control over multi-objective cost |
| **Data** | GeoJSON, NumPy arrays (file-based) | No database needed for demo scope |
| **AI** | Google Gemini API (optional) | Explanation generation only |
| **Validation** | Pydantic v2 | Schema validation |

### Service Boundaries

```
backend/
├── main.py                    # FastAPI app entry point
├── config.py                  # Environment & settings
├── routers/
│   ├── map.py                 # Map tile & layer endpoints
│   ├── route.py               # Route computation endpoints
│   ├── science.py             # Science target endpoints
│   ├── scenario.py            # Scenario comparison endpoints
│   └── report.py              # Report generation endpoints
├── services/
│   ├── data_service.py        # Data loading & grid access
│   ├── geo_engine.py          # Geospatial processing
│   ├── route_engine.py        # Multi-objective A* pathfinding
│   ├── science_engine.py      # Science value computation
│   ├── scenario_engine.py     # Scenario re-computation
│   ├── evidence_engine.py     # Per-segment evidence assembly
│   └── explanation_engine.py  # AI explanation generation
├── data/
│   ├── adapters/              # NASA data format adapters
│   ├── cache/                 # Pre-processed grids (.npy, .json)
│   ├── tiles/                 # Map tile PNGs
│   ├── demo/                  # Demo scenario data
│   └── raw/                   # Raw NASA downloads (gitignored)
├── models/
│   ├── domain.py              # Core domain models
│   ├── schemas.py             # API request/response schemas
│   └── enums.py               # Enumerations
├── utils/
│   ├── mars_geo.py            # Mars coordinate math
│   ├── provenance.py          # Data provenance tracking
│   └── grid.py                # Grid utilities
└── tests/
    ├── test_mars_geo.py
    ├── test_route_engine.py
    ├── test_science_engine.py
    └── test_api.py
```

---

## 14. API Specification

### `GET /api/v1/health`
Returns `{"status": "ok", "data_mode": "VERIFIED_SNAPSHOT", "grid_loaded": true}`

### `GET /api/v1/map/layers`
Returns available map layers with metadata, thumbnails, default visibility.

### `GET /api/v1/map/tiles/{layer}/{z}/{x}/{y}.png`
Serves pre-rendered tile PNGs. Layers: `terrain`, `hazard`, `science`.

### `GET /api/v1/map/region-info`
Query params: `lat`, `lon`. Returns elevation, slope, terrain type, hazard, science value at point.

### `POST /api/v1/routes/compute`

Request:
```json
{
  "start": {"lat": 18.35, "lon": 77.35},
  "destination": {"lat": 18.50, "lon": 77.55},
  "constraints": {
    "max_slope_deg": 20,
    "max_eva_hours": 6,
    "walking_speed_kmh": 3.0
  },
  "strategies": ["SAFEST", "FASTEST", "SCIENCE_RICHEST", "BALANCED"]
}
```

Response:
```json
{
  "computation_id": "uuid",
  "data_mode": "VERIFIED_SNAPSHOT",
  "strategies": {
    "SAFEST": {
      "path": [{"lat": 18.35, "lon": 77.35}, "..."],
      "metrics": {
        "distance_km": "{computed}",
        "estimated_time_hours": "{computed}",
        "avg_hazard_score": "{computed}",
        "max_slope_deg": "{computed}",
        "total_science_value": "{computed}",
        "segments_count": "{computed}",
        "elevation_gain_m": "{computed}",
        "elevation_loss_m": "{computed}",
        "confidence": "HIGH"
      },
      "science_targets_nearby": ["..."]
    },
    "FASTEST": {},
    "SCIENCE_RICHEST": {},
    "BALANCED": {}
  },
  "comparison": {
    "distance_range": {"min": "{computed}", "max": "{computed}"},
    "time_range": {"min": "{computed}", "max": "{computed}"},
    "science_range": {"min": "{computed}", "max": "{computed}"},
    "trade_off_summary": "{generated_from_computed_metrics}"
  },
  "pareto": {
    "SAFEST": "NON_DOMINATED",
    "FASTEST": "NON_DOMINATED",
    "SCIENCE_RICHEST": "NON_DOMINATED",
    "BALANCED": "{DOMINATED_or_NON_DOMINATED}"
  }
}
```

### `GET /api/v1/routes/{computation_id}/segments/{segment_id}/evidence`
Returns per-segment evidence with NASA data provenance and cost breakdown.

### `POST /api/v1/scenarios/compare`

Request:
```json
{
  "base_computation_id": "uuid",
  "modifications": {"max_slope_deg": 15, "science_weight": 0.8}
}
```

Response includes modified routes + impact analysis (which routes changed, % distance/science/time impact, summary text).

### `GET /api/v1/science/targets`
Returns full science target catalog.

### `GET /api/v1/science/profile`
Query params: `computation_id`, `strategy`. Returns chart-ready science value profile along route.

### `POST /api/v1/reports/generate`
Generates mission report JSON for selected route strategy.

---

## 15. Domain Models

### Pydantic Models (backend/models/domain.py)

```python
class Coordinate(BaseModel):
    lat: float   # Planetocentric degrees
    lon: float   # East-positive degrees

class GridMetadata(BaseModel):
    lat_min: float; lat_max: float
    lon_min: float; lon_max: float
    rows: int; cols: int
    cell_size_ns_m: float   # ~177 m (non-square)
    cell_size_ew_m: float   # ~187 m (non-square)
    coordinate_system: str = "IAU2000_planetocentric_east"

class MissionConstraints(BaseModel):
    max_slope_deg: float = 20.0
    max_eva_hours: float = 6.0
    walking_speed_kmh: float = 3.0

class RouteMetrics(BaseModel):
    distance_km: float
    estimated_time_hours: float
    avg_hazard_score: float
    max_slope_deg: float
    total_science_value: float
    segments_count: int
    elevation_gain_m: float
    elevation_loss_m: float

class RouteSegment(BaseModel):
    segment_id: int
    start: Coordinate; end: Coordinate
    distance_m: float
    elevation_change_m: float
    slope_deg: float
    traversability_cost: float
    hazard_score: float
    science_value: float
    contributing_layers: dict

class ScienceTarget(BaseModel):
    id: str; name: str; type: str
    location: Coordinate
    science_value: float
    description: str
    distance_from_route_m: float = 0.0
    detour_cost_minutes: float = 0.0
    source: str

class Route(BaseModel):
    strategy: str
    path: list[Coordinate]
    segments: list[RouteSegment]
    metrics: RouteMetrics
    science_targets_nearby: list[ScienceTarget]
    confidence: str  # HIGH | MODERATE | LOW

class ProvenanceRecord(BaseModel):
    source: str; product: str; instrument: str; mission: str
    observation_time: str; retrieval_date: str
    processing_version: str; coordinate_system: str; resolution_m: float
```

### TypeScript Interfaces (frontend/src/types/index.ts)

Mirror all Python models as TypeScript interfaces with matching field names.

### Enumerations (backend/models/enums.py)

```python
class RouteStrategy(str, Enum):
    SAFEST = "SAFEST"
    FASTEST = "FASTEST"
    SCIENCE_RICHEST = "SCIENCE_RICHEST"
    BALANCED = "BALANCED"

class DataMode(str, Enum):
    LIVE = "LIVE"
    VERIFIED_SNAPSHOT = "VERIFIED_SNAPSHOT"
    DEMONSTRATION = "DEMONSTRATION"

class MineralClass(str, Enum):
    CARBONATE = "CARBONATE"
    PHYLLOSILICATE = "PHYLLOSILICATE"
    HYDRATED_SILICA = "HYDRATED_SILICA"
    OLIVINE_ALTERED = "OLIVINE_ALTERED"
    PYROXENE = "PYROXENE"
    IRON_OXIDE = "IRON_OXIDE"
    SULFATE = "SULFATE"
    BASALT = "BASALT"
    UNKNOWN = "UNKNOWN"

class ConfidenceLevel(str, Enum):
    HIGH = "HIGH"
    MODERATE = "MODERATE"
    LOW = "LOW"
```

---

## 16. Repository Structure

```
NSAC 2026/
├── reference.png
├── README.md
├── .gitignore
├── docs/                            # Planning & methodology docs
│   ├── repository-audit.md
│   ├── challenge-contract.md
│   ├── common-competitor-space.md
│   ├── architecture-decision.md
│   ├── nasa-data-catalog.md
│   ├── geospatial-methodology.md
│   ├── VICTOR-blueprint-part1.md
│   ├── VICTOR-blueprint-part2.md
│   ├── demo-script.md
│   ├── judge-qa.md
│   └── BUILD_STATE.md
├── backend/
│   ├── main.py
│   ├── config.py
│   ├── requirements.txt
│   ├── routers/ (map, route, science, scenario, report)
│   ├── services/ (data_service, route_engine, science_engine,
│   │              scenario_engine, evidence_engine, explanation_engine)
│   ├── data/
│   │   ├── adapters/ (mola, crism, themis, base)
│   │   ├── cache/ (.npy grids, .json metadata)
│   │   ├── tiles/ (terrain/hazard/science tile pyramids)
│   │   └── demo/ (precomputed routes)
│   ├── models/ (domain, schemas, enums)
│   ├── utils/ (mars_geo, provenance, grid)
│   └── tests/
├── frontend/
│   ├── package.json, next.config.js, tsconfig.json, tailwind.config.ts
│   ├── public/assets/
│   └── src/
│       ├── app/ (layout, page, globals.css, planner/page)
│       ├── components/
│       │   ├── map/ (MarsMap, LayerControl, RouteOverlay, EvidencePopup)
│       │   ├── panels/ (InfoBar, RouteProfile, RiskAssessment,
│       │   │            ScienceOpportunities, RouteComparison, ScenarioPanel)
│       │   ├── sidebar/ (Sidebar)
│       │   └── common/ (Header, DataBadge, ConfidenceIndicator)
│       ├── hooks/ (useRoutes, useMapLayers, useScenario)
│       ├── services/ (api.ts)
│       ├── types/ (index.ts)
│       └── utils/ (formatting.ts)
├── scripts/
│   ├── generate_demo_data.py
│   └── generate_tiles.py
└── deployment/
    ├── docker-compose.yml
    ├── Dockerfile.backend
    └── Dockerfile.frontend
```

---

## 17. Dependency Matrix

### Backend (requirements.txt)
```
fastapi>=0.104.0
uvicorn>=0.24.0
pydantic>=2.5.0
numpy>=1.26.0
scipy>=1.11.0
Pillow>=10.1.0
httpx>=0.25.0
python-dotenv>=1.0.0
```

### Frontend (package.json)
```
next@14, react@18, react-dom@18, typescript@5
tailwindcss@3
leaflet@1.9, react-leaflet@4, @types/leaflet
recharts@2
lucide-react
```

### Scripts
```
numpy, Pillow
```

---

## 18. 48-Hour Implementation Roadmap

| Hours | Phase | Deliverable |
|---|---|---|
| 0-3 | Foundation | Backend (FastAPI) + Frontend (Next.js) scaffolds running |
| 3-8 | Data Layer | Demo data grids generated, tile pyramid built, data service loading |
| 8-14 | Core Intelligence | Multi-objective A* engine, 4 route strategies, evidence decomposition |
| 14-18 | Advanced Intelligence | Science engine, scenario engine, uncertainty metadata |
| 18-22 | Backend API | All endpoints wired, validated, error-handled |
| 22-32 | Frontend | Map, layers, info bar, route overlay, charts, panels |
| 32-38 | Killer Feature | Evidence inspector, scenario comparison panel |
| 38-42 | Integration | E2E testing, error handling, demo hardening |
| 42-46 | Polish | UX polish, loading states, responsive, accessibility |
| 46-48 | Demo Prep | Demo script rehearsal, screenshots, final audit |

---

## 19. Antigravity Phase-by-Phase Prompts

### PROMPT 1: Foundation (Phase 0-1)

```
TASK: Initialize the VICTOR project for NASA Space Apps Challenge 2026.

BACKEND:
1. Create backend/requirements.txt:
   fastapi>=0.104.0, uvicorn>=0.24.0, pydantic>=2.5.0, numpy>=1.26.0,
   scipy>=1.11.0, Pillow>=10.1.0, httpx>=0.25.0, python-dotenv>=1.0.0
2. Create backend/main.py: FastAPI app, CORS for localhost:3000, health check
   at /api/v1/health returning {"status":"ok","data_mode":"VERIFIED_SNAPSHOT"},
   include routers for map, route, science, scenario, report
3. Create backend/config.py: Pydantic Settings with DATA_DIR, CACHE_DIR,
   DATA_MODE="VERIFIED_SNAPSHOT", GEMINI_API_KEY=None, HOST="0.0.0.0", PORT=8000
   DataMode options: LIVE | VERIFIED_SNAPSHOT | DEMONSTRATION
   Default: VERIFIED_SNAPSHOT (real pre-downloaded NASA data)
4. Create backend/models/enums.py with RouteStrategy, DataMode (LIVE,
   VERIFIED_SNAPSHOT, DEMONSTRATION), MineralClass, ConfidenceLevel enums
   (exact values in blueprint section 15)
5. Create backend/models/domain.py with Coordinate, GridMetadata (note:
   cell_size_ns_m and cell_size_ew_m fields for non-square cells),
   MissionConstraints, RouteMetrics, RouteSegment, ScienceTarget, Route,
   ProvenanceRecord (exact fields in blueprint section 15)
6. Create backend/models/schemas.py with RouteComputeRequest (start, destination,
   constraints, strategies), RouteComputeResponse (including pareto field),
   ScenarioCompareRequest, RegionInfoResponse
7. Create all __init__.py files
8. pip install -r requirements.txt
9. Verify uvicorn backend.main:app starts on port 8000

FRONTEND:
1. npx -y create-next-app@latest frontend --typescript --tailwind --eslint
   --app --src-dir --import-alias "@/*" --no-turbopack
2. cd frontend && npm install leaflet react-leaflet @types/leaflet recharts
   lucide-react
3. Create frontend/src/app/globals.css: CSS variables for --victor-navy
   (#0B3D91), --victor-blue (#1E88E5), --victor-accent (#FF6F00),
   --victor-surface (#F8F9FA). Import Inter from Google Fonts.
4. Create frontend/src/types/index.ts: TypeScript interfaces matching all
   backend models (note: DataMode = LIVE | VERIFIED_SNAPSHOT | DEMONSTRATION)
5. Create frontend/src/services/api.ts: fetch wrapper for all backend endpoints
6. Verify npm run dev starts on port 3000

GIT: init, .gitignore (node_modules, .next, __pycache__, .env, *.npy,
data/raw/), commit "feat: initialize VICTOR project structure"

DONE WHEN: backend /api/v1/health returns ok with data_mode VERIFIED_SNAPSHOT,
frontend renders, git committed
```

### PROMPT 2: Data Layer (Phase 2-3)

```
TASK: Build the VICTOR data pipeline. The PRIMARY path uses real pre-downloaded
NASA data (VERIFIED_SNAPSHOT mode). Synthetic fallback is emergency-only.

PHASE 1 — ACQUIRE VERIFIED REAL NASA DATA:
1. Download MOLA MEGDR (128 ppd) for Jezero region from USGS Astropedia
2. Download CRISM multispectral mineral parameter maps for Jezero
3. Download THEMIS global daytime IR mosaic crop for Jezero
4. Save originals to backend/data/raw/ (gitignored)
5. Record PDS product IDs and retrieval dates in provenance.json

PHASE 2 — VALIDATE / NORMALIZE / PREPROCESS:
1. Reproject all data to equirectangular, IAU 2000 planetocentric, east-positive
2. Clip all data to computation extent: 18.0–18.9°N, 77.0–78.0°E
3. Resample to 300×300 grid (non-square cells: ~177m N-S × ~187m E-W)
4. Validate elevation range (~-3000 to ~-1200m for Jezero)
5. Save normalized arrays to backend/data/cache/

PHASE 3 — GENERATE COMPUTATIONAL GRIDS (300×300):
All grids: 300 rows × 300 cols, extent 18.0–18.9°N, 77.0–78.0°E

ELEVATION: from MOLA normalized data
Save: backend/data/cache/elevation.npy

SLOPE (derived): arctan(gradient / cell_distance) in degrees, using haversine
distance for cell spacing (~177m N-S, ~187m E-W), 8-neighbor max gradient
Save: backend/data/cache/slope.npy

TRAVERSABILITY (derived from slope):
  0–5° = 1.0, 5–10° = 1.5, 10–15° = 2.5, 15–20° = 5.0,
  20–25° = 10.0, >25° = impassable (999)
Save: backend/data/cache/traversability.npy

SCIENCE_VALUE: from CRISM mineral parameter maps → tier-based model:
  Tier 1 (0.8–1.0): Carbonates, Phyllosilicates, Hydrated silica
  Tier 2 (0.5–0.8): Altered olivine, Sulfates
  Tier 3 (0.2–0.5): Pyroxene, Iron oxides
  Tier 4 (0.0–0.2): Unaltered basalt, Unknown
  Label as MODEL — Science Priority Score, NOT a direct measurement.
Save: backend/data/cache/science_value.npy

HAZARD (derived): 0.5*norm_slope + 0.3*rock_hazard + 0.2*surface_dust_risk
  surface_dust_risk is derived from THEMIS TI (low TI = fine dust = low traction).
  NOT from MCS atmospheric data. Scale 0–10.
Save: backend/data/cache/hazard.npy

SCIENCE_TARGETS (JSON, 10 entries): Western Delta Front, 3 Carbonate deposits,
2 Seitah Olivine, Ancient Shoreline, 2 Crater Rim Phyllosilicates, Hydrated Silica.
Each: id, name, type, lat, lon, science_value, tier, description, source.
Do NOT hardcode distance_from_route_m or detour_cost_minutes (computed at runtime).
Save: backend/data/cache/science_targets.json

GRID_METADATA: lat_min=18.0, lat_max=18.9, lon_min=77.0, lon_max=78.0,
rows=300, cols=300, cell_size_ns_m=177.5, cell_size_ew_m=187.1,
cell_shape="non-square"
Save: backend/data/cache/grid_metadata.json

PROVENANCE: records for MOLA, CRISM, THEMIS with real PDS product IDs,
mission/instrument names, observation dates, retrieval dates
Save: backend/data/cache/provenance.json

PHASE 4 — GENERATE MAP/DISPLAY PRODUCTS:
Create scripts/generate_tiles.py:
- Read elevation.npy, color-map with mars palette (brown/orange/gray), generate
  PNG tiles at zoom 1-5 into backend/data/tiles/terrain/{z}/{x}/{y}.png
- Same for hazard (red transparent overlay) and science (green transparent)

PHASE 5 — SYNTHETIC EMERGENCY FALLBACK:
Create scripts/generate_synthetic_fallback.py:
- If real NASA data download fails, generate synthetic grids matching
  known Jezero topography as emergency fallback ONLY.
- All synthetic data MUST be labeled: "DEMONSTRATION — NOT REAL NASA DATA"
- Synthetic data is NEVER the primary path.

Create backend/services/data_service.py:
- Load all .npy grids + JSON on init
- Detect data_mode: VERIFIED_SNAPSHOT if real data present, DEMONSTRATION
  if only synthetic fallback exists
- Methods: get_elevation(lat,lon), get_slope(lat,lon), get_value_at(grid,lat,lon),
  latlon_to_grid(lat,lon), grid_to_latlon(row,col), get_science_targets(),
  get_provenance(), get_traversability_grid(), get_science_grid()

RUN pipeline. Verify all files created with correct shapes/ranges.

DONE WHEN: all .npy shape (300,300), elevation in expected Jezero range,
tile dirs exist, data_service loads without errors, provenance records
contain real PDS product IDs, data_mode = VERIFIED_SNAPSHOT
```

### PROMPT 3: Core Route Intelligence (Phase 4-6)

```
TASK: Build multi-objective A* pathfinding engine — the core intelligence.

Read docs/VICTOR-blueprint-part1.md sections 5 and 7 for exact specifications.

IMPORTANT: All edge costs MUST be non-negative. Science-seeking is achieved
via science_penalty = weight * (1 - science_value), NOT negative weights.

Create backend/utils/mars_geo.py:
- haversine_mars(lat1, lon1, lat2, lon2) -> meters, R_mars=3389500
- grid_to_latlon(row, col, metadata) -> (lat, lon)
- latlon_to_grid(lat, lon, metadata) -> (row, col) with bounds check
- bearing(lat1, lon1, lat2, lon2) -> degrees

Create backend/services/route_engine.py:
class RouteEngine:
  __init__(data_service): load grids
  compute_routes(start, dest, constraints) -> dict[strategy_name, Route]:
    Run A* with 4 weight profiles (ALL NON-NEGATIVE):
    SAFEST:          {distance:0.30, traversability:0.10, hazard:0.50, science_penalty:0.10}
    FASTEST:         {distance:0.60, traversability:0.30, hazard:0.10, science_penalty:0.00}
    SCIENCE_RICHEST: {distance:0.15, traversability:0.10, hazard:0.05, science_penalty:0.70}
    BALANCED:        {distance:0.25, traversability:0.15, hazard:0.30, science_penalty:0.30}

  _astar(start_cell, dest_cell, weights, constraints):
    heapq priority queue, 8-connected grid,
    diagonal cost uses haversine (sqrt(ns² + ew²) for non-square cells),
    max 500000 iterations, skip cells where slope > constraints.max_slope_deg

  _edge_cost(a, b, weights):
    w.distance        * haversine_distance(a, b) +
    w.traversability  * avg(traversability[a], traversability[b]) +
    w.hazard          * avg(hazard[a], hazard[b]) +
    w.science_penalty * avg(1 - science_value[a], 1 - science_value[b])
    ALL FOUR TERMS ARE NON-NEGATIVE. A* correctness is preserved.

  For each segment, store cost decomposition:
    distance_contribution, traversability_contribution,
    hazard_contribution, science_penalty_contribution, total_edge_cost

  Post-process: cell path -> coordinates, compute per-segment metrics,
  build RouteSegment with contributing_layers and cost_breakdown,
  compute RouteMetrics, estimate time as distance / (base_speed / traversability_cost)

Create backend/services/evidence_engine.py:
  get_segment_evidence(segment, data_service) -> dict with elevation/slope/
  material/mineral/science values, provenance records, cost breakdown
  (distance, traversability, hazard, science_penalty contributions)

  Analytical counterfactual attribution:
    cost_without_X = total_cost - X_contribution
    This is deterministic arithmetic — do NOT run additional A* runs.

Create backend/routers/route.py:
  POST /api/v1/routes/compute -> RouteComputeResponse
  GET /api/v1/routes/{id}/segments/{seg_id}/evidence
  Store results in-memory dict by computation_id (uuid4)

Create backend/tests/test_mars_geo.py: haversine accuracy, grid round-trip
Create backend/tests/test_route_engine.py:
  VALID assertions (do NOT use invalid universal guarantees):
  1. All 4 strategies produce valid, connected paths
  2. All routes respect max_slope constraint
  3. Impassable terrain (>25°) is avoided
  4. Route segment distances sum to total distance (±1%)
  5. Each strategy's route is optimal under its OWN weighted cost function
  6. Determinism: same inputs produce same outputs
  7. Pareto plausibility: routes show meaningful trade-offs
  8. Evidence decomposition sums match total edge costs
  9. Graceful handling when no path exists
  10. Computation < 5 seconds on 300×300 grid

DONE WHEN: compute_routes returns 4 distinct valid paths, all tests pass,
API returns well-formed JSON, < 5 second computation
```

### PROMPT 4: Science + Scenarios (Phase 7-9)

```
TASK: Build science opportunity analysis, scenario comparison, and
Pareto dominance analysis engines.

Create backend/services/science_engine.py:
- get_nearby_targets(route, radius_m=500): find targets near route,
  compute distance_from_route_m and detour_cost_minutes AT RUNTIME
  (these values are never hardcoded in the target catalog)
- compute_route_science_profile(route): per-segment science values for charting
- compare_science_value(routes_dict): total/unique/efficiency per strategy
- science_discovery_analysis(routes_dict): identify best detour opportunity,
  generate template-based text using computed values:
  "{detour_km} km detour accesses {mineral_name}, +{science_delta}% science value"
  Do NOT hardcode specific distances or percentages.

Create backend/services/pareto_engine.py:
  Pareto dominance analysis over the 4 generated routes.
  Objectives: distance (minimize), time (minimize), hazard (minimize),
  science_value (maximize).
  Route A dominates B iff A is no worse on every objective AND strictly
  better on at least one.
  Label each route: NON_DOMINATED or DOMINATED.
  This is deterministic comparison — no ML, no approximation.
  Include in route computation response.

Create backend/services/scenario_engine.py:
- compare_scenarios(base_routes, modifications): re-run route engine with
  modified constraints, diff results, compute impact percentages and summary
- Modifications can change: max_slope_deg, walking_speed_kmh, custom weights

Add to evidence_engine.py:
- Confidence levels per layer: categorical only (HIGH / MODERATE / LOW)
  No numeric confidence unless documented derivation methodology exists.
- Data freshness dates, spatial resolution warnings
- Analytical counterfactual per segment:
  cost_without_X = total_cost - X_contribution (deterministic arithmetic)

Create backend/routers/science.py:
  GET /api/v1/science/targets
  GET /api/v1/science/profile?computation_id=X&strategy=Y

Create backend/routers/scenario.py:
  POST /api/v1/scenarios/compare

DONE WHEN: science returns 3+ targets near demo route with runtime-computed
detour distances, scenario produces different routes when max_slope reduced,
Pareto labels are computed for all 4 routes, all endpoints return valid JSON
```

### PROMPT 5: Frontend (Phase 11-14)

```
TASK: Build the complete VICTOR frontend matching reference.png design.

Read reference.png and docs/VICTOR-blueprint-part1.md section 10-12.
Use Next.js 14, TypeScript, Tailwind CSS, Leaflet, Recharts, Lucide icons.

LAYOUT (src/app/planner/page.tsx):
- Full-height grid: header(60px) + main area
- Main: left sidebar(240px) + center(map + bottom panels) + right panel(320px)

HEADER (src/components/common/Header.tsx):
- Left: "VICTOR" logo text in navy
- Center: nav tabs (Mission Planner, Data & Layers, Science Targets, Methodology)
- Right: data mode badge (green=LIVE, blue=VERIFIED_SNAPSHOT, amber=DEMONSTRATION)
  + search icon

SIDEBAR (src/components/sidebar/Sidebar.tsx):
- Icon+label nav items from reference.png
- Active state highlight in blue
- Sections: Mission Overview, Plan Marswalk, Interactive Map, Route Analysis,
  Science Opportunities, Environmental Data, Compare Scenarios, Mission Report
- Bottom: Data Sources, Methodology, System Status

MAP (src/components/map/MarsMap.tsx):
- MARS COORDINATE TRANSFORMATION (CRITICAL):
  Use Leaflet L.CRS.Simple with an explicit affine transformation that maps
  Mars planetocentric lat/lon to Leaflet pixel coordinates:
    x_pixel = (lon - lon_min) / (lon_max - lon_min) * tile_extent
    y_pixel = (lat_max - lat) / (lat_max - lat_min) * tile_extent
  This ensures consistent coordinates across:
  - Map click events (convert pixel → Mars lat/lon)
  - Route overlays (convert Mars lat/lon → pixel)
  - Tile coordinates (aligned to the same extent)
  - Scale bar (compute from haversine at display center)
  - Markers and data layers
  Define and document the transformation in a mars_projection utility.
  Do NOT leave CRS as ambiguous "custom CRS or mapped Simple CRS".
- Load tiles from backend /api/v1/map/tiles/terrain/{z}/{x}/{y}.png
- Set bounds to match grid extent (18.0-18.9N, 77.0-78.0E)
- Click to place start (green pin) and destination (red pin)
- Scale bar in km (computed from Mars radius haversine), zoom controls
- NOTE: import leaflet CSS, use dynamic import with ssr:false for Next.js

LAYER CONTROL (src/components/map/LayerControl.tsx):
- Right panel, checkboxes + opacity sliders for each layer
- Layers: Base Imagery (HiRISE, DISPLAY-ONLY), Elevation (MOLA),
  Surface Composition (CRISM), Thermal Inertia (THEMIS),
  Atmospheric Context (MCS — CONTEXTUAL, regional/seasonal only),
  Scientific Targets, Hazard Zones,
  Perseverance Traverse (REFERENCE/VALIDATION)

ROUTE OVERLAY (src/components/map/RouteOverlay.tsx):
- 4 colored polylines: SAFEST=#22C55E, FASTEST=#3B82F6,
  SCIENCE_RICHEST=#F97316, BALANCED=#A855F7
- Start/destination markers, science target markers
- Click segment -> call evidence API -> show EvidencePopup

INFO BAR (src/components/panels/InfoBar.tsx):
- 5 metric cards: Region+coords, Elevation, Terrain Type, Temperature, Dust
- MCS atmospheric data labeled as CONTEXTUAL (regional/seasonal)
- Match reference.png layout exactly

ROUTE PROFILE (src/components/panels/RouteProfile.tsx):
- Recharts LineChart: X=distance(km), Y=elevation(m) + terrain difficulty
- Color by selected strategy

RISK ASSESSMENT (src/components/panels/RiskAssessment.tsx):
- 4 bars: Terrain Difficulty, Rock Hazard, Slope Risk, Surface Dust Risk
- Colored by severity, score /10
- Note: "Dust Exposure" bar uses THEMIS-derived surface_dust_risk, NOT MCS

SCIENCE OPPORTUNITIES (src/components/panels/ScienceOpportunities.tsx):
- Horizontal scroll of target cards with name, distance, value badge
- Science values labeled as "MODEL" scores, not direct measurements
- Confidence displayed as categorical (HIGH/MODERATE/LOW), never fake %

ROUTE COMPARISON (src/components/panels/RouteComparison.tsx):
- Table: Strategy, Distance, Time, Hazard, Science, Confidence, Pareto Status
- Pareto column shows NON_DOMINATED or DOMINATED label
- Highlight selected, toggle routes on map

EVIDENCE POPUP (src/components/map/EvidencePopup.tsx):
- KILLER FEATURE: slide-in panel showing segment evidence
- Elevation (MOLA), Slope (derived), Surface Material (THEMIS),
  Minerals (CRISM), Science Value (MODEL label), Cost Breakdown bar chart
  showing: distance, traversability, hazard, science_penalty contributions
- Analytical counterfactual: "Without hazard factor, cost would be {X}"
- Data source badges with dates
- Confidence: categorical only (HIGH/MODERATE/LOW)
- This is what makes VICTOR different from every other team

SCENARIO PANEL (src/components/panels/ScenarioPanel.tsx):
- Sliders: Safety Priority, Science Priority, Max Slope (5-30), EVA Time (2-8h)
- "Recompute" button, before/after comparison, impact summary

HOOKS:
- useRoutes: state for routes, selected strategy, computeRoutes(), selectStrategy()
- useMapLayers: enabled layers, opacity, toggleLayer()
- useScenario: parameters, compareScenarios()

LANDING (src/app/page.tsx):
- Hero: "VICTOR - Martian Marswalk Intelligence Platform"
- "A multi-objective route planning system for future Mars explorers"
- "Start Planning" button -> /planner
- Professional, clean, NASA-institutional aesthetic

DONE WHEN: map renders with Mars tiles using documented coordinate transformation,
layers toggle, routes display as 4 colored paths, evidence panel shows
per-segment data with cost decomposition, scenario recomputes,
route comparison table with Pareto status works, design matches reference.png
aesthetic
```

### PROMPT 6: Integration & Demo Hardening (Phase 15-20)

```
TASK: End-to-end integration, error handling, demo hardening, and final polish.

DATA MODE: The demo MUST run from VERIFIED_SNAPSHOT mode (real pre-downloaded
NASA data). DEMONSTRATION mode is emergency fallback only.

DEMO SCENARIO:
- Pre-compute routes for start=18.35N/77.35E, dest=18.50N/77.55E with
  default constraints (max_slope=20, eva=6h, speed=3kmh)
- Save to backend/data/demo/precomputed_routes.json
- Load on app startup for instant first display
- All demo values MUST come from actual computation, not hardcoded numbers

DEMO SCRIPT VARIABLES (populated from computation, NOT hardcoded):
- {fastest_distance_km}, {safest_key_segment}, {science_target_name}
- {science_value_delta}, {route_shift_km}, {pct_impassable}
- {detour_km}, {detour_minutes}, {mineral_name}
- All demo narrative uses these runtime variables

ERROR HANDLING:
- Backend unavailable: "System Offline" with retry button
- Route computation fails: "Could not compute route" with explanation
- No viable path: "No route found. Try increasing max slope tolerance."
- Out-of-bounds coordinates: "Point outside mapped region"
- Slow computation: loading spinner with "Computing routes..."
- Data mode fallback: if VERIFIED_SNAPSHOT data missing, fall to
  DEMONSTRATION mode with visible "DEMONSTRATION — NOT REAL NASA DATA" label

PERFORMANCE:
- Tile caching headers (Cache-Control: max-age=3600)
- Route computation target: < 3 seconds
- Frontend: lazy load non-critical panels

UX POLISH:
- Loading skeletons for all async panels
- Smooth slide-in for evidence panel
- Tooltips on all icon-only controls
- Color-blind safe: add dashed/dotted patterns to route lines
- Data mode badge always visible in header
- Science values labeled as MODEL scores throughout UI
- Confidence always categorical (HIGH/MODERATE/LOW), never fake percentages

TESTING:
- Full workflow: open -> planner -> click start -> click dest -> compute ->
  view comparison (with Pareto status) -> click segment -> evidence
  (with cost decomposition and counterfactual) -> change scenario -> recompute
- All API calls succeed
- No console errors
- Verify data_mode = VERIFIED_SNAPSHOT in health check

DOCUMENTATION:
- README.md: project description, setup instructions (pip install, npm install,
  run scripts, start backend, start frontend), demo walkthrough
- docs/BUILD_STATE.md: final implementation status
- docs/demo-script.md: 7-minute demo walkthrough using runtime variables
- docs/judge-qa.md: anticipated Q&A with accurate answers

FINAL: npm run build succeeds, pytest passes, git commit "VICTOR v1.0"

DONE WHEN: demo workflow completes in <30 seconds, no errors, demo scenario
loads in <2 seconds from VERIFIED_SNAPSHOT data, evidence inspector works
with cost decomposition, scenario comparison works, Pareto labels shown
```

---

## 20. Testing Strategy

| Test | Tool | Target |
|---|---|---|
| Mars geo math | pytest | haversine accuracy ±1%, grid round-trip |
| Route engine | pytest | 4 valid connected paths, constraint compliance, determinism, Pareto plausibility |
| Science engine | pytest | 3+ targets near route with runtime-computed detours, science profile chart-ready |
| Pareto engine | pytest | Deterministic dominance labels, consistent with route metrics |
| API endpoints | pytest + httpx | All endpoints return valid schemas |
| TypeScript | tsc | No type errors |
| Build | npm run build | Succeeds |
| E2E | Manual browser | Full workflow demo |
| Data validation | Python script | Grid values in expected ranges |

### 10 Critical Tests (Audited Valid Assertions)
1. Route feasibility: A* finds path between any two traversable points
2. Constraint compliance: all routes respect max_slope_deg
3. Route connectivity: every route is a connected sequence of adjacent cells
4. Metric consistency: segment distances sum to total (±1%)
5. Evidence consistency: cost decomposition (distance + traversability + hazard + science_penalty) matches total edge cost
6. Determinism: same inputs produce same outputs
7. Objective ordering: each strategy’s route is optimal under its OWN weighted cost function
8. Pareto plausibility: routes show meaningful trade-offs across objectives
9. Scenario sensitivity: tighter slope constraint changes route paths
10. Graceful fallback: no-path scenario returns clear error, not crash

---

## 21. Failure & Fallback Strategy

| Failure | Fallback |
|---|---|
| NASA data download | DEMONSTRATION synthetic fallback (clearly labeled). VERIFIED_SNAPSHOT is primary path. |
| Backend crash | "System Offline" UI state with retry |
| Route timeout (>10s) | Return error with explanation |
| No viable path | "No route — adjust constraints" message |
| Tile not found | Gray placeholder tile |
| AI explanation fails | Templated text from computed metrics |
| Map crash | Reload map component |
| Invalid input | Pydantic validation error message |

---

## 22. Red-Team Findings (Top 10)

| # | Finding | Severity | Mitigation |
|---|---|---|---|
| 1 | ~177×187m grid too coarse for small hazards | HIGH | Document; real missions use 1m HiRISE DTM |
| 2 | Science value scoring is a MODEL, not measurement | MEDIUM | Tier-based methodology documented; cite Farley et al. 2020 |
| 3 | Demo must use real NASA data | HIGH | VERIFIED_SNAPSHOT mode primary; DEMONSTRATION is emergency fallback only, clearly labeled |
| 4 | Walking speed model simplified | MEDIUM | Document as estimate |
| 5 | LLM could hallucinate | MEDIUM | Only receives structured computed data |
| 6 | Cost function weights not calibrated | HIGH | Tunable via scenario engine; sensitivity shown |
| 7 | No return trip consideration | MEDIUM | Challenge focuses on one-way; noted as extension |
| 8 | No radiation exposure layer | LOW | Not in primary scope |
| 9 | Mineral classification approximate | MEDIUM | Using published TI/CRISM ranges; tier methodology documented |
| 10 | MCS is contextual only | LOW | MCS provides regional/seasonal atmosphere context, NOT per-cell route hazard |

---

## 23. Demo Script (7 minutes)

> **All numeric values below are TEMPLATE VARIABLES. They must be populated from actual computed results AFTER implementation, not hardcoded.**

**0:00-0:45** — "A future astronaut at Jezero Crater needs to walk across hazardous terrain. The terrain is dangerous, science is valuable, time is limited. Which route? VICTOR helps decide."

**0:45-1:30** — Show map. Toggle layers: terrain, elevation, hazards, science targets. "Real NASA data from 6 instrument datasets across 4 Mars missions — MOLA, HiRISE, CRISM, THEMIS, MCS, and Perseverance."

**1:30-2:15** — Click start near landing site. Click destination near crater rim. Set 6h EVA, 20° max slope. Generate Routes.

**2:15-3:15** — 4 color-coded routes appear. Show comparison table with Pareto status. "FASTEST is {fastest_distance_km}. SAFEST avoids {safest_key_segment}. SCIENCE-RICHEST visits {science_target_name}. Notice the trade-offs — the Pareto analysis shows these routes represent genuinely different trade-offs."

**3:15-4:15** — **KILLER MOMENT**: Click segment near science target. Evidence panel shows CRISM mineral detection (categorical confidence: HIGH/MODERATE/LOW), MOLA slope, THEMIS surface material. Cost decomposition: distance, traversability, hazard, and science penalty contributions. "This is exactly WHY this route differs — and without the hazard factor, cost would be {counterfactual_cost}."

**4:15-5:00** — Science opportunities panel. "BALANCED route passes near deltaic sediments. {detour_km} km detour adds {detour_minutes} minutes but accesses {mineral_name}, increasing science value by {science_value_delta}%." (All values computed at runtime.)

**5:00-6:00** — Scenario change. Reduce max slope 20° → 15°. Recompute. Routes shift. "{pct_impassable}% terrain now off-limits. SAFEST shifted {route_shift_km} km. BALANCED still reaches science target." (Values from computation.)

**6:00-7:00** — "VICTOR doesn't just show Mars. It computes which path to take, explains why using NASA data, and lets you change the mission to see what happens. This is not a map. This is mission intelligence."

---

## 24. Judge Q&A

| Question | Answer |
|---|---|
| What NASA data? | 6 instrument datasets from 4 NASA Mars missions: MOLA (elevation, MGS), HiRISE (imagery, MRO), CRISM (mineralogy, MRO), THEMIS (surface material, Odyssey), MCS (atmosphere, MRO), Perseverance (reference traverse, Mars 2020) |
| How different from Google Maps? | Multi-objective: 4 competing strategies with quantified trade-offs and Pareto dominance analysis, not single shortest path |
| Is AI doing the science? | No. Science from NASA data + deterministic computation. AI only explains computed results in natural language |
| How handle uncertainty? | Categorical confidence (HIGH/MODERATE/LOW) per data layer. Science values explicitly labeled as MODEL scores, not direct measurements. No fabricated numeric precision |
| What if NASA data unavailable? | Three modes: LIVE (stretch goal), VERIFIED_SNAPSHOT (primary — real pre-downloaded NASA data), DEMONSTRATION (emergency fallback, clearly labeled). Data mode always visible |
| Could this be used for real missions? | Methodology is sound (similar to NASA AutoNav). Resolution would need to increase for real EVA |
| What is Pareto analysis? | We evaluate whether any route dominates another across all objectives. If all 4 routes are non-dominated, it proves they represent genuinely different trade-offs |
| How are science values determined? | Tier-based model following Mars 2020 science priorities (Farley et al. 2020). Clearly labeled as MODEL scores, not direct NASA measurements |

---

## 25. Final Risk Register

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Real NASA data fails | HIGH | HIGH | Demo data; all computation works offline |
| Route too slow | LOW | HIGH | 300x300 + numpy A* = 1-3 sec |
| Map doesn't render | MEDIUM | HIGH | Test Leaflet extensively; static image fallback |
| Judges miss innovation | MEDIUM | HIGH | Demo script makes computation visible immediately |
| Time runs out | MEDIUM | MEDIUM | Backend intelligence prioritized over frontend polish |
| Grid coordinate bugs | MEDIUM | HIGH | Extensive unit tests + landmark validation |

---

## EXECUTIVE SUMMARY

### WHAT WE BUILD
VICTOR — Multi-objective Marswalk planning fusing 6 instrument datasets from 4 NASA Mars missions into traversability + science grids, running weighted A* (all non-negative edge costs) for 4 route strategies, with Pareto dominance analysis, per-segment evidence provenance with analytical counterfactual attribution, and scenario comparison. Data runs on VERIFIED_SNAPSHOT (real pre-downloaded NASA data) by default.

### WHY DIFFERENT
4 competing routes (not 1), quantified trade-offs with Pareto analysis, per-segment NASA evidence with cost decomposition, scenario re-computation. Real computation over real data, not LLM text generation.

### HARD TO COPY
Multi-layer data fusion + multi-objective A* + evidence decomposition + Pareto dominance requires geospatial grid computation + graph algorithms + scientific domain knowledge.

### MUST WORK FOR DEMO
Map loads, layers toggle, 4 routes compute in <5s, evidence inspector works with cost breakdown and counterfactual, Pareto status displayed, scenario changes routes visibly. All from VERIFIED_SNAPSHOT data.

### CAN DEFER
AI explanations (use templates), PDF export, 3D view, LIVE NASA download pipeline, mobile responsive.

### NEXT STEP
Execute PROMPT 1: Initialize VICTOR project structure.
