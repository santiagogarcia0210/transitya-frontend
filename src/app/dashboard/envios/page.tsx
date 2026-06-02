'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { serializarFirestore, toArray } from '@/lib/utils';
import { useEmpresaTipo } from '@/hooks/useEmpresaTipo';

const ESTADOS = ['Pendiente', 'En camino', 'Entregado', 'No entregado'] as const;
type EstadoEnvio = typeof ESTADOS[number];

const BADGE_EST: Record<string, string> = {
  Pendiente: 'badge-amber', 'En camino': 'badge-blue', Entregado: 'badge-green', 'No entregado': 'badge-red',
};

interface Envio {
  id: string; nroEnvio: string; fecha: string;
  clienteId: string; clienteNombre: string;
  repartidorId: string; repartidorNombre: string;
  direccionEntrega: string; bultos: number; pesoKg: number;
  descripcion: string; estado: EstadoEnvio | string;
  monto: number; observaciones: string;
}
interface FormState {
  id: string; nroEnvio: string; fecha: string;
  clienteId: string; repartidorId: string;
  direccionEntrega: string; bultos: string; pesoKg: string;
  descripcion: string; estado: string; monto: string; observaciones: string;
}
interface Selectable { id: string; nombre: string; }

function norm(e: Record<string, unknown>): Envio {
  return {
    id:               String(e.id              || ''),
    nroEnvio:         String(e.nroEnvio        || e.nro_envio       || e.tracking         || ''),
    fecha:            String(e.fecha           || e.FECHA           || ''),
    clienteId:        String(e.clienteId       || e.cliente_id      || ''),
    clienteNombre:    String(e.clienteNombre   || e.cliente         || e.CLIENTE          || ''),
    repartidorId:     String(e.repartidorId    || e.repartidor_id   || ''),
    repartidorNombre: String(e.repartidorNombre|| e.repartidor      || e.REPARTIDOR       || ''),
    direccionEntrega: String(e.direccionEntrega|| e.direccion       || e.DIRECCION        || ''),
    bultos:           Number(e.bultos          || e.BULTOS          || 0),
    pesoKg:           Number(e.pesoKg          || e.peso            || e.PESO             || 0),
    descripcion:      String(e.descripcion     || e.DESCRIPCION     || ''),
    estado:           String(e.estado          || e.ESTADO          || 'Pendiente'),
    monto:            Number(e.monto           || e.MONTO           || 0),
    observaciones:    String(e.observaciones   || e.OBSERVACIONES   || ''),
  };
}

function generarNroEnvio(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  const rand = String(Math.floor(Math.random()*9000)+1000);
  return `PKT-${y}${m}${day}-${rand}`;
}

