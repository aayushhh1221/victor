'use client';

import React from 'react';
import type { RouteStrategy, Route, ParetoStatus } from '@/types';
import { STRATEGY_META } from '@/types';

interface RouteComparisonTableProps {
  routes: Partial<Record<RouteStrategy, Route>>;
  pareto: Partial<Record<RouteStrategy, ParetoStatus>>;
  activeStrategy: RouteStrategy | null;
  onStrategySelect: (s: RouteStrategy) => void;
}

export default function RouteComparisonTable({
  routes,
  pareto,
  activeStrategy,
  onStrategySelect,
}: RouteComparisonTableProps) {
  const strategies = Object.keys(routes) as RouteStrategy[];
  if (strategies.length === 0) return null;

  // Hazard is on a 0-10 scale (see RouteAnalysisView); thresholds match.
  const headers = ['Strategy', 'Distance', 'Time', 'Hazard (0–10)', 'Science (0–1)', 'Pareto'];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {headers.map((h, i) => (
              <th
                key={h}
                className={`py-2 px-2 font-medium ${i === 0 ? 'text-left' : 'text-right'}`}
                style={{ color: 'var(--text-muted)' }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {strategies.map((name) => {
            const route = routes[name]!;
            const m = route.metrics;
            const meta = STRATEGY_META[name];
            const isActive = activeStrategy === name;
            const paretoStatus = pareto[name];
            return (
              <tr
                key={name}
                onClick={() => onStrategySelect(name)}
                className="cursor-pointer transition-colors"
                style={{
                  borderBottom: '1px solid var(--border-subtle)',
                  background: isActive ? 'var(--accent-lighter)' : 'transparent',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--surface-sunken)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
              >
                <td className="py-2 px-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ background: meta.color }}
                    />
                    <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                      {meta.label}
                    </span>
                  </div>
                </td>
                <td className="text-right py-2 px-2 font-mono" style={{ color: 'var(--text-secondary)' }}>
                  {m.distance_km.toFixed(1)} km
                </td>
                <td className="text-right py-2 px-2 font-mono" style={{ color: 'var(--text-secondary)' }}>
                  {m.estimated_time_hours.toFixed(1)} h
                </td>
                <td className="text-right py-2 px-2 font-mono">
                  <span
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
                </td>
                <td className="text-right py-2 px-2 font-mono">
                  <span
                    style={{
                      color: m.avg_science_value >= 0.6
                        ? 'var(--color-success)'
                        : m.avg_science_value >= 0.3
                        ? 'var(--color-warning)'
                        : 'var(--text-muted)'
                    }}
                  >
                    {m.avg_science_value.toFixed(3)}
                  </span>
                </td>
                <td className="text-right py-2 px-2">
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                    style={{
                      background: paretoStatus === 'NON_DOMINATED' ? 'var(--color-success-bg)' : 'var(--surface-sunken)',
                      color: paretoStatus === 'NON_DOMINATED' ? 'var(--color-success)' : 'var(--text-muted)',
                      border: `1px solid ${paretoStatus === 'NON_DOMINATED' ? 'var(--color-success-border)' : 'var(--border)'}`,
                    }}
                  >
                    {paretoStatus === 'NON_DOMINATED' ? '★ Optimal' : 'Dominated'}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-[10px] mt-2 px-2" style={{ color: 'var(--text-muted)' }}>
        Science values are MODEL scores — not direct NASA measurements.
        Pareto: ★ = not dominated on any objective.
      </p>
    </div>
  );
}
