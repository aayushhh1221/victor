/**
 * VICTOR — Backend API client.
 * All requests go to the FastAPI backend at NEXT_PUBLIC_API_URL.
 */

import type {
  RouteComputeRequest,
  RouteComputeResponse,
  ScenarioCompareResponse,
  ScenarioModification,
  SegmentEvidenceResponse,
  ScienceProfileResponse,
  HealthResponse,
  ScienceTarget,
  RegionInfo,
  MapLayersResponse,
  TerrainClassesResponse,
  BriefingResponse,
  EnvironmentResponse,
  ReportStrategy,
} from '@/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
  ) {
    super(`API Error ${status}: ${detail}`);
  }
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {}
    throw new ApiError(res.status, detail);
  }
  return res.json() as Promise<T>;
}

// ── Health ──────────────────────────────────────────────────────────────────

export async function getHealth(): Promise<HealthResponse> {
  return fetchJson<HealthResponse>('/api/v1/health');
}

// ── Map ─────────────────────────────────────────────────────────────────────

export async function getRegionInfo(): Promise<Record<string, unknown>> {
  return fetchJson<Record<string, unknown>>('/api/v1/map/region');
}

export async function getLayers(): Promise<Record<string, unknown>> {
  return fetchJson<Record<string, unknown>>('/api/v1/map/layers');
}

/** Typed form of GET /api/v1/map/region. Prefer this over getRegionInfo(). */
export async function getRegion(): Promise<RegionInfo> {
  return fetchJson<RegionInfo>('/api/v1/map/region');
}

/**
 * Typed form of GET /api/v1/map/layers.
 *
 * This response is the single source of truth for the layer panel: which
 * layers exist, which are renderable (`available`), and why not when they
 * are not. The client must not maintain a parallel hardcoded list.
 */
export async function getMapLayers(): Promise<MapLayersResponse> {
  return fetchJson<MapLayersResponse>('/api/v1/map/layers');
}

/**
 * Typed form of GET /api/v1/map/terrain-classes.
 *
 * Metadata for the unsupervised terrain-archetype layer: cluster names, the
 * features used, how k was chosen and the caveats. Returns
 * `{ available: false, reason, classes: [] }` when classification has not
 * been run — the caller must handle that rather than assume classes exist.
 */
export async function getTerrainClasses(): Promise<TerrainClassesResponse> {
  return fetchJson<TerrainClassesResponse>('/api/v1/map/terrain-classes');
}

/**
 * Base URL for map tiles.
 *
 * In production tiles are served from Supabase Storage (a CDN), not from the
 * API. Two reasons: Render's filesystem is ephemeral, so tiles served from the
 * API instance vanish on every redeploy; and streaming ~8,000 PNGs through a
 * 0.1-shared-CPU instance wastes both CPU and its bandwidth allowance.
 *
 * When NEXT_PUBLIC_TILE_BASE_URL is unset — local development, and the offline
 * demo — this falls back to the API's own tile route, so neither depends on
 * network storage being reachable.
 */
const TILE_BASE = process.env.NEXT_PUBLIC_TILE_BASE_URL?.replace(/\/$/, '')
  ?? `${API_BASE}/api/v1/map/tiles`;

/** True when tiles come from external object storage rather than the API. */
export function tilesAreExternallyHosted(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_TILE_BASE_URL);
}

/** URL of one specific tile. */
export function getTileUrl(layer: string, z: number, x: number, y: number): string {
  return `${TILE_BASE}/${layer}/${z}/${x}/${y}.png`;
}

/**
 * Leaflet URL template for a layer, e.g. `.../terrain/{z}/{x}/{y}.png`.
 *
 * Leaflet wants the placeholders literally, so this is built directly rather
 * than by string-replacing coordinates back out of a concrete getTileUrl()
 * result — which is what the map component used to do, and which silently
 * breaks the moment the URL shape changes.
 */
export function getTileUrlTemplate(layer: string): string {
  return `${TILE_BASE}/${layer}/{z}/{x}/{y}.png?v=4`;
}

// ── Routes ──────────────────────────────────────────────────────────────────

