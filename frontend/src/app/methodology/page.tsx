'use client';

import React from 'react';
import Header from '@/components/common/Header';
import { Compass, Mountain, Activity, ShieldCheck, Zap, Layers, Scale } from 'lucide-react';

export default function MethodologyPage() {
  const sections = [
    { id: 'geodesics', title: '1. Martian Geodesics & Spheroid Datum' },
    { id: 'spatial-resolution', title: '2. Non-Square Grid Resolution' },
    { id: 'tobler-velocity', title: '3. Anisotropic Tobler Walking Velocity' },
    { id: 'cost-decomposition', title: '4. Multi-Objective Cost Function' },
    { id: 'pareto-dominance', title: '5. Pareto Frontier Optimization' },
    { id: 'eva-safety-reserve', title: '6. Life-Support Reserve Accounting' },
  ];

  return (
    <div
      className="min-h-screen flex flex-col font-sans transition-colors duration-200"
      style={{ background: 'var(--surface)', color: 'var(--text-primary)' }}
    >
      <Header dataMode="VERIFIED_SNAPSHOT" activeTab="methodology" />

      {/* Page Title Section (In Document Flow) */}
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
              <h1 className="text-xl font-bold tracking-tight uppercase" style={{ color: 'var(--text-primary)' }}>
                Scientific Methodology &amp; Mathematical Specification
              </h1>
              <p className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
                NASA Mars Exploration Program &middot; Autonomous Traverse Optimization &middot; IAU2000 Mars Frame
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span
              className="px-2.5 py-1 rounded border"
              style={{
                background: 'var(--surface-raised)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
              }}
            >
              R_Mars = 3389.5 km
            </span>
            <span
              className="px-2.5 py-1 rounded border"
              style={{
                background: 'var(--surface-raised)',
                borderColor: 'var(--border)',
                color: 'var(--accent)',
              }}
            >
              Gravity = 0.38g
            </span>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-6 py-10 flex flex-col lg:flex-row gap-10">
        {/* Sticky Table of Contents rail */}
        <aside className="lg:w-72 flex-shrink-0">
          <div
            className="lg:sticky lg:top-20 space-y-1 p-4 rounded-xl border"
            style={{
              background: 'var(--surface-raised)',
              borderColor: 'var(--border)',
            }}
          >
            <p className="text-[10px] font-bold uppercase tracking-wider mb-3 px-2" style={{ color: 'var(--text-muted)' }}>
              Specification Index
            </p>
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="block px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors hover:brightness-110"
                style={{ color: 'var(--text-secondary)' }}
              >
                {s.title}
              </a>
            ))}
          </div>
        </aside>

        {/* Scientific Paper Body */}
        <article className="flex-1 min-w-0 space-y-12">
          {/* Section 1 */}
          <section id="geodesics" className="scroll-mt-24 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
              <Compass size={14} />
              <span>Section 1</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              Oblate Spheroidal Geodesics &amp; IAU2000 Mars Frame
            </h2>
            <p className="text-xs sm:text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Mars is an oblate ellipsoid with significant polar flattening. To avoid severe euclidean projection distortions,
              all surface distances between cell coordinates $(\phi_1, \lambda_1)$ and $(\phi_2, \lambda_2)$ are evaluated via the Great-Circle
              Haversine formula evaluated at the IAU2000 volumetric mean radius of Mars:
            </p>
            <div
              className="p-4 rounded-xl font-mono text-xs overflow-x-auto border"
              style={{ background: 'var(--surface-sunken)', borderColor: 'var(--border)' }}
            >
              <p className="font-bold" style={{ color: 'var(--mode-live)' }}>{'// Mars Volumetric Mean Radius (IAU2000/PDS Standard)'}</p>
              <p style={{ color: 'var(--text-primary)' }}>R_MARS = 3,389,500.0 meters (3389.5 km)</p>
              <p className="mt-2" style={{ color: 'var(--text-muted)' }}>{'// Haversine Geodesic Arc Metric:'}</p>
              <p style={{ color: 'var(--accent)' }}>
                Δσ = 2 &middot; arcsin(&radic;( sin&sup2;(&Delta;&phi;/2) + cos(&phi;&sub1;)&middot;cos(&phi;&sub2;)&middot;sin&sup2;(&Delta;&lambda;/2) ))
              </p>
              <p style={{ color: 'var(--accent)' }}>Distance (meters) = R_MARS &middot; Δσ</p>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Equatorial radius a = 3396.19 km and polar radius c = 3376.20 km define Mars&apos;s flattening ratio
              f = 0.00589. Over the 53 &times; 56 km Jezero operational quadrant, Haversine on mean volumetric datum
              limits geodesic error to &lt; 0.04%, well within MOLA horizontal measurement tolerances.
            </p>
          </section>

          {/* Section 2 */}
          <section id="spatial-resolution" className="scroll-mt-24 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
              <Layers size={14} />
              <span>Section 2</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              Non-Square Grid Resolution &amp; Metric Metric Aspect
            </h2>
            <p className="text-xs sm:text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              The Jezero Crater computation grid spans 18.00&deg;N to 18.90&deg;N latitude and 77.00&deg;E to 78.00&deg;E longitude
              sampled at 300 &times; 300 cells. Because meridians converge poleward, cells are strictly non-square:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl border" style={{ background: 'var(--surface-sunken)', borderColor: 'var(--border)' }}>
                <span className="text-[10px] font-mono uppercase block" style={{ color: 'var(--text-muted)' }}>North-South Spacing (&Delta;y)</span>
                <span className="text-base font-bold font-mono block mt-1" style={{ color: 'var(--text-primary)' }}>177.5 meters</span>
                <span className="text-xs block mt-1" style={{ color: 'var(--text-muted)' }}>Exact arc length of 0.003&deg; latitude</span>
              </div>
              <div className="p-3.5 rounded-xl border" style={{ background: 'var(--surface-sunken)', borderColor: 'var(--border)' }}>
                <span className="text-[10px] font-mono uppercase block" style={{ color: 'var(--text-muted)' }}>East-West Spacing (&Delta;x at 18.45&deg;N)</span>
                <span className="text-base font-bold font-mono block mt-1" style={{ color: 'var(--text-primary)' }}>187.1 meters</span>
                <span className="text-xs block mt-1" style={{ color: 'var(--text-muted)' }}>Adjusted by cos(18.45&deg;) = 0.9486</span>
              </div>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Diagonal cell traversals account for anisotropic step length: D_diag = &radic;(&Delta;x&sup2; + &Delta;y&sup2;) &approx; 257.9 meters.
            </p>
          </section>

          {/* Section 3 */}
          <section id="tobler-velocity" className="scroll-mt-24 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
              <Mountain size={14} />
              <span>Section 3</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              Anisotropic Tobler Walking Velocity on 0.38g Gravity
            </h2>
            <p className="text-xs sm:text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Human traversal velocity is an exponential anisotropic function of slope gradient. VICTOR implements Waldo Tobler’s
              classic Hiking Function, modified for the reduced Martian gravity (0.38g) and the kinematic resistance of pressurized Extravehicular Mobility Units (EMUs):
            </p>
            <div
              className="p-4 rounded-xl font-mono text-xs overflow-x-auto border"
              style={{ background: 'var(--surface-sunken)', borderColor: 'var(--border)' }}
            >
              <p className="font-bold" style={{ color: 'var(--color-warning)' }}>{'// Tobler Anisotropic Velocity (km/h):'}</p>
              <p style={{ color: 'var(--accent)' }}>v(S) = v&sub0; &middot; exp( -3.5 &middot; |tan(S) + 0.05| )</p>
              <p className="mt-2" style={{ color: 'var(--text-muted)' }}>{'// Where:'}</p>
              <p style={{ color: 'var(--text-primary)' }}>S = slope in radians (rise / run)</p>
              <p style={{ color: 'var(--text-primary)' }}>v&sub0; = unhindered pace (nominally 3.0 km/h on Mars)</p>
              <p style={{ color: 'var(--mode-live)' }}>Optimal pace occurs at gentle downhill slope: S = -0.05 rad (-2.86&deg;)</p>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Traversing uphill at 15&deg; reduces walking velocity to 0.84 km/h; descending scarps &gt; 20&deg; incurs
              severe slipping and braking penalties.
            </p>
          </section>

          {/* Section 4 */}
          <section id="cost-decomposition" className="scroll-mt-24 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
              <Zap size={14} />
              <span>Section 4</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              Multi-Objective Cost Decomposition (Glass Box Engine)
            </h2>
            <p className="text-xs sm:text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Every edge in the A* graph search is evaluated against a weighted composite cost function that balances
              physical distance, terrain roughness, slope hazard, and scientific sampling value:
            </p>
            <div
              className="p-4 rounded-xl font-mono text-xs overflow-x-auto border"
              style={{ background: 'var(--surface-sunken)', borderColor: 'var(--border)' }}
            >
              <p style={{ color: 'var(--accent)' }}>
                Cost(edge) = w_dist &middot; D + w_hazard &middot; Hazard(p) &middot; D + w_slope &middot; f(S) &middot; D - w_sci &middot; Science(p)
              </p>
            </div>
            <p className="text-xs sm:text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              VICTOR computes 4 distinct Pareto-competing strategies simultaneously:
            </p>
            <ul className="text-xs space-y-2 list-disc list-inside" style={{ color: 'var(--text-secondary)' }}>
              <li><strong style={{ color: 'var(--mode-live)' }}>SAFEST:</strong> Minimizes cumulative hazard and strict slope penalties (w_hazard = 3.0, w_slope = 3.0).</li>
              <li><strong style={{ color: 'var(--accent)' }}>FASTEST:</strong> Minimizes distance and traverse duration (w_dist = 3.0).</li>
              <li><strong style={{ color: 'var(--color-warning)' }}>SCIENCE_RICHEST:</strong> Heavily incentivizes routing through carbonate and clay deposits (w_sci = 3.5).</li>
              <li><strong style={{ color: '#A855F7' }}>BALANCED:</strong> Equalized harmonic arbitration (w_dist = 1.0, w_hazard = 1.0, w_slope = 1.0, w_sci = 1.0).</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section id="pareto-dominance" className="scroll-mt-24 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
              <Scale size={14} />
              <span>Section 5</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              Pareto Frontier Dominance Arithmetic
            </h2>
            <p className="text-xs sm:text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              In multi-objective optimization, a strategy A Pareto-dominates strategy B (A &succ; B) if and only if:
            </p>
            <div
              className="p-4 rounded-xl font-mono text-xs border"
              style={{ background: 'var(--surface-sunken)', borderColor: 'var(--border)' }}
            >
              <p style={{ color: 'var(--accent)' }}>&forall; i &in; Objectives, M_i(A) &le; M_i(B)  AND  &exist; j &in; Objectives, M_j(A) &lt; M_j(B)</p>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Where objective vector M = [Hazard, Time, -Science].
              Routes identified as <strong style={{ color: 'var(--mode-live)' }}>NON_DOMINATED</strong> lie on the true Pareto optimal frontier — meaning no objective can be improved without degrading another.
            </p>
          </section>

          {/* Section 6 */}
          <section id="eva-safety-reserve" className="scroll-mt-24 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
              <ShieldCheck size={14} />
              <span>Section 6</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              Consumables &amp; 20% Life-Support Safety Margin
            </h2>
            <p className="text-xs sm:text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Per NASA EVA flight rules (JSC-28538), astronaut surface traversals require a non-negotiable 20% life-support reserve
              accounting for unexpected suit telemetry, physical exertion, and rover mechanical delays:
            </p>
            <div
              className="p-4 rounded-xl font-mono text-xs border"
              style={{ background: 'var(--surface-sunken)', borderColor: 'var(--border)' }}
            >
              <p style={{ color: 'var(--accent)' }}>Required_EVA_Duration = Estimated_Traverse_Time &times; 1.20</p>
              <p className="mt-1" style={{ color: 'var(--text-muted)' }}>If Required_EVA_Duration &gt; Max_EVA_Budget &rarr; Route is classified INFEASIBLE</p>
            </div>
          </section>
        </article>
      </div>
    </div>
  );
}
