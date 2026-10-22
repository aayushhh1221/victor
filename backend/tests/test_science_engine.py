"""Tests for VICTOR science opportunity engine."""
import pytest
from backend.services.data_service import DataService
from backend.services.route_engine import RouteEngine
from backend.services.science_engine import (
    get_nearby_targets,
    compute_route_science_profile,
    compare_science_value,
    science_discovery_analysis,
)
from backend.models.domain import Coordinate, MissionConstraints, ScienceTarget
from backend.models.enums import MineralClass, ScienceTier


@pytest.fixture(scope="module")
def sample_routes(sample_data):
    engine = RouteEngine(sample_data)
    start = Coordinate(lat=18.44, lon=77.45)
    dest = Coordinate(lat=18.48, lon=77.24)
    constraints = MissionConstraints(max_slope_deg=20.0, max_eva_hours=6.0, walking_speed_kmh=3.0)
    return engine.compute_routes(start, dest, constraints)


class TestScienceEngine:
    def test_nearby_targets_runtime_detour(self, sample_data, sample_routes):
        """Science targets have runtime-computed detour distance and minutes."""
        route = sample_routes["BALANCED"]
        targets = sample_data.get_science_targets()
        # Find targets with a generous radius (5000m) to ensure match
        nearby = get_nearby_targets(route, targets, radius_m=5000.0, walking_speed_kmh=3.0)
        assert len(nearby) > 0

        for t in nearby:
            assert t.distance_from_route_m is not None
            assert t.distance_from_route_m <= 5000.0
            assert t.detour_cost_minutes is not None
            expected_minutes = ((t.distance_from_route_m * 2) / 1000.0 / 3.0) * 60.0
            assert abs(t.detour_cost_minutes - expected_minutes) < 0.2

    def test_route_science_profile_monotonic(self, sample_routes):
        """Profile cumulative distance increases monotonically."""
        route = sample_routes["SCIENCE_RICHEST"]
        profile_resp = compute_route_science_profile(route, "comp-01", "SCIENCE_RICHEST")
        assert len(profile_resp.profile) == len(route.segments)

        prev_km = -1.0
        for pt in profile_resp.profile:
            assert pt.distance_km >= prev_km
            assert 0.0 <= pt.science_value <= 1.0
            prev_km = pt.distance_km

        assert profile_resp.total_science_value >= 0.0
        assert profile_resp.peak_science_value >= 0.0

    def test_compare_science_value(self, sample_routes):
        """compare_science_value reports all strategies with valid metrics."""
        comparison = compare_science_value(sample_routes)
        assert len(comparison) == len(sample_routes)
        for strat, data in comparison.items():
            assert "total_science_value" in data
            assert "avg_science_value" in data
            assert "peak_science_value" in data
            assert "science_per_km" in data
            assert data["total_science_value"] >= 0.0

    def test_science_discovery_analysis_template(self, sample_routes):
        """science_discovery_analysis produces a valid non-empty explanation."""
        text = science_discovery_analysis(sample_routes)
        assert isinstance(text, str)
        assert len(text) > 20
        assert "route adds" in text
        assert "higher science value" in text

    def test_science_profile_populates_mola_elevation(self, sample_data, sample_routes):
        """compute_route_science_profile populates authentic MOLA elevation when data_service is supplied."""
        route = sample_routes["BALANCED"]
        profile_resp = compute_route_science_profile(route, "comp-01", "BALANCED", data_service=sample_data)
        elevations = [p.elevation_m for p in profile_resp.profile]
        assert all(e is not None for e in elevations), "All waypoints must have sampled MOLA elevation"
        # Jezero crater floor elevation is well below Martian datum (-2500m to -2000m)
        assert all(e < -1500 for e in elevations), "Jezero elevations must be negative MOLA datum"