export async function computeRoutes(
  req: RouteComputeRequest,
): Promise<RouteComputeResponse> {
  return fetchJson<RouteComputeResponse>('/api/v1/routes/compute', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

export async function getDemoRoutes(): Promise<RouteComputeResponse> {
  return fetchJson<RouteComputeResponse>('/api/v1/routes/demo');
}

export async function getSegmentEvidence(
  computationId: string,
  segmentId: number,
  strategy: string,
): Promise<SegmentEvidenceResponse> {
  return fetchJson<SegmentEvidenceResponse>(
    `/api/v1/routes/${computationId}/segments/${segmentId}/evidence?strategy=${strategy}`,
  );
}

// ── Science ─────────────────────────────────────────────────────────────────

export async function getScienceTargets(): Promise<{ targets: ScienceTarget[]; label: string }> {
  return fetchJson<{ targets: ScienceTarget[]; label: string }>('/api/v1/science/targets');
}

export async function getScienceProfile(
  computationId: string,
  strategy: string,
): Promise<ScienceProfileResponse> {
  return fetchJson<ScienceProfileResponse>(
    `/api/v1/science/profile?computation_id=${computationId}&strategy=${strategy}`,
  );
}

export async function compareScienceStrategies(computationId: string): Promise<Record<string, unknown>> {
  return fetchJson<Record<string, unknown>>(`/api/v1/science/compare/${computationId}`);
}

// ── Scenarios ────────────────────────────────────────────────────────────────

export async function compareScenarios(
  baseComputationId: string,
  modifications: ScenarioModification,
): Promise<ScenarioCompareResponse> {
  return fetchJson<ScenarioCompareResponse>('/api/v1/scenarios/compare', {
    method: 'POST',
    body: JSON.stringify({
      base_computation_id: baseComputationId,
      modifications,
    }),
  });
}

// ── Environment ─────────────────────────────────────────────────────────────

/**
 * Current environmental conditions for the study region.
 *
 * Most fields come back null on purpose — the MCS atmospheric products they
 * would derive from are not available as a gridded NASA product. Callers must
 * render a null as — and surface `notes`, never substitute a number.
 */
export async function getEnvironment(): Promise<EnvironmentResponse> {
  return fetchJson<EnvironmentResponse>('/api/v1/environment/current');
}

// ── Mission briefing & report ───────────────────────────────────────────────

/** Narrative Markdown briefing for one strategy of a stored computation. */
export async function getBriefing(
  computationId: string,
  strategy: ReportStrategy | string,
): Promise<BriefingResponse> {
  return fetchJson<BriefingResponse>(
    `/api/v1/report/briefing/${encodeURIComponent(computationId)}`
      + `?strategy=${encodeURIComponent(strategy)}`,
  );
}

/**
 * URL of the self-contained HTML mission report.
 *
 * This endpoint returns a whole HTML document, not JSON, so the client opens
 * the URL directly rather than fetching and re-rendering it. With
 * `download` the backend adds a Content-Disposition attachment header.
 */
export function getReportUrl(
  computationId: string,
  strategy: ReportStrategy | string,
  download = false,
): string {
  const params = new URLSearchParams({
    strategy,
    download: download ? 'true' : 'false',
  });
  return `${API_BASE}/api/v1/report/${encodeURIComponent(computationId)}?${params}`;
}

/**
 * URL of the official NASA Technical Memorandum PDF report.
 *
 * This endpoint returns a publication-grade PDF conforming to NASA Technical
 * Report formatting standards with full multi-mission provenance and vector layouts.
 */
export function getPdfReportUrl(
  computationId: string,
  strategy: ReportStrategy | string,
): string {
  const params = new URLSearchParams({ strategy });
  return `${API_BASE}/api/v1/report/pdf/${encodeURIComponent(computationId)}?${params}`;
}

/**
 * URL of the standard RFC 7946 GeoJSON route export.
 *
 * Compatible with QGIS, ArcGIS, Google Earth, and web GIS viewers.
 */
export function getGeoJsonReportUrl(
  computationId: string,
  strategy?: ReportStrategy | string,
): string {
  const params = new URLSearchParams();
  if (strategy && strategy !== 'ALL') {
    params.set('strategy', strategy);
  }
  const qs = params.toString() ? `?${params}` : '';
  return `${API_BASE}/api/v1/routes/${encodeURIComponent(computationId)}/geojson${qs}`;
}

export interface RoutePresetItem {
  id: string;
  name: string;
  type: string;
  desc: string;
  start: { lat: number; lon: number };
  destination: { lat: number; lon: number };
  historical_context?: string;
}

/** Fetch authoritative traverse presets from backend. */
export async function getRoutePresets(): Promise<RoutePresetItem[]> {
  return fetchJson<RoutePresetItem[]>('/api/v1/routes/presets');
}

export { ApiError };

