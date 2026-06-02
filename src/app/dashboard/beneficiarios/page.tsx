'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { serializarFirestore, toArray } from '@/lib/utils';

interface Beneficiario {
  id: string; nombre: string; dni: string; domicilio: string;
  localidad: string; obraSocial: string; nroAfiliado: string;
  chofer: string; lat?: string; lng?: string;
}

function normalizar(b: Record<string, unknown>): Beneficiario {
  return {
    id:          String(b.id          || ''),
    nombre:      String(b.nombre      || b['APELLIDO Y NOMBRE'] || b.NOMBRE      || ''),
    dni:         String(b.dni         || b.DNI         || b.DOCUMENTO   || ''),
    domicilio:   String(b.domicilio   || b.DOMICILIO   || b.direccion   || ''),
    localidad:   String(b.localidad   || b.LOCALIDAD   || ''),
    obraSocial:  String(b.obraSocial  || b['OBRA SOCIAL'] || b.OBRASOCIAL || ''),
    nroAfiliado: String(b.nroAfiliado || b['N° AFILIADO'] || b.nro_afiliado || ''),
    chofer:      String(b.chofer      || b.CHOFER      || ''),
    lat:         String(b.lat         || b.LAT         || ''),
    lng:         String(b.lng         || b.LNG         || b.lon || ''),
  };
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '.78rem', color: 'var(--text3)', marginBottom: '.3rem', fontWeight: 500,
};

const EMPTY = {
  id: '', nombre: '', dni: '', domicilio: '', localidad: '',
  obraSocial: '', nroAfiliado: '', chofer: '',
};

