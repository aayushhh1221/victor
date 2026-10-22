 # VICTOR coding-agent implementation plan

**Status:** Approved planning specification; code changes are not part of this document.  
**Inputs:** `docs/AUDIT_REPORT_20261021_203212.md`, the existing map-first handoff, and direct current-worktree evidence.  
**Goal:** Make VICTOR scientifically truthful, functionally safe, and usable on phone, tablet, and desktop without inventing data or weakening its offline-first architecture.

## 1. Mandatory operating rules

1. Read this plan, the audit, `AGENTS.md` if present, `README.md`, `frontend/package.json`, `backend/requirements.txt`, `render.yaml`, and the current source/diff before editing.
2. The worktree is already dirty. Preserve every pre-existing change. Do not reset, checkout, discard, overwrite, delete, or reformat unrelated files.
3. Use the existing stack: Next.js 14, FastAPI, NumPy grids, Leaflet with `L.CRS.Simple`, and the existing typed frontend API layer. Do not introduce a new map, state-management, UI, chart, auth, queue, database, or data-provider dependency without a documented blocker and approval.
4. Do not download or contact NASA/PDS, tile CDNs, databases, deployments, credentials, or any external service during the initial implementation unless the task owner explicitly authorizes the source-verification/enrichment phase.
5. Never manufacture a number to fill `null`, unavailable, missing, modelled, or unverified data. Preserve a typed state of measured, derived, modelled, unavailable, or invalid all the way to the UI.
6. VICTOR is an independent NASA Space Apps Challenge project. Never imply NASA endorsement, ownership, mission-operations approval, or that an inferred/derived value is a NASA measurement.
7. Follow phase order. A later phase cannot merge until all its prerequisite acceptance checks pass.
8. Make small, reviewable changes and add tests with the behavior being changed. Record exact files, commands, exit codes, and unverified checks at the end of every phase.
9. Stop and ask rather than silently choosing any of these product rules: EVA one-way vs round-trip budgeting/reserve; the operational role of science score; source/product choice for data enrichment; whether full-resolution imagery may be bundled; database/cache migration policy; target performance SLOs.

## 2. Baseline and non-negotiable release gates

### Baseline commands

Run only with dependencies already installed:

```powershell
python -m pytest backend/tests -q
```

From `frontend`:

```powershell
npm run lint
npm run build
```

Record the current result before changing anything. The last audit observed 72 passed / 4 skipped backend tests and successful frontend build/lint invocation; re-run rather than assuming that remains true.

### Non-negotiable gates

- No route response may exceed a declared effective mission budget.
- No route may silently clamp, substitute, or begin/end at an unsafe/no-data cell.
- No cache/report/scenario may mix results from a different request or data/model manifest.
- No active scientific/geospatial source may be shown as NASA-only unless the local manifest proves allow-listed NASA/PDS provenance.
- No proxy/model/no-data value may render as a direct observation.
- No user-facing page may be clipped, require horizontal page scrolling, or lose keyboard access at required viewport sizes.
- Every clickable navigation/control must work, be disabled with a specific reason, or be absent.

## 3. Delivery order and dependency map

```text
P0 baseline and guardrails
  ├─ P1 local map coordinate/tile truth
  ├─ P1 layer authority and global-map source policy
  └─ P1 mission input, endpoint and EVA safety
       ├─ P1 scenario/persistence/cache correctness
       └─ P1 data manifest and NASA-only policy
            ├─ P2 evidence/report/content truth
            ├─ P2 landing and information architecture
            └─ P2 responsive/accessibility redesign
                 ├─ P2 ML rigor
                 └─ P2 performance/operational hardening
                      └─ release verification
```

Map and layer work remain first visual priorities. Safety and provenance gates must be completed before any route is presented as an operational recommendation.

## 4. Phase 0 — establish contracts and regression harness

**Objective:** Create a safe implementation baseline and make the decisions that code cannot safely infer.

**Files to inspect/change**

- `backend/models/domain.py`, `backend/models/schemas.py`
- `backend/services/route_engine.py`, `backend/services/scenario_engine.py`
- `backend/services/data_service.py`, `backend/services/computation_store.py`
- `frontend/src/types/index.ts`, `frontend/src/services/api.ts`
- `backend/tests/`, frontend test setup only if an existing compatible mechanism is available

