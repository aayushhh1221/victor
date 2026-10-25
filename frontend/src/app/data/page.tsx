'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Header from '@/components/common/Header';
import {
  Database, ExternalLink, Layers, ArrowRight, HardDrive, Info
} from 'lucide-react';

interface DataSource {
  id: string;
  name: string;
  mission: string;
  node: string;
  pdsId: string;
  resolution: string;
  bands: string;
  victorUse: string;
  status: string;
  coverage: string;
  details: string[];
  sourceUrl: string;
  localFile: string;
}

const SOURCES: DataSource[] = [
  {
    id: 'mola',
    name: 'Mars Orbiter Laser Altimeter (MOLA)',
    mission: 'Mars Global Surveyor (NASA / JPL)',
    node: 'PDS Geosciences Node',
    pdsId: 'MEGDR L3 (MEG128N000EB)',
    resolution: '200 m / px DEM (128 pixels/degree)',
    bands: '1064 nm Nd:YAG altimetry',
    victorUse: 'Topographic elevation model, slope calculations, and walking energy cost estimates.',
    status: 'Ingested locally as raster grid',
    coverage: '18.00°N–18.90°N, 77.00°E–78.00°E (300 × 300 matrix)',
    details: [
      'IAU2000 Mars Volumetric Mean Spheroid (R = 3,389,500 m)',
      'Vertical datum: Mars Areoid',
      'Step size: ~177 m latitude × 187 m longitude',
      'Elevation span in study area: approximately -2,642 m to -1,980 m'
    ],
    sourceUrl: 'https://pds-geosciences.wustl.edu/missions/mgs/mola.html',
    localFile: 'elevation_mola.npy',
  },
  {
    id: 'themis',
    name: 'Thermal Emission Imaging System (THEMIS)',
    mission: '2001 Mars Odyssey (NASA / ASU)',
    node: 'ASU Mars Space Flight Facility / PDS Geosciences',
    pdsId: 'THEMIS IR Nighttime Mosaic',
    resolution: '100 m / px IR mosaic',
    bands: 'Thermal Infrared (band 9 at 12.57 μm)',
    victorUse: 'Thermal inertia proxy used in hazard weighting for loose regolith vs bedrock surfaces.',
    status: 'Ingested locally as raster grid',
    coverage: '18.00°N–18.90°N, 77.00°E–78.00°E (300 × 300 matrix)',
    details: [
      'Nighttime IR values capture surface heat retention',
      'Higher thermal inertia indicates competent rock or consolidated material',
      'Lower thermal inertia indicates fine, unconsolidated dust or sand deposits',
      'Normalized to [0, 1] scale for hazard cost scoring'
    ],
    sourceUrl: 'https://themis.asu.edu/data',
    localFile: 'themis_thermal_inertia.npy',
  },
  {
    id: 'ctx',
    name: 'Context Camera (CTX) Mosaic',
    mission: 'Mars Reconnaissance Orbiter (NASA / MSSS)',
    node: 'Malin Space Science Systems / PDS Cartography Node',
    pdsId: 'CTX EDR Orthorectified Composite',
    resolution: '5.0 m / px visible mosaic',
    bands: 'Panchromatic visible (500–800 nm)',
    victorUse: 'Visual map layer for terrain features and crater morphology.',
    status: 'Rendered locally via tile service',
    coverage: 'Jezero Crater study area',
    details: [
      'Provides visible surface context for terrain features and crater rims',
      'Registered to Jezero geographic coordinates',
      'Used as an imagery overlay on Leaflet canvas'
    ],
    sourceUrl: 'https://pds-imaging.jpl.nasa.gov/volumes/mro.html',
    localFile: 'ctx_context_5m.npy',
  },
  {
    id: 'crism',
    name: 'Compact Reconnaissance Imaging Spectrometer for Mars (CRISM)',
    mission: 'Mars Reconnaissance Orbiter (NASA / JHU-APL)',
    node: 'PDS Geosciences Node',
    pdsId: 'CRISM MTRDR targeted observations',
    resolution: '181 m / px derived map',
    bands: 'Visible & Infrared (0.36–3.92 μm)',
    victorUse: 'Mineral indicator scoring for science opportunity route weighting.',
    status: 'Ingested locally as derived index',
    coverage: '18.00°N–18.90°N, 77.00°E–78.00°E',
    details: [
      'Targeted spectral observations identifying carbonates and clays',
      'Used by the science-weighted routing profile',
      'Values normalized to [0, 1] relative score across study grid'
    ],
    sourceUrl: 'https://crism.jhuapl.edu/data',
    localFile: 'science_crism.npy',
  },
  {
    id: 'meda',
    name: 'Mars Environmental Dynamics Analyzer (MEDA)',
    mission: 'Mars 2020 Perseverance Rover (NASA / CAB)',
    node: 'NASA PDS Atmospheres Node',
    pdsId: 'M2020 MEDA RDR Archive',
    resolution: 'In-situ ground station',
    bands: 'Atmospheric pressure, ambient temperature, dust optical depth',
    victorUse: 'Environmental context for Jezero Crater conditions.',
    status: 'Reference documentation (real-time stream not ingested)',
    coverage: 'Perseverance landing site context',
    details: [
      'Provides typical surface temperature and pressure bounds for Jezero Crater',
      'Real-time atmospheric ingestion is not active; values remain labelled unavailable in UI when not loaded from backend'
    ],
    sourceUrl: 'https://pds-atmospheres.nmsu.edu/data_and_services/atmospheres_data/PERSEVERANCE/meda.html',
    localFile: 'Not ingested as dynamic layer',
  },
];

