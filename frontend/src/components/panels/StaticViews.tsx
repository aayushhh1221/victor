'use client';

/**
 * Static/contextual views for sidebar and header tabs that don't
 * require dynamic data from the planning engine.
 */

import React from 'react';
import type { DataMode, HealthResponse } from '@/types';
import { BookOpen, Database, Cpu, Thermometer, FileText, Map, Layers } from 'lucide-react';
import { withAlpha } from '@/utils/color';

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
    <ViewShell icon={<BookOpen size={18} />} eyebrow="NASA Space Apps Challenge 2026" title="About VICTOR">
      <InfoBox title="VICTOR">
        <p>
          <strong>VICTOR</strong> stands for <strong>Voyage Intelligence for Terrain-aware
          Cartographic Optimization &amp; Routing</strong>.
        </p>
      </InfoBox>
      <InfoBox title="Challenge">
        <p>
          This project is an entry for the <strong>NASA Space Apps Challenge 2026</strong>,
          challenge category: <em>Interplanetary Survival Guide: Martian Map</em>.
          Hackathon: 14–15 November 2026.
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
          Every number displayed traces to a specific NASA instrument or is labelled as a model
          estimate. Missing data is shown as <code>—</code>, not as a plausible-looking number.
        </p>
      </InfoBox>
      <InfoBox title="Data Sources">
        <ul className="list-disc list-inside space-y-1">
          <li><strong>MOLA</strong> (Mars Orbiter Laser Altimeter, Mars Global Surveyor) — elevation, slope, traversability</li>
          <li><strong>THEMIS</strong> (Thermal Emission Imaging System, 2001 Mars Odyssey) — night-IR thermal inertia proxy</li>
          <li><strong>CTX</strong> (Context Camera, Mars Reconnaissance Orbiter) — orbital base imagery, ~5 m/px</li>
          <li><strong>Mars 2020 / Perseverance</strong> — reference traverse and published science targets</li>
        </ul>
        <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          CRISM composition and MCS atmospheric products are not yet ingested; see Data Sources.
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
    type: 'Elevation',
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
    instrument: 'Mars 2020 / Perseverance',
    mission: 'Mars 2020',
    type: 'Reference Traverse & Science Targets',
    resolution: 'Point / polyline',
    usage: 'Reference rover path for orientation; published target locations behind the science MODEL',
    confidence: 'MODERATE',
  },
  {
    instrument: 'CRISM',
    mission: 'Mars Reconnaissance Orbiter',
    type: 'Surface Composition',
    resolution: '15–200 m (variable)',
    usage: 'Not yet ingested — pending integration',
    confidence: 'PENDING',
  },
  {
    instrument: 'MCS',
    mission: 'Mars Reconnaissance Orbiter',
    type: 'Atmospheric Dust',
    resolution: 'Regional / seasonal',
    usage: 'Not yet ingested — pending integration',
    confidence: 'PENDING',
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
        Every routing decision traces to one of these NASA instrument data products.
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

export function EnvironmentalView() {
  return (
    <ViewShell icon={<Thermometer size={18} />} eyebrow="Atmospheric & Surface Conditions" title="Environmental Data">
      <div
        className="flex items-center gap-3 p-4 rounded-xl mb-6"
        style={{
          background: 'var(--mode-demo-bg)',
          border: '1px solid var(--mode-demo-border)',
          color: 'var(--mode-demo)',
        }}
      >
        <Thermometer size={16} className="flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold">Environmental data not yet ingested</p>
          <p className="text-xs mt-0.5">
            MCS atmospheric profiles and daily temperature curves are on the backend roadmap.
            See <code>frontend/BACKEND_REQUESTS.md</code> for the endpoint spec.
          </p>
        </div>
      </div>

      <InfoBox title="What will appear here">
        <ul className="list-disc list-inside space-y-1 text-sm">
          <li>Surface temperature range (THEMIS-derived, daytime / nighttime)</li>
          <li>Dust opacity index (MCS seasonal climatology)</li>
          <li>Wind speed estimate (GCM model output)</li>
          <li>UV exposure index</li>
          <li>Atmospheric pressure</li>
        </ul>
        <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          All values will be labelled with their data source and uncertainty.
          No fabricated environmental data will ever appear in this panel.
        </p>
      </InfoBox>

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

interface MissionReportViewProps {
  hasRoute: boolean;
  routeSummary?: string;
}

export function MissionReportView({ hasRoute, routeSummary }: MissionReportViewProps) {
  return (
    <ViewShell icon={<FileText size={18} />} eyebrow="Post-Mission" title="Mission Report">
      {!hasRoute ? (
        <div
          className="p-5 rounded-xl"
          style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)' }}
        >
          <p className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
            Report generated after route computation
          </p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Plan a Marswalk to generate a mission report. The report will include selected route
            metrics, science opportunities accessed, provenance records for all data used, and
            risk factors encountered along the route.
          </p>
        </div>
      ) : (
        <div>
          <InfoBox title="Trade-off Summary">
            <p>{routeSummary ?? 'Route computed. Summary available after strategy selection.'}</p>
          </InfoBox>
          <InfoBox title="Data Provenance">
            <p>
              All route costs derive from MOLA elevation (slope and traversability bands), the
              THEMIS night-IR thermal inertia proxy, and the science value MODEL over published
              Jezero targets. Data is pre-downloaded from PDS — no live satellite queries are
              made during planning.
            </p>
          </InfoBox>
        </div>
      )}
    </ViewShell>
  );
}

// ── Mars Explorer ─────────────────────────────────────────────────────────

export function MarsExplorerView({ onNavigate }: { onNavigate: (s: string) => void }) {
  return (
    <ViewShell icon={<Map size={18} />} eyebrow="Exploration" title="Mars Explorer">
      <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
        The interactive map is the primary exploration interface. Use it to explore Jezero Crater
        terrain, place start/destination markers, and visualise route options.
      </p>
      <button
        onClick={() => onNavigate('plan')}
        className="px-5 py-2.5 rounded-lg font-semibold text-sm mb-6"
        style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
      >
        Open Mission Planner with Map →
      </button>
      <InfoBox title="Available Layers">
        <ul className="list-disc list-inside space-y-1">
          <li>Base Imagery (CTX, MRO) — real orbital imagery, ~5 m/px</li>
          <li>Shaded Relief — colourmapped MOLA elevation (derived, not imagery)</li>
          <li>Elevation (MOLA) — colour-graded altitude</li>
          <li>Thermal Inertia Proxy (THEMIS) — night-IR surface material proxy</li>
          <li>Hazard Zones — model-derived risk overlay, 0–10</li>
          <li>Science Priority (MODEL) — published target value zones</li>
          <li>Perseverance Traverse — historical rover path reference</li>
        </ul>
        <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          The layer panel reports which of these the backend can currently render;
          the rest appear disabled with the reason.
        </p>
      </InfoBox>
      <InfoBox title="Coordinate System">
        <p>IAU2000 planetocentric coordinates, east-positive longitude. All coordinates displayed
        as decimal degrees, WGS-84 analogue for Leaflet rendering via a linear projection
        within the bounded study region.</p>
      </InfoBox>
    </ViewShell>
  );
}

// ── Data & Layers tab ─────────────────────────────────────────────────────

export function DataLayersTabView({ onNavigate }: { onNavigate: (s: string) => void }) {
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
