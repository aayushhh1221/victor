"""
PATHWISE — Synthetic Fallback Data Generator.

EMERGENCY FALLBACK ONLY. This script generates synthetic grids
modeled on published Jezero Crater geological maps.

ALL output is explicitly labeled DEMONSTRATION — NOT REAL NASA DATA.
Provenance records contain SYNTHETIC product IDs.
DataService will detect this and set data_mode = DEMONSTRATION.

Scientific basis:
- Crater floor elevation derived from: Goudge et al. 2015,
  Farley et al. 2020 (Science 374), Mangold et al. 2021
- Delta lobe geometry: Goudge et al. 2017
- Seitah formation: Farley et al. 2022 (Science 377)
"""
import sys
import json
import logging
from pathlib import Path
from datetime import datetime

import numpy as np
from scipy.ndimage import gaussian_filter

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("pathwise.synthetic")

CACHE_DIR = ROOT / "backend" / "data" / "cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

ROWS, COLS = 300, 300
LAT_MIN, LAT_MAX = 18.0, 18.9
LON_MIN, LON_MAX = 77.0, 78.0
CELL_NS_M = 177.5
CELL_EW_M = 187.1

rng = np.random.default_rng(42)  # Reproducible


def gaussian_blob(rows, cols, center_r, center_c, sigma_r, sigma_c, amplitude):
    """2D Gaussian blob for synthetic geological features."""
    R, C = np.mgrid[0:rows, 0:cols]
    return amplitude * np.exp(
        -0.5 * (((R - center_r) / sigma_r) ** 2 + ((C - center_c) / sigma_c) ** 2)
    )


def generate_elevation() -> np.ndarray:
    """
    Synthetic elevation modeled on Jezero Crater.
    Reference: Goudge et al. 2015, Farley et al. 2020.
    Units: metres (negative = below datum)
    """
    logger.info("Generating synthetic elevation (Jezero model)...")
    elev = np.full((ROWS, COLS), -2500.0)

    # Crater rim: ring of higher elevation (~20 cells wide at edges)
    for r in range(ROWS):
        for c in range(COLS):
            rim_r = min(r, ROWS - 1 - r)
            rim_c = min(c, COLS - 1 - c)
            rim_dist = min(rim_r, rim_c)
            if rim_dist < 25:
                rim_elev = -1300.0 + (rim_dist / 25.0) * 900.0
                elev[r, c] = max(elev[r, c], rim_elev)

    # Western delta lobe (rows 40-150, cols 20-130) — rises to ~-1800m
    delta_blob = gaussian_blob(ROWS, COLS, 95, 75, 45, 45, 600.0)
    elev += delta_blob

    # Seitah formation (SE quadrant, rows 180-265, cols 150-260)
    seitah_blob = gaussian_blob(ROWS, COLS, 222, 205, 35, 45, 180.0)
    elev += seitah_blob

    # Raised shoreline arc (NE quadrant)
    for r in range(40, 120):
        for c in range(150, 230):
            dist_from_arc = abs((r - 80) + (c - 190) * 0.5) / 50.0
            if dist_from_arc < 0.3:
                elev[r, c] += 150.0 * (1 - dist_from_arc / 0.3)

    # Smooth and add noise
    elev = gaussian_filter(elev, sigma=3)
    elev += rng.normal(0, 15, size=(ROWS, COLS))
    elev = np.clip(elev, -3000, -1100)
    return elev.astype(np.float32)


def generate_slope(elev: np.ndarray) -> np.ndarray:
    """
    Derive slope from elevation using haversine cell spacing.
    8-neighbour maximum gradient.
    """
    logger.info("Generating slope from elevation gradient...")
    slope = np.zeros((ROWS, COLS), dtype=np.float32)
    for dr, dc in [(-1,0),(1,0),(0,-1),(0,1),(-1,-1),(-1,1),(1,-1),(1,1)]:
        # Physical distance for this neighbour step
        if dr != 0 and dc != 0:
            dist_m = np.sqrt(CELL_NS_M**2 + CELL_EW_M**2)
        elif dr != 0:
            dist_m = CELL_NS_M
        else:
            dist_m = CELL_EW_M

        # Roll to get neighbour values
        shifted = np.roll(np.roll(elev, dr, axis=0), dc, axis=1)
        grad = np.abs(elev - shifted) / dist_m
        s = np.degrees(np.arctan(grad))
        slope = np.maximum(slope, s)

    # Fix edge artifacts from roll
    slope[0, :] = slope[1, :]
    slope[-1, :] = slope[-2, :]
    slope[:, 0] = slope[:, 1]
    slope[:, -1] = slope[:, -2]
    return slope.astype(np.float32)


