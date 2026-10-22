'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { Coordinate, Route, RouteStrategy, ScienceTarget, ActiveLayer } from '@/types';
import { STRATEGY_META } from '@/types';
import {
  marsToLeaflet,
  leafletToMars,
  pixelSpanToKm,
  LEAFLET_BOUNDS,
  EXTENT,
  TILE_EXTENT,
} from '@/utils/marsProjection';
import { getTileUrlTemplate } from '@/services/api';
import { useTheme } from '@/utils/theme';
import { readToken } from '@/utils/color';
import { Crosshair, Globe } from 'lucide-react';

// Dynamic import guard for SSR (Leaflet requires window)
let L: typeof import('leaflet') | null = null;
if (typeof window !== 'undefined') {
  L = require('leaflet');
  require('leaflet/dist/leaflet.css');
}

// Perseverance Rover Historical Reference Traverse (Mars 2020 Sols 1-1000)
const PERSEVERANCE_TRAVERSE: Coordinate[] = [
  { lat: 18.4447, lon: 77.4508 }, // Octavia E. Butler landing
  { lat: 18.4385, lon: 77.4452 }, // Séítah North entry
  { lat: 18.4280, lon: 77.4480 }, // South Séítah
  { lat: 18.4320, lon: 77.4250 }, // Van Zyl Overlook
  { lat: 18.4400, lon: 77.3850 }, // Kodiak Butte Pass
  { lat: 18.4520, lon: 77.3520 }, // Three Forks
  { lat: 18.4610, lon: 77.3300 }, // Hawksbill Gap
  { lat: 18.4720, lon: 77.2950 }, // Delta Front
  { lat: 18.4850, lon: 77.2650 }, // Upper Fan
  { lat: 18.4980, lon: 77.2400 }, // Margin Unit
];

interface MarsMapProps {
  start: Coordinate | null;
  destination: Coordinate | null;
  routes: Partial<Record<RouteStrategy, Route>>;
  activeLayers: ActiveLayer[];
  scienceTargets: ScienceTarget[];
  onMapClick: (_coord: Coordinate) => void;
  onSegmentClick: (_strategy: RouteStrategy, _segmentId: number) => void;
  activeStrategy: RouteStrategy | null;
  pinMode?: 'start' | 'destination' | null;
  onPinDrag?: (_type: 'start' | 'destination', _coord: Coordinate) => void;
  focusCoord?: Coordinate | null;
  onOpenGlobalExplorer?: () => void;
}

/** Pixel distance sampled from the live map to derive the current scale. */
const SCALE_SAMPLE_PX = 100;

/**
 * Pick a 1 / 2 / 5 × 10ⁿ value at or below `v` — the conventional ladder for
 * map scale bars.
 */
function niceScaleValue(v: number): number {
  if (!(v > 0) || !Number.isFinite(v)) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const frac = v / pow;
  const mult = frac >= 5 ? 5 : frac >= 2 ? 2 : 1;
  return mult * pow;
}

/** Trim a scale label to at most one decimal place. */
function formatScaleNumber(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1).replace(/\.0$/, '');
}

/** Base layer IDs — only these drive the tile render state indicator. */
const BASE_LAYER_IDS = ['imagery', 'terrain'];

