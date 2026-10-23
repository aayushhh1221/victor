'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import Header from '@/components/common/Header';
import InfoBar from '@/components/common/InfoBar';
import VictorLogo from '@/components/common/VictorLogo';
import type { CorridorData } from '@/components/home/HeroReconMap';
import type { RegionInfo, EnvironmentResponse } from '@/types';
import { getRegion, getEnvironment } from '@/services/api';
import {
  ArrowRight, ShieldCheck, Zap, Globe, Database,
  BookOpen, Award, Scale, Sparkles, Radio,
  ChevronRight, Activity, ExternalLink, MapPin
} from 'lucide-react';

// Dynamic import for Leaflet-based Hero Satellite Reconnaissance Map (SSR unsafe)
const HeroReconMap = dynamic(() => import('@/components/home/HeroReconMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[440px] rounded-2xl border border-white/10 bg-[#06090F] flex flex-col items-center justify-center font-mono text-xs text-slate-400 gap-3 shadow-2xl">
      <div className="w-8 h-8 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
      <span className="tracking-widest uppercase text-[11px] text-cyan-300">
        INITIALIZING MRO CTX SATELLITE RECONNAISSANCE STREAM...
      </span>
    </div>
  ),
});

const CORRIDORS: CorridorData[] = [
  {
    id: 'perseverance',
    name: 'Séítah → Ancient Delta',
    category: 'Historical Mars 2020 Baseline',
    start: { lat: 18.4447, lon: 77.4508 },
    destination: { lat: 18.4812, lon: 77.2415 },
    path: [
      { lat: 18.4447, lon: 77.4508 },
      { lat: 18.4385, lon: 77.4452 },
      { lat: 18.4280, lon: 77.4480 },
      { lat: 18.4320, lon: 77.4250 },
      { lat: 18.4400, lon: 77.3850 },
      { lat: 18.4520, lon: 77.3520 },
      { lat: 18.4610, lon: 77.3300 },
      { lat: 18.4720, lon: 77.2950 },
      { lat: 18.4812, lon: 77.2415 },
    ],
    distanceKm: 17.1,
    evaHours: 5.4,
    slopeMax: 8.8,
    hazardScore: 2.25,
    scienceScore: 0.88,
    description: 'Traverses the rugged olivine-bearing Séítah formation across crater floor ripples toward the Hawksbill Gap sedimentary delta fan.',
  },
  {
    id: 'delta-fan',
    name: 'Crater Floor → Delta Fan',
    category: 'Sedimentary Stratigraphy',
    start: { lat: 18.4320, lon: 77.4250 },
    destination: { lat: 18.4610, lon: 77.3300 },
    path: [
      { lat: 18.4320, lon: 77.4250 },
      { lat: 18.4380, lon: 77.3950 },
      { lat: 18.4450, lon: 77.3700 },
      { lat: 18.4520, lon: 77.3520 },
      { lat: 18.4610, lon: 77.3300 },
    ],
    distanceKm: 6.0,
    evaHours: 2.1,
    slopeMax: 6.2,
    hazardScore: 1.85,
    scienceScore: 0.74,
    description: 'Direct transit across basaltic sands to Hawksbill Gap layered delta deposits preserving ancient biosignature candidates.',
  },
  {
    id: 'three-forks',
    name: 'Three Forks → Margin Unit',
    category: 'Carbonate Rim Ascent',
    start: { lat: 18.4520, lon: 77.3520 },
    destination: { lat: 18.4980, lon: 77.2400 },
    path: [
      { lat: 18.4520, lon: 77.3520 },
      { lat: 18.4650, lon: 77.3200 },
      { lat: 18.4780, lon: 77.2850 },
      { lat: 18.4880, lon: 77.2600 },
      { lat: 18.4980, lon: 77.2400 },
    ],
    distanceKm: 7.3,
    evaHours: 2.8,
    slopeMax: 11.4,
    hazardScore: 2.60,
    scienceScore: 0.92,
    description: 'Sample cache depot route ascending steep scarp margins to investigate carbonate-bearing crater rim boundaries.',
  },
  {
    id: 'kodiak',
    name: 'Kodiak Butte Pass → Crater Rim',
    category: 'Geomorphology Scouting',
    start: { lat: 18.4400, lon: 77.3850 },
    destination: { lat: 18.4900, lon: 77.3600 },
    path: [
      { lat: 18.4400, lon: 77.3850 },
      { lat: 18.4520, lon: 77.3800 },
      { lat: 18.4680, lon: 77.3750 },
      { lat: 18.4800, lon: 77.3700 },
      { lat: 18.4900, lon: 77.3600 },
    ],
    distanceKm: 3.4,
    evaHours: 1.4,
    slopeMax: 14.1,
    hazardScore: 3.10,
    scienceScore: 0.65,
    description: 'Examines the isolated Kodiak delta remnant before navigating boulder-strewn ejecta ramps on Jezero northern rim.',
  },
];

