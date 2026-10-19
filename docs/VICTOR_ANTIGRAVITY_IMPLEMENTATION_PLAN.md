# VICTOR — Antigravity Implementation Plan

> Owner: Google Antigravity implementation agent  
> Oversight: Codex audit and acceptance review  
> Created: 2026-10-17  
> Status: implementation specification; no application code is changed by this document.

## 1. Mission and non-negotiable product truth

VICTOR is an independent Mars mission-planning prototype for the NASA Space Apps Challenge. It is **not** an official NASA product and must never claim or imply NASA endorsement, programme ownership, mission-operation approval, or rover-operation validation.

The product helps a mission planner explore the Jezero Crater study region, select a start and destination, compare terrain-aware routes, inspect documented scientific evidence, and understand uncertainty. Its primary value is traceable decision support, not a decorative dashboard.

The implementation must preserve these distinctions everywhere:

| Kind of value | May be shown as | Must not be described as |
| --- | --- | --- |
| API value from a measured/ingested source | Source-attributed observation or metadata | A more precise or different measurement |
| API value derived from documented inputs | Derived estimate/proxy/model score | Direct NASA measurement |
| API `null`, unavailable layer, failed request | `—`, unavailable, or a concrete error state | A plausible fallback number or an enabled control |
| Reference mockup value | Visual/layout direction only | VICTOR data |

Examples that must **not** be hard-coded unless the corresponding API returns the value with provenance: `-63 °C`, `τ 0.38`, “Low to Moderate”, risk scores from the mockup, route distances, observation dates, or user/account identities.

## 2. Authoritative current facts to verify before editing

Do not treat older Markdown reports as source of truth. Re-check these facts in the working tree and record deviations in the final implementation report.

1. The frontend is Next.js 14 static export in `frontend/`; the backend is FastAPI in `backend/`.
2. The root route currently redirects to `/planner`; it needs to become a real landing page.
3. The map uses Leaflet with `L.CRS.Simple`, not React Leaflet.
4. Tile generation uses 256px tiles and creates `2 ** z` tiles per dimension at every zoom `z` from 1 through 5.
5. The frontend currently declares `TILE_EXTENT = 1024` at Leaflet zoom 0. This is incompatible with the generated pyramid and is the confirmed cause of the flat map.
6. The local backend has tile assets, and `/api/v1/map/layers` is the authoritative source for layer identity, availability, source, classification and default opacity.
7. `/api/v1/environment/current` intentionally returns null for temperature and dust when those values cannot be derived. The frontend must honour that.
8. The working tree is dirty. Preserve unrelated edits; do not reset, checkout, delete, or overwrite user work.

## 3. Mandatory operating protocol for Antigravity

### Before coding

1. Read `AGENTS.md` if present, repository instructions, package manifests, `frontend/.env.local`, `render.yaml`, the live audit addendum, and this plan.
2. Inspect the current diff before any edit. Treat all pre-existing changes as user work.
3. Start both services locally only when dependencies are already installed. Do not install packages, download data, call NASA services, or use credentials merely to diagnose the app.
4. Verify the map failure directly:
   - compare `backend/data/tiles/imagery/2/1/1.png` (real file) with `backend/data/tiles/imagery/2/8/8.png` (missing);
   - request both through the local API;
   - confirm the latter currently receives the brown placeholder as a success response.
5. Inspect installed design instructions before any UI implementation. Apply their requirements only where compatible with this specification; this specification wins on data truth, product claims and scope.

### During coding

- Work in the phase order below. Do not start visual redesign while Phases 1–3 have failing acceptance criteria.
- Make focused commits or clearly separated change groups per phase if the repository workflow permits. Never combine map math, landing content, and broad styling in one unreviewable rewrite.
- Use the existing semantic CSS tokens. Add named tokens when needed; do not scatter one-off colours or font declarations through components.
- Reuse existing backend contracts and typed API helpers. Do not invent client-side scientific data or duplicate server metadata.
- Do not add a map library, state-management library, chart library, authentication system, external map provider, or third-party data service unless this plan explicitly requires it and the existing stack demonstrably cannot do the job.
- If a necessary architectural choice cannot be resolved from the code and this plan, stop and request direction. Record the exact options, impact, and recommendation; do not silently guess.

### Completion evidence

For every phase, report:

1. exact files added/changed/deleted;
2. user-visible behaviour delivered;
3. commands run with exit codes;
4. screenshots or browser evidence when browser tooling is available;
5. known limitations and any unverified item.

