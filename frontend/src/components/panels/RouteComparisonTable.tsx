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

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-white/10">
            <th className="text-left py-2 px-2 text-gray-400 font-medium">Strategy</th>
            <th className="text-right py-2 px-2 text-gray-400 font-medium">Distance</th>
            <th className="text-right py-2 px-2 text-gray-400 font-medium">Time</th>
            <th className="text-right py-2 px-2 text-gray-400 font-medium">Hazard</th>
            <th className="text-right py-2 px-2 text-gray-400 font-medium">Science</th>
            <th className="text-right py-2 px-2 text-gray-400 font-medium">Pareto</th>
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
                className={`cursor-pointer border-b border-white/5 transition-colors ${
                  isActive ? 'bg-white/10' : 'hover:bg-white/5'
                }`}
              >
                <td className="py-2 px-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ background: meta.color }}
                    />
                    <span className="text-gray-200 font-medium">{meta.label}</span>
                  </div>
                </td>
                <td className="text-right py-2 px-2 text-gray-300 font-mono">
                  {m.distance_km.toFixed(1)} km
                </td>
                <td className="text-right py-2 px-2 text-gray-300 font-mono">
                  {m.estimated_time_hours.toFixed(1)} h
                </td>
                <td className="text-right py-2 px-2 font-mono">
                  <span
                    className={
                      m.avg_hazard_score < 3
                        ? 'text-green-400'
                        : m.avg_hazard_score < 6
                        ? 'text-yellow-400'
                        : 'text-red-400'
                    }
                  >
                    {m.avg_hazard_score.toFixed(2)}
                  </span>
                </td>
                <td className="text-right py-2 px-2 font-mono">
                  <span
                    className={
                      m.avg_science_value >= 0.6
                        ? 'text-green-400'
                        : m.avg_science_value >= 0.3
                        ? 'text-yellow-400'
                        : 'text-gray-400'
                    }
                  >
                    {m.avg_science_value.toFixed(3)}
                  </span>
                </td>
                <td className="text-right py-2 px-2">
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      paretoStatus === 'NON_DOMINATED'
                        ? 'bg-green-800/60 text-green-300'
                        : 'bg-gray-700/60 text-gray-400'
                    }`}
                  >
                    {paretoStatus === 'NON_DOMINATED' ? '★ Optimal' : 'Dominated'}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-[10px] text-gray-600 mt-2 px-2">
        Science values are MODEL scores — not direct NASA measurements.
        Pareto: ★ = not dominated on any objective.
      </p>
    </div>
  );
}
