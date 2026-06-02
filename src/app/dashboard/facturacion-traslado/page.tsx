'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { serializarFirestore, toArray } from '@/lib/utils';
import { useEmpresaTipo } from '@/hooks/useEmpresaTipo';

const ESTADOS_FAC = ['Pendiente','Pagada'] as const;

interface Factura {
  id:string; pasajeroId:string; pasajeroNombre:string; fecha:string;
  viajesIds:string[]; total:number; estado:string; observaciones:string;
}
interface FormState {
  id:string; pasajeroId:string; fecha:string;
  viajesIds:string[]; estado:string; observaciones:string;
}
interface Viaje { id:string; fecha:string; pasajeroNombre:string; origen:string; destino:string; monto:number; estado:string; }
interface Sel { id:string; nombre:string; }

function normFac(f: Record<string,unknown>): Factura {
  const ids=Array.isArray(f.viajesIds)?f.viajesIds.map(String):[];
  return {
    id:             String(f.id             ||''),
    pasajeroId:     String(f.pasajeroId     ||f.pasajero_id||''),
    pasajeroNombre: String(f.pasajeroNombre ||f.pasajero   ||''),
    fecha:          String(f.fecha          ||f.FECHA      ||''),
    viajesIds:      ids,
    total:          Number(f.total          ||f.TOTAL      ||0),
    estado:         String(f.estado         ||f.ESTADO     ||'Pendiente'),
    observaciones:  String(f.observaciones  ||f.OBSERVACIONES||''),
  };
}