const PDS_INSTRUMENTS = [
  {
    code: 'MOLA MEGDR',
    name: 'Mars Orbiter Laser Altimeter',
    mission: 'Mars Global Surveyor',
    res: '200 m / px DEM',
    bands: '1064 nm Nd:YAG Laser',
    role: 'Topographic relief, gradient slope matrices, and Tobler metabolic energy expenditure modeling.',
  },
  {
    code: 'THEMIS IR',
    name: 'Thermal Emission Imaging System',
    mission: '2001 Mars Odyssey',
    res: '100 m / px Night-IR',
    bands: 'Band 9 (12.57 μm)',
    role: 'Thermal inertia proxy: separates exposed bedrock from wheel-sinking drift dust hazards.',
  },
  {
    code: 'CTX MOSAIC',
    name: 'Context Camera Orthomosaic',
    mission: 'Mars Reconnaissance Orbiter',
    res: '5.0 m / px Optical',
    bands: '500–800 nm Panchromatic',
    role: 'Micro-relief morphology: scarp detection, boulder fields, and fractured bedrock channels.',
  },
  {
    code: 'CRISM MTRDR',
    name: 'Imaging Spectrometer for Mars',
    mission: 'Mars Reconnaissance Orbiter',
    res: '181 m / px Mineral Map',
    bands: '544 VNIR / IR Channels',
    role: 'Diagnostic phyllosilicate clay (2.30 μm) and carbonate (2.51 μm) science return scoring.',
  },
  {
    code: 'MEDA CSDR',
    name: 'Environmental Dynamics Analyzer',
    mission: 'Mars 2020 Perseverance',
    res: '1 Hz In-Situ Sensors',
    bands: 'Pressure, Temp, Wind, τ',
    role: 'Ambient pressure (745 Pa), thermal diurnal extremes, and 20% life-support reserve boundaries.',
  },
];

