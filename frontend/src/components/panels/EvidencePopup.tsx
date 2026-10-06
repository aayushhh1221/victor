'use client';

import React, { useState } from 'react';
import type { SegmentEvidenceResponse } from '@/types';
import { X, ChevronDown, ChevronRight } from 'lucide-react';

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
  const tierColor = ['', '#22C55E', '#86EFAC', '#FCD34D', '#9CA3AF'][evidence.science_tier];

  const confColor: Record<string, string> = {
    HIGH: '#22C55E',
    MODERATE: '#F59E0B',
    LOW: '#EF4444',
  };

  return (
    <div
      className="absolute bottom-4 right-4 w-80 rounded-lg shadow-2xl overflow-hidden z-50"
      style={{ background: '#0D1F33', border: '1px solid rgba(255,255,255,0.12)' }}
      id="evidence-popup"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b"
        style={{ borderColor: 'rgba(255,255,255,0.08)', background: '#0B1929' }}
      >
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: strategyColor }} />
          <span className="text-xs font-semibold text-gray-200">{strategyName} — Segment {evidence.segment_id}</span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-300 transition-colors"
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
              <div key={label} className="pathwise-panel px-2 py-1.5">
                <p className="metric-label">{label}</p>
                <p className="metric-value text-sm">{value}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Surface material */}
        <section>
          <p className="section-heading mb-1">Surface Material</p>
          <div className="pathwise-panel p-2">
            <p className="text-xs text-gray-200">{evidence.surface_material}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">{evidence.mineral_class}</p>
          </div>
        </section>

        {/* Science */}
        <section>
          <p className="section-heading mb-1">Science Priority</p>
          <div className="pathwise-panel p-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-mono font-bold" style={{ color: tierColor }}>
                {evidence.science_value.toFixed(4)}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                    style={{ background: `${tierColor}25`, color: tierColor }}>
                Tier {evidence.science_tier}
              </span>
            </div>
            <p className="text-[10px] text-gray-500 mt-0.5">{tierLabel}</p>
            <p className="text-[10px] text-amber-600 mt-1">
              MODEL score — not a direct NASA measurement
            </p>
          </div>
        </section>

        {/* Hazard */}
        <section>
          <p className="section-heading mb-1">Hazard</p>
          <div className="pathwise-panel p-2">
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-800 rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full"
                  style={{
                    width: `${(evidence.hazard_score / 10) * 100}%`,
                    background: evidence.hazard_score < 3 ? '#22C55E' :
                               evidence.hazard_score < 6 ? '#F59E0B' : '#EF4444',
                  }}
                />
              </div>
              <span className="text-xs font-mono text-gray-300">
                {evidence.hazard_score.toFixed(2)}/10
              </span>
            </div>
            <p className="text-[10px] text-gray-600 mt-1">
              0.5×slope + 0.3×rock + 0.2×surface_dust_risk (THEMIS TI)
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
                    <span className="text-gray-400 capitalize">{label}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-gray-300">{val.toFixed(4)}</span>
                      <span className="text-[10px] text-emerald-400 font-mono">(-{reductionPct.toFixed(0)}%)</span>
                    </div>
                  </div>
                );
              })}
              <p className="text-[10px] text-gray-600 mt-1">
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
                <div key={src.layer} className="pathwise-panel p-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-300 font-medium capitalize">{src.layer}</span>
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded font-medium"
                      style={{
                        background: `${confColor[src.confidence] ?? '#888'}25`,
                        color: confColor[src.confidence] ?? '#888',
                      }}
                    >
                      {src.confidence}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-0.5">{src.instrument}</p>
                  <p className="text-[10px] text-gray-600">{src.mission} · {src.resolution_m}m res.</p>
                  {src.label && (
                    <p className="text-[10px] text-amber-600 mt-0.5">{src.label}</p>
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
