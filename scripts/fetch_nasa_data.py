"""
VICTOR — Real NASA data acquisition via windowed HTTP reads.

Replaces the synthetic fallback with genuine NASA products for the Jezero window.

## Why windowed reads

The original pipeline abandoned real data with the comment "MOLA full download
would take too long for hackathon." That was the right observation and the wrong
conclusion. The global MOLA DEM is **2 GB** — worse than the 180 MB the comment
assumed — but VICTOR needs a 1.0 deg x 0.9 deg window of it.

GDAL's /vsicurl/ driver issues HTTP range requests, so only the bytes covering
that window are transferred. Measured against the real endpoint: a full Jezero
elevation read touches **~10.6 MB of the 2 GB file in under 20 seconds**.

No bulk download, no stored raw rasters, no 180 MB problem.

## Verified sources

All three endpoints below were resolved and read successfully before this module
was written; the recorded resolutions and CRSs are what the servers actually
returned, not what a catalogue claims.

## A note on CRS handling

The sources do not agree on coordinate system. MOLA is Equirectangular in
**metres** (so degree bounds must be scaled by the sphere radius its CRS
declares), while CTX and THEMIS are geographic in **degrees**. `_window_for`
handles both rather than assuming one, because getting this wrong produces a
zero-size window that reads successfully and returns nothing.
"""
from __future__ import annotations

import logging
import math
import os
import sys
import time
from dataclasses import dataclass
from pathlib import Path

# GDAL tuning for remote reads — set before rasterio is imported.
os.environ.setdefault("GDAL_DISABLE_READDIR_ON_OPEN", "EMPTY_DIR")
# .img/.hdr/.lbl must be allowed or the ENVI and PDS3 drivers cannot reach the
# sibling header beside a remote CRISM image.
os.environ.setdefault(
    "CPL_VSIL_CURL_ALLOWED_EXTENSIONS", ".tif,.TIF,.img,.IMG,.hdr,.HDR,.lbl,.LBL"
)
os.environ.setdefault("GDAL_HTTP_MULTIPLEX", "YES")
os.environ.setdefault("VSI_CACHE", "TRUE")
os.environ.setdefault("GDAL_CACHEMAX", "512")

import numpy as np  # noqa: E402

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from backend.utils.provenance import (  # noqa: E402
    Classification,
    DataSource,
    ProvenanceRegistry,
    sha256_of_array,
)

logger = logging.getLogger("victor.fetch_nasa")

# ── Jezero computation extent (must match the existing grid contract) ──────────
LAT_MIN, LAT_MAX = 18.0, 18.9
LON_MIN, LON_MAX = 77.0, 78.0
ROWS, COLS = 300, 300
CELL_NS_M = 177.5
CELL_EW_M = 187.1

S3 = "https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/Mars"


@dataclass(frozen=True)
class RemoteRaster:
    """A verified remote NASA raster and the metadata needed to cite it."""

    product_id: str
    title: str
    mission: str
    instrument: str
    url: str
    native_resolution: str
    native_resolution_m: float
    license: str
    # Canonical mission name counted by the multi-mission compliance check.
    nasa_mission: str = ""
    distributor: str = "USGS Astrogeology Science Center"
    archive_node: str = "NASA Planetary Data System (PDS) Cartography and Imaging Science Node"
    published_md5_url: str | None = None
    # Band to read for multi-band products (1-based, as rasterio expects).
    band: int = 1
    # Explicit geographic bounds (lon_min, lat_min, lon_max, lat_max).
    # Set this for products whose embedded CRS is awkward — the CRISM map tiles
    # declare a per-tile sphere radius and a non-zero central meridian, so
    # scaling degrees by a single radius (as _window_for does) would be wrong.
    # Given exact bounds we map lat/lon linearly onto the pixel grid instead,
    # which is sub-pixel accurate and sidesteps the CRS entirely.
    geographic_bounds: tuple[float, float, float, float] | None = None

    @property
    def vsi_url(self) -> str:
        return f"/vsicurl/{self.url}"


MOLA_DEM = RemoteRaster(
    product_id="Mars_MGS_MOLA_DEM_mosaic_global_463m",
    title="Mars MGS MOLA Digital Elevation Model, global mosaic",
    mission="Mars Global Surveyor (MGS)",
    nasa_mission="Mars Global Surveyor",
    instrument="MOLA (Mars Orbiter Laser Altimeter)",
    url="https://planetarymaps.usgs.gov/mosaic/Mars_MGS_MOLA_DEM_mosaic_global_463m.tif",
    native_resolution="463.0835744 m/px (128 pixels/degree)",
    native_resolution_m=463.0835744,
    license="CC0 (public domain)",
)

THEMIS_NIGHT_IR = RemoteRaster(
    product_id="THEMIS_NightIR_ControlledMosaics_100m_v2_oct2018",
    title="THEMIS Night Infrared controlled mosaic, global, v2 (Oct 2018)",
    mission="2001 Mars Odyssey",
    nasa_mission="2001 Mars Odyssey",
    instrument="THEMIS (Thermal Emission Imaging System)",
    url=f"{S3}/THEMIS_controlled_mosaics/AA_mosaics/"
        "THEMIS_NightIR_ControlledMosaics_100m_v2_oct2018.tif",
    native_resolution="100 m/px",
    native_resolution_m=100.0,
    license="Public domain (NASA/USGS)",
    published_md5_url=f"{S3}/THEMIS_controlled_mosaics/AA_mosaics/"
                      "THEMIS_NightIR_ControlledMosaics_100m_v2_oct2018.tif.md5",
)

