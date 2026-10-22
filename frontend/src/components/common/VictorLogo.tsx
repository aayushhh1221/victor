import React from 'react';

interface VictorLogoProps {
  className?: string;
  width?: number;
  height?: number;
  size?: number;
  variant?: 'mark' | 'badge';
  title?: string;
}

export default function VictorLogo({
  className = '',
  width,
  height,
  size = 32,
  variant = 'badge',
  title = 'VICTOR — Voyage Intelligence for Terrain-aware Cartographic Optimization & Routing',
}: VictorLogoProps) {
  const finalWidth = width ?? size;
  const finalHeight = height ?? size;

  return (
    <svg
      width={finalWidth}
      height={finalHeight}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <defs>
        {/* Aerospace Titanium Crease Gradients */}
        <linearGradient id="victor-ti-light" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F8FAFC" />
          <stop offset="100%" stopColor="#CBD5E1" />
        </linearGradient>
        <linearGradient id="victor-ti-dark" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#94A3B8" />
          <stop offset="100%" stopColor="#64748B" />
        </linearGradient>

        {/* Electric Cyan Vector Crease Gradients */}
        <linearGradient id="victor-cyan-light" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7DD3FC" />
          <stop offset="100%" stopColor="#38BDF8" />
        </linearGradient>
        <linearGradient id="victor-cyan-dark" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0284C7" />
          <stop offset="100%" stopColor="#0B3D91" />
        </linearGradient>

        {/* Mars Red Horizon Arc */}
        <linearGradient id="victor-mars-horizon" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#B91C1C" />
          <stop offset="50%" stopColor="#EF4444" />
          <stop offset="100%" stopColor="#B91C1C" />
        </linearGradient>

        {/* Celestial Gold Star */}
        <linearGradient id="victor-star-gold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FEF08A" />
          <stop offset="50%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>

        {/* Deep Space Background */}
        <radialGradient id="victor-space-bg" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#0F172A" />
          <stop offset="100%" stopColor="#060913" />
        </radialGradient>
      </defs>

      {/* Badge Frame (when variant is badge) */}
      {variant === 'badge' && (
        <>
          <circle cx="50" cy="50" r="46" fill="url(#victor-space-bg)" stroke="#94A3B8" strokeWidth="2" />
          <circle cx="50" cy="50" r="44" stroke="#1E293B" strokeWidth="0.75" />

          {/* Lower Martian Terrain under Horizon */}
          <path d="M 8 64 Q 50 48 92 64 A 46 46 0 0 1 8 64 Z" fill="#7F1D1D" />
          {/* Topographic Elevation Contours */}
          <path d="M 14 70 Q 50 56 86 70" stroke="#B91C1C" strokeWidth="0.75" fill="none" opacity="0.6" />
          <path d="M 22 77 Q 50 64 78 77" stroke="#B91C1C" strokeWidth="0.75" fill="none" opacity="0.5" />
          <path d="M 30 84 Q 50 72 70 84" stroke="#B91C1C" strokeWidth="0.75" fill="none" opacity="0.4" />
        </>
      )}

      {/* Mars Horizon Arc */}
      <path
        d="M 8 64 Q 50 48 92 64"
        stroke="url(#victor-mars-horizon)"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />

      {/* V Chevron: Left Wing (Titanium with Centerline Crease) */}
      <polygon points="24,34 35,34 47,74 41,74" fill="url(#victor-ti-light)" />
      <polygon points="35,34 40,34 50,74 47,74" fill="url(#victor-ti-dark)" />

      {/* V Chevron: Right Wing (Cyan Vector with Centerline Crease & Arrow) */}
      <polygon points="50,74 53,74 71,42 63,42" fill="url(#victor-cyan-light)" />
      <polygon points="53,74 59,74 74,42 71,42" fill="url(#victor-cyan-dark)" />
      {/* Arrowhead */}
      <polygon points="73,42 63,40 79,24 81,44" fill="url(#victor-cyan-light)" />
      <polygon points="79,24 81,44 73,42" fill="url(#victor-cyan-dark)" />

      {/* Apex Celestial Guidance Star */}
      <polygon points="50,14 52.5,21 59,23 52.5,25 50,32 47.5,25 41,23 47.5,21" fill="url(#victor-star-gold)" />
      <circle cx="50" cy="23" r="1" fill="#FFFFFF" />
    </svg>
  );
}
