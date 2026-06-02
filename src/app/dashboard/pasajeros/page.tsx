'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { serializarFirestore, toArray } from '@/lib/utils';
import { useEmpresaTipo } from '@/hooks/useEmpresaTipo';

interface Pasajero {
  id: string; nombre: string; telefono: string; email: string;
  direccion: string; observaciones: string;
}
interface FormState {
  id: string; nombre: string; telefono: string; email: string;
  direccion: string; observaciones: string;
}
function norm(p: Record<string, unknown>): Pasajero {
  return {
    id:           String(p.id           || ''),
    nombre:       String(p.nombre       || p.NOMBRE       || ''),
    telefono:     String(p.telefono     || p.TELEFONO     || ''),
    email:        String(p.email        || p.EMAIL        || ''),
    direccion:    String(p.direccion    || p.DIRECCION    || p.domicilio || ''),
    observaciones:String(p.observaciones|| p.OBSERVACIONES|| ''),
  };
}
const L: React.CSSProperties = {display:'block',fontSize:'.78rem',color:'var(--text3)',marginBottom:'.3rem',fontWeight:500};
const EMPTY: FormState = {id:'',nombre:'',telefono:'',email:'',direccion:'',observaciones:''};

export default function PasajerosPage() {
  const router = useRouter();
  const { tipo, loading: tipoLoading } = useEmpresaTipo();

  const [lista,   setLista]   = useState<Pasajero[]>([]);
  const [loading, setLoading] = useState(true);
  const [busq,    setBusq]    = useState('');
  const [modal,   setModal]   = useState(false);
  const [form,    setForm]    = useState<FormState>(EMPTY);
  const [saving,  setSaving]  = useState(false);
  const [delId,   setDelId]   = useState<string|null>(null);
  const [msg,     setMsg]     = useState<{text:string;ok:boolean}|null>(null);

  useEffect(()=>{
    if(!tipoLoading&&tipo!==null&&tipo!=='traslado') router.replace('/dashboard');
  },[tipo,tipoLoading,router]);

  const cargar=async()=>{
    setLoading(true);
    try{const r=await api.get('/api/pasajeros');setLista(toArray(r.data).map(serializarFirestore).map(norm));}
    catch{/*silent*/}finally{setLoading(false);}
  };
  useEffect(()=>{if(tipo==='traslado')cargar();},[tipo]);

  const filtrados=lista.filter(p=>{
    const q=busq.toLowerCase();
    return !q||p.nombre.toLowerCase().includes(q)||p.telefono.includes(q)||p.email.toLowerCase().includes(q);
  });

  const sf=(k:keyof FormState)=>(ev:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement>)=>setForm(f=>({...f,[k]:ev.target.value}));
  const abrir=(p?:Pasajero)=>{
    setForm(p?{id:p.id,nombre:p.nombre,telefono:p.telefono,email:p.email,direccion:p.direccion,observaciones:p.observaciones}:EMPTY);
    setMsg(null);setModal(true);
  };
  const cerrar=()=>{setModal(false);setMsg(null);};
  const guardar=async()=>{
    if(!form.nombre){setMsg({text:'El nombre es obligatorio',ok:false});return;}
    setSaving(true);setMsg(null);
    try{
      form.id?await api.put(`/api/pasajeros/${form.id}`,form):await api.post('/api/pasajeros',form);
      cerrar();cargar();
    }catch{setMsg({text:'Error al guardar',ok:false});}
    setSaving(false);
  };
  const eliminar=async(id:string)=>{
    try{await api.delete(`/api/pasajeros/${id}`);setDelId(null);cargar();}catch{/*silent*/}
  };

  if(tipoLoading) return <div style={{padding:'2rem',color:'var(--text3)'}}><span className="spinner"/> Verificando…</div>;
  if(tipo!=='traslado') return null;

  return(
    <div>
      <div className="section-header">
        <div>
          <h2 className="section-title">👤 Pasajeros</h2>
          <p style={{fontSize:'.82rem',color:'var(--text3)',marginTop:'.2rem'}}>{filtrados.length} pasajero{filtrados.length!==1?'s':''}</p>
        </div>
        <button className="btn btn-primary" onClick={()=>abrir()}>+ Nuevo pasajero</button>
      </div>

      <div className="filter-bar">
        <input className="input" placeholder="Buscar nombre, teléfono o email…" value={busq} onChange={e=>setBusq(e.target.value)}/>
        {busq&&<button className="btn btn-secondary" style={{fontSize:'.78rem'}} onClick={()=>setBusq('')}>✕</button>}
      </div>

      {loading?(
        <div style={{display:'flex',alignItems:'center',gap:'.75rem',color:'var(--text3)',padding:'2rem'}}><span className="spinner"/> Cargando…</div>
      ):filtrados.length===0?(
        <div className="empty-state"><div className="empty-icon">👤</div><p>Sin pasajeros</p></div>
      ):(
        <div style={{display:'flex',flexDirection:'column',gap:'.4rem'}}>
          {filtrados.map(p=>(
            <div key={p.id} className="card"
              style={{display:'flex',alignItems:'center',gap:'1rem',padding:'.75rem 1rem',cursor:'pointer'}}
              onClick={()=>abrir(p)}>
              <div style={{flex:1,minWidth:0}}>
                <span style={{fontSize:'.88rem',fontWeight:600,color:'var(--text)'}}>{p.nombre}</span>
                <p style={{fontSize:'.78rem',color:'var(--text3)',marginTop:'.15rem'}}>
                  {p.telefono&&p.telefono}{p.email&&` · ${p.email}`}{p.direccion&&` · ${p.direccion}`}
                </p>
              </div>
              {delId===p.id?(
                <div style={{display:'flex',gap:'.4rem'}} onClick={e=>e.stopPropagation()}>
                  <button className="btn btn-danger" style={{fontSize:'.72rem',padding:'.3rem .6rem'}} onClick={()=>eliminar(p.id)}>Confirmar</button>
                  <button className="btn btn-secondary" style={{fontSize:'.72rem',padding:'.3rem .6rem'}} onClick={()=>setDelId(null)}>✕</button>
                </div>
              ):(
                <button className="btn btn-secondary" style={{fontSize:'.72rem',padding:'.3rem .6rem'}}
                  onClick={e=>{e.stopPropagation();setDelId(p.id);}}>🗑</button>
              )}
            </div>
          ))}
        </div>
      )}

      {modal&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.65)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50,padding:'1rem'}}
          onClick={e=>{if(e.target===e.currentTarget)cerrar();}}>
          <div className="card" style={{width:'100%',maxWidth:'480px',maxHeight:'90vh',overflowY:'auto',padding:'1.5rem'}}>
            <h3 style={{fontSize:'1rem',fontWeight:700,color:'var(--text)',marginBottom:'1.25rem'}}>
              {form.id?'✏️ Editar pasajero':'+ Nuevo pasajero'}
            </h3>
            <div className="form-grid">
              <div><label style={L}>Nombre *</label><input className="input" value={form.nombre} onChange={sf('nombre')}/></div>
              <div className="form-grid form-grid-2">
                <div><label style={L}>Teléfono</label><input className="input" placeholder="11-1234-5678" value={form.telefono} onChange={sf('telefono')}/></div>
                <div><label style={L}>Email</label><input type="email" className="input" value={form.email} onChange={sf('email')}/></div>
              </div>
              <div><label style={L}>Dirección</label><input className="input" placeholder="Calle 123, Ciudad" value={form.direccion} onChange={sf('direccion')}/></div>
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
