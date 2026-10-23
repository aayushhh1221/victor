'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { DataMode } from '@/types';
import { useTheme } from '@/utils/theme';
import { HelpCircle, Moon, Sun } from 'lucide-react';
import NasaLogo from '@/components/common/NasaLogo';
import VictorLogo from '@/components/common/VictorLogo';

/** Full product name, used wherever the long form belongs. */
export const PRODUCT_NAME_LONG =
  'VICTOR — Voyage Intelligence for Terrain-aware Cartographic Optimization & Routing';

interface HeaderProps {
  dataMode?: DataMode | null;
  activeTab?: string;
  onTabChange?: (_tab: string) => void;
}

const NAV_LINKS = [
  { href: '/planner', id: 'planner', label: 'Mission Planner' },
  { href: '/explorer', id: 'explorer', label: 'Global Mars Explorer' },
  { href: '/methodology', id: 'methodology', label: 'Methodology' },
  { href: '/data', id: 'data', label: 'NASA Data Catalog' },
  { href: '/about', id: 'about', label: 'About & Charter' },
];

function DataModeBadge({ mode }: { mode?: DataMode | null }) {
  if (!mode) return null;
  const config: Record<DataMode, { label: string; cls: string; dot: string }> = {
    LIVE: {
      label: 'LIVE TELEMETRY',
      cls: 'badge-live',
      dot: 'var(--mode-live)',
    },
    VERIFIED_SNAPSHOT: {
      label: 'PDS BASELINE',
      cls: 'badge-verified',
      dot: 'var(--mode-verified)',
    },
    DEMONSTRATION: {
      label: 'SYNTHETIC DEMO',
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
          ? 'Synthetic terrain simulation — non-observational'
          : mode === 'VERIFIED_SNAPSHOT'
          ? 'NASA Planetary Data System (PDS) archive telemetry'
          : 'Live NASA PDS data stream'
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
  const pathname = usePathname();

  return (
    <header
      className="h-14 flex items-center justify-between px-4 border-b flex-shrink-0 z-30 relative"
      style={{
        background: 'var(--header-bg)',
        borderColor: 'var(--header-border)',
      }}
    >
      {/* Logo group */}
      <Link href="/" className="flex items-center gap-2.5 flex-shrink-0 min-w-0 transition-opacity hover:opacity-90">
        <NasaLogo width={36} height={30} />
        <div className="h-5 w-px opacity-30" style={{ background: 'var(--text-muted)' }} />
        <VictorLogo size={30} />
        <div className="flex flex-col leading-tight" title={PRODUCT_NAME_LONG}>
          <span className="font-bold text-sm tracking-wide" style={{ color: 'var(--text-primary)' }}>
            VICTOR
          </span>
          <span className="text-[9px] font-medium tracking-wider uppercase" style={{ color: 'var(--text-muted)' }}>
            NASA Space Apps · Traverse Intelligence
          </span>
        </div>
      </Link>

      {/* Nav tabs — center */}
      <nav className="flex items-center gap-0.5 flex-shrink-0 border-b-0 h-14 overflow-x-auto">
        {NAV_LINKS.map((link) => {
          const isCurrentRoute = pathname === link.href;
          const isCurrentTab = activeTab === link.id;
          const isActive = isCurrentRoute || (pathname === '/planner' && isCurrentTab);

          return (
            <Link
              key={link.id}
              id={`nav-tab-${link.id}`}
              href={link.href}
              onClick={(_e) => {
                if (onTabChange && pathname === '/planner' && link.href === '/planner') {
                  onTabChange(link.id);
                }
              }}
              className={`header-tab whitespace-nowrap ${isActive ? 'active' : ''}`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      {/* Right actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <DataModeBadge mode={dataMode || 'VERIFIED_SNAPSHOT'} />

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

        {/* Help — opens Methodology */}
        <Link
          id="nav-help"
          href="/methodology"
          className="w-8 h-8 flex items-center justify-center rounded transition-colors"
          style={{ color: 'var(--text-muted)' }}
          aria-label="Help: open Methodology"
          title="How VICTOR computes routes (Methodology)"
        >
          <HelpCircle size={16} />
        </Link>
      </div>
    </header>
  );
}

