'use client';

import React, { useState, useEffect } from 'react';
import type { RouteComputeResponse, RouteStrategy, ScienceTarget } from '@/types';
import { STRATEGY_META } from '@/types';
import { compareScienceStrategies } from '@/services/api';
import { FlaskConical, AlertTriangle, Info } from 'lucide-react';
import { withAlpha } from '@/utils/color';

interface ScienceOppsViewProps {
  routeResult: RouteComputeResponse | null;
  scienceTargets: ScienceTarget[];
  activeStrategy: RouteStrategy | null;
  scienceLabel: string;
}

/**
 * Per-strategy science metrics as GET /api/v1/science/compare/{id} reports
 * them. Every figure in the yield grid is read from here, so the request is
 * load-bearing rather than a render gate.
 */
interface StrategyScienceMetrics {
  total_science_value: number;
  avg_science_value: number;
  peak_science_value: number;
  science_per_km: number;
}

interface ScienceComparison {
  computation_id: string;
  comparison: Partial<Record<string, StrategyScienceMetrics>>;
  discovery_analysis: string;
  label: string;
}

const TIER_LABELS: Record<number, string> = {
  1: 'Biosignature-relevant',
  2: 'Water interaction',
  3: 'Geological context',
  4: 'Baseline',
};

const TIER_COLORS: Record<number, string> = {
  1: 'var(--tier-1)',
  2: 'var(--tier-2)',
  3: 'var(--tier-3)',
  4: 'var(--tier-4)',
};

