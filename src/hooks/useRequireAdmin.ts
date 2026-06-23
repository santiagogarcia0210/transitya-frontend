'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUserRol } from './useUserRol';

// Redirige al chofer (o cualquier rol no-admin) a /dashboard.
// Retorna true mientras el rol está resolviendo o no es admin/superadmin
// → el componente debe hacer `if (authLoading) return null` para evitar flash.
export function useRequireAdmin(): boolean {
  const { rol, loading } = useUserRol();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (rol !== 'admin' && rol !== 'superadmin') router.replace('/dashboard');
  }, [rol, loading, router]);

  return loading || (rol !== 'admin' && rol !== 'superadmin');
}
