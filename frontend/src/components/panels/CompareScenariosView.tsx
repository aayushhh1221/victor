'use client';

import React, { useState } from 'react';
import type { RouteComputeResponse, MissionConstraints, ScenarioCompareResponse, RouteStrategy } from '@/types';
import { STRATEGY_META } from '@/types';
import { compareScenarios } from '@/services/api';
import {
  ArrowRight, RefreshCw, AlertTriangle, TrendingUp, TrendingDown, Minus,
  Sliders, Wind, Mountain, Zap, ShieldCheck, Sparkles, Compass, CheckCircle2,
  type LucideIcon,
} from 'lucide-react';
import { withAlpha } from '@/utils/color';

interface CompareScenariosViewProps {
  routeResult: RouteComputeResponse | null;
  baseConstraints: MissionConstraints;
  onApplyScenario?: (_c: MissionConstraints) => void;
}

const DEFAULT_MODIFIED: MissionConstraints = {
  max_slope_deg: 15,
  max_eva_hours: 4,
  walking_speed_kmh: 2,
};

interface ScenarioPreset {
  id: string;
  name: string;
  icon: LucideIcon;
  tagline: string;
  desc: string;
  constraints: MissionConstraints;
}

const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    id: 'dust-storm',
    name: 'Dust Storm Encounter',
    icon: Wind,
    tagline: 'High dust tau, low visibility & slow pace',
    desc: 'Simulates atmospheric dust storm contingency with reduced speed and conservative EVA duration.',
    constraints: {
      max_slope_deg: 12,
      max_eva_hours: 2.5,
      walking_speed_kmh: 1.5,
    },
  },
  {
    id: 'scarp-scouting',
    name: 'Steep Scarp Scouting',
    icon: Mountain,
    tagline: 'High allowable slope for crater rims',
    desc: 'Permits steep ascents up to 25° for direct access to delta front scarps and crater rim outcrops.',
    constraints: {
      max_slope_deg: 25,
      max_eva_hours: 5.0,
      walking_speed_kmh: 2.5,
    },
  },
  {
    id: 'rapid-sprint',
    name: 'Rapid Traversal Sprint',
    icon: Zap,
    tagline: 'Flat terrain sprint at 4.5 km/h',
    desc: 'Fast ground transit across flat crater plains prioritizing rapid distance coverage before nightfall.',
    constraints: {
      max_slope_deg: 10,
      max_eva_hours: 7.0,
      walking_speed_kmh: 4.5,
    },
  },
  {
    id: 'conservative-eva',
    name: 'Conservative Margin',
    icon: ShieldCheck,
    tagline: 'Strict consumables safety ceiling',
    desc: 'Tight safety boundaries with strict suit oxygen/power reserve margins.',
    constraints: {
      max_slope_deg: 14,
      max_eva_hours: 3.0,
      walking_speed_kmh: 2.0,
    },
  },
];

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

