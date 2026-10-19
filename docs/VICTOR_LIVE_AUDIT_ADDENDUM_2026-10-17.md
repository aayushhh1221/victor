# VICTOR — Live Audit Addendum

> Date: 2026-10-17  
> Scope: a fresh, local evidence pass over the current working tree, with emphasis on the Mars map and layers. This document does not rely on prior audit documents.

## Executive summary

VICTOR is a Next.js 14 static-export frontend backed by a FastAPI service. Its local backend loads the committed Jezero grids successfully, reports `VERIFIED_SNAPSHOT`, and exposes ten map-layer records. The production frontend build and lint checks pass; the backend test suite passes with skips.

The primary planner experience is nevertheless blocked by a confirmed tile-coordinate mismatch. At the default Leaflet zoom, the client asks for tiles that the generated pyramid cannot contain. The API masks that mismatch by returning a brown `No data` PNG with HTTP 200. The result is the reported flat-colour map, even though the actual imagery and overlay files are present locally.

The current uncommitted frontend changes also introduce fabricated environmental values and an unsupported NASA-program affiliation. Those must not ship.

## Verification performed

| Check | Result | Evidence |
| --- | --- | --- |
| Backend health | Pass | Local `GET /api/v1/health` returned `ok`, a loaded `300 x 300` grid and `VERIFIED_SNAPSHOT`. |
| Layer inventory | Pass | Local `GET /api/v1/map/layers` returned 10 records, including CTX imagery, MOLA terrain/elevation, THEMIS proxy, hazard, science, CRISM composition, terrain class, confidence and rover reference route. |
| Assets on disk | Pass | Each checked core layer contains 1,364 PNGs. |
| Existing real tile | Pass | `imagery/2/1/1.png` is present (11,760 bytes) and visually contains CTX image data. |
| Requested missing tile | Fail | `imagery/2/8/8.png` does not exist. The local endpoint returns the 1,485-byte brown placeholder with HTTP 200. |
| Backend tests | Pass with skips | `python -m pytest backend/tests -q`: 70 passed, 4 skipped. |
| Frontend build | Pass | `npm run build`: compiled and type-checked successfully. |
| Frontend lint | Pass | `npm run lint`: no warnings or errors. |
| Browser console/responsive rendering | Unverified | No browser-inspection tool was available in this audit environment. |

## Architecture and map data flow

1. `scripts/generate_tiles.py` creates a raster pyramid for zoom levels 1–5. At zoom `z`, it produces `2 ** z` rows and columns of 256px tiles.
2. `backend/routers/map.py` serves the tile path `/api/v1/map/tiles/{layer}/{z}/{x}/{y}.png`.
3. `frontend/src/components/map/MarsMap.tsx` creates a Leaflet `CRS.Simple` map and provides Leaflet a URL template for every selected layer.
4. `frontend/src/utils/marsProjection.ts` maps the Mars bounding box into Leaflet coordinates; this coordinate extent must use Leaflet's zoom-0 256px world, not the tile generator's 1024px `z=2` image size.
5. `LayerControl.tsx` obtains layer availability from the backend, but current fallback logic falsely claims several layers are available when the API cannot be reached.

## Prioritized findings

### P0 — Leaflet and tile-pyramid coordinate systems disagree

**Status:** Confirmed  
**Locations:** `frontend/src/utils/marsProjection.ts:28`, `frontend/src/components/map/MarsMap.tsx:96-109`, `scripts/generate_tiles.py:113-151`

The tile generator makes a four-by-four tile world for `z=2` (`2 ** 2`), so only coordinates `0..3` are valid. The frontend declares a 1024-unit world at Leaflet zoom 0. At Leaflet zoom 2, that world is scaled fourfold and maps the centre to requests around `z=2/x=8/y=8` rather than the valid `x=1/y=1` region.

**Reproduction:**

```powershell
Test-Path backend/data/tiles/imagery/2/8/8.png  # False
Test-Path backend/data/tiles/imagery/2/1/1.png  # True
```

**Impact:** the planner's selected CTX base layer resolves to placeholder tiles rather than Mars imagery. The same mismatch prevents all raster overlays from rendering where expected.

### P0 — Missing tiles are intentionally hidden as successful brown images

**Status:** Confirmed  
**Locations:** `backend/routers/map.py:61-72`, `scripts/generate_tiles.py:157-162`

For a missing tile, the server returns `placeholder.png` as `200 image/png`. The placeholder is a brown opaque image labelled `No data`, not the router comment's claimed transparent 1x1 image.

**Impact:** Leaflet sees a successful tile load and neither emits a useful load error nor gives the user an explanation. This directly turns a diagnosable map-contract failure into a flat-colour map.

