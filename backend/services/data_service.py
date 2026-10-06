"""PATHWISE — Data service: loads and serves all precomputed NASA grids."""
from __future__ import annotations
import json
import logging
from pathlib import Path
from typing import Optional, Tuple
import numpy as np
from ..config import settings
from ..models.domain import GridMetadata, ScienceTarget, ProvenanceRecord
from ..models.enums import DataMode, MineralClass, ScienceTier, ConfidenceLevel
from ..utils.mars_geo import latlon_to_grid, grid_to_latlon

logger = logging.getLogger(__name__)


class DataService:
    """
    Central data service for PATHWISE.

    Loads pre-processed NASA grids from cache directory.
    Detects DataMode: VERIFIED_SNAPSHOT if real NASA data present,
    DEMONSTRATION if only synthetic fallback exists.
    """

    def __init__(self) -> None:
        self.cache_dir = settings.CACHE_DIR
        self._elevation: Optional[np.ndarray] = None
        self._slope: Optional[np.ndarray] = None
        self._traversability: Optional[np.ndarray] = None
        self._hazard: Optional[np.ndarray] = None
        self._science_value: Optional[np.ndarray] = None
        self._metadata: Optional[GridMetadata] = None
        self._science_targets: list[ScienceTarget] = []
        self._provenance: list[ProvenanceRecord] = []
        self._data_mode: DataMode = DataMode.DEMONSTRATION
        self._loaded = False

    def load(self) -> None:
        """Load all grids and metadata from cache directory."""
        try:
            self._load_grids()
            self._load_metadata()
            self._load_science_targets()
            self._load_provenance()
            self._detect_data_mode()
            self._loaded = True
            logger.info(f"DataService loaded: mode={self._data_mode}, "
                       f"grid={self._elevation.shape}")
        except Exception as e:
            logger.error(f"DataService load failed: {e}")
            raise

    def _load_grids(self) -> None:
        required = ["elevation", "slope", "traversability", "hazard", "science_value"]
        for name in required:
            path = self.cache_dir / f"{name}.npy"
            if not path.exists():
                raise FileNotFoundError(f"Missing grid: {path}")
            arr = np.load(path)
            if arr.shape != (300, 300):
                raise ValueError(f"{name}.npy shape={arr.shape}, expected (300,300)")
            setattr(self, f"_{name}", arr)

    def _load_metadata(self) -> None:
        path = self.cache_dir / "grid_metadata.json"
        if path.exists():
            with open(path) as f:
                self._metadata = GridMetadata(**json.load(f))
        else:
            self._metadata = GridMetadata()  # defaults are correct

    def _load_science_targets(self) -> None:
        path = self.cache_dir / "science_targets.json"
        if path.exists():
            with open(path) as f:
                raw = json.load(f)
            self._science_targets = [
                ScienceTarget(
                    id=t["id"],
                    name=t["name"],
                    type=t["type"],
                    mineral_class=MineralClass(t.get("mineral_class", "UNKNOWN")),
                    location={"lat": t["lat"], "lon": t["lon"]},
                    science_value=t["science_value"],
                    tier=ScienceTier(t.get("tier", 4)),
                    description=t["description"],
                    source=t["source"],
                )
                for t in raw
            ]
        else:
            self._science_targets = []

    def _load_provenance(self) -> None:
        path = self.cache_dir / "provenance.json"
        if path.exists():
            with open(path) as f:
                raw = json.load(f)
            self._provenance = [ProvenanceRecord(**p) for p in raw]
        else:
            self._provenance = []

    def _detect_data_mode(self) -> None:
        """
        Determine data mode from provenance metadata.
        Real NASA data → VERIFIED_SNAPSHOT
        Synthetic fallback only → DEMONSTRATION
        """
        prov_path = self.cache_dir / "provenance.json"
        if not prov_path.exists():
            self._data_mode = DataMode.DEMONSTRATION
            return
        # Check if provenance contains real PDS product IDs (not synthetic)
        has_real = any(
            p.pds_product_id and not p.pds_product_id.startswith("SYNTHETIC")
            for p in self._provenance
        )
        self._data_mode = DataMode.VERIFIED_SNAPSHOT if has_real else DataMode.DEMONSTRATION

    # ── Public accessors ──────────────────────────────────────────────────────

    @property
    def metadata(self) -> GridMetadata:
        return self._metadata

    @property
    def data_mode(self) -> DataMode:
        return self._data_mode

    @property
    def elevation(self) -> np.ndarray:
        return self._elevation

    @property
    def slope(self) -> np.ndarray:
        return self._slope

    @property
    def traversability(self) -> np.ndarray:
        return self._traversability

    @property
    def hazard(self) -> np.ndarray:
        return self._hazard

    @property
    def science_value(self) -> np.ndarray:
        return self._science_value

    def get_value_at(self, grid: np.ndarray, lat: float, lon: float) -> float:
        r, c = latlon_to_grid(lat, lon, self._metadata)
        return float(grid[r, c])

    def get_elevation(self, lat: float, lon: float) -> float:
        return self.get_value_at(self._elevation, lat, lon)

    def get_slope(self, lat: float, lon: float) -> float:
        return self.get_value_at(self._slope, lat, lon)

    def get_science_targets(self) -> list[ScienceTarget]:
        return self._science_targets

    def get_provenance(self) -> list[ProvenanceRecord]:
        return self._provenance

    def get_traversability_grid(self) -> np.ndarray:
        return self._traversability

    def get_science_grid(self) -> np.ndarray:
        return self._science_value

    def is_loaded(self) -> bool:
        return self._loaded

    def latlon_to_grid(self, lat: float, lon: float) -> Tuple[int, int]:
        return latlon_to_grid(lat, lon, self._metadata)

    def grid_to_latlon(self, row: int, col: int) -> Tuple[float, float]:
        return grid_to_latlon(row, col, self._metadata)
