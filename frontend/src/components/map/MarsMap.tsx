'use client';

import React, { useEffect, useRef } from 'react';
import type { Coordinate, Route, RouteStrategy, ScienceTarget, ActiveLayer } from '@/types';
import { STRATEGY_META } from '@/types';
import {
  marsToLeaflet,
  leafletToMars,
  LEAFLET_BOUNDS,
} from '@/utils/marsProjection';
import { getTileUrl } from '@/services/api';

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

    // Add Mars-colored background rectangle
    const bgRect = L.rectangle(LEAFLET_BOUNDS, {
      fillColor: '#6B3410',
      fillOpacity: 1,
      color: '#A0522D',
      weight: 1,
      interactive: false,
    });
    bgRect.addTo(map);

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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update tile and reference layers based on activeLayers prop
  useEffect(() => {
    if (!mapRef.current || !L) return;

    activeLayers.forEach((layer) => {
      const existing = layersRef.current[layer.id];

      if (layer.id === 'perseverance_traverse') {
        if (layer.visible && !existing) {
          const latlngs = PERSEVERANCE_TRAVERSE.map((c) => marsToLeaflet(c.lat, c.lon));
          const line = L!.polyline(latlngs, {
            color: '#F59E0B',
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
          existing.setStyle({ opacity: layer.opacity });
        }
        return;
      }

      // Tile layers (terrain, elevation, hazard, science)
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
  }, [activeLayers]);

  // Update start/destination markers
  useEffect(() => {
    if (!mapRef.current || !L) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const addPin = (coord: Coordinate, color: string, label: string) => {
      const pos = marsToLeaflet(coord.lat, coord.lon);
      const icon = L!.divIcon({
        className: '',
        html: `
          <div style="
            background:${color};border:2px solid #fff;border-radius:50% 50% 50% 0;
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

    if (start) addPin(start, '#22C55E', 'START');
    if (destination) addPin(destination, '#EF4444', 'DEST');
  }, [start, destination]);

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

    scienceTargets.forEach((target) => {
      const pos = marsToLeaflet(target.location.lat, target.location.lon);
      const tierColor = ['#22C55E', '#86EFAC', '#FCD34D', '#E5E7EB'][target.tier - 1] ?? '#E5E7EB';
      const icon = L!.divIcon({
        className: '',
        html: `
          <div style="
            background:${tierColor};border:2px solid #1E3A5F;border-radius:50%;
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
  }, [scienceTargets]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      {/* Scale bar */}
      <div className="absolute bottom-4 left-4 bg-[#0B1929]/80 text-white text-xs px-2 py-1 rounded border border-white/20 font-mono">
        ← ~10 km →
      </div>
      {/* Coordinate system label */}
      <div className="absolute top-2 left-2 bg-[#0B1929]/80 text-[10px] text-gray-400 px-2 py-1 rounded font-mono">
        IAU2000 planetocentric · E-positive
      </div>
    </div>
  );
}
