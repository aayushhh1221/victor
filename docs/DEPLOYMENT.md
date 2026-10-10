# VICTOR — Deployment Guide

Everything needed to put VICTOR online on **Render** (free tier) and **Supabase**
(free tier). No code changes are required — only accounts, generated artefacts
and environment variables.

**Read time:** ~10 minutes. **Hands-on time:** ~45–60 minutes, most of it
waiting on the tile upload and the first builds.

---

## Contents

1. [What you are deploying](#1-what-you-are-deploying)
2. [Prerequisites](#2-prerequisites)
3. [Part A — Local setup and artefact generation](#3-part-a--local-setup-and-artefact-generation)
4. [Part B — Supabase](#4-part-b--supabase)
5. [Part C — Render](#5-part-c--render)
6. [Part D — Verification](#6-part-d--verification)
7. [Free-tier constraints you must know](#7-free-tier-constraints-you-must-know)
8. [Troubleshooting](#8-troubleshooting)
9. [Pre-demo checklist](#9-pre-demo-checklist)
10. [Environment variable reference](#10-environment-variable-reference)

---

## 1. What you are deploying

VICTOR is a Mars EVA ("marswalk") route planner for Jezero Crater, built for the
NASA Space Apps Challenge 2026. A FastAPI backend computes four competing routes
with multi-objective A*; a Next.js frontend presents them.

### Four components

| Component | Platform | Plan | Why this choice |
|---|---|---|---|
| `victor-api` | Render **Web Service** | Free | FastAPI backend |
| `victor-web` | Render **Static Site** | Free | Always-on and CDN-backed, so the UI loads instantly even while the API is cold |
| Database | Supabase **Postgres** | Free | Persists route computations and the route cache |
| Map tiles | Supabase **Storage** | Free | Render's filesystem is ephemeral — tiles served from the API would vanish on redeploy |

### Why the frontend is a Static Site, not a Web Service

Render's free Web Services **spin down after 15 minutes of inactivity** and take
roughly 50 seconds to wake. Free Static Sites do not spin down at all.

Splitting them means a judge opening the URL sees the interface immediately,
while the API wakes in the background. If the frontend were also a Web Service,
they would stare at nothing for the better part of a minute.

### Why Supabase is genuinely needed, not decorative

Route results are referenced later by `computation_id` — segment evidence,
science profiles and scenario comparisons all look one up. Those used to live in
a process dictionary, which fails specifically on Render:

1. A judge computes a route and gets a `computation_id`.
2. They read the results for 15 minutes — entirely normal during evaluation.
3. The service spins down. The dictionary is erased.
4. They click a route segment for its evidence.
5. **404.**

Postgres fixes that. It also backs a **route cache**: an uncached 4-strategy
computation measured **13.3 s on a desktop**, and the cached repeat took
**0.24 s**. On 0.1 shared CPU the uncached path projects well past a minute, so
the cache is load-bearing rather than an optimisation.

> **The app still runs completely offline with none of this configured.** That is
> deliberate: the live demo is given from a laptop, and the free tier is too
> fragile to stake it on. Deployment is supporting evidence that it is really
> live.

---

## 2. Prerequisites

### Accounts

- **GitHub** — with access to `ArpitSingh-01/VICTOR`
- **Render** — sign up at [render.com](https://render.com), connect GitHub
- **Supabase** — sign up at [supabase.com](https://supabase.com)

No payment card is required for either free tier.

### Local tooling (needed for Part A only)

- **Python 3.11+**
- **Node.js 18+** and npm 9+
- **Git**
- Optionally `psql` — the Supabase web SQL editor works instead

### One thing to understand before starting

> ## ⚠️ Map tiles are NOT in the repository — you must generate them
>
> Tiles are generated artefacts (**12,277 PNG files, ~211 MB**) and are
> gitignored, so a fresh clone does not have them.
>
> **The symptom if you skip this:** the backend starts fine, `/api/v1/health`
> reports everything healthy, every API endpoint returns 200 — and **the map is
> blank**, with tile requests returning **404**:
>
> ```
> GET /api/v1/map/tiles/imagery/3/4/4.png   ->  404
> ```
>
> Nothing is broken. The tiles have simply never been built. Fix it with one
> command from the repository root:
>
> ```bash
> python scripts/bootstrap.py
> ```
>
> This is **Step A.2** below, and it is the single step most likely to be
> missed, because everything else looks healthy without it. You need the tiles
> locally before you can upload them to Supabase Storage in Part B.

The repository itself is only ~8.5 MB / 125 files. The data grids **are**
committed, because the backend cannot boot without them — tiles are the only
large artefact you have to build.

---

## 3. Part A — Local setup and artefact generation

Do this first. Parts B and C depend on its output.

### A.1 Clone and install

```bash
git clone https://github.com/ArpitSingh-01/VICTOR.git
cd VICTOR
```

Install **both** dependency sets. Production is deliberately minimal (7
packages); the pipeline set carries the heavy geospatial stack that only ever
runs on your machine, never on the server:

```bash
pip install -r backend/requirements.txt
pip install -r requirements-pipeline.txt
pip install -r requirements-dev.txt    # optional, for running tests
```

> `requirements-pipeline.txt` includes `rasterio` (which bundles GDAL),
> `scipy`, `Pillow` and `scikit-learn`. These are **excluded from production on
> purpose** — Render's free instance has 512 MB RAM and a slow build, and none
> of them are needed to *serve* the app, only to *build its data*.

### A.2 Generate the artefacts

```bash
python scripts/bootstrap.py
```

This runs the whole pipeline and is **idempotent** — re-running skips work
already done.

| Step | What it does | Time |
|---|---|---|
| 1. NASA data | Windowed HTTP reads of real MOLA, THEMIS, CTX and CRISM products | ~2–10 min first run |
| 2. Terrain classification | Unsupervised k-means (needs scikit-learn) | ~1 min |
| 3. Map tiles | Renders 12,277 PNGs across 9 layers | ~5–15 min |
| 4. Demo routes | Precomputes the demo traverse | ~15 s |

Useful flags: `--skip-tiles` (fast, but you need tiles for deployment),
`--skip-ml`, `--force` (regenerate everything).

> **The first NASA fetch is the slow part** — the CTX mosaic read takes several
> minutes. Windowed reads are cached under `backend/data/raw/` afterwards, so
> re-runs take seconds. If the fetch fails entirely (network, archive outage),
> bootstrap falls back to synthetic grids and the app labels itself
> `DEMONSTRATION` — **do not deploy in that state**, since real NASA data is a
> mandatory challenge requirement. Re-run when the network is healthy.

### A.3 Confirm it works locally

```bash
# Backend — run from the repository ROOT, not from backend/
uvicorn backend.main:app --reload --port 8000
```

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`. You should see the planner with a map.

Then confirm the data is real:

```bash
curl http://localhost:8000/api/v1/health
```

Look for:

```json
{
  "data_mode": "VERIFIED_SNAPSHOT",
  "compliance": { "compliant": true, "mission_count": 4 }
}
```

If `data_mode` is `DEMONSTRATION`, the NASA fetch did not succeed. Fix that
before deploying (see [Troubleshooting](#8-troubleshooting)).

Optionally run the tests:

```bash
pytest backend/tests -q      # expect: 70 passed, 4 skipped
```

The 4 skips are live-database tests. They activate automatically once
`DATABASE_URL` is set, which is a useful way to verify Part B.

---

## 4. Part B — Supabase

### B.1 Create the project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**
2. **Name:** `victor`
3. **Database password:** generate a strong one and **save it** — you need it for
   the connection strings and it cannot be retrieved later (only reset)
4. **Region:** pick the one closest to your Render region. If you use Render's
   `oregon` (the default in `render.yaml`), choose **West US (Oregon)**.
   Cross-continent round trips add latency to every database call.
5. **Create new project**, then wait ~2 minutes for provisioning

### B.2 Apply the database schema

The migration lives at [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql).
It creates three tables:

| Table | Purpose |
|---|---|
| `computations` | Route results, so `computation_id` lookups survive a restart |
| `route_cache` | Completed computations keyed by their inputs |
| `mission_briefings` | Generated narrative briefings |

Row Level Security is enabled with no permissive policy, so the public anon key
cannot read or write them. The backend uses the direct connection and is
unaffected.

**Easiest route — the web editor:**

1. Dashboard → **SQL Editor** → **New query**
2. Paste the entire contents of `supabase/migrations/0001_init.sql`
3. **Run**. You should see `Success. No rows returned.`

**Or via `psql`** — use the **direct** connection (port 5432), not the pooler.
pgbouncer in transaction mode does not reliably support all DDL:

```bash
psql "postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres" \
  -f supabase/migrations/0001_init.sql
```

> The app also creates these tables at startup with `CREATE TABLE IF NOT EXISTS`
> as a safety net, so a forgotten migration will not break it. Applying the
> migration is still correct — it is the reviewable source of truth and it sets
> up RLS, which the runtime fallback does not.

### B.3 Collect your two connection strings

Dashboard → **Project Settings** → **Database** → **Connection string**.

You need **both**, and they are used for different things:

| Which | Port | Tab in dashboard | Used for |
|---|---|---|---|
| **Pooler** | **6543** | "Connection pooling" → **Transaction** mode | `DATABASE_URL` on Render |
| **Direct** | 5432 | "URI" | Migrations only |

They look like:

```
# Pooler (port 6543) — this is what Render gets
postgresql://postgres.abcdefghijklmnop:PASSWORD@aws-0-us-west-1.pooler.supabase.com:6543/postgres

# Direct (port 5432) — migrations only
postgresql://postgres:PASSWORD@db.abcdefghijklmnop.supabase.co:5432/postgres
```

> ### Use the pooler on Render. This matters.
>
> Render's free tier spins the service down after 15 minutes idle and wakes it
> on the next request, so connections churn constantly. Supabase's direct
> connection has a low connection cap and drops idle sessions; the pgbouncer
> pooler is built for exactly this pattern.
>
> VICTOR's store reconnects automatically if a connection dies and degrades to
> in-memory rather than failing a request — but the pooler means that path is
> rarely needed.

Replace `PASSWORD` with the password from B.1. If it contains special
characters, URL-encode them (`@` → `%40`, `#` → `%23`, `/` → `%2F`).

### B.4 Get the service role key

Dashboard → **Project Settings** → **API** → **Project API keys**.

Copy the **`service_role`** key — the long JWT, *not* `anon`.

> ### Keep this key server-side only
>
> `service_role` bypasses Row Level Security. It is used only by the local tile
> upload script. **Never** put it in Render env vars, in the frontend, or in any
> committed file.

### B.5 Upload the map tiles

From the repository root, with tiles generated in Part A:

```bash
# Put credentials in a local .env (gitignored) — see .env.example
echo 'SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co' >> .env
echo 'SUPABASE_SERVICE_KEY=YOUR_SERVICE_ROLE_KEY' >> .env

# Check what would happen first
python scripts/upload_tiles.py --dry-run

# Create the public bucket and upload
python scripts/upload_tiles.py --create-bucket
```

Expect **12,277 files, ~211 MB** (against the free tier's 1 GB cap) and roughly
10–25 minutes depending on your connection.

The uploader is **resumable**: it records successes in a local manifest, so if it
is interrupted, just run `python scripts/upload_tiles.py` again and it continues.
Uploads use upsert, so re-runs are safe.

| Flag | Purpose |
|---|---|
| `--dry-run` | Report what would upload, change nothing |
| `--create-bucket` | Create the public bucket first |
| `--workers N` | Parallel uploads (default 12) |
| `--limit N` | Upload only N tiles — good for a smoke test |
| `--force` | Re-upload everything, ignoring the manifest |
| `--bucket NAME` | Bucket name (default `victor-tiles`) |

On success it prints the value you need in Part C:

```
NEXT_PUBLIC_TILE_BASE_URL=https://YOUR_PROJECT_REF.supabase.co/storage/v1/object/public/victor-tiles
```

Verify one tile is publicly readable:

```bash
curl -I "https://YOUR_PROJECT_REF.supabase.co/storage/v1/object/public/victor-tiles/imagery/3/4/4.png"
```

`HTTP/2 200` with `content-type: image/png` means it worked. A `400` or `404`
usually means the bucket is not public — fix in Dashboard → **Storage** →
`victor-tiles` → **Settings** → make it public.

---

## 5. Part C — Render

### C.1 Deploy from the blueprint

The repository contains [`render.yaml`](../render.yaml), which defines both
services.

1. [dashboard.render.com](https://dashboard.render.com) → **New** → **Blueprint**
2. Connect the `ArpitSingh-01/VICTOR` repository
3. Render reads `render.yaml` and proposes **two** services: `victor-api` and
   `victor-web`
4. It will prompt for the variables marked `sync: false`. You can fill them now
   or after the first deploy — see C.2 for the chicken-and-egg note.
5. **Apply**

<details>
<summary>If you prefer to create the services manually</summary>

**Backend** — New → Web Service:

| Setting | Value |
|---|---|
| Runtime | Python 3 |
| Root directory | *(blank — the repository root)* |
| Build command | `pip install -r backend/requirements.txt` |
| Start command | `uvicorn backend.main:app --host 0.0.0.0 --port $PORT --workers 1` |
| Health check path | `/api/v1/health` |
| Plan | Free |

**Frontend** — New → Static Site:

| Setting | Value |
|---|---|
| Root directory | `frontend` |
| Build command | `npm ci && npm run build` |
| Publish directory | `out` |
| Rewrite rule | `/*` → `/index.html` (type: Rewrite) |

`--workers 1` is not arbitrary: 512 MB has no room for more, and the data grids
are loaded into memory once at startup.

</details>

### C.2 Set the environment variables

There is a **chicken-and-egg** here: each service needs the other's URL. Deploy
both first, note the two URLs Render assigns, then set the variables and
redeploy.

**On `victor-api`** (Environment tab):

| Key | Value |
|---|---|
| `PYTHON_VERSION` | `3.11` *(already in the blueprint)* |
| `DATABASE_URL` | The **pooler** string from B.3 — port **6543** |
| `FRONTEND_URL` | `https://victor-web.onrender.com` (your actual web URL) |
| `ALLOWED_ORIGINS` | *(optional)* comma-separated extra origins |

**On `victor-web`** (Environment tab):

| Key | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://victor-api.onrender.com` (your actual API URL) |
| `NEXT_PUBLIC_TILE_BASE_URL` | The Storage URL printed in B.5 |

> ### `NEXT_PUBLIC_*` variables are baked in at build time
>
> Next.js inlines them during `npm run build`. Changing either one requires a
> **full redeploy** of `victor-web`, not just a restart. Setting them and
> expecting a restart to pick them up is the most common mistake here.

Do **not** set `SUPABASE_SERVICE_KEY` on Render. It is only needed locally for
the tile upload.

### C.3 Redeploy

After setting the variables:

- `victor-api` → **Manual Deploy** → **Deploy latest commit**
- `victor-web` → **Manual Deploy** → **Clear build cache & deploy** (needed so
  the new `NEXT_PUBLIC_*` values are compiled in)

First builds take roughly 3–6 minutes each.

---

## 6. Part D — Verification

Work through these in order. Each one isolates a different failure.

### D.1 The API is up and the data is real

```bash
curl https://victor-api.onrender.com/api/v1/health
```

Be patient — the first request after idle takes ~50 s while the service wakes.

Check four things in the response:

```json
{
  "status": "ok",
  "data_mode": "VERIFIED_SNAPSHOT",
  "compliance": {
    "compliant": true,
    "mission_count": 4,
    "nasa_missions": ["2001 Mars Odyssey", "Mars 2020",
                      "Mars Global Surveyor", "Mars Reconnaissance Orbiter"]
  },
  "store": { "mode": "postgres", "healthy": true, "configured": true }
}
```

| Field | Must be | If it is not |
|---|---|---|
| `data_mode` | `VERIFIED_SNAPSHOT` | Synthetic grids got committed — regenerate (A.2) and redeploy |
| `compliance.compliant` | `true` | A data source is missing |
| `compliance.mission_count` | `4` | Same |
| `store.mode` | `postgres` | `DATABASE_URL` is wrong or unreachable — read `store.last_error` |

> `store.mode: "memory"` with `configured: true` means the variable is set but
> the database cannot be reached. The app still works, but computations will not
> survive a spin-down. `store.last_error` names the reason.

### D.2 The database is actually persisting

The honest test is a restart. Compute a route, restart the service, then ask for
its evidence:

```bash
API=https://victor-api.onrender.com

# Compute a route and keep its id
CID=$(curl -s -X POST $API/api/v1/routes/compute \
  -H 'Content-Type: application/json' \
  -d '{"start":{"lat":18.10,"lon":77.10},
       "destination":{"lat":18.80,"lon":77.90},
       "constraints":{"max_slope_deg":20.0,"max_eva_hours":6.0,"walking_speed_kmh":3.0},
       "strategies":["SAFEST","FASTEST","SCIENCE_RICHEST","BALANCED"]}' \
  | python -c "import json,sys; print(json.load(sys.stdin)['computation_id'])")
echo "computation: $CID"
```

Now **Manual Deploy → Restart** in the Render dashboard, wait for it to come
back, then:

```bash
curl -s "$API/api/v1/routes/$CID/segments/5/evidence?strategy=BALANCED" | head -c 200
```

Evidence returned → persistence works. `404` → it is not persisting; recheck
`store.mode` in D.1.

You can also run the live integration tests locally against the real database:

```bash
DATABASE_URL="your-pooler-connection-string" pytest backend/tests -v -k Live
```

Those four tests cover restart survival, route-cache persistence and
reconnect-after-drop. They skip without `DATABASE_URL`.

### D.3 Tiles are coming from Supabase, not the API

```bash
curl -I "https://YOUR_PROJECT_REF.supabase.co/storage/v1/object/public/victor-tiles/terrain/3/4/4.png"
```

Then open the deployed site, open DevTools → Network, filter for `.png`, and
confirm tile requests go to `supabase.co` and **not** to `onrender.com`. If they
go to Render, `NEXT_PUBLIC_TILE_BASE_URL` was not compiled in — redeploy
`victor-web` with the build cache cleared.

### D.4 The frontend works end to end

Open `https://victor-web.onrender.com` and check:

- The map renders with imagery (not a blank or brown rectangle)
- The demo route is drawn with four coloured strategies
- The layer panel lists layers; **10 of 11 are available** (only MCS dust is off,
  which is correct — no gridded MCS product exists)
- The provenance badge reads "VERIFIED — real NASA data from 4 missions"
- Clicking a route segment opens evidence with counterfactuals
- The Mission Report view generates a briefing and the report export opens

### D.5 Measure the thing nobody has measured

**Nothing has yet run on 0.1 shared CPU.** Desktop baselines, for comparison:

| Measurement | Desktop |
|---|---|
| 4-strategy route, uncached | **13.3 s** |
| Same route, cached | **0.24 s** |
| Cold start | n/a |

Record the real figures:

```bash
# Cold start — do this after >15 min idle
time curl -s -o /dev/null https://victor-api.onrender.com/api/v1/health

# Uncached computation (use a start/dest pair you have not tried)
time curl -s -o /dev/null -X POST $API/api/v1/routes/compute -H 'Content-Type: application/json' -d '...'

# Immediately repeat the identical request — should be a cache hit
time curl -s -o /dev/null -X POST $API/api/v1/routes/compute -H 'Content-Type: application/json' -d '...'
```

A 5–10× degradation versus desktop would put the uncached path in the tens of
seconds. If interactive planning is unusable, the mitigations in order are:

1. **Already done** — the demo route is precomputed and costs zero computation
2. **Already done** — the route cache makes repeats near-instant
3. **If still needed** — compute interactive requests on a coarser grid while
   the demo keeps full 300×300 resolution (not implemented; only do this if the
   measurement demands it)

Please share the numbers so the status report can state facts instead of
projections.

---

## 7. Free-tier constraints you must know

These are not hypothetical. Each one has already shaped the architecture.

### Render

| Constraint | Consequence | Handling |
|---|---|---|
| **Spin-down after 15 min idle** | ~50 s cold start | Frontend is a Static Site (always on); computations persist to Postgres |
| **512 MB RAM** | Heavy libraries will not fit | Production is 7 packages; GDAL/scipy/Pillow/scikit-learn are pipeline-only |
| **0.1 shared CPU** | Route computation is slow | Precomputed demo route + route cache |
| **Ephemeral filesystem** | Anything written at runtime is lost | Grids committed, tiles in Storage, reports streamed not written |
| **750 instance-hours/month** | ≈ 744 h in a 31-day month | See the warning below |
| **Build time limits** | Cannot generate data on the server | All artefacts generated locally in Part A |

> ### Do not keep the API warm all month
>
> 750 instance-hours is only about **6 hours more than a 31-day month**. An
> uptime pinger hitting `/api/v1/health` every 10 minutes would consume
> essentially the entire allowance, and the service would stop before the event.
>
> Enable a pinger (UptimeRobot, cron-job.org) **only a day or two before the
> hackathon**. A health check that also touches Postgres conveniently keeps
> Supabase clear of its idle pause at the same time.

### Supabase

| Constraint | Consequence | Handling |
|---|---|---|
| **Pauses after 7 days idle** | Database unreachable; `store.mode` drops to `memory` | **Check it is awake before demoing.** Opening the dashboard resumes it |
| **500 MB database** | Could fill with cached routes | Rows expire after 7 days (`COMPUTATION_TTL_SECONDS`) |
| **1 GB Storage** | Tiles must fit | 211 MB used — comfortable |
| **5 GB Storage egress/month** | Heavy traffic could exceed it | Tiles are served with a 1-year immutable cache header |
| **Low direct connection cap** | Connection exhaustion | Use the **pooler on 6543** |

> ### The 7-day pause is the single most likely demo-day failure
>
> If you deploy now and nobody touches the project until the hackathon, Supabase
> will have paused it. The app will still work — it degrades to in-memory — but
> you lose persistence, and `store.mode` will read `memory`. Check D.1 the day
> before.

---

## 8. Troubleshooting

### `data_mode` is `DEMONSTRATION` instead of `VERIFIED_SNAPSHOT`

The NASA data fetch did not succeed, so synthetic grids are in use. This matters:
real NASA data is a **mandatory** challenge requirement.

```bash
# Re-run the fetch and read the output carefully
python scripts/fetch_nasa_data.py

# Force a fresh fetch, ignoring the local window cache
python scripts/fetch_nasa_data.py --refetch
```

Look for `COMPLIANT : True` and `implied data mode: VERIFIED_SNAPSHOT`. Then
commit the regenerated grids under `backend/data/cache/` and redeploy.

Most likely causes: no network during the original run, a NASA/USGS archive
outage, or `rasterio` not installed (it is in `requirements-pipeline.txt`).

### Backend build fails on Render

- **`ModuleNotFoundError: No module named 'backend'`** — the start command must
  be `uvicorn backend.main:app` from the **repository root**. `backend/main.py`
  uses relative imports and cannot be loaded from inside `backend/`. Make sure
  the service's root directory is blank, not `backend`.
- **Build timeout or OOM** — check the build command is
  `pip install -r backend/requirements.txt`. If it is installing
  `requirements-pipeline.txt`, it is pulling GDAL and will struggle.

### `store.mode` is `memory` but `configured` is `true`

The database is set but unreachable. Read `store.last_error` in the health
response.

- **Authentication failed** — wrong password, or special characters need
  URL-encoding (`@` → `%40`)
- **Timeout / connection refused** — Supabase project is paused (open the
  dashboard to resume) or the host is wrong
- **`psycopg is not installed`** — `backend/requirements.txt` includes
  `psycopg[binary]`; check the build log actually installed it

### Tile routes return 404 and the map is blank — on a LOCAL fresh clone

**Most likely cause: you have not run `python scripts/bootstrap.py` yet.**

Tiles are gitignored generated artefacts, so a fresh clone has none. Everything
else will look perfectly healthy — the backend boots, `/api/v1/health` is `ok`,
all API endpoints return 200 — and only the tile routes 404.

```bash
# Confirm the diagnosis: this should report 12277
find backend/data/tiles -name '*.png' | wc -l

# Fix
python scripts/bootstrap.py
```

If the count is 0 or low, tile generation has not run or did not finish. It
takes 5–15 minutes. `python scripts/generate_tiles.py` runs just that step.

### Map is blank, or tiles 404 — on the DEPLOYED site

1. Confirm tiles uploaded: `python scripts/upload_tiles.py --dry-run` should
   report `pending: 0`
2. Confirm the bucket is public (B.5)
3. Confirm `NEXT_PUBLIC_TILE_BASE_URL` has **no trailing slash** and ends in the
   bucket name
4. **Redeploy `victor-web` with the build cache cleared** — `NEXT_PUBLIC_*` is
   compiled in, so a restart is not enough
5. In DevTools → Network, check where tile requests are actually going

### CORS errors in the browser console

`FRONTEND_URL` on `victor-api` must exactly match the frontend's origin —
including `https://` and with no trailing slash. Add any extra origins to
`ALLOWED_ORIGINS` as a comma-separated list. `localhost` is always permitted, so
local development against the deployed API keeps working.

### First request takes ~50 seconds

Expected — that is the free-tier cold start. The frontend is a Static Site so it
loads immediately; only API calls wait. See the pinger note in §7.

### Route computation times out

The free instance is slow. The demo route (`/api/v1/routes/demo`) is precomputed
and instant. For arbitrary routes, the first request for a given start/destination
pair is slow and the repeat is cached. If this is unusable, see D.5.

### Segment evidence 404s after a while

`store.mode` is `memory`, so the `computation_id` died with the process. Fix
`DATABASE_URL` (D.1).

---

## 9. Pre-demo checklist

Run this **24 hours before** and again **1 hour before** the demo.

```bash
API=https://victor-api.onrender.com
WEB=https://victor-web.onrender.com
```

- [ ] **Supabase is awake** — open the dashboard; if it says paused, resume it
      and wait for provisioning
- [ ] **API is warm** — two consecutive `curl $API/api/v1/health` return in under
      a second
- [ ] **Data is real** — `data_mode` is `VERIFIED_SNAPSHOT`,
      `compliance.compliant` is `true`, `mission_count` is `4`
- [ ] **Persistence is live** — `store.mode` is `postgres`, `healthy` is `true`
- [ ] **Tiles load** — open `$WEB`, confirm imagery renders and DevTools shows
      tiles coming from `supabase.co`
- [ ] **Demo route loads instantly** — `curl $API/api/v1/routes/demo` returns
      four strategies
- [ ] **A fresh route computes** — pick an untried start/destination and confirm
      it completes
- [ ] **Report export works** — open the Mission Report view, generate a
      briefing, open the report
- [ ] **Local fallback is ready** — the laptop running the demo has the full
      stack working offline

> ### The local build is the primary demo path
>
> Have `uvicorn backend.main:app` and `npm run dev` working on the demo machine
> before you walk in. The deployed URL is supporting evidence that it is really
> live; it should not be the thing standing between you and a working
> demonstration. The app runs fully offline by design.

---

## 10. Environment variable reference

Full annotated version: [`.env.example`](../.env.example).

### `victor-api` (Render Web Service)

| Variable | Required | Example | Notes |
|---|---|---|---|
| `PYTHON_VERSION` | Yes | `3.11` | Already in `render.yaml` |
| `DATABASE_URL` | Recommended | `postgresql://postgres.ref:pw@aws-0-us-west-1.pooler.supabase.com:6543/postgres` | **Pooler, port 6543.** Without it the store is memory-only |
| `FRONTEND_URL` | Yes | `https://victor-web.onrender.com` | CORS. Exact origin, no trailing slash |
| `ALLOWED_ORIGINS` | No | `https://preview.onrender.com` | Comma-separated extra origins |
| `COMPUTATION_TTL_SECONDS` | No | `604800` | Row expiry, default 7 days |
| `GEMINI_API_KEY` | No | — | Enables the LLM briefing. Without it a deterministic template produces a complete brief offline |

### `victor-web` (Render Static Site)

| Variable | Required | Example | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | Yes | `https://victor-api.onrender.com` | Baked in at build time |
| `NEXT_PUBLIC_TILE_BASE_URL` | Yes | `https://ref.supabase.co/storage/v1/object/public/victor-tiles` | No trailing slash. Baked in at build time |

### Local only — never on Render

| Variable | Used by | Notes |
|---|---|---|
| `SUPABASE_URL` | `scripts/upload_tiles.py` | `https://YOUR_REF.supabase.co` |
| `SUPABASE_SERVICE_KEY` | `scripts/upload_tiles.py` | **`service_role` key.** Bypasses RLS — never expose it |
| `DIRECT_DATABASE_URL` | `psql` migrations | Direct connection, port 5432 |

---

## Quick reference

```bash
# Local artefact generation — DO THIS FIRST.
# Without it the map is blank and tile routes 404, even though everything
# else reports healthy. Generates 12,277 tiles (~211 MB), 5-15 minutes.
python scripts/bootstrap.py

# Apply the schema (direct connection, port 5432)
psql "$DIRECT_DATABASE_URL" -f supabase/migrations/0001_init.sql

# Upload tiles (12,277 files, ~211 MB)
python scripts/upload_tiles.py --create-bucket

# Verify the deployment
curl https://victor-api.onrender.com/api/v1/health

# Run the live database tests
DATABASE_URL="..." pytest backend/tests -v -k Live
```

**Further reading:** [`README.md`](../README.md) for the project overview ·
[`docs/PROJECT_STATUS_REPORT.md`](PROJECT_STATUS_REPORT.md) for current status and
known gaps · [`.env.example`](../.env.example) for annotated variables.

Questions about anything in this guide should go to whoever built the backend —
particularly if a verification step in Part D fails in a way the troubleshooting
section does not cover.
