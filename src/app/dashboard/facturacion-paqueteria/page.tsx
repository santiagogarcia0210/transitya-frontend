'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { serializarFirestore, toArray } from '@/lib/utils';
import { useEmpresaTipo } from '@/hooks/useEmpresaTipo';

const ESTADOS_FAC = ['Pendiente', 'Pagada'] as const;

interface Factura {
  id: string; clienteId: string; clienteNombre: string; fecha: string;
  enviosIds: string[]; subtotal: number; descuento: number; total: number;
  estado: string; observaciones: string;
}
interface FormState {
  id: string; clienteId: string; fecha: string;
  enviosIds: string[]; descuento: string; estado: string; observaciones: string;
}
interface Envio { id: string; nroEnvio: string; clienteNombre: string; monto: number; estado: string; }
interface Selectable { id: string; nombre: string; }

function normFac(f: Record<string, unknown>): Factura {
  const ids = Array.isArray(f.enviosIds) ? f.enviosIds.map(String) : [];
  return {
    id:            String(f.id            || ''),
    clienteId:     String(f.clienteId     || f.cliente_id  || ''),
    clienteNombre: String(f.clienteNombre || f.cliente     || ''),
    fecha:         String(f.fecha         || f.FECHA       || ''),
    enviosIds:     ids,
    subtotal:      Number(f.subtotal      || 0),
    descuento:     Number(f.descuento     || 0),
    total:         Number(f.total         || 0),
    estado:        String(f.estado        || 'Pendiente'),
    observaciones: String(f.observaciones || ''),
  };
}

const fmt = (n: number) =>
  n.toLocaleString('es-AR', { style:'currency', currency:'ARS', maximumFractionDigits:0 });
const L: React.CSSProperties = {display:'block',fontSize:'.78rem',color:'var(--text3)',marginBottom:'.3rem',fontWeight:500};
const EMPTY: FormState = { id:'', clienteId:'', fecha:'', enviosIds:[], descuento:'0', estado:'Pendiente', observaciones:'' };

