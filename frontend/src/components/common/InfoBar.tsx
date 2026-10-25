'use client';

import React from 'react';
import { MapPin, Mountain, Layers, Thermometer, Wind } from 'lucide-react';
import type { EnvironmentResponse, RegionInfo } from '@/types';

/**
 * Region summary strip.
 *
 * Purely presentational: every value comes from GET /api/v1/map/region, which
 * computes them from the loaded NASA grids. There are deliberately NO fallback
 * constants here. If the request fails, or the backend reports a field as null,
 * the card renders — with a tooltip saying why. Showing a plausible-looking
 * number in place of a measurement is the one thing this project must never do.
 */

interface InfoBarProps {
  region: RegionInfo | null;
  loading: boolean;
  /** Human-readable reason the region could not be loaded, if it failed. */
  error: string | null;
  /**
   * Conditions from GET /api/v1/environment/current, when loaded.
   *
   * Only the temperature and dust cards read it. Both quantities come back null
   * today — the MCS products behind them are not ingested — so the cards stay
   * at —, but the endpoint's `notes` string now explains why in the tooltip
   * instead of a hardcoded sentence. If a real value ever arrives the card
   * shows it, credited to the source the endpoint names.
   */
  environment?: EnvironmentResponse | null;
}


function InfoCard({
  icon,
  label,
  value,
  sub,
  unavailable,
  tooltip,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  unavailable?: boolean;
  tooltip?: string;
}) {
  return (
    <div
      className="info-card flex items-center gap-3 px-4 py-3 flex-1 min-w-0"
      title={tooltip}
    >
      <div
        className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-md"
        style={{
          background: unavailable ? 'var(--surface-sunken)' : 'var(--accent-light)',
          color: unavailable ? 'var(--text-disabled)' : 'var(--accent)',
        }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="section-heading truncate">{label}</p>
        <p
          className="text-sm font-semibold mt-0.5 truncate"
          style={{ color: unavailable ? 'var(--text-muted)' : 'var(--text-primary)' }}
        >
          {value}
        </p>
        {sub && (
          <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

/** Format a planetocentric coordinate pair, respecting hemisphere signs. */
function formatCoords(lat: number, lon: number): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(3)}°${ns}, ${Math.abs(lon).toFixed(3)}°${ew}`;
}

export default function InfoBar({ region, loading, error, environment }: InfoBarProps) {
  if (loading) {
    return (
      <div
        className="flex gap-2 px-4 py-2 border-b flex-shrink-0"
        style={{ borderColor: 'var(--border)' }}
      >
        {[...Array(5)].map((_, i) => (
          <div key={i} className="skeleton h-14 flex-1 rounded-lg" />
        ))}
      </div>
    );
  }

  // One reason string reused by every card that has nothing to show.
  const missingReason = error
    ? `Region metadata unavailable: ${error}`
    : 'Region metadata unavailable — backend did not report this field';

  const hasCoords = region?.lat != null && region?.lon != null;
  const hasElevation = region?.elevation_m != null;
  const hasTerrain = !!region?.terrain_type;

  const elevationSub = (() => {
    if (!hasElevation) return undefined;
    const { elevation_min_m: lo, elevation_max_m: hi } = region!;
    const range =
      lo != null && hi != null
        ? `${Math.round(lo).toLocaleString()} to ${Math.round(hi).toLocaleString()} m`
        : 'MOLA datum';
    return `MOLA/MGS · ${range}`;
  })();

  // ── Environmental cards ───────────────────────────────────────────────────
  const dayTemp = environment?.surface_temperature_day_c ?? null;
  const hasTemp = dayTemp != null;
  const dustTau = environment?.dust_opacity_tau ?? null;
  const hasDust = dustTau != null;

  return (
    <div
      className="flex gap-0 border-b flex-shrink-0"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--border)',
      }}
    >
      <div className="flex flex-1 divide-x" style={{ borderColor: 'var(--border)' }}>
        <InfoCard
          icon={<MapPin size={16} />}
          label="Selected Region"
          value={region?.name ?? '—'}
          sub={hasCoords ? formatCoords(region!.lat!, region!.lon!) : undefined}
          unavailable={!region?.name}
          tooltip={
            region?.name
              ? hasCoords
                ? `${region.name} (${formatCoords(region!.lat!, region!.lon!)}) · ${region.region_description ?? ''}`
                : `${region.name} (Coordinates unavailable) · ${region.region_description ?? ''}`
              : missingReason
          }
        />
        <InfoCard
          icon={<Mountain size={16} />}
          label="Elevation (Mean)"
          value={hasElevation ? `${Math.round(region!.elevation_m!).toLocaleString()} m` : '—'}
          sub={elevationSub}
          unavailable={!hasElevation}
          tooltip={
            hasElevation
              ? `Mean topographic elevation (${Math.round(region!.elevation_m!).toLocaleString()} m) relative to the Mars areoid datum. Source: MGS MOLA MEGDR raster.`
              : missingReason
          }
        />
        <InfoCard
          icon={<Layers size={16} />}
          label="Terrain Type"
          value={region?.terrain_type ?? '—'}
          sub={region?.terrain_subtype ? 'Crater Floor & Delta' : undefined}
          unavailable={!hasTerrain}
          tooltip={hasTerrain ? (region!.terrain_subtype ?? 'Martian crater sedimentary floor') : missingReason}
        />
        <InfoCard
          icon={<Thermometer size={16} />}
          label="Surface Temp. (Daytime)"
          value={hasTemp ? `${dayTemp} °C` : '—'}
          sub={
            hasTemp
              ? 'MEDA TIRS · Mars 2020'
              : 'Not available — MEDA not ingested'
          }
          unavailable={!hasTemp}
          tooltip={
            hasTemp
              ? `Daytime surface temperature (${dayTemp} °C) from NASA Mars 2020 Perseverance MEDA Thermal Infrared Sensor (TIRS). Sol 1–1000 PDS Atmospheres Node.`
              : (environment?.notes ?? 'Temperature data unavailable.')
          }
        />
        <InfoCard
          icon={<Wind size={16} />}
          label="Atmospheric Dust (τ)"
          value={hasDust ? `τ ${dustTau}` : '—'}
          sub={
            hasDust
              ? 'MEDA RDS · Mars 2020'
              : 'Not available — MEDA not ingested'
          }
          unavailable={!hasDust}
          tooltip={
            hasDust
              ? `Atmospheric dust optical depth (tau = ${dustTau}) from NASA Mars 2020 Perseverance MEDA Radiation & Dust Sensor (RDS). PDS Atmospheres Node.`
              : (environment?.notes ?? 'Dust optical depth unavailable.')
          }
        />
      </div>
    </div>
  );
}
