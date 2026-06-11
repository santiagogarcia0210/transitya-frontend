'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import { serializarFirestore, toArray } from '@/lib/utils';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

type Tab = 'carga'|'diario'|'mensual';

/* ─── Tipos ─────────────────────────────────────────────────────────── */

interface ReporteKM {
  id:string; fecha:string; chofer:string; vehiculo:string;
  kmInicial:number; kmFinal:number; kmRecorridos:number;
  combustibleLitros:number; combustibleImporte:number; observaciones:string;
  fotoIniUrl:string; fotoFinUrl:string;
}

interface FormState {
  id:string; fecha:string; chofer:string; vehiculo:string;
  kmInicial:string; kmFinal:string;
  combustibleLitros:string; combustibleImporte:string; observaciones:string;
}

interface GrupoChofer {
  chofer:string; vehiculo:string;
  kmTotal:number; litrosTotal:number; costoTotal:number;
  diasTrabajados:number; kmPromedio:number;
  registros:ReporteKM[];
}

const toBase64Raw = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

function normalizar(e: Record<string,unknown>): ReporteKM {
  const ki=Number(e.kmInicial||e['KM INICIAL']||e.km_inicial||0);
  const kf=Number(e.kmFinal||e['KM FINAL']||e.km_final||0);
  return {
    id:String(e.id||''), fecha:String(e.fecha||e.FECHA||''),
    chofer:String(e.chofer||e.CHOFER||''), vehiculo:String(e.vehiculo||e.VEHICULO||''),
    kmInicial:ki, kmFinal:kf,
    kmRecorridos:Number(e.kmRecorridos||e['KM RECORRIDOS']||e.km||0)||Math.max(0,kf-ki),
    combustibleLitros:Number(e.combustibleLitros||e['COMBUSTIBLE LITROS']||e.litros||0),
    combustibleImporte:Number(e.combustibleImporte||e.combustiblePesos||e['COMBUSTIBLE IMPORTE']||e['COMBUSTIBLE PESOS']||e.importe||0),
    observaciones:String(e.observaciones||e.OBSERVACIONES||''),
    fotoIniUrl:String(e.fotoIniUrl||e.FOTOINICIAL||e.fotoInicio||''),
    fotoFinUrl:String(e.fotoFinUrl||e.FOTOFINAL||e.fotoFin||''),
  };
}

const L:React.CSSProperties={display:'block',fontSize:'.78rem',color:'var(--text3)',marginBottom:'.3rem',fontWeight:500};
const EMPTY:FormState={id:'',fecha:'',chofer:'',vehiculo:'',kmInicial:'',kmFinal:'',combustibleLitros:'',combustibleImporte:'',observaciones:''};

function mesLabel(ym:string):string{
  const [y,m]=ym.split('-');
  return `${MESES[parseInt(m)-1]||m} ${y}`;
}

/* ═══════════════════════════════════════════════════════════════════════ */

