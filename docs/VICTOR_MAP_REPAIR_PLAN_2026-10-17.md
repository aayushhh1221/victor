# VICTOR — Approval-Gated Map Repair Plan

> Based only on the live audit supplement dated 2026-10-17.  
> Status: **Awaiting explicit approval. No application code has been changed.**

## Objective

Restore a geographically appropriate, interactive Jezero basemap and make every layer control accurately represent what is loaded. Preserve the existing FastAPI API, Leaflet engine, local/offline data model and route overlays; do not replace the mapping stack.

## Phase 1 — Repair the tile-coordinate contract

### Affected files

- `frontend/src/utils/marsProjection.ts`
- `frontend/src/components/map/MarsMap.tsx`
- `backend/routers/map.py`
- New focused tests for tile-coordinate and missing-tile behaviour

### Implementation steps

1. Treat the generator's pyramid as a normal Leaflet tile pyramid: one 256px world at zoom 0; 2x2 at zoom 1; 4x4 at zoom 2.
2. Update the frontend CRS coordinate extent and every dependent conversion/scale calculation so a region centre at Leaflet zoom 2 resolves to valid `z=2/x=1..2/y=1..2` tiles.
3. Keep the Mars geographic extent and coordinate transformations explicit; validate coordinate round trips before and after the change.
4. Change the missing-tile endpoint from a successful opaque brown placeholder to an explicit not-found response (or a truly transparent, explicitly signalled no-data tile only when coverage is knowingly absent). Do not mask transport or coordinate errors as map content.
5. Add `tileerror`/load-state handling to `MarsMap`: surface a concise in-map status explaining whether imagery is unavailable, the API cannot be reached, or no coverage exists. Offer retry only when it is actionable.

### Acceptance criteria

- At initial zoom, every requested CTX image tile exists in the generated `z=2` directory.
- The map shows image detail rather than brown placeholder pixels.
- Toggling terrain, elevation, thermal, hazard, science, composition, terrain-class and confidence layers changes the visual output at their configured opacity.
- A deliberately missing tile is visible to diagnostics and does not silently look like a valid basemap.
- Geographic coordinate click-to-place, route paths, scale bar, labels and markers remain aligned with imagery.

### Risks and mitigation

| Risk | Mitigation |
| --- | --- |
| CRS change shifts markers/routes | Add projection round-trip and expected tile-index tests; verify a known Jezero coordinate visually. |
| Tile provider returns different out-of-range semantics in deployment | Test API-served tiles and the configured object-storage URL separately. |
| A missing tile becomes visually noisy | Use a compact map status indicator, not a full opaque placeholder across the map. |

## Phase 2 — Make layer state truthful and resilient

### Affected files

- `frontend/src/app/planner/page.tsx`
- `frontend/src/components/map/LayerControl.tsx`
- `frontend/src/components/map/MarsMap.tsx`

### Implementation steps

1. Start with no active raster layers until the authoritative `/api/v1/map/layers` response resolves.
2. Remove the hard-coded `FALLBACK_LAYERS` availability catalogue. Retain a clear loading skeleton and the existing unavailable/error presentation.
3. Enable the first backend-confirmed base layer after metadata arrives; preserve user selections thereafter.
4. Add an explicit connection/data state near the map so a stopped backend cannot be confused with a rendered Mars surface.
5. Keep all slider and checkbox semantics keyboard-accessible and associate any disabled state with its source-specific reason.

### Acceptance criteria

- With the backend stopped, no fictitious layers are marked available; the map explains the unavailable state.
- With the backend running, the panel contains exactly the layer records the endpoint reports and controls change map output.
- Dust activity remains disabled until a real ingestible source exists.

## Phase 3 — Restore scientific and product-identity integrity

### Affected files

- `frontend/src/components/common/InfoBar.tsx`
- `frontend/src/components/common/Header.tsx`
- `frontend/src/components/panels/StaticViews.tsx`
- Any accompanying product attribution component/assets if needed

### Implementation steps

1. Restore unavailable display states for temperature and dust when the API supplies `null`; carry the endpoint's explanation in a tooltip/help text.
2. Keep actual THEMIS thermal-proxy values labelled as a proxy, never as degrees Celsius.
3. Replace wording that presents VICTOR as a NASA Mars Exploration Program product with accurate independent-project / Space Apps Challenge language.
4. Retain source attribution but avoid suggesting NASA endorsement.

### Acceptance criteria

- No visible environmental value is absent from the corresponding API response.
- NASA sources are cited accurately without a NASA-program ownership or endorsement claim.
- Existing data-mode and model-score caveats remain intact.

## Phase 4 — Verify core experience and refine only after it works

### Affected areas

- Planner map shell, panels and responsive CSS
- Optional new frontend test harness only if the existing toolchain cannot express the contract tests

### Implementation steps

1. Check the repaired planner at desktop plus 320px, 375px, 414px and 768px widths.
2. Make the map shell, layer panel and inspector collapse/reflow without obscuring the map or creating horizontal scroll.
3. Check keyboard use for map-adjacent controls, visible focus, contrast, loading/error/no-data messages and reduced-motion behaviour.
4. Apply the existing light institutional design direction only after map data is demonstrably working; do not add decorative imagery, fake controls, or fabricated metrics.

### Acceptance criteria

- Production build, lint and backend suite remain green.
- Browser network panel shows successful existing tile loads and intentional errors for missing assets.
- No console errors in the core planner route.
- The map is usable at the specified widths and all visible controls have a meaningful action or honest disabled state.

## Implementation order

1. Phase 1 (P0 map contract) — required before visual work.
2. Phase 2 (truthful layer-state handling) — required before enabling polish controls.
3. Phase 3 (scientific/identity integrity) — required before release.
4. Phase 4 (responsive and visual QA) — final quality gate.

## Not proposed

- Replacing Leaflet, FastAPI, the tile generator, route engine, or local/offline data model.
- Contacting NASA endpoints or adding credentials.
- Presenting MCS dust or environmental observations that the backend cannot source.
- Any redesign that copies the reference mockup's fabricated numbers or implies NASA endorsement.

