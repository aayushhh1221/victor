"""
VICTOR — Audit Report & Implementation Plan Verification Tests.

Tests the safety contracts and architectural invariants from:
- AUD-001 / ADR Decision 1: 20% life support safety reserve & EVA duration enforcement
- AUD-002 / ADR Decision 2: Coordinate validation and unsafe start endpoint rejection
- AUD-003 / ADR Decision 4: Custom strategy weight overrides validation and application
- AUD-004: Persisted computation request context and scenario validation
- AUD-005 / AUD-006: Data integrity manifest verification & cache versioning
- AUD-008: Elimination of hardcoded environment fallback constants
"""
import pytest
import math
import numpy as np
from fastapi.testclient import TestClient

from backend.main import app
from backend.models.domain import Coordinate, MissionConstraints
from backend.models.schemas import RouteComputeRequest, ScenarioModification
from backend.models.enums import DataMode, RouteStrategy
from backend.services.route_engine import RouteEngine, UnsafeEndpointError, OverEvaBudgetError
from backend.services.data_service import DataService
from backend.dependencies import init_services
from backend.utils.mars_geo import validate_jezero_coordinate, latlon_to_grid


@pytest.fixture(scope="module")
def api_client(sample_data):
    init_services(sample_data)
    with TestClient(app) as c:
        yield c


# ── AUD-002: Coordinate Bounds & Validation ─────────────────────────────────

class TestCoordinateBoundsAndSafety:
    def test_out_of_bounds_lat_raises_value_error(self, sample_data):
        with pytest.raises(ValueError, match="outside the Jezero Crater grid extent"):
            validate_jezero_coordinate(19.2, 77.45, sample_data.metadata)

    def test_out_of_bounds_lon_raises_value_error(self, sample_data):
        with pytest.raises(ValueError, match="outside the Jezero Crater grid extent"):
            validate_jezero_coordinate(18.45, 78.5, sample_data.metadata)

    def test_nan_coordinate_raises_value_error(self, sample_data):
        with pytest.raises(ValueError, match="finite numbers"):
            validate_jezero_coordinate(float("nan"), 77.45, sample_data.metadata)

    def test_latlon_to_grid_clamp_false_rejects_out_of_bounds(self, sample_data):
        with pytest.raises(ValueError):
            latlon_to_grid(17.5, 77.45, sample_data.metadata, clamp=False)

    def test_in_bounds_coordinate_succeeds(self, sample_data):
        r, c = latlon_to_grid(18.45, 77.45, sample_data.metadata, clamp=False)
        assert 0 <= r < 300
        assert 0 <= c < 300

    def test_unsafe_start_endpoint_rejected(self, sample_data):
        """A start cell with slope > max_slope_deg must raise UnsafeEndpointError."""
        engine = RouteEngine(sample_data)
        slope_grid = sample_data.slope
        high_slope_idx = np.unravel_index(np.argmax(slope_grid), slope_grid.shape)
        max_slope_val = float(slope_grid[high_slope_idx])
        start_lat, start_lon = sample_data.grid_to_latlon(*high_slope_idx)

        constraints = MissionConstraints(
            max_slope_deg=max(5.0, max_slope_val - 5.0),
            max_eva_hours=8.0,
            walking_speed_kmh=3.0,
        )
        dest = Coordinate(lat=18.45, lon=77.45)

        with pytest.raises(UnsafeEndpointError, match="exceeds max slope limit"):
            engine.compute_routes(Coordinate(lat=start_lat, lon=start_lon), dest, constraints)


# ── AUD-001: EVA Duration & 20% Reserve Enforcement ─────────────────────────

class TestEvaDurationEnforcement:
    def test_over_eva_budget_rejected(self, sample_data):
        """When budget is too small to cover traverse + 20% reserve, engine must raise OverEvaBudgetError."""
        engine = RouteEngine(sample_data)
        start = Coordinate(lat=18.35, lon=77.35)
        dest = Coordinate(lat=18.55, lon=77.60)
        constraints = MissionConstraints(
            max_slope_deg=20.0,
            max_eva_hours=1.0,
            walking_speed_kmh=3.0,
        )
        with pytest.raises(OverEvaBudgetError, match="including 20% life-support reserve"):
            engine.compute_routes(start, dest, constraints)

    def test_feasible_route_includes_20_percent_reserve_metrics(self, sample_data):
        """Feasible routes must compute and report the 20% life support safety reserve."""
        engine = RouteEngine(sample_data)
        start = Coordinate(lat=18.44, lon=77.45)
        dest = Coordinate(lat=18.48, lon=77.25)
        constraints = MissionConstraints(
            max_slope_deg=20.0,
            max_eva_hours=8.0,
            walking_speed_kmh=3.0,
        )
        routes = engine.compute_routes(start, dest, constraints, strategies=["SAFEST"])
        assert "SAFEST" in routes
        route = routes["SAFEST"]
        metrics = route.metrics

        expected_with_reserve = round(metrics.estimated_time_hours * 1.20, 3)
        assert metrics.required_eva_time_with_reserve_hours == expected_with_reserve
        assert metrics.effective_eva_budget_hours == 8.0
        assert metrics.eva_reserve_hours == round(metrics.estimated_time_hours * 0.20, 3)
        assert metrics.eva_margin_hours == round(8.0 - expected_with_reserve, 3)
        assert metrics.is_feasible is True
        assert metrics.required_eva_time_with_reserve_hours <= constraints.max_eva_hours