const fmt=(n:number)=>n.toLocaleString('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0});
const L:React.CSSProperties={display:'block',fontSize:'.78rem',color:'var(--text3)',marginBottom:'.3rem',fontWeight:500};
const EMPTY:FormState={id:'',pasajeroId:'',fecha:'',viajesIds:[],estado:'Pendiente',observaciones:''};

export default function FacturacionTrasladoPage() {
  const router = useRouter();
  const { tipo, loading:tipoLoading } = useEmpresaTipo();

  const [lista,      setLista]      = useState<Factura[]>([]);
  const [pasajeros,  setPasajeros]  = useState<Sel[]>([]);
  const [viajes,     setViajes]     = useState<Viaje[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [filtroEst,  setFiltroEst]  = useState('');
  const [modal,      setModal]      = useState(false);
  const [form,       setForm]       = useState<FormState>(EMPTY);
  const [saving,     setSaving]     = useState(false);
  const [pagandoId,  setPagandoId]  = useState<string|null>(null);
  const [delId,      setDelId]      = useState<string|null>(null);
  const [msg,        setMsg]        = useState<{text:string;ok:boolean}|null>(null);

  useEffect(()=>{
    if(!tipoLoading&&tipo!==null&&tipo!=='traslado') router.replace('/dashboard');
  },[tipo,tipoLoading,router]);

  const cargar=async()=>{
    setLoading(true);
    try{
      const [fRes,pRes,vRes]=await Promise.allSettled([
        api.get('/api/facturacion-traslado'),api.get('/api/pasajeros'),api.get('/api/viajes'),
      ]);
      if(fRes.status==='fulfilled') setLista(toArray(fRes.value.data).map(serializarFirestore).map(normFac));
      if(pRes.status==='fulfilled')
        setPasajeros(toArray(pRes.value.data).map(serializarFirestore)
          .map((p:Record<string,unknown>)=>({id:String(p.id||''),nombre:String(p.nombre||'')})));
      if(vRes.status==='fulfilled')
        setViajes(toArray(vRes.value.data).map(serializarFirestore)
          .filter((v:Record<string,unknown>)=>v.estado==='Completado')
          .map((v:Record<string,unknown>)=>({
            id:String(v.id||''),fecha:String(v.fecha||''),
            pasajeroNombre:String(v.pasajeroNombre||v.pasajero||''),
            origen:String(v.origen||''),destino:String(v.destino||''),
            monto:Number(v.monto||0),estado:String(v.estado||''),
          })));
    }catch{/*silent*/}finally{setLoading(false);}
  };
  useEffect(()=>{if(tipo==='traslado')cargar();},[tipo]);

  const totalForm=form.viajesIds.reduce((s,id)=>{
    const v=viajes.find(v=>v.id===id);
    return s+(v?.monto||0);
  },0);

  const sf=(k:keyof Omit<FormState,'viajesIds'>)=>(ev:React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>)=>setForm(f=>({...f,[k]:ev.target.value}));
  const toggleViaje=(id:string)=>setForm(f=>({...f,viajesIds:f.viajesIds.includes(id)?f.viajesIds.filter(x=>x!==id):[...f.viajesIds,id]}));

  const abrir=(f?:Factura)=>{
    setForm(f?{id:f.id,pasajeroId:f.pasajeroId,fecha:f.fecha,viajesIds:f.viajesIds,estado:f.estado,observaciones:f.observaciones}
      :{...EMPTY,fecha:new Date().toISOString().split('T')[0]});
    setMsg(null);setModal(true);
  };
  const cerrar=()=>{setModal(false);setMsg(null);};
  const guardar=async()=>{
    if(!form.pasajeroId){setMsg({text:'Seleccioná un pasajero',ok:false});return;}
    setSaving(true);setMsg(null);
    const payload={...form,total:totalForm};
    try{
      form.id?await api.put(`/api/facturacion-traslado/${form.id}`,payload):await api.post('/api/facturacion-traslado',payload);
      cerrar();cargar();
    }catch{setMsg({text:'Error al guardar',ok:false});}
    setSaving(false);
  };
  const marcarPagada=async(id:string,ev:React.MouseEvent)=>{
    ev.stopPropagation();setPagandoId(id);
    try{await api.put(`/api/facturacion-traslado/${id}`,{estado:'Pagada'});cargar();}catch{/*silent*/}
    setPagandoId(null);
  };
  const eliminar=async(id:string)=>{
    try{await api.delete(`/api/facturacion-traslado/${id}`);setDelId(null);cargar();}catch{/*silent*/}
  };

  const filtrados=filtroEst?lista.filter(f=>f.estado===filtroEst):lista;
  const totalPend=lista.filter(f=>f.estado==='Pendiente').reduce((s,f)=>s+f.total,0);
  const totalCob=lista.filter(f=>f.estado==='Pagada').reduce((s,f)=>s+f.total,0);

  if(tipoLoading) return <div style={{padding:'2rem',color:'var(--text3)'}}><span className="spinner"/> Verificando…</div>;
  if(tipo!=='traslado') return null;

  return(
    <div>
      <div className="section-header">
        <div>
          <h2 className="section-title">💰 Facturación Traslado</h2>
          <p style={{fontSize:'.82rem',color:'var(--text3)',marginTop:'.2rem'}}>{filtrados.length} factura{filtrados.length!==1?'s':''}</p>
        </div>
        <button className="btn btn-primary" onClick={()=>abrir()}>+ Nueva factura</button>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'1rem',marginBottom:'1.25rem'}}>
        <div className="stat-card"><p className="stat-label">Total</p><p className="stat-value" style={{color:'var(--text)'}}>{lista.length}</p></div>
        <div className="stat-card"><p className="stat-label">Pendiente</p><p className="stat-value" style={{color:'var(--amber)'}}>{fmt(totalPend)}</p></div>
        <div className="stat-card"><p className="stat-label">Cobrado</p><p className="stat-value" style={{color:'var(--green)'}}>{fmt(totalCob)}</p></div>
      </div>

      <div className="filter-bar">
        {ESTADOS_FAC.map(s=>(
          <button key={s} className={filtroEst===s?'btn btn-primary':'btn btn-secondary'}
            style={{fontSize:'.82rem'}} onClick={()=>setFiltroEst(filtroEst===s?'':s)}>{s}</button>
        ))}
        {filtroEst&&<button className="btn btn-secondary" style={{fontSize:'.78rem'}} onClick={()=>setFiltroEst('')}>✕ Todos</button>}
      </div>

      {loading?(
        <div style={{display:'flex',alignItems:'center',gap:'.75rem',color:'var(--text3)',padding:'2rem'}}><span className="spinner"/> Cargando…</div>
      ):filtrados.length===0?(
        <div className="empty-state"><div className="empty-icon">💰</div><p>Sin facturas</p></div>
      ):(
        <div style={{display:'flex',flexDirection:'column',gap:'.4rem'}}>
          {filtrados.map(f=>(
            <div key={f.id} className="card"
              style={{display:'flex',alignItems:'center',gap:'1rem',padding:'.75rem 1rem',cursor:'pointer'}}
              onClick={()=>abrir(f)}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:'.5rem',flexWrap:'wrap'}}>
                  <span style={{fontSize:'.88rem',fontWeight:600,color:'var(--text)'}}>{f.pasajeroNombre||'Sin pasajero'}</span>
                  <span className={`badge ${f.estado==='Pagada'?'badge-green':'badge-amber'}`}>{f.estado}</span>
                  {f.viajesIds.length>0&&<span className="badge badge-gray">{f.viajesIds.length} viaje{f.viajesIds.length!==1?'s':''}</span>}
                </div>
                <p style={{fontSize:'.78rem',color:'var(--text3)',marginTop:'.15rem'}}>{f.fecha}</p>
              </div>
              <p style={{fontSize:'1rem',fontWeight:700,color:'var(--text)',whiteSpace:'nowrap'}}>{fmt(f.total)}</p>
              {f.estado!=='Pagada'&&(
                <button className="btn btn-primary" style={{fontSize:'.72rem',padding:'.3rem .7rem',flexShrink:0}}
                  disabled={pagandoId===f.id}
                  onClick={ev=>marcarPagada(f.id,ev)}>
                  {pagandoId===f.id?<span className="spinner" style={{width:10,height:10}}/>:'✓ Pagada'}
                </button>
              )}
              {delId===f.id?(
                <div style={{display:'flex',gap:'.4rem'}} onClick={ev=>ev.stopPropagation()}>
                  <button className="btn btn-danger" style={{fontSize:'.72rem',padding:'.3rem .6rem'}} onClick={()=>eliminar(f.id)}>Confirmar</button>
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
          onClick={ev=>{if(ev.target===ev.currentTarget)cerrar();}}>
          <div className="card" style={{width:'100%',maxWidth:'560px',maxHeight:'90vh',overflowY:'auto',padding:'1.5rem'}}>
            <h3 style={{fontSize:'1rem',fontWeight:700,color:'var(--text)',marginBottom:'1.25rem'}}>
              {form.id?'✏️ Editar factura':'+ Nueva factura'}
            </h3>
            <div className="form-grid">
              <div className="form-grid form-grid-2">
                <div>
                  <label style={L}>Pasajero *</label>
                  <select className="select" value={form.pasajeroId} onChange={sf('pasajeroId')}>
                    <option value="">— Seleccioná —</option>
                    {pasajeros.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
                <div><label style={L}>Fecha</label><input type="date" className="input" value={form.fecha} onChange={sf('fecha')}/></div>
              </div>

              {/* Multi-select viajes completados */}
              <div>
                <label style={L}>Viajes completados ({form.viajesIds.length} sel.) · Total: {fmt(totalForm)}</label>
                {viajes.length===0?(
                  <p style={{fontSize:'.82rem',color:'var(--text3)'}}>Sin viajes completados disponibles</p>
                ):(
                  <div style={{maxHeight:180,overflowY:'auto',border:'1px solid var(--border2)',borderRadius:'var(--radius)',padding:'.25rem'}}>
                    {viajes.map(v=>{
                      const sel=form.viajesIds.includes(v.id);
                      return(
                        <div key={v.id} onClick={()=>toggleViaje(v.id)}
                          style={{display:'flex',alignItems:'center',gap:'.6rem',padding:'.4rem .6rem',cursor:'pointer',
                            borderRadius:'var(--radius)',background:sel?'var(--blue-dim)':'transparent',
                            borderLeft:sel?'3px solid var(--blue)':'3px solid transparent',transition:'background 150ms'}}>
                          <span style={{width:16,height:16,borderRadius:3,border:`2px solid ${sel?'var(--blue)':'var(--border2)'}`,
                            background:sel?'var(--blue)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',
                            flexShrink:0,fontSize:'.65rem',color:'#fff'}}>{sel?'✓':''}</span>
                          <div style={{flex:1,minWidth:0}}>
                            <p style={{fontSize:'.82rem',color:'var(--text)',fontWeight:sel?600:400}}>
                              {v.pasajeroNombre}
                              <span style={{color:'var(--text3)',marginLeft:'.4rem',fontSize:'.72rem'}}>{v.fecha}</span>
                            </p>
                            {v.origen&&v.destino&&<p style={{fontSize:'.72rem',color:'var(--text3)'}}>{v.origen} → {v.destino}</p>}
                          </div>
                          {v.monto>0&&<span style={{fontSize:'.78rem',fontWeight:600,color:'var(--green)',whiteSpace:'nowrap'}}>{fmt(v.monto)}</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Total */}
              <div style={{background:'var(--bg4)',borderRadius:'var(--radius)',padding:'.75rem 1rem',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:'.82rem',color:'var(--text3)'}}>Total</span>
                <span style={{fontSize:'1.1rem',fontWeight:700,color:'var(--green)'}}>{fmt(totalForm)}</span>
              </div>

              <div>
                <label style={L}>Estado</label>
                <select className="select" value={form.estado} onChange={sf('estado')}>
                  {ESTADOS_FAC.map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div><label style={L}>Observaciones</label><textarea className="textarea" rows={2} value={form.observaciones} onChange={sf('observaciones')}/></div>
            </div>
            {msg&&<p style={{fontSize:'.82rem',color:msg.ok?'var(--green)':'var(--red)',marginTop:'.75rem'}}>{msg.text}</p>}
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
