'use client';

import React from 'react';
import Link from 'next/link';
import {
  Compass, ArrowRight, ShieldCheck, Zap, FlaskConical,
  Activity, CheckCircle2,
} from 'lucide-react';
import VictorLogo from '@/components/common/VictorLogo';

export default function Home() {
  const instruments = [
    {
      name: 'MRO HiRISE',
      resolution: '0.25 m / px',
      type: 'Visible Optical Orthorectified',
      role: 'Micro-relief hazard avoidance, boulder detection, scarp detection',
      node: 'NASA PDS Geosciences',
    },
    {
      name: 'MGS MOLA + MEX HRSC',
      resolution: '200 m / px DEM',
      type: 'Digital Elevation Model',
      role: 'Terrain gradient slope modeling, Tobler metabolic expenditure',
      node: 'NASA PDS Cartography',
    },
    {
      name: 'Mars Odyssey THEMIS',
      resolution: '100 m / px',
      type: 'Thermal Inertia Proxy',
      role: 'Surface material characterization: bedrock vs loose dust/regolith',
      node: 'NASA PDS Planetary Data',
    },
    {
      name: 'MRO CRISM',
      resolution: '181 m / px MRDR',
      type: 'Spectral Mineralogy',
      role: 'Hydrated silicates, carbonates, and phyllosilicate target scoring',
      node: 'NASA PDS Geosciences Node',
    },
    {
      name: 'Perseverance MEDA',
      resolution: 'In-Situ 1 Hz',
      type: 'Environmental Package',
      role: 'Surface temperature, atmospheric pressure, and dust opacity (tau)',
      node: 'NASA PDS Atmospheres Node',
    },
  ];

  const presets = [
    {
      name: 'Séítah → Ancient Delta',
      desc: 'Perseverance landing site traverse across crater floor toward river delta.',
      start: '18.44°N, 77.45°E',
      dest: '18.48°N, 77.24°E',
      type: 'Historic Traverse',
    },
    {
      name: 'Crater Floor → Delta Fan',
      desc: 'Traverse across basaltic sands to Hawksbill Gap layered delta deposits.',
      start: '18.432°N, 77.425°E',
      dest: '18.461°N, 77.330°E',
      type: 'Sedimentary Stratigraphy',
    },
    {
      name: 'Three Forks → Margin Unit',
      desc: 'Sample cache depot route ascending to carbonate-bearing rim margin.',
      start: '18.452°N, 77.352°E',
      dest: '18.498°N, 77.240°E',
      type: 'Carbonate Exploration',
    },
    {
      name: 'Kodiak Butte Pass → Crater Rim',
      desc: 'Steep geological scouting mission toward Jezero crater northern rim.',
      start: '18.440°N, 77.385°E',
      dest: '18.490°N, 77.360°E',
      type: 'Geomorphology Scouting',
    },
  ];

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--surface)', color: 'var(--text-primary)' }}
    >
      {/* Top Banner Navigation */}
      <header
        className="h-14 border-b flex items-center justify-between px-6 sticky top-0 z-50 backdrop-blur-md"
        style={{
          background: 'var(--surface-overlay)',
          borderColor: 'var(--border)',
        }}
      >
        <div className="flex items-center gap-3">
          <VictorLogo size={32} />
          <div>
            <span className="font-bold tracking-wider text-sm" style={{ color: 'var(--text-primary)' }}>
              VICTOR
            </span>
            <span className="ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
              NASA Space Apps 2026
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/planner?tab=layers"
            className="text-xs font-medium hover:underline hidden sm:inline-block"
            style={{ color: 'var(--text-secondary)' }}
          >
            NASA Data Layers
          </Link>
          <Link
            href="/planner?tab=methodology"
            className="text-xs font-medium hover:underline hidden sm:inline-block"
            style={{ color: 'var(--text-secondary)' }}
          >
            A* Traversal Math
          </Link>
          <Link
            href="/planner"
            className="px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
            style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
          >
            <span>Launch Planner</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-16 lg:py-24 px-6 border-b" style={{ borderColor: 'var(--border)' }}>
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{
            background: 'radial-gradient(circle at 50% 20%, rgba(21, 101, 192, 0.12), transparent 70%)',
          }}
        />

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-6 border"
            style={{
              background: 'var(--surface-raised)',
              borderColor: 'var(--border-strong)',
              color: 'var(--text-secondary)',
            }}
          >
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--color-success)' }} />
            <span>Operational over Jezero Crater (18.4°N, 77.4°E) · Mars 2020 Landing Site</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight">
            Voyage Intelligence for<br />
            <span style={{ color: 'var(--accent)' }}>Terrain-aware Cartographic Routing</span>
          </h1>

          <p className="mt-6 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Mission-critical EVA path planning across Martian terrain. VICTOR computes multi-criteria A* trajectories
            governed by real NASA orbital sensors and in-situ rover observations — balancing slope gradients, thermal regolith hazards,
            and high-value astrobiological science targets.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/planner"
              className="px-6 py-3 rounded-xl font-semibold text-sm flex items-center gap-2 transition-transform hover:scale-[1.02] shadow-md"
              style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
            >
              <Compass size={18} />
              <span>Open Marswalk Planner</span>
            </Link>

            <Link
              href="/planner?section=analysis"
              className="px-6 py-3 rounded-xl font-semibold text-sm flex items-center gap-2 border transition-all"
              style={{
                background: 'var(--surface-raised)',
                borderColor: 'var(--border-strong)',
                color: 'var(--text-primary)',
              }}
            >
              <Activity size={18} style={{ color: 'var(--accent)' }} />
              <span>Route Analysis & Metrics</span>
            </Link>
          </div>

          {/* Quick Metrics Bar */}
          <div
            className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl max-w-3xl mx-auto border"
            style={{
              background: 'var(--surface-raised)',
              borderColor: 'var(--border)',
            }}
          >
            <div>
              <p className="text-xl sm:text-2xl font-bold font-mono" style={{ color: 'var(--text-primary)' }}>4 Strategies</p>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Safest, Fastest, Science, Balanced</p>
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold font-mono" style={{ color: 'var(--text-primary)' }}>0.25 m/px</p>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>MRO HiRISE Optical Fidelity</p>
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold font-mono" style={{ color: 'var(--text-primary)' }}>4 Missions</p>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>NASA PDS Observational Pipeline</p>
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold font-mono" style={{ color: 'var(--text-primary)' }}>Tobler Math</p>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Martian Metabolic Velocity</p>
            </div>
          </div>
        </div>
      </section>

      {/* Core Architectural Pillars */}
      <section className="py-16 px-6 max-w-6xl mx-auto w-full">
        <div className="text-center mb-12">
          <p className="section-heading mb-1">Autonomous Traversal Architecture</p>
          <h2 className="text-2xl sm:text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Built for Astronaut Safety & Scientific Maximization
          </h2>
          <p className="text-sm mt-2 max-w-xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
            Each trajectory point is evaluated in real-time against physical constraints derived from orbital telemetry.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div
            className="p-6 rounded-2xl border transition-all hover:shadow-md"
            style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)' }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
              style={{ background: 'rgba(22, 163, 74, 0.1)', color: 'var(--color-success)' }}
            >
              <ShieldCheck size={22} />
            </div>
            <h3 className="text-base font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
              Deterministic Hazard Avoidance
            </h3>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Combines slope steepness from MOLA elevation with THEMIS thermal inertia proxies to steer clear of
              fine dust traps, boulder fields, and steep escarpments exceeding astronaut suit tilt envelopes.
            </p>
            <div className="mt-4 pt-4 border-t flex items-center gap-1.5 text-[11px] font-mono" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
              <CheckCircle2 size={13} style={{ color: 'var(--color-success)' }} />
              <span>Real-time slope thresholding (5°–30°)</span>
            </div>
          </div>

          <div
            className="p-6 rounded-2xl border transition-all hover:shadow-md"
            style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)' }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
              style={{ background: 'rgba(21, 101, 192, 0.1)', color: 'var(--accent)' }}
            >
              <FlaskConical size={22} />
            </div>
            <h3 className="text-base font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
              CRISM Mineralogical Optimization
            </h3>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Ingests CRISM spectral observations (OLINDEX3 and CINDEX2) to route astronauts toward high-yield
              phyllosilicates, carbonates, and ancient sedimentary deltas with the greatest biosignature potential.
            </p>
            <div className="mt-4 pt-4 border-t flex items-center gap-1.5 text-[11px] font-mono" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
              <CheckCircle2 size={13} style={{ color: 'var(--accent)' }} />
              <span>Per-segment scientific return scoring</span>
            </div>
          </div>

          <div
            className="p-6 rounded-2xl border transition-all hover:shadow-md"
            style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)' }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
              style={{ background: 'rgba(217, 119, 6, 0.1)', color: 'var(--color-warning)' }}
            >
              <Zap size={22} />
            </div>
            <h3 className="text-base font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
              Consumables & Tobler Dynamics
            </h3>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Calculates astronaut travel time using a Mars-adapted Tobler hiking function:
              $W = v_0 \cdot \exp(-3.5 \cdot |\tan(\theta) + 0.05|)$, ensuring metabolic expenditure stays within strict EVA oxygen limits.
            </p>
            <div className="mt-4 pt-4 border-t flex items-center gap-1.5 text-[11px] font-mono" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
              <CheckCircle2 size={13} style={{ color: 'var(--color-warning)' }} />
              <span>Metabolic cost & EVA margin tracking</span>
            </div>
          </div>
        </div>
      </section>

      {/* NASA Instrument Provenance Matrix */}
      <section className="py-12 px-6 border-y" style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)' }}>
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
            <div>
              <p className="section-heading mb-1">Data Provenance & Sensor Pipeline</p>
              <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                Ingested NASA Planetary Data System Products
              </h2>
            </div>
            <Link
              href="/planner?tab=layers"
              className="text-xs font-semibold flex items-center gap-1 hover:underline"
              style={{ color: 'var(--accent)' }}
            >
              <span>View Data Layers Inspector</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface-sunken)' }}>
                  <th className="py-3 px-4 font-semibold" style={{ color: 'var(--text-primary)' }}>Mission / Instrument</th>
                  <th className="py-3 px-4 font-semibold" style={{ color: 'var(--text-primary)' }}>Resolution</th>
                  <th className="py-3 px-4 font-semibold" style={{ color: 'var(--text-primary)' }}>Dataset Type</th>
                  <th className="py-3 px-4 font-semibold" style={{ color: 'var(--text-primary)' }}>Operational Role in VICTOR</th>
                  <th className="py-3 px-4 font-semibold" style={{ color: 'var(--text-primary)' }}>PDS Node</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {instruments.map((inst) => (
                  <tr key={inst.name} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4 font-bold font-mono" style={{ color: 'var(--text-primary)' }}>{inst.name}</td>
                    <td className="py-3 px-4 font-mono" style={{ color: 'var(--text-secondary)' }}>{inst.resolution}</td>
                    <td className="py-3 px-4" style={{ color: 'var(--text-secondary)' }}>{inst.type}</td>
                    <td className="py-3 px-4" style={{ color: 'var(--text-secondary)' }}>{inst.role}</td>
                    <td className="py-3 px-4 font-mono text-[11px]" style={{ color: 'var(--accent)' }}>{inst.node}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Mission Presets Showcase */}
      <section className="py-16 px-6 max-w-6xl mx-auto w-full">
        <div className="text-center mb-10">
          <p className="section-heading mb-1">Standardized Traversal Scenarios</p>
          <h2 className="text-2xl sm:text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Preconfigured Jezero Crater Missions
          </h2>
          <p className="text-xs sm:text-sm mt-2 max-w-lg mx-auto" style={{ color: 'var(--text-secondary)' }}>
            Launch directly into documented geological corridors traversed by NASA&apos;s Perseverance rover.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {presets.map((preset) => (
            <Link
              key={preset.name}
              href="/planner"
              className="p-5 rounded-xl border flex flex-col justify-between transition-all hover:scale-[1.02] hover:shadow-md group"
              style={{
                background: 'var(--surface-raised)',
                borderColor: 'var(--border)',
              }}
            >
              <div>
                <span
                  className="text-[10px] font-mono uppercase px-2 py-0.5 rounded font-semibold inline-block mb-2"
                  style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}
                >
                  {preset.type}
                </span>
                <h3 className="font-bold text-sm mb-1 group-hover:text-blue-600 transition-colors" style={{ color: 'var(--text-primary)' }}>
                  {preset.name}
                </h3>
                <p className="text-xs leading-relaxed mt-2" style={{ color: 'var(--text-muted)' }}>
                  {preset.desc}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t text-[11px] font-mono flex items-center justify-between" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                <span>{preset.start}</span>
                <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" style={{ color: 'var(--accent)' }} />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto py-8 px-6 border-t" style={{ borderColor: 'var(--border)', background: 'var(--surface-sunken)' }}>
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
          <div className="flex items-center gap-2">
            <span className="font-bold" style={{ color: 'var(--text-primary)' }}>VICTOR</span>
            <span>· NASA Space Apps Challenge 2026</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/planner?tab=about" className="hover:underline">About VICTOR</Link>
            <Link href="/planner?tab=methodology" className="hover:underline">Methodology & Math</Link>
            <Link href="/planner?tab=science" className="hover:underline">Science Targets</Link>
            <Link href="/planner?section=status" className="hover:underline">System Status</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
