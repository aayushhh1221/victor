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
from PIL import Image, ImageDraw, ImageFilter

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


# Calibrated Martian natural ferric-oxide palette based on Mars 2020 Mastcam-Z & Viking observations
MARS_TRUE_COLOR = [
    (0.0,   (24, 14, 10)),     # Deep shadowed basalt / dunes
    (45.0,  (65, 36, 24)),     # Low-albedo bedrock
    (100.0, (132, 74, 44)),    # Intermediate ferric sand
    (160.0, (185, 115, 68)),   # Oxidized dust & delta fan
    (210.0, (222, 155, 100)),  # Bright crater rim / light-toned carbonates
    (255.0, (246, 200, 154)),  # High-albedo peaks & ejecta
]


def generate_layer_tiles(
    layer_name: str,
    grid: np.ndarray,
    colormap,
    mode: str = "RGB",
    resample=Image.LANCZOS,
    sharpen: bool = False,
):
    """Generate tiles at zoom 1-5 for a layer with high-definition upscaling."""
    logger.info(f"Generating high-definition tiles for layer: {layer_name}")
    out_dir = TILES_DIR / layer_name
    out_dir.mkdir(parents=True, exist_ok=True)

    # 2048×2048 base canvas for razor-sharp zoom 1-5 tiles without blocky pixelation
    base_size = 2048
    raw_img = grid_to_image(grid, colormap, mode)
    full_img = raw_img.resize((base_size, base_size), resample)

    if sharpen and mode == "RGB":
        full_img = full_img.filter(ImageFilter.UnsharpMask(radius=2, percent=135, threshold=3))

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
    (0.0,   (14, 14, 14)),
    (40.0,  (48, 48, 48)),
    (100.0, (108, 108, 108)),
    (160.0, (168, 168, 168)),
    (210.0, (218, 218, 218)),
    (255.0, (248, 248, 248)),
]

# Thermal inertia proxy: cool/dusty (low) through warm/rocky (high).
THERMAL_COLORS = [
    (0.0,  (40, 20, 90, 150)),    # low inertia — dust/sand
    (0.35, (90, 60, 160, 130)),
    (0.65, (220, 140, 60, 130)),
    (1.0,  (255, 240, 180, 150)), # high inertia — bedrock
]


# Terrain archetype classes (categorical, ids 0..n). Stops are placed at exact
# class ids so np.interp returns the flat class colour rather than a blend —
# a blended value between two class ids would depict terrain that is not there.
# Surface composition from CRISM mineral indices. The first stop is fully
# transparent so CRISM swath gaps (stored as -9999, mapped to NaN) render as
# nothing at all — an unmeasured cell must not be painted as "no mineral".
COMPOSITION_COLORS = [
    (0.0,  (0, 0, 0, 0)),         # no measurement — transparent
    (0.01, (40, 60, 140, 70)),    # weak signature
    (0.35, (60, 150, 160, 120)),
    (0.65, (210, 170, 60, 150)),
    (1.0,  (220, 90, 60, 180)),   # strong mineral signature
]

CONFIDENCE_COLORS = [
    (0.0,  (120, 20, 20, 170)),   # little supporting data — flag it loudly
    (0.5,  (200, 140, 40, 120)),
    (0.75, (120, 160, 120, 60)),
    (1.0,  (60, 160, 90, 20)),    # fully supported — nearly transparent
]

TERRAIN_CLASS_COLORS = [
    (0.0, (56, 142, 180, 170)),   # class 0 — blue
    (1.0, (240, 170, 60, 170)),   # class 1 — amber
    (2.0, (200, 85, 95, 170)),    # class 2 — red
    (3.0, (120, 180, 105, 170)),  # class 3 — green
    (4.0, (155, 120, 195, 170)),  # class 4 — purple
    (5.0, (230, 130, 190, 170)),  # class 5 — pink
    (6.0, (110, 190, 190, 170)),  # class 6 — teal
]


