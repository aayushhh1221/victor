# VICTOR — Implementation Blueprint

> **Phase 3 of the transformation plan.**
> **Status:** AWAITING USER APPROVAL before any code is modified.
> Created: 2026-10-17 | Audit basis: VICTOR_AUDIT_REPORT.md

---

## 0. Guiding Principles

1. **Do not break what works.** Backend is production-quality. API contracts are stable.
   No backend changes unless a specific bug demands it.
2. **Fix the most impactful things first.** The reference.png layout divergences lose the
   most points in a competition context. Data integrity is already excellent.
3. **No invented data.** Every value displayed must come from the backend or be clearly
   labeled as a model score. This principle is already well-implemented; we preserve it.
4. **Each phase is independently deployable.** We ship value incrementally.
5. **Preserve all working functionality.** The Pareto table, evidence popup, scenario engine,
   and mission report are genuine differentiators — keep them.

---

## 1. Phase Breakdown

### Phase A — Critical Layout & Chart Fix (P0)
*Goal: Make the default planner view match reference.png structurally.*

**A1. Fix Route Profile Chart — show elevation, not science/hazard**

- File: `frontend/src/app/planner/page.tsx` (lines 700-764)
- Problem: Chart shows `science` + `hazard` series. Reference.png shows elevation + terrain difficulty.
- Fix: Compute cumulative elevation from `segment.elevation_change_m` data that already comes
  back in the `RouteComputeResponse`. Add a second "terrain difficulty" series from
  `traversability_cost` (already in segments). Keep existing science/hazard data available
  in the full `RouteAnalysisView`.
- Chart series:
  - Y1 (left axis): Elevation (m) — cumulative sum of `elevation_change_m` from a baseline
  - Y2 (right axis): Terrain Difficulty — `traversability_cost` (1.0-10.0 scale)
  - X axis: Distance (km) — cumulative `distance_m / 1000`
- Colors: elevation = `var(--accent)` (blue), terrain = `var(--color-warning)` (amber)
- No backend change needed — data is already in `RouteSegment.elevation_change_m`

**A2. Three-Panel Bottom Layout**

- File: `frontend/src/app/planner/page.tsx` (lines 688-791)
- Problem: Single chart + trade-off summary sidebar. Reference has three equal panels.
- Fix: Replace the `showSciencePanel` bottom area with a three-column layout:
  ```
  [ Route Profile (elevation chart) ] [ Route Risk Assessment ] [ Science Opportunities ]
  ```
- Route Risk Assessment: Extract from `RouteAnalysisView.tsx` — it already has the
  `RiskMeter` component for Hazard Score, Max Slope, Traversability, Confidence.
  Inline 4 risk meters in the bottom panel using data from `routeResult.strategies[activeStrategy]`.
- Science Opportunities: Show top 3 nearby targets (already in
  `routeResult.strategies[activeStrategy].science_targets_nearby`). Static thumbnail
  generation via `generate_image` tool.
- Bottom panel height: 220px (was 200px), split into three equal-width columns with dividers.

**A3. Map Place-Name Labels**

- File: `frontend/src/components/map/MarsMap.tsx`
- Problem: No geographic labels on map.
- Fix: Add `L.marker` with `L.divIcon` HTML labels for key locations.
  Labels render as CSS-styled absolutely-positioned divs on the Leaflet pane.
  No additional API call needed — coordinates are hardcoded geographic facts.

Key labels to add:
```
Jezero Crater    18.44°N 77.45°E  — main title label (large, white)
Ancient Delta    18.47°N 77.33°E  — medium label
Seitah           18.42°N 77.47°E  — medium label
Crater Rim       18.52°N 77.50°E  — small label
```

---

### Phase B — Map Polish (P1)
*Goal: Professional cartographic appearance.*

**B1. Graduated Scale Bar**

