'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { serializarFirestore, toArray } from '@/lib/utils';
import { useEmpresaTipo } from '@/hooks/useEmpresaTipo';

interface Viaje {
  id: string; fecha: string; hora: string;
  pasajeroNombre: string; origen: string; destino: string; estado: string;
}

const BADGE: Record<string, string> = {
  Reservado: 'badge-gray', Confirmado: 'badge-blue', 'En curso': 'badge-amber',
  Completado: 'badge-green', Cancelado: 'badge-red',
};

export default function SeguimientoTrasladoPage() {
  const router = useRouter();
  const { tipo, loading: tipoLoading } = useEmpresaTipo();

  const [lista,   setLista]   = useState<Viaje[]>([]);
  const [loading, setLoading] = useState(true);
  const [busq,    setBusq]    = useState('');

  useEffect(() => {
    if (!tipoLoading && tipo !== null && tipo !== 'traslado') router.replace('/dashboard');
  }, [tipo, tipoLoading, router]);

  useEffect(() => {
    if (tipo !== 'traslado') return;
    api.get('/api/viajes')
      .then(r => setLista(
        toArray(r.data).map(serializarFirestore)
          .filter((v: Record<string, unknown>) => ['Confirmado', 'En curso'].includes(String(v.estado || '')))
          .map((v: Record<string, unknown>) => ({
            id:             String(v.id             || ''),
            fecha:          String(v.fecha          || v.FECHA  || ''),
            hora:           String(v.hora           || ''),
            pasajeroNombre: String(v.pasajeroNombre || v.pasajero || ''),
            origen:         String(v.origen         || ''),
            destino:        String(v.destino        || ''),
            estado:         String(v.estado         || ''),
          }))
      ))
      .catch(() => { /* silent */ })
      .finally(() => setLoading(false));
  }, [tipo]);

  const filtrados = lista.filter(v => {
    const q = busq.toLowerCase();
    return !q || v.pasajeroNombre.toLowerCase().includes(q) || v.origen.toLowerCase().includes(q) || v.destino.toLowerCase().includes(q);
  });

  const copiarLink = (id: string) => {
    const url = `${window.location.origin}/seguimiento/viaje/${encodeURIComponent(id)}`;
    navigator.clipboard?.writeText(url).catch(() => { /* silent */ });
  };

  if (tipoLoading) return <div style={{ padding: '2rem', color: 'var(--text3)' }}><span className="spinner" /> Verificando…</div>;
  if (tipo !== 'traslado') return null;

  return (
    <div>
      <div className="section-header">
        <div>
          <h2 className="section-title">🔍 Seguimiento Traslado</h2>
          <p style={{ fontSize: '.82rem', color: 'var(--text3)', marginTop: '.2rem' }}>
            Viajes activos — links de seguimiento en tiempo real
          </p>
        </div>
      </div>

      <div className="filter-bar">
        <input className="input" placeholder="Buscar pasajero, origen o destino…"
          value={busq} onChange={e => setBusq(e.target.value)} />
        {busq && <button className="btn btn-secondary" style={{ fontSize: '.78rem' }} onClick={() => setBusq('')}>✕</button>}
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', color: 'var(--text3)', padding: '2rem' }}>
          <span className="spinner" /> Cargando viajes activos…
        </div>
      ) : filtrados.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🔍</div>
          <p>Sin viajes confirmados o en curso</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
          {filtrados.map(v => (
            <div key={v.id} className="card"
              style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '.75rem 1rem' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '.88rem', fontWeight: 600, color: 'var(--text)' }}>{v.pasajeroNombre || 'Sin pasajero'}</span>
                  <span className={`badge ${BADGE[v.estado] || 'badge-gray'}`}>{v.estado}</span>
                </div>
                <p style={{ fontSize: '.78rem', color: 'var(--text3)', marginTop: '.15rem' }}>
                  {v.fecha}{v.hora && ` ${v.hora}`}
                  {v.origen && v.destino && ` · ${v.origen} → ${v.destino}`}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '.4rem', flexShrink: 0 }}>
                <a
                  href={`/seguimiento/viaje/${encodeURIComponent(v.id)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="btn btn-secondary"
                  style={{ fontSize: '.75rem', padding: '.3rem .6rem', textDecoration: 'none' }}>
                  🔗 Ver
                </a>
                <button className="btn btn-secondary" style={{ fontSize: '.75rem', padding: '.3rem .6rem' }}
                  onClick={() => copiarLink(v.id)}
                  title="Copiar link de seguimiento">
                  📋 Copiar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ marginTop: '1.5rem', padding: '1rem 1.25rem', background: 'var(--bg3)' }}>
        <p style={{ fontSize: '.82rem', color: 'var(--text3)', marginBottom: '.4rem', fontWeight: 600 }}>
          🔗 Link de seguimiento público
        </p>
        <p style={{ fontSize: '.78rem', color: 'var(--text3)' }}>
          Los pasajeros pueden ver el estado de su viaje en:{' '}
          <code style={{ color: 'var(--blue)', background: 'var(--bg4)', padding: '.1rem .4rem', borderRadius: 4 }}>
            {typeof window !== 'undefined' ? window.location.origin : ''}/seguimiento/viaje/[ID-VIAJE]
          </code>
        </p>
      </div>
    </div>
  );
}
