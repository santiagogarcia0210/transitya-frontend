'use client';
import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';

interface Empresa {
  tenantId: string; nombre: string; tipo: string; email: string;
  plan: string; estadoSusc: string; fechaRegistro: string;
  fechaProximoCobro: string; choferesActivos: number; maxChoferes: number;
  activo: boolean; suspendida: boolean;
}

interface EmpresaDetalle {
  empresa: Record<string,unknown>;
  suscripcion: Record<string,unknown>;
  features: Record<string,unknown>;
  limites: Record<string,unknown>;
}

const PLAN_LABEL: Record<string,string> = { esencial:'Esencial', pro:'Pro', flota:'Flota', prueba:'Prueba', basico:'Básico' };
const TIPO_LABEL: Record<string,string> = {
  transporte_especial:'Transporte Especial', transporte_escolar:'Transporte Escolar',
  paqueteria:'Paquetería', traslado:'Traslado', otro:'Otro'
};

function diasRestantes(fecha: string): number {
  if (!fecha) return -999;
  return Math.ceil((new Date(fecha).getTime() - Date.now()) / 86400000);
}

function DiasBadge({ fecha }: { fecha: string }) {
  const dias = diasRestantes(fecha);
  if (dias <= -999) return <span className="badge badge-gray">—</span>;
  const cls = dias > 10 ? 'badge-green' : dias > 0 ? 'badge-amber' : 'badge-red';
  return <span className={`badge ${cls}`}>{dias > 0 ? `${dias}d` : 'Vencida'}</span>;
}

const L: React.CSSProperties = { display:'block', fontSize:'.75rem', color:'var(--text3)', marginBottom:'.25rem', fontWeight:500 };

