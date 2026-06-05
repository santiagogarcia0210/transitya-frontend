'use client';
import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';

let _cached: string | null = null;

export function invalidateUserRolCache() {
  _cached = null;
}

export function useUserRol() {
  const [rol,     setRol]     = useState<string | null>(_cached);
  const [loading, setLoading] = useState(_cached === null);

  useEffect(() => {
    if (_cached !== null) {
      setRol(_cached);
      setLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { setRol(''); setLoading(false); return; }
      try {
        const result = await user.getIdTokenResult();
        const r = String(result.claims.rol || '');
        _cached = r;
        setRol(r);
      } catch {
        setRol('');
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  return { rol, loading };
}
