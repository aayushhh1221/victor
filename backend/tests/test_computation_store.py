"""
VICTOR — Computation store tests.

These exist because of a specific deployment failure. On Render's free tier a
service spins down after 15 minutes idle, and route computations were held in a
plain process dict — so every stored computation_id vanished with it and
segment-evidence, science-profile and scenario-comparison lookups all returned
404 for anyone who left a tab open.

The round-trip test below is the regression test for that: it proves a stored
computation can be serialised and rebuilt, which is what lets the store survive
a restart when a database is configured.
"""
import os
import sys
import uuid
from pathlib import Path

import pytest

ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(ROOT))

from backend.services.computation_store import (  # noqa: E402
    ComputationStore,
    MAX_MEMORY_ENTRIES,
    route_cache_key,
)


@pytest.fixture
def store():
    """A store with no database — the offline configuration."""
    return ComputationStore(database_url="")


def _entry():
    return {"response": None, "routes": {}, "request": None}


class TestDictInterface:
    """The routers use this as a dict; that contract must not drift."""

    def test_set_and_get(self, store):
        store["abc"] = _entry()
        assert store.get("abc") is not None

    def test_get_missing_returns_none(self, store):
        assert store.get("does-not-exist") is None

    def test_get_missing_returns_default(self, store):
        sentinel = {"x": 1}
        assert store.get("nope", sentinel) is sentinel

    def test_contains(self, store):
        store["abc"] = _entry()
        assert "abc" in store
        assert "nope" not in store

    def test_getitem_raises_keyerror(self, store):
        with pytest.raises(KeyError):
            store["missing"]

    def test_getitem_returns_entry(self, store):
        store["abc"] = _entry()
        assert store["abc"] is not None


class TestMemoryBounding:
    def test_lru_eviction_bounds_memory(self, store):
        """Unbounded growth would leak on a 512 MB instance."""
        for i in range(MAX_MEMORY_ENTRIES + 50):
            store[f"k{i}"] = _entry()
        assert len(store) == MAX_MEMORY_ENTRIES

    def test_oldest_entry_is_evicted_first(self, store):
        for i in range(MAX_MEMORY_ENTRIES + 10):
            store[f"k{i}"] = _entry()
        assert store.get("k0") is None
        assert store.get(f"k{MAX_MEMORY_ENTRIES + 9}") is not None

    def test_reading_an_entry_protects_it_from_eviction(self, store):
        """LRU, not FIFO: an entry still being read should not be dropped."""
        store["keep"] = _entry()
        for i in range(MAX_MEMORY_ENTRIES - 1):
            store[f"k{i}"] = _entry()
            store.get("keep")  # keep it fresh
        store["overflow"] = _entry()
        assert store.get("keep") is not None


class TestOfflineBehaviour:
    def test_no_database_url_is_not_an_error(self, store):
        """Offline operation is a hard requirement — the demo runs on localhost."""
        assert store.persistent is False
        store["abc"] = _entry()
        assert store.get("abc") is not None

    def test_bad_database_url_degrades_rather_than_raising(self):
        """A database problem must never stop route planning from working."""
        s = ComputationStore(database_url="postgresql://invalid:invalid@127.0.0.1:1/none")
        assert s.persistent is False
        s["abc"] = _entry()
        assert s.get("abc") is not None


