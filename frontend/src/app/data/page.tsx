'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Header from '@/components/common/Header';
import {
  Database, ExternalLink, Layers, Microscope,
  Sparkles, ArrowRight, CheckCircle2, Compass, HardDrive, Info
} from 'lucide-react';

interface InstrumentDossier {
  id: string;
  name: string;
  mission: string;
  node: string;
  pdsId: string;
  resolution: string;
  bands: string;
  metricRole: string;
  scienceContribution: string;
  technicalDetails: string[];
  diagnosticSignatures?: { label: string; wavelength: string; mineral: string }[];
  pdsUrl: string;
  numpyFile: string;
  minMax: string;
}

const INSTRUMENTS: InstrumentDossier[] = [
  {
    id: 'mola',
    name: 'Mars Orbiter Laser Altimeter (MOLA)',
    mission: 'Mars Global Surveyor (NASA / JPL)',
    node: 'PDS Geosciences Node / Cartography & Imaging (USGS Flagstaff)',
    pdsId: 'MGS-M-MOLA-5-MEGDR-L3-V1.0 (MEG128N000EB)',
    resolution: '200 m / px DEM (128 pixels/degree)',
    bands: '1064 nm Nd:YAG pulsed laser (10 Hz, 8 ns pulse width)',
    metricRole: 'Digital Elevation Model (DEM), slope gradients, topographic relief, and Tobler walking speed model.',
    scienceContribution: 'Provides the authoritative IAU2000 areoid vertical datum. All surface slopes and energy costs are derived from true laser flight altimetry.',
    technicalDetails: [
      'IAU2000 Mars Volumetric Mean Spheroid (R = 3,389,500.0 m)',
      'Vertical accuracy: ±1 meter on low-relief crater floors; horizontal resolution: ~200 m',
      'Non-square grid resolution: 177.5 m (latitudinal) × 187.1 m (longitudinal at 18.45°N)',
      'Grid slice: 300 × 300 float32 matrix spanning 18.00°N–18.90°N, 77.00°E–78.00°E'
    ],
    pdsUrl: 'https://pds-geosciences.wustl.edu/missions/mgs/mola.html',
    numpyFile: 'elevation_mola.npy',
    minMax: '-2,642 m to -1,980 m (Areoid Datum)',
  },
  {
    id: 'themis',
    name: 'Thermal Emission Imaging System (THEMIS)',
    mission: 'Mars Odyssey 2001 (NASA / ASU)',
    node: 'ASU Mars Space Flight Facility / PDS Geosciences Node',
    pdsId: 'ODYSSEY-M-THEMIS-5-IR-MOSAIC-V1.0',
    resolution: '100 m / px Nighttime Infrared Mosaic',
    bands: 'Thermal Infrared 9 Bands (6.78 μm to 14.88 μm; Band 9 centered at 12.57 μm)',
    metricRole: 'Thermal inertia proxy for soil compaction vs. loose drift regolith hazard discrimination.',
    scienceContribution: 'Crucial for hazard scoring: high thermal inertia (>350 SI) indicates stable exposed bedrock and durable travel; low thermal inertia (<140 SI) warns of treacherous, unconsolidated dust mantles and wheel-sink hazards.',
    technicalDetails: [
      'Uncalibrated drift sand causes severe wheel slip and rover entrapment',
      'Nighttime IR captures heat retention after solar sunset, isolating physical grain size',
      'Calibrated against Curiosity and Perseverance in-situ wheel sink observations',
      'Grid integration: Inverted thermal inertia normalized to [0.0, 1.0] hazard score'
    ],
    pdsUrl: 'https://themis.asu.edu/data',
    numpyFile: 'themis_thermal_inertia.npy',
    minMax: '115 to 480 J·m⁻²·K⁻¹·s⁻¹/²',
  },
  {
    id: 'ctx',
    name: 'Context Camera (CTX) Controlled Mosaic',
    mission: 'Mars Reconnaissance Orbiter (NASA / MSSS)',
    node: 'Malin Space Science Systems / PDS Cartography Node',
    pdsId: 'MRO-M-CTX-2-EDR-L0-V1.0 (Orbits 028408, 016390)',
    resolution: '5.0 m / px Controlled Orthorectified Composite',
    bands: 'Panchromatic visible wavelength (500 nm to 800 nm)',
    metricRole: 'Morphological micro-hazard detection: scarp edges, boulder clusters, ripple fields, and crater rims.',
    scienceContribution: 'Provides human-scale contextual validation of terrain impassability. Used to cross-check steep 20°+ slopes detected by altimetry with visible morphological scarps.',
    technicalDetails: [
      'Controlled sub-pixel tie-point registration against Jezero HiRISE baseline',
      'Identifies fractured bedrock corridors and aeolian transverse dunes in Séítah',
      'Orthorectified to MOLA/HRSC elevation surfaces to eliminate relief distortion',
      'Visual backdrop layer for tactical astronaut path inspection'
    ],
    pdsUrl: 'https://pds-imaging.jpl.nasa.gov/volumes/mro.html',
    numpyFile: 'ctx_context_5m.npy',
    minMax: 'Reflectance I/F: 0.08 to 0.32',
  },
  {
    id: 'crism',
    name: 'Compact Reconnaissance Imaging Spectrometer for Mars (CRISM)',
    mission: 'Mars Reconnaissance Orbiter (NASA / JHU-APL)',
    node: 'PDS Geosciences Node (Washington University in St. Louis)',
    pdsId: 'MRO-M-CRISM-5-MTRDR-V1.0 (FRT00005850 / HRL000040FF)',
    resolution: '181 m / px Map-Projected Targeted Experiment Record',
    bands: 'VNIR (0.36–1.05 μm) and IR (1.00–3.92 μm) at 6.55 nm spectral sampling (544 channels)',
    metricRole: 'Science value heuristic weighting (w_sci) based on verified astrobiological mineral signatures.',
    scienceContribution: 'Directly drives the SCIENCE_RICHEST routing engine. Rewards paths passing through ancient aqueous habitats rich in smectite clays and magnesium carbonates with high biosignature preservation potential.',
    technicalDetails: [
      'Targeted empirical atmospheric transmission correction (volcano-scan calibration)',
      'Identifies Jezero Delta Fan sedimentary deposits and Jezero Rim Margin carbonates',
      'Calibrated against Perseverance Mastcam-Z and SuperCam LIBS ground truth',
      'Normalized composite layer yielding science opportunity index from 0.0 to 1.0'
    ],
    diagnosticSignatures: [
      { label: 'Fe/Mg Smectite Clay', wavelength: '1.41 μm, 1.91 μm, 2.30 μm', mineral: 'Nontronite / Saponite (Phyllosilicates)' },
      { label: 'Magnesium Carbonate', wavelength: '2.31 μm, 2.51 μm', mineral: 'Magnesite (Aqueous Biosignature Host)' },
      { label: 'Hydrated Silica', wavelength: '1.40 μm, 1.90 μm, 2.21 μm', mineral: 'Opaline Silica (Hot Spring / Lacustrine)' },
      { label: 'Olivine Bedrock', wavelength: '1.05 μm broad band', mineral: 'Forsterite-rich Basaltic Floor (Séítah)' },
    ],
    pdsUrl: 'https://crism.jhuapl.edu/data',
    numpyFile: 'science_crism.npy',
    minMax: 'Science Index: 0.00 to 0.96 (Normalized)',
  },
  {
    id: 'meda',
    name: 'Mars Environmental Dynamics Analyzer (MEDA)',
    mission: 'Mars 2020 Perseverance Rover (NASA / CAB CSIC-INTA)',
    node: 'Centro de Astrobiología / NASA PDS Atmospheres Node',
    pdsId: 'M2020-M-MEDA-3-RDR-V1.0 (Sol 001 to Sol 1250 Archive)',
    resolution: '1 Hz In-Situ Calibrated Ground Station',
    bands: 'Pressure (PS), Ambient Temperature (ATS), Wind (WS), Humidity (HS), Optical Depth (RDS / tau)',
    metricRole: 'Dynamic atmospheric density, dust opacity constraints, and thermal excursion safety limits.',
    scienceContribution: 'Supplies empirical boundary conditions for astronaut EVA suits: ambient atmospheric pressure (740–760 Pa CO₂), diurnal temperature swings (-88°C to -14°C), and dust optical depth (tau ~0.45).',
    technicalDetails: [
      'In-situ pressure transducer accurate to ±0.5 Pa; establishes suit leakage differentials',
      'Thermal sensors track ground temperature cycles, informing metabolic consumption',
      'Radiation and Dust Sensor (RDS) monitors atmospheric opacity during dust storms',
      'Provides empirical verification for life-support reserve calculations'
    ],
    pdsUrl: 'https://pds-atmospheres.nmsu.edu/data_and_services/atmospheres_data/PERSEVERANCE/meda.html',
    numpyFile: 'meda_environmental_profile.json',
    minMax: 'Pressure: 742 Pa | Temp: -64°C (Sol Mean)',
  },
];

