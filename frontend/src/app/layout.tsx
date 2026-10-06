import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'PATHWISE — Marswalk Arbitration Engine | NASA Space Apps 2026',
  description:
    'Multi-objective Marswalk route arbitration for Jezero Crater. ' +
    'Real NASA data (MOLA, CRISM, THEMIS). A* pathfinding with Pareto dominance analysis, ' +
    'per-segment evidence provenance, and scenario comparison.',
  keywords: 'Mars, NASA, Space Apps, route planning, Jezero Crater, A*, Pareto, MOLA, CRISM, THEMIS',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0B1929" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
