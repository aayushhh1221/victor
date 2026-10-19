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
  computeRoutes, getDemoRoutes, getHealth, getScienceTargets, getSegmentEvidence, getRegion,
  getEnvironment,
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
  MarsExplorerView, DataLayersTabView, SystemStatusView,
} from '@/components/panels/StaticViews';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { MapPin, Play, AlertTriangle, Navigation, ShieldCheck, Mountain, FlaskConical, TrendingUp, ChevronDown, ChevronUp, Crosshair } from 'lucide-react';
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
  { id: 'perseverance_traverse', visible: true, opacity: 0.8 },
];

interface MissionPreset {
  id: string;
  name: string;
  start: Coordinate;
  destination: Coordinate;
  desc: string;
}

const MISSION_PRESETS: MissionPreset[] = [
  {
    id: 'perseverance',
    name: 'Séítah → Ancient Delta (Perseverance Traverse)',
    start: { lat: 18.44, lon: 77.45 },
    destination: { lat: 18.48, lon: 77.24 },
    desc: 'Historical Mars 2020 landing site traverse across crater floor toward river delta.',
  },
  {
    id: 'delta-fan',
    name: 'Crater Floor → Delta Fan',
    start: { lat: 18.432, lon: 77.425 },
    destination: { lat: 18.461, lon: 77.330 },
    desc: 'Traverse across basaltic sands to Hawksbill Gap layered delta deposits.',
  },
  {
    id: 'three-forks',
    name: 'Three Forks → Margin Unit',
    start: { lat: 18.452, lon: 77.352 },
    destination: { lat: 18.498, lon: 77.240 },
    desc: 'Sample cache depot route ascending to carbonate-bearing rim margin.',
  },
  {
    id: 'kodiak',
    name: 'Kodiak Butte Pass → Crater Rim',
    start: { lat: 18.440, lon: 77.385 },
    destination: { lat: 18.490, lon: 77.360 },
    desc: 'Steep geological scouting mission toward Jezero crater northern rim.',
  },
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
  | 'layers'
  | 'status';

/**
 * Navigation mapping.
 *
 * The header tabs and the sidebar are two routes into the same set of views,
 * so the three tables below must agree. Where a view has no counterpart in the
 * other navigation (there is no sidebar row for "About", no header tab for
 * "Mission Report"), the mapping is the empty string: that clears the other
 * nav's highlight rather than leaving a stale, wrong one lit.
 */

/** Header tab id → main view. */
const TAB_TO_VIEW: Record<string, MainView> = {
  planner: 'planner',
  explorer: 'explorer',
  layers: 'layers',
  science: 'science',
  methodology: 'methodology',
  about: 'about',
};

/** Header tab id → sidebar section id ('' = no corresponding row). */
const TAB_TO_SECTION: Record<string, string> = {
  planner: 'plan',
  explorer: 'map',
  layers: '',       // "Data & Layers" is a tab-only view; 'sources' is a different view
  science: 'science',
  methodology: 'methodology',
  about: '',        // no About row in the sidebar
};

/** Sidebar section id → main view. Every section has its own distinct view. */
const SECTION_TO_VIEW: Record<string, MainView> = {
  overview: 'overview',
  plan: 'planner',
  map: 'explorer',   // distinct from 'plan' so the two nav items are not duplicates
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
  const [selectedPresetId, setSelectedPresetId] = useState<string>('perseverance');
  const [scienceLabel, setScienceLabel] = useState('');

  // Compute the main view from both tab and sidebar state
  // Tab takes priority if it changed last, then sidebar
  const [mainView, setMainView] = useState<MainView>('planner');

  const navigateTo = useCallback((view: MainView, section: string, tab: string) => {
    setMainView(view);
    // Always assign, including '' — that clears the other nav's highlight so
    // it cannot keep showing a stale selection.
    setSidebarSection(section);
    setActiveTab(tab);
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
      const clamped: Coordinate = {
        lat: Math.max(18.01, Math.min(18.89, parseFloat(coord.lat.toFixed(4)))),
        lon: Math.max(77.01, Math.min(77.99, parseFloat(coord.lon.toFixed(4)))),
      };

      if (pinMode === 'start') {
        setStart(clamped);
        // If destination has not been set yet, transition to destination mode; otherwise finish placement
        setPinMode(!destination ? 'destination' : null);
        setComputeError(null);
        setSelectedPresetId('');
      } else if (pinMode === 'destination') {
        setDestination(clamped);
        setPinMode(null);
        setComputeError(null);
        setSelectedPresetId('');
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
    setSelectedPresetId('');
  }, []);

  const handleSelectPreset = useCallback((preset: MissionPreset) => {
    setSelectedPresetId(preset.id);
    setStart(preset.start);
    setDestination(preset.destination);
    setPinMode(null);
    setComputeError(null);
  }, []);

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
    const dist = Math.hypot(destination.lat - start.lat, destination.lon - start.lon);
    if (dist < 0.001) {
      setComputeError('Start and destination must be distinct locations (at least 100m apart).');
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
        text: 'DEMONSTRATION DATA — Not real NASA observations',
        title: 'Running on synthetic demonstration data — not real NASA observations',
      };
    }
    if (bannerMode === 'VERIFIED_SNAPSHOT') {
      return {
        cls: 'badge-verified',
        icon: <ShieldCheck size={12} />,
        text:
          missionCount != null
            ? `VERIFIED — real NASA data from ${missionCount} mission${missionCount === 1 ? '' : 's'}`
            : 'VERIFIED SNAPSHOT — pre-downloaded real NASA data',
        title: missionList
          ? `Pre-downloaded, verified NASA instrument data from: ${missionList}`
          : 'Pre-downloaded, verified NASA instrument data',
      };
    }
    return {
      cls: 'badge-live',
      icon: <ShieldCheck size={12} />,
      text: 'LIVE NASA DATA FEED',
      title: 'Live NASA data feed',
    };
  })();

  // ── NON-PLANNER VIEWS ────────────────────────────────────────────────────
  if (mainView === 'overview') {
    return (
      <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--surface)' }}>
        <Header dataMode={dataMode} activeTab={activeTab} onTabChange={handleTabChange} />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar activeSection={sidebarSection} onSectionChange={handleSidebarChange} />
          <MissionOverviewView
            routeResult={routeResult}
            dataMode={dataMode}
            constraints={constraints}
            onNavigate={(id) => handleSidebarChange(id)}
          />
        </div>
      </div>
    );
  }

  if (mainView === 'analysis') {
    return (
      <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--surface)' }}>
        <Header dataMode={dataMode} activeTab={activeTab} onTabChange={handleTabChange} />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar activeSection={sidebarSection} onSectionChange={handleSidebarChange} />
          <RouteAnalysisView
            routeResult={routeResult}
            activeStrategy={activeStrategy}
            onStrategyChange={setActiveStrategy}
            constraints={constraints}
          />
        </div>
      </div>
    );
  }

  if (mainView === 'science') {
    return (
      <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--surface)' }}>
        <Header dataMode={dataMode} activeTab={activeTab} onTabChange={handleTabChange} />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar activeSection={sidebarSection} onSectionChange={handleSidebarChange} />
          <ScienceOppsView
            routeResult={routeResult}
            scienceTargets={scienceTargets}
            activeStrategy={activeStrategy}
            scienceLabel={scienceLabel}
          />
        </div>
      </div>
    );
  }

  if (mainView === 'scenarios') {
    return (
      <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--surface)' }}>
        <Header dataMode={dataMode} activeTab={activeTab} onTabChange={handleTabChange} />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar activeSection={sidebarSection} onSectionChange={handleSidebarChange} />
          <CompareScenariosView routeResult={routeResult} baseConstraints={constraints} />
        </div>
      </div>
    );
  }

  if (mainView === 'report') {
    return (
      <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--surface)' }}>
        <Header dataMode={dataMode} activeTab={activeTab} onTabChange={handleTabChange} />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar activeSection={sidebarSection} onSectionChange={handleSidebarChange} />
          <MissionReportView
            routeResult={routeResult}
            activeStrategy={activeStrategy}
          />
        </div>
      </div>
    );
  }

  if (mainView === 'env') {
    return (
      <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--surface)' }}>
        <Header dataMode={dataMode} activeTab={activeTab} onTabChange={handleTabChange} />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar activeSection={sidebarSection} onSectionChange={handleSidebarChange} />
          <EnvironmentalView />
        </div>
      </div>
    );
  }

  if (mainView === 'sources') {
    return (
      <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--surface)' }}>
        <Header dataMode={dataMode} activeTab={activeTab} onTabChange={handleTabChange} />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar activeSection={sidebarSection} onSectionChange={handleSidebarChange} />
          <DataSourcesView />
        </div>
      </div>
    );
  }

  if (mainView === 'methodology') {
    return (
      <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--surface)' }}>
        <Header dataMode={dataMode} activeTab={activeTab} onTabChange={handleTabChange} />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar activeSection={sidebarSection} onSectionChange={handleSidebarChange} />
          <MethodologyView />
        </div>
      </div>
    );
  }

  if (mainView === 'about') {
    return (
      <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--surface)' }}>
        <Header dataMode={dataMode} activeTab={activeTab} onTabChange={handleTabChange} />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar activeSection={sidebarSection} onSectionChange={handleSidebarChange} />
          <AboutView />
        </div>
      </div>
    );
  }

  if (mainView === 'explorer') {
    return (
      <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--surface)' }}>
        <Header dataMode={dataMode} activeTab={activeTab} onTabChange={handleTabChange} />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar activeSection={sidebarSection} onSectionChange={handleSidebarChange} />
          <MarsExplorerView onNavigate={(s) => handleSidebarChange(s)} />
        </div>
      </div>
    );
  }

  if (mainView === 'layers') {
    return (
      <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--surface)' }}>
        <Header dataMode={dataMode} activeTab={activeTab} onTabChange={handleTabChange} />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar activeSection={sidebarSection} onSectionChange={handleSidebarChange} />
          <DataLayersTabView onNavigate={(s) => handleSidebarChange(s)} />
        </div>
      </div>
    );
  }

  if (mainView === 'status') {
    return (
      <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--surface)' }}>
        <Header dataMode={dataMode} activeTab={activeTab} onTabChange={handleTabChange} />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar activeSection={sidebarSection} onSectionChange={handleSidebarChange} />
          <SystemStatusView dataMode={dataMode} health={health} />
        </div>
      </div>
    );
  }

  // ── PLANNER VIEW (default) ────────────────────────────────────────────────

  return (
    <div
      className="flex flex-col h-screen overflow-hidden"
      style={{ background: 'var(--surface)' }}
    >
      <Header dataMode={dataMode} activeTab={activeTab} onTabChange={handleTabChange} />
      <InfoBar
        region={region}
        loading={regionLoading}
        error={regionError}
        environment={environment}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar activeSection={sidebarSection} onSectionChange={handleSidebarChange} />

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
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all disabled:opacity-40"
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
                    Elevation and terrain difficulty along selected route
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
                          label={{ value: 'Elev (m)', angle: -90, position: 'insideLeft', offset: 12, fontSize: 9, fill: 'var(--chart-text)' }}
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

          {/* Compute error */}
          {computeError && (
            <div
              className="absolute bottom-4 left-4 flex items-center gap-2 px-3 py-2 rounded z-20 text-xs"
              style={{
                background: 'var(--color-danger-bg)',
                border: '1px solid var(--color-danger-border)',
                color: 'var(--color-danger)',
              }}
            >
              <AlertTriangle size={12} />
              {computeError}
            </div>
          )}
        </div>

        {/* Right panel — 360px (trims map container width by ~10% to eliminate blank side gutters) */}
        <div
          className="w-[360px] flex-shrink-0 flex flex-col border-l overflow-y-auto"
          style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)' }}
        >
          {/* Mission Presets */}
          <div className="p-3 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between mb-1.5">
              <p className="section-heading">Mission Presets</p>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--surface-sunken)', color: 'var(--text-muted)' }}>
                Jezero Crater
              </span>
            </div>
            <p className="text-[11px] mb-2" style={{ color: 'var(--text-muted)' }}>
              Choose a verified historical traverse or place custom pins on the map:
            </p>
            <div className="space-y-1.5">
              {MISSION_PRESETS.map((preset) => {
                const isSelected = selectedPresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => handleSelectPreset(preset)}
                    className="w-full text-left p-2 rounded text-xs transition-all flex flex-col gap-0.5 hover:brightness-105"
                    style={{
                      background: isSelected ? 'var(--surface-sunken)' : 'transparent',
                      border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs" style={{ color: isSelected ? 'var(--accent)' : 'var(--text-primary)' }}>
                        {preset.name}
                      </span>
                      {isSelected && (
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'var(--accent)' }} />
                      )}
                    </div>
                    <span className="text-[10px] leading-tight line-clamp-2" style={{ color: 'var(--text-muted)' }}>
                      {preset.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mission parameters */}
          <div className="p-3 border-b" style={{ borderColor: 'var(--border)' }}>
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
                  className="w-full h-1"
                  style={{ accentColor: 'var(--accent)' }}
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
                  className="w-full h-1"
                  style={{ accentColor: 'var(--accent)' }}
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
                  className="w-full h-1"
                  style={{ accentColor: 'var(--accent)' }}
                />
              </div>
            </div>

            {/* Waypoints & Coordinates */}
            <div className="mt-3 space-y-2">
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
            </div>

            {/* Compute button */}
            <button
              id="btn-compute-routes"
              onClick={handleComputeRoutes}
              disabled={isComputing || !start || !destination}
              className="mt-3 w-full py-2 rounded font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
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
              <p className="mt-2 text-xs flex items-center gap-1" style={{ color: 'var(--color-danger)' }}>
                <AlertTriangle size={11} />
                {computeError}
              </p>
            )}
          </div>

          {/* Route comparison */}
          {routeResult && (
            <div className="p-3 border-b" style={{ borderColor: 'var(--border)' }}>
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

          {/* Layer control */}
          <div className="p-0 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="px-3 pt-3 pb-0">
              <p className="section-heading">Map Layers</p>
              <p className="text-[10px] mt-0.5 mb-1" style={{ color: 'var(--text-muted)' }}>
                Combine data from multiple NASA missions
              </p>
            </div>
            <LayerControl layers={layers} onChange={setLayers} />
            {/* Key for the terrain-archetype layer. The layer renders as flat
                coloured regions, so it is unreadable without one — shown only
                while that layer is switched on. */}
            {terrainClassVisible && <TerrainClassLegend />}
          </div>

          {/* Data mode note — mission list comes from the backend compliance report */}
          <div className="p-3">
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
                'DEMONSTRATION mode. Data is synthetic, modeled on published Jezero geology. Not real NASA observations.'
              ) : dataMode == null ? (
                'Data mode unknown — the backend could not be reached.'
              ) : (
                <>
                  {dataMode === 'LIVE' ? 'LIVE' : 'VERIFIED_SNAPSHOT'} mode.
                  {missionList
                    ? ` Real NASA open data from ${missionCount} mission${missionCount === 1 ? '' : 's'}: ${missionList}.`
                    : ' Real NASA instrument data; mission list not reported.'}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
