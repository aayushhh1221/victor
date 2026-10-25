# VICTOR — Deployment Guide

Deploy target: **two separate Render projects** (FastAPI backend + static Next.js
frontend) and **one Supabase free-tier project** (Postgres + object storage).
Everything below reflects the repository as it stands; commands were verified
against it.

---

## 1. What deploys where, and why

| Piece | Service | Plan | Notes |
|---|---|---|---|
| Backend API | Render **Web Service** (`victor-api`) | Free | Spins down after 15 min idle; ~50 s cold start |
| Frontend UI | Render **Static Site** (`victor-web`) | Free | Always-on CDN — never spins down |
| Database | Supabase **Postgres** | Free | Persists computations across API spin-downs |
| Map tiles | Supabase **Storage** bucket `victor-tiles` | Free | 202 MB pyramid, CDN-served to the browser |

Why this split: the frontend is a Next.js **static export** (`output: 'export'`),
so it needs no Node server — a free Render Static Site is always-on and loads
instantly even while the API is still waking from a spin-down. The API is the
only billable web service, so even keeping it warm 24/7 with a pinger fits the
free 750 instance-hours (~744 h used). The database exists because a Render
spin-down wipes process memory *and* the runtime disk cache — Postgres is the
only layer that survives it.

**Never add the ingestion pipeline to any deploy build.** It needs GDAL/rasterio
(~100 MB+ of native libs) and exceeds the free build limits. Grids are committed;
tiles are pre-rendered and uploaded once.

---

## 2. Prerequisites

- GitHub repo with **everything committed and pushed** — Render builds from the
  pushed commit, not your working tree.
- Render account; Supabase account.
- Locally: Python 3.11+, Node 18+, `pip install -r backend/requirements.txt -r
  requirements-dev.txt` (for the verification gate in §7).

---

## 3. Part A — Supabase (database + tile storage)

### A.1 Create the project
Create one Supabase project (any region close to `oregon`). Note the project ref.

### A.2 Apply the schema
Use the **direct** connection (port 5432) or the Supabase SQL Editor — *not* the
pooler; pgbouncer in transaction mode does not support every DDL statement.

```bash
psql "postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres" \
  -f supabase/migrations/0001_init.sql
```

Or paste the file into Dashboard → SQL Editor → Run. The migration is fully
idempotent (`IF NOT EXISTS` throughout). Note: `supabase db push` (CLI) will not
pick up the `0001_init.sql` filename — use SQL Editor/psql.

Two connection strings come out of this; do not mix them up:
- **`DIRECT_DATABASE_URL`** — port **5432** — for migrations only.
- **`DATABASE_URL`** — port **6543** (pooler, transaction mode) — what the API
  uses at runtime. Format:
  `postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres`

The backend connects as the `postgres` role, which owns these tables and
therefore bypasses their RLS. RLS with no policies blocks the `anon` role —
which is exactly the point, since it is the only role a browser could ever carry.

### A.3 Upload the map tiles
The 202 MB / ~12,000-file tile pyramid is **gitignored by design** (Render's
filesystem is ephemeral — committing it would not survive redeploys anyway; and
streaming that many PNGs through a 0.1-shared-CPU API would be the slowest thing
the app does).

Add to `.env` at the repo root (server-side only — the service_role key bypasses
RLS and must never reach the browser):

```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_KEY=<service_role key>
```

Then:

```bash
python scripts/upload_tiles.py --create-bucket   # one-time: bucket + full upload
python scripts/upload_tiles.py                   # resume an interrupted run
python scripts/upload_tiles.py --dry-run         # see what would happen
```

This creates the **public** bucket `victor-tiles`. The public URL you will paste
into *both* platform dashboards is:

```
https://<project-ref>.supabase.co/storage/v1/object/public/victor-tiles
```

---

## 4. Part B — Render backend (`victor-api`)

Either use **Blueprint** (New → Blueprint, point at the repo — `render.yaml`
supplies everything) or create a Web Service manually with:

| Setting | Value |
|---|---|
| Runtime | Python 3.11 (`PYTHON_VERSION` env var) |
| Build command | `pip install -r backend/requirements.txt` |
| Start command | `uvicorn backend.main:app --host 0.0.0.0 --port $PORT --workers 1` |
| Health check | `/api/v1/health` |

Environment variables:

| Var | Value | Why |
|---|---|---|
| `DATABASE_URL` | Supabase **pooler** URL (6543) | Persists computations across spin-downs |
| `TILES_EXTERNAL_URL` | `https://<ref>.supabase.co/storage/v1/object/public/victor-tiles` | The deploy has **no local tiles**; without this `/map/layers` reports every tile layer unavailable and the deployed map can never enable a basemap |
| `FRONTEND_URL` | `https://<victor-web>.onrender.com` | CORS — set after Part C's first deploy, then restart |
| `ALLOWED_ORIGINS` | optional comma-separated extras | Preview deploys, custom domain |

`localhost` origins are always permitted in addition, so local development keeps
working against the deployed backend.

Do not run the pipeline in the build. Do not raise workers above 1 (512 MB RAM).

---

## 5. Part C — Render frontend (`victor-web`)

Create a **Static Site** (not a Web Service):

