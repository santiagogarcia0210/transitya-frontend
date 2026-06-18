'use client';
import { useEffect, useState } from 'react';
import { getAuth } from 'firebase/auth';
import api from '@/lib/api';
import { serializarFirestore, toArray } from '@/lib/utils';

/* ─── Tipos ─────────────────────────────────────────────────────────── */

type Tab = 'usuarios' | 'fiscal' | 'salud' | 'asistencia' | 'suscripcion';
const ROLES = ['admin', 'chofer', 'operador'] as const;
type Rol = typeof ROLES[number];

const CONDICIONES_IVA = [
  'Responsable Inscripto',
  'Monotributista',
  'Exento',
  'No Responsable',
] as const;

interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: Rol | string;
  activo: boolean;
  vehiculo: string;
}

interface UserForm {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  vehiculo: string;
  clave: string;
  activo: boolean;
}

interface FiscalForm {
  razonSocial: string;
  cuit: string;
  condicionIVA: string;
  domicilio: string;
  puntoVentaDefault: string;
  iibb: string;
  inicioActividades: string;
}

function normalizarUsuario(u: Record<string, unknown>): Usuario {
  return {
    id:       String(u.id       || u.uid     || ''),
    nombre:   String(u.nombre   || u.NOMBRE  || u.usuario || ''),
    email:    String(u.email    || u.EMAIL   || ''),
    rol:      String(u.rol      || u.ROL     || 'operador'),
    activo:   u.activo !== false,
    vehiculo: String(u.vehiculo || u.VEHICULO || ''),
  };
}

const EMPTY_USER: UserForm = {
  id: '', nombre: '', email: '', rol: 'chofer', vehiculo: '', clave: '', activo: true,
};

const EMPTY_FISCAL: FiscalForm = {
  razonSocial: '', cuit: '', condicionIVA: '', domicilio: '',
  puntoVentaDefault: '', iibb: '', inicioActividades: '',
};

/* ─── Estilos ───────────────────────────────────────────────────────── */

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '.78rem', color: 'var(--text3)', marginBottom: '.3rem', fontWeight: 500,
};

const BADGE_ROL: Record<string, string> = {
  admin: 'badge-red', chofer: 'badge-blue', operador: 'badge-teal',
};

/* ─── Componente ─────────────────────────────────────────────────────── */

