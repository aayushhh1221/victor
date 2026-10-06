"""
PATHWISE — Map Tile Generator.

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
logger = logging.getLogger("pathwise.tiles")

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
    """Linear interpolation between colormap stops."""
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
    """Convert a 2D numpy grid to a PIL image using a colormap."""
    rows, cols = grid.shape
    img = Image.new(mode, (cols, rows))
    pixels = img.load()

    for r in range(rows):
        for c in range(cols):
            color = interpolate_color(float(grid[r, c]), colormap)
            if mode == "RGBA":
                pixels[c, r] = color[:4] if len(color) >= 4 else color + (255,)
            else:
                pixels[c, r] = color[:3]
    return img


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


def main():
    if not (CACHE_DIR / "elevation.npy").exists():
        logger.error("Cache not found. Run data pipeline first.")
        sys.exit(1)

    TILES_DIR.mkdir(parents=True, exist_ok=True)

    elevation = np.load(CACHE_DIR / "elevation.npy")
    hazard = np.load(CACHE_DIR / "hazard.npy")
    science = np.load(CACHE_DIR / "science_value.npy")

    # Terrain (elevation, RGB)
    generate_layer_tiles("terrain", elevation, TERRAIN_COLORS, "RGB")
    generate_layer_tiles("elevation", elevation, TERRAIN_COLORS, "RGB")

    # Hazard overlay (RGBA for transparency)
    generate_layer_tiles("hazard", hazard, HAZARD_COLORS, "RGBA")

    # Science overlay (RGBA for transparency)
    generate_layer_tiles("science", science, SCIENCE_COLORS, "RGBA")

    create_placeholder()
    logger.info("✓ Tile generation complete")


if __name__ == "__main__":
    main()
