'use client';

import React, { useState } from 'react';
import type { RouteStrategy, Route, ParetoStatus } from '@/types';
import { STRATEGY_META } from '@/types';
import { withAlpha } from '@/utils/color';
import { LayoutGrid, Table as TableIcon, AlertTriangle, ShieldCheck } from 'lucide-react';

interface RouteComparisonTableProps {
  routes: Partial<Record<RouteStrategy, Route>>;
  pareto: Partial<Record<RouteStrategy, ParetoStatus>>;
  activeStrategy: RouteStrategy | null;
  onStrategySelect: (_s: RouteStrategy) => void;
}

export default function RouteComparisonTable({
  routes,
  pareto,
  activeStrategy,
  onStrategySelect,
}: RouteComparisonTableProps) {
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const strategies = Object.keys(routes) as RouteStrategy[];
  if (strategies.length === 0) return null;

  return (
    <div>
      {/* View Mode Toggle */}
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Strategy Evaluation ({strategies.length})
        </span>
        <div className="flex items-center rounded p-0.5 border" style={{ background: 'var(--surface-sunken)', borderColor: 'var(--border)' }}>
          <button
            onClick={() => setViewMode('cards')}
            className="px-2 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 transition-all"
            style={{
              background: viewMode === 'cards' ? 'var(--accent)' : 'transparent',
              color: viewMode === 'cards' ? 'var(--on-accent)' : 'var(--text-secondary)',
            }}
            title="Card View (Recommended for sidebars)"
          >
            <LayoutGrid size={11} /> Cards
          </button>
          <button
            onClick={() => setViewMode('table')}
            className="px-2 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 transition-all"
            style={{
              background: viewMode === 'table' ? 'var(--accent)' : 'transparent',
              color: viewMode === 'table' ? 'var(--on-accent)' : 'var(--text-secondary)',
            }}
            title="Compact Table View"
          >
            <TableIcon size={11} /> Table
          </button>
        </div>
      </div>

      {viewMode === 'cards' ? (
        /* Cards View — fully fits 360px sidebar without horizontal scroll */
        <div className="space-y-2">
          {strategies.map((name) => {
            const route = routes[name]!;
            const m = route.metrics;
            const meta = STRATEGY_META[name];
            const isActive = activeStrategy === name;
            const paretoStatus = pareto[name];
            const isPareto = paretoStatus === 'NON_DOMINATED';
            const isFeasible = route.is_feasible !== false;

            const budgetH = m.effective_eva_budget_hours || 6.0;
            const reserveH = m.required_eva_time_with_reserve_hours || (m.estimated_time_hours * 1.2);
            const usagePct = Math.min(100, Math.round((reserveH / budgetH) * 100));

            return (
              <div
                key={name}
                onClick={() => onStrategySelect(name)}
                className="p-2.5 rounded-lg border cursor-pointer transition-all duration-150 text-xs"
                style={{
                  background: isActive ? withAlpha(meta.color, 8) : 'var(--surface-sunken)',
                  borderColor: isActive ? meta.color : 'var(--border)',
                  boxShadow: isActive ? `0 0 0 1px ${meta.color}` : 'none',
                }}
              >
                {/* Card Header: Color, Name, Pareto, Feasibility */}
                <div className="flex items-center justify-between gap-1.5 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: meta.color }}
                    />
                    <span className="font-semibold text-xs truncate" style={{ color: 'var(--text-primary)' }}>
                      {meta.label}
                    </span>
                    {isActive && (
                      <span className="text-[9px] px-1 py-0.2 rounded font-bold uppercase" style={{ background: meta.color, color: '#fff' }}>
                        Active
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded font-medium"
                      style={{
                        background: isPareto ? 'var(--color-success-bg)' : 'var(--surface-raised)',
                        color: isPareto ? 'var(--color-success)' : 'var(--text-muted)',
                        border: `1px solid ${isPareto ? 'var(--color-success-border)' : 'var(--border)'}`,
                      }}
                      title={isPareto ? 'Non-dominated on Pareto frontier' : 'Dominated by another traverse'}
                    >
                      {isPareto ? '★ Optimal' : 'Dominated'}
                    </span>

                    {!isFeasible ? (
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded font-semibold flex items-center gap-0.5"
                        style={{
                          background: 'var(--color-danger-bg)',
                          color: 'var(--color-danger)',
                          border: '1px solid var(--color-danger-border)',
                        }}
                        title={route.infeasibility_reason || 'Route exceeds maximum EVA duration'}
                      >
                        <AlertTriangle size={9} /> Over Budget
                      </span>
                    ) : (
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded font-semibold flex items-center gap-0.5"
                        style={{
                          background: 'var(--color-success-bg)',
                          color: 'var(--color-success)',
                          border: '1px solid var(--color-success-border)',
                        }}
                      >
                        <ShieldCheck size={9} /> Feasible
                      </span>
                    )}
                  </div>
                </div>

                {/* Metrics 4-grid */}
                <div className="grid grid-cols-4 gap-1.5 p-1.5 rounded bg-black/10 text-[11px] font-mono">
                  <div>
                    <span className="text-[9px] block text-slate-400 font-sans">Distance</span>
                    <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {m.distance_km.toFixed(1)} km
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] block text-slate-400 font-sans">EVA Time</span>
                    <span className="font-semibold" style={{ color: !isFeasible ? 'var(--color-danger)' : 'var(--text-primary)' }}>
                      {m.estimated_time_hours.toFixed(1)} h
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] block text-slate-400 font-sans">Hazard</span>
                    <span
                      className="font-semibold"
                      style={{
                        color: m.avg_hazard_score < 3
                          ? 'var(--color-success)'
                          : m.avg_hazard_score < 6
                          ? 'var(--color-warning)'
                          : 'var(--color-danger)'
                      }}
                    >
                      {m.avg_hazard_score.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] block text-slate-400 font-sans">Science</span>
                    <span
                      className="font-semibold"
                      style={{
                        color: m.avg_science_value >= 0.5 ? 'var(--color-success)' : 'var(--text-primary)'
                      }}
                    >
                      {m.avg_science_value.toFixed(3)}
                    </span>
                  </div>
                </div>

                {/* Life Support Consumables Progress Bar */}
                <div className="mt-2">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                    <span>EVA Life Support (+20% reserve: {reserveH.toFixed(1)}h)</span>
                    <span className="font-mono">{usagePct}% of {budgetH.toFixed(0)}h</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-raised)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, (reserveH / budgetH) * 100)}%`,
                        background: !isFeasible ? 'var(--color-danger)' : usagePct > 80 ? 'var(--color-warning)' : 'var(--color-success)',
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Compact Table View */
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] border-collapse font-sans">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th className="py-1.5 px-1.5 font-medium text-left" style={{ color: 'var(--text-muted)' }}>Strategy</th>
                <th className="py-1.5 px-1.5 font-medium text-right" style={{ color: 'var(--text-muted)' }}>Dist</th>
                <th className="py-1.5 px-1.5 font-medium text-right" style={{ color: 'var(--text-muted)' }}>Time (Res)</th>
                <th className="py-1.5 px-1.5 font-medium text-right" style={{ color: 'var(--text-muted)' }}>Haz</th>
                <th className="py-1.5 px-1.5 font-medium text-right" style={{ color: 'var(--text-muted)' }}>Sci</th>
                <th className="py-1.5 px-1.5 font-medium text-right" style={{ color: 'var(--text-muted)' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {strategies.map((name) => {
                const route = routes[name]!;
                const m = route.metrics;
                const meta = STRATEGY_META[name];
                const isActive = activeStrategy === name;
                const paretoStatus = pareto[name];
                const isPareto = paretoStatus === 'NON_DOMINATED';
                const isFeasible = route.is_feasible !== false;
                const reserveH = m.required_eva_time_with_reserve_hours || (m.estimated_time_hours * 1.2);

                return (
                  <tr
                    key={name}
                    onClick={() => onStrategySelect(name)}
                    className="cursor-pointer transition-colors"
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      background: isActive ? withAlpha(meta.color, 10) : 'transparent',
                    }}
                  >
                    <td className="py-1.5 px-1.5">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: meta.color }} />
                        <span className="font-semibold text-xs" style={{ color: 'var(--text-primary)' }}>
                          {meta.label}
                        </span>
                      </div>
                    </td>
                    <td className="text-right py-1.5 px-1.5 font-mono" style={{ color: 'var(--text-secondary)' }}>
                      {m.distance_km.toFixed(1)}k
                    </td>
                    <td className="text-right py-1.5 px-1.5 font-mono" style={{ color: !isFeasible ? 'var(--color-danger)' : 'var(--text-secondary)' }}>
                      {m.estimated_time_hours.toFixed(1)}h
                      <span className="block text-[9px] opacity-75 font-sans">({reserveH.toFixed(1)}h)</span>
                    </td>
                    <td className="text-right py-1.5 px-1.5 font-mono">
                      <span style={{ color: m.avg_hazard_score < 3 ? 'var(--color-success)' : m.avg_hazard_score < 6 ? 'var(--color-warning)' : 'var(--color-danger)' }}>
                        {m.avg_hazard_score.toFixed(1)}
                      </span>
                    </td>
                    <td className="text-right py-1.5 px-1.5 font-mono">
                      <span style={{ color: m.avg_science_value >= 0.5 ? 'var(--color-success)' : 'var(--text-primary)' }}>
                        {m.avg_science_value.toFixed(2)}
                      </span>
                    </td>
                    <td className="text-right py-1.5 px-1.5">
                      {!isFeasible ? (
                        <span className="text-[9px] px-1 py-0.5 rounded font-semibold text-rose-500 bg-rose-500/10 border border-rose-500/20">
                          Over
                        </span>
                      ) : isPareto ? (
                        <span className="text-[9px] px-1 py-0.5 rounded font-semibold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20">
                          ★ Best
                        </span>
                      ) : (
                        <span className="text-[9px] px-1 py-0.5 rounded text-slate-400">
                          Sub
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[10px] mt-2 px-1 leading-snug" style={{ color: 'var(--text-muted)' }}>
        Multi-objective A* evaluated across 300×300 Jezero rasters. Pareto ★ indicates non-dominated traverse.
      </p>
    </div>
  );
}
