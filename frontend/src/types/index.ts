/**
 * VICTOR — TypeScript interfaces matching all backend models.
 * DataMode: LIVE | VERIFIED_SNAPSHOT | DEMONSTRATION
 */

export type DataMode = 'LIVE' | 'VERIFIED_SNAPSHOT' | 'DEMONSTRATION';
export type RouteStrategy = 'SAFEST' | 'FASTEST' | 'SCIENCE_RICHEST' | 'BALANCED';
export type ConfidenceLevel = 'HIGH' | 'MODERATE' | 'LOW';
export type ParetoStatus = 'NON_DOMINATED' | 'DOMINATED';
export type MineralClass =
  | 'CARBONATE' | 'PHYLLOSILICATE' | 'HYDRATED_SILICA'
  | 'OLIVINE_ALTERED' | 'SULFATE' | 'PYROXENE' | 'IRON_OXIDE'
  | 'BASALT' | 'UNKNOWN';

export interface Coordinate {
  lat: number;
  lon: number;
}

export interface GridMetadata {
  lat_min: number;
  lat_max: number;
  lon_min: number;
  lon_max: number;
  rows: number;
  cols: number;
  cell_size_ns_m: number;  // ~177m N-S
  cell_size_ew_m: number;  // ~187m E-W
  cell_shape: string;      // 'non-square'
  coordinate_system: string;
  region_ns_km: number;
  region_ew_km: number;
}

export interface MissionConstraints {
  max_slope_deg: number;
  max_eva_hours: number;
  walking_speed_kmh: number;
}

export interface EdgeCostBreakdown {
  distance_contribution: number;
  traversability_contribution: number;
  hazard_contribution: number;
  science_penalty_contribution: number;
  total_edge_cost: number;
}

export interface RouteSegment {
  segment_id: number;
  start: Coordinate;
  end: Coordinate;
  distance_m: number;
  elevation_change_m: number;
  slope_deg: number;
  traversability_cost: number;
  hazard_score: number;
  science_value: number;
  science_tier?: number;
  cost_breakdown?: EdgeCostBreakdown;
  contributing_layers: Record<string, string>;
}

export interface RouteMetrics {
  distance_km: number;
  estimated_time_hours: number;
  avg_hazard_score: number;
  max_slope_deg: number;
  total_science_value: number;
  avg_science_value: number;
  segments_count: number;
  elevation_gain_m: number;
  elevation_loss_m: number;
  impassable_cells_avoided: number;
  confidence: ConfidenceLevel;
}

export interface ScienceTarget {
  id: string;
  name: string;
  type: string;
  mineral_class: MineralClass;
  location: Coordinate;
  science_value: number;
  tier: number;
  description: string;
  source: string;
  distance_from_route_m?: number;
  detour_cost_minutes?: number;
}

export interface Route {
  strategy: RouteStrategy;
  path: Coordinate[];
  segments: RouteSegment[];
  metrics: RouteMetrics;
  science_targets_nearby: ScienceTarget[];
  pareto_status: ParetoStatus;
}

export interface ProvenanceRecord {
  source: string;
  product: string;
  instrument: string;
  mission: string;
  pds_product_id?: string;
  observation_time?: string;
  retrieval_date?: string;
  processing_version: string;
  coordinate_system: string;
  resolution_m: number;
  confidence: ConfidenceLevel;
  notes?: string;
}

export interface RouteRangeSummary {
  min: number;
  max: number;
}

export interface RouteComputeComparison {
  distance_range: RouteRangeSummary;
  time_range: RouteRangeSummary;
  science_range: RouteRangeSummary;
  hazard_range: RouteRangeSummary;
  trade_off_summary: string;
}

export interface RouteComputeResponse {
  computation_id: string;
  data_mode: DataMode;
  strategies: Partial<Record<RouteStrategy, Route>>;
  comparison: RouteComputeComparison;
  pareto: Partial<Record<RouteStrategy, ParetoStatus>>;
  provenance: ProvenanceRecord[];
}

export interface RouteComputeRequest {
  start: Coordinate;
  destination: Coordinate;
  constraints: MissionConstraints;
  strategies: RouteStrategy[];
}

