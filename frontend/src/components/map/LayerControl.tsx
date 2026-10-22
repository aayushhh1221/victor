'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { ActiveLayer, MapLayer } from '@/types';
import { getMapLayers } from '@/services/api';
import { Info, AlertTriangle } from 'lucide-react';
import { withAlpha } from '@/utils/color';

/**
 * Map layer panel.
 *
 * Driven ENTIRELY by GET /api/v1/map/layers. The backend computes `available`
 * from the grids it actually ingested and the tiles it actually rendered, so it
 * is authoritative: this component never overrides it, and keeps no parallel
 * hardcoded layer list. If the request fails we show an error instead of a
 * plausible-looking list of layers whose toggles would do nothing.
 */

interface LayerControlProps {
  layers: ActiveLayer[];
  onChange: (_layers: ActiveLayer[]) => void;
}

/** Swatch colour per layer id. Unknown ids fall back to the accent token. */
const LAYER_SWATCH: Record<string, string> = {
  imagery: 'var(--layer-imagery)',
  terrain: 'var(--layer-terrain)',
  elevation: 'var(--layer-elevation)',
  thermal: 'var(--layer-thermal)',
  hazard: 'var(--layer-hazard)',
  science: 'var(--layer-science)',
  composition: 'var(--layer-composition)',
  dust_activity: 'var(--layer-dust)',
  perseverance_traverse: 'var(--layer-traverse)',
};

const swatchFor = (id: string) => LAYER_SWATCH[id] ?? 'var(--accent)';

/** Provenance classification → semantic colour token. */
const CLASSIFICATION_COLOR: Record<string, string> = {
  MEASURED: 'var(--color-success)',
  DERIVED: 'var(--color-info)',
  MODELLED: 'var(--color-warning)',
};

/**
 * Basemaps, in preference order. Exactly one is enabled on first load so the
 * map is never blank — whichever the backend reports as renderable.
 */
const BASEMAP_PREFERENCE = ['imagery', 'terrain'];