export default function BeneficiariosPage() {
  const [lista,         setLista]         = useState<Beneficiario[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [filtroBusq,    setFiltroBusq]    = useState('');
  const [filtroChofer,  setFiltroChofer]  = useState('');
  const [showModal,     setShowModal]     = useState(false);
  const [form,          setForm]          = useState(EMPTY);
  const [saving,        setSaving]        = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [msg,           setMsg]           = useState<{ text: string; ok: boolean } | null>(null);

  const cargar = async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/beneficiarios');
      setLista(toArray(r.data).map(serializarFirestore).map(normalizar));
    } catch { /* silent */ }
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);

  const choferes = [...new Set(lista.map(b => b.chofer).filter(Boolean))].sort();

  const filtrados = lista.filter(b => {
    const q = filtroBusq.toLowerCase();
    if (q && !b.nombre.toLowerCase().includes(q) && !b.dni.includes(q)) return false;
    if (filtroChofer && b.chofer !== filtroChofer) return false;
    return true;
  });

  const setF = (k: keyof typeof EMPTY) =>
    (ev: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [k]: ev.target.value }));

  const abrirNuevo = () => { setForm(EMPTY); setMsg(null); setShowModal(true); };
  const abrirEdicion = (b: Beneficiario) => {
    setForm({ id: b.id, nombre: b.nombre, dni: b.dni, domicilio: b.domicilio,
      localidad: b.localidad, obraSocial: b.obraSocial, nroAfiliado: b.nroAfiliado, chofer: b.chofer });
    setMsg(null); setShowModal(true);
  };
  const cerrarModal = () => { setShowModal(false); setMsg(null); };

  const guardar = async () => {
    if (!form.nombre) { setMsg({ text: 'El nombre es obligatorio', ok: false }); return; }
    setSaving(true); setMsg(null);
    try {
      if (form.id) {
        await api.put(`/api/beneficiarios/${form.id}`, form);
      } else {
        await api.post('/api/beneficiarios', form);
      }
      cerrarModal(); cargar();
    } catch { setMsg({ text: 'Error al guardar', ok: false }); }
    setSaving(false);
  };

  const eliminar = async (id: string) => {
    try { await api.delete(`/api/beneficiarios/${id}`); setConfirmDelete(null); cargar(); }
    catch { /* silent */ }
  };

  return (
    <div>
      <div className="section-header">
        <div>
          <h2 className="section-title">👥 Beneficiarios</h2>
          <p style={{ fontSize: '.82rem', color: 'var(--text3)', marginTop: '.2rem' }}>
            {filtrados.length} registro{filtrados.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button className="btn btn-primary" onClick={abrirNuevo}>+ Nuevo beneficiario</button>
      </div>

      <div className="filter-bar">
        <input className="input" placeholder="Buscar por nombre o DNI…"
          value={filtroBusq} onChange={e => setFiltroBusq(e.target.value)} />
        {choferes.length > 0 && (
          <select className="select" value={filtroChofer} onChange={e => setFiltroChofer(e.target.value)}>
            <option value="">Todos los choferes</option>
            {choferes.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        {(filtroBusq || filtroChofer) && (
          <button className="btn btn-secondary" style={{ fontSize: '.78rem' }}
            onClick={() => { setFiltroBusq(''); setFiltroChofer(''); }}>✕ Limpiar</button>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', color: 'var(--text3)', padding: '2rem 0' }}>
          <span className="spinner" /> Cargando beneficiarios…
        </div>
      ) : filtrados.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">👥</div>
          <p>Sin beneficiarios registrados</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
          {filtrados.map(b => (
            <div key={b.id} className="card"
              style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '.75rem 1rem', cursor: 'pointer' }}
              onClick={() => abrirEdicion(b)}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '.88rem', fontWeight: 600, color: 'var(--text)' }}>{b.nombre}</span>
                  {b.lat && b.lng
                    ? <span className="badge badge-green">📍 GPS</span>
                    : <span className="badge badge-gray">Sin GPS</span>}
                </div>
                <p style={{ fontSize: '.78rem', color: 'var(--text3)', marginTop: '.15rem' }}>
                  {b.dni && `DNI: ${b.dni}`}
                  {b.obraSocial && ` · ${b.obraSocial}`}
                  {b.chofer && ` · ${b.chofer}`}
                </p>
              </div>
              {confirmDelete === b.id ? (
                <div style={{ display: 'flex', gap: '.4rem' }} onClick={ev => ev.stopPropagation()}>
                  <button className="btn btn-danger" style={{ fontSize: '.75rem', padding: '.3rem .6rem' }}
                    onClick={() => eliminar(b.id)}>Confirmar</button>
                  <button className="btn btn-secondary" style={{ fontSize: '.75rem', padding: '.3rem .6rem' }}
                    onClick={() => setConfirmDelete(null)}>Cancelar</button>
                </div>
              ) : (
                <button className="btn btn-secondary" style={{ fontSize: '.75rem', padding: '.3rem .6rem' }}
                  onClick={ev => { ev.stopPropagation(); setConfirmDelete(b.id); }}>🗑</button>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}
          onClick={e => { if (e.target === e.currentTarget) cerrarModal(); }}>
          <div className="card" style={{ width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', marginBottom: '1.25rem' }}>
              {form.id ? '✏️ Editar beneficiario' : '+ Nuevo beneficiario'}
            </h3>
            <div className="form-grid">
              <div>
                <label style={labelStyle}>Nombre completo *</label>
                <input className="input" placeholder="Apellido y nombre" value={form.nombre} onChange={setF('nombre')} />
              </div>
              <div className="form-grid form-grid-2">
                <div>
                  <label style={labelStyle}>DNI</label>
                  <input className="input" placeholder="12345678" value={form.dni} onChange={setF('dni')} />
                </div>
                <div>
                  <label style={labelStyle}>N° Afiliado</label>
                  <input className="input" placeholder="00000000" value={form.nroAfiliado} onChange={setF('nroAfiliado')} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Domicilio</label>
                <input className="input" placeholder="Calle 123" value={form.domicilio} onChange={setF('domicilio')} />
              </div>
              <div className="form-grid form-grid-2">
                <div>
                  <label style={labelStyle}>Localidad</label>
                  <input className="input" placeholder="Ciudad" value={form.localidad} onChange={setF('localidad')} />
                </div>
                <div>
                  <label style={labelStyle}>Obra Social</label>
                  <input className="input" placeholder="Ej: IOMA" value={form.obraSocial} onChange={setF('obraSocial')} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Chofer asignado</label>
                {choferes.length > 0 ? (
                  <select className="select" value={form.chofer} onChange={setF('chofer')}>
                    <option value="">Sin asignar</option>
                    {choferes.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                ) : (
                  <input className="input" placeholder="Nombre del chofer" value={form.chofer} onChange={setF('chofer')} />
                )}
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
                  : form.id ? 'Actualizar' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
