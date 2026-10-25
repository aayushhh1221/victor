'use client';

import React, { useState } from 'react';
import type { SegmentEvidenceResponse } from '@/types';
import { X, ChevronDown, ChevronRight } from 'lucide-react';
import { withAlpha } from '@/utils/color';

interface EvidencePopupProps {
  evidence: SegmentEvidenceResponse;
  strategyName: string;
  strategyColor: string;
  onClose: () => void;
}

export default function EvidencePopup({
  evidence,
  strategyName,
  strategyColor,
  onClose,
}: EvidencePopupProps) {
  const [showSources, setShowSources] = useState(false);
  const [showCounterfactuals, setShowCounterfactuals] = useState(false);

  const tierLabel = ['', 'Biosignature-relevant', 'Water interaction', 'Geological context', 'Baseline'][
    evidence.science_tier
  ];
  const tierColor = ['', 'var(--tier-1)', 'var(--tier-2)', 'var(--tier-3)', 'var(--tier-4)'][evidence.science_tier];

  const confColor: Record<string, string> = {
    HIGH: 'var(--color-success)',
    MODERATE: 'var(--color-warning)',
    LOW: 'var(--color-danger)',
  };
  /** Unrecognised confidence levels get a neutral token, never a raw hex. */
  const confidenceColor = (level: string) => confColor[level] ?? 'var(--text-muted)';

  return (
    <div
      className="absolute bottom-4 right-4 w-80 rounded-lg shadow-2xl overflow-hidden z-50"
      style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)' }}
      id="evidence-popup"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
      >
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: strategyColor }} />
          <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
            {strategyName} — Segment {evidence.segment_id}
          </span>
        </div>
        <button
          onClick={onClose}
          className="transition-colors"
          style={{ color: 'var(--text-muted)' }}
          id="evidence-popup-close"
        >
          <X size={14} />
        </button>
      </div>

      <div className="p-3 space-y-3 overflow-y-auto max-h-[70vh]">
        {/* Terrain */}
        <section>
          <p className="section-heading mb-2">Terrain</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Elevation', value: `${evidence.elevation_m.toFixed(0)} m` },
              { label: 'Slope', value: `${evidence.slope_deg.toFixed(1)}°` },
              { label: 'Traversability', value: evidence.traversability_cost.toFixed(2) },
            ].map(({ label, value }) => (
              <div key={label} className="victor-panel px-2 py-1.5">
                <p className="metric-label">{label}</p>
                <p className="metric-value text-sm">{value}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Surface material */}
        <section>
          <p className="section-heading mb-1">Surface Material (THEMIS Proxy)</p>
          <div className="victor-panel p-2">
            <p className="text-xs" style={{ color: 'var(--text-primary)' }}>{evidence.surface_material}</p>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{evidence.mineral_class} · night-IR brightness proxy</p>
          </div>
        </section>

        {/* Science */}
        <section>
          <p className="section-heading mb-1">Science Priority</p>
          <div className="victor-panel p-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-mono font-bold" style={{ color: tierColor }}>
                {evidence.science_value.toFixed(4)}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                    style={{ background: withAlpha(tierColor, 15), color: tierColor }}>
                Tier {evidence.science_tier}
              </span>
            </div>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{tierLabel}</p>
            <p className="text-[10px] mt-1" style={{ color: 'var(--mode-demo)' }}>
              MODEL score — not a direct NASA measurement
            </p>
          </div>
        </section>

        {/* Hazard */}
        <section>
          <p className="section-heading mb-1">Hazard</p>
          <div className="victor-panel p-2">
            <div className="flex items-center gap-2">
              <div className="flex-1 rounded-full h-1.5" style={{ background: 'var(--surface-sunken)' }}>
                <div
                  className="h-1.5 rounded-full"
                  style={{
                    width: `${(evidence.hazard_score / 10) * 100}%`,
                    background: evidence.hazard_score < 3 ? 'var(--risk-low)' :
                               evidence.hazard_score < 6 ? 'var(--risk-moderate)' : 'var(--risk-extreme)',
                  }}
                />
              </div>
              <span className="text-xs font-mono" style={{ color: 'var(--text-primary)' }}>
                {evidence.hazard_score.toFixed(2)}/10
              </span>
            </div>
            <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
              10 × (0.7 × slope/25 + 0.3 × (1 − THEMIS thermal proxy))
            </p>
          </div>
        </section>

        {/* Analytical counterfactuals */}
        <section>
          <button
            className="flex items-center gap-1 w-full text-left"
            onClick={() => setShowCounterfactuals(!showCounterfactuals)}
            id="evidence-counterfactual-toggle"
          >
            {showCounterfactuals ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <p className="section-heading">Counterfactual Attribution</p>
          </button>
          {showCounterfactuals && (
            <div className="mt-2 space-y-1">
              {Object.entries(evidence.counterfactuals).map(([key, val]) => {
                const label = key.replace('cost_without_', '');
                const total = evidence.cost_breakdown.total_edge_cost || 1;
                const reductionPct = Math.max(0, ((total - val) / total) * 100);
                return (
                  <div key={key} className="flex items-center justify-between text-xs py-0.5">
                    <span className="capitalize" style={{ color: 'var(--text-secondary)' }}>{label}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{val.toFixed(4)}</span>
                      <span className="text-[10px] font-mono" style={{ color: 'var(--color-success)' }}>(-{reductionPct.toFixed(0)}%)</span>
                    </div>
                  </div>
                );
              })}
              <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                Analytical: cost_without_X = total − X contribution
              </p>
            </div>
          )}
        </section>

        {/* Data sources */}
        <section>
          <button
            className="flex items-center gap-1 w-full text-left"
            onClick={() => setShowSources(!showSources)}
            id="evidence-sources-toggle"
          >
            {showSources ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <p className="section-heading">Data Provenance ({evidence.data_sources.length} sources)</p>
          </button>
          {showSources && (
            <div className="mt-2 space-y-2">
              {evidence.data_sources.map((src) => (
                <div key={src.layer} className="victor-panel p-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium capitalize" style={{ color: 'var(--text-primary)' }}>{src.layer}</span>
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded font-medium"
                      style={{
                        background: withAlpha(confidenceColor(src.confidence), 15),
                        color: confidenceColor(src.confidence),
                      }}
                    >
                      {src.confidence}
                    </span>
                  </div>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>{src.instrument}</p>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {src.mission} · {typeof src.resolution_m === 'number' ? (src.resolution_m % 1 === 0 ? src.resolution_m : src.resolution_m.toFixed(1)) : src.resolution_m}m native res.
                  </p>
                  {src.label && (
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-warning)' }}>{src.label}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
