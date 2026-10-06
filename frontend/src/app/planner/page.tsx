'use client';
import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import type {
  Coordinate, RouteStrategy, ActiveLayer, ScienceTarget,
  SegmentEvidenceResponse, RouteComputeResponse, DataMode, MissionConstraints,
} from '@/types';
import { STRATEGY_META } from '@/types';
import {
  computeRoutes, getDemoRoutes, getHealth, getScienceTargets, getSegmentEvidence
} from '@/services/api';
import Header from '@/components/common/Header';
import Sidebar from '@/components/sidebar/Sidebar';
import LayerControl from '@/components/map/LayerControl';
import RouteComparisonTable from '@/components/panels/RouteComparisonTable';
import EvidencePopup from '@/components/panels/EvidencePopup';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { MapPin, Play, AlertTriangle } from 'lucide-react';

// Dynamic import for Leaflet (SSR unsafe)
const MarsMap = dynamic(() => import('@/components/map/MarsMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#0D1020]">
      <div className="text-center text-gray-500">
        <div className="skeleton w-24 h-24 rounded-full mx-auto mb-4" />
        <p className="text-sm">Loading Mars terrain…</p>
      </div>
    </div>
  ),
});

const DEFAULT_CONSTRAINTS: MissionConstraints = {
  max_slope_deg: 20,
  max_eva_hours: 6,
  walking_speed_kmh: 3,
};

const DEFAULT_LAYERS: ActiveLayer[] = [
  { id: 'terrain', visible: true, opacity: 1 },
  { id: 'elevation', visible: false, opacity: 0.7 },
  { id: 'hazard', visible: false, opacity: 0.6 },
  { id: 'science', visible: false, opacity: 0.6 },
  { id: 'perseverance_traverse', visible: false, opacity: 0.8 },
];

type PinMode = 'start' | 'destination' | null;