CTX_JEZERO = RemoteRaster(
    product_id="Jezero_CTX_BlockAdj_dd",
    title="Jezero Crater CTX block-adjusted mosaic (Exploration Zone)",
    mission="Mars Reconnaissance Orbiter (MRO)",
    nasa_mission="Mars Reconnaissance Orbiter",
    instrument="CTX (Context Camera)",
    url=f"{S3}/CTX_EZs/Jezero_CTX_BlockAdj_dd.tif",
    native_resolution="~5 m/px (8.4353e-05 degrees/px)",
    native_resolution_m=5.0,
    license="Public domain (NASA/USGS)",
)

# Preferred elevation source: 2.3x finer than the 463 m MOLA mosaic, same
# planetocentric Equirectangular family and the same 3396190 m radius, so it is
# a drop-in replacement. Resolution matters here beyond fidelity — at 463 m/px
# the Jezero floor is smoothed enough that the SAFEST, FASTEST and BALANCED
# routes converge on nearly the same path, which collapses the multi-objective
# trade-off the project exists to demonstrate.
HRSC_MOLA_DEM = RemoteRaster(
    product_id="Mars_HRSC_MOLA_BlendDEM_Global_200mp_v2",
    title="Mars HRSC/MOLA blended Digital Elevation Model, global, 200 m v2",
    mission="Mars Express + Mars Global Surveyor",
    nasa_mission="Mars Global Surveyor",
    instrument="HRSC (Mars Express) blended with MOLA (MGS)",
    url=f"{S3}/PDS_Derived/MAP2/images/Mars/HRSC_MOLA_Blend/"
        "Mars_HRSC_MOLA_BlendDEM_Global_200mp_v2.tif",
    native_resolution="199.99999 m/px",
    native_resolution_m=200.0,
    license="Public domain (NASA/USGS/ESA)",
)

# Real CRISM mineralogy. This is the MRDR multispectral summary-parameter map,
# a 5x5 degree tile that fully contains the Jezero window at 181 m/px — close
# enough to the 177.5 m grid cell that almost no resampling is needed.
# Band numbering is 1-based per the tile's own ENVI header.
CRISM_BAND_OLINDEX3 = 16        # olivine index
CRISM_BAND_MIN2295_2480 = 46    # carbonate detection pair, part 1
CRISM_BAND_CINDEX2 = 53         # carbonate index
CRISM_NODATA = 65535.0

CRISM_MRDR = RemoteRaster(
    product_id="t1250_mrrsu_20n078_0327_4",
    title="CRISM MRDR multispectral summary parameters, tile 20N078 (MC-13)",
    mission="Mars Reconnaissance Orbiter (MRO)",
    nasa_mission="Mars Reconnaissance Orbiter",
    instrument="CRISM (Compact Reconnaissance Imaging Spectrometer for Mars)",
    url="https://pds-geosciences.wustl.edu/mro/"
        "mro-m-crism-5-rdr-multispectral-v1/mrocr_3201/mrdr/mc13/"
        "t1250_mrrsu_20n078_0327_4.img",
    native_resolution="181.1424 m/px (327 px/degree)",
    native_resolution_m=181.1424,
    license="Public domain (NASA)",
    distributor="NASA PDS Geosciences Node (Washington University in St. Louis)",
    archive_node="NASA Planetary Data System (PDS) Geosciences Node",
    band=CRISM_BAND_OLINDEX3,
    geographic_bounds=(75.0, 17.5, 80.0, 22.5),
)


# ── Windowed reading ──────────────────────────────────────────────────────────

def _window_for(src, lon_min, lat_min, lon_max, lat_max):
    """Build a read window from degree bounds, for either CRS convention.

    Geographic rasters take the degrees directly. Projected (Equirectangular)
    rasters need them scaled by the radius the raster's own CRS declares — which
    is not necessarily the radius VICTOR uses elsewhere, so it is read from the
    file rather than assumed.
    """
    from rasterio.windows import from_bounds

    if src.crs and src.crs.is_geographic:
        return from_bounds(lon_min, lat_min, lon_max, lat_max, src.transform)

    radius = None
    try:
        radius = src.crs.to_dict().get("R") or src.crs.to_dict().get("a")
    except Exception:
        pass
    if not radius:
        # Fall back to deriving it from the raster's own global extent.
        radius = src.bounds.right / math.pi

    scale = math.radians(1.0) * float(radius)
    logger.info(f"  projected CRS — {scale:.3f} m/degree (radius {radius:.0f} m)")
    return from_bounds(
        lon_min * scale, lat_min * scale, lon_max * scale, lat_max * scale,
        src.transform,
    )


