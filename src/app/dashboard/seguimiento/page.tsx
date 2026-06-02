'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { serializarFirestore, toArray } from '@/lib/utils';
import { useEmpresaTipo } from '@/hooks/useEmpresaTipo';

interface Envio {
  id: string; nroEnvio: string; clienteNombre: string; estado: string; fecha: string;
}

const BADGE: Record<string, string> = {
  Pendiente:'badge-amber', 'En camino':'badge-blue', Entregado:'badge-green', 'No entregado':'badge-red',
};

export default function SeguimientoPage() {
  const router = useRouter();
  const { tipo, loading: tipoLoading } = useEmpresaTipo();

  const [lista,   setLista]   = useState<Envio[]>([]);
  const [loading, setLoading] = useState(true);
  const [busq,    setBusq]    = useState('');

  useEffect(() => {
    if (!tipoLoading && tipo !== null && tipo !== 'paqueteria') router.replace('/dashboard');
  }, [tipo, tipoLoading, router]);

  useEffect(() => {
    if (tipo !== 'paqueteria') return;
    api.get('/api/envios')
      .then(r => setLista(
        toArray(r.data).map(serializarFirestore).map((e: Record<string, unknown>) => ({
          id:             String(e.id             || ''),
          nroEnvio:       String(e.nroEnvio       || e.tracking || ''),
          clienteNombre:  String(e.clienteNombre  || e.cliente  || ''),
          estado:         String(e.estado         || 'Pendiente'),
          fecha:          String(e.fecha          || e.FECHA    || ''),
        }))
      ))
      .catch(() => { /* silent */ })
      .finally(() => setLoading(false));
  }, [tipo]);

  const filtrados = lista.filter(e => {
    const q = busq.toLowerCase();
    return !q || e.nroEnvio.toLowerCase().includes(q) || e.clienteNombre.toLowerCase().includes(q);
  });

  const copiarLink = (nroEnvio: string) => {
    const url = `${window.location.origin}/seguimiento/${encodeURIComponent(nroEnvio)}`;
    navigator.clipboard?.writeText(url).catch(() => { /* silent */ });
  };

  if (tipoLoading) return <div style={{ padding: '2rem', color: 'var(--text3)' }}><span className="spinner" /> Verificando…</div>;
  if (tipo !== 'paqueteria') return null;

  return (
    <div>
      <div className="section-header">
        <div>
          <h2 className="section-title">🔍 Seguimiento de Envíos</h2>
          <p style={{ fontSize: '.82rem', color: 'var(--text3)', marginTop: '.2rem' }}>
            Links públicos de rastreo por número de seguimiento
          </p>
        </div>
      </div>

      <div className="filter-bar">
        <input className="input" placeholder="Buscar N° seguimiento o cliente…"
          value={busq} onChange={e => setBusq(e.target.value)} />
        {busq && <button className="btn btn-secondary" style={{ fontSize: '.78rem' }} onClick={() => setBusq('')}>✕</button>}
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', color: 'var(--text3)', padding: '2rem' }}>
          <span className="spinner" /> Cargando envíos…
        </div>
      ) : filtrados.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">🔍</div><p>Sin envíos con número de seguimiento</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
          {filtrados.filter(e => e.nroEnvio).map(e => (
            <div key={e.id} className="card"
              style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '.75rem 1rem' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--text)', fontSize: '.88rem' }}>{e.nroEnvio}</span>
                  <span className={`badge ${BADGE[e.estado] || 'badge-gray'}`}>{e.estado}</span>
                </div>
                <p style={{ fontSize: '.78rem', color: 'var(--text3)', marginTop: '.15rem' }}>
                  {e.clienteNombre}{e.fecha && ` · ${e.fecha}`}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '.4rem', flexShrink: 0 }}>
                <a
                  href={`/seguimiento/${encodeURIComponent(e.nroEnvio)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="btn btn-secondary"
                  style={{ fontSize: '.75rem', padding: '.3rem .6rem', textDecoration: 'none' }}>
                  🔗 Ver
                </a>
                <button className="btn btn-secondary" style={{ fontSize: '.75rem', padding: '.3rem .6rem' }}
                  onClick={() => copiarLink(e.nroEnvio)}
                  title="Copiar link">
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
          Los clientes pueden rastrear su envío en:{' '}
          <code style={{ color: 'var(--blue)', background: 'var(--bg4)', padding: '.1rem .4rem', borderRadius: 4 }}>
            {typeof window !== 'undefined' ? window.location.origin : ''}/seguimiento/[N°-ENVÍO]
          </code>
        </p>
      </div>
    </div>
  );
}
