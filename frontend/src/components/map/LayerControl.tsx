'use client';

import React from 'react';
import type { ActiveLayer } from '@/types';

interface LayerControlProps {
  layers: ActiveLayer[];
  onChange: (layers: ActiveLayer[]) => void;
}

const LAYER_META: Record<string, { label: string; type: string; color: string }> = {
  terrain: { label: 'Base Terrain (HiRISE)', type: 'DISPLAY_ONLY', color: '#8B6914' },
  elevation: { label: 'Elevation (MOLA)', type: 'VERIFIED_SNAPSHOT', color: '#4B9CD3' },
  hazard: { label: 'Hazard Zones', type: 'MODEL_DERIVED', color: '#EF4444' },
  science: { label: 'Science Priority (CRISM MODEL)', type: 'MODEL_DERIVED', color: '#22C55E' },
  perseverance_traverse: { label: 'Perseverance Traverse', type: 'REFERENCE', color: '#A855F7' },
};

const TYPE_BADGE: Record<string, string> = {
  DISPLAY_ONLY: 'bg-gray-600',
  VERIFIED_SNAPSHOT: 'bg-blue-700',
  MODEL_DERIVED: 'bg-amber-700',
  REFERENCE: 'bg-purple-700',
  CONTEXTUAL: 'bg-cyan-700',
};

export default function LayerControl({ layers, onChange }: LayerControlProps) {
  const toggle = (id: string) => {
    onChange(layers.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)));
  };
  const setOpacity = (id: string, opacity: number) => {
    onChange(layers.map((l) => (l.id === id ? { ...l, opacity } : l)));
  };

  return (
    <div className="p-3 space-y-3">
      <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Data Layers</p>
      {layers.map((layer) => {
        const meta = LAYER_META[layer.id];
        if (!meta) return null;
        return (
          <div key={layer.id} className="space-y-1.5">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id={`layer-${layer.id}`}
                checked={layer.visible}
                onChange={() => toggle(layer.id)}
                className="accent-blue-500 w-3.5 h-3.5 flex-shrink-0"
              />
              <label
                htmlFor={`layer-${layer.id}`}
                className="flex-1 text-xs text-gray-200 cursor-pointer leading-tight"
              >
                {meta.label}
              </label>
            </div>
            <div className="flex items-center gap-2 pl-5">
              <span
                className={`text-[9px] px-1.5 py-0.5 rounded font-medium text-white ${TYPE_BADGE[meta.type] ?? 'bg-gray-600'}`}
              >
                {meta.type.replace('_', ' ')}
              </span>
            </div>
            {layer.visible && (
              <div className="pl-5 flex items-center gap-2">
                <span className="text-[10px] text-gray-500">Opacity</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={layer.opacity}
                  onChange={(e) => setOpacity(layer.id, parseFloat(e.target.value))}
                  className="w-full h-1 accent-blue-500"
                  aria-label={`${meta.label} opacity`}
                />
                <span className="text-[10px] text-gray-400 w-8 text-right">
                  {Math.round(layer.opacity * 100)}%
                </span>
              </div>
            )}
          </div>
        );
      })}

      {/* MCS contextual info — always displayed, not a routing layer */}
      <div className="mt-3 pt-3 border-t border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded border border-cyan-600 bg-cyan-900/40 flex-shrink-0" />
          <span className="text-xs text-gray-400">Atmospheric Context (MCS)</span>
        </div>
        <p className="text-[10px] text-gray-600 mt-1 pl-5 leading-tight">
          CONTEXTUAL — regional/seasonal only. Not used in route hazard calculation.
        </p>
      </div>
    </div>
  );
}
