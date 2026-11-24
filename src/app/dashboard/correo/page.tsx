'use client';
import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
import { LABEL, OVERLAY, mensajeError } from '@/lib/administrativo';

interface Mail {
  id: string; de: string; deNombre: string; asunto: string; fecha: string; extracto: string;
  adjuntos: { nombre: string; tipo: string; tamano: number }[];
  categoria: string; resumen: string; accion: string; urgencia: 'ALTA' | 'MEDIA' | 'BAJA'; requiereAccion: boolean;
  pacienteId: string; pacienteNombre: string; clasificadoPor: 'regla' | 'ia'; link: string;
  estado: 'NUEVO' | 'VISTO' | 'RESUELTO';
}
interface Reglas { trabajo: string[]; ignorar: string[]; palabrasClave: string[] }
interface Config {
  conectado: boolean; user?: string; host?: string; port?: number; secure?: boolean; proveedor?: string;
  activo?: boolean; usarIA?: boolean; ultimaSync?: string; error?: string; aviso?: string;
  stats?: { revisados: number; guardados: number; ignorados: number } | null;
  reglas: Reglas; iaDisponible: boolean; categorias: Record<string, string>;
}
interface Contadores { NUEVO: number; ACCION: number; RESUELTO: number; total: number; porCategoria: Record<string, number> }
type Vista = 'PENDIENTES' | 'ACCION' | 'NUEVO' | 'RESUELTO' | 'TODOS';

const PROVEEDORES: Record<string, { label: string; host: string; port: number; ayuda: string }> = {
  gmail:   { label: 'Gmail / Google Workspace', host: 'imap.gmail.com', port: 993,
    ayuda: 'Gmail no acepta la contraseña normal. Activá la verificación en 2 pasos en la cuenta y creá una "Contraseña de aplicación" en myaccount.google.com/apppasswords. Son 16 letras: pegalas acá.' },
  outlook: { label: 'Outlook / Hotmail / Microsoft 365', host: 'outlook.office365.com', port: 993,
    ayuda: 'Con verificación en 2 pasos activada, creá una contraseña de aplicación en account.microsoft.com → Seguridad. En Microsoft 365 de empresa, el administrador tiene que tener IMAP habilitado.' },
  yahoo:   { label: 'Yahoo', host: 'imap.mail.yahoo.com', port: 993,
    ayuda: 'Generá una contraseña de aplicación en la configuración de seguridad de la cuenta de Yahoo.' },
  otro:    { label: 'Otro (hosting propio, etc.)', host: '', port: 993,
    ayuda: 'Pedile a tu proveedor de hosting los datos IMAP: servidor (ej. mail.tuempresa.com.ar) y puerto (casi siempre 993 con SSL).' },
};

const URG_UI = { ALTA: { color: 'var(--red)', label: 'Urgente' }, MEDIA: { color: 'var(--amber)', label: 'Media' }, BAJA: { color: 'var(--text3)', label: '' } };

function fechaCorta(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const hoy = new Date();
  if (d.toDateString() === hoy.toDateString()) return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
}

function haceCuanto(iso?: string) {
  if (!iso) return 'nunca';
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  if (min < 1440) return `hace ${Math.round(min / 60)} h`;
  return new Date(iso).toLocaleDateString('es-AR');
}

const pedir = (v: Vista, c: string, q: string) => Promise.all([
  api.get('/api/correo/config'),
  api.get('/api/correo/mails', { params: { estado: v === 'TODOS' ? '' : v, categoria: c, q } }),
]);