def main():
    if not (CACHE_DIR / "elevation.npy").exists():
        logger.error("Cache not found. Run data pipeline first.")
        sys.exit(1)

    TILES_DIR.mkdir(parents=True, exist_ok=True)

    elevation = np.load(CACHE_DIR / "elevation.npy")
    hazard = np.load(CACHE_DIR / "hazard.npy")
    science = np.load(CACHE_DIR / "science_value.npy")

    # Shaded relief and elevation, both colormapped from the elevation grid with smooth Lanczos upscaling
    generate_layer_tiles("terrain", elevation, TERRAIN_COLORS, "RGB", resample=Image.LANCZOS)
    generate_layer_tiles("elevation", elevation, TERRAIN_COLORS, "RGB", resample=Image.LANCZOS)

    # Overlays use RGBA so they composite smoothly over the basemap
    generate_layer_tiles("hazard", hazard, HAZARD_COLORS, "RGBA", resample=Image.BILINEAR)
    generate_layer_tiles("science", science, SCIENCE_COLORS, "RGBA", resample=Image.BILINEAR)

    # Base imagery in crisp panchromatic grayscale with unsharp detail enhancement
    imagery_path = CACHE_DIR / "imagery.npy"
    if imagery_path.exists():
        imagery = normalize_to_uint8(np.load(imagery_path))
        generate_layer_tiles("imagery", imagery, GRAY_COLORS, "RGB", resample=Image.LANCZOS, sharpen=True)
    else:
        logger.info("imagery.npy absent — skipping CTX basemap tiles")

    thermal_path = CACHE_DIR / "thermal_proxy.npy"
    if thermal_path.exists():
        generate_layer_tiles("thermal", np.load(thermal_path), THERMAL_COLORS, "RGBA", resample=Image.BILINEAR)
    else:
        logger.info("thermal_proxy.npy absent — skipping thermal tiles")

    dust_path = CACHE_DIR / "dust.npy"
    if dust_path.exists():
        generate_layer_tiles("dust_activity", np.load(dust_path), HAZARD_COLORS, "RGBA", resample=Image.BILINEAR)
    else:
        logger.info("dust.npy absent — skipping dust tiles")

    # Terrain archetypes from the unsupervised classifier. Categorical, so NEAREST keeps classes discrete.
    terrain_class_path = CACHE_DIR / "terrain_class.npy"
    if terrain_class_path.exists():
        labels = np.load(terrain_class_path)
        generate_layer_tiles(
            "terrain_class", labels.astype(np.float64), TERRAIN_CLASS_COLORS, "RGBA", resample=Image.NEAREST
        )
    else:
        logger.info("terrain_class.npy absent — skipping terrain class tiles")

    # Surface composition from real CRISM spectra.
    ol_path = CACHE_DIR / "olivine_index.npy"
    cb_path = CACHE_DIR / "carbonate_index.npy"
    if ol_path.exists() and cb_path.exists():
        def _stretch(a):
            a = np.where(a <= -9999.0, np.nan, a)
            finite = a[np.isfinite(a)]
            if finite.size == 0:
                return a
            lo, hi = np.percentile(finite, [5, 95])
            if hi - lo < 1e-9:
                return np.zeros_like(a)
            return np.clip((a - lo) / (hi - lo), 0.0, 1.0)

        ol = _stretch(np.load(ol_path).astype(np.float64))
        cb = _stretch(np.load(cb_path).astype(np.float64))
        composition = np.fmax(ol, cb)
        composition = np.where(~np.isfinite(ol) & ~np.isfinite(cb), np.nan, composition)
        generate_layer_tiles("composition", composition, COMPOSITION_COLORS, "RGBA", resample=Image.BILINEAR)
    else:
        logger.info("CRISM index grids absent — skipping composition tiles")

    confidence_path = CACHE_DIR / "confidence.npy"
    if confidence_path.exists():
        generate_layer_tiles(
            "confidence", np.load(confidence_path), CONFIDENCE_COLORS, "RGBA", resample=Image.NEAREST
        )
    else:
        logger.info("confidence.npy absent — skipping confidence tiles")

    create_placeholder()
    logger.info("✓ Tile generation complete")


if __name__ == "__main__":
    main()