## 4. Priority and dependency map

```text
P0 Map coordinate contract ─┐
                            ├─> P0 Map layer truth + tile status ─> P1 planner workflow
P0 tile-error semantics ────┘                                      │
                                                                    ├─> P1 landing page
                                                                    ├─> P1 route-based information architecture
                                                                    └─> P2 responsive, accessibility, polish
```

Do not reverse this order. A polished site with a fake or flat Mars map fails the product's primary job.

## 5. Phase 0 — Baseline and safeguards

### Objective

Establish a reproducible baseline without modifying behaviour.

### Inspect

- `frontend/package.json`, `frontend/next.config.mjs`, `frontend/.env.local`
- `backend/main.py`, `backend/routers/map.py`, `scripts/generate_tiles.py`
- `frontend/src/utils/marsProjection.ts`, `frontend/src/components/map/MarsMap.tsx`, `frontend/src/components/map/LayerControl.tsx`
- current source control diff and existing tests

### Required baseline commands

Run only with installed dependencies:

```powershell
python -m pytest backend/tests -q
npm run lint
npm run build
```

Run frontend commands from `frontend/` and tests from the repository root. Record missing-tool failures honestly; do not install packages during the baseline without explicit approval.

### Baseline acceptance

- Existing changes are identified but not overwritten.
- Current build/test results are captured.
- No product source is changed in this phase.

## 6. Phase 1 — Repair the Mars tile-coordinate contract (P0)

### Objective

Make Leaflet request exactly the tiles generated by the local pyramid so the CTX basemap and all supported raster overlays render at the correct position and zoom.

### Files expected to change

- `frontend/src/utils/marsProjection.ts`
- `frontend/src/components/map/MarsMap.tsx`
- `backend/routers/map.py`
- `backend/tests/` (new focused map/tile tests)
- frontend test configuration/files only if a small, maintainable test mechanism is necessary and approved by the project conventions

### Required implementation details

1. Define the coordinate convention in one place, with comments that distinguish:
   - a 256px Leaflet world at zoom 0;
   - the generator's `2 ** z` tile grid at zoom `z`;
   - Mars latitude/longitude affine mapping;
   - Leaflet's inverted vertical axis under `CRS.Simple`.
2. Change the frontend base coordinate extent from the generator's 1024px `z=2` image size to the actual Leaflet zoom-0 world size: **256 units**. Update all dependent functions, including:
   - `marsToPixel`;
   - `pixelToMars`;
   - `marsToLeaflet`;
   - `leafletToMars`;
   - `LEAFLET_BOUNDS`;
   - scale-bar distance conversion.
3. Do not change Jezero geographic bounds solely to make the image look better. The geographic extent remains the region reported by the backend until a separate source-backed region model is introduced.
4. Keep Leaflet tile configuration aligned with generator bounds:
   - `tileSize: 256`;
   - `minZoom: 1` and `maxZoom: 5` only if the on-disk pyramid contains those levels;
   - `bounds: LEAFLET_BOUNDS` and `noWrap: true`;
   - configure native max zoom only when verified against actual tile assets.
5. Replace the current missing-tile behaviour in `backend/routers/map.py`:
   - a tile absent because the path is invalid/missing must yield an explicit `404` response;
   - do not return an opaque brown image with HTTP 200;
   - do not silently substitute a generic placeholder for a broken request;
   - if a legitimate no-data raster is later needed, provide it as a source-labelled, transparent overlay with clear metadata, not as a basemap fallback.
6. In `MarsMap.tsx`, register Leaflet `tileloadstart`, `tileload`, and `tileerror` events for the active base layer. Maintain a small explicit render-state model, at minimum:
   - `loading` while the chosen basemap is loading;
   - `ready` after one or more expected base tiles load with no terminal error;
   - `error` if all requested basemap tiles fail or a source endpoint is unreachable;
   - `no-base-layer` when the authoritative layer response exposes no usable basemap.
7. Render a compact in-map status element for `loading`, `error`, and `no-base-layer`. It must name the affected layer and offer a retry only when retry has an actual handler. It must not obscure route selection or map controls.
8. Preserve interaction behaviour after the projection fix: clicking the map must return valid Mars coordinates, start/destination pins and routes must align with imagery, and existing route evidence clicks must still work.

### Required tests

Add deterministic coverage for these invariants:

