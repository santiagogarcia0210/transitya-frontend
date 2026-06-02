'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { serializarFirestore, toArray } from '@/lib/utils';
import { useEmpresaTipo } from '@/hooks/useEmpresaTipo';

const ESTADOS = ['Reservado','Confirmado','En curso','Completado','Cancelado'] as const;
type EstadoViaje = typeof ESTADOS[number];
const BADGE: Record<string,string> = {
  Reservado:'badge-gray', Confirmado:'badge-blue', 'En curso':'badge-amber',
  Completado:'badge-green', Cancelado:'badge-red',
};

interface Viaje {
  id:string; fecha:string; hora:string; pasajeroId:string; pasajeroNombre:string;
  choferId:string; choferNombre:string; origen:string; destino:string;
  distanciaKm:number; monto:number; estado:EstadoViaje|string; observaciones:string;
}
interface FormState {
  id:string; fecha:string; hora:string; pasajeroId:string; choferId:string;
  origen:string; destino:string; distanciaKm:string; monto:string; estado:string; observaciones:string;
}
interface Sel { id:string; nombre:string; }

function norm(v: Record<string,unknown>): Viaje {
  return {
    id:             String(v.id             ||''),
    fecha:          String(v.fecha          ||v.FECHA          ||''),
    hora:           String(v.hora           ||v.HORA           ||''),
    pasajeroId:     String(v.pasajeroId     ||v.pasajero_id    ||''),
    pasajeroNombre: String(v.pasajeroNombre ||v.pasajero       ||v.PASAJERO||''),
    choferId:       String(v.choferId       ||v.chofer_id      ||''),
    choferNombre:   String(v.choferNombre   ||v.chofer         ||v.CHOFER  ||''),
    origen:         String(v.origen         ||v.ORIGEN         ||''),
    destino:        String(v.destino        ||v.DESTINO        ||''),
    distanciaKm:    Number(v.distanciaKm    ||v.distancia      ||0),
    monto:          Number(v.monto          ||v.MONTO          ||0),
    estado:         String(v.estado         ||v.ESTADO         ||'Reservado'),
    observaciones:  String(v.observaciones  ||v.OBSERVACIONES  ||''),
  };
}

