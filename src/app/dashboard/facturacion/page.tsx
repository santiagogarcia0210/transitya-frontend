'use client';
import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import { serializarFirestore, toArray } from '@/lib/utils';

type Tab = 'comprobantes' | 'arca';

const ESTADOS_FAC   = ['PENDIENTE', 'PAGADO', 'ANULADO'];
const ESTADOS_ARCA  = ['emitida', 'cobrada', 'anulada'] as const;
const TIPOS_ARCA    = [
  'Factura A','Factura B','Factura C',
  'Factura de Crédito Electrónica MiPyME A',
  'Factura de Crédito Electrónica MiPyME B',
  'Factura de Crédito Electrónica MiPyME C',
];
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

/* ─── Tipos ─────────────────────────────────────────────────────────── */

interface Factura {
  id:string; nro:string; fecha:string; cliente:string;
  monto:number; estado:string; concepto:string;
}
interface FacturaARCA {
  id:string; tipoComprobante:string; puntoVenta:string; numero:string;
  cae:string; fecha:string; cliente:string; cuitCliente:string;
  concepto:string; monto:number; estado:string;
}
interface FormFac {
  id:string; nro:string; fecha:string; cliente:string;
  monto:string; estado:string; concepto:string;
}
interface FormARCA {
  id:string; tipoComprobante:string; puntoVenta:string; numero:string;
  cae:string; fecha:string; cliente:string; cuitCliente:string;
  concepto:string; monto:string;
}

function normFac(f:Record<string,unknown>):Factura {
  return {
    id:String(f.id||''), nro:String(f.nro||f.numero||f.nroFactura||f['NRO FACTURA']||''),
    fecha:String(f.fecha||f.FECHA||''), cliente:String(f.cliente||f.CLIENTE||f.razonSocial||''),
    monto:Number(f.monto||f.MONTO||f.total||0),
    estado:String(f.estado||f.ESTADO||'PENDIENTE').toUpperCase(),
    concepto:String(f.concepto||f.CONCEPTO||f.descripcion||''),
  };
}
function normARCA(f:Record<string,unknown>):FacturaARCA {
  const pv=String(f.puntoVenta||f.punto_venta||f.pv||'0').padStart(4,'0');
  const num=String(f.numero||f.nro||'0').padStart(8,'0');
  return {
    id:String(f.id||''),
    tipoComprobante:String(f.tipoComprobante||f.tipo||'Factura B'),
    puntoVenta:pv, numero:num,
    cae:String(f.cae||f.CAE||''),
    fecha:String(f.fecha||f.FECHA||''),
    cliente:String(f.cliente||f.CLIENTE||f.razonSocial||''),
    cuitCliente:String(f.cuitCliente||f.cuit||f.CUIT||''),
    concepto:String(f.concepto||f.CONCEPTO||''),
    monto:Number(f.monto||f.MONTO||f.importe||0),
    estado:String(f.estado||f.ESTADO||'emitida').toLowerCase(),
  };
}

const BADGE_FAC:Record<string,string>={ PAGADO:'badge-green', PENDIENTE:'badge-amber', ANULADO:'badge-red' };
const BADGE_ARCA:Record<string,string>={ cobrada:'badge-green', emitida:'badge-blue', anulada:'badge-red' };