| Test | Expected result |
| --- | --- |
| Mars centre round trip | `marsToLeaflet` then `leafletToMars` returns the same coordinate within documented floating-point tolerance. |
| Corner mapping | each region corner maps to the corresponding `LEAFLET_BOUNDS` corner. |
| Initial zoom tile range | a centre point at zoom 2 maps into valid tile coordinates `0..3` for the generated 4x4 `z=2` pyramid. |
| Existing tile endpoint | a known valid image tile returns `200 image/png`. |
| Missing tile endpoint | a known absent tile returns `404`; it must not return a valid-looking tile. |
| Tile error UI | mocked/controlled tile failure produces an accessible error status rather than a blank or brown map. |

Use a small pure utility for tile-index calculations if needed so the coordinate test does not depend on a browser-only Leaflet runtime. Do not hard-code a browser test around incidental DOM structure.

### Phase acceptance criteria

- Initial planner view displays real CTX pixel content, not the brown `No data` asset.
- The API no longer marks absent tiles as successful imagery.
- At zoom 2, every client-requested in-bounds base tile exists in the generated `z=2` directory.
- Base imagery, terrain, elevation, thermal, hazard, science, composition, terrain class and confidence overlays align with markers/routes.
- All Phase 1 tests, build, lint and backend suite pass.

## 7. Phase 2 — Make map layers authoritative, usable and honest (P0)

### Objective

Ensure the layer panel exactly reflects the backend's data availability and that controls produce visible, source-traceable map changes.

### Files expected to change

- `frontend/src/app/planner/page.tsx`
- `frontend/src/components/map/LayerControl.tsx`
- `frontend/src/components/map/MarsMap.tsx`
- `frontend/src/types/index.ts` only for additive, strongly typed map-render state if necessary
- `frontend/src/services/api.ts` only for additive helpers if necessary

### Required implementation details

1. Remove `FALLBACK_LAYERS` as a source of availability. The frontend must never declare a scientific layer available just because a hard-coded array says so.
2. Start raster-layer state empty or explicitly `pending` until `GET /api/v1/map/layers` resolves. Avoid the current contradiction where comments say the state is empty but the planner enables imagery before metadata arrives.
3. On a successful authoritative response:
   - create layer state from exactly that response;
   - preserve a user-adjusted visibility/opacity value when the same layer is refreshed;
   - enable the first available basemap in this order: `imagery`, then `terrain`;
   - do not auto-enable a science, risk, composition or confidence overlay.
4. On a failed authoritative response:
   - display the existing layer-list unavailable state with the actual error message;
   - do not show selectable fake controls;
   - set map state to `no-base-layer` or `error` as applicable.
5. Render layer rows from all fields returned by the API:
   - name;
   - source;
   - classification (`MEASURED`, `DERIVED`, `MODELLED`, or missing);
   - description;
   - available/unavailable state and reason;
   - current opacity when visible.
6. Retain a disabled MCS dust-activity row when the API returns it unavailable. The UI may show its reason, but must not synthesize dust tiles or dust readings.
7. Distinguish layer types:
   - `tile`: creates/removes a Leaflet tile layer;
   - `polyline`: manages the Perseverance reference line;
   - future types: remain disabled/unrendered unless a deliberate renderer is implemented.
8. Provide accessible native checkbox and slider labels. Each unavailable checkbox must be disabled and programmatically associated with its precise reason. Keep visible focus indication.
9. Preserve overlay order deliberately: base imagery/terrain at bottom, then analytic overlays, then route/reference geometry, then pins/labels/interactive segments. Document the ordering in code.
10. Add a small legend only for active overlays that require a legend. A legend must use the same range/classification as the renderer; do not invent colour meanings.

### Visual behaviour rules

- CTX imagery is a grayscale/decimated local basemap unless its asset pipeline is upgraded; do not recolour it to mimic an unrelated Mars photo.
- Composition gaps are data gaps, not “no mineral” areas; keep their intended transparency.
- A fully opaque analytic overlay must never hide the base imagery by default.
- Each active layer must visibly change the map. If it cannot, mark the issue as a bug and do not call the control complete.

### Phase acceptance criteria

- Panel row count, names, sources, classifications and availability match `/api/v1/map/layers` exactly.
- Each available layer can be toggled and opacity-adjusted, with immediate visible effect.
- An unavailable API source cannot be toggled.
- Stop the backend: the panel and map display explicit unavailable states, not “working” controls or a flat map.
- Restart the backend: layer metadata loads and a valid base layer appears without a page refresh race.