def generate_traversability(slope: np.ndarray) -> np.ndarray:
    """
    Traversability from slope.
    Approved mapping (post-audit):
    0-5° = 1.0, 5-10° = 1.5, 10-15° = 2.5, 15-20° = 5.0,
    20-25° = 10.0, >25° = impassable (999)
    """
    logger.info("Generating traversability from slope...")
    trav = np.ones((ROWS, COLS), dtype=np.float32)
    trav[slope > 5] = 1.5
    trav[slope > 10] = 2.5
    trav[slope > 15] = 5.0
    trav[slope > 20] = 10.0
    trav[slope > 25] = 999.0
    return trav


def generate_science_value(elev: np.ndarray) -> np.ndarray:
    """
    Synthetic science priority scores (MODEL — NOT direct measurements).
    Tier-based: Tier 1 (0.8-1.0) in delta/carbonate patches,
    Tier 4 (0.0-0.2) in unaltered basalt.
    Basis: Jezero science targets per Farley et al. 2020, 2022.
    """
    logger.info("Generating science value model (tier-based)...")
    sci = np.full((ROWS, COLS), 0.1, dtype=np.float32)  # Tier 4 baseline

    # Delta region — Tier 1-2 (phyllosilicates, carbonates)
    sci += gaussian_blob(ROWS, COLS, 95, 75, 50, 50, 0.75).astype(np.float32)

    # 3 Carbonate patches (Tier 1, peak 0.95) — based on Goudge et al. 2015
    carbonate_locs = [(80, 60, 12), (105, 85, 10), (70, 100, 8)]
    for cr, cc, sig in carbonate_locs:
        sci += gaussian_blob(ROWS, COLS, cr, cc, sig, sig, 0.85).astype(np.float32)

    # 2 Seitah olivine patches (Tier 2, peak 0.7) — Farley et al. 2022
    seitah_locs = [(210, 185, 18), (240, 210, 15)]
    for sr, sc_, sig in seitah_locs:
        sci += gaussian_blob(ROWS, COLS, sr, sc_, sig, sig, 0.6).astype(np.float32)

    # Ancient shoreline (Tier 2) — NE quadrant
    sci += gaussian_blob(ROWS, COLS, 80, 190, 20, 30, 0.5).astype(np.float32)

    # 2 Crater rim phyllosilicates (Tier 1, peak 0.88)
    sci += gaussian_blob(ROWS, COLS, 15, 150, 15, 15, 0.78).astype(np.float32)
    sci += gaussian_blob(ROWS, COLS, 270, 60, 12, 12, 0.72).astype(np.float32)

    # Hydrated silica (Tier 1, delta edge)
    sci += gaussian_blob(ROWS, COLS, 55, 45, 10, 10, 0.80).astype(np.float32)

    sci = np.clip(sci, 0.0, 1.0)
    sci += rng.uniform(0, 0.02, size=(ROWS, COLS)).astype(np.float32)
    return np.clip(sci, 0.0, 1.0).astype(np.float32)


def generate_hazard(slope: np.ndarray, sci: np.ndarray) -> np.ndarray:
    """
    Composite hazard: 0.5*norm_slope + 0.3*rock_hazard + 0.2*surface_dust_risk
    surface_dust_risk derived from THEMIS TI proxy (inverse of science stability).
    NOT from MCS atmospheric data.
    Scale: 0-10
    """
    logger.info("Generating hazard (slope + rock + surface_dust_risk from THEMIS proxy)...")
    norm_slope = np.clip(slope / 30.0, 0, 1)

    # Rock hazard proxy (correlated with slope but not identical)
    rock_hazard = gaussian_filter(norm_slope + rng.uniform(0, 0.1, size=(ROWS, COLS)), sigma=2)
    rock_hazard = np.clip(rock_hazard, 0, 1)

    # surface_dust_risk from THEMIS TI proxy:
    # Low TI (fine dust) = high dust risk = low science stability
    # We model: low science value in non-altered-mineral areas → higher dust accumulation
    surface_dust_risk = np.clip(0.5 - sci * 0.4 + rng.uniform(0, 0.1, size=(ROWS, COLS)), 0, 1)
    surface_dust_risk = gaussian_filter(surface_dust_risk, sigma=2).astype(np.float32)

    hazard = 10.0 * (0.5 * norm_slope + 0.3 * rock_hazard + 0.2 * surface_dust_risk)
    return np.clip(hazard, 0, 10).astype(np.float32)


def save_grid_metadata():
    meta = {
        "lat_min": LAT_MIN, "lat_max": LAT_MAX,
        "lon_min": LON_MIN, "lon_max": LON_MAX,
        "rows": ROWS, "cols": COLS,
        "cell_size_ns_m": CELL_NS_M,
        "cell_size_ew_m": CELL_EW_M,
        "cell_shape": "non-square",
        "coordinate_system": "IAU2000_planetocentric_east",
        "region_ns_km": 53.2,
        "region_ew_km": 56.1,
        "data_mode": "DEMONSTRATION",
        "label": "DEMONSTRATION — NOT REAL NASA DATA",
    }
    with open(CACHE_DIR / "grid_metadata.json", "w") as f:
        json.dump(meta, f, indent=2)
    logger.info("Saved grid_metadata.json")