const fmt=(n:number)=>n>0?n.toLocaleString('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}):'—';
const L:React.CSSProperties={display:'block',fontSize:'.78rem',color:'var(--text3)',marginBottom:'.3rem',fontWeight:500};
const EMPTY:FormState={id:'',fecha:'',hora:'',pasajeroId:'',choferId:'',origen:'',destino:'',distanciaKm:'',monto:'',estado:'Reservado',observaciones:''};

export default function ViajesPage() {
  const router = useRouter();
  const { tipo, loading:tipoLoading } = useEmpresaTipo();

  const [lista,        setLista]        = useState<Viaje[]>([]);
  const [pasajeros,    setPasajeros]    = useState<Sel[]>([]);
  const [choferes,     setChoferes]     = useState<Sel[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [filtroEst,    setFiltroEst]    = useState('');
  const [busq,         setBusq]         = useState('');
  const [modal,        setModal]        = useState(false);
  const [form,         setForm]         = useState<FormState>(EMPTY);
  const [saving,       setSaving]       = useState(false);
  const [cambiandoId,  setCambiandoId]  = useState<string|null>(null);
  const [delId,        setDelId]        = useState<string|null>(null);
  const [msg,          setMsg]          = useState<{text:string;ok:boolean}|null>(null);

  useEffect(()=>{
    if(!tipoLoading&&tipo!==null&&tipo!=='traslado') router.replace('/dashboard');
  },[tipo,tipoLoading,router]);

  const cargar=async()=>{
    setLoading(true);
    try{
      const [vRes,pRes,cRes]=await Promise.allSettled([
        api.get('/api/viajes'),api.get('/api/pasajeros'),api.get('/api/choferes-traslado'),
      ]);
      if(vRes.status==='fulfilled') setLista(toArray(vRes.value.data).map(serializarFirestore).map(norm));
      if(pRes.status==='fulfilled')
        setPasajeros(toArray(pRes.value.data).map(serializarFirestore)
          .map((p:Record<string,unknown>)=>({id:String(p.id||''),nombre:String(p.nombre||'')})));
      if(cRes.status==='fulfilled')
        setChoferes(toArray(cRes.value.data).map(serializarFirestore)
          .filter((c:Record<string,unknown>)=>c.activo!==false)
          .map((c:Record<string,unknown>)=>({id:String(c.id||''),nombre:String(c.nombre||'')})));
    }catch{/*silent*/}finally{setLoading(false);}
  };
  useEffect(()=>{if(tipo==='traslado')cargar();},[tipo]);

  const filtrados=lista.filter(v=>{
    const q=busq.toLowerCase();
    if(q&&!v.pasajeroNombre.toLowerCase().includes(q)&&!v.origen.toLowerCase().includes(q)&&!v.destino.toLowerCase().includes(q)) return false;
    if(filtroEst&&v.estado!==filtroEst) return false;
    return true;
  });

  const sf=(k:keyof FormState)=>(ev:React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>)=>setForm(f=>({...f,[k]:ev.target.value}));
  const abrir=(v?:Viaje)=>{
    setForm(v?{id:v.id,fecha:v.fecha,hora:v.hora,pasajeroId:v.pasajeroId,choferId:v.choferId,
      origen:v.origen,destino:v.destino,distanciaKm:String(v.distanciaKm||''),monto:String(v.monto||''),
      estado:v.estado,observaciones:v.observaciones}:{...EMPTY,fecha:new Date().toISOString().split('T')[0]});
    setMsg(null);setModal(true);
  };
  const cerrar=()=>{setModal(false);setMsg(null);};
  const guardar=async()=>{
    setSaving(true);setMsg(null);
    try{
      form.id?await api.put(`/api/viajes/${form.id}`,form):await api.post('/api/viajes',form);
      cerrar();cargar();
    }catch{setMsg({text:'Error al guardar',ok:false});}
    setSaving(false);
  };
  const cambiarEstado=async(id:string,estado:string,ev:React.ChangeEvent<HTMLSelectElement>)=>{
    ev.stopPropagation();setCambiandoId(id);
    try{await api.patch(`/api/viajes/${id}/estado`,{estado});cargar();}catch{/*silent*/}
    setCambiandoId(null);
  };
  const eliminar=async(id:string)=>{
    try{await api.delete(`/api/viajes/${id}`);setDelId(null);cargar();}catch{/*silent*/}
  };

  if(tipoLoading) return <div style={{padding:'2rem',color:'var(--text3)'}}><span className="spinner"/> Verificando…</div>;
  if(tipo!=='traslado') return null;

  const counts=ESTADOS.reduce((acc,s)=>({...acc,[s]:lista.filter(v=>v.estado===s).length}),{} as Record<string,number>);

  return(
    <div>
      <div className="section-header">
        <div>
          <h2 className="section-title">🚕 Viajes</h2>
          <p style={{fontSize:'.82rem',color:'var(--text3)',marginTop:'.2rem'}}>
            {filtrados.length} viaje{filtrados.length!==1?'s':''}
            {counts['En curso']>0&&<> · <span style={{color:'var(--amber)'}}>{counts['En curso']} en curso</span></>}
          </p>
        </div>
        <button className="btn btn-primary" onClick={()=>abrir()}>+ Nuevo viaje</button>
      </div>

      {/* Stats KPI */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:'.75rem',marginBottom:'1.25rem'}}>
        {ESTADOS.map(s=>(
          <div key={s} className="stat-card" style={{cursor:'pointer',padding:'.75rem',outline:filtroEst===s?`2px solid var(--blue)`:undefined}}
            onClick={()=>setFiltroEst(filtroEst===s?'':s)}>
            <p className="stat-label" style={{fontSize:'.72rem'}}>{s}</p>
            <p className="stat-value" style={{fontSize:'1.5rem',color:{Reservado:'var(--text3)',Confirmado:'var(--blue)','En curso':'var(--amber)',Completado:'var(--green)',Cancelado:'var(--red)'}[s]}}>
              {counts[s]||0}
            </p>
          </div>
        ))}
      </div>

      <div className="filter-bar">
        <input className="input" placeholder="Buscar pasajero, origen o destino…" value={busq} onChange={e=>setBusq(e.target.value)}/>
        {(busq||filtroEst)&&<button className="btn btn-secondary" style={{fontSize:'.78rem'}} onClick={()=>{setBusq('');setFiltroEst('');}}>✕ Limpiar</button>}
      </div>

      {loading?(
        <div style={{display:'flex',alignItems:'center',gap:'.75rem',color:'var(--text3)',padding:'2rem'}}><span className="spinner"/> Cargando…</div>
      ):filtrados.length===0?(
        <div className="empty-state"><div className="empty-icon">🚕</div><p>Sin viajes</p></div>
      ):(
        <div style={{display:'flex',flexDirection:'column',gap:'.4rem'}}>
          {filtrados.map(v=>(
            <div key={v.id} className="card"
              style={{display:'flex',alignItems:'center',gap:'1rem',padding:'.75rem 1rem',cursor:'pointer'}}
              onClick={()=>abrir(v)}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:'.5rem',flexWrap:'wrap'}}>
                  <span style={{fontSize:'.88rem',fontWeight:600,color:'var(--text)'}}>{v.pasajeroNombre||'Sin pasajero'}</span>
                  <span className={`badge ${BADGE[v.estado]||'badge-gray'}`}>{v.estado}</span>
                </div>
                <p style={{fontSize:'.78rem',color:'var(--text3)',marginTop:'.15rem'}}>
                  {v.fecha}{v.hora&&` ${v.hora}`}
                  {v.origen&&v.destino&&` · ${v.origen} → ${v.destino}`}
                  {v.choferNombre&&` · ${v.choferNombre}`}
                  {v.distanciaKm>0&&` · ${v.distanciaKm} km`}
                </p>
              </div>
              {v.monto>0&&<p style={{fontSize:'.95rem',fontWeight:700,color:'var(--text)',whiteSpace:'nowrap'}}>{fmt(v.monto)}</p>}

              {/* Cambio estado inline */}
              <select className="select"
                style={{fontSize:'.75rem',padding:'.25rem .5rem',width:'auto',minWidth:110,flexShrink:0,
                  opacity:cambiandoId===v.id?.6:1}}
                value={v.estado} disabled={cambiandoId===v.id}
                onClick={ev=>ev.stopPropagation()}
                onChange={ev=>cambiarEstado(v.id,ev.target.value,ev)}>
                {ESTADOS.map(s=><option key={s} value={s}>{s}</option>)}
              </select>

              {delId===v.id?(
                <div style={{display:'flex',gap:'.4rem'}} onClick={ev=>ev.stopPropagation()}>
                  <button className="btn btn-danger" style={{fontSize:'.72rem',padding:'.3rem .6rem'}} onClick={()=>eliminar(v.id)}>Confirmar</button>
                  <button className="btn btn-secondary" style={{fontSize:'.72rem',padding:'.3rem .6rem'}} onClick={()=>setDelId(null)}>✕</button>
                </div>
              ):(
                <button className="btn btn-secondary" style={{fontSize:'.72rem',padding:'.3rem .6rem'}}
                  onClick={ev=>{ev.stopPropagation();setDelId(v.id);}}>🗑</button>
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
              {form.id?'✏️ Editar viaje':'+ Nuevo viaje'}
            </h3>
            <div className="form-grid">
              <div className="form-grid form-grid-2">
                <div><label style={L}>Fecha</label><input type="date" className="input" value={form.fecha} onChange={sf('fecha')}/></div>
                <div><label style={L}>Hora</label><input type="time" className="input" value={form.hora} onChange={sf('hora')}/></div>
              </div>
              <div className="form-grid form-grid-2">
                <div>
                  <label style={L}>Pasajero</label>
                  <select className="select" value={form.pasajeroId} onChange={sf('pasajeroId')}>
                    <option value="">— Seleccioná —</option>
                    {pasajeros.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label style={L}>Chofer</label>
                  <select className="select" value={form.choferId} onChange={sf('choferId')}>
                    <option value="">— Seleccioná —</option>
                    {choferes.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-grid form-grid-2">
                <div><label style={L}>Origen</label><input className="input" placeholder="Ej: Casa del pasajero" value={form.origen} onChange={sf('origen')}/></div>
                <div><label style={L}>Destino</label><input className="input" placeholder="Ej: Hospital" value={form.destino} onChange={sf('destino')}/></div>
              </div>
              <div className="form-grid form-grid-2">
                <div><label style={L}>Distancia (km)</label><input type="number" className="input" placeholder="0" value={form.distanciaKm} onChange={sf('distanciaKm')}/></div>
                <div><label style={L}>Monto ($)</label><input type="number" className="input" placeholder="0" value={form.monto} onChange={sf('monto')}/></div>
              </div>
              <div>
                <label style={L}>Estado</label>
                <select className="select" value={form.estado} onChange={sf('estado')}>
                  {ESTADOS.map(s=><option key={s} value={s}>{s}</option>)}
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
