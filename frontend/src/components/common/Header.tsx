'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { DataMode } from '@/types';
import { HelpCircle, Menu, X } from 'lucide-react';
import VictorLogo from '@/components/common/VictorLogo';

/** Full product name, used wherever the long form belongs. */
export const PRODUCT_NAME_LONG =
  'VICTOR — Voyage Intelligence for Terrain-aware Cartographic Optimization & Routing';

interface HeaderProps {
  dataMode?: DataMode | null;
  activeTab?: string;
  onTabChange?: (_tab: string) => void;
}

const PRIMARY_NAV_LINKS = [
  { href: '/planner', id: 'planner', label: 'Mission Planner' },
  { href: '/explorer', id: 'explorer', label: 'Mars Map' },
  { href: '/data', id: 'data', label: 'Data and Methods' },
];

const SECONDARY_NAV_LINKS = [
  { href: '/methodology', id: 'methodology', label: 'Methodology' },
  { href: '/about', id: 'about', label: 'About VICTOR' },
];

function DataModeBadge({ mode }: { mode: DataMode }) {
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
  if (!c) return null;

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
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close mobile menu on Escape key press
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  return (
    <header
      className="h-14 flex items-center justify-between px-3 sm:px-4 border-b flex-shrink-0 z-30 relative"
      style={{
        background: 'var(--header-bg)',
        borderColor: 'var(--header-border)',
      }}
    >
      {/* Brand Group */}
      <Link
        href="/"
        className="flex items-center gap-2.5 flex-shrink-0 min-w-0 transition-opacity hover:opacity-90 mr-2"
        title={PRODUCT_NAME_LONG}
      >
        <VictorLogo size={28} />
        <div className="flex flex-col leading-tight min-w-0">
          <span className="font-bold text-sm tracking-wide" style={{ color: 'var(--text-primary)' }}>
            VICTOR
          </span>
          <span className="text-[10px] font-normal tracking-tight truncate hidden xs:inline" style={{ color: 'var(--text-muted)' }}>
            Independent NASA Space Apps Project
          </span>
        </div>
      </Link>

      {/* Primary Navigation — Desktop */}
      <nav className="hidden md:flex items-center gap-1 flex-shrink-0 h-14" aria-label="Primary navigation">
        {PRIMARY_NAV_LINKS.map((link) => {
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

      {/* Right Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Render data mode badge only when provided by backend */}
        {dataMode && <DataModeBadge mode={dataMode} />}

        {/* Methodology link */}
        <Link
          id="nav-methodology"
          href="/methodology"
          className="w-8 h-8 hidden sm:flex items-center justify-center rounded transition-colors hover:bg-[var(--surface-sunken)]"
          style={{ color: 'var(--text-muted)' }}
          aria-label="How VICTOR evaluates routes (Methodology)"
          title="How VICTOR evaluates routes (Methodology)"
        >
          <HelpCircle size={16} />
        </Link>

        {/* Mobile menu trigger */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden w-8 h-8 flex items-center justify-center rounded transition-colors"
          style={{
            background: 'var(--surface-sunken)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
          }}
          aria-expanded={mobileMenuOpen}
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? <X size={16} /> : <Menu size={16} />}
        </button>
      </div>

      {/* Mobile Drawer/Menu */}
      {mobileMenuOpen && (
        <div
          ref={menuRef}
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation menu"
          className="md:hidden absolute top-14 left-0 right-0 border-b shadow-lg py-3 px-4 z-50 flex flex-col gap-1"
          style={{
            background: 'var(--surface)',
            borderColor: 'var(--border)',
          }}
        >
          <p className="section-heading px-2 pt-1 pb-1">Navigation</p>
          {PRIMARY_NAV_LINKS.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.id}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`px-3 py-2 rounded text-xs font-medium transition-colors ${
                  isActive
                    ? 'font-semibold'
                    : 'hover:bg-[var(--surface-sunken)]'
                }`}
                style={{
                  color: isActive ? 'var(--accent)' : 'var(--text-primary)',
                  background: isActive ? 'var(--accent-light)' : 'transparent',
                }}
              >
                {link.label}
              </Link>
            );
          })}

          <div className="h-px my-1" style={{ background: 'var(--border)' }} />
          <p className="section-heading px-2 pt-1 pb-1">Documentation</p>
          {SECONDARY_NAV_LINKS.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.id}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`px-3 py-2 rounded text-xs transition-colors ${
                  isActive
                    ? 'font-semibold'
                    : 'hover:bg-[var(--surface-sunken)]'
                }`}
                style={{
                  color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                  background: isActive ? 'var(--accent-light)' : 'transparent',
                }}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      )}
    </header>
  );
}