def _window_from_bounds(src, bounds: tuple[float, float, float, float]):
    """Build a read window by mapping lat/lon linearly onto the pixel grid.

    For products whose declared CRS is inconvenient (a per-tile sphere radius,
    a non-zero central meridian), but whose exact geographic extent is published.
    Linear interpolation across a known extent is sub-pixel accurate and avoids
    reimplementing the projection.
    """
    from rasterio.windows import Window

    b_lon_min, b_lat_min, b_lon_max, b_lat_max = bounds
    lon_span = b_lon_max - b_lon_min
    lat_span = b_lat_max - b_lat_min

    col0 = (LON_MIN - b_lon_min) / lon_span * src.width
    col1 = (LON_MAX - b_lon_min) / lon_span * src.width
    # Row 0 is the northern edge.
    row0 = (b_lat_max - LAT_MAX) / lat_span * src.height
    row1 = (b_lat_max - LAT_MIN) / lat_span * src.height

    logger.info(
        f"  explicit bounds → cols {col0:.0f}-{col1:.0f}, rows {row0:.0f}-{row1:.0f}"
    )
    return Window(col0, row0, col1 - col0, row1 - row0)


def read_crism_band(band: int, label: str) -> tuple[np.ndarray, dict]:
    """Read one CRISM summary-parameter band over the Jezero window.

    GDAL's ENVI driver needs the sibling .hdr, which it will not fetch while
    directory probing is disabled for remote reads. Rather than relax that (it
    is what keeps the other reads fast), this issues the HTTP range request
    directly — the ENVI layout is fully specified, so the byte offsets are exact:

        BSQ, float32 little-endian, header offset 0,
        1538 samples x 1636 lines x 60 bands
        offset(band0, line, sample) = ((band0*1636 + line)*1538 + sample) * 4

    One contiguous range covering the needed row span (~1.8 MB) beats 295
    per-row requests, and beats the 576 MB whole file by a wide margin.
    """
    import requests

    SAMPLES, LINES, BANDS = 1538, 1636, 60
    ITEMSIZE = 4
    band0 = band - 1
    if not 0 <= band0 < BANDS:
        raise ValueError(f"CRISM band {band} out of range 1..{BANDS}")

    b_lon_min, b_lat_min, b_lon_max, b_lat_max = CRISM_MRDR.geographic_bounds
    lon_span, lat_span = b_lon_max - b_lon_min, b_lat_max - b_lat_min

    col0 = int((LON_MIN - b_lon_min) / lon_span * SAMPLES)
    col1 = int(np.ceil((LON_MAX - b_lon_min) / lon_span * SAMPLES))
    row0 = int((b_lat_max - LAT_MAX) / lat_span * LINES)
    row1 = int(np.ceil((b_lat_max - LAT_MIN) / lat_span * LINES))
    n_rows, n_cols = row1 - row0, col1 - col0

    band_start = band0 * LINES * SAMPLES * ITEMSIZE
    span_start = band_start + row0 * SAMPLES * ITEMSIZE
    span_len = n_rows * SAMPLES * ITEMSIZE

    logger.info(f"Reading CRISM {label} (band {band}) …")
    logger.info(
        f"  rows {row0}-{row1}, cols {col0}-{col1} "
        f"({n_rows}x{n_cols}); range {span_len/1e6:.1f} MB of 576 MB"
    )

    t0 = time.perf_counter()
    resp = requests.get(
        CRISM_MRDR.url,
        headers={"Range": f"bytes={span_start}-{span_start + span_len - 1}"},
        timeout=180,
    )
    resp.raise_for_status()
    if len(resp.content) != span_len:
        raise ValueError(
            f"CRISM range read returned {len(resp.content)} bytes, expected {span_len}"
        )
    elapsed = time.perf_counter() - t0

    rows = np.frombuffer(resp.content, dtype="<f4").reshape(n_rows, SAMPLES)
    sub = rows[:, col0:col1].astype(np.float32)
    # CRISM map tiles use 65535 for unmeasured cells (swath gaps).
    sub = np.where(sub >= CRISM_NODATA, np.nan, sub)

    # Resample onto the computation grid. The native 181 m/px is so close to the
    # grid cell that this is nearly 1:1.
    from scipy.ndimage import zoom
    valid_before = int(np.isfinite(sub).sum())
    grid = zoom(np.nan_to_num(sub, nan=0.0), (ROWS / n_rows, COLS / n_cols), order=1)
    mask = zoom(np.isfinite(sub).astype(np.float32), (ROWS / n_rows, COLS / n_cols), order=1)
    grid = np.where(mask > 0.5, grid, np.nan).astype(np.float32)

    diagnostics = {
        "native_size": f"{SAMPLES}x{LINES}x{BANDS}",
        "native_crs": "Equirectangular, per-tile sphere; read via published 5x5 deg bounds",
        "band": band,
        "band_count": BANDS,
        "window_px": f"{n_cols}x{n_rows}",
        "read_s": round(elapsed, 2),
        "bytes_read": span_len,
        "valid_native_cells": valid_before,
        "nodata_cells": int(np.isnan(grid).sum()),
    }
    logger.info(
        f"  → {ROWS}x{COLS} in {elapsed:.1f}s; "
        f"{diagnostics['nodata_cells']} of {ROWS*COLS} cells unmeasured"
    )
    return grid, diagnostics


