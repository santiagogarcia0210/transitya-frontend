'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { serializarFirestore, toArray } from '@/lib/utils';

/* ─── Tipos ─────────────────────────────────────────────────────────── */

interface Beneficiario {
  id: string;
  apellidoYNombre: string;
  dni: string;
  nroAfiliado: string;
  domicilio: string;
  localidad: string;
  nroContacto: string;
  obraSocial: string;
  prestador: string;
  codigoPrestador: string;
  kmIdaVuelta: number;
  viajesMensuales: number;
  kmMensuales: number;
  dependencia: string;
  observaciones: string;
  chofer: string;
  lat: string;
  lng: string;
  activo: boolean;
}

interface FormState {
  id: string;
  apellidoYNombre: string;
  dni: string;
  nroAfiliado: string;
  domicilio: string;
  localidad: string;
  nroContacto: string;
  obraSocial: string;
  prestador: string;
  codigoPrestador: string;
  kmIdaVuelta: string;
  viajesMensuales: string;
  kmMensuales: string;
  dependencia: string;
  observaciones: string;
  chofer: string;
}

function normalizar(b: Record<string, unknown>): Beneficiario {
  return {
    id:              String(b.id              || ''),
    apellidoYNombre: String(b.apellidoYNombre || b['APELLIDO Y NOMBRE'] || b.nombre || b.NOMBRE || ''),
    dni:             String(b.dni             || b.DNI             || b.DOCUMENTO          || ''),
    nroAfiliado:     String(b.nroAfiliado     || b['N° AFILIADO']  || b.nro_afiliado       || ''),
    domicilio:       String(b.domicilio       || b.DOMICILIO       || b.direccion          || ''),
    localidad:       String(b.localidad       || b.LOCALIDAD       || ''),
    nroContacto:     String(b.nroContacto     || b.NROCONTACTO     || b.telefono || b.TELEFONO || ''),
    obraSocial:      String(b.obraSocial      || b['OBRA SOCIAL']  || b.OBRASOCIAL         || ''),
    prestador:       String(b.prestador       || b.PRESTADOR       || ''),
    codigoPrestador: String(b.codigoPrestador || b['CODIGO PRESTADOR'] || b.CODIGOPRESTADOR || ''),
    kmIdaVuelta:     Number(b.kmIdaVuelta     || b.KMIDAVUELTA     || b['KM IDA VUELTA']   || 0),
    viajesMensuales: Number(b.viajesMensuales || b.VIAJESMENSUALES || b['VIAJES MENSUALES']|| 0),
    kmMensuales:     Number(b.kmMensuales     || b.KMMENSUALES     || b['KM MENSUALES']    || 0),
    dependencia:     String(b.dependencia     || b.DEPENDENCIA     || ''),
    observaciones:   String(b.observaciones   || b.OBSERVACIONES   || ''),
    chofer:          String(b.chofer          || b.CHOFER          || ''),
    lat:             String(b.lat             || b.LAT             || ''),
    lng:             String(b.lng             || b.LNG             || b.lon || b.LON || ''),
    activo:          b.activo !== false && b.ACTIVO !== false,
  };
}

const EMPTY: FormState = {
  id: '', apellidoYNombre: '', dni: '', nroAfiliado: '', domicilio: '', localidad: '',
  nroContacto: '', obraSocial: '', prestador: '', codigoPrestador: '',
  kmIdaVuelta: '', viajesMensuales: '', kmMensuales: '',
  dependencia: '', observaciones: '', chofer: '',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '.78rem', color: 'var(--text3)', marginBottom: '.3rem', fontWeight: 500,
};

/* ─── Componente ─────────────────────────────────────────────────────── */

