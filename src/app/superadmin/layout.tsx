'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import SuperadminSidebar from '@/components/layout/SuperadminSidebar';

export const dynamic = 'force-dynamic';

export default function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const router  = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.replace('/login'); return; }
      try {
        const result = await user.getIdTokenResult();
        if (result.claims.rol !== 'superadmin') { router.replace('/dashboard'); return; }
        setReady(true);
      } catch { router.replace('/login'); }
    });
    return unsub;
  }, [router]);

  if (!ready) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: 'var(--bg)' }}>
      <span className="spinner" style={{ width: 32, height: 32 }} />
    </div>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <SuperadminSidebar />
      <main style={{ flex: 1, padding: '1.75rem 2rem', overflowY: 'auto', minWidth: 0 }}>
        {children}
      </main>
    </div>
  );
}