export default function AdministradorPage() {
  const [tab,           setTab]           = useState<Tab>('usuarios');

  /* — Usuarios — */
  const [usuarios,      setUsuarios]      = useState<Usuario[]>([]);
  const [loadingU,      setLoadingU]      = useState(true);
  const [showModal,     setShowModal]     = useState(false);
  const [userForm,      setUserForm]      = useState<UserForm>(EMPTY_USER);
  const [savingU,       setSavingU]       = useState(false);
  const [confirmDel,    setConfirmDel]    = useState<string | null>(null);
  const [msgU,          setMsgU]          = useState<{ text: string; ok: boolean } | null>(null);
  const [togglingId,    setTogglingId]    = useState<string | null>(null);

  /* — Datos Fiscales — */
  const [fiscal,        setFiscal]        = useState<FiscalForm>(EMPTY_FISCAL);
  const [loadingF,      setLoadingF]      = useState(true);
  const [savingF,       setSavingF]       = useState(false);
  const [msgF,          setMsgF]          = useState<{ text: string; ok: boolean } | null>(null);

  /* — Salud del sistema — */
  const [salud,            setSalud]            = useState<Record<string,unknown>|null>(null);
  const [loadingSalud,     setLoadingSalud]      = useState(false);
  const [backingUp,        setBackingUp]         = useState(false);
  const [backupMsg,        setBackupMsg]         = useState('');
  const [notifEmail,       setNotifEmail]        = useState('');
  const [savingNotifEmail, setSavingNotifEmail]  = useState(false);
  const [msgNotifEmail,    setMsgNotifEmail]     = useState('');
  const [instalandoTodos,  setInstalandoTodos]   = useState(false);

  /* — Asistencia hoy — */
  const [asistHoy,      setAsistHoy]      = useState<{chofer:string;presentes:number;ausentes:number;pendientes:number;total:number;tomada:boolean}[]>([]);
  const [loadingAH,     setLoadingAH]     = useState(false);

  /* — Suscripción — */
  const [suscripcion,   setSuscripcion]   = useState<Record<string,unknown>|null>(null);
  const [loadingSusc,   setLoadingSusc]   = useState(false);

  /* UID del usuario actual (para bloquear auto-eliminación) */
  const currentUid = getAuth().currentUser?.uid ?? '';

  /* ── Carga ────────────────────────────────────────────────────────── */
  const cargarUsuarios = async () => {
    setLoadingU(true);
    try {
      const r = await api.get('/api/usuarios');
      setUsuarios(toArray(r.data).map(serializarFirestore).map(normalizarUsuario));
    } catch { /* silent */ }
    setLoadingU(false);
  };

  const cargarFiscal = async () => {
    setLoadingF(true);
    try {
      const r = await api.get('/api/empresa/fiscal');
      const d = serializarFirestore(r.data);
      setFiscal({
        razonSocial:       String(d.razonSocial       || d['RAZON SOCIAL']   || ''),
        cuit:              String(d.cuit              || d.CUIT              || ''),
        condicionIVA:      String(d.condicionIVA      || d['CONDICION IVA']  || ''),
        domicilio:         String(d.domicilio         || d.DOMICILIO         || ''),
        puntoVentaDefault: String(d.puntoVentaDefault || d.PUNTOVENTA        || ''),
        iibb:              String(d.iibb              || d.IIBB              || ''),
        inicioActividades: String(d.inicioActividades || d.INICIOACTIVIDADES || ''),
      });
    } catch { /* sin datos previos */ }
    setLoadingF(false);
  };

  const cargarSalud = async () => {
    setLoadingSalud(true);
    try {
      const r = await api.get('/api/admin/salud');
      const d = serializarFirestore(r.data);
      setSalud(d);
      if (d.notifEmail) setNotifEmail(String(d.notifEmail));
    }
    catch { /* silent */ }
    setLoadingSalud(false);
  };
  const ejecutarBackup = async () => {
    setBackingUp(true); setBackupMsg('');
    try {
      const r = await api.post('/api/admin/backup');
      setBackupMsg(`✓ Backup generado: ${r.data?.archivo || r.data?.filename || 'completado'}`);
      setTimeout(cargarSalud, 800);
    } catch { setBackupMsg('Error al ejecutar backup'); }
    setBackingUp(false);
  };

  const instalarTodosLosTriggers = async () => {
    setInstalandoTodos(true);
    try {
      await api.post('/api/admin/instalar-todos-triggers', {});
      setTimeout(cargarSalud, 800);
    } catch { /* silent */ }
    setInstalandoTodos(false);
  };

  const guardarNotifEmail = async () => {
    setSavingNotifEmail(true); setMsgNotifEmail('');
    try {
      await api.post('/api/admin/notif-email', { email: notifEmail });
      setMsgNotifEmail('✓ Guardado');
    } catch { setMsgNotifEmail('Error al guardar'); }
    setSavingNotifEmail(false);
  };

  const cargarAsistHoy = async () => {
    setLoadingAH(true);
    try {
      const r = await api.get('/api/asistencia/estado-hoy');
      setAsistHoy(toArray(r.data).map(serializarFirestore).map((a: Record<string,unknown>) => ({
        chofer:    String(a.chofer    || a.CHOFER    || ''),
        presentes: Number(a.presentes || 0),
        ausentes:  Number(a.ausentes  || 0),
        pendientes:Number(a.pendientes|| 0),
        total:     Number(a.total     || 0),
        tomada:    Boolean(a.tomada   ?? (Number(a.presentes||0)+Number(a.ausentes||0))>0),
      })));
    } catch { /* silent */ }
    setLoadingAH(false);
  };

  const cargarSuscripcion = async () => {
    setLoadingSusc(true);
    try { const r = await api.get('/api/empresa/suscripcion'); setSuscripcion(serializarFirestore(r.data)); }
    catch { /* silent */ }
    setLoadingSusc(false);
  };

  useEffect(() => { cargarUsuarios(); cargarFiscal(); }, []);
  useEffect(() => { if (tab === 'salud')       cargarSalud();       }, [tab]);
  useEffect(() => { if (tab === 'asistencia')  cargarAsistHoy();    }, [tab]);
  useEffect(() => { if (tab === 'suscripcion') cargarSuscripcion(); }, [tab]);

  /* ── Usuarios ─────────────────────────────────────────────────────── */
  const setUF = (k: keyof UserForm) =>
    (ev: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setUserForm(f => ({ ...f, [k]: ev.target.value }));

  const abrirNuevo = () => { setUserForm(EMPTY_USER); setMsgU(null); setShowModal(true); };

  const abrirEdicion = (u: Usuario) => {
    setUserForm({ id: u.id, nombre: u.nombre, email: u.email, rol: u.rol,
      vehiculo: u.vehiculo, clave: '', activo: u.activo });
    setMsgU(null); setShowModal(true);
  };

  const cerrarModal = () => { setShowModal(false); setMsgU(null); };

  const guardarUsuario = async () => {
    if (!userForm.nombre || !userForm.email) {
      setMsgU({ text: 'Nombre y email son obligatorios', ok: false }); return;
    }
    const emailInput = document.createElement('input');
    emailInput.type = 'email';
    emailInput.value = userForm.email;
    if (!emailInput.validity.valid) {
      setMsgU({ text: 'El email no tiene un formato válido', ok: false }); return;
    }
    setSavingU(true); setMsgU(null);
    try {
      const payload: Record<string, unknown> = {
        nombre: userForm.nombre, email: userForm.email,
        rol: userForm.rol, vehiculo: userForm.vehiculo, activo: userForm.activo,
      };
      if (userForm.id) {
        await api.put(`/api/usuarios/${userForm.id}`, payload);
      } else {
        await api.post('/api/usuarios', { ...payload, password: userForm.clave });
      }
      cerrarModal(); cargarUsuarios();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje;
      setMsgU({ text: msg || 'Error al guardar usuario', ok: false });
    }
    setSavingU(false);
  };

  const eliminarUsuario = async (id: string) => {
    try { await api.delete(`/api/usuarios/${id}`); setConfirmDel(null); cargarUsuarios(); }
    catch { /* silent */ }
  };

  const toggleActivo = async (u: Usuario, ev: React.MouseEvent) => {
    ev.stopPropagation();
    setTogglingId(u.id);
    try {
      await api.put(`/api/usuarios/${u.id}`, { activo: !u.activo });
      cargarUsuarios();
    } catch { /* silent */ }
    setTogglingId(null);
  };

  /* ── Fiscal ───────────────────────────────────────────────────────── */
  const setFF = (k: keyof FiscalForm) =>
    (ev: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setFiscal(f => ({ ...f, [k]: ev.target.value }));

  const guardarFiscal = async () => {
    setSavingF(true); setMsgF(null);
    try {
      await api.put('/api/empresa/fiscal', fiscal);
      setMsgF({ text: '✓ Datos guardados', ok: true });
    } catch { setMsgF({ text: 'Error al guardar', ok: false }); }
    setSavingF(false);
  };

  /* ─── Render ──────────────────────────────────────────────────────── */
  return (
    <div>
      {/* Header */}
      <div className="section-header" style={{ marginBottom: '1rem' }}>
        <h2 className="section-title">⚙️ Administrador</h2>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '.35rem', flexWrap: 'wrap', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '.75rem' }}>
        {([
          { key: 'usuarios',    label: '👥 Usuarios' },
          { key: 'fiscal',      label: '🏢 Datos Fiscales' },
          { key: 'salud',       label: '🩺 Salud' },
          { key: 'asistencia',  label: '✅ Asistencia hoy' },
          { key: 'suscripcion', label: '💳 Suscripción' },
        ] as { key: Tab; label: string }[]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={tab === t.key ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{ fontSize: '.82rem' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══ Tab Usuarios ══════════════════════════════════════════════ */}
      {tab === 'usuarios' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
            <button className="btn btn-primary" onClick={abrirNuevo}>+ Nuevo usuario</button>
          </div>

          {loadingU ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', color: 'var(--text3)', padding: '2rem 0' }}>
              <span className="spinner" /> Cargando usuarios…
            </div>
          ) : usuarios.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">👥</div><p>Sin usuarios</p></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
              {usuarios.map(u => {
                const esSelf = u.id === currentUid || u.email === getAuth().currentUser?.email;
                return (
                  <div key={u.id} className="card"
                    style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '.75rem 1rem',
                      cursor: 'pointer', opacity: u.activo ? 1 : .55 }}
                    onClick={() => abrirEdicion(u)}>

                    {/* Avatar */}
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                      background: 'var(--bg4)', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: '.9rem', fontWeight: 700, color: 'var(--text)',
                    }}>
                      {(u.nombre || u.email || '?')[0].toUpperCase()}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '.88rem', fontWeight: 600, color: 'var(--text)' }}>{u.nombre || '—'}</span>
                        <span className={`badge ${BADGE_ROL[u.rol] || 'badge-gray'}`}>{u.rol}</span>
                        {esSelf && <span className="badge badge-teal">Vos</span>}
                        {!u.activo && <span className="badge badge-gray">Inactivo</span>}
                      </div>
                      <p style={{ fontSize: '.78rem', color: 'var(--text3)', marginTop: '.1rem' }}>
                        {u.email}
                        {u.vehiculo && ` · ${u.vehiculo}`}
                      </p>
                    </div>

                    {/* Toggle activo */}
                    <button
                      title={u.activo ? 'Desactivar' : 'Activar'}
                      onClick={ev => toggleActivo(u, ev)}
                      disabled={!!togglingId}
                      style={{
                        width: '40px', height: '22px', borderRadius: '11px', border: 'none',
                        cursor: 'pointer', flexShrink: 0, transition: 'background .2s',
                        background: u.activo ? 'var(--green)' : 'var(--bg4)',
                        position: 'relative',
                      }}>
                      <span style={{
                        position: 'absolute', top: '3px',
                        left: u.activo ? '21px' : '3px',
                        width: '16px', height: '16px', borderRadius: '50%',
                        background: '#fff', transition: 'left .2s',
                      }} />
                    </button>

                    {/* Eliminar */}
                    <div onClick={ev => ev.stopPropagation()}>
                      {confirmDel === u.id ? (
                        <div style={{ display: 'flex', gap: '.3rem' }}>
                          <button className="btn btn-danger" style={{ fontSize: '.72rem', padding: '.3rem .6rem' }}
                            onClick={() => eliminarUsuario(u.id)}>Confirmar</button>
                          <button className="btn btn-secondary" style={{ fontSize: '.72rem', padding: '.3rem .6rem' }}
                            onClick={() => setConfirmDel(null)}>✕</button>
                        </div>
                      ) : (
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: '.72rem', padding: '.3rem .6rem',
                            opacity: esSelf ? .35 : 1, cursor: esSelf ? 'not-allowed' : 'pointer' }}
                          disabled={esSelf}
                          title={esSelf ? 'No podés eliminar tu propio usuario' : 'Eliminar'}
                          onClick={() => setConfirmDel(u.id)}>
                          🗑
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Modal crear/editar usuario */}
          {showModal && (
            <div
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}
              onClick={e => { if (e.target === e.currentTarget) cerrarModal(); }}>
              <div className="card" style={{ width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', marginBottom: '1.25rem' }}>
                  {userForm.id ? '✏️ Editar usuario' : '+ Nuevo usuario'}
                </h3>
                <div className="form-grid">
                  <div>
                    <label style={labelStyle}>Nombre *</label>
                    <input className="input" placeholder="Nombre completo" value={userForm.nombre} onChange={setUF('nombre')} />
                  </div>
                  <div>
                    <label style={labelStyle}>Email *</label>
                    <input type="email" className="input" placeholder="usuario@mail.com"
                      value={userForm.email} onChange={setUF('email')}
                      readOnly={!!userForm.id}
                      style={userForm.id ? { opacity: .6, cursor: 'not-allowed' } : {}} />
                  </div>
                  <div className="form-grid form-grid-2">
                    <div>
                      <label style={labelStyle}>Rol</label>
                      <select className="select" value={userForm.rol} onChange={setUF('rol')}>
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Vehículo</label>
                      <input className="input" placeholder="Ej: AA123BB" value={userForm.vehiculo} onChange={setUF('vehiculo')} />
                    </div>
                  </div>
                  {!userForm.id && (
                    <div>
                      <label style={labelStyle}>Contraseña inicial</label>
                      <input type="password" className="input" placeholder="Mínimo 6 caracteres"
                        value={userForm.clave} onChange={setUF('clave')} />
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
                    <label style={{ ...labelStyle, marginBottom: 0 }}>Activo</label>
                    <button
                      type="button"
                      onClick={() => setUserForm(f => ({ ...f, activo: !f.activo }))}
                      style={{
                        width: '40px', height: '22px', borderRadius: '11px', border: 'none',
                        cursor: 'pointer', transition: 'background .2s', flexShrink: 0,
                        background: userForm.activo ? 'var(--green)' : 'var(--bg4)',
                        position: 'relative',
                      }}>
                      <span style={{
                        position: 'absolute', top: '3px',
                        left: userForm.activo ? '21px' : '3px',
                        width: '16px', height: '16px', borderRadius: '50%',
                        background: '#fff', transition: 'left .2s',
                      }} />
                    </button>
                    <span style={{ fontSize: '.78rem', color: 'var(--text3)' }}>
                      {userForm.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                </div>
                {msgU && (
                  <p style={{ fontSize: '.82rem', color: msgU.ok ? 'var(--green)' : 'var(--red)', marginTop: '.75rem' }}>
                    {msgU.text}
                  </p>
                )}
                <div style={{ display: 'flex', gap: '.75rem', marginTop: '1.25rem' }}>
                  <button className="btn btn-secondary" style={{ flex: 1 }} onClick={cerrarModal}>Cancelar</button>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={guardarUsuario} disabled={savingU}>
                    {savingU
                      ? <><span className="spinner" style={{ width: '12px', height: '12px', borderWidth: '2px' }} /> Guardando…</>
                      : userForm.id ? 'Actualizar' : 'Crear usuario'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ══ Tab Datos Fiscales ════════════════════════════════════════ */}
      {tab === 'fiscal' && (
        <div className="card" style={{ padding: '1.5rem', maxWidth: '560px' }}>
          <h3 style={{ fontSize: '.95rem', fontWeight: 700, color: 'var(--text)', marginBottom: '1.25rem' }}>
            🏢 Datos Fiscales de la Empresa
          </h3>

          {loadingF ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', color: 'var(--text3)' }}>
              <span className="spinner" /> Cargando…
            </div>
          ) : (
            <div className="form-grid">
              <div>
                <label style={labelStyle}>Razón Social</label>
                <input className="input" placeholder="Ej: Transit S.A." value={fiscal.razonSocial} onChange={setFF('razonSocial')} />
              </div>

              <div className="form-grid form-grid-2">
                <div>
                  <label style={labelStyle}>CUIT</label>
                  <input className="input" placeholder="30-12345678-9" value={fiscal.cuit} onChange={setFF('cuit')} />
                </div>
                <div>
                  <label style={labelStyle}>Condición IVA</label>
                  <select className="select" value={fiscal.condicionIVA} onChange={setFF('condicionIVA')}>
                    <option value="">— Seleccioná —</option>
                    {CONDICIONES_IVA.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Domicilio Fiscal</label>
                <input className="input" placeholder="Calle 123, Ciudad" value={fiscal.domicilio} onChange={setFF('domicilio')} />
              </div>

              <div className="form-grid form-grid-2">
                <div>
                  <label style={labelStyle}>Punto de Venta Default</label>
                  <input type="number" className="input" placeholder="1" value={fiscal.puntoVentaDefault} onChange={setFF('puntoVentaDefault')} />
                </div>
                <div>
                  <label style={labelStyle}>N° IIBB</label>
                  <input className="input" placeholder="000-000000-0" value={fiscal.iibb} onChange={setFF('iibb')} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Inicio de Actividades</label>
                <input type="date" className="input" value={fiscal.inicioActividades} onChange={setFF('inicioActividades')} />
              </div>

              {msgF && (
                <p style={{ fontSize: '.82rem', color: msgF.ok ? 'var(--green)' : 'var(--red)' }}>
                  {msgF.text}
                </p>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-primary" onClick={guardarFiscal} disabled={savingF}>
                  {savingF
                    ? <><span className="spinner" style={{ width: '12px', height: '12px', borderWidth: '2px' }} /> Guardando…</>
                    : 'Guardar datos fiscales'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ Tab Salud del Sistema ══════════════════════════════════════ */}
      {tab === 'salud' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>

          {/* Backup destacado */}
          <div className="card" style={{ padding:'1.25rem', border:'1px solid rgba(47,129,247,0.35)' }}>
            <p style={{ fontWeight:700, color:'var(--text)', marginBottom:'.5rem' }}>☁ Backup de la planilla</p>
            <p style={{ fontSize:'.82rem', color:'var(--text3)', marginBottom:'.75rem', lineHeight:1.6 }}>
              Copia de seguridad completa. El backup automático se activa con el trigger semanal.
            </p>
            {backupMsg && (
              <p style={{ fontSize:'.78rem', color: backupMsg.startsWith('✓')?'var(--green)':'var(--red)', marginBottom:'.5rem' }}>
                {backupMsg}
              </p>
            )}
            <div style={{ display:'flex', gap:'.5rem', flexWrap:'wrap' }}>
              <button className="btn btn-primary" style={{ fontSize:'.82rem' }} onClick={ejecutarBackup} disabled={backingUp}>
                {backingUp ? <><span className="spinner" style={{width:10,height:10}}/> Ejecutando…</> : '☁ Hacer backup ahora'}
              </button>
              <button className="btn btn-secondary" style={{ fontSize:'.82rem' }} onClick={cargarSalud} disabled={loadingSalud}>
                ↻ Actualizar
              </button>
            </div>
          </div>

          {loadingSalud ? (
            <div style={{display:'flex',alignItems:'center',gap:'.75rem',color:'var(--text3)',padding:'2rem'}}><span className="spinner"/> Cargando…</div>
          ) : salud && (
            <>
              {/* Stats: colecciones + registros */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
                <div className="stat-card">
                  <p className="stat-label">Colecciones</p>
                  <p className="stat-value" style={{ color:'var(--blue)', fontSize:'1.8rem' }}>
                    {Number(salud.hojas || 0)}
                  </p>
                  <p className="stat-sub">en el sistema</p>
                </div>
                <div className="stat-card">
                  <p className="stat-label">Registros</p>
                  <p className="stat-value" style={{ color:'var(--green)', fontSize:'1.8rem' }}>
                    {Number(salud.registros || 0).toLocaleString('es-AR')}
                  </p>
                  <p className="stat-sub">total documentos</p>
                </div>
              </div>

              {/* Triggers */}
              {salud.triggers && (() => {
                const t = salud.triggers as Record<string,boolean>;
                const tick = (v: boolean) => v ? '✅' : '❌';
                return (
                  <div className="card" style={{ padding:'1.25rem' }}>
                    <p style={{ fontWeight:700, color:'var(--text)', marginBottom:'.85rem' }}>⚡ Triggers automáticos</p>
                    <div style={{ display:'grid', gap:'.5rem', fontSize:'.85rem', color:'var(--text)' }}>
                      <div>{tick(t.backup)} &nbsp; Backup semanal (domingos 3:00 AM)</div>
                      <div>{tick(t.cierre)} &nbsp; Cierre de día (lun-vie 20:00)</div>
                      <div>{tick(t.renovacion)} &nbsp; Renovación de mes (día 1 de cada mes)</div>
                      <div>{tick(t.vencimientos)} &nbsp; Vencimiento de documentos (lunes 8:00)</div>
                      <div>{tick(t.resumen)} &nbsp; Resumen mensual (día 1 de cada mes 8:00)</div>
                    </div>
                    <div style={{ display:'flex', gap:'.5rem', marginTop:'1rem' }}>
                      <button className="btn btn-secondary" style={{ fontSize:'.82rem' }}
                        onClick={instalarTodosLosTriggers} disabled={instalandoTodos}>
                        {instalandoTodos ? <><span className="spinner" style={{width:10,height:10}}/> …</> : '⚡ Instalar todos los triggers'}
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Estado */}
              <div className="card" style={{ padding:'1.25rem' }}>
                <p style={{ fontWeight:700, color:'var(--text)', marginBottom:'.85rem' }}>📊 Estado</p>
                <div style={{ display:'grid', gap:'.5rem', fontSize:'.85rem', color:'var(--text3)' }}>
                  <div><strong style={{ color:'var(--text)' }}>Último backup:</strong> {String(salud.ultimoBackup || '—')}</div>
                  <div><strong style={{ color:'var(--text)' }}>Última ubicación GPS:</strong> {String(salud.ultimaUbicacion || '—')}</div>
                  <div><strong style={{ color:'var(--text)' }}>Consultado:</strong> {String(salud.fechaConsulta || '—')}</div>
                </div>
                {!!(salud.colecciones) && (
                  <div style={{ marginTop:'1rem' }}>
                    <p style={{ fontSize:'.72rem', fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:'.5rem' }}>
                      Colecciones
                    </p>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:'.5rem' }}>
                      {Object.entries(salud.colecciones as Record<string,number>).map(([c, count]) => (
                        <div key={c} style={{ display:'flex', justifyContent:'space-between', fontSize:'.82rem',
                          padding:'.35rem .6rem', background:'var(--bg4)', borderRadius:'var(--radius)' }}>
                          <span style={{ color:'var(--text3)' }}>{c}</span>
                          <span style={{ fontWeight:600, color:'var(--blue)' }}>{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{ display:'flex', gap:'.5rem', marginTop:'1rem' }}>
                  <button className="btn btn-secondary" style={{ fontSize:'.82rem' }} onClick={ejecutarBackup} disabled={backingUp}>
                    {backingUp ? <><span className="spinner" style={{width:10,height:10}}/> …</> : '⬆ Backup ahora'}
                  </button>
                  <button className="btn btn-secondary" style={{ fontSize:'.82rem' }}
                    onClick={instalarTodosLosTriggers} disabled={instalandoTodos}>
                    {instalandoTodos ? <><span className="spinner" style={{width:10,height:10}}/> …</> : '⚡ Instalar todos'}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Email de notificaciones */}
          <div className="card" style={{ padding:'1.25rem' }}>
            <p style={{ fontWeight:700, color:'var(--text)', marginBottom:'.4rem' }}>📧 Email de notificaciones</p>
            <p style={{ fontSize:'.82rem', color:'var(--text3)', marginBottom:'.75rem' }}>
              Email donde recibís alertas de asistencia, vencimientos y gastos elevados.
            </p>
            <div style={{ display:'flex', gap:'.5rem', alignItems:'center' }}>
              <input type="email" className="input" style={{ flex:1 }} placeholder="admin@ejemplo.com"
                value={notifEmail} onChange={e => setNotifEmail(e.target.value)} />
              <button className="btn btn-primary" style={{ fontSize:'.82rem', whiteSpace:'nowrap' }}
                onClick={guardarNotifEmail} disabled={savingNotifEmail}>
                {savingNotifEmail ? <span className="spinner" style={{width:10,height:10}}/> : 'Guardar'}
              </button>
            </div>
            {msgNotifEmail && (
              <p style={{ fontSize:'.78rem', color: msgNotifEmail.startsWith('✓')?'var(--green)':'var(--red)', marginTop:'.4rem' }}>
                {msgNotifEmail}
              </p>
            )}
          </div>

        </div>
      )}

      {/* ══ Tab Asistencia Hoy ════════════════════════════════════════ */}
      {tab === 'asistencia' && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.25rem' }}>
            <p style={{ fontSize:'.85rem', color:'var(--text3)' }}>Resumen de asistencia tomada hoy.</p>
            <button className="btn btn-secondary" onClick={cargarAsistHoy} disabled={loadingAH}>↻</button>
          </div>

          {(() => {
            const dow = new Date().getDay();
            if (dow === 0 || dow === 6) return (
              <div className="card" style={{ textAlign:'center', padding:'3rem', color:'var(--text3)' }}>
                <p style={{ fontSize:'2rem', marginBottom:'.5rem' }}>🏖️</p>
                <p style={{ fontSize:'.95rem', fontWeight:600 }}>Fin de semana — sin asistencia</p>
              </div>
            );
            return loadingAH ? (
              <div style={{display:'flex',alignItems:'center',gap:'.75rem',color:'var(--text3)',padding:'2rem'}}><span className="spinner"/> Cargando…</div>
            ) : asistHoy.length === 0 ? (
              <div className="empty-state"><div className="empty-icon">✅</div><p>Sin datos de asistencia hoy</p></div>
            ) : (
              <div className="tabla-wrap">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Chofer</th>
                      <th style={{textAlign:'center'}}>Presentes</th>
                      <th style={{textAlign:'center'}}>Ausentes</th>
                      <th style={{textAlign:'center'}}>Pendientes</th>
                      <th style={{textAlign:'center'}}>Total</th>
                      <th style={{textAlign:'center'}}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {asistHoy.map(a => (
                      <tr key={a.chofer}>
                        <td style={{ fontWeight:500, color:'var(--text)' }}>{a.chofer || 'Sin asignar'}</td>
                        <td style={{ textAlign:'center', color:'var(--green)', fontWeight:600 }}>{a.presentes}</td>
                        <td style={{ textAlign:'center', color:'var(--red)' }}>{a.ausentes}</td>
                        <td style={{ textAlign:'center', color:'var(--amber)' }}>{a.pendientes}</td>
                        <td style={{ textAlign:'center' }}>{a.total}</td>
                        <td style={{ textAlign:'center' }}>
                          <span className={`badge ${a.tomada ? 'badge-green' : 'badge-red'}`}>
                            {a.tomada ? 'Tomó asistencia' : 'Sin registrar'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      )}

      {/* ══ Tab Suscripción ══════════════════════════════════════════ */}
      {tab === 'suscripcion' && (
        <div style={{ maxWidth: 520 }}>
          {loadingSusc ? (
            <div style={{display:'flex',alignItems:'center',gap:'.75rem',color:'var(--text3)',padding:'2rem'}}><span className="spinner"/> Cargando…</div>
          ) : !suscripcion ? (
            <div className="empty-state"><div className="empty-icon">💳</div><p>Sin datos de suscripción</p></div>
          ) : (
            <div>
              {/* Card principal */}
              <div className="card" style={{ padding:'1.5rem', marginBottom:'1rem' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1rem' }}>
                  <div>
                    <p style={{ fontSize:'.82rem', color:'var(--text3)', marginBottom:'.2rem' }}>Plan actual</p>
                    <p style={{ fontSize:'1.25rem', fontWeight:700, color:'var(--text)' }}>
                      {String(suscripcion.plan || suscripcion.nombre || 'Sin datos')}
                    </p>
                  </div>
                  {!!(suscripcion.estado) && (() => {
                    const est = String(suscripcion.estado);
                    return <span className={`badge ${est.toLowerCase()==='activa'?'badge-green':est.toLowerCase()==='vencida'?'badge-red':'badge-amber'}`}>{est}</span>;
                  })()}
                </div>
                <div style={{ display:'grid', gap:'.5rem' }}>
                  {[
                    ['Vencimiento',        String(suscripcion.fechaVencimiento    || '')],
                    ['Choferes máx.',      String(suscripcion.limiteChoferes     || '')],
                    ['Beneficiarios máx.', String(suscripcion.limiteBeneficiarios|| '')],
                    ['Tenant ID',          String(suscripcion.tenantId           || '')],
                  ].filter(([,v]) => v).map(([l,v]) => (
                    <div key={String(l)} style={{ display:'flex', justifyContent:'space-between', borderBottom:'1px solid var(--border)', paddingBottom:'.4rem' }}>
                      <span style={{ fontSize:'.85rem', color:'var(--text3)' }}>{l}</span>
                      <span style={{ fontSize:'.85rem', fontWeight:500, color:'var(--text)' }}>{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Alerta si vencida */}
              {String(suscripcion.estado ?? '').toLowerCase() === 'vencida' && (
                <div style={{ background:'var(--red-dim)', border:'1px solid rgba(239,68,68,.3)', borderRadius:'var(--radius)', padding:'1rem 1.25rem', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'1rem' }}>
                  <div>
                    <p style={{ fontWeight:600, color:'var(--red)' }}>⚠️ Suscripción vencida</p>
                    <p style={{ fontSize:'.82rem', color:'var(--text3)', marginTop:'.2rem' }}>Contactá al soporte para renovar.</p>
                  </div>
                  {!!(suscripcion.urlRenovar) && (
                    <a href={String(suscripcion.urlRenovar)} target="_blank" rel="noopener noreferrer" className="btn btn-danger" style={{ textDecoration:'none' }}>
                      Renovar
                    </a>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
