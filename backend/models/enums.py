"""PATHWISE — Enumeration types."""
from enum import Enum


class RouteStrategy(str, Enum):
    SAFEST = "SAFEST"
    FASTEST = "FASTEST"
    SCIENCE_RICHEST = "SCIENCE_RICHEST"
    BALANCED = "BALANCED"


class DataMode(str, Enum):
    LIVE = "LIVE"
    VERIFIED_SNAPSHOT = "VERIFIED_SNAPSHOT"
    DEMONSTRATION = "DEMONSTRATION"


class MineralClass(str, Enum):
    CARBONATE = "CARBONATE"
    PHYLLOSILICATE = "PHYLLOSILICATE"
    HYDRATED_SILICA = "HYDRATED_SILICA"
    OLIVINE_ALTERED = "OLIVINE_ALTERED"
    SULFATE = "SULFATE"
    PYROXENE = "PYROXENE"
    IRON_OXIDE = "IRON_OXIDE"
    BASALT = "BASALT"
    UNKNOWN = "UNKNOWN"


class ConfidenceLevel(str, Enum):
    HIGH = "HIGH"
    MODERATE = "MODERATE"
    LOW = "LOW"


class ScienceTier(int, Enum):
    TIER_1 = 1  # 0.8–1.0 — Biosignature-relevant
    TIER_2 = 2  # 0.5–0.8 — Water interaction
    TIER_3 = 3  # 0.2–0.5 — Geological context
    TIER_4 = 4  # 0.0–0.2 — Baseline


class ParetoStatus(str, Enum):
    NON_DOMINATED = "NON_DOMINATED"
    DOMINATED = "DOMINATED"
