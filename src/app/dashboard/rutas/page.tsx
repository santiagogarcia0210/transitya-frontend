'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { serializarFirestore, toArray } from '@/lib/utils';
import { useEmpresaTipo } from '@/hooks/useEmpresaTipo';

const ESTADOS_RUTA = ['Planificada', 'En curso', 'Completada'] as const;
type EstadoRuta = typeof ESTADOS_RUTA[number];
const BADGE_RUTA: Record<string, string> = {
  Planificada:'badge-amber', 'En curso':'badge-blue', Completada:'badge-green',
};

interface Envio { id: string; nroEnvio: string; clienteNombre: string; direccionEntrega: string; estado: string; }
interface Ruta {
  id: string; nombre: string; repartidorId: string; repartidorNombre: string;
  fecha: string; enviosIds: string[]; estado: EstadoRuta | string; enviosCount: number;
}
interface FormState {
  id: string; nombre: string; repartidorId: string; fecha: string;
  enviosIds: string[]; estado: string;
}
interface Selectable { id: string; nombre: string; }

function normRuta(r: Record<string, unknown>): Ruta {
  const ids = Array.isArray(r.enviosIds) ? r.enviosIds.map(String) : [];
  return {
    id:               String(r.id               || ''),
    nombre:           String(r.nombre           || r.NOMBRE           || ''),
    repartidorId:     String(r.repartidorId     || r.repartidor_id    || ''),
    repartidorNombre: String(r.repartidorNombre || r.repartidor       || ''),
    fecha:            String(r.fecha            || r.FECHA            || ''),
    enviosIds:        ids,
    estado:           String(r.estado           || r.ESTADO           || 'Planificada'),
    enviosCount:      ids.length,
  };
}

const L: React.CSSProperties = {display:'block',fontSize:'.78rem',color:'var(--text3)',marginBottom:'.3rem',fontWeight:500};
const EMPTY: FormState = { id:'', nombre:'', repartidorId:'', fecha:'', enviosIds:[], estado:'Planificada' };

