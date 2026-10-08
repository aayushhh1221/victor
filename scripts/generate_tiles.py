"""
VICTOR — Map Tile Generator.

Generates PNG tile sets from grid data for Leaflet display.
Zoom levels 1-5 for terrain, hazard, and science layers.
"""
import sys
import math
import logging
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("victor.tiles")

CACHE_DIR = ROOT / "backend" / "data" / "cache"
TILES_DIR = ROOT / "backend" / "data" / "tiles"
TILE_SIZE = 256

# Mars color palettes
TERRAIN_COLORS = [
    (-3100, (10, 5, 3)),      # Deep crater floor (very dark)
    (-2800, (60, 30, 15)),    # Crater floor (dark rust)
    (-2400, (120, 65, 30)),   # Mid basin (rust)
    (-2000, (160, 90, 45)),   # Delta/basin floor (sandy rust)
    (-1600, (190, 120, 60)),  # Delta lobe (tan)
    (-1200, (210, 150, 80)),  # Rim slopes (light tan)
    (-1000, (230, 180, 110)), # Upper rim (cream)
]

HAZARD_COLORS = [
    (0.0,  (0, 80, 0, 0)),      # Low hazard — transparent
    (3.0,  (255, 200, 0, 60)),  # Moderate — yellow semi-transparent
    (6.0,  (255, 100, 0, 100)), # High — orange
    (10.0, (200, 0, 0, 150)),   # Very high — red
]

SCIENCE_COLORS = [
    (0.0,  (0, 0, 100, 0)),      # No science — transparent
    (0.2,  (0, 50, 150, 30)),    # Tier 4 — faint blue
    (0.5,  (0, 120, 80, 80)),    # Tier 3 — teal
    (0.8,  (0, 180, 50, 120)),   # Tier 2 — green
    (1.0,  (50, 220, 50, 180)),  # Tier 1 — bright green
]


def interpolate_color(value, colormap):
    """Linear interpolation between colormap stops (scalar; kept for callers)."""
    vals = [c[0] for c in colormap]
    cols = [c[1] for c in colormap]

    if value <= vals[0]:
        return cols[0]
    if value >= vals[-1]:
        return cols[-1]

    for i in range(len(vals) - 1):
        if vals[i] <= value <= vals[i+1]:
            t = (value - vals[i]) / (vals[i+1] - vals[i])
            c0, c1 = cols[i], cols[i+1]
            return tuple(int(c0[j] + t * (c1[j] - c0[j])) for j in range(len(c0)))
    return cols[-1]


def grid_to_image(grid: np.ndarray, colormap, mode: str = "RGB") -> Image.Image:
    """Convert a 2D numpy grid to a PIL image using a colormap.

    Vectorised with np.interp per channel. The original implementation called
    interpolate_color once per pixel — 90,000 Python calls per layer, which is
    the reason tile generation was slow enough to be excluded from the build.
    """
    stops = np.array([c[0] for c in colormap], dtype=np.float64)
    channels = len(colormap[0][1])
    cols = np.array(
        [list(c[1]) + [255] * (channels - len(c[1])) for c in colormap],
        dtype=np.float64,
    )

    flat = np.nan_to_num(grid.astype(np.float64), nan=float(stops[0])).ravel()
    n_out = 4 if mode == "RGBA" else 3
    out = np.zeros((flat.size, n_out), dtype=np.uint8)
    for ch in range(min(n_out, channels)):
        out[:, ch] = np.clip(
            np.interp(flat, stops, cols[:, ch]), 0, 255
        ).astype(np.uint8)
    if n_out == 4 and channels < 4:
        out[:, 3] = 255

    rows, cols_n = grid.shape
    return Image.fromarray(out.reshape(rows, cols_n, n_out), mode=mode)


def normalize_to_uint8(grid: np.ndarray) -> np.ndarray:
    """Stretch a grid to 0-255 across its 2nd-98th percentile.

    Used for single-band imagery, where absolute values carry no colour meaning
    and a percentile stretch gives usable contrast.
    """
    finite = grid[np.isfinite(grid)]
    if finite.size == 0:
        return np.zeros(grid.shape, dtype=np.float64)
    lo, hi = np.percentile(finite, [2, 98])
    if hi - lo < 1e-9:
        return np.zeros(grid.shape, dtype=np.float64)
    return np.clip((grid - lo) / (hi - lo), 0.0, 1.0) * 255.0


