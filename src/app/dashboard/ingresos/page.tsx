'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { serializarFirestore, toArray } from '@/lib/utils';

const ESTADOS = ['PRESENTADO', 'PAGADO'];
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

interface Ingreso {
  id: string; fecha: string; nroFactura: string; concepto: string;
  monto: number; obraSocial: string; estado: string; observaciones: string;
}

interface FormState {
  id: string; fecha: string; nroFactura: string; concepto: string;
  monto: string; obraSocial: string; estado: string; observaciones: string;
}

const EMPTY: FormState = {
  id: '', fecha: '', nroFactura: '', concepto: '',
  monto: '', obraSocial: '', estado: 'PRESENTADO', observaciones: '',
};

function normalizar(e: Record<string, unknown>): Ingreso {
  return {
    id:           String(e.id           || ''),
    fecha:        String(e.fecha        || e.FECHA        || ''),
    nroFactura:   String(e.nroFactura   || e.NROFACTURA   || e['NRO FACTURA'] || e.nro_factura || ''),
    concepto:     String(e.concepto     || e.CONCEPTO     || e.descripcion    || ''),
    monto:        Number(e.monto        || e.MONTO        || 0),
    obraSocial:   String(e.obraSocial   || e.OBRASOCIAL   || e['OBRA SOCIAL'] || ''),
    estado:       String(e.estado       || e.ESTADO       || 'PRESENTADO').toUpperCase(),
    observaciones:String(e.observaciones|| e.OBSERVACIONES|| ''),
  };
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '.78rem', color: 'var(--text3)', marginBottom: '.3rem', fontWeight: 500,
};

const fmt = (n: number) =>
  n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

function badgeEstado(estado: string) {
  return estado === 'PAGADO' ? 'badge-green' : 'badge-amber';
}

