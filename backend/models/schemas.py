"""PATHWISE — API request/response schemas."""
from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field
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


class ScenarioModification(BaseModel):
    max_slope_deg: Optional[float] = None
    walking_speed_kmh: Optional[float] = None
    max_eva_hours: Optional[float] = None
    weight_overrides: Optional[dict[str, dict[str, float]]] = None


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
    science_value: float
    science_tier: int
    hazard_score: float
    traversability_cost: float
    cost_breakdown: dict
    counterfactuals: dict[str, float]  # cost_without_X for each component
    data_sources: list[dict]
    confidence_per_layer: dict[str, str]
