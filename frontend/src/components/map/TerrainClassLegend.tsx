'use client';

import React, { useEffect, useState } from 'react';
import type { TerrainClassesResponse } from '@/types';
import { terrainClassColor } from '@/types';
import { getTerrainClasses } from '@/services/api';
import { Brain, AlertTriangle, Info } from 'lucide-react';
import { withAlpha } from '@/utils/color';

/**
 * Legend for the `terrain_class` map layer.
 *
 * That layer renders as flat coloured regions, so without a key it is just
 * blobs. This panel names each k-means cluster, gives its share of the grid,
 * and — the part that matters most — states plainly that the classification is
 * ADVISORY: it does not enter the routing cost function. The A-star and Pareto
 * stages are unchanged by it, and saying so is what keeps the classical
 * optimiser defensible when an ML layer is on screen beside it.
 *
 * Everything shown comes from GET /api/v1/map/terrain-classes. The swatch
 * colours are the --terrain-class-N tokens, which mirror the tile renderer's
 * per-class palette in id order, so a swatch matches the map exactly.
 */

/**
 * Readable gloss for each clustering feature id. These are descriptions of the
 * identifiers, not data: the raw id stays available as the tooltip, and an id
 * with no gloss is shown verbatim rather than guessed at.
 */
const FEATURE_LABELS: Record<string, string> = {
  mola_slope_deg: 'MOLA slope (°)',
  mola_roughness_m: 'MOLA roughness (m)',
  themis_thermal_proxy: 'THEMIS thermal proxy (0–1)',
  crism_olivine_olindex3: 'CRISM olivine (OLINDEX3)',
  crism_carbonate_cindex2: 'CRISM carbonate (CINDEX2)',
};

const EM_DASH = '—';

/** Format a 0–1 share as a percentage, or — when the backend did not report it. */
function asPercent(value: number | null | undefined, digits = 1): string {
  return value == null || !Number.isFinite(value)
    ? EM_DASH
    : `${(value * 100).toFixed(digits)}%`;
}

/** One-line summary of a cluster centroid, for the row tooltip. */
function centroidSummary(centroid: Record<string, number> | null): string | undefined {
  if (!centroid) return undefined;
  const parts = Object.entries(centroid).map(
    ([key, value]) => `${FEATURE_LABELS[key] ?? key}: ${value}`,
  );
  return parts.length > 0 ? `Cluster centroid — ${parts.join(' · ')}` : undefined;
}