# ── AUD-003: Weight Overrides ───────────────────────────────────────────────

class TestWeightOverrides:
    def test_custom_weights_applied_and_echoed(self, sample_data):
        engine = RouteEngine(sample_data)
        start = Coordinate(lat=18.44, lon=77.45)
        dest = Coordinate(lat=18.48, lon=77.25)
        constraints = MissionConstraints(max_slope_deg=20.0, max_eva_hours=8.0, walking_speed_kmh=3.0)
        overrides = {"distance": 4.0, "hazard": 0.5, "traversability": 2.0, "science_penalty": 0.0}

        routes = engine.compute_routes(
            start, dest, constraints, strategies=["SAFEST"], weight_overrides=overrides
        )
        assert "SAFEST" in routes
        route = routes["SAFEST"]
        assert route.effective_weights == overrides

    def test_invalid_weight_override_keys_rejected(self):
        with pytest.raises(ValueError, match="Unknown weight override key"):
            ScenarioModification(weight_overrides={"unsupported_key": 2.0})

    def test_out_of_range_weight_override_rejected(self):
        with pytest.raises(ValueError, match="must be between 0.0 and 5.0"):
            ScenarioModification(weight_overrides={"distance": 10.0})


# ── AUD-006: Manifest Integrity Verification ────────────────────────────────

class TestManifestIntegrity:
    def test_manifest_loads_and_verifies_cleanly(self):
        ds = DataService()
        ds.load()
        assert ds.manifest_valid is True
        assert ds.manifest_id is not None
        assert len(ds.integrity_errors) == 0
        assert ds.data_mode == DataMode.VERIFIED_SNAPSHOT

    def test_tampered_manifest_downgrades_to_demonstration(self, monkeypatch):
        ds = DataService()
        monkeypatch.setattr(ds, "_load_manifest", lambda: setattr(ds, "_manifest_valid", False) or setattr(ds, "_manifest_id", "invalid"))
        ds.load()
        assert ds.data_mode == DataMode.DEMONSTRATION


# ── AUD-008: Environment Truthfulness (No Hardcoded Fallbacks) ───────────────

class TestEnvironmentTruthfulness:
    def test_environment_without_meda_params_returns_none(self):
        from backend.routers import environment

        class MockDataService:
            data_mode = DataMode.VERIFIED_SNAPSHOT
            meda_environment = {}  # Empty MEDA params
            def optional_grid(self, name):
                return None

        import asyncio
        resp = asyncio.run(environment.get_current_environment(MockDataService()))
        assert resp.surface_temperature_day_c is None
        assert resp.surface_temperature_night_c is None
        assert resp.dust_opacity_tau is None
        assert resp.atmospheric_pressure_pa is None
        assert resp.temperature_source is None
        assert resp.dust_opacity_source is None
        assert resp.pressure_source is None


# ── HTTP API Integration Tests ──────────────────────────────────────────────

class TestApiSafetyEndpoints:
    def test_route_compute_out_of_bounds_returns_422(self, api_client):
        payload = {
            "start": {"lat": 25.0, "lon": 77.45},  # Lat > 18.9
            "destination": {"lat": 18.5, "lon": 77.45},
            "constraints": {"max_slope_deg": 20, "max_eva_hours": 8, "walking_speed_kmh": 3},
            "strategies": ["SAFEST"],
        }
        resp = api_client.post("/api/v1/routes/compute", json=payload)
        assert resp.status_code == 422

    def test_route_compute_over_budget_returns_422(self, api_client):
        payload = {
            "start": {"lat": 18.35, "lon": 77.35},
            "destination": {"lat": 18.55, "lon": 77.60},
            "constraints": {"max_slope_deg": 20, "max_eva_hours": 1.0, "walking_speed_kmh": 3},
            "strategies": ["SAFEST"],
        }
        resp = api_client.post("/api/v1/routes/compute", json=payload)
        assert resp.status_code == 422
        assert "20% life-support reserve" in resp.json()["detail"]

    def test_scenario_compare_with_contingency_succeeds(self, api_client):
        """Scenario comparison under tighter constraints must return 200 with feasibility flags."""
        demo_resp = api_client.get("/api/v1/routes/demo")
        assert demo_resp.status_code == 200
        comp_id = demo_resp.json()["computation_id"]

        compare_payload = {
            "base_computation_id": comp_id,
            "modifications": {
                "max_slope_deg": 15.0,
                "max_eva_hours": 4.0,
                "walking_speed_kmh": 2.0,
            },
        }
        resp = api_client.post("/api/v1/scenarios/compare", json=compare_payload)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["diffs"]) == 4
        assert "exceed" in data["impact_summary"].lower()

    def test_official_nasa_pdf_report_export(self, api_client):
        """PDF report export must stream a valid binary PDF document."""
        api_client.get("/api/v1/routes/demo")
        resp = api_client.get("/api/v1/report/pdf/demo-jezero-001?strategy=BALANCED")
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "application/pdf"
        assert "attachment" in resp.headers["content-disposition"]
        assert resp.content.startswith(b"%PDF-")
        assert len(resp.content) > 5000
