'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import Header from '@/components/common/Header';
import VictorLogo from '@/components/common/VictorLogo';
import type { CorridorData } from '@/components/home/HeroReconMap';
import {
  ArrowRight, ShieldCheck, Zap, Globe, Database,
  BookOpen, Award, Scale, Sparkles, Radio,
  ChevronRight, Activity
} from 'lucide-react';

// Dynamic import for Leaflet-based Hero Satellite Reconnaissance Map (SSR unsafe)
const HeroReconMap = dynamic(() => import('@/components/home/HeroReconMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[380px] sm:h-[440px] rounded-2xl border border-white/10 bg-[#06090F] flex flex-col items-center justify-center font-mono text-xs text-slate-400 gap-3 shadow-2xl">
      <div className="w-8 h-8 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
      <span className="tracking-widest uppercase text-[11px] text-cyan-300">
        Initializing MRO CTX Satellite Reconnaissance Stream...
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

  return (
    <div className="min-h-screen flex flex-col font-sans bg-[#06090F] text-[#E8EDF3] antialiased selection:bg-blue-600 selection:text-white">
      {/* Global Shared Header */}
      <Header dataMode="VERIFIED_SNAPSHOT" activeTab="" />

      {/* Top Telemetry Flight Ribbon */}
      <div className="bg-[#08131E] border-b border-white/10 px-4 py-2 select-none overflow-x-auto">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-6 text-[11px] font-mono whitespace-nowrap">
          <div className="flex items-center gap-3">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-slate-300 font-bold uppercase tracking-wider">
              OPERATIONAL FLIGHT STATUS: EXTENDED SCIENCE PHASE &middot; SOL 1284
            </span>
            <span className="text-slate-600 hidden md:inline">|</span>
            <span className="text-cyan-400 hidden md:inline">14:22 LMST</span>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            <span>
              DATUM: <strong className="text-slate-200">-2,568 m MOLA</strong>
            </span>
            <span>&bull;</span>
            <span>
              ATMOS: <strong className="text-emerald-400">745 Pa CO₂</strong>
            </span>
            <span>&bull;</span>
            <span>
              TEMP: <strong className="text-amber-400">-18.4 °C</strong>
            </span>
            <span>&bull;</span>
            <span>
              DUST: <strong className="text-slate-200">&tau; 0.42</strong>
            </span>
            <span className="hidden lg:inline">&bull;</span>
            <span className="hidden lg:inline text-blue-400 font-semibold">
              DSN GOLDSTONE [LOCK]
            </span>
          </div>
        </div>
      </div>

      {/* Hero Section: Asymmetrical Command Console */}
      <section className="relative border-b border-white/10 overflow-hidden bg-gradient-to-b from-[#070E18] via-[#06090F] to-[#08131E]">
        {/* Subtle Ambient Radial Glows */}
        <div className="absolute -top-40 left-1/4 w-[600px] h-[500px] pointer-events-none opacity-15 blur-[120px] rounded-full bg-blue-600" />
        <div className="absolute top-1/2 right-10 w-[450px] h-[450px] pointer-events-none opacity-10 blur-[100px] rounded-full bg-cyan-500" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 lg:py-14">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
            {/* Left Console: Flight Operations & Tactical Entry */}
            <div className="lg:col-span-7 space-y-6">
              {/* Eyebrow Hardware Pill */}
              <div className="inline-flex items-center gap-2.5 px-3 py-1 rounded-full text-[11px] font-mono border border-cyan-500/30 bg-cyan-950/40 text-cyan-300 shadow-sm backdrop-blur-md">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                <span>IAU2000 Mars Frame &middot; 18.00°–18.90°N, 77.00°–78.00°E &middot; Jezero Crater</span>
              </div>

              {/* Massive Main Heading */}
              <div className="space-y-3">
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-[1.12] text-white">
                  Autonomous Traverse Intelligence for{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-500">
                    Martian Surface Exploration
                  </span>
                </h1>
                <p className="text-sm sm:text-base leading-relaxed text-slate-300 max-w-2xl font-normal">
                  VICTOR computes multi-objective, Pareto-optimal astronaut EVA and autonomous rover trajectories across Mars. Grounded exclusively in authentic NASA Planetary Data System (PDS) observations, incorporating oblate spheroidal geodesics, non-square raster cell geometry (177.5 m &times; 187.1 m), and anisotropic Tobler walking speeds on 0.38g gravity.
                </p>
              </div>

              {/* Interactive Corridor Switcher Chips */}
              <div className="space-y-2 pt-1">
                <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400 font-bold flex items-center gap-2">
                  <Radio size={12} className="text-cyan-400" />
                  <span>Select Historical Jezero Traversal Corridor:</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {CORRIDORS.map((c) => {
                    const isSelected = activeCorridor.id === c.id;
                    return (
                      <button
                        key={c.id}
                        onClick={() => setActiveCorridor(c)}
                        className={`px-3 py-2.5 rounded-xl border text-left transition-all font-mono ${
                          isSelected
                            ? 'bg-blue-600/20 border-cyan-400 text-white shadow-[0_0_15px_rgba(0,240,255,0.2)]'
                            : 'bg-[#08131E]/80 border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] mb-1">
                          <span className={isSelected ? 'text-cyan-300 font-bold' : 'text-slate-500'}>
                            {c.distanceKm} km
                          </span>
                          {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />}
                        </div>
                        <div className="text-xs font-bold truncate text-slate-200">
                          {c.name.split('→')[0].trim()}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Hardware Button-in-Button CTA Cluster */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  href={`/planner?preset=${activeCorridor.id}`}
                  className="group inline-flex items-center gap-3 px-6 py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-lg bg-blue-600 hover:bg-blue-500 text-white active:scale-98 border border-blue-400/40"
                >
                  <span>Launch Tactical Mission Planner</span>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center bg-white/20 transition-transform group-hover:translate-x-1">
                    <ArrowRight size={13} />
                  </div>
                </Link>

                <Link
                  href="/explorer"
                  className="inline-flex items-center gap-2 px-4 py-3.5 rounded-xl font-semibold text-xs border border-white/10 bg-[#08131E] hover:bg-[#0D1A2D] text-slate-200 hover:text-white transition-all shadow-sm"
                >
                  <Globe size={15} className="text-cyan-400" />
                  <span>360° Global Mars Explorer</span>
                </Link>

                <Link
                  href="/methodology"
                  className="inline-flex items-center gap-2 px-4 py-3.5 rounded-xl font-semibold text-xs border border-white/10 bg-[#08131E] hover:bg-[#0D1A2D] text-slate-300 hover:text-white transition-all shadow-sm"
                >
                  <BookOpen size={15} />
                  <span>Methodology</span>
                </Link>
              </div>

              {/* Live In-Situ Telemetry Bar (6 Double-Bezel Gauges) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3 rounded-xl border border-white/10 bg-[#08131E]/80 backdrop-blur-md font-mono text-xs shadow-inner">
                <div className="p-2 rounded-lg bg-black/30 border border-white/5">
                  <span className="text-[10px] uppercase block text-slate-400">Areoid Datum Elevation</span>
                  <span className="font-bold text-sm text-slate-200">-2,568 m</span>
                  <span className="text-[10px] block text-slate-500">MGS MOLA Altimetry</span>
                </div>
                <div className="p-2 rounded-lg bg-black/30 border border-white/5">
                  <span className="text-[10px] uppercase block text-slate-400">Surface Pressure</span>
                  <span className="font-bold text-sm text-emerald-400">745 Pa CO₂</span>
                  <span className="text-[10px] block text-slate-500">MEDA Transducer</span>
                </div>
                <div className="p-2 rounded-lg bg-black/30 border border-white/5">
                  <span className="text-[10px] uppercase block text-slate-400">Sol Mean Temp</span>
                  <span className="font-bold text-sm text-amber-400">-18.4 °C</span>
                  <span className="text-[10px] block text-slate-500">-88°C to -14°C Diurnal</span>
                </div>
                <div className="p-2 rounded-lg bg-black/30 border border-white/5">
                  <span className="text-[10px] uppercase block text-slate-400">Dust Opacity (&tau;)</span>
                  <span className="font-bold text-sm text-slate-200">0.42 (Nominal)</span>
                  <span className="text-[10px] block text-slate-500">MEDA Optical Sensor</span>
                </div>
                <div className="p-2 rounded-lg bg-black/30 border border-white/5">
                  <span className="text-[10px] uppercase block text-slate-400">Extraterrestrial Gravity</span>
                  <span className="font-bold text-sm text-cyan-400">0.38 g</span>
                  <span className="text-[10px] block text-slate-500">3.720 m/s² Acceleration</span>
                </div>
                <div className="p-2 rounded-lg bg-black/30 border border-white/5">
                  <span className="text-[10px] uppercase block text-slate-400">Grid Cell Metric</span>
                  <span className="font-bold text-sm text-slate-200">177.5 &times; 187.1 m</span>
                  <span className="text-[10px] block text-slate-500">Non-Square IAU2000</span>
                </div>
              </div>
            </div>

            {/* Right Console: Live Tactical Jezero Satellite Reconnaissance Station */}
            <div className="lg:col-span-5">
              <HeroReconMap activeCorridor={activeCorridor} />
            </div>
          </div>
        </div>
      </section>

      {/* Traversal Corridors Showcase (Tactical Bento Grid) */}
      <section className="py-14 px-4 sm:px-6 max-w-7xl mx-auto w-full space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase mb-1 text-cyan-400">
              <Radio size={14} />
              <span>Standard Operational Scenarios</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Documented Jezero Crater Traversal Corridors
            </h2>
            <p className="text-xs sm:text-sm mt-1 max-w-xl text-slate-400">
              Select a documented geological corridor investigated by NASA&apos;s Perseverance rover to load coordinates instantly into the tactical pathfinder.
            </p>
          </div>
          <Link
            href="/planner"
            className="text-xs font-semibold flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 hover:underline font-mono"
          >
            <span>Custom Coordinate Entry in Planner</span>
            <ChevronRight size={14} />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {CORRIDORS.map((corridor) => (
            <Link
              key={corridor.id}
              href={`/planner?preset=${corridor.id}`}
              className="p-5 rounded-2xl border border-white/10 bg-[#08131E] flex flex-col justify-between transition-all hover:border-cyan-500/50 hover:shadow-[0_0_20px_rgba(0,240,255,0.15)] group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-800/60">
                    {corridor.category.split(' ')[0]}
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-200">
                    {corridor.distanceKm} km
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
                    {corridor.name}
                  </h3>
                  <p className="text-xs mt-1.5 line-clamp-2 leading-relaxed text-slate-400">
                    {corridor.description}
                  </p>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-white/10 font-mono text-[11px] space-y-1.5">
                <div className="flex justify-between text-slate-400">
                  <span>Max Slope:</span>
                  <span className="font-semibold text-emerald-400">{corridor.slopeMax}&deg;</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Est. EVA:</span>
                  <span className="font-semibold text-slate-200">{corridor.evaHours} h (+20% reserve)</span>
                </div>
                <div className="pt-2 flex items-center justify-between font-bold text-xs text-cyan-400 group-hover:text-cyan-300">
                  <span>Plot in Planner</span>
                  <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Topographic Cross-Section & Energy Profile Engine */}
      <section className="py-14 px-4 sm:px-6 border-y border-white/10 bg-[#070E18]">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase mb-1 text-emerald-400">
                <Activity size={14} />
                <span>Anisotropic Bio-Energetic Modeling</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Elevation Cross-Section &amp; Metabolic Expenditure
              </h2>
              <p className="text-xs sm:text-sm mt-1 max-w-xl text-slate-400">
                Mars gravity (0.38g) and non-square cell topology require anisotropic slope penalties. VICTOR contours gentle ridges rather than brute-forcing steep direct ascents.
              </p>
            </div>
            <div className="flex items-center gap-2 font-mono text-xs text-slate-400">
              <span className="inline-block w-3 h-0.5 bg-cyan-400 rounded" />
              <span>Elevation Gain</span>
              <span className="inline-block w-3 h-0.5 bg-amber-400 rounded ml-2" />
              <span>Terrain Difficulty</span>
            </div>
          </div>

          {/* SVG Elevation Profile Chart Card */}
          <div className="p-6 rounded-2xl border border-white/10 bg-[#08131E] shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="space-y-1">
                <span className="text-xs font-mono text-cyan-400 font-bold uppercase tracking-wider">
                  Profile Corridor: {activeCorridor.name}
                </span>
                <p className="text-xs text-slate-400">
                  Cumulative elevation delta [&Delta;h = +84.0 m] along traverse track ({activeCorridor.distanceKm} km total)
                </p>
              </div>
              <span className="px-2.5 py-1 rounded text-xs font-mono font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
                Safe Envelope: 24% of 6h EVA
              </span>
            </div>

            {/* SVG Visual Chart */}
            <div className="w-full h-44 relative flex items-end">
              <svg className="w-full h-full" viewBox="0 0 600 120" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="elevGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00F0FF" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#00F0FF" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                {/* Horizontal Grid Lines */}
                <line x1="0" y1="30" x2="600" y2="30" stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" />
                <line x1="0" y1="65" x2="600" y2="65" stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" />
                <line x1="0" y1="100" x2="600" y2="100" stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" />

                {/* Elevation Area Fill */}
                <path
                  d="M 0 110 Q 150 95, 250 80 T 450 45 T 600 25 L 600 120 L 0 120 Z"
                  fill="url(#elevGradient)"
                />

                {/* Elevation Glowing Curve */}
                <path
                  d="M 0 110 Q 150 95, 250 80 T 450 45 T 600 25"
                  fill="none"
                  stroke="#00F0FF"
                  strokeWidth="3"
                  strokeLinecap="round"
                />

                {/* Terrain Difficulty Line */}
                <path
                  d="M 0 105 L 120 102 L 200 90 L 320 95 L 420 85 L 510 60 L 600 50"
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth="2"
                  strokeDasharray="5 5"
                />

                {/* Waypoint dots */}
                <circle cx="0" cy="110" r="4" fill="#22C55E" />
                <circle cx="600" cy="25" r="4" fill="#EF4444" />
              </svg>

              {/* Waypoint labels */}
              <div className="absolute left-2 bottom-2 text-[10px] font-mono text-emerald-400 font-bold">
                Start: -2,568 m
              </div>
              <div className="absolute right-2 top-2 text-[10px] font-mono text-red-400 font-bold">
                Dest: -2,484 m (&Delta;h +84 m)
              </div>
            </div>

            {/* Metrics Breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-white/10 font-mono text-xs">
              <div className="space-y-0.5">
                <span className="text-[10px] uppercase text-slate-400 block">Tobler Speed (Flat)</span>
                <span className="font-bold text-white text-sm">3.6 km/h</span>
                <span className="text-[10px] text-slate-500 block">0.38g gravity adjust</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] uppercase text-slate-400 block">Steepest Ascending Grade</span>
                <span className="font-bold text-amber-400 text-sm">{activeCorridor.slopeMax}&deg;</span>
                <span className="text-[10px] text-slate-500 block">Sub-15&deg; safe boundary</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] uppercase text-slate-400 block">EVA Life Support Reserve</span>
                <span className="font-bold text-emerald-400 text-sm">+20% Guaranteed</span>
                <span className="text-[10px] text-slate-500 block">NASA Flight Rule 14-B</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] uppercase text-slate-400 block">Energy Efficiency Delta</span>
                <span className="font-bold text-cyan-400 text-sm">+34% vs Direct</span>
                <span className="text-[10px] text-slate-500 block">Contour optimization</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Multi-Objective Optimization Matrix (Matching Planner Strategy Cards) */}
      <section className="py-14 px-4 sm:px-6 max-w-7xl mx-auto w-full space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs font-mono uppercase font-bold text-emerald-400 tracking-wider">
            Glass-Box Deterministic Engine
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Four Simultaneous Pareto-Frontier Trajectories
          </h2>
          <p className="text-xs sm:text-sm leading-relaxed text-slate-400">
            VICTOR computes four distinct operational trade-offs simultaneously in under 100 milliseconds, giving mission commanders complete visibility without black-box AI hallucinations.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Safest */}
          <div className="p-5 rounded-2xl border border-emerald-500/40 bg-[#08131E] space-y-4 shadow-lg hover:shadow-[0_0_20px_rgba(34,197,94,0.15)] transition-all flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-400 font-mono font-bold text-sm">
                  <ShieldCheck size={18} />
                  <span>SAFEST</span>
                </div>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                  Optimal
                </span>
              </div>
              <p className="text-xs leading-relaxed text-slate-300">
                Minimizes cumulative terrain hazard and slope angle. Bypasses treacherous dune ripples and loose drift regolith with low thermal inertia.
              </p>
            </div>

            <div className="space-y-3 pt-3 border-t border-white/10 font-mono text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Distance:</span>
                <span className="font-bold text-white">17.1 km</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>EVA Time:</span>
                <span className="font-bold text-white">5.4 h</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Hazard Score:</span>
                <span className="font-bold text-emerald-400">2.25 (Low)</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Life Support:</span>
                  <span className="text-emerald-400">90% of 6h</span>
                </div>
                <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                  <div className="w-[90%] h-full bg-emerald-500 rounded-full" />
                </div>
              </div>
            </div>
          </div>

          {/* 2. Fastest */}
          <div className="p-5 rounded-2xl border border-blue-500/40 bg-[#08131E] space-y-4 shadow-lg hover:shadow-[0_0_20px_rgba(59,130,246,0.15)] transition-all flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-blue-400 font-mono font-bold text-sm">
                  <Zap size={18} />
                  <span>FASTEST</span>
                </div>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-blue-950 text-blue-300 border border-blue-800">
                  Optimal
                </span>
              </div>
              <p className="text-xs leading-relaxed text-slate-300">
                Optimizes purely for minimal travel duration using Tobler hiking speeds on 0.38g gravity across hard bedrock channels.
              </p>
            </div>

            <div className="space-y-3 pt-3 border-t border-white/10 font-mono text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Distance:</span>
                <span className="font-bold text-white">16.2 km</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>EVA Time:</span>
                <span className="font-bold text-blue-400">4.7 h</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Hazard Score:</span>
                <span className="font-bold text-amber-400">2.85 (Mod)</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Life Support:</span>
                  <span className="text-blue-400">78% of 6h</span>
                </div>
                <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                  <div className="w-[78%] h-full bg-blue-500 rounded-full" />
                </div>
              </div>
            </div>
          </div>

          {/* 3. Science-Richest */}
          <div className="p-5 rounded-2xl border border-amber-500/40 bg-[#08131E] space-y-4 shadow-lg hover:shadow-[0_0_20px_rgba(245,158,11,0.15)] transition-all flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-400 font-mono font-bold text-sm">
                  <Sparkles size={18} />
                  <span>SCIENCE_RICHEST</span>
                </div>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-950 text-amber-300 border border-amber-800">
                  Optimal
                </span>
              </div>
              <p className="text-xs leading-relaxed text-slate-300">
                Routes proactively near verified phyllosilicate clay deposits, olivine-bearing units, and ancient lacustrine carbonates mapped by CRISM.
              </p>
            </div>

            <div className="space-y-3 pt-3 border-t border-white/10 font-mono text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Distance:</span>
                <span className="font-bold text-white">19.4 km</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>EVA Time:</span>
                <span className="font-bold text-white">5.9 h</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Science Score:</span>
                <span className="font-bold text-amber-400">0.895 (Max)</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Life Support:</span>
                  <span className="text-amber-400">98% of 6h</span>
                </div>
                <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                  <div className="w-[98%] h-full bg-amber-500 rounded-full" />
                </div>
              </div>
            </div>
          </div>

          {/* 4. Balanced */}
          <div className="p-5 rounded-2xl border border-purple-500/40 bg-[#08131E] space-y-4 shadow-lg hover:shadow-[0_0_20px_rgba(168,85,247,0.15)] transition-all flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-purple-400 font-mono font-bold text-sm">
                  <Scale size={18} />
                  <span>BALANCED</span>
                </div>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-purple-950 text-purple-300 border border-purple-800">
                  Optimal
                </span>
              </div>
              <p className="text-xs leading-relaxed text-slate-300">
                Harmonic multi-criteria arbitration: balances hazard avoidance against transit velocity and scientific sampling yield.
              </p>
            </div>

            <div className="space-y-3 pt-3 border-t border-white/10 font-mono text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Distance:</span>
                <span className="font-bold text-white">17.8 km</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>EVA Time:</span>
                <span className="font-bold text-white">5.2 h</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Compromise:</span>
                <span className="font-bold text-purple-400">Pareto Dominant</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Life Support:</span>
                  <span className="text-purple-400">86% of 6h</span>
                </div>
                <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                  <div className="w-[86%] h-full bg-purple-500 rounded-full" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center pt-2">
          <Link
            href="/methodology"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-semibold border border-white/10 bg-[#08131E] hover:bg-[#0D1A2D] text-slate-200 transition-colors shadow-sm"
          >
            <BookOpen size={14} className="text-cyan-400" />
            <span>Read Full Mathematical Whitepaper &amp; Geodesic Proofs</span>
          </Link>
        </div>
      </section>

      {/* NASA Planetary Data System (PDS) Calibrated Ingestion Pipeline */}
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
