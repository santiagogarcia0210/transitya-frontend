'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { serializarFirestore, toArray } from '@/lib/utils';

type TabIng = 'carga' | 'buscar' | 'stats';

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
    nroFactura:   String(e.nroFactura   || e.NROFACTURA   || e['NRO FACTURA'] || ''),
    concepto:     String(e.concepto     || e.CONCEPTO     || e.descripcion    || ''),
    monto:        Number(e.monto        || e.MONTO        || 0),
    obraSocial:   String(e.obraSocial   || e.OBRASOCIAL   || e['OBRA SOCIAL'] || ''),
    estado:       String(e.estado       || e.ESTADO       || 'PRESENTADO').toUpperCase(),
    observaciones:String(e.observaciones|| e.OBSERVACIONES|| ''),
  };
}

const L: React.CSSProperties = {
  display: 'block', fontSize: '.78rem', color: 'var(--text3)', marginBottom: '.3rem', fontWeight: 500,
};

const fmt = (n: number) =>
  n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

export default function IngresosPage() {
  const [tab,          setTab]          = useState<TabIng>('carga');
  const [lista,        setLista]        = useState<Ingreso[]>([]);
  const [loading,      setLoading]      = useState(true);

  /* ── Tab Carga ── */
  const [form,         setForm]         = useState<FormState>(EMPTY);
  const [saving,       setSaving]       = useState(false);
  const [msgCarga,     setMsgCarga]     = useState<{text:string;ok:boolean}|null>(null);

  /* ── Tab Consultar ── */
  const [busqText,     setBusqText]     = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroMes,    setFiltroMes]    = useState('');
  const [pagando,      setPagando]      = useState<string|null>(null);
  const [confirmDel,   setConfirmDel]   = useState<string|null>(null);

  /* ── Tab Stats ── */
  const [statsMes,     setStatsMes]     = useState(() => new Date().getMonth());
  const [statsAnio,    setStatsAnio]    = useState(() => new Date().getFullYear());

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

  /* ── Tab Carga: helpers ── */
  const setF = (k: keyof FormState) =>
    (ev: React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: ev.target.value }));

  const guardar = async () => {
    if (!form.fecha || !form.concepto || !form.monto) {
      setMsgCarga({ text: 'Completá fecha, concepto y monto', ok: false }); return;
    }
    setSaving(true); setMsgCarga(null);
    try {
      if (form.id) {
        await api.put(`/api/ingresos/${form.id}`, form);
        setMsgCarga({ text: '✅ Ingreso actualizado.', ok: true });
      } else {
        await api.post('/api/ingresos', form);
        setMsgCarga({ text: '✅ Ingreso guardado.', ok: true });
        setForm(EMPTY);
      }
      cargar();
    } catch { setMsgCarga({ text: 'Error al guardar', ok: false }); }
    setSaving(false);
  };

  /* ── Tab Consultar: filtrado ── */
  const mesesFiltro = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(anioActual, hoy.getMonth() - i, 1);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const a = d.getFullYear();
    return { value: `${m}-${a}`, label: `${MESES[d.getMonth()]} ${a}` };
  });

  const filtrados = lista.filter(e => {
    const q = busqText.toLowerCase();
    if (q && !e.concepto.toLowerCase().includes(q) &&
             !e.obraSocial.toLowerCase().includes(q) &&
             !e.nroFactura.toLowerCase().includes(q)) return false;
    if (filtroEstado && e.estado !== filtroEstado) return false;
    if (filtroMes) {
      const [mes, anio] = filtroMes.split('-');
      if (!e.fecha.includes(`/${mes}/${anio}`) && !e.fecha.startsWith(`${anio}-${mes}`)) return false;
    }
    return true;
  });

  const totalFiltrado   = filtrados.reduce((s, e) => s + e.monto, 0);
  const totalPagado     = filtrados.filter(e => e.estado === 'PAGADO').reduce((s, e) => s + e.monto, 0);
  const totalPresentado = filtrados.filter(e => e.estado === 'PRESENTADO').reduce((s, e) => s + e.monto, 0);

  const marcarPagado = async (id: string, ev: React.MouseEvent) => {
    ev.stopPropagation();
    setPagando(id);
    try { await api.patch(`/api/ingresos/${id}/pagar`); cargar(); }
    catch { /* silent */ }
    setPagando(null);
  };

  const eliminar = async (id: string) => {
    try { await api.delete(`/api/ingresos/${id}`); setConfirmDel(null); cargar(); }
    catch { /* silent */ }
  };

  /* ── Stats ── */
  const ingDelMes = lista.filter(e => {
    if (!e.fecha) return false;
    const d = new Date(e.fecha.includes('/') ? e.fecha.split('/').reverse().join('-') : e.fecha);
    return d.getMonth() === statsMes && d.getFullYear() === statsAnio;
  });
  const totalMes     = ingDelMes.reduce((s, e) => s + e.monto, 0);
  const pagadosMes   = ingDelMes.filter(e => e.estado === 'PAGADO').reduce((s, e) => s + e.monto, 0);
  const presentadosMes = ingDelMes.filter(e => e.estado === 'PRESENTADO').reduce((s, e) => s + e.monto, 0);

  const porObraSocial = [...new Set(ingDelMes.map(e => e.obraSocial).filter(Boolean))]
    .map(os => ({
      os,
      total: ingDelMes.filter(e => e.obraSocial === os).reduce((s,e)=>s+e.monto,0),
      count: ingDelMes.filter(e => e.obraSocial === os).length,
    })).sort((a,b) => b.total - a.total);

  const maxOS = Math.max(...porObraSocial.map(o => o.total), 1);

  return (
    <div>
      {/* Header */}
      <div className="section-header">
        <div><div className="section-icon green">💰</div></div>
        <div style={{ flex:1 }}>
          <div className="section-title">Ingresos</div>
          <div className="section-sub">Cobros y obras sociales</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-inner" style={{ marginBottom:'1rem' }}>
        <button className={`tab-inner${tab==='carga'?' active':''}`}
          onClick={() => { setTab('carga'); setMsgCarga(null); }}>Nueva carga</button>
        <button className={`tab-inner${tab==='buscar'?' active':''}`} onClick={() => setTab('buscar')}>Consultar</button>
        <button className={`tab-inner${tab==='stats'?' active':''}`} onClick={() => setTab('stats')}>📊 Estadísticas</button>
      </div>

      {/* ═══ TAB CARGA ═══ */}
      {tab === 'carga' && (
        <div className="card">
          <div className="card-title">{form.id ? `✏️ Editando ingreso` : 'Nuevo ingreso'}</div>
          <div className="form-grid">

            {/* N° Factura */}
            <div><label style={L}>N° de Factura</label>
              <input type="text" className="input" placeholder="Ej: 0001-00012345"
                value={form.nroFactura} onChange={setF('nroFactura')} /></div>

            {/* Estado toggle — idéntico al GAS */}
            <div><label style={L}>Estado</label>
              <div style={{ display:'flex', gap:10, marginTop:6 }}>
                <button type="button"
                  style={{ flex:1, padding:'8px', fontWeight:700, borderRadius:6, cursor:'pointer',
                    border: form.estado==='PRESENTADO' ? '2px solid var(--amber)' : '2px solid var(--border2)',
                    color: form.estado==='PRESENTADO' ? '#92400e' : 'var(--text3)',
                    background: form.estado==='PRESENTADO' ? '#fef3c7' : 'var(--bg4)',
                  }}
                  onClick={() => setForm(f => ({ ...f, estado: 'PRESENTADO' }))}>
                  📋 PRESENTADO
                </button>
                <button type="button"
                  style={{ flex:1, padding:'8px', fontWeight:700, borderRadius:6, cursor:'pointer',
                    border: form.estado==='PAGADO' ? '2px solid var(--green)' : '2px solid var(--border2)',
                    color: form.estado==='PAGADO' ? '#065f46' : 'var(--text3)',
                    background: form.estado==='PAGADO' ? '#d1fae5' : 'var(--bg4)',
                  }}
                  onClick={() => setForm(f => ({ ...f, estado: 'PAGADO' }))}>
                  ✓ PAGADO
                </button>
              </div>
              <input type="hidden" value={form.estado} /></div>

            <div className="form-grid form-grid-2">
              <div><label style={L}>Fecha</label>
                <input type="date" className="input" value={form.fecha} onChange={setF('fecha')} /></div>
              <div><label style={L}>Monto *</label>
                <input type="number" className="input" placeholder="0" value={form.monto} onChange={setF('monto')} /></div>
            </div>
            <div><label style={L}>Concepto *</label>
              <input type="text" className="input" placeholder="Ej: Liquidación mayo 2025"
                value={form.concepto} onChange={setF('concepto')} /></div>
            <div><label style={L}>Obra Social</label>
              <input type="text" className="input" placeholder="Ej: IOMA, OSDE, PAMI…"
                value={form.obraSocial} onChange={setF('obraSocial')} /></div>
            <div><label style={L}>Observaciones</label>
              <textarea className="textarea" rows={2} placeholder="Opcional…"
                value={form.observaciones} onChange={setF('observaciones')} /></div>
          </div>

          {msgCarga && (
            <p style={{ fontSize:'.82rem', color:msgCarga.ok?'var(--green)':'var(--red)', marginTop:'.75rem' }}>
              {msgCarga.text}
            </p>
          )}

          <div className="btn-row" style={{ marginTop:'1.25rem' }}>
            <button className="btn btn-primary" onClick={guardar} disabled={saving}>
              {saving ? <><span className="spinner" style={{width:12,height:12}}/> Guardando…</> : '✓ Guardar ingreso'}
            </button>
            <button className="btn btn-secondary"
              onClick={() => { setForm(EMPTY); setMsgCarga(null); }}>Limpiar</button>
          </div>
        </div>
      )}

      {/* ═══ TAB CONSULTAR ═══ */}
      {tab === 'buscar' && (
        <div>
          {/* KPIs */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'.75rem', marginBottom:'1rem' }}>
            <div className="tablero-card green" style={{ padding:'.85rem 1rem' }}>
              <div className="tablero-label">Cobrado</div>
              <div className="tablero-value">{fmt(totalPagado)}</div>
            </div>
            <div className="tablero-card amber" style={{ padding:'.85rem 1rem' }}>
              <div className="tablero-label">Pendiente</div>
              <div className="tablero-value">{fmt(totalPresentado)}</div>
            </div>
          </div>

          {/* Filtros */}
          <div className="card" style={{ marginBottom:'.75rem' }}>
            <div className="search-row">
              <input type="search" className="input" placeholder="Buscar en ingresos…"
                value={busqText} onChange={e => setBusqText(e.target.value)} />
            </div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:8 }}>
              <select className="select" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
                <option value="">Todos los estados</option>
                <option value="PRESENTADO">PRESENTADO</option>
                <option value="PAGADO">PAGADO</option>
              </select>
              <select className="select" value={filtroMes} onChange={e => setFiltroMes(e.target.value)}>
                <option value="">Todos los meses</option>
                {mesesFiltro.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
              {(busqText||filtroEstado||filtroMes) && (
                <button className="btn btn-secondary btn-sm"
                  onClick={() => { setBusqText(''); setFiltroEstado(''); setFiltroMes(''); }}>
                  ✕ Limpiar
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div style={{ display:'flex', alignItems:'center', gap:'.75rem', color:'var(--text3)', padding:'2rem 0' }}>
              <span className="spinner"/> Cargando ingresos…
            </div>
          ) : (
            <>
              <p style={{ fontSize:'.8rem', color:'var(--text3)', margin:'.5rem 0' }}>
                {filtrados.length} registro{filtrados.length!==1?'s':''} ·{' '}
                <strong style={{ color:'var(--green)' }}>{fmt(totalFiltrado)}</strong>
              </p>
              {filtrados.length === 0 ? (
                <div className="empty-state"><div className="empty-icon">💰</div><p>Sin ingresos registrados</p></div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:'.4rem' }}>
                  {filtrados.map(e => (
                    <div key={e.id} className="result-item">
                      <div className="result-body" style={{ flex:1 }}>
                        <div className="result-name" style={{ display:'flex', justifyContent:'space-between' }}>
                          <span>{e.concepto}</span>
                          <span style={{ fontWeight:700, color:'var(--green)' }}>{fmt(e.monto)}</span>
                        </div>
                        <div className="result-meta">
                          {e.fecha       && <span>{e.fecha}</span>}
                          <span className={`badge ${e.estado==='PAGADO'?'badge-green':'badge-amber'}`}>{e.estado}</span>
                          {e.obraSocial  && <span>{e.obraSocial}</span>}
                          {e.nroFactura  && <span>Fact. {e.nroFactura}</span>}
                        </div>
                      </div>
                      <div className="result-actions" style={{ display:'flex', flexDirection:'column', gap:4 }}>
                        {e.estado !== 'PAGADO' && e.id && (
                          <button className="btn btn-secondary btn-sm"
                            style={{ color:'var(--green)', borderColor:'var(--green)', fontSize:'.72rem' }}
                            disabled={pagando === e.id}
                            onClick={ev => marcarPagado(e.id, ev)}>
                            {pagando === e.id ? '…' : '✓ Cobrado'}
                          </button>
                        )}
                        <button className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setForm({ id:e.id, fecha:e.fecha, nroFactura:e.nroFactura, concepto:e.concepto,
                              monto:String(e.monto), obraSocial:e.obraSocial, estado:e.estado, observaciones:e.observaciones });
                            setTab('carga');
                          }}>✏ Editar</button>
                        {confirmDel === e.id ? (
                          <div style={{ display:'flex', gap:2 }}>
                            <button className="btn btn-danger btn-sm" onClick={() => eliminar(e.id)}>✓</button>
                            <button className="btn btn-secondary btn-sm" onClick={() => setConfirmDel(null)}>✕</button>
                          </div>
                        ) : (
                          <button className="btn btn-secondary btn-sm" onClick={() => setConfirmDel(e.id)}>🗑</button>
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

      {/* ═══ TAB ESTADÍSTICAS ═══ */}
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
              <span className="spinner"/>
            </div>
          ) : (
            <>
              <div className="tablero" style={{ gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', marginBottom:'1.25rem' }}>
                <div className="tablero-card green">
                  <div className="tablero-label">Total del mes</div>
                  <div className="tablero-value">{fmt(totalMes)}</div>
                  <div className="tablero-sub">{ingDelMes.length} registros</div>
                </div>
                <div className="tablero-card green">
                  <div className="tablero-label">Cobrado</div>
                  <div className="tablero-value">{fmt(pagadosMes)}</div>
                </div>
                <div className="tablero-card amber">
                  <div className="tablero-label">Presentado</div>
                  <div className="tablero-value">{fmt(presentadosMes)}</div>
                </div>
              </div>

              {porObraSocial.length === 0 ? (
                <div className="empty-state"><div className="empty-icon">📊</div>
                  <p>Sin ingresos para {MESES[statsMes]} {statsAnio}</p></div>
              ) : (
                <div className="card">
                  <div className="card-title">Por obra social — {MESES[statsMes]} {statsAnio}</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:'.6rem', marginTop:'.5rem' }}>
                    {porObraSocial.map(o => (
                      <div key={o.os}>
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:'.82rem', marginBottom:3 }}>
                          <span style={{ color:'var(--text2)', fontWeight:500 }}>{o.os}</span>
                          <span style={{ color:'var(--text)', fontWeight:700 }}>{fmt(o.total)}</span>
                        </div>
                        <div style={{ height:8, background:'var(--bg4)', borderRadius:4, overflow:'hidden' }}>
                          <div style={{
                            height:'100%', borderRadius:4, background:'var(--green)',
                            width:`${(o.total/maxOS)*100}%`, transition:'width .4s ease',
                          }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
