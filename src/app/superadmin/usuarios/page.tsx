'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

interface Usuario {
  uid: string; email: string; displayName: string; nombre: string;
  rol: string; tenantId: string; empresa: string;
  disabled: boolean; activo: boolean;
  createdAt: string; lastSignIn: string;
}

interface UsuarioDetalle {
  uid: string; email: string; displayName: string; nombre: string;
  rol: string; tenantId: string; empresa: string;
  disabled: boolean; activo: boolean; phoneNumber: string;
  createdAt: string; creadoEn: string; lastSignIn: string;
  claims: Record<string,unknown>;
}

interface Grupo {
  tenantId: string; empresa: string;
  usuarios: Usuario[];
  admins: number; choferes: number; total: number;
}

const ROL_LABEL: Record<string,string> = { superadmin:'SuperAdmin', admin:'Admin', chofer:'Chofer', operador:'Operador' };
const ROL_COLOR: Record<string,string> = { superadmin:'badge-purple', admin:'badge-blue', chofer:'badge-teal', operador:'badge-amber' };

export default function UsuariosPage() {
  const router = useRouter();
  const [usuarios,   setUsuarios]   = useState<Usuario[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [busqueda,   setBusqueda]   = useState('');
  const [filtroRol,  setFiltroRol]  = useState('');
  const [filtroEst,  setFiltroEst]  = useState('');
  const [detalle,    setDetalle]    = useState<UsuarioDetalle | null>(null);
  const [loadingDet, setLoadingDet] = useState(false);
  const [accionUid,  setAccionUid]  = useState('');
  const [msg,        setMsg]        = useState<{text:string;ok:boolean}|null>(null);
  const [collapsed,  setCollapsed]  = useState<Set<string>>(new Set());

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/superadmin/usuarios');
      setUsuarios(r.data.usuarios || []);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const filtrados = useMemo(() => usuarios.filter(u => {
    const nombre = u.displayName || u.nombre || '';
    const q = busqueda.toLowerCase();
    if (q && !u.email?.toLowerCase().includes(q) && !nombre.toLowerCase().includes(q) && !u.empresa?.toLowerCase().includes(q)) return false;
    if (filtroRol && u.rol !== filtroRol) return false;
    const isSusp = u.disabled || u.activo === false;
    if (filtroEst === 'activo'     && isSusp)  return false;
    if (filtroEst === 'suspendido' && !isSusp) return false;
    return true;
  }), [usuarios, busqueda, filtroRol, filtroEst]);

  const grupos: Grupo[] = useMemo(() => {
    const map = new Map<string, Grupo>();

    filtrados.forEach(u => {
      const key = u.tenantId || '__sin_empresa__';
      const emp = u.empresa || (u.tenantId ? u.tenantId : '');
      if (!map.has(key)) {
        map.set(key, { tenantId: key, empresa: emp, usuarios: [], admins: 0, choferes: 0, total: 0 });
      }
      const g = map.get(key)!;
      g.usuarios.push(u);
      g.total++;
      if (u.rol === 'admin' || u.rol === 'administrador') g.admins++;
      if (u.rol === 'chofer') g.choferes++;
    });

    return [...map.values()].sort((a, b) => {
      if (a.tenantId === '__sin_empresa__') return 1;
      if (b.tenantId === '__sin_empresa__') return -1;
      return a.empresa.localeCompare(b.empresa, 'es');
    });
  }, [filtrados]);

  const toggleCollapse = (key: string) =>
    setCollapsed(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const verDetalle = async (uid: string) => {
    setLoadingDet(true); setDetalle(null);
    try {
      const r = await api.get(`/api/superadmin/usuarios/${uid}`);
      setDetalle(r.data.usuario || r.data);
    } catch { /* silent */ }
    setLoadingDet(false);
  };

  const toggleEstado = async (uid: string, isSusp: boolean) => {
    setAccionUid(uid); setMsg(null);
    try {
      await api.put(`/api/superadmin/usuarios/${uid}/estado`, { activo: isSusp });
      setMsg({ text:`✅ Usuario ${isSusp ? 'activado' : 'suspendido'}.`, ok:true });
      cargar();
      if (detalle?.uid === uid) setDetalle(null);
    } catch { setMsg({ text:'Error al cambiar estado.', ok:false }); }
    setAccionUid('');
  };

  const roles = useMemo(() => [...new Set(usuarios.map(u => u.rol).filter(Boolean))].sort(), [usuarios]);

  const subtituloGrupo = (g: Grupo) => {
    const parts = [];
    if (g.choferes > 0) parts.push(`${g.choferes} chofer${g.choferes !== 1 ? 'es' : ''}`);
    if (g.admins > 0)   parts.push(`${g.admins} admin${g.admins !== 1 ? 's' : ''}`);
    const resto = g.total - g.choferes - g.admins;
    if (resto > 0) parts.push(`${resto} otro${resto !== 1 ? 's' : ''}`);
    return parts.join(', ') || `${g.total} usuario${g.total !== 1 ? 's' : ''}`;
  };

  return (
    <div>
      <div className="section-header" style={{ marginBottom:'1.25rem' }}>
        <div>
          <div className="section-title">👥 Usuarios</div>
          <div className="section-sub">
            {filtrados.length} usuario{filtrados.length !== 1 ? 's' : ''} en {grupos.length} empresa{grupos.length !== 1 ? 's' : ''}
          </div>
        </div>
        <button className="btn btn-secondary" style={{ fontSize:'.8rem' }} onClick={cargar}>↻ Actualizar</button>
      </div>

      <div className="filter-bar" style={{ marginBottom:'1rem' }}>
        <input className="input" placeholder="Buscar por email, nombre o empresa…"
          style={{ minWidth:220 }} value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        <select className="select" value={filtroRol} onChange={e => setFiltroRol(e.target.value)}>
          <option value="">Todos los roles</option>
          {roles.map(r => <option key={r} value={r}>{ROL_LABEL[r]||r}</option>)}
        </select>
        <select className="select" value={filtroEst} onChange={e => setFiltroEst(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="activo">Activos</option>
          <option value="suspendido">Suspendidos</option>
        </select>
        {(busqueda || filtroRol || filtroEst) && (
          <button className="btn btn-secondary btn-sm"
            onClick={() => { setBusqueda(''); setFiltroRol(''); setFiltroEst(''); }}>✕</button>
        )}
      </div>

      {msg && (
        <div style={{ background: msg.ok ? 'rgba(16,185,129,.1)' : 'rgba(239,68,68,.1)',
          border:`1px solid ${msg.ok ? 'rgba(16,185,129,.3)' : 'rgba(239,68,68,.3)'}`,
          borderRadius:'var(--radius)', padding:'.5rem .85rem', fontSize:'.82rem',
          color: msg.ok ? 'var(--green)' : 'var(--red)', marginBottom:'.75rem' }}>
          {msg.text}
        </div>
      )}

      {loading ? (
        <div style={{ display:'flex', gap:'.75rem', color:'var(--text3)', padding:'2rem' }}>
          <span className="spinner" /> Cargando…
        </div>
      ) : grupos.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">👥</div><p>Sin usuarios</p></div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'.85rem' }}>
          {grupos.map(g => {
            const isCollapsed = collapsed.has(g.tenantId);
            const sinEmpresa  = g.tenantId === '__sin_empresa__';

            return (
              <div key={g.tenantId} className="card" style={{ padding:0, overflow:'hidden' }}>
                {/* Header del grupo */}
                <div
                  style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                    padding:'.85rem 1.1rem', cursor:'pointer', background:'var(--bg3)',
                    borderBottom: isCollapsed ? 'none' : '1px solid var(--border)' }}
                  onClick={() => toggleCollapse(g.tenantId)}>
                  <div style={{ display:'flex', alignItems:'center', gap:'.65rem' }}>
                    <span style={{ fontSize:'1rem' }}>{sinEmpresa ? '❓' : '🏢'}</span>
                    <div>
                      <div style={{ fontWeight:700, fontSize:'.9rem', color:'var(--text)' }}>
                        {sinEmpresa ? 'Sin empresa' : (g.empresa || g.tenantId)}
                      </div>
                      <div style={{ fontSize:'.73rem', color:'var(--text3)', marginTop:'.1rem' }}>
                        {subtituloGrupo(g)}
                        {!sinEmpresa && g.tenantId && (
                          <span style={{ marginLeft:'.4rem', opacity:.6 }}>· {g.tenantId}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:'.5rem' }}>
                    {!sinEmpresa && (
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize:'.72rem' }}
                        onClick={e => { e.stopPropagation(); router.push(`/superadmin/empresas`); }}>
                        Ver empresa
                      </button>
                    )}
                    <span style={{ color:'var(--text3)', fontSize:'.82rem', minWidth:16, textAlign:'center' }}>
                      {isCollapsed ? '▶' : '▼'}
                    </span>
                  </div>
                </div>

                {/* Tabla de usuarios del grupo */}
                {!isCollapsed && (
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'.82rem' }}>
                      <tbody>
                        {g.usuarios.map(u => {
                          const uid    = u.uid;
                          const nombre = u.displayName || u.nombre || '(sin nombre)';
                          const isSusp = u.disabled || u.activo === false;

                          return (
                            <tr key={uid}
                              style={{ borderBottom:'1px solid var(--border)', opacity: isSusp ? .55 : 1 }}>
                              <td style={{ padding:'8px 12px', width:24 }}>
                                <span style={{ fontSize:'1rem' }}>{u.rol === 'chofer' ? '🚌' : u.rol === 'admin' ? '👔' : '👤'}</span>
                              </td>
                              <td style={{ padding:'8px 8px' }}>
                                <div style={{ fontWeight:600, color:'var(--text)' }}>{nombre}</div>
                                <div style={{ fontSize:'.73rem', color:'var(--text3)' }}>{u.email}</div>
                              </td>
                              <td style={{ padding:'8px 8px' }}>
                                <span className={`badge ${ROL_COLOR[u.rol]||'badge-gray'}`} style={{ fontSize:'.7rem' }}>
                                  {ROL_LABEL[u.rol]||u.rol||'—'}
                                </span>
                              </td>
                              <td style={{ padding:'8px 8px' }}>
                                <span className={`badge ${isSusp ? 'badge-red' : 'badge-green'}`} style={{ fontSize:'.7rem' }}>
                                  {isSusp ? 'Suspendido' : 'Activo'}
                                </span>
                              </td>
                              <td style={{ padding:'8px 8px', color:'var(--text3)', fontSize:'.75rem', whiteSpace:'nowrap' }}>
                                {u.lastSignIn ? new Date(u.lastSignIn).toLocaleDateString('es-AR') : '—'}
                              </td>
                              <td style={{ padding:'8px 12px 8px 4px' }}>
                                <div style={{ display:'flex', gap:'.3rem', justifyContent:'flex-end' }}>
                                  <button className="btn btn-secondary btn-sm" style={{ fontSize:'.72rem' }}
                                    onClick={() => verDetalle(uid)}>Ver</button>
                                  <button
                                    className={`btn btn-sm ${isSusp ? 'btn-primary' : 'btn-danger'}`}
                                    style={{ fontSize:'.72rem' }}
                                    disabled={accionUid === uid}
                                    onClick={() => toggleEstado(uid, isSusp)}>
                                    {accionUid === uid ? '…' : isSusp ? 'Activar' : 'Suspender'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal detalle */}
      {(loadingDet || detalle) && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.65)', display:'flex',
          alignItems:'center', justifyContent:'center', zIndex:50, padding:'1rem' }}
          onClick={e => { if (e.target === e.currentTarget) setDetalle(null); }}>
          <div className="card" style={{ width:'100%', maxWidth:480, maxHeight:'88vh', overflowY:'auto', padding:'1.5rem' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
              <h3 style={{ fontSize:'1rem', fontWeight:700, color:'var(--text)' }}>👤 Detalle de usuario</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setDetalle(null)}>✕</button>
            </div>

            {loadingDet ? (
              <div style={{ display:'flex', gap:'.75rem', padding:'2rem', color:'var(--text3)' }}>
                <span className="spinner" /> Cargando…
              </div>
            ) : detalle && (
              <div style={{ display:'flex', flexDirection:'column', gap:'.75rem' }}>
                {([
                  ['Nombre',    detalle.displayName || detalle.nombre || '—'],
                  ['Email',     detalle.email],
                  ['Rol',       ROL_LABEL[detalle.rol]||detalle.rol||'—'],
                  ['Empresa',   detalle.empresa || detalle.tenantId || '—'],
                  ['Tenant ID', detalle.tenantId || '—'],
                  ['Teléfono',  detalle.phoneNumber || '—'],
                  ['Registrado', (detalle.createdAt||detalle.creadoEn) ? new Date(detalle.createdAt||detalle.creadoEn).toLocaleDateString('es-AR') : '—'],
                  ['Último acceso', detalle.lastSignIn ? new Date(detalle.lastSignIn).toLocaleDateString('es-AR') : '—'],
                  ['Estado',    (detalle.disabled || detalle.activo === false) ? '🔴 Suspendido' : '🟢 Activo'],
                ] as [string,string][]).map(([k,v]) => (
                  <div key={k} style={{ display:'flex', justifyContent:'space-between', fontSize:'.84rem',
                    borderBottom:'1px solid var(--border)', paddingBottom:'.4rem' }}>
                    <span style={{ color:'var(--text3)', fontWeight:500 }}>{k}</span>
                    <span style={{ color:'var(--text)', fontWeight:600 }}>{v}</span>
                  </div>
                ))}

                <div style={{ display:'flex', gap:'.75rem', marginTop:'.5rem' }}>
                  <button className="btn btn-secondary" style={{ flex:1 }} onClick={() => setDetalle(null)}>Cerrar</button>
                  <button
                    className={`btn ${(detalle.disabled || detalle.activo === false) ? 'btn-primary' : 'btn-danger'}`}
                    style={{ flex:1 }}
                    disabled={accionUid === detalle.uid}
                    onClick={() => {
                      const isSusp = detalle.disabled || detalle.activo === false;
                      toggleEstado(detalle.uid, isSusp);
                      setDetalle(null);
                    }}>
                    {(detalle.disabled || detalle.activo === false) ? '✅ Activar' : '⛔ Suspender'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
