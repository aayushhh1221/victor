'use client';

import React from 'react';
import {
  Map, Route, FlaskConical, BarChart3, Layers,
  FileText, Database, Settings, HelpCircle, Activity,
  LucideIcon
} from 'lucide-react';

interface SidebarProps {
  activeSection: string;
  onSectionChange: (s: string) => void;
}

const SECTIONS = [
  { id: 'overview',     icon: Activity,      label: 'Mission Overview' },
  { id: 'plan',         icon: Route,         label: 'Plan Marswalk' },
  { id: 'map',          icon: Map,           label: 'Interactive Map' },
  { id: 'analysis',     icon: BarChart3,     label: 'Route Analysis' },
  { id: 'science',      icon: FlaskConical,  label: 'Science Opps.' },
  { id: 'env',          icon: Layers,        label: 'Environmental' },
  { id: 'scenarios',    icon: Settings,      label: 'Compare Scenarios' },
  { id: 'report',       icon: FileText,      label: 'Mission Report' },
];

const BOTTOM_SECTIONS = [
  { id: 'sources',      icon: Database,      label: 'Data Sources' },
  { id: 'methodology',  icon: HelpCircle,    label: 'Methodology' },
];

export default function Sidebar({ activeSection, onSectionChange }: SidebarProps) {
  const NavItem = ({ id, icon: Icon, label }: { id: string; icon: LucideIcon; label: string }) => {
    const isActive = activeSection === id;
    return (
      <button
        id={`sidebar-${id}`}
        onClick={() => onSectionChange(id)}
        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-left transition-colors group ${
          isActive
            ? 'bg-blue-600/20 text-blue-400 border border-blue-600/20'
            : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
        }`}
      >
        <Icon
          size={14}
          className={`flex-shrink-0 ${isActive ? 'text-blue-400' : 'text-gray-600 group-hover:text-gray-400'}`}
        />
        <span className="text-xs font-medium truncate">{label}</span>
      </button>
    );
  };

  return (
    <aside
      className="w-[200px] flex-shrink-0 flex flex-col border-r overflow-y-auto"
      style={{ background: '#08131E', borderColor: 'rgba(255,255,255,0.06)' }}
    >
      {/* Region tag */}
      <div className="px-3 py-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <p className="text-[10px] text-gray-600 uppercase tracking-wider">Study Region</p>
        <p className="text-xs text-gray-400 mt-0.5">Jezero Crater, Mars</p>
        <p className="text-[10px] text-gray-600 mt-0.5">18.0–18.9°N · 77.0–78.0°E</p>
      </div>

      {/* Main nav */}
      <nav className="flex-1 p-2 space-y-0.5">
        {SECTIONS.map((s) => (
          <NavItem key={s.id} {...s} />
        ))}
      </nav>

      {/* Bottom */}
      <div className="p-2 border-t space-y-0.5" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        {BOTTOM_SECTIONS.map((s) => (
          <NavItem key={s.id} {...s} />
        ))}
        {/* System Status */}
        <div className="px-3 py-2 mt-1">
          <p className="text-[10px] text-gray-600 uppercase tracking-wider">System</p>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            <span className="text-[10px] text-gray-500">Backend connected</span>
          </div>
          <p className="text-[10px] text-gray-700 mt-1">300×300 grid · ~53×56 km</p>
        </div>
      </div>
    </aside>
  );
}