function ValueBadge({ tier }: { tier: number }) {
  const label = tier === 1 ? 'High Value' : tier === 2 ? 'High Value' : tier === 3 ? 'Medium Value' : 'Baseline';
  const cls = tier <= 2 ? 'value-high' : tier === 3 ? 'value-medium' : 'value-low';
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${cls}`}>
      {label}
    </span>
  );
}

export default function ScienceOppsView({
  routeResult,
  scienceTargets,
  activeStrategy,
  scienceLabel,
}: ScienceOppsViewProps) {
  const [strategyComparison, setStrategyComparison] = useState<ScienceComparison | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!routeResult) {
      setStrategyComparison(null);
      return;
    }
    setLoading(true);
    compareScienceStrategies(routeResult.computation_id)
      .then((data) => setStrategyComparison(data as unknown as ScienceComparison))
      .catch(() => setStrategyComparison(null))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeResult?.computation_id]);

  // Get nearby targets for the active strategy
  const nearbyTargets = activeStrategy
    ? (routeResult?.strategies[activeStrategy]?.science_targets_nearby ?? [])
    : [];

  // All targets sorted by tier then science_value
  const sortedTargets = [...scienceTargets].sort((a, b) =>
    a.tier !== b.tier ? a.tier - b.tier : b.science_value - a.science_value
  );

  return (
    <div
      className="flex-1 overflow-y-auto p-6"
      style={{ background: 'var(--surface)', color: 'var(--text-primary)' }}
    >
      <div className="mb-5">
        <p className="section-heading mb-1">Science</p>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Science Opportunities
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          High-value geological and astrobiological targets in Jezero Crater.
        </p>
      </div>

      {/* Scientific Model Priority Notice */}
      <div
        className="flex items-start gap-3 p-4 rounded-xl mb-6 shadow-sm"
        style={{
          background: 'var(--surface-raised)',
          border: '1px solid var(--border)',
        }}
      >
        <Info size={16} className="flex-shrink-0 mt-0.5 text-blue-400" />
        <div>
          <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
            Scientific Model Priority Scores {scienceLabel ? `· ${scienceLabel}` : ''}
          </p>
          <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Science values are mathematical model scores derived from MRO CRISM multispectral mineral mapping (olivine & carbonate spectral absorption bands) and MOLA topography, weighted by astrobiological relevance. They guide autonomous route arbitration and do not represent direct in-situ confirmation of biosignatures.
          </p>
        </div>
      </div>

      {/* Science yield by strategy — every figure from /science/compare */}
      {strategyComparison?.comparison && (
        <div className="mb-6">
          <p className="section-heading mb-3">Science Yield by Strategy</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(['SAFEST', 'FASTEST', 'SCIENCE_RICHEST', 'BALANCED'] as RouteStrategy[]).map((strategy) => {
              const metrics = strategyComparison.comparison[strategy];
              if (!metrics) return null;
              const meta = STRATEGY_META[strategy];
              const nearbyCount = routeResult?.strategies[strategy]?.science_targets_nearby.length;
              return (
                <div
                  key={strategy}
                  className="rounded-xl p-3"
                  style={{
                    background: 'var(--surface-raised)',
                    border: `1px solid ${strategy === activeStrategy ? withAlpha(meta.color, 50) : 'var(--border)'}`,
                  }}
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: meta.color }} />
                    <span className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                      {meta.label}
                    </span>
                  </div>
                  <p className="text-lg font-bold" style={{ color: meta.color }}>
                    {metrics.total_science_value.toFixed(2)}
                  </p>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    total science · avg {metrics.avg_science_value.toFixed(3)}
                  </p>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    peak {metrics.peak_science_value.toFixed(3)} · {metrics.science_per_km.toFixed(3)} /km
                  </p>
                  <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                    {nearbyCount != null ? `${nearbyCount} targets nearby` : 'targets nearby: —'}
                  </p>
                </div>
              );
            })}
          </div>
          {strategyComparison.discovery_analysis && (
            <p className="text-xs mt-3 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {strategyComparison.discovery_analysis}
            </p>
          )}
        </div>
      )}

      {/* Nearby targets for active route */}
      {nearbyTargets.length > 0 && (
        <div className="mb-6">
          <p className="section-heading mb-3">
            Near Active Route — {activeStrategy && STRATEGY_META[activeStrategy].label}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {nearbyTargets.slice(0, 6).map((target) => (
              <div
                key={target.id}
                className="rounded-xl overflow-hidden"
                style={{
                  background: 'var(--surface-raised)',
                  border: `1px solid ${withAlpha(TIER_COLORS[target.tier] ?? 'var(--border)', 30)}`,
                }}
              >
                {/* Colored header strip */}
                <div
                  className="h-1"
                  style={{ background: TIER_COLORS[target.tier] ?? 'var(--border)' }}
                />
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="text-sm font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>
                        {target.name}
                      </p>
                      <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {target.type}
                      </p>
                    </div>
                    <FlaskConical
                      size={14}
                      className="flex-shrink-0 mt-0.5"
                      style={{ color: TIER_COLORS[target.tier] ?? 'var(--text-muted)' }}
                    />
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <ValueBadge tier={target.tier} />
                    <span
                      className="text-[11px] font-mono"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {target.distance_from_route_m != null
                        ? `${(target.distance_from_route_m / 1000).toFixed(1)} km`
                        : '—'}
                    </span>
                  </div>
                  <p className="text-[10px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {target.description.slice(0, 80)}{target.description.length > 80 ? '…' : ''}
                  </p>
                  {target.detour_cost_minutes != null && (
                    <p className="text-[10px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
                      Detour: +{target.detour_cost_minutes.toFixed(0)} min
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All science targets */}
      <div>
        <p className="section-heading mb-3">All Jezero Crater Targets ({sortedTargets.length})</p>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sortedTargets.map((target) => (
            <div
              key={target.id}
              className="rounded-xl p-3 flex gap-3"
              style={{
                background: 'var(--surface-raised)',
                border: '1px solid var(--border)',
              }}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-xs"
                style={{
                  background: TIER_COLORS[target.tier] ?? 'var(--tier-4)',
                  color: 'var(--on-tier)',
                }}
              >
                T{target.tier}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>
                    {target.name}
                  </p>
                  <ValueBadge tier={target.tier} />
                </div>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {target.type} · {target.mineral_class.replace('_', ' ')} ({TIER_LABELS[target.tier] ?? 'Tier ' + target.tier})
                </p>
                <p className="text-[10px] mt-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {target.description.slice(0, 70)}{target.description.length > 70 ? '…' : ''}
                </p>
                <div className="flex items-center justify-between mt-1.5">
                  <span
                    className="text-[11px] font-mono"
                    style={{ color: TIER_COLORS[target.tier] ?? 'var(--text-muted)' }}
                  >
                    Score: {target.science_value.toFixed(3)}
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--text-disabled)' }}>
                    {target.location.lat.toFixed(3)}°N
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {scienceTargets.length === 0 && !loading && (
        <div
          className="flex items-center gap-3 p-4 rounded-lg mt-4"
          style={{
            background: 'var(--surface-sunken)',
            border: '1px solid var(--border)',
            color: 'var(--text-muted)',
          }}
        >
          <AlertTriangle size={16} />
          <p className="text-sm">No science targets loaded. Ensure the backend is running.</p>
        </div>
      )}
    </div>
  );
}