| Setting | Value |
|---|---|
| Root directory | `frontend` |
| Build command | `npm ci && npm run build` |
| Publish directory | `out` |

Environment variables — **these are baked in at build time**; changing them
later requires a redeploy, not just a restart:

| Var | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://victor-api.onrender.com` (the Part B URL) |
| `NEXT_PUBLIC_TILE_BASE_URL` | same value as the backend's `TILES_EXTERNAL_URL` |

`render.yaml` also carries a rewrite (`/* → /index.html`) so unmatched paths
fall back to the home page; real route files (`/planner/` etc.) are served
directly by the static export.

---

## 6. Part D — Close the loop and smoke-test

1. Set `FRONTEND_URL` on the backend to the deployed frontend URL; **restart**
   the backend service (env changes need a restart, and CORS is read at startup).
2. Open `https://<victor-web>.onrender.com` — the planner should hydrate with
   the precomputed demo route.
3. Walk this checklist:

| Check | Expected |
|---|---|
| `GET https://<api>/api/v1/health` | `status: ok`, `data_mode: VERIFIED_SNAPSHOT`, `store.mode: postgres` |
| Map loads | Imagery tiles render from the Supabase CDN (Network tab: requests to `supabase.co/storage`, 200s) |
| Plan a route | 4 strategies return in seconds on a warm cache (first hit may take tens of seconds on cold 0.1 CPU) |
| Click a route segment | Evidence popup populates |
| **Spin-down test** | Wait 15+ minutes idle, reload the planner, click the same segment → **no 404**. This is the database doing its job |
| Mission report | HTML report + PDF export render with provenance appendix |

The spin-down test is the one that proves the deployment is correct end to end.

---

## 7. Verification gate before going live (one minute, locally)

The 4 live-database tests skip without a `DATABASE_URL`. Once Supabase exists,
put the **pooler** URL in your local `.env` and run the full suite — those tests
activate and exercise the real write/read/cache/health path end to end:

```bash
python -m pytest backend/tests -q
# expect: 103 passed, 0 skipped (with DATABASE_URL set)
```

If any live test fails, do not deploy — fix first. (Client-side analysis says
the jsonb round-trip is sound, but this gate is what turns that into a fact.)

---

## 8. Demo-day runbook

1. **Wake Supabase** — free projects pause after 7 days idle. Open the dashboard
   and run one query (`select 1;` in SQL Editor) shortly before the event.
2. **Warm the API** — hit `https://<api>/api/v1/health` in a browser ~1 minute
   before presenting to absorb the ~50 s cold start. The static frontend loads
   instantly regardless; the UI shows honest loading states while the API wakes.
3. Keep `https://<api>/docs` open in a spare tab — judges like the OpenAPI page.
4. If the API spin-down is unacceptable for a long judging window, enable an
   uptime pinger on the health endpoint — it fits the free hour allowance as
   long as this is your only Render web service.

---

## 9. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Backend crashes on boot: `ModuleNotFoundError: reportlab` | Prod requirements out of date | Fixed in repo (`reportlab` + `Pillow` in `backend/requirements.txt`) — redeploy |
| `/api/v1/health` says `store.mode: memory` despite `DATABASE_URL` set | Supabase paused, or wrong (direct 5432) URL | Wake project; use the pooler URL; check `store.last_error` in the same response |
| Segment evidence 404s after idle | Spin-down with no persistence | `DATABASE_URL` missing/wrong on the API |
| Map blank, layer toggles disabled, "Grid ingested but map tiles not yet rendered" | `TILES_EXTERNAL_URL` unset on the **backend** | Set it to the bucket URL and restart |
| Map loads but tiles 404 in Network tab | `NEXT_PUBLIC_TILE_BASE_URL` unset or wrong on the **frontend** | Set it to the same bucket URL; **rebuild** the frontend |
| CORS errors in browser console | `FRONTEND_URL` on the API doesn't match the deployed frontend origin | Set it and restart the API |
| Manifest integrity failure in logs; app degrades to `DEMONSTRATION` | A committed cache file changed without updating `data_manifest.json` | `python scripts/update_manifest.py` then commit — never edit cache files and ignore this |
| Frontend serves unstyled HTML; all `/_next/static/*` 404 | Corrupted `.next` dev cache | Stop dev server, delete `frontend/.next`, restart `npm run dev` |
| First route compute takes tens of seconds | 0.1 shared CPU, cold cache | Expected; warm cache hits are indexed reads. The demo route is precomputed and instant |

---

## 10. Free-tier limits to keep in mind

| Limit | Value | Mitigation |
|---|---|---|
| Render web service | 512 MB RAM, 0.1 shared CPU, spins down after 15 min idle, ~50 s wake | Single worker; precomputed demo; route cache; pinger if needed |
| Render instance hours | 750 h/month | One web service 24/7 ≈ 744 h — do **not** add a second Render web service |
| Supabase database | 500 MB | 7-day TTL purge (`COMPUTATION_TTL_SECONDS`) keeps it bounded |
| Supabase project | Pauses after 7 days idle | Wake before the event |
| Supabase storage | 1 GB | Tile pyramid ≈ 200 MB — headroom fine |