**Required work**

1. Write a short architecture decision record or add a section to project documentation defining:
   - region input contract and error semantics;
   - one-way/round-trip EVA budget, reserve, time model, and uncertainty;
   - definition and bounds of each route weight;
   - source-state vocabulary: `MEASURED`, `DERIVED`, `MODELLED`, `UNAVAILABLE`, `INVALID`;
   - immutable data-run/manifest identity;
   - NASA/PDS allow-list policy and mandatory provenance fields.
2. Add test fixtures that use a small deterministic grid and manifest, so routing/data tests do not depend on live source retrieval.
3. Add a shared response metadata shape for `data_manifest_id`, `pipeline_version`, effective constraints, effective weights, and source state. Do not yet expose values the backend cannot calculate.

**Acceptance**

- Current baseline commands are recorded.
- Decision points are resolved by the owner or marked as stop gates.
- Existing dirty files remain untouched unless part of an approved focused change.

## 5. Phase 1 — repair local map coordinate and tile semantics

**Objective:** Render local Mars imagery/layers at correct coordinates and make missing tiles truthful.

**Primary files**

- `frontend/src/utils/marsProjection.ts`
- `frontend/src/components/map/MarsMap.tsx`
- `frontend/src/components/map/LayerControl.tsx`
- `backend/routers/map.py`
- `scripts/generate_tiles.py`
- focused backend/frontend map tests

**Implementation steps**

1. Make a single documented coordinate contract:
   - Leaflet zoom-0 world is 256 units;
   - generator uses `2 ** z` tiles per side, each 256 px;
   - CRS.Simple y-axis inversion and Jezero affine lat/lon conversion are explicit;
   - `LEAFLET_BOUNDS`, forward/reverse conversion, scale calculation, and tile-index helper share that source of truth.
2. Replace any use of 1024 as Leaflet zoom-0 world extent with 256. Do not alter Jezero latitude/longitude bounds just to improve appearance.
3. Configure actual generated zoom levels only: tile size 256, no wrapping, bounded view; align min/native/max zoom to the on-disk pyramid after inspecting it.
4. In `backend/routers/map.py`, return HTTP 404 for missing/invalid tiles. Do not serve a brown/opaque placeholder with HTTP 200. A future legitimate no-data raster must be a source-labelled transparent data layer, never a basemap substitute.
5. In `MarsMap.tsx`, model base-layer state explicitly: `loading`, `ready`, `error`, `no-base-layer`; attach tile load/start/error listeners; show an accessible compact status with real retry behavior only.
6. Correct imagery wording. Current tile generation reads the decimated `imagery.npy` grid; do not claim full-resolution interactive CTX tiles unless the pipeline actually retains and serves them.

**Required tests**

| Test | Expected result |
|---|---|
| Projection centre round trip | Mars -> Leaflet -> Mars preserves coordinates within documented tolerance. |
| Projection corners | Every region corner maps to the corresponding Leaflet bound. |
| Zoom-2 tile index | A centre point is within `0..3` in both tile axes. |
| Existing local tile | API yields `200 image/png`. |
| Missing local tile | API yields `404`, never a successful placeholder. |
| Tile failure UI | Controlled tile failure yields a labelled error state, not a flat/blank map. |

**Acceptance**

- Initial map shows real local imagery or a truthful error/no-data state.
- Markers, routes, labels, overlays, and click-to-coordinate conversion align.
- No client request targets a tile outside the generated local tile range.

## 6. Phase 2 — make map layers and global explorer truthful

**Objective:** Make backend metadata the only layer authority and remove non-NASA third-party map dependencies.

**Primary files**

- `backend/routers/map.py`
- `backend/services/data_service.py`
- `frontend/src/app/planner/page.tsx`
- `frontend/src/components/map/LayerControl.tsx`
- `frontend/src/components/map/MarsMap.tsx`
- `frontend/src/components/map/GlobalMarsMap.tsx`
- `frontend/src/services/api.ts`, `frontend/src/types/index.ts`

**Implementation steps**