export default function DataSourcesPage() {
  const [selectedId, setSelectedId] = useState<string>('mola');
  const activeSource = SOURCES.find((s) => s.id === selectedId) || SOURCES[0];

  return (
    <div
      className="min-h-screen flex flex-col font-sans"
      style={{
        background: 'var(--surface)',
        color: 'var(--text-primary)',
      }}
    >
      <Header activeTab="data" />

      {/* Page Header */}
      <section className="border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center border"
              style={{
                background: 'var(--accent-light)',
                borderColor: 'var(--accent-border)',
                color: 'var(--accent)',
              }}
            >
              <Database size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                Data and Methods
              </h1>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Mars datasets used for terrain analysis and candidate route evaluation in Jezero Crater.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span
              className="px-2.5 py-1 rounded border"
              style={{
                background: 'var(--surface-raised)',
                borderColor: 'var(--border)',
                color: 'var(--text-secondary)',
              }}
            >
              Datum: IAU2000 Mars Areoid
            </span>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8 flex flex-col lg:flex-row gap-8">
        {/* Left Column: Data Source Selector */}
        <aside className="lg:w-80 flex-shrink-0 space-y-3">
          <p className="section-heading px-1">
            Data Sources ({SOURCES.length})
          </p>
          <div className="space-y-2">
            {SOURCES.map((src) => {
              const isSelected = src.id === selectedId;
              return (
                <button
                  key={src.id}
                  onClick={() => setSelectedId(src.id)}
                  className="w-full text-left p-3.5 rounded-xl border transition-all flex flex-col gap-1.5"
                  style={{
                    background: isSelected ? 'var(--surface-raised)' : 'transparent',
                    borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded"
                      style={{
                        background: isSelected ? 'var(--accent-light)' : 'var(--surface-sunken)',
                        color: isSelected ? 'var(--accent)' : 'var(--text-muted)',
                      }}
                    >
                      {src.mission.split('(')[0].trim()}
                    </span>
                    <span className="text-[10px] font-mono font-semibold" style={{ color: 'var(--accent)' }}>
                      {src.resolution.split(' ')[0]}
                    </span>
                  </div>
                  <h3 className="text-xs font-bold leading-snug" style={{ color: 'var(--text-primary)' }}>
                    {src.name}
                  </h3>
                  <p className="text-[11px] line-clamp-1" style={{ color: 'var(--text-secondary)' }}>
                    {src.victorUse}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Grid Metadata Summary */}
          <div
            className="p-4 rounded-xl border mt-6 space-y-3"
            style={{
              background: 'var(--surface-raised)',
              borderColor: 'var(--border)',
            }}
          >
            <div className="flex items-center gap-2 text-xs font-bold uppercase" style={{ color: 'var(--text-primary)' }}>
              <Info size={14} style={{ color: 'var(--accent)' }} />
              <span>Local Analysis Bounds</span>
            </div>
            <div className="text-xs space-y-1.5 font-mono" style={{ color: 'var(--text-secondary)' }}>
              <div className="flex justify-between py-1 border-b" style={{ borderColor: 'var(--border)' }}>
                <span>Latitude:</span>
                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>18.00°N – 18.90°N</span>
              </div>
              <div className="flex justify-between py-1 border-b" style={{ borderColor: 'var(--border)' }}>
                <span>Longitude:</span>
                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>77.00°E – 78.00°E</span>
              </div>
              <div className="flex justify-between py-1 border-b" style={{ borderColor: 'var(--border)' }}>
                <span>Grid Dimension:</span>
                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>300 × 300 cells</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Cell Size:</span>
                <span className="font-bold" style={{ color: 'var(--accent)' }}>~177 m × 187 m</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Right Column: Source Details Card */}
        <section className="flex-1 min-w-0">
          <div
            className="p-6 sm:p-8 rounded-2xl border space-y-6"
            style={{
              background: 'var(--surface-raised)',
              borderColor: 'var(--border)',
            }}
          >
            {/* Header */}
            <div className="border-b pb-5 space-y-2" style={{ borderColor: 'var(--border)' }}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span
                  className="px-2.5 py-1 rounded text-xs font-mono font-bold uppercase border"
                  style={{
                    background: 'var(--accent-light)',
                    borderColor: 'var(--accent-border)',
                    color: 'var(--accent)',
                  }}
                >
                  {activeSource.mission}
                </span>
                <a
                  href={activeSource.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs hover:underline transition-colors"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <span>Source Archive</span>
                  <ExternalLink size={13} />
                </a>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                {activeSource.name}
              </h2>
              <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                Archive Node: {activeSource.node}
              </p>
            </div>

            {/* Quick Specs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div
                className="p-3.5 rounded-xl border"
                style={{ background: 'var(--surface-sunken)', borderColor: 'var(--border)' }}
              >
                <span className="text-[10px] font-mono uppercase block" style={{ color: 'var(--text-muted)' }}>
                  Spatial Resolution
                </span>
                <span className="text-xs font-bold font-mono mt-1 block" style={{ color: 'var(--accent)' }}>
                  {activeSource.resolution}
                </span>
              </div>
              <div
                className="p-3.5 rounded-xl border"
                style={{ background: 'var(--surface-sunken)', borderColor: 'var(--border)' }}
              >
                <span className="text-[10px] font-mono uppercase block" style={{ color: 'var(--text-muted)' }}>
                  Product Reference
                </span>
                <span className="text-xs font-mono mt-1 block truncate" title={activeSource.pdsId} style={{ color: 'var(--text-primary)' }}>
                  {activeSource.pdsId}
                </span>
              </div>
              <div
                className="p-3.5 rounded-xl border"
                style={{ background: 'var(--surface-sunken)', borderColor: 'var(--border)' }}
              >
                <span className="text-[10px] font-mono uppercase block" style={{ color: 'var(--text-muted)' }}>
                  Local Status
                </span>
                <span className="text-xs font-mono mt-1 block" style={{ color: 'var(--text-primary)' }}>
                  {activeSource.status}
                </span>
              </div>
            </div>

            {/* Role in VICTOR */}
            <div className="space-y-2">
              <h3 className="section-heading">Role in VICTOR</h3>
              <p
                className="text-xs leading-relaxed p-4 rounded-xl border"
                style={{
                  background: 'var(--surface-sunken)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-secondary)',
                }}
              >
                {activeSource.victorUse}
              </p>
            </div>

            {/* Technical Details */}
            <div className="space-y-2">
              <h3 className="section-heading flex items-center gap-2">
                <Layers size={13} style={{ color: 'var(--accent)' }} />
                <span>Technical Notes &amp; Grid Integration</span>
              </h3>
              <ul className="space-y-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                {activeSource.details.map((detail, idx) => (
                  <li
                    key={idx}
                    className="p-2.5 rounded-lg border leading-relaxed"
                    style={{
                      background: 'var(--surface-sunken)',
                      borderColor: 'var(--border)',
                    }}
                  >
                    {detail}
                  </li>
                ))}
              </ul>
            </div>

            {/* Navigation action */}
            <div className="pt-4 border-t flex flex-wrap items-center justify-between gap-4" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                <HardDrive size={15} />
                <span>Local asset: <code style={{ color: 'var(--text-primary)' }}>backend/data/{activeSource.localFile}</code></span>
              </div>
              <Link
                href="/planner"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm"
                style={{
                  background: 'var(--accent)',
                  color: 'var(--on-accent)',
                }}
              >
                <span>Open Mission Planner</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer Disclosure */}
      <footer className="border-t py-6 px-6 text-center text-xs mt-auto" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
        <p>VICTOR is an independent NASA Space Apps Challenge project. It is not an official NASA product or mission-operations tool.</p>
      </footer>
    </div>
  );
}