export default function ReportesKMPage() {
  const hoy      = new Date();
  const anioAct  = hoy.getFullYear();

  /* Perfil */
  const [esAdmin, setEsAdmin] = useState(false);
  const [miNombre,setMiNombre]= useState('');
  useEffect(()=>{
    api.get('/api/usuarios/perfil').then(r=>{
      const d=serializarFirestore(r.data);
      setEsAdmin(String(d.rol||'').toLowerCase()==='admin');
      setMiNombre(String(d.nombre||d.usuario||''));
    }).catch(()=>{});
  },[]);

  const [tab, setTab] = useState<Tab>('carga');

  /* ═══════════════════════════════════════════════════════════════════════
     TAB CARGA DIARIA (CRUD existente)
     ═══════════════════════════════════════════════════════════════════════ */
  const [lista,       setLista]       = useState<ReporteKM[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [filtroChofer,setFiltroChofer]= useState('');
  const [filtroMes,   setFiltroMes]   = useState('');
  const [showModal,   setShowModal]   = useState(false);
  const [form,        setForm]        = useState<FormState>(EMPTY);
  const [saving,      setSaving]      = useState(false);
  const [confirmDel,  setConfirmDel]  = useState<string|null>(null);
  const [msg,         setMsg]         = useState<{text:string;ok:boolean}|null>(null);
  /* Fotos odómetro */
  const fileInicioRef = useRef<HTMLInputElement>(null);
  const fileFinRef    = useRef<HTMLInputElement>(null);
  const [fotoIniFile, setFotoIniFile] = useState<File|null>(null);
  const [fotoFinFile, setFotoFinFile] = useState<File|null>(null);
  const [prevIni,     setPrevIni]     = useState('');
  const [prevFin,     setPrevFin]     = useState('');
  const [scanningI,   setScanningI]   = useState(false);
  const [scanningF,   setScanningF]   = useState(false);

  const cargar = async () => {
    setLoading(true);
    try{ const r=await api.get('/api/reportes'); setLista(toArray(r.data).map(serializarFirestore).map(normalizar)); }
    catch{/*silent*/}finally{setLoading(false);}
  };
  useEffect(()=>{if(tab==='carga')cargar();},[tab]);

  const choferes=[...new Set(lista.map(r=>r.chofer).filter(Boolean))].sort();
  const mesesFiltro=Array.from({length:12},(_,i)=>{
    const d=new Date(anioAct,hoy.getMonth()-i,1);
    const m=String(d.getMonth()+1).padStart(2,'0'), a=d.getFullYear();
    return{value:`${m}-${a}`,label:`${MESES[d.getMonth()]} ${a}`};
  });

  const filtrados=lista.filter(r=>{
    if(filtroChofer&&r.chofer!==filtroChofer)return false;
    if(filtroMes){const[m,a]=filtroMes.split('-');if(!r.fecha.includes(`/${m}/${a}`)&&!r.fecha.startsWith(`${a}-${m}`))return false;}
    return true;
  });
  const totalKM=filtrados.reduce((s,r)=>s+r.kmRecorridos,0);
  const totalL =filtrados.reduce((s,r)=>s+r.combustibleLitros,0);
  const getFechaKey=(f:string)=>{
    if(!f)return'sin-mes';
    if(/^\d{4}-\d{2}/.test(f))return f.slice(0,7);
    const p=f.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    return p?`${p[3]}-${p[2].padStart(2,'0')}`:f.slice(0,7)||'sin-mes';
  };
  const porMes:Record<string,ReporteKM[]>={};
  filtrados.forEach(r=>{const m=getFechaKey(r.fecha);if(!porMes[m])porMes[m]=[];porMes[m].push(r);});

  const kmCalc=Math.max(0,(parseFloat(form.kmFinal)||0)-(parseFloat(form.kmInicial)||0));
  const setF=(k:keyof FormState)=>(ev:React.ChangeEvent<HTMLInputElement>)=>setForm(f=>({...f,[k]:ev.target.value}));
  const abrirNuevo=()=>{setForm({...EMPTY,fecha:new Date().toISOString().split('T')[0]});setFotoIniFile(null);setFotoFinFile(null);setPrevIni('');setPrevFin('');setMsg(null);setShowModal(true);};
  const abrirEdit=(r:ReporteKM)=>{setForm({id:r.id,fecha:r.fecha,chofer:r.chofer,vehiculo:r.vehiculo,kmInicial:String(r.kmInicial),kmFinal:String(r.kmFinal),combustibleLitros:String(r.combustibleLitros),combustibleImporte:String(r.combustibleImporte),observaciones:r.observaciones});setFotoIniFile(null);setFotoFinFile(null);setPrevIni(r.fotoIniUrl||'');setPrevFin(r.fotoFinUrl||'');setMsg(null);setShowModal(true);};
  const cerrar=()=>{setShowModal(false);setMsg(null);};

  const guardar=async()=>{
    if(!form.fecha||!form.chofer){setMsg({text:'Completá fecha y chofer',ok:false});return;}
    setSaving(true);setMsg(null);
    try{
      const payload: Record<string,unknown> = {...form, kmRecorridos:String(kmCalc)};
      if(fotoIniFile){
        payload.fotoIniBase64 = await toBase64Raw(fotoIniFile);
        payload.mimeTypeFotos = fotoIniFile.type || 'image/jpeg';
      }
      if(fotoFinFile){
        payload.fotoFinBase64 = await toBase64Raw(fotoFinFile);
        payload.mimeTypeFotos = fotoFinFile.type || 'image/jpeg';
      }
      form.id?await api.put(`/api/reportes/${form.id}`,payload):await api.post('/api/reportes',payload);
      cerrar();cargar();
    }catch{setMsg({text:'Error al guardar',ok:false});}
    setSaving(false);
  };
  const eliminar=async(id:string)=>{try{await api.delete(`/api/reportes/${id}`);setConfirmDel(null);cargar();}catch{/*silent*/}};

  const onFotoChange=(tipo:'inicio'|'fin')=>(ev:React.ChangeEvent<HTMLInputElement>)=>{
    const file=ev.target.files?.[0]||null;
    if(!file)return;
    const url=URL.createObjectURL(file);
    if(tipo==='inicio'){setFotoIniFile(file);setPrevIni(url);}
    else{setFotoFinFile(file);setPrevFin(url);}
    // lanzar scan automáticamente
    escanearOdometroConFile(tipo,file);
  };

  const escanearOdometro=async(tipo:'inicio'|'fin')=>{
    const ref=tipo==='inicio'?fileInicioRef:fileFinRef;
    const existingFile=tipo==='inicio'?fotoIniFile:fotoFinFile;
    if(!existingFile){ref.current?.click();return;}
    escanearOdometroConFile(tipo,existingFile);
  };

  const escanearOdometroConFile=async(tipo:'inicio'|'fin',file:File)=>{
    tipo==='inicio'?setScanningI(true):setScanningF(true);
    try{
      const bytes=await file.arrayBuffer();
      const b64=btoa(String.fromCharCode(...new Uint8Array(bytes)));
      const r=await api.post('/api/ia/escanear-odometro',{fotoBase64:b64,tipo});
      const km=String(r.data?.km||r.data?.valor||'');
      if(km) setForm(f=>({...f,[tipo==='inicio'?'kmInicial':'kmFinal']:km}));
    }catch{/*silent*/}
    tipo==='inicio'?setScanningI(false):setScanningF(false);
  };

  /* ═══════════════════════════════════════════════════════════════════════
     TAB REPORTE DIARIO
     ═══════════════════════════════════════════════════════════════════════ */
  const [diaISO,    setDiaISO]    = useState(new Date().toISOString().split('T')[0]);
  const [diaData,   setDiaData]   = useState<ReporteKM[]>([]);
  const [loadingD,  setLoadingD]  = useState(false);

  const isoToES=(iso:string)=>{const[y,m,d]=iso.split('-');return`${d}/${m}/${y}`;};

  const cargarDiario=useCallback(async(iso:string)=>{
    setLoadingD(true);
    try{
      const r=await api.get(`/api/reportes/diario?fecha=${encodeURIComponent(isoToES(iso))}`);
      setDiaData(toArray(r.data).map(serializarFirestore).map(normalizar));
    }catch{setDiaData([]);}
    setLoadingD(false);
  },[]);

  useEffect(()=>{if(tab==='diario')cargarDiario(diaISO);},[diaISO,tab,cargarDiario]);

  // Si es chofer, filtrar solo sus registros
  const diaFiltrado=esAdmin?diaData:diaData.filter(r=>r.chofer===miNombre);

  /* ═══════════════════════════════════════════════════════════════════════
     TAB REPORTE MENSUAL
     ═══════════════════════════════════════════════════════════════════════ */
  const [repMes,    setRepMes]    = useState(hoy.getMonth()+1);
  const [repAnio,   setRepAnio]   = useState(anioAct);
  const [grupos,    setGrupos]    = useState<GrupoChofer[]>([]);
  const [loadingM,  setLoadingM]  = useState(false);

  const cargarMensual=useCallback(async(mes:number,anio:number)=>{
    setLoadingM(true);
    try{
      const r=await api.get(`/api/reportes/mensual?mes=${mes}&anio=${anio}`);
      const d=serializarFirestore(r.data);
      const regs:ReporteKM[]=toArray(d.registros??d.data??d).map(serializarFirestore).map(normalizar);
      // Agrupar por chofer
      const map:Record<string,ReporteKM[]>={};
      regs.forEach(reg=>{if(!map[reg.chofer])map[reg.chofer]=[];map[reg.chofer].push(reg);});
      setGrupos(Object.entries(map).map(([chofer,rs])=>({
        chofer,
        vehiculo:rs[0]?.vehiculo||'',
        kmTotal:rs.reduce((s,x)=>s+x.kmRecorridos,0),
        litrosTotal:rs.reduce((s,x)=>s+x.combustibleLitros,0),
        costoTotal:rs.reduce((s,x)=>s+x.combustibleImporte,0),
        diasTrabajados:rs.length,
        kmPromedio:rs.length>0?Math.round(rs.reduce((s,x)=>s+x.kmRecorridos,0)/rs.length):0,
        registros:rs,
      })));
    }catch{setGrupos([]);}
    setLoadingM(false);
  },[]);

  useEffect(()=>{if(tab==='mensual')cargarMensual(repMes,repAnio);},[repMes,repAnio,tab,cargarMensual]);

  // Si es chofer filtrar
  const gruposFiltrados=esAdmin?grupos:grupos.filter(g=>g.chofer===miNombre);
  const totalesMens={
    km:gruposFiltrados.reduce((s,g)=>s+g.kmTotal,0),
    litros:gruposFiltrados.reduce((s,g)=>s+g.litrosTotal,0),
    costo:gruposFiltrados.reduce((s,g)=>s+g.costoTotal,0),
    dias:gruposFiltrados.reduce((s,g)=>s+g.diasTrabajados,0),
  };

  /* ─── Render ──────────────────────────────────────────────────────── */
  return (
    <div>
      <div className="section-header" style={{marginBottom:'1rem'}}>
        <h2 className="section-title">🛣️ Reportes KM</h2>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:'.35rem',flexWrap:'wrap',marginBottom:'1.25rem',borderBottom:'1px solid var(--border)',paddingBottom:'.75rem'}}>
        {([
          {key:'carga' as Tab, label:'📝 Carga diaria'},
          {key:'diario' as Tab,label:'📊 Reporte diario'},
          {key:'mensual' as Tab,label:'📅 Reporte mensual'},
        ] as {key:Tab;label:string}[]).map(t=>(
          <button key={t.key} className={tab===t.key?'btn btn-primary':'btn btn-secondary'}
            style={{fontSize:'.82rem'}} onClick={()=>setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      {/* ══ TAB CARGA DIARIA ══════════════════════════════════════════ */}
      {tab==='carga'&&(
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1rem',flexWrap:'wrap',gap:'.5rem'}}>
            <p style={{fontSize:'.82rem',color:'var(--text3)'}}>
              <strong style={{color:'var(--purple)'}}>{totalKM.toLocaleString('es-AR')} km</strong>
              {totalL>0&&<> · {totalL.toLocaleString('es-AR')} L</>}
            </p>
            <button className="btn btn-primary" onClick={abrirNuevo}>+ Nuevo reporte</button>
          </div>

          <div className="filter-bar">
            {choferes.length>0&&(
              <select className="select" value={filtroChofer} onChange={e=>setFiltroChofer(e.target.value)}>
                <option value="">Todos los choferes</option>
                {choferes.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            )}
            <select className="select" value={filtroMes} onChange={e=>setFiltroMes(e.target.value)}>
              <option value="">Todos los meses</option>
              {mesesFiltro.map(m=><option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            {(filtroChofer||filtroMes)&&<button className="btn btn-secondary" style={{fontSize:'.78rem'}} onClick={()=>{setFiltroChofer('');setFiltroMes('');}}>✕</button>}
          </div>

          {loading?(
            <div style={{display:'flex',alignItems:'center',gap:'.75rem',color:'var(--text3)',padding:'2rem'}}><span className="spinner"/> Cargando…</div>
          ):filtrados.length===0?(
            <div className="empty-state"><div className="empty-icon">🛣️</div><p>Sin reportes</p></div>
          ):(
            <>
              {Object.entries(porMes).sort((a,b)=>b[0].localeCompare(a[0])).map(([mes,items])=>(
                <div key={mes} style={{marginBottom:'1.25rem'}}>
                  <p style={{fontSize:'.75rem',fontWeight:700,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:'.5rem'}}>
                    {mes==='sin-mes'?'Sin fecha':mesLabel(mes)}
                    <span style={{marginLeft:'.5rem',color:'var(--purple)',fontWeight:600}}>{items.reduce((s,r)=>s+r.kmRecorridos,0).toLocaleString('es-AR')} km</span>
                  </p>
                  <div style={{display:'flex',flexDirection:'column',gap:'.4rem'}}>
                    {items.map(r=>(
                      <div key={r.id} className="card"
                        style={{display:'flex',alignItems:'center',gap:'1rem',padding:'.75rem 1rem',cursor:'pointer'}}
                        onClick={()=>abrirEdit(r)}>
                        <div style={{flex:1,minWidth:0}}>
                          <span style={{fontSize:'.88rem',fontWeight:600,color:'var(--text)'}}>{r.chofer||'Sin chofer'}{r.vehiculo&&` · ${r.vehiculo}`}</span>
                          <p style={{fontSize:'.78rem',color:'var(--text3)',marginTop:'.15rem'}}>
                            {r.fecha}{r.combustibleLitros>0&&` · ${r.combustibleLitros} L`}{r.combustibleImporte>0&&` · $${r.combustibleImporte.toLocaleString('es-AR')}`}
                          </p>
                          {(r.fotoIniUrl||r.fotoFinUrl)&&(
                            <div style={{display:'flex',gap:4,marginTop:4}}>
                              {r.fotoIniUrl&&<img src={r.fotoIniUrl} alt="KM inicial" title="Foto KM inicial"
                                style={{width:36,height:36,objectFit:'cover',borderRadius:4,border:'1px solid var(--border)',flexShrink:0}}
                                onClick={ev=>{ev.stopPropagation();window.open(r.fotoIniUrl,'_blank');}}
                                onError={ev=>(ev.currentTarget.style.display='none')}/>}
                              {r.fotoFinUrl&&<img src={r.fotoFinUrl} alt="KM final" title="Foto KM final"
                                style={{width:36,height:36,objectFit:'cover',borderRadius:4,border:'1px solid var(--border)',flexShrink:0}}
                                onClick={ev=>{ev.stopPropagation();window.open(r.fotoFinUrl,'_blank');}}
                                onError={ev=>(ev.currentTarget.style.display='none')}/>}
                            </div>
                          )}
                        </div>
                        <p style={{fontSize:'1rem',fontWeight:700,color:'var(--purple)',whiteSpace:'nowrap'}}>{r.kmRecorridos.toLocaleString('es-AR')} km</p>
                        {confirmDel===r.id?(
                          <div style={{display:'flex',gap:'.4rem'}} onClick={ev=>ev.stopPropagation()}>
                            <button className="btn btn-danger" style={{fontSize:'.72rem',padding:'.3rem .6rem'}} onClick={()=>eliminar(r.id)}>Confirmar</button>
                            <button className="btn btn-secondary" style={{fontSize:'.72rem',padding:'.3rem .6rem'}} onClick={()=>setConfirmDel(null)}>✕</button>
                          </div>
                        ):(
                          <button className="btn btn-secondary" style={{fontSize:'.72rem',padding:'.3rem .6rem'}}
                            onClick={ev=>{ev.stopPropagation();setConfirmDel(r.id);}}>🗑</button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Modal */}
          {showModal&&(
            <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.65)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50,padding:'1rem'}}
              onClick={e=>{if(e.target===e.currentTarget)cerrar();}}>
              <div className="card" style={{width:'100%',maxWidth:'520px',maxHeight:'90vh',overflowY:'auto',padding:'1.5rem'}}>
                <h3 style={{fontSize:'1rem',fontWeight:700,color:'var(--text)',marginBottom:'1.25rem'}}>
                  {form.id?'✏️ Editar reporte':'+ Nuevo reporte KM'}
                </h3>
                <div className="form-grid">
                  <div className="form-grid form-grid-2">
                    <div><label style={L}>Fecha *</label><input type="date" className="input" value={form.fecha} onChange={setF('fecha')}/></div>
                    <div><label style={L}>Chofer *</label><input className="input" placeholder="Nombre" value={form.chofer} onChange={setF('chofer')}/></div>
                  </div>
                  <div><label style={L}>Vehículo</label><input className="input" placeholder="Ej: AA123BB" value={form.vehiculo} onChange={setF('vehiculo')}/></div>
                  <div className="form-grid form-grid-2">
                    <div>
                      <label style={L}>KM Inicial</label>
                      <div style={{display:'flex',gap:'.35rem'}}>
                        <input type="number" className="input" placeholder="0" value={form.kmInicial} onChange={setF('kmInicial')} style={{flex:1}}/>
                        <input ref={fileInicioRef} type="file" accept="image/*" style={{display:'none'}} onChange={onFotoChange('inicio')}/>
                        <button type="button" className="btn btn-secondary" style={{fontSize:'.7rem',padding:'.3rem .5rem',flexShrink:0}}
                          onClick={()=>escanearOdometro('inicio')} disabled={scanningI} title="Foto + IA">
                          {scanningI?<span className="spinner" style={{width:10,height:10}}/>:'🤖'}
                        </button>
                      </div>
                      {prevIni&&<img src={prevIni} alt="foto inicio" style={{marginTop:'.35rem',maxHeight:60,maxWidth:'100%',borderRadius:'var(--radius)',objectFit:'contain'}}/>}
                    </div>
                    <div>
                      <label style={L}>KM Final</label>
                      <div style={{display:'flex',gap:'.35rem'}}>
                        <input type="number" className="input" placeholder="0" value={form.kmFinal} onChange={setF('kmFinal')} style={{flex:1}}/>
                        <input ref={fileFinRef} type="file" accept="image/*" style={{display:'none'}} onChange={onFotoChange('fin')}/>
                        <button type="button" className="btn btn-secondary" style={{fontSize:'.7rem',padding:'.3rem .5rem',flexShrink:0}}
                          onClick={()=>escanearOdometro('fin')} disabled={scanningF} title="Foto + IA">
                          {scanningF?<span className="spinner" style={{width:10,height:10}}/>:'🤖'}
                        </button>
                      </div>
                      {prevFin&&<img src={prevFin} alt="foto fin" style={{marginTop:'.35rem',maxHeight:60,maxWidth:'100%',borderRadius:'var(--radius)',objectFit:'contain'}}/>}
                    </div>
                  </div>
                  <div><label style={L}>KM Recorridos (calculado)</label>
                    <input type="number" className="input" value={kmCalc} readOnly style={{opacity:.6,cursor:'not-allowed'}}/></div>
                  <div className="form-grid form-grid-2">
                    <div><label style={L}>Combustible (litros)</label><input type="number" className="input" placeholder="0" value={form.combustibleLitros} onChange={setF('combustibleLitros')}/></div>
                    <div><label style={L}>Combustible ($)</label><input type="number" className="input" placeholder="0" value={form.combustibleImporte} onChange={setF('combustibleImporte')}/></div>
                  </div>
                  <div><label style={L}>Observaciones</label><input className="input" placeholder="Opcional…" value={form.observaciones} onChange={setF('observaciones')}/></div>
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
      )}

      {/* ══ TAB REPORTE DIARIO ════════════════════════════════════════ */}
      {tab==='diario'&&(
        <div>
          <div style={{display:'flex',gap:'1rem',alignItems:'flex-end',marginBottom:'1.25rem',flexWrap:'wrap'}}>
            <div>
              <label style={L}>Fecha</label>
              <input type="date" className="input" style={{width:160}} value={diaISO} onChange={e=>setDiaISO(e.target.value)}/>
            </div>
            <button className="btn btn-secondary" onClick={()=>cargarDiario(diaISO)} disabled={loadingD}>↻</button>
            <span style={{fontSize:'.82rem',color:'var(--text3)',alignSelf:'center'}}>
              {new Date(diaISO+'T00:00:00').toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'})}
            </span>
          </div>

          {loadingD?(
            <div style={{display:'flex',alignItems:'center',gap:'.75rem',color:'var(--text3)',padding:'2rem'}}><span className="spinner"/> Cargando…</div>
          ):diaFiltrado.length===0?(
            <div className="empty-state"><div className="empty-icon">📊</div><p>Sin reportes para este día</p></div>
          ):(
            <div>
              {/* Resumen del día */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:'1rem',marginBottom:'1.25rem'}}>
                {[
                  {l:'KM totales',  v:`${diaFiltrado.reduce((s,r)=>s+r.kmRecorridos,0).toLocaleString('es-AR')} km`,c:'var(--purple)'},
                  {l:'Litros',      v:`${diaFiltrado.reduce((s,r)=>s+r.combustibleLitros,0).toLocaleString('es-AR')} L`,c:'var(--amber)'},
                  {l:'Costo comb.', v:`$${diaFiltrado.reduce((s,r)=>s+r.combustibleImporte,0).toLocaleString('es-AR')}`,c:'var(--red)'},
                  {l:'Choferes',    v:String(diaFiltrado.length),c:'var(--blue)'},
                ].map(s=>(
                  <div key={s.l} className="stat-card">
                    <p className="stat-label">{s.l}</p>
                    <p className="stat-value" style={{color:s.c,fontSize:'1.5rem'}}>{s.v}</p>
                  </div>
                ))}
              </div>
              <div className="tabla-wrap">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Chofer</th><th>Vehículo</th>
                      <th style={{textAlign:'center'}}>KM Inicial</th>
                      <th style={{textAlign:'center'}}>KM Final</th>
                      <th style={{textAlign:'center'}}>KM Rec.</th>
                      <th style={{textAlign:'center'}}>Litros</th>
                      <th style={{textAlign:'center'}}>Costo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diaFiltrado.map(r=>(
                      <tr key={r.id}>
                        <td style={{fontWeight:500,color:'var(--text)'}}>{r.chofer||'—'}</td>
                        <td>{r.vehiculo||'—'}</td>
                        <td style={{textAlign:'center'}}>{r.kmInicial.toLocaleString('es-AR')}</td>
                        <td style={{textAlign:'center'}}>{r.kmFinal.toLocaleString('es-AR')}</td>
                        <td style={{textAlign:'center',fontWeight:700,color:'var(--purple)'}}>{r.kmRecorridos.toLocaleString('es-AR')}</td>
                        <td style={{textAlign:'center'}}>{r.combustibleLitros>0?`${r.combustibleLitros} L`:'—'}</td>
                        <td style={{textAlign:'center'}}>{r.combustibleImporte>0?`$${r.combustibleImporte.toLocaleString('es-AR')}`:'—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ TAB REPORTE MENSUAL ═══════════════════════════════════════ */}
      {tab==='mensual'&&(
        <div>
          <div style={{display:'flex',gap:'1rem',alignItems:'flex-end',marginBottom:'1.25rem',flexWrap:'wrap'}}>
            <div>
              <label style={L}>Mes</label>
              <select className="select" style={{width:140}} value={repMes} onChange={e=>setRepMes(Number(e.target.value))}>
                {MESES.map((m,i)=><option key={i} value={i+1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label style={L}>Año</label>
              <input type="number" className="input" style={{width:100}} value={repAnio} onChange={e=>setRepAnio(Number(e.target.value))}/>
            </div>
            <button className="btn btn-secondary" onClick={()=>cargarMensual(repMes,repAnio)} disabled={loadingM}>↻</button>
          </div>

          {loadingM?(
            <div style={{display:'flex',alignItems:'center',gap:'.75rem',color:'var(--text3)',padding:'2rem'}}><span className="spinner"/> Cargando…</div>
          ):gruposFiltrados.length===0?(
            <div className="empty-state"><div className="empty-icon">📅</div><p>Sin datos para {MESES[repMes-1]} {repAnio}</p></div>
          ):(
            <div>
              {/* Totales generales */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:'1rem',marginBottom:'1.5rem'}}>
                {[
                  {l:'KM total',     v:`${totalesMens.km.toLocaleString('es-AR')} km`,   c:'var(--purple)'},
                  {l:'Litros total', v:`${totalesMens.litros.toLocaleString('es-AR')} L`, c:'var(--amber)'},
                  {l:'Costo total',  v:`$${totalesMens.costo.toLocaleString('es-AR')}`,   c:'var(--red)'},
                  {l:'Días trabajados',v:String(totalesMens.dias),                         c:'var(--blue)'},
                ].map(s=>(
                  <div key={s.l} className="stat-card">
                    <p className="stat-label">{s.l}</p>
                    <p className="stat-value" style={{color:s.c,fontSize:'1.5rem'}}>{s.v}</p>
                  </div>
                ))}
              </div>

              {/* Tabla por chofer */}
              <div className="tabla-wrap">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Chofer</th><th>Vehículo</th>
                      <th style={{textAlign:'center'}}>Días</th>
                      <th style={{textAlign:'center'}}>KM total</th>
                      <th style={{textAlign:'center'}}>KM prom/día</th>
                      <th style={{textAlign:'center'}}>Litros</th>
                      <th style={{textAlign:'center'}}>Costo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gruposFiltrados.map(g=>(
                      <tr key={g.chofer}>
                        <td style={{fontWeight:500,color:'var(--text)'}}>{g.chofer||'—'}</td>
                        <td>{g.vehiculo||'—'}</td>
                        <td style={{textAlign:'center'}}>{g.diasTrabajados}</td>
                        <td style={{textAlign:'center',fontWeight:700,color:'var(--purple)'}}>{g.kmTotal.toLocaleString('es-AR')}</td>
                        <td style={{textAlign:'center'}}>{g.kmPromedio.toLocaleString('es-AR')}</td>
                        <td style={{textAlign:'center'}}>{g.litrosTotal>0?`${g.litrosTotal.toLocaleString('es-AR')} L`:'—'}</td>
                        <td style={{textAlign:'center'}}>{g.costoTotal>0?`$${g.costoTotal.toLocaleString('es-AR')}`:'—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