export default function FacturacionPaqueteriaPage() {
  const router = useRouter();
  const { tipo, loading: tipoLoading } = useEmpresaTipo();

  const [lista,      setLista]      = useState<Factura[]>([]);
  const [clientes,   setClientes]   = useState<Selectable[]>([]);
  const [envios,     setEnvios]     = useState<Envio[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [filtroEst,  setFiltroEst]  = useState('');
  const [modal,      setModal]      = useState(false);
  const [form,       setForm]       = useState<FormState>(EMPTY);
  const [saving,     setSaving]     = useState(false);
  const [pagandoId,  setPagandoId]  = useState<string|null>(null);
  const [delId,      setDelId]      = useState<string|null>(null);
  const [msg,        setMsg]        = useState<{text:string;ok:boolean}|null>(null);

  useEffect(() => {
    if (!tipoLoading && tipo !== null && tipo !== 'paqueteria') router.replace('/dashboard');
  }, [tipo, tipoLoading, router]);

  const cargar = async () => {
    setLoading(true);
    try {
      const [facRes, cliRes, envRes] = await Promise.allSettled([
        api.get('/api/facturacion-paqueteria'),
        api.get('/api/clientes'),
        api.get('/api/envios'),
      ]);
      if (facRes.status==='fulfilled') setLista(toArray(facRes.value.data).map(serializarFirestore).map(normFac));
      if (cliRes.status==='fulfilled')
        setClientes(toArray(cliRes.value.data).map(serializarFirestore)
          .map((c: Record<string,unknown>) => ({ id:String(c.id||''), nombre:String(c.nombre||'') })));
      if (envRes.status==='fulfilled')
        setEnvios(toArray(envRes.value.data).map(serializarFirestore).map((e: Record<string,unknown>) => ({
          id:String(e.id||''), nroEnvio:String(e.nroEnvio||e.tracking||''),
          clienteNombre:String(e.clienteNombre||e.cliente||''),
          monto:Number(e.monto||0), estado:String(e.estado||''),
        })));
    } catch { /* silent */ } finally { setLoading(false); }
  };
  useEffect(() => { if (tipo==='paqueteria') cargar(); }, [tipo]);

  // Calcular subtotal en base a envíos seleccionados
  const subtotalForm = form.enviosIds.reduce((s, id) => {
    const e = envios.find(e=>e.id===id);
    return s + (e?.monto||0);
  }, 0);
  const totalForm = Math.max(0, subtotalForm - Number(form.descuento||0));

  // Envíos disponibles para el cliente seleccionado
  const enviosCliente = form.clienteId
    ? envios.filter(e => {
        const cli = clientes.find(c=>c.id===form.clienteId);
        return !form.clienteId || e.clienteNombre === cli?.nombre || true; // mostrar todos si no podemos filtrar por id
      })
    : envios;

  const sf = (k: keyof Omit<FormState,'enviosIds'>) =>
    (ev: React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: ev.target.value }));

  const toggleEnvio = (id: string) =>
    setForm(f => ({
      ...f,
      enviosIds: f.enviosIds.includes(id) ? f.enviosIds.filter(x=>x!==id) : [...f.enviosIds, id],
    }));

  const abrir = (f?: Factura) => {
    setForm(f ? { id:f.id, clienteId:f.clienteId, fecha:f.fecha, enviosIds:f.enviosIds,
      descuento:String(f.descuento||0), estado:f.estado, observaciones:f.observaciones }
    : { ...EMPTY, fecha:new Date().toISOString().split('T')[0] });
    setMsg(null); setModal(true);
  };
  const cerrar = () => { setModal(false); setMsg(null); };

  const guardar = async () => {
    if (!form.clienteId) { setMsg({ text:'Seleccioná un cliente', ok:false }); return; }
    setSaving(true); setMsg(null);
    const payload = { ...form, subtotal:subtotalForm, total:totalForm };
    try {
      form.id ? await api.put(`/api/facturacion-paqueteria/${form.id}`, payload)
              : await api.post('/api/facturacion-paqueteria', payload);
      cerrar(); cargar();
    } catch { setMsg({ text:'Error al guardar', ok:false }); }
    setSaving(false);
  };

  const marcarPagada = async (id: string, ev: React.MouseEvent) => {
    ev.stopPropagation();
    setPagandoId(id);
    try { await api.put(`/api/facturacion-paqueteria/${id}`, { estado:'Pagada' }); cargar(); }
    catch { /* silent */ }
    setPagandoId(null);
  };

  const eliminar = async (id: string) => {
    try { await api.delete(`/api/facturacion-paqueteria/${id}`); setDelId(null); cargar(); } catch { /* silent */ }
  };

  const filtrados = filtroEst ? lista.filter(f=>f.estado===filtroEst) : lista;
  const totalPendiente = lista.filter(f=>f.estado==='Pendiente').reduce((s,f)=>s+f.total,0);
  const totalCobrado   = lista.filter(f=>f.estado==='Pagada').reduce((s,f)=>s+f.total,0);

  if (tipoLoading) return <div style={{padding:'2rem',color:'var(--text3)'}}><span className="spinner"/> Verificando…</div>;
  if (tipo !== 'paqueteria') return null;

  return (
    <div>
      <div className="section-header">
        <div>
          <h2 className="section-title">💰 Facturación Paquetería</h2>
          <p style={{fontSize:'.82rem',color:'var(--text3)',marginTop:'.2rem'}}>
            {filtrados.length} factura{filtrados.length!==1?'s':''}
          </p>
        </div>
        <button className="btn btn-primary" onClick={()=>abrir()}>+ Nueva factura</button>
      </div>

      {/* Resumen */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'1rem',marginBottom:'1.25rem'}}>
        <div className="stat-card"><p className="stat-label">Total facturas</p><p className="stat-value" style={{color:'var(--text)'}}>{lista.length}</p></div>
        <div className="stat-card"><p className="stat-label">Pendiente</p><p className="stat-value" style={{color:'var(--amber)'}}>{fmt(totalPendiente)}</p></div>
        <div className="stat-card"><p className="stat-label">Cobrado</p><p className="stat-value" style={{color:'var(--green)'}}>{fmt(totalCobrado)}</p></div>
      </div>

      <div className="filter-bar">
        {ESTADOS_FAC.map(s => (
          <button key={s} className={filtroEst===s?'btn btn-primary':'btn btn-secondary'}
            style={{fontSize:'.82rem'}} onClick={()=>setFiltroEst(filtroEst===s?'':s)}>{s}</button>
        ))}
        {filtroEst && <button className="btn btn-secondary" style={{fontSize:'.78rem'}} onClick={()=>setFiltroEst('')}>✕ Todos</button>}
      </div>

      {loading ? (
        <div style={{display:'flex',alignItems:'center',gap:'.75rem',color:'var(--text3)',padding:'2rem'}}><span className="spinner"/> Cargando…</div>
      ) : filtrados.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">💰</div><p>Sin facturas</p></div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:'.4rem'}}>
          {filtrados.map(f => (
            <div key={f.id} className="card"
              style={{display:'flex',alignItems:'center',gap:'1rem',padding:'.75rem 1rem',cursor:'pointer'}}
              onClick={()=>abrir(f)}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:'.5rem',flexWrap:'wrap'}}>
                  <span style={{fontSize:'.88rem',fontWeight:600,color:'var(--text)'}}>{f.clienteNombre||'Sin cliente'}</span>
                  <span className={`badge ${f.estado==='Pagada'?'badge-green':'badge-amber'}`}>{f.estado}</span>
                  {f.enviosIds.length>0 && <span className="badge badge-gray">{f.enviosIds.length} envío{f.enviosIds.length!==1?'s':''}</span>}
                </div>
                <p style={{fontSize:'.78rem',color:'var(--text3)',marginTop:'.15rem'}}>
                  {f.fecha}
                  {f.descuento>0 && ` · Desc: ${fmt(f.descuento)}`}
                </p>
              </div>
              <p style={{fontSize:'1rem',fontWeight:700,color:'var(--text)',whiteSpace:'nowrap'}}>{fmt(f.total)}</p>
              {f.estado!=='Pagada' && (
                <button className="btn btn-primary" style={{fontSize:'.72rem',padding:'.3rem .7rem',flexShrink:0}}
                  disabled={pagandoId===f.id}
                  onClick={ev=>marcarPagada(f.id, ev)}>
                  {pagandoId===f.id?<span className="spinner" style={{width:10,height:10}}/>:'✓ Pagada'}
                </button>
              )}
              {delId===f.id ? (
                <div style={{display:'flex',gap:'.4rem'}} onClick={ev=>ev.stopPropagation()}>
                  <button className="btn btn-danger" style={{fontSize:'.72rem',padding:'.3rem .6rem'}} onClick={()=>eliminar(f.id)}>Confirmar</button>
                  <button className="btn btn-secondary" style={{fontSize:'.72rem',padding:'.3rem .6rem'}} onClick={()=>setDelId(null)}>✕</button>
                </div>
              ) : (
                <button className="btn btn-secondary" style={{fontSize:'.72rem',padding:'.3rem .6rem'}}
                  onClick={ev=>{ev.stopPropagation();setDelId(f.id);}}>🗑</button>
              )}
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.65)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50,padding:'1rem'}}
          onClick={ev=>{if(ev.target===ev.currentTarget)cerrar();}}>
          <div className="card" style={{width:'100%',maxWidth:'580px',maxHeight:'90vh',overflowY:'auto',padding:'1.5rem'}}>
            <h3 style={{fontSize:'1rem',fontWeight:700,color:'var(--text)',marginBottom:'1.25rem'}}>
              {form.id?'✏️ Editar factura':'+ Nueva factura'}
            </h3>
            <div className="form-grid">
              <div className="form-grid form-grid-2">
                <div>
                  <label style={L}>Cliente *</label>
                  <select className="select" value={form.clienteId} onChange={sf('clienteId')}>
                    <option value="">— Seleccioná —</option>
                    {clientes.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
                <div><label style={L}>Fecha</label><input type="date" className="input" value={form.fecha} onChange={sf('fecha')}/></div>
              </div>

              {/* Multi-select envíos */}
              <div>
                <label style={L}>Envíos incluidos ({form.enviosIds.length} sel.) · Subtotal: {fmt(subtotalForm)}</label>
                {enviosCliente.length === 0 ? (
                  <p style={{fontSize:'.82rem',color:'var(--text3)'}}>Sin envíos disponibles</p>
                ) : (
                  <div style={{maxHeight:180,overflowY:'auto',border:'1px solid var(--border2)',borderRadius:'var(--radius)',padding:'.25rem'}}>
                    {enviosCliente.map(e => {
                      const sel = form.enviosIds.includes(e.id);
                      return (
                        <div key={e.id} onClick={()=>toggleEnvio(e.id)}
                          style={{display:'flex',alignItems:'center',gap:'.6rem',padding:'.4rem .6rem',cursor:'pointer',
                            borderRadius:'var(--radius)',background:sel?'var(--blue-dim)':'transparent',
                            borderLeft:sel?'3px solid var(--blue)':'3px solid transparent',transition:'background 150ms'}}>
                          <span style={{width:16,height:16,borderRadius:3,border:`2px solid ${sel?'var(--blue)':'var(--border2)'}`,
                            background:sel?'var(--blue)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',
                            flexShrink:0,fontSize:'.65rem',color:'#fff'}}>{sel?'✓':''}</span>
                          <div style={{flex:1,minWidth:0}}>
                            <p style={{fontSize:'.82rem',color:'var(--text)',fontWeight:sel?600:400}}>
                              {e.clienteNombre}
                              {e.nroEnvio && <span style={{fontFamily:'monospace',marginLeft:'.4rem',fontSize:'.72rem',color:'var(--text3)'}}>{e.nroEnvio}</span>}
                            </p>
                          </div>
                          {e.monto>0 && <span style={{fontSize:'.78rem',fontWeight:600,color:'var(--green)',whiteSpace:'nowrap'}}>{fmt(e.monto)}</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="form-grid form-grid-2">
                <div><label style={L}>Descuento ($)</label><input type="number" className="input" placeholder="0" value={form.descuento} onChange={sf('descuento')}/></div>
                <div>
                  <label style={L}>Estado</label>
                  <select className="select" value={form.estado} onChange={sf('estado')}>
                    {ESTADOS_FAC.map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* Totales */}
              <div style={{background:'var(--bg4)',borderRadius:'var(--radius)',padding:'.75rem 1rem',display:'grid',gap:'.3rem'}}>
                {[['Subtotal',subtotalForm,'var(--text)'],['Descuento',-Number(form.descuento||0),'var(--red)'],['Total',totalForm,'var(--green)']].map(([label,val,color])=>(
                  <div key={String(label)} style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <span style={{fontSize:'.82rem',color:'var(--text3)'}}>{label}</span>
                    <span style={{fontSize:'.95rem',fontWeight:700,color:String(color)}}>{fmt(Number(val))}</span>
                  </div>
                ))}
              </div>

              <div><label style={L}>Observaciones</label><textarea className="textarea" rows={2} value={form.observaciones} onChange={sf('observaciones')}/></div>
            </div>
            {msg && <p style={{fontSize:'.82rem',color:msg.ok?'var(--green)':'var(--red)',marginTop:'.75rem'}}>{msg.text}</p>}
            <div style={{display:'flex',gap:'.75rem',marginTop:'1.25rem'}}>
              <button className="btn btn-secondary" style={{flex:1}} onClick={cerrar}>Cancelar</button>
              <button className="btn btn-primary" style={{flex:1}} onClick={guardar} disabled={saving}>
                {saving?<><span className="spinner" style={{width:12,height:12}}/>Guardando…</>:form.id?'Actualizar':'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