def generate_tile(layer_img: Image.Image, z: int, x: int, y: int, out_dir: Path):
    """Extract a tile from the full layer image."""
    n_tiles = 2 ** z
    total_w, total_h = layer_img.size

    tile_w = total_w / n_tiles
    tile_h = total_h / n_tiles

    left = int(x * tile_w)
    top = int(y * tile_h)
    right = int((x + 1) * tile_w)
    bottom = int((y + 1) * tile_h)

    tile = layer_img.crop((left, top, right, bottom))
    tile = tile.resize((TILE_SIZE, TILE_SIZE), Image.LANCZOS)

    tile_path = out_dir / str(z) / str(x) / f"{y}.png"
    tile_path.parent.mkdir(parents=True, exist_ok=True)
    tile.save(str(tile_path), "PNG")


def generate_layer_tiles(layer_name: str, grid: np.ndarray, colormap, mode: str = "RGB"):
    """Generate tiles at zoom 1-5 for a layer."""
    logger.info(f"Generating tiles for layer: {layer_name}")
    out_dir = TILES_DIR / layer_name
    out_dir.mkdir(parents=True, exist_ok=True)

    # Full resolution image (300×300 grid → 1024×1024 base image)
    base_size = 1024
    raw_img = grid_to_image(grid, colormap, mode)
    # Scale up for higher quality tiles
    full_img = raw_img.resize((base_size, base_size), Image.NEAREST)

    count = 0
    for z in range(1, 6):
        n_tiles = 2 ** z
        for x in range(n_tiles):
            for y in range(n_tiles):
                generate_tile(full_img, z, x, y, out_dir)
                count += 1

    logger.info(f"  → {count} tiles generated for {layer_name}")


def create_placeholder():
    """1×1 gray placeholder tile for missing tiles."""
    placeholder = Image.new("RGBA", (TILE_SIZE, TILE_SIZE), (80, 60, 50, 180))
    draw = ImageDraw.Draw(placeholder)
    draw.text((100, 120), "No data", fill=(180, 150, 120))
    placeholder.save(str(TILES_DIR / "placeholder.png"), "PNG")


GRAY_COLORS = [
    (0.0,   (0, 0, 0)),
    (255.0, (255, 255, 255)),
]

# Thermal inertia proxy: cool/dusty (low) through warm/rocky (high).
THERMAL_COLORS = [
    (0.0,  (40, 20, 90, 150)),    # low inertia — dust/sand
    (0.35, (90, 60, 160, 130)),
    (0.65, (220, 140, 60, 130)),
    (1.0,  (255, 240, 180, 150)), # high inertia — bedrock
]


def main():
    if not (CACHE_DIR / "elevation.npy").exists():
        logger.error("Cache not found. Run data pipeline first.")
        sys.exit(1)

    TILES_DIR.mkdir(parents=True, exist_ok=True)

    elevation = np.load(CACHE_DIR / "elevation.npy")
    hazard = np.load(CACHE_DIR / "hazard.npy")
    science = np.load(CACHE_DIR / "science_value.npy")

    # Shaded relief and elevation, both colormapped from the elevation grid.
    generate_layer_tiles("terrain", elevation, TERRAIN_COLORS, "RGB")
    generate_layer_tiles("elevation", elevation, TERRAIN_COLORS, "RGB")

    # Overlays use RGBA so they composite over the basemap.
    generate_layer_tiles("hazard", hazard, HAZARD_COLORS, "RGBA")
    generate_layer_tiles("science", science, SCIENCE_COLORS, "RGBA")

    # Optional layers — generated only once their grid has been ingested, which
    # is also what makes the corresponding layer report itself available.
    imagery_path = CACHE_DIR / "imagery.npy"
    if imagery_path.exists():
        imagery = normalize_to_uint8(np.load(imagery_path))
        generate_layer_tiles("imagery", imagery, GRAY_COLORS, "RGB")
    else:
        logger.info("imagery.npy absent — skipping CTX basemap tiles")

    thermal_path = CACHE_DIR / "thermal_proxy.npy"
    if thermal_path.exists():
        generate_layer_tiles("thermal", np.load(thermal_path), THERMAL_COLORS, "RGBA")
    else:
        logger.info("thermal_proxy.npy absent — skipping thermal tiles")

    dust_path = CACHE_DIR / "dust.npy"
    if dust_path.exists():
        generate_layer_tiles("dust_activity", np.load(dust_path), HAZARD_COLORS, "RGBA")
    else:
        logger.info("dust.npy absent — skipping dust tiles")

    create_placeholder()
    logger.info("✓ Tile generation complete")


if __name__ == "__main__":
    main()
