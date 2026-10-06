# Geospatial Methodology

## Mars Coordinate System

| Parameter | Value | Rationale |
|---|---|---|
| **Standard** | IAU 2000 | Modern standard used by MOLA, HiRISE, CRISM, THEMIS |
| **Latitude** | Planetocentric | Center-of-mass referenced; consistent across datasets |
| **Longitude** | Positive East (0°–360°) | IAU 2000 convention for Mars; used by PDS products |
| **Datum** | MOLA areoid | Equipotential surface; mean equatorial radius 3,396,190 m |
| **Elevation reference** | Relative to MOLA areoid | Meters; negative values common in lowlands |

## Internal Coordinate Handling

All internal coordinates stored as:
```
(latitude_planetocentric_deg, longitude_east_deg, elevation_m)
```

### Conversion Rules
- If ingesting planetographic data: convert via `tan(lat_centric) = (b/a)² × tan(lat_graphic)` where a = 3396.19 km, b = 3376.20 km
- If ingesting west-positive longitude: `lon_east = 360° - lon_west`
- All conversions logged as provenance metadata

## Distance Calculation

Mars is an oblate spheroid, but for Jezero-region distances (< 50 km), the error from using a sphere is negligible (< 0.3%).

### Primary method: Haversine on Mars sphere
```
R_mars = 3,389,500 m (mean radius)

d = 2 * R_mars * arcsin(sqrt(
    sin²((φ₂-φ₁)/2) + cos(φ₁) * cos(φ₂) * sin²((λ₂-λ₁)/2)
))
```

### For slope calculation: local plane approximation
```
Δx = R_mars * cos(φ) * Δλ  (east-west distance)
Δy = R_mars * Δφ            (north-south distance)
Δz = Δelevation             (from DEM)

slope_angle = arctan(Δz / sqrt(Δx² + Δy²))
```

## Map Projection

| Parameter | Value |
|---|---|
| **Display projection** | Equirectangular (Simple Cylindrical) |
| **Center latitude** | 18.44° N (Jezero center) |
| **Extent** | ~18.0–18.9° N, 77.0–78.0° E |
| **Tile format** | PNG tiles at zoom levels 1–6 (pre-rendered) |

Equirectangular is standard for Mars web mapping and is used by all major Mars GIS tools (JMARS, Mars Trek). At Jezero's latitude (~18° N), the east-west distortion from equirectangular is ~5%, which is acceptable for the application.

## Raster Grid Specification

### Primary computation grid
| Parameter | Value | Derivation |
|---|---|---|
| **Lat extent** | 18.0°–18.9° N (0.9°) | Selected to cover Jezero + surroundings |
| **Lon extent** | 77.0°–78.0° E (1.0°) | Selected to cover Jezero + surroundings |
| **N-S distance** | ~53.2 km | R_mars × Δlat_rad = 3,389,500 × 0.01571 |
| **E-W distance** | ~56.1 km | R_mars × cos(18.45°) × Δlon_rad = 3,389,500 × 0.9492 × 0.01745 |
| **Grid size** | 300 rows × 300 columns | |
| **Cell size (N-S)** | ~177 m | 53,242 m / 300 |
| **Cell size (E-W)** | ~187 m | 56,117 m / 300 |
| **Cell shape** | Non-square (documented) | Inherent in equirectangular at non-zero latitude |
| **Cell count** | 90,000 cells | |
| **Memory** | ~720 KB per float32 layer | |

**Note:** Cells are non-square (~177 m × ~187 m) due to the equirectangular projection at 18.45° N latitude. This is acceptable because:
- A* edge costs use actual haversine distance, not cell count
- The N-S / E-W difference (5.4%) is well within source data resolution (MOLA = 463 m)
- All distance calculations use Mars-radius haversine, not cell-size approximation

This resolution balances:
- MOLA global DEM (463 m) — upsampled ~2.5x
- CRISM multispectral (200 m) — close match
- THEMIS IR (100 m) — slightly downsampled
- Computation speed for A* pathfinding (90K cells is fast)

### Secondary grid (for display only)
HiRISE-derived textures at higher resolution for visual fidelity, but NOT used for computation.

## Spatial Indexing

For the Jezero region:
- Grid cells indexed by (row, col) → flat array
- A* pathfinding operates on 8-connected grid (cardinal + diagonal neighbors)
- Diagonal distance = √2 × cell_size; cardinal = cell_size
- No spatial index tree needed for 90K cells (direct array access is O(1))

## Validation

| Check | Method |
|---|---|
| Distance accuracy | Compare computed distances to known Perseverance traverse waypoints |
| Elevation accuracy | Spot-check MOLA elevations against published Jezero crater floor depth (~-2,500 m) |
| Slope accuracy | Verify known delta front slopes (~10–15° per published geological papers) |
| Coordinate consistency | Ensure all layers align when overlaid (visual check on reference imagery) |
