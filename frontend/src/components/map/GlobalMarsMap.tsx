'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Compass, Layers, ExternalLink } from 'lucide-react';

let L: typeof import('leaflet') | null = null;
if (typeof window !== 'undefined') {
  L = require('leaflet');
  require('leaflet/dist/leaflet.css');
}

interface MarsLandmark {
  name: string;
  category: 'rover' | 'lander' | 'geology';
  lat: number;
  lon: number; // -180 to 180 for standard map
  marsLon: number; // 0 to 360 East
  elevationKm?: number;
  mission?: string;
  year?: number;
  desc: string;
  isTargetSite?: boolean;
}

const MARS_LANDMARKS: MarsLandmark[] = [
  {
    name: 'Jezero Crater',
    category: 'rover',
    lat: 18.38,
    lon: 77.58,
    marsLon: 77.58,
    elevationKm: -2.5,
    mission: 'Perseverance Rover & Ingenuity Helicopter (Mars 2020)',
    year: 2021,
    desc: 'Ancient lake basin with a preserved river delta rich in carbonates and olivine. Active study area for the VICTOR EVA pathfinder.',
    isTargetSite: true,
  },
  {
    name: 'Gale Crater (Mount Sharp)',
    category: 'rover',
    lat: -4.59,
    lon: 137.44,
    marsLon: 137.44,
    elevationKm: -4.5,
    mission: 'Curiosity Rover (Mars Science Laboratory)',
    year: 2012,
    desc: 'Impact crater featuring Aeolis Mons (Mount Sharp), a 5 km central mound of layered sedimentary rocks preserving evidence of past aqueous environments.',
  },
  {
    name: 'Meridiani Planum',
    category: 'rover',
    lat: -1.94,
    lon: -5.53,
    marsLon: 354.47,
    elevationKm: -1.3,
    mission: 'Opportunity Rover (MER-B)',
    year: 2004,
    desc: 'Hematite-rich plain where Opportunity discovered "blueberries" (spherical hematite concretions) proving prolonged ancient liquid water presence.',
  },
  {
    name: 'Gusev Crater',
    category: 'rover',
    lat: -14.57,
    lon: 175.47,
    marsLon: 175.47,
    elevationKm: -1.9,
    mission: 'Spirit Rover (MER-A)',
    year: 2004,
    desc: 'Ancient crater hosting Columbia Hills and hydrothermal silica deposits indicating past volcanic hot springs.',
  },
  {
    name: 'Olympus Mons',
    category: 'geology',
    lat: 18.65,
    lon: -133.8,
    marsLon: 226.2,
    elevationKm: 21.9,
    desc: 'The largest shield volcano and tallest planetary mountain in the Solar System, standing nearly 22 km above Martian datum with an 80 km caldera.',
  },
  {
    name: 'Valles Marineris',
    category: 'geology',
    lat: -14.0,
    lon: -59.2,
    marsLon: 300.8,
    elevationKm: -7.0,
    desc: 'Massive canyon system stretching over 4,000 km across the Martian equator, reaching depths of up to 7 km and widths of 200 km.',
  },
  {
    name: 'Elysium Planitia',
    category: 'lander',
    lat: 4.5,
    lon: 135.62,
    marsLon: 135.62,
    elevationKm: -2.6,
    mission: 'InSight Lander',
    year: 2018,
    desc: 'Smooth volcanic plain where InSight measured Marsquakes and internal planetary core-mantle boundary structure.',
  },
  {
    name: 'Chryse Planitia',
    category: 'lander',
    lat: 22.48,
    lon: -47.95,
    marsLon: 312.05,
    elevationKm: -3.8,
    mission: 'Viking 1 Lander',
    year: 1976,
    desc: 'Historic first successful long-duration Mars surface mission, imaging rocky volcanic plains and outflow channels.',
  },
  {
    name: 'Utopia Planitia',
    category: 'lander',
    lat: 48.27,
    lon: 110.0,
    marsLon: 110.0,
    elevationKm: -4.1,
    mission: 'Viking 2 (1976) & Zhurong (2021)',
    year: 2021,
    desc: 'Vast northern plains basin containing vast subsurface water-ice sheets and ancient sedimentary shoreline deposits.',
  },
];

