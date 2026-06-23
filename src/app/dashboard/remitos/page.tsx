'use client';
import { useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import { serializarFirestore, toArray } from '@/lib/utils';
import Button from '@/components/ui/Button';

const TIPOS_COMB    = ['Nafta Super', 'Nafta Premium', 'Diesel', 'Gasoil', 'GNC', 'Otro'];
const MIMES_VALIDOS = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

const toBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

interface Remito {
  id: string; fecha: string; nroRemito: string; razonSocial: string;
  cuit: string; combustible: number; tipoCombustible: string;
  monto: number; chofer: string; observaciones: string; comprobante: string;
}

interface FormState {
  id: string; fecha: string; nroRemito: string; razonSocial: string;
  cuit: string; combustible: string; tipoCombustible: string;
  monto: string; chofer: string; observaciones: string;
}

function normalizar(e: Record<string, unknown>): Remito {
  return {
    id:             String(e.id             || ''),
    fecha:          String(e.fecha          || e.FECHA          || ''),
    nroRemito:      String(e.nroRemito      || e.NROREMITO      || e['NRO REMITO']      || e.nro_remito      || ''),
    razonSocial:    String(e.razonSocial    || e.RAZONSOCIAL    || e['RAZON SOCIAL']    || e.razon_social    || ''),
    cuit:           String(e.cuit           || e.CUIT           || ''),
    combustible:    Number(e.combustible    || e.COMBUSTIBLE    || e.litros             || e.LITROS          || 0),
    tipoCombustible:String(e.tipoCombustible|| e.TIPOCOMBUSTIBLE|| e['TIPO COMBUSTIBLE']|| e.tipo_combustible|| ''),
    monto:          Number(e.monto          || e.MONTO          || e.importe            || e.IMPORTE         || 0),
    chofer:         String(e.chofer         || e.CHOFER         || ''),
    observaciones:  String(e.observaciones  || e.OBSERVACIONES  || ''),
    comprobante:    String(e.comprobante    || e.COMPROBANTE    || ''),
  };
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '.78rem', color: 'var(--text3)', marginBottom: '.3rem', fontWeight: 500,
};

const fmt = (n: number) =>
  n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

const fechaISO = (v: string) => {
  if (!v) return '';
  const iso = v.includes('/') ? v.split('/').reverse().join('-') : v;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
};

const EMPTY: FormState = {
  id: '', fecha: '', nroRemito: '', razonSocial: '',
  cuit: '', combustible: '', tipoCombustible: '', monto: '', chofer: '', observaciones: '',
};

export default function RemitosPage() {
  const [tabActivo, setTabActivo] = useState<'lista'|'pdf'>('lista');

  /* Perfil (para saber si es admin) */
  const [esAdmin, setEsAdmin] = useState(false);
  const [miNombre, setMiNombre] = useState('');
  useEffect(() => {
    api.get('/api/usuarios/perfil').then(r => {
      const d = serializarFirestore(r.data);
      setEsAdmin(String(d.rol||'').toLowerCase() === 'admin');
      setMiNombre(String(d.nombre||d.usuario||''));
    }).catch(() => {});
  }, []);

  const [lista,         setLista]         = useState<Remito[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [filtroBusq,    setFiltroBusq]    = useState('');
  const [filtroDesde,   setFiltroDesde]   = useState('');
  const [filtroHasta,   setFiltroHasta]   = useState('');
  const [filtroChofer,  setFiltroChofer]  = useState('');
  const [showModal,     setShowModal]     = useState(false);
  const [form,          setForm]          = useState<FormState>(EMPTY);
  const [archivo,       setArchivo]       = useState<File | null>(null);
  const [previewUrl,    setPreviewUrl]    = useState('');
  const [saving,        setSaving]        = useState(false);
  const [scanning,         setScanning]         = useState(false);
  const [scanWarnings,     setScanWarnings]     = useState<string[]>([]);
  const [requiereRevision, setRequiereRevision] = useState(false);
  const [dupWarning,       setDupWarning]       = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [msg,           setMsg]           = useState<{ text: string; ok: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);


  const cargar = async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/remitos');
      setLista(toArray(r.data).map(serializarFirestore).map(normalizar));
    } catch { /* silent */ }
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);

  const choferes = Array.from(
    new Map(
      lista.map(r => r.chofer).filter(Boolean)
        .map(c => [c.toLowerCase().split('@')[0], c])
    ).values()
  ).sort();

  const filtrados = lista.filter(r => {
    const q = filtroBusq.toLowerCase();
    if (q && !r.razonSocial.toLowerCase().includes(q) && !r.nroRemito.toLowerCase().includes(q) && !r.cuit.includes(q)) return false;
    if (filtroChofer && r.chofer !== filtroChofer) return false;
    if (filtroDesde && r.fecha < filtroDesde) return false;
    if (filtroHasta && r.fecha > filtroHasta) return false;
    return true;
  });

  const totalMonto       = filtrados.reduce((s, r) => s + r.monto, 0);
  const totalCombustible = filtrados.reduce((s, r) => s + r.combustible, 0);


  const setF = (k: keyof FormState) =>
    (ev: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: ev.target.value }));

  const abrirNuevo = () => {
    setForm(EMPTY); setArchivo(null); setPreviewUrl('');
    setScanWarnings([]); setRequiereRevision(false);
    setDupWarning(false); setMsg(null); setShowModal(true);
  };

  const abrirEdicion = (r: Remito) => {
    setForm({
      id: r.id, fecha: fechaISO(r.fecha), nroRemito: r.nroRemito, razonSocial: r.razonSocial,
      cuit: r.cuit, combustible: String(r.combustible),
      tipoCombustible: r.tipoCombustible || '',
      monto: String(r.monto), chofer: r.chofer, observaciones: r.observaciones,
    });
    setArchivo(null); setPreviewUrl(r.comprobante || '');
    setDupWarning(false); setMsg(null); setShowModal(true);
  };

  const cerrarModal = () => {
    setShowModal(false); setMsg(null); setDupWarning(false);
    setScanWarnings([]); setRequiereRevision(false);
  };

  const onArchivo = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const f = ev.target.files?.[0] || null;
    setArchivo(f);
    setPreviewUrl(f ? URL.createObjectURL(f) : '');
  };

  const escanear = async () => {
    if (!archivo) { fileRef.current?.click(); return; }
    const mimeType = archivo.type || 'image/jpeg';
    if (!MIMES_VALIDOS.includes(mimeType)) {
      setMsg({ text: `Formato no soportado (${mimeType}). Usá JPG o PNG.`, ok: false });
      return;
    }
    setScanning(true); setScanWarnings([]); setRequiereRevision(false); setMsg(null);
    try {
      const dataUrl = await toBase64(archivo);
      const b64 = dataUrl.split(',')[1];
      const r = await api.post('/api/remitos/escanear', { fotoBase64: b64, mimeType });
      const { datos = {}, advertencias = [], requiere_revision = false } = r.data;
      setScanWarnings(advertencias);
      setRequiereRevision(requiere_revision);
      setForm(f => ({
        ...f,
        nroRemito:       datos.nroRemito      != null ? String(datos.nroRemito)          : f.nroRemito,
        razonSocial:     datos.razonSocial     != null ? String(datos.razonSocial)        : f.razonSocial,
        cuit:            datos.cuit            != null ? String(datos.cuit)               : f.cuit,
        fecha:           fechaISO(datos.fecha  || '') || f.fecha,
        combustible:     datos.combustible     != null ? String(datos.combustible)        : f.combustible,
        tipoCombustible: datos.tipoCombustible != null ? String(datos.tipoCombustible)    : f.tipoCombustible,
        monto:           datos.monto           != null ? String(datos.monto)              : f.monto,
      }));
      if (!requiere_revision && advertencias.length === 0) {
        setMsg({ text: '✓ Datos extraídos del comprobante', ok: true });
      }
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje;
      setMsg({ text: msg || 'No se pudo escanear el comprobante', ok: false });
    }
    setScanning(false);
  };

  const guardar = async (forzar = false) => {
    if (!form.fecha || !form.nroRemito) {
      setMsg({ text: 'Completá fecha y número de remito', ok: false });
      return;
    }
    if (!forzar && !form.id && form.nroRemito && form.cuit) {
      try {
        const r = await api.get(`/api/remitos/duplicado?nroRemito=${encodeURIComponent(form.nroRemito)}&cuit=${encodeURIComponent(form.cuit)}`);
        if (r.data?.duplicado) { setDupWarning(true); return; }
      } catch { /* opcional */ }
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
        await api.put(`/api/remitos/${form.id}`, payload);
      } else {
        await api.post('/api/remitos', payload);
      }
      cerrarModal(); cargar();
    } catch { setMsg({ text: 'Error al guardar', ok: false }); }
    setSaving(false);
  };

  const eliminar = async (id: string) => {
    try { await api.delete(`/api/remitos/${id}`); setConfirmDelete(null); cargar(); }
    catch { /* silent */ }
  };

  /* PDF tab state */
  const [pdfChofer,  setPdfChofer]  = useState('');
  const [pdfDesde,   setPdfDesde]   = useState('');
  const [pdfHasta,   setPdfHasta]   = useState('');
  const [pdfData,    setPdfData]    = useState<Remito[]>([]);
  const [loadingPdf, setLoadingPdf] = useState(false);

  const buscarPdf = async () => {
    setLoadingPdf(true);
    try {
      const params = new URLSearchParams();
      if (pdfChofer) params.set('chofer', pdfChofer);
      if (pdfDesde)  params.set('desde', pdfDesde);
      if (pdfHasta)  params.set('hasta', pdfHasta);
      const r = await api.get(`/api/remitos/pdf-data?${params}`);
      setPdfData(toArray(r.data).map(serializarFirestore).map(normalizar));
    } catch { /* fallback: filter from lista */
      setPdfData(lista.filter(r => {
        if (pdfChofer && r.chofer !== pdfChofer) return false;
        if (pdfDesde  && r.fecha < pdfDesde) return false;
        if (pdfHasta  && r.fecha > pdfHasta) return false;
        return true;
      }));
    }
    setLoadingPdf(false);
  };

  return (
    <div>
      {/* Header */}
      <div className="section-header">
        <div>
          <h2 className="section-title">🧾 Remitos</h2>
          <p style={{ fontSize: '.82rem', color: 'var(--text3)', marginTop: '.2rem' }}>
            {filtrados.length} registro{filtrados.length !== 1 ? 's' : ''} ·{' '}
            <strong style={{ color: 'var(--blue)' }}>{fmt(totalMonto)}</strong>
            {totalCombustible > 0 && (
              <> · <strong style={{ color: 'var(--amber)' }}>{totalCombustible.toLocaleString('es-AR')} L</strong></>
            )}
          </p>
        </div>
        {tabActivo === 'lista' && <button className="btn btn-primary" onClick={abrirNuevo}>+ Nuevo remito</button>}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:'.35rem', marginBottom:'1.25rem', borderBottom:'1px solid var(--border)', paddingBottom:'.75rem' }}>
        {([{key:'lista',label:'🧾 Remitos'},{key:'pdf',label:'🖨️ PDF / Imprimir'}] as {key:'lista'|'pdf';label:string}[]).map(t=>(
          <button key={t.key} className={tabActivo===t.key?'btn btn-primary':'btn btn-secondary'}
            style={{fontSize:'.82rem'}} onClick={()=>setTabActivo(t.key)}>{t.label}</button>
        ))}
      </div>

      {tabActivo === 'lista' && <>

      {/* Filtros */}
      <div className="filter-bar">
        <input className="input" placeholder="Buscar razón social, N° remito o CUIT…"
          value={filtroBusq} onChange={e => setFiltroBusq(e.target.value)} />
        {choferes.length > 0 && (
          <select className="select" value={filtroChofer} onChange={e => setFiltroChofer(e.target.value)}>
            <option value="">Todos los choferes</option>
            {choferes.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
          <label style={{ fontSize: '.78rem', color: 'var(--text3)', fontWeight: 500, whiteSpace: 'nowrap' }}>Desde</label>
          <input type="date" className="input" style={{ width: 148 }}
            value={filtroDesde} onChange={e => setFiltroDesde(e.target.value)} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
          <label style={{ fontSize: '.78rem', color: 'var(--text3)', fontWeight: 500, whiteSpace: 'nowrap' }}>Hasta</label>
          <input type="date" className="input" style={{ width: 148 }}
            value={filtroHasta} onChange={e => setFiltroHasta(e.target.value)} />
        </div>
        {(filtroBusq || filtroChofer || filtroDesde || filtroHasta) && (
          <button className="btn btn-secondary" style={{ fontSize: '.78rem' }}
            onClick={() => { setFiltroBusq(''); setFiltroChofer(''); setFiltroDesde(''); setFiltroHasta(''); }}>
            ✕ Limpiar
          </button>
        )}
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', color: 'var(--text3)', padding: '2rem 0' }}>
          <span className="spinner" /> Cargando remitos…
        </div>
      ) : filtrados.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🧾</div>
          <p>Sin remitos registrados</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
          {filtrados.map(r => (
            <div key={r.id} className="card"
              style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '.75rem 1rem', cursor: 'pointer' }}
              onClick={() => abrirEdicion(r)}>

              {/* Thumbnail comprobante */}
              {r.comprobante && (
                <img src={r.comprobante} alt="comprobante"
                  style={{ width: '44px', height: '44px', objectFit: 'cover', borderRadius: 'var(--radius)',
                    flexShrink: 0, border: '1px solid var(--border2)' }}
                  onClick={ev => { ev.stopPropagation(); window.open(r.comprobante, '_blank'); }} />
              )}

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '.88rem', fontWeight: 600, color: 'var(--text)' }}>
                    {r.razonSocial || 'Sin razón social'}
                  </span>
                  {r.nroRemito && <span className="badge badge-blue">#{r.nroRemito}</span>}
                  {r.tipoCombustible && <span className="badge badge-amber">{r.tipoCombustible}</span>}
                </div>
                <p style={{ fontSize: '.78rem', color: 'var(--text3)', marginTop: '.15rem' }}>
                  {r.fecha}
                  {r.chofer    && ` · ${r.chofer}`}
                  {r.cuit      && ` · ${r.cuit}`}
                  {r.combustible > 0 && ` · ${r.combustible} L`}
                  {r.observaciones && ` · ${r.observaciones}`}
                </p>
              </div>

              <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--blue)', whiteSpace: 'nowrap' }}>
                {fmt(r.monto)}
              </p>

              {confirmDelete === r.id ? (
                <div style={{ display: 'flex', gap: '.4rem' }} onClick={ev => ev.stopPropagation()}>
                  <button className="btn btn-danger" style={{ fontSize: '.72rem', padding: '.3rem .6rem' }}
                    onClick={() => eliminar(r.id)}>Confirmar</button>
                  <button className="btn btn-secondary" style={{ fontSize: '.72rem', padding: '.3rem .6rem' }}
                    onClick={() => setConfirmDelete(null)}>Cancelar</button>
                </div>
              ) : (
                <button className="btn btn-secondary" style={{ fontSize: '.72rem', padding: '.3rem .6rem' }}
                  onClick={ev => { ev.stopPropagation(); setConfirmDelete(r.id); }}>🗑</button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div
          className="modal-overlay"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}
          onClick={e => { if (e.target === e.currentTarget) cerrarModal(); }}>
          <div className="card modal-content" style={{ width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', marginBottom: '1.25rem' }}>
              {form.id ? '✏️ Editar remito' : '+ Nuevo remito'}
            </h3>

            <div className="form-grid">
              {/* Fila fecha + nro */}
              <div className="form-grid form-grid-2">
                <div>
                  <label style={labelStyle}>Fecha *</label>
                  <input type="date" className="input" value={form.fecha} onChange={setF('fecha')} />
                </div>
                <div>
                  <label style={labelStyle}>N° Remito *</label>
                  <input type="text" className="input" placeholder="Ej: 0001-00012" value={form.nroRemito} onChange={setF('nroRemito')} />
                </div>
              </div>

              {/* Razón social */}
              <div>
                <label style={labelStyle}>Razón Social</label>
                <input type="text" className="input" placeholder="Ej: YPF S.A." value={form.razonSocial} onChange={setF('razonSocial')} />
              </div>

              {/* CUIT + Chofer */}
              <div className="form-grid form-grid-2">
                <div>
                  <label style={labelStyle}>CUIT</label>
                  <input type="text" className="input" placeholder="30-12345678-9" value={form.cuit} onChange={setF('cuit')} />
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
              </div>

              {/* Combustible litros + tipo */}
              <div className="form-grid form-grid-2">
                <div>
                  <label style={labelStyle}>Combustible (litros)</label>
                  <input type="number" className="input" placeholder="0" value={form.combustible} onChange={setF('combustible')} />
                </div>
                <div>
                  <label style={labelStyle}>Tipo combustible</label>
                  <select className="select" value={form.tipoCombustible} onChange={setF('tipoCombustible')}>
                    <option value="">—</option>
                    {TIPOS_COMB.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              {/* Monto */}
              <div>
                <label style={labelStyle}>Monto ($)</label>
                <input type="number" className="input" placeholder="0" value={form.monto} onChange={setF('monto')} />
              </div>

              {/* Observaciones */}
              <div>
                <label style={labelStyle}>Observaciones</label>
                <textarea className="textarea" rows={2} placeholder="Opcional…"
                  value={form.observaciones} onChange={setF('observaciones')} />
              </div>

              {/* Comprobante + Escanear IA */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '.4rem' }}>
                  <label style={labelStyle}>Comprobante</label>
                  <Button variant="secondary" size="sm" loading={scanning} onClick={escanear}>
                    {!scanning && '🤖 Escanear con IA'}
                    {scanning && 'Escaneando…'}
                  </Button>
                </div>
                <input ref={fileRef} type="file" accept="image/*"
                  style={{ display: 'none' }} onChange={onArchivo} />
                <div
                  style={{ border: '1.5px dashed var(--border2)', borderRadius: 'var(--radius)',
                    padding: '.75rem', textAlign: 'center', cursor: 'pointer',
                    color: 'var(--text3)', fontSize: '.82rem' }}
                  onClick={() => fileRef.current?.click()}>
                  {previewUrl
                    ? <img src={previewUrl} alt="comprobante"
                        style={{ maxHeight: '120px', maxWidth: '100%', borderRadius: 'var(--radius)', objectFit: 'contain' }} />
                    : '📎 Clic para adjuntar imagen'}
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
                ⚠️ Ya existe un remito con el mismo N° y CUIT. ¿Querés guardarlo igual?
                <div style={{ display: 'flex', gap: '.5rem', marginTop: '.5rem' }}>
                  <button className="btn btn-primary" style={{ fontSize: '.78rem', padding: '.3rem .75rem' }}
                    onClick={() => { setDupWarning(false); guardar(true); }}>Sí, guardar igual</button>
                  <button className="btn btn-secondary" style={{ fontSize: '.78rem', padding: '.3rem .75rem' }}
                    onClick={() => setDupWarning(false)}>Cancelar</button>
                </div>
              </div>
            )}

            {requiereRevision && scanWarnings.length > 0 && (
              <div style={{ background: 'var(--amber-dim)', border: '1px solid var(--amber)',
                borderRadius: 'var(--radius)', padding: '.75rem 1rem', marginTop: '1rem',
                fontSize: '.82rem', color: 'var(--amber)' }}>
                ⚠️ Revisá los datos extraídos: {scanWarnings.join(' · ')}
              </div>
            )}

            {msg && (
              <p style={{ fontSize: '.82rem', color: msg.ok ? 'var(--green)' : 'var(--red)', marginTop: '.75rem' }}>
                {msg.text}
              </p>
            )}

            <div style={{ display: 'flex', gap: '.75rem', marginTop: '1.25rem' }}>
              <Button variant="secondary" style={{ flex: 1 }} onClick={cerrarModal}>Cancelar</Button>
              <Button depth style={{ flex: 1 }} loading={saving} onClick={() => guardar(false)}>
                {!saving && (form.id ? 'Actualizar' : 'Guardar')}
                {saving && 'Guardando…'}
              </Button>
            </div>
            {previewUrl && <div style={{ height: 100 }} aria-hidden="true" />}
          </div>
        </div>
      )}

      </> /* end tabActivo === 'lista' */}

      {/* ══ Tab PDF / Imprimir ════════════════════════════════════════ */}
      {tabActivo === 'pdf' && (
        <div>
          {/* Filtros */}
          <div style={{ display:'flex', gap:'1rem', flexWrap:'wrap', alignItems:'flex-end', marginBottom:'1.25rem' }}>
            {esAdmin && choferes.length > 0 && (
              <div>
                <label style={{ display:'block', fontSize:'.78rem', color:'var(--text3)', marginBottom:'.3rem', fontWeight:500 }}>Chofer</label>
                <select className="select" style={{ width:180 }} value={pdfChofer} onChange={e=>setPdfChofer(e.target.value)}>
                  <option value="">Todos</option>
                  {choferes.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}
            <div>
              <label style={{ display:'block', fontSize:'.78rem', color:'var(--text3)', marginBottom:'.3rem', fontWeight:500 }}>Desde</label>
              <input type="date" className="input" style={{ width:155 }} value={pdfDesde} onChange={e=>setPdfDesde(e.target.value)}/>
            </div>
            <div>
              <label style={{ display:'block', fontSize:'.78rem', color:'var(--text3)', marginBottom:'.3rem', fontWeight:500 }}>Hasta</label>
              <input type="date" className="input" style={{ width:155 }} value={pdfHasta} onChange={e=>setPdfHasta(e.target.value)}/>
            </div>
            <button className="btn btn-secondary" onClick={buscarPdf} disabled={loadingPdf}>
              {loadingPdf ? <><span className="spinner" style={{width:12,height:12}}/> Buscando…</> : '🔍 Buscar'}
            </button>
            {pdfData.length > 0 && (
              <button className="btn btn-primary" onClick={() => window.print()}>🖨️ Imprimir / PDF</button>
            )}
          </div>

          {loadingPdf ? (
            <div style={{display:'flex',alignItems:'center',gap:'.75rem',color:'var(--text3)',padding:'2rem'}}><span className="spinner"/> Cargando…</div>
          ) : pdfData.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">🖨️</div><p>Seleccioná filtros y buscá para ver los remitos a imprimir</p></div>
          ) : (
            <div id="remitos-pdf-content">
              {/* Encabezado del PDF */}
              <div style={{ marginBottom:'1.25rem', padding:'1rem', background:'var(--bg3)', borderRadius:'var(--radius-lg)', borderBottom:'2px solid var(--border)' }} className="no-print">
                <p style={{ fontSize:'.85rem', color:'var(--text3)' }}>
                  <strong style={{ color:'var(--text)' }}>{pdfData.length} remito{pdfData.length!==1?'s':''}</strong>
                  {' · '}Total litros: <strong style={{ color:'var(--amber)' }}>{pdfData.reduce((s,r)=>s+r.combustible,0).toLocaleString('es-AR')} L</strong>
                  {' · '}Total monto: <strong style={{ color:'var(--blue)' }}>{fmt(pdfData.reduce((s,r)=>s+r.monto,0))}</strong>
                </p>
              </div>
              {/* Tabla imprimible */}
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'.85rem' }}>
                  <thead>
                    <tr>
                      {['Fecha','N° Remito','Razón Social','CUIT','Chofer','Combustible (L)','Monto'].map(h=>(
                        <th key={h} style={{ border:'1px solid var(--border)', padding:'.5rem .75rem', background:'var(--bg4)', textAlign:'left', fontSize:'.8rem', color:'var(--text3)', fontWeight:700 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pdfData.map(r=>(
                      <tr key={r.id}>
                        <td style={{ border:'1px solid var(--border)', padding:'.45rem .75rem' }}>{r.fecha}</td>
                        <td style={{ border:'1px solid var(--border)', padding:'.45rem .75rem', fontFamily:'monospace' }}>{r.nroRemito||'—'}</td>
                        <td style={{ border:'1px solid var(--border)', padding:'.45rem .75rem', fontWeight:500 }}>{r.razonSocial||'—'}</td>
                        <td style={{ border:'1px solid var(--border)', padding:'.45rem .75rem', fontFamily:'monospace', fontSize:'.78rem' }}>{r.cuit||'—'}</td>
                        <td style={{ border:'1px solid var(--border)', padding:'.45rem .75rem' }}>{r.chofer||'—'}</td>
                        <td style={{ border:'1px solid var(--border)', padding:'.45rem .75rem', textAlign:'right' }}>{r.combustible>0?r.combustible.toLocaleString('es-AR'):'—'}</td>
                        <td style={{ border:'1px solid var(--border)', padding:'.45rem .75rem', textAlign:'right', fontWeight:700 }}>{r.monto>0?fmt(r.monto):'—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background:'var(--bg4)', fontWeight:700 }}>
                      <td colSpan={5} style={{ border:'1px solid var(--border)', padding:'.5rem .75rem', textAlign:'right' }}>TOTALES</td>
                      <td style={{ border:'1px solid var(--border)', padding:'.5rem .75rem', textAlign:'right', color:'var(--amber)' }}>
                        {pdfData.reduce((s,r)=>s+r.combustible,0).toLocaleString('es-AR')} L
                      </td>
                      <td style={{ border:'1px solid var(--border)', padding:'.5rem .75rem', textAlign:'right', color:'var(--blue)' }}>
                        {fmt(pdfData.reduce((s,r)=>s+r.monto,0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