def read_window(raster: RemoteRaster, out_shape=(ROWS, COLS)) -> tuple[np.ndarray, dict]:
    """Read the Jezero window from a remote raster, resampled to out_shape.

    The resampled window is cached under backend/data/raw/ (gitignored). Re-runs
    reuse it rather than re-fetching, which matters because the CTX mosaic read
    takes ~8 minutes. Delete the cache or pass --refetch to force a fresh read.
    """
    import rasterio
    from rasterio.enums import Resampling

    raw_dir = ROOT / "backend" / "data" / "raw"
    raw_dir.mkdir(parents=True, exist_ok=True)
    cache_npy = raw_dir / f"{raster.product_id}__window.npy"
    cache_meta = raw_dir / f"{raster.product_id}__window.json"

    if cache_npy.exists() and cache_meta.exists() and "--refetch" not in sys.argv:
        import json as _json
        data = np.load(cache_npy)
        diagnostics = _json.loads(cache_meta.read_text())
        diagnostics["from_cache"] = True
        logger.info(f"Reading {raster.product_id} … (cached window)")
        return data, diagnostics

    logger.info(f"Reading {raster.product_id} …")
    t0 = time.perf_counter()

    with rasterio.open(raster.vsi_url) as src:
        t_open = time.perf_counter() - t0

        if raster.geographic_bounds is not None:
            window = _window_from_bounds(src, raster.geographic_bounds)
        else:
            window = _window_for(src, LON_MIN, LAT_MIN, LON_MAX, LAT_MAX)

        if window.width < 1 or window.height < 1:
            raise ValueError(
                f"{raster.product_id}: window collapsed to "
                f"{window.width:.4f}x{window.height:.4f}. CRS handling is wrong — "
                f"refusing to return an empty grid."
            )

        t1 = time.perf_counter()
        arr = src.read(
            raster.band,
            window=window,
            out_shape=out_shape,
            resampling=Resampling.bilinear,
            masked=True,
        )
        t_read = time.perf_counter() - t1

        # Cast before filling: integer source rasters (MOLA is int16) cannot
        # hold NaN, so the mask must be applied to a float view.
        data = arr.astype(np.float32).filled(np.nan)
        diagnostics = {
            "native_size": f"{src.width}x{src.height}",
            "native_crs": src.crs.to_string() if src.crs else "unknown",
            "tiled": bool(src.profile.get("tiled")),
            "band": raster.band,
            "band_count": src.count,
            "window_px": f"{window.width:.1f}x{window.height:.1f}",
            "open_s": round(t_open, 2),
            "read_s": round(t_read, 2),
            "nodata_cells": int(np.isnan(data).sum()),
        }

    import json as _json
    np.save(cache_npy, data)
    cache_meta.write_text(_json.dumps(diagnostics, indent=2), encoding="utf-8")

    logger.info(
        f"  → {out_shape[0]}x{out_shape[1]} in {diagnostics['read_s']}s "
        f"(open {diagnostics['open_s']}s), "
        f"{diagnostics['nodata_cells']} nodata cells"
    )
    return data, diagnostics


def source_from(
    raster: RemoteRaster,
    classification: Classification,
    diag: dict,
    grids: list[str],
    checksum: str,
    processing: list[str],
    caveats: list[str],
) -> DataSource:
    """Build a provenance record, carrying NASA mission and archive lineage."""
    return DataSource(
        product_id=raster.product_id,
        title=raster.title,
        mission=raster.mission,
        nasa_missions=[raster.nasa_mission or raster.mission],
        instrument=raster.instrument,
        url=raster.url,
        classification=classification,
        distributor=raster.distributor,
        archive_node=raster.archive_node,
        native_resolution=raster.native_resolution,
        native_resolution_m=raster.native_resolution_m,
        native_crs=diag.get("native_crs"),
        license=raster.license,
        published_checksum_md5=raster.published_md5_url,
        checksum_sha256=checksum,
        grids_produced=grids,
        processing_chain=processing,
        caveats=caveats,
    )


# ── Derivations ───────────────────────────────────────────────────────────────

def derive_slope(elevation: np.ndarray) -> np.ndarray:
    """Slope in degrees from the elevation gradient, honouring non-square cells."""
    dz_dy, dz_dx = np.gradient(elevation, CELL_NS_M, CELL_EW_M)
    return np.degrees(np.arctan(np.hypot(dz_dx, dz_dy))).astype(np.float32)


# Traversability cost multipliers by slope band, per docs/nasa-data-catalog.md.
TRAVERSABILITY_BANDS = [
    (5.0, 1.0),
    (10.0, 1.5),
    (15.0, 2.5),
    (20.0, 5.0),
    (25.0, 10.0),
]
IMPASSABLE = 999.0


def derive_traversability(slope: np.ndarray) -> np.ndarray:
    """Map slope to a traversability cost multiplier using the documented bands."""
    trav = np.full(slope.shape, IMPASSABLE, dtype=np.float32)
    assigned = np.zeros(slope.shape, dtype=bool)
    for threshold, cost in TRAVERSABILITY_BANDS:
        mask = (~assigned) & (slope < threshold)
        trav[mask] = cost
        assigned |= mask
    return trav