export default function LayerControl({ layers, onChange }: LayerControlProps) {
  // null = pending, [] = empty response, MapLayer[] = loaded
  const [apiLayers, setApiLayers] = useState<MapLayer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const seededRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    getMapLayers()
      .then((data) => {
        if (cancelled) return;
        setApiLayers(data.layers ?? []);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        // Do NOT substitute a hardcoded layer list. The user must know the
        // backend is unreachable rather than operating controls that do nothing.
        setApiLayers(null);
        setError(
          err?.message
            ? `Could not reach the backend: ${err.message}`
            : 'Could not reach the backend. Layer availability is unknown.',
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Reconcile local layer state with what the backend says is renderable:
   * force-off anything unavailable, adopt the backend's default opacity for
   * layers we have not customised, and enable one basemap on first load.
   */
  useEffect(() => {
    if (!apiLayers || apiLayers.length === 0) return;

    const byId = new Map(apiLayers.map((l) => [l.id, l]));
    let next: ActiveLayer[] = apiLayers.map((meta) => {
      const existing = layers.find((l) => l.id === meta.id);
      return {
        id: meta.id,
        visible: meta.available && (existing?.visible ?? false),
        opacity: existing?.opacity ?? meta.default_opacity,
      };
    });

    if (!seededRef.current) {
      seededRef.current = true;
      const anyBasemapOn = next.some(
        (l) => BASEMAP_PREFERENCE.includes(l.id) && l.visible,
      );
      if (!anyBasemapOn) {
        const basemap = BASEMAP_PREFERENCE.find((id) => byId.get(id)?.available);
        if (basemap) {
          next = next.map((l) => (l.id === basemap ? { ...l, visible: true } : l));
        }
      }
    }

    const changed =
      next.length !== layers.length ||
      next.some((l, i) =>
        layers[i]?.id !== l.id ||
        layers[i]?.visible !== l.visible ||
        layers[i]?.opacity !== l.opacity,
      );
    if (changed) onChange(next);
    // `layers`/`onChange` are intentionally omitted: this runs on layer-list
    // arrival, and re-running on every local toggle would fight the user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiLayers]);

  const stateFor = (meta: MapLayer): ActiveLayer =>
    layers.find((l) => l.id === meta.id) ?? {
      id: meta.id,
      visible: false,
      opacity: meta.default_opacity,
    };

  const toggle = (meta: MapLayer) => {
    if (!meta.available) return;
    const existing = layers.find((l) => l.id === meta.id);
    if (existing) {
      onChange(layers.map((l) => (l.id === meta.id ? { ...l, visible: !l.visible } : l)));
    } else {
      onChange([...layers, { id: meta.id, visible: true, opacity: meta.default_opacity }]);
    }
  };

  const setOpacity = (meta: MapLayer, opacity: number) => {
    const existing = layers.find((l) => l.id === meta.id);
    if (existing) {
      onChange(layers.map((l) => (l.id === meta.id ? { ...l, opacity } : l)));
    } else {
      onChange([...layers, { id: meta.id, visible: true, opacity }]);
    }
  };

  // ── Error: never substitute a hardcoded layer list ────────────────────────
  if (error) {
    return (
      <div className="p-3">
        <div
          className="flex items-start gap-2 p-3 rounded-lg"
          style={{
            background: 'var(--color-danger-bg)',
            border: '1px solid var(--color-danger-border)',
            color: 'var(--color-danger)',
          }}
        >
          <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold">Layer list unavailable</p>
            <p className="text-[10px] mt-1 leading-relaxed">
              The backend could not be reached, so which layers exist is unknown.
              No layer controls are shown rather than offering toggles that may
              do nothing.
            </p>
            <p className="text-[10px] mt-1 font-mono opacity-80">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (!apiLayers) {
    return (
      <div className="p-3 space-y-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="skeleton h-8 rounded" />
        ))}
      </div>
    );
  }

  if (apiLayers.length === 0) {
    return (
      <p className="p-3 text-[10px]" style={{ color: 'var(--text-muted)' }}>
        The backend reported no map layers.
      </p>
    );
  }

  return (
    <div className="p-3 space-y-1">
      {apiLayers.map((meta) => {
        const { available } = meta;
        const swatch = swatchFor(meta.id);
        const layerState = stateFor(meta);
        const isChecked = available && layerState.visible;
        const reason = meta.unavailable_reason ?? 'Not available';
        const classificationColor = meta.classification
          ? CLASSIFICATION_COLOR[meta.classification] ?? 'var(--text-muted)'
          : null;

        return (
          <div
            key={meta.id}
            className="py-2 px-1 rounded"
            style={{ opacity: available ? 1 : 0.55 }}
          >
            <div className="flex items-start gap-2">
              {/* Checkbox / disabled marker + colour swatch */}
              <div className="flex items-center gap-1.5 mt-0.5 flex-shrink-0">
                <input
                  type="checkbox"
                  id={`layer-${meta.id}`}
                  checked={isChecked}
                  disabled={!available}
                  onChange={() => toggle(meta)}
                  className="w-3.5 h-3.5 flex-shrink-0 disabled:cursor-not-allowed"
                  style={{ accentColor: swatch }}
                  title={available ? undefined : reason}
                  aria-describedby={available ? undefined : `layer-${meta.id}-reason`}
                />
                <div
                  className={`w-6 h-4 rounded-sm flex-shrink-0 ${available ? 'opacity-100' : 'opacity-40'}`}
                  style={{ background: swatch, border: '1px solid var(--border)' }}
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-1">
                  <label
                    htmlFor={`layer-${meta.id}`}
                    className={`text-xs font-medium leading-tight ${available ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                    style={{ color: available ? 'var(--text-primary)' : 'var(--text-disabled)' }}
                    title={available ? meta.description : reason}
                  >
                    {meta.name}
                  </label>
                  {available && isChecked && (
                    <span
                      className="text-[10px] font-mono flex-shrink-0"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {Math.round(layerState.opacity * 100)}%
                    </span>
                  )}
                  {!available && (
                    <span title={reason} className="flex-shrink-0">
                      <Info size={11} style={{ color: 'var(--text-disabled)' }} />
                    </span>
                  )}
                </div>

                {/* Provenance: source + classification, straight from the API */}
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  {classificationColor && (
                    <span
                      className="text-[9px] px-1 py-px rounded font-semibold tracking-wide"
                      style={{
                        background: withAlpha(classificationColor, 14),
                        color: classificationColor,
                        border: `1px solid ${withAlpha(classificationColor, 30)}`,
                      }}
                    >
                      {meta.classification}
                    </span>
                  )}
                  <span className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
                    {meta.source}
                  </span>
                </div>

                <p
                  id={available ? undefined : `layer-${meta.id}-reason`}
                  className="text-[10px] leading-tight mt-0.5"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {available ? meta.description : reason}
                </p>
              </div>
            </div>

            {/* Opacity slider — only for a visible, available layer */}
            {available && isChecked && (
              <div className="pl-[38px] mt-2 flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={layerState.opacity}
                  onChange={(e) => setOpacity(meta, parseFloat(e.target.value))}
                  className="layer-slider flex-1"
                  aria-label={`${meta.name} opacity`}
                  style={{ accentColor: swatch }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
