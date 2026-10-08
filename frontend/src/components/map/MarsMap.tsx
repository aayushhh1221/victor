'use client';

import React, { useEffect, useRef } from 'react';
import type { Coordinate, Route, RouteStrategy, ScienceTarget, ActiveLayer } from '@/types';
import { STRATEGY_META } from '@/types';
import {
  marsToLeaflet,
  leafletToMars,
  pixelSpanToKm,
  LEAFLET_BOUNDS,
} from '@/utils/marsProjection';
import { getTileUrl } from '@/services/api';
import { useTheme } from '@/utils/theme';
import { readToken } from '@/utils/color';

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
  onMapClick: (coord: Coordinate) => void;
  onSegmentClick: (strategy: RouteStrategy, segmentId: number) => void;
  activeStrategy: RouteStrategy | null;
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

export default function MarsMap({
  start,
  destination,
  routes,
  activeLayers,
  scienceTargets,
  onMapClick,
  onSegmentClick,
  activeStrategy,
}: MarsMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layersRef = useRef<Record<string, any>>({});
  const routeLayersRef = useRef<any[]>([]);
  const markersRef = useRef<any[]>([]);
  const sciLayersRef = useRef<any[]>([]);
  const bgRectRef = useRef<any>(null);

  // Leaflet vector styles take concrete colour values, so every token below is
  // resolved at paint time. `theme` must therefore appear in the dependency
  // array of every effect that reads one, or the canvas keeps the old theme's
  // colours after a toggle.
  const { theme } = useTheme();

  // Initialize Leaflet map on mount
  useEffect(() => {
    if (!containerRef.current || mapRef.current || !L) return;

    const map = L.map(containerRef.current, {
      crs: L.CRS.Simple,
      minZoom: 1,
      maxZoom: 5,
      zoomControl: false,
      attributionControl: false,
    });

    // Add zoom control in top-right
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Set initial view to Jezero center
    const center = marsToLeaflet(18.45, 77.5);
    map.setView(center, 2);

    // Click handler — convert Leaflet pixel → Mars lat/lon
    map.on('click', (e: any) => {
      const { lat: ly, lng: lx } = e.latlng;
      const marsCoord = leafletToMars(ly, lx);
      onMapClick(marsCoord);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      bgRectRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mars-coloured background rectangle — restyled whenever the theme changes
  useEffect(() => {
    if (!mapRef.current || !L) return;
    const fillColor = readToken('--leaflet-bg', '#C8A882');
    const color = readToken('--map-border', '#A0522D');

    if (bgRectRef.current) {
      bgRectRef.current.setStyle({ fillColor, color });
      return;
    }
    const bgRect = L.rectangle(LEAFLET_BOUNDS, {
      fillColor,
      fillOpacity: 1,
      color,
      weight: 1,
      interactive: false,
    });
    bgRect.addTo(mapRef.current);
    bgRect.bringToBack();
    bgRectRef.current = bgRect;
  }, [theme]);

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
      if (layer.visible) {
        if (!existing) {
          const tileLayer = L!.tileLayer(
            `${getTileUrl(layer.id, 0, 0, 0).replace('/0/0/0.png', '')}/{z}/{x}/{y}.png`,
            {
              tileSize: 256,
              minZoom: 1,
              maxZoom: 5,
              noWrap: true,
              bounds: LEAFLET_BOUNDS,
              opacity: layer.opacity,
            }
          );
          tileLayer.addTo(mapRef.current);
          layersRef.current[layer.id] = tileLayer;
        } else {
          existing.setOpacity(layer.opacity);
        }
      } else {
        if (existing) {
          existing.remove();
          delete layersRef.current[layer.id];
        }
      }
    });
  }, [activeLayers, theme]);

  // Update start/destination markers
  useEffect(() => {
    if (!mapRef.current || !L) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const pinRing = readToken('--surface', '#FFFFFF');

    const addPin = (coord: Coordinate, color: string, label: string) => {
      const pos = marsToLeaflet(coord.lat, coord.lon);
      const icon = L!.divIcon({
        className: '',
        html: `
          <div style="
            background:${color};border:2px solid ${pinRing};border-radius:50% 50% 50% 0;
            width:20px;height:20px;transform:rotate(-45deg);
            box-shadow:0 2px 6px rgba(0,0,0,0.5)
          "></div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 20],
      });
      const marker = L!.marker(pos, { icon })
        .bindTooltip(label, { permanent: true, direction: 'right', offset: [12, -10] })
        .addTo(mapRef.current);
      markersRef.current.push(marker);
    };

    const pinStart = readToken('--pin-start', '#22C55E');
    const pinDest = readToken('--pin-dest', '#EF4444');

    if (start) addPin(start, pinStart, 'START');
    if (destination) addPin(destination, pinDest, 'DEST');
  }, [start, destination, theme]);

  // Draw route polylines
  useEffect(() => {
    if (!mapRef.current || !L) return;
    routeLayersRef.current.forEach((l) => l.remove());
    routeLayersRef.current = [];

    Object.entries(routes).forEach(([strategyName, route]) => {
      if (!route) return;
      const meta = STRATEGY_META[strategyName as RouteStrategy];
      const isActive = activeStrategy === null || activeStrategy === strategyName;
      const weight = isActive ? 3 : 1.5;
      const opacity = isActive ? 0.9 : 0.3;

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

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      {/* Dynamic graduated scale bar — hidden until measured from the live map */}
      {scaleTotal != null && (
        <div
          className="absolute bottom-4 left-4 flex flex-col items-start z-10"
          style={{ pointerEvents: 'none' }}
        >
          <div
            className="flex items-end justify-between text-[10px] font-mono mb-0.5"
            style={{ width: scaleWidthPx, color: 'var(--text-primary)' }}
          >
            <span>0</span>
            <span>{formatScaleNumber(scaleTotal / 2)}</span>
            <span>{formatScaleNumber(scaleTotal)} {scaleUnit}</span>
          </div>
          <div
            style={{
              width: scaleWidthPx,
              height: 6,
              display: 'flex',
              border: '1.5px solid var(--text-primary)',
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <div style={{ flex: 1, background: 'var(--text-primary)' }} />
            <div style={{ flex: 1, background: 'transparent' }} />
            <div style={{ flex: 1, background: 'var(--text-primary)' }} />
            <div style={{ flex: 1, background: 'transparent' }} />
          </div>
        </div>
      )}
      {/* Coordinate system label */}
      <div
        className="absolute top-2 left-2 text-[10px] px-2 py-1 rounded font-mono z-10"
        style={{
          background: 'var(--surface-overlay)',
          color: 'var(--text-muted)',
          border: '1px solid var(--border)',
          pointerEvents: 'none',
        }}
      >
        IAU2000 planetocentric · E-positive
      </div>
    </div>
  );
}