def derive_thermal_proxy(night_ir: np.ndarray) -> np.ndarray:
    """Normalise THEMIS night IR to a 0-1 thermal inertia proxy.

    Nighttime infrared brightness correlates with thermal inertia: rocky,
    high-inertia surfaces retain heat overnight while dust and loose sand cool
    quickly. This is a documented *proxy*, not a published thermal inertia
    product — a distinction the provenance record carries explicitly.
    """
    finite = night_ir[np.isfinite(night_ir)]
    if finite.size == 0:
        return np.full(night_ir.shape, 0.5, dtype=np.float32)
    lo, hi = np.percentile(finite, [2, 98])
    if hi - lo < 1e-6:
        return np.full(night_ir.shape, 0.5, dtype=np.float32)
    proxy = np.clip((night_ir - lo) / (hi - lo), 0.0, 1.0)
    return np.nan_to_num(proxy, nan=0.5).astype(np.float32)


def derive_hazard(slope: np.ndarray, thermal_proxy: np.ndarray) -> np.ndarray:
    """Composite hazard on a 0-10 scale.

    Weighting matches the existing documented model: slope dominates, with a
    dust/loose-regolith term from the thermal proxy (low inertia implies loose
    material, which is the hazardous case).
    """
    slope_term = np.clip(slope / 25.0, 0.0, 1.0)
    dust_term = 1.0 - thermal_proxy
    hazard = 10.0 * (0.7 * slope_term + 0.3 * dust_term)
    return np.clip(hazard, 0.0, 10.0).astype(np.float32)


def derive_science_value(targets: list[dict]) -> tuple[np.ndarray, list[str]]:
    """Build a science priority field from published Jezero science targets.

    This is a MODEL, and labelled as such. What makes it defensible rather than
    invented is that the inputs are real: each target's coordinates and
    significance come from the peer-reviewed Jezero literature (Goudge et al.
    2017; Farley et al. 2020) and from Mars 2020's own published science
    targeting. The model is the *interpolation* between them, not the targets.

    Field = max over targets of (target_value * gaussian(distance)), floored at a
    small baseline so that terrain far from any known target is low-priority but
    not zero — a traverse can still encounter unanticipated science.
    """
    SIGMA_M = 2500.0     # influence radius; beyond ~2.5 km a target stops driving priority
    BASELINE = 0.10

    lat_step = (LAT_MAX - LAT_MIN) / ROWS
    lon_step = (LON_MAX - LON_MIN) / COLS
    # Row 0 is the northern edge, matching the existing grid convention.
    lats = LAT_MAX - (np.arange(ROWS) + 0.5) * lat_step
    lons = LON_MIN + (np.arange(COLS) + 0.5) * lon_step
    lat_grid = lats[:, None]
    lon_grid = lons[None, :]

    field = np.full((ROWS, COLS), BASELINE, dtype=np.float32)
    citations: set[str] = set()

    for t in targets:
        lat, lon = t.get("lat"), t.get("lon")
        value = t.get("science_value")
        if lat is None or lon is None or value is None:
            continue
        # Local flat-earth metres; the window is < 60 km so curvature is negligible.
        dy = (lat_grid - lat) * (CELL_NS_M / lat_step)
        dx = (lon_grid - lon) * (CELL_EW_M / lon_step)
        dist2 = dx * dx + dy * dy
        contribution = float(value) * np.exp(-dist2 / (2.0 * SIGMA_M ** 2))
        field = np.maximum(field, contribution)
        if t.get("source"):
            citations.add(str(t["source"]))

    return np.clip(field, 0.0, 1.0).astype(np.float32), sorted(citations)


def combine_mineral_indices(olivine: np.ndarray, carbonate: np.ndarray) -> np.ndarray:
    """Combine CRISM olivine and carbonate indices into a 0-1 mineral interest field.

    Both are spectral summary parameters, not abundances, and they sit on
    different scales — so each is percentile-stretched independently before
    being combined, and the combination takes the maximum rather than a sum:
    a cell is scientifically interesting if EITHER mineral is strongly present,
    and olivine and carbonate are distinct science stories at Jezero rather
    than two measurements of one thing.

    NaN (CRISM swath gap) propagates — an unmeasured cell must stay unmeasured,
    not become a zero that reads as "no mineral here".
    """
    def stretch(a: np.ndarray) -> np.ndarray:
        finite = a[np.isfinite(a)]
        if finite.size == 0:
            return np.full(a.shape, np.nan, dtype=np.float32)
        lo, hi = np.percentile(finite, [5, 95])
        if hi - lo < 1e-9:
            return np.zeros(a.shape, dtype=np.float32)
        return np.clip((a - lo) / (hi - lo), 0.0, 1.0).astype(np.float32)

    ol, cb = stretch(olivine), stretch(carbonate)
    combined = np.fmax(ol, cb)
    # fmax ignores NaN when only one side has it; a cell is unmeasured only when
    # both inputs are.
    both_nan = ~np.isfinite(ol) & ~np.isfinite(cb)
    return np.where(both_nan, np.nan, combined).astype(np.float32)


