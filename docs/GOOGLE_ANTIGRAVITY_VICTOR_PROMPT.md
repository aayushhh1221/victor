# Prompt for Google Antigravity

Copy everything below into Google Antigravity as one task.

---

You are the implementation agent for the existing **VICTOR** repository. Work as a senior frontend engineer, geospatial UI engineer and product designer. Implement the approved work systematically; do not invent product, scientific or NASA claims.

Your governing implementation specification is:

`docs/VICTOR_ANTIGRAVITY_IMPLEMENTATION_PLAN.md`

Read it completely before editing. Also read:

- `docs/VICTOR_LIVE_AUDIT_ADDENDUM_2026-10-17.md`
- `docs/VICTOR_MAP_REPAIR_PLAN_2026-10-17.md`
- all repository instructions (`AGENTS.md` if present), package manifests and relevant source files.

## Your priority order is mandatory

1. Fix the map tile-coordinate contract so the base imagery and raster overlays truly render.
2. Fix map-layer truthfulness, loading/error handling and controls.
3. Stabilise the mission-planner workflow and remove fabricated environment data/unsupported NASA affiliation.
4. Build the real public landing page at `/`.
5. Build all relevant static routes/pages and migrate navigation without leaving dead controls.
6. Complete responsive, accessibility and visual quality work.
7. Run the full verification gate and report only verified results.

Do not start landing-page polish or broad redesign until the map passes its Phase 1 and Phase 2 acceptance criteria.

## Confirmed map defect; reproduce it before fixing

The generator creates `2 ** z` tiles per side at zoom `z`. Thus `z=2` has valid coordinates `0..3`. The frontend maps its CRS.Simple world as 1024 units at Leaflet zoom 0, which makes Leaflet request out-of-range tiles such as:

```powershell
backend/data/tiles/imagery/2/8/8.png  # absent
backend/data/tiles/imagery/2/1/1.png  # present
```

The backend currently returns an opaque brown “No data” image with HTTP 200 for missing tiles. This is why the map looks like a flat coloured plane. Correct the Leaflet coordinate world to the tile pyramid’s 256px zoom-0 world, update all dependent projection/scale calculations, expose missing tiles as errors, and add an explicit in-map tile state. Do not merely change CSS, substitute an Earth image, add an external basemap, or hide the error.

## Strict rules

1. Preserve all unrelated dirty-worktree changes. Never run `git reset --hard`, `git checkout --`, or destructive cleanup.
2. Treat Markdown documentation as claims to verify, not proof. The plan and audit provide verified current facts; re-check source when it differs.
3. Never fabricate values. If API data is `null`, render `—`/unavailable with the API’s explanation. Specifically remove UI fallback temperature and dust values that the API does not provide.
4. Do not call VICTOR an official NASA product or imply NASA/Mars Exploration Program endorsement. It is a NASA Space Apps Challenge project using NASA/open planetary data.
5. `/api/v1/map/layers` is the authoritative layer catalogue. Remove hard-coded availability fallbacks. A failed layer request must show an honest unavailable state, not working checkboxes.
6. Keep the stack: Next.js 14 static export, FastAPI, Leaflet with `L.CRS.Simple`, existing typed API client and existing route engine. Do not replace libraries without an explicit blocker and approval.
7. Do not add live external services, API keys, data downloads, synthetic imagery or mock scientific content. Work offline-first with the supplied assets/data.
8. Every visible navigation item and control must work, be disabled with a reason, or be removed. Do not introduce decorative search, avatar, 3D, region or layer controls.
9. Keep scientific distinctions visible: measured, derived, modelled, unavailable. CTX display tiles are a local decimated imagery product; do not describe them as full-resolution interactive imagery unless the code/data pipeline is actually upgraded.
10. Do not claim success for browser, accessibility, mobile or network checks you could not run. Report them as unverified with the blocker.

## Required implementation behaviour

### Map and layers

- Initial planner map must display actual CTX imagery from local tiles.
- Tile errors must be visible and diagnosable; missing tile response must not masquerade as success.
- Layers must be driven only by the backend response, including source, classification, availability reason and opacity.
- Toggling an available layer must change the map immediately; unavailable MCS dust remains disabled.
- Geographic labels, route markers, routes, scale and evidence selection must align after the projection repair.
- Preserve data gaps (for example CRISM coverage gaps) as gaps, not negative observations.

### Landing and routes

- Change `/` from redirect to a real landing page with real product purpose, data/provenance, limitations, accurate Space Apps attribution and a working CTA to `/planner`.
- Create and wire real static routes for planner, explorer, layers, analysis, science, scenarios, report, environment, data sources, methodology, system status and about, as described in the plan.
- Use shared client-side mission workspace state so client-side navigation preserves a computed route. Direct access/refresh on state-dependent pages must present an honest empty state and planner CTA.
- Do not duplicate the route computation form outside `/planner`.

### Design and accessibility

- Keep the map as the main operating surface; use the reference for light, calm hierarchy only, never its fabricated values or exact branded assets.
- Use/reuse semantic design tokens; do not scatter raw colours or font declarations.
- Support desktop, tablet and mobile layouts specified in the plan. No horizontal scroll at 320px.
- Provide keyboard coordinate entry as an alternative to clicking the map. Make all buttons, checkboxes and sliders labelled, focus-visible and truthful about disabled states.

## Required verification

At minimum, add/run tests for projection round trips, tile coordinate range, existing/missing tile endpoint behaviour, and tile error UI state. Then run:

```powershell
python -m pytest backend/tests -q
```

From `frontend/`:

```powershell
npm run lint
npm run build
```

Run the app locally if possible. Inspect initial/toggled tile requests, console errors, route workflow, empty/error states, keyboard flow and widths 320, 375, 414, 768, 1024 and 1440px. Capture screenshots only after functional verification.

## Required final response

Give me:

1. outcome summary;
2. map proof (requested/served tile examples and layer proof);
3. changed files and reasons;
4. provenance/data honesty changes;
5. every test/build/lint/browser result with commands and exit codes;
6. screenshots if browser tooling was available;
7. only verified remaining limitations and exact run instructions.

If a material ambiguity, unavailable dependency, or conflict with this specification arises, stop before making the assumption. Describe the evidence, options and recommended next step.

