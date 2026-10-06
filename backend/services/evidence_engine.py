"""PATHWISE — Evidence engine: per-segment provenance and counterfactual attribution."""
from __future__ import annotations
import math
from typing import Optional
from ..models.domain import RouteSegment, ProvenanceRecord
from ..models.enums import ConfidenceLevel, MineralClass, ScienceTier
from ..models.schemas import SegmentEvidenceResponse
from .data_service import DataService

# THEMIS-based surface material classification (thermal inertia proxy)
# TI ranges (J m-2 K-1 s-1/2): low = dust, medium = sand/rock mix, high = indurated
THEMIS_MATERIAL_MAP = [
    (0.0, 0.25, "Fine dust (low TI)", MineralClass.UNKNOWN),
    (0.25, 0.45, "Dust-rock mix (moderate TI)", MineralClass.BASALT),
    (0.45, 0.65, "Sand/granule (moderate-high TI)", MineralClass.BASALT),
    (0.65, 0.85, "Indurated / consolidated (high TI)", MineralClass.BASALT),
    (0.85, 1.01, "Exposed rock / bedrock", MineralClass.PYROXENE),
]

# Approximate CRISM mineral class from science_value tier
SCIENCE_TIER_MINERAL = {
    1: (MineralClass.CARBONATE, "Carbonates / Phyllosilicates / Hydrated silica"),
    2: (MineralClass.OLIVINE_ALTERED, "Altered olivine / Sulfates"),
    3: (MineralClass.PYROXENE, "Pyroxene / Iron oxides"),
    4: (MineralClass.BASALT, "Unaltered basalt / Unknown"),
}

LAYER_CONFIDENCE = {
    "MOLA_elevation": ConfidenceLevel.HIGH,
    "MOLA_slope": ConfidenceLevel.HIGH,
    "THEMIS_surface_material": ConfidenceLevel.MODERATE,
    "CRISM_science_value_model": ConfidenceLevel.MODERATE,
    "hazard_composite": ConfidenceLevel.MODERATE,
    "traversability_model": ConfidenceLevel.MODERATE,
}


def _science_tier(sci_val: float) -> int:
    if sci_val >= 0.8:
        return 1
    elif sci_val >= 0.5:
        return 2
    elif sci_val >= 0.2:
        return 3
    return 4


def _surface_material(hazard_proxy: float) -> tuple[str, MineralClass]:
    """Approximate surface material from hazard/TI proxy value [0–10]."""
    norm = hazard_proxy / 10.0
    for lo, hi, label, mineral in THEMIS_MATERIAL_MAP:
        if lo <= norm < hi:
            return label, mineral
    return "Exposed rock / bedrock", MineralClass.PYROXENE


class EvidenceEngine:
    """
    Produces per-segment evidence reports with deterministic analytical attribution.

    Counterfactuals are arithmetic: cost_without_X = total_cost - X_contribution.
    No additional A* runs are performed.
    """

    def __init__(self, data_service: DataService) -> None:
        self.ds = data_service

    def get_segment_evidence(
        self,
        segment: RouteSegment,
        computation_id: str,
    ) -> SegmentEvidenceResponse:
        """
        Generate full evidence report for a route segment.

        Returns elevation, slope, surface material, mineral class,
        science value with tier, hazard, cost decomposition,
        analytical counterfactuals, and per-layer confidence.
        """
        bd = segment.cost_breakdown
        tier = _science_tier(segment.science_value)
        surface_mat, mineral = _surface_material(segment.hazard_score)
        mineral_class, mineral_desc = SCIENCE_TIER_MINERAL.get(tier, (MineralClass.BASALT, "Unknown"))

        # Analytical counterfactuals — pure arithmetic, no extra computation
        counterfactuals: dict[str, float] = {}
        if bd:
            for comp in ["distance", "traversability", "hazard", "science_penalty"]:
                counterfactuals[f"cost_without_{comp}"] = bd.cost_without(comp)

        data_sources = [
            {
                "layer": "elevation",
                "source": "MOLA/MGS",
                "instrument": "MOLA (Mars Orbiter Laser Altimeter)",
                "mission": "Mars Global Surveyor (MGS)",
                "confidence": LAYER_CONFIDENCE["MOLA_elevation"].value,
                "resolution_m": 463,
                "data_type": "VERIFIED_SNAPSHOT",
            },
            {
                "layer": "slope",
                "source": "MOLA/MGS (derived)",
                "instrument": "Derived from MOLA elevation gradient",
                "mission": "Mars Global Surveyor (MGS)",
                "confidence": LAYER_CONFIDENCE["MOLA_slope"].value,
                "resolution_m": 177,
                "data_type": "MODEL_DERIVED",
            },
            {
                "layer": "surface_material",
                "source": "THEMIS/Mars Odyssey",
                "instrument": "THEMIS (Thermal Emission Imaging System)",
                "mission": "Mars Odyssey",
                "confidence": LAYER_CONFIDENCE["THEMIS_surface_material"].value,
                "resolution_m": 100,
                "data_type": "VERIFIED_SNAPSHOT",
            },
            {
                "layer": "science_value",
                "source": "CRISM/MRO (tier model)",
                "instrument": "CRISM (Compact Reconnaissance Imaging Spectrometer for Mars)",
                "mission": "Mars Reconnaissance Orbiter (MRO)",
                "confidence": LAYER_CONFIDENCE["CRISM_science_value_model"].value,
                "resolution_m": 18,
                "data_type": "MODEL_DERIVED",
                "label": "MODEL — Science Priority Score. NOT a direct measurement.",
            },
        ]

        return SegmentEvidenceResponse(
            computation_id=computation_id,
            segment_id=segment.segment_id,
            elevation_m=float(self.ds.get_elevation(segment.end.lat, segment.end.lon)),
            slope_deg=round(segment.slope_deg, 2),
            surface_material=surface_mat,
            mineral_class=mineral_class.value,
            science_value=round(segment.science_value, 4),
            science_tier=tier,
            hazard_score=round(segment.hazard_score, 3),
            traversability_cost=round(segment.traversability_cost, 3),
            cost_breakdown=bd.model_dump() if bd else {},
            counterfactuals=counterfactuals,
            data_sources=data_sources,
            confidence_per_layer={k: v.value for k, v in LAYER_CONFIDENCE.items()},
        )
