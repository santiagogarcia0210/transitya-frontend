'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { serializarFirestore, toArray } from '@/lib/utils';
import { useEmpresaTipo } from '@/hooks/useEmpresaTipo';

const ESTADOS = ['Pendiente','Confirmada','Cancelada'] as const;
type EstadoRes = typeof ESTADOS[number];
const BADGE: Record<string,string> = {
  Pendiente:'badge-amber', Confirmada:'badge-green', Cancelada:'badge-red',
};

interface Reserva {
  id:string; fechaSolicitud:string; fechaViaje:string; hora:string;
  pasajeroId:string; pasajeroNombre:string; origen:string; destino:string;
  monto:number; estado:EstadoRes|string; observaciones:string;
}
interface FormState {
  id:string; fechaSolicitud:string; fechaViaje:string; hora:string;
  pasajeroId:string; origen:string; destino:string; monto:string;
  estado:string; observaciones:string;
}
interface Sel { id:string; nombre:string; }

function norm(r: Record<string,unknown>): Reserva {
  return {
    id:             String(r.id             ||''),
    fechaSolicitud: String(r.fechaSolicitud ||r.fecha_solicitud||r.FECHA     ||''),
    fechaViaje:     String(r.fechaViaje     ||r.fecha_viaje    ||r.fechaViaje||''),
    hora:           String(r.hora           ||r.HORA           ||''),
    pasajeroId:     String(r.pasajeroId     ||r.pasajero_id    ||''),
    pasajeroNombre: String(r.pasajeroNombre ||r.pasajero       ||''),
    origen:         String(r.origen         ||r.ORIGEN         ||''),
    destino:        String(r.destino        ||r.DESTINO        ||''),
    monto:          Number(r.monto          ||r.MONTO          ||0),
    estado:         String(r.estado         ||r.ESTADO         ||'Pendiente'),
    observaciones:  String(r.observaciones  ||r.OBSERVACIONES  ||''),
  };
}

