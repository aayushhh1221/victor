"""
VICTOR — NASA data provenance tracking.

Every grid VICTOR reasons over must be traceable to a specific, citable source.
This module is the single place that record is defined and serialised.

The core distinction it enforces is **classification**:

    MEASURED  — values read from a published NASA instrument product, resampled
                but not reinterpreted. "This elevation is MOLA's elevation."
    DERIVED   — computed from measured inputs by a documented transformation.
                "This slope is the gradient of MOLA elevation."
    MODELLED  — assigned by a VICTOR model, not traceable to an instrument
                reading of that quantity. "This science score is our tier model."
    SYNTHETIC — generated, with no NASA input at all. Demonstration only.

That distinction is the project's central honesty claim, and the reason this
module exists rather than the provenance being a loose dict: a reviewer asking
"is this measured or modelled?" must get a per-layer answer that the code itself
guarantees, not one maintained by hand in a JSON file.
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Optional


class Classification(str, Enum):
    """How directly a value traces to a NASA instrument reading."""

    MEASURED = "MEASURED"
    DERIVED = "DERIVED"
    MODELLED = "MODELLED"
    SYNTHETIC = "SYNTHETIC"


# Classifications that rest on real NASA instrument data.
# MODELLED is included deliberately: a score computed *from* real NASA
# measurements by a documented model is legitimate science, not fabrication, so
# long as it is labelled MODELLED per-layer. Only SYNTHETIC — invented values
# with no NASA input — disqualifies a run.
NASA_BACKED_CLASSIFICATIONS = frozenset(
    {Classification.MEASURED, Classification.DERIVED, Classification.MODELLED}
)

# The challenge contract makes multi-mission integration mandatory:
#   "must combine data from more than one NASA science mission"
#   "Multi-mission data integration is mandatory"
# This is the minimum number of distinct NASA missions a compliant run needs.
MIN_NASA_MISSIONS = 2


@dataclass
class DataSource:
    """A single citable NASA product, and what VICTOR derived from it."""

    product_id: str
    title: str
    mission: str
    instrument: str
    url: str
    classification: Classification

    # Canonical NASA mission attribution. Free-text `mission` is for display;
    # this list is what the multi-mission compliance check counts, so a derived
    # product must name every mission that contributed to it.
    nasa_missions: list[str] = field(default_factory=list)

    # Distribution lineage — these products are NASA mission data served through
    # NASA/USGS archives, and a reviewer asking "is this NASA data?" should be
    # able to read the answer here rather than infer it from a hostname.
    distributor: Optional[str] = None
    archive_node: Optional[str] = None

    # Source characteristics
    native_resolution: Optional[str] = None
    native_resolution_m: Optional[float] = None
    native_crs: Optional[str] = None
    observation_window: Optional[str] = None
    license: Optional[str] = None

    # Integrity and retrieval
    retrieved_at: Optional[str] = None
    checksum_sha256: Optional[str] = None
    # Per-grid checksums, keyed by grid name. `checksum_sha256` above covers only
    # one grid, which is ambiguous for a source that produces several (slope and
    # traversability, or the two CRISM mineral indices) — an auditor recomputing
    # hashes cannot tell which grid the single value refers to. This maps every
    # produced grid to its own hash so each one is independently verifiable.
    grid_checksums: dict[str, str] = field(default_factory=dict)
    published_checksum_md5: Optional[str] = None
    bytes_read: Optional[int] = None

    # What VICTOR did with it
    grids_produced: list[str] = field(default_factory=list)
    processing_chain: list[str] = field(default_factory=list)
    caveats: list[str] = field(default_factory=list)

    def __post_init__(self):
        # A source that names no mission cannot count toward the mandatory
        # multi-mission requirement; default to the display name so the
        # attribution is never silently empty.
        if not self.nasa_missions and self.mission:
            self.nasa_missions = [self.mission]

    def to_dict(self) -> dict:
        d = asdict(self)
        d["classification"] = self.classification.value
        return d

    def to_legacy_record(self) -> dict:
        """Export in the flat shape `ProvenanceRecord` and the API already expect.

        The rich record above is the source of truth; this keeps
        `GET /api/v1/map/region` working without a schema migration.
        """
        confidence = {
            Classification.MEASURED: "HIGH",
            Classification.DERIVED: "MODERATE",
            Classification.MODELLED: "LOW",
            Classification.SYNTHETIC: "LOW",
        }[self.classification]

        note_parts = [f"[{self.classification.value}]"]
        if self.distributor:
            note_parts.append(f"Distributed by {self.distributor}.")
        if self.archive_node:
            note_parts.append(f"Archive: {self.archive_node}.")
        note_parts.extend(self.processing_chain)
        note_parts.extend(self.caveats)

        return {
            "source": f"{self.instrument} / {self.mission}",
            "product": self.title,
            "instrument": self.instrument,
            "mission": self.mission,
            "pds_product_id": self.product_id,
            "observation_time": self.observation_window,
            "retrieval_date": self.retrieved_at,
            "processing_version": f"{self.classification.value.lower()}-1.0",
            "coordinate_system": self.native_crs or "IAU2000_planetocentric_east",
            "resolution_m": self.native_resolution_m,
            "confidence": confidence,
            "notes": " ".join(note_parts),
        }


class ProvenanceRegistry:
    """Collects DataSource records and serialises them to provenance.json."""

    def __init__(self, region: str, extent: dict | None = None):
        self.region = region
        self.extent = extent or {}
        self._sources: dict[str, DataSource] = {}

    def register(self, source: DataSource) -> DataSource:
        """Add or replace a source record, stamping retrieval time if absent."""
        if source.retrieved_at is None:
            source.retrieved_at = datetime.now(timezone.utc).isoformat()
        self._sources[source.product_id] = source
        return source

    @property
    def sources(self) -> list[DataSource]:
        return list(self._sources.values())

    def grids_covered(self) -> dict[str, str]:
        """Map each produced grid name to the classification backing it."""
        coverage: dict[str, str] = {}
        for src in self._sources.values():
            for grid in src.grids_produced:
                coverage[grid] = src.classification.value
        return coverage

    def nasa_missions(self) -> list[str]:
        """Distinct NASA science missions contributing real data to this run.

        SYNTHETIC sources are excluded — fabricated data contributes no mission.
        """
        missions: set[str] = set()
        for src in self._sources.values():
            if src.classification is Classification.SYNTHETIC:
                continue
            missions.update(src.nasa_missions)
        return sorted(missions)

    def synthetic_sources(self) -> list[str]:
        """Product IDs of any fabricated sources — the disqualifying case."""
        return [
            s.product_id for s in self._sources.values()
            if s.classification is Classification.SYNTHETIC
        ]

    def is_real_data(self) -> bool:
        """True when no source is fabricated.

        MODELLED layers are permitted: a science score computed from real NASA
        measurements by a documented model is legitimate analysis. Only
        SYNTHETIC — values invented with no NASA input — fails this check.
        """
        if not self._sources:
            return False
        return not self.synthetic_sources()

    def satisfies_multi_mission_requirement(self) -> bool:
        """True when data from at least MIN_NASA_MISSIONS distinct missions is used.

        The challenge contract states this as mandatory, not optional:
        "Multi-mission data integration is mandatory."
        """
        return len(self.nasa_missions()) >= MIN_NASA_MISSIONS

    def is_challenge_compliant(self) -> bool:
        """True when both mandatory data requirements are met."""
        return self.is_real_data() and self.satisfies_multi_mission_requirement()

    def compliance_report(self) -> dict:
        """Machine-checkable status against the contract's mandatory data rules.

        Surfaced via the API so the Data Sources view can state compliance as a
        fact derived from the actual provenance, rather than a claim in prose.
        """
        missions = self.nasa_missions()
        synthetic = self.synthetic_sources()
        return {
            "real_nasa_data": self.is_real_data(),
            "multi_mission": self.satisfies_multi_mission_requirement(),
            "compliant": self.is_challenge_compliant(),
            "nasa_missions": missions,
            "mission_count": len(missions),
            "missions_required": MIN_NASA_MISSIONS,
            "synthetic_sources": synthetic,
            "blocking_issues": self._blocking_issues(missions, synthetic),
        }

    def _blocking_issues(self, missions: list[str], synthetic: list[str]) -> list[str]:
        issues: list[str] = []
        if synthetic:
            issues.append(
                "Fabricated (SYNTHETIC) sources present, which the challenge's "
                f"real-data requirement disallows: {', '.join(synthetic)}"
            )
        if len(missions) < MIN_NASA_MISSIONS:
            issues.append(
                f"Only {len(missions)} NASA mission(s) integrated "
                f"({', '.join(missions) or 'none'}); the challenge requires at "
                f"least {MIN_NASA_MISSIONS}."
            )
        return issues

    def data_mode(self) -> str:
        """The DataMode this provenance implies. Never set this by hand."""
        return "VERIFIED_SNAPSHOT" if self.is_challenge_compliant() else "DEMONSTRATION"

    def label(self) -> str:
        """Human-readable banner text matching the implied data mode."""
        if self.is_challenge_compliant():
            n = len(self.nasa_missions())
            return f"VERIFIED SNAPSHOT — real NASA open data from {n} missions"
        return "DEMONSTRATION — NOT REAL NASA DATA"

    def to_dict(self) -> dict:
        return {
            "region": self.region,
            "extent": self.extent,
            "data_mode": self.data_mode(),
            "label": self.label(),
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "compliance": self.compliance_report(),
            "grid_classification": self.grids_covered(),
            "sources": [s.to_dict() for s in self.sources],
        }

    def write(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(self.to_dict(), indent=2), encoding="utf-8")

    def write_legacy(self, path: Path) -> None:
        """Write the flat list form that DataService and the API consume."""
        path.parent.mkdir(parents=True, exist_ok=True)
        records = [s.to_legacy_record() for s in self.sources]
        path.write_text(json.dumps(records, indent=2), encoding="utf-8")


def sha256_of_array(arr) -> str:
    """Checksum a numpy array's bytes.

    Raw source rasters are never stored whole (windowed reads only), so the
    integrity anchor is the derived grid actually committed to the repository.
    """
    h = hashlib.sha256()
    h.update(np_ascontiguous(arr).tobytes())
    return h.hexdigest()


def np_ascontiguous(arr):
    """Ensure a C-contiguous buffer so checksums are reproducible."""
    import numpy as np

    return np.ascontiguousarray(arr)
