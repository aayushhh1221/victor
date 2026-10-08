'use client';

import React, { useState, useEffect } from 'react';
import type {
  RouteComputeResponse, RouteStrategy, SegmentEvidenceResponse, MissionConstraints,
} from '@/types';
import { STRATEGY_META } from '@/types';
import { getSegmentEvidence, getScienceProfile } from '@/services/api';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  CartesianGrid
} from 'recharts';
import { AlertTriangle, Info } from 'lucide-react';
import { withAlpha } from '@/utils/color';
import EvidencePopup from './EvidencePopup';

/**
 * Scale conventions, fixed by the backend and relied on throughout this file:
 *   hazard_score / avg_hazard_score — 0 to 10 (composite: MOLA slope + THEMIS night IR)
 *   science_value                   — 0 to 1 (MODEL score)
 *   traversability_cost             — banded multiplier, 1.0 (easy) to 10.0 (hardest passable)
 * Treating hazard as 0-1 would overstate every reading tenfold, so the
 * thresholds below are deliberately on the 0-10 scale and match EvidencePopup.
 */
const HAZARD_MAX = 10;
/** Highest traversability multiplier assigned to passable terrain. */
const TRAVERSABILITY_MAX = 10;

const hazardColor = (score: number) =>
  score < 3 ? 'var(--color-success)' : score < 6 ? 'var(--color-warning)' : 'var(--color-danger)';

interface RouteAnalysisViewProps {
  routeResult: RouteComputeResponse | null;
  activeStrategy: RouteStrategy | null;
  onStrategyChange: (s: RouteStrategy) => void;
  /** Mission constraints in force — the reference the slope meter is read against. */
  constraints: MissionConstraints;
}