export interface ScenarioModification {
  max_slope_deg?: number;
  walking_speed_kmh?: number;
  max_eva_hours?: number;
}

export interface ScenarioDiff {
  strategy: string;
  distance_change_km: number;
  time_change_hours: number;
  hazard_change: number;
  science_change: number;
  route_diverged: boolean;
}

export interface ScenarioCompareResponse {
  base_computation_id: string;
  modified_computation_id: string;
  data_mode: DataMode;
  base_strategies: Partial<Record<RouteStrategy, Route>>;
  modified_strategies: Partial<Record<RouteStrategy, Route>>;
  diffs: ScenarioDiff[];
  impact_summary: string;
  pct_impassable_change: number;
}

export interface SegmentEvidenceResponse {
  computation_id: string;
  segment_id: number;
  elevation_m: number;
  slope_deg: number;
  surface_material: string;
  mineral_class: string;
  science_value: number;
  science_tier: number;
  hazard_score: number;
  traversability_cost: number;
  cost_breakdown: Record<string, number>;
  counterfactuals: Record<string, number>;
  data_sources: Array<{
    layer: string;
    source: string;
    instrument: string;
    mission: string;
    confidence: ConfidenceLevel;
    resolution_m: number;
    data_type: string;
    label?: string;
  }>;
  confidence_per_layer: Record<string, string>;
}

export interface ScienceProfilePoint {
  distance_km: number;
  science_value: number;
  elevation_m?: number;
  hazard_score?: number;
}

export interface ScienceProfileResponse {
  computation_id: string;
  strategy: string;
  profile: ScienceProfilePoint[];
  total_science_value: number;
  peak_science_value: number;
}

export interface HealthResponse {
  status: string;
  data_mode: DataMode;
  grid_loaded: boolean;
  grid_shape?: number[];
  region?: string;
  scientific_note?: string;
}

export interface LayerInfo {
  id: string;
  name: string;
  type: string;
  source: string;
  description: string;
}

// ── GET /api/v1/map/region ───────────────────────────────────────────────────
// Every field below is computed server-side from the loaded grids, or null.
// A null means "not available" and MUST render as — in the UI; the frontend
// never substitutes a plausible-looking constant.

export interface RegionCompliance {
  real_nasa_data: boolean;
  multi_mission: boolean;
  compliant: boolean;
  nasa_missions: string[];
  mission_count: number;
  missions_required?: number;
  synthetic_sources?: string[];
  blocking_issues?: string[];
}

export interface RegionInfo {
  region_name: string;
  name: string;
  lat_min: number;
  lat_max: number;
  lon_min: number;
  lon_max: number;
  /** Region centre, degrees. */
  lat: number | null;
  lon: number | null;
  /** Mean of the real elevation grid, metres relative to the Mars datum. */
  elevation_m: number | null;
  elevation_min_m: number | null;
  elevation_max_m: number | null;
  elevation_source: string | null;
  terrain_type: string | null;
  terrain_subtype: string | null;
  region_description: string | null;
  grid_rows: number;
  grid_cols: number;
  cell_size_ns_m: number;
  cell_size_ew_m: number;
  cell_shape: string;
  region_ns_km: number;
  region_ew_km: number;
  coordinate_system: string;
  data_mode: DataMode;
  compliance: RegionCompliance | null;
  available_layers: string[];
  provenance: ProvenanceRecord[];
}

// ── GET /api/v1/map/layers ───────────────────────────────────────────────────

export type LayerRenderType = 'tile' | 'polyline';
export type LayerClassification = 'MEASURED' | 'DERIVED' | 'MODELLED';

/** One map layer as the backend reports it. `available` is authoritative. */
export interface MapLayer {
  id: string;
  name: string;
  type: LayerRenderType | string;
  source: string;
  description: string;
  available: boolean;
  unavailable_reason: string | null;
  classification: LayerClassification | null;
  default_opacity: number;
}

export interface MapLayersResponse {
  data_mode: DataMode;
  layers: MapLayer[];
}

