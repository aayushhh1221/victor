'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/common/Header';
import GlobalMarsMap from '@/components/map/GlobalMarsMap';

export default function ExplorerPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col h-dvh w-screen overflow-hidden" style={{ background: 'var(--surface)' }}>
      <Header activeTab="explorer" />
      <main className="flex-1 relative w-full h-full overflow-hidden" role="main" aria-label="Mars Map View">
        <GlobalMarsMap onSelectJezero={() => router.push('/planner')} />
      </main>
    </div>
  );
}