export default function MarsMap({
  start,
  destination,
  routes,
  activeLayers,
  scienceTargets,
  onMapClick,
  onSegmentClick,
  activeStrategy,
  pinMode,
  onPinDrag,
  focusCoord,
  onOpenGlobalExplorer,
}: MarsMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layersRef = useRef<Record<string, any>>({});
  const routeLayersRef = useRef<any[]>([]);
  const markersRef = useRef<any[]>([]);
  const sciLayersRef = useRef<any[]>([]);

  // Keep latest callbacks in refs so event listeners registered once on mount
  // never execute stale closures.
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;

  const onPinDragRef = useRef(onPinDrag);
  onPinDragRef.current = onPinDrag;

  /**
   * Tile render state for the active basemap.
   *
   * - 'loading'       — base layer tile requests in flight
   * - 'ready'         — one or more base tiles loaded with no terminal error
   * - 'error'         — all requested base tiles failed / endpoint unreachable
   * - 'no-base-layer' — no usable basemap in the activeLayers prop at all
   * - null            — map not yet initialised
   */
  type TileRenderState = 'loading' | 'ready' | 'error' | 'no-base-layer' | null;
  const [tileState, setTileState] = useState<TileRenderState>(null);
  const [tileErrorLayer, setTileErrorLayer] = useState<string | null>(null);
  // Track in-flight tile counts per base layer to decide when all have failed
  const tileInflightRef = useRef<Record<string, number>>({});
  const tileLoadedRef = useRef<Record<string, number>>({});
  const tileErroredRef = useRef<Record<string, number>>({});

  // Leaflet vector styles take concrete colour values, so every token below is
  // resolved at paint time. `theme` must therefore appear in the dependency
  // array of every effect that reads one, or the canvas keeps the old theme's
  // colours after a toggle.
  const { theme } = useTheme();

  // Pan / center on focusCoord when requested by waypoint cards
  useEffect(() => {
    if (!mapRef.current || !focusCoord) return;
    const pos = marsToLeaflet(focusCoord.lat, focusCoord.lon);
    mapRef.current.setView(pos, Math.max(mapRef.current.getZoom(), 2), { animate: true });
  }, [focusCoord]);

  // Initialize Leaflet map on mount
  useEffect(() => {
    if (!containerRef.current || mapRef.current || !L) return;

    const map = L.map(containerRef.current, {
      crs: L.CRS.Simple,
      minZoom: 2,
      maxZoom: 5,
      zoomControl: false,
      attributionControl: false,
      maxBoundsViscosity: 1.0,
    });

    // Constrain panning to the Jezero study area with zero out-of-bounds void
    const boundsBuffer = 16;
    const panBounds: [[number, number], [number, number]] = [
      [-boundsBuffer, -boundsBuffer],
      [TILE_EXTENT + boundsBuffer, TILE_EXTENT + boundsBuffer],
    ];
    map.setMaxBounds(panBounds);

    // Add zoom control in top-right
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Initial view: center on central Jezero Crater at Zoom 2 (1024×1024px, completely fills width with zero blank gutters)
    map.setView([TILE_EXTENT / 2, TILE_EXTENT / 2], 2);

    // Resize observer to ensure the map always fits its container cleanly
    const resizeObserver = new ResizeObserver(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // Click handler — always calls freshest onMapClick via ref
    map.on('click', (e: any) => {
      const { lat: ly, lng: lx } = e.latlng;
      const marsCoord = leafletToMars(ly, lx);
      onMapClickRef.current?.(marsCoord);
    });

    mapRef.current = map;

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update tile and reference layers based on activeLayers prop
  useEffect(() => {
    if (!mapRef.current || !L) return;

    activeLayers.forEach((layer) => {
      const existing = layersRef.current[layer.id];

      if (layer.id === 'perseverance_traverse') {
        const stopColor = readToken('--pin-stop', '#F59E0B');
        if (layer.visible && !existing) {
          const latlngs = PERSEVERANCE_TRAVERSE.map((c) => marsToLeaflet(c.lat, c.lon));
          const line = L!.polyline(latlngs, {
            color: stopColor,
            weight: 3,
            dashArray: '6, 8',
            opacity: layer.opacity,
          }).bindTooltip('Perseverance Traverse (Mars 2020 Reference)', { sticky: true });
          line.addTo(mapRef.current);
          layersRef.current[layer.id] = line;
        } else if (!layer.visible && existing) {
          existing.remove();
          delete layersRef.current[layer.id];
        } else if (layer.visible && existing) {
          existing.setStyle({ opacity: layer.opacity, color: stopColor });
        }
        return;
      }

      // Tile layers (imagery, terrain, elevation, thermal, hazard, science)
      const isBase = BASE_LAYER_IDS.includes(layer.id);

      if (layer.visible) {
        if (!existing) {
          const tileLayer = L!.tileLayer(
            getTileUrlTemplate(layer.id),
            {
              tileSize: 256,
              minZoom: 2,
              maxZoom: 5,
              noWrap: true,
              bounds: LEAFLET_BOUNDS,
              opacity: layer.opacity,
            }
          );

          // Track tile load state for basemap layers so the UI can surface
          // loading / error / ready honestly without polling.
          if (isBase) {
            tileInflightRef.current[layer.id] = 0;
            tileLoadedRef.current[layer.id] = 0;
            tileErroredRef.current[layer.id] = 0;
            setTileState('loading');
            setTileErrorLayer(null);

            tileLayer.on('tileloadstart', () => {
              tileInflightRef.current[layer.id] = (tileInflightRef.current[layer.id] ?? 0) + 1;
              setTileState('loading');
            });

            tileLayer.on('tileload', () => {
              tileLoadedRef.current[layer.id] = (tileLoadedRef.current[layer.id] ?? 0) + 1;
              // At least one tile loaded → ready (errors on other tiles don't override this)
              setTileState('ready');
              setTileErrorLayer(null);
            });

            tileLayer.on('tileerror', (_e: any) => {
              tileErroredRef.current[layer.id] = (tileErroredRef.current[layer.id] ?? 0) + 1;
              const loaded = tileLoadedRef.current[layer.id] ?? 0;
              // Only transition to error state if no tile has loaded yet
              if (loaded === 0) {
                setTileState('error');
                setTileErrorLayer(layer.id);
              }
            });
          }

          tileLayer.addTo(mapRef.current);
          layersRef.current[layer.id] = tileLayer;
        } else {
          existing.setOpacity(layer.opacity);
        }
      } else {
        if (existing) {
          existing.remove();
          delete layersRef.current[layer.id];
          // Clean up tracking state for removed base layers
          if (isBase) {
            delete tileInflightRef.current[layer.id];
            delete tileLoadedRef.current[layer.id];
            delete tileErroredRef.current[layer.id];
          }
        }
      }
    });

    // Check if any basemap is active; if not, set no-base-layer state
    const hasActiveBase = activeLayers.some(
      (l) => BASE_LAYER_IDS.includes(l.id) && l.visible,
    );
    if (!hasActiveBase) {
      setTileState('no-base-layer');
    }
  }, [activeLayers, theme]);

  // Update start/destination markers
  useEffect(() => {
    if (!mapRef.current || !L) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const pinRing = readToken('--surface', '#FFFFFF');

    const addPin = (coord: Coordinate, color: string, label: string, isStart: boolean) => {
      const pos = marsToLeaflet(coord.lat, coord.lon);
      const icon = L!.divIcon({
        className: '',
        html: `
          <div style="
            background:${color};border:2px solid ${pinRing};border-radius:50% 50% 50% 0;
            width:22px;height:22px;transform:rotate(-45deg);
            box-shadow:0 2px 8px rgba(0,0,0,0.6);
            cursor:grab;
          "></div>
        `,
        iconSize: [22, 22],
        iconAnchor: [11, 22],
      });
      const marker = L!.marker(pos, { icon, draggable: true, zIndexOffset: isStart ? 1000 : 990 })
        .bindTooltip(`${label} · Drag to adjust`, {
          permanent: false,
          direction: isStart ? 'left' : 'right',
          offset: isStart ? [-14, -10] : [14, -10],
        })
        .addTo(mapRef.current);

      marker.on('dragend', (e: any) => {
        const { lat: ly, lng: lx } = e.target.getLatLng();
        const marsCoord = leafletToMars(ly, lx);
        const clamped: Coordinate = {
          lat: Math.max(EXTENT.lat_min, Math.min(EXTENT.lat_max, parseFloat(marsCoord.lat.toFixed(4)))),
          lon: Math.max(EXTENT.lon_min, Math.min(EXTENT.lon_max, parseFloat(marsCoord.lon.toFixed(4)))),
        };
        onPinDragRef.current?.(isStart ? 'start' : 'destination', clamped);
      });

      markersRef.current.push(marker);
    };

    const pinStart = readToken('--pin-start', '#22C55E');
    const pinDest = readToken('--pin-dest', '#EF4444');

    if (start) addPin(start, pinStart, 'START', true);
    if (destination) addPin(destination, pinDest, 'DEST', false);
  }, [start, destination, theme, onPinDrag]);

  // Draw route polylines
  useEffect(() => {
    if (!mapRef.current || !L) return;
    routeLayersRef.current.forEach((l) => l.remove());
    routeLayersRef.current = [];

    Object.entries(routes).forEach(([strategyName, route]) => {
      if (!route) return;
      const meta = STRATEGY_META[strategyName as RouteStrategy];
      const isActive = activeStrategy === null || activeStrategy === strategyName;
      const weight = isActive ? 4 : 1.5;
      const opacity = isActive ? 1.0 : 0.25;

      const latlngs = route.path.map((c) => marsToLeaflet(c.lat, c.lon));
      const polyline = L!.polyline(latlngs, {
        color: meta.color,
        weight,
        opacity,
        dashArray: meta.dashArray,
      }).addTo(mapRef.current);

      // Segment click support
      route.segments.forEach((seg) => {
        const segLine = L!.polyline(
          [marsToLeaflet(seg.start.lat, seg.start.lon),
           marsToLeaflet(seg.end.lat, seg.end.lon)],
          { color: meta.color, weight: weight + 3, opacity: 0, interactive: true },
        );
        segLine.on('click', (e: any) => {
          L!.DomEvent.stopPropagation(e);
          onSegmentClick(strategyName as RouteStrategy, seg.segment_id);
        });
        segLine.addTo(mapRef.current);
        routeLayersRef.current.push(segLine);
      });

      routeLayersRef.current.push(polyline);
    });

    // Auto-fit view to active route when routes are rendered
    const activeRoute = (activeStrategy && routes[activeStrategy]) || Object.values(routes)[0];
    if (activeRoute?.path && activeRoute.path.length > 1) {
      const latlngs = activeRoute.path.map((c) => marsToLeaflet(c.lat, c.lon));
      const bounds = L!.latLngBounds(latlngs);
      mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 4, animate: true });
    }
  }, [routes, activeStrategy, onSegmentClick]);

  // Science target markers
  useEffect(() => {
    if (!mapRef.current || !L) return;
    sciLayersRef.current.forEach((l) => l.remove());
    sciLayersRef.current = [];

    const tierColors = [
      readToken('--tier-1', '#22C55E'),
      readToken('--tier-2', '#86EFAC'),
      readToken('--tier-3', '#FCD34D'),
      readToken('--tier-4', '#9CA3AF'),
    ];
    const borderColor = readToken('--accent', '#1565C0');

    scienceTargets.forEach((target) => {
      const pos = marsToLeaflet(target.location.lat, target.location.lon);
      const tierColor = tierColors[target.tier - 1] ?? tierColors[3];
      const icon = L!.divIcon({
        className: '',
        html: `
          <div style="
            background:${tierColor};border:2px solid ${borderColor};border-radius:50%;
            width:10px;height:10px;cursor:pointer;
          " title="${target.name}"></div>
        `,
        iconSize: [10, 10],
        iconAnchor: [5, 5],
      });
      const marker = L!.marker(pos, { icon })
        .bindTooltip(
          `<strong>${target.name}</strong><br/>
           Tier ${target.tier} | Score: ${target.science_value.toFixed(2)}<br/>
           <em style="font-size:10px">MODEL score — not a direct measurement</em>`,
          { direction: 'top', offset: [0, -8] },
        )
        .addTo(mapRef.current);
      sciLayersRef.current.push(marker);
    });
  }, [scienceTargets, theme]);

  // Geographic landmark markers — subtle point markers with hover-only tooltips.
  // No permanent text is plastered on the map; hovering reveals full geological details.
  const landmarksRef = React.useRef<any[]>([]);
  useEffect(() => {
    if (!mapRef.current || !L) return;

    landmarksRef.current.forEach((m) => m.remove());
    landmarksRef.current = [];

    const places = [
      {
        lat: 18.455,
        lon: 77.43,
        name: 'Jezero Crater',
        type: 'Impact Basin',
        desc: 'Mars 2020 landing site and ancient lake basin (~45 km diameter).',
      },
      {
        lat: 18.473,
        lon: 77.335,
        name: 'Ancient Delta',
        type: 'Fluvial Deposit',
        desc: 'Layered clay and carbonate-rich river fan formation.',
      },
      {
        lat: 18.428,
        lon: 77.465,
        name: 'Séítah Unit',
        type: 'Basaltic Bedrock',
        desc: 'Olivine-rich cumulate bedrock with ripples and sand sheets.',
      },
      {
        lat: 18.515,
        lon: 77.50,
        name: 'Crater Rim',
        type: 'Topographic Boundary',
        desc: 'Elevated Noachian impact rim exposing ancient Mars crust.',
      },
      {
        lat: 18.449,
        lon: 77.325,
        name: 'Delta Fan',
        type: 'Sedimentary Margin',
        desc: 'Hawksbill Gap layered delta sequence with organic preservation potential.',
      },
    ];

    places.forEach(({ lat, lon, name, type, desc }) => {
      const pos = marsToLeaflet(lat, lon);
      const icon = L!.divIcon({
        className: 'landmark-icon',
        html: `
          <div style="
            width: 7px; height: 7px; border-radius: 50%;
            background: rgba(241, 245, 249, 0.9);
            border: 1px solid rgba(15, 23, 42, 0.85);
            box-shadow: 0 0 3px rgba(0,0,0,0.7);
            cursor: pointer;
          "></div>
        `,
        iconSize: [7, 7],
        iconAnchor: [3.5, 3.5],
      });

      const marker = L!.marker(pos, { icon, interactive: true, zIndexOffset: 650 })
        .bindTooltip(
          `<div style="font-family:Inter,-apple-system,sans-serif;min-width:130px;max-width:210px;padding:2px 0;">
             <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
               <span style="font-weight:600;font-size:11px;color:#f8fafc;">${name}</span>
               <span style="font-size:9px;color:#38bdf8;background:rgba(56,189,248,0.15);padding:1px 4px;border-radius:2px;">${type}</span>
             </div>
             <div style="font-size:10px;color:#94a3b8;margin-top:3px;line-height:1.35;">${desc}</div>
           </div>`,
          {
            permanent: false,
            direction: 'top',
            offset: [0, -6],
            opacity: 0.98,
          }
        )
        .addTo(mapRef.current);

      landmarksRef.current.push(marker);
    });
  }, []);

  // Dynamic scale bar.
  //
  // The scale must come from the map's actual zoom. Measuring the projected
  // span between the corners of getBounds() cannot work: those corners map to
  // the container edges by definition, so the measurement is the container
  // width at every zoom level. Instead we sample how many CRS.Simple units a
  // fixed pixel distance covers right now, and convert that to ground
  // distance with the region's own affine projection.
  const [scaleKm, setScaleKm] = React.useState<number | null>(null);
  const [scaleWidthPx, setScaleWidthPx] = React.useState<number>(150);

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    const updateScale = () => {
      if (!mapRef.current) return;
      const a = mapRef.current.containerPointToLatLng([0, 0]);
      const b = mapRef.current.containerPointToLatLng([SCALE_SAMPLE_PX, 0]);
      // CRS.Simple maps x → lng, so this is a horizontal span in grid units.
      const crsUnits = Math.abs(b.lng - a.lng);
      if (!Number.isFinite(crsUnits) || crsUnits <= 0) return;

      const kmPerPx = pixelSpanToKm(crsUnits) / SCALE_SAMPLE_PX;
      if (!Number.isFinite(kmPerPx) || kmPerPx <= 0) return;

      const targetPx = 150;
      const niceKm = niceScaleValue(kmPerPx * targetPx);
      setScaleKm(niceKm);
      setScaleWidthPx(Math.max(60, Math.min(250, Math.round(niceKm / kmPerPx))));
    };

    map.on('zoom zoomend move moveend resize', updateScale);
    updateScale();
    return () => {
      map.off('zoom zoomend move moveend resize', updateScale);
    };
  }, []);

  // Express the bar in metres below 1 km so short scales stay readable.
  const scaleUnit = scaleKm != null && scaleKm < 1 ? 'm' : 'km';
  const scaleTotal = scaleKm != null ? (scaleUnit === 'm' ? scaleKm * 1000 : scaleKm) : null;

  /** Retry: remove and re-add the errored base layer tile source. */
  const retryBasemap = useCallback(() => {
    if (!tileErrorLayer || !mapRef.current || !L) return;
    const existing = layersRef.current[tileErrorLayer];
    if (existing) {
      existing.remove();
      delete layersRef.current[tileErrorLayer];
      // Reset tracking — the activeLayers effect will re-add on next render
      delete tileInflightRef.current[tileErrorLayer];
      delete tileLoadedRef.current[tileErrorLayer];
      delete tileErroredRef.current[tileErrorLayer];
    }
    setTileState('loading');
    // Force re-run of the layer effect by toggling internal counter — we
    // can't call onChange here, so instead we delete the cached layer so the
    // existing activeLayers prop causes a fresh tileLayer on next render.
    // The layer will be re-created automatically on the next activeLayers effect run.
    const activeBase = activeLayers.find(
      (l) => l.id === tileErrorLayer && l.visible,
    );
    if (activeBase && L) {
      const tileLayer = L.tileLayer(getTileUrlTemplate(tileErrorLayer), {
        tileSize: 256,
        minZoom: 2,
        maxZoom: 5,
        noWrap: true,
        bounds: LEAFLET_BOUNDS,
        opacity: activeBase.opacity,
      });
      tileInflightRef.current[tileErrorLayer] = 0;
      tileLoadedRef.current[tileErrorLayer] = 0;
      tileErroredRef.current[tileErrorLayer] = 0;
      tileLayer.on('tileloadstart', () => { setTileState('loading'); });
      tileLayer.on('tileload', () => { setTileState('ready'); setTileErrorLayer(null); });
      tileLayer.on('tileerror', () => {
        if ((tileLoadedRef.current[tileErrorLayer] ?? 0) === 0) {
          setTileState('error');
        }
      });
      tileLayer.addTo(mapRef.current);
      layersRef.current[tileErrorLayer] = tileLayer;
    }
  }, [tileErrorLayer, activeLayers]);

  return (
    <div
      className="relative w-full h-full overflow-hidden"
      style={{ background: '#090d16' }}
    >
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ cursor: pinMode ? 'crosshair' : 'grab', background: 'transparent' }}
      />

      {/* Map view reset / Recenter button */}
      <div className="absolute top-[82px] right-[10px] z-[1050]">
        <button
          onClick={() => {
            if (!mapRef.current || !L) return;
            const targetRoute = (activeStrategy && routes[activeStrategy]) || Object.values(routes)[0];
            if (targetRoute?.path && targetRoute.path.length > 1) {
              const bounds = L.latLngBounds(targetRoute.path.map((c) => marsToLeaflet(c.lat, c.lon)));
              mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 4, animate: true });
            } else if (start && destination) {
              const bounds = L.latLngBounds([marsToLeaflet(start.lat, start.lon), marsToLeaflet(destination.lat, destination.lon)]);
              mapRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 4, animate: true });
            } else {
              mapRef.current.setView([TILE_EXTENT / 2, TILE_EXTENT / 2], 2, { animate: true });
            }
          }}
          className="flex items-center justify-center w-[30px] h-[30px] rounded shadow-md transition-all active:scale-95 hover:brightness-110"
          style={{
            background: 'rgba(15, 23, 42, 0.92)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: 'var(--text-primary)',
            backdropFilter: 'blur(8px)',
          }}
          title="Fit route / Recenter map"
          aria-label="Fit route / Recenter map"
        >
          <Crosshair size={15} />
        </button>
      </div>

      {/* Global Mars Explorer launcher button */}
      {onOpenGlobalExplorer && (
        <div className="absolute top-[118px] right-[10px] z-[1050]">
          <button
            onClick={onOpenGlobalExplorer}
            className="flex items-center justify-center w-[30px] h-[30px] rounded shadow-md transition-all active:scale-95 hover:brightness-110"
            style={{
              background: 'rgba(15, 23, 42, 0.92)',
              border: '1px solid var(--accent)',
              color: 'var(--accent)',
              backdropFilter: 'blur(8px)',
            }}
            title="Open Global Mars Explorer (Real NASA 360° Planetary Map)"
            aria-label="Open Global Mars Explorer"
          >
            <Globe size={15} />
          </button>
        </div>
      )}

      {/* Compact tile render state indicator — only shown when actionable */}
      {(tileState === 'loading' || tileState === 'error' || tileState === 'no-base-layer') && (
        <div
          className="absolute top-10 left-1/2 z-[1060] flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-medium"
          style={{
            transform: 'translateX(-50%)',
            background: tileState === 'error' ? 'var(--color-danger-bg)' : 'rgba(15, 23, 42, 0.92)',
            border: `1px solid ${
              tileState === 'error'
                ? 'var(--color-danger-border)'
                : tileState === 'no-base-layer'
                ? 'var(--color-warning-border, var(--border))'
                : 'var(--border)'
            }`,
            color: tileState === 'error' ? 'var(--color-danger)' : 'var(--text-primary)',
            backdropFilter: 'blur(8px)',
            pointerEvents: tileState === 'error' ? 'auto' : 'none',
            maxWidth: '90%',
            whiteSpace: 'nowrap',
          }}
          role="status"
          aria-live="polite"
        >
          {tileState === 'loading' && (
            <>
              <span
                className="inline-block w-2.5 h-2.5 rounded-full animate-pulse"
                style={{ background: 'var(--accent)' }}
              />
              Loading imagery…
            </>
          )}
          {tileState === 'error' && (
            <>
              <span style={{ color: 'var(--color-danger)' }}>⚠</span>
              Imagery unavailable
              {tileErrorLayer && (
                <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                  {' '}({tileErrorLayer})
                </span>
              )}
              <button
                onClick={retryBasemap}
                className="ml-2 underline text-[11px]"
                style={{ color: 'var(--accent)', cursor: 'pointer', background: 'none', border: 'none' }}
                aria-label="Retry loading map imagery"
              >
                Retry
              </button>
            </>
          )}
          {tileState === 'no-base-layer' && (
            <>No basemap selected — toggle a base layer in the Layers panel</>
          )}
        </div>
      )}

      {/* North arrow — fixed position, bottom-right of map */}
      <div
        className="absolute bottom-3 right-3 z-[1050] flex flex-col items-center"
        style={{ pointerEvents: 'none' }}
      >
        <div
          className="flex flex-col items-center rounded px-1.5 py-1"
          style={{
            background: 'rgba(15, 23, 42, 0.92)',
            border: '1px solid rgba(255,255,255,0.15)',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.6)',
          }}
        >
          <svg width="18" height="24" viewBox="0 0 18 24" fill="none">
            {/* North (filled) */}
            <polygon points="9,2 14,13 9,11 4,13" fill="var(--accent)" />
            {/* South (outline only) */}
            <polygon points="9,22 14,11 9,13 4,11" fill="var(--surface-raised)" stroke="var(--border)" strokeWidth="0.5" />
          </svg>
          <span
            className="text-[9px] font-bold mt-0.5"
            style={{ color: 'var(--accent)', letterSpacing: '0.1em' }}
          >
            N
          </span>
        </div>
      </div>

      {/* Dynamic graduated scale bar */}
      {scaleTotal != null && (
        <div
          className="absolute bottom-3 left-3 flex flex-col items-start z-[1050] px-2.5 py-1.5 rounded-lg font-mono select-none"
          style={{
            pointerEvents: 'none',
            background: 'rgba(15, 23, 42, 0.94)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.7)',
          }}
        >
          <div
            className="flex items-end justify-between mb-1"
            style={{ width: scaleWidthPx, minWidth: 60 }}
          >
            <span className="text-[10px] font-mono text-slate-300">0</span>
            <span className="text-[10px] font-mono text-slate-300">{formatScaleNumber(scaleTotal / 2)}</span>
            <span className="text-[10px] font-mono text-emerald-400 font-bold">{formatScaleNumber(scaleTotal)} {scaleUnit}</span>
          </div>
          {/* Graduated bar: two filled cyan + two empty segments */}
          <div
            style={{
              width: scaleWidthPx,
              height: 6,
              display: 'flex',
              border: '1px solid rgba(255, 255, 255, 0.4)',
              borderRadius: 2,
              overflow: 'hidden',
              boxShadow: '0 1px 4px rgba(0, 0, 0, 0.8)',
            }}
          >
            <div style={{ flex: 1, background: '#38BDF8' }} />
            <div style={{ flex: 1, background: 'transparent' }} />
            <div style={{ flex: 1, background: '#38BDF8' }} />
            <div style={{ flex: 1, background: 'transparent' }} />
          </div>
        </div>
      )}

    </div>
  );
}