def save_science_targets():
    """
    10 science targets based on published Jezero geological maps.
    science_value is a MODEL score (tier-based), NOT a direct measurement.
    distance_from_route_m and detour_cost_minutes are NOT included
    (computed at runtime from actual route).
    """
    targets = [
        {
            "id": "wdf-01", "name": "Western Delta Front",
            "type": "DELTAIC_SEDIMENT", "mineral_class": "PHYLLOSILICATE",
            "lat": 18.47, "lon": 77.25,
            "science_value": 0.92, "tier": 1,
            "description": "Primary deltaic sediment deposit at western delta lobe entry. "
                           "High phyllosilicate signature. Key Mars 2020 science target.",
            "source": "Goudge et al. 2017; Farley et al. 2020",
        },
        {
            "id": "carb-01", "name": "Carbonate Deposit Alpha",
            "type": "CARBONATE", "mineral_class": "CARBONATE",
            "lat": 18.52, "lon": 77.20,
            "science_value": 0.95, "tier": 1,
            "description": "Exposed carbonate unit in delta lobe. "
                           "Highest biosignature preservation potential in Jezero.",
            "source": "Goudge et al. 2015",
        },
        {
            "id": "carb-02", "name": "Carbonate Deposit Beta",
            "type": "CARBONATE", "mineral_class": "CARBONATE",
            "lat": 18.49, "lon": 77.28,
            "science_value": 0.88, "tier": 1,
            "description": "Secondary carbonate outcrop within delta fan.",
            "source": "Goudge et al. 2015",
        },
        {
            "id": "carb-03", "name": "Carbonate Deposit Gamma",
            "type": "CARBONATE", "mineral_class": "CARBONATE",
            "lat": 18.44, "lon": 77.33,
            "science_value": 0.83, "tier": 1,
            "description": "Tertiary carbonate exposure at delta margin.",
            "source": "Goudge et al. 2015",
        },
        {
            "id": "sei-01", "name": "Seitah Olivine Unit A",
            "type": "OLIVINE", "mineral_class": "OLIVINE_ALTERED",
            "lat": 18.20, "lon": 77.62,
            "science_value": 0.72, "tier": 2,
            "description": "Seitah formation altered olivine, southeast basin. "
                           "Interacted with water. Farley et al. 2022 primary target.",
            "source": "Farley et al. 2022 (Science 377)",
        },
        {
            "id": "sei-02", "name": "Seitah Olivine Unit B",
            "type": "OLIVINE", "mineral_class": "OLIVINE_ALTERED",
            "lat": 18.15, "lon": 77.70,
            "science_value": 0.67, "tier": 2,
            "description": "Secondary Seitah olivine exposure with alteration rind.",
            "source": "Farley et al. 2022 (Science 377)",
        },
        {
            "id": "shore-01", "name": "Ancient Shoreline",
            "type": "LACUSTRINE", "mineral_class": "PHYLLOSILICATE",
            "lat": 18.55, "lon": 77.63,
            "science_value": 0.70, "tier": 2,
            "description": "Inferred ancient shoreline of Jezero paleolake. "
                           "Lacustrine sediment deposition expected.",
            "source": "Mangold et al. 2021",
        },
        {
            "id": "phyl-01", "name": "Rim Phyllosilicate N",
            "type": "PHYLLOSILICATE", "mineral_class": "PHYLLOSILICATE",
            "lat": 18.86, "lon": 77.50,
            "science_value": 0.78, "tier": 1,
            "description": "Phyllosilicate exposure in northern crater rim. "
                           "Formed by aqueous alteration.",
            "source": "Ehlmann et al. 2008",
        },
        {
            "id": "phyl-02", "name": "Rim Phyllosilicate S",
            "type": "PHYLLOSILICATE", "mineral_class": "PHYLLOSILICATE",
            "lat": 18.04, "lon": 77.20,
            "science_value": 0.73, "tier": 1,
            "description": "Southern rim phyllosilicate outcrop.",
            "source": "Ehlmann et al. 2008",
        },
        {
            "id": "hsilica-01", "name": "Hydrated Silica Patch",
            "type": "HYDRATED_SILICA", "mineral_class": "HYDRATED_SILICA",
            "lat": 18.43, "lon": 77.15,
            "science_value": 0.85, "tier": 1,
            "description": "Hydrated silica at delta inlet. High biosignature preservation. "
                           "Tier 1 priority.",
            "source": "Goudge et al. 2017",
        },
    ]
    with open(CACHE_DIR / "science_targets.json", "w") as f:
        json.dump(targets, f, indent=2)
    logger.info(f"Saved {len(targets)} science targets")