export default function RegistroPage() {
  const [lista,         setLista]         = useState<Beneficiario[]>([]);
  const [choferesList,  setChoferesList]  = useState<string[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [filtroBusq,    setFiltroBusq]    = useState('');
  const [filtroChofer,  setFiltroChofer]  = useState('');
  const [showModal,     setShowModal]     = useState(false);
  const [form,          setForm]          = useState<FormState>(EMPTY);
  const [saving,        setSaving]        = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [bajaId,        setBajaId]        = useState<string | null>(null);
  const [bajaObs,       setBajaObs]       = useState('');
  const [bajaSaving,    setBajaSaving]    = useState(false);
  const [msg,           setMsg]           = useState<{ text: string; ok: boolean } | null>(null);

  /* ── Carga ────────────────────────────────────────────────────────── */
  const cargar = async () => {
    setLoading(true);
    try {
      const [regRes, choRes] = await Promise.all([
        api.get('/api/registro'),
        api.get('/api/usuarios').catch(() => ({ data: [] })),
      ]);
      setLista(toArray(regRes.data).map(serializarFirestore).map(normalizar));
      const chs = toArray(choRes.data)
        .map(serializarFirestore)
        .filter((u: Record<string, unknown>) => String(u.rol || '').toLowerCase() === 'chofer')
        .map((u: Record<string, unknown>) => String(u.nombre || u.NOMBRE || u.usuario || ''))
        .filter(Boolean)
        .sort() as string[];
      setChoferesList([...new Set(chs)]);
    } catch { /* silent */ }
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);

  /* ── Filtrado ─────────────────────────────────────────────────────── */
  const filtrados = lista.filter(b => {
    const q = filtroBusq.toLowerCase();
    if (q &&
      !b.apellidoYNombre.toLowerCase().includes(q) &&
      !b.dni.includes(q) &&
      !b.nroAfiliado.toLowerCase().includes(q)
    ) return false;
    if (filtroChofer && b.chofer !== filtroChofer) return false;
    return true;
  });

  /* Choferes presentes en la lista (para filtro), fusionado con los activos */
  const choferesEnLista = [...new Set(lista.map(b => b.chofer).filter(Boolean))].sort();
  const todosCh = [...new Set([...choferesList, ...choferesEnLista])].sort();

  /* ── Handlers form ────────────────────────────────────────────────── */
  const setF = (k: keyof FormState) =>
    (ev: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: ev.target.value }));

  const abrirNuevo = () => { setForm(EMPTY); setMsg(null); setShowModal(true); };

  const abrirEdicion = (b: Beneficiario) => {
    setForm({
      id: b.id,
      apellidoYNombre: b.apellidoYNombre,
      dni: b.dni,
      nroAfiliado: b.nroAfiliado,
      domicilio: b.domicilio,
      localidad: b.localidad,
      nroContacto: b.nroContacto,
      obraSocial: b.obraSocial,
      prestador: b.prestador,
      codigoPrestador: b.codigoPrestador,
      kmIdaVuelta: String(b.kmIdaVuelta || ''),
      viajesMensuales: String(b.viajesMensuales || ''),
      kmMensuales: String(b.kmMensuales || ''),
      dependencia: b.dependencia,
      observaciones: b.observaciones,
      chofer: b.chofer,
    });
    setMsg(null); setShowModal(true);
  };

  const cerrarModal = () => { setShowModal(false); setMsg(null); };

  const guardar = async () => {
    if (!form.apellidoYNombre.trim()) {
      setMsg({ text: 'El apellido y nombre es obligatorio', ok: false });
      return;
    }
    setSaving(true); setMsg(null);
    try {
      if (form.id) {
        await api.put(`/api/registro/${form.id}`, form);
      } else {
        await api.post('/api/registro', form);
      }
      cerrarModal(); cargar();
    } catch { setMsg({ text: 'Error al guardar', ok: false }); }
    setSaving(false);
  };

  const eliminar = async (id: string) => {
    try { await api.delete(`/api/registro/${id}`); setConfirmDelete(null); cargar(); }
    catch { /* silent */ }
  };

  /* ── Dar de baja ──────────────────────────────────────────────────── */
  const abrirBaja = (id: string, ev: React.MouseEvent) => {
    ev.stopPropagation();
    setBajaId(id); setBajaObs('');
  };

  const confirmarBaja = async () => {
    if (!bajaId) return;
    setBajaSaving(true);
    try {
      await api.post(`/api/registro/${bajaId}/baja`, { observaciones: bajaObs });
      setBajaId(null); cargar();
    } catch { /* silent — igual recargamos */ }
    setBajaSaving(false);
  };

  /* ─── Render ──────────────────────────────────────────────────────── */
  return (
    <div>
      {/* Header */}
      <div className="section-header">
        <div>
          <h2 className="section-title">📋 Registro</h2>
          <p style={{ fontSize: '.82rem', color: 'var(--text3)', marginTop: '.2rem' }}>
            {filtrados.length} beneficiario{filtrados.length !== 1 ? 's' : ''}
            {filtroChofer && ` · ${filtroChofer}`}
          </p>
        </div>
        <button className="btn btn-primary" onClick={abrirNuevo}>+ Nueva alta</button>
      </div>

      {/* Filtros */}
      <div className="filter-bar">
        <input className="input" placeholder="Buscar nombre, DNI o N° afiliado…"
          value={filtroBusq} onChange={e => setFiltroBusq(e.target.value)} />
        {todosCh.length > 0 && (
          <select className="select" value={filtroChofer} onChange={e => setFiltroChofer(e.target.value)}>
            <option value="">Todos los choferes</option>
            {todosCh.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        {(filtroBusq || filtroChofer) && (
          <button className="btn btn-secondary" style={{ fontSize: '.78rem' }}
            onClick={() => { setFiltroBusq(''); setFiltroChofer(''); }}>✕ Limpiar</button>
        )}
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', color: 'var(--text3)', padding: '2rem 0' }}>
          <span className="spinner" /> Cargando registros…
        </div>
      ) : filtrados.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <p>Sin beneficiarios registrados</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
          {filtrados.map(b => (
            <div key={b.id} className="card"
              style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '.75rem 1rem', cursor: 'pointer' }}
              onClick={() => abrirEdicion(b)}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Fila principal */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '.88rem', fontWeight: 600, color: 'var(--text)' }}>
                    {b.apellidoYNombre}
                  </span>
                  {b.lat && b.lng
                    ? <span className="badge badge-green">📍 GPS</span>
                    : <span className="badge badge-gray">Sin GPS</span>}
                  {!b.activo && <span className="badge badge-red">BAJA</span>}
                </div>
                {/* Fila secundaria */}
                <p style={{ fontSize: '.78rem', color: 'var(--text3)', marginTop: '.15rem' }}>
                  {b.dni       && `DNI: ${b.dni}`}
                  {b.nroAfiliado && ` · Afil: ${b.nroAfiliado}`}
                  {b.localidad && ` · ${b.localidad}`}
                  {b.obraSocial && ` · ${b.obraSocial}`}
                  {b.chofer    && ` · 🚗 ${b.chofer}`}
                </p>
              </div>

              {/* Acciones */}
              <div style={{ display: 'flex', gap: '.4rem', flexShrink: 0 }} onClick={ev => ev.stopPropagation()}>
                {b.activo && (
                  <button className="btn btn-danger" style={{ fontSize: '.72rem', padding: '.3rem .6rem' }}
                    onClick={ev => abrirBaja(b.id, ev)}>
                    Dar de baja
                  </button>
                )}
                {confirmDelete === b.id ? (
                  <>
                    <button className="btn btn-danger" style={{ fontSize: '.72rem', padding: '.3rem .6rem' }}
                      onClick={() => eliminar(b.id)}>Eliminar</button>
                    <button className="btn btn-secondary" style={{ fontSize: '.72rem', padding: '.3rem .6rem' }}
                      onClick={() => setConfirmDelete(null)}>✕</button>
                  </>
                ) : (
                  <button className="btn btn-secondary" style={{ fontSize: '.72rem', padding: '.3rem .6rem' }}
                    onClick={() => setConfirmDelete(b.id)}>🗑</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal CRUD ───────────────────────────────────────────────── */}
      {showModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}
          onClick={e => { if (e.target === e.currentTarget) cerrarModal(); }}>
          <div className="card" style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', marginBottom: '1.25rem' }}>
              {form.id ? '✏️ Editar beneficiario' : '+ Nueva alta'}
            </h3>

            <div className="form-grid">
              {/* Nombre */}
              <div>
                <label style={labelStyle}>Apellido y Nombre *</label>
                <input className="input" placeholder="Ej: García, Juan Carlos" value={form.apellidoYNombre} onChange={setF('apellidoYNombre')} />
              </div>

              {/* DNI + N° Afiliado */}
              <div className="form-grid form-grid-2">
                <div>
                  <label style={labelStyle}>DNI</label>
                  <input className="input" placeholder="12345678" value={form.dni} onChange={setF('dni')} />
                </div>
                <div>
                  <label style={labelStyle}>N° Afiliado</label>
                  <input className="input" placeholder="000000000" value={form.nroAfiliado} onChange={setF('nroAfiliado')} />
                </div>
              </div>

              {/* Domicilio + Localidad */}
              <div className="form-grid form-grid-2">
                <div>
                  <label style={labelStyle}>Domicilio</label>
                  <input className="input" placeholder="Calle 123" value={form.domicilio} onChange={setF('domicilio')} />
                </div>
                <div>
                  <label style={labelStyle}>Localidad</label>
                  <input className="input" placeholder="Ciudad" value={form.localidad} onChange={setF('localidad')} />
                </div>
              </div>

              {/* Contacto + Chofer */}
              <div className="form-grid form-grid-2">
                <div>
                  <label style={labelStyle}>N° Contacto</label>
                  <input className="input" placeholder="11-1234-5678" value={form.nroContacto} onChange={setF('nroContacto')} />
                </div>
                <div>
                  <label style={labelStyle}>Chofer asignado</label>
                  {todosCh.length > 0 ? (
                    <select className="select" value={form.chofer} onChange={setF('chofer')}>
                      <option value="">Sin asignar</option>
                      {todosCh.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  ) : (
                    <input className="input" placeholder="Nombre del chofer" value={form.chofer} onChange={setF('chofer')} />
                  )}
                </div>
              </div>

              {/* Obra Social + Prestador */}
              <div className="form-grid form-grid-2">
                <div>
                  <label style={labelStyle}>Obra Social</label>
                  <input className="input" placeholder="Ej: IOMA" value={form.obraSocial} onChange={setF('obraSocial')} />
                </div>
                <div>
                  <label style={labelStyle}>Prestador</label>
                  <input className="input" placeholder="Nombre del prestador" value={form.prestador} onChange={setF('prestador')} />
                </div>
              </div>

              {/* Código prestador + Dependencia */}
              <div className="form-grid form-grid-2">
                <div>
                  <label style={labelStyle}>Código Prestador</label>
                  <input className="input" placeholder="0000" value={form.codigoPrestador} onChange={setF('codigoPrestador')} />
                </div>
                <div>
                  <label style={labelStyle}>Dependencia</label>
                  <input className="input" placeholder="Ej: SAME, Hospital X" value={form.dependencia} onChange={setF('dependencia')} />
                </div>
              </div>

              {/* KM + Viajes */}
              <div className="form-grid form-grid-2" style={{ gridTemplateColumns: '1fr 1fr 1fr' } as React.CSSProperties}>
                <div>
                  <label style={labelStyle}>KM ida+vuelta</label>
                  <input type="number" className="input" placeholder="0" value={form.kmIdaVuelta} onChange={setF('kmIdaVuelta')} />
                </div>
                <div>
                  <label style={labelStyle}>Viajes / mes</label>
                  <input type="number" className="input" placeholder="0" value={form.viajesMensuales} onChange={setF('viajesMensuales')} />
                </div>
                <div>
                  <label style={labelStyle}>KM mensuales</label>
                  <input type="number" className="input" placeholder="0" value={form.kmMensuales} onChange={setF('kmMensuales')} />
                </div>
              </div>

              {/* Observaciones */}
              <div>
                <label style={labelStyle}>Observaciones</label>
                <textarea className="textarea" rows={2} placeholder="Opcional…"
                  value={form.observaciones} onChange={setF('observaciones')} />
              </div>
            </div>

            {msg && (
              <p style={{ fontSize: '.82rem', color: msg.ok ? 'var(--green)' : 'var(--red)', marginTop: '.75rem' }}>
                {msg.text}
              </p>
            )}

            <div style={{ display: 'flex', gap: '.75rem', marginTop: '1.25rem' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={cerrarModal}>Cancelar</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={guardar} disabled={saving}>
                {saving
                  ? <><span className="spinner" style={{ width: '12px', height: '12px', borderWidth: '2px' }} /> Guardando…</>
                  : form.id ? 'Actualizar' : 'Guardar alta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Dar de Baja ─────────────────────────────────────────── */}
      {bajaId && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: '1rem' }}
          onClick={e => { if (e.target === e.currentTarget) setBajaId(null); }}>
          <div className="card" style={{ width: '100%', maxWidth: '420px', padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--red)', marginBottom: '.5rem' }}>
              ⚠️ Dar de baja
            </h3>
            <p style={{ fontSize: '.84rem', color: 'var(--text3)', marginBottom: '1rem' }}>
              Esta acción marca al beneficiario como inactivo. Podés registrar el motivo:
            </p>
            <div>
              <label style={labelStyle}>Motivo / Observaciones</label>
              <textarea className="textarea" rows={3}
                placeholder="Ej: Alta médica, traslado, baja voluntaria…"
                value={bajaObs} onChange={e => setBajaObs(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: '.75rem', marginTop: '1.25rem' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setBajaId(null)}>Cancelar</button>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={confirmarBaja} disabled={bajaSaving}>
                {bajaSaving
                  ? <><span className="spinner" style={{ width: '12px', height: '12px', borderWidth: '2px' }} /> Procesando…</>
                  : 'Confirmar baja'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
