# PATHWISE — Project Status Report

**Project:** PATHWISE — Multi-Objective Marswalk Arbitration Engine
**Challenge:** NASA Space Apps Challenge 2026 — *Interplanetary Survival Guide: Martian Map*
**Team:** Hackmanthan · Local Event: Lucknow, India
**Event Dates:** November 14–15, 2026
**Report Date:** October 6, 2026
**Repository State:** `master` @ `7f915ac` (clean working tree, 2 commits)
**Status Legend:** ✓ Complete · △ Partial / Needs Work · ✗ Not Started

---

## 1. Executive Summary

PATHWISE is a **working v1.0 product core**, not a greenfield idea. The full computational pipeline — data fusion → multi-objective A* pathfinding → Pareto arbitration → per-segment evidence → scenario diffing — is implemented, tested, and running locally end-to-end.

However, verification performed for this report surfaces **three findings that materially change the project's position**:

1. **The map data is synthetic, not real NASA data.** All five computation grids (elevation, slope, traversability, hazard, science value) are currently labeled `DEMONSTRATION — NOT REAL NASA DATA`. The real-data pipeline in `scripts/data_pipeline.py` is a stub: it performs a HEAD request to the MOLA server, then deliberately falls back to synthetic generation. Since the challenge contract requires *real, multi-mission NASA data*, this is the **single highest-priority gap** in the project.
2. **The "47/47 tests pass" claim is stale.** Re-running the suite today yields **45 passed / 2 failed**. Both failures share one root cause: `backend/data/demo/precomputed_routes.json` was saved with Windows-1252 encoding (contains byte `0x96`, a non-UTF-8 en-dash), which crashes the demo-routes and scenario-compare endpoints with a `UnicodeDecodeError`. This is a small fix, but it breaks two user-facing API endpoints and the automatic demo route on load.
3. **There is zero deployment or persistence infrastructure.** No Dockerfile, no `render.yaml`, no environment configuration for production, no database. The stated target stack (Render free tier + Supabase free tier) is entirely unbuilt. The frontend's `.env.local` points at `localhost:8000`.

**Overall Health:**

| Dimension | Status | Notes |
|---|---|---|
| Core engine (backend) | ✓ Strong | 6 services, ~1,100 lines, well-factored, 45/47 tests green |
| API layer | ✓ Strong | 4 routers, Pydantic v2 schemas, health endpoint, degraded-mode startup |
| Frontend application | △ Good shell, incomplete product | Map + route computation + evidence all work; nav is decorative; several reference-UI panels missing |
| Real NASA data | ✗ Not started | Synthetic-only; ingestion pipeline stubbed |
| Design vs. `reference.png` | △ Divergent | Current build is a dark "mission control" theme; reference is a light, NASA-blue institutional dashboard |
| Deployment (Render) | ✗ Not started | No config, no prod env vars, CORS hardcoded to localhost |
| Database (Supabase) | ✗ Not started | Nothing wired |
| Documentation | ✓ Excellent | 11 docs covering contract, architecture, methodology, demo, judge Q&A |

**Bottom line:** the hard, differentiating intellectual work is done and verified. The remaining work to a submittable product is (a) ingesting **real** NASA raster data, (b) rebuilding the UI to match `reference.png`, and (c) shipping to Render + Supabase — all planned in detail in the phase plan that accompanies this report.

---

## 2. What Exists Today (Verified Inventory)

### 2.1 Backend — FastAPI (Python)