function RiskMeter({
  label,
  icon,
  value,
  max,
  unit,
  color,
  unavailable,
  tooltip,
}: {
  label: string;
  icon: React.ReactNode;
  value: number | null;
  max: number;
  /** Suffix shown after both the value and the scale maximum. */
  unit?: string;
  color: string;
  unavailable?: boolean;
  tooltip?: string;
}) {
  const pct = value != null && max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const suffix = unit ?? '';
  return (
    <div className="flex items-center gap-3">
      <div
        className="w-8 h-8 flex items-center justify-center rounded flex-shrink-0"
        style={{
          background: unavailable ? 'var(--surface-sunken)' : withAlpha(color, 10),
          color: unavailable ? 'var(--text-disabled)' : color,
        }}
        title={tooltip}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span
            className="text-xs font-medium"
            style={{ color: 'var(--text-primary)' }}
            title={tooltip}
          >
            {label}
          </span>
          <div className="flex items-center gap-1">
            {unavailable || value == null ? (
              <span
                className="text-xs font-mono flex items-center gap-1"
                style={{ color: 'var(--text-muted)' }}
                title={tooltip}
              >
                <Info size={10} /> —
              </span>
            ) : (
              <span className="text-xs font-mono font-semibold" style={{ color }} title={tooltip}>
                {value.toFixed(1)}{suffix} / {max}{suffix}
              </span>
            )}
          </div>
        </div>
        <div className="risk-bar-track">
          {!unavailable && value != null && (
            <div
              className="risk-bar-fill"
              style={{ width: `${pct}%`, background: color }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/** Where the chart's elevation series came from, so the axis can say so. */
type ElevationBasis = 'absolute' | 'relative' | 'none';

interface ProfilePoint {
  km: string;
  elevation: number | null;
  difficulty: number | null;
}

export default function RouteAnalysisView({
  routeResult,
  activeStrategy,
  onStrategyChange,
  constraints,
}: RouteAnalysisViewProps) {
  const [chartData, setChartData] = useState<ProfilePoint[]>([]);
  const [elevationBasis, setElevationBasis] = useState<ElevationBasis>('none');
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [evidence, setEvidence] = useState<SegmentEvidenceResponse | null>(null);
  const [evidenceLoading, setEvidenceLoading] = useState(false);

  // Build the route profile chart. Preferred source is the science profile
  // endpoint, which reports absolute elevation sampled from the MOLA grid.
  useEffect(() => {
    if (!routeResult || !activeStrategy) {
      setChartData([]);
      setElevationBasis('none');
      return;
    }

    const route = routeResult.strategies[activeStrategy];
    if (!route) {
      setChartData([]);
      setElevationBasis('none');
      return;
    }

    setLoadingProfile(true);
    getScienceProfile(routeResult.computation_id, activeStrategy)
      .then((profile) => {
        const hasElevation = profile.profile.some((p) => p.elevation_m != null);
        setChartData(
          profile.profile.map((p) => ({
            km: p.distance_km.toFixed(2),
            // hazard_score is already 0-10 — no rescaling.
            elevation: p.elevation_m ?? null,
            difficulty: p.hazard_score ?? null,
          })),
        );
        setElevationBasis(hasElevation ? 'absolute' : 'none');
      })
      .catch(() => {
        // Fall back to per-segment data. Segments carry elevation_change_m (a
        // delta), never an absolute height, so we plot the cumulative change
        // from the route start and label the axis accordingly. Inventing an
        // absolute datum to add it to would be fabricating a measurement.
        let dist = 0;
        let cumulativeChange = 0;
        let sawElevationChange = false;
        const data: ProfilePoint[] = route.segments.map((seg) => {
          dist += seg.distance_m / 1000;
          if (seg.elevation_change_m != null) {
            cumulativeChange += seg.elevation_change_m;
            sawElevationChange = true;
          }
          return {
            km: dist.toFixed(2),
            elevation: seg.elevation_change_m != null ? cumulativeChange : null,
            difficulty: seg.hazard_score,
          };
        });
        setChartData(data);
        setElevationBasis(sawElevationChange ? 'relative' : 'none');
      })
      .finally(() => setLoadingProfile(false));
  }, [routeResult, activeStrategy]);

  const handleSegmentClick = async (strategy: RouteStrategy, segmentId: number) => {
    if (!routeResult) return;
    setEvidenceLoading(true);
    try {
      const ev = await getSegmentEvidence(routeResult.computation_id, segmentId, strategy);
      setEvidence(ev);
    } catch {
      // Silently fail
    } finally {
      setEvidenceLoading(false);
    }
  };

  const activeRoute = activeStrategy ? routeResult?.strategies[activeStrategy] : null;

  // ── Risk meters ──────────────────────────────────────────────────────────
  // Each meter reads ONE distinct real field. Where no real field exists for a
  // factor, the meter is marked unavailable rather than synthesised from
  // another one.

  /** Mean composite hazard along the route, 0-10, straight from route metrics. */
  const avgHazard = activeRoute ? activeRoute.metrics.avg_hazard_score : null;

  /** Steepest slope encountered, degrees, read against the mission slope limit. */
  const maxSlope = activeRoute ? activeRoute.metrics.max_slope_deg : null;
  const slopeLimit = constraints.max_slope_deg;

  /** Mean traversability multiplier — derived from MOLA slope bands, a field
   *  distinct from the hazard composite. */
  const avgTraversability = (() => {
    if (!activeRoute || activeRoute.segments.length === 0) return null;
    const vals = activeRoute.segments
      .map((s) => s.traversability_cost)
      .filter((v): v is number => v != null && Number.isFinite(v));
    if (vals.length === 0) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  })();


  return (
    <div
      className="flex-1 overflow-y-auto p-6"
      style={{ background: 'var(--surface)', color: 'var(--text-primary)' }}
    >
      <div className="mb-5">
        <p className="section-heading mb-1">Analysis</p>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Route Analysis
        </h1>
      </div>

      {/* Strategy selector */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {(['SAFEST', 'FASTEST', 'SCIENCE_RICHEST', 'BALANCED'] as RouteStrategy[]).map((s) => {
          const meta = STRATEGY_META[s];
          const hasRoute = !!routeResult?.strategies[s];
          return (
            <button
              key={s}
              onClick={() => hasRoute && onStrategyChange(s)}
              disabled={!hasRoute}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-30"
              style={{
                background: activeStrategy === s ? `${meta.color}18` : 'var(--surface-raised)',
                border: `1px solid ${activeStrategy === s ? meta.color + '60' : 'var(--border)'}`,
                color: activeStrategy === s ? meta.color : 'var(--text-secondary)',
              }}
            >
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: meta.color }}
              />
              {meta.label}
            </button>
          );
        })}
      </div>

      {!routeResult && (
        <div
          className="flex items-center gap-3 p-4 rounded-lg"
          style={{
            background: 'var(--mode-demo-bg)',
            border: '1px solid var(--mode-demo-border)',
            color: 'var(--mode-demo)',
          }}
        >
          <AlertTriangle size={16} />
          <p className="text-sm">No route available. Plan a Marswalk to see analysis.</p>
        </div>
      )}

      {routeResult && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Route Profile Chart */}
          <div
            className="xl:col-span-2 rounded-xl p-4"
            style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)' }}
          >
            <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
              Route Profile
            </h2>
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
              {elevationBasis === 'relative'
                ? 'Cumulative elevation change from the route start, and terrain hazard (0–10) along the route'
                : 'Elevation and terrain hazard (0–10) along the selected route'}
            </p>

            {loadingProfile ? (
              <div className="h-48 flex items-center justify-center">
                <div
                  className="w-5 h-5 border-2 rounded-full animate-spin"
                  style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
                />
              </div>
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="km"
                    label={{ value: 'Distance (km)', position: 'insideBottomRight', offset: -10, fontSize: 11 }}
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis
                    yAxisId="elev"
                    orientation="left"
                    label={{
                      value: elevationBasis === 'relative'
                        ? 'Elevation change (m)'
                        : 'Elevation (m)',
                      angle: -90,
                      position: 'insideLeft',
                      fontSize: 11,
                    }}
                    tick={{ fontSize: 10 }}
                    domain={['auto', 'auto']}
                  />
                  <YAxis
                    yAxisId="diff"
                    orientation="right"
                    domain={[0, HAZARD_MAX]}
                    hide
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--surface-raised)',
                      border: '1px solid var(--border)',
                      fontSize: 11,
                      color: 'var(--text-primary)',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {elevationBasis !== 'none' && (
                    <Line
                      yAxisId="elev"
                      type="monotone"
                      dataKey="elevation"
                      stroke="var(--route-fastest)"
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                      name={
                        elevationBasis === 'relative'
                          ? 'Elevation change from start (m)'
                          : 'Elevation (m)'
                      }
                    />
                  )}
                  <Line
                    yAxisId="diff"
                    type="monotone"
                    dataKey="difficulty"
                    stroke="var(--route-science-richest)"
                    strokeWidth={1.5}
                    dot={false}
                    connectNulls
                    name="Terrain hazard (0–10)"
                    strokeDasharray="4 2"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center">
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Select a route strategy to view its profile
                </p>
              </div>
            )}
            {elevationBasis === 'relative' && (
              <p className="text-[10px] mt-2" style={{ color: 'var(--text-muted)' }}>
                Absolute elevation was unavailable for this route, so the elevation trace shows
                cumulative change from the start point. No absolute datum has been assumed.
              </p>
            )}
          </div>

          {/* Right column: Risk + Segment list */}
          <div className="space-y-4">
            {/* Route Risk Assessment */}
            <div
              className="rounded-xl p-4"
              style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)' }}
            >
              <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                Route Risk Assessment
              </h2>
              <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                Each factor below reads one distinct measured or derived field.
              </p>
              <div className="space-y-4">
                <RiskMeter
                  label="Terrain Hazard (mean)"
                  icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 20L12 4l9 16H3z"/></svg>}
                  value={avgHazard}
                  max={HAZARD_MAX}
                  color="var(--risk-extreme)"
                  tooltip="Mean composite hazard over all route segments, 0–10. Derived from MOLA slope (70%) and THEMIS night-IR thermal proxy (30%). Field: metrics.avg_hazard_score"
                />
                <RiskMeter
                  label="Peak Slope vs Limit"
                  icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 20 L21 4"/><path d="M3 20 L21 20"/></svg>}
                  value={maxSlope}
                  max={slopeLimit}
                  unit="°"
                  color="var(--risk-moderate)"
                  tooltip={`Steepest slope on the route, measured from the MOLA elevation grid, shown against the ${slopeLimit}° mission slope limit you set. Field: metrics.max_slope_deg`}
                />
                <RiskMeter
                  label="Traversability Cost (mean)"
                  icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 18h4l3-12 3 12h4"/></svg>}
                  value={avgTraversability}
                  max={TRAVERSABILITY_MAX}
                  unit="×"
                  color="var(--risk-high)"
                  tooltip="Mean per-segment traversability multiplier — a banded cost from MOLA slope: 1.0× under 5°, rising to 10× at 20–25°. Terrain over 25° is impassable and excluded by the router. Field: segments[].traversability_cost"
                />
                <RiskMeter
                  label="Dust Exposure"
                  icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a10 10 0 0 1 10 10"/><path d="M12 6a6 6 0 0 1 6 6"/><path d="M12 10a2 2 0 0 1 2 2"/></svg>}
                  value={null}
                  max={10}
                  color="var(--risk-low)"
                  unavailable
                  tooltip="Dust Exposure: data source not yet ingested (MCS atmospheric data pending)"
                />
              </div>
            </div>

            {/* Metrics summary */}
            {activeRoute && (
              <div
                className="rounded-xl p-4"
                style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)' }}
              >
                <p className="section-heading mb-3">Route Metrics</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Distance', value: `${activeRoute.metrics.distance_km.toFixed(1)} km` },
                    { label: 'Est. Time', value: `${activeRoute.metrics.estimated_time_hours.toFixed(1)} h` },
                    { label: 'Max Slope', value: `${activeRoute.metrics.max_slope_deg.toFixed(1)}°` },
                    { label: 'Confidence', value: activeRoute.metrics.confidence },
                  ].map(({ label, value }) => (
                    <div key={label} className="victor-panel px-3 py-2">
                      <p className="metric-label">{label}</p>
                      <p className="metric-value text-sm">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Segment list — click for evidence */}
      {activeRoute && activeRoute.segments.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
            Segment Evidence
          </h2>
          <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
            Click any segment to see which NASA instrument data drove its routing cost.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Seg', 'Distance', 'Slope°', 'Hazard (0–10)', 'Science (MODEL, 0–1)'].map((h) => (
                    <th
                      key={h}
                      className="text-left py-2 px-3 font-medium"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeRoute.segments.slice(0, 20).map((seg) => (
                  <tr
                    key={seg.segment_id}
                    onClick={() => activeStrategy && handleSegmentClick(activeStrategy, seg.segment_id)}
                    className="cursor-pointer transition-colors hover:bg-opacity-50"
                    style={{ borderBottom: '1px solid var(--border-subtle)' }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = 'var(--accent-lighter)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = '';
                    }}
                  >
                    <td className="py-1.5 px-3 font-mono" style={{ color: 'var(--text-muted)' }}>
                      #{seg.segment_id}
                    </td>
                    <td className="py-1.5 px-3 font-mono" style={{ color: 'var(--text-primary)' }}>
                      {(seg.distance_m).toFixed(0)} m
                    </td>
                    <td className="py-1.5 px-3 font-mono" style={{ color: 'var(--text-primary)' }}>
                      {seg.slope_deg.toFixed(1)}°
                    </td>
                    <td className="py-1.5 px-3 font-mono">
                      <span style={{ color: hazardColor(seg.hazard_score) }}>
                        {seg.hazard_score.toFixed(2)}
                      </span>
                    </td>
                    <td className="py-1.5 px-3 font-mono">
                      <span style={{
                        color: seg.science_value >= 0.6 ? 'var(--color-success)' : seg.science_value >= 0.3 ? 'var(--color-warning)' : 'var(--text-muted)'
                      }}>
                        {seg.science_value.toFixed(3)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {activeRoute.segments.length > 20 && (
              <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                Showing 20 of {activeRoute.segments.length} segments.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Evidence popup */}
      {evidenceLoading && (
        <div className="fixed bottom-8 right-8 flex items-center gap-2 px-3 py-2 rounded-lg text-xs z-50"
          style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        >
          <div
            className="w-3 h-3 border-2 rounded-full animate-spin"
            style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
          />
          Querying NASA instrument data…
        </div>
      )}
      {evidence && activeStrategy && (
        <EvidencePopup
          evidence={evidence}
          strategyName={STRATEGY_META[activeStrategy].label}
          strategyColor={STRATEGY_META[activeStrategy].color}
          onClose={() => setEvidence(null)}
        />
      )}

      <p className="text-[10px] mt-6" style={{ color: 'var(--text-muted)' }}>
        Science values are MODEL scores on a 0–1 scale — not direct NASA measurements.
        Hazard scores are on a 0–10 scale, derived from MOLA slope and THEMIS night-IR
        thermal inertia proxy.
      </p>
    </div>
  );
}
