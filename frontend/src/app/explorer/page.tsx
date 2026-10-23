'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/common/Header';
import GlobalMarsMap from '@/components/map/GlobalMarsMap';

export default function ExplorerPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden" style={{ background: 'var(--surface)' }}>
      <Header dataMode="VERIFIED_SNAPSHOT" activeTab="explorer" />
      <main className="flex-1 relative w-full h-full overflow-hidden">
        <GlobalMarsMap onSelectJezero={() => router.push('/planner')} />
      </main>
    </div>
  );
}
