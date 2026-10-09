-- VICTOR — initial schema
--
-- Apply with either:
--   psql "$DIRECT_DATABASE_URL" -f supabase/migrations/0001_init.sql
--   or paste into the Supabase SQL Editor
--
-- Use the DIRECT connection (port 5432) for migrations, not the pooler (6543).
-- pgbouncer in transaction mode does not support every DDL statement reliably.
--
-- The application also creates these tables at startup with CREATE TABLE IF NOT
-- EXISTS, so a fresh project will not break on a forgotten migration. This file
-- is the reviewable source of truth; the runtime create is a safety net.

-- ---------------------------------------------------------------------------
-- computations
--
-- Route results are referenced later by computation_id: segment evidence,
-- science profiles and scenario comparisons all look up a prior result.
--
-- Without this table those lookups live only in process memory, and the
-- deployment target (Render free tier) spins a service down after 15 minutes
-- idle. The resulting failure is specific and user-facing: a judge computes a
-- route, reads it for 15 minutes, clicks a segment for its evidence, and gets a
-- 404 because the id died with the process.
-- ---------------------------------------------------------------------------
create table if not exists computations (
    computation_id text        primary key,
    payload        jsonb       not null,
    created_at     timestamptz not null default now()
);

-- Supports the TTL purge, which keeps the 500 MB free-tier database bounded.
create index if not exists computations_created_at_idx
    on computations (created_at);

-- ---------------------------------------------------------------------------
-- route_cache
--
-- A 4-strategy computation takes 2.1-2.9 s PER STRATEGY on a desktop. The
-- deployment target gives 0.1 shared CPU, where that projects to tens of
-- seconds per request. Caching completed computations by their inputs turns a
-- repeated query into a single indexed read.
--
-- cache_key is a hash of (start, destination, constraints, strategy set) —
-- computed by the application so the hashing rule lives next to the code that
-- depends on it.
-- ---------------------------------------------------------------------------
create table if not exists route_cache (
    cache_key   text        primary key,
    payload     jsonb       not null,
    created_at  timestamptz not null default now()
);

create index if not exists route_cache_created_at_idx
    on route_cache (created_at);

-- ---------------------------------------------------------------------------
-- mission_briefings
--
-- Generated narrative briefings, cached against the computation that produced
-- them. On a 0.1 CPU instance, and with an LLM call behind it, regenerating a
-- briefing on every view would be the slowest and most expensive thing the app
-- does. Keyed to computation_id so a cached briefing can never be shown
-- alongside a different route than the one it describes.
-- ---------------------------------------------------------------------------
create table if not exists mission_briefings (
    computation_id text        primary key,
    strategy       text        not null,
    briefing       jsonb       not null,
    generator      text        not null,  -- 'llm' or 'template'
    created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- These tables hold derived, non-personal computation results and are written
-- only by the backend using the service role, which bypasses RLS. RLS is
-- enabled with no permissive policy so that the anon/public key — which the
-- frontend would carry — cannot read or write them. Storage (map tiles) is the
-- only thing the browser reads directly, and that is a separate public bucket.
-- ---------------------------------------------------------------------------
alter table computations      enable row level security;
alter table route_cache       enable row level security;
alter table mission_briefings enable row level security;