## 8. Phase 3 — Stabilise the core mission-planner workflow (P1)

### Objective

Make the working map the centre of an understandable, resilient end-to-end workflow.

### Files expected to change

- `frontend/src/app/planner/page.tsx`
- `frontend/src/components/map/MarsMap.tsx`
- `frontend/src/components/common/InfoBar.tsx`
- existing route, comparison, evidence and science panel components as needed

### Required workflow

1. User opens `/planner` and sees a loaded map or a truthful loading/error state.
2. User selects “start”, then clicks a valid location; coordinate is displayed in an accessible textual control as well as a pin.
3. User selects “destination”, then clicks a valid location.
4. “Plan Route” remains disabled until both points are valid and shows a named loading state while computing.
5. On success, show strategy alternatives and make one active strategy clear. On API failure or no path, show the backend error without fabricating an alternative.
6. Active route, pins, scale and geographic labels remain visible over layers.
7. Selecting a route segment opens the evidence inspector. It must identify strategy, segment, source classification and whether a value is measured, derived or modelled.
8. Clear/reset returns the planner to a defined state without leaving stale layers, route data, or evidence drawer contents.

### Scientific honesty repairs

1. Restore `InfoBar` behaviour so API `null` temperature/dust fields render `—` and an explanation from `environment.notes`; mark them unavailable.
2. A THEMIS night-IR thermal proxy may be displayed as a unitless proxy only. It is not a Celsius measurement.
3. Keep science priority visibly labelled as a model score when shown in maps, cards or charts.
4. Correct all product wording to “NASA Space Apps Challenge entry/project” or equivalent accurate language. Do not call VICTOR part of the NASA Mars Exploration Program, NASA-owned, or officially NASA branded.

### Phase acceptance criteria

- A planner can complete the eight-step workflow above with the local backend.
- No displayed environment metric is invented when the API says `null`.
- Every route/chart/risk/science value traces to a known response field or is labelled unavailable.
- The core planner has no console errors and no dead action controls.

## 9. Phase 4 — Build a proper public landing page (P1)

### Objective

Replace the root redirect with a credible product landing page that prepares a visitor to enter the planner without pretending the project has capabilities or endorsements it does not have.

### Primary visitor and job

- **Visitor:** hackathon judge, planetary-science reviewer, collaborator or prospective mission-planning user.
- **Job:** understand what VICTOR does, what data supports it, its limitations, and how to start the planner.
- **Primary action:** enter `/planner`.

### Files expected to change/add

- `frontend/src/app/page.tsx`
- `frontend/src/components/landing/` (new, composable sections)
- `frontend/src/app/globals.css` or existing token/component styles (additive only)
- shared header/footer components if required

### Required landing-page content, in this order

1. **Header:** VICTOR identity, concise independent-project/Space Apps Challenge attribution, navigation to real routes, and a primary “Open mission planner” link.
2. **Hero:** plain-language product statement. Use a geographic/mission-planning visual only if it comes from the repository or a properly attributed source; otherwise use the existing real map surface as the visual focal point, not synthetic Mars imagery.
3. **Operational story:** Start → analyse terrain/data layers → compare routes → inspect evidence. Use real product interactions/copy, not invented quantitative claims.
4. **Evidence and provenance:** name actual source families presently supported by the repository (MOLA, THEMIS proxy, CTX, CRISM, plus derived/modelled outputs) and explain the measured/derived/modelled distinction.
5. **Scope and limitations:** Jezero study region, prototype status, no operational validation, unavailable atmospheric data handled explicitly.
6. **Planner call to action:** a second link to `/planner`.
7. **Footer:** real internal navigation, methodology/data-source routes, concise attribution and no false NASA affiliation.

### Design direction

- Use the reference image for hierarchy—light, calm, mission-operations readability—not its fake data, exact visual assets or NASA affiliation.
- Use a restrained science/operations visual system: clear white/near-white surfaces, dark readable text, one disciplined blue action colour, data encodings kept distinct, thin borders, dense but breathable layouts.
- Do not use generic “AI” gradients, fake browser frames, stock astronaut photos, decoration that competes with data, marketing metrics, testimonials or partner logos without evidence.

### Landing-page acceptance criteria

- `/` is statically exported and no longer redirects.
- Every header/footer navigation target exists and is meaningful.
- The page contains no fabricated measurement, performance claim, testimonial, partnership or NASA endorsement claim.
- Desktop and mobile layout is readable, keyboard navigable and has no horizontal scroll.