1. Make `GET /api/v1/map/layers` return all layer fields the UI needs: stable ID, name, type, availability, unavailable reason, source state, source/product identity, native/display resolution, coverage, default opacity, ordering, and legend semantics.
2. Remove hard-coded `FALLBACK_LAYERS` or any equivalent availability assumption. The frontend starts in `pending`; after an API failure, it displays the real unavailable error and leaves unavailable controls disabled.
3. Retain overlays only when the API says they are available. Preserve server-provided classification and no-data conditions. CRISM gaps remain transparent/no-data, not negative mineral observations.
4. Define deterministic ordering: basemap, analytic raster overlays, reference geometry, route geometry, pins, interaction/evidence surface.
5. Expose an accessible checkbox/slider label and availability reason for every row. Only enable a control that has a renderer and a valid source.
6. Remove OpenPlanetary Carto from `GlobalMarsMap.tsx`; it violates the required NASA-only source policy. Do not replace it with another external provider. Until a locally bundled, manifest-backed NASA/PDS global layer exists, show an honest unavailable state and explain why.
7. For live NASA Trek URLs, decide with the owner whether externally fetched visual tiles are permitted. If not explicitly approved and manifest-backed, disable them too. Avoid runtime network dependency.

**Acceptance**

- Layer control data matches `/map/layers` exactly.
- Each available layer changes the map visibly and has a matching legend/source state.
- Backend-offline and unavailable-layer flows are clear and non-interactive.
- Global explorer causes no third-party tile request.

## 7. Phase 3 — route, coordinate, and EVA safety contract

**Objective:** Make core mission results correspond exactly to accepted inputs and constraints.

**Primary files**

- `backend/models/domain.py`
- `backend/models/schemas.py`
- `backend/utils/mars_geo.py`
- `backend/services/route_engine.py`
- `backend/routers/route.py`
- `backend/tests/test_mars_geo.py`, `test_route_engine.py`, `test_api.py`
- `frontend/src/app/planner/page.tsx`
- relevant planner/route panel components and type/API files

**Implementation steps**

1. Add Pydantic validation for finite coordinates and the exact grid's latitude/longitude extent. Do not use clamping for public-request validation.
2. Keep a separate internal clamp helper only where mathematically necessary and never use it to transform a user-requested route endpoint silently.
3. Before A*, validate start and destination grid cells for slope, traversability, data availability, and routeability. Return deterministic 422-style diagnostics that name which endpoint and condition failed.
4. Implement the owner-approved EVA contract:
   - compute per-edge or accumulated travel time using clearly documented inputs;
   - enforce required budget during search or reject an over-budget completed path;
   - model one-way/round-trip/reserve as specified;
   - include effective budget, estimate, reserve, and feasibility in the response/report.
5. Ensure scenario UI language says “constraint” only when engine enforcement exists. Do not call it oxygen/power consumables feasibility without an actual consumables model.
6. Add keyboard coordinate entry as a first-class alternative to clicking the map. Show accepted coordinates and backend validation feedback inline.

**Required tests**

- NaN/Infinity/out-of-region/edge coordinate handling.
- No silent endpoint mutation.
- Unsafe/no-data start and destination rejected.
- Feasible route accepted; over-budget route rejected/no-feasible-route.
- Response/report constraints exactly equal effective engine constraints.

**Acceptance**

- A 1-hour limit cannot return a 4.462-hour “feasible” route.
- A start cell over the requested slope limit cannot return a route.
- All client validation is advisory only; backend is authoritative.

## 8. Phase 4 — scenario, persistence, cache, and report consistency

**Objective:** Ensure an identical mission/data run is used by route, scenario, evidence, and report flows.

**Primary files**

- `backend/services/scenario_engine.py`
- `backend/services/computation_store.py`
- `backend/routers/route.py`, `backend/routers/scenario.py`, `backend/routers/report.py`
- `backend/models/schemas.py`
- `frontend/src/components/panels/CompareScenariosView.tsx`
- `frontend/src/components/panels/MissionReportView.tsx`
- persistence/scenario/API tests

**Implementation steps**