class TestRestartSurvival:
    """The actual regression test for the spin-down 404 bug."""

    def test_response_survives_a_serialise_deserialise_round_trip(self):
        """A rehydrated entry must expose the same routes the live one did.

        This is what makes segment evidence still resolvable after the process
        that computed it has gone away.
        """
        from backend.services.data_service import DataService
        from backend.services.route_engine import RouteEngine
        from backend.services.pareto_engine import compute_pareto_dominance
        from backend.models.schemas import (
            Coordinate, MissionConstraints, RouteComputeResponse,
            RouteComputeComparison, RouteRangeSummary,
        )

        ds = DataService()
        try:
            ds.load()
        except FileNotFoundError:
            pytest.skip("Cache data not available — run the data pipeline first")

        engine = RouteEngine(ds)
        routes = engine.compute_routes(
            Coordinate(lat=18.44, lon=77.45),
            Coordinate(lat=18.50, lon=77.25),
            MissionConstraints(),
        )
        pareto = compute_pareto_dominance(routes)
        response = RouteComputeResponse(
            computation_id="round-trip-test",
            data_mode=ds.data_mode,
            strategies=routes,
            comparison=RouteComputeComparison(
                distance_range=RouteRangeSummary(min=0.0, max=1.0),
                time_range=RouteRangeSummary(min=0.0, max=1.0),
                science_range=RouteRangeSummary(min=0.0, max=1.0),
                hazard_range=RouteRangeSummary(min=0.0, max=1.0),
                trade_off_summary="test",
            ),
            pareto=pareto,
            provenance=ds.get_provenance(),
        )

        store = ComputationStore(database_url="")
        entry = {"response": response, "routes": routes, "request": None}

        payload = store._serialise(entry)
        assert payload is not None, "a response must be serialisable to persist"

        restored = store._deserialise(payload)
        assert restored is not None, "a persisted response must be rebuildable"

        # The rehydrated entry must carry the same strategies, which is what
        # segment-evidence lookups depend on.
        assert set(restored["routes"].keys()) == set(routes.keys())
        assert restored["response"].computation_id == "round-trip-test"
        for name, route in routes.items():
            assert len(restored["routes"][name].segments) == len(route.segments)


class TestRouteCacheKey:
    """The cache key decides whether a request skips a multi-second A* run.

    Measured: an uncached 4-strategy computation took 13.3 s on a desktop; the
    cached repeat took 0.24 s. A key that is unstable would silently discard
    that 56x win; a key that is too loose would return the wrong route.
    """

    CONSTRAINTS = {"max_slope_deg": 20.0, "max_eva_hours": 6.0, "walking_speed_kmh": 3.0}

    def test_identical_inputs_produce_identical_keys(self):
        a = route_cache_key(18.44, 77.45, 18.50, 77.25, self.CONSTRAINTS, ["SAFEST"])
        b = route_cache_key(18.44, 77.45, 18.50, 77.25, self.CONSTRAINTS, ["SAFEST"])
        assert a == b

    def test_strategy_order_does_not_matter(self):
        """The same set of strategies is the same request."""
        a = route_cache_key(18.44, 77.45, 18.50, 77.25, self.CONSTRAINTS, ["SAFEST", "FASTEST"])
        b = route_cache_key(18.44, 77.45, 18.50, 77.25, self.CONSTRAINTS, ["FASTEST", "SAFEST"])
        assert a == b

    def test_different_destination_misses(self):
        a = route_cache_key(18.44, 77.45, 18.50, 77.25, self.CONSTRAINTS, ["SAFEST"])
        b = route_cache_key(18.44, 77.45, 18.50, 77.26, self.CONSTRAINTS, ["SAFEST"])
        assert a != b

    def test_different_constraints_miss(self):
        """Constraints change the result, so they must change the key."""
        other = dict(self.CONSTRAINTS, max_slope_deg=15.0)
        a = route_cache_key(18.44, 77.45, 18.50, 77.25, self.CONSTRAINTS, ["SAFEST"])
        b = route_cache_key(18.44, 77.45, 18.50, 77.25, other, ["SAFEST"])
        assert a != b

    def test_float_noise_below_grid_resolution_still_hits(self):
        """Rounding is to ~1 m; the grid cell is 177.5 m.

        Without this, trivial floating-point differences in a request would
        defeat the cache entirely.
        """
        a = route_cache_key(18.44, 77.45, 18.50, 77.25, self.CONSTRAINTS, ["SAFEST"])
        b = route_cache_key(18.440000004, 77.45, 18.50, 77.25, self.CONSTRAINTS, ["SAFEST"])
        assert a == b

    def test_different_weight_overrides_miss(self):
        """Weight overrides change the A* cost function, so they change the key.

        Regression: the router once omitted weight_overrides from the key, so a
        repeat compute under a different focus profile was served the cached
        routes computed under the previous weights.
        """
        a = route_cache_key(18.44, 77.45, 18.50, 77.25, self.CONSTRAINTS, ["SAFEST"])
        b = route_cache_key(
            18.44, 77.45, 18.50, 77.25, self.CONSTRAINTS, ["SAFEST"],
            weight_overrides={"hazard": 3.0},
        )
        c = route_cache_key(
            18.44, 77.45, 18.50, 77.25, self.CONSTRAINTS, ["SAFEST"],
            weight_overrides={"hazard": 0.3},
        )
        assert a != b
        assert b != c

    def test_weight_override_float_noise_still_hits(self):
        """Overrides are rounded so request noise does not defeat the cache."""
        a = route_cache_key(
            18.44, 77.45, 18.50, 77.25, self.CONSTRAINTS, ["SAFEST"],
            weight_overrides={"hazard": 3.0},
        )
        b = route_cache_key(
            18.44, 77.45, 18.50, 77.25, self.CONSTRAINTS, ["SAFEST"],
            weight_overrides={"hazard": 3.00000001},
        )
        assert a == b

    def test_nested_per_strategy_overrides_are_keyed(self):
        """Per-strategy overrides are schema-legal and must neither crash the
        key builder nor collide with the flat form."""
        nested = route_cache_key(
            18.44, 77.45, 18.50, 77.25, self.CONSTRAINTS, ["SAFEST"],
            weight_overrides={"SAFEST": {"hazard": 3.0}, "FASTEST": {"distance": 2.0}},
        )
        flat = route_cache_key(
            18.44, 77.45, 18.50, 77.25, self.CONSTRAINTS, ["SAFEST"],
            weight_overrides={"hazard": 3.0},
        )
        nested_again = route_cache_key(
            18.44, 77.45, 18.50, 77.25, self.CONSTRAINTS, ["SAFEST"],
            weight_overrides={"FASTEST": {"distance": 2.0}, "SAFEST": {"hazard": 3.0}},
        )
        assert nested == nested_again  # key order must not matter
        assert nested != flat

    def test_allow_infeasible_changes_the_key(self):
        """allow_infeasible decides whether over-budget routes are returned or
        rejected — a hit across that flag would leak an infeasible route into a
        request that asked to exclude it."""
        a = route_cache_key(18.44, 77.45, 18.50, 77.25, self.CONSTRAINTS, ["SAFEST"])
        b = route_cache_key(
            18.44, 77.45, 18.50, 77.25, self.CONSTRAINTS, ["SAFEST"],
            allow_infeasible=True,
        )
        assert a != b