/* ── Modal de conexión y reglas ──────────────────────────────────────── */
function ModalConfig({ cfg, onCerrar, onCambio }: { cfg: Config; onCerrar: () => void; onCambio: () => void }) {
  const [prov, setProv] = useState(cfg.proveedor && PROVEEDORES[cfg.proveedor] ? cfg.proveedor : 'gmail');
  const [user, setUser] = useState(cfg.user || '');
  const [pass, setPass] = useState('');
  const [host, setHost] = useState(cfg.host || PROVEEDORES.gmail.host);
  const [port, setPort] = useState(String(cfg.port || 993));
  const [trabajo, setTrabajo] = useState(cfg.reglas.trabajo.join('\n'));
  const [ignorar, setIgnorar] = useState(cfg.reglas.ignorar.join('\n'));
  const [palabras, setPalabras] = useState(cfg.reglas.palabrasClave.join(', '));
  const [usarIA, setUsarIA] = useState(cfg.usarIA !== false);
  const [ocupado, setOcupado] = useState('');
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const elegirProv = (p: string) => { setProv(p); if (PROVEEDORES[p].host) setHost(PROVEEDORES[p].host); setPort(String(PROVEEDORES[p].port)); };

  const conectar = async () => {
    if (!user.trim()) { setMsg({ text: 'Poné la dirección de mail.', ok: false }); return; }
    if (!host.trim()) { setMsg({ text: 'Poné el servidor IMAP.', ok: false }); return; }
    if (!pass && !cfg.conectado) { setMsg({ text: 'Poné la contraseña de aplicación.', ok: false }); return; }
    setOcupado('conectar'); setMsg(null);
    try {
      const r = await api.post('/api/correo/config', { user, pass, host, port: Number(port), secure: Number(port) !== 143, proveedor: prov });
      setMsg({ text: `Conectado ✓ (${r.data.mensajes} mails en la bandeja). Leyendo los últimos 30 días…`, ok: true });
      setPass('');
      await api.post('/api/correo/sincronizar').catch(() => {});
      onCambio();
      setMsg({ text: 'Conectado y sincronizado ✓', ok: true });
    } catch (e) { setMsg({ text: mensajeError(e, 'No se pudo conectar'), ok: false }); }
    setOcupado('');
  };

  const guardarReglas = async (reescanear: boolean) => {
    setOcupado(reescanear ? 'reescanear' : 'reglas'); setMsg(null);
    try {
      await api.put('/api/correo/reglas', { reglas: { trabajo, ignorar, palabrasClave: palabras }, usarIA });
      if (reescanear) {
        const r = await api.post('/api/correo/reescanear');
        setMsg({ text: `Listo: ${r.data.revisados} revisados, ${r.data.guardados} nuevos de trabajo.`, ok: true });
      } else setMsg({ text: 'Reglas guardadas ✓', ok: true });
      onCambio();
    } catch (e) { setMsg({ text: mensajeError(e), ok: false }); }
    setOcupado('');
  };

  const desconectar = async () => {
    const borrar = window.confirm('¿Borrar también los mails ya guardados en Transit·Ya?\n\nAceptar = borrar · Cancelar = conservarlos');
    if (!window.confirm('Se va a desconectar la casilla. ¿Seguro?')) return;
    try { await api.delete(`/api/correo/config${borrar ? '?borrarMails=true' : ''}`); onCambio(); onCerrar(); }
    catch (e) { setMsg({ text: mensajeError(e), ok: false }); }
  };

  return (
    <div style={OVERLAY} onClick={e => { if (e.target === e.currentTarget && !ocupado) onCerrar(); }}>
      <div className="card" style={{ width: '100%', maxWidth: 560, padding: '1.5rem', maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)' }}>{cfg.conectado ? 'Correo de la empresa' : 'Conectar el correo de la empresa'}</h3>
          <button className="btn btn-secondary" onClick={onCerrar} disabled={!!ocupado}>✕</button>
        </div>

        <p style={{ fontSize: '.9rem', fontWeight: 700, color: 'var(--text)', marginBottom: '.5rem' }}>Casilla</p>
        <div className="form-grid">
          <div><label style={LABEL}>Proveedor</label>
            <select className="select" value={prov} onChange={e => elegirProv(e.target.value)}>
              {Object.entries(PROVEEDORES).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
            </select></div>
          <div><label style={LABEL}>Mail de la empresa</label>
            <input className="input" type="email" value={user} placeholder="administracion@tuempresa.com" onChange={e => setUser(e.target.value)} /></div>
          <div><label style={LABEL}>Contraseña de aplicación</label>
            <input className="input" type="password" autoComplete="new-password" value={pass}
              placeholder={cfg.conectado ? 'Dejala vacía para mantener la actual' : ''} onChange={e => setPass(e.target.value)} />
            <p style={{ fontSize: '.72rem', color: 'var(--text3)', marginTop: '.3rem' }}>{PROVEEDORES[prov].ayuda}</p></div>
          {prov === 'otro' && (
            <div className="form-grid form-grid-2">
              <div><label style={LABEL}>Servidor IMAP</label><input className="input" value={host} placeholder="mail.tuempresa.com.ar" onChange={e => setHost(e.target.value)} /></div>
              <div><label style={LABEL}>Puerto</label><input className="input" type="number" value={port} onChange={e => setPort(e.target.value)} /></div>
            </div>
          )}
        </div>
        <p style={{ fontSize: '.72rem', color: 'var(--text3)', marginTop: '.5rem' }}>
          🔒 La contraseña se guarda cifrada. Transit·Ya solo lee: no marca mails como leídos, no borra ni envía nada. Lo que no es de trabajo no se guarda.
        </p>
        <button className="btn btn-primary" style={{ marginTop: '.75rem', width: '100%' }} onClick={conectar} disabled={!!ocupado}>
          {ocupado === 'conectar' ? <><span className="spinner" style={{ width: 12, height: 12 }} />Probando conexión…</> : cfg.conectado ? 'Guardar casilla' : 'Conectar'}
        </button>

        {cfg.conectado && (
          <>
            <p style={{ fontSize: '.9rem', fontWeight: 700, color: 'var(--text)', margin: '1.5rem 0 .25rem' }}>Qué cuenta como trabajo</p>
            <p style={{ fontSize: '.74rem', color: 'var(--text3)', marginBottom: '.6rem' }}>
              Las reglas mandan primero. Lo que las reglas no definen lo decide {cfg.iaDisponible ? 'la IA' : 'la lista de palabras clave'}.
            </p>
            <div className="form-grid">
              <div><label style={LABEL}>Siempre de trabajo (un mail o @dominio por línea)</label>
                <textarea className="input" rows={3} value={trabajo} placeholder={'@osprera.org.ar\ncontador@estudio.com'} onChange={e => setTrabajo(e.target.value)} /></div>
              <div><label style={LABEL}>Nunca mostrar (un mail o @dominio por línea)</label>
                <textarea className="input" rows={3} value={ignorar} placeholder={'@mercadolibre.com\nnewsletter@…'} onChange={e => setIgnorar(e.target.value)} /></div>
              <div><label style={LABEL}>Palabras clave (separadas por coma)</label>
                <textarea className="input" rows={3} value={palabras} onChange={e => setPalabras(e.target.value)} /></div>
              <label style={{ fontSize: '.82rem', color: cfg.iaDisponible ? 'var(--text2)' : 'var(--text3)', display: 'flex', gap: '.4rem', alignItems: 'flex-start' }}>
                <input type="checkbox" checked={usarIA && cfg.iaDisponible} disabled={!cfg.iaDisponible} onChange={e => setUsarIA(e.target.checked)} style={{ marginTop: 3 }} />
                <span>Usar IA para clasificar, resumir y detectar qué hay que hacer.
                  <span style={{ display: 'block', fontSize: '.72rem', color: 'var(--text3)' }}>
                    {cfg.iaDisponible ? 'Se envía remitente, asunto y un extracto de cada mail a Claude (Anthropic).' : 'No disponible: falta ANTHROPIC_API_KEY en el servidor.'}
                  </span></span>
              </label>
            </div>
            <div style={{ display: 'flex', gap: '.5rem', marginTop: '.9rem', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={() => guardarReglas(false)} disabled={!!ocupado}>{ocupado === 'reglas' ? 'Guardando…' : 'Guardar reglas'}</button>
              <button className="btn btn-secondary" onClick={() => guardarReglas(true)} disabled={!!ocupado}>
                {ocupado === 'reescanear' ? <><span className="spinner" style={{ width: 12, height: 12 }} />Revisando…</> : 'Guardar y revisar últimos 30 días'}
              </button>
              <div style={{ flex: 1 }} />
              <button className="btn btn-danger" onClick={desconectar} disabled={!!ocupado}>Desconectar</button>
            </div>
          </>
        )}
        {msg && <p style={{ fontSize: '.82rem', color: msg.ok ? 'var(--green)' : 'var(--red)', marginTop: '.9rem' }}>{msg.text}</p>}
      </div>
    </div>
  );
}

/* ── Página ──────────────────────────────────────────────────────────── */
export default function CorreoPage() {
  const authLoading = useRequireAdmin();
  const [cfg, setCfg] = useState<Config | null>(null);
  const [mails, setMails] = useState<Mail[]>([]);
  const [cont, setCont] = useState<Contadores | null>(null);
  const [cats, setCats] = useState<Record<string, string>>({});
  const [vista, setVista] = useState<Vista>('PENDIENTES');
  const [categoria, setCategoria] = useState('');
  const [busq, setBusq] = useState('');
  const [abierto, setAbierto] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sync, setSync] = useState(false);
  const [aviso, setAviso] = useState<{ text: string; ok: boolean } | null>(null);
  const [verConfig, setVerConfig] = useState(false);

  const aplicar = useCallback(([rc, rm]: Awaited<ReturnType<typeof pedir>>) => {
    setCfg(rc.data); setMails(rm.data.mails || []); setCont(rm.data.contadores); setCats(rm.data.categorias || {});
  }, []);
  const recargar = useCallback(async () => {
    try { aplicar(await pedir(vista, categoria, busq)); } catch { /* silent */ }
  }, [vista, categoria, busq, aplicar]);

  useEffect(() => {
    if (authLoading) return;
    let vivo = true;
    const t = setTimeout(() => {
      pedir(vista, categoria, busq).then(r => { if (vivo) aplicar(r); }).catch(() => {}).finally(() => { if (vivo) setLoading(false); });
    }, busq ? 300 : 0);
    return () => { vivo = false; clearTimeout(t); };
  }, [authLoading, vista, categoria, busq, aplicar]);

  const sincronizar = async () => {
    setSync(true); setAviso(null);
    try {
      const r = await api.post('/api/correo/sincronizar');
      setAviso({ text: r.data.guardados ? `${r.data.guardados} mail${r.data.guardados === 1 ? '' : 's'} nuevo${r.data.guardados === 1 ? '' : 's'} de trabajo` : 'No hay mails nuevos de trabajo', ok: true });
      await recargar();
    } catch (e) { setAviso({ text: mensajeError(e, 'No se pudo sincronizar'), ok: false }); }
    setSync(false);
  };

  const cambiarEstado = async (m: Mail, estado: Mail['estado']) => {
    setMails(ms => ms.map(x => x.id === m.id ? { ...x, estado } : x));
    try { await api.put(`/api/correo/mails/${m.id}`, { estado }); } catch { /* silent */ }
    if (estado === 'RESUELTO') recargar();
  };

  const abrir = (m: Mail) => {
    setAbierto(abierto === m.id ? null : m.id);
    if (m.estado === 'NUEVO') cambiarEstado(m, 'VISTO');
  };

  const noEsTrabajo = async (m: Mail) => {
    const ignorar = window.confirm(`¿Ignorar siempre los mails de ${m.de}?\n\nAceptar = no mostrar más mails de este remitente\nCancelar = solo sacar este`);
    try { await api.post(`/api/correo/mails/${m.id}/no-es-trabajo`, { ignorarRemitente: ignorar }); await recargar(); } catch { /* silent */ }
  };

  const siempreTrabajo = async (m: Mail) => {
    try { await api.post(`/api/correo/mails/${m.id}/remitente-trabajo`); setAviso({ text: `Los mails de ${m.de} van a entrar siempre.`, ok: true }); } catch { /* silent */ }
  };

  if (authLoading) return null;

  return (
    <div>
      <div className="section-header">
        <div>
          <h2 className="section-title">📨 Correo de trabajo</h2>
          <p style={{ fontSize: '.82rem', color: 'var(--text3)', marginTop: '.2rem' }}>
            {cfg?.conectado
              ? <>{cfg.user} · actualizado {haceCuanto(cfg.ultimaSync)}{cont && cont.ACCION > 0 && <span style={{ color: 'var(--amber)' }}> · {cont.ACCION} para resolver</span>}</>
              : 'Solo los mails de trabajo de la casilla de la empresa, clasificados y resumidos.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '.5rem' }}>
          {cfg?.conectado && (
            <button className="btn btn-secondary" onClick={sincronizar} disabled={sync}>
              {sync ? <><span className="spinner" style={{ width: 12, height: 12 }} />Leyendo…</> : '↻ Actualizar'}
            </button>
          )}
          {cfg && <button className={cfg.conectado ? 'btn btn-secondary' : 'btn btn-primary'} onClick={() => setVerConfig(true)}>{cfg.conectado ? '⚙️ Configurar' : 'Conectar correo'}</button>}
        </div>
      </div>

      {cfg?.error && (
        <div className="card" style={{ padding: '.8rem 1rem', marginBottom: '1rem', borderColor: 'var(--red)' }}>
          <p style={{ fontSize: '.84rem', color: 'var(--red)' }}>No se pudo leer el correo: {cfg.error}</p>
        </div>
      )}
      {cfg?.aviso && !cfg.error && <p style={{ fontSize: '.78rem', color: 'var(--amber)', marginBottom: '.75rem' }}>{cfg.aviso}</p>}
      {aviso && <p style={{ fontSize: '.82rem', color: aviso.ok ? 'var(--green)' : 'var(--red)', marginBottom: '.75rem' }}>{aviso.text}</p>}

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', color: 'var(--text3)', padding: '2rem' }}><span className="spinner" /> Cargando…</div>
      ) : !cfg?.conectado && !cont?.total ? (
        <div className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <p style={{ fontSize: '.95rem', fontWeight: 600, color: 'var(--text)' }}>Todavía no hay un correo conectado</p>
          <p style={{ fontSize: '.82rem', color: 'var(--text3)', margin: '.5rem auto 1rem', maxWidth: 460 }}>
            Conectá la casilla de la empresa. Transit·Ya la revisa cada 10 minutos, se queda solo con lo de trabajo
            (obras sociales, familias, centros, contador, cobros) y te dice qué hay que hacer.
          </p>
          <button className="btn btn-primary" onClick={() => setVerConfig(true)}>Conectar correo</button>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '.35rem', flexWrap: 'wrap', marginBottom: '.75rem' }}>
            {([
              ['PENDIENTES', 'Pendientes', cont ? cont.total - cont.RESUELTO : 0], ['ACCION', 'Para resolver', cont?.ACCION || 0],
              ['NUEVO', 'Sin leer', cont?.NUEVO || 0], ['RESUELTO', 'Resueltos', cont?.RESUELTO || 0], ['TODOS', 'Todos', cont?.total || 0],
            ] as [Vista, string, number][]).map(([k, label, n]) => (
              <button key={k} className={vista === k ? 'btn btn-primary' : 'btn btn-secondary'} style={{ fontSize: '.82rem' }} onClick={() => setVista(k)}>{label} ({n})</button>
            ))}
          </div>
          <div className="filter-bar" style={{ marginBottom: '1rem' }}>
            <input className="input" placeholder="Buscar asunto, remitente o paciente…" value={busq} onChange={e => setBusq(e.target.value)} />
            <select className="select" value={categoria} onChange={e => setCategoria(e.target.value)}>
              <option value="">Todas las categorías</option>
              {Object.entries(cats).map(([k, l]) => <option key={k} value={k}>{l}{cont?.porCategoria?.[k] ? ` (${cont.porCategoria[k]})` : ''}</option>)}
            </select>
          </div>

          {mails.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">📭</div><p>No hay mails en esta vista</p></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
              {mails.map(m => {
                const ab = abierto === m.id;
                const urg = URG_UI[m.urgencia] || URG_UI.BAJA;
                return (
                  <div key={m.id} className="card" style={{ padding: '.75rem 1rem', opacity: m.estado === 'RESUELTO' ? .65 : 1 }}>
                    <div style={{ display: 'flex', gap: '.75rem', cursor: 'pointer' }} onClick={() => abrir(m)}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 7, flexShrink: 0,
                        background: m.estado === 'NUEVO' ? 'var(--blue-bright, #3b82f6)' : 'transparent' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: '.5rem', alignItems: 'baseline' }}>
                          <span style={{ fontSize: '.84rem', color: 'var(--text2)', fontWeight: m.estado === 'NUEVO' ? 700 : 500, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {m.deNombre || m.de}
                          </span>
                          <span style={{ fontSize: '.72rem', color: 'var(--text3)', flexShrink: 0 }}>{fechaCorta(m.fecha)}</span>
                        </div>
                        <p style={{ fontSize: '.88rem', color: 'var(--text)', fontWeight: m.estado === 'NUEVO' ? 700 : 600, marginTop: '.1rem' }}>{m.asunto || '(sin asunto)'}</p>
                        <p style={{ fontSize: '.78rem', color: 'var(--text3)', marginTop: '.15rem' }}>{m.resumen || m.extracto.slice(0, 140)}</p>
                        {m.accion && m.estado !== 'RESUELTO' && (
                          <p style={{ fontSize: '.78rem', color: urg.color === 'var(--text3)' ? 'var(--amber)' : urg.color, marginTop: '.25rem', fontWeight: 600 }}>→ {m.accion}</p>
                        )}
                        <div style={{ display: 'flex', gap: '.3rem', flexWrap: 'wrap', marginTop: '.4rem' }}>
                          <span className="badge badge-blue">{cats[m.categoria] || m.categoria}</span>
                          {urg.label && m.estado !== 'RESUELTO' && <span className={`badge ${m.urgencia === 'ALTA' ? 'badge-red' : 'badge-amber'}`}>{urg.label}</span>}
                          {m.pacienteNombre && <span className="badge badge-purple">👤 {m.pacienteNombre}</span>}
                          {m.adjuntos?.length > 0 && <span className="badge badge-gray">📎 {m.adjuntos.length}</span>}
                          {m.estado === 'RESUELTO' && <span className="badge badge-green">Resuelto</span>}
                        </div>
                      </div>
                    </div>
                    {ab && (
                      <div style={{ marginTop: '.75rem', paddingTop: '.75rem', borderTop: '1px solid var(--border)' }}>
                        <p style={{ fontSize: '.74rem', color: 'var(--text3)', marginBottom: '.4rem' }}>
                          De: {m.deNombre ? `${m.deNombre} <${m.de}>` : m.de} · {new Date(m.fecha).toLocaleString('es-AR')}
                          {' · '}{m.clasificadoPor === 'ia' ? 'clasificado por IA' : 'clasificado por regla'}
                        </p>
                        <p style={{ fontSize: '.82rem', color: 'var(--text2)', whiteSpace: 'pre-wrap', maxHeight: 260, overflowY: 'auto', lineHeight: 1.5 }}>{m.extracto || '(sin texto)'}</p>
                        {m.adjuntos?.length > 0 && (
                          <p style={{ fontSize: '.76rem', color: 'var(--text3)', marginTop: '.5rem' }}>📎 {m.adjuntos.map(a => a.nombre).join(' · ')}</p>
                        )}
                        <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap', marginTop: '.75rem' }}>
                          {m.estado !== 'RESUELTO'
                            ? <button className="btn btn-success" style={{ fontSize: '.76rem' }} onClick={() => cambiarEstado(m, 'RESUELTO')}>✓ Resuelto</button>
                            : <button className="btn btn-secondary" style={{ fontSize: '.76rem' }} onClick={() => cambiarEstado(m, 'VISTO')}>Volver a pendiente</button>}
                          {m.link && <a className="btn btn-secondary" style={{ fontSize: '.76rem' }} href={m.link} target="_blank" rel="noreferrer">Abrir en Gmail ↗</a>}
                          <div style={{ flex: 1 }} />
                          <button className="btn btn-secondary" style={{ fontSize: '.76rem' }} onClick={() => siempreTrabajo(m)}>Siempre de trabajo</button>
                          <button className="btn btn-secondary" style={{ fontSize: '.76rem' }} onClick={() => noEsTrabajo(m)}>No es de trabajo</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {verConfig && cfg && <ModalConfig cfg={cfg} onCerrar={() => setVerConfig(false)} onCambio={recargar} />}
    </div>
  );
}
