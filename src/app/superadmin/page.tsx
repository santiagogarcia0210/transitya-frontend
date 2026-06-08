'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SuperadminRoot() {
  const router = useRouter();
  useEffect(() => { router.replace('/superadmin/dashboard'); }, [router]);
  return null;
}
