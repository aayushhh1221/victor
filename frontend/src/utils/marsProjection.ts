/**
 * VICTOR — Mars coordinate transformation utility.
 *
 * Explicit affine transformation mapping Mars planetocentric lat/lon
 * to Leaflet pixel coordinates and back.
 *
 * ## Coordinate convention
 *
 * The tile generator (scripts/generate_tiles.py) creates a standard Leaflet
 * tile pyramid:
 *   - Zoom 0: one 256×256 tile covering the whole world → world = 256 units
 *   - Zoom z: 2^z × 2^z tiles, each still 256px → world = 256 * 2^z pixels
 *
 * Example valid tile coords:
 *   z=1: x ∈ {0,1},   y ∈ {0,1}
 *   z=2: x ∈ {0..3},  y ∈ {0..3}
 *   z=3: x ∈ {0..7},  y ∈ {0..7}
 *
 * TILE_EXTENT is the zoom-0 world size (256 units). All affine mappings use
 * this constant. Leaflet scales internally when zooming.
 *
 * Leaflet CRS.Simple axis orientation:
 *   - x (lng) increases rightward → matches our longitude
 *   - y (lat) increases upward   → INVERTED from image pixel y (which increases
 *     downward). We account for this in marsToLeaflet / leafletToMars.
 *
 * Grid extent: 18.0–18.9°N, 77.0–78.0°E (non-square cells)
 *
 * All conversions use the same affine mapping:
 *   x_pixel = (lon - lon_min) / (lon_max - lon_min) * TILE_EXTENT
 *   y_pixel = (lat_max - lat) / (lat_max - lat_min) * TILE_EXTENT
 *
 * Scale bar uses haversine at display center.
 */

const R_MARS_M = 3_389_500; // IAU 2000 mean radius

// Region extent
export const EXTENT = {
  lat_min: 18.0,
  lat_max: 18.9,
  lon_min: 77.0,
  lon_max: 78.0,
};

/**
 * Leaflet zoom-0 world size in CRS.Simple units.
 *
 * MUST equal the tile size (256px) — this is what Leaflet expects as its
 * coordinate space at zoom 0. The generator makes 2^z tiles per side at each
 * zoom level z, matching this 256-unit world exactly.
 *
 * Previous value was 256*4 = 1024, which is the pixel dimensions of the z=2
 * tile grid image (4 tiles × 256px), NOT the zoom-0 world size. That caused
 * Leaflet at zoom 2 to request tiles at x/y ≈ 8 rather than ≈ 1, making every
 * tile request fall outside the 0..3 range that the generator produces.
 */
export const TILE_EXTENT = 256;

export interface PixelPoint {
  x: number;
  y: number;
}

/**
 * Mars lat/lon → Leaflet pixel coordinate.
 * y-axis is inverted: lat_max → y=0 (top), lat_min → y=TILE_EXTENT (bottom).
 */
export function marsToPixel(lat: number, lon: number): PixelPoint {
  const x = ((lon - EXTENT.lon_min) / (EXTENT.lon_max - EXTENT.lon_min)) * TILE_EXTENT;
  const y = ((EXTENT.lat_max - lat) / (EXTENT.lat_max - EXTENT.lat_min)) * TILE_EXTENT;
  return { x, y };
}

/**
 * Leaflet pixel coordinate → Mars lat/lon.
 */
export function pixelToMars(x: number, y: number): { lat: number; lon: number } {
  const lon = EXTENT.lon_min + (x / TILE_EXTENT) * (EXTENT.lon_max - EXTENT.lon_min);
  const lat = EXTENT.lat_max - (y / TILE_EXTENT) * (EXTENT.lat_max - EXTENT.lat_min);
  return { lat, lon };
}

/**
 * Mars haversine distance in metres.
 */
export function haversineMars(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dphi = ((lat2 - lat1) * Math.PI) / 180;
  const dlambda = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dphi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlambda / 2) ** 2;
  return 2 * R_MARS_M * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Compute scale bar length in km for a given pixel span.
 * Uses haversine at the display center latitude.
 */
export function pixelSpanToKm(pixelSpan: number): number {
  // 1 pixel in longitude at center latitude
  const centerLat = (EXTENT.lat_max + EXTENT.lat_min) / 2;
  const lonPerPixel = (EXTENT.lon_max - EXTENT.lon_min) / TILE_EXTENT;
  const lonSpan = pixelSpan * lonPerPixel;
  const distM = haversineMars(centerLat, 77.5, centerLat, 77.5 + lonSpan);
  return distM / 1000;
}

/**
 * Convert Mars lat/lon to a Leaflet LatLng-compatible object.
 * Leaflet CRS.Simple uses [y, x] = [lat_pixel, lon_pixel].
 */
export function marsToLeaflet(lat: number, lon: number): [number, number] {
  const { x, y } = marsToPixel(lat, lon);
  // Leaflet LatLng in Simple CRS is [y, x] where y is the vertical axis
  // We flip y since Leaflet CRS.Simple has y increasing upward
  return [TILE_EXTENT - y, x];
}

/**
 * Convert Leaflet CRS.Simple [y,x] back to Mars lat/lon.
 */
export function leafletToMars(leafletLat: number, leafletLon: number): { lat: number; lon: number } {
  const y = TILE_EXTENT - leafletLat;
  const x = leafletLon;
  return pixelToMars(x, y);
}

/** Bounding box for Leaflet in CRS.Simple units */
export const LEAFLET_BOUNDS: [[number, number], [number, number]] = [
  [0, 0],
  [TILE_EXTENT, TILE_EXTENT],
];