const fmt=(n:number)=>n>0?n.toLocaleString('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}):'—';
const L:React.CSSProperties={display:'block',fontSize:'.78rem',color:'var(--text3)',marginBottom:'.3rem',fontWeight:500};
const EMPTY:FormState={id:'',fechaSolicitud:'',fechaViaje:'',hora:'',pasajeroId:'',origen:'',destino:'',monto:'',estado:'Pendiente',observaciones:''};

export default function ReservasPage() {
  const router = useRouter();
  const { tipo, loading:tipoLoading } = useEmpresaTipo();

  const [lista,      setLista]      = useState<Reserva[]>([]);
  const [pasajeros,  setPasajeros]  = useState<Sel[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [filtroEst,  setFiltroEst]  = useState('');
  const [busq,       setBusq]       = useState('');
  const [modal,      setModal]      = useState(false);
  const [form,       setForm]       = useState<FormState>(EMPTY);
  const [saving,     setSaving]     = useState(false);
  const [accionId,   setAccionId]   = useState<string|null>(null);
  const [delId,      setDelId]      = useState<string|null>(null);
  const [msg,        setMsg]        = useState<{text:string;ok:boolean}|null>(null);

  useEffect(()=>{
    if(!tipoLoading&&tipo!==null&&tipo!=='traslado') router.replace('/dashboard');
  },[tipo,tipoLoading,router]);

  const cargar=async()=>{
    setLoading(true);
    try{
      const [rRes,pRes]=await Promise.allSettled([api.get('/api/reservas'),api.get('/api/pasajeros')]);
      if(rRes.status==='fulfilled') setLista(toArray(rRes.value.data).map(serializarFirestore).map(norm));
      if(pRes.status==='fulfilled')
        setPasajeros(toArray(pRes.value.data).map(serializarFirestore)
          .map((p:Record<string,unknown>)=>({id:String(p.id||''),nombre:String(p.nombre||'')})));
    }catch{/*silent*/}finally{setLoading(false);}
  };
  useEffect(()=>{if(tipo==='traslado')cargar();},[tipo]);

  const filtrados=lista.filter(r=>{
    const q=busq.toLowerCase();
    if(q&&!r.pasajeroNombre.toLowerCase().includes(q)&&!r.origen.toLowerCase().includes(q)&&!r.destino.toLowerCase().includes(q)) return false;
    if(filtroEst&&r.estado!==filtroEst) return false;
    return true;
  });

  const sf=(k:keyof FormState)=>(ev:React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>)=>setForm(f=>({...f,[k]:ev.target.value}));
  const abrir=(r?:Reserva)=>{
    const hoy=new Date().toISOString().split('T')[0];
    setForm(r?{id:r.id,fechaSolicitud:r.fechaSolicitud,fechaViaje:r.fechaViaje,hora:r.hora,
      pasajeroId:r.pasajeroId,origen:r.origen,destino:r.destino,monto:String(r.monto||''),
      estado:r.estado,observaciones:r.observaciones}:{...EMPTY,fechaSolicitud:hoy});
    setMsg(null);setModal(true);
  };
  const cerrar=()=>{setModal(false);setMsg(null);};
  const guardar=async()=>{
    if(!form.pasajeroId){setMsg({text:'Seleccioná un pasajero',ok:false});return;}
    setSaving(true);setMsg(null);
    try{
      form.id?await api.put(`/api/reservas/${form.id}`,form):await api.post('/api/reservas',form);
      cerrar();cargar();
    }catch{setMsg({text:'Error al guardar',ok:false});}
    setSaving(false);
  };

  const cambiarEstado=async(id:string,estado:EstadoRes,ev:React.MouseEvent)=>{
    ev.stopPropagation();setAccionId(id);
    try{await api.patch(`/api/reservas/${id}`,{estado});cargar();}catch{/*silent*/}
    setAccionId(null);
  };

  const eliminar=async(id:string)=>{
    try{await api.delete(`/api/reservas/${id}`);setDelId(null);cargar();}catch{/*silent*/}
  };

  if(tipoLoading) return <div style={{padding:'2rem',color:'var(--text3)'}}><span className="spinner"/> Verificando…</div>;
  if(tipo!=='traslado') return null;

  const pendientes=lista.filter(r=>r.estado==='Pendiente').length;

  return(
    <div>
      <div className="section-header">
        <div>
          <h2 className="section-title">📅 Reservas</h2>
          <p style={{fontSize:'.82rem',color:'var(--text3)',marginTop:'.2rem'}}>
            {filtrados.length} reserva{filtrados.length!==1?'s':''}
            {pendientes>0&&<> · <span style={{color:'var(--amber)'}}>{pendientes} pendiente{pendientes!==1?'s':''}</span></>}
          </p>
        </div>
        <button className="btn btn-primary" onClick={()=>abrir()}>+ Nueva reserva</button>
      </div>

      <div className="filter-bar">
        <input className="input" placeholder="Buscar pasajero, origen o destino…" value={busq} onChange={e=>setBusq(e.target.value)}/>
        <div style={{display:'flex',gap:'.35rem'}}>
          {ESTADOS.map(s=>(
            <button key={s} className={filtroEst===s?'btn btn-primary':'btn btn-secondary'}
              style={{fontSize:'.75rem',padding:'.3rem .65rem'}}
              onClick={()=>setFiltroEst(filtroEst===s?'':s)}>{s}</button>
          ))}
        </div>
        {(busq||filtroEst)&&<button className="btn btn-secondary" style={{fontSize:'.78rem'}} onClick={()=>{setBusq('');setFiltroEst('');}}>✕</button>}
      </div>

      {loading?(
        <div style={{display:'flex',alignItems:'center',gap:'.75rem',color:'var(--text3)',padding:'2rem'}}><span className="spinner"/> Cargando…</div>
      ):filtrados.length===0?(
        <div className="empty-state"><div className="empty-icon">📅</div><p>Sin reservas</p></div>
      ):(
        <div style={{display:'flex',flexDirection:'column',gap:'.4rem'}}>
          {filtrados.map(r=>(
            <div key={r.id} className="card"
              style={{display:'flex',alignItems:'center',gap:'1rem',padding:'.75rem 1rem',cursor:'pointer'}}
              onClick={()=>abrir(r)}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:'.5rem',flexWrap:'wrap'}}>
                  <span style={{fontSize:'.88rem',fontWeight:600,color:'var(--text)'}}>{r.pasajeroNombre||'Sin pasajero'}</span>
                  <span className={`badge ${BADGE[r.estado]||'badge-gray'}`}>{r.estado}</span>
                </div>
                <p style={{fontSize:'.78rem',color:'var(--text3)',marginTop:'.15rem'}}>
                  Viaje: {r.fechaViaje}{r.hora&&` ${r.hora}`}
                  {r.origen&&r.destino&&` · ${r.origen} → ${r.destino}`}
                </p>
              </div>
              {r.monto>0&&<p style={{fontSize:'.95rem',fontWeight:700,color:'var(--text)',whiteSpace:'nowrap'}}>{fmt(r.monto)}</p>}

              {/* Botones confirmar/cancelar inline para Pendiente */}
              {r.estado==='Pendiente'&&(
                <div style={{display:'flex',gap:'.35rem',flexShrink:0}} onClick={ev=>ev.stopPropagation()}>
                  <button className="btn btn-primary" style={{fontSize:'.72rem',padding:'.3rem .6rem'}}
                    disabled={accionId===r.id}
                    onClick={ev=>cambiarEstado(r.id,'Confirmada',ev)}>
                    {accionId===r.id?<span className="spinner" style={{width:10,height:10}}/>:'✓ Confirmar'}
                  </button>
                  <button className="btn btn-danger" style={{fontSize:'.72rem',padding:'.3rem .6rem'}}
                    disabled={accionId===r.id}
                    onClick={ev=>cambiarEstado(r.id,'Cancelada',ev)}>
                    ✕ Cancelar
                  </button>
                </div>
              )}

              {delId===r.id?(
                <div style={{display:'flex',gap:'.4rem'}} onClick={ev=>ev.stopPropagation()}>
                  <button className="btn btn-danger" style={{fontSize:'.72rem',padding:'.3rem .6rem'}} onClick={()=>eliminar(r.id)}>Eliminar</button>
                  <button className="btn btn-secondary" style={{fontSize:'.72rem',padding:'.3rem .6rem'}} onClick={()=>setDelId(null)}>✕</button>
                </div>
              ):(
                <button className="btn btn-secondary" style={{fontSize:'.72rem',padding:'.3rem .6rem'}}
                  onClick={ev=>{ev.stopPropagation();setDelId(r.id);}}>🗑</button>
              )}
            </div>
          ))}
        </div>
      )}

      {modal&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.65)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50,padding:'1rem'}}
          onClick={ev=>{if(ev.target===ev.currentTarget)cerrar();}}>
          <div className="card" style={{width:'100%',maxWidth:'520px',maxHeight:'90vh',overflowY:'auto',padding:'1.5rem'}}>
            <h3 style={{fontSize:'1rem',fontWeight:700,color:'var(--text)',marginBottom:'1.25rem'}}>
              {form.id?'✏️ Editar reserva':'+ Nueva reserva'}
            </h3>
            <div className="form-grid">
              <div>
                <label style={L}>Pasajero</label>
                <select className="select" value={form.pasajeroId} onChange={sf('pasajeroId')}>
                  <option value="">— Seleccioná —</option>
                  {pasajeros.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <div className="form-grid form-grid-2">
                <div><label style={L}>Fecha solicitud</label><input type="date" className="input" value={form.fechaSolicitud} onChange={sf('fechaSolicitud')}/></div>
                <div><label style={L}>Fecha del viaje</label><input type="date" className="input" value={form.fechaViaje} onChange={sf('fechaViaje')}/></div>
              </div>
              <div className="form-grid form-grid-2">
                <div><label style={L}>Hora</label><input type="time" className="input" value={form.hora} onChange={sf('hora')}/></div>
                <div><label style={L}>Monto ($)</label><input type="number" className="input" placeholder="0" value={form.monto} onChange={sf('monto')}/></div>
              </div>
              <div className="form-grid form-grid-2">
                <div><label style={L}>Origen</label><input className="input" value={form.origen} onChange={sf('origen')}/></div>
                <div><label style={L}>Destino</label><input className="input" value={form.destino} onChange={sf('destino')}/></div>
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
