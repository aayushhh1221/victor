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
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(ROOT))

from backend.services.computation_store import (  # noqa: E402
    ComputationStore,
    MAX_MEMORY_ENTRIES,
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
