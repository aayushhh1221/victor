'use client';

import React from 'react';
import type { DataMode } from '@/types';

interface HeaderProps {
  dataMode: DataMode | null;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const TABS = [
  { id: 'planner', label: 'Mission Planner' },
  { id: 'layers', label: 'Data & Layers' },
  { id: 'science', label: 'Science Targets' },
  { id: 'methodology', label: 'Methodology' },
];

function DataModeBadge({ mode }: { mode: DataMode | null }) {
  if (!mode) return null;
  const config = {
    LIVE:               { label: 'LIVE', cls: 'badge-live', dot: '#22C55E' },
    VERIFIED_SNAPSHOT:  { label: 'VERIFIED DATA', cls: 'badge-verified', dot: '#3B82F6' },
    DEMONSTRATION:      { label: 'DEMONSTRATION', cls: 'badge-demonstration', dot: '#F59E0B' },
  }[mode];

  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium ${config.cls}`}>
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: config.dot }}
      />
      {config.label}
    </div>
  );
}

export default function Header({ dataMode, activeTab, onTabChange }: HeaderProps) {
  return (
    <header
      className="h-14 flex items-center justify-between px-4 border-b"
      style={{ background: '#08131E', borderColor: 'rgba(255,255,255,0.08)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <circle cx="11" cy="11" r="9" stroke="#1E88E5" strokeWidth="1.5" />
            <path d="M4 11 Q8 6 11 11 Q14 16 18 11" stroke="#FF6F00" strokeWidth="1.5" fill="none" />
            <circle cx="11" cy="11" r="2" fill="#1E88E5" />
          </svg>
          <span className="font-bold text-white text-base tracking-wider">PATHWISE</span>
        </div>
        <span className="text-[10px] text-gray-600 hidden lg:block">
          Marswalk Arbitration Engine
        </span>
      </div>

      {/* Nav tabs */}
      <nav className="flex items-center gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            id={`nav-tab-${tab.id}`}
            onClick={() => onTabChange(tab.id)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-blue-600/20 text-blue-400 border border-blue-600/30'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Right */}
      <div className="flex items-center gap-3">
        <DataModeBadge mode={dataMode} />
        <span className="text-[10px] text-gray-600 hidden xl:block">
          NASA Space Apps 2026
        </span>
      </div>
    </header>
  );
}
