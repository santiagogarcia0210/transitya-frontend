'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { serializarFirestore, toArray } from '@/lib/utils';
import { useEmpresaTipo } from '@/hooks/useEmpresaTipo';

const TIPOS     = ['Alta', 'Baja', 'Modificación'] as const;
const ESTADOS   = ['Pendiente', 'Presentado', 'Aprobado', 'Observado'] as const;
type Estado = typeof ESTADOS[number];

interface PresentacionDoc {
  id: string;
  tipo: string;
  beneficiario: string;
  fecha: string;
  organismo: string;
  nroExpediente: string;
  estado: Estado | string;
  observaciones: string;
}

interface FormState {
  id: string;
  tipo: string;
  beneficiario: string;
  fecha: string;
  organismo: string;
  nroExpediente: string;
  estado: string;
  observaciones: string;
}

function normalizar(r: Record<string, unknown>): PresentacionDoc {
  return {
    id:            String(r.id            || ''),
    tipo:          String(r.tipo          || r.TIPO     || r['TIPO DOC'] || 'Alta'),
    beneficiario:  String(r.beneficiario  || r['APELLIDO Y NOMBRE'] || r.nombre || r.NOMBRE || ''),
    fecha:         String(r.fecha         || r.FECHA    || ''),
    organismo:     String(r.organismo     || r.ORGANISMO || ''),
    nroExpediente: String(r.nroExpediente || r['NRO EXPEDIENTE'] || r.expediente || ''),
    estado:        String(r.estado        || r.ESTADO   || 'Pendiente'),
    observaciones: String(r.observaciones || r.OBSERVACIONES || ''),
  };
}

const BADGE_TIPO: Record<string, string> = {
  Alta: 'badge-green', Baja: 'badge-red', 'Modificación': 'badge-blue',
};
const BADGE_EST: Record<string, string> = {
  Pendiente: 'badge-gray', Presentado: 'badge-blue', Aprobado: 'badge-green', Observado: 'badge-amber',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '.78rem', color: 'var(--text3)', marginBottom: '.3rem', fontWeight: 500,
};

const EMPTY: FormState = {
  id: '', tipo: 'Alta', beneficiario: '', fecha: '',
  organismo: '', nroExpediente: '', estado: 'Pendiente', observaciones: '',
};

