'use client';

/**
 * Static/contextual views for sidebar and header tabs that don't
 * require dynamic data from the planning engine.
 */

import React, { useEffect, useState } from 'react';
import type { DataMode, EnvironmentResponse, HealthResponse } from '@/types';
import { getEnvironment } from '@/services/api';
import { BookOpen, Database, Cpu, Thermometer, Layers, Info, AlertTriangle } from 'lucide-react';
import { withAlpha } from '@/utils/color';
import dynamic from 'next/dynamic';

const GlobalMarsMap = dynamic(() => import('@/components/map/GlobalMarsMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center" style={{ background: '#050508' }}>
      <div className="text-center">
        <div className="skeleton w-16 h-16 rounded-full mx-auto mb-3" />
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading Mars Map…</p>
      </div>
    </div>
  ),
});

// ── Shared ───────────────────────────────────────────────────────────────

function ViewShell({
  icon,
  eyebrow,
  title,
  children,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex-1 overflow-y-auto p-6"
      style={{ background: 'var(--surface)', color: 'var(--text-primary)' }}
    >
      <div className="mb-6">
        <p className="section-heading mb-1">{eyebrow}</p>
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}
          >
            {icon}
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {title}
          </h1>
        </div>
      </div>
      {children}
    </div>
  );
}

function InfoBox({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl p-5 mb-4"
      style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)' }}
    >
      <p className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
        {title}
      </p>
      <div className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {children}
      </div>
    </div>
  );
}

// ── Methodology ──────────────────────────────────────────────────────────

export function MethodologyView() {
  return (
    <ViewShell icon={<BookOpen size={18} />} eyebrow="Scientific Approach" title="Methodology">
      <InfoBox title="Multi-Objective A* Pathfinding">
        <p>
          VICTOR uses a multi-objective variant of A* (weighted-sum scalarisation) to compute
          four distinct routes simultaneously. Each strategy applies a different weight vector
          across the four cost dimensions: <strong>distance</strong>, <strong>hazard</strong>,{' '}
          <strong>traversability</strong>, and <strong>negative science value</strong>.
        </p>
      </InfoBox>
      <InfoBox title="Pareto Non-Dominance">
        <p>
          After computing all four routes, VICTOR checks which are Pareto non-dominated —
          meaning no other route is strictly better on every objective. Routes marked{' '}
          <strong>★ Pareto Optimal</strong> represent genuinely different trade-offs;
          dominated routes are worse on at least one objective without any compensating gain.
        </p>
      </InfoBox>
      <InfoBox title="Per-Segment Cost Decomposition">
        <p>
          Every route segment&apos;s cost is broken down into contributions from its data
          sources: MOLA elevation (slope cost and traversability bands), THEMIS night-IR
          (thermal inertia proxy for loose vs rocky surface), and the derived science value
          MODEL. Clicking a segment reveals this decomposition and counterfactual analysis
          (how much cheaper without each layer).
        </p>
      </InfoBox>
      <InfoBox title="Science Value Model">
        <p>
          Science values are <strong>MODEL scores over published Jezero target locations</strong>,
          not direct observations. A tier-1 score marks a site associated with carbonate or
          phyllosilicate deposits — minerals that form in aqueous environments and are
          considered high-priority for biosignature research. These are not confirmed
          biosignature detections, and the score is not a measurement.
        </p>
      </InfoBox>
      <InfoBox title="Grid Resolution">
        <p>
          The routing grid covers Jezero Crater (18.0–18.9°N, 77.0–78.0°E) at 300×300 cells,
          approximately 177 m N-S × 187 m E-W per cell (~53×56 km total).
          MOLA resolution is 128 ppd (~463 m native), bi-linearly resampled to grid — so
          obstacles smaller than ~463 m are not represented. THEMIS night-IR is ~100 m native.
        </p>
      </InfoBox>
    </ViewShell>
  );
}

// ── About ────────────────────────────────────────────────────────────────

