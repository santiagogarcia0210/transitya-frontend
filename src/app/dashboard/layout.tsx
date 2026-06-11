'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import Sidebar from '@/components/layout/Sidebar';
import BottomNav from '@/components/layout/BottomNav';
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
    <div className="dashboard-layout" style={{ minHeight: '100vh', background: 'var(--bg)', position: 'relative' }}>
      <FlowFieldBackground intensity="subtle" />
      <Sidebar />
      <main className="dashboard-main" style={{ position: 'relative', zIndex: 1, padding: '1.75rem 2rem', overflowY: 'auto', minHeight: '100vh' }}>
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