type GlobalLayerId = 'mola' | 'viking';

const GLOBAL_BASEMAPS: Record<GlobalLayerId, { name: string; url: string; subdomains?: string[]; maxZoom: number; desc: string }> = {
  mola: {
    name: 'NASA MGS MOLA Global Topography (Elevation)',
    url: 'https://trek.nasa.gov/tiles/Mars/EQ/Mars_MGS_MOLA_ClrShade_merge_global_463m/1.0.0/default/default028mm/{z}/{y}/{x}.jpg',
    maxZoom: 6,
    desc: 'Global shaded elevation map from the Mars Orbiter Laser Altimeter on Mars Global Surveyor (NASA Solar System Treks).',
  },
  viking: {
    name: 'NASA Viking MDIM 2.1 (Global Natural Color)',
    url: 'https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/default/default028mm/{z}/{y}/{x}.jpg',
    maxZoom: 6,
    desc: 'Calibrated color controlled global mosaic from NASA Viking Orbiter cameras (232 m/px, NASA Solar System Treks).',
  },
};

interface GlobalMarsMapProps {
  onSelectJezero?: () => void;
}

export default function GlobalMarsMap({ onSelectJezero }: GlobalMarsMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const [activeLayer, setActiveLayer] = useState<GlobalLayerId>('mola');
  const [hoverCoord, setHoverCoord] = useState<{ lat: number; lon: number } | null>(null);
  const [tileError, setTileError] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !L) return;

    // Initialize Leaflet map with standard Web Mercator for global tiles
    const MARS_GLOBAL_BOUNDS: [[number, number], [number, number]] = [
      [-85, -180],
      [85, 180],
    ];

    const map = L.map(containerRef.current, {
      center: [15, 75],
      zoom: 2,
      minZoom: 2,
      maxZoom: 6,
      zoomControl: false,
      attributionControl: false,
      worldCopyJump: false,
      maxBounds: MARS_GLOBAL_BOUNDS,
      maxBoundsViscosity: 1.0,
    });

    L.control.zoom({ position: 'topright' }).addTo(map);

    // Initial tile layer - noWrap: true guarantees single continuous planet
    const baseConfig = GLOBAL_BASEMAPS[activeLayer];
    const tileLayer = L.tileLayer(baseConfig.url, {
      maxZoom: baseConfig.maxZoom,
      noWrap: true,
      bounds: MARS_GLOBAL_BOUNDS,
    });
    tileLayer.on('tileerror', () => {
      setTileError(true);
    });
    tileLayer.addTo(map);
    layerRef.current = tileLayer;

    // Fit single globe cleanly into view without horizontal duplication
    map.fitBounds([[-65, -170], [65, 170]], { padding: [12, 12] });

    // Mouse coordinates tracker
    map.on('mousemove', (e: any) => {
      const lat = parseFloat(e.latlng.lat.toFixed(2));
      const lon = parseFloat(e.latlng.lng.toFixed(2));
      // Normalize to 0-360 East
      const marsLon = parseFloat((((lon % 360) + 360) % 360).toFixed(2));
      setHoverCoord({ lat, lon: marsLon });
    });

    // Add landmarks
    MARS_LANDMARKS.forEach((lm) => {
      const isTarget = lm.isTargetSite;
      const pinColor = isTarget ? '#22C55E' : lm.category === 'geology' ? '#F59E0B' : '#3B82F6';

      const icon = L!.divIcon({
        className: '',
        html: `
          <div style="
            position:relative;
            display:flex;align-items:center;justify-content:center;
            width:${isTarget ? '28px' : '20px'};height:${isTarget ? '28px' : '20px'};
          ">
            ${isTarget ? `<div style="
              position:absolute;inset:0;border-radius:50%;
              background:rgba(34,197,94,0.4);
              animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;
            "></div>` : ''}
            <div style="
              background:${pinColor};border:2px solid #FFFFFF;border-radius:50%;
              width:${isTarget ? '16px' : '12px'};height:${isTarget ? '16px' : '12px'};
              box-shadow:0 2px 6px rgba(0,0,0,0.8);
              cursor:pointer;
            "></div>
          </div>
        `,
        iconSize: [isTarget ? 28 : 20, isTarget ? 28 : 20],
        iconAnchor: [isTarget ? 14 : 10, isTarget ? 14 : 10],
      });

      const popupContent = `
        <div style="font-family:Inter,sans-serif;font-size:12px;max-width:240px;color:#111;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
            <strong style="font-size:13px;color:#0F172A;">${lm.name}</strong>
            ${isTarget ? `<span style="background:#DCFCE7;color:#166534;font-size:10px;font-weight:700;padding:1px 6px;border-radius:4px;">VICTOR ACTIVE</span>` : ''}
          </div>
          <div style="font-size:11px;color:#64748B;margin-bottom:6px;">
            ${lm.lat >= 0 ? `${lm.lat}°N` : `${Math.abs(lm.lat)}°S`}, ${lm.marsLon}°E
            ${lm.elevationKm !== undefined ? ` · Elev: ${lm.elevationKm > 0 ? `+${lm.elevationKm}` : lm.elevationKm} km` : ''}
          </div>
          ${lm.mission ? `<div style="font-size:11px;font-weight:600;color:#2563EB;margin-bottom:4px;">${lm.mission} (${lm.year})</div>` : ''}
          <p style="font-size:11px;line-height:1.4;margin:0 0 8px 0;color:#334155;">${lm.desc}</p>
          ${isTarget ? `
            <button id="btn-goto-jezero" style="
              width:100%;background:#16A34A;color:#fff;border:none;border-radius:6px;
              padding:6px 10px;font-weight:600;font-size:11px;cursor:pointer;
              display:flex;align-items:center;justify-content:center;gap:4px;
            ">
              Open Tactical Mission Planner →
            </button>
          ` : ''}
        </div>
      `;

      const marker = L!.marker([lm.lat, lm.lon], { icon }).addTo(map);
      marker.bindPopup(popupContent);

      marker.on('popupopen', () => {
        const btn = document.getElementById('btn-goto-jezero');
        if (btn && onSelectJezero) {
          btn.onclick = () => onSelectJezero();
        }
      });
    });

    // Jezero Target Boundary Box on the global planet map
    const jezeroBounds: [[number, number], [number, number]] = [
      [18.0, 77.0],
      [18.9, 78.0],
    ];
    L.rectangle(jezeroBounds, {
      color: '#22C55E',
      weight: 2,
      fillColor: '#22C55E',
      fillOpacity: 0.25,
      dashArray: '3, 3',
    })
      .bindTooltip('<strong>Jezero Crater Exploration Zone</strong><br/>VICTOR Active EVA Routing Grid (53 × 59 km)', { sticky: true })
      .addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Switch tile basemap
  useEffect(() => {
    if (!mapRef.current || !L) return;
    if (layerRef.current) {
      layerRef.current.remove();
    }
    const config = GLOBAL_BASEMAPS[activeLayer];
    const newLayer = L.tileLayer(config.url, {
      maxZoom: config.maxZoom,
      noWrap: true,
      bounds: [[-85, -180], [85, 180]],
    });
    newLayer.on('tileerror', () => {
      setTileError(true);
    });
    newLayer.addTo(mapRef.current);
    layerRef.current = newLayer;
  }, [activeLayer]);

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden" style={{ background: '#050508' }}>
      {/* Top Banner / HUD Controls */}
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b z-10"
        style={{
          background: 'var(--surface-raised)',
          borderColor: 'var(--border)',
        }}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Compass size={16} style={{ color: 'var(--accent)' }} />
            <span className="font-semibold text-xs tracking-wide uppercase" style={{ color: 'var(--text-primary)' }}>
              Mars Planetary Explorer
            </span>
          </div>
          <span className="text-[11px] px-2 py-0.5 rounded font-mono" style={{ background: 'var(--surface-sunken)', color: 'var(--text-muted)' }}>
            Global 360° Planetary Coverage · Real NASA / USGS Data
          </span>
        </div>

        {/* Basemap Switcher */}
        <div className="flex items-center gap-1.5">
          <Layers size={13} style={{ color: 'var(--text-muted)' }} />
          <span className="text-xs mr-1" style={{ color: 'var(--text-muted)' }}>
            Basemap:
          </span>
          {(Object.keys(GLOBAL_BASEMAPS) as GlobalLayerId[]).map((id) => (
            <button
              key={id}
              onClick={() => {
                setTileError(false);
                setActiveLayer(id);
              }}
              className="px-2.5 py-1 rounded text-[11px] font-medium transition-colors"
              style={{
                background: activeLayer === id ? 'var(--accent)' : 'var(--surface-sunken)',
                color: activeLayer === id ? 'var(--on-accent)' : 'var(--text-secondary)',
                border: `1px solid ${activeLayer === id ? 'var(--accent)' : 'var(--border)'}`,
              }}
            >
              {id === 'viking' ? 'Viking Color Globe' : 'NASA MOLA Topography'}
            </button>
          ))}
        </div>
      </div>

      {/* Main Map Canvas */}
      <div className="relative flex-1 w-full h-full">
        <div ref={containerRef} className="w-full h-full" style={{ background: '#050508' }} />

        {/* Offline / unreachable fallback notification */}
        {tileError && (
          <div
            className="absolute top-4 left-1/2 -translate-x-1/2 z-[1050] px-4 py-2 rounded-lg text-xs font-medium shadow-2xl backdrop-blur-md flex items-center gap-2 max-w-lg text-center"
            style={{
              background: 'rgba(30, 41, 59, 0.95)',
              color: '#F8FAFC',
              border: '1px solid rgba(245, 158, 11, 0.6)',
            }}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
            <span>
              Global NASA Treks tiles are currently unreachable offline. Local tactical layers for Jezero Crater remain fully operational.
            </span>
          </div>
        )}

        {/* Target Site Callout floating box */}
        <div
          className="absolute bottom-6 left-6 z-[1050] rounded-xl p-3.5 shadow-2xl backdrop-blur-md max-w-sm"
          style={{
            background: 'rgba(15, 23, 42, 0.92)',
            border: '1px solid rgba(34, 197, 94, 0.5)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            color: '#FFFFFF',
          }}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Active Mission Zone: Jezero Crater
            </span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed mb-3">
            Jezero Crater (18.38°N, 77.58°E) is VICTOR’s active high-resolution multi-mission operational zone.
            Features 5 m/px CTX imagery, CRISM mineral spectroscopy, and multi-objective A* traverse routing.
          </p>
          {onSelectJezero && (
            <button
              onClick={onSelectJezero}
              className="flex items-center justify-center gap-2 w-full py-2 rounded-lg text-xs font-semibold shadow-md transition-all hover:brightness-110 active:scale-98"
              style={{ background: '#16A34A', color: '#FFFFFF' }}
            >
              <span>Launch Tactical Route Planner</span>
              <ExternalLink size={13} />
            </button>
          )}
        </div>

        {/* Live Coordinate Display */}
        <div
          className="absolute bottom-6 right-6 z-[1050] px-3.5 py-2 rounded-lg font-mono text-[11px] shadow-2xl backdrop-blur-md"
          style={{
            background: 'rgba(15, 23, 42, 0.92)',
            color: '#E2E8F0',
            border: '1px solid rgba(255,255,255,0.15)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          }}
        >
          {hoverCoord
            ? `LAT: ${hoverCoord.lat >= 0 ? `${hoverCoord.lat}°N` : `${Math.abs(hoverCoord.lat)}°S`}  ·  LON: ${hoverCoord.lon}°E (IAU2000)`
            : 'Explore Mars · Hover to inspect IAU2000 planetocentric coordinates'}
        </div>
      </div>
    </div>
  );
}
