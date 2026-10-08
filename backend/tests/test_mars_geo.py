"""VICTOR — Mars geodesy unit tests."""
import sys
import math
import pytest
from pathlib import Path

ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(ROOT))

from backend.utils.mars_geo import (
    haversine_mars, grid_to_latlon, latlon_to_grid, bearing, R_MARS_M
)
from backend.models.domain import GridMetadata

META = GridMetadata()  # Default: Jezero 300×300, non-square cells


class TestHaversine:
    def test_zero_distance(self):
        assert haversine_mars(18.0, 77.0, 18.0, 77.0) == pytest.approx(0.0, abs=1e-6)

    def test_pole_distance(self):
        """Quarter circumference from equator to pole ~5332 km on Mars."""
        d = haversine_mars(0, 0, 90, 0)
        assert 5_300_000 < d < 5_400_000, f"Quarter circumference: {d/1000:.0f} km"

    def test_jezero_known_distance(self):
        """
        MOLA track spacing in Jezero at ~18°N.
        Two points 0.9° apart in lat at 18°N ≈ 53 km.
        """
        d = haversine_mars(18.0, 77.5, 18.9, 77.5)
        assert 52_000 < d < 54_500, f"Expected ~53 km, got {d/1000:.1f} km"

    def test_ew_distance_jezero(self):
        """1° longitude at 18°N on Mars ≈ 56.1 km."""
        d = haversine_mars(18.5, 77.0, 18.5, 78.0)
        assert 55_000 < d < 57_500, f"Expected ~56 km, got {d/1000:.1f} km"

    def test_symmetry(self):
        d1 = haversine_mars(18.3, 77.4, 18.6, 77.8)
        d2 = haversine_mars(18.6, 77.8, 18.3, 77.4)
        assert d1 == pytest.approx(d2, rel=1e-9)

    def test_non_negative(self):
        assert haversine_mars(18.0, 77.0, 18.5, 77.5) > 0


class TestGridLatLon:
    def test_center_cell_roundtrip(self):
        """Grid→latlon→grid must round-trip without drift."""
        for row in [0, 50, 149, 150, 299]:
            for col in [0, 50, 149, 150, 299]:
                lat, lon = grid_to_latlon(row, col, META)
                r2, c2 = latlon_to_grid(lat, lon, META)
                assert abs(r2 - row) <= 1, f"Row mismatch at ({row},{col}): got {r2}"
                assert abs(c2 - col) <= 1, f"Col mismatch at ({row},{col}): got {c2}"

    def test_top_left_is_lat_max(self):
        lat, lon = grid_to_latlon(0, 0, META)
        assert lat > 18.8, f"Row 0 should be near lat_max, got {lat}"
        assert lon < 77.1, f"Col 0 should be near lon_min, got {lon}"

    def test_bottom_right_is_lat_min(self):
        lat, lon = grid_to_latlon(299, 299, META)
        assert lat < 18.1, f"Row 299 should be near lat_min, got {lat}"
        assert lon > 77.9, f"Col 299 should be near lon_max, got {lon}"

    def test_bounds_clamping(self):
        """latlon_to_grid must clamp OOB coordinates."""
        r, c = latlon_to_grid(17.0, 80.0, META)  # Outside region
        assert 0 <= r <= 299
        assert 0 <= c <= 299

    def test_extent_coverage(self):
        """All grid cells within declared extent."""
        lats = [grid_to_latlon(r, 150, META)[0] for r in [0, 299]]
        lons = [grid_to_latlon(150, c, META)[1] for c in [0, 299]]
        assert min(lats) >= META.lat_min - 0.01
        assert max(lats) <= META.lat_max + 0.01
        assert min(lons) >= META.lon_min - 0.01
        assert max(lons) <= META.lon_max + 0.01

    def test_cell_size_ns(self):
        """N-S cell size should be ~177.5m."""
        lat1, lon = grid_to_latlon(100, 150, META)
        lat2, _ = grid_to_latlon(101, 150, META)
        dist = haversine_mars(lat1, lon, lat2, lon)
        assert 170 < dist < 185, f"N-S cell size: {dist:.1f}m (expected ~177.5m)"

    def test_cell_size_ew(self):
        """E-W cell size should be ~187.1m."""
        lat, lon1 = grid_to_latlon(150, 100, META)
        _, lon2 = grid_to_latlon(150, 101, META)
        dist = haversine_mars(lat, lon1, lat, lon2)
        assert 180 < dist < 195, f"E-W cell size: {dist:.1f}m (expected ~187.1m)"


class TestBearing:
    def test_north(self):
        b = bearing(18.0, 77.0, 19.0, 77.0)
        assert b == pytest.approx(0.0, abs=1.0)

    def test_east(self):
        b = bearing(18.0, 77.0, 18.0, 78.0)
        assert b == pytest.approx(90.0, abs=2.0)

    def test_south(self):
        b = bearing(19.0, 77.0, 18.0, 77.0)
        assert b == pytest.approx(180.0, abs=1.0)
