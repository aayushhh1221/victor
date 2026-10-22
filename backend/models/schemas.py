"""VICTOR — API request/response schemas."""
from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field, model_validator, field_validator
from .enums import RouteStrategy, DataMode, ParetoStatus
from .domain import (
    Coordinate, MissionConstraints, Route, RouteMetrics,
    ProvenanceRecord, ScienceTarget
)


class RouteComputeRequest(BaseModel):
    start: Coordinate
    destination: Coordinate
    constraints: MissionConstraints = Field(default_factory=MissionConstraints)
    strategies: list[RouteStrategy] = Field(
        default=[RouteStrategy.SAFEST, RouteStrategy.FASTEST,
                 RouteStrategy.SCIENCE_RICHEST, RouteStrategy.BALANCED]
    )
    allow_infeasible: bool = False
    weight_overrides: Optional[dict[str, float] | dict[str, dict[str, float]]] = None

    @model_validator(mode="after")
    def validate_extent(self) -> RouteComputeRequest:
        for name, coord in [("start", self.start), ("destination", self.destination)]:
            if not (18.0 <= coord.lat <= 18.9 and 77.0 <= coord.lon <= 78.0):
                raise ValueError(
                    f"{name} coordinate ({coord.lat:.4f}°N, {coord.lon:.4f}°E) is outside "
                    f"Jezero Crater study extent [18.0..18.9°N, 77.0..78.0°E]."
                )
        return self


class RouteRangeSummary(BaseModel):
    min: float
    max: float


class RouteComputeComparison(BaseModel):
    distance_range: RouteRangeSummary
    time_range: RouteRangeSummary
    science_range: RouteRangeSummary
    hazard_range: RouteRangeSummary
    trade_off_summary: str


class RouteComputeResponse(BaseModel):
    computation_id: str
    data_mode: DataMode
    strategies: dict[str, Route]
    comparison: RouteComputeComparison
    pareto: dict[str, ParetoStatus]
    provenance: list[ProvenanceRecord] = Field(default_factory=list)
    data_manifest_id: str = "manifest-jezero-2026-v1"
    pipeline_version: str = "1.0.0"
    effective_constraints: Optional[MissionConstraints] = None


class ScenarioModification(BaseModel):
    max_slope_deg: Optional[float] = None
    walking_speed_kmh: Optional[float] = None
    max_eva_hours: Optional[float] = None
    weight_overrides: Optional[dict[str, float] | dict[str, dict[str, float]]] = None

    @field_validator("weight_overrides")
    @classmethod
    def validate_weights(cls, v):
        if not v:
            return v
        allowed_keys = {"distance", "traversability", "hazard", "science_penalty"}
        # Flat dict case: {"distance": 2.0, ...}
        if all(isinstance(val, (int, float)) for val in v.values()):
            for key, val in v.items():
                if key not in allowed_keys:
                    raise ValueError(f"Unknown weight override key: '{key}'. Allowed: {sorted(allowed_keys)}")
                if not (0.0 <= val <= 5.0):
                    raise ValueError(f"Weight override for '{key}' must be between 0.0 and 5.0 (got {val})")
        else:
            for strat, weights in v.items():
                if not isinstance(weights, dict):
                    raise ValueError("Strategy weight overrides must be dictionaries")
                for key, val in weights.items():
                    if key not in allowed_keys:
                        raise ValueError(f"Unknown weight override key: '{key}'. Allowed: {sorted(allowed_keys)}")
                    if not isinstance(val, (int, float)) or not (0.0 <= val <= 5.0):
                        raise ValueError(f"Weight override for '{key}' must be between 0.0 and 5.0 (got {val})")
        return v


class ScenarioCompareRequest(BaseModel):
    base_computation_id: str
    modifications: ScenarioModification


class ScenarioDiff(BaseModel):
    strategy: str
    distance_change_km: float
    time_change_hours: float
    hazard_change: float
    science_change: float
    route_diverged: bool


class ScenarioCompareResponse(BaseModel):
    base_computation_id: str
    modified_computation_id: str
    data_mode: DataMode
    base_strategies: dict[str, Route]
    modified_strategies: dict[str, Route]
    diffs: list[ScenarioDiff]
    impact_summary: str
    pct_impassable_change: float


class RegionInfoResponse(BaseModel):
    region_name: str
    lat_min: float
    lat_max: float
    lon_min: float
    lon_max: float
    grid_rows: int
    grid_cols: int
    cell_size_ns_m: float
    cell_size_ew_m: float
    cell_shape: str
    region_ns_km: float
    region_ew_km: float
    coordinate_system: str
    data_mode: DataMode
    available_layers: list[str]
    provenance: list[ProvenanceRecord]

    # ── Fields the UI info bar needs. Added per frontend request so the UI can
    # render real values instead of falling back to hardcoded placeholders.
    # Every one of these is computed from the loaded grids or left null — none
    # is a constant typed in by hand.
    name: str = "Jezero Crater"
    lat: Optional[float] = None               # region centre
    lon: Optional[float] = None               # region centre
    elevation_m: Optional[float] = None       # mean of the real elevation grid
    elevation_min_m: Optional[float] = None
    elevation_max_m: Optional[float] = None
    elevation_source: Optional[str] = None
    terrain_type: Optional[str] = None
    terrain_subtype: Optional[str] = None
    region_description: Optional[str] = None
    compliance: Optional[dict] = None         # challenge data-requirement status


class LayerInfo(BaseModel):
    """One map layer, with explicit availability so the UI never guesses."""

    id: str
    name: str
    type: str
    source: str
    description: str
    available: bool
    unavailable_reason: Optional[str] = None
    classification: Optional[str] = None
    default_opacity: float = 1.0


class LayersResponse(BaseModel):
    data_mode: DataMode
    layers: list[LayerInfo]


class EnvironmentResponse(BaseModel):
    """Atmospheric and surface conditions.

    Every quantity is Optional and defaults to None. A null here means "not
    ingested", and the UI is expected to render it as such. Returning a
    plausible-looking number in place of a missing measurement would defeat the
    purpose of the endpoint.
    """

    region: str
    data_mode: DataMode
    surface_temperature_day_c: Optional[float] = None
    surface_temperature_night_c: Optional[float] = None
    temperature_source: Optional[str] = None
    thermal_index_mean: Optional[float] = None       # unitless THEMIS night-IR proxy
    thermal_index_source: Optional[str] = None
    dust_opacity_tau: Optional[float] = None
    dust_opacity_source: Optional[str] = None
    atmospheric_pressure_pa: Optional[float] = None
    pressure_source: Optional[str] = None
    notes: str = ""


class ScienceProfilePoint(BaseModel):
    distance_km: float
    science_value: float
    elevation_m: Optional[float] = None
    hazard_score: Optional[float] = None


class ScienceProfileResponse(BaseModel):
    computation_id: str
    strategy: str
    profile: list[ScienceProfilePoint]
    total_science_value: float
    peak_science_value: float


class SegmentEvidenceResponse(BaseModel):
    computation_id: str
    segment_id: int
    elevation_m: float
    slope_deg: float
    surface_material: str
    mineral_class: str
    # Unsupervised terrain archetype. Advisory context only — it describes the
    # ground this leg crosses and had no influence on the route chosen.
    terrain_class_id: Optional[int] = None
    terrain_class_name: Optional[str] = None
    science_value: float
    science_tier: int
    hazard_score: float
    traversability_cost: float
    cost_breakdown: dict
    counterfactuals: dict[str, float]  # cost_without_X for each component
    data_sources: list[dict]
    confidence_per_layer: dict[str, str]