export default function TerrainClassLegend() {
  const [data, setData] = useState<TerrainClassesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getTerrainClasses()
      .then((res) => {
        if (cancelled) return;
        setData(res);
        setError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setData(null);
        setError(e instanceof Error ? e.message : 'Terrain class request failed');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Request failed: say so; never invent class names or shares ────────────
  if (error) {
    return (
      <div className="px-3 pb-3">
        <div
          className="flex items-start gap-2 p-2.5 rounded-lg"
          style={{
            background: 'var(--color-danger-bg)',
            border: '1px solid var(--color-danger-border)',
            color: 'var(--color-danger)',
          }}
        >
          <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[11px] font-semibold">Terrain class legend unavailable</p>
            <p className="text-[10px] mt-0.5 leading-relaxed font-mono opacity-80">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="px-3 pb-3 space-y-1.5">
        <div className="skeleton h-4 w-2/3 rounded" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="skeleton h-5 rounded" />
        ))}
      </div>
    );
  }

  // ── Classification not run: report the backend's own reason ───────────────
  if (!data.available) {
    return (
      <div className="px-3 pb-3">
        <div
          className="flex items-start gap-2 p-2.5 rounded-lg"
          style={{
            background: 'var(--mode-demo-bg)',
            border: '1px solid var(--mode-demo-border)',
            color: 'var(--mode-demo)',
          }}
        >
          <Info size={13} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[11px] font-semibold">No terrain classification</p>
            <p className="text-[10px] mt-0.5 leading-relaxed">
              {data.reason ?? 'The backend reported no classification output.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const classes = data.classes ?? [];
  const silhouette = data.silhouette_scores ?? null;
  const chosenK = data.k ?? null;

  return (
    <div className="px-3 pb-3">
      <div
        className="rounded-lg overflow-hidden"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        {/* Header */}
        <div
          className="flex items-start gap-2 px-2.5 py-2"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}
        >
          <div
            className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}
          >
            <Brain size={13} />
          </div>
          <div className="min-w-0">
            <p
              className="text-[11px] font-semibold leading-tight"
              style={{ color: 'var(--text-primary)' }}
            >
              Terrain Archetypes
            </p>
            <p className="text-[10px] leading-tight mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {data.method ?? 'classification method not reported'}
              {chosenK != null && ` · k = ${chosenK}`}
            </p>
          </div>
        </div>

        {/* Advisory notice — the single most important statement in this panel */}
        <div
          className="px-2.5 py-2 text-[10px] leading-relaxed"
          style={{
            background: 'var(--mode-demo-bg)',
            borderBottom: '1px solid var(--border-subtle)',
            color: 'var(--mode-demo)',
          }}
        >
          <span className="font-semibold">Advisory layer.</span>{' '}
          These classes do <span className="font-semibold">not</span> affect routing: route
          cost, traversability and ranking come solely from the multi-objective A* cost
          function, which this classification does not feed.
        </div>

        {/* Class rows */}
        <div className="px-2.5 py-2">
          {classes.length === 0 ? (
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              The backend reported no classes.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {classes.map((cls) => {
                const color = terrainClassColor(cls.id);
                const countNote =
                  cls.cell_count != null
                    ? `${cls.cell_count.toLocaleString()} grid cells`
                    : 'cell count not reported';
                const centroid = centroidSummary(cls.centroid);
                return (
                  <li
                    key={cls.id}
                    className="flex items-start gap-2"
                    title={centroid ? `${countNote}. ${centroid}` : countNote}
                  >
                    <span
                      aria-hidden
                      className="w-3.5 h-3.5 rounded-sm flex-shrink-0 mt-px"
                      style={{ background: color, border: '1px solid var(--border-strong)' }}
                    />
                    <span
                      className="text-[11px] leading-tight flex-1 min-w-0"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {cls.name}
                    </span>
                    <span
                      className="text-[10px] font-mono flex-shrink-0"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {asPercent(cls.fraction)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="text-[9px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
            Percentages are each class&apos;s share of classified grid cells.
            Names interpret the cluster centroids; they are not published
            geological unit assignments.
          </p>
        </div>

        {/* How k was chosen */}
        {(data.k_selection || silhouette) && (
          <div
            className="px-2.5 py-2"
            style={{ borderTop: '1px solid var(--border-subtle)' }}
          >
            <p className="section-heading mb-1">Cluster count</p>
            {data.k_selection && (
              <p className="text-[10px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                k = {chosenK ?? EM_DASH} chosen by {data.k_selection}.
              </p>
            )}
            {silhouette && Object.keys(silhouette).length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {Object.entries(silhouette)
                  .sort((a, b) => Number(a[0]) - Number(b[0]))
                  .map(([k, score]) => {
                    const isChosen = chosenK != null && Number(k) === chosenK;
                    return (
                      <span
                        key={k}
                        className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                        title={`Silhouette score for k = ${k}: ${score}`}
                        style={{
                          background: isChosen
                            ? withAlpha('var(--accent)', 12)
                            : 'var(--surface-sunken)',
                          color: isChosen ? 'var(--accent)' : 'var(--text-muted)',
                          border: `1px solid ${
                            isChosen ? withAlpha('var(--accent)', 30) : 'var(--border)'
                          }`,
                          fontWeight: isChosen ? 600 : 400,
                        }}
                      >
                        k{k} {Number.isFinite(score) ? score.toFixed(4) : EM_DASH}
                      </span>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* Features the clustering ran on */}
        {data.features && data.features.length > 0 && (
          <div
            className="px-2.5 py-2"
            style={{ borderTop: '1px solid var(--border-subtle)' }}
          >
            <p className="section-heading mb-1">Input features</p>
            <ul className="space-y-0.5">
              {data.features.map((feature) => (
                <li
                  key={feature}
                  className="text-[10px] leading-tight"
                  style={{ color: 'var(--text-secondary)' }}
                  title={feature}
                >
                  {FEATURE_LABELS[feature] ?? feature}
                </li>
              ))}
            </ul>
            {data.crism_gap_fraction != null && (
              <p className="text-[9px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
                CRISM coverage gaps: {asPercent(data.crism_gap_fraction, 0)} of cells.
              </p>
            )}
          </div>
        )}

        {/* Caveats, verbatim from the backend */}
        {data.caveats && data.caveats.length > 0 && (
          <div
            className="px-2.5 py-2"
            style={{
              borderTop: '1px solid var(--border-subtle)',
              background: 'var(--surface-raised)',
            }}
          >
            <p className="section-heading mb-1">Caveats</p>
            <ul className="space-y-1">
              {data.caveats.map((caveat, i) => (
                <li
                  key={i}
                  className="text-[10px] leading-relaxed flex gap-1.5"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <span aria-hidden>&middot;</span>
                  <span>{caveat}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
