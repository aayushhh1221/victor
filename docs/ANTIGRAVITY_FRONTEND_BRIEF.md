# VICTOR — Frontend Work Brief (Antigravity)

> **You own the frontend. A second agent owns the backend concurrently.**
> Read the Scope Boundary section before editing anything. Staying inside it is the
> single most important constraint in this brief — violating it will cause merge
> conflicts and lost work.

---

## 1. Project context

**VICTOR** is a multi-objective route planner for astronaut EVAs ("marswalks") across
**Jezero Crater, Mars** (18.0–18.9°N, 77.0–78.0°E). It is an entry for the **NASA Space
Apps Challenge 2026**, challenge *"Interplanetary Survival Guide: Martian Map"*.
Hackathon is **14–15 November 2026**.

Given a start and destination, the backend computes **four competing routes** —
`SAFEST`, `FASTEST`, `SCIENCE_RICHEST`, `BALANCED` — using multi-objective A*, then
proves which are Pareto non-dominated. Clicking a route segment reveals which Mars
instrument data drove that segment's cost, with counterfactual attribution.

**Stack:** Next.js 14.2.35 (TypeScript, App Router) + FastAPI (Python 3.11).
The backend is complete and working. **The frontend is the weak half, and it is your job.**

---

## 2. Scope boundary — read this carefully

### You own, and may freely modify:

```
frontend/src/app/**            (layout, pages, globals.css)
frontend/src/components/**      (all components)
frontend/src/utils/**
frontend/tailwind.config.*
frontend/next.config.mjs
frontend/package.json           (you may add UI dependencies)
```

### You must NOT touch — another agent is actively editing these:

```
backend/**                      ← ALL of it. No exceptions.
scripts/**
docs/**
.gitignore
README.md
```

### Shared contract files — additive changes only:

```
frontend/src/services/api.ts    ← You MAY add new functions.
                                   You MUST NOT change existing function
                                   signatures or remove anything.
frontend/src/types/index.ts     ← You MAY add new types.
                                   You MUST NOT change existing domain types
                                   (Route, RouteSegment, Coordinate, ScienceTarget,
                                   SegmentEvidenceResponse, DataMode, STRATEGY_META).
```

These two files are the interface with the backend. The backend agent is adding fields
to API responses but **will not remove or rename any existing field**, so anything you
build against the current shape will keep working.

**If you believe you need a backend change, do not make it.** Write the request in
`frontend/BACKEND_REQUESTS.md` (create it) describing the endpoint and response you
need, and build the UI against a clearly-marked placeholder in the meantime.

---

## 3. The design target

**The attached `reference.png` is the design north star.** Match its layout, hierarchy,
spacing, and visual language. It is a **light, white/NASA-blue institutional interface**.

### What the reference shows, top to bottom

**Header bar:** NASA logo + "SPACE APPS CHALLENGE 2026" wordmark · six tabs — *Mission
Planner, Mars Explorer, Data & Layers, Science Targets, Methodology, About* · a search
field · help icon · user avatar.

**Left sidebar:** Mission Overview, Plan Marswalk, Interactive Map, Route Analysis,
Science Opportunities, Environmental, Compare Scenarios, Mission Report — then a lower
group: Data Sources, Methodology, System Status.

**Page title:** "Martian Map & Mission Planner"

**Five-card info bar:** Jezero Crater `18.444°N 77.450°E` · Elevation `−2,450 m` ·
Terrain `Crater Floor–Delta` · Temperature `−63 °C` · Dust `Low to Moderate`

**Main map panel:** orbital-imagery-style base, a Start→Destination route drawn across
it, place labels (*Jezero Crater, Ancient Delta, Séítah Formation*), a graduated
**0–20 km scale bar**, a **3D toggle**, a **region dropdown**, and a prominent
**"Plan Route"** button.

**Map Layers panel (8 layers, with opacity sliders):**
Base Imagery (HiRISE) · Elevation (MOLA) 70% · Surface Composition (CRISM) 60% ·
Thermal Inertia (THEMIS) 50% · Dust Activity (MCS) 50% · Scientific Targets ·
Hazard Zones · Previous Rover Routes

