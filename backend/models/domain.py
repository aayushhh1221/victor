"""VICTOR — Core domain models."""
from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field
from .enums import (
    RouteStrategy, DataMode, MineralClass, ConfidenceLevel, ScienceTier, ParetoStatus
)


class Coordinate(BaseModel):
    """Mars planetocentric coordinate."""
    lat: float = Field(..., description="Planetocentric latitude (degrees)")
    lon: float = Field(..., description="East-positive longitude (degrees)")


class GridMetadata(BaseModel):
    """300×300 computation grid specification. Non-square cells."""
    lat_min: float = 18.0
    lat_max: float = 18.9
    lon_min: float = 77.0
    lon_max: float = 78.0
    rows: int = 300
    cols: int = 300
    cell_size_ns_m: float = 177.5   # ~177 m N-S (non-square)
    cell_size_ew_m: float = 187.1   # ~187 m E-W (non-square)
    cell_shape: str = "non-square"
    coordinate_system: str = "IAU2000_planetocentric_east"
    region_ns_km: float = 53.2
    region_ew_km: float = 56.1


class MissionConstraints(BaseModel):
    """EVA mission operational constraints."""
    max_slope_deg: float = Field(20.0, ge=5.0, le=30.0)
    max_eva_hours: float = Field(6.0, ge=1.0, le=12.0)
    walking_speed_kmh: float = Field(3.0, ge=0.5, le=6.0)


class EdgeCostBreakdown(BaseModel):
    """Per-segment edge cost decomposition for evidence attribution."""
    distance_contribution: float
    traversability_contribution: float
    hazard_contribution: float
    science_penalty_contribution: float
    total_edge_cost: float

    def cost_without(self, component: str) -> float:
        """Analytical counterfactual: cost without a given component."""
        mapping = {
            "distance": self.distance_contribution,
            "traversability": self.traversability_contribution,
            "hazard": self.hazard_contribution,
            "science_penalty": self.science_penalty_contribution,
        }
        return self.total_edge_cost - mapping.get(component, 0.0)


class RouteSegment(BaseModel):
    """Single route segment with full evidence provenance."""
    segment_id: int
    start: Coordinate
    end: Coordinate
    distance_m: float
    elevation_change_m: float
    slope_deg: float
    traversability_cost: float
    hazard_score: float
    science_value: float
    science_tier: Optional[int] = None
    cost_breakdown: Optional[EdgeCostBreakdown] = None
    contributing_layers: dict = Field(default_factory=dict)


class RouteMetrics(BaseModel):
    """Aggregate metrics for a complete route."""
    distance_km: float
    estimated_time_hours: float
    avg_hazard_score: float
    max_slope_deg: float
    total_science_value: float
    avg_science_value: float
    segments_count: int
    elevation_gain_m: float
    elevation_loss_m: float
    impassable_cells_avoided: int = 0
    confidence: ConfidenceLevel = ConfidenceLevel.MODERATE


class ScienceTarget(BaseModel):
    """Science target with tier-based MODEL scores (not direct measurements)."""
    id: str
    name: str
    type: str
    mineral_class: MineralClass = MineralClass.UNKNOWN
    location: Coordinate
    science_value: float = Field(..., ge=0.0, le=1.0,
        description="MODEL — Science Priority Score. NOT a direct NASA measurement.")
    tier: ScienceTier = ScienceTier.TIER_4
    description: str
    source: str
    # Computed at runtime from actual route — never hardcoded:
    distance_from_route_m: Optional[float] = None
    detour_cost_minutes: Optional[float] = None


class Route(BaseModel):
    """Complete route result for one strategy."""
    strategy: RouteStrategy
    path: list[Coordinate]
    segments: list[RouteSegment]
    metrics: RouteMetrics
    science_targets_nearby: list[ScienceTarget] = Field(default_factory=list)
    pareto_status: ParetoStatus = ParetoStatus.NON_DOMINATED


class ProvenanceRecord(BaseModel):
    """Full data provenance for one NASA dataset."""
    source: str
    product: str
    instrument: str
    mission: str
    pds_product_id: Optional[str] = None
    observation_time: Optional[str] = None
    retrieval_date: Optional[str] = None
    processing_version: str = "1.0"
    coordinate_system: str = "IAU2000_planetocentric_east"
    resolution_m: float
    confidence: ConfidenceLevel = ConfidenceLevel.HIGH
    notes: Optional[str] = None