# ── Orchestration ─────────────────────────────────────────────────────────────

def fetch_all(registry: ProvenanceRegistry) -> dict[str, np.ndarray]:
    """Fetch every real source and derive the full grid set.

    Raises on any failure. The caller decides whether to fall back to synthetic
    data; this function never silently substitutes it, because that is precisely
    the defect that left the project on demonstration data for its whole build.
    """
    grids: dict[str, np.ndarray] = {}

    # 1. Elevation — MEASURED. Prefer the 200 m HRSC/MOLA blend; fall back to
    # the 463 m MOLA mosaic if it is unreachable, so a network problem with the
    # larger file degrades resolution rather than failing the run.
    try:
        elevation, diag = read_window(HRSC_MOLA_DEM)
        dem = HRSC_MOLA_DEM
        if np.isnan(elevation).all():
            raise ValueError("HRSC/MOLA window returned all-nodata")
    except Exception as exc:
        logger.warning(f"HRSC/MOLA 200 m DEM unavailable ({exc}); falling back to MOLA 463 m")
        elevation, diag = read_window(MOLA_DEM)
        dem = MOLA_DEM
        if np.isnan(elevation).all():
            raise ValueError("MOLA window returned all-nodata.")

    elevation = np.nan_to_num(elevation, nan=float(np.nanmean(elevation)))
    grids["elevation"] = elevation
    registry.register(source_from(
        dem, Classification.MEASURED, diag,
        grids=["elevation"],
        checksum=sha256_of_array(elevation),
        processing=[
            f"Windowed /vsicurl read of {diag['window_px']} px from "
            f"{diag['native_size']} global mosaic",
            f"Bilinear resample to {ROWS}x{COLS}",
        ],
        caveats=[
            f"Native {dem.native_resolution_m:.0f} m/px versus the "
            f"{CELL_NS_M:.1f} m x {CELL_EW_M:.1f} m grid cell; relief below the "
            f"source resolution is not resolved.",
        ],
    ))

    # 2. Slope and traversability — DERIVED from MOLA
    slope = derive_slope(elevation)
    traversability = derive_traversability(slope)
    grids["slope"] = slope
    grids["traversability"] = traversability
    registry.register(DataSource(
        product_id=f"{MOLA_DEM.product_id}__DERIVED_slope_traversability",
        title="Slope and traversability derived from MOLA elevation",
        mission=MOLA_DEM.mission,
        nasa_missions=[MOLA_DEM.nasa_mission],
        instrument=MOLA_DEM.instrument,
        url=MOLA_DEM.url,
        classification=Classification.DERIVED,
        distributor=MOLA_DEM.distributor,
        archive_node=MOLA_DEM.archive_node,
        native_resolution=MOLA_DEM.native_resolution,
        native_resolution_m=MOLA_DEM.native_resolution_m,
        license=MOLA_DEM.license,
        checksum_sha256=sha256_of_array(traversability),
        grids_produced=["slope", "traversability"],
        processing_chain=[
            "slope = degrees(arctan(|grad(elevation)|)) with 177.5 m NS / 187.1 m EW spacing",
            "traversability = banded cost multiplier per docs/nasa-data-catalog.md "
            "(0-5deg=1.0, 5-10=1.5, 10-15=2.5, 15-20=5.0, 20-25=10.0, >25=impassable)",
        ],
        caveats=[
            "Slope inherits MOLA's 463 m/px resolution: real obstacles smaller "
            "than ~463 m are not represented.",
        ],
    ))

    # 3. THEMIS night IR thermal proxy — DERIVED (2001 Mars Odyssey)
    night_ir, diag_th = read_window(THEMIS_NIGHT_IR)
    thermal_proxy = derive_thermal_proxy(night_ir)
    grids["thermal_proxy"] = thermal_proxy
    registry.register(source_from(
        THEMIS_NIGHT_IR, Classification.DERIVED, diag_th,
        grids=["thermal_proxy"],
        checksum=sha256_of_array(thermal_proxy),
        processing=[
            f"Windowed /vsicurl read of {diag_th['window_px']} px",
            f"Bilinear resample to {ROWS}x{COLS}",
            "Normalised to 0-1 across the 2nd-98th percentile of the window",
        ],
        caveats=[
            "This is night-IR brightness normalised as a thermal inertia PROXY, "
            "not a published thermal inertia product. High values indicate "
            "heat-retaining (likely rocky) surfaces; low values indicate "
            "fast-cooling dust or loose sand.",
        ],
    ))

    # 4. CTX base imagery — MEASURED (Mars Reconnaissance Orbiter)
    # Third NASA mission, and the real orbital basemap the UI needs.
    imagery, diag_ctx = read_window(CTX_JEZERO)
    imagery = np.nan_to_num(imagery, nan=0.0)
    grids["imagery"] = imagery
    registry.register(source_from(
        CTX_JEZERO, Classification.MEASURED, diag_ctx,
        grids=["imagery"],
        checksum=sha256_of_array(imagery),
        processing=[
            f"Windowed /vsicurl read of {diag_ctx['window_px']} px from "
            f"{diag_ctx['native_size']} regional mosaic",
            f"Bilinear decimation to {ROWS}x{COLS} for the basemap raster",
        ],
        caveats=[
            "Decimated from ~5 m/px to the computation grid for display. The "
            "full-resolution mosaic is used for map tiles, not for routing.",
        ],
    ))

    # 5. Hazard — DERIVED composite across two missions
    hazard = derive_hazard(slope, thermal_proxy)
    grids["hazard"] = hazard
    registry.register(DataSource(
        product_id="VICTOR_hazard_composite",
        title="Composite traverse hazard derived from MOLA slope and THEMIS night IR",
        mission="Derived (MGS + Mars Odyssey)",
        nasa_missions=[MOLA_DEM.nasa_mission, THEMIS_NIGHT_IR.nasa_mission],
        instrument="MOLA + THEMIS",
        url="(derived — see contributing sources)",
        classification=Classification.DERIVED,
        distributor="Derived by VICTOR",
        archive_node=MOLA_DEM.archive_node,
        native_resolution_m=CELL_EW_M,
        license="Derived from public domain inputs",
        checksum_sha256=sha256_of_array(hazard),
        grids_produced=["hazard"],
        processing_chain=[
            "hazard = 10 * (0.7 * clip(slope/25, 0, 1) + 0.3 * (1 - thermal_proxy))",
        ],
        caveats=[
            "Hazard is a VICTOR weighting of measured inputs, not a NASA "
            "hazard product. The weights are a modelling choice.",
        ],
    ))

    # 6. CRISM mineralogy — MEASURED (Mars Reconnaissance Orbiter).
    # Olivine and carbonate are the two mineral families that define Jezero's
    # science case, so grounding the science layer in real spectra rather than a
    # proximity model is the biggest credibility upgrade available here.
    olivine = carbonate = None
    try:
        olivine, diag_ol = read_crism_band(CRISM_BAND_OLINDEX3, "OLINDEX3 olivine")
        carbonate, diag_cb = read_crism_band(CRISM_BAND_CINDEX2, "CINDEX2 carbonate")
        grids["olivine_index"] = np.nan_to_num(olivine, nan=-9999.0)
        grids["carbonate_index"] = np.nan_to_num(carbonate, nan=-9999.0)
        coverage = 100.0 * float(np.isfinite(olivine).mean())
        registry.register(source_from(
            CRISM_MRDR, Classification.MEASURED, diag_ol,
            grids=["olivine_index", "carbonate_index"],
            checksum=sha256_of_array(grids["olivine_index"]),
            processing=[
                f"HTTP range read of {diag_ol['bytes_read']/1e6:.1f} MB from the "
                f"576 MB ENVI BSQ cube (band {CRISM_BAND_OLINDEX3} OLINDEX3, "
                f"band {CRISM_BAND_CINDEX2} CINDEX2)",
                "Georeferenced via the product label's published 5x5 degree bounds",
                f"Bilinear resample to {ROWS}x{COLS}",
            ],
            caveats=[
                f"CRISM multispectral mapping has swath gaps: only {coverage:.0f}% "
                f"of the window is measured. Unmeasured cells are stored as -9999 "
                f"and must be treated as NO DATA, never as 'no mineral'.",
                "Summary parameters are spectral indices, not mineral abundances.",
            ],
        ))
    except Exception as exc:
        logger.warning(f"CRISM unavailable ({exc}); science falls back to target model")

    # 7. Science priority. DERIVED where CRISM measured the surface, MODELLED
    # where it did not. The blend ratio is recorded so the distinction survives.
    import json as _json
    targets_path = ROOT / "backend" / "data" / "cache" / "science_targets.json"
    targets = _json.loads(targets_path.read_text()) if targets_path.exists() else []
    if isinstance(targets, dict):
        targets = targets.get("targets", [])
    target_field, citations = derive_science_value(targets)

    if olivine is not None and carbonate is not None:
        mineral = combine_mineral_indices(olivine, carbonate)
        measured = np.isfinite(mineral)
        science = np.where(
            measured,
            0.6 * np.nan_to_num(mineral, nan=0.0) + 0.4 * target_field,
            target_field,
        ).astype(np.float32)
        classification = Classification.DERIVED
        chain = [
            f"{len(targets)} published science targets with literature coordinates",
            "mineral = normalised max(OLINDEX3, CINDEX2) from real CRISM spectra",
            "science = 0.6*mineral + 0.4*target_model where CRISM measured; "
            "target_model alone inside CRISM swath gaps",
        ]
        extra = [
            f"{100.0 * float(measured.mean()):.0f}% of cells are CRISM-measured "
            f"(DERIVED); the rest fall back to the target proximity model "
            f"(MODELLED). Per-cell provenance therefore varies across the grid.",
        ]
    else:
        science = target_field
        classification = Classification.MODELLED
        chain = [
            f"{len(targets)} published science targets with literature coordinates",
            "field = max over targets of value * exp(-d^2 / 2*2500m^2), floor 0.10",
        ]
        extra = ["CRISM unavailable; score is entirely model-derived."]

    grids["science_value"] = np.clip(science, 0.0, 1.0).astype(np.float32)
    registry.register(DataSource(
        product_id="VICTOR_science_priority",
        title="Science priority from CRISM mineralogy and published Jezero targets",
        mission="MRO (CRISM) + Mars 2020 / published Jezero literature",
        nasa_missions=["Mars Reconnaissance Orbiter", "Mars 2020"],
        instrument="CRISM summary parameters + Perseverance science targeting",
        url=CRISM_MRDR.url if olivine is not None
            else "https://science.nasa.gov/mission/mars-2020-perseverance/",
        classification=classification,
        distributor="Derived by VICTOR",
        archive_node=CRISM_MRDR.archive_node,
        native_resolution_m=CELL_EW_M,
        license="Derived from public domain inputs",
        checksum_sha256=sha256_of_array(grids["science_value"]),
        grids_produced=["science_value"],
        processing_chain=chain,
        caveats=[
            "A priority SCORE, not a measurement. The mineral indices underneath "
            "it are real CRISM measurements; collapsing them into one priority "
            "number is a VICTOR modelling choice.",
        ] + extra + ([f"Target sources: {'; '.join(citations)}"] if citations else []),
    ))


    return grids


