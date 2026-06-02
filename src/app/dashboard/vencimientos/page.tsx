'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { serializarFirestore, toArray } from '@/lib/utils';

const TIPOS = ['Seguro', 'VTV', 'Licencia', 'Otro'];

type EstadoVenc = 'VENCIDO' | 'PROXIMO' | 'VIGENTE';
type TabVenc = 'todos' | 'VENCIDO' | 'PROXIMO' | 'VIGENTE';

interface Vencimiento {
  id: string; descripcion: string; persona: string; chofer: string; vehiculo: string;
  tipo: string; fechaVencimiento: string; diasAviso: number; notas: string;
  estado: EstadoVenc; diasRestantes: number;
}

function calcularInfo(fechaStr: string, diasAviso = 30): { estado: EstadoVenc; dias: number } {
  if (!fechaStr) return { estado: 'VIGENTE', dias: 999 };
  const fecha = new Date(fechaStr);
  if (isNaN(fecha.getTime())) return { estado: 'VIGENTE', dias: 999 };
  const dias = Math.round((fecha.getTime() - Date.now()) / 86400000);
  if (dias < 0) return { estado: 'VENCIDO', dias };
  if (dias <= diasAviso) return { estado: 'PROXIMO', dias };
  return { estado: 'VIGENTE', dias };
}

function normalizar(v: Record<string, unknown>): Vencimiento {
  const fecha = String(v.fechaVencimiento || v.fechaVenc || v.fecha || v.FECHAVENCIMIENTO || v.FECHAVENC || v.FECHA || '');
  const diasAviso = Number(v.diasAviso || v.DIASAVISO || 30);
  const { estado, dias } = calcularInfo(fecha, diasAviso);
  const chofer  = String(v.chofer  || v.CHOFER  || '');
  const vehiculo= String(v.vehiculo|| v.VEHICULO|| '');
  return {
    id:               String(v.id          || ''),
    descripcion:      String(v.descripcion || v.DESCRIPCION || v.documento || ''),
    persona:          String(v.persona     || v.PERSONA     || chofer      || ''),
    chofer,
    vehiculo,
    tipo:             String(v.tipo        || v.TIPO        || 'Otro'),
    fechaVencimiento: fecha,
    diasAviso,
    notas:            String(v.notas       || v.NOTAS       || v.observaciones || ''),
    estado,
    diasRestantes:    dias,
  };
}

const L: React.CSSProperties = {
  display:'block', fontSize:'.78rem', color:'var(--text3)', marginBottom:'.3rem', fontWeight:500,
};

const EMPTY = { id:'', descripcion:'', persona:'', fechaVencimiento:'', tipo:'Seguro', diasAviso:'30', notas:'' };

