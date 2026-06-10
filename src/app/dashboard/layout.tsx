'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import Sidebar from '@/components/layout/Sidebar';
import FlowFieldBackground from '@/components/ui/FlowFieldBackground';

export const dynamic = 'force-dynamic';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) router.push('/login');
    });
    return unsub;
  }, [router]);

  return (
    <div className="dashboard-layout" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)', position: 'relative', overflow: 'hidden' }}>
      <FlowFieldBackground intensity="subtle" />
      <div style={{ display: 'flex', flex: 1, position: 'relative', zIndex: 1, minWidth: 0 }}>
        <Sidebar />
        <main style={{ flex: 1, padding: '1.75rem 2rem', overflowY: 'auto', minWidth: 0 }}>
          {children}
        </main>
      </div>
    </div>
  );
}