const fmt=(n:number)=>n.toLocaleString('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0});
const L:React.CSSProperties={display:'block',fontSize:'.78rem',color:'var(--text3)',marginBottom:'.3rem',fontWeight:500};

const EMPTY_FAC:FormFac={id:'',nro:'',fecha:'',cliente:'',monto:'',estado:'PENDIENTE',concepto:''};
const EMPTY_ARCA:FormARCA={id:'',tipoComprobante:'Factura B',puntoVenta:'',numero:'',cae:'',fecha:'',cliente:'',cuitCliente:'',concepto:'',monto:''};

/* ═══════════════════════════════════════════════════════════════════════ */

export default function FacturacionPage() {
  const hoy=new Date(); const anioAct=hoy.getFullYear();
  const [tab, setTab] = useState<Tab>('comprobantes');

  /* ── Tab Comprobantes ─────────────────────────────────────────────── */
  const [lista,    setLista]    = useState<Factura[]>([]);
  const [loadingF, setLoadingF] = useState(true);
  const [busq,     setBusq]     = useState('');
  const [filtEst,  setFiltEst]  = useState('');
  const [filtMes,  setFiltMes]  = useState('');
  const [modal,    setModal]    = useState(false);
  const [form,     setForm]     = useState<FormFac>(EMPTY_FAC);
  const [saving,   setSaving]   = useState(false);
  const [delId,    setDelId]    = useState<string|null>(null);
  const [msg,      setMsg]      = useState<{text:string;ok:boolean}|null>(null);

  const cargarFac=async()=>{
    setLoadingF(true);
    try{const r=await api.get('/api/facturacion/facturas');setLista(toArray(r.data).map(serializarFirestore).map(normFac));}
    catch{/*silent*/}finally{setLoadingF(false);}
  };
  useEffect(()=>{if(tab==='comprobantes')cargarFac();},[tab]);

  const mesesFiltro=Array.from({length:12},(_,i)=>{
    const d=new Date(anioAct,hoy.getMonth()-i,1);
    const m=String(d.getMonth()+1).padStart(2,'0'),a=d.getFullYear();
    return{value:`${m}-${a}`,label:`${MESES[d.getMonth()]} ${a}`};
  });
  const filtrados=lista.filter(f=>{
    const q=busq.toLowerCase();
    if(q&&!f.cliente.toLowerCase().includes(q)&&!f.nro.includes(q)&&!f.concepto.toLowerCase().includes(q))return false;
    if(filtEst&&f.estado!==filtEst)return false;
    if(filtMes){const[m,a]=filtMes.split('-');if(!f.fecha.includes(`/${m}/${a}`)&&!f.fecha.startsWith(`${a}-${m}`))return false;}
    return true;
  });
  const totFil=filtrados.reduce((s,f)=>s+f.monto,0);
  const totPag=filtrados.filter(f=>f.estado==='PAGADO').reduce((s,f)=>s+f.monto,0);
  const totPend=filtrados.filter(f=>f.estado==='PENDIENTE').reduce((s,f)=>s+f.monto,0);
  const sfFac=(k:keyof FormFac)=>(ev:React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>)=>setForm(f=>({...f,[k]:ev.target.value}));
  const abrirFac=(f?:Factura)=>{setForm(f?{id:f.id,nro:f.nro,fecha:f.fecha,cliente:f.cliente,monto:String(f.monto),estado:f.estado,concepto:f.concepto}:EMPTY_FAC);setMsg(null);setModal(true);};
  const cerrarFac=()=>{setModal(false);setMsg(null);};
  const guardarFac=async()=>{
    if(!form.fecha||!form.cliente||!form.monto){setMsg({text:'Completá fecha, cliente y monto',ok:false});return;}
    setSaving(true);setMsg(null);
    try{form.id?await api.put(`/api/facturacion/facturas/${form.id}`,form):await api.post('/api/facturacion/facturas',form);cerrarFac();cargarFac();}
    catch{setMsg({text:'Error al guardar',ok:false});}
    setSaving(false);
  };
  const eliminarFac=async(id:string)=>{try{await api.delete(`/api/facturacion/facturas/${id}`);setDelId(null);cargarFac();}catch{/*silent*/}};

  /* ── Tab AFIP/ARCA ────────────────────────────────────────────────── */
  const [arca,      setArca]      = useState<FacturaARCA[]>([]);
  const [loadingA,  setLoadingA]  = useState(false);
  const [filtTipo,  setFiltTipo]  = useState('');
  const [filtDesde, setFiltDesde] = useState('');
  const [filtHasta, setFiltHasta] = useState('');
  const [modalA,    setModalA]    = useState(false);
  const [formA,     setFormA]     = useState<FormARCA>(EMPTY_ARCA);
  const [savingA,   setSavingA]   = useState(false);
  const [pagandoId, setPagandoId] = useState<string|null>(null);
  const [msgA,      setMsgA]      = useState<{text:string;ok:boolean}|null>(null);

  const cargarArca=useCallback(async()=>{
    setLoadingA(true);
    try{const r=await api.get('/api/facturacion/arca');setArca(toArray(r.data).map(serializarFirestore).map(normARCA));}
    catch{/*silent*/}finally{setLoadingA(false);}
  },[]);
  useEffect(()=>{if(tab==='arca')cargarArca();},[tab,cargarArca]);

  const arcaFiltrada=arca.filter(f=>{
    if(filtTipo&&f.tipoComprobante!==filtTipo)return false;
    if(filtDesde&&f.fecha<filtDesde)return false;
    if(filtHasta&&f.fecha>filtHasta)return false;
    return true;
  });
  const totEmitido=arcaFiltrada.filter(f=>f.estado==='emitida'||f.estado==='cobrada').reduce((s,f)=>s+f.monto,0);
  const totCobrado=arcaFiltrada.filter(f=>f.estado==='cobrada').reduce((s,f)=>s+f.monto,0);
  const totPendA  =arcaFiltrada.filter(f=>f.estado==='emitida').reduce((s,f)=>s+f.monto,0);
  const sfA=(k:keyof FormARCA)=>(ev:React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>)=>setFormA(f=>({...f,[k]:ev.target.value}));
  const abrirA=(f?:FacturaARCA)=>{setFormA(f?{id:f.id,tipoComprobante:f.tipoComprobante,puntoVenta:f.puntoVenta,numero:f.numero,cae:f.cae,fecha:f.fecha,cliente:f.cliente,cuitCliente:f.cuitCliente,concepto:f.concepto,monto:String(f.monto)}:EMPTY_ARCA);setMsgA(null);setModalA(true);};
  const cerrarA=()=>{setModalA(false);setMsgA(null);};
  const guardarA=async()=>{
    if(!formA.fecha||!formA.cliente||!formA.monto){setMsgA({text:'Completá fecha, cliente y monto',ok:false});return;}
    setSavingA(true);setMsgA(null);
    try{formA.id?await api.put(`/api/facturacion/arca/${formA.id}`,formA):await api.post('/api/facturacion/arca',formA);cerrarA();cargarArca();}
    catch{setMsgA({text:'Error al guardar',ok:false});}
    setSavingA(false);
  };
  const marcarCobrada=async(id:string,ev:React.MouseEvent)=>{
    ev.stopPropagation();setPagandoId(id);
    try{await api.patch(`/api/facturacion/arca/${id}/pagar`);cargarArca();}catch{/*silent*/}
    setPagandoId(null);
  };

  /* ─── Render ──────────────────────────────────────────────────────── */
  return (
    <div>
      <div className="section-header" style={{marginBottom:'1rem'}}>
        <h2 className="section-title">🧾 Facturación</h2>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:'.35rem',flexWrap:'wrap',marginBottom:'1.25rem',borderBottom:'1px solid var(--border)',paddingBottom:'.75rem'}}>
        {([
          {key:'comprobantes' as Tab, label:'📄 Comprobantes'},
          {key:'arca'          as Tab, label:'🏛️ AFIP/ARCA'},
        ] as {key:Tab;label:string}[]).map(t=>(
          <button key={t.key} className={tab===t.key?'btn btn-primary':'btn btn-secondary'}
            style={{fontSize:'.82rem'}} onClick={()=>setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      {/* ══ TAB COMPROBANTES ══════════════════════════════════════════ */}
      {tab==='comprobantes'&&(
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'.75rem',flexWrap:'wrap',gap:'.5rem'}}>
            <p style={{fontSize:'.82rem',color:'var(--text3)'}}>
              {filtrados.length} factura{filtrados.length!==1?'s':''} · <strong style={{color:'var(--text)'}}>{fmt(totFil)}</strong>
              {totPend>0&&<span style={{color:'var(--amber)'}}> · {fmt(totPend)} pendiente</span>}
            </p>
            <button className="btn btn-primary" onClick={()=>abrirFac()}>+ Nueva factura</button>
          </div>
          {totPag>0&&(
            <div style={{display:'flex',gap:'1rem',marginBottom:'.75rem',flexWrap:'wrap'}}>
              {[['Cobrado',totPag,'var(--green)'],['Pendiente',totPend,'var(--amber)']].map(([l,v,c])=>(
                <div key={String(l)} className="card" style={{padding:'.6rem 1rem',flex:1,minWidth:160}}>
                  <p style={{fontSize:'.72rem',color:'var(--text3)',marginBottom:'.2rem'}}>{l}</p>
                  <p style={{fontSize:'1rem',fontWeight:700,color:String(c)}}>{fmt(Number(v))}</p>
                </div>
              ))}
            </div>
          )}
          <div className="filter-bar">
            <input className="input" placeholder="Buscar cliente, N° o concepto…" value={busq} onChange={e=>setBusq(e.target.value)}/>
            <select className="select" value={filtEst} onChange={e=>setFiltEst(e.target.value)}>
              <option value="">Todos los estados</option>
              {ESTADOS_FAC.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
            <select className="select" value={filtMes} onChange={e=>setFiltMes(e.target.value)}>
              <option value="">Todos los meses</option>
              {mesesFiltro.map(m=><option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            {(busq||filtEst||filtMes)&&<button className="btn btn-secondary" style={{fontSize:'.78rem'}} onClick={()=>{setBusq('');setFiltEst('');setFiltMes('');}}>✕</button>}
          </div>
          {loadingF?(
            <div style={{display:'flex',alignItems:'center',gap:'.75rem',color:'var(--text3)',padding:'2rem'}}><span className="spinner"/> Cargando…</div>
          ):filtrados.length===0?(
            <div className="empty-state"><div className="empty-icon">🧾</div><p>Sin facturas</p></div>
          ):(
            <div style={{display:'flex',flexDirection:'column',gap:'.4rem'}}>
              {filtrados.map(f=>(
                <div key={f.id} className="card"
                  style={{display:'flex',alignItems:'center',gap:'1rem',padding:'.75rem 1rem',cursor:'pointer'}}
                  onClick={()=>abrirFac(f)}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:'.5rem',flexWrap:'wrap'}}>
                      <span style={{fontSize:'.88rem',fontWeight:600,color:'var(--text)'}}>{f.cliente||'Sin cliente'}</span>
                      {f.nro&&<span className="badge badge-gray">#{f.nro}</span>}
                      <span className={`badge ${BADGE_FAC[f.estado]||'badge-gray'}`}>{f.estado}</span>
                    </div>
                    <p style={{fontSize:'.78rem',color:'var(--text3)',marginTop:'.15rem'}}>{f.fecha}{f.concepto&&` · ${f.concepto}`}</p>
                  </div>
                  <p style={{fontSize:'1rem',fontWeight:700,color:'var(--text)',whiteSpace:'nowrap'}}>{fmt(f.monto)}</p>
                  {delId===f.id?(
                    <div style={{display:'flex',gap:'.4rem'}} onClick={ev=>ev.stopPropagation()}>
                      <button className="btn btn-danger" style={{fontSize:'.72rem',padding:'.3rem .6rem'}} onClick={()=>eliminarFac(f.id)}>Confirmar</button>
                      <button className="btn btn-secondary" style={{fontSize:'.72rem',padding:'.3rem .6rem'}} onClick={()=>setDelId(null)}>✕</button>
                    </div>
                  ):(
                    <button className="btn btn-secondary" style={{fontSize:'.72rem',padding:'.3rem .6rem'}}
                      onClick={ev=>{ev.stopPropagation();setDelId(f.id);}}>🗑</button>
                  )}
                </div>
              ))}
            </div>
          )}
          {modal&&(
            <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.65)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50,padding:'1rem'}}
              onClick={e=>{if(e.target===e.currentTarget)cerrarFac();}}>
              <div className="card" style={{width:'100%',maxWidth:'520px',maxHeight:'90vh',overflowY:'auto',padding:'1.5rem'}}>
                <h3 style={{fontSize:'1rem',fontWeight:700,color:'var(--text)',marginBottom:'1.25rem'}}>{form.id?'✏️ Editar':'+ Nueva factura'}</h3>
                <div className="form-grid">
                  <div className="form-grid form-grid-2">
                    <div><label style={L}>Fecha *</label><input type="date" className="input" value={form.fecha} onChange={sfFac('fecha')}/></div>
                    <div><label style={L}>N° Factura</label><input className="input" placeholder="0001-00000001" value={form.nro} onChange={sfFac('nro')}/></div>
                  </div>
                  <div><label style={L}>Cliente *</label><input className="input" value={form.cliente} onChange={sfFac('cliente')}/></div>
                  <div className="form-grid form-grid-2">
                    <div><label style={L}>Monto *</label><input type="number" className="input" value={form.monto} onChange={sfFac('monto')}/></div>
                    <div><label style={L}>Estado</label>
                      <select className="select" value={form.estado} onChange={sfFac('estado')}>
                        {ESTADOS_FAC.map(s=><option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  <div><label style={L}>Concepto</label><textarea className="textarea" rows={2} value={form.concepto} onChange={sfFac('concepto')}/></div>
                </div>
                {msg&&<p style={{fontSize:'.82rem',color:msg.ok?'var(--green)':'var(--red)',marginTop:'.75rem'}}>{msg.text}</p>}
                <div style={{display:'flex',gap:'.75rem',marginTop:'1.25rem'}}>
                  <button className="btn btn-secondary" style={{flex:1}} onClick={cerrarFac}>Cancelar</button>
                  <button className="btn btn-primary" style={{flex:1}} onClick={guardarFac} disabled={saving}>
                    {saving?<><span className="spinner" style={{width:12,height:12}}/>Guardando…</>:form.id?'Actualizar':'Guardar'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ TAB AFIP/ARCA ══════════════════════════════════════════════ */}
      {tab==='arca'&&(
        <div>
          {/* Resumen */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'1rem',marginBottom:'1.25rem'}}>
            {[
              {l:'Total emitido', v:fmt(totEmitido), c:'var(--text)'},
              {l:'Cobrado',        v:fmt(totCobrado),  c:'var(--green)'},
              {l:'Pendiente cobro',v:fmt(totPendA),    c:'var(--amber)'},
            ].map(s=>(
              <div key={s.l} className="stat-card">
                <p className="stat-label">{s.l}</p>
                <p className="stat-value" style={{color:s.c,fontSize:'1.4rem'}}>{s.v}</p>
              </div>
            ))}
          </div>

          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'.75rem',flexWrap:'wrap',gap:'.5rem'}}>
            <p style={{fontSize:'.82rem',color:'var(--text3)'}}>{arcaFiltrada.length} factura{arcaFiltrada.length!==1?'s':''} ARCA</p>
            <button className="btn btn-primary" onClick={()=>abrirA()}>+ Nueva factura ARCA</button>
          </div>

          {/* Filtros */}
          <div className="filter-bar">
            <select className="select" value={filtTipo} onChange={e=>setFiltTipo(e.target.value)}>
              <option value="">Todos los tipos</option>
              {TIPOS_ARCA.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
            <div style={{display:'flex',alignItems:'center',gap:'.35rem'}}>
              <label style={{fontSize:'.78rem',color:'var(--text3)',whiteSpace:'nowrap'}}>Desde</label>
              <input type="date" className="input" style={{width:145}} value={filtDesde} onChange={e=>setFiltDesde(e.target.value)}/>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:'.35rem'}}>
              <label style={{fontSize:'.78rem',color:'var(--text3)',whiteSpace:'nowrap'}}>Hasta</label>
              <input type="date" className="input" style={{width:145}} value={filtHasta} onChange={e=>setFiltHasta(e.target.value)}/>
            </div>
            {(filtTipo||filtDesde||filtHasta)&&<button className="btn btn-secondary" style={{fontSize:'.78rem'}} onClick={()=>{setFiltTipo('');setFiltDesde('');setFiltHasta('');}}>✕</button>}
          </div>

          {loadingA?(
            <div style={{display:'flex',alignItems:'center',gap:'.75rem',color:'var(--text3)',padding:'2rem'}}><span className="spinner"/> Cargando…</div>
          ):arcaFiltrada.length===0?(
            <div className="empty-state"><div className="empty-icon">🏛️</div><p>Sin facturas ARCA</p></div>
          ):(
            <div className="tabla-wrap">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Número</th>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th style={{textAlign:'right'}}>Monto</th>
                    <th style={{textAlign:'center'}}>Estado</th>
                    <th>CAE</th>
                    <th style={{width:120}}></th>
                  </tr>
                </thead>
                <tbody>
                  {arcaFiltrada.map(f=>(
                    <tr key={f.id} style={{cursor:'pointer'}} onClick={()=>abrirA(f)}>
                      <td style={{fontSize:'.78rem'}}>{f.tipoComprobante}</td>
                      <td style={{fontFamily:'monospace',fontSize:'.82rem'}}>{f.puntoVenta}-{f.numero}</td>
                      <td>{f.fecha}</td>
                      <td style={{fontWeight:500,color:'var(--text)'}}>{f.cliente}</td>
                      <td style={{textAlign:'right',fontWeight:700}}>{fmt(f.monto)}</td>
                      <td style={{textAlign:'center'}}>
                        <span className={`badge ${BADGE_ARCA[f.estado]||'badge-gray'}`}>{f.estado}</span>
                      </td>
                      <td style={{fontFamily:'monospace',fontSize:'.72rem',color:'var(--text3)'}}>{f.cae||'—'}</td>
                      <td onClick={ev=>ev.stopPropagation()}>
                        {f.estado==='emitida'&&(
                          <button className="btn btn-primary" style={{fontSize:'.72rem',padding:'.3rem .6rem'}}
                            disabled={pagandoId===f.id}
                            onClick={ev=>marcarCobrada(f.id,ev)}>
                            {pagandoId===f.id?<span className="spinner" style={{width:10,height:10}}/>:'✓ Cobrada'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Modal nueva ARCA */}
          {modalA&&(
            <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.65)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50,padding:'1rem'}}
              onClick={e=>{if(e.target===e.currentTarget)cerrarA();}}>
              <div className="card" style={{width:'100%',maxWidth:'580px',maxHeight:'90vh',overflowY:'auto',padding:'1.5rem'}}>
                <h3 style={{fontSize:'1rem',fontWeight:700,color:'var(--text)',marginBottom:'1.25rem'}}>
                  {formA.id?'✏️ Editar factura ARCA':'+ Nueva factura ARCA'}
                </h3>
                <div className="form-grid">
                  <div>
                    <label style={L}>Tipo de comprobante</label>
                    <select className="select" value={formA.tipoComprobante} onChange={sfA('tipoComprobante')}>
                      {TIPOS_ARCA.map(t=><option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-grid form-grid-2">
                    <div><label style={L}>Punto de venta</label><input type="number" className="input" placeholder="0001" value={formA.puntoVenta} onChange={sfA('puntoVenta')}/></div>
                    <div><label style={L}>Número</label><input type="number" className="input" placeholder="00000001" value={formA.numero} onChange={sfA('numero')}/></div>
                  </div>
                  <div className="form-grid form-grid-2">
                    <div><label style={L}>Fecha *</label><input type="date" className="input" value={formA.fecha} onChange={sfA('fecha')}/></div>
                    <div><label style={L}>CAE</label><input className="input" placeholder="12345678901234" value={formA.cae} onChange={sfA('cae')}/></div>
                  </div>
                  <div className="form-grid form-grid-2">
                    <div><label style={L}>Cliente *</label><input className="input" placeholder="Razón social" value={formA.cliente} onChange={sfA('cliente')}/></div>
                    <div><label style={L}>CUIT cliente</label><input className="input" placeholder="30-12345678-9" value={formA.cuitCliente} onChange={sfA('cuitCliente')}/></div>
                  </div>
                  <div className="form-grid form-grid-2">
                    <div><label style={L}>Monto *</label><input type="number" className="input" placeholder="0" value={formA.monto} onChange={sfA('monto')}/></div>
                    <div><label style={L}>Concepto</label><input className="input" placeholder="Descripción" value={formA.concepto} onChange={sfA('concepto')}/></div>
                  </div>
                </div>
                {msgA&&<p style={{fontSize:'.82rem',color:msgA.ok?'var(--green)':'var(--red)',marginTop:'.75rem'}}>{msgA.text}</p>}
                <div style={{display:'flex',gap:'.75rem',marginTop:'1.25rem'}}>
                  <button className="btn btn-secondary" style={{flex:1}} onClick={cerrarA}>Cancelar</button>
                  <button className="btn btn-primary" style={{flex:1}} onClick={guardarA} disabled={savingA}>
                    {savingA?<><span className="spinner" style={{width:12,height:12}}/>Guardando…</>:formA.id?'Actualizar':'Guardar'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
