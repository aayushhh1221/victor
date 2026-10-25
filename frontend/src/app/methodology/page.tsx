'use client';

import React from 'react';
import Link from 'next/link';
import Header from '@/components/common/Header';
import { Compass, Mountain, ShieldCheck, Zap, Scale, AlertTriangle, ArrowRight } from 'lucide-react';

export default function MethodologyPage() {
  const sections = [
    { id: 'geodesics', title: '1. Coordinates and Distance' },
    { id: 'slope-speed', title: '2. Terrain Slope and Traversal Speed' },
    { id: 'trade-offs', title: '3. Multi-Objective Route Strategies' },
    { id: 'pareto', title: '4. Evaluating Trade-offs' },
    { id: 'reserves', title: '5. Time and Reserve Margins' },
    { id: 'limitations', title: '6. Limitations and Assumptions' },
  ];

  return (
    <div
      className="min-h-screen flex flex-col font-sans"
      style={{ background: 'var(--surface)', color: 'var(--text-primary)' }}
    >
      <Header activeTab="methodology" />

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
              <Compass size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                How VICTOR evaluates routes
              </h1>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Terrain-aware pathfinding models, traversal speed estimations, and trade-offs in Jezero Crater.
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
              Mars Radius: 3,389.5 km
            </span>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-6 py-10 flex flex-col lg:flex-row gap-10">
        {/* Table of Contents rail */}
        <aside className="lg:w-64 flex-shrink-0">
          <div
            className="lg:sticky lg:top-20 space-y-1 p-4 rounded-xl border"
            style={{
              background: 'var(--surface-raised)',
              borderColor: 'var(--border)',
            }}
          >
            <p className="section-heading mb-3 px-2">
              Outline
            </p>
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="block px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-[var(--surface-sunken)]"
                style={{ color: 'var(--text-secondary)' }}
              >
                {s.title}
              </a>
            ))}
          </div>
        </aside>

        {/* Article Body */}
        <article className="flex-1 min-w-0 space-y-10">
          {/* Section 1 */}
          <section id="geodesics" className="scroll-mt-24 space-y-3">
            <h2 className="text-lg font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              1. Coordinates and Distance Calculation
            </h2>
            <p className="text-xs sm:text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Surface distances between grid cells in Jezero Crater are calculated using spherical geodesics based on the mean volumetric radius of Mars (3,389.5 km).
            </p>
            <div
              className="p-4 rounded-xl border text-xs space-y-2 leading-relaxed"
              style={{ background: 'var(--surface-sunken)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            >
              <p>
                The Jezero study grid covers 18.00°N to 18.90°N latitude and 77.00°E to 78.00°E longitude on a 300 × 300 cell matrix. Because lines of longitude converge toward the poles, grid cell dimensions are not square: north-south step sizes are approximately 177 meters, and east-west step sizes are approximately 187 meters at 18.45°N.
              </p>
            </div>
          </section>

          {/* Section 2 */}
          <section id="slope-speed" className="scroll-mt-24 space-y-3">
            <h2 className="text-lg font-bold tracking-tight flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Mountain size={16} style={{ color: 'var(--accent)' }} />
              <span>2. Terrain Slope and Traversal Speed</span>
            </h2>
            <p className="text-xs sm:text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Walking speed is modelled as a function of terrain slope using an adapted version of Tobler&apos;s hiking function. On flat terrain, nominal walking speed is assumed to be 3.0 km/h under Mars gravity conditions.
            </p>
            <div
              className="p-4 rounded-xl border text-xs space-y-2 leading-relaxed"
              style={{ background: 'var(--surface-sunken)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            >
              <p>
                <strong>Slope effects:</strong> Gentle downhill grades allow slightly faster walking, while uphill grades reduce speed significantly. Gradients exceeding 20 degrees incur steep travel time penalties or are treated as impassable terrain depending on the selected constraints.
              </p>
            </div>
          </section>

          {/* Section 3 */}
          <section id="trade-offs" className="scroll-mt-24 space-y-3">
            <h2 className="text-lg font-bold tracking-tight flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Zap size={16} style={{ color: 'var(--accent)' }} />
              <span>3. Multi-Objective Route Strategies</span>
            </h2>
            <p className="text-xs sm:text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Different exploration scenarios require different balances between travel time, safety, and scientific sampling opportunities. The routing engine evaluates four distinct weighting profiles:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl border" style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)' }}>
                <p className="font-semibold text-sm mb-1" style={{ color: 'var(--route-safest)' }}>Safest Route</p>
                <p style={{ color: 'var(--text-secondary)' }}>
                  Prioritizes flatter terrain, lower cumulative slopes, and lower surface hazard scores, accepting longer travel distance to avoid steep or difficult ground.
                </p>
              </div>
              <div className="p-3.5 rounded-xl border" style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)' }}>
                <p className="font-semibold text-sm mb-1" style={{ color: 'var(--route-fastest)' }}>Fastest Route</p>
                <p style={{ color: 'var(--text-secondary)' }}>
                  Minimizes estimated traverse duration, following the most direct feasible path subject to the maximum allowable slope constraint.
                </p>
              </div>
              <div className="p-3.5 rounded-xl border" style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)' }}>
                <p className="font-semibold text-sm mb-1" style={{ color: 'var(--route-science-richest)' }}>Science-Weighted Route</p>
                <p style={{ color: 'var(--text-secondary)' }}>
                  Biases paths toward areas with known mineral interest, such as clay and carbonate signatures identified in CRISM data.
                </p>
              </div>
              <div className="p-3.5 rounded-xl border" style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)' }}>
                <p className="font-semibold text-sm mb-1" style={{ color: 'var(--route-balanced)' }}>Balanced Route</p>
                <p style={{ color: 'var(--text-secondary)' }}>
                  A compromise weighting that balances distance, slope difficulty, and science opportunities evenly.
                </p>
              </div>
            </div>
          </section>

          {/* Section 4 */}
          <section id="pareto" className="scroll-mt-24 space-y-3">
            <h2 className="text-lg font-bold tracking-tight flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Scale size={16} style={{ color: 'var(--accent)' }} />
              <span>4. Evaluating Trade-offs (Pareto Comparison)</span>
            </h2>
            <p className="text-xs sm:text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              When multiple candidate routes are computed, VICTOR compares their key metrics — travel time, cumulative hazard, and science score — to determine whether any route is clearly dominated by another.
            </p>
            <p className="text-xs sm:text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              A candidate route is non-dominated if no other computed route is simultaneously faster, safer, and richer in scientific opportunity. Presenting these trade-offs transparently allows mission planners to select the profile suited to their specific operational priorities.
            </p>
          </section>

          {/* Section 5 */}
          <section id="reserves" className="scroll-mt-24 space-y-3">
            <h2 className="text-lg font-bold tracking-tight flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <ShieldCheck size={16} style={{ color: 'var(--color-success)' }} />
              <span>5. Time and Reserve Margins</span>
            </h2>
            <p className="text-xs sm:text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Extravehicular activities (EVAs) require safety margins for unexpected delays and exertion. By default, VICTOR applies a planning reserve margin to estimated travel durations to determine whether a route fits within the maximum allowable mission time budget.
            </p>
          </section>

          {/* Section 6 */}
          <section id="limitations" className="scroll-mt-24 space-y-3">
            <h2 className="text-lg font-bold tracking-tight flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <AlertTriangle size={16} style={{ color: 'var(--color-warning)' }} />
              <span>6. Limitations and Assumptions</span>
            </h2>
            <div
              className="p-4 rounded-xl border text-xs space-y-3 leading-relaxed"
              style={{ background: 'var(--surface-sunken)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            >
              <p>
                <strong>Grid resolution:</strong> The elevation model has an effective spatial resolution of approximately 177–187 meters per cell. Micro-topographic obstacles such as boulders, small craters, and narrow crevices below grid resolution are not visible to the solver.
              </p>
              <p>
                <strong>Planning tool only:</strong> Outputs from VICTOR are intended for conceptual exploration and challenge evaluation. They do not constitute operational guidance or certified flight plans.
              </p>
            </div>
          </section>

          {/* Action Link */}
          <div className="pt-6 border-t flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
            <Link
              href="/data"
              className="text-xs font-medium hover:underline"
              style={{ color: 'var(--accent)' }}
            >
              ← Inspect Data Sources
            </Link>
            <Link
              href="/planner"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm"
              style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
            >
              <span>Open Mission Planner</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </article>
      </div>

      {/* Footer Disclosure */}
      <footer className="border-t py-6 px-6 text-center text-xs mt-auto" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
        <p>VICTOR is an independent NASA Space Apps Challenge project. It is not an official NASA product or mission-operations tool.</p>
      </footer>
    </div>
  );
}
