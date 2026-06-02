'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { serializarFirestore, toArray } from '@/lib/utils';
import { useEmpresaTipo } from '@/hooks/useEmpresaTipo';

interface Chofer {
  id: string; nombre: string; telefono: string; licencia: string;
  vehiculo: string; patente: string; activo: boolean;
}
interface FormState {
  id: string; nombre: string; telefono: string; licencia: string;
  vehiculo: string; patente: string; activo: boolean;
}
function norm(c: Record<string, unknown>): Chofer {
  return {
    id:       String(c.id       || ''),
    nombre:   String(c.nombre   || c.NOMBRE   || ''),
    telefono: String(c.telefono || c.TELEFONO || ''),
    licencia: String(c.licencia || c.LICENCIA || ''),
    vehiculo: String(c.vehiculo || c.VEHICULO || ''),
    patente:  String(c.patente  || c.PATENTE  || ''),
    activo:   c.activo !== false,
  };
}
const L: React.CSSProperties = {display:'block',fontSize:'.78rem',color:'var(--text3)',marginBottom:'.3rem',fontWeight:500};
const EMPTY: FormState = {id:'',nombre:'',telefono:'',licencia:'',vehiculo:'',patente:'',activo:true};

export default function ChoferesPage() {
  const router = useRouter();
  const { tipo, loading: tipoLoading } = useEmpresaTipo();

  const [lista,   setLista]   = useState<Chofer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busq,    setBusq]    = useState('');
  const [modal,   setModal]   = useState(false);
  const [form,    setForm]    = useState<FormState>(EMPTY);
  const [saving,  setSaving]  = useState(false);
  const [delId,   setDelId]   = useState<string|null>(null);
  const [msg,     setMsg]     = useState<{text:string;ok:boolean}|null>(null);

  useEffect(()=>{
    if(!tipoLoading && tipo!==null && tipo!=='traslado') router.replace('/dashboard');
  },[tipo,tipoLoading,router]);

  const cargar = async()=>{
    setLoading(true);
    try{ const r=await api.get('/api/choferes-traslado'); setLista(toArray(r.data).map(serializarFirestore).map(norm)); }
    catch{/*silent*/}finally{setLoading(false);}
  };
  useEffect(()=>{if(tipo==='traslado')cargar();},[tipo]);

  const filtrados=lista.filter(c=>{
    const q=busq.toLowerCase();
    return !q||c.nombre.toLowerCase().includes(q)||c.patente.toLowerCase().includes(q);
  });

  const sf=(k:keyof FormState)=>(ev:React.ChangeEvent<HTMLInputElement>)=>setForm(f=>({...f,[k]:ev.target.value}));
  const abrir=(c?:Chofer)=>{
    setForm(c?{id:c.id,nombre:c.nombre,telefono:c.telefono,licencia:c.licencia,vehiculo:c.vehiculo,patente:c.patente,activo:c.activo}:EMPTY);
    setMsg(null);setModal(true);
  };
  const cerrar=()=>{setModal(false);setMsg(null);};
  const guardar=async()=>{
    if(!form.nombre){setMsg({text:'El nombre es obligatorio',ok:false});return;}
    setSaving(true);setMsg(null);
    try{
      form.id?await api.put(`/api/choferes-traslado/${form.id}`,form):await api.post('/api/choferes-traslado',form);
      cerrar();cargar();
    }catch{setMsg({text:'Error al guardar',ok:false});}
    setSaving(false);
  };
  const eliminar=async(id:string)=>{
    try{await api.delete(`/api/choferes-traslado/${id}`);setDelId(null);cargar();}catch{/*silent*/}
  };

  if(tipoLoading) return <div style={{padding:'2rem',color:'var(--text3)'}}><span className="spinner"/> Verificando…</div>;
  if(tipo!=='traslado') return null;

  return(
    <div>
      <div className="section-header">
        <div>
          <h2 className="section-title">🚗 Choferes</h2>
          <p style={{fontSize:'.82rem',color:'var(--text3)',marginTop:'.2rem'}}>
            <span style={{color:'var(--green)'}}>{lista.filter(c=>c.activo).length} activo{lista.filter(c=>c.activo).length!==1?'s':''}</span>
            {lista.filter(c=>!c.activo).length>0&&<> · {lista.filter(c=>!c.activo).length} inactivos</>}
          </p>
        </div>
        <button className="btn btn-primary" onClick={()=>abrir()}>+ Nuevo chofer</button>
      </div>

      <div className="filter-bar">
        <input className="input" placeholder="Buscar nombre o patente…" value={busq} onChange={e=>setBusq(e.target.value)}/>
        {busq&&<button className="btn btn-secondary" style={{fontSize:'.78rem'}} onClick={()=>setBusq('')}>✕</button>}
      </div>

      {loading?(
        <div style={{display:'flex',alignItems:'center',gap:'.75rem',color:'var(--text3)',padding:'2rem'}}><span className="spinner"/> Cargando…</div>
      ):filtrados.length===0?(
        <div className="empty-state"><div className="empty-icon">🚗</div><p>Sin choferes</p></div>
      ):(
        <div style={{display:'flex',flexDirection:'column',gap:'.4rem'}}>
          {filtrados.map(c=>(
            <div key={c.id} className="card"
              style={{display:'flex',alignItems:'center',gap:'1rem',padding:'.75rem 1rem',cursor:'pointer',opacity:c.activo?1:.6}}
              onClick={()=>abrir(c)}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:'.5rem',flexWrap:'wrap'}}>
                  <span style={{fontSize:'.88rem',fontWeight:600,color:'var(--text)'}}>{c.nombre}</span>
                  <span className={`badge ${c.activo?'badge-green':'badge-gray'}`}>{c.activo?'Activo':'Inactivo'}</span>
                </div>
                <p style={{fontSize:'.78rem',color:'var(--text3)',marginTop:'.15rem'}}>
                  {c.vehiculo&&c.vehiculo}{c.patente&&` · ${c.patente}`}{c.licencia&&` · Lic: ${c.licencia}`}{c.telefono&&` · ${c.telefono}`}
                </p>
              </div>
              {delId===c.id?(
                <div style={{display:'flex',gap:'.4rem'}} onClick={e=>e.stopPropagation()}>
                  <button className="btn btn-danger" style={{fontSize:'.72rem',padding:'.3rem .6rem'}} onClick={()=>eliminar(c.id)}>Confirmar</button>
                  <button className="btn btn-secondary" style={{fontSize:'.72rem',padding:'.3rem .6rem'}} onClick={()=>setDelId(null)}>✕</button>
                </div>
              ):(
                <button className="btn btn-secondary" style={{fontSize:'.72rem',padding:'.3rem .6rem'}}
                  onClick={e=>{e.stopPropagation();setDelId(c.id);}}>🗑</button>
              )}
            </div>
          ))}
        </div>
      )}

      {modal&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.65)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50,padding:'1rem'}}
          onClick={e=>{if(e.target===e.currentTarget)cerrar();}}>
          <div className="card" style={{width:'100%',maxWidth:'480px',padding:'1.5rem'}}>
            <h3 style={{fontSize:'1rem',fontWeight:700,color:'var(--text)',marginBottom:'1.25rem'}}>
              {form.id?'✏️ Editar chofer':'+ Nuevo chofer'}
            </h3>
            <div className="form-grid">
              <div><label style={L}>Nombre *</label><input className="input" value={form.nombre} onChange={sf('nombre')}/></div>
              <div className="form-grid form-grid-2">
                <div><label style={L}>Teléfono</label><input className="input" placeholder="11-1234-5678" value={form.telefono} onChange={sf('telefono')}/></div>
                <div><label style={L}>N° Licencia</label><input className="input" placeholder="12345678" value={form.licencia} onChange={sf('licencia')}/></div>
              </div>
              <div className="form-grid form-grid-2">
                <div><label style={L}>Vehículo</label><input className="input" placeholder="Ej: Toyota Corolla" value={form.vehiculo} onChange={sf('vehiculo')}/></div>
                <div><label style={L}>Patente</label><input className="input" placeholder="AA123BB" value={form.patente} onChange={sf('patente')}/></div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:'.75rem'}}>
                <label style={{...L,marginBottom:0}}>Activo</label>
                <button type="button" onClick={()=>setForm(f=>({...f,activo:!f.activo}))}
                  style={{width:40,height:22,borderRadius:11,border:'none',cursor:'pointer',transition:'background .2s',
                    background:form.activo?'var(--green)':'var(--bg4)',position:'relative',flexShrink:0}}>
                  <span style={{position:'absolute',top:3,left:form.activo?21:3,width:16,height:16,borderRadius:'50%',background:'#fff',transition:'left .2s'}}/>
                </button>
                <span style={{fontSize:'.78rem',color:'var(--text3)'}}>{form.activo?'Activo':'Inactivo'}</span>
              </div>
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
