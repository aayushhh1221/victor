"""
VICTOR — One-command bootstrap for a fresh clone.

Brings a newly cloned repository to a runnable state:

  1. Generates the data grids if they are missing (via scripts/data_pipeline.py).
  2. Generates the map tile pyramid if it is missing (via scripts/generate_tiles.py).

Both steps are idempotent and skip themselves when their output already exists,
so this is safe to re-run.

Usage (from the repository root):

    python scripts/bootstrap.py              # grids + tiles
    python scripts/bootstrap.py --skip-tiles # grids only (faster; tiles take minutes)

Why this exists: the backend refuses to serve routes without the .npy grids, and
the test suite silently skips 24 of its 47 tests when they are absent — so a
fresh clone that skips this step appears to work while being substantially
non-functional. See docs/PROJECT_STATUS_REPORT.md (HIGH-6, MEDIUM-1).
"""
import argparse
import logging
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
CACHE_DIR = ROOT / "backend" / "data" / "cache"
TILES_DIR = ROOT / "backend" / "data" / "tiles"

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s — %(message)s")
logger = logging.getLogger("victor.bootstrap")

REQUIRED_GRIDS = [
    "elevation.npy",
    "slope.npy",
    "traversability.npy",
    "hazard.npy",
    "science_value.npy",
    "grid_metadata.json",
    "science_targets.json",
    "provenance.json",
]


def grids_present() -> bool:
    """True when every grid and metadata file the DataService requires exists."""
    return all((CACHE_DIR / name).exists() for name in REQUIRED_GRIDS)


def tiles_present() -> bool:
    """True when the tile pyramid looks populated (zoom 1 of the terrain layer)."""
    return (TILES_DIR / "terrain" / "1").is_dir()


def run_step(script: str, description: str) -> None:
    """Run a pipeline script, failing loudly rather than continuing half-set-up."""
    logger.info(f"{description} — running scripts/{script}")
    result = subprocess.run([sys.executable, str(ROOT / "scripts" / script)])
    if result.returncode != 0:
        logger.error(f"scripts/{script} failed with exit code {result.returncode}.")
        sys.exit(result.returncode)


def main() -> None:
    parser = argparse.ArgumentParser(description="Bootstrap a fresh VICTOR clone.")
    parser.add_argument(
        "--skip-tiles",
        action="store_true",
        help="Generate data grids only. Tile generation takes several minutes.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Regenerate even if output already exists.",
    )
    args = parser.parse_args()

    logger.info("VICTOR bootstrap starting.")

    if grids_present() and not args.force:
        logger.info("Data grids already present — skipping data pipeline.")
    else:
        run_step("data_pipeline.py", "Generating data grids")

    if args.skip_tiles:
        logger.info("--skip-tiles given — not generating map tiles.")
    elif tiles_present() and not args.force:
        logger.info("Tile pyramid already present — skipping tile generation.")
    else:
        run_step("generate_tiles.py", "Generating map tiles (this takes a few minutes)")

    logger.info("Bootstrap complete. Start the backend from the repository root with:")
    logger.info("    uvicorn backend.main:app --reload --port 8000")


if __name__ == "__main__":
    main()