### P0 — Environmental cards fabricate values when the API honestly returns null

**Status:** Confirmed  
**Locations:** `frontend/src/components/common/InfoBar.tsx:170-192`, `backend/routers/environment.py:14-73`

The backend deliberately returns `null` for temperature and dust opacity because its ingested THEMIS proxy cannot support either measurement. The frontend substitutes `-63 °C` and `τ 0.38 (Clear)`, labels them as available, and attributes them to Mars 2020 instruments.

**Impact:** this violates VICTOR's scientific-provenance requirement and makes the UI contradict its API. Restore the unavailable state until an appropriately sourced API field exists.

### P1 — Layer panel invents an availability catalogue on API failure

**Status:** Confirmed  
**Locations:** `frontend/src/components/map/LayerControl.tsx:52-130`, `:133-152`

`FALLBACK_LAYERS` represents several tiles as available. If `GET /api/v1/map/layers` fails, the panel retains those controls and suppresses the error instead of displaying the existing unavailable-state UI.

**Impact:** users can operate checkboxes that cannot be verified against an active tile source. The fallback also duplicates metadata owned by the backend and has drifted from its full ten-layer response.

### P1 — Map-tile contract has no regression test

**Status:** Confirmed  
**Locations:** `backend/tests/`; no frontend test setup or map-contract test found

The 74 collected backend tests do not test the relationship between the Leaflet projection, generated pyramid range, and tile URL template.

**Impact:** the core map can regress while the backend test suite, lint, and static build all pass.

### P1 — VICTOR is presented as a NASA Mars Exploration Program product

**Status:** Confirmed  
**Locations:** `frontend/src/components/common/Header.tsx:81-90`, `frontend/src/components/panels/StaticViews.tsx:128-139`

The UI calls the mark an official NASA logo, changes the subtitle to `Mars Exploration Program`, and says the product was developed for that programme. Repository materials identify it as a NASA Space Apps Challenge entry, not an official NASA product.

**Impact:** creates an endorsement/affiliation claim that the project must not make. Revert to accurate Space Apps Challenge phrasing and keep source attributions separate from product identity.

### P2 — CTX display resolution is much lower than its UI wording implies

**Status:** Confirmed  
**Locations:** `scripts/generate_tiles.py:140-151`, `backend/data/cache/imagery.npy`

The cache image used to generate all CTX display tiles is `300 x 300`; it is resized to 1024px and then cropped into the tile pyramid. It should be described as a decimated display basemap, not as interactive full-resolution (~5m/px) imagery.

### P2 — Planner responsiveness and map accessibility are unverified/partial

**Status:** Likely  
**Locations:** `frontend/src/components/sidebar/Sidebar.tsx:61`, `frontend/src/app/planner/page.tsx:806,877,964`, `frontend/src/components/map/MarsMap.tsx`

The planner has fixed 210px, 220px, 240px and 300px side panels without a corresponding narrow-screen shell. Leaflet controls and a click-to-place map workflow do not presently expose a keyboard-equivalent flow. Browser viewport and keyboard testing remains required.

## Positive findings to preserve

- The backend's `/health` and `/map/layers` responses derive availability from loaded grids and rendered assets.
- Local tile assets for the audited core layers exist and real imagery content is present.
- The build, type check, lint, and backend suite are healthy on the audited working tree.
- The backend's environmental endpoint correctly models unavailable fields as `null`; this is the right provenance behaviour.
- Existing semantic tokens and data-mode warnings provide a useful foundation for the eventual visual refinement.

## Highest-risk assumptions

1. The coordinate mismatch is confirmed structurally and by missing-tile requests. Full browser verification remains required after the repair because Leaflet's final tile indices depend on viewport state.
2. A browser was not available to inspect failed network requests or accessibility tree output in this audit environment.
3. No external NASA service was contacted; provenance claims were evaluated only against local code, local cached metadata, and local API output.

## Audit health score

| Dimension | Score | Basis |
| --- | ---: | --- |
| Accessibility | 2/4 | Some labelled controls, but planner keyboard and mobile behaviour remain incomplete/unverified. |
| Performance | 3/4 | Static build succeeds and tile assets are local; per-segment vectors and tile errors still need browser profiling. |
| Theming | 2/4 | Semantic tokens exist, but the map has inline colour fallbacks and hard-coded label styles. |
| Responsive design | 1/4 | Fixed planner columns have no verified mobile composition. |
| Implementation integrity | 0/4 | The primary map is broken and the current UI fabricates unavailable scientific data. |
| **Total** | **8/20** | **Poor — repair core integrity before visual polish.** |

