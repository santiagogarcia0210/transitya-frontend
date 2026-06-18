'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import Sidebar from '@/components/layout/Sidebar';
import BottomNav from '@/components/layout/BottomNav';
import FlowFieldBackground from '@/components/ui/FlowFieldBackground';
import TrialExpiredModal from '@/components/ui/TrialExpiredModal';

export const dynamic = 'force-dynamic';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [showTrialModal, setShowTrialModal] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) router.push('/login');
    });
    return unsub;
  }, [router]);

  useEffect(() => {
    const handler = () => setShowTrialModal(true);
    window.addEventListener('prueba-vencida', handler);
    return () => window.removeEventListener('prueba-vencida', handler);
  }, []);

  return (
    <div className="dashboard-layout" style={{ minHeight: '100vh', background: 'var(--bg)', position: 'relative' }}>
      <FlowFieldBackground intensity="subtle" />
      <Sidebar />
      <main className="dashboard-main" style={{ position: 'relative', zIndex: 1, padding: '1.75rem 2rem', overflowY: 'auto', minHeight: '100vh' }}>
        {children}
      </main>
      <BottomNav />
      {showTrialModal && <TrialExpiredModal onClose={() => setShowTrialModal(false)} />}
    </div>
  );
}