class TestRouteCacheMemory:
    def test_miss_returns_none(self, store):
        assert store.get_cached_route("no-such-key") is None

    def test_put_then_get_hits(self, store):
        store.put_cached_route("k", {"computation_id": "x"})
        assert store.get_cached_route("k") == {"computation_id": "x"}

    def test_cache_is_lru_bounded(self, store):
        """The cache must not be an unbounded memory leak on a 512 MB instance."""
        for i in range(MAX_MEMORY_ENTRIES + 20):
            store.put_cached_route(f"k{i}", {"computation_id": str(i)})
        assert store.get_cached_route("k0") is None
        assert store.get_cached_route(f"k{MAX_MEMORY_ENTRIES + 19}") is not None


class TestHealthReporting:
    """A degraded store must be visible, not silent.

    This is the reporting that was missing when the store could lose its
    connection and never reconnect — the failure looked identical to working.
    """

    def test_unconfigured_reports_memory_mode_honestly(self, store):
        h = store.health()
        assert h["mode"] == "memory"
        assert h["configured"] is False
        assert h["healthy"] is True  # memory-only is a valid, working state
        assert "not survive" in h["note"]

    def test_configured_but_unreachable_does_not_claim_postgres(self):
        """The important case: configured != working."""
        s = ComputationStore(database_url="postgresql://x:x@127.0.0.1:1/none")
        h = s.health()
        assert h["configured"] is True
        assert h["mode"] == "memory", "an unreachable database must not report as postgres"
        assert h["healthy"] is False
        assert h["last_error"], "the failure reason must be reported"

    def test_degraded_store_still_serves_reads_and_writes(self):
        """Persistence failing must never stop route planning."""
        s = ComputationStore(database_url="postgresql://x:x@127.0.0.1:1/none")
        s["abc"] = _entry()
        assert s.get("abc") is not None
        s.put_cached_route("k", {"computation_id": "x"})
        assert s.get_cached_route("k") is not None