| Module | Lines | Purpose | Status |
|---|---|---|---|
| `services/route_engine.py` | 362 | Multi-objective A* (SAFEST / FASTEST / SCIENCE_RICHEST / BALANCED), non-negative science-seeking cost formulation, slope-threshold constraints | ✓ |
| `services/data_service.py` | 179 | Loads 300×300 NumPy grids, auto-detects DEMONSTRATION vs VERIFIED_SNAPSHOT mode | ✓ |
| `services/science_engine.py` | 130 | Science target scoring, runtime detour cost computation | ✓ |
| `services/evidence_engine.py` | 146 | Per-segment cost decomposition + closed-form counterfactual attribution | ✓ |
| `services/pareto_engine.py` | 55 | Deterministic Pareto dominance verification across 4 strategies | ✓ |
| `services/scenario_engine.py` | 98 | Constraint sensitivity / scenario diffing | ✓ |
| `utils/mars_geo.py` | — | IAU2000 planetocentric geodesy (haversine, bearing, grid ↔ lat/lon) | ✓ |
| `utils/provenance.py` | — | NASA instrument attribution records | ✓ |
| `routers/` (route, science, scenario, map) | ~350 | REST API incl. tile serving (zoom 1–5 PNG) and precomputed demo route | ✓ |
| `data/tiles/` | ~60+ PNGs | elevation, hazard, science, terrain layers | ✓ (synthetic-derived) |

### 2.2 Frontend — Next.js 14 (TypeScript)

| Component | Status | Notes |
|---|---|---|
| `/planner` page | ✓ | Pin start/destination on map, set constraints (max slope, EVA hours, walk speed), compute 4 routes |
| `MarsMap.tsx` (Leaflet) | ✓ | Mars CRS affine projection, route polylines, science target markers, segment click → evidence |
| `RouteComparisonTable.tsx` | ✓ | Pareto arbitration table with NON_DOMINATED badges |
| `EvidencePopup.tsx` | ✓ | Per-segment MOLA/THEMIS/CRISM provenance + counterfactuals + confidence levels |
| Science profile chart (Recharts) | ✓ | Science/hazard along route distance |
| Data-mode honesty badge | ✓ | Amber "DEMONSTRATION DATA — Not real NASA observations" banner when synthetic |
| Header nav tabs (4) | △ | Render and highlight, but **do not switch views** — only Planner has content |
| Sidebar sections (10) | △ | Render and highlight, but **do not switch views** — single-page app |

### 2.3 Scripts & Tooling

| Script | Status | Notes |
|---|---|---|
| `scripts/generate_synthetic_fallback.py` (421 ln) | ✓ | High-fidelity Jezero-modeled synthetic grids (current data source) |
| `scripts/data_pipeline.py` (113 ln) | ✗ (stub) | Real MOLA download path aborts by design after a HEAD check → synthetic fallback |
| `scripts/generate_tiles.py` | ✓ | Renders multiscale PNG tiles from grids |
| `scripts/inspect_demo_metrics.py` | ✓ | Demo scenario metric inspection |

### 2.4 Documentation (11 files — a genuine strength)

`challenge-contract.md` (requirements traceability) · `architecture-decision.md` (5-concept scoring, PATHWISE won at 8.35) · `PATHWISE-blueprint-part1/2.md` (full system spec) · `nasa-data-catalog.md` (6 datasets, 4 missions, with real PDS/USGS source URLs) · `geospatial-methodology.md` · `common-competitor-space.md` (differentiation analysis) · `demo-script.md` (7-min walkthrough) · `judge-qa.md` · `repository-audit.md` · `BUILD_STATE.md`.

---

## 3. Verification Performed for This Report

Everything below was **executed on October 6, 2026** — not taken from existing docs.

| Check | Claimed | Verified Result |
|---|---|---|
| Backend tests (`pytest backend/tests`) | 47/47 pass | **45 passed, 2 failed** (see §4) |
| Frontend production build (`npm run build`) | Exit 0 | **✓ Pass** — `/planner` 118 kB first-load JS, strict TS, 0 errors |
| Data mode | "Real NASA data from 6 instruments / 4 missions" (README, FastAPI description) | **✗ DEMONSTRATION** — `grid_metadata.json` and `provenance.json` explicitly label all data synthetic |
| Deployment config | — | **✗ None found** (no Dockerfile, render.yaml, Procfile, CI workflow) |
| Git state | — | ✓ Clean, `master` = worktree branch = `7f915ac`, no divergence |

---

## 4. The Two Failing Tests — Root Cause Identified

```
FAILED test_api.py::TestAPIEndpoints::test_routes_demo_endpoint
FAILED test_api.py::TestAPIEndpoints::test_scenarios_compare_endpoint
E   UnicodeDecodeError: 'utf-8' codec can't decode byte 0x96 in position 327284
```

