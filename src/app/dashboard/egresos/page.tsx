'use client';
import { useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import { serializarFirestore, toArray } from '@/lib/utils';

const CATEGORIAS = ['Combustible', 'Repuesto', 'Mantenimiento', 'Seguro', 'Peaje', 'Otro'];
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const BADGE_CAT: Record<string, string> = {
  Combustible: 'badge-amber', Repuesto: 'badge-blue', Mantenimiento: 'badge-purple',
  Seguro: 'badge-teal', Peaje: 'badge-gray', Otro: 'badge-gray',
};

interface Egreso {
  id: string; fecha: string; concepto: string; monto: number;
  categoria: string; proveedor: string; chofer: string; observaciones: string; comprobante?: string;
}

interface FormState {
  id: string; fecha: string; concepto: string; monto: string;
  categoria: string; proveedor: string; chofer: string; observaciones: string;
}

const EMPTY: FormState = {
  id: '', fecha: '', concepto: '', monto: '', categoria: 'Combustible', proveedor: '', chofer: '', observaciones: '',
};

function normalizar(e: Record<string, unknown>): Egreso {
  return {
    id:           String(e.id || ''),
    fecha:        String(e.fecha        || e.FECHA        || ''),
    concepto:     String(e.concepto     || e.CONCEPTO     || ''),
    monto:        Number(e.monto        || e.MONTO        || 0),
    categoria:    String(e.categoria    || e.CATEGORIA    || 'Otro'),
    proveedor:    String(e.proveedor    || e.PROVEEDOR    || ''),
    chofer:       String(e.chofer       || e.CHOFER       || ''),
    observaciones:String(e.observaciones|| e.OBSERVACIONES|| ''),
    comprobante:  String(e.comprobante  || e.COMPROBANTE  || ''),
  };
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '.78rem', color: 'var(--text3)', marginBottom: '.3rem', fontWeight: 500,
};

const fmt = (n: number) =>
  n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

export default function EgresosPage() {
  const [lista,          setLista]          = useState<Egreso[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [filtroBusq,     setFiltroBusq]     = useState('');
  const [filtroCateg,    setFiltroCateg]    = useState('');
  const [filtroMes,      setFiltroMes]      = useState('');
  const [filtroChofer,   setFiltroChofer]   = useState('');
  const [showModal,      setShowModal]      = useState(false);
  const [form,           setForm]           = useState<FormState>(EMPTY);
  const [archivo,        setArchivo]        = useState<File | null>(null);
  const [previewUrl,     setPreviewUrl]     = useState('');
  const [saving,         setSaving]         = useState(false);
  const [scanning,       setScanning]       = useState(false);
  const [dupWarning,     setDupWarning]     = useState(false);
  const [confirmDelete,  setConfirmDelete]  = useState<string | null>(null);
  const [msg,            setMsg]            = useState<{ text: string; ok: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const hoy = new Date();
  const anioActual = hoy.getFullYear();

  const cargar = async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/egresos');
      setLista(toArray(r.data).map(serializarFirestore).map(normalizar));
    } catch { /* silent */ }
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);

  const choferes = [...new Set(lista.map(e => e.chofer).filter(Boolean))].sort();

  const filtrados = lista.filter(e => {
    const q = filtroBusq.toLowerCase();
    if (q && !e.concepto.toLowerCase().includes(q) && !e.proveedor.toLowerCase().includes(q)) return false;
    if (filtroCateg && e.categoria !== filtroCateg) return false;
    if (filtroChofer && e.chofer !== filtroChofer) return false;
    if (filtroMes) {
      const [mes, anio] = filtroMes.split('-');
      if (!e.fecha.includes(`/${mes}/${anio}`) && !e.fecha.startsWith(`${anio}-${mes}`)) return false;
    }
    return true;
  });

  const total = filtrados.reduce((s, e) => s + e.monto, 0);

  const setF = (k: keyof FormState) =>
    (ev: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: ev.target.value }));

  const abrirNuevo = () => {
    setForm(EMPTY); setArchivo(null); setPreviewUrl('');
    setDupWarning(false); setMsg(null); setShowModal(true);
  };

  const abrirEdicion = (e: Egreso) => {
    setForm({ id: e.id, fecha: e.fecha, concepto: e.concepto, monto: String(e.monto),
      categoria: e.categoria, proveedor: e.proveedor, chofer: e.chofer, observaciones: e.observaciones });
    setArchivo(null); setPreviewUrl(e.comprobante || '');
    setDupWarning(false); setMsg(null); setShowModal(true);
  };

  const cerrarModal = () => { setShowModal(false); setMsg(null); setDupWarning(false); };

  const onArchivo = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const f = ev.target.files?.[0] || null;
    setArchivo(f);
    setPreviewUrl(f ? URL.createObjectURL(f) : '');
  };

  const escanear = async () => {
    if (!archivo) { fileRef.current?.click(); return; }
    setScanning(true);
    try {
      const fd = new FormData();
      fd.append('comprobante', archivo);
      const r = await api.post('/api/egresos/escanear', fd);
      const d = r.data;
      setForm(f => ({
        ...f,
        fecha:     d.fecha     || d.FECHA     || f.fecha,
        concepto:  d.concepto  || d.CONCEPTO  || f.concepto,
        monto:     String(d.monto || d.MONTO  || f.monto),
        categoria: d.categoria || d.CATEGORIA || f.categoria,
        proveedor: d.proveedor || d.PROVEEDOR || f.proveedor,
      }));
    } catch {
      setMsg({ text: 'No se pudo escanear el comprobante', ok: false });
    }
    setScanning(false);
  };

  const guardar = async (forzar = false) => {
    if (!form.fecha || !form.concepto || !form.monto) {
      setMsg({ text: 'Completá fecha, concepto y monto', ok: false });
      return;
    }
    if (!forzar && !form.id) {
      try {
        const r = await api.get(`/api/egresos/duplicado?fecha=${encodeURIComponent(form.fecha)}&monto=${form.monto}`);
        if (r.data?.duplicado) { setDupWarning(true); return; }
      } catch { /* endpoint opcional */ }
    }
    setSaving(true); setMsg(null);
    try {
      let payload: FormData | Record<string, string>;
      if (archivo) {
        const fd = new FormData();
        (Object.entries(form) as [string, string][]).forEach(([k, v]) => fd.append(k, v));
        fd.append('comprobante', archivo);
        payload = fd;
      } else {
        payload = { ...form };
      }
      if (form.id) {
        await api.put(`/api/egresos/${form.id}`, payload);
      } else {
        await api.post('/api/egresos', payload);
      }
      cerrarModal();
      cargar();
    } catch { setMsg({ text: 'Error al guardar', ok: false }); }
    setSaving(false);
  };

  const eliminar = async (id: string) => {
    try { await api.delete(`/api/egresos/${id}`); setConfirmDelete(null); cargar(); }
    catch { /* silent */ }
  };

  const mesesFiltro = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(anioActual, hoy.getMonth() - i, 1);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const a = d.getFullYear();
    return { value: `${m}-${a}`, label: `${MESES[d.getMonth()]} ${a}` };
  });

  return (
    <div>
      {/* Header */}
      <div className="section-header">
        <div>
          <h2 className="section-title">💸 Egresos</h2>
          <p style={{ fontSize: '.82rem', color: 'var(--text3)', marginTop: '.2rem' }}>
            {filtrados.length} registro{filtrados.length !== 1 ? 's' : ''} ·{' '}
            <strong style={{ color: 'var(--red)' }}>{fmt(total)}</strong>
          </p>
        </div>
        <button className="btn btn-primary" onClick={abrirNuevo}>+ Nuevo egreso</button>
      </div>

      {/* Filtros */}
      <div className="filter-bar">
        <input className="input" placeholder="Buscar concepto o proveedor…"
          value={filtroBusq} onChange={e => setFiltroBusq(e.target.value)} />
        <select className="select" value={filtroCateg} onChange={e => setFiltroCateg(e.target.value)}>
          <option value="">Todas las categorías</option>
          {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {choferes.length > 0 && (
          <select className="select" value={filtroChofer} onChange={e => setFiltroChofer(e.target.value)}>
            <option value="">Todos los choferes</option>
            {choferes.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <select className="select" value={filtroMes} onChange={e => setFiltroMes(e.target.value)}>
          <option value="">Todos los meses</option>
          {mesesFiltro.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        {(filtroBusq || filtroCateg || filtroChofer || filtroMes) && (
          <button className="btn btn-secondary" style={{ fontSize: '.78rem' }}
            onClick={() => { setFiltroBusq(''); setFiltroCateg(''); setFiltroChofer(''); setFiltroMes(''); }}>
            ✕ Limpiar
          </button>
        )}
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', color: 'var(--text3)', padding: '2rem 0' }}>
          <span className="spinner" /> Cargando egresos…
        </div>
      ) : filtrados.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">💸</div>
          <p>Sin egresos registrados</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
          {filtrados.map(e => (
            <div key={e.id} className="card"
              style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '.75rem 1rem', cursor: 'pointer' }}
              onClick={() => abrirEdicion(e)}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '.88rem', fontWeight: 600, color: 'var(--text)' }}>{e.concepto}</span>
                  <span className={`badge ${BADGE_CAT[e.categoria] || 'badge-gray'}`}>{e.categoria}</span>
                </div>
                <p style={{ fontSize: '.78rem', color: 'var(--text3)', marginTop: '.15rem' }}>
                  {e.fecha}
                  {e.chofer && ` · ${e.chofer}`}
                  {e.proveedor && ` · ${e.proveedor}`}
                  {e.observaciones && ` · ${e.observaciones}`}
                </p>
              </div>
              <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--red)', whiteSpace: 'nowrap' }}>
                {fmt(e.monto)}
              </p>
              {confirmDelete === e.id ? (
                <div style={{ display: 'flex', gap: '.4rem' }} onClick={ev => ev.stopPropagation()}>
                  <button className="btn btn-danger" style={{ fontSize: '.75rem', padding: '.3rem .6rem' }}
                    onClick={() => eliminar(e.id)}>Confirmar</button>
                  <button className="btn btn-secondary" style={{ fontSize: '.75rem', padding: '.3rem .6rem' }}
                    onClick={() => setConfirmDelete(null)}>Cancelar</button>
                </div>
              ) : (
                <button className="btn btn-secondary" style={{ fontSize: '.75rem', padding: '.3rem .6rem' }}
                  onClick={ev => { ev.stopPropagation(); setConfirmDelete(e.id); }}>🗑</button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}
          onClick={e => { if (e.target === e.currentTarget) cerrarModal(); }}>
          <div className="card" style={{ width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', marginBottom: '1.25rem' }}>
              {form.id ? '✏️ Editar egreso' : '+ Nuevo egreso'}
            </h3>

            <div className="form-grid">
              <div className="form-grid form-grid-2">
                <div>
                  <label style={labelStyle}>Fecha *</label>
                  <input type="date" className="input" value={form.fecha} onChange={setF('fecha')} />
                </div>
                <div>
                  <label style={labelStyle}>Monto *</label>
                  <input type="number" className="input" placeholder="0" value={form.monto} onChange={setF('monto')} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Concepto *</label>
                <input type="text" className="input" placeholder="Ej: Nafta YPF" value={form.concepto} onChange={setF('concepto')} />
              </div>
              <div className="form-grid form-grid-2">
                <div>
                  <label style={labelStyle}>Categoría</label>
                  <select className="select" value={form.categoria} onChange={setF('categoria')}>
                    {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Proveedor</label>
                  <input type="text" className="input" placeholder="Ej: Shell" value={form.proveedor} onChange={setF('proveedor')} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Chofer</label>
                {choferes.length > 0 ? (
                  <select className="select" value={form.chofer} onChange={setF('chofer')}>
                    <option value="">Sin asignar</option>
                    {choferes.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                ) : (
                  <input type="text" className="input" placeholder="Nombre del chofer" value={form.chofer} onChange={setF('chofer')} />
                )}
              </div>
              <div>
                <label style={labelStyle}>Observaciones</label>
                <textarea className="textarea" rows={2} placeholder="Opcional…"
                  value={form.observaciones} onChange={setF('observaciones')} />
              </div>

              {/* Comprobante + Escanear IA */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '.4rem' }}>
                  <label style={labelStyle}>Comprobante</label>
                  <button type="button" className="btn btn-secondary"
                    style={{ fontSize: '.75rem', padding: '.25rem .6rem' }}
                    onClick={escanear} disabled={scanning}>
                    {scanning
                      ? <><span className="spinner" style={{ width: '10px', height: '10px', borderWidth: '2px' }} /> Escaneando…</>
                      : '🤖 Escanear con IA'}
                  </button>
                </div>
                <input ref={fileRef} type="file" accept="image/*,application/pdf"
                  style={{ display: 'none' }} onChange={onArchivo} />
                <div
                  style={{ border: '1.5px dashed var(--border2)', borderRadius: 'var(--radius)',
                    padding: '.75rem', textAlign: 'center', cursor: 'pointer',
                    color: 'var(--text3)', fontSize: '.82rem' }}
                  onClick={() => fileRef.current?.click()}>
                  {previewUrl
                    ? <img src={previewUrl} alt="comprobante"
                        style={{ maxHeight: '120px', maxWidth: '100%', borderRadius: 'var(--radius)', objectFit: 'contain' }} />
                    : '📎 Clic para adjuntar imagen o PDF'}
                </div>
                {archivo && (
                  <p style={{ fontSize: '.75rem', color: 'var(--text3)', marginTop: '.3rem' }}>{archivo.name}</p>
                )}
              </div>
            </div>

            {/* Advertencia duplicado */}
            {dupWarning && (
              <div style={{ background: 'var(--amber-dim)', border: '1px solid var(--amber)',
                borderRadius: 'var(--radius)', padding: '.75rem 1rem', marginTop: '1rem',
                fontSize: '.82rem', color: 'var(--amber)' }}>
                ⚠️ Ya existe un egreso con la misma fecha y monto. ¿Querés guardarlo igual?
                <div style={{ display: 'flex', gap: '.5rem', marginTop: '.5rem' }}>
                  <button className="btn btn-primary" style={{ fontSize: '.78rem', padding: '.3rem .75rem' }}
                    onClick={() => { setDupWarning(false); guardar(true); }}>Sí, guardar igual</button>
                  <button className="btn btn-secondary" style={{ fontSize: '.78rem', padding: '.3rem .75rem' }}
                    onClick={() => setDupWarning(false)}>Cancelar</button>
                </div>
              </div>
            )}

            {msg && (
              <p style={{ fontSize: '.82rem', color: msg.ok ? 'var(--green)' : 'var(--red)', marginTop: '.75rem' }}>
                {msg.text}
              </p>
            )}

            <div style={{ display: 'flex', gap: '.75rem', marginTop: '1.25rem' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={cerrarModal}>Cancelar</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => guardar(false)} disabled={saving}>
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
