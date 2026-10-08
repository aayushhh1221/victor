# VICTOR — Project Status Report

### Voyage Intelligence for Terrain-aware Cartographic Optimization & Routing

**Team** hackmanthan (6 members) · Local Event: Lucknow, India
**Challenge** Interplanetary Survival Guide: Martian Map — NASA Space Apps Challenge 2026
**Study region** Jezero Crater, Mars · 18.0–18.9°N, 77.0–78.0°E
**Report date** 8 October 2026
**Hackathon** 14–15 November 2026 — **37 days remaining**

---

## 1. Executive Summary

VICTOR plans astronaut EVA traverses ("marswalks") across Jezero Crater, computing four
competing routes — `SAFEST`, `FASTEST`, `SCIENCE_RICHEST`, `BALANCED` — via multi-objective
A*, proving which are Pareto non-dominated, and explaining each route segment in terms of
the NASA instrument data that drove its cost.

**The mandatory data requirement is now satisfied.** At the start of this assessment every
grid the system reasoned over was synthetically generated, which failed the challenge's
binding requirement. That is closed. The system now runs on **five real NASA data products
spanning four missions**, and the compliance condition is enforced in code rather than
asserted in prose.

### Status at a glance

| Dimension | Status | Note |
|---|---|---|
| **NASA data authenticity** | **Satisfied** | 5 real products, 4 missions, `VERIFIED_SNAPSHOT` |
| **Multi-mission integration** | **Satisfied** | Mandatory per contract; enforced in code |
| Routing algorithm | **Strong** | Non-negative multi-objective A*, admissible heuristic |
| Test coverage | **Verified** | 59/59 passing, deterministic |
| Production build | **Verified** | Compiles clean, all routes static-exportable |
| UI completeness | **Wired** | All navigation functional; trade-off engine exposed |
| Visual design | **Rebuilt** | Light NASA-institutional default, dark toggle |
| Documentation accuracy | **Corrected** | False claims removed; quickstart verified working |
| Deployment config | **Ready** | `render.yaml`, dependency split, persistence |
| Live deployment | **Not yet done** | Requires account setup — see §8 |

---

## 2. NASA Data Provenance

The challenge contract states the data requirement in binding terms, and states it three
separate times:

> *"Must use data from multiple NASA science missions"*
> *"Data must be real/verified NASA open data"*
> *"Multi-mission data integration is mandatory"*

### Live compliance status

Reported by `GET /api/v1/health`:

```
data_mode        : VERIFIED_SNAPSHOT
real NASA data   : True
multi-mission    : True (4 of 2 required)
COMPLIANT        : True
```

### Sources ingested

| Mission | Instrument | Product | Native res. | Role |
|---|---|---|---|---|
| Mars Global Surveyor | MOLA | `Mars_MGS_MOLA_DEM_mosaic_global_463m` | 463 m/px | Elevation → slope → traversability |
| 2001 Mars Odyssey | THEMIS | `THEMIS_NightIR_ControlledMosaics_100m_v2` | 100 m/px | Thermal inertia proxy |
| Mars Reconnaissance Orbiter | CTX | `Jezero_CTX_BlockAdj_dd` | ~5 m/px | Real orbital basemap imagery |
| Mars Reconnaissance Orbiter | CRISM | `t1250_mrrsu_20n078_0327_4` | 181 m/px | Olivine + carbonate mineralogy |
| Mars 2020 | Perseverance | Published science targeting | — | Science target locations |

All are NASA mission instrument data distributed through NASA/USGS archives (PDS Imaging
Node, PDS Geosciences Node). Per-product provenance — URL, retrieval timestamp, SHA-256
checksum, processing chain, and caveats — is recorded in
`backend/data/cache/provenance_detail.json` and served by the API.

### The technique that made this possible

The original pipeline abandoned real data with the comment *"MOLA full download would take
too long for hackathon."* The observation was right and the conclusion was wrong. The global
MOLA mosaic is **2 GB** — worse than the 180 MB the comment assumed — but only a
1.0° × 0.9° window is needed.

GDAL's `/vsicurl/` driver issues HTTP range requests, so only the covering bytes transfer.
Measured against the live endpoints:

| Source | Transferred | Of total | Time |
|---|---|---|---|
| MOLA elevation | ~10.6 MB | 2 GB | 13 s |
| CRISM mineral band | 1.8 MB | 576 MB | 6 s |

No bulk downloads, no stored raw rasters. Windowed reads are cached locally so re-runs are
near-instant.

### Honest classification, enforced in code

Every layer carries one of four classifications:

| Class | Meaning | Example |
|---|---|---|
| `MEASURED` | Read from a published NASA product | MOLA elevation, CRISM indices |
| `DERIVED` | Computed from measured inputs by a documented transform | Slope, hazard, thermal proxy |
| `MODELLED` | Assigned by a VICTOR model | Science priority in CRISM gaps |
| `SYNTHETIC` | Generated, no NASA input | *(none present)* |

`backend/utils/provenance.py` computes the data mode from these rather than accepting a
hand-set value. It reports `VERIFIED_SNAPSHOT` only when **no source is synthetic AND at
least two distinct NASA missions contributed**. The previous code inferred this with
`any(not startswith("SYNTHETIC"))`, meaning a single real product among synthetic ones would
have advertised verified provenance.

**Known data gaps, stated plainly:**
- **CRISM covers 66% of the window.** Multispectral mapping has swath gaps. Unmeasured cells
  are stored as no-data and never filled — a gap means "unmeasured", not "no mineral".
- **MCS atmospheric data is unavailable.** Verified: no gridded MCS product exists in any
  NASA archive; the dataset is point profiles only. Temperature, dust opacity and pressure
  are returned as `null`, not estimated.

---

## 3. Verified Strengths

### 3.1 The routing engine is mathematically correct

Science-seeking is a *reward* conceptually, and the naive implementation — subtracting a
bonus from edge cost — produces negative weights, which breaks A* by admitting negative-cost
cycles. VICTOR expresses it as a **non-negative penalty** instead:

```
sci_penalty = 1.0 - avg_science_value
```

A high-science edge incurs a small penalty rather than a negative cost. All edge costs stay
non-negative, A* stays valid, and the optimality guarantee survives.

The heuristic is `w_distance × distance/1000`. Since every cost term is non-negative and any
path's length is at least the straight-line distance, true remaining cost is always at least
the heuristic — so it never overestimates, which is the admissibility condition A* requires.

### 3.2 Four strategies with transparent weights

`WEIGHT_PROFILES` in `backend/services/route_engine.py` is declarative and inspectable:

| Strategy | Distance | Traversability | Hazard | Science penalty |
|---|---|---|---|---|
| SAFEST | 0.30 | 0.10 | **0.50** | 0.10 |
| FASTEST | **0.60** | 0.30 | 0.10 | 0.00 |
| SCIENCE_RICHEST | 0.15 | 0.10 | 0.05 | **0.70** |
| BALANCED | 0.25 | 0.15 | 0.30 | 0.30 |

### 3.3 Demonstrated trade-off on real data

Demo traverse, crater floor to northern rim (`GET /api/v1/routes/demo`):

| Strategy | Distance | Hazard (0–10) | Science (0–1) | Pareto |
|---|---|---|---|---|
| SAFEST | 85.19 km | **1.196** | 0.4367 | NON_DOMINATED |
| FASTEST | **71.40 km** | 2.124 | 0.3335 | NON_DOMINATED |
| SCIENCE_RICHEST | 80.38 km | 1.651 | **0.4945** | NON_DOMINATED |
| BALANCED | 82.92 km | 1.277 | 0.4509 | NON_DOMINATED |

`SCIENCE_RICHEST` detours 9 km beyond `FASTEST` to gain 48% more science. `SAFEST` spends
14 km extra to nearly halve hazard. Spread: 16% distance, 44% hazard, 33% science.

**A note on route selection.** Across Jezero's flat crater floor the four strategies converge
to within ~5% of each other. That is a true property of benign terrain, not a defect — on
gentle ground there is little to trade off. The demo therefore uses a traverse that genuinely
crosses varied terrain, with the same real data and the same untouched weight profiles. The
weights were not tuned to manufacture contrast.

### 3.4 Evidence and provenance

`backend/services/evidence_engine.py` decomposes each segment into its contributing cost
components and computes closed-form counterfactuals (`cost_without_X`) showing what the
segment would have cost had a factor been absent. `pareto_engine.py` computes genuine
dominance relationships. Both surface in the UI.

### 3.5 Test coverage

**59 tests, all passing, deterministic across consecutive runs.** Covering Mars geodesy, A*
feasibility and constraint compliance, science analysis, the REST API, and the computation
store's restart-survival behaviour.

### 3.6 Correct Mars geodesy

IAU2000 planetocentric, east-positive, R_Mars = 3,389,500 m, with a Mars-specific haversine.
The 300×300 grid correctly accounts for **non-square cells** (177.5 m NS × 187.1 m EW,
~53.2 × 56.1 km) rather than assuming square cells, which is a common and consequential
error.

---

## 4. Defects Found and Fixed

### 4.1 The cost function was dimensionally inconsistent *(most significant)*

Three of four cost terms were charged **per step** while distance was charged **per metre**:

```
d_contrib  = w_dist * (dist/1000)   ← per metre
t_contrib  = w_trav * avg_trav      ← per step
h_contrib  = w_haz  * avg_hazard    ← per step
sp_contrib = w_sci  * sci_penalty   ← per step
```