export default function EmpresasPage() {
  const [lista,    setLista]    = useState<Empresa[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroPlan,   setFiltroPlan]   = useState('');
  const [detalle,  setDetalle]  = useState<EmpresaDetalle | null>(null);
  const [detalleId, setDetalleId] = useState('');
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [accionMsg, setAccionMsg] = useState('');
  const [toggling, setToggling] = useState<Set<string>>(new Set());
  const [confirmToggle, setConfirmToggle] = useState<{ empresa: Empresa; motivo: string } | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/superadmin/empresas');
      setLista(r.data.empresas || []);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const filtradas = lista.filter(e => {
    const q = busqueda.toLowerCase();
    if (q && !e.nombre.toLowerCase().includes(q) && !e.email?.toLowerCase().includes(q)) return false;
    if (filtroEstado === 'activa'    && (e.suspendida || !e.activo)) return false;
    if (filtroEstado === 'suspendida' && !e.suspendida) return false;
    if (filtroPlan && e.plan !== filtroPlan) return false;
    return true;
  });

  const verDetalle = async (tenantId: string) => {
    setDetalleId(tenantId); setLoadingDetalle(true);
    try {
      const r = await api.get(`/api/superadmin/empresas/${tenantId}`);
      setDetalle({ empresa: r.data.empresa, suscripcion: r.data.suscripcion, features: r.data.features, limites: r.data.limites });
    } catch { /* silent */ }
    setLoadingDetalle(false);
  };

  const toggleEstado = async (empresa: Empresa, motivo?: string) => {
    const nuevoActivo = empresa.suspendida || !empresa.activo;
    setConfirmToggle(null);
    setToggling(prev => new Set(prev).add(empresa.tenantId));
    // Optimistic update
    setLista(prev => prev.map(e =>
      e.tenantId === empresa.tenantId
        ? { ...e, activo: nuevoActivo, suspendida: !nuevoActivo }
        : e
    ));
    try {
      await api.put(`/api/superadmin/empresas/${empresa.tenantId}/estado`, { activo: nuevoActivo, motivo: motivo || '' });
      setAccionMsg(`✅ Empresa ${nuevoActivo ? 'reactivada' : 'suspendida'}.`);
    } catch {
      // Rollback on error
      setLista(prev => prev.map(e =>
        e.tenantId === empresa.tenantId
          ? { ...e, activo: empresa.activo, suspendida: empresa.suspendida }
          : e
      ));
      setAccionMsg('❌ Error al cambiar estado. No se guardó el cambio.');
    }
    setToggling(prev => { const s = new Set(prev); s.delete(empresa.tenantId); return s; });
  };

  const planes = [...new Set(lista.map(e => e.plan).filter(Boolean))].sort();

  return (
    <div>
      <div className="section-header" style={{ marginBottom:'1.25rem' }}>
        <div>
          <div className="section-title">🏢 Empresas</div>
          <div className="section-sub">{filtradas.length} de {lista.length} empresa{lista.length !== 1 ? 's' : ''}</div>
        </div>
        <button className="btn btn-secondary" style={{ fontSize:'.8rem' }} onClick={cargar}>↻ Actualizar</button>
      </div>

      <div className="filter-bar" style={{ marginBottom:'1rem' }}>
        <input className="input" placeholder="Buscar por nombre o email…"
          style={{ minWidth:200 }} value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        <select className="select" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="activa">Activas</option>
          <option value="suspendida">Suspendidas</option>
        </select>
        {planes.length > 0 && (
          <select className="select" value={filtroPlan} onChange={e => setFiltroPlan(e.target.value)}>
            <option value="">Todos los planes</option>
            {planes.map(p => <option key={p} value={p}>{PLAN_LABEL[p] || p}</option>)}
          </select>
        )}
        {(busqueda || filtroEstado || filtroPlan) && (
          <button className="btn btn-secondary btn-sm" onClick={() => { setBusqueda(''); setFiltroEstado(''); setFiltroPlan(''); }}>✕</button>
        )}
      </div>

      {accionMsg && (
        <div style={{ background:'var(--green-dim)', border:'1px solid rgba(16,185,129,.3)',
          borderRadius:'var(--radius)', padding:'.5rem .85rem', fontSize:'.82rem',
          color:'var(--green)', marginBottom:'.75rem' }}>
          {accionMsg}
        </div>
      )}

      {loading ? (
        <div style={{ display:'flex', alignItems:'center', gap:'.75rem', color:'var(--text3)', padding:'2rem' }}>
          <span className="spinner" /> Cargando…
        </div>
      ) : filtradas.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">🏢</div><p>Sin empresas</p></div>
      ) : (
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'.82rem' }}>
            <thead>
              <tr style={{ borderBottom:'1px solid var(--border)', color:'var(--text3)' }}>
                {['Empresa','Tipo','Plan','Estado','Vencimiento','Días','Choferes','Acciones'].map(h => (
                  <th key={h} style={{ textAlign:'left', padding:'8px 10px', fontWeight:600, whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtradas.map(e => {
                const isSusp = e.suspendida || !e.activo;
                return (
                  <tr key={e.tenantId} style={{ borderBottom:'1px solid var(--border)', opacity: isSusp ? .6 : 1 }}>
                    <td style={{ padding:'8px 10px' }}>
                      <div style={{ fontWeight:600, color:'var(--text)' }}>{e.nombre}</div>
                      <div style={{ fontSize:'.73rem', color:'var(--text3)' }}>{e.email}</div>
                    </td>
                    <td style={{ padding:'8px 10px', color:'var(--text2)' }}>{TIPO_LABEL[e.tipo] || e.tipo || '—'}</td>
                    <td style={{ padding:'8px 10px' }}>
                      <span className="badge badge-blue" style={{ fontSize:'.72rem' }}>{PLAN_LABEL[e.plan] || e.plan}</span>
                    </td>
                    <td style={{ padding:'8px 10px' }}>
                      <span className={`badge ${isSusp ? 'badge-red' : 'badge-green'}`} style={{ fontSize:'.72rem' }}>
                        {isSusp ? 'Suspendida' : 'Activa'}
                      </span>
                    </td>
                    <td style={{ padding:'8px 10px', color:'var(--text3)', fontSize:'.78rem' }}>
                      {e.fechaProximoCobro ? new Date(e.fechaProximoCobro).toLocaleDateString('es-AR') : '—'}
                    </td>
                    <td style={{ padding:'8px 10px' }}><DiasBadge fecha={e.fechaProximoCobro} /></td>
                    <td style={{ padding:'8px 10px', color:'var(--text2)' }}>{e.choferesActivos}/{e.maxChoferes}</td>
                    <td style={{ padding:'8px 10px' }}>
                      <div style={{ display:'flex', gap:'.5rem', alignItems:'center' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => verDetalle(e.tenantId)}>Ver</button>
                        {toggling.has(e.tenantId) ? (
                          <span className="spinner" style={{ width:14, height:14, flexShrink:0 }} />
                        ) : (
                          <button
                            role="switch"
                            aria-checked={!isSusp}
                            title={isSusp ? 'Reactivar empresa' : 'Suspender empresa'}
                            onClick={() => {
                              setAccionMsg('');
                              if (isSusp) toggleEstado(e);
                              else setConfirmToggle({ empresa: e, motivo: '' });
                            }}
                            style={{
                              width:36, height:20, borderRadius:10, border:'none', cursor:'pointer',
                              background: isSusp ? '#4B5563' : '#6C5FFF',
                              position:'relative', flexShrink:0, padding:0,
                              transition:'background .2s',
                            }}
                          >
                            <span style={{
                              position:'absolute', top:2,
                              left: isSusp ? 2 : 18,
                              width:16, height:16, borderRadius:'50%',
                              background:'#fff', display:'block',
                              transition:'left .2s',
                            }} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal confirmación suspensión */}
      {confirmToggle && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.65)', display:'flex',
          alignItems:'center', justifyContent:'center', zIndex:60, padding:'1rem' }}
          onClick={ev => { if (ev.target === ev.currentTarget) setConfirmToggle(null); }}>
          <div className="card" style={{ width:'100%', maxWidth:420, padding:'1.5rem' }}>
            <h3 style={{ fontSize:'1rem', fontWeight:700, color:'var(--text)', marginBottom:'.75rem' }}>
              Suspender empresa
            </h3>
            <p style={{ fontSize:'.85rem', color:'var(--text2)', marginBottom:'1rem' }}>
              Esto cortará el acceso de <strong style={{ color:'var(--text)' }}>{confirmToggle.empresa.nombre}</strong> a la plataforma. Podés reactivarla en cualquier momento.
            </p>
            <label style={{ display:'block', fontSize:'.75rem', color:'var(--text3)', marginBottom:'.3rem', fontWeight:500 }}>
              Motivo (opcional)
            </label>
            <input className="input" placeholder="Ej: falta de pago"
              value={confirmToggle.motivo}
              onChange={ev => setConfirmToggle(prev => prev ? { ...prev, motivo: ev.target.value } : null)}
              style={{ marginBottom:'1rem' }} />
            <div style={{ display:'flex', gap:'.75rem' }}>
              <button className="btn btn-secondary" style={{ flex:1 }} onClick={() => setConfirmToggle(null)}>
                Cancelar
              </button>
              <button className="btn btn-danger" style={{ flex:1 }}
                onClick={() => toggleEstado(confirmToggle.empresa, confirmToggle.motivo)}>
                Suspender
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal detalle */}
      {detalleId && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.65)', display:'flex',
          alignItems:'center', justifyContent:'center', zIndex:50, padding:'1rem' }}
          onClick={e => { if (e.target === e.currentTarget) { setDetalleId(''); setDetalle(null); } }}>
          <div className="card" style={{ width:'100%', maxWidth:600, maxHeight:'88vh', overflowY:'auto', padding:'1.5rem' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
              <h3 style={{ fontSize:'1rem', fontWeight:700, color:'var(--text)' }}>
                🏢 Detalle de empresa
              </h3>
              <button className="btn btn-secondary btn-sm" onClick={() => { setDetalleId(''); setDetalle(null); }}>✕</button>
            </div>

            {loadingDetalle ? (
              <div style={{ display:'flex', gap:'.75rem', padding:'2rem', color:'var(--text3)' }}>
                <span className="spinner" /> Cargando…
              </div>
            ) : detalle ? (
              <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
                {/* Empresa */}
                <div>
                  <div style={{ fontSize:'.72rem', fontWeight:700, color:'var(--text3)', textTransform:'uppercase',
                    letterSpacing:'.06em', marginBottom:'.5rem' }}>Empresa</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'.5rem', fontSize:'.82rem' }}>
                    {([['Nombre', detalle.empresa.nombre],['Tipo',detalle.empresa.tipo],
                      ['Email',detalle.empresa.email],['Teléfono',detalle.empresa.telefono],
                      ['Tenant ID', detalleId]] as [string, string][]).map(([k,v]) => (
                      <div key={k}>
                        <label style={L}>{k}</label>
                        <span style={{ color:'var(--text)' }}>{String(v||'—')}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Suscripción */}
                <div style={{ borderTop:'1px solid var(--border)', paddingTop:'1rem' }}>
                  <div style={{ fontSize:'.72rem', fontWeight:700, color:'var(--text3)', textTransform:'uppercase',
                    letterSpacing:'.06em', marginBottom:'.5rem' }}>Suscripción</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'.5rem', fontSize:'.82rem' }}>
                    {([['Plan', PLAN_LABEL[String(detalle.suscripcion.plan||'—')]||String(detalle.suscripcion.plan||'—')],
                      ['Estado', String(detalle.suscripcion.estado||'—')],
                      ['Próximo cobro', detalle.suscripcion.fechaProximoCobro ? new Date(String(detalle.suscripcion.fechaProximoCobro)).toLocaleDateString('es-AR') : '—'],
                      ['Choferes incl.', String(detalle.suscripcion.choferesIncluidos||'—')],
                      ['Precio', detalle.suscripcion.precio ? `$${Number(detalle.suscripcion.precio).toLocaleString('es-AR')}` : '—'],
                    ] as [string, string][]).map(([k,v]) => (
                      <div key={k}>
                        <label style={L}>{k}</label>
                        <span style={{ color:'var(--text)' }}>{String(v||'—')}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Features */}
                {Object.keys(detalle.features).filter(k => !k.startsWith('_')).length > 0 && (
                  <div style={{ borderTop:'1px solid var(--border)', paddingTop:'1rem' }}>
                    <div style={{ fontSize:'.72rem', fontWeight:700, color:'var(--text3)', textTransform:'uppercase',
                      letterSpacing:'.06em', marginBottom:'.5rem' }}>Features</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:'.4rem' }}>
                      {Object.entries(detalle.features).filter(([k]) => !k.startsWith('_')).map(([k,v]) => (
                        <span key={k} className={`badge ${v ? 'badge-green' : 'badge-gray'}`} style={{ fontSize:'.72rem' }}>
                          {v ? '✓' : '✗'} {k}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display:'flex', gap:'.75rem', marginTop:'.5rem' }}>
                  <button className="btn btn-secondary" style={{ flex:1 }}
                    onClick={() => { setDetalleId(''); setDetalle(null); }}>Cerrar</button>
                  <button className="btn btn-primary" style={{ flex:1 }}
                    onClick={() => window.location.href = `/superadmin/features?tenant=${detalleId}`}>
                    ⚙️ Editar features
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
