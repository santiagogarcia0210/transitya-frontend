'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { serializarFirestore, toArray } from '@/lib/utils';

interface Chofer {
  id: string; nombre: string; usuario: string; vehiculo: string;
  telefono: string; licencia: string; email: string;
}

function normalizar(u: Record<string, unknown>): Chofer {
  return {
    id:       String(u.id       || ''),
    nombre:   String(u.nombre   || u.NOMBRE   || u.usuario || ''),
    usuario:  String(u.usuario  || u.USUARIO  || ''),
    vehiculo: String(u.vehiculo || u.VEHICULO || ''),
    telefono: String(u.telefono || u.TELEFONO || u.tel     || ''),
    licencia: String(u.licencia || u.LICENCIA || ''),
    email:    String(u.email    || u.EMAIL    || ''),
  };
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '.78rem', color: 'var(--text3)', marginBottom: '.3rem', fontWeight: 500,
};

const EMPTY = { id: '', nombre: '', usuario: '', vehiculo: '', telefono: '', licencia: '', email: '' };

export default function ChoferesPage() {
  const [lista,         setLista]         = useState<Chofer[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [filtroBusq,    setFiltroBusq]    = useState('');
  const [showModal,     setShowModal]     = useState(false);
  const [form,          setForm]          = useState(EMPTY);
  const [saving,        setSaving]        = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [msg,           setMsg]           = useState<{ text: string; ok: boolean } | null>(null);

  const cargar = async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/usuarios');
      setLista(
        toArray(r.data).map(serializarFirestore)
          .filter((u: Record<string, unknown>) => String(u.rol || '').toLowerCase() === 'chofer')
          .map(normalizar)
      );
    } catch { /* silent */ }
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);

  const filtrados = lista.filter(c => {
    const q = filtroBusq.toLowerCase();
    return !q || c.nombre.toLowerCase().includes(q) || c.vehiculo.toLowerCase().includes(q);
  });

  const setF = (k: keyof typeof EMPTY) =>
    (ev: React.ChangeEvent<HTMLInputElement>) =>
      setForm(f => ({ ...f, [k]: ev.target.value }));

  const abrirNuevo = () => { setForm(EMPTY); setMsg(null); setShowModal(true); };
  const abrirEdicion = (c: Chofer) => {
    setForm({ id: c.id, nombre: c.nombre, usuario: c.usuario, vehiculo: c.vehiculo,
      telefono: c.telefono, licencia: c.licencia, email: c.email });
    setMsg(null); setShowModal(true);
  };
  const cerrarModal = () => { setShowModal(false); setMsg(null); };

  const guardar = async () => {
    if (!form.nombre) { setMsg({ text: 'El nombre es obligatorio', ok: false }); return; }
    setSaving(true); setMsg(null);
    try {
      if (form.id) {
        await api.put(`/api/usuarios/${form.id}`, form);
      } else {
        await api.post('/api/usuarios', { ...form, rol: 'chofer' });
      }
      cerrarModal(); cargar();
    } catch { setMsg({ text: 'Error al guardar', ok: false }); }
    setSaving(false);
  };

  const eliminar = async (id: string) => {
    try { await api.delete(`/api/usuarios/${id}`); setConfirmDelete(null); cargar(); }
    catch { /* silent */ }
  };

  return (
    <div>
      <div className="section-header">
        <div>
          <h2 className="section-title">🚗 Choferes</h2>
          <p style={{ fontSize: '.82rem', color: 'var(--text3)', marginTop: '.2rem' }}>
            {filtrados.length} chofer{filtrados.length !== 1 ? 'es' : ''}
          </p>
        </div>
        <button className="btn btn-primary" onClick={abrirNuevo}>+ Nuevo chofer</button>
      </div>

      <div className="filter-bar">
        <input className="input" placeholder="Buscar por nombre o vehículo…"
          value={filtroBusq} onChange={e => setFiltroBusq(e.target.value)} />
        {filtroBusq && (
          <button className="btn btn-secondary" style={{ fontSize: '.78rem' }}
            onClick={() => setFiltroBusq('')}>✕ Limpiar</button>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', color: 'var(--text3)', padding: '2rem 0' }}>
          <span className="spinner" /> Cargando choferes…
        </div>
      ) : filtrados.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🚗</div>
          <p>Sin choferes registrados</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
          {filtrados.map(c => (
            <div key={c.id} className="card"
              style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '.75rem 1rem', cursor: 'pointer' }}
              onClick={() => abrirEdicion(c)}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '.88rem', fontWeight: 600, color: 'var(--text)' }}>{c.nombre}</span>
                  <span className="badge badge-blue">Chofer</span>
                </div>
                <p style={{ fontSize: '.78rem', color: 'var(--text3)', marginTop: '.15rem' }}>
                  {c.vehiculo || 'Sin vehículo'}
                  {c.telefono && ` · ${c.telefono}`}
                  {c.licencia && ` · Lic: ${c.licencia}`}
                </p>
              </div>
              {confirmDelete === c.id ? (
                <div style={{ display: 'flex', gap: '.4rem' }} onClick={ev => ev.stopPropagation()}>
                  <button className="btn btn-danger" style={{ fontSize: '.75rem', padding: '.3rem .6rem' }}
                    onClick={() => eliminar(c.id)}>Confirmar</button>
                  <button className="btn btn-secondary" style={{ fontSize: '.75rem', padding: '.3rem .6rem' }}
                    onClick={() => setConfirmDelete(null)}>Cancelar</button>
                </div>
              ) : (
                <button className="btn btn-secondary" style={{ fontSize: '.75rem', padding: '.3rem .6rem' }}
                  onClick={ev => { ev.stopPropagation(); setConfirmDelete(c.id); }}>🗑</button>
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
          <div className="card" style={{ width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', marginBottom: '1.25rem' }}>
              {form.id ? '✏️ Editar chofer' : '+ Nuevo chofer'}
            </h3>
            <div className="form-grid">
              <div>
                <label style={labelStyle}>Nombre *</label>
                <input className="input" placeholder="Nombre completo" value={form.nombre} onChange={setF('nombre')} />
              </div>
              <div className="form-grid form-grid-2">
                <div>
                  <label style={labelStyle}>Usuario</label>
                  <input className="input" placeholder="usuario123" value={form.usuario} onChange={setF('usuario')} />
                </div>
                <div>
                  <label style={labelStyle}>Teléfono</label>
                  <input className="input" placeholder="Ej: 11-1234-5678" value={form.telefono} onChange={setF('telefono')} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Vehículo</label>
                <input className="input" placeholder="Ej: VW Crafter AA123BB" value={form.vehiculo} onChange={setF('vehiculo')} />
              </div>
              <div className="form-grid form-grid-2">
                <div>
                  <label style={labelStyle}>N° Licencia</label>
                  <input className="input" placeholder="Ej: 12345678" value={form.licencia} onChange={setF('licencia')} />
                </div>
                <div>
                  <label style={labelStyle}>Email</label>
                  <input type="email" className="input" placeholder="chofer@mail.com" value={form.email} onChange={setF('email')} />
                </div>
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