## 10. Phase 5 — Establish durable information architecture and relevant pages (P1)

### Objective

Replace planner-only view switching with meaningful static routes while reusing existing working components and maintaining mission context across client-side navigation.

### Route inventory

| Route | Visitor job | Existing material to reuse | Required no-data/direct-entry state |
| --- | --- | --- | --- |
| `/` | Understand VICTOR and enter planner | New landing components | Not applicable |
| `/planner` | Set endpoints and compute routes | Current planner map shell | Map/API unavailable state |
| `/explorer` | Explore layers and regional context | `MarsMap`, layer controls | Explain no data/selected layer state |
| `/layers` | Understand and manage data layers | `LayerControl`, provenance | Authoritative layer error/loading state |
| `/analysis` | Compare route profile, risk and evidence | `RouteAnalysisView`, comparison/evidence | “Compute or load a route in Planner” CTA |
| `/science` | Inspect route-adjacent science opportunities | `ScienceOppsView` | Model-score caveat; planner CTA if no route |
| `/scenarios` | Compare constraint changes | `CompareScenariosView` | Planner CTA if no base computation |
| `/report` | Read/export mission report | `MissionReportView` | Planner CTA if no computation |
| `/environment` | Read available environmental context | `EnvironmentalView` | Explicit unavailable values with sources |
| `/data-sources` | Audit sources, provenance and coverage | `DataSourcesView` | Source-list error state |
| `/methodology` | Understand routing and limits | `MethodologyView` | Not applicable |
| `/status` | See system/data health | `SystemStatusView` | Health-check error state |
| `/about` | Product scope and disclaimer | `AboutView` | Not applicable |

### Routing and state implementation constraints

1. Keep `/planner` as the only computation-control surface; supporting pages are analysis/read surfaces, not duplicate planners.
2. Create real App Router pages for the inventory above. Do not use decorative navigation that merely changes a highlighted tab.
3. Extract reusable application state into a client-side provider mounted in a shared layout or shell. It must preserve, at minimum:
   - start and destination;
   - mission constraints;
   - layers and active strategy;
   - route computation/result ID and result;
   - science targets;
   - region, health and environment responses with loading/error state.
4. Do not persist scientific result data to local storage unless the project explicitly designs and documents a versioned, expiry-aware format. In-memory state is sufficient for first implementation.
5. Directly opening a state-dependent route after a refresh must show an honest empty state and a link to `/planner`; it must not reconstruct an unknown computation or display stale mock values.
6. Build shared navigation from one route-definition data structure so header, sidebar, footer and mobile menu cannot drift.
7. Remove the old `mainView` routing state only after all route replacements are wired and tested. Do not maintain two competing navigation systems.

### Page-specific requirements

- **Explorer:** map-first, with coordinate display, visible selected layer legend and source note. No route-computation controls outside the planner.
- **Layers:** explain each layer’s source, classification, resolution/coverage caveat and current availability. Use backend response rather than a hard-coded catalogue.
- **Analysis:** elevation/profile/risk visualisations must derive from selected route segments. If absolute elevation cannot be derived, say so; do not draw a fake curve.
- **Science:** prioritise source-aware cards and route proximity; clearly label modelled score/derived context.
- **Scenarios:** show base/modified constraints, changes by strategy, and missing-state guidance.
- **Report:** only offer export when a valid computation exists. A report must include provenance and limitations.
- **Environment:** distinguish thermal proxy from temperature and unavailable dust/pressure from zero.
- **Data sources/methodology:** accessible reference pages with direct source descriptions, CRS, region coverage, transform/model caveats and retrieval metadata supplied by the API/cache.
- **System status:** show API/reachability/data mode/store limitation from `getHealth`; never infer “operational” from a loaded frontend.

### Phase acceptance criteria

- Every navigation item resolves to one of the above static routes.
- Every route provides a meaningful direct-entry, loading, success and error/no-data state appropriate to its job.
- Existing planner capabilities—route strategies, scenario comparison, evidence and report export—remain reachable.
- `npm run build` reports every route as static-compatible.

## 11. Phase 6 — Design system, responsive behaviour and accessibility (P2)

### Objective

Make the repaired product feel coherent and reliable on desktop, tablet and mobile without compromising map usability or provenance.

### Design-system requirements