export default function Home() {
  const [activeCorridor, setActiveCorridor] = useState<CorridorData>(CORRIDORS[0]);
  const [region, setRegion] = useState<RegionInfo | null>(null);
  const [environment, setEnvironment] = useState<EnvironmentResponse | null>(null);

  useEffect(() => {
    // Fetch live region & environment metadata from FastAPI backend
    getRegion()
      .then((r) => setRegion(r))
      .catch(() => {
        // Fallback snapshot metadata
        setRegion({
          region_name: 'Jezero Crater, Mars',
          name: 'Jezero Crater',
          lat_min: 18.0,
          lat_max: 18.9,
          lon_min: 77.0,
          lon_max: 78.0,
          lat: 18.45,
          lon: 77.5,
          elevation_m: -2277.0,
          elevation_min_m: -2874.0,
          elevation_max_m: -1466.0,
          elevation_source: 'MOLA/MGS',
          terrain_type: 'Crater Floor / Delta',
          terrain_subtype: 'Deltaic, sedimentary, olivine-bearing (Séítah)',
          region_description: 'Jezero Crater, Mars 2020 Perseverance landing site.',
          grid_rows: 300,
          grid_cols: 300,
          cell_size_ns_m: 177.5,
          cell_size_ew_m: 187.1,
          cell_shape: 'non-square',
          region_ns_km: 53.25,
          region_ew_km: 56.13,
          coordinate_system: 'IAU2000 planetocentric',
          data_mode: 'VERIFIED_SNAPSHOT',
          compliance: null,
          available_layers: ['imagery', 'terrain', 'elevation'],
          provenance: [],
        });
      });

    getEnvironment()
      .then((e) => setEnvironment(e))
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen flex flex-col font-sans bg-[#06090F] text-[#E8EDF3] antialiased selection:bg-blue-600 selection:text-white">
      {/* Top Global Shared Header (Strictly Dark Mission Control) */}
      <Header dataMode="VERIFIED_SNAPSHOT" activeTab="" />

      {/* Authentic NASA Telemetry InfoBar Strip */}
      <InfoBar region={region} loading={false} error={null} environment={environment} />

      {/* Flight Operations Header & Action Cluster */}
      <div className="border-b border-white/10 bg-[#08131E] px-4 py-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-mono font-bold tracking-wider text-cyan-400 uppercase">
                MARS 2020 EXTENDED RECONNAISSANCE // JEZERO CRATER DISPATCH
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-white">
              Autonomous Traverse Intelligence for{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-500">
                Martian Surface Exploration
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
              VICTOR solves the multi-objective Pareto frontier for astronaut EVA and autonomous rovers. Built upon NASA Planetary Data System observations, oblate spheroidal geodesics (3,396.2 km &times; 3,376.2 km), and anisotropic Tobler walking speeds on 0.38g gravity.
            </p>
          </div>

          {/* Quick Hardware Action Links */}
          <div className="flex flex-wrap items-center gap-2.5 flex-shrink-0">
            <Link
              href={`/planner?preset=${activeCorridor.id}`}
              className="group inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-md bg-blue-600 hover:bg-blue-500 text-white active:scale-98 border border-blue-400/40"
            >
              <span>Launch Tactical Planner</span>
              <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
            </Link>

            <Link
              href="/explorer"
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl font-semibold text-xs border border-white/10 bg-[#0D1A2D] hover:bg-[#152742] text-slate-200 hover:text-white transition-all shadow-sm"
            >
              <Globe size={14} className="text-cyan-400" />
              <span>360° Mars Explorer</span>
            </Link>

            <Link
              href="/methodology"
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl font-semibold text-xs border border-white/10 bg-[#0D1A2D] hover:bg-[#152742] text-slate-300 hover:text-white transition-all shadow-sm"
            >
              <BookOpen size={14} />
              <span>Methodology</span>
            </Link>

            <Link
              href="/data"
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl font-semibold text-xs border border-white/10 bg-[#0D1A2D] hover:bg-[#152742] text-slate-300 hover:text-white transition-all shadow-sm"
            >
              <Database size={14} />
              <span>NASA Catalog</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Tactical Command Operations Deck (3-Column Layout Matching Planner) */}
      <section className="px-4 sm:px-6 py-6 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Column 1: Historical Jezero Corridors Selector (Left Column) */}
          <div className="lg:col-span-3 space-y-4">
            <div className="p-4 rounded-2xl border border-white/10 bg-[#08131E] shadow-xl space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                  <Radio size={14} />
                  <span>Traverse Corridors</span>
                </span>
                <span className="text-[10px] font-mono text-slate-400">4 PRESETS</span>
              </div>

              <div className="space-y-2">
                {CORRIDORS.map((c) => {
                  const isSelected = activeCorridor.id === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setActiveCorridor(c)}
                      className={`w-full text-left p-3 rounded-xl border transition-all font-mono ${
                        isSelected
                          ? 'bg-blue-950/60 border-cyan-400 text-white shadow-[0_0_15px_rgba(0,240,255,0.2)]'
                          : 'bg-[#06090F]/70 border-white/5 text-slate-400 hover:text-slate-200 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="font-bold text-white truncate">{c.name}</span>
                        {isSelected && <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />}
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center justify-between">
                        <span>{c.distanceKm} km</span>
                        <span className="text-cyan-300 font-semibold">{c.evaHours} h EVA</span>
                        <span className="text-emerald-400">Max {c.slopeMax}&deg;</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="pt-2">
                <Link
                  href={`/planner?preset=${activeCorridor.id}`}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-blue-600 hover:bg-blue-500 text-white transition-all shadow border border-blue-400/40"
                >
                  <span>Plot Corridor in Planner</span>
                  <ExternalLink size={13} />
                </Link>
              </div>
            </div>

            {/* In-Situ Mission Constraints */}
            <div className="p-4 rounded-2xl border border-white/10 bg-[#08131E] shadow-xl space-y-2.5 font-mono text-xs">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block border-b border-white/10 pb-1.5">
                Active Operational Bounds
              </span>
              <div className="flex justify-between text-slate-300 text-[11px]">
                <span className="text-slate-400">Max Slope Limit:</span>
                <span className="font-bold text-amber-400">15.0&deg; (Wheel Slip)</span>
              </div>
              <div className="flex justify-between text-slate-300 text-[11px]">
                <span className="text-slate-400">EVA Budget:</span>
                <span className="font-bold text-slate-200">6.0 h (20% Reserve)</span>
              </div>
              <div className="flex justify-between text-slate-300 text-[11px]">
                <span className="text-slate-400">Tobler Pace:</span>
                <span className="font-bold text-cyan-400">3.0 km/h (0.38g)</span>
              </div>
              <div className="flex justify-between text-slate-300 text-[11px]">
                <span className="text-slate-400">Mesh Resolution:</span>
                <span className="font-bold text-slate-200">177.5 &times; 187.1 m</span>
              </div>
            </div>
          </div>

          {/* Column 2: Center Reconnaissance Map Viewport */}
          <div className="lg:col-span-6 space-y-4">
            <HeroReconMap activeCorridor={activeCorridor} />

            {/* Bottom Context Details */}
            <div className="p-3.5 rounded-xl border border-white/10 bg-[#08131E] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono">
              <div className="space-y-0.5 text-center sm:text-left">
                <span className="text-[10px] uppercase text-cyan-400 font-bold block">
                  Active Science Objective:
                </span>
                <p className="text-[11px] text-slate-300 leading-tight">
                  {activeCorridor.description}
                </p>
              </div>
              <Link
                href={`/planner?preset=${activeCorridor.id}`}
                className="whitespace-nowrap px-3 py-1.5 rounded-lg bg-blue-600/20 text-cyan-300 hover:text-white border border-cyan-500/30 text-[11px] font-bold flex items-center gap-1.5 hover:bg-blue-600 transition-colors"
              >
                <span>Full Tactical Engine</span>
                <ChevronRight size={13} />
              </Link>
            </div>
          </div>

          {/* Column 3: 4 Pareto Strategy Cards (Right Column - Matching Planner Screenshot) */}
          <div className="lg:col-span-3 space-y-3">
            <div className="flex items-center justify-between font-mono text-xs border-b border-white/10 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                <Scale size={14} className="text-cyan-400" />
                <span>Strategy Evaluation (4)</span>
              </span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-950 text-blue-300 border border-blue-800">
                Pareto
              </span>
            </div>

            {/* 1. Safest Strategy Card */}
            <div className="p-3.5 rounded-xl border border-emerald-500/40 bg-[#08131E] space-y-2.5 shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="font-mono font-bold text-xs text-emerald-400">Safest</span>
                  <span className="px-1 py-0.2 rounded text-[8px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                    ACTIVE
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[9px] font-mono text-emerald-300">
                  <span>★ Optimal</span>
                  <span>Feasible</span>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-1 text-center font-mono text-[10px] text-slate-400 border-t border-b border-white/5 py-1.5">
                <div>
                  <span className="block text-[8px] uppercase">Dist</span>
                  <span className="font-bold text-white">17.1 km</span>
                </div>
                <div>
                  <span className="block text-[8px] uppercase">EVA</span>
                  <span className="font-bold text-white">5.4 h</span>
                </div>
                <div>
                  <span className="block text-[8px] uppercase">Hazard</span>
                  <span className="font-bold text-emerald-400">2.25</span>
                </div>
                <div>
                  <span className="block text-[8px] uppercase">Sci</span>
                  <span className="font-bold text-white">0.582</span>
                </div>
              </div>
              <div className="space-y-1 font-mono text-[10px]">
                <div className="flex justify-between text-slate-400">
                  <span>EVA Life Support (+20% res):</span>
                  <span className="text-emerald-400 font-bold">90% of 6h</span>
                </div>
                <div className="w-full h-1.5 bg-black/50 rounded-full overflow-hidden">
                  <div className="w-[90%] h-full bg-emerald-500 rounded-full" />
                </div>
              </div>
            </div>

            {/* 2. Fastest Strategy Card */}
            <div className="p-3.5 rounded-xl border border-blue-500/30 bg-[#08131E] space-y-2.5 shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-400" />
                  <span className="font-mono font-bold text-xs text-blue-400">Fastest</span>
                </div>
                <div className="flex items-center gap-1 text-[9px] font-mono text-blue-300">
                  <span>★ Optimal</span>
                  <span>Feasible</span>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-1 text-center font-mono text-[10px] text-slate-400 border-t border-b border-white/5 py-1.5">
                <div>
                  <span className="block text-[8px] uppercase">Dist</span>
                  <span className="font-bold text-white">16.2 km</span>
                </div>
                <div>
                  <span className="block text-[8px] uppercase">EVA</span>
                  <span className="font-bold text-blue-400">4.7 h</span>
                </div>
                <div>
                  <span className="block text-[8px] uppercase">Hazard</span>
                  <span className="font-bold text-amber-400">2.85</span>
                </div>
                <div>
                  <span className="block text-[8px] uppercase">Sci</span>
                  <span className="font-bold text-white">0.420</span>
                </div>
              </div>
              <div className="space-y-1 font-mono text-[10px]">
                <div className="flex justify-between text-slate-400">
                  <span>EVA Life Support (+20% res):</span>
                  <span className="text-blue-400 font-bold">78% of 6h</span>
                </div>
                <div className="w-full h-1.5 bg-black/50 rounded-full overflow-hidden">
                  <div className="w-[78%] h-full bg-blue-500 rounded-full" />
                </div>
              </div>
            </div>

            {/* 3. Science-Richest Strategy Card */}
            <div className="p-3.5 rounded-xl border border-amber-500/30 bg-[#08131E] space-y-2.5 shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="font-mono font-bold text-xs text-amber-400">Science-Richest</span>
                </div>
                <div className="flex items-center gap-1 text-[9px] font-mono text-amber-300">
                  <span>★ Optimal</span>
                  <span>Feasible</span>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-1 text-center font-mono text-[10px] text-slate-400 border-t border-b border-white/5 py-1.5">
                <div>
                  <span className="block text-[8px] uppercase">Dist</span>
                  <span className="font-bold text-white">19.4 km</span>
                </div>
                <div>
                  <span className="block text-[8px] uppercase">EVA</span>
                  <span className="font-bold text-white">5.9 h</span>
                </div>
                <div>
                  <span className="block text-[8px] uppercase">Hazard</span>
                  <span className="font-bold text-amber-400">2.92</span>
                </div>
                <div>
                  <span className="block text-[8px] uppercase">Sci</span>
                  <span className="font-bold text-amber-400">0.895</span>
                </div>
              </div>
              <div className="space-y-1 font-mono text-[10px]">
                <div className="flex justify-between text-slate-400">
                  <span>EVA Life Support (+20% res):</span>
                  <span className="text-amber-400 font-bold">98% of 6h</span>
                </div>
                <div className="w-full h-1.5 bg-black/50 rounded-full overflow-hidden">
                  <div className="w-[98%] h-full bg-amber-500 rounded-full" />
                </div>
              </div>
            </div>

            {/* 4. Balanced Strategy Card */}
            <div className="p-3.5 rounded-xl border border-purple-500/30 bg-[#08131E] space-y-2.5 shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-400" />
                  <span className="font-mono font-bold text-xs text-purple-400">Balanced</span>
                </div>
                <div className="flex items-center gap-1 text-[9px] font-mono text-purple-300">
                  <span>★ Optimal</span>
                  <span>Feasible</span>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-1 text-center font-mono text-[10px] text-slate-400 border-t border-b border-white/5 py-1.5">
                <div>
                  <span className="block text-[8px] uppercase">Dist</span>
                  <span className="font-bold text-white">17.8 km</span>
                </div>
                <div>
                  <span className="block text-[8px] uppercase">EVA</span>
                  <span className="font-bold text-white">5.2 h</span>
                </div>
                <div>
                  <span className="block text-[8px] uppercase">Hazard</span>
                  <span className="font-bold text-emerald-400">2.40</span>
                </div>
                <div>
                  <span className="block text-[8px] uppercase">Sci</span>
                  <span className="font-bold text-purple-300">0.720</span>
                </div>
              </div>
              <div className="space-y-1 font-mono text-[10px]">
                <div className="flex justify-between text-slate-400">
                  <span>EVA Life Support (+20% res):</span>
                  <span className="text-purple-400 font-bold">86% of 6h</span>
                </div>
                <div className="w-full h-1.5 bg-black/50 rounded-full overflow-hidden">
                  <div className="w-[86%] h-full bg-purple-500 rounded-full" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom Command Console (Route Analysis & Risk Assessment - Matching Planner) */}
      <section className="px-4 sm:px-6 pb-12 max-w-7xl mx-auto w-full">
        <div className="p-5 rounded-2xl border border-white/10 bg-[#08131E] shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-cyan-400" />
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-white">
                Route Analysis &amp; Mission Profiles (4 computed strategies)
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 bg-cyan-400 rounded" />
                <span>Elevation</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 bg-amber-400 rounded" />
                <span>Terrain Difficulty</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Elevation SVG Chart */}
            <div className="lg:col-span-5 space-y-2">
              <span className="text-[10px] font-mono uppercase text-slate-400 block font-semibold">
                SAFEST &mdash; ROUTE PROFILE (Cumulative Elevation Delta [&Delta;h])
              </span>
              <div className="w-full h-36 relative flex items-end bg-[#06090F] p-2 rounded-xl border border-white/5">
                <svg className="w-full h-full" viewBox="0 0 500 100" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="deckElevGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00F0FF" stopOpacity="0.30" />
                      <stop offset="100%" stopColor="#00F0FF" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <line x1="0" y1="25" x2="500" y2="25" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                  <line x1="0" y1="55" x2="500" y2="55" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                  <line x1="0" y1="85" x2="500" y2="85" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />

                  <path d="M 0 90 Q 120 80, 220 65 T 380 40 T 500 20 L 500 100 L 0 100 Z" fill="url(#deckElevGrad)" />
                  <path d="M 0 90 Q 120 80, 220 65 T 380 40 T 500 20" fill="none" stroke="#00F0FF" strokeWidth="2.5" />
                  <path d="M 0 88 L 100 86 L 180 75 L 290 80 L 380 70 L 450 50 L 500 42" fill="none" stroke="#F59E0B" strokeWidth="1.8" strokeDasharray="4 4" />
                </svg>
                <div className="absolute left-3 bottom-2 text-[9px] font-mono text-cyan-400 font-bold">
                  Start: -2,568 m
                </div>
                <div className="absolute right-3 top-2 text-[9px] font-mono text-cyan-400 font-bold">
                  &Delta;h: +84.0 m
                </div>
              </div>
            </div>

            {/* Route Risk Assessment Gauges */}
            <div className="lg:col-span-4 space-y-2 border-l border-r border-white/5 px-0 lg:px-4 font-mono text-xs">
              <span className="text-[10px] uppercase text-slate-400 block font-semibold">
                ROUTE RISK ASSESSMENT
              </span>
              <div className="space-y-2">
                <div className="space-y-0.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">Terrain Hazard:</span>
                    <span className="font-bold text-emerald-400">2.2 / 5.0</span>
                  </div>
                  <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                    <div className="w-[44%] h-full bg-emerald-500 rounded-full" />
                  </div>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Max Slope:</span>
                  <span className="font-bold text-slate-200">2.4&deg; (Nominal)</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Science Value:</span>
                  <span className="font-bold text-cyan-400">8.6 / 10.0</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Data Confidence:</span>
                  <span className="font-bold text-amber-400">MODERATE (PDS Verified)</span>
                </div>
              </div>
            </div>

            {/* Science Targets Proximity */}
            <div className="lg:col-span-3 space-y-2 font-mono text-xs">
              <span className="text-[10px] uppercase text-slate-400 block font-semibold">
                SCIENCE OPPORTUNITIES NEAR ROUTE
              </span>
              <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1.5 text-[11px]">
                <div className="flex items-center gap-1.5 text-cyan-300 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  <span>Smectite Clay Deposit</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">
                  Hawksbill Gap mudstones exhibiting 2.30 &mu;m phyllosilicate absorption.
                </p>
                <div className="text-[10px] text-emerald-400 pt-1 font-semibold">
                  Offset: 45 m &middot; Tier 1 Priority
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* NASA Planetary Data System Ingestion Pipeline Section */}
      <section className="py-14 px-4 sm:px-6 border-t border-white/10 bg-[#070E18]">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase mb-1 text-emerald-400">
                <Database size={14} />
                <span>Multi-Mission Observational Datasets</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Calibrated NASA PDS Data Pipeline
              </h2>
              <p className="text-xs sm:text-sm mt-1 max-w-xl text-slate-400">
                Every elevation pixel, slope gradient, and mineral signature originates from verified planetary archive records.
              </p>
            </div>
            <Link
              href="/data"
              className="text-xs font-semibold flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 hover:underline font-mono"
            >
              <span>Open PDS Data Catalog</span>
              <ChevronRight size={14} />
            </Link>
          </div>

          <div className="space-y-2.5">
            {PDS_INSTRUMENTS.map((inst, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl border border-white/10 bg-[#08131E] flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors hover:border-cyan-500/40"
              >
                <div className="space-y-0.5 md:w-1/3">
                  <span className="text-[10px] font-mono uppercase font-bold text-emerald-400">
                    {inst.code}
                  </span>
                  <h4 className="text-sm font-bold text-white">{inst.name}</h4>
                  <span className="text-[11px] font-mono block text-slate-400">{inst.mission}</span>
                </div>
                <div className="text-xs leading-relaxed md:w-1/2 text-slate-300">
                  {inst.role}
                </div>
                <div className="md:w-1/6 flex flex-col items-start md:items-end justify-center font-mono text-xs">
                  <span className="font-bold text-slate-200">{inst.res}</span>
                  <span className="text-[10px] text-slate-500">{inst.bands}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* NASA Space Apps Rubric & Charter Capsule */}
      <section className="py-12 px-4 sm:px-6 border-t border-white/10 bg-[#08131E]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2 text-xs font-mono font-bold uppercase text-cyan-400">
              <Award size={15} />
              <span>NASA Space Apps Challenge 2026</span>
            </div>
            <h3 className="text-base font-bold text-white">
              Project Charter &amp; Rubric Compliance
            </h3>
            <p className="text-xs max-w-xl leading-relaxed text-slate-400">
              100% real NASA PDS data, reproducible IAU2000 math, glass-box explainability, sub-100ms performance, and RFC 7946 GeoJSON export.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/about"
              className="px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm bg-blue-600 hover:bg-blue-500 text-white active:scale-98"
            >
              Read Mission Charter
            </Link>
            <Link
              href="/planner"
              className="px-4 py-2.5 rounded-xl text-xs font-bold border border-white/10 bg-[#0D1A2D] hover:bg-[#152742] text-slate-200 transition-colors"
            >
              Launch Planner
            </Link>
          </div>
        </div>
      </section>

      {/* Institutional Footer */}
      <footer className="py-8 px-4 sm:px-6 border-t border-white/10 mt-auto text-xs bg-[#06090F] text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <VictorLogo size={22} />
            <span className="font-bold tracking-wide text-slate-200">
              PROJECT VICTOR
            </span>
            <span>&middot;</span>
            <span>NASA Space Apps Challenge 2026</span>
          </div>
          <div className="flex flex-wrap items-center gap-4 font-mono text-xs text-slate-400">
            <Link href="/planner" className="hover:text-cyan-300 hover:underline">Mission Planner</Link>
            <Link href="/explorer" className="hover:text-cyan-300 hover:underline">Global Explorer</Link>
            <Link href="/methodology" className="hover:text-cyan-300 hover:underline">Methodology</Link>
            <Link href="/data" className="hover:text-cyan-300 hover:underline">PDS Data Catalog</Link>
            <Link href="/about" className="hover:text-cyan-300 hover:underline">About &amp; Charter</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
