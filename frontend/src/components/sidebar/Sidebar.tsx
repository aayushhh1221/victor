'use client';

import React from 'react';
import {
  Activity, Route, Globe, BarChart3, FlaskConical,
  Thermometer, GitCompare, FileText, Database, BookOpen,
  Cpu, LucideIcon
} from 'lucide-react';

interface SidebarProps {
  activeSection: string;
  onSectionChange: (_s: string) => void;
}

const SECTIONS: { id: string; icon: LucideIcon; label: string }[] = [
  { id: 'overview',    icon: Activity,     label: 'Mission Overview' },
  { id: 'plan',        icon: Route,        label: 'Mission Planner' },
  { id: 'map',         icon: Globe,        label: 'Global Mars Explorer' },
  { id: 'analysis',    icon: BarChart3,    label: 'Route Analysis' },
  { id: 'science',     icon: FlaskConical, label: 'Science Opportunities' },
  { id: 'env',         icon: Thermometer,  label: 'Environmental' },
  { id: 'scenarios',   icon: GitCompare,   label: 'Compare Scenarios' },
  { id: 'report',      icon: FileText,     label: 'Mission Report' },
];

const BOTTOM_SECTIONS: { id: string; icon: LucideIcon; label: string }[] = [
  { id: 'sources',     icon: Database,     label: 'Data Sources' },
  { id: 'methodology', icon: BookOpen,     label: 'Methodology' },
  { id: 'status',      icon: Cpu,          label: 'System Status' },
];

function NavItem({
  id,
  icon: Icon,
  label,
  activeSection,
  onSectionChange,
}: {
  id: string;
  icon: LucideIcon;
  label: string;
  activeSection: string;
  onSectionChange: (_s: string) => void;
}) {
  const isActive = activeSection === id;
  return (
    <button
      id={`sidebar-${id}`}
      onClick={() => onSectionChange(id)}
      className={`nav-item${isActive ? ' active' : ''}`}
    >
      <Icon size={14} className="flex-shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
}

export default function Sidebar({ activeSection, onSectionChange }: SidebarProps) {
  return (
    <aside
      className="w-full lg:w-[210px] flex-shrink-0 flex flex-row lg:flex-col border-b lg:border-b-0 lg:border-r overflow-x-auto lg:overflow-y-auto"
      style={{
        background: 'var(--sidebar-bg)',
        borderColor: 'var(--sidebar-border)',
      }}
    >
      {/* Study region */}
      <div
        className="hidden lg:block px-3 py-2.5 border-b"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <p className="section-heading mb-0.5">Study Region</p>
        <p className="text-xs font-semibold mt-1" style={{ color: 'var(--text-primary)' }}>
          Jezero Crater, Mars
        </p>
        <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
          18.0–18.9°N · 77.0–78.0°E
        </p>
      </div>

      {/* Main navigation */}
      <nav className="flex lg:flex-col flex-row flex-1 p-2 gap-1 lg:space-y-0.5" aria-label="Main navigation">
        {SECTIONS.map((s) => (
          <NavItem
            key={s.id}
            {...s}
            activeSection={activeSection}
            onSectionChange={onSectionChange}
          />
        ))}
      </nav>

      {/* Divider */}
      <div className="hidden lg:block" style={{ borderTop: '1px solid var(--border-subtle)' }} />

      {/* Bottom navigation */}
      <nav className="flex lg:flex-col flex-row p-2 gap-1 lg:space-y-0.5" aria-label="Secondary navigation">
        {BOTTOM_SECTIONS.map((s) => (
          <NavItem
            key={s.id}
            {...s}
            activeSection={activeSection}
            onSectionChange={onSectionChange}
          />
        ))}
      </nav>
    </aside>
  );
}