**Bottom row, three panels:**
- **Route Profile** — line chart, elevation + terrain difficulty, −3000 to −1500 m over 0–20 km
- **Route Risk Assessment** — four meters: Terrain Difficulty 3.2/10, Rock Hazard 4.8/10, Slope Risk 3.5/10, Dust Exposure 2.1/10
- **Science Opportunities** — thumbnail cards: Deltaic Sediments 0.8 km *High Value*, Carbonate Deposits 3.4 km *High Value*, Ancient Shoreline 5.1 km *Medium Value*, plus a "View All" link

### Critical: the reference is a mockup, and its numbers are fake

**Every number in `reference.png` is invented for the mockup.** `−63 °C`,
`Dust Low to Moderate`, `3.2/10`, `0.8 km` — none of these come from real data.

**Do not hardcode mockup values into the UI.** This project's central credibility claim
is that it does not misrepresent its data, and a reviewer who finds an invented
temperature will discount everything else. Rules:

- Where the backend provides a value → render the real value.
- Where the backend does not yet provide it → render `—` or "Not available", with a
  tooltip saying the data source is not yet ingested. **Never a plausible-looking number.**
- Match the reference's *layout and visual treatment*, not its *content*.

---

## 4. Current state — exact facts you need

### 4.1 There is only one real page

`frontend/src/app/` contains just three files: `layout.tsx`, `page.tsx` (redirects to
`/planner`), and `planner/page.tsx` (475 lines — the whole application).

### 4.2 Navigation is half-wired

`frontend/src/app/planner/page.tsx:71-72`:

```tsx
const [activeTab, setActiveTab] = useState('planner');
const [sidebarSection, setSidebarSection] = useState('plan');
```

These are passed to `Header` (line 169) and `Sidebar` (line 172), where they **do** drive
which nav item appears highlighted. But nothing else responds — no view switches, no
panel opens. All 10 sidebar items and all 4 header tabs change the highlight and nothing
more. **Making these actually navigate is a core task.**

### 4.3 Five API functions are fully built and never called

This is the highest-value work available. The backend features exist; they have no UI.

| Function | Location | Serves |
|---|---|---|
| `compareScenarios` | `services/api.ts:110` | **Compare Scenarios view — a complete backend engine with zero UI** |
| `getScienceProfile` | `services/api.ts:95` | Science Opportunities panel |
| `compareScienceStrategies` | `services/api.ts:104` | Science strategy comparison |
| `getRegionInfo` | `services/api.ts:52` | The 5-card info bar |
| `getLayers` | `services/api.ts:56` | Map Layers panel metadata |

### 4.4 The current theme is dark and uses literal colors

`frontend/src/app/globals.css` (151 lines):

```css
--victor-navy:  #0B1929;
--victor-panel: #0D1F33;
--victor-text:  #E8EDF3;
body { background-color: var(--victor-navy); }
.leaflet-container { background: #1A0A00; }
```

Colors are applied **directly**, not through semantic roles, so theming is currently
impossible. There are also hardcoded hex values inline in components —
`planner/page.tsx` root background is `#07101C`, `Sidebar.tsx` background is `#08131E`.

### 4.5 These four colors are data encodings — preserve them in both themes

From `STRATEGY_META` in `types/index.ts`:

| Strategy | Color |
|---|---|
| SAFEST | `#22C55E` |
| FASTEST | `#3B82F6` |
| SCIENCE_RICHEST | `#F97316` |
| BALANCED | `#A855F7` |

They identify routes on the map and in the comparison table. Adjust lightness for
contrast if needed, but **do not re-hue them** — and verify contrast against *both*
light and dark backgrounds.

### 4.6 Map layer reality vs. the reference

`DEFAULT_LAYERS` in `planner/page.tsx` has **5** entries; the backend serves tiles for
**4**: `terrain`, `elevation`, `hazard`, `science`, plus a `perseverance_traverse`
polyline. The reference wants **8**.

**Three reference layers have no backend data at all:** Base Imagery (HiRISE),
Thermal Inertia (THEMIS), Dust Activity (MCS).