- File: `frontend/src/components/map/MarsMap.tsx`
- Problem: Basic "← X km →" text. Reference shows 0 / 5 / 10 / 20 km ticks with solid bar.
- Fix: Replace the text-only scale element with an SVG scale bar:
  - Four segments (0-5, 5-10, 10-15, 15-20 km) alternating black/white
  - Tick labels at 0, 5, 10, 20 km
  - "km" unit label on right
  - Updates dynamically on zoom (existing logic preserved)

**B2. North Arrow**

- File: `frontend/src/components/map/MarsMap.tsx`
- Fix: Add a fixed-position compass rose overlay in bottom-right of map canvas.
  Simple SVG: "N" text + upward arrow. Styled with the accent color.
  Mars maps use true north (planetocentric north pole), which aligns with the grid's
  y-axis — no rotation needed.

**B3. Header Search Field & Avatar (decorative)**

- File: `frontend/src/components/common/Header.tsx`
- Fix: Add a non-functional search input (styled to match reference.png) between the
  nav tabs and the right action buttons. Add a placeholder avatar circle with initials.
  These are cosmetic competition polish items.

**B4. Science Opportunity Thumbnails**

- File: `frontend/src/app/planner/page.tsx` (nearby targets section) and
  `frontend/src/components/panels/ScienceOppsView.tsx`
- Fix: Generate 4-6 science target thumbnail images using the `generate_image` tool.
  Images: Mars surface materials (carbonate rock, delta sediment, ancient shoreline,
  olivine-bearing basalt, phyllosilicate clay). Store as static assets in `frontend/public/`.
  Reference in science target card by mineral class type.

---

### Phase C — Design Polish (P2)
*Goal: Premium look matching the reference.png quality level.*

**C1. Fix JetBrains Mono Import**

- File: `frontend/src/app/layout.tsx`
- Fix: Import `JetBrains_Mono` from `next/font/google` alongside `Inter`. Apply to `--font-mono` CSS variable. Minimal change.

**C2. Visual Hierarchy Improvements**

- Increase header height from 56px to 64px to give more breathing room
- Add a thin colored top border (2px `var(--accent)`) to the header — NASA institutional style
- Refine InfoBar card styling: slightly taller (py-4 instead of py-3), stronger label contrast
- Add subtle card shadow to planner right panel

**C3. Map Waypoint Labels**

- File: `frontend/src/components/map/MarsMap.tsx`
- Fix: Add small text labels at start/destination pins showing coordinate or label name.
  "Start" / "Destination" text underneath the marker circles.

**C4. Route Line Visual Quality**

- Increase active route line stroke width from ~2px to 3px
- Add a subtle glow effect to the active route (via SVG filter or thicker transparent underline)
- Non-active routes: slightly lower opacity (0.35 vs 0.5)

---

### Phase D — Content & Static Views (P2-P3)
*Goal: Complete the supporting views to competition standard.*

**D1. EnvironmentalView — wire to live data**

- File: `frontend/src/components/panels/StaticViews.tsx`
- Fix: `EnvironmentalView` currently shows static text. Wire it to `getEnvironment()` API call.
  Show THEMIS thermal proxy (which IS available), honest nulls for MCS data with
  `environment.notes` as the explanation.

**D2. MarsExplorerView — enrich content**

- Add labeled sections for key Jezero geological features with brief scientific descriptions.
- Link to the planner from relevant science targets.

**D3. System Status — improve display**

- Add uptime, grid dimensions, Pareto count, computation store stats from health endpoint.
- Already mostly implemented in `SystemStatusView` — enhance the visual layout.

---

## 2. File Change Manifest