export default function PlannerPage() {
  // Map state
  const [pinMode, setPinMode] = useState<PinMode>('start');
  const [start, setStart] = useState<Coordinate | null>(null);
  const [destination, setDestination] = useState<Coordinate | null>(null);
  const [layers, setLayers] = useState<ActiveLayer[]>(DEFAULT_LAYERS);
  const [scienceTargets, setScienceTargets] = useState<ScienceTarget[]>([]);

  // Route state
  const [isComputing, setIsComputing] = useState(false);
  const [routeResult, setRouteResult] = useState<RouteComputeResponse | null>(null);
  const [activeStrategy, setActiveStrategy] = useState<RouteStrategy | null>(null);
  const [constraints, setConstraints] = useState<MissionConstraints>(DEFAULT_CONSTRAINTS);
  const [computeError, setComputeError] = useState<string | null>(null);

  // Evidence state
  const [evidence, setEvidence] = useState<SegmentEvidenceResponse | null>(null);
  const [evidenceStrategy, setEvidenceStrategy] = useState<RouteStrategy | null>(null);
  const [evidenceLoading, setEvidenceLoading] = useState(false);

  // UI state
  const [dataMode, setDataMode] = useState<DataMode | null>(null);
  const [activeTab, setActiveTab] = useState('planner');
  const [sidebarSection, setSidebarSection] = useState('plan');
  const [showSciencePanel, setShowSciencePanel] = useState(false);
  const [scienceLabel, setScienceLabel] = useState('');

  // Fetch health, science targets, and precomputed demo routes on mount
  useEffect(() => {
    getHealth()
      .then((h) => setDataMode(h.data_mode))
      .catch(() => setDataMode('DEMONSTRATION'));

    getScienceTargets()
      .then((r) => {
        setScienceTargets(r.targets ?? []);
        setScienceLabel(r.label ?? '');
      })
      .catch(() => {});

    getDemoRoutes()
      .then((demo) => {
        setRouteResult(demo);
        setStart({ lat: 18.44, lon: 77.45 });
        setDestination({ lat: 18.48, lon: 77.24 });
        setShowSciencePanel(true);
        setActiveStrategy('BALANCED');
        setPinMode(null);
      })
      .catch(() => {});
  }, []);

  const handleMapClick = useCallback(
    (coord: Coordinate) => {
      if (pinMode === 'start') {
        setStart(coord);
        setPinMode('destination');
      } else if (pinMode === 'destination') {
        setDestination(coord);
        setPinMode(null);
      }
    },
    [pinMode],
  );

  const handleSegmentClick = useCallback(
    async (strategy: RouteStrategy, segmentId: number) => {
      if (!routeResult) return;
      setEvidenceLoading(true);
      try {
        const ev = await getSegmentEvidence(routeResult.computation_id, segmentId, strategy);
        setEvidence(ev);
        setEvidenceStrategy(strategy);
      } catch (_e) {
        // Silently fail — evidence is optional
      } finally {
        setEvidenceLoading(false);
      }
    },
    [routeResult],
  );

  const handleComputeRoutes = async () => {
    if (!start || !destination) {
      setComputeError('Place start and destination markers on the map first.');
      return;
    }
    setComputeError(null);
    setIsComputing(true);
    setRouteResult(null);
    setEvidence(null);

    try {
      const result = await computeRoutes({
        start,
        destination,
        constraints,
        strategies: ['SAFEST', 'FASTEST', 'SCIENCE_RICHEST', 'BALANCED'],
      });
      setRouteResult(result);
      setActiveStrategy(null);
      setShowSciencePanel(true);
    } catch (e: any) {
      setComputeError(e.message ?? 'Route computation failed. Check that the backend is running.');
    } finally {
      setIsComputing(false);
    }
  };

  // Build science profile chart data
  const chartData = activeStrategy && routeResult
    ? (routeResult.strategies[activeStrategy]?.segments ?? []).map((seg, i) => ({
        km: (seg.distance_m * i / 1000).toFixed(2),
        science: parseFloat(seg.science_value.toFixed(4)),
        hazard: parseFloat(seg.hazard_score.toFixed(3)),
      }))
    : [];

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: '#07101C' }}>
      <Header dataMode={dataMode} activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar activeSection={sidebarSection} onSectionChange={setSidebarSection} />

        {/* Center — map + bottom panels */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Map area */}
          <div className="relative flex-1 overflow-hidden">
            <MarsMap
              start={start}
              destination={destination}
              routes={routeResult?.strategies ?? {}}
              activeLayers={layers}
              scienceTargets={scienceTargets}
              onMapClick={handleMapClick}
              onSegmentClick={handleSegmentClick}
              activeStrategy={activeStrategy}
            />

            {/* Map control bar */}
            <div
              className="absolute top-3 left-3 flex items-center gap-2 z-10"
              style={{ pointerEvents: 'auto' }}
            >
              {/* Pin mode buttons */}
              <button
                id="btn-place-start"
                onClick={() => setPinMode('start')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${
                  pinMode === 'start'
                    ? 'bg-green-600 text-white'
                    : 'bg-[#0D1F33]/90 text-gray-300 border border-white/10 hover:bg-white/10'
                }`}
              >
                <MapPin size={11} />
                Start
              </button>
              <button
                id="btn-place-dest"
                onClick={() => setPinMode('destination')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${
                  pinMode === 'destination'
                    ? 'bg-red-600 text-white'
                    : 'bg-[#0D1F33]/90 text-gray-300 border border-white/10 hover:bg-white/10'
                }`}
              >
                <MapPin size={11} />
                Destination
              </button>
              {(start || destination) && (
                <button
                  id="btn-clear-pins"
                  onClick={() => { setStart(null); setDestination(null); setPinMode('start'); setRouteResult(null); }}
                  className="px-2.5 py-1.5 rounded text-xs text-gray-500 border border-white/10 bg-[#0D1F33]/90 hover:text-gray-300 hover:bg-white/10 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>

            {/* DEMONSTRATION mode warning */}
            {dataMode === 'DEMONSTRATION' && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-3 py-1.5 rounded text-xs text-amber-400 border border-amber-600/40 bg-amber-900/30">
                <AlertTriangle size={12} />
                DEMONSTRATION DATA — Not real NASA observations
              </div>
            )}

            {/* Evidence loading spinner */}
            {evidenceLoading && (
              <div className="absolute top-12 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-1.5 rounded text-xs text-blue-300 border border-blue-600/40 bg-[#0D1F33]/90 shadow-lg backdrop-blur">
                <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                Querying NASA instrument data...
              </div>
            )}

            {/* Evidence popup */}
            {evidence && evidenceStrategy && (
              <EvidencePopup
                evidence={evidence}
                strategyName={STRATEGY_META[evidenceStrategy].label}
                strategyColor={STRATEGY_META[evidenceStrategy].color}
                onClose={() => setEvidence(null)}
              />
            )}
          </div>

          {/* Bottom panel — route analysis */}
          {showSciencePanel && routeResult && (
            <div
              className="border-t flex-shrink-0"
              style={{
                background: '#0D1929',
                borderColor: 'rgba(255,255,255,0.08)',
                height: '200px',
              }}
            >
              <div className="flex h-full">
                {/* Chart */}
                <div className="flex-1 p-3">
                  <p className="section-heading mb-2">
                    {activeStrategy
                      ? `${STRATEGY_META[activeStrategy].label} — Science Profile`
                      : 'Select a route strategy to see science profile'}
                  </p>
                  {activeStrategy && chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={150}>
                      <AreaChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="km" tick={{ fontSize: 10 }} label={{ value: 'km', position: 'insideRight', fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} domain={[0, 1]} />
                        <Tooltip
                          contentStyle={{ background: '#0D1F33', border: '1px solid rgba(255,255,255,0.1)', fontSize: 11 }}
                          labelStyle={{ color: '#8A9AB5' }}
                        />
                        <Area type="monotone" dataKey="science" stroke="#22C55E" fill="#22C55E20" strokeWidth={1.5} name="Science (MODEL)" />
                        <Area type="monotone" dataKey="hazard" stroke="#EF4444" fill="#EF444420" strokeWidth={1} name="Hazard" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-32 flex items-center justify-center">
                      <p className="text-gray-600 text-xs">Click a strategy row to view its profile</p>
                    </div>
                  )}
                </div>

                {/* Trade-off summary */}
                <div className="w-64 border-l p-3" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  <p className="section-heading mb-2">Trade-off Summary</p>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    {routeResult.comparison.trade_off_summary}
                  </p>
                  {dataMode === 'DEMONSTRATION' && (
                    <p className="text-[10px] text-amber-600 mt-2">
                      Values computed from DEMONSTRATION data
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right panel — 300px */}
        <div
          className="w-[300px] flex-shrink-0 flex flex-col border-l overflow-y-auto"
          style={{ background: '#0B1929', borderColor: 'rgba(255,255,255,0.08)' }}
        >
          {/* Mission parameters */}
          <div className="p-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <p className="section-heading mb-3">Mission Parameters</p>
            <div className="space-y-3">
              <div>
                <label className="metric-label block mb-1" htmlFor="max-slope">
                  Max Slope ({constraints.max_slope_deg}°)
                </label>
                <input
                  id="max-slope"
                  type="range" min={5} max={30} step={1}
                  value={constraints.max_slope_deg}
                  onChange={(e) => setConstraints((c) => ({ ...c, max_slope_deg: +e.target.value }))}
                  className="w-full h-1 accent-blue-500"
                />
              </div>
              <div>
                <label className="metric-label block mb-1" htmlFor="eva-hours">
                  Max EVA ({constraints.max_eva_hours}h)
                </label>
                <input
                  id="eva-hours"
                  type="range" min={1} max={12} step={0.5}
                  value={constraints.max_eva_hours}
                  onChange={(e) => setConstraints((c) => ({ ...c, max_eva_hours: +e.target.value }))}
                  className="w-full h-1 accent-blue-500"
                />
              </div>
              <div>
                <label className="metric-label block mb-1" htmlFor="walk-speed">
                  Walk Speed ({constraints.walking_speed_kmh} km/h)
                </label>
                <input
                  id="walk-speed"
                  type="range" min={0.5} max={6} step={0.5}
                  value={constraints.walking_speed_kmh}
                  onChange={(e) => setConstraints((c) => ({ ...c, walking_speed_kmh: +e.target.value }))}
                  className="w-full h-1 accent-blue-500"
                />
              </div>
            </div>

            {/* Pins status */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className={`rounded px-2 py-1.5 text-xs ${start ? 'bg-green-900/30 text-green-400 border border-green-700/30' : 'bg-white/5 text-gray-600 border border-white/5'}`}>
                {start ? `▲ ${start.lat.toFixed(3)}°N` : 'No start set'}
              </div>
              <div className={`rounded px-2 py-1.5 text-xs ${destination ? 'bg-red-900/30 text-red-400 border border-red-700/30' : 'bg-white/5 text-gray-600 border border-white/5'}`}>
                {destination ? `● ${destination.lat.toFixed(3)}°N` : 'No dest set'}
              </div>
            </div>

            {/* Compute button */}
            <button
              id="btn-compute-routes"
              onClick={handleComputeRoutes}
              disabled={isComputing || !start || !destination}
              className="mt-3 w-full py-2 rounded font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: !isComputing && start && destination
                  ? 'linear-gradient(135deg, #1565C0, #1E88E5)'
                  : undefined,
                color: 'white',
              }}
            >
              {isComputing ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Computing…
                </>
              ) : (
                <>
                  <Play size={13} />
                  Compute Routes
                </>
              )}
            </button>
            {computeError && (
              <p className="mt-2 text-xs text-red-400 flex items-center gap-1">
                <AlertTriangle size={11} />
                {computeError}
              </p>
            )}
          </div>

          {/* Route comparison */}
          {routeResult && (
            <div className="p-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <p className="section-heading mb-2">Route Comparison</p>
              <RouteComparisonTable
                routes={routeResult.strategies}
                pareto={routeResult.pareto}
                activeStrategy={activeStrategy}
                onStrategySelect={(s) => setActiveStrategy((prev) => (prev === s ? null : s))}
              />
            </div>
          )}

          {/* Science targets nearby */}
          {activeStrategy && routeResult?.strategies[activeStrategy]?.science_targets_nearby?.length ? (
            <div className="p-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <p className="section-heading mb-2">Nearby Science Targets</p>
              <p className="text-[10px] text-amber-600 mb-2">{scienceLabel || 'MODEL scores — not direct measurements'}</p>
              {routeResult.strategies[activeStrategy]!.science_targets_nearby.slice(0, 5).map((t) => (
                <div key={t.id} className="pathwise-panel p-2 mb-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs text-gray-200 font-medium leading-tight">{t.name}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">{t.type}</p>
                    </div>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded font-bold flex-shrink-0"
                      style={{
                        color: ['#22C55E','#86EFAC','#FCD34D','#9CA3AF'][t.tier-1],
                        background: `${['#22C55E','#86EFAC','#FCD34D','#9CA3AF'][t.tier-1]}20`,
                      }}
                    >
                      T{t.tier}
                    </span>
                  </div>
                  {t.distance_from_route_m !== undefined && (
                    <p className="text-[10px] text-gray-600 mt-1">
                      {t.distance_from_route_m.toFixed(0)}m from route
                      {t.detour_cost_minutes !== undefined && ` · +${t.detour_cost_minutes.toFixed(0)} min detour`}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : null}

          {/* Layer control */}
          <div className="p-0 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <div className="px-3 pt-3 pb-0">
              <p className="section-heading">Layers</p>
            </div>
            <LayerControl layers={layers} onChange={setLayers} />
          </div>

          {/* Data mode note */}
          <div className="p-3">
            <div
              className={`text-[10px] px-2 py-1.5 rounded leading-relaxed ${
                dataMode === 'DEMONSTRATION'
                  ? 'text-amber-600 bg-amber-900/20 border border-amber-700/30'
                  : 'text-blue-500 bg-blue-900/20 border border-blue-700/30'
              }`}
            >
              {dataMode === 'DEMONSTRATION'
                ? 'DEMONSTRATION mode. Data is synthetic, modeled on published Jezero geology. Not real NASA observations.'
                : 'VERIFIED_SNAPSHOT mode. Data from pre-downloaded NASA instruments (MOLA, CRISM, THEMIS).'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