export default function PresentacionDocsPage() {
  const router = useRouter();
  const { tipo: empresaTipo, loading: tipoLoading } = useEmpresaTipo();

  const [lista,         setLista]         = useState<PresentacionDoc[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [filtroBusq,    setFiltroBusq]    = useState('');
  const [filtroTipo,    setFiltroTipo]    = useState('');
  const [filtroEstado,  setFiltroEstado]  = useState('');
  const [showModal,     setShowModal]     = useState(false);
  const [form,          setForm]          = useState<FormState>(EMPTY);
  const [saving,        setSaving]        = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [msg,           setMsg]           = useState<{ text: string; ok: boolean } | null>(null);

  /* Guard */
  useEffect(() => {
    if (!tipoLoading && empresaTipo !== null && empresaTipo !== 'transporte_escolar' && empresaTipo !== 'transporte_especial') {
      router.replace('/dashboard');
    }
  }, [empresaTipo, tipoLoading, router]);

  const cargar = async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/presentacion-docs');
      setLista(toArray(r.data).map(serializarFirestore).map(normalizar));
    } catch { /* silent */ }
    setLoading(false);
  };

  useEffect(() => {
    if (empresaTipo === 'transporte_escolar' || empresaTipo === 'transporte_especial') cargar();
  }, [empresaTipo]);

  const filtrados = lista.filter(r => {
    const q = filtroBusq.toLowerCase();
    if (q && !r.beneficiario.toLowerCase().includes(q) &&
             !r.organismo.toLowerCase().includes(q) &&
             !r.nroExpediente.includes(q)) return false;
    if (filtroTipo   && r.tipo   !== filtroTipo)   return false;
    if (filtroEstado && r.estado !== filtroEstado) return false;
    return true;
  });

  const setF = (k: keyof FormState) =>
    (ev: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: ev.target.value }));

  const abrirNuevo = () => {
    setForm({ ...EMPTY, fecha: new Date().toISOString().split('T')[0] });
    setMsg(null); setShowModal(true);
  };
  const abrirEdicion = (r: PresentacionDoc) => {
    setForm({ id: r.id, tipo: r.tipo, beneficiario: r.beneficiario, fecha: r.fecha,
      organismo: r.organismo, nroExpediente: r.nroExpediente,
      estado: r.estado, observaciones: r.observaciones });
    setMsg(null); setShowModal(true);
  };
  const cerrar = () => { setShowModal(false); setMsg(null); };

  const guardar = async () => {
    if (!form.beneficiario) { setMsg({ text: 'El beneficiario es obligatorio', ok: false }); return; }
    setSaving(true); setMsg(null);
    try {
      form.id ? await api.put(`/api/presentacion-docs/${form.id}`, form)
              : await api.post('/api/presentacion-docs', form);
      cerrar(); cargar();
    } catch { setMsg({ text: 'Error al guardar', ok: false }); }
    setSaving(false);
  };

  const eliminar = async (id: string) => {
    try { await api.delete(`/api/presentacion-docs/${id}`); setConfirmDelete(null); cargar(); }
    catch { /* silent */ }
  };

  if (tipoLoading) return <div style={{ padding: '2rem', color: 'var(--text3)' }}><span className="spinner" /> Verificando acceso…</div>;
  if (empresaTipo !== 'transporte_escolar' && empresaTipo !== 'transporte_especial') return null;

  const pendientes = lista.filter(r => r.estado === 'Pendiente').length;

  return (
    <div>
      <div className="section-header">
        <div>
          <h2 className="section-title">📁 Presentación Docs</h2>
          <p style={{ fontSize: '.82rem', color: 'var(--text3)', marginTop: '.2rem' }}>
            {filtrados.length} registro{filtrados.length !== 1 ? 's' : ''}
            {pendientes > 0 && <> · <span style={{ color: 'var(--amber)' }}>{pendientes} pendiente{pendientes !== 1 ? 's' : ''}</span></>}
          </p>
        </div>
        <button className="btn btn-primary" onClick={abrirNuevo}>+ Nuevo registro</button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
        {ESTADOS.map(s => (
          <div key={s} className="stat-card">
            <p className="stat-label">{s}</p>
            <p className="stat-value" style={{ color: { Pendiente: 'var(--text3)', Presentado: 'var(--blue)', Aprobado: 'var(--green)', Observado: 'var(--amber)' }[s] }}>
              {lista.filter(r => r.estado === s).length}
            </p>
          </div>
        ))}
      </div>

      <div className="filter-bar">
        <input className="input" placeholder="Buscar beneficiario, organismo o expediente…"
          value={filtroBusq} onChange={e => setFiltroBusq(e.target.value)} />
        <select className="select" value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
          <option value="">Todos los tipos</option>
          {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="select" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {(filtroBusq || filtroTipo || filtroEstado) && (
          <button className="btn btn-secondary" style={{ fontSize: '.78rem' }}
            onClick={() => { setFiltroBusq(''); setFiltroTipo(''); setFiltroEstado(''); }}>✕ Limpiar</button>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', color: 'var(--text3)', padding: '2rem' }}>
          <span className="spinner" /> Cargando…
        </div>
      ) : filtrados.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">📁</div><p>Sin registros de presentación</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
          {filtrados.map(r => (
            <div key={r.id} className="card"
              style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '.75rem 1rem', cursor: 'pointer' }}
              onClick={() => abrirEdicion(r)}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '.88rem', fontWeight: 600, color: 'var(--text)' }}>{r.beneficiario}</span>
                  <span className={`badge ${BADGE_TIPO[r.tipo] || 'badge-gray'}`}>{r.tipo}</span>
                  <span className={`badge ${BADGE_EST[r.estado] || 'badge-gray'}`}>{r.estado}</span>
                </div>
                <p style={{ fontSize: '.78rem', color: 'var(--text3)', marginTop: '.15rem' }}>
                  {r.fecha && `${r.fecha} · `}
                  {r.organismo && `${r.organismo}`}
                  {r.nroExpediente && ` · Exp: ${r.nroExpediente}`}
                </p>
              </div>
              {confirmDelete === r.id ? (
                <div style={{ display: 'flex', gap: '.4rem' }} onClick={ev => ev.stopPropagation()}>
                  <button className="btn btn-danger" style={{ fontSize: '.72rem', padding: '.3rem .6rem' }}
                    onClick={() => eliminar(r.id)}>Confirmar</button>
                  <button className="btn btn-secondary" style={{ fontSize: '.72rem', padding: '.3rem .6rem' }}
                    onClick={() => setConfirmDelete(null)}>✕</button>
                </div>
              ) : (
                <button className="btn btn-secondary" style={{ fontSize: '.72rem', padding: '.3rem .6rem' }}
                  onClick={ev => { ev.stopPropagation(); setConfirmDelete(r.id); }}>🗑</button>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}
          onClick={e => { if (e.target === e.currentTarget) cerrar(); }}>
          <div className="card" style={{ width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', marginBottom: '1.25rem' }}>
              {form.id ? '✏️ Editar registro' : '+ Nuevo registro'}
            </h3>
            <div className="form-grid">
              <div>
                <label style={labelStyle}>Beneficiario *</label>
                <input className="input" placeholder="Apellido y Nombre" value={form.beneficiario} onChange={setF('beneficiario')} />
              </div>
              <div className="form-grid form-grid-2">
                <div>
                  <label style={labelStyle}>Tipo</label>
                  <select className="select" value={form.tipo} onChange={setF('tipo')}>
                    {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Estado</label>
                  <select className="select" value={form.estado} onChange={setF('estado')}>
                    {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-grid form-grid-2">
                <div>
                  <label style={labelStyle}>Fecha</label>
                  <input type="date" className="input" value={form.fecha} onChange={setF('fecha')} />
                </div>
                <div>
                  <label style={labelStyle}>N° Expediente</label>
                  <input className="input" placeholder="EXP-00000/00" value={form.nroExpediente} onChange={setF('nroExpediente')} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Organismo</label>
                <input className="input" placeholder="Ej: ANDIS, IOMA, Ministerio…" value={form.organismo} onChange={setF('organismo')} />
              </div>
              <div>
                <label style={labelStyle}>Observaciones</label>
                <textarea className="textarea" rows={2} placeholder="Opcional…"
                  value={form.observaciones} onChange={setF('observaciones')} />
              </div>
            </div>
            {msg && <p style={{ fontSize: '.82rem', color: msg.ok ? 'var(--green)' : 'var(--red)', marginTop: '.75rem' }}>{msg.text}</p>}
            <div style={{ display: 'flex', gap: '.75rem', marginTop: '1.25rem' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={cerrar}>Cancelar</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={guardar} disabled={saving}>
                {saving ? <><span className="spinner" style={{ width: 12, height: 12 }} /> Guardando…</> : form.id ? 'Actualizar' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