const fmt = (n: number) =>
  n > 0 ? n.toLocaleString('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}) : '—';
const L: React.CSSProperties = {display:'block',fontSize:'.78rem',color:'var(--text3)',marginBottom:'.3rem',fontWeight:500};

const EMPTY: FormState = {
  id:'', nroEnvio:'', fecha:'', clienteId:'', repartidorId:'',
  direccionEntrega:'', bultos:'', pesoKg:'', descripcion:'', estado:'Pendiente', monto:'', observaciones:'',
};

export default function EnviosPage() {
  const router = useRouter();
  const { tipo, loading: tipoLoading } = useEmpresaTipo();

  const [lista,        setLista]        = useState<Envio[]>([]);
  const [clientes,     setClientes]     = useState<Selectable[]>([]);
  const [repartidores, setRepartidores] = useState<Selectable[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [filtroEst,    setFiltroEst]    = useState('');
  const [busq,         setBusq]         = useState('');
  const [modal,        setModal]        = useState(false);
  const [form,         setForm]         = useState<FormState>(EMPTY);
  const [saving,       setSaving]       = useState(false);
  const [cambiandoId,  setCambiandoId]  = useState<string|null>(null);
  const [delId,        setDelId]        = useState<string|null>(null);
  const [msg,          setMsg]          = useState<{text:string;ok:boolean}|null>(null);

  useEffect(() => {
    if (!tipoLoading && tipo !== null && tipo !== 'paqueteria') router.replace('/dashboard');
  }, [tipo, tipoLoading, router]);

  const cargar = async () => {
    setLoading(true);
    try {
      const [envResp, cliResp, repResp] = await Promise.allSettled([
        api.get('/api/envios'),
        api.get('/api/clientes'),
        api.get('/api/repartidores'),
      ]);
      if (envResp.status==='fulfilled') setLista(toArray(envResp.value.data).map(serializarFirestore).map(norm));
      if (cliResp.status==='fulfilled')
        setClientes(toArray(cliResp.value.data).map(serializarFirestore)
          .map((c: Record<string,unknown>) => ({ id:String(c.id||''), nombre:String(c.nombre||c.NOMBRE||'') })));
      if (repResp.status==='fulfilled')
        setRepartidores(toArray(repResp.value.data).map(serializarFirestore)
          .filter((r: Record<string,unknown>) => r.activo !== false)
          .map((r: Record<string,unknown>) => ({ id:String(r.id||''), nombre:String(r.nombre||r.NOMBRE||'') })));
    } catch { /* silent */ } finally { setLoading(false); }
  };
  useEffect(() => { if (tipo==='paqueteria') cargar(); }, [tipo]);

  const filtrados = lista.filter(e => {
    const q = busq.toLowerCase();
    if (q && !e.nroEnvio.toLowerCase().includes(q) && !e.clienteNombre.toLowerCase().includes(q)
          && !e.descripcion.toLowerCase().includes(q)) return false;
    if (filtroEst && e.estado !== filtroEst) return false;
    return true;
  });

  const sf = (k: keyof FormState) =>
    (ev: React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: ev.target.value }));

  const abrir = (e?: Envio) => {
    setForm(e ? {
      id:e.id, nroEnvio:e.nroEnvio, fecha:e.fecha, clienteId:e.clienteId,
      repartidorId:e.repartidorId, direccionEntrega:e.direccionEntrega,
      bultos:String(e.bultos||''), pesoKg:String(e.pesoKg||''),
      descripcion:e.descripcion, estado:e.estado, monto:String(e.monto||''), observaciones:e.observaciones,
    } : { ...EMPTY, nroEnvio:generarNroEnvio(), fecha:new Date().toISOString().split('T')[0] });
    setMsg(null); setModal(true);
  };
  const cerrar = () => { setModal(false); setMsg(null); };

  const guardar = async () => {
    setSaving(true); setMsg(null);
    try {
      form.id ? await api.put(`/api/envios/${form.id}`, form)
              : await api.post('/api/envios', form);
      cerrar(); cargar();
    } catch { setMsg({ text:'Error al guardar', ok:false }); }
    setSaving(false);
  };

  const cambiarEstado = async (id: string, estado: string, ev: React.ChangeEvent<HTMLSelectElement>) => {
    ev.stopPropagation();
    setCambiandoId(id);
    try {
      await api.patch(`/api/envios/${id}/estado`, { estado });
      cargar();
    } catch { /* silent */ }
    setCambiandoId(null);
  };

  const eliminar = async (id: string) => {
    try { await api.delete(`/api/envios/${id}`); setDelId(null); cargar(); } catch { /* silent */ }
  };

  if (tipoLoading) return <div style={{padding:'2rem',color:'var(--text3)'}}><span className="spinner"/> Verificando…</div>;
  if (tipo !== 'paqueteria') return null;

  const counts = ESTADOS.reduce((acc, s) => ({ ...acc, [s]: lista.filter(e=>e.estado===s).length }), {} as Record<string,number>);

  return (
    <div>
      <div className="section-header">
        <div>
          <h2 className="section-title">📦 Envíos</h2>
          <p style={{fontSize:'.82rem',color:'var(--text3)',marginTop:'.2rem'}}>
            {filtrados.length} envío{filtrados.length!==1?'s':''}
            {counts['Pendiente']>0 && <> · <span style={{color:'var(--amber)'}}>{counts['Pendiente']} pendiente{counts['Pendiente']!==1?'s':''}</span></>}
            {counts['En camino']>0 && <> · <span style={{color:'var(--blue)'}}>{counts['En camino']} en camino</span></>}
          </p>
        </div>
        <button className="btn btn-primary" onClick={()=>abrir()}>+ Nuevo envío</button>
      </div>

      {/* Stats rápidas */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'1rem',marginBottom:'1.25rem'}}>
        {ESTADOS.map(s => (
          <div key={s} className="stat-card" style={{cursor:'pointer',outline:filtroEst===s?`2px solid var(--blue)`:undefined}}
            onClick={()=>setFiltroEst(filtroEst===s?'':s)}>
            <p className="stat-label">{s}</p>
            <p className="stat-value" style={{color:{Pendiente:'var(--amber)','En camino':'var(--blue)',Entregado:'var(--green)','No entregado':'var(--red)'}[s]}}>
              {counts[s]||0}
            </p>
          </div>
        ))}
      </div>

      <div className="filter-bar">
        <input className="input" placeholder="Buscar N° envío, cliente o descripción…" value={busq} onChange={e=>setBusq(e.target.value)}/>
        {(busq||filtroEst) && <button className="btn btn-secondary" style={{fontSize:'.78rem'}} onClick={()=>{setBusq('');setFiltroEst('');}}>✕ Limpiar</button>}
      </div>

      {loading ? (
        <div style={{display:'flex',alignItems:'center',gap:'.75rem',color:'var(--text3)',padding:'2rem'}}><span className="spinner"/> Cargando…</div>
      ) : filtrados.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">📦</div><p>Sin envíos</p></div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:'.4rem'}}>
          {filtrados.map(e => (
            <div key={e.id} className="card"
              style={{display:'flex',alignItems:'center',gap:'1rem',padding:'.75rem 1rem',cursor:'pointer'}}
              onClick={()=>abrir(e)}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:'.5rem',flexWrap:'wrap'}}>
                  <span style={{fontSize:'.88rem',fontWeight:600,color:'var(--text)'}}>{e.clienteNombre||'Sin cliente'}</span>
                  {e.nroEnvio && <span className="badge badge-gray" style={{fontFamily:'monospace',fontSize:'.7rem'}}>{e.nroEnvio}</span>}
                  <span className={`badge ${BADGE_EST[e.estado]||'badge-gray'}`}>{e.estado}</span>
                </div>
                <p style={{fontSize:'.78rem',color:'var(--text3)',marginTop:'.15rem'}}>
                  {e.fecha}
                  {e.repartidorNombre && ` · ${e.repartidorNombre}`}
                  {e.direccionEntrega && ` · ${e.direccionEntrega}`}
                  {e.bultos>0 && ` · ${e.bultos} bulto${e.bultos!==1?'s':''}`}
                </p>
              </div>
              {e.monto>0 && <p style={{fontSize:'.95rem',fontWeight:700,color:'var(--text)',whiteSpace:'nowrap'}}>{fmt(e.monto)}</p>}

              {/* Cambio de estado inline */}
              <select
                className="select"
                style={{fontSize:'.75rem',padding:'.25rem .5rem',width:'auto',minWidth:110,flexShrink:0,opacity:cambiandoId===e.id?.6:1}}
                value={e.estado}
                disabled={cambiandoId===e.id}
                onClick={ev=>ev.stopPropagation()}
                onChange={ev=>cambiarEstado(e.id, ev.target.value, ev)}>
                {ESTADOS.map(s=><option key={s} value={s}>{s}</option>)}
              </select>

              {delId===e.id ? (
                <div style={{display:'flex',gap:'.4rem'}} onClick={ev=>ev.stopPropagation()}>
                  <button className="btn btn-danger" style={{fontSize:'.72rem',padding:'.3rem .6rem'}} onClick={()=>eliminar(e.id)}>Confirmar</button>
                  <button className="btn btn-secondary" style={{fontSize:'.72rem',padding:'.3rem .6rem'}} onClick={()=>setDelId(null)}>✕</button>
                </div>
              ) : (
                <button className="btn btn-secondary" style={{fontSize:'.72rem',padding:'.3rem .6rem'}}
                  onClick={ev=>{ev.stopPropagation();setDelId(e.id);}}>🗑</button>
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
              {form.id?'✏️ Editar envío':'+ Nuevo envío'}
            </h3>
            <div className="form-grid">
              <div className="form-grid form-grid-2">
                <div>
                  <label style={L}>N° Seguimiento</label>
                  <input className="input" style={{fontFamily:'monospace'}} value={form.nroEnvio} onChange={sf('nroEnvio')}
                    readOnly={!!form.id} placeholder="Auto-generado"/>
                </div>
                <div><label style={L}>Fecha</label><input type="date" className="input" value={form.fecha} onChange={sf('fecha')}/></div>
              </div>
              <div className="form-grid form-grid-2">
                <div>
                  <label style={L}>Cliente</label>
                  <select className="select" value={form.clienteId} onChange={sf('clienteId')}>
                    <option value="">— Seleccioná —</option>
                    {clientes.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label style={L}>Repartidor</label>
                  <select className="select" value={form.repartidorId} onChange={sf('repartidorId')}>
                    <option value="">— Seleccioná —</option>
                    {repartidores.map(r=><option key={r.id} value={r.id}>{r.nombre}</option>)}
                  </select>
                </div>
              </div>
              <div><label style={L}>Dirección de entrega</label><input className="input" placeholder="Calle 123, Ciudad" value={form.direccionEntrega} onChange={sf('direccionEntrega')}/></div>
              <div className="form-grid form-grid-2">
                <div><label style={L}>Bultos</label><input type="number" className="input" placeholder="1" value={form.bultos} onChange={sf('bultos')}/></div>
                <div><label style={L}>Peso (kg)</label><input type="number" className="input" placeholder="0.5" value={form.pesoKg} onChange={sf('pesoKg')}/></div>
              </div>
              <div><label style={L}>Descripción</label><input className="input" placeholder="Ej: Electrónica, Ropa…" value={form.descripcion} onChange={sf('descripcion')}/></div>
              <div className="form-grid form-grid-2">
                <div>
                  <label style={L}>Estado</label>
                  <select className="select" value={form.estado} onChange={sf('estado')}>
                    {ESTADOS.map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div><label style={L}>Monto ($)</label><input type="number" className="input" placeholder="0" value={form.monto} onChange={sf('monto')}/></div>
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