**Root cause:** `backend/data/demo/precomputed_routes.json` was written on Windows in default cp1252 encoding (file also uses CRLF line endings). A non-ASCII dash (`–` → byte `0x96`) deep in the file breaks UTF-8 JSON parsing when the demo endpoint and scenario-compare endpoint load it.

**Impact:** the precomputed demo route that the frontend auto-loads on startup fails to fetch (the frontend silently swallows the error, so the map loads empty until the user computes manually), and scenario comparison errors out.

**Fix (small):** regenerate the demo JSON with `encoding='utf-8'` (or `ensure_ascii=True`) in the generating script, and make every `open()` in the read path explicit about UTF-8. Then re-run the suite to restore 47/47.

---

## 5. Data Reality Check — the Critical Gap

The challenge contract requires **real NASA open data from multiple science missions**. Current state:

| Dataset | Mission | Role in PATHWISE | Current Source | Real? |
|---|---|---|---|---|
| MOLA MEGDR 128 ppd | MGS | Elevation → slope → traversability | `SYNTHETIC_MOLA_JEZERO_300x300` | ✗ Synthetic |
| CRISM mineral model | MRO | Science value tiers | `SYNTHETIC_CRISM_JEZERO_TIERMODEL` | ✗ Synthetic |
| THEMIS thermal inertia | Odyssey | Dust/surface risk proxy | `SYNTHETIC_THEMIS_JEZERO_TI` | ✗ Synthetic |
| HiRISE imagery / DTM | MRO | Base imagery, roughness | Not used at all (no imagery tiles exist) | ✗ Absent |
| MCS dust climatology | MRO | Atmospheric context | Modeled only | ✗ Synthetic |
| Perseverance traverse | Mars 2020 | Ground-truth route overlay | Optional map layer on synthetic grid | ✗ Synthetic |

**What is genuinely real today:** the *feature names* (Western Delta Front, Seitah olivine units, carbonate deposits, ancient shoreline) reflect published Jezero geology (Goudge et al. 2015; Farley et al. 2020), and the data catalog (`nasa-data-catalog.md`) documents correct PDS/USGS source URLs for every dataset. The engine math is data-agnostic and will consume real rasters without redesign.

**What must change:** `scripts/data_pipeline.py` must be completed to actually download and crop: (1) MOLA MEGDR 128 ppd (~180 MB IMG) — highest value, drives slope/traversability; (2) at least one more real mission raster (CRISM multispectral map or THEMIS TI mosaic) to satisfy "multi-mission"; (3) ideally HiRISE/CTX imagery for a real visual base layer. The provenance and honesty-labeling system (VERIFIED_SNAPSHOT vs DEMONSTRATION) is already built and is a judging strength — but it currently has nothing real to verify.

**Overclaim risk:** the FastAPI `description` and README state "Real NASA data from 6 instrument datasets across 4 Mars missions." Judges who inspect provenance.json will see synthetic labels. Copy must be corrected to match reality until real data lands.

---

## 6. Challenge Requirements Traceability

Derived from `docs/challenge-contract.md`:

| Requirement | Required? | Status | Evidence / Gap |
|---|---|---|---|
| Layered, integrated Mars map | ✓ | △ | 5 toggleable layers with opacity; but layers derived from synthetic data; no real imagery base layer |
| Multi-mission NASA data | ✓ | ✗ | 4 missions *modeled*, 0 missions *real* |
| Specific location/route focus (not whole-planet) | ✓ | ✓ | Jezero Crater 18.0–18.9°N, 77.0–78.0°E (~53×56 km), 300×300 grid |
| Safety-relevant information | ✓ | △ | Hazard + slope constraints computed; no environmental conditions (temp/dust) presented; risk scores from synthetic grid |
| Science target identification | ✓ | △ | 10 targets, detour costs computed at runtime; real feature types, synthetic placements/scores |
| Route planning/optimization | — | ✓ | Multi-objective A* + Pareto proof + scenario diffing (strong differentiator) |
| Evidence & provenance | — | ✓ | Per-segment instrument attribution, confidence levels, counterfactuals |
| Scenario comparison | — | ✓ | Backend complete; **no frontend UI exists for it** (`scenario` router unused by the client) |
| Environmental conditions | — | ✗ | Reference UI shows temp/dust cards; nothing implemented |
| Mission report export | — | ✗ | Sidebar item exists; no functionality |
| Uncertainty communication | — | △ | Confidence levels (HIGH/MODERATE/LOW) exist in evidence; no map-level uncertainty visualization |