Two defects followed. A diagonal step covers 1.41× the ground of an orthogonal one for
identical terrain cost, so diagonals were systematically under-penalised. More seriously,
total cost fell as step count fell, so the non-distance objectives were partly optimising for
*brevity* rather than their own criterion.

That inverted the headline result: **`SCIENCE_RICHEST` returned a 272-step route with less
science (0.361) than `SAFEST`'s 408-step route (0.446)** — the science-seeking strategy was
winning by taking fewer steps. A reviewer asking "why does your science-richest route have
less science?" would have had no good answer.

**Fix:** every term scaled by step distance, making the whole cost a cost-per-kilometre.
Admissibility is preserved. All four route invariants now pass.

### 4.2 Layer metadata contradicted the application's own banner

`backend/routers/map.py` hardcoded `"type": "VERIFIED_SNAPSHOT"` for the elevation layer
while the app ran in `DEMONSTRATION` mode, and labelled colormapped elevation as
`"Base Terrain (HiRISE)"`. Layer provenance and availability are now derived from the live
data mode and from which grids and tiles actually exist.

### 4.3 Hazard scale misread by a factor of ten in the UI

`avg_hazard_score` is on a 0–10 scale; the Route Analysis panel treated it as 0–1. Risk
meters rendered as "90.0 / 10" with bars pinned at 100%, the terrain-difficulty chart trace
was clipped off-axis and invisible, and the segment table coloured every row as danger.
Corrected to 0–10 throughout, matching the convention already used in the evidence panel.

### 4.4 The info bar displayed fabricated values

The region info bar declared fields the API did not return, so it always fell through to
hardcoded constants — including coordinates `18.444°N, 77.450°E` presented as real on every
page load, and an elevation of `−2,450 m` on the error path with no "unavailable" marker.
The backend now serves real computed values (`lat`, `lon`, `elevation_m`,
`elevation_min_m`/`max_m`, `terrain_type`, `elevation_source`) and **every hardcoded fallback
was deleted**. Missing data renders as `—` with a tooltip.

### 4.5 Navigation did not navigate

All 10 sidebar items and 4 header tabs changed only a highlight; no view switched and no data
loaded. A complete scenario-comparison engine existed end-to-end with no UI entry point, and
five typed API client functions were never called. All navigation now resolves to real views,
and the scenario engine is exposed.

### 4.6 Computation results did not survive a restart

Route results were held in a plain process dict. On Render's free tier — which spins a
service down after 15 minutes idle — every stored `computation_id` died with it, so a judge
who computed a route, read it for 15 minutes, then clicked a segment would get a **404**. The
dict also had no eviction, so it grew without bound on a 512 MB instance.

Replaced with a dict-compatible store (so the three consumer routers needed no changes) that
is LRU-bounded and optionally Postgres-backed. It degrades to memory-only if no database is
configured, which keeps offline operation intact.

### 4.7 Documentation and setup were broken

- `README.md` claimed "6 instrument datasets across 4 NASA missions" against 3 synthetic
  grids; the same claim appeared in the API description rendered publicly at `/docs`
- The documented backend start command **failed outright** —
  `ImportError: attempted relative import with no known parent package`
- Data grids were gitignored and the quickstart omitted generation, so a fresh clone could
  not run
- `backend/utils/provenance.py` was documented but did not exist

All corrected and verified. Grids are committed, `scripts/bootstrap.py` added, and the
working start command (`uvicorn backend.main:app` from the repository root) is documented.

### 4.8 The test suite concealed its own failure mode

In a clean checkout the suite reported `16 passed, 24 skipped, 7 errors` — over half the
tests silently vanished when data was absent, so a CI run would look broadly green while the
entire data layer was missing. A performance test also sat within 7% of its threshold and
failed on most full-suite runs. Both addressed; the suite is now deterministic.

---

## 5. Challenge Contract Compliance

| Requirement | Weight | Status | Evidence |
|---|---|---|---|
| **Real/verified NASA open data** | **Mandatory** | **Met** | 5 products, `VERIFIED_SNAPSHOT` |
| **Multi-mission integration** | **Mandatory** | **Met** | 4 missions, enforced in code |
| Layered Mars map | Required | **Met** | 9 layers, 7 renderable |
| Specific location/route focus | Required | **Met** | Jezero Crater, route-centric |
| Safety-relevant information | Required | **Met** | Hazard, slope, traversability |
| Science target identification | Required | **Met** | CRISM mineralogy + 10 targets |
| Route planning/optimization | Strong | **Met** | Multi-objective A* |
| Multi-objective trade-offs | Strong | **Met** | 4 strategies + Pareto analysis |
| Evidence/provenance | Strong | **Met** | Per-segment counterfactuals, provenance API |
| Scenario comparison | Moderate | **Met** | Compare Scenarios view |
| Environmental conditions | Moderate | **Partial** | THEMIS thermal proxy; MCS unavailable |
| Uncertainty visualization | Moderate | **Partial** | No-data and classification surfaced |
| AI/ML-driven intelligence | Moderate | **Not met** | Planned — see §7 |
| Mission report export | Nice-to-have | **Not met** | Planned — see §7 |