export default function VencimientosPage() {
  const [lista,         setLista]         = useState<Vencimiento[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [tabVenc,       setTabVenc]       = useState<TabVenc>('todos');
  const [filtroTipo,    setFiltroTipo]    = useState('');
  const [busqPersona,   setBusqPersona]   = useState('');
  const [showModal,     setShowModal]     = useState(false);
  const [form,          setForm]          = useState(EMPTY);
  const [saving,        setSaving]        = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string|null>(null);
  const [msg,           setMsg]           = useState<{text:string;ok:boolean}|null>(null);

  const cargar = async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/vencimientos');
      const datos = toArray(r.data).map(serializarFirestore).map(normalizar);
      // Ordenar siempre por días restantes ascendente
      datos.sort((a, b) => a.diasRestantes - b.diasRestantes);
      setLista(datos);
    } catch { /* silent */ }
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);

  // Contadores por estado
  const counts = {
    VENCIDO: lista.filter(v => v.estado === 'VENCIDO').length,
    PROXIMO: lista.filter(v => v.estado === 'PROXIMO').length,
    VIGENTE: lista.filter(v => v.estado === 'VIGENTE').length,
  };

  // Filtrado combinado
  const filtrados = lista.filter(v => {
    if (tabVenc !== 'todos' && v.estado !== tabVenc) return false;
    if (filtroTipo && v.tipo !== filtroTipo) return false;
    if (busqPersona) {
      const q = busqPersona.toLowerCase();
      if (!v.persona.toLowerCase().includes(q) && !v.chofer.toLowerCase().includes(q) &&
          !v.descripcion.toLowerCase().includes(q) && !v.vehiculo.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const setF = (k: keyof typeof EMPTY) =>
    (ev: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [k]: ev.target.value }));

  const abrirNuevo = () => { setForm(EMPTY); setMsg(null); setShowModal(true); };
  const abrirEdicion = (v: Vencimiento) => {
    setForm({ id:v.id, descripcion:v.descripcion, persona:v.persona||v.chofer,
      fechaVencimiento:v.fechaVencimiento, tipo:v.tipo, diasAviso:String(v.diasAviso), notas:v.notas });
    setMsg(null); setShowModal(true);
  };
  const cerrar = () => { setShowModal(false); setMsg(null); };

  const guardar = async () => {
    if (!form.descripcion || !form.fechaVencimiento) {
      setMsg({ text:'Completá descripción y fecha', ok:false }); return;
    }
    setSaving(true); setMsg(null);
    try {
      form.id ? await api.put(`/api/vencimientos/${form.id}`, form)
              : await api.post('/api/vencimientos', form);
      cerrar(); cargar();
    } catch { setMsg({ text:'Error al guardar', ok:false }); }
    setSaving(false);
  };

  const eliminar = async (id: string) => {
    try { await api.delete(`/api/vencimientos/${id}`); setConfirmDelete(null); cargar(); }
    catch { /* silent */ }
  };

  return (
    <div>
      <div className="section-header">
        <div>
          <h2 className="section-title">📅 Vencimientos</h2>
          <p style={{ fontSize:'.82rem', color:'var(--text3)', marginTop:'.2rem' }}>
            {counts.VENCIDO > 0 && <span style={{color:'var(--red)'}}>{counts.VENCIDO} vencido{counts.VENCIDO!==1?'s':''} · </span>}
            {counts.PROXIMO > 0 && <span style={{color:'var(--amber)'}}>{counts.PROXIMO} próximo{counts.PROXIMO!==1?'s':''} · </span>}
            {lista.length} total
          </p>
        </div>
        <button className="btn btn-primary" onClick={abrirNuevo}>+ Nuevo</button>
      </div>

      {/* Tabs como filtros con contadores */}
      <div style={{ display:'flex', gap:'.35rem', flexWrap:'wrap', marginBottom:'1rem',
        borderBottom:'1px solid var(--border)', paddingBottom:'.75rem' }}>
        {([
          { key:'todos'   as TabVenc, label:'Todos',    badge:String(lista.length),       color:'' },
          { key:'VENCIDO' as TabVenc, label:'Vencidos', badge:String(counts.VENCIDO),     color:'badge-red' },
          { key:'PROXIMO' as TabVenc, label:'Próximos', badge:String(counts.PROXIMO),     color:'badge-amber' },
          { key:'VIGENTE' as TabVenc, label:'Vigentes', badge:String(counts.VIGENTE),     color:'badge-green' },
        ]).map(t => (
          <button key={t.key}
            className={tabVenc === t.key ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{ fontSize:'.82rem', display:'flex', alignItems:'center', gap:'.4rem' }}
            onClick={() => setTabVenc(t.key)}>
            {t.label}
            <span className={`badge ${tabVenc===t.key?'badge-green':t.color||'badge-gray'}`}
              style={{ fontSize:'.68rem', padding:'.1rem .4rem', minWidth:20, textAlign:'center' }}>
              {t.badge}
            </span>
          </button>
        ))}
      </div>

      {/* Filtros adicionales */}
      <div className="filter-bar" style={{ marginBottom:'1rem' }}>
        <select className="select" value={filtroTipo} onChange={e=>setFiltroTipo(e.target.value)}>
          <option value="">Todos los tipos</option>
          {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input className="input" placeholder="Buscar persona o vehículo…"
          value={busqPersona} onChange={e=>setBusqPersona(e.target.value)} />
        {(filtroTipo || busqPersona) && (
          <button className="btn btn-secondary" style={{fontSize:'.78rem'}}
            onClick={() => { setFiltroTipo(''); setBusqPersona(''); }}>✕ Limpiar</button>
        )}
      </div>

      {/* Sección destacada: próximos a vencer (solo en vista "todos") */}
      {!loading && tabVenc === 'todos' && counts.PROXIMO > 0 && (
        <div style={{ background:'var(--amber-dim)', border:'1px solid var(--amber)',
          borderRadius:'var(--radius-lg)', padding:'.85rem 1rem', marginBottom:'1rem' }}>
          <p style={{ fontSize:'.8rem', fontWeight:700, color:'var(--amber)', marginBottom:'.5rem' }}>
            ⚠️ Próximos a vencer ({counts.PROXIMO})
          </p>
          <div style={{ display:'flex', flexDirection:'column', gap:'.3rem' }}>
            {lista.filter(v => v.estado === 'PROXIMO').map(v => (
              <div key={v.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                fontSize:'.82rem', color:'var(--text)' }}>
                <span>{v.descripcion}{(v.persona||v.chofer) && ` — ${v.persona||v.chofer}`}</span>
                <span style={{ fontWeight:700, color:'var(--amber)', flexShrink:0, marginLeft:'1rem' }}>
                  {v.diasRestantes} día{v.diasRestantes !== 1 ? 's' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div style={{display:'flex',alignItems:'center',gap:'.75rem',color:'var(--text3)',padding:'2rem'}}>
          <span className="spinner"/> Cargando vencimientos…
        </div>
      ) : filtrados.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">📅</div><p>Sin vencimientos en esta categoría</p></div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'.4rem' }}>
          {filtrados.map(v => {
            const diasAbs = Math.abs(v.diasRestantes);
            const diasColor = v.estado === 'VENCIDO' ? 'var(--red)' : v.estado === 'PROXIMO' ? 'var(--amber)' : 'var(--green)';
            const diasLabel = v.estado === 'VENCIDO'
              ? `-${diasAbs} día${diasAbs !== 1 ? 's' : ''}`
              : `${v.diasRestantes} día${v.diasRestantes !== 1 ? 's' : ''}`;
            return (
              <div key={v.id} className="card"
                style={{ display:'flex', alignItems:'center', gap:'1rem', padding:'.75rem 1rem', cursor:'pointer' }}
                onClick={() => abrirEdicion(v)}>
                {/* Días destacados */}
                <div style={{ minWidth:56, textAlign:'center', flexShrink:0 }}>
                  <p style={{ fontSize:'1.1rem', fontWeight:800, color:diasColor, lineHeight:1 }}>{diasLabel}</p>
                  <p style={{ fontSize:'.65rem', color:'var(--text3)', marginTop:'.1rem' }}>
                    {v.estado === 'VENCIDO' ? 'vencido' : 'restantes'}
                  </p>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'.5rem', flexWrap:'wrap' }}>
                    <span style={{ fontSize:'.88rem', fontWeight:600, color:'var(--text)' }}>{v.descripcion}</span>
                    <span className={`badge ${v.estado==='VENCIDO'?'badge-red':v.estado==='PROXIMO'?'badge-amber':'badge-green'}`}>
                      {v.estado}
                    </span>
                    <span className="badge badge-gray">{v.tipo}</span>
                  </div>
                  <p style={{ fontSize:'.78rem', color:'var(--text3)', marginTop:'.15rem' }}>
                    {v.fechaVencimiento || 'Sin fecha'}
                    {(v.persona||v.chofer) && ` · ${v.persona||v.chofer}`}
                    {v.vehiculo && ` · ${v.vehiculo}`}
                    {v.notas && ` · ${v.notas}`}
                  </p>
                </div>
                {confirmDelete === v.id ? (
                  <div style={{display:'flex',gap:'.4rem'}} onClick={ev=>ev.stopPropagation()}>
                    <button className="btn btn-danger" style={{fontSize:'.72rem',padding:'.3rem .6rem'}} onClick={()=>eliminar(v.id)}>Confirmar</button>
                    <button className="btn btn-secondary" style={{fontSize:'.72rem',padding:'.3rem .6rem'}} onClick={()=>setConfirmDelete(null)}>✕</button>
                  </div>
                ) : (
                  <button className="btn btn-secondary" style={{fontSize:'.72rem',padding:'.3rem .6rem'}}
                    onClick={ev=>{ev.stopPropagation();setConfirmDelete(v.id);}}>🗑</button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.65)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50,padding:'1rem'}}
          onClick={e=>{if(e.target===e.currentTarget)cerrar();}}>
          <div className="card" style={{width:'100%',maxWidth:'480px',padding:'1.5rem'}}>
            <h3 style={{fontSize:'1rem',fontWeight:700,color:'var(--text)',marginBottom:'1.25rem'}}>
              {form.id ? '✏️ Editar vencimiento' : '+ Nuevo vencimiento'}
            </h3>
            <div className="form-grid">
              <div><label style={L}>Descripción *</label>
                <input className="input" placeholder="Ej: Licencia de conducir — Juan Pérez" value={form.descripcion} onChange={setF('descripcion')}/></div>
              <div className="form-grid form-grid-2">
                <div><label style={L}>Tipo</label>
                  <select className="select" value={form.tipo} onChange={setF('tipo')}>
                    {TIPOS.map(t=><option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div><label style={L}>Persona</label>
                  <input className="input" placeholder="Nombre" value={form.persona} onChange={setF('persona')}/></div>
              </div>
              <div className="form-grid form-grid-2">
                <div><label style={L}>Fecha de vencimiento *</label>
                  <input type="date" className="input" value={form.fechaVencimiento} onChange={setF('fechaVencimiento')}/></div>
                <div><label style={L}>Días de aviso</label>
                  <input type="number" className="input" min="1" max="365" value={form.diasAviso} onChange={setF('diasAviso')}/>
                  <p style={{fontSize:'.7rem',color:'var(--text3)',marginTop:'.2rem'}}>Días antes para alertar (default 30)</p>
                </div>
              </div>
              <div><label style={L}>Notas</label>
                <input className="input" placeholder="Opcional…" value={form.notas} onChange={setF('notas')}/></div>
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
