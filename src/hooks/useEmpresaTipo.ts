'use client';
import { useState, useEffect } from 'react';
import api from '@/lib/api';

// Cache de módulo: sobrevive re-renders y navegación sin refetch
let _cached: string | null = null;
let _promise: Promise<string> | null = null;

export function useEmpresaTipo() {
  const [tipo,    setTipo]    = useState<string | null>(_cached);
  const [loading, setLoading] = useState(_cached === null);

  useEffect(() => {
    if (_cached !== null) {
      setTipo(_cached);
      setLoading(false);
      return;
    }
    if (!_promise) {
      _promise = api.get('/api/empresa/tipo')
        .then(r => {
          _cached = String(r.data?.tipo || r.data || '');
          return _cached;
        })
        .catch(() => {
          _cached = 'transporte_escolar';
          return 'transporte_escolar';
        });
    }
    _promise.then(t => {
      setTipo(t);
      setLoading(false);
    });
  }, []);

  return { tipo, loading };
}