export default function RutasPage() {
  const router = useRouter();
  const { tipo, loading: tipoLoading } = useEmpresaTipo();

  const [lista,        setLista]        = useState<Ruta[]>([]);
  const [repartidores, setRepartidores] = useState<Selectable[]>([]);
  const [enviosPend,   setEnviosPend]   = useState<Envio[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [modal,        setModal]        = useState(false);
  const [form,         setForm]         = useState<FormState>(EMPTY);
  const [saving,       setSaving]       = useState(false);
  const [delId,        setDelId]        = useState<string|null>(null);
  const [msg,          setMsg]          = useState<{text:string;ok:boolean}|null>(null);

  useEffect(() => {
    if (!tipoLoading && tipo !== null && tipo !== 'paqueteria') router.replace('/dashboard');
  }, [tipo, tipoLoading, router]);

  const cargar = async () => {
    setLoading(true);
    try {
      const [rutRes, repRes, envRes] = await Promise.allSettled([
        api.get('/api/rutas'),
        api.get('/api/repartidores'),
        api.get('/api/envios'),
      ]);
      if (rutRes.status==='fulfilled') setLista(toArray(rutRes.value.data).map(serializarFirestore).map(normRuta));
      if (repRes.status==='fulfilled')
        setRepartidores(toArray(repRes.value.data).map(serializarFirestore)
          .filter((r: Record<string,unknown>) => r.activo !== false)
          .map((r: Record<string,unknown>) => ({ id:String(r.id||''), nombre:String(r.nombre||'') })));
      if (envRes.status==='fulfilled')
        setEnviosPend(toArray(envRes.value.data).map(serializarFirestore)
          .filter((e: Record<string,unknown>) => ['Pendiente','En camino'].includes(String(e.estado||'')))
          .map((e: Record<string,unknown>) => ({
            id:String(e.id||''), nroEnvio:String(e.nroEnvio||e.tracking||''),
            clienteNombre:String(e.clienteNombre||e.cliente||''),
            direccionEntrega:String(e.direccionEntrega||e.direccion||''),
            estado:String(e.estado||''),
          })));
    } catch { /* silent */ } finally { setLoading(false); }
  };
  useEffect(() => { if (tipo==='paqueteria') cargar(); }, [tipo]);

  const sf = (k: keyof Omit<FormState,'enviosIds'>) =>
    (ev: React.ChangeEvent<HTMLInputElement|HTMLSelectElement>) =>
      setForm(f => ({ ...f, [k]: ev.target.value }));

  const toggleEnvio = (id: string) =>
    setForm(f => ({
      ...f,
      enviosIds: f.enviosIds.includes(id) ? f.enviosIds.filter(x=>x!==id) : [...f.enviosIds, id],
    }));

  const abrir = (r?: Ruta) => {
    setForm(r ? { id:r.id, nombre:r.nombre, repartidorId:r.repartidorId,
      fecha:r.fecha, enviosIds:r.enviosIds, estado:r.estado } : { ...EMPTY, fecha:new Date().toISOString().split('T')[0] });
    setMsg(null); setModal(true);
  };
  const cerrar = () => { setModal(false); setMsg(null); };

  const guardar = async () => {
    if (!form.nombre) { setMsg({ text:'El nombre es obligatorio', ok:false }); return; }
    setSaving(true); setMsg(null);
    try {
      form.id ? await api.put(`/api/rutas/${form.id}`, form)
              : await api.post('/api/rutas', form);
      cerrar(); cargar();
    } catch { setMsg({ text:'Error al guardar', ok:false }); }
    setSaving(false);
  };
  const eliminar = async (id: string) => {
    try { await api.delete(`/api/rutas/${id}`); setDelId(null); cargar(); } catch { /* silent */ }
  };

  if (tipoLoading) return <div style={{padding:'2rem',color:'var(--text3)'}}><span className="spinner"/> Verificando…</div>;
  if (tipo !== 'paqueteria') return null;

  return (
    <div>
      <div className="section-header">
        <div>
          <h2 className="section-title">🗺️ Rutas</h2>
          <p style={{fontSize:'.82rem',color:'var(--text3)',marginTop:'.2rem'}}>
            {lista.length} ruta{lista.length!==1?'s':''}
            {lista.filter(r=>r.estado==='En curso').length > 0 &&
              <> · <span style={{color:'var(--blue)'}}>{lista.filter(r=>r.estado==='En curso').length} en curso</span></>}
          </p>
        </div>
        <button className="btn btn-primary" onClick={()=>abrir()}>+ Nueva ruta</button>
      </div>

      {loading ? (
        <div style={{display:'flex',alignItems:'center',gap:'.75rem',color:'var(--text3)',padding:'2rem'}}><span className="spinner"/> Cargando…</div>
      ) : lista.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">🗺️</div><p>Sin rutas planificadas</p></div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:'.4rem'}}>
          {lista.map(r => (
            <div key={r.id} className="card"
              style={{display:'flex',alignItems:'center',gap:'1rem',padding:'.75rem 1rem',cursor:'pointer'}}
              onClick={()=>abrir(r)}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:'.5rem',flexWrap:'wrap'}}>
                  <span style={{fontSize:'.88rem',fontWeight:600,color:'var(--text)'}}>{r.nombre}</span>
                  <span className={`badge ${BADGE_RUTA[r.estado]||'badge-gray'}`}>{r.estado}</span>
                  {r.enviosCount>0 && <span className="badge badge-gray">{r.enviosCount} envío{r.enviosCount!==1?'s':''}</span>}
                </div>
                <p style={{fontSize:'.78rem',color:'var(--text3)',marginTop:'.15rem'}}>
                  {r.fecha}{r.repartidorNombre && ` · ${r.repartidorNombre}`}
                </p>
              </div>
              {delId===r.id ? (
                <div style={{display:'flex',gap:'.4rem'}} onClick={ev=>ev.stopPropagation()}>
                  <button className="btn btn-danger" style={{fontSize:'.72rem',padding:'.3rem .6rem'}} onClick={()=>eliminar(r.id)}>Confirmar</button>
                  <button className="btn btn-secondary" style={{fontSize:'.72rem',padding:'.3rem .6rem'}} onClick={()=>setDelId(null)}>✕</button>
                </div>
              ) : (
                <button className="btn btn-secondary" style={{fontSize:'.72rem',padding:'.3rem .6rem'}}
                  onClick={ev=>{ev.stopPropagation();setDelId(r.id);}}>🗑</button>
              )}
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.65)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50,padding:'1rem'}}
          onClick={ev=>{if(ev.target===ev.currentTarget)cerrar();}}>
          <div className="card" style={{width:'100%',maxWidth:'560px',maxHeight:'90vh',overflowY:'auto',padding:'1.5rem'}}>
            <h3 style={{fontSize:'1rem',fontWeight:700,color:'var(--text)',marginBottom:'1.25rem'}}>
              {form.id?'✏️ Editar ruta':'+ Nueva ruta'}
            </h3>
            <div className="form-grid">
              <div><label style={L}>Nombre *</label><input className="input" placeholder="Ej: Ruta Norte Martes" value={form.nombre} onChange={sf('nombre')}/></div>
              <div className="form-grid form-grid-2">
                <div>
                  <label style={L}>Repartidor</label>
                  <select className="select" value={form.repartidorId} onChange={sf('repartidorId')}>
                    <option value="">— Seleccioná —</option>
                    {repartidores.map(r=><option key={r.id} value={r.id}>{r.nombre}</option>)}
                  </select>
                </div>
                <div><label style={L}>Fecha</label><input type="date" className="input" value={form.fecha} onChange={sf('fecha')}/></div>
              </div>
              <div>
                <label style={L}>Estado</label>
                <select className="select" value={form.estado} onChange={sf('estado')}>
                  {ESTADOS_RUTA.map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              {/* Multi-select envíos */}
              <div>
                <label style={L}>Envíos incluidos ({form.enviosIds.length} seleccionados)</label>
                {enviosPend.length === 0 ? (
                  <p style={{fontSize:'.82rem',color:'var(--text3)',padding:'.5rem'}}>Sin envíos pendientes disponibles</p>
                ) : (
                  <div style={{maxHeight:200,overflowY:'auto',border:'1px solid var(--border2)',borderRadius:'var(--radius)',padding:'.25rem'}}>
                    {enviosPend.map(e => {
                      const sel = form.enviosIds.includes(e.id);
                      return (
                        <div key={e.id}
                          onClick={()=>toggleEnvio(e.id)}
                          style={{display:'flex',alignItems:'center',gap:'.6rem',padding:'.45rem .6rem',
                            cursor:'pointer',borderRadius:'var(--radius)',
                            background:sel?'var(--blue-dim)':'transparent',
                            borderLeft:sel?'3px solid var(--blue)':'3px solid transparent',
                            transition:'background 150ms'}}>
                          <span style={{width:16,height:16,borderRadius:3,border:`2px solid ${sel?'var(--blue)':'var(--border2)'}`,
                            background:sel?'var(--blue)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',
                            flexShrink:0,fontSize:'.65rem',color:'#fff'}}>
                            {sel?'✓':''}
                          </span>
                          <div style={{minWidth:0}}>
                            <p style={{fontSize:'.82rem',color:'var(--text)',fontWeight:sel?600:400}}>
                              {e.clienteNombre||'Sin cliente'}
                              {e.nroEnvio && <span style={{fontFamily:'monospace',marginLeft:'.4rem',fontSize:'.72rem',color:'var(--text3)'}}>{e.nroEnvio}</span>}
                            </p>
                            {e.direccionEntrega && <p style={{fontSize:'.72rem',color:'var(--text3)'}}>{e.direccionEntrega}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
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