| File | Phase | Change Type | Scope |
|---|---|---|---|
| `frontend/src/app/planner/page.tsx` | A1, A2 | Edit | Route Profile chart + three-panel bottom layout |
| `frontend/src/components/map/MarsMap.tsx` | A3, B1, B2, C3, C4 | Edit | Labels, scale bar, north arrow, route polish |
| `frontend/src/components/common/Header.tsx` | B3 | Edit | Search field, avatar |
| `frontend/src/app/layout.tsx` | C1 | Edit | JetBrains Mono import |
| `frontend/src/app/globals.css` | C2 | Edit | Header height, InfoBar spacing |
| `frontend/src/components/panels/StaticViews.tsx` | D1, D2, D3 | Edit | EnvironmentalView live data, MarsExplorer content |
| `frontend/src/components/panels/ScienceOppsView.tsx` | B4 | Edit | Thumbnail images in cards |
| `frontend/public/science/` | B4 | Create | Static science thumbnail images (PNG, ~150x150) |
| **Backend** | — | **No changes** | Backend is production-complete |

---

## 3. Implementation Order

### Sprint 1 (do first — highest impact)
1. A1: Fix Route Profile chart → elevation + terrain difficulty
2. A2: Three-panel bottom layout with Route Risk meters
3. A3: Map place-name labels (Jezero, Delta, Seitah, Rim)

### Sprint 2 (competition polish)
4. B1: Graduated scale bar with tick marks
5. B2: North arrow overlay
6. C1: JetBrains Mono font import fix
7. C4: Route line visual quality (thicker active, dimmed inactive)

### Sprint 3 (premium finish)
8. B3: Header search field + avatar (decorative)
9. B4: Science thumbnail images
10. C2: Visual hierarchy — header accent border, InfoBar spacing
11. C3: Map waypoint labels (Start/Destination text under pins)
12. D1: EnvironmentalView live data wiring

### Sprint 4 (if time allows)
13. D2: MarsExplorerView content enrichment
14. D3: System Status layout improvements

---

## 4. Technical Constraints

### What NOT to change
- `types/index.ts` — TypeScript interfaces match Pydantic schemas exactly
- `services/api.ts` — All endpoints working and typed
- `utils/marsProjection.ts` — Projection math is correct and tested
- `utils/theme.tsx` — Theme system works; no flash on reload
- Any backend files — Backend is production-complete
- `globals.css` token definitions — Only additions allowed, no removals

### Risk Assessment per Change

| Change | Risk | Mitigation |
|---|---|---|
| A1: Route Profile chart | Low | Only affects chart series, same component |
| A2: Three-panel bottom layout | Medium | Restructures DOM; test route highlight still works |
| A3: Map labels | Low | Additive; Leaflet divIcon is stable API |
| B1: Scale bar SVG | Low | Replaces existing element |
| B2: North arrow | Low | Additive overlay |
| C1: JetBrains Mono | Low | Additive import |
| B3: Header search | Low | Additive elements; no logic change |

---

## 5. Acceptance Criteria

After implementation, the planner view must:

- [ ] Show an elevation + terrain difficulty chart in the Route Profile panel
- [ ] Display three panels in the bottom strip: Route Profile, Route Risk, Science Opps
- [ ] Render Jezero Crater, Ancient Delta, and Seitah labels on the map canvas
- [ ] Show a graduated scale bar (0, 5, 10, 20 km ticks)
- [ ] Show a North arrow in the map corner
- [ ] JetBrains Mono render correctly in metric values
- [ ] `npm run build` exit 0 with 0 TypeScript errors
- [ ] All existing functionality intact (Pareto table, evidence popup, scenario compare, report export)
- [ ] Light and dark themes both render correctly

---

## 6. Out of Scope

The following reference.png elements are **intentionally deferred** because they require
significant new technology or backend changes that do not justify the competition ROI:

- **3D toggle:** Requires Three.js or similar — new rendering engine
- **Region dropdown:** Would require multi-region data (only Jezero is currently ingested)
- **Live dust/temperature from MCS:** Product does not exist as a gridded NASA archive
- **User authentication / avatar account:** No auth system in scope

---

*Implementation Blueprint complete. Awaiting explicit user approval to proceed with Phase A (Sprint 1).*
