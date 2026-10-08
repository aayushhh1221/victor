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

export function getTileUrl(layer: string, z: number, x: number, y: number): string {
  return `${API_BASE}/api/v1/map/tiles/${layer}/${z}/${x}/${y}.png`;
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

export { ApiError };
