'use client';

import React from 'react';
import type { DataMode } from '@/types';
import { useTheme } from '@/utils/theme';
import { HelpCircle, Moon, Sun } from 'lucide-react';

/** Full product name, used wherever the long form belongs. */
export const PRODUCT_NAME_LONG =
  'VICTOR — Voyage Intelligence for Terrain-aware Cartographic Optimization & Routing';

interface HeaderProps {
  dataMode: DataMode | null;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const TABS = [
  { id: 'planner',     label: 'Mission Planner' },
  { id: 'explorer',   label: 'Mars Explorer' },
  { id: 'layers',     label: 'Data & Layers' },
  { id: 'science',    label: 'Science Targets' },
  { id: 'methodology', label: 'Methodology' },
  { id: 'about',      label: 'About' },
];

function DataModeBadge({ mode }: { mode: DataMode | null }) {
  if (!mode) return null;
  const config: Record<DataMode, { label: string; cls: string; dot: string }> = {
    LIVE: {
      label: 'LIVE DATA',
      cls: 'badge-live',
      dot: 'var(--mode-live)',
    },
    VERIFIED_SNAPSHOT: {
      label: 'VERIFIED DATA',
      cls: 'badge-verified',
      dot: 'var(--mode-verified)',
    },
    DEMONSTRATION: {
      label: 'DEMO DATA',
      cls: 'badge-demonstration',
      dot: 'var(--mode-demo)',
    },
  };
  const c = config[mode];
  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium ${c.cls}`}
      title={
        mode === 'DEMONSTRATION'
          ? 'Running on synthetic demonstration data — not real NASA observations'
          : mode === 'VERIFIED_SNAPSHOT'
          ? 'Using pre-downloaded, verified NASA instrument data'
          : 'Live NASA data feed'
      }
    >
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: c.dot }}
      />
      {c.label}
    </div>
  );
}

export default function Header({ dataMode, activeTab, onTabChange }: HeaderProps) {
  const { theme, toggle } = useTheme();

  return (
    <header
      className="h-14 flex items-center justify-between px-4 border-b flex-shrink-0 z-30"
      style={{
        background: 'var(--header-bg)',
        borderColor: 'var(--header-border)',
      }}
    >
      {/* Logo group */}
      <div className="flex items-center gap-3 flex-shrink-0 min-w-0">
        {/* NASA-style meatball */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-label="NASA">
            <circle cx="18" cy="18" r="17" fill="var(--accent)" />
            <ellipse cx="18" cy="18" rx="12" ry="7" stroke="var(--on-accent)" strokeWidth="2" fill="none" />
            <path d="M8 18 Q13 10 18 18 Q23 26 28 18" stroke="var(--color-danger)" strokeWidth="2.5" fill="none" />
            <text x="18" y="22" textAnchor="middle" fill="var(--on-accent)" fontSize="8" fontWeight="700" fontFamily="sans-serif">NASA</text>
          </svg>
          <div className="flex flex-col leading-tight" title={PRODUCT_NAME_LONG}>
            <span className="font-bold text-sm tracking-wide" style={{ color: 'var(--text-primary)' }}>
              VICTOR
            </span>
            <span className="text-[9px] font-medium tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>
              Space Apps Challenge 2026
            </span>
          </div>
        </div>
      </div>

      {/* Nav tabs — center */}
      <nav className="flex items-center gap-0.5 flex-shrink-0 border-b-0 h-14 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            id={`nav-tab-${tab.id}`}
            onClick={() => onTabChange(tab.id)}
            className={`header-tab whitespace-nowrap ${activeTab === tab.id ? 'active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Right actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <DataModeBadge mode={dataMode} />

        {/* Theme toggle */}
        <button
          onClick={toggle}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          className="w-8 h-8 flex items-center justify-center rounded transition-colors"
          style={{
            background: 'var(--surface-sunken)',
            border: '1px solid var(--border)',
            color: 'var(--text-muted)',
          }}
        >
          {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
        </button>

        {/* Help — opens the Methodology view, which documents how routes are computed */}
        <button
          id="nav-help"
          onClick={() => onTabChange('methodology')}
          className="w-8 h-8 flex items-center justify-center rounded transition-colors"
          style={{ color: 'var(--text-muted)' }}
          aria-label="Help: open Methodology"
          title="How VICTOR computes routes (Methodology)"
        >
          <HelpCircle size={16} />
        </button>
      </div>
    </header>
  );
}