1. Preserve the existing light/dark semantic token structure. Consolidate only after identifying current token usage; do not replace it wholesale.
2. Put any new colour, shadow, typography and spacing values behind semantic names. Data colours may remain distinct encodings but must be documented and contrast-checked.
3. Remove raw inline map-label typography/colour declarations where a token/class can express them without breaking Leaflet’s rendering model.
4. Use a maximum of two font roles plus a monospace data role. Verify loaded font files/imports; do not add a web font solely for style.
5. Keep the map visually primary. Panels support the map rather than creating a generic analytics-dashboard grid.

### Responsive topology

| Width | Required planner layout |
| --- | --- |
| 1280px and up | Persistent sidebar, map as largest surface, docked layers/analysis panel. |
| 768–1279px | Collapsible secondary panels; map remains the primary area; no compressed unreadable three-column strip. |
| 414–767px | Single-column shell; map has a practical minimum height; layer/analysis panels open as drawers or sections; full controls remain reachable. |
| 320–413px | Same hierarchy with no horizontal page scroll, no clipped primary controls, and tappable map-adjacent controls. |

### Accessibility requirements

- Semantic landmarks: header, nav, main, complementary panels, footer.
- Exactly one page `h1`; logical heading order on all routes.
- Native buttons/inputs where possible; names and states for icon controls.
- Visible `:focus-visible` treatment using tokens.
- Keyboard alternative for setting coordinates: editable latitude/longitude inputs with validation and an “apply coordinate” action. Map click alone is insufficient.
- Error and loading state changes announced through an appropriate live region without over-announcing map tile events.
- Layer checkbox, slider and disabled-source reason are programmatically associated.
- Verify text/control contrast; do not call WCAG compliance complete without measured/browser verification.
- Respect `prefers-reduced-motion`; motion must never be needed to understand a state change.

### Phase acceptance criteria

- Test 320, 375, 414, 768, 1024 and 1440px viewports.
- No page-level horizontal scroll; essential controls are not hidden behind fixed panels.
- Keyboard-only user can navigate, select layer controls, enter coordinates, run a route and reach evidence/content panels.
- No contrast, heading, label or focus regressions in the final accessibility scan.

## 12. Phase 7 — Verification, delivery and acceptance review (P0 release gate)

### Required verification order

1. Run targeted coordinate/tile tests.
2. Run complete backend tests: `python -m pytest backend/tests -q`.
3. Run frontend lint: `npm run lint`.
4. Run frontend production build: `npm run build`.
5. Run the application locally with backend and frontend together.
6. In a browser, inspect:
   - console errors;
   - network requests for initial tiles and toggled overlays;
   - an intentional missing tile response;
   - planner workflow;
   - direct-entry empty states;
   - desktop and mobile widths;
   - keyboard focus and controls.
7. Capture screenshots only after the functional pass; include landing, working planner with imagery/layers, mobile planner, analysis and sources/status.
8. Run the configured UI-quality detector once over changed UI files. Review each finding in context; do not suppress it blindly.

### Release-blocking conditions

Do not declare the work complete if any of these remain true:

- Map shows brown placeholder/no-data tiles as the normal base layer.
- A layer is enabled without backend confirmation that it exists and is renderable.
- API `null` values appear as measured temperature, dust, pressure or risk data.
- Site claims VICTOR is an official NASA/Mars Exploration Program product.
- A visible navigation item is dead, decorative or shows fabricated content.
- Core planner has a console error, uncaught failed request or inaccessible primary action.
- Build, lint or relevant tests fail.

## 13. Explicit out of scope unless separately approved

- New live NASA/PDS integrations, API keys, external tile providers or data downloads.
- 3D terrain, global Mars coverage, user authentication, user profiles, collaboration, payments or notifications.
- Replacing Leaflet, FastAPI, the routing engine or storage architecture.
- Claims that a prototype route is validated for real rover/EVA operations.
- Synthetic “NASA-like” imagery, fake thumbnails, fake scientific charts, fake user avatars, fake search, or decorative controls with no action.

## 14. Final handoff format required from Antigravity

Use this exact outline:

1. **Outcome:** concise summary of delivered user-visible behaviour.
2. **Map proof:** initial tile request examples, working layer list, missing-tile behaviour, screenshots/browser evidence.
3. **Files:** created, changed and deleted files with reasons.
4. **Data/provenance:** exact sources/values shown, unavailable data retained, claim/disclaimer changes.
5. **Verification:** commands, results and browser checks.
6. **Known limitations:** only verified remaining limitations.
7. **Runbook:** exact local commands and any configuration values needed.