---

## 7. UI Status vs. `reference.png`

`reference.png` (2.0 MB mockup) is the agreed design target. Current divergence is significant:

### 7.1 Theme mismatch
- **Reference:** light background, white cards, NASA-blue accents, institutional "NASA mission dashboard" feel.
- **Current build:** dark theme (`#07101C` background, dark navy panels) — a "mission control at night" aesthetic.

→ A deliberate decision is required: **restyle to the light reference theme** (recommended — the reference was chosen as the design north star) or formally justify the dark variant. This decision shapes all remaining UI work and should be made before Phase UI work begins.

### 7.2 Feature-by-feature gap analysis

| reference.png Element | Current Status |
|---|---|
| Top info bar — Selected Region, Elevation (avg), Terrain Type, Current Conditions (−63 °C), Atmospheric Dust | ✗ Missing entirely |
| Light NASA-branded top nav with search + avatar | △ Dark variant exists; search ✗; tabs non-functional |
| Left sidebar navigation (10 sections) | △ Present, non-functional (single page) |
| Interactive map with route, waypoints, labels (Start / Ancient Delta / Seitah / Destination) | ✓ Partial — route + pins work; named waypoint labels ✗ |
| Map Layers panel (HiRISE, MOLA, CRISM, THEMIS, MCS, targets, hazards, rover routes) with opacity sliders | △ 5 synthetic layers with sliders; no HiRISE imagery layer |
| **Route Profile** — elevation + terrain difficulty vs. distance | ✗ Replaced by science/hazard profile (no elevation profile exists) |
| **Route Risk Assessment** — 0–10 bars (Terrain 3.2, Rock 4.8, Slope 3.5, Dust 2.1) | ✗ Missing |
| **Science Opportunities** — thumbnail cards with value badges & distance | △ List exists in right panel; no thumbnails/cards styling |
| Scale bar (0–5–10–20 km) | ✗ (Leaflet default absent) |
| 3D toggle | ✗ |
| Multi-page nav (Mars Explorer, Data & Layers, Science Targets, Methodology, About) | ✗ Single page |

### 7.3 What the current UI has that the reference doesn't
Genuinely valuable additions worth keeping in any restyle: the Pareto route-comparison table, per-segment evidence popup, data-mode honesty badges, and mission-constraint sliders.

---

## 8. Deployment & Infrastructure Readiness (Render + Supabase)

| Item | Status | Notes |
|---|---|---|
| Backend containerization | ✗ | No Dockerfile. FastAPI + numpy/scipy/rasterio stack needs a Docker build for Render Web Service |
| Frontend hosting | ✗ | Next.js 14; needs decision — Render Web Service vs. static export; `.env.local` is localhost-only |
| `render.yaml` blueprint | ✗ | Nothing defined |
| Production CORS | ✗ | `FRONTEND_URL` default + hardcoded localhost trio in `main.py` |
| Environment variable strategy | ✗ | No `.env.production`, no secrets plan (only optional `GEMINI_API_KEY` exists today) |
| Database (Supabase) | ✗ | No client, no schema, no use case wired. Candidate uses: saved routes/scenarios, generated mission reports, (optional) lightweight auth |
| Data shipping | △ | Grids (~5 × 300×300 float64 ≈ 3.6 MB) + tiles are small enough to commit or bundle into the deploy; no pipeline exists to place them |
| Cold-start behavior | △ | Render free tier spins down; startup loads grids (~seconds) — acceptable, but demo flow must tolerate it |
| CI (tests on push) | ✗ | None |