Both mandatory requirements and all three Strong requirements are met.

---

## 6. Deployment Readiness

Target: **Render free tier** (hosting) + **Supabase free tier** (database/storage).

### Configuration in place

- **`render.yaml`** — API as a Web Service; frontend as an always-on free **Static Site**, so
  the UI loads instantly even while the API is cold. Verified: the production build classifies
  every route as `○ (Static)`.
- **Dependency split** — production is 7 packages. `rasterio`/GDAL, `scipy` and `Pillow` moved
  to `requirements-pipeline.txt` (developer-only). Verified that no pipeline module reaches
  the server import graph.
- **CORS** reads from configuration, so adding the deployed origin is an environment variable
  rather than a code change.
- **Zero-computation demo path** — `/api/v1/routes/demo` is served from a committed
  precomputed file.

### Constraints this design accommodates

| Constraint | Accommodation |
|---|---|
| Ephemeral filesystem | Nothing generated at runtime; grids committed, tiles pre-rendered |
| 512 MB RAM | Minimal production dependencies; single worker; ~5 MB of grids |
| 0.1 shared CPU | Precomputed demo route; LRU-bounded store |
| 15-min spin-down | Computation store optionally persisted to Postgres |
| 750 instance-hours/month | ≈744 h in a 31-day month — enable any uptime pinger only shortly before the event |
| Supabase 7-day pause | A project left idle will be asleep on demo day — verify beforehand |

### Measured performance

| Measurement | Result |
|---|---|
| 4-strategy route computation (desktop) | 2.1–2.9 s per strategy |
| Full test suite | 59 passed in ~20 s |
| Tile pyramid | 8,185 PNGs, 127 MB (fits Supabase Storage's 1 GB) |
| Committed data grids | 9 arrays, ~3 MB |

**Open risk:** route computation has not been measured on the actual 0.1 CPU instance. A
conservative 5–10× degradation puts worst-case computation in the tens of seconds, before a
~50 s cold start. The demo path avoids computation entirely; interactive planning may need
route caching.

---

## 7. Remaining Work

**Blocking deployment (requires account access):**
1. Create the Render services and Supabase project
2. Set `FRONTEND_URL`, `NEXT_PUBLIC_API_URL`, `DATABASE_URL`
3. Measure cold-start and route-compute time on the real instance
4. Move the 127 MB tile pyramid to Supabase Storage — Render's filesystem is ephemeral, so
   tiles served from the instance disappear on redeploy

**Feature work:**
5. **AI/ML intelligence** (Moderate, unmet) — unsupervised terrain classification over the
   real MOLA/THEMIS/CRISM feature stack, fitted offline so scikit-learn never ships to
   production; plus an LLM mission-briefing generator grounded strictly in structured route
   data. Both as advisory layers over the preserved A*/Pareto core.
6. **Mission report export** (Nice-to-have, unmet) — deliberately scheduled late.
7. **Environmental data** — consider Mars 2020 MEDA (real in-situ Perseverance weather,
   NASA-hosted, 1750+ sols) in place of the unavailable MCS gridded product.
8. **Uncertainty visualization** — extend the existing no-data and classification signals
   into an explicit confidence overlay.

---

## 8. Closing Assessment

The project's central weakness at the start of this assessment was that a well-engineered
routing core sat on entirely synthetic data, failing the challenge's binding requirement while
its documentation claimed otherwise. That is resolved: five real NASA products across four
missions, with per-cell provenance and a compliance condition the code enforces rather than
asserts.

The engineering is now matched by its inputs. The non-negative cost formulation, the
admissible heuristic, the Pareto frontier and the counterfactual evidence decomposition are
genuine, and a dimensional bug that had inverted the headline trade-off has been found and
fixed. The interface is wired, honest about what it does not know, and visually aligned with
the agreed direction.

Two things are worth saying plainly. First, the remaining unmet requirements are both
non-mandatory, and the path for each is clear. Second, the work that most needs doing next is
not a feature but a measurement: nothing has yet run on the actual deployment hardware, and
the free tier's constraints are tight enough that the first honest numbers from a live
instance should be treated as a gate, not a formality.

---

*Prepared from static audit plus executed verification of the test suite, production build,
data ingestion, route invariants and live API endpoints. 8 October 2026.*
