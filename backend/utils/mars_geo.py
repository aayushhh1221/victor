"""PATHWISE — Mars geodesy utilities."""
import math
from typing import Tuple
from ..models.domain import GridMetadata

# Mars mean radius (IAU 2000)
R_MARS_M = 3_389_500.0


def haversine_mars(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Great-circle distance on Mars using the haversine formula.

    Args:
        lat1, lon1: Start point (degrees, planetocentric)
        lat2, lon2: End point (degrees, planetocentric east-positive)

    Returns:
        Distance in metres.
    """
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R_MARS_M * c


def grid_to_latlon(row: int, col: int, meta: GridMetadata) -> Tuple[float, float]:
    """
    Convert 0-indexed (row, col) to Mars planetocentric (lat, lon).
    Row 0 = lat_max (north), Row N-1 = lat_min (south).
    """
    lat = meta.lat_max - (row + 0.5) * (meta.lat_max - meta.lat_min) / meta.rows
    lon = meta.lon_min + (col + 0.5) * (meta.lon_max - meta.lon_min) / meta.cols
    return lat, lon


def latlon_to_grid(lat: float, lon: float, meta: GridMetadata) -> Tuple[int, int]:
    """
    Convert Mars planetocentric (lat, lon) to nearest grid (row, col).
    Clamps to grid bounds.

    Returns:
        (row, col) 0-indexed, clamped to [0, rows-1] × [0, cols-1]
    """
    row_f = (meta.lat_max - lat) / (meta.lat_max - meta.lat_min) * meta.rows - 0.5
    col_f = (lon - meta.lon_min) / (meta.lon_max - meta.lon_min) * meta.cols - 0.5
    row = int(round(row_f))
    col = int(round(col_f))
    row = max(0, min(meta.rows - 1, row))
    col = max(0, min(meta.cols - 1, col))
    return row, col


def bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Initial bearing from point 1 to point 2 (degrees, clockwise from north).
    """
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dlambda = math.radians(lon2 - lon1)
    x = math.sin(dlambda) * math.cos(phi2)
    y = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(dlambda)
    return (math.degrees(math.atan2(x, y)) + 360) % 360


def cell_diagonal_m(meta: GridMetadata) -> float:
    """
    Euclidean diagonal distance across one grid cell in metres.
    Uses non-square cell dimensions.
    """
    return math.sqrt(meta.cell_size_ns_m ** 2 + meta.cell_size_ew_m ** 2)


def neighbor_distance_m(row: int, col: int, nrow: int, ncol: int, meta: GridMetadata) -> float:
    """
    Physical distance (metres) between adjacent grid cells (row,col) → (nrow,ncol).
    Properly handles non-square cells using haversine.
    """
    lat1, lon1 = grid_to_latlon(row, col, meta)
    lat2, lon2 = grid_to_latlon(nrow, ncol, meta)
    return haversine_mars(lat1, lon1, lat2, lon2)
