'use client';
import { useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import { serializarFirestore, toArray } from '@/lib/utils';
import Button from '@/components/ui/Button';

type TabEgr = 'carga' | 'buscar' | 'stats';

const CATEGORIAS = ['Combustible', 'Repuesto', 'Mantenimiento', 'Seguro', 'Peaje', 'Limpieza', 'Otro'];
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

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
    monto:        parseFloat(String(e.monto || e.MONTO || e.IMPORTE || e.TOTAL || 0)) || 0,
    categoria:    String(e.categoria    || e.CATEGORIA    || 'Otro'),
    proveedor:    String(e.proveedor    || e.PROVEEDOR    || e.COMERCIO || ''),
    chofer:       String(e.chofer       || e.CHOFER       || e.USUARIO  || ''),
    observaciones:String(e.observaciones|| e.OBSERVACIONES|| ''),
    comprobante:  String(e.comprobanteUrl || e.COMPROBANTEURL || e.comprobante || e.COMPROBANTE || ''),
  };
}

const toBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const L: React.CSSProperties = {
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

export default function EgresosPage() {
  const [tab,            setTab]            = useState<TabEgr>('carga');
  const [lista,          setLista]          = useState<Egreso[]>([]);
  const [loading,        setLoading]        = useState(true);

  /* ── Tab Carga ── */
  const [form,           setForm]           = useState<FormState>(EMPTY);
  const [archivo,        setArchivo]        = useState<File | null>(null);
  const [previewUrl,     setPreviewUrl]     = useState('');
  const [saving,         setSaving]         = useState(false);
  const [scanning,       setScanning]       = useState(false);
  const [dupWarning,     setDupWarning]     = useState(false);
  const [msgCarga,       setMsgCarga]       = useState<{ text: string; ok: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /* ── Tab Buscar ── */
  const [busqText,       setBusqText]       = useState('');
  const [filtroDesde,    setFiltroDesde]    = useState('');
  const [filtroHasta,    setFiltroHasta]    = useState('');
  const [filtroMontoMin, setFiltroMontoMin] = useState('');
  const [filtroMontoMax, setFiltroMontoMax] = useState('');
  const [filtroCateg,    setFiltroCateg]    = useState('');
  const [filtroChofer,   setFiltroChofer]   = useState('');
  const [showFiltros,    setShowFiltros]    = useState(false);
  const [confirmDelete,  setConfirmDelete]  = useState<string | null>(null);

  /* ── Tab Stats ── */
  const [statsMes,       setStatsMes]       = useState(() => new Date().getMonth());
  const [statsAnio,      setStatsAnio]      = useState(() => new Date().getFullYear());

  const hoy = new Date();

  const cargar = async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/egresos');
      setLista(toArray(r.data).map(serializarFirestore).map(normalizar));
    } catch { /* silent */ }
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);

  const choferes = Array.from(
    new Map(
      lista.map(e => e.chofer).filter(Boolean)
        .map(c => [c.toLowerCase().split('@')[0], c])
    ).values()
  ).sort();

  /* ── Filtrado para búsqueda ── */
  const filtrados = lista.filter(e => {
    const q = busqText.toLowerCase();
    if (q && !e.concepto.toLowerCase().includes(q) &&
             !e.proveedor.toLowerCase().includes(q) &&
             !e.chofer.toLowerCase().includes(q) &&
             !e.observaciones.toLowerCase().includes(q)) return false;
    if (filtroDesde && e.fecha < filtroDesde) return false;
    if (filtroHasta && e.fecha > filtroHasta) return false;
    if (filtroMontoMin && e.monto < Number(filtroMontoMin)) return false;
    if (filtroMontoMax && e.monto > Number(filtroMontoMax)) return false;
    if (filtroCateg && e.categoria !== filtroCateg) return false;
    if (filtroChofer && e.chofer !== filtroChofer) return false;
    return true;
  });

  const limpiarFiltros = () => {
    setBusqText(''); setFiltroDesde(''); setFiltroHasta('');
    setFiltroMontoMin(''); setFiltroMontoMax(''); setFiltroCateg(''); setFiltroChofer('');
  };

  const total = filtrados.reduce((s, e) => s + e.monto, 0);

  /* ── Carga: helpers ── */
  const setF = (k: keyof FormState) =>
    (ev: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: ev.target.value }));

  const onArchivo = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const f = ev.target.files?.[0] || null;
    setArchivo(f);
    setPreviewUrl(f ? URL.createObjectURL(f) : '');
  };

  const escanear = async () => {
    if (!archivo) { fileRef.current?.click(); return; }
    setScanning(true);
    try {
      const dataUrl  = await toBase64(archivo);
      const [prefix, b64] = dataUrl.split(',');
      const mimeType = prefix.replace('data:', '').replace(';base64', '');
      const r = await api.post('/api/egresos/escanear', { fotoBase64: b64, mimeType });
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
      setMsgCarga({ text: 'No se pudo escanear el comprobante', ok: false });
    }
    setScanning(false);
  };

  const guardar = async (forzar = false) => {
    if (!form.fecha || !form.concepto || !form.monto) {
      setMsgCarga({ text: 'Completá fecha, concepto y monto', ok: false }); return;
    }
    if (!forzar && !form.id) {
      try {
        const r = await api.get(`/api/egresos/duplicado?fecha=${encodeURIComponent(form.fecha)}&monto=${form.monto}`);
        if (r.data?.duplicado) { setDupWarning(true); return; }
      } catch { /* endpoint opcional */ }
    }
    setSaving(true); setMsgCarga(null);
    try {
      const payload: Record<string, unknown> = { ...form };
      if (archivo) {
        payload.comprobante = await toBase64(archivo);
      }
      if (form.id) {
        await api.put(`/api/egresos/${form.id}`, payload);
        setMsgCarga({ text: '✅ Egreso actualizado.', ok: true });
      } else {
        await api.post('/api/egresos', payload);
        setMsgCarga({ text: '✅ Egreso guardado.', ok: true });
        setForm(EMPTY); setArchivo(null); setPreviewUrl('');
      }
      cargar();
    } catch { setMsgCarga({ text: 'Error al guardar', ok: false }); }
    setSaving(false);
  };

  const eliminar = async (id: string) => {
    try { await api.delete(`/api/egresos/${id}`); setConfirmDelete(null); cargar(); }
    catch { /* silent */ }
  };

  /* ── Stats ── */
  const egresosDelMes = lista.filter(e => {
    if (!e.fecha) return false;
    let iso = e.fecha;
    if (iso.includes('/')) {
      const [dd, mm, yy] = iso.split('/');
      iso = `${(yy||'').padStart(4,'0')}-${(mm||'').padStart(2,'0')}-${(dd||'').padStart(2,'0')}`;
    }
    return iso.startsWith(`${statsAnio}-${String(statsMes + 1).padStart(2,'0')}`);
  });

  const porCategoria = CATEGORIAS.map(cat => ({
    cat, total: egresosDelMes.filter(e => e.categoria === cat).reduce((s, e) => s + e.monto, 0),
    count: egresosDelMes.filter(e => e.categoria === cat).length,
  })).filter(c => c.total > 0).sort((a, b) => b.total - a.total);

  const totalMes = egresosDelMes.reduce((s, e) => s + e.monto, 0);
  const maxCateg = Math.max(...porCategoria.map(c => c.total), 1);

  const CATEG_COLORS: Record<string, string> = {
    Combustible: 'var(--amber)', Repuesto: 'var(--blue)', Mantenimiento: 'var(--purple)',
    Seguro: 'var(--teal)', Peaje: 'var(--green)', Limpieza: 'var(--blue)', Otro: 'var(--text3)',
  };

  return (
    <div>
      {/* Header */}
      <div className="section-header">
        <div>
          <div className="section-icon amber">💸</div>
        </div>
        <div style={{ flex:1 }}>
          <div className="section-title">Egresos</div>
          <div className="section-sub">Gastos y comprobantes</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-inner" style={{ marginBottom:'1rem' }}>
        <button className={`tab-inner${tab==='carga'?' active':''}`} onClick={() => { setTab('carga'); setMsgCarga(null); }}>
          Nueva carga
        </button>
        <button className={`tab-inner${tab==='buscar'?' active':''}`} onClick={() => setTab('buscar')}>
          Consultar
        </button>
        <button className={`tab-inner${tab==='stats'?' active':''}`} onClick={() => setTab('stats')}>
          📊 Estadísticas
        </button>
      </div>

      {/* ═══ TAB CARGA ═══ */}
      {tab === 'carga' && (
        <div className="card">
          <div className="card-title">Nuevo egreso</div>
          <div className="form-grid">
            <div className="form-grid form-grid-2">
              <div><label style={L}>Fecha *</label>
                <input type="date" className="input" value={form.fecha} onChange={setF('fecha')} /></div>
              <div><label style={L}>Monto *</label>
                <input type="number" className="input" placeholder="0" value={form.monto} onChange={setF('monto')} /></div>
            </div>
            <div><label style={L}>Concepto *</label>
              <input type="text" className="input" placeholder="Ej: Nafta YPF" value={form.concepto} onChange={setF('concepto')} /></div>
            <div className="form-grid form-grid-2">
              <div><label style={L}>Categoría</label>
                <select className="select" value={form.categoria} onChange={setF('categoria')}>
                  {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select></div>
              <div><label style={L}>Proveedor / Comercio</label>
                <input type="text" className="input" placeholder="Ej: Shell" value={form.proveedor} onChange={setF('proveedor')} /></div>
            </div>
            <div><label style={L}>Chofer</label>
              {choferes.length > 0
                ? <select className="select" value={form.chofer} onChange={setF('chofer')}>
                    <option value="">Sin asignar</option>
                    {choferes.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                : <input type="text" className="input" placeholder="Nombre del chofer"
                    value={form.chofer} onChange={setF('chofer')} />}
            </div>
            <div><label style={L}>Observaciones</label>
              <textarea className="textarea" rows={2} placeholder="Opcional…"
                value={form.observaciones} onChange={setF('observaciones')} /></div>

            {/* Comprobante */}
            <div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'.4rem' }}>
                <label style={L}>Comprobante</label>
                <Button variant="success" size="sm" loading={scanning} onClick={escanear}>
                  {!scanning && '📷 Escanear con IA'}
                  {scanning && 'Escaneando…'}
                </Button>
              </div>
              <input ref={fileRef} type="file" accept="image/*,application/pdf"
                style={{ display:'none' }} onChange={onArchivo} />
              <div style={{ border:'1.5px dashed var(--border2)', borderRadius:'var(--radius)',
                padding:'.75rem', textAlign:'center', cursor:'pointer', color:'var(--text3)', fontSize:'.82rem' }}
                onClick={() => fileRef.current?.click()}>
                {previewUrl
                  ? <img src={previewUrl} alt="comprobante"
                      style={{ maxHeight:120, maxWidth:'100%', borderRadius:'var(--radius)', objectFit:'contain' }} />
                  : '📎 Clic para adjuntar imagen o PDF'}
              </div>
              {archivo && <p style={{ fontSize:'.75rem', color:'var(--text3)', marginTop:'.3rem' }}>{archivo.name}</p>}
            </div>
          </div>

          {dupWarning && (
            <div style={{ background:'var(--amber-dim)', border:'1px solid var(--amber)',
              borderRadius:'var(--radius)', padding:'.75rem 1rem', marginTop:'1rem',
              fontSize:'.82rem', color:'var(--amber)' }}>
              ⚠️ Ya existe un egreso con la misma fecha y monto. ¿Querés guardarlo igual?
              <div style={{ display:'flex', gap:'.5rem', marginTop:'.5rem' }}>
                <button className="btn btn-primary" style={{ fontSize:'.78rem', padding:'.3rem .75rem' }}
                  onClick={() => { setDupWarning(false); guardar(true); }}>Sí, guardar igual</button>
                <button className="btn btn-secondary" style={{ fontSize:'.78rem', padding:'.3rem .75rem' }}
                  onClick={() => setDupWarning(false)}>Cancelar</button>
              </div>
            </div>
          )}

          {msgCarga && (
            <p style={{ fontSize:'.82rem', color:msgCarga.ok?'var(--green)':'var(--red)', marginTop:'.75rem' }}>
              {msgCarga.text}
            </p>
          )}

          <div className="btn-row" style={{ marginTop:'1.25rem' }}>
            <Button depth loading={saving} onClick={() => guardar(false)}>
              {!saving && '✓ Guardar egreso'}
              {saving && 'Guardando…'}
            </Button>
            <Button variant="secondary" onClick={() => { setForm(EMPTY); setArchivo(null); setPreviewUrl(''); setMsgCarga(null); }}>
              Limpiar
            </Button>
          </div>
        </div>
      )}

      {/* ═══ TAB BUSCAR ═══ */}
      {tab === 'buscar' && (
        <div>
          <div className="card">
            <div className="search-row">
              <input type="search" className="input" placeholder="Buscar en egresos…"
                value={busqText} onChange={e => setBusqText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && setShowFiltros(false)} />
              <button className="btn btn-secondary"
                onClick={() => setShowFiltros(v => !v)}>
                ⚙ Filtros{(filtroDesde||filtroHasta||filtroMontoMin||filtroMontoMax||filtroCateg||filtroChofer) ? ' ●' : ''}
              </button>
            </div>

            {showFiltros && (
              <div style={{ marginTop:'1rem', paddingTop:'1rem', borderTop:'1px solid var(--border)' }}>
                <div className="form-grid form-grid-2">
                  <div><label style={L}>Desde</label>
                    <input type="date" className="input" value={filtroDesde} onChange={e => setFiltroDesde(e.target.value)} /></div>
                  <div><label style={L}>Hasta</label>
                    <input type="date" className="input" value={filtroHasta} onChange={e => setFiltroHasta(e.target.value)} /></div>
                  <div><label style={L}>Monto mín ($)</label>
                    <input type="number" className="input" placeholder="0"
                      value={filtroMontoMin} onChange={e => setFiltroMontoMin(e.target.value)} /></div>
                  <div><label style={L}>Monto máx ($)</label>
                    <input type="number" className="input" placeholder="Sin límite"
                      value={filtroMontoMax} onChange={e => setFiltroMontoMax(e.target.value)} /></div>
                </div>
                <div style={{ marginTop:8 }}><label style={L}>Categoría</label>
                  <select className="select" style={{ width:'100%' }} value={filtroCateg} onChange={e => setFiltroCateg(e.target.value)}>
                    <option value="">Todas</option>
                    {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ marginTop:8 }}><label style={L}>Chofer</label>
                  <select className="select" style={{ width:'100%' }} value={filtroChofer} onChange={e => setFiltroChofer(e.target.value)}>
                    <option value="">Todos los choferes</option>
                    {choferes.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="btn-row" style={{ marginTop:10 }}>
                  <button className="btn btn-secondary btn-sm" onClick={limpiarFiltros}>Limpiar filtros</button>
                </div>
              </div>
            )}
          </div>

          {loading ? (
            <div style={{ display:'flex', alignItems:'center', gap:'.75rem', color:'var(--text3)', padding:'2rem 0' }}>
              <span className="spinner"/> Cargando egresos…
            </div>
          ) : (
            <>
              <p style={{ fontSize:'.8rem', color:'var(--text3)', margin:'.5rem 0' }}>
                {filtrados.length} registro{filtrados.length!==1?'s':''} ·{' '}
                <strong style={{ color:'var(--red)' }}>{fmt(total)}</strong>
              </p>

              {filtrados.length === 0 ? (
                <div className="empty-state"><div className="empty-icon">💸</div><p>Sin egresos encontrados.</p></div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:'.4rem' }}>
                  {filtrados.map(e => (
                    <div key={e.id} className="result-item">
                      <div className="result-body" style={{ flex:1 }}>
                        <div className="result-name" style={{ display:'flex', justifyContent:'space-between' }}>
                          <span>{e.concepto || e.proveedor || 'Egreso'}</span>
                          <span style={{ fontWeight:700, color:'var(--red)', fontSize:'.95rem' }}>{fmt(e.monto)}</span>
                        </div>
                        <div className="result-meta">
                          {e.fecha      && <span>{e.fecha}</span>}
                          {e.categoria  && <span className="badge badge-amber" style={{fontSize:'.68rem'}}>{e.categoria}</span>}
                          {e.proveedor  && <span>{e.proveedor}</span>}
                          {e.chofer     && <span>🚗 {e.chofer}</span>}
                          {e.observaciones && <span>{e.observaciones}</span>}
                        </div>
                        {e.comprobante && (
                          <img src={e.comprobante} alt="comprobante"
                            style={{ marginTop:6, width:44, height:44, borderRadius:4, border:'1px solid var(--border)', objectFit:'cover', cursor:'pointer', flexShrink:0 }}
                            onClick={ev => { ev.stopPropagation(); window.open(e.comprobante, '_blank'); }}
                            onError={ev => (ev.currentTarget.style.display='none')} />
                        )}
                      </div>
                      <div className="result-actions" style={{ display:'flex', flexDirection:'column', gap:4 }}>
                        <button className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setForm({ id:e.id, fecha:fechaISO(e.fecha),
                              concepto:e.concepto || '',
                              monto:String(Math.round(parseFloat(String(e.monto || 0)))),
                              categoria:e.categoria, proveedor:e.proveedor, chofer:e.chofer, observaciones:e.observaciones });
                            setPreviewUrl(e.comprobante||''); setArchivo(null); setTab('carga');
                          }}>✏ Editar</button>
                        {confirmDelete === e.id ? (
                          <div style={{ display:'flex', gap:2 }}>
                            <button className="btn btn-danger btn-sm" onClick={() => eliminar(e.id)}>✓</button>
                            <button className="btn btn-secondary btn-sm" onClick={() => setConfirmDelete(null)}>✕</button>
                          </div>
                        ) : (
                          <button className="btn btn-secondary btn-sm" onClick={() => setConfirmDelete(e.id)}>🗑</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ═══ TAB STATS ═══ */}
      {tab === 'stats' && (
        <div>
          <div className="card" style={{ marginBottom:'.75rem' }}>
            <div className="dj-controls">
              <div className="form-group" style={{ flex:'0 0 auto' }}>
                <label style={L}>Mes</label>
                <select className="select" value={statsMes} onChange={e => setStatsMes(Number(e.target.value))}>
                  {MESES.map((m,i) => <option key={i} value={i}>{m}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ flex:'0 0 auto' }}>
                <label style={L}>Año</label>
                <input type="number" className="input" style={{ width:90 }}
                  value={statsAnio} onChange={e => setStatsAnio(Number(e.target.value))} />
              </div>
            </div>
          </div>

          {loading ? (
            <div style={{ display:'flex', alignItems:'center', gap:'.75rem', color:'var(--text3)', padding:'2rem 0' }}>
              <span className="spinner"/> Cargando…
            </div>
          ) : (
            <>
              {/* Resumen */}
              <div className="tablero" style={{ gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', marginBottom:'1.25rem' }}>
                <div className="tablero-card red">
                  <div className="tablero-label">Total del mes</div>
                  <div className="tablero-value" style={{ whiteSpace:'nowrap', fontSize:'clamp(14px,2vw,22px)' }}>{fmt(totalMes)}</div>
                  <div className="tablero-sub">{egresosDelMes.length} egresos</div>
                </div>
                {porCategoria.slice(0,3).map(c => (
                  <div key={c.cat} className="tablero-card amber">
                    <div className="tablero-label">{c.cat}</div>
                    <div className="tablero-value">{fmt(c.total)}</div>
                    <div className="tablero-sub">{c.count} registro{c.count!==1?'s':''}</div>
                  </div>
                ))}
              </div>

              {/* Gráfico de barras por categoría */}
              {porCategoria.length === 0 ? (
                <div className="empty-state"><div className="empty-icon">📊</div>
                  <p>Sin egresos para {MESES[statsMes]} {statsAnio}</p></div>
              ) : (
                <div className="card">
                  <div className="card-title">Por categoría — {MESES[statsMes]} {statsAnio}</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:'.6rem', marginTop:'.5rem' }}>
                    {porCategoria.map(c => (
                      <div key={c.cat}>
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:'.82rem', marginBottom:3 }}>
                          <span style={{ color:'var(--text2)', fontWeight:500 }}>{c.cat}</span>
                          <span style={{ color:'var(--text)', fontWeight:700 }}>{fmt(c.total)}</span>
                        </div>
                        <div style={{ height:8, background:'var(--bg4)', borderRadius:4, overflow:'hidden' }}>
                          <div style={{
                            height:'100%', borderRadius:4,
                            background: CATEG_COLORS[c.cat] || 'var(--blue)',
                            width: `${(c.total / maxCateg) * 100}%`,
                            transition: 'width .4s ease',
                          }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tabla de choferes */}
              {(() => {
                const porChofer = [...new Set(egresosDelMes.map(e => e.chofer).filter(Boolean))]
                  .map(ch => ({ chofer: ch, total: egresosDelMes.filter(e => e.chofer === ch).reduce((s,e)=>s+e.monto,0), count: egresosDelMes.filter(e=>e.chofer===ch).length }))
                  .sort((a,b) => b.total - a.total);
                if (!porChofer.length) return null;
                return (
                  <div className="card" style={{ marginTop:'.75rem' }}>
                    <div className="card-title">Por chofer — {MESES[statsMes]} {statsAnio}</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:'.4rem', marginTop:'.5rem' }}>
                      {porChofer.map(c => (
                        <div key={c.chofer} style={{ display:'flex', justifyContent:'space-between',
                          alignItems:'center', padding:'6px 0', borderBottom:'1px solid var(--border)' }}>
                          <span style={{ fontSize:'.88rem', color:'var(--text2)' }}>🚗 {c.chofer}</span>
                          <span style={{ fontSize:'.88rem', fontWeight:700, color:'var(--red)' }}>{fmt(c.total)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </div>
      )}
    </div>
  );
}
