'use client';

import React from 'react';
import type { RouteComputeResponse, DataMode, MissionConstraints } from '@/types';
import { STRATEGY_META } from '@/types';
import { Route, FlaskConical, Shield, Clock } from 'lucide-react';
import { withAlpha } from '@/utils/color';

interface MissionOverviewProps {
  routeResult: RouteComputeResponse | null;
  dataMode: DataMode | null;
  constraints: MissionConstraints;
  onNavigate: (section: string) => void;
}

export default function MissionOverviewView({
  routeResult,
  dataMode,
  constraints,
  onNavigate,
}: MissionOverviewProps) {
  const strategies = routeResult
    ? Object.entries(routeResult.strategies).map(([name, route]) => ({ name, route }))
    : [];

  return (
    <div
      className="flex-1 overflow-y-auto p-6"
      style={{ background: 'var(--surface)', color: 'var(--text-primary)' }}
    >
      <div className="mb-6">
        <p className="section-heading mb-1">Interplanetary Survival Guide</p>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Mission Overview
        </h1>
        <p className="text-sm mt-1 max-w-2xl" style={{ color: 'var(--text-secondary)' }}>
          VICTOR computes four competing Marswalk routes across Jezero Crater, proves which are
          Pareto non-dominated, and explains every routing decision through NASA instrument data.
        </p>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          {
            icon: <Route size={18} />,
            label: 'Routes Computed',
            value: strategies.length > 0 ? `${strategies.length} / 4` : 'None yet',
            sub: 'SAFEST, FASTEST, SCIENCE_RICHEST, BALANCED',
            color: 'var(--accent)',
          },
          {
            icon: <Shield size={18} />,
            label: 'Max Slope',
            value: `${constraints.max_slope_deg}°`,
            sub: 'Current constraint',
            color: 'var(--color-success)',
          },
          {
            icon: <Clock size={18} />,
            label: 'EVA Duration',
            value: `${constraints.max_eva_hours} h`,
            sub: 'Max allowed',
            color: 'var(--color-warning)',
          },
          {
            icon: <FlaskConical size={18} />,
            label: 'Data Mode',
            value: dataMode?.replace('_', ' ') ?? '—',
            sub: dataMode === 'DEMONSTRATION' ? 'Synthetic data' : 'NASA instruments',
            color: dataMode === 'DEMONSTRATION' ? 'var(--mode-demo)' : 'var(--accent)',
          },
        ].map(({ icon, label, value, sub, color }) => (
          <div
            key={label}
            className="rounded-xl p-4"
            style={{
              background: 'var(--surface-raised)',
              border: '1px solid var(--border)',
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: withAlpha(color, 10), color }}
              >
                {icon}
              </div>
              <p className="section-heading">{label}</p>
            </div>
            <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {value}
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {sub}
            </p>
          </div>
        ))}
      </div>

      {/* Route summary (if computed) */}
      {strategies.length > 0 && routeResult && (
        <div className="mb-6">
          <p className="section-heading mb-3">Computed Routes</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {strategies.map(({ name, route }) => {
              if (!route) return null;
              const meta = STRATEGY_META[name as keyof typeof STRATEGY_META];
              const pareto = routeResult.pareto[name as keyof typeof routeResult.pareto];
              return (
                <div
                  key={name}
                  className="rounded-xl p-4"
                  style={{
                    background: 'var(--surface-raised)',
                    border: `1px solid ${withAlpha(meta.color, 30)}`,
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ background: meta.color }} />
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {meta.label}
                      </p>
                    </div>
                    {pareto === 'NON_DOMINATED' && (
                      <span
                        className="text-[10px] px-2 py-0.5 rounded font-medium"
                        style={{
                          background: 'var(--color-success-bg)',
                          color: 'var(--color-success)',
                          border: '1px solid var(--color-success-border)',
                        }}
                      >
                        ★ Pareto Optimal
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p style={{ color: 'var(--text-muted)' }}>Distance</p>
                      <p className="font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {route.metrics.distance_km.toFixed(1)} km
                      </p>
                    </div>
                    <div>
                      <p style={{ color: 'var(--text-muted)' }}>Time</p>
                      <p className="font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {route.metrics.estimated_time_hours.toFixed(1)} h
                      </p>
                    </div>
                    <div>
                      <p style={{ color: 'var(--text-muted)' }}>Avg Hazard (0–10)</p>
                      <p className="font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {route.metrics.avg_hazard_score.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p style={{ color: 'var(--text-muted)' }}>Science (MODEL, total)</p>
                      <p className="font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {route.metrics.total_science_value.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <p className="text-[10px] mt-2 italic" style={{ color: 'var(--text-muted)' }}>
                    {meta.description}
                  </p>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] mt-3" style={{ color: 'var(--text-muted)' }}>
            {routeResult.comparison.trade_off_summary}
          </p>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { id: 'plan', label: 'Plan a Marswalk', desc: 'Set start/destination, compute 4 routes' },
          { id: 'analysis', label: 'Route Analysis', desc: 'Elevation profile, risk assessment, segment evidence' },
          { id: 'scenarios', label: 'Compare Scenarios', desc: 'Modify constraints, see impact on all routes' },
        ].map(({ id, label, desc }) => (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            className="text-left p-4 rounded-xl transition-colors"
            style={{
              background: 'var(--surface-raised)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
            }}
          >
            <p className="text-sm font-semibold mb-1">{label}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