Render all 8 rows to match the reference, but the three unavailable ones must be
**visibly disabled** with a tooltip such as *"Data source not yet ingested."* The
backend agent is adding thermal inertia and composition tiles during this work;
`GET /api/v1/map/layers` returns the authoritative list, so **drive the panel from that
endpoint** and layers will light up on their own as they land.

### 4.7 Known rough edges in the map component

`frontend/src/components/map/MarsMap.tsx`:
- Line 83 — map base is a plain brown rectangle, `fillColor: '#6B3410'`
- Line 268 — scale bar is a fixed `← ~10 km →` label that ignores zoom
- Lines 21–32 — `PERSEVERANCE_TRAVERSE` is 10 hardcoded waypoints

**Leave lines 21–32 alone** — the backend agent is replacing that with real data and will
expose it via the API. Fix the scale bar (make it graduate properly, 0–20 km as in the
reference) and style the base per the theme.

Note: `MarsMap.tsx:16` uses raw `require('leaflet')`, not `react-leaflet`. If
`react-leaflet` appears in `package.json`, it is unused — do not build on it.

### 4.8 Already available to you

- **Recharts** is installed — use it for the Route Profile chart.
- **Tailwind 3.4.1** and **lucide-react** are installed.
- The backend serves a **precomputed demo route** at `GET /api/v1/routes/demo`, which
  `planner/page.tsx` already loads on mount. You get a populated UI immediately without
  waiting on a computation.

---

## 5. Your tasks, in order

### Task 1 — Themeable design system (do this first; everything depends on it)

Rewrite `globals.css` around **semantic role tokens** rather than literal colors:
`--surface`, `--surface-raised`, `--border`, `--text-primary`, `--text-muted`, `--accent`,
and so on. Define them under `:root[data-theme="light"]` and `[data-theme="dark"]`, with
**light as the `:root` default**.

Then eliminate every hardcoded hex in components (`planner/page.tsx`, `Sidebar.tsx`,
`Header.tsx`, `MarsMap.tsx`) in favour of tokens.

Add a theme toggle: a provider reading `localStorage`, with `prefers-color-scheme` as the
first-visit default, and a **pre-paint inline script in `layout.tsx`** so there is no
flash of the wrong theme on load. `.leaflet-container`'s background must become
theme-aware.

**Acceptance:** light theme is the default and matches the reference's visual language;
the toggle switches cleanly with no flash on hard reload; `grep -rE '#[0-9A-Fa-f]{6}'`
over `src/` returns hits only in the token definitions and `STRATEGY_META`.

### Task 2 — Header and page shell

Build the six-tab header with search field, help icon, and avatar. Add the page title
and the **five-card info bar**, backing the first three cards with `getRegionInfo()`.
Temperature and dust have no data source yet — render them per the honesty rule in §3.

**Acceptance:** header matches the reference; info bar shows real coordinates, elevation,
and terrain unit from the API; no invented values anywhere.

### Task 3 — Make navigation real

Convert the sidebar and header items into actual routed views under `app/`. Every one of
the 10 sidebar items and 6 header tabs must lead somewhere real.

Thin-but-honest beats fake-but-full: a view that says "Mission Report — generated after a
route is computed" is acceptable; a view with placeholder lorem content is not.

**Acceptance:** clicking every nav item changes the view. Nothing is decorative.

### Task 4 — Compare Scenarios view (highest value in this brief)

A complete scenario-comparison engine exists in the backend with no UI whatsoever. Build
the view on `compareScenarios()` (`services/api.ts:110`): let the user modify mission
constraints, re-run against a base computation, and show the before/after difference
across the four strategies.

This satisfies a scored challenge requirement and needs **no new backend work**.

**Acceptance:** a user can alter constraints and see a clear comparison of how the routes
changed.

### Task 5 — Route Analysis view

- **Route Profile** chart via Recharts — elevation and terrain difficulty against distance.
- **Route Risk Assessment** panel — four meters, matching the reference's visual
  treatment. Derive each from real route data (`hazard_score`, slope, traversability on
  the returned segments). **Dust Exposure has no data source** — disable it with a
  tooltip rather than inventing a value.
