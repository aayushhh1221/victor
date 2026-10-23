'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  marsToLeaflet,
  TILE_EXTENT,
  LEAFLET_BOUNDS,
  leafletToMars,
} from '@/utils/marsProjection';
import { Crosshair, ZoomIn, ZoomOut, Compass } from 'lucide-react';

export interface CorridorData {
  id: string;
  name: string;
  category: string;
  start: { lat: number; lon: number };
  destination: { lat: number; lon: number };
  path: { lat: number; lon: number }[];
  distanceKm: number;
  evaHours: number;
  slopeMax: number;
  hazardScore: number;
  scienceScore: number;
  description: string;
}

interface HeroReconMapProps {
  activeCorridor: CorridorData;
  onSelectCorridor?: (_id: string) => void;
}

export default function HeroReconMap({ activeCorridor }: HeroReconMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const routePolylineRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [activeLayer, setActiveLayer] = useState<'imagery' | 'terrain' | 'elevation'>('imagery');
  const [hoverCoord, setHoverCoord] = useState<{ lat: number; lon: number } | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

  // Initialize Leaflet Map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    if (typeof window === 'undefined') return;
    const L = require('leaflet');
    require('leaflet/dist/leaflet.css');

    // Simple Cartesian projection for Mars raster
    const map = L.map(containerRef.current, {
      crs: L.CRS.Simple,
      minZoom: 0,
      maxZoom: 5,
      zoomControl: false,
      attributionControl: false,
      maxBounds: [
        [-50, -50],
        [TILE_EXTENT + 50, TILE_EXTENT + 50],
      ],
      maxBoundsViscosity: 0.8,
    });

    // Initial center on Jezero delta
    const centerPoint = marsToLeaflet(18.455, 77.38);
    map.setView(centerPoint, 2);

    // Initial Base Tile Layer
    const tileUrl = `${API_BASE}/api/v1/map/tiles/imagery/{z}/{x}/{y}.png`;
    const tileLayer = L.tileLayer(tileUrl, {
      minZoom: 0,
      maxZoom: 5,
      tileSize: 256,
      noWrap: true,
      bounds: LEAFLET_BOUNDS,
      errorTileUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    }).addTo(map);

    tileLayerRef.current = tileLayer;
    mapRef.current = map;
    setIsMapReady(true);

    // Mouse move coordinate readout
    map.on('mousemove', (e: any) => {
      try {
        const mars = leafletToMars(e.latlng.lat, e.latlng.lng);
        if (mars.lat >= 18.0 && mars.lat <= 18.9 && mars.lon >= 77.0 && mars.lon <= 78.0) {
          setHoverCoord(mars);
        }
      } catch {}
    });

    map.on('mouseout', () => {
      setHoverCoord(null);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [API_BASE]);

  // Update Tile Layer when layer switch button is clicked
  useEffect(() => {
    if (!mapRef.current || !isMapReady) return;
    const L = require('leaflet');

    if (tileLayerRef.current) {
      mapRef.current.removeLayer(tileLayerRef.current);
    }

    const tileUrl = `${API_BASE}/api/v1/map/tiles/${activeLayer}/{z}/{x}/{y}.png`;
    const tileLayer = L.tileLayer(tileUrl, {
      minZoom: 0,
      maxZoom: 5,
      tileSize: 256,
      noWrap: true,
      bounds: LEAFLET_BOUNDS,
      errorTileUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    }).addTo(mapRef.current);

    tileLayerRef.current = tileLayer;
  }, [activeLayer, isMapReady, API_BASE]);

  // Update Route Polyline & Markers when activeCorridor changes
  useEffect(() => {
    if (!mapRef.current || !isMapReady || !activeCorridor) return;
    const L = require('leaflet');
    const map = mapRef.current;

    // Clear previous route
    if (routePolylineRef.current) {
      map.removeLayer(routePolylineRef.current);
      routePolylineRef.current = null;
    }

    // Clear previous markers
    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current = [];

    // Convert path to Leaflet coords
    const leafletPath = activeCorridor.path.map((pt) => marsToLeaflet(pt.lat, pt.lon));

    // Outer glow polyline
    const glowLine = L.polyline(leafletPath, {
      color: '#00F0FF',
      weight: 6,
      opacity: 0.35,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);

    // Inner sharp polyline
    const routeLine = L.polyline(leafletPath, {
      color: '#00F0FF',
      weight: 2.5,
      opacity: 0.95,
      dashArray: '6, 6',
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);

    // Group both lines
    const lineGroup = L.layerGroup([glowLine, routeLine]).addTo(map);
    routePolylineRef.current = lineGroup;

    // Start Marker (Green Beacon)
    const startLL = marsToLeaflet(activeCorridor.start.lat, activeCorridor.start.lon);
    const startIcon = L.divIcon({
      className: 'custom-start-marker',
      html: `
        <div style="position:relative; width:22px; height:22px; display:flex; align-items:center; justify-content:center;">
          <div style="position:absolute; inset:0; border-radius:50%; background:rgba(34,197,94,0.35); animation:ping 1.8s cubic-bezier(0,0,0.2,1) infinite;"></div>
          <div style="width:12px; height:12px; border-radius:50%; background:#22C55E; border:2px solid #FFFFFF; box-shadow:0 0 10px #22C55E;"></div>
        </div>
      `,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
    const startMarker = L.marker(startLL, { icon: startIcon }).addTo(map);

    // Dest Marker (Red Beacon)
    const destLL = marsToLeaflet(activeCorridor.destination.lat, activeCorridor.destination.lon);
    const destIcon = L.divIcon({
      className: 'custom-dest-marker',
      html: `
        <div style="position:relative; width:22px; height:22px; display:flex; align-items:center; justify-content:center;">
          <div style="position:absolute; inset:0; border-radius:50%; background:rgba(239,68,68,0.35); animation:ping 1.8s cubic-bezier(0,0,0.2,1) infinite;"></div>
          <div style="width:12px; height:12px; border-radius:50%; background:#EF4444; border:2px solid #FFFFFF; box-shadow:0 0 10px #EF4444;"></div>
        </div>
      `,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
    const destMarker = L.marker(destLL, { icon: destIcon }).addTo(map);

    markersRef.current = [startMarker, destMarker];

    // Smooth pan/zoom to fit route with padding
    try {
      const bounds = L.latLngBounds(leafletPath);
      map.flyToBounds(bounds, {
        padding: [30, 30],
        maxZoom: 3,
        duration: 0.8,
      });
    } catch {}
  }, [activeCorridor, isMapReady]);

  // Zoom controls
  const handleZoomIn = () => mapRef.current?.zoomIn();
  const handleZoomOut = () => mapRef.current?.zoomOut();
  const handleResetView = () => {
    if (!mapRef.current) return;
    const centerPoint = marsToLeaflet(18.455, 77.38);
    mapRef.current.flyTo(centerPoint, 2, { duration: 0.6 });
  };

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-white/10 bg-[#06090F] shadow-2xl flex flex-col">
      {/* Top Tactical Bezel Bar */}
      <div className="px-4 py-2.5 bg-[#08131E] border-b border-white/10 flex items-center justify-between z-10 select-none">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
          </span>
          <span className="text-[11px] font-mono font-bold tracking-wider text-slate-200 uppercase">
            Jezero Tactical Reconnaissance Station
          </span>
          <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-cyan-950/80 text-cyan-300 border border-cyan-800/60">
            MRO CTX 5m/px
          </span>
        </div>

        {/* Layer Selector Chips */}
        <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded-lg border border-white/5">
          {(
            [
              { id: 'imagery', label: 'CTX Panchro' },
              { id: 'terrain', label: 'Shaded Relief' },
              { id: 'elevation', label: 'MOLA Topo' },
            ] as const
          ).map((l) => (
            <button
              key={l.id}
              onClick={() => setActiveLayer(l.id)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono transition-all ${
                activeLayer === l.id
                  ? 'bg-blue-600 text-white font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Leaflet Map Viewport */}
      <div className="relative w-full h-[380px] sm:h-[440px] bg-[#06090F]">
        <div ref={containerRef} className="w-full h-full" />

        {/* Tactical Crosshair Reticle Center Overlay */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-15">
          <div className="w-20 h-20 border border-cyan-400 rounded-full flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full" />
          </div>
          <div className="absolute w-32 h-[1px] bg-cyan-400" />
          <div className="absolute h-32 w-[1px] bg-cyan-400" />
        </div>

        {/* Map Floating Tactical Controls (Top-Right) */}
        <div className="absolute top-3 right-3 z-[400] flex flex-col gap-1 bg-[#08131E]/90 backdrop-blur-md p-1 rounded-xl border border-white/10 shadow-lg">
          <button
            onClick={handleZoomIn}
            title="Zoom In"
            className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors text-sm font-bold"
          >
            <ZoomIn size={14} />
          </button>
          <button
            onClick={handleZoomOut}
            title="Zoom Out"
            className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors text-sm font-bold"
          >
            <ZoomOut size={14} />
          </button>
          <button
            onClick={handleResetView}
            title="Recenter Jezero"
            className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors text-sm font-bold"
          >
            <Compass size={14} />
          </button>
        </div>

        {/* Bottom Cartographic Scale Bar & Coordinates */}
        <div className="absolute bottom-3 left-3 z-[400] flex items-center gap-2">
          <div className="px-2.5 py-1 rounded-lg bg-[#08131E]/90 backdrop-blur-md border border-white/10 font-mono text-[10px] text-slate-300 flex items-center gap-2 shadow-lg">
            <Crosshair size={12} className="text-cyan-400" />
            <span>
              {hoverCoord
                ? `${hoverCoord.lat.toFixed(4)}°N, ${hoverCoord.lon.toFixed(4)}°E`
                : `${activeCorridor.start.lat.toFixed(3)}°N, ${activeCorridor.start.lon.toFixed(3)}°E (Active Corridor)`}
            </span>
          </div>

          <div className="px-2.5 py-1 rounded-lg bg-[#08131E]/90 backdrop-blur-md border border-white/10 font-mono text-[10px] text-slate-300 flex items-center gap-1.5 shadow-lg">
            <span className="w-10 h-1 bg-cyan-400/80 rounded" />
            <span>2.0 km</span>
          </div>
        </div>
      </div>

      {/* Bottom Telemetry Strip */}
      <div className="px-4 py-3 bg-[#08131E] border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
        <div>
          <span className="text-[10px] uppercase text-slate-400 block">Distance</span>
          <span className="font-bold text-white text-sm">{activeCorridor.distanceKm} km</span>
        </div>
        <div>
          <span className="text-[10px] uppercase text-slate-400 block">Est. EVA Time</span>
          <span className="font-bold text-cyan-400 text-sm">{activeCorridor.evaHours} h</span>
        </div>
        <div>
          <span className="text-[10px] uppercase text-slate-400 block">Max Slope</span>
          <span className="font-bold text-emerald-400 text-sm">{activeCorridor.slopeMax}°</span>
        </div>
        <div>
          <span className="text-[10px] uppercase text-slate-400 block">Science Yield</span>
          <span className="font-bold text-amber-400 text-sm">{(activeCorridor.scienceScore * 10).toFixed(1)} / 10</span>
        </div>
      </div>
    </div>
  );
}