def save_provenance():
    """
    Provenance records with SYNTHETIC product IDs so DataService
    detects DEMONSTRATION mode.
    """
    now = datetime.utcnow().isoformat() + "Z"
    records = [
        {
            "source": "MOLA/MGS (SYNTHETIC MODEL)",
            "product": "Synthetic elevation modeled on MOLA MEGDR 128ppd",
            "instrument": "MOLA (Mars Orbiter Laser Altimeter)",
            "mission": "Mars Global Surveyor (MGS)",
            "pds_product_id": "SYNTHETIC_MOLA_JEZERO_300x300",
            "observation_time": "1997-2001",
            "retrieval_date": now,
            "processing_version": "synthetic-1.0",
            "coordinate_system": "IAU2000_planetocentric_east",
            "resolution_m": 177.5,
            "confidence": "MODERATE",
            "notes": "DEMONSTRATION — NOT REAL NASA DATA. "
                    "Synthetic elevation modeled on published Jezero geology. "
                    "For VERIFIED_SNAPSHOT, run real data pipeline.",
        },
        {
            "source": "CRISM/MRO (SYNTHETIC MODEL)",
            "product": "Synthetic mineral tier model based on CRISM published results",
            "instrument": "CRISM (Compact Reconnaissance Imaging Spectrometer for Mars)",
            "mission": "Mars Reconnaissance Orbiter (MRO)",
            "pds_product_id": "SYNTHETIC_CRISM_JEZERO_TIERMODEL",
            "observation_time": "2006-present",
            "retrieval_date": now,
            "processing_version": "synthetic-1.0",
            "coordinate_system": "IAU2000_planetocentric_east",
            "resolution_m": 18.0,
            "confidence": "MODERATE",
            "notes": "DEMONSTRATION — NOT REAL NASA DATA. "
                    "Tier-based model from Goudge et al. 2015, Farley et al. 2020.",
        },
        {
            "source": "THEMIS/Odyssey (SYNTHETIC MODEL)",
            "product": "Synthetic TI-proxy for surface_dust_risk",
            "instrument": "THEMIS (Thermal Emission Imaging System)",
            "mission": "Mars Odyssey",
            "pds_product_id": "SYNTHETIC_THEMIS_JEZERO_TI",
            "observation_time": "2001-present",
            "retrieval_date": now,
            "processing_version": "synthetic-1.0",
            "coordinate_system": "IAU2000_planetocentric_east",
            "resolution_m": 100.0,
            "confidence": "LOW",
            "notes": "DEMONSTRATION — NOT REAL NASA DATA. "
                    "surface_dust_risk modeled as TI proxy.",
        },
    ]
    with open(CACHE_DIR / "provenance.json", "w") as f:
        json.dump(records, f, indent=2)
    logger.info("Saved provenance.json (DEMONSTRATION mode)")


def main():
    logger.warning("=" * 60)
    logger.warning("GENERATING SYNTHETIC FALLBACK DATA")
    logger.warning("DEMONSTRATION — NOT REAL NASA DATA")
    logger.warning("DataService will detect DEMONSTRATION mode from provenance.")
    logger.warning("=" * 60)

    elev = generate_elevation()
    np.save(CACHE_DIR / "elevation.npy", elev)
    logger.info(f"elevation: shape={elev.shape}, range=[{elev.min():.0f}, {elev.max():.0f}]m")

    slope = generate_slope(elev)
    np.save(CACHE_DIR / "slope.npy", slope)
    logger.info(f"slope: max={slope.max():.1f}°")

    trav = generate_traversability(slope)
    np.save(CACHE_DIR / "traversability.npy", trav)
    logger.info(f"traversability: impassable cells={np.sum(trav >= 999)}")

    sci = generate_science_value(elev)
    np.save(CACHE_DIR / "science_value.npy", sci)
    logger.info(f"science_value: range=[{sci.min():.3f}, {sci.max():.3f}]")

    hazard = generate_hazard(slope, sci)
    np.save(CACHE_DIR / "hazard.npy", hazard)
    logger.info(f"hazard: range=[{hazard.min():.2f}, {hazard.max():.2f}]")

    save_grid_metadata()
    save_science_targets()
    save_provenance()

    # Validate
    for name in ["elevation", "slope", "traversability", "hazard", "science_value"]:
        arr = np.load(CACHE_DIR / f"{name}.npy")
        assert arr.shape == (300, 300), f"{name} shape mismatch: {arr.shape}"

    logger.info("✓ All grids validated: shape (300, 300)")
    logger.info("✓ Synthetic fallback complete — data_mode will be DEMONSTRATION")


if __name__ == "__main__":
    main()