1. Either remove `weight_overrides` from public schemas/UI until implementation is real, or validate a closed set of override keys/ranges, pass them into route computation, and return effective weights. Never accept and ignore them.
2. Persist the validated full request, effective constraints/weights, route schema version, and immutable `data_manifest_id` with each computation. Rehydrate exactly; never fabricate a request from grid centre/defaults.
3. Treat old persisted records that lack required context as legacy/unavailable for scenario comparison rather than producing a comparison against invented defaults.
4. Include manifest/pipeline/model identity in cache keys. Existing entries without compatible identity must miss/recompute or return an explicit legacy state.
5. Include computation/request/manifest identity in mission reports and expose it to the frontend.

**Acceptance**

- Restart/rehydration preserves original endpoints and constraints byte-for-byte in normalized form.
- A changed grid/model manifest cannot return an older cache entry.
- An effective scenario weight is either visibly active and test-proven or impossible to submit.

## 9. Phase 5 — verified data manifest and NASA-only provenance policy

**Objective:** Prevent inaccurate verified-state claims and give every active datum a traceable lifecycle.

**Primary files**

- `backend/utils/provenance.py`
- `scripts/fetch_nasa_data.py`
- a new versioned cache-manifest schema/file and validation utility
- `backend/services/data_service.py`
- `backend/routers/environment.py`, `science.py`, `map.py`
- cache/data validation tests

**Implementation steps**

1. Define an atomic manifest for all required/optional arrays and factual auxiliary JSON: SHA-256, shape/dtype, units, CRS, source/product ID, data state, transform/version, generated time, coverage, native/display resolution, and pipeline version.
2. Write generated grids, provenance, metadata, and manifest to a staging location, verify hashes, then atomically publish the bundle. Do not mark partial output verified.
3. At DataService startup, validate array hashes and schema against the manifest before declaring `VERIFIED_SNAPSHOT`. Fail closed to `INVALID`/`UNAVAILABLE`, with a diagnostic safe for health/UI.
4. Create an allow-list policy requiring NASA/PDS origin for every active scientific, observational, geospatial, or ML data source. Derived records must list all input manifest IDs.
5. Remove published-literature science targets from active scoring/routing until an approved NASA/PDS-only replacement is available. Render science score as unavailable where no compliant source exists; do not synthesize a replacement.
6. Remove environment fallback constants. Promote MEDA values only after an approved local manifest contains product IDs, sol/time window, units, aggregation, applicability, missingness, and hashes; otherwise return null + reason.
7. Keep cached cache/data artifacts out of user edits and document how a new verified bundle is made.

**Acceptance**

- Tampered/missing/swapped cache artifacts cannot start in verified mode.
- The active science field has an allow-listed input chain or is unavailable.
- Environment UI never shows a number when its backing data is absent/unverified.

## 10. Phase 6 — evidence, reporting, content, and landing information architecture

**Objective:** Ensure every screen tells the truth about the current data/model state and gives users a coherent entry point.

**Primary files**

- `backend/services/evidence_engine.py`
- `backend/models/domain.py`, `backend/models/schemas.py`
- `backend/routers/report.py`
- `frontend/src/components/panels/EvidencePopup.tsx`
- `frontend/src/components/panels/StaticViews.tsx`
- `frontend/src/components/panels/CompareScenariosView.tsx`
- `frontend/src/components/panels/MissionReportView.tsx`
- `frontend/src/app/page.tsx`, `frontend/src/app/layout.tsx`

**Implementation steps**

1. Replace inferred mineral/material labels with typed evidence values:
   - THEMIS normalized night-IR remains a proxy with no false physical units;
   - CRISM measured summary indices, derived science score, modelled/no-data state, coverage, and source resolution are separate;
   - correct CRISM display/native resolution to manifest value (current local provenance says 181.1424 m, not 18 m).
2. Use backend manifest/source records to render provenance. Do not hard-code claimed instrument coverage, resolution, orbit, algorithm, or data-quality text in panels.
3. Correct or remove unsupported mentions of HRSC, Tobler, HiRISE contacts, NASA MEP development, and universal NASA authenticity. Use independent-project language.
4. Replace the root redirect with an accessible, responsive landing page that explains:
   - what VICTOR does;
   - Jezero study extent and current data state;
   - measured/derived/modelled limitations;
   - independent NASA Space Apps Challenge attribution;
   - a working CTA to `/planner`.
   Do not add invented metrics, testimonials, operator identities, or synthetic imagery.