export default function IngresosPage() {
  const [lista,         setLista]         = useState<Ingreso[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [filtroBusq,    setFiltroBusq]    = useState('');
  const [filtroEstado,  setFiltroEstado]  = useState('');
  const [filtroMes,     setFiltroMes]     = useState('');
  const [showModal,     setShowModal]     = useState(false);
  const [form,          setForm]          = useState<FormState>(EMPTY);
  const [saving,        setSaving]        = useState(false);
  const [pagando,       setPagando]       = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [msg,           setMsg]           = useState<{ text: string; ok: boolean } | null>(null);

  const hoy = new Date();
  const anioActual = hoy.getFullYear();

  const cargar = async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/ingresos');
      setLista(toArray(r.data).map(serializarFirestore).map(normalizar));
    } catch { /* silent */ }
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);

  const filtrados = lista.filter(e => {
    const q = filtroBusq.toLowerCase();
    if (q && !e.concepto.toLowerCase().includes(q) && !e.obraSocial.toLowerCase().includes(q) && !e.nroFactura.toLowerCase().includes(q)) return false;
    if (filtroEstado && e.estado !== filtroEstado) return false;
    if (filtroMes) {
      const [mes, anio] = filtroMes.split('-');
      if (!e.fecha.includes(`/${mes}/${anio}`) && !e.fecha.startsWith(`${anio}-${mes}`)) return false;
    }
    return true;
  });

  const totalFiltrado  = filtrados.reduce((s, e) => s + e.monto, 0);
  const totalPagado    = filtrados.filter(e => e.estado === 'PAGADO').reduce((s, e) => s + e.monto, 0);
  const totalPresentado = filtrados.filter(e => e.estado === 'PRESENTADO').reduce((s, e) => s + e.monto, 0);

  const setF = (k: keyof FormState) =>
    (ev: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: ev.target.value }));

  const abrirNuevo = () => {
    setForm(EMPTY); setMsg(null); setShowModal(true);
  };

  const abrirEdicion = (e: Ingreso) => {
    setForm({ id: e.id, fecha: e.fecha, nroFactura: e.nroFactura, concepto: e.concepto,
      monto: String(e.monto), obraSocial: e.obraSocial, estado: e.estado, observaciones: e.observaciones });
    setMsg(null); setShowModal(true);
  };

  const cerrarModal = () => { setShowModal(false); setMsg(null); };

  const guardar = async () => {
    if (!form.fecha || !form.concepto || !form.monto) {
      setMsg({ text: 'Completá fecha, concepto y monto', ok: false });
      return;
    }
    setSaving(true); setMsg(null);
    try {
      if (form.id) {
        await api.put(`/api/ingresos/${form.id}`, form);
      } else {
        await api.post('/api/ingresos', form);
      }
      cerrarModal();
      cargar();
    } catch { setMsg({ text: 'Error al guardar', ok: false }); }
    setSaving(false);
  };

  const marcarPagado = async (id: string, ev: React.MouseEvent) => {
    ev.stopPropagation();
    setPagando(id);
    try {
      await api.patch(`/api/ingresos/${id}/pagar`);
      cargar();
    } catch { /* silent */ }
    setPagando(null);
  };

  const eliminar = async (id: string) => {
    try { await api.delete(`/api/ingresos/${id}`); setConfirmDelete(null); cargar(); }
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
          <h2 className="section-title">💰 Ingresos</h2>
          <p style={{ fontSize: '.82rem', color: 'var(--text3)', marginTop: '.2rem' }}>
            {filtrados.length} registro{filtrados.length !== 1 ? 's' : ''} ·{' '}
            <strong style={{ color: 'var(--green)' }}>{fmt(totalFiltrado)}</strong>
          </p>
        </div>
        <button className="btn btn-primary" onClick={abrirNuevo}>+ Nuevo ingreso</button>
      </div>

      {/* KPIs rápidos */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem', marginBottom: '1rem' }}>
        <div className="card" style={{ padding: '.85rem 1rem' }}>
          <p style={{ fontSize: '.75rem', color: 'var(--text3)' }}>Cobrado</p>
          <p style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--green)' }}>{fmt(totalPagado)}</p>
        </div>
        <div className="card" style={{ padding: '.85rem 1rem' }}>
          <p style={{ fontSize: '.75rem', color: 'var(--text3)' }}>Pendiente</p>
          <p style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--amber)' }}>{fmt(totalPresentado)}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="filter-bar">
        <input className="input" placeholder="Buscar concepto, obra social, factura…"
          value={filtroBusq} onChange={e => setFiltroBusq(e.target.value)} />
        <select className="select" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="select" value={filtroMes} onChange={e => setFiltroMes(e.target.value)}>
          <option value="">Todos los meses</option>
          {mesesFiltro.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        {(filtroBusq || filtroEstado || filtroMes) && (
          <button className="btn btn-secondary" style={{ fontSize: '.78rem' }}
            onClick={() => { setFiltroBusq(''); setFiltroEstado(''); setFiltroMes(''); }}>
            ✕ Limpiar
          </button>
        )}
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', color: 'var(--text3)', padding: '2rem 0' }}>
          <span className="spinner" /> Cargando ingresos…
        </div>
      ) : filtrados.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">💰</div>
          <p>Sin ingresos registrados</p>
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
                  <span className={`badge ${badgeEstado(e.estado)}`}>{e.estado}</span>
                </div>
                <p style={{ fontSize: '.78rem', color: 'var(--text3)', marginTop: '.15rem' }}>
                  {e.fecha}
                  {e.obraSocial && ` · ${e.obraSocial}`}
                  {e.nroFactura && ` · Fact. ${e.nroFactura}`}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--green)', whiteSpace: 'nowrap' }}>
                  {fmt(e.monto)}
                </p>
                {e.estado !== 'PAGADO' && e.id && (
                  <button className="btn btn-success" style={{ fontSize: '.72rem', padding: '.3rem .6rem', whiteSpace: 'nowrap' }}
                    disabled={pagando === e.id}
                    onClick={ev => marcarPagado(e.id, ev)}>
                    {pagando === e.id ? '…' : '✓ Cobrado'}
                  </button>
                )}
                {confirmDelete === e.id ? (
                  <div style={{ display: 'flex', gap: '.4rem' }} onClick={ev => ev.stopPropagation()}>
                    <button className="btn btn-danger" style={{ fontSize: '.72rem', padding: '.3rem .6rem' }}
                      onClick={() => eliminar(e.id)}>Confirmar</button>
                    <button className="btn btn-secondary" style={{ fontSize: '.72rem', padding: '.3rem .6rem' }}
                      onClick={() => setConfirmDelete(null)}>Cancelar</button>
                  </div>
                ) : (
                  <button className="btn btn-secondary" style={{ fontSize: '.72rem', padding: '.3rem .6rem' }}
                    onClick={ev => { ev.stopPropagation(); setConfirmDelete(e.id); }}>🗑</button>
                )}
              </div>
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
          <div className="card" style={{ width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', marginBottom: '1.25rem' }}>
              {form.id ? '✏️ Editar ingreso' : '+ Nuevo ingreso'}
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
                <input type="text" className="input" placeholder="Ej: Liquidación mayo" value={form.concepto} onChange={setF('concepto')} />
              </div>
              <div className="form-grid form-grid-2">
                <div>
                  <label style={labelStyle}>N° Factura</label>
                  <input type="text" className="input" placeholder="0001-00000001" value={form.nroFactura} onChange={setF('nroFactura')} />
                </div>
                <div>
                  <label style={labelStyle}>Estado</label>
                  <select className="select" value={form.estado} onChange={setF('estado')}>
                    {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Obra Social</label>
                <input type="text" className="input" placeholder="Ej: IOMA" value={form.obraSocial} onChange={setF('obraSocial')} />
              </div>
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
                  : form.id ? 'Actualizar' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