**Free-tier constraints to design around:** Render free web service = 512 MB RAM, spins down after ~15 min idle, cold starts ~30–60 s. Supabase free = 500 MB Postgres, pausing after 1 week inactivity. Both are adequate for this workload (grids are small; pathfinding on 90k nodes is CPU-light) but must be validated in the phase plan.

---

## 9. Risk Register (Prioritized)

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | Synthetic data fails the challenge's core "real NASA data" requirement | **Critical** | Complete the real-data ingestion pipeline (Phase 2 of plan); MOLA first — biggest single win |
| R2 | Judges inspect provenance and find overclaiming copy ("Real NASA data…") | High | Purge overclaims from README/FastAPI description; keep honesty badges |
| R3 | Demo route silently fails on page load (encoding bug) — first impression breaks | High | Fix UTF-8 demo JSON + restore 47/47 tests (quick win) |
| R4 | UI diverges from the agreed reference design | High | Light-theme restyle to reference.png before adding new panels |
| R5 | Scenario engine invisible to users/judges (no UI) | Medium | Build Compare Scenarios view — it's a headline differentiator |
| R6 | Render cold start during live demo | Medium | Pre-warm before demo; keep precomputed demo route instant |
| R7 | Time: event is Nov 14–15; ~5.5 weeks remain | Medium | Phase plan sequences P0 gaps first; feature freeze date needed |

---

## 10. Recommended Next Phases (Preview)

The full phase-wise plan with deep research will follow as a separate document. The shape of it, based on this report:

| Phase | Theme | Outcome |
|---|---|---|
| **0 — Stabilize** (days) | Fix demo JSON encoding → 47/47 tests; purge data overclaims; pin Python/Node versions | Trustworthy baseline |
| **1 — Real Data** | Complete MOLA + second-mission raster ingestion (CRISM/THEMIS), regenerate grid/tiles/provenance, verify engine on real terrain | VERIFIED_SNAPSHOT mode becomes true |
| **2 — Design System & Shell** | Light reference theme, functional multi-page nav, info bar, typography | UI matches reference.png |
| **3 — Reference Parity Panels** | Route Profile (elevation), Route Risk Assessment, Science Opportunity cards, Compare Scenarios view, Data Sources & Methodology pages | Full reference feature set |
| **4 — Mission Report + Persistence** | Supabase schema (routes/scenarios/reports), report generation & export | Supabase integrated |
| **5 — Deploy** | Dockerfiles, render.yaml, prod env/CORS, CI, cold-start hardening | Live URL on Render free tier |
| **6 — Judging Package** | Demo script refresh on real data, video, judge Q&A, submission polish | Submission-ready |

---

## 11. Appendix

### A. How to Run (current, local)

```bash
# Backend (port 8000)
cd backend && pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Frontend (port 3000)
cd frontend && npm install --legacy-peer-deps && npm run dev

# Tests
pytest backend/tests -v        # currently 45/47 — see §4
cd frontend && npm run build   # verified passing
```

### B. Known Local-Environment Notes
- Tests were run on **Python 3.13** (README specifies 3.11+); Pydantic emits 2 deprecation warnings (`class Config` → `ConfigDict`) — harmless, worth cleaning before v3 of Pydantic.
- npm installs require `--legacy-peer-deps` (Leaflet/react-leaflet peer pinning).
- `.env.local` must point `NEXT_PUBLIC_API_URL` at the deployed backend URL once hosted.

### C. Fact Base for the Phase Plan (carried forward)
- Focus region, grid geometry, geodesy math, and engine interfaces are **stable** — real data swaps in without redesign (`data_pipeline.py` → same `.npy` contract).
- The `DataMode` honesty system (VERIFIED_SNAPSHOT / DEMONSTRATION badges, provenance records, per-panel disclaimers) is implemented end-to-end and should be preserved as a first-class feature.
- `reference.png` remains the binding design target (per team decision); theme decision (§7.1) is the first UI gate.
- Hosting: Render free tier (backend + frontend) / Supabase free tier (Postgres) — per team decision, to be engineered in Phases 4–5.

---

*End of report. Prepared from direct repository inspection and executed verification (test run, production build, data provenance audit, config review) on 2026-10-06.*