5. Ensure direct/refresh entry to state-dependent panels gives an explicit empty state and planner CTA, not an implicit demo or crash.
6. Make print/report output use same manifest/request identity and truthful source labels as the web UI.

**Acceptance**

- Evidence cannot display a proxy/modelled/no-data item as a measurement.
- Every visible source claim comes from a validated response/manifest.
- Landing, methodology, about, scenario, report, environment, and data-source copy have no unsupported NASA affiliation or algorithm claim.

## 11. Phase 7 — responsive, touch, and accessibility implementation

**Objective:** Replace the fixed desktop shell with a mobile-first workspace without reducing desktop capability.

**Primary files**

- `frontend/src/app/globals.css`
- `frontend/src/app/planner/page.tsx`
- `frontend/src/components/common/Header.tsx`
- `frontend/src/components/common/InfoBar.tsx`
- `frontend/src/components/sidebar/Sidebar.tsx`
- `frontend/src/components/map/MarsMap.tsx`
- `frontend/src/components/panels/EvidencePopup.tsx`
- `RouteComparisonTable.tsx`, `RouteAnalysisView.tsx`, and all static/panel components

**Layout contract**

| Range | Required behavior |
|---|---|
| 0–639 px | One-column page; header compact menu; sidebar in a focus-managed drawer; inspector as bottom sheet; map retains tappable controls; panels stack; page scroll is allowed. |
| 640–1023 px | Collapsible side navigation; map/content priority; inspector collapses below or beside only when space permits. |
| 1024 px and above | Existing multi-column workspace may appear, but widths flex and content has a minimum usable map area. |

**Implementation steps**

1. Remove global `html, body { overflow: hidden; }` as layout policy. Scope scrolling/containment deliberately to map/panels and permit document scroll on small screens.
2. Replace structural fixed widths/heights (210 px sidebar, 360 px inspector, 220/240 px fixed panels, 320 px popup) with responsive tokens, min/max widths, grid/flex constraints, container queries, and viewport-safe sizing.
3. Provide header navigation that is usable without horizontal clipping: compact menu/drawer under mobile breakpoint, labelled buttons, focus return, Escape close.
4. Turn mobile inspector/evidence content into accessible dialog/bottom-sheet behavior: focus trap only when modal, close button label, safe-area padding, and non-obscured map interaction.
5. Convert interactive table rows into semantic buttons/links inside valid table cells; maintain keyboard selection and visible focus. Supply summaries/text equivalents for maps/charts.
6. Ensure controls meet pointer target, contrast, reduced-motion, keyboard, and screen-reader requirements. Do not rely on hover.
7. Test network loading/error/empty states at every layout class. The map, layer controls, route form, panels, reports, and print view all need responsive validation, not only the home/planner screen.

**Acceptance**

- No horizontal page scroll or clipped critical control at 320, 360, 375, 390, 412, 768, 1024, 1280, 1440, and 1920 CSS px.
- Portrait and landscape, keyboard-open, safe-area, touch, mouse, 200% zoom, and 400% reflow remain functional.
- Keyboard-only flow can open navigation, set coordinates, plan route, inspect evidence, change layers, compare scenarios, and close overlays.

## 12. Phase 8 — ML validation and transparent product positioning

**Objective:** Make terrain clustering reproducible and appropriately bounded, not falsely “best performing.”

**Primary files**

- `scripts/classify_terrain.py`
- new model-card/evaluation artifact path outside active cache until versioned
- data manifest definitions and ML tests
- terrain class API/UI/provenance surfaces

**Implementation steps**

1. State the task precisely: current K-means is unsupervised terrain grouping, not a validated hazard or mineral classifier.
2. Persist code/pipeline version, seed, feature definitions/units, scaler parameters, clustering configuration, input manifest ID, output label map, and evaluation results.
3. Quantify CRISM gap treatment separately; do not let median imputation masquerade as measured CRISM coverage.
4. Run spatially blocked validation, multi-seed/bootstrapped stability, and coverage-stratified diagnostics. Use an official NASA/PDS-only evaluation source only after approved source validation; otherwise avoid accuracy claims.
5. Present labels as exploratory clusters until evidence supports stronger semantics. Include a model card in source/report.

