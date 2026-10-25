"""
VICTOR — Computation result store and route cache.

Route computations are referenced later by `computation_id`: segment evidence,
science profiles and scenario comparisons all look up a prior result. Holding
those in a plain process dict works on a long-lived server and fails on the
deployment target.

Render's free tier spins a service down after 15 minutes idle. The failure that
produces is user-facing and specific:

  1. A judge computes a route and gets a computation_id.
  2. They read the results for 15 minutes — entirely normal during evaluation.
  3. The service spins down; the dict is erased.
  4. They click a route segment for its evidence.
  5. 404.

This module keeps the dict-like interface the routers already use
(`store[key] = value`, `store.get(key)`), so `route.py`, `science.py` and
`scenario.py` need no changes, while adding:

  * optional Postgres persistence (Supabase), enabled by DATABASE_URL
  * reconnect-on-failure, because a connection that drops must not silently
    disable persistence for the rest of the process lifetime
  * a route cache, so a repeated computation is a single indexed read instead
    of a multi-second A* run on 0.1 shared CPU
  * LRU eviction so memory is bounded on a 512 MB instance
  * TTL expiry so the 500 MB free-tier database stays bounded
  * health reporting, so a degraded store is visible rather than invisible

Persistence is strictly optional. With no DATABASE_URL the store is in-memory
only and the app runs completely offline — a hard requirement here, because the
demo is given from localhost and the free tier is too fragile to depend on.
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import time
from collections import OrderedDict
from typing import Any, Callable, Optional, TypeVar

logger = logging.getLogger("victor.computation_store")

# Bound memory on a 512 MB instance. Each entry is one response with four
# routes; a few hundred is far more than a demo or judging session needs.
MAX_MEMORY_ENTRIES = 200

# Drop persisted rows after this long. Prevents the free tier's 500 MB database
# filling up from repeated use.
DEFAULT_TTL_SECONDS = 7 * 24 * 3600

# After a failed database operation, wait at least this long before attempting
# another connection. Without a floor, every request would pay the full connect
# timeout while the database is down, turning a degraded feature into a stalled
# API.
RECONNECT_COOLDOWN_SECONDS = 30.0

T = TypeVar("T")


def _normalise_weight_overrides(
    weight_overrides: Optional[dict],
) -> Optional[dict]:
    """Normalise weight overrides to a stable, JSON-safe form.

    Accepts both shapes the API schema permits — flat
    ``{"hazard": 2.0}`` and per-strategy ``{"SAFEST": {"hazard": 2.0}}`` —
    rounding floats to 4 decimal places so float noise cannot defeat the cache.
    Anything else raises, because silently hashing an unexpected shape would
    make one request's key collide with another's.
    """
    if not weight_overrides:
        return None

    def norm_value(value):
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError(f"Weight override values must be numbers, got {value!r}")
        return round(float(value), 4)

    normalised: dict = {}
    for key in sorted(weight_overrides):
        value = weight_overrides[key]
        if isinstance(value, dict):
            normalised[key] = {k: norm_value(v) for k, v in sorted(value.items())}
        else:
            normalised[key] = norm_value(value)
    return normalised


def route_cache_key(
    start_lat: float,
    start_lon: float,
    dest_lat: float,
    dest_lon: float,
    constraints: dict,
    strategies: Optional[list[str]] = None,
    weight_overrides: Optional[dict] = None,
    data_manifest_id: Optional[str] = None,
    allow_infeasible: bool = False,
) -> str:
    """Stable cache key for a route computation.

    Coordinates are rounded to 5 decimal places (~1 m at Mars scale, far finer
    than the 177.5 m grid cell) so that floating-point noise in a request does
    not defeat the cache, while genuinely different start points still miss.

    Every input that changes the engine's output must appear here: weight
    overrides change the A* cost function, and allow_infeasible decides whether
    over-budget routes are returned or rejected — omitting either once served a
    cached response computed under different weights.

    Lives here rather than in the router so the hashing rule sits next to the
    table that depends on it.
    """
    payload = {
        "start": [round(start_lat, 5), round(start_lon, 5)],
        "dest": [round(dest_lat, 5), round(dest_lon, 5)],
        "constraints": {k: constraints[k] for k in sorted(constraints)},
        "strategies": sorted(strategies) if strategies else None,
        "weight_overrides": _normalise_weight_overrides(weight_overrides),
        "allow_infeasible": bool(allow_infeasible),
        "data_manifest_id": data_manifest_id,
    }
    blob = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


class _Database:
    """Postgres connection with lazy reconnect and honest health reporting.

    The previous implementation connected once at construction and never
    retried. Supabase's free tier pauses a project after 7 days idle and
    recycles connections on its own schedule, so the first drop would disable
    persistence for the process lifetime — silently reintroducing the 404 bug
    this store exists to prevent. Every operation now goes through `run()`,
    which reconnects on failure and degrades to memory rather than raising.
    """

    def __init__(self, url: str):
        self._url = url
        self._conn = None
        self._last_error: Optional[str] = None
        self._last_attempt = 0.0
        self._driver_missing = False
        self.connect()

    # ── Connection lifecycle ─────────────────────────────────────────────────

    def connect(self) -> bool:
        """(Re)establish the connection. Returns True on success."""
        if self._driver_missing:
            return False

        now = time.monotonic()
        if self._conn is None and (now - self._last_attempt) < RECONNECT_COOLDOWN_SECONDS:
            # Still cooling down from a recent failure; do not stall the request.
            return False
        self._last_attempt = now

        try:
            import psycopg  # type: ignore
        except ImportError:
            self._driver_missing = True
            self._last_error = "psycopg is not installed"
            logger.warning(
                "DATABASE_URL is set but psycopg is not installed; "
                "store is in-memory only. Install psycopg[binary] to persist."
            )
            return False

        try:
            self._close_quietly()
            # connect_timeout keeps a dead host from blocking a request for the
            # OS default (which can be minutes).
            self._conn = psycopg.connect(self._url, autocommit=True, connect_timeout=5)
            self._ensure_schema()
            self._last_error = None
            logger.info("Computation store connected to Postgres.")
            return True
        except Exception as exc:
            self._conn = None
            self._last_error = f"{type(exc).__name__}: {exc}"
            logger.warning(f"Database connection failed ({exc}); using memory only.")
            return False

    def _close_quietly(self) -> None:
        if self._conn is not None:
            try:
                self._conn.close()
            except Exception:
                pass
            self._conn = None

    def _ensure_schema(self) -> None:
        """Create tables if absent.

        A safety net so a fresh project works without the migration having been
        applied. supabase/migrations/0001_init.sql is the reviewable source of
        truth and includes RLS, which this does not.
        """
        statements = [
            """
            CREATE TABLE IF NOT EXISTS computations (
                computation_id TEXT PRIMARY KEY,
                payload        JSONB NOT NULL,
                created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
            )
            """,
            "CREATE INDEX IF NOT EXISTS computations_created_at_idx ON computations (created_at)",
            """
            CREATE TABLE IF NOT EXISTS route_cache (
                cache_key  TEXT PRIMARY KEY,
                payload    JSONB NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
            """,
            "CREATE INDEX IF NOT EXISTS route_cache_created_at_idx ON route_cache (created_at)",
        ]
        with self._conn.cursor() as cur:
            for sql in statements:
                cur.execute(sql)

    # ── Operation wrapper ────────────────────────────────────────────────────

    def run(self, operation: Callable[[Any], T], what: str) -> Optional[T]:
        """Execute `operation(cursor)`, reconnecting once if the connection died.

        Returns the operation's result, or None if the database is unavailable.
        Never raises: the caller falls back to memory, because route planning
        must not fail just because persistence is down.
        """
        if self._conn is None and not self.connect():
            return None

        for attempt in (1, 2):
            try:
                with self._conn.cursor() as cur:
                    return operation(cur)
            except Exception as exc:
                self._last_error = f"{type(exc).__name__}: {exc}"
                self._conn = None
                if attempt == 1:
                    logger.info(f"{what} failed ({exc}); reconnecting and retrying once.")
                    if self.connect():
                        continue
                logger.warning(f"{what} failed after reconnect: {exc}")
                return None
        return None

    # ── Health ───────────────────────────────────────────────────────────────

    @property
    def connected(self) -> bool:
        return self._conn is not None

    @property
    def last_error(self) -> Optional[str]:
        return self._last_error


class ComputationStore:
    """Dict-like store for route computations, optionally Postgres-backed.

    Deliberately synchronous: the routers call this synchronously and the
    payloads are small, so an async interface would mean restructuring three
    routers for no measurable gain.
    """

    def __init__(
        self,
        database_url: Optional[str] = None,
        ttl_seconds: int = DEFAULT_TTL_SECONDS,
    ):
        self._memory: OrderedDict[str, dict] = OrderedDict()
        self._route_cache_memory: OrderedDict[str, dict] = OrderedDict()
        self._ttl = ttl_seconds
        self._db: Optional[_Database] = None

        url = database_url if database_url is not None else os.environ.get("DATABASE_URL", "")
        if url:
            self._db = _Database(url)
            self._purge_expired()
        else:
            logger.info(
                "No DATABASE_URL set — computation store is in-memory only. "
                "Results will not survive a restart."
            )

    # ── Health ───────────────────────────────────────────────────────────────

    @property
    def persistent(self) -> bool:
        """True when a live database connection is backing this store."""
        return self._db is not None and self._db.connected

    def health(self) -> dict:
        """Store status, for /api/v1/health.

        Reports what is actually true rather than what was configured — a store
        that was given a DATABASE_URL but cannot reach it must not claim to be
        persistent.
        """
        if self._db is None:
            return {
                "mode": "memory",
                "healthy": True,
                "configured": False,
                "last_error": None,
                "entries": len(self._memory),
                "note": "No DATABASE_URL configured; results will not survive a restart.",
            }
        connected = self._db.connected
        return {
            "mode": "postgres" if connected else "memory",
            "healthy": connected,
            "configured": True,
            "last_error": self._db.last_error,
            "entries": len(self._memory),
            "note": None if connected else "Database configured but unreachable; degraded to memory.",
        }

    # ── Dict-like interface used by the routers ──────────────────────────────

    def __setitem__(self, key: str, value: dict) -> None:
        self._remember(self._memory, key, value)
        self._persist(key, value)

    def __getitem__(self, key: str) -> dict:
        found = self.get(key)
        if found is None:
            raise KeyError(key)
        return found

    def __contains__(self, key: str) -> bool:
        return self.get(key) is not None

    def __len__(self) -> int:
        return len(self._memory)

    def get(self, key: str, default: Any = None) -> Any:
        """Return a stored computation, rehydrating from the database if needed."""
        if key in self._memory:
            self._memory.move_to_end(key)
            return self._memory[key]

        restored = self._load(key)
        if restored is not None:
            # Warm the cache so repeat lookups stay in memory.
            self._remember(self._memory, key, restored)
            return restored
        return default

    @staticmethod
    def _remember(bucket: OrderedDict, key: str, value: dict) -> None:
        """Insert into an LRU bucket, evicting the least recently used."""
        bucket[key] = value
        bucket.move_to_end(key)
        while len(bucket) > MAX_MEMORY_ENTRIES:
            evicted, _ = bucket.popitem(last=False)
            logger.debug(f"Evicted {evicted} (memory bound reached)")

    # ── Route cache ──────────────────────────────────────────────────────────

    def get_cached_route(self, cache_key: str) -> Optional[dict]:
        """Return a previously computed response payload, or None on a miss.

        This is what keeps interactive planning usable on 0.1 shared CPU, where
        a fresh 4-strategy computation is projected at tens of seconds.
        """
        if cache_key in self._route_cache_memory:
            self._route_cache_memory.move_to_end(cache_key)
            return self._route_cache_memory[cache_key]

        if self._db is None:
            return None

        def op(cur):
            cur.execute("SELECT payload FROM route_cache WHERE cache_key = %s", (cache_key,))
            return cur.fetchone()

        row = self._db.run(op, "route cache lookup")
        if not row:
            return None
        payload = row[0]
        self._remember(self._route_cache_memory, cache_key, payload)
        return payload

    def put_cached_route(self, cache_key: str, payload: dict) -> None:
        """Store a computed response payload against its input hash."""
        self._remember(self._route_cache_memory, cache_key, payload)
        if self._db is None:
            return

        def op(cur):
            cur.execute(
                """
                INSERT INTO route_cache (cache_key, payload)
                VALUES (%s, %s)
                ON CONFLICT (cache_key)
                DO UPDATE SET payload = EXCLUDED.payload, created_at = now()
                """,
                (cache_key, json.dumps(payload)),
            )
            return True

        self._db.run(op, "route cache write")

    # ── Database round-trip ──────────────────────────────────────────────────

    def _persist(self, key: str, value: dict) -> None:
        if self._db is None:
            return
        payload = self._serialise(value)
        if payload is None:
            return

        def op(cur):
            cur.execute(
                """
                INSERT INTO computations (computation_id, payload)
                VALUES (%s, %s)
                ON CONFLICT (computation_id)
                DO UPDATE SET payload = EXCLUDED.payload, created_at = now()
                """,
                (key, json.dumps(payload)),
            )
            return True

        self._db.run(op, f"persist computation {key}")

    def _load(self, key: str) -> Optional[dict]:
        if self._db is None:
            return None

        def op(cur):
            cur.execute(
                "SELECT payload FROM computations WHERE computation_id = %s", (key,)
            )
            return cur.fetchone()

        row = self._db.run(op, f"load computation {key}")
        if not row:
            return None
        return self._deserialise(row[0])

    def _purge_expired(self) -> None:
        if self._db is None:
            return

        def op(cur):
            for table in ("computations", "route_cache"):
                cur.execute(
                    f"DELETE FROM {table} "
                    f"WHERE created_at < now() - make_interval(secs => %s)",
                    (self._ttl,),
                )
            return True

        self._db.run(op, "TTL purge")

    # ── Serialisation ────────────────────────────────────────────────────────

    def _serialise(self, value: dict) -> Optional[dict]:
        """Convert a stored entry to JSON-safe form.

        Entries hold Pydantic models (the response, routes, and request). Storing
        the request preserves full scenario analysis capabilities across restarts.
        """
        try:
            response = value.get("response")
            if response is None or not hasattr(response, "model_dump_json"):
                return None
            result = {"response": json.loads(response.model_dump_json())}
            req = value.get("request")
            if req is not None and hasattr(req, "model_dump_json"):
                result["request"] = json.loads(req.model_dump_json())
            return result
        except Exception as exc:
            logger.warning(f"Could not serialise computation: {exc}")
            return None

    def _deserialise(self, payload: dict) -> Optional[dict]:
        """Rebuild a store entry from its persisted form."""
        try:
            from ..models.schemas import RouteComputeRequest, RouteComputeResponse

            response = RouteComputeResponse.model_validate(payload["response"])
            req_data = payload.get("request")
            request_obj = RouteComputeRequest.model_validate(req_data) if req_data else None
            return {
                "response": response,
                "routes": response.strategies,
                "request": request_obj,
            }
        except Exception as exc:
            logger.warning(f"Could not deserialise computation: {exc}")
            return None


def build_store() -> ComputationStore:
    """Create the process-wide store from the environment."""
    ttl = int(os.environ.get("COMPUTATION_TTL_SECONDS", DEFAULT_TTL_SECONDS))
    return ComputationStore(ttl_seconds=ttl)
