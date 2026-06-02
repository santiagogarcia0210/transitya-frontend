'use client';
import { use, useEffect, useState } from 'react';

interface HistorialItem {
  estado: string;
  fecha: string;
  hora?: string;
  nota?: string;
}

interface EnvioData {
  nroEnvio: string;
  descripcion: string;
  cliente: string;
  repartidor: string;
  direccionEntrega: string;
  estadoActual: string;
  fecha: string;
  historial: HistorialItem[];
}

const ESTADOS_COLOR: Record<string, { color: string; icon: string }> = {
  Pendiente:     { color: '#f59e0b', icon: '🕐' },
  'En camino':   { color: '#3b82f6', icon: '🚚' },
  Entregado:     { color: '#10b981', icon: '✅' },
  'No entregado':{ color: '#ef4444', icon: '❌' },
};

function formatFecha(f: string): string {
  if (!f) return '';
  const d = new Date(f);
  if (isNaN(d.getTime())) return f;
  return d.toLocaleDateString('es-AR', { day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

export default function SeguimientoPage({ params }: { params: Promise<{ nroEnvio: string }> }) {
  const { nroEnvio: paramNro } = use(params);
  const [busqueda,  setBusqueda]  = useState(decodeURIComponent(paramNro || ''));
  const [envio,     setEnvio]     = useState<EnvioData | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');

  useEffect(() => {
    if (paramNro && paramNro !== 'search') {
      buscar(decodeURIComponent(paramNro));
    }
  }, [paramNro]);

  const buscar = async (nro?: string) => {
    const q = (nro ?? busqueda).trim();
    if (!q) return;
    setLoading(true); setError(''); setEnvio(null);
    try {
      const res = await fetch(`/api/seguimiento/${encodeURIComponent(q)}`);
      if (!res.ok) {
        if (res.status === 404) { setError(`No se encontró el envío "${q}".`); }
        else { setError('Error al consultar el seguimiento. Intentá de nuevo.'); }
        return;
      }
      const data = await res.json();
      setEnvio(data);
    } catch {
      setError('Error de conexión. Verificá tu conexión a internet.');
    } finally {
      setLoading(false);
    }
  };

  const estadoInfo = envio ? (ESTADOS_COLOR[envio.estadoActual] ?? { color:'#6b7280', icon:'📦' }) : null;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '2rem 1rem',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '.5rem' }}>🚌</div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f1f5f9', margin: 0 }}>Transit·Ya</h1>
        <p style={{ color: '#94a3b8', fontSize: '.9rem', margin: '.25rem 0 0' }}>Seguimiento de envíos</p>
      </div>

      {/* Buscador */}
      <div style={{ width: '100%', maxWidth: 520, marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '.5rem' }}>
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && buscar()}
            placeholder="Ingresá el número de seguimiento (ej: PKT-20250601-1234)"
            style={{
              flex: 1, padding: '.75rem 1rem', borderRadius: '8px', fontSize: '.9rem',
              background: '#1e293b', border: '2px solid #334155', color: '#f1f5f9',
              outline: 'none',
            }}
          />
          <button
            onClick={() => buscar()}
            disabled={loading}
            style={{
              padding: '.75rem 1.25rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
              background: loading ? '#334155' : '#3b82f6', color: '#fff', fontWeight: 600, fontSize: '.9rem',
              whiteSpace: 'nowrap',
            }}>
            {loading ? '…' : 'Buscar'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ width:'100%', maxWidth:520, background:'rgba(239,68,68,.15)', border:'1px solid rgba(239,68,68,.4)',
          borderRadius:10, padding:'1rem 1.25rem', color:'#fca5a5', fontSize:'.88rem', marginBottom:'1rem', textAlign:'center' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Resultado */}
      {envio && (
        <div style={{ width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Card estado actual */}
          <div style={{ background: '#1e293b', borderRadius: 12, padding: '1.5rem',
            border: `2px solid ${estadoInfo?.color}40` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <p style={{ color: '#94a3b8', fontSize: '.78rem', marginBottom: '.2rem' }}>N° de seguimiento</p>
                <p style={{ color: '#f1f5f9', fontFamily: 'monospace', fontSize: '1rem', fontWeight: 700 }}>{envio.nroEnvio}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '.4rem',
                  background: `${estadoInfo?.color}20`, color: estadoInfo?.color,
                  padding: '.35rem .75rem', borderRadius: 20, fontSize: '.82rem', fontWeight: 700, border:`1px solid ${estadoInfo?.color}40` }}>
                  {estadoInfo?.icon} {envio.estadoActual}
                </span>
              </div>
            </div>

            {/* Info del envío */}
            <div style={{ display: 'grid', gap: '.6rem' }}>
              {[
                ['📦', 'Descripción', envio.descripcion],
                ['👤', 'Cliente',     envio.cliente],
                ['🚴', 'Repartidor',  envio.repartidor],
                ['📍', 'Destino',     envio.direccionEntrega],
                ['📅', 'Fecha',       envio.fecha ? formatFecha(envio.fecha) : ''],
              ].filter(([,,v]) => v).map(([icon, label, val]) => (
                <div key={String(label)} style={{ display: 'flex', gap: '.75rem', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '1rem', flexShrink: 0, marginTop: '.1rem' }}>{icon}</span>
                  <div>
                    <p style={{ color: '#64748b', fontSize: '.72rem', marginBottom: '.1rem' }}>{label}</p>
                    <p style={{ color: '#e2e8f0', fontSize: '.88rem' }}>{String(val)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline historial */}
          {envio.historial && envio.historial.length > 0 && (
            <div style={{ background: '#1e293b', borderRadius: 12, padding: '1.5rem', border: '1px solid #334155' }}>
              <p style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '.9rem', marginBottom: '1.25rem' }}>
                📋 Historial del envío
              </p>
              <div style={{ position: 'relative' }}>
                {/* Línea vertical */}
                <div style={{ position: 'absolute', left: 11, top: 12, bottom: 12, width: 2, background: '#334155' }} />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {[...envio.historial].reverse().map((h, i) => {
                    const info = ESTADOS_COLOR[h.estado] ?? { color: '#6b7280', icon: '📦' };
                    const isLast = i === 0;
                    return (
                      <div key={i} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
                        {/* Dot */}
                        <div style={{
                          width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                          background: isLast ? info.color : '#334155',
                          border: `2px solid ${isLast ? info.color : '#475569'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '.65rem',
                        }}>
                          {isLast && <span style={{ filter: 'brightness(0) invert(1)', fontSize: '.7rem' }}>●</span>}
                        </div>
                        <div style={{ flex: 1, paddingTop: '.15rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
                            <span style={{ color: isLast ? info.color : '#cbd5e1', fontWeight: 600, fontSize: '.85rem' }}>
                              {info.icon} {h.estado}
                            </span>
                          </div>
                          {(h.fecha || h.hora) && (
                            <p style={{ color: '#64748b', fontSize: '.75rem', marginTop: '.15rem' }}>
                              {formatFecha(h.fecha || '')}{h.hora && ` · ${h.hora}`}
                            </p>
                          )}
                          {h.nota && <p style={{ color: '#94a3b8', fontSize: '.82rem', marginTop: '.2rem' }}>{h.nota}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <p style={{ color: '#475569', fontSize: '.78rem', marginTop: 'auto', paddingTop: '2rem', textAlign: 'center' }}>
        Transit·Ya · Seguimiento de envíos
      </p>
    </div>
  );
}