- Wire **per-segment evidence**: clicking a segment already calls `getSegmentEvidence`;
  present the cost decomposition and counterfactuals properly.

**Acceptance:** chart reflects the selected route; every meter traces to a real field; no
fabricated metrics.

### Task 6 — Science Opportunities view

Thumbnail cards in the reference's style — name, distance along route, value class —
driven by `getScienceProfile()` and `compareScienceStrategies()` against the 10 science
targets the backend already serves.

**Important:** science values are **model-derived scores, not measurements**. The existing
UI says so in a tooltip (`MarsMap.tsx`), and your cards must carry the same caveat.

**Acceptance:** cards render from API data; the model-not-measurement caveat is visible.

### Task 7 — Map Layers panel

Eight rows with opacity sliders, driven by `GET /api/v1/map/layers`. Unavailable layers
disabled with an explanatory tooltip. Keep the existing tile-loading mechanism in
`MarsMap.tsx` intact — only the panel and styling change.

**Acceptance:** panel is built from the endpoint, not a hardcoded list; toggles and
sliders affect the map; unavailable layers are clearly marked rather than broken.

### Task 8 — Static export

Add `output: 'export'` to `next.config.mjs` and confirm `npm run build` still succeeds.

The app deploys to **Render's free static site tier** so it stays always-on while the
backend sleeps. Consequences: no Next.js image optimization (use pre-sized assets and
plain `<img>`), and every route must be statically renderable — no server components
requiring a runtime, no route handlers.

**Acceptance:** `npm run build` exits 0 and every route reports `○ (Static)`.

---

## 6. How to run it

**Backend** — run from the **repository root**, not from `backend/`. `backend/main.py`
uses relative imports, so it must load as a package:

```bash
uvicorn backend.main:app --reload --port 8000
```

If route endpoints return errors about missing data, the computation grids need
generating (one-time, from the repo root):

```bash
python scripts/data_pipeline.py
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000` → redirects to `/planner`.

Useful endpoints while developing:
- `GET /api/v1/health` — reports the active data mode
- `GET /api/v1/map/layers` — authoritative layer list
- `GET /api/v1/map/region` — region metadata for the info bar
- `GET /api/v1/routes/demo` — precomputed route, instant
- `http://localhost:8000/docs` — full interactive API reference

---

## 7. Non-negotiable constraints

**Offline-first.** The app must work fully with networking disabled — that is how the
demo will be given. Never make a core view depend on an external CDN or a live third-party
tile service. Any external enhancement needs a local fallback.

**Never fabricate data.** Covered in §3, repeated because it is the easiest rule to break
by accident and the most damaging. Every number on screen must trace to an API response.
Missing data is displayed as missing.

**Preserve the honesty UI.** The app currently shows a data-mode banner warning that it
is running on demonstration data, and a "MODEL score — not a direct measurement" caveat
on science values. **Restyle these to fit the light theme; do not remove them.** They are
a deliberate credibility feature, not clutter. The backend reports the live mode via
`/api/v1/health`.

**No backend edits.** Repeated from §2 because it is the constraint most likely to cause
lost work. If you need something from the backend, write it in
`frontend/BACKEND_REQUESTS.md`.

**Keep the build green.** `npm run build` must exit 0 with no new type errors at the end
of every task. `services/api.ts` is fully typed — keep it that way.

---

## 8. Definition of done

- Light theme is default, matches `reference.png`, and the dark toggle works without flash
- Every sidebar item and header tab navigates to a real view
- The scenario-comparison engine has a working UI
- Route Profile, Route Risk Assessment, and Science Opportunities all render from live API data
- Map Layers panel is driven by `/api/v1/map/layers`, with unavailable layers disabled and labelled
- `npm run build` exits 0, all routes `○ (Static)`
- No hardcoded colors outside the token layer; no fabricated data anywhere
- `backend/`, `scripts/`, and `docs/` are untouched — `git status` shows no changes there

---

## 9. Report back

When you finish, summarise:
1. What you completed, and anything you could not
2. Any entry you added to `frontend/BACKEND_REQUESTS.md`
3. Any place you had to show "not available" and what data would fill it
4. Files you changed, so the two work streams can be merged cleanly