// ── GET /api/v1/map/terrain-classes ──────────────────────────────────────────
// Metadata for the `terrain_class` map layer: an UNSUPERVISED k-means
// classification of the surface. It is advisory — it does not feed the routing
// cost function — and the UI is required to say so.

/** One k-means cluster. `centroid` keys are the feature ids in `features`. */
export interface TerrainClass {
  id: number;
  name: string;
  /** Cells assigned to this cluster. Absent if the backend did not report it. */
  cell_count?: number | null;
  /** Share of classified cells, 0–1. */
  fraction: number | null;
  centroid: Record<string, number> | null;
}

export interface TerrainClassesResponse {
  /** Authoritative. When false, only `reason` and an empty `classes` are set. */
  available: boolean;
  /** Why classification output is missing, when `available` is false. */
  reason?: string | null;
  /** e.g. 'k-means (unsupervised)'. */
  method?: string | null;
  /** Chosen cluster count. */
  k?: number | null;
  /** How `k` was chosen, e.g. 'highest silhouette score'. */
  k_selection?: string | null;
  /** Silhouette score per candidate k, keyed by k as a string. */
  silhouette_scores?: Record<string, number> | null;
  /** Feature ids the clustering ran on. */
  features?: string[] | null;
  /** Share of cells with no CRISM coverage, 0–1. */
  crism_gap_fraction?: number | null;
  classes: TerrainClass[];
  caveats?: string[] | null;
}

/** CSS token holding the tile colour for a cluster id. Palette wraps at 7. */
export const TERRAIN_CLASS_PALETTE_SIZE = 7;

export function terrainClassColor(id: number): string {
  const slot = ((id % TERRAIN_CLASS_PALETTE_SIZE) + TERRAIN_CLASS_PALETTE_SIZE)
    % TERRAIN_CLASS_PALETTE_SIZE;
  return `var(--terrain-class-${slot})`;
}

// ── GET /api/v1/report/briefing/{computation_id} ─────────────────────────────

/** Which generator produced a briefing. Both are first-class, neither is an error. */
export type BriefingGenerator = 'llm' | 'template';

export interface BriefingResponse {
  computation_id: string;
  strategy: string;
  /** Markdown using only `##`, `###`, `- ` bullets and `**bold**`. */
  briefing: string;
  generator: BriefingGenerator | string;
  cached: boolean;
}

// ── GET /api/v1/environment/current ──────────────────────────────────────────
// Most fields are deliberately null: the gridded NASA products they would come
// from are not ingested. A null MUST render as — with `notes` explaining why.

export interface EnvironmentResponse {
  region: string;
  data_mode: DataMode;
  surface_temperature_day_c: number | null;
  surface_temperature_night_c: number | null;
  temperature_source: string | null;
  /** Unitless 0–1 THEMIS night-IR thermal inertia proxy. NOT a temperature. */
  thermal_index_mean: number | null;
  thermal_index_source: string | null;
  dust_opacity_tau: number | null;
  dust_opacity_source: string | null;
  atmospheric_pressure_pa: number | null;
  pressure_source: string | null;
  notes: string;
}

// UI state types
export interface MapPin {
  type: 'start' | 'destination';
  coordinate: Coordinate;
}

export interface ActiveLayer {
  id: string;
  visible: boolean;
  opacity: number;
}

// Strategy display metadata
export const STRATEGY_META: Record<RouteStrategy, {
  label: string;
  color: string;
  dashArray?: string;
  description: string;
}> = {
  SAFEST: {
    label: 'Safest',
    color: '#22C55E',
    description: 'Minimises hazard and slope risk',
  },
  FASTEST: {
    label: 'Fastest',
    color: '#3B82F6',
    dashArray: '8,4',
    description: 'Minimises total distance and traversal time',
  },
  SCIENCE_RICHEST: {
    label: 'Science-Richest',
    color: '#F97316',
    dashArray: '4,4',
    description: 'Maximises science value via high-tier mineral zones',
  },
  BALANCED: {
    label: 'Balanced',
    color: '#A855F7',
    dashArray: '12,4,4,4',
    description: 'Balances all objectives: distance, safety, science',
  },
};
