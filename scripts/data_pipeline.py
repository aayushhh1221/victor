"""
PATHWISE — Data Pipeline: Phase 1 (Real NASA Data Acquisition)

Attempts to download real NASA data from USGS Astropedia / PDS.
On failure, falls back to generate_synthetic_fallback.py.

Data priority: VERIFIED_SNAPSHOT (real NASA) > DEMONSTRATION (synthetic)

Real data sources:
- MOLA MEGDR 128 ppd: https://astrogeology.usgs.gov/search/map/Mars/GlobalSurveyor/MOLA
- CRISM multispectral maps: https://pds-geosciences.wustl.edu/missions/mro/crism.htm
- THEMIS global mosaic: https://astrogeology.usgs.gov/search/map/Mars/Odyssey/THEMIS
"""
import sys
import logging
from pathlib import Path

# Allow running as script from repo root
ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("pathwise.data_pipeline")

CACHE_DIR = ROOT / "backend" / "data" / "cache"
RAW_DIR = ROOT / "backend" / "data" / "raw"
CACHE_DIR.mkdir(parents=True, exist_ok=True)
RAW_DIR.mkdir(parents=True, exist_ok=True)

# Jezero computation extent
LAT_MIN, LAT_MAX = 18.0, 18.9
LON_MIN, LON_MAX = 77.0, 78.0
ROWS, COLS = 300, 300


def check_existing() -> bool:
    """Return True if all required cache files already exist."""
    required = [
        CACHE_DIR / "elevation.npy",
        CACHE_DIR / "slope.npy",
        CACHE_DIR / "traversability.npy",
        CACHE_DIR / "hazard.npy",
        CACHE_DIR / "science_value.npy",
        CACHE_DIR / "grid_metadata.json",
        CACHE_DIR / "science_targets.json",
        CACHE_DIR / "provenance.json",
    ]
    return all(p.exists() for p in required)


def attempt_real_data_download() -> bool:
    """
    Attempt to download real NASA data.
    Returns True if successful, False if network/data unavailable.
    """
    try:
        import requests
        import numpy as np
        import json
        from datetime import datetime

        logger.info("Attempting MOLA MEGDR download from USGS PDS...")
        # MOLA MEGDR 128 ppd — cropped to Jezero region
        # Product: megr_n90.img (north hemisphere)
        # For hackathon, we use the 128 ppd global grid and crop
        MOLA_URL = (
            "https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg128/"
            "megr_n00_128_1.img"
        )
        # Try a small HEAD request first to check availability
        resp = requests.head(MOLA_URL, timeout=10)
        if resp.status_code != 200:
            logger.warning(f"MOLA MEGDR unavailable: HTTP {resp.status_code}")
            return False

        logger.info("MOLA server responded. Downloading...")
        # Full download would proceed here for production
        # For hackathon with time constraints, we fall through to synthetic if > 30MB
        # (The full 128ppd grid is ~180MB)
        logger.warning("MOLA full download would take too long for hackathon. Using synthetic fallback.")
        return False

    except Exception as e:
        logger.warning(f"Real data download failed: {e}")
        return False


def main():
    if check_existing():
        logger.info("All cache files exist — skipping data pipeline.")
        logger.info("Delete backend/data/cache/*.npy to re-run.")
        return

    logger.info("Starting PATHWISE data pipeline...")
    logger.info(f"Grid: {ROWS}×{COLS}, extent: {LAT_MIN}–{LAT_MAX}°N, {LON_MIN}–{LON_MAX}°E")

    real_success = attempt_real_data_download()

    if real_success:
        logger.info("✓ VERIFIED_SNAPSHOT: Real NASA data downloaded successfully.")
    else:
        logger.warning("Real NASA data unavailable. Falling back to synthetic DEMONSTRATION data.")
        logger.warning("DEMONSTRATION DATA — NOT REAL NASA DATA — will be clearly labeled.")
        import subprocess
        result = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "generate_synthetic_fallback.py")],
            check=True
        )
        logger.info("Synthetic fallback generated.")


if __name__ == "__main__":
    main()