def write_outputs(grids: dict[str, np.ndarray], registry: ProvenanceRegistry) -> None:
    """Persist grids and provenance as one consistent set.

    Grids and provenance are written together, never separately: a cache holding
    real grids beside a provenance file describing synthetic ones is exactly the
    inconsistency this project exists to avoid.
    """
    import json

    cache = ROOT / "backend" / "data" / "cache"
    cache.mkdir(parents=True, exist_ok=True)

    for name, arr in grids.items():
        np.save(cache / f"{name}.npy", arr.astype(np.float32))
        logger.info(f"  wrote {name}.npy")

    # Flat list for DataService and the existing API schema.
    registry.write_legacy(cache / "provenance.json")
    # Rich record with compliance detail for the Data Sources view.
    registry.write(cache / "provenance_detail.json")
    logger.info("  wrote provenance.json + provenance_detail.json")

    # grid_metadata.json carries the authoritative data mode, derived from
    # provenance rather than asserted by hand.
    meta_path = cache / "grid_metadata.json"
    meta = json.loads(meta_path.read_text()) if meta_path.exists() else {}
    meta.update({
        "lat_min": LAT_MIN, "lat_max": LAT_MAX,
        "lon_min": LON_MIN, "lon_max": LON_MAX,
        "rows": ROWS, "cols": COLS,
        "cell_size_ns_m": CELL_NS_M, "cell_size_ew_m": CELL_EW_M,
        "cell_shape": "non-square",
        "coordinate_system": "IAU2000_planetocentric_east",
        "region_ns_km": 53.2, "region_ew_km": 56.1,
        "data_mode": registry.data_mode(),
        "label": registry.label(),
        "compliance": registry.compliance_report(),
    })
    meta_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")
    logger.info(f"  wrote grid_metadata.json (data_mode={registry.data_mode()})")


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s — %(message)s")
    logger.info("Fetching real NASA data for Jezero Crater …")
    logger.info(f"Extent: {LAT_MIN}-{LAT_MAX}N, {LON_MIN}-{LON_MAX}E at {ROWS}x{COLS}")

    registry = ProvenanceRegistry(
        region="Jezero Crater, Mars",
        extent={
            "lat_min": LAT_MIN, "lat_max": LAT_MAX,
            "lon_min": LON_MIN, "lon_max": LON_MAX,
            "rows": ROWS, "cols": COLS,
        },
    )

    t0 = time.perf_counter()
    try:
        grids = fetch_all(registry)
    except Exception as exc:
        logger.error(f"Real data acquisition FAILED: {exc}")
        return 1

    logger.info(f"All sources fetched in {time.perf_counter() - t0:.1f}s")

    comp = registry.compliance_report()
    logger.info("-- Challenge compliance -------------------------------")
    logger.info(f"  real NASA data   : {comp['real_nasa_data']}")
    logger.info(
        f"  multi-mission    : {comp['multi_mission']} "
        f"({comp['mission_count']} of {comp['missions_required']} required)"
    )
    for m in comp["nasa_missions"]:
        logger.info(f"      - {m}")
    logger.info(f"  COMPLIANT        : {comp['compliant']}")
    for issue in comp["blocking_issues"]:
        logger.warning(f"  BLOCKING: {issue}")
    logger.info(f"  implied data mode: {registry.data_mode()}")
    logger.info("-------------------------------------------------------")

    for name, arr in grids.items():
        logger.info(
            f"  {name:16s} min={float(np.nanmin(arr)):9.2f} "
            f"max={float(np.nanmax(arr)):9.2f} mean={float(np.nanmean(arr)):9.2f}"
        )

    if "--no-write" in sys.argv:
        logger.info("--no-write given; nothing persisted.")
        return 0

    logger.info("Writing grids and provenance …")
    write_outputs(grids, registry)
    return 0


if __name__ == "__main__":
    sys.exit(main())
