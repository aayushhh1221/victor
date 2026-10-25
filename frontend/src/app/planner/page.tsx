'use client';
import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import type {
  Coordinate, RouteStrategy, ActiveLayer, ScienceTarget,
  SegmentEvidenceResponse, RouteComputeResponse, DataMode, MissionConstraints, HealthResponse,
  RegionInfo, EnvironmentResponse,
} from '@/types';
import { STRATEGY_META } from '@/types';
import {
  computeRoutes, getHealth, getScienceTargets, getSegmentEvidence, getRegion,
  getEnvironment, getDemoRoutes,
} from '@/services/api';
import Header from '@/components/common/Header';
import Sidebar from '@/components/sidebar/Sidebar';
import InfoBar from '@/components/common/InfoBar';
import LayerControl from '@/components/map/LayerControl';
import TerrainClassLegend from '@/components/map/TerrainClassLegend';
import RouteComparisonTable from '@/components/panels/RouteComparisonTable';
import EvidencePopup from '@/components/panels/EvidencePopup';
import CompareScenariosView from '@/components/panels/CompareScenariosView';
import RouteAnalysisView from '@/components/panels/RouteAnalysisView';
import ScienceOppsView from '@/components/panels/ScienceOppsView';
import MissionOverviewView from '@/components/panels/MissionOverviewView';
import MissionReportView from '@/components/panels/MissionReportView';
import {
  MethodologyView, AboutView, DataSourcesView, EnvironmentalView,
  MarsExplorerView, SystemStatusView,
} from '@/components/panels/StaticViews';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import {
  MapPin, Play, AlertTriangle, Navigation, ShieldCheck, Mountain,
  FlaskConical, TrendingUp, ChevronDown, ChevronUp, Crosshair,
  Sliders, Layers, RotateCcw,
} from 'lucide-react';
import { withAlpha } from '@/utils/color';

// Dynamic import for Leaflet (SSR unsafe)
const MarsMap = dynamic(() => import('@/components/map/MarsMap'), {
  ssr: false,
  loading: () => (
    <div
      className="w-full h-full flex items-center justify-center"
      style={{ background: 'var(--surface-sunken)' }}
    >
      <div className="text-center">
        <div className="skeleton w-16 h-16 rounded-full mx-auto mb-3" />
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading Mars terrain…</p>
      </div>
    </div>
  ),
});

const DEFAULT_CONSTRAINTS: MissionConstraints = {
  max_slope_deg: 20,
  max_eva_hours: 6,
  walking_speed_kmh: 3,
};

/**
 * Initial layer state: deliberately empty.
 *
 * Which layers exist, whether they can be rendered, and their default opacity
 * are all owned by GET /api/v1/map/layers. LayerControl seeds this list from
 * that response and enables the first basemap the backend confirms it can
 * render, so the map never requests tiles for a layer we have not verified.
 */
const DEFAULT_LAYERS: ActiveLayer[] = [
  { id: 'imagery', visible: true, opacity: 1.0 },
  { id: 'perseverance_traverse', visible: false, opacity: 0.8 },
];

type PinMode = 'start' | 'destination' | null;

/** Map which sidebar sections and header tabs render as the full-page main view. */
type MainView =
  | 'planner'   // Default: map + right panel
  | 'overview'
  | 'analysis'
  | 'science'
  | 'scenarios'
  | 'report'
  | 'env'
  | 'sources'
  | 'methodology'
  | 'about'
  | 'explorer'
  | 'status';

/**
 * Navigation mapping.
 *
 * The header tabs and the sidebar are two routes into the same set of views,
 * perfectly synchronized bidirectionally.
 */

/** Header tab id → main view. */
const TAB_TO_VIEW: Record<string, MainView> = {
  planner: 'planner',
  explorer: 'explorer',
  science: 'science',
  methodology: 'methodology',
  about: 'about',
};

/** Header tab id → sidebar section id ('' = no corresponding row). */
const TAB_TO_SECTION: Record<string, string> = {
  planner: 'plan',
  explorer: 'map',
  science: 'science',
  methodology: 'methodology',
  about: '',
};

/** Sidebar section id → main view. */
const SECTION_TO_VIEW: Record<string, MainView> = {
  overview: 'overview',
  plan: 'planner',
  map: 'explorer',
  analysis: 'analysis',
  science: 'science',
  env: 'env',
  scenarios: 'scenarios',
  report: 'report',
  sources: 'sources',
  methodology: 'methodology',
  status: 'status',
};

/** Sidebar section id → header tab id ('' = no corresponding tab). */
const SECTION_TO_TAB: Record<string, string> = {
  overview: '',
  plan: 'planner',
  map: 'explorer',
  analysis: '',
  science: 'science',
  env: '',
  scenarios: '',
  report: '',
  sources: '',
  methodology: 'methodology',
  status: '',
};