export default function CompareScenariosView({
  routeResult,
  baseConstraints,
  onApplyScenario,
}: CompareScenariosViewProps) {
  const [modified, setModified] = useState<MissionConstraints>(DEFAULT_MODIFIED);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [result, setResult] = useState<ScenarioCompareResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyPreset = (preset: ScenarioPreset) => {
    setModified({ ...preset.constraints });
    setSelectedPreset(preset.id);
  };

  const handleSliderChange = (field: keyof MissionConstraints, value: number) => {
    setSelectedPreset(null);
    setModified((prev) => ({ ...prev, [field]: value }));
  };

  const runComparison = async () => {
    if (!routeResult) {
      setError('No route computed yet. Plan a Marswalk first.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const mods = {
        max_slope_deg: modified.max_slope_deg,
        max_eva_hours: modified.max_eva_hours,
        walking_speed_kmh: modified.walking_speed_kmh,
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
        <p className="section-heading mb-1">Mission Planning & Differential Simulation</p>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Compare Scenarios
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Modify mission constraints or choose environmental contingency presets to evaluate how each route strategy responds.
          The backend re-runs A* traversal with your new parameters and calculates exact delta metrics.
        </p>
      </div>

      {!routeResult && (
        <div
          className="flex items-center gap-3 p-4 rounded-xl mb-6 shadow-sm"
          style={{
            background: 'var(--mode-demo-bg)',
            border: '1px solid var(--mode-demo-border)',
            color: 'var(--mode-demo)',
          }}
        >
          <AlertTriangle size={18} className="shrink-0" />
          <div className="text-sm">
            <strong>No active route baseline.</strong> Go to the <strong>Plan Marswalk</strong> tab or sidebar to compute an initial route,
            then return here to run differential sensitivity tests.
          </div>
        </div>
      )}

      {/* Preset quick selection pills */}
      <div className="mb-6">
        <p className="section-heading mb-2">Operational Contingency Presets</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {SCENARIO_PRESETS.map((p) => {
            const Icon = p.icon;
            const isSelected = selectedPreset === p.id;
            return (
              <button
                key={p.id}
                onClick={() => applyPreset(p)}
                className="text-left p-3 rounded-xl transition-all duration-200 border"
                style={{
                  background: isSelected ? 'var(--accent-light)' : 'var(--surface-raised)',
                  borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <Icon size={16} style={{ color: isSelected ? 'var(--accent)' : 'var(--text-secondary)' }} />
                    <span className="font-semibold text-xs" style={{ color: 'var(--text-primary)' }}>
                      {p.name}
                    </span>
                  </div>
                  {isSelected && <CheckCircle2 size={13} style={{ color: 'var(--accent)' }} />}
                </div>
                <p className="text-[11px] line-clamp-2 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {p.tagline}
                </p>
                <div className="mt-2 text-[10px] font-mono flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                  <span>{p.constraints.max_slope_deg}°</span>
                  <span>·</span>
                  <span>{p.constraints.max_eva_hours}h</span>
                  <span>·</span>
                  <span>{p.constraints.walking_speed_kmh}km/h</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Base constraints (read-only) */}
        <div
          className="rounded-xl p-5"
          style={{
            background: 'var(--surface-raised)',
            border: '1px solid var(--border)',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="section-heading">Base Constraints</p>
            <span className="text-[10px] font-medium uppercase px-2 py-0.5 rounded" style={{ background: 'var(--surface-sunken)', color: 'var(--text-muted)' }}>
              Active Baseline
            </span>
          </div>
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
            Original operational boundaries set during initial route generation.
          </p>
          <div className="space-y-4">
            <div className="p-3 rounded-lg" style={{ background: 'var(--surface-sunken)' }}>
              <p className="metric-label mb-1">Max Traversable Slope</p>
              <div className="flex items-baseline justify-between">
                <p className="text-2xl font-bold font-mono" style={{ color: 'var(--text-primary)' }}>
                  {baseConstraints.max_slope_deg}°
                </p>
                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>MOLA Slope Ceiling</span>
              </div>
            </div>
            <div className="p-3 rounded-lg" style={{ background: 'var(--surface-sunken)' }}>
              <p className="metric-label mb-1">Max EVA Duration</p>
              <div className="flex items-baseline justify-between">
                <p className="text-2xl font-bold font-mono" style={{ color: 'var(--text-primary)' }}>
                  {baseConstraints.max_eva_hours} h
                </p>
                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Suit Life Support</span>
              </div>
            </div>
            <div className="p-3 rounded-lg" style={{ background: 'var(--surface-sunken)' }}>
              <p className="metric-label mb-1">Walking Pace</p>
              <div className="flex items-baseline justify-between">
                <p className="text-2xl font-bold font-mono" style={{ color: 'var(--text-primary)' }}>
                  {baseConstraints.walking_speed_kmh} km/h
                </p>
                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Terrain slope-adjusted</span>
              </div>
            </div>
          </div>
        </div>

        {/* Middle: Arrow indicator */}
        <div className="flex items-center justify-center py-2 lg:py-0">
          <div className="flex flex-col items-center gap-2 p-3 rounded-full" style={{ background: 'var(--surface-sunken)' }}>
            <ArrowRight size={22} style={{ color: 'var(--accent)' }} className="transform rotate-90 lg:rotate-0" />
            <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Simulate
            </span>
          </div>
        </div>

        {/* Right: Modified constraints */}
        <div
          className="rounded-xl p-5"
          style={{
            background: 'var(--surface-raised)',
            border: '1px solid var(--border)',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="section-heading">Modified Constraints</p>
            <span className="text-[10px] font-medium uppercase px-2 py-0.5 rounded" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
              Target Scenario
            </span>
          </div>
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
            Adjust the sliders below or select a contingency preset above.
          </p>
          <div className="space-y-5">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="metric-label" htmlFor="scenario-slope">
                  Max Slope Limit
                </label>
                <span className="text-sm font-bold font-mono" style={{ color: 'var(--text-primary)' }}>
                  {modified.max_slope_deg}°
                </span>
              </div>
              <input
                id="scenario-slope"
                type="range" min={5} max={30} step={1}
                value={modified.max_slope_deg}
                onChange={(e) => handleSliderChange('max_slope_deg', +e.target.value)}
                className="w-full h-1 cursor-pointer"
                style={{ accentColor: 'var(--accent)' }}
              />
              <div className="flex justify-between text-[10px] mt-0.5" style={{ color: 'var(--text-disabled)' }}>
                <span>5° (conservative)</span><span>30° (steep ridge)</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="metric-label" htmlFor="scenario-eva">
                  Max EVA Duration
                </label>
                <span className="text-sm font-bold font-mono" style={{ color: 'var(--text-primary)' }}>
                  {modified.max_eva_hours} h
                </span>
              </div>
              <input
                id="scenario-eva"
                type="range" min={1} max={12} step={0.5}
                value={modified.max_eva_hours}
                onChange={(e) => handleSliderChange('max_eva_hours', +e.target.value)}
                className="w-full h-1 cursor-pointer"
                style={{ accentColor: 'var(--accent)' }}
              />
              <div className="flex justify-between text-[10px] mt-0.5" style={{ color: 'var(--text-disabled)' }}>
                <span>1 h (scout)</span><span>12 h (extended)</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="metric-label" htmlFor="scenario-speed">
                  Flat Walking Speed
                </label>
                <span className="text-sm font-bold font-mono" style={{ color: 'var(--text-primary)' }}>
                  {modified.walking_speed_kmh} km/h
                </span>
              </div>
              <input
                id="scenario-speed"
                type="range" min={0.5} max={6} step={0.5}
                value={modified.walking_speed_kmh}
                onChange={(e) => handleSliderChange('walking_speed_kmh', +e.target.value)}
                className="w-full h-1 cursor-pointer"
                style={{ accentColor: 'var(--accent)' }}
              />
              <div className="flex justify-between text-[10px] mt-0.5" style={{ color: 'var(--text-disabled)' }}>
                <span>0.5 km/h</span><span>6.0 km/h</span>
              </div>
            </div>
          </div>

          <button
            id="btn-compare-scenarios"
            onClick={runComparison}
            disabled={loading || !routeResult}
            className="mt-6 w-full py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
          >
            {loading ? (
              <>
                <div
                  className="w-4 h-4 border-2 rounded-full animate-spin"
                  style={{
                    borderColor: withAlpha('var(--on-accent)', 30),
                    borderTopColor: 'var(--on-accent)',
                  }}
                />
                Re-running Traversal A* Models…
              </>
            ) : (
              <>
                <RefreshCw size={15} />
                Run Scenario Comparison
              </>
            )}
          </button>

          {error && (
            <p className="mt-2.5 text-xs flex items-center gap-1.5 p-2 rounded" style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}>
              <AlertTriangle size={13} className="shrink-0" /> {error}
            </p>
          )}
        </div>
      </div>

      {/* When no result has been run yet: display informative sandbox preview card */}
      {!result && (
        <div
          className="mt-8 rounded-xl p-6"
          style={{
            background: 'var(--surface-raised)',
            border: '1px solid var(--border)',
          }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}
            >
              <Sliders size={20} />
            </div>
            <div>
              <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                Scenario Sensitivity & Divergence Engine
              </h3>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Understand how operational changes affect Martian surface route selection
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="p-4 rounded-lg" style={{ background: 'var(--surface-sunken)' }}>
              <div className="flex items-center gap-2 mb-2">
                <Mountain size={16} style={{ color: 'var(--accent)' }} />
                <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
                  Impassable Barrier Rerouting
                </h4>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Lowering slope tolerances transforms crater escarpments and dune ridges into hard obstacles, forcing the A* algorithm to scout wider detour corridors.
              </p>
            </div>

            <div className="p-4 rounded-lg" style={{ background: 'var(--surface-sunken)' }}>
              <div className="flex items-center gap-2 mb-2">
                <Zap size={16} style={{ color: 'var(--accent)' }} />
                <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
                  Consumables Feasibility
                </h4>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Modifying suit EVA duration checks whether distant high-yield science targets remain within safe round-trip metabolic envelopes.
              </p>
            </div>

            <div className="p-4 rounded-lg" style={{ background: 'var(--surface-sunken)' }}>
              <div className="flex items-center gap-2 mb-2">
                <Compass size={16} style={{ color: 'var(--accent)' }} />
                <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
                  Multi-Strategy Divergence
                </h4>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Evaluates how Safest, Fastest, Science-Richest, and Balanced routes branch differently when terrain difficulty coefficients shift.
              </p>
            </div>
          </div>

          <div className="mt-5 pt-4 flex items-center justify-between border-t" style={{ borderColor: 'var(--border)' }}>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {routeResult ? 'Baseline ready. Select any preset above and click Run Scenario Comparison.' : 'Awaiting baseline route from Marswalk Planner.'}
            </span>
            {routeResult && (
              <button
                onClick={runComparison}
                disabled={loading}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
                style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
              >
                <Sparkles size={13} />
                Run Default Comparison
              </button>
            )}
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="mt-8">
          {/* Impact summary */}
          <div
            className="p-5 rounded-xl mb-6 shadow-sm"
            style={{
              background: 'var(--accent-light)',
              border: `1px solid ${withAlpha('var(--accent)', 25)}`,
            }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <p className="section-heading">Scenario Impact Assessment</p>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded font-semibold" style={{ background: 'var(--surface-raised)', color: 'var(--accent)' }}>
                Data Mode: {result.data_mode}
              </span>
            </div>
            <p className="text-sm font-medium mt-1" style={{ color: 'var(--text-primary)' }}>
              {result.impact_summary}
            </p>
            {result.pct_impassable_change !== 0 && (
              <p className="text-xs mt-2 flex items-center gap-1.5 font-mono" style={{ color: 'var(--text-secondary)' }}>
                <Mountain size={13} style={{ color: 'var(--accent)' }} />
                Impassable terrain envelope: <strong>{result.pct_impassable_change > 0 ? '+' : ''}{result.pct_impassable_change.toFixed(1)}%</strong> change across grid
              </p>
            )}
            {onApplyScenario && (
              <div
                className="mt-4 pt-3 border-t flex flex-wrap items-center justify-between gap-3"
                style={{ borderColor: withAlpha('var(--accent)', 25) }}
              >
                <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Ready to adopt these parameters for your surface traverse?
                </div>
                <button
                  id="btn-apply-scenario-planner"
                  onClick={() => onApplyScenario(modified)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 shadow-sm transition-all hover:brightness-110 active:scale-95"
                  style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
                >
                  <CheckCircle2 size={14} />
                  Apply This Scenario to Mission Planner
                </button>
              </div>
            )}
          </div>

          {/* Per-strategy diffs */}
          <p className="section-heading mb-3">Strategy-by-Strategy Traversal Comparison</p>
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
                  className="rounded-xl p-4 transition-shadow hover:shadow-md"
                  style={{
                    background: 'var(--surface-raised)',
                    border: `1px solid ${withAlpha(meta.color, 35)}`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ background: meta.color }}
                    />
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                      {meta.label}
                    </p>
                    {mod && !mod.is_feasible && (
                      <span
                        className="ml-auto text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 flex items-center gap-1"
                        style={{
                          background: 'var(--color-danger-bg)',
                          color: 'var(--color-danger)',
                          border: '1px solid var(--color-danger-border)',
                        }}
                        title={mod.infeasibility_reason || 'Route exceeds modified EVA limit'}
                      >
                        <AlertTriangle size={10} />
                        Over EVA Budget
                      </span>
                    )}
                    {diff.route_diverged && (!mod || mod.is_feasible) && (
                      <span
                        className="ml-auto text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0"
                        style={{
                          background: 'var(--accent-light)',
                          color: 'var(--accent)',
                          border: '1px solid var(--border)',
                        }}
                      >
                        Route Diverged
                      </span>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Distance</span>
                      <DeltaBadge value={diff.distance_change_km} unit=" km" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>EVA Time</span>
                      <DeltaBadge value={diff.time_change_hours} unit=" h" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Terrain Hazard</span>
                      <DeltaBadge value={diff.hazard_change} unit="" invertGood />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Science Score</span>
                      <DeltaBadge value={diff.science_change} unit="" />
                    </div>

                    {base && mod && (
                      <div
                        className="mt-3 pt-2.5 text-[11px] space-y-1.5"
                        style={{
                          borderTop: '1px solid var(--border)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        <div className="flex justify-between items-center">
                          <span>Base:</span>
                          <span className="font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>
                            {base.metrics.distance_km.toFixed(2)} km · {base.metrics.estimated_time_hours.toFixed(2)} h
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>Modified:</span>
                          <span className="font-mono text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {mod.metrics.distance_km.toFixed(2)} km · {mod.metrics.estimated_time_hours.toFixed(2)} h
                          </span>
                        </div>
                        {mod.infeasibility_reason && (
                          <div className="text-[10px] pt-1 leading-tight flex items-start gap-1" style={{ color: 'var(--color-danger)' }}>
                            <AlertTriangle size={10} className="shrink-0 mt-0.5" />
                            <span>{mod.infeasibility_reason}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <p
            className="text-[11px] mt-4 font-mono"
            style={{ color: 'var(--text-muted)' }}
          >
            Science metrics reflect multi-target heuristic scores based on CRISM mineral diversity indices.
          </p>
        </div>
      )}
    </div>
  );
}