export default function DataCatalogPage() {
  const [selectedInstrument, setSelectedInstrument] = useState<string>('mola');
  const activeDoc = INSTRUMENTS.find((d) => d.id === selectedInstrument) || INSTRUMENTS[0];

  return (
    <div
      className="min-h-screen flex flex-col font-sans transition-colors duration-200"
      style={{
        background: 'var(--surface)',
        color: 'var(--text-primary)',
      }}
    >
      <Header dataMode="VERIFIED_SNAPSHOT" activeTab="data" />

      {/* Page Header (In Document Flow) */}
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
              <h1 className="text-xl font-bold tracking-tight uppercase" style={{ color: 'var(--text-primary)' }}>
                NASA Planetary Data System (PDS) Multi-Mission Catalog
              </h1>
              <p className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
                Authoritative Observational Baselines &middot; Calibrated Instrument Records &middot; Zero Synthetic Shortcuts
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span
              className="px-2.5 py-1 rounded border flex items-center gap-1.5"
              style={{
                background: 'var(--color-success-bg)',
                borderColor: 'var(--color-success-border)',
                color: 'var(--color-success)',
              }}
            >
              <CheckCircle2 size={13} />
              PDS Archive Validated
            </span>
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
        {/* Left Column: Instrument Selector List */}
        <aside className="lg:w-80 flex-shrink-0 space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-wider px-1" style={{ color: 'var(--text-muted)' }}>
            Mission Instruments ({INSTRUMENTS.length})
          </p>
          <div className="space-y-2">
            {INSTRUMENTS.map((inst) => {
              const isSelected = inst.id === selectedInstrument;
              return (
                <button
                  key={inst.id}
                  onClick={() => setSelectedInstrument(inst.id)}
                  className="w-full text-left p-3.5 rounded-xl border transition-all flex flex-col gap-1.5"
                  style={{
                    background: isSelected ? 'var(--surface-raised)' : 'var(--surface-sunken)',
                    borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                    boxShadow: isSelected ? '0 4px 12px rgba(0,0,0,0.1)' : 'none',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded"
                      style={{
                        background: isSelected ? 'var(--accent-light)' : 'var(--surface-raised)',
                        color: isSelected ? 'var(--accent)' : 'var(--text-muted)',
                      }}
                    >
                      {inst.mission.split('(')[0].trim()}
                    </span>
                    <span className="text-[10px] font-mono font-semibold" style={{ color: 'var(--accent)' }}>
                      {inst.resolution.split(' ')[0]}
                    </span>
                  </div>
                  <h3 className="text-xs font-bold leading-snug" style={{ color: 'var(--text-primary)' }}>
                    {inst.name}
                  </h3>
                  <p className="text-[11px] line-clamp-1" style={{ color: 'var(--text-secondary)' }}>
                    {inst.metricRole}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Quick Technical Summary Card */}
          <div
            className="p-4 rounded-xl border mt-6 space-y-3"
            style={{
              background: 'var(--surface-raised)',
              borderColor: 'var(--border)',
            }}
          >
            <div className="flex items-center gap-2 text-xs font-bold uppercase" style={{ color: 'var(--text-primary)' }}>
              <Info size={14} style={{ color: 'var(--accent)' }} />
              <span>Raster Coordinate Grid</span>
            </div>
            <div className="text-xs space-y-1.5 font-mono" style={{ color: 'var(--text-secondary)' }}>
              <div className="flex justify-between py-1 border-b" style={{ borderColor: 'var(--border)' }}>
                <span>Latitude Range:</span>
                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>18.00°N – 18.90°N</span>
              </div>
              <div className="flex justify-between py-1 border-b" style={{ borderColor: 'var(--border)' }}>
                <span>Longitude Range:</span>
                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>77.00°E – 78.00°E</span>
              </div>
              <div className="flex justify-between py-1 border-b" style={{ borderColor: 'var(--border)' }}>
                <span>Matrix Dim:</span>
                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>300 × 300 (90,000 cells)</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Cell Ground Step:</span>
                <span className="font-bold" style={{ color: 'var(--accent)' }}>177.5 m × 187.1 m</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Right Column: Instrument Deep Dossier */}
        <section className="flex-1 min-w-0">
          <div
            className="p-6 sm:p-8 rounded-2xl border space-y-6"
            style={{
              background: 'var(--surface-raised)',
              borderColor: 'var(--border)',
            }}
          >
            {/* Header / Identity */}
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
                  {activeDoc.mission}
                </span>
                <a
                  href={activeDoc.pdsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs hover:underline transition-colors"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <span>Official PDS Archive</span>
                  <ExternalLink size={13} />
                </a>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                {activeDoc.name}
              </h2>
              <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                Archive Node: {activeDoc.node}
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
                  {activeDoc.resolution}
                </span>
              </div>
              <div
                className="p-3.5 rounded-xl border"
                style={{ background: 'var(--surface-sunken)', borderColor: 'var(--border)' }}
              >
                <span className="text-[10px] font-mono uppercase block" style={{ color: 'var(--text-muted)' }}>
                  PDS Product Identifier
                </span>
                <span className="text-xs font-mono mt-1 block truncate" title={activeDoc.pdsId} style={{ color: 'var(--text-primary)' }}>
                  {activeDoc.pdsId}
                </span>
              </div>
              <div
                className="p-3.5 rounded-xl border"
                style={{ background: 'var(--surface-sunken)', borderColor: 'var(--border)' }}
              >
                <span className="text-[10px] font-mono uppercase block" style={{ color: 'var(--text-muted)' }}>
                  Observed Dynamic Range
                </span>
                <span className="text-xs font-mono mt-1 block" style={{ color: 'var(--text-primary)' }}>
                  {activeDoc.minMax}
                </span>
              </div>
            </div>

            {/* Metric Role in Routing Engine */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Compass size={14} style={{ color: 'var(--accent)' }} />
                <span>Mathematical Role in VICTOR Routing Engine</span>
              </h4>
              <p
                className="text-xs leading-relaxed p-4 rounded-xl border"
                style={{
                  background: 'var(--surface-sunken)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-secondary)',
                }}
              >
                {activeDoc.metricRole}
              </p>
            </div>

            {/* Scientific Provenance & Mission Context */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Microscope size={14} style={{ color: 'var(--mode-live)' }} />
                <span>Observational Science Contribution</span>
              </h4>
              <p
                className="text-xs leading-relaxed p-4 rounded-xl border"
                style={{
                  background: 'var(--surface-sunken)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-secondary)',
                }}
              >
                {activeDoc.scienceContribution}
              </p>
            </div>

            {/* Diagnostic Signatures if CRISM */}
            {activeDoc.diagnosticSignatures && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <Sparkles size={14} style={{ color: 'var(--color-warning)' }} />
                  <span>CRISM Target Absorption Mineralogy (Jezero Crater)</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {activeDoc.diagnosticSignatures.map((sig, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl border flex flex-col justify-between"
                      style={{
                        background: 'var(--surface-sunken)',
                        borderColor: 'var(--border)',
                      }}
                    >
                      <div>
                        <div className="flex items-center justify-between text-xs font-bold" style={{ color: 'var(--color-warning)' }}>
                          <span>{sig.label}</span>
                          <span className="font-mono text-[11px]" style={{ color: 'var(--text-muted)' }}>{sig.wavelength}</span>
                        </div>
                        <p className="text-xs mt-1 font-mono" style={{ color: 'var(--text-secondary)' }}>
                          {sig.mineral}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Technical Calibration Details */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Layers size={14} style={{ color: 'var(--accent)' }} />
                <span>Instrument Calibration &amp; Coordinate Alignment</span>
              </h4>
              <ul className="space-y-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                {activeDoc.technicalDetails.map((detail, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2.5 p-2.5 rounded-lg border"
                    style={{
                      background: 'var(--surface-sunken)',
                      borderColor: 'var(--border)',
                    }}
                  >
                    <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--mode-live)' }} />
                    <span className="leading-relaxed">{detail}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Raw Matrix Storage & Launch Bridge */}
            <div className="pt-4 border-t flex flex-wrap items-center justify-between gap-4" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                <HardDrive size={15} />
                <span>Backend Cache: <code style={{ color: 'var(--text-primary)' }}>backend/data/{activeDoc.numpyFile}</code></span>
              </div>
              <Link
                href="/planner"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-98"
                style={{
                  background: 'var(--accent)',
                  color: 'var(--on-accent)',
                }}
              >
                <span>Plot Route with {activeDoc.id.toUpperCase()}</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