export function AboutView() {
  return (
    <ViewShell icon={<BookOpen size={18} />} eyebrow="Independent Project" title="About VICTOR">
      <InfoBox title="VICTOR">
        <p>
          <strong>VICTOR</strong> stands for <strong>Voyage Intelligence for Terrain-aware
          Cartographic Optimization &amp; Routing</strong>.
        </p>
      </InfoBox>
      <InfoBox title="Project Origin">
        <p>
          An independent project developed for the <strong>NASA Space Apps Challenge</strong> exploring
          terrain-aware route evaluation in Jezero Crater, Mars.
        </p>
      </InfoBox>
      <InfoBox title="What VICTOR does">
        <p className="mb-2">
          Given a start and destination in Jezero Crater, VICTOR computes four competing
          Marswalk routes:
        </p>
        <ul className="list-disc list-inside space-y-1 text-sm">
          <li><strong>Safest</strong> — minimises hazard and slope</li>
          <li><strong>Fastest</strong> — minimises distance and time</li>
          <li><strong>Science-Richest</strong> — maximises science value via high-tier mineral zones</li>
          <li><strong>Balanced</strong> — balances all objectives</li>
        </ul>
      </InfoBox>
      <InfoBox title="Data Honesty">
        <p>
          VICTOR is designed around one principle: <strong>never misrepresent data provenance</strong>.
          Every number displayed traces to a specific dataset or is labelled as a model
          estimate. Missing data is shown as <code>—</code>, not as a plausible-looking number.
        </p>
      </InfoBox>
      <InfoBox title="Data Sources">
        <ul className="list-disc list-inside space-y-1">
          <li><strong>MOLA</strong> (Mars Orbiter Laser Altimeter, Mars Global Surveyor) — elevation, slope, traversability</li>
          <li><strong>THEMIS</strong> (Thermal Emission Imaging System, 2001 Mars Odyssey) — night-IR thermal inertia proxy</li>
          <li><strong>CTX</strong> (Context Camera, Mars Reconnaissance Orbiter) — orbital base imagery, ~5 m/px</li>
          <li><strong>CRISM</strong> (Compact Reconnaissance Imaging Spectrometer for Mars, MRO) — olivine and carbonate mineralogy (181 m/px)</li>
          <li><strong>Mars 2020 / Perseverance</strong> — reference rover traverse and landing site context</li>
        </ul>
        <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          VICTOR is an independent NASA Space Apps Challenge project. It is not an official NASA product or mission-operations tool.
        </p>
      </InfoBox>
    </ViewShell>
  );
}

// ── Data Sources ─────────────────────────────────────────────────────────

/**
 * NASA instrument inventory. Status reflects what the ingest pipeline actually
 * produces; the layer panel in the planner is the live, authoritative view
 * (it reads availability straight from the backend).
 */
const DATA_SOURCES = [
  {
    instrument: 'MOLA',
    mission: 'Mars Global Surveyor',
    type: 'Elevation & Topography',
    resolution: '128 ppd (~463 m)',
    usage: 'Slope calculation, elevation profile, traversability bands, hazard model',
    confidence: 'HIGH',
  },
  {
    instrument: 'THEMIS',
    mission: '2001 Mars Odyssey',
    type: 'Night-IR Thermal Proxy',
    resolution: '~100 m',
    usage: 'Thermal inertia proxy — heat-retaining rock vs loose dust; 30% of the hazard composite',
    confidence: 'MODERATE',
  },
  {
    instrument: 'CTX',
    mission: 'Mars Reconnaissance Orbiter',
    type: 'Orbital Imagery',
    resolution: '~5 m/px',
    usage: 'Real orbital base imagery of Jezero. Display only — not used in routing',
    confidence: 'HIGH',
  },
  {
    instrument: 'CRISM',
    mission: 'Mars Reconnaissance Orbiter',
    type: 'Surface Composition & Mineralogy',
    resolution: '181 m/px (MRDR summary parameters)',
    usage: 'Spectral olivine (OLINDEX3) and carbonate (CINDEX2) indices; guides SCIENCE_RICHEST routing',
    confidence: 'HIGH',
  },
  {
    instrument: 'Mars 2020 / Perseverance',
    mission: 'Mars 2020',
    type: 'Reference Traverse & Science Targets',
    resolution: 'Point / polyline',
    usage: 'Reference rover path for orientation; published target locations behind the science MODEL',
    confidence: 'HIGH',
  },
  {
    instrument: 'MEDA & MCS',
    mission: 'Mars 2020 & MRO',
    type: 'Atmospheric & Surface Weather',
    resolution: 'In-situ diurnal observations (Jezero Crater)',
    usage: 'Ambient surface temperature, atmospheric pressure, and dust opacity (tau)',
    confidence: 'HIGH',
  },
];

