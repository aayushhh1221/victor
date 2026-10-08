"""
VICTOR — Computation result store.

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

A redeploy does the same, and the plain dict had no eviction, so it also grew
without bound on a 512 MB instance.

This module keeps the dict-like interface the routers already use
(`store[key] = value`, `store.get(key)`), so `route.py`, `science.py` and
`scenario.py` need no changes, while adding:

  * optional Postgres persistence (Supabase), enabled by DATABASE_URL
  * LRU eviction so memory is bounded
  * TTL expiry so the table does not grow forever

Persistence is strictly optional. With no DATABASE_URL the store is in-memory
only and the app runs completely offline — which is a hard requirement here,
because the demo is given from localhost and the free tier is too fragile to
depend on.
"""
from __future__ import annotations

import json
import logging
import os
import time
from collections import OrderedDict
from typing import Any, Optional

logger = logging.getLogger("victor.computation_store")

# Bound memory on a 512 MB instance. Each entry is one response with four
# routes; a few hundred is far more than a demo or judging session needs.
MAX_MEMORY_ENTRIES = 200

# Drop persisted rows after this long. Prevents the free tier's 500 MB database
# filling up from repeated use.
DEFAULT_TTL_SECONDS = 7 * 24 * 3600


class ComputationStore:
    """Dict-like store for route computations, optionally Postgres-backed.

    Deliberately not an async interface: the routers call this synchronously and
    the payloads are small. Keeping it synchronous avoids restructuring three
    routers for no measurable gain.
    """

    def __init__(self, database_url: Optional[str] = None, ttl_seconds: int = DEFAULT_TTL_SECONDS):
        self._memory: OrderedDict[str, dict] = OrderedDict()
        self._ttl = ttl_seconds
        self._conn = None
        self._db_failed = False

        url = database_url if database_url is not None else os.environ.get("DATABASE_URL", "")
        if url:
            self._try_connect(url)
        else:
            logger.info(
                "No DATABASE_URL set — computation store is in-memory only. "
                "Results will not survive a restart."
            )

    # ── Persistence setup ────────────────────────────────────────────────────

    def _try_connect(self, url: str) -> None:
        """Connect and ensure the table exists.

        Any failure degrades to memory-only rather than breaking the app: a
        database problem must never stop route planning from working.
        """
        try:
            import psycopg  # type: ignore

            self._conn = psycopg.connect(url, autocommit=True)
            with self._conn.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS computations (
                        computation_id TEXT PRIMARY KEY,
                        payload        JSONB NOT NULL,
                        created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
                    )
                    """
                )
                cur.execute(
                    "CREATE INDEX IF NOT EXISTS computations_created_at_idx "
                    "ON computations (created_at)"
                )
            logger.info("Computation store persisting to Postgres.")
            self._purge_expired()
        except ImportError:
            logger.warning(
                "DATABASE_URL is set but psycopg is not installed; "
                "falling back to in-memory store. Install psycopg[binary] to persist."
            )
            self._db_failed = True
        except Exception as exc:
            logger.warning(f"Could not connect to the database ({exc}); in-memory only.")
            self._conn = None
            self._db_failed = True

    @property
    def persistent(self) -> bool:
        return self._conn is not None

    # ── Dict-like interface used by the routers ──────────────────────────────

    def __setitem__(self, key: str, value: dict) -> None:
        self._memory[key] = value
        self._memory.move_to_end(key)
        while len(self._memory) > MAX_MEMORY_ENTRIES:
            evicted, _ = self._memory.popitem(last=False)
            logger.debug(f"Evicted {evicted} from the in-memory store (bound reached)")
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
            self._memory[key] = restored
            self._memory.move_to_end(key)
            return restored
        return default

    # ── Database round-trip ──────────────────────────────────────────────────

    def _persist(self, key: str, value: dict) -> None:
        if not self._conn:
            return
        payload = self._serialise(value)
        if payload is None:
            return
        try:
            with self._conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO computations (computation_id, payload)
                    VALUES (%s, %s)
                    ON CONFLICT (computation_id)
                    DO UPDATE SET payload = EXCLUDED.payload, created_at = now()
                    """,
                    (key, json.dumps(payload)),
                )
        except Exception as exc:
            logger.warning(f"Failed to persist computation {key}: {exc}")

    def _load(self, key: str) -> Optional[dict]:
        if not self._conn:
            return None
        try:
            with self._conn.cursor() as cur:
                cur.execute(
                    "SELECT payload FROM computations WHERE computation_id = %s", (key,)
                )
                row = cur.fetchone()
            if not row:
                return None
            return self._deserialise(row[0])
        except Exception as exc:
            logger.warning(f"Failed to load computation {key}: {exc}")
            return None

    def _purge_expired(self) -> None:
        if not self._conn:
            return
        try:
            with self._conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM computations "
                    "WHERE created_at < now() - make_interval(secs => %s)",
                    (self._ttl,),
                )
        except Exception as exc:
            logger.debug(f"TTL purge skipped: {exc}")

    # ── Serialisation ────────────────────────────────────────────────────────

    def _serialise(self, value: dict) -> Optional[dict]:
        """Convert a stored entry to JSON-safe form.

        Entries hold Pydantic models (the response and its routes). Only the
        response is persisted — `routes` is recoverable from it on rehydration,
        so storing both would double the row size for nothing.
        """
        try:
            response = value.get("response")
            if response is None or not hasattr(response, "model_dump_json"):
                return None
            return {"response": json.loads(response.model_dump_json())}
        except Exception as exc:
            logger.warning(f"Could not serialise computation: {exc}")
            return None

    def _deserialise(self, payload: dict) -> Optional[dict]:
        """Rebuild a store entry from its persisted form."""
        try:
            from ..models.schemas import RouteComputeResponse

            response = RouteComputeResponse.model_validate(payload["response"])
            return {
                "response": response,
                "routes": response.strategies,
                # The original request is not persisted; consumers treat a
                # missing request as "constraints unknown", which is already the
                # case for the precomputed demo entry.
                "request": None,
            }
        except Exception as exc:
            logger.warning(f"Could not deserialise computation: {exc}")
            return None


def build_store() -> ComputationStore:
    """Create the process-wide store from the environment."""
    ttl = int(os.environ.get("COMPUTATION_TTL_SECONDS", DEFAULT_TTL_SECONDS))
    return ComputationStore(ttl_seconds=ttl)