export default function PlannerPage() {
  // Map state
  const [pinMode, setPinMode] = useState<PinMode>('start');
  const [start, setStart] = useState<Coordinate | null>(null);
  const [destination, setDestination] = useState<Coordinate | null>(null);
  const [focusCoord, setFocusCoord] = useState<Coordinate | null>(null);
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
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [region, setRegion] = useState<RegionInfo | null>(null);
  const [regionLoading, setRegionLoading] = useState(true);
  const [regionError, setRegionError] = useState<string | null>(null);
  // Conditions for the info-bar tooltips. Most of its fields are null by
  // design, so a failed request simply leaves the cards at — as before.
  const [environment, setEnvironment] = useState<EnvironmentResponse | null>(null);
  const [activeTab, setActiveTab] = useState('planner');
  const [sidebarSection, setSidebarSection] = useState('plan');
  const [showSciencePanel, setShowSciencePanel] = useState(false);
  const [bottomPanelCollapsed, setBottomPanelCollapsed] = useState(false);
  const [scienceLabel, setScienceLabel] = useState('');

  // Right sidebar tab state: 'solutions' | 'parameters' | 'layers'
  const [sidebarTab, setSidebarTab] = useState<'solutions' | 'parameters' | 'layers'>('solutions');
  // Quick parameter banner toggle
  const [showQuickParams, setShowQuickParams] = useState(false);
  // Optimization weight overrides state
  const [weightProfile, setWeightProfile] = useState<'balanced' | 'safest' | 'fastest' | 'science' | 'custom'>('balanced');
  const [weightOverrides, setWeightOverrides] = useState<{
    distance?: number;
    hazard?: number;
    science_penalty?: number;
  }>({});

  // Manual keyboard coordinate entry state
  const [showManualCoord, setShowManualCoord] = useState(false);
  const [manualStartLat, setManualStartLat] = useState('');
  const [manualStartLon, setManualStartLon] = useState('');
  const [manualDestLat, setManualDestLat] = useState('');
  const [manualDestLon, setManualDestLon] = useState('');
  const [coordFeedback, setCoordFeedback] = useState<string | null>(null);

  const handleApplyManualCoords = () => {
    const sLat = parseFloat(manualStartLat);
    const sLon = parseFloat(manualStartLon);
    const dLat = parseFloat(manualDestLat);
    const dLon = parseFloat(manualDestLon);

    if (isNaN(sLat) || isNaN(sLon) || isNaN(dLat) || isNaN(dLon)) {
      setCoordFeedback('All coordinates must be valid finite numbers.');
      return;
    }

    if (sLat < 18.0 || sLat > 18.9 || sLon < 77.0 || sLon > 78.0) {
      setCoordFeedback('Start coordinates must be inside Jezero bounds (18.0–18.9°N, 77.0–78.0°E).');
      return;
    }

    if (dLat < 18.0 || dLat > 18.9 || dLon < 77.0 || dLon > 78.0) {
      setCoordFeedback('Destination coordinates must be inside Jezero bounds (18.0–18.9°N, 77.0–78.0°E).');
      return;
    }

    if (Math.abs(sLat - dLat) < 0.0001 && Math.abs(sLon - dLon) < 0.0001) {
      setCoordFeedback('Start and destination must be distinct points (at least 50m apart).');
      return;
    }

    setStart({ lat: sLat, lon: sLon });
    setDestination({ lat: dLat, lon: dLon });
    setCoordFeedback('Coordinates applied successfully.');
    setPinMode(null);
  };

  // Compute the main view from both tab and sidebar state
  // Tab takes priority if it changed last, then sidebar
  const [mainView, setMainView] = useState<MainView>('planner');

  const navigateTo = useCallback((view: MainView, section: string, tab: string) => {
    setMainView(view);
    // Always assign, including '' — that clears the other nav's highlight so
    // it cannot keep showing a stale selection.
    setSidebarSection(section);
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (tab && tab !== 'planner') {
        url.searchParams.set('tab', tab);
        url.searchParams.delete('section');
      } else if (section && section !== 'plan') {
        url.searchParams.set('section', section);
        url.searchParams.delete('tab');
      } else {
        url.searchParams.delete('tab');
        url.searchParams.delete('section');
      }
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  const handleTabChange = useCallback((tab: string) => {
    navigateTo(TAB_TO_VIEW[tab] ?? 'planner', TAB_TO_SECTION[tab] ?? '', tab);
  }, [navigateTo]);

  const handleSidebarChange = useCallback((section: string) => {
    navigateTo(
      SECTION_TO_VIEW[section] ?? 'planner',
      section,
      SECTION_TO_TAB[section] ?? '',
    );
  }, [navigateTo]);

  // Deep-linking: sync initial view from URL query params on client mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      const sectionParam = params.get('section');
      if (tabParam && TAB_TO_VIEW[tabParam]) {
        navigateTo(TAB_TO_VIEW[tabParam], TAB_TO_SECTION[tabParam] ?? '', tabParam);
      } else if (sectionParam && SECTION_TO_VIEW[sectionParam]) {
        navigateTo(SECTION_TO_VIEW[sectionParam], sectionParam, SECTION_TO_TAB[sectionParam] ?? '');
      }
    }
  }, [navigateTo]);

  // Fetch health, region metadata, science targets, and demo routes on mount
  useEffect(() => {
    getHealth()
      .then((h) => {
        setDataMode(h.data_mode);
        setHealth(h);
      })
      .catch(() => setDataMode('DEMONSTRATION'));

    // Region metadata. On failure we record the reason and render — in every
    // affected card; there is deliberately no hardcoded fallback region.
    getRegion()
      .then((r) => {
        setRegion(r);
        setRegionError(null);
      })
      .catch((e: unknown) => {
        setRegion(null);
        setRegionError(e instanceof Error ? e.message : 'request failed');
      })
      .finally(() => setRegionLoading(false));

    getScienceTargets()
      .then((r) => {
        setScienceTargets(r.targets ?? []);
        setScienceLabel(r.label ?? '');
      })
      .catch(() => {});

    // Environmental conditions. Used only for tooltips and the Environmental
    // view, so a failure degrades to the same — the backend already reports.
    getEnvironment()
      .then(setEnvironment)
      .catch(() => setEnvironment(null));

    // Hydrate precomputed demo routes on initial cold start so map, cards, and profile are instantly populated
    getDemoRoutes()
      .then((demo) => {
        setRouteResult(demo);
        setActiveStrategy('BALANCED');
        const firstStrat = Object.values(demo.strategies)[0];
        if (firstStrat && firstStrat.path && firstStrat.path.length >= 2) {
          setStart(firstStrat.path[0]);
          setDestination(firstStrat.path[firstStrat.path.length - 1]);
        }
      })
      .catch(() => {});
  }, []);

  const handleMapClick = useCallback(
    (coord: Coordinate) => {
      const clamped: Coordinate = {
        lat: Math.max(18.01, Math.min(18.89, parseFloat(coord.lat.toFixed(4)))),
        lon: Math.max(77.01, Math.min(77.99, parseFloat(coord.lon.toFixed(4)))),
      };

      if (pinMode === 'start') {
        setStart(clamped);
        // If destination has not been set yet, transition to destination mode; otherwise finish placement
        setPinMode(!destination ? 'destination' : null);
        setComputeError(null);
      } else if (pinMode === 'destination') {
        setDestination(clamped);
        setPinMode(null);
        setComputeError(null);
      }
      // When pinMode is null, map clicks do NOT move pins. Markers can still be dragged directly.
    },
    [pinMode, destination],
  );

  const handlePinDrag = useCallback((type: 'start' | 'destination', coord: Coordinate) => {
    if (type === 'start') {
      setStart(coord);
    } else {
      setDestination(coord);
    }
    setComputeError(null);
  }, []);

  const triggerCompute = useCallback(
    async (
      startCoord: Coordinate,
      destCoord: Coordinate,
      overrideConstraints?: MissionConstraints,
      overrideWeights?: Record<string, number>,
    ) => {
      const dist = Math.hypot(destCoord.lat - startCoord.lat, destCoord.lon - startCoord.lon);
      if (dist < 0.001) {
        setComputeError('Start and destination must be distinct locations (at least 100m apart).');
        return;
      }
      setComputeError(null);
      setIsComputing(true);
      setEvidence(null);

      const activeConstraints = overrideConstraints || constraints;
      const activeWeights = overrideWeights || (weightProfile === 'custom' && Object.keys(weightOverrides).length > 0 ? weightOverrides : undefined);

      try {
        const payload: any = {
          start: startCoord,
          destination: destCoord,
          constraints: activeConstraints,
          strategies: ['SAFEST', 'FASTEST', 'SCIENCE_RICHEST', 'BALANCED'],
          allow_infeasible: true,
        };
        if (activeWeights && Object.keys(activeWeights).length > 0) {
          payload.weight_overrides = activeWeights;
        }
        const result = await computeRoutes(payload);
        setRouteResult(result);
        setActiveStrategy('BALANCED');
        setShowSciencePanel(true);
        setSidebarTab('solutions');
      } catch (e: any) {
        setComputeError(e.message ?? 'Route computation failed. Check that the backend is running.');
      } finally {
        setIsComputing(false);
      }
    },
    [constraints, weightProfile, weightOverrides],
  );

  const handleWeightProfileChange = (profile: 'balanced' | 'safest' | 'fastest' | 'science' | 'custom') => {
    setWeightProfile(profile);
    let newWeights: Record<string, number> = {};
    if (profile === 'safest') {
      newWeights = { distance: 0.5, hazard: 3.0, science_penalty: 0.5 };
    } else if (profile === 'fastest') {
      newWeights = { distance: 3.0, hazard: 0.3, science_penalty: 0.2 };
    } else if (profile === 'science') {
      newWeights = { distance: 0.5, hazard: 0.8, science_penalty: 3.0 };
    }
    setWeightOverrides(newWeights);
    if (start && destination) {
      triggerCompute(start, destination, constraints, Object.keys(newWeights).length > 0 ? newWeights : undefined);
    }
  };

  const handleSegmentClick = useCallback(
    async (strategy: RouteStrategy, segmentId: number) => {
      if (!routeResult) return;
      setEvidenceLoading(true);
      try {
        const ev = await getSegmentEvidence(routeResult.computation_id, segmentId, strategy);
        setEvidence(ev);
        setEvidenceStrategy(strategy);
      } catch {
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
    await triggerCompute(start, destination);
  };

  /** Whether the advisory terrain-archetype layer is currently on the map. */
  const terrainClassVisible = layers.some((l) => l.id === 'terrain_class' && l.visible);

  // Build profile chart data from active strategy segments.
  // Shows elevation change (cumulative) + terrain traversability cost — matching reference.png.
  const chartData = activeStrategy && routeResult
    ? (() => {
        let cumDist = 0;
        let cumElev = 0;
        return (routeResult.strategies[activeStrategy]?.segments ?? []).map((seg) => {
          cumDist += seg.distance_m / 1000;
          cumElev += seg.elevation_change_m;
          return {
            km: parseFloat(cumDist.toFixed(2)),
            elevation: parseFloat(cumElev.toFixed(1)),
            terrain: parseFloat(seg.traversability_cost.toFixed(2)),
          };
        });
      })()
    : [];

  // ── Data-mode provenance banner ───────────────────────────────────────────
  // Three modes, each stated plainly. VERIFIED_SNAPSHOT earns a positive badge
  // naming the actual missions behind the data, counted from the backend's
  // compliance report — never asserted by the frontend.
  const compliance = region?.compliance ?? null;
  const missionCount = compliance?.mission_count ?? null;
  const missionList = compliance?.nasa_missions?.join(', ') ?? null;

  const bannerMode: DataMode | null = dataMode;
  const banner = (() => {
    if (!bannerMode) return null;
    if (bannerMode === 'DEMONSTRATION') {
      return {
        cls: 'badge-demonstration',
        icon: <AlertTriangle size={12} />,
        text: 'SYNTHETIC DEMONSTRATION MODE',
        title: 'Running on synthetic terrain simulation — non-observational',
      };
    }
    if (bannerMode === 'VERIFIED_SNAPSHOT') {
      return {
        cls: 'badge-verified',
        icon: <ShieldCheck size={12} />,
        text:
          missionCount != null
            ? `NASA PDS Multi-Mission Baseline (${missionCount} Missions)`
            : 'NASA PDS Multi-Mission Baseline',
        title: missionList
          ? `NASA Planetary Data System (PDS) archive: ${missionList}`
          : 'NASA Planetary Data System (PDS) archive data',
      };
    }
    return {
      cls: 'badge-live',
      icon: <ShieldCheck size={12} />,
      text: 'LIVE PDS TELEMETRY STREAM',
      title: 'Live NASA Planetary Data System telemetry stream',
    };
  })();

  // ── VIEW CONTENT DISPATCHER ──────────────────────────────────────────────
  const renderMainContent = () => {
    switch (mainView) {
      case 'overview':
        return (
          <MissionOverviewView
            routeResult={routeResult}
            dataMode={dataMode}
            constraints={constraints}
            onNavigate={(id) => handleSidebarChange(id)}
          />
        );
      case 'analysis':
        return (
          <RouteAnalysisView
            routeResult={routeResult}
            activeStrategy={activeStrategy}
            onStrategyChange={setActiveStrategy}
            constraints={constraints}
          />
        );
      case 'science':
        return (
          <ScienceOppsView
            routeResult={routeResult}
            scienceTargets={scienceTargets}
            activeStrategy={activeStrategy}
            scienceLabel={scienceLabel}
          />
        );
      case 'scenarios':
        return (
          <CompareScenariosView
            routeResult={routeResult}
            baseConstraints={constraints}
            onApplyScenario={(modConstraints) => {
              setConstraints(modConstraints);
              if (start && destination) {
                triggerCompute(start, destination, modConstraints);
              }
              handleSidebarChange('plan');
            }}
          />
        );
      case 'report':
        return (
          <MissionReportView
            routeResult={routeResult}
            activeStrategy={activeStrategy}
          />
        );
      case 'env':
        return <EnvironmentalView />;
      case 'sources':
        return <DataSourcesView />;
      case 'methodology':
        return <MethodologyView />;
      case 'about':
        return <AboutView />;
      case 'explorer':
        return <MarsExplorerView onNavigate={(s) => handleSidebarChange(s)} />;
      case 'status':
        return <SystemStatusView dataMode={dataMode} health={health} />;
      case 'planner':
      default:
        return (
          <>
            {/* Center — map + bottom panels */}
            <div className="flex flex-col flex-1 overflow-hidden">
          {/* Map title bar */}
          <div
            className="flex items-center justify-between px-4 py-2 border-b flex-shrink-0"
            style={{
              background: 'var(--surface)',
              borderColor: 'var(--border)',
            }}
          >
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Mars Surface Map
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Explore terrain, hazards, and scientific features with multi-mission data
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                id="btn-toggle-quick-params"
                type="button"
                onClick={() => setShowQuickParams((v) => !v)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-all"
                style={{
                  background: showQuickParams ? 'var(--accent-light)' : 'var(--surface-sunken)',
                  borderColor: showQuickParams ? 'var(--accent)' : 'var(--border)',
                  color: showQuickParams ? 'var(--accent)' : 'var(--text-secondary)',
                  border: '1px solid',
                }}
                title="Toggle Quick Parameters & Tuning Bar"
              >
                <Sliders size={12} />
                <span className="font-mono text-[11px] hidden sm:inline">
                  {constraints.max_slope_deg}° · {constraints.max_eva_hours}h · {constraints.walking_speed_kmh}km/h
                </span>
                <span className="sm:hidden text-[11px]">Params</span>
              </button>

              {/* Pin mode buttons */}
              <button
                id="btn-place-start"
                onClick={() => setPinMode((m) => (m === 'start' ? null : 'start'))}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors`}
                style={{
                  background: pinMode === 'start' ? 'var(--pin-start)' : 'var(--surface-sunken)',
                  color: pinMode === 'start' ? 'var(--on-accent)' : 'var(--text-secondary)',
                  border: `1px solid ${pinMode === 'start' ? 'var(--pin-start)' : 'var(--border)'}`,
                }}
              >
                <MapPin size={11} /> {pinMode === 'start' ? 'Placing Start…' : 'Start'}
              </button>
              <button
                id="btn-place-dest"
                onClick={() => setPinMode((m) => (m === 'destination' ? null : 'destination'))}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors"
                style={{
                  background: pinMode === 'destination' ? 'var(--pin-dest)' : 'var(--surface-sunken)',
                  color: pinMode === 'destination' ? 'var(--on-accent)' : 'var(--text-secondary)',
                  border: `1px solid ${pinMode === 'destination' ? 'var(--pin-dest)' : 'var(--border)'}`,
                }}
              >
                <MapPin size={11} /> {pinMode === 'destination' ? 'Placing Dest…' : 'Destination'}
              </button>
              {(start || destination) && (
                <button
                  id="btn-clear-pins"
                  onClick={() => {
                    setStart(null);
                    setDestination(null);
                    setPinMode('start');
                    setRouteResult(null);
                  }}
                  className="px-2.5 py-1.5 rounded text-xs transition-colors"
                  style={{
                    color: 'var(--text-muted)',
                    border: '1px solid var(--border)',
                    background: 'var(--surface-sunken)',
                  }}
                >
                  Clear
                </button>
              )}
              <button
                id="btn-plan-route"
                onClick={handleComputeRoutes}
                disabled={isComputing || !start || !destination}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all disabled:opacity-40 shadow-sm"
                style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
              >
                {isComputing ? (
                  <>
                    <div
                      className="w-3 h-3 border-2 rounded-full animate-spin"
                      style={{
                        borderColor: withAlpha('var(--on-accent)', 30),
                        borderTopColor: 'var(--on-accent)',
                      }}
                    />
                    Computing…
                  </>
                ) : (
                  <>
                    <Navigation size={12} />
                    Plan Route
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick Parameters Tuning Bar */}
          {showQuickParams && (
            <div
              className="px-4 py-2 border-b flex-shrink-0 flex flex-wrap items-center justify-between gap-3 text-xs shadow-sm"
              style={{
                background: 'var(--surface-raised)',
                borderColor: 'var(--border)',
              }}
            >
              <div className="flex flex-wrap items-center gap-3.5 flex-1 min-w-0">
                {/* Slope slider */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>Slope:</span>
                  <input
                    type="range" min={5} max={30} step={1}
                    value={constraints.max_slope_deg}
                    onChange={(e) => setConstraints((c) => ({ ...c, max_slope_deg: +e.target.value }))}
                    className="w-16 sm:w-20 h-1 cursor-pointer"
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  <span className="font-mono font-bold text-xs" style={{ color: 'var(--text-primary)' }}>
                    {constraints.max_slope_deg}°
                  </span>
                </div>

                {/* EVA slider */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>EVA:</span>
                  <input
                    type="range" min={1} max={12} step={0.5}
                    value={constraints.max_eva_hours}
                    onChange={(e) => setConstraints((c) => ({ ...c, max_eva_hours: +e.target.value }))}
                    className="w-16 sm:w-20 h-1 cursor-pointer"
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  <span className="font-mono font-bold text-xs" style={{ color: 'var(--text-primary)' }}>
                    {constraints.max_eva_hours}h
                  </span>
                </div>

                {/* Speed slider */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>Pace:</span>
                  <input
                    type="range" min={0.5} max={6} step={0.5}
                    value={constraints.walking_speed_kmh}
                    onChange={(e) => setConstraints((c) => ({ ...c, walking_speed_kmh: +e.target.value }))}
                    className="w-16 sm:w-20 h-1 cursor-pointer"
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  <span className="font-mono font-bold text-xs" style={{ color: 'var(--text-primary)' }}>
                    {constraints.walking_speed_kmh}k/h
                  </span>
                </div>

                {/* Focus Preset */}
                <div className="hidden md:flex items-center gap-1">
                  <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>Focus:</span>
                  {(['balanced', 'safest', 'fastest', 'science'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => handleWeightProfileChange(p)}
                      className="px-1.5 py-0.5 rounded text-[10px] font-medium capitalize transition-all"
                      style={{
                        background: weightProfile === p ? 'var(--accent)' : 'var(--surface-sunken)',
                        color: weightProfile === p ? 'var(--on-accent)' : 'var(--text-secondary)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (start && destination) {
                      triggerCompute(start, destination);
                    }
                  }}
                  disabled={isComputing || !start || !destination}
                  className="px-2.5 py-1 rounded font-semibold text-xs flex items-center gap-1.5 transition-all shadow-sm"
                  style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
                >
                  <RotateCcw size={11} className={isComputing ? 'animate-spin' : ''} />
                  Re-Plan
                </button>
                <button
                  onClick={() => setShowQuickParams(false)}
                  className="text-xs px-1 text-slate-400 hover:text-white"
                  title="Close Parameters Bar"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

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
              pinMode={pinMode}
              onPinDrag={handlePinDrag}
              focusCoord={focusCoord}
              onOpenGlobalExplorer={() => handleSidebarChange('map')}
            />

            {/* Guidance banner for placing start / destination pins */}
            {pinMode && (
              <div
                className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium shadow-md backdrop-blur select-none"
                style={{
                  background: 'rgba(15, 23, 42, 0.92)',
                  border: `1px solid ${pinMode === 'start' ? 'var(--pin-start)' : 'var(--pin-dest)'}`,
                  color: '#FFFFFF',
                }}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: pinMode === 'start' ? 'var(--pin-start)' : 'var(--pin-dest)' }}
                />
                <span>Click map to place {pinMode === 'start' ? 'Start' : 'Destination'}</span>
                <button
                  onClick={() => setPinMode(null)}
                  className="ml-1 text-[11px] text-slate-400 hover:text-white px-1"
                  aria-label="Cancel"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Data-mode banner — only show when synthetic DEMONSTRATION warning is necessary */}
            {banner && bannerMode === 'DEMONSTRATION' && (
              <div
                className={`absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-3 py-1.5 rounded text-xs ${banner.cls}`}
                title={banner.title}
              >
                {banner.icon}
                {banner.text}
              </div>
            )}

            {/* Evidence loading spinner */}
            {evidenceLoading && (
              <div
                className="absolute top-12 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-1.5 rounded text-xs shadow-lg backdrop-blur"
                style={{
                  background: 'var(--surface-overlay)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                }}
              >
                <div
                  className="w-3 h-3 border-2 rounded-full animate-spin"
                  style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
                />
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

          {/* Bottom panel toggle bar */}
          {showSciencePanel && routeResult && (
            <div
              className="flex items-center justify-between px-4 py-1.5 border-t flex-shrink-0 select-none"
              style={{
                background: 'var(--surface)',
                borderColor: 'var(--border)',
              }}
            >
              <div className="flex items-center gap-2">
                <TrendingUp size={13} style={{ color: 'var(--accent)' }} />
                <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Route Analysis & Mission Profiles
                </span>
                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  ({Object.keys(routeResult.strategies).length} computed strategies)
                </span>
              </div>
              <button
                id="btn-toggle-bottom-panel"
                onClick={() => setBottomPanelCollapsed((v) => !v)}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded transition-colors font-medium hover:brightness-110"
                style={{
                  color: 'var(--text-secondary)',
                  background: 'var(--surface-sunken)',
                  border: '1px solid var(--border)',
                }}
              >
                {bottomPanelCollapsed ? (
                  <>
                    <ChevronUp size={12} /> Show Route Analysis
                  </>
                ) : (
                  <>
                    <ChevronDown size={12} /> Maximize Map View
                  </>
                )}
              </button>
            </div>
          )}

          {/* Bottom panel — three columns: Route Profile | Route Risk | Science Opps */}
          {showSciencePanel && routeResult && !bottomPanelCollapsed && (() => {
            const activeRoute = activeStrategy ? routeResult.strategies[activeStrategy] : null;
            const metrics = activeRoute?.metrics ?? null;

            // Inline risk bar helper
            const RiskBar = ({ label, value, max, color, unit = '', icon }: {
              label: string; value: number | null; max: number;
              color: string; unit?: string; icon: React.ReactNode;
            }) => {
              const pct = value != null ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
              return (
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 flex items-center justify-center rounded flex-shrink-0"
                    style={{ background: withAlpha(color, 12), color }}>
                    {icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] font-medium" style={{ color: 'var(--text-primary)' }}>{label}</span>
                      <span className="text-[10px] font-mono" style={{ color }}>
                        {value != null ? `${value.toFixed(1)}${unit}` : '—'}
                      </span>
                    </div>
                    <div className="risk-bar-track">
                      <div className="risk-bar-fill" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                </div>
              );
            };

            return (
              <div
                className="border-t flex-shrink-0 flex"
                style={{
                  background: 'var(--surface-raised)',
                  borderColor: 'var(--border)',
                  height: '220px',
                }}
              >
                {/* Column 1: Route Profile — elevation + terrain difficulty */}
                <div className="flex-1 min-w-0 p-3 border-r" style={{ borderColor: 'var(--border)' }}>
                  <p className="section-heading mb-1.5">
                    {activeStrategy ? `${STRATEGY_META[activeStrategy].label} — Route Profile` : 'Route Profile'}
                  </p>
                  <p className="text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
                    Cumulative elevation delta (Δh) and terrain traversability along route
                  </p>
                  {activeStrategy && chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={148}>
                      <LineChart data={chartData} margin={{ top: 2, right: 20, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                        <XAxis
                          dataKey="km"
                          tick={{ fontSize: 9, fill: 'var(--chart-text)' }}
                          label={{ value: 'Distance (km)', position: 'insideBottomRight', offset: -4, fontSize: 9, fill: 'var(--chart-text)' }}
                        />
                        <YAxis
                          yAxisId="elev"
                          tick={{ fontSize: 9, fill: 'var(--chart-text)' }}
                          label={{ value: 'Δ Elev (m)', angle: -90, position: 'insideLeft', offset: 12, fontSize: 9, fill: 'var(--chart-text)' }}
                        />
                        <YAxis
                          yAxisId="terrain"
                          orientation="right"
                          tick={{ fontSize: 9, fill: 'var(--chart-text)' }}
                          domain={[0, 10]}
                          label={{ value: 'Difficulty', angle: 90, position: 'insideRight', offset: 8, fontSize: 9, fill: 'var(--chart-text)' }}
                        />
                        <Tooltip
                          contentStyle={{
                            background: 'var(--surface-raised)',
                            border: '1px solid var(--border)',
                            fontSize: 11,
                            color: 'var(--text-primary)',
                          }}
                          labelStyle={{ color: 'var(--text-muted)' }}
                          labelFormatter={(v) => `${v} km`}
                        />
                        <Legend wrapperStyle={{ fontSize: 9, paddingTop: 0 }} />
                        <Line
                          yAxisId="elev"
                          type="monotone"
                          dataKey="elevation"
                          stroke="var(--accent)"
                          strokeWidth={2}
                          dot={false}
                          name="Elevation"
                        />
                        <Line
                          yAxisId="terrain"
                          type="monotone"
                          dataKey="terrain"
                          stroke="var(--color-warning)"
                          strokeWidth={1.5}
                          dot={false}
                          name="Terrain Difficulty"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-32 flex items-center justify-center">
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        Select a strategy to view its profile
                      </p>
                    </div>
                  )}
                </div>

                {/* Column 2: Route Risk Assessment */}
                <div className="w-[220px] flex-shrink-0 p-3 border-r" style={{ borderColor: 'var(--border)' }}>
                  <p className="section-heading mb-1">Route Risk Assessment</p>
                  <p className="text-[10px] mb-2" style={{ color: 'var(--text-muted)' }}>
                    Key factors affecting route safety
                  </p>
                  {metrics ? (
                    <div className="mt-1">
                      <RiskBar
                        label="Terrain Hazard"
                        value={metrics.avg_hazard_score}
                        max={10}
                        color={metrics.avg_hazard_score < 3 ? 'var(--color-success)' : metrics.avg_hazard_score < 6 ? 'var(--color-warning)' : 'var(--color-danger)'}
                        icon={<AlertTriangle size={12} />}
                      />
                      <RiskBar
                        label="Max Slope"
                        value={metrics.max_slope_deg}
                        max={30}
                        color={metrics.max_slope_deg < 10 ? 'var(--color-success)' : metrics.max_slope_deg < 20 ? 'var(--color-warning)' : 'var(--color-danger)'}
                        unit="°"
                        icon={<Mountain size={12} />}
                      />
                      <RiskBar
                        label="Science Value"
                        value={metrics.avg_science_value}
                        max={1}
                        color="var(--tier-1)"
                        icon={<FlaskConical size={12} />}
                      />
                      <RiskBar
                        label="Elevation Gain"
                        value={metrics.elevation_gain_m}
                        max={500}
                        color="var(--layer-elevation)"
                        unit=" m"
                        icon={<TrendingUp size={12} />}
                      />
                      <div className="mt-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Data Confidence</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                              metrics.confidence === 'HIGH' ? 'value-high' :
                              metrics.confidence === 'MODERATE' ? 'value-medium' : 'value-low'
                            }`}
                          >
                            {metrics.confidence}
                          </span>
                        </div>
                        {dataMode === 'DEMONSTRATION' && (
                          <p className="text-[10px] mt-1" style={{ color: 'var(--mode-demo)' }}>
                            DEMONSTRATION data
                          </p>
                        )}
                        <button
                          className="text-[10px] mt-1.5 block"
                          style={{ color: 'var(--accent)' }}
                          onClick={() => handleSidebarChange('report')}
                        >
                          Mission report &amp; briefing →
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center h-24">
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Select a strategy</p>
                    </div>
                  )}
                </div>

                {/* Column 3: Science Opportunities */}
                <div className="w-[240px] flex-shrink-0 p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="section-heading">Science Opportunities</p>
                    <button
                      className="text-[10px]"
                      style={{ color: 'var(--accent)' }}
                      onClick={() => handleSidebarChange('science')}
                    >
                      View All →
                    </button>
                  </div>
                  <p className="text-[10px] mb-2" style={{ color: 'var(--text-muted)' }}>
                    High-value targets near the route
                  </p>
                  {activeRoute?.science_targets_nearby?.length ? (
                    activeRoute.science_targets_nearby.slice(0, 3).map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center gap-2 mb-1.5 p-1.5 rounded"
                        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                      >
                        {/* Colour swatch */}
                        <div
                          className="w-8 h-8 rounded flex-shrink-0 flex items-center justify-center"
                          style={{
                            background: withAlpha(
                              ['var(--tier-1)', 'var(--tier-2)', 'var(--tier-3)', 'var(--tier-4)'][t.tier - 1] ?? 'var(--tier-4)',
                              15
                            ),
                          }}
                        >
                          <FlaskConical size={14}
                            style={{ color: ['var(--tier-1)', 'var(--tier-2)', 'var(--tier-3)', 'var(--tier-4)'][t.tier - 1] ?? 'var(--tier-4)' }}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-medium leading-tight truncate" style={{ color: 'var(--text-primary)' }}>
                            {t.name}
                          </p>
                          <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            {t.distance_from_route_m != null ? `${t.distance_from_route_m.toFixed(0)} m away` : t.type}
                          </p>
                        </div>
                        <span
                          className="text-[10px] px-1 py-0.5 rounded font-bold flex-shrink-0"
                          style={{
                            color: ['var(--tier-1)', 'var(--tier-2)', 'var(--tier-3)', 'var(--tier-4)'][t.tier - 1],
                            background: 'var(--surface-sunken)',
                          }}
                        >
                          T{t.tier}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs mt-4 text-center" style={{ color: 'var(--text-muted)' }}>
                      {activeStrategy ? 'No targets near this route' : 'Select a strategy'}
                    </p>
                  )}
                  {scienceLabel && (
                    <p className="text-[10px] mt-1" style={{ color: 'var(--mode-demo)' }}>
                      {scienceLabel}
                    </p>
                  )}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Right panel — 360px on desktop, full width on mobile */}
        <div
          className="w-full lg:w-[360px] flex-shrink-0 flex flex-col border-t lg:border-t-0 lg:border-l overflow-hidden"
          style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)' }}
        >
          {/* Sidebar Top Nav Tabs */}
          <div className="flex border-b flex-shrink-0 text-xs font-semibold select-none" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            <button
              id="tab-btn-solutions"
              onClick={() => setSidebarTab('solutions')}
              className="flex-1 py-2.5 text-center transition-all border-b-2 flex items-center justify-center gap-1.5"
              style={{
                borderColor: sidebarTab === 'solutions' ? 'var(--accent)' : 'transparent',
                color: sidebarTab === 'solutions' ? 'var(--accent)' : 'var(--text-secondary)',
                background: sidebarTab === 'solutions' ? 'var(--surface-raised)' : 'transparent',
              }}
            >
              <Navigation size={12} />
              <span>Traverse</span>
              {routeResult && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-blue-600/20 text-blue-400">
                  {Object.keys(routeResult.strategies).length}
                </span>
              )}
            </button>
            <button
              id="tab-btn-parameters"
              onClick={() => setSidebarTab('parameters')}
              className="flex-1 py-2.5 text-center transition-all border-b-2 flex items-center justify-center gap-1.5"
              style={{
                borderColor: sidebarTab === 'parameters' ? 'var(--accent)' : 'transparent',
                color: sidebarTab === 'parameters' ? 'var(--accent)' : 'var(--text-secondary)',
                background: sidebarTab === 'parameters' ? 'var(--surface-raised)' : 'transparent',
              }}
            >
              <Sliders size={12} />
              <span>Parameters</span>
            </button>
            <button
              id="tab-btn-layers"
              onClick={() => setSidebarTab('layers')}
              className="flex-1 py-2.5 text-center transition-all border-b-2 flex items-center justify-center gap-1.5"
              style={{
                borderColor: sidebarTab === 'layers' ? 'var(--accent)' : 'transparent',
                color: sidebarTab === 'layers' ? 'var(--accent)' : 'var(--text-secondary)',
                background: sidebarTab === 'layers' ? 'var(--surface-raised)' : 'transparent',
              }}
            >
              <Layers size={12} />
              <span>Layers</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* TAB 1: TRAVERSE SOLUTIONS */}
            {sidebarTab === 'solutions' && (
              <div>
                {/* Active Parameters Banner */}
                <div className="p-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)', background: 'var(--surface-sunken)' }}>
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-wider block text-slate-400">
                      Active Constraints
                    </span>
                    <span className="text-xs font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {constraints.max_slope_deg}° slope · {constraints.max_eva_hours}h EVA · {constraints.walking_speed_kmh} km/h
                    </span>
                  </div>
                  <button
                    onClick={() => setSidebarTab('parameters')}
                    className="text-[11px] px-2 py-1 rounded border font-medium transition-all hover:brightness-110"
                    style={{ borderColor: 'var(--accent)', color: 'var(--accent)', background: 'var(--surface)' }}
                  >
                    Modify
                  </button>
                </div>

                {/* Over EVA Budget Warning Banner if routes exceed budget */}
                {routeResult && Object.values(routeResult.strategies).some((r) => !r.is_feasible) && (
                  <div
                    className="m-3 p-3 rounded-lg border text-xs"
                    style={{
                      background: 'var(--color-danger-bg)',
                      borderColor: 'var(--color-danger-border)',
                      color: 'var(--color-danger)',
                    }}
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-xs">EVA Life-Support Ceiling Exceeded</p>
                        <p className="text-[11px] opacity-90 mt-0.5 leading-relaxed">
                          This traverse requires more duration than your current {constraints.max_eva_hours}h EVA budget when including the required 20% life-support safety reserve.
                        </p>
                      </div>
                    </div>
                    {(() => {
                      const maxNeeded = Math.max(
                        ...Object.values(routeResult.strategies).map((r) => r.metrics.required_eva_time_with_reserve_hours || (r.metrics.estimated_time_hours * 1.2))
                      );
                      const suggestedH = Math.min(12, Math.ceil(maxNeeded * 2) / 2);
                      return (
                        <button
                          onClick={() => {
                            const updatedConstraints = { ...constraints, max_eva_hours: suggestedH };
                            setConstraints(updatedConstraints);
                            if (start && destination) {
                              triggerCompute(start, destination, updatedConstraints);
                            }
                          }}
                          className="w-full py-1.5 px-3 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm hover:brightness-110"
                          style={{
                            background: 'var(--color-danger)',
                            color: '#FFFFFF',
                          }}
                        >
                          Adjust Max EVA to {suggestedH}h &amp; Make Feasible
                        </button>
                      );
                    })()}
                  </div>
                )}

                {/* Route comparison table / cards */}
                {routeResult ? (
                  <div className="p-3 border-b" style={{ borderColor: 'var(--border)' }}>
                    <RouteComparisonTable
                      routes={routeResult.strategies}
                      pareto={routeResult.pareto}
                      activeStrategy={activeStrategy}
                      onStrategySelect={(s) => setActiveStrategy((prev) => (prev === s ? null : s))}
                    />
                  </div>
                ) : (
                  <div className="p-6 text-center">
                    <Navigation size={28} className="mx-auto mb-2 text-slate-400 opacity-60" />
                    <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                      No Route Computed Yet
                    </p>
                    <p className="text-xs text-slate-400 mb-4">
                      Place a start point and a destination on the map to compare candidate routes.
                      You can also enter coordinates in Parameters.
                    </p>
                    <button
                      onClick={() => setPinMode('start')}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm"
                      style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
                    >
                      Set Start Point
                    </button>
                  </div>
                )}

                {/* Science targets nearby */}
                {activeStrategy && routeResult?.strategies[activeStrategy]?.science_targets_nearby?.length ? (
                  <div className="p-3 border-b" style={{ borderColor: 'var(--border)' }}>
                    <p className="section-heading mb-2">Nearby Science Targets</p>
                    <p className="text-[10px] mb-2" style={{ color: 'var(--mode-demo)' }}>
                      {scienceLabel || 'MODEL scores — not direct measurements'}
                    </p>
                    {routeResult.strategies[activeStrategy]!.science_targets_nearby.slice(0, 5).map((t) => (
                      <div key={t.id} className="victor-panel p-2 mb-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-medium leading-tight" style={{ color: 'var(--text-primary)' }}>
                              {t.name}
                            </p>
                            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                              {t.type}
                            </p>
                          </div>
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded font-bold flex-shrink-0"
                            style={{
                              color: ['var(--tier-1)', 'var(--tier-2)', 'var(--tier-3)', 'var(--tier-4)'][t.tier - 1],
                              background: 'var(--surface-sunken)',
                            }}
                          >
                            T{t.tier}
                          </span>
                        </div>
                        {t.distance_from_route_m !== undefined && (
                          <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                            {t.distance_from_route_m.toFixed(0)}m from route
                            {t.detour_cost_minutes !== undefined && ` · +${t.detour_cost_minutes.toFixed(0)} min detour`}
                          </p>
                        )}
                      </div>
                    ))}
                    <button
                      className="text-xs mt-1"
                      style={{ color: 'var(--accent)' }}
                      onClick={() => handleSidebarChange('science')}
                    >
                      View All Science Targets →
                    </button>
                  </div>
                ) : null}

                {/* Quick link to report */}
                {routeResult && (
                  <div className="p-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Mission Documentation:</span>
                    <button
                      onClick={() => handleSidebarChange('report')}
                      className="text-xs font-semibold flex items-center gap-1"
                      style={{ color: 'var(--accent)' }}
                    >
                      Mission Report &amp; PDF Export →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: MISSION PARAMETERS & SETUP */}
            {sidebarTab === 'parameters' && (
              <div>
                {/* Mission parameters */}
                <div className="p-3 border-b" style={{ borderColor: 'var(--border)' }}>
                  <p className="section-heading mb-3">Operational Constraints</p>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="metric-label" htmlFor="max-slope">
                          Max Slope Limit
                        </label>
                        <span className="text-xs font-bold font-mono" style={{ color: 'var(--text-primary)' }}>
                          {constraints.max_slope_deg}°
                        </span>
                      </div>
                      <input
                        id="max-slope"
                        type="range" min={5} max={30} step={1}
                        value={constraints.max_slope_deg}
                        onChange={(e) => setConstraints((c) => ({ ...c, max_slope_deg: +e.target.value }))}
                        className="w-full h-1 cursor-pointer"
                        style={{ accentColor: 'var(--accent)' }}
                      />
                      <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
                        <span>5° (safe)</span><span>15° (moderate)</span><span>30° (scarp)</span>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="metric-label" htmlFor="eva-hours">
                          Max EVA Duration
                        </label>
                        <span className="text-xs font-bold font-mono" style={{ color: 'var(--text-primary)' }}>
                          {constraints.max_eva_hours} h
                        </span>
                      </div>
                      <input
                        id="eva-hours"
                        type="range" min={1} max={12} step={0.5}
                        value={constraints.max_eva_hours}
                        onChange={(e) => setConstraints((c) => ({ ...c, max_eva_hours: +e.target.value }))}
                        className="w-full h-1 cursor-pointer"
                        style={{ accentColor: 'var(--accent)' }}
                      />
                      <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
                        <span>1 h (scout)</span><span>6 h (nominal)</span><span>12 h (extended)</span>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="metric-label" htmlFor="walk-speed">
                          Walking Pace
                        </label>
                        <span className="text-xs font-bold font-mono" style={{ color: 'var(--text-primary)' }}>
                          {constraints.walking_speed_kmh} km/h
                        </span>
                      </div>
                      <input
                        id="walk-speed"
                        type="range" min={0.5} max={6} step={0.5}
                        value={constraints.walking_speed_kmh}
                        onChange={(e) => setConstraints((c) => ({ ...c, walking_speed_kmh: +e.target.value }))}
                        className="w-full h-1 cursor-pointer"
                        style={{ accentColor: 'var(--accent)' }}
                      />
                      <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
                        <span>0.5 km/h</span><span>3.0 km/h</span><span>6.0 km/h</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Multi-Objective Optimization Focus */}
                <div className="p-3 border-b" style={{ borderColor: 'var(--border)' }}>
                  <p className="section-heading mb-2">Strategy Optimization Weights</p>
                  <p className="text-[10px] mb-2.5" style={{ color: 'var(--text-muted)' }}>
                    Tune the cost weights driving A* graph search across the terrain:
                  </p>
                  <div className="grid grid-cols-2 gap-1.5 mb-3">
                    {([
                      { id: 'balanced', label: 'Balanced' },
                      { id: 'safest', label: 'Safety First' },
                      { id: 'fastest', label: 'Speed Sprint' },
                      { id: 'science', label: 'Science Focus' },
                    ] as const).map(({ id, label }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => handleWeightProfileChange(id)}
                        className="p-1.5 rounded text-xs font-medium text-left transition-all border"
                        style={{
                          background: weightProfile === id ? 'var(--accent-light)' : 'var(--surface-sunken)',
                          borderColor: weightProfile === id ? 'var(--accent)' : 'var(--border)',
                          color: weightProfile === id ? 'var(--accent)' : 'var(--text-secondary)',
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {weightProfile === 'custom' && (
                    <div className="space-y-2 p-2 rounded bg-black/10">
                      <div>
                        <div className="flex justify-between text-[10px]">
                          <span>Hazard Avoidance:</span>
                          <span className="font-mono">{(weightOverrides.hazard ?? 1.0).toFixed(1)}</span>
                        </div>
                        <input
                          type="range" min={0.1} max={5.0} step={0.1}
                          value={weightOverrides.hazard ?? 1.0}
                          onChange={(e) => setWeightOverrides((w) => ({ ...w, hazard: +e.target.value }))}
                          className="w-full h-1"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-[10px]">
                          <span>Distance Weight:</span>
                          <span className="font-mono">{(weightOverrides.distance ?? 1.0).toFixed(1)}</span>
                        </div>
                        <input
                          type="range" min={0.1} max={5.0} step={0.1}
                          value={weightOverrides.distance ?? 1.0}
                          onChange={(e) => setWeightOverrides((w) => ({ ...w, distance: +e.target.value }))}
                          className="w-full h-1"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Waypoints & Coordinates */}
                <div className="p-3 border-b space-y-2" style={{ borderColor: 'var(--border)' }}>
                  <p className="section-heading">Waypoint Navigation</p>
                  <div
                    className="rounded p-2 text-xs flex items-center justify-between cursor-pointer transition-all hover:brightness-105"
                    onClick={() => start && setFocusCoord({ ...start })}
                    title={start ? 'Click to center map on Start waypoint' : undefined}
                    style={{
                      background: start ? 'var(--color-success-bg)' : 'var(--surface-sunken)',
                      border: `1px solid ${start ? 'var(--color-success-border)' : 'var(--border)'}`,
                    }}
                  >
                    <div className="min-w-0 pr-2">
                      <span className="font-semibold block" style={{ color: 'var(--pin-start)' }}>
                        ▲ Start Waypoint
                      </span>
                      <span className="font-mono text-[11px] block truncate" style={{ color: start ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {start ? `${start.lat.toFixed(4)}°N, ${start.lon.toFixed(4)}°E` : 'Not placed yet'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {start && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFocusCoord({ ...start });
                          }}
                          className="p-1 rounded hover:bg-black/10 transition-colors"
                          title="Center map on Start"
                          style={{ color: 'var(--pin-start)' }}
                        >
                          <Crosshair size={13} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPinMode((m) => (m === 'start' ? null : 'start'));
                        }}
                        className="px-2 py-1 rounded text-[11px] font-medium transition-colors"
                        style={{
                          background: pinMode === 'start' ? 'var(--pin-start)' : 'var(--surface-raised)',
                          color: pinMode === 'start' ? '#fff' : 'var(--text-secondary)',
                          border: '1px solid var(--border)',
                        }}
                      >
                        {pinMode === 'start' ? 'Cancel' : start ? 'Move' : 'Place'}
                      </button>
                    </div>
                  </div>

                  <div
                    className="rounded p-2 text-xs flex items-center justify-between cursor-pointer transition-all hover:brightness-105"
                    onClick={() => destination && setFocusCoord({ ...destination })}
                    title={destination ? 'Click to center map on Destination waypoint' : undefined}
                    style={{
                      background: destination ? 'var(--color-danger-bg)' : 'var(--surface-sunken)',
                      border: `1px solid ${destination ? 'var(--color-danger-border)' : 'var(--border)'}`,
                    }}
                  >
                    <div className="min-w-0 pr-2">
                      <span className="font-semibold block" style={{ color: 'var(--pin-dest)' }}>
                        ● Destination
                      </span>
                      <span className="font-mono text-[11px] block truncate" style={{ color: destination ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {destination ? `${destination.lat.toFixed(4)}°N, ${destination.lon.toFixed(4)}°E` : 'Not placed yet'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {destination && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFocusCoord({ ...destination });
                          }}
                          className="p-1 rounded hover:bg-black/10 transition-colors"
                          title="Center map on Destination"
                          style={{ color: 'var(--pin-dest)' }}
                        >
                          <Crosshair size={13} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPinMode((m) => (m === 'destination' ? null : 'destination'));
                        }}
                        className="px-2 py-1 rounded text-[11px] font-medium transition-colors"
                        style={{
                          background: pinMode === 'destination' ? 'var(--pin-dest)' : 'var(--surface-raised)',
                          color: pinMode === 'destination' ? '#fff' : 'var(--text-secondary)',
                          border: '1px solid var(--border)',
                        }}
                      >
                        {pinMode === 'destination' ? 'Cancel' : destination ? 'Move' : 'Place'}
                      </button>
                    </div>
                  </div>

                  {/* Direct Keyboard Coordinate Input */}
                  <div className="pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                        Coordinate Entry (Keyboard)
                      </span>
                      <button
                        type="button"
                        id="btn-toggle-coord-entry"
                        onClick={() => setShowManualCoord((v) => !v)}
                        className="text-[10px] font-medium"
                        style={{ color: 'var(--accent)' }}
                      >
                        {showManualCoord ? 'Hide inputs' : 'Enter lat/lon'}
                      </button>
                    </div>

                    {showManualCoord && (
                      <div className="space-y-2 p-2 rounded" style={{ background: 'var(--surface-sunken)', border: '1px solid var(--border)' }}>
                        <div>
                          <span className="text-[10px] font-semibold block mb-0.5" style={{ color: 'var(--pin-start)' }}>
                            Start Waypoint
                          </span>
                          <div className="grid grid-cols-2 gap-1.5">
                            <div>
                              <label className="text-[9px] block" style={{ color: 'var(--text-muted)' }}>Lat (18.0–18.9°N)</label>
                              <input
                                id="manual-start-lat"
                                type="number" step="0.0001" min="18.0" max="18.9"
                                value={manualStartLat}
                                onChange={(e) => setManualStartLat(e.target.value)}
                                className="w-full px-1.5 py-1 text-xs font-mono rounded border"
                                style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }}
                              />
                            </div>
                            <div>
                              <label className="text-[9px] block" style={{ color: 'var(--text-muted)' }}>Lon (77.0–78.0°E)</label>
                              <input
                                id="manual-start-lon"
                                type="number" step="0.0001" min="77.0" max="78.0"
                                value={manualStartLon}
                                onChange={(e) => setManualStartLon(e.target.value)}
                                className="w-full px-1.5 py-1 text-xs font-mono rounded border"
                                style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }}
                              />
                            </div>
                          </div>
                        </div>

                        <div>
                          <span className="text-[10px] font-semibold block mb-0.5" style={{ color: 'var(--pin-dest)' }}>
                            Destination Waypoint
                          </span>
                          <div className="grid grid-cols-2 gap-1.5">
                            <div>
                              <label className="text-[9px] block" style={{ color: 'var(--text-muted)' }}>Lat (18.0–18.9°N)</label>
                              <input
                                id="manual-dest-lat"
                                type="number" step="0.0001" min="18.0" max="18.9"
                                value={manualDestLat}
                                onChange={(e) => setManualDestLat(e.target.value)}
                                className="w-full px-1.5 py-1 text-xs font-mono rounded border"
                                style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }}
                              />
                            </div>
                            <div>
                              <label className="text-[9px] block" style={{ color: 'var(--text-muted)' }}>Lon (77.0–78.0°E)</label>
                              <input
                                id="manual-dest-lon"
                                type="number" step="0.0001" min="77.0" max="78.0"
                                value={manualDestLon}
                                onChange={(e) => setManualDestLon(e.target.value)}
                                className="w-full px-1.5 py-1 text-xs font-mono rounded border"
                                style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }}
                              />
                            </div>
                          </div>
                        </div>

                        {coordFeedback && (
                          <p
                            id="coord-feedback-msg"
                            className="text-[10px] leading-tight font-medium"
                            style={{ color: coordFeedback.includes('applied') ? 'var(--color-success)' : 'var(--color-warning)' }}
                          >
                            {coordFeedback}
                          </p>
                        )}

                        <button
                          id="btn-apply-manual-coords"
                          type="button"
                          onClick={handleApplyManualCoords}
                          className="w-full py-1 rounded text-xs font-medium transition-colors"
                          style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
                        >
                          Apply Coordinates
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Compute button */}
                <div className="p-3">
                  <button
                    id="btn-compute-routes"
                    onClick={handleComputeRoutes}
                    disabled={isComputing || !start || !destination}
                    className="w-full py-2.5 rounded font-semibold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                    style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
                  >
                    {isComputing ? (
                      <>
                        <div
                          className="w-3.5 h-3.5 border-2 rounded-full animate-spin"
                          style={{
                            borderColor: withAlpha('var(--on-accent)', 30),
                            borderTopColor: 'var(--on-accent)',
                          }}
                        />
                        Computing A* Traversal…
                      </>
                    ) : (
                      <>
                        <Play size={13} />
                        Compute Optimal Route
                      </>
                    )}
                  </button>

                  {computeError && (
                    <div
                      className="mt-3 p-3 rounded-lg text-xs border"
                      style={{
                        background: 'var(--color-danger-bg)',
                        borderColor: 'var(--color-danger-border)',
                        color: 'var(--color-danger)',
                      }}
                    >
                      <div className="flex items-start gap-2">
                        <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                        <p className="text-[11px] leading-relaxed opacity-95">
                          {computeError.replace(/^API Error \d+:\s*/, '')}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: DATA LAYERS */}
            {sidebarTab === 'layers' && (
              <div className="p-0">
                <div className="px-3 pt-3 pb-0">
                  <p className="section-heading">Multi-Mission Map Layers</p>
                  <p className="text-[10px] mt-0.5 mb-2" style={{ color: 'var(--text-muted)' }}>
                    Combine observational rasters from NASA MRO, Mars Odyssey, and Mars Global Surveyor
                  </p>
                </div>
                <LayerControl layers={layers} onChange={setLayers} />
                {terrainClassVisible && <TerrainClassLegend />}
              </div>
            )}
          </div>

          {/* Persistent Data mode footer */}
          <div className="p-2.5 border-t flex-shrink-0" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            <div
              className={`text-[10px] px-2 py-1.5 rounded leading-relaxed ${
                dataMode === 'DEMONSTRATION'
                  ? 'badge-demonstration'
                  : dataMode === 'LIVE'
                  ? 'badge-live'
                  : 'badge-verified'
              }`}
            >
              {dataMode === 'DEMONSTRATION' ? (
                'DEMONSTRATION mode. Synthetic terrain modeled on published Jezero morphology.'
              ) : dataMode == null ? (
                'Data mode unavailable — offline or unreachable.'
              ) : (
                <>
                  {dataMode === 'LIVE' ? 'LIVE TELEMETRY' : 'PDS BASELINE'} mode.
                  {missionList
                    ? ` Planetary Data System telemetry from ${missionCount} mission${missionCount === 1 ? '' : 's'}: ${missionList}.`
                    : ' Planetary Data System multi-mission telemetry.'}
                </>
              )}
            </div>
          </div>
        </div>
      </>
    );
    }
  };

  return (
    <div className="flex flex-col min-h-screen lg:h-screen lg:overflow-hidden" style={{ background: 'var(--surface)' }}>
      <Header dataMode={dataMode} activeTab={activeTab} onTabChange={handleTabChange} />
      <InfoBar region={region} loading={regionLoading} error={regionError} environment={environment} />
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
        <Sidebar activeSection={sidebarSection} onSectionChange={handleSidebarChange} />
        {renderMainContent()}
      </div>
    </div>
  );
}

