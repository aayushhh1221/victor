import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { ThemeProvider } from '@/utils/theme';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title:
    'VICTOR — Voyage Intelligence for Terrain-aware Cartographic Optimization & Routing | ' +
    'NASA Mars Exploration',
  description:
    'VICTOR — Voyage Intelligence for Terrain-aware Cartographic Optimization & Routing. ' +
    'Multi-objective EVA route arbitration for Jezero Crater, Mars. ' +
    'Real NASA data (MOLA, CRISM, THEMIS, CTX). A* pathfinding with Pareto dominance analysis, ' +
    'per-segment evidence provenance, and scenario comparison.',
  keywords: 'Mars, NASA, route planning, Jezero Crater, A*, Pareto, MOLA, CRISM, THEMIS, CTX, EVA, marswalk, VICTOR',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

// Pre-paint inline script: sets data-theme BEFORE first paint to eliminate flash.
// Default to 'dark' for Space Mission Control environment.
const themeScript = `
(function(){
  try {
    var stored = localStorage.getItem('victor_mission_theme_v3');
    var theme = stored === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
  } catch(e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
`.trim();

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#08131E" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        {/* Pre-paint theme script — must run synchronously before any render */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${inter.variable} ${jetbrainsMono.variable}`} style={{ fontFamily: 'var(--font-inter), Inter, -apple-system, sans-serif' }}>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