const SOURCE_CONF_COLOR: Record<string, string> = {
  HIGH: 'var(--color-success)',
  MODERATE: 'var(--color-warning)',
  LOW: 'var(--color-danger)',
  PENDING: 'var(--text-muted)',
};

/**
 * The instrument cards on their own, with no page shell — so a view that
 * already provides a shell can embed them without nesting two scroll
 * containers and two <h1>s.
 */
export function DataSourceList() {
  return (
    <>
      <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
        Every routing decision traces to one of these data products.
        Sources marked PENDING are not yet ingested; any UI element depending on them shows <code>—</code>.
      </p>
      <div className="space-y-3">
        {DATA_SOURCES.map((src) => {
          const color = SOURCE_CONF_COLOR[src.confidence] ?? 'var(--text-muted)';
          return (
            <div
              key={src.instrument}
              className="rounded-xl p-4"
              style={{
                background: 'var(--surface-raised)',
                border: '1px solid var(--border)',
                opacity: src.confidence === 'PENDING' ? 0.7 : 1,
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                      {src.instrument}
                    </span>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                      style={{
                        background: withAlpha(color, 10),
                        color,
                        border: `1px solid ${withAlpha(color, 20)}`,
                      }}
                    >
                      {src.confidence}
                    </span>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {src.mission} · {src.type}
                  </p>
                </div>
                <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                  {src.resolution}
                </span>
              </div>
              <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
                {src.usage}
              </p>
            </div>
          );
        })}
      </div>
    </>
  );
}

export function DataSourcesView() {
  return (
    <ViewShell icon={<Database size={18} />} eyebrow="Data Provenance" title="Data Sources">
      <DataSourceList />
    </ViewShell>
  );
}

// ── Environmental ────────────────────────────────────────────────────────

const EM_DASH = '—';

/**
 * One environmental quantity.
 *
 * `value` null means the backend reported null — the data product behind the
 * field is not ingested. That renders as — with the backend's own `notes` as
 * the tooltip. There is deliberately no fallback constant: a plausible-looking
 * temperature here would be indistinguishable from a measurement.
 */
function EnvField({
  label,
  value,
  unit,
  scale,
  source,
  tooltip,
}: {
  label: string;
  value: number | null;
  unit?: string;
  /** What the number means, e.g. 'unitless 0–1 proxy'. Shown when present. */
  scale?: string;
  source: string | null;
  tooltip: string;
}) {
  const unavailable = value == null;
  return (
    <div
      className="flex items-start justify-between gap-4 py-2.5"
      style={{ borderBottom: '1px solid var(--border-subtle)' }}
      title={tooltip}
    >
      <div className="min-w-0">
        <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
          {label}
        </p>
        <p className="text-[10px] mt-0.5 leading-snug" style={{ color: 'var(--text-muted)' }}>
          {unavailable ? 'Not available — no ingested data for this quantity' : (source ?? 'Source not reported')}
        </p>
        {!unavailable && scale && (
          <p className="text-[10px] mt-0.5 leading-snug" style={{ color: 'var(--text-muted)' }}>
            {scale}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {unavailable && <Info size={11} style={{ color: 'var(--text-disabled)' }} />}
        <span
          className="metric-value"
          style={{ color: unavailable ? 'var(--text-muted)' : 'var(--text-primary)' }}
        >
          {unavailable ? EM_DASH : `${value}${unit ? ` ${unit}` : ''}`}
        </span>
      </div>
    </div>
  );
}

export function EnvironmentalView() {
  const [env, setEnv] = useState<EnvironmentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getEnvironment()
      .then((res) => {
        if (cancelled) return;
        setEnv(res);
        setError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setEnv(null);
        setError(e instanceof Error ? e.message : 'Environment request failed');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const notes = env?.notes?.trim() || '';
  const missingTooltip = notes || 'The backend reported this field as not available.';

  return (
    <ViewShell icon={<Thermometer size={18} />} eyebrow="Atmospheric & Surface Conditions" title="Environmental Data">
      {error && (
        <div
          className="flex items-start gap-3 p-4 rounded-xl mb-6"
          style={{
            background: 'var(--color-danger-bg)',
            border: '1px solid var(--color-danger-border)',
            color: 'var(--color-danger)',
          }}
        >
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold">Environmental data unavailable</p>
            <p className="text-xs mt-0.5 leading-relaxed">
              The backend could not be reached, so no conditions are shown. Nothing is
              estimated in its place.
            </p>
            <p className="text-[10px] mt-1 font-mono opacity-80">{error}</p>
          </div>
        </div>
      )}

      {!env && !error && (
        <div className="space-y-2 mb-6">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton h-12 rounded-lg" />
          ))}
        </div>
      )}

      {env && (
        <>
          <div
            className="rounded-xl p-5 mb-4"
            style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-start justify-between gap-3 mb-1">
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {env.region}
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Every value below is read from an ingested dataset or reported as
                  unavailable.
                </p>
              </div>
              <span
                className={`text-[10px] px-2 py-0.5 rounded font-semibold flex-shrink-0 ${
                  env.data_mode === 'DEMONSTRATION'
                    ? 'badge-demonstration'
                    : env.data_mode === 'LIVE'
                    ? 'badge-live'
                    : 'badge-verified'
                }`}
              >
                {env.data_mode === 'VERIFIED_SNAPSHOT' ? 'PDS BASELINE' : env.data_mode}
              </span>
            </div>

            <div className="mt-3">
              <EnvField
                label="Thermal inertia index (mean)"
                value={env.thermal_index_mean}
                scale="Unitless 0–1 proxy for thermal inertia — high means heat-retaining rock, low means loose dust or sand. This is NOT a temperature."
                source={env.thermal_index_source}
                tooltip={
                  env.thermal_index_mean != null
                    ? 'Grid mean of the THEMIS night-IR thermal proxy. A relative 0–1 index, not convertible to a temperature without the THEMIS emissivity and atmospheric correction chain.'
                    : missingTooltip
                }
              />
              <EnvField
                label="Surface temperature (day)"
                value={env.surface_temperature_day_c}
                unit="°C"
                source={env.temperature_source}
                tooltip={missingTooltip}
              />
              <EnvField
                label="Surface temperature (night)"
                value={env.surface_temperature_night_c}
                unit="°C"
                source={env.temperature_source}
                tooltip={missingTooltip}
              />
              <EnvField
                label="Dust opacity (τ)"
                value={env.dust_opacity_tau}
                source={env.dust_opacity_source}
                tooltip={missingTooltip}
              />
              <EnvField
                label="Atmospheric pressure"
                value={env.atmospheric_pressure_pa}
                unit="Pa"
                source={env.pressure_source}
                tooltip={missingTooltip}
              />
            </div>
          </div>

          {notes && (
            <div
              className="flex items-start gap-3 p-4 rounded-xl mb-4"
              style={{
                background: 'var(--surface-raised)',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
              }}
            >
              <Info size={16} className="flex-shrink-0 mt-0.5 text-blue-400" />
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Data Ingestion Notes
                </p>
                <p className="text-xs mt-1 leading-relaxed">{notes}</p>
              </div>
            </div>
          )}
        </>
      )}

      <InfoBox title="Known Jezero Crater Climate Context (qualitative)">
        <p>
          Jezero Crater lies at ~18°N latitude, roughly comparable to the northern tropics on
          Earth. Mars obliquity and thin CO₂ atmosphere produce extreme diurnal swings.
          Perihelion dust storms can significantly increase opacity and reduce solar panel output.
          This context is documented, not modelled — no specific numbers are displayed here.
        </p>
      </InfoBox>
    </ViewShell>
  );
}

// ── Mission Report ────────────────────────────────────────────────────────
// Moved to its own module: the view is now driven by the briefing and report
// endpoints, so it no longer belongs among the static views.
// See components/panels/MissionReportView.tsx.

// ── Mars Explorer ─────────────────────────────────────────────────────────

export function MarsExplorerView({ onNavigate }: { onNavigate: (_s: string) => void }) {
  return (
    <div className="flex-1 w-full h-full flex flex-col overflow-hidden">
      <GlobalMarsMap onSelectJezero={() => onNavigate('plan')} />
    </div>
  );
}

// ── Data & Layers tab ─────────────────────────────────────────────────────

export function DataLayersTabView({ onNavigate }: { onNavigate: (_s: string) => void }) {
  return (
    <ViewShell icon={<Layers size={18} />} eyebrow="Map Data" title="Data & Layers">
      <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
        Control map layer visibility and opacity from the Mission Planner.
        The layers panel is embedded in the right sidebar of the map view, and
        reports live which layers the backend can currently render.
      </p>
      <button
        onClick={() => onNavigate('plan')}
        className="px-5 py-2.5 rounded-lg font-semibold text-sm mb-6"
        style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
      >
        Open Map with Layer Controls →
      </button>
      {/* Instrument cards without their own ViewShell — this view already
          provides the page shell and heading. */}
      <p className="section-heading mb-3">Underlying Data Sources</p>
      <DataSourceList />
    </ViewShell>
  );
}

// ── System Status ─────────────────────────────────────────────────────────

interface SystemStatusViewProps {
  dataMode: DataMode | null;
  health: HealthResponse | null;
}

export function SystemStatusView({ dataMode: _dataMode, health }: SystemStatusViewProps) {
  return (
    <ViewShell icon={<Cpu size={18} />} eyebrow="Backend" title="System Status">
      <div className="space-y-4">
        <div
          className="rounded-xl p-4"
          style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)' }}
        >
          <p className="section-heading mb-3">Backend Health</p>
          <div className="space-y-2">
            {[
              { label: 'Connection', value: health ? '✓ Connected' : '✗ Offline', ok: !!health },
              { label: 'Data Mode', value: health?.data_mode ?? '—', ok: !!health },
              { label: 'Grid Loaded', value: health?.grid_loaded ? 'Yes' : 'No', ok: !!health?.grid_loaded },
              { label: 'Grid Shape', value: health?.grid_shape ? `${health.grid_shape[0]}×${health.grid_shape[1]}` : '—', ok: true },
              { label: 'Region', value: health?.region ?? '—', ok: !!health?.region },
            ].map(({ label, value, ok }) => (
              <div key={label} className="flex items-center justify-between text-xs">
                <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                <span className="font-mono font-medium" style={{ color: ok ? 'var(--text-primary)' : 'var(--color-danger)' }}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {health?.scientific_note && (
          <div
            className="p-4 rounded-xl"
            style={{
              background: 'var(--mode-demo-bg)',
              border: '1px solid var(--mode-demo-border)',
              color: 'var(--mode-demo)',
            }}
          >
            <p className="text-xs leading-relaxed">{health.scientific_note}</p>
          </div>
        )}
      </div>
    </ViewShell>
  );
}
