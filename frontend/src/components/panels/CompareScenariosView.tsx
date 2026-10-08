'use client';

import React, { useState } from 'react';
import type { RouteComputeResponse, MissionConstraints, ScenarioCompareResponse, RouteStrategy } from '@/types';
import { STRATEGY_META } from '@/types';
import { compareScenarios } from '@/services/api';
import { ArrowRight, RefreshCw, AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { withAlpha } from '@/utils/color';

interface CompareScenariosViewProps {
  routeResult: RouteComputeResponse | null;
  baseConstraints: MissionConstraints;
}

const DEFAULT_MODIFIED: MissionConstraints = {
  max_slope_deg: 15,
  max_eva_hours: 4,
  walking_speed_kmh: 2,
};

function DeltaBadge({ value, unit, invertGood }: { value: number; unit: string; invertGood?: boolean }) {
  const isPositive = value > 0;
  const isGood = invertGood ? !isPositive : isPositive;
  const color = Math.abs(value) < 0.001 ? 'var(--text-muted)' : isGood ? 'var(--color-success)' : 'var(--color-danger)';
  const Icon = Math.abs(value) < 0.001 ? Minus : isPositive ? TrendingUp : TrendingDown;
  return (
    <span className="flex items-center gap-1 text-xs font-mono font-semibold" style={{ color }}>
      <Icon size={11} />
      {isPositive ? '+' : ''}{value.toFixed(2)}{unit}
    </span>
  );
}

export default function CompareScenariosView({ routeResult, baseConstraints }: CompareScenariosViewProps) {
  const [modified, setModified] = useState<MissionConstraints>(DEFAULT_MODIFIED);
  const [result, setResult] = useState<ScenarioCompareResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runComparison = async () => {
    if (!routeResult) {
      setError('No route computed yet. Plan a Marswalk first.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const mods = {
        max_slope_deg: modified.max_slope_deg !== baseConstraints.max_slope_deg ? modified.max_slope_deg : undefined,
        max_eva_hours: modified.max_eva_hours !== baseConstraints.max_eva_hours ? modified.max_eva_hours : undefined,
        walking_speed_kmh: modified.walking_speed_kmh !== baseConstraints.walking_speed_kmh ? modified.walking_speed_kmh : undefined,
      };
      const r = await compareScenarios(routeResult.computation_id, mods);
      setResult(r);
    } catch (e: any) {
      setError(e.message ?? 'Comparison failed. Check backend connection.');
    } finally {
      setLoading(false);
    }
  };

  const strategies: RouteStrategy[] = ['SAFEST', 'FASTEST', 'SCIENCE_RICHEST', 'BALANCED'];

  return (
    <div
      className="flex-1 overflow-y-auto p-6"
      style={{ background: 'var(--surface)', color: 'var(--text-primary)' }}
    >
      {/* Page title */}
      <div className="mb-6">
        <p className="section-heading mb-1">Mission Planning</p>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Compare Scenarios
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Modify mission constraints and compare how each route strategy responds. The backend
          re-runs A* with your new parameters and shows before/after differences.
        </p>
      </div>

      {!routeResult && (
        <div
          className="flex items-center gap-3 p-4 rounded-lg mb-6"
          style={{
            background: 'var(--mode-demo-bg)',
            border: '1px solid var(--mode-demo-border)',
            color: 'var(--mode-demo)',
          }}
        >
          <AlertTriangle size={16} />
          <p className="text-sm">
            No route computed yet. Go to <strong>Plan Marswalk</strong> and compute a route first,
            then return here to compare scenarios.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Base constraints (read-only) */}
        <div
          className="rounded-xl p-4"
          style={{
            background: 'var(--surface-raised)',
            border: '1px solid var(--border)',
          }}
        >
          <p className="section-heading mb-3">Base Constraints</p>
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
            Original parameters used to compute the route.
          </p>
          <div className="space-y-4">
            <div>
              <p className="metric-label mb-1">Max Slope</p>
              <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {baseConstraints.max_slope_deg}°
              </p>
            </div>
            <div>
              <p className="metric-label mb-1">Max EVA Duration</p>
              <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {baseConstraints.max_eva_hours} h
              </p>
            </div>
            <div>
              <p className="metric-label mb-1">Walk Speed</p>
              <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {baseConstraints.walking_speed_kmh} km/h
              </p>
            </div>
          </div>
        </div>

        {/* Middle: Arrow */}
        <div className="flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <ArrowRight size={24} style={{ color: 'var(--accent)' }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              modify →
            </span>
          </div>
        </div>

        {/* Right: Modified constraints */}
        <div
          className="rounded-xl p-4"
          style={{
            background: 'var(--surface-raised)',
            border: '1px solid var(--border)',
          }}
        >
          <p className="section-heading mb-3">Modified Constraints</p>
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
            Drag sliders to change parameters.
          </p>
          <div className="space-y-5">
            <div>
              <label className="metric-label block mb-1" htmlFor="scenario-slope">
                Max Slope: <strong style={{ color: 'var(--text-primary)' }}>{modified.max_slope_deg}°</strong>
              </label>
              <input
                id="scenario-slope"
                type="range" min={5} max={30} step={1}
                value={modified.max_slope_deg}
                onChange={(e) => setModified((c) => ({ ...c, max_slope_deg: +e.target.value }))}
                className="w-full h-1"
                style={{ accentColor: 'var(--accent)' }}
              />
              <div className="flex justify-between text-[10px] mt-0.5" style={{ color: 'var(--text-disabled)' }}>
                <span>5°</span><span>30°</span>
              </div>
            </div>
            <div>
              <label className="metric-label block mb-1" htmlFor="scenario-eva">
                Max EVA: <strong style={{ color: 'var(--text-primary)' }}>{modified.max_eva_hours} h</strong>
              </label>
              <input
                id="scenario-eva"
                type="range" min={1} max={12} step={0.5}
                value={modified.max_eva_hours}
                onChange={(e) => setModified((c) => ({ ...c, max_eva_hours: +e.target.value }))}
                className="w-full h-1"
                style={{ accentColor: 'var(--accent)' }}
              />
              <div className="flex justify-between text-[10px] mt-0.5" style={{ color: 'var(--text-disabled)' }}>
                <span>1 h</span><span>12 h</span>
              </div>
            </div>
            <div>
              <label className="metric-label block mb-1" htmlFor="scenario-speed">
                Walk Speed: <strong style={{ color: 'var(--text-primary)' }}>{modified.walking_speed_kmh} km/h</strong>
              </label>
              <input
                id="scenario-speed"
                type="range" min={0.5} max={6} step={0.5}
                value={modified.walking_speed_kmh}
                onChange={(e) => setModified((c) => ({ ...c, walking_speed_kmh: +e.target.value }))}
                className="w-full h-1"
                style={{ accentColor: 'var(--accent)' }}
              />
              <div className="flex justify-between text-[10px] mt-0.5" style={{ color: 'var(--text-disabled)' }}>
                <span>0.5</span><span>6 km/h</span>
              </div>
            </div>
          </div>

          <button
            id="btn-compare-scenarios"
            onClick={runComparison}
            disabled={loading || !routeResult}
            className="mt-5 w-full py-2 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
          >
            {loading ? (
              <>
                <div
                  className="w-3.5 h-3.5 border-2 rounded-full animate-spin"
                  style={{
                    borderColor: withAlpha('var(--on-accent)', 30),
                    borderTopColor: 'var(--on-accent)',
                  }}
                />
                Running Comparison…
              </>
            ) : (
              <>
                <RefreshCw size={14} />
                Run Scenario Comparison
              </>
            )}
          </button>

          {error && (
            <p className="mt-2 text-xs flex items-center gap-1" style={{ color: 'var(--color-danger)' }}>
              <AlertTriangle size={11} /> {error}
            </p>
          )}
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="mt-8">
          {/* Impact summary */}
          <div
            className="p-4 rounded-xl mb-6"
            style={{
              background: 'var(--accent-light)',
              border: `1px solid ${withAlpha('var(--accent)', 20)}`,
            }}
          >
            <p className="section-heading mb-1">Impact Summary</p>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {result.impact_summary}
            </p>
            {result.pct_impassable_change !== 0 && (
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                Impassable cells: {result.pct_impassable_change > 0 ? '+' : ''}
                {result.pct_impassable_change.toFixed(1)}% change
              </p>
            )}
          </div>

          {/* Per-strategy diffs */}
          <p className="section-heading mb-3">Strategy-by-Strategy Comparison</p>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {strategies.map((strategy) => {
              const diff = result.diffs.find((d) => d.strategy === strategy);
              const base = result.base_strategies[strategy];
              const mod = result.modified_strategies[strategy];
              const meta = STRATEGY_META[strategy];
              if (!diff) return null;
              return (
                <div
                  key={strategy}
                  className="rounded-xl p-4"
                  style={{
                    background: 'var(--surface-raised)',
                    border: `1px solid ${withAlpha(meta.color, 30)}`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ background: meta.color }}
                    />
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {meta.label}
                    </p>
                    {diff.route_diverged && (
                      <span
                        className="ml-auto text-[10px] px-1.5 py-0.5 rounded font-medium"
                        style={{
                          background: 'var(--color-danger-bg)',
                          color: 'var(--color-danger)',
                          border: '1px solid var(--color-danger-border)',
                        }}
                      >
                        Route Changed
                      </span>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Distance</span>
                      <DeltaBadge value={diff.distance_change_km} unit=" km" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Time</span>
                      <DeltaBadge value={diff.time_change_hours} unit=" h" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Hazard</span>
                      <DeltaBadge value={diff.hazard_change} unit="" invertGood />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Science</span>
                      <DeltaBadge value={diff.science_change} unit="" />
                    </div>

                    {base && mod && (
                      <div
                        className="mt-2 pt-2 text-[10px] space-y-1"
                        style={{
                          borderTop: '1px solid var(--border)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        <div className="flex justify-between">
                          <span>Base:</span>
                          <span className="font-mono">
                            {base.metrics.distance_km.toFixed(1)} km · {base.metrics.estimated_time_hours.toFixed(1)} h
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Modified:</span>
                          <span className="font-mono">
                            {mod.metrics.distance_km.toFixed(1)} km · {mod.metrics.estimated_time_hours.toFixed(1)} h
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <p
            className="text-[10px] mt-4"
            style={{ color: 'var(--text-muted)' }}
          >
            Science values are MODEL scores — not direct NASA measurements. Data mode: {result.data_mode}.
          </p>
        </div>
      )}
    </div>
  );
}