**Acceptance**

- A result can be reproduced from manifest and configuration.
- Published metrics have a defined dataset/split/method.
- UI explains classification and no-data limitations.

## 13. Phase 9 — performance, resilience, and deployment readiness

**Objective:** Avoid blocking backend behavior and establish measurable operation.

**Primary files**

- `backend/routers/route.py`, `backend/routers/scenario.py`
- `backend/services/route_engine.py`, `computation_store.py`
- deployment configuration and CI only after owner approval

**Implementation steps**

1. Benchmark current cold/cache-hit route computation with all strategies and realistic representative inputs before changing execution architecture.
2. Define p95/p99 latency, maximum queue time, memory, failure, and concurrency targets with the owner.
3. Move CPU-bound A* work behind an approved bounded process/executor or job model; do not leave synchronous multisecond work inside async request handling under load.
4. Add request timeout/cancellation semantics, server-side rate limits appropriate to deployment, cache observability, and manifest/cache mismatch metrics.
5. Add health/readiness data that reports validated bundle state without exposing sensitive internals.

**Acceptance**

- Load test meets agreed SLOs without event-loop starvation.
- Timeouts/cancellations and overload are explicit user states, not dropped/broken requests.
- Observability distinguishes cache hit/miss, invalid bundle, no feasible route, validation rejection, and compute failure.

## 14. Verification matrix and release procedure

### Automated suites

- Backend unit/API/persistence tests: route bounds, finite values, start/destination safety, EVA, scenarios, cache rehydration, manifest mismatch, missing environment/science data, tile status.
- Frontend type/lint/build plus browser workflows: landing, planner, map tiles, layer success/failure, coordinate entry, route errors/success, scenario/report, environment/source null state, explorer unavailable state.
- Data fixtures: checksum, CRS, units, resolution, coverage, source policy, partial publish, stale bundle.
- Accessibility: automated scan plus keyboard-only, NVDA/VoiceOver, focus, contrast, 400% reflow, reduced motion.
- ML: deterministic replay, artifact check, spatial validation, stability, coverage strata.
- Load: concurrent route/scenario requests, cold/cache-hit, cancellation, resource use.

### Manual viewport matrix

| Viewport | Test |
|---|---|
| 320 / 360 / 375 / 390 / 412 | Phone portrait/landscape, touch, keyboard open, drawer/sheet/map. |
| 768 / 1024 | Tablet portrait/landscape, panel transitions, chart/table overflow. |
| 1280 / 1440 / 1920 | Desktop workspace, map/panel minimum dimensions, print report. |
| 200% zoom / 400% reflow | No clipped content, focus remains visible, no two-dimensional page scroll. |

### Final release checklist

1. Re-run all baseline commands and all new tests.
2. Validate a clean fixture run, a deliberately invalid/tampered bundle, unavailable layers, no science data, no environment data, no feasible route, and API outage.
3. Capture browser network/console evidence for local tiles only; verify no third-party global tile request.
4. Validate current copy against active manifest and source policy.
5. Produce a completion report with changed files, exact commands/results, browser screenshots, data-manifest ID, model artifact ID, known limitations, and rollback/migration instructions.

## 15. Copy-paste task prompt for the coding agent

> You are implementing the VICTOR repository. Read `docs/VICTOR_CODING_AGENT_IMPLEMENTATION_PLAN_20261021.md` and `docs/AUDIT_REPORT_20261021_203212.md` completely before editing. Treat the current worktree as user-owned and dirty: preserve unrelated changes; never reset, checkout, delete, or overwrite them. Work phase by phase, beginning with the baseline. Maintain the existing Next.js 14 + FastAPI + Leaflet CRS.Simple stack; do not add dependencies, external map providers, fake data, NASA claims, or network downloads without explicit approval. Make no route look feasible unless the backend enforces its effective input constraints. Preserve measured/derived/modelled/unavailable/invalid data states. Stop and ask before choosing EVA reserve semantics, NASA/PDS source replacements, full-resolution imagery strategy, cache migration, or performance SLOs. For every completed phase, report exact changed files, behavior delivered, tests/commands with exit codes, browser/device proof if actually run, and remaining limitations. Do not claim a check that you did not run.