# ── Live database integration ────────────────────────────────────────────────
#
# These are the tests that prove persistence actually works. They are skipped
# until DATABASE_URL is set, so the suite stays green offline while turning into
# a real integration check the moment a Supabase connection string exists.
#
# Run with:
#   DATABASE_URL="postgresql://...pooler.supabase.com:6543/postgres" pytest backend/tests -v

LIVE_DB_URL = os.environ.get("DATABASE_URL", "")
requires_db = pytest.mark.skipif(
    not LIVE_DB_URL,
    reason="DATABASE_URL not set — skipping live Supabase integration tests",
)


@requires_db
class TestLiveDatabase:
    def test_connects_and_reports_postgres(self):
        s = ComputationStore(database_url=LIVE_DB_URL)
        h = s.health()
        assert h["mode"] == "postgres", f"could not connect: {h['last_error']}"
        assert h["healthy"] is True
        assert s.persistent is True

    def test_computation_survives_a_new_store_instance(self):
        """The actual regression test for the spin-down 404, against a real database.

        A second ComputationStore stands in for a restarted process: it shares
        no memory with the first, so a successful read can only have come from
        Postgres.
        """
        from backend.models.schemas import (
            RouteComputeResponse, RouteComputeComparison, RouteRangeSummary,
        )
        from backend.models.enums import DataMode

        key = f"live-test-{uuid.uuid4()}"
        response = RouteComputeResponse(
            computation_id=key,
            data_mode=DataMode.VERIFIED_SNAPSHOT,
            strategies={},
            comparison=RouteComputeComparison(
                distance_range=RouteRangeSummary(min=0.0, max=1.0),
                time_range=RouteRangeSummary(min=0.0, max=1.0),
                science_range=RouteRangeSummary(min=0.0, max=1.0),
                hazard_range=RouteRangeSummary(min=0.0, max=1.0),
                trade_off_summary="live test",
            ),
            pareto={},
            provenance=[],
        )

        writer = ComputationStore(database_url=LIVE_DB_URL)
        writer[key] = {"response": response, "routes": {}, "request": None}

        reader = ComputationStore(database_url=LIVE_DB_URL)
        assert not reader._memory, "reader must start with cold memory"
        restored = reader.get(key)
        assert restored is not None, "computation did not survive — persistence is broken"
        assert restored["response"].computation_id == key

    def test_route_cache_survives_a_new_store_instance(self):
        key = f"live-cache-{uuid.uuid4()}"
        payload = {"computation_id": "cached", "marker": key}

        ComputationStore(database_url=LIVE_DB_URL).put_cached_route(key, payload)

        reader = ComputationStore(database_url=LIVE_DB_URL)
        got = reader.get_cached_route(key)
        assert got is not None, "route cache did not persist"
        assert got["marker"] == key

    def test_reconnects_after_the_connection_is_dropped(self):
        """Supabase recycles connections and pauses idle projects.

        Before the reconnect fix, the first drop disabled persistence for the
        rest of the process lifetime — silently.
        """
        s = ComputationStore(database_url=LIVE_DB_URL)
        assert s.persistent

        # Drop the connection out from under the store.
        s._db._close_quietly()
        s._db._last_attempt = 0.0  # bypass the reconnect cooldown for the test
        assert not s._db.connected

        key = f"live-reconnect-{uuid.uuid4()}"
        s.put_cached_route(key, {"computation_id": "x", "marker": key})

        got = ComputationStore(database_url=LIVE_DB_URL).get_cached_route(key)
        assert got is not None, "store did not reconnect after the connection dropped"
        assert s.health()["mode"] == "postgres"
