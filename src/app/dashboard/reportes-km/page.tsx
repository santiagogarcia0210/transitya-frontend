'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import { serializarFirestore, toArray } from '@/lib/utils';
import { exportarResumenPDF, exportarResumenMensualPDF } from '@/lib/pdfResumen';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

type Tab = 'carga' | 'resumen' | 'mensual';

/* ─── Tipos carga diaria ─────────────────────────────────────────────────── */
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

/* ─── Tipos resumen diario / mensual ─────────────────────────────────────── */
interface EgresoR { fecha?:string; categoria:string; proveedor:string; monto:number; concepto:string; tipoComprobante:string; }
interface RemitoR { fecha?:string; nroRemito:string; razonSocial:string; combustible:number; monto:number; tipoCombustible:string; }
interface ChicoR  { nombre:string; domicilio:string; diasTransportado?:number; }
interface ChoferR {
  email:string; nombre:string; vehiculo:string;
  km:{ inicial:number; final:number; recorridos:number };
  diasActivos?:number;
  montoTotal:number; observaciones:string;
  egresos:EgresoR[]; remitos:RemitoR[]; chicos:ChicoR[];
}

/* ─── Utilidades ─────────────────────────────────────────────────────────── */
const toBase64Raw = (file:File):Promise<string> =>
  new Promise((resolve,reject)=>{
    const r=new FileReader();
    r.onload=()=>resolve((r.result as string).split(',')[1]);
    r.onerror=reject;
    r.readAsDataURL(file);
  });

async function comprimirImagen(file: File, maxPx = 1200, quality = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Error al cargar imagen')); };
    img.src = objectUrl;
  });
}

function normalizar(e:Record<string,unknown>):ReporteKM {
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
    fotoIniUrl:String(e.fotoIniUrl||e['FOTO KM INICIO']||e.FOTOINICIAL||e.fotoInicio||''),
    fotoFinUrl:String(e.fotoFinUrl||e['FOTO KM FIN']||e.FOTOFINAL||e.fotoFin||''),
  };
}

const hoyISO=()=>{const h=new Date();return `${h.getFullYear()}-${String(h.getMonth()+1).padStart(2,'0')}-${String(h.getDate()).padStart(2,'0')}`;};
const $ar=(n:number)=>`$${n.toLocaleString('es-AR',{minimumFractionDigits:0,maximumFractionDigits:0})}`;

function mesLabel(ym:string):string{
  const[y,m]=ym.split('-');
  return `${MESES[parseInt(m)-1]||m} ${y}`;
}

const L:React.CSSProperties={display:'block',fontSize:'.78rem',color:'var(--text3)',marginBottom:'.3rem',fontWeight:500};
const EMPTY:FormState={id:'',fecha:'',chofer:'',vehiculo:'',kmInicial:'',kmFinal:'',combustibleLitros:'',combustibleImporte:'',observaciones:''};

/* ═══════════════════════════════════════════════════════════════════════════ */

export default function ReportesKMPage() {
  const hoy     = new Date();
  const anioAct = hoy.getFullYear();

  /* Perfil */
  const [esAdmin,    setEsAdmin]    = useState(false);
  const [miNombre,     setMiNombre]     = useState('');
  const [miVehiculo,   setMiVehiculo]   = useState('');
  const [nombreEmpresa,setNombreEmpresa]= useState('Transit·Ya');
  useEffect(()=>{
    api.get('/api/usuarios/perfil').then(r=>{
      const d=serializarFirestore(r.data);
      setEsAdmin(String(d.rol||'').toLowerCase()==='admin');
      setMiNombre(String(d.nombre||d.usuario||''));
      setMiVehiculo(String(d.vehiculo||''));
    }).catch(()=>{});
    api.get('/api/empresa').then(r=>{
      const d=r.data;
      const n=String(d?.nombre||d?.razonSocial||d?.empresa||'');
      if(n)setNombreEmpresa(n);
    }).catch(()=>{});
  },[]);

  const [tab,setTab]=useState<Tab>('carga');

  /* ═══════════════════════════════════════════════════════════════════════
     TAB CARGA DIARIA
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
  const fileInicioRef = useRef<HTMLInputElement>(null);
  const fileFinRef    = useRef<HTMLInputElement>(null);
  const [fotoIniFile, setFotoIniFile] = useState<File|null>(null);
  const [fotoFinFile, setFotoFinFile] = useState<File|null>(null);
  const [prevIni,     setPrevIni]     = useState('');
  const [prevFin,     setPrevFin]     = useState('');
  const [scanningI,   setScanningI]   = useState(false);
  const [scanningF,   setScanningF]   = useState(false);

  const cargar=async()=>{
    setLoading(true);
    try{const r=await api.get('/api/reportes');setLista(toArray(r.data).map(serializarFirestore).map(normalizar));}
    catch{/*silent*/}finally{setLoading(false);}
  };
  useEffect(()=>{if(tab==='carga')cargar();},[tab]);

  const choferes=[...new Set(lista.map(r=>r.chofer).filter(Boolean))].sort();
  const mesesFiltro=Array.from({length:12},(_,i)=>{
    const d=new Date(anioAct,hoy.getMonth()-i,1);
    const m=String(d.getMonth()+1).padStart(2,'0'),a=d.getFullYear();
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

  const abrirNuevo=()=>{
    const base={...EMPTY,fecha:hoyISO()};
    // Autocompletar para choferes
    if(!esAdmin){base.chofer=miNombre;base.vehiculo=miVehiculo;}
    setForm(base);
    setFotoIniFile(null);setFotoFinFile(null);setPrevIni('');setPrevFin('');setMsg(null);setShowModal(true);
  };
  const abrirEdit=(r:ReporteKM)=>{
    setForm({id:r.id,fecha:r.fecha,chofer:r.chofer,vehiculo:r.vehiculo,kmInicial:String(r.kmInicial),kmFinal:String(r.kmFinal),combustibleLitros:String(r.combustibleLitros),combustibleImporte:String(r.combustibleImporte),observaciones:r.observaciones});
    setFotoIniFile(null);setFotoFinFile(null);setPrevIni(r.fotoIniUrl||'');setPrevFin(r.fotoFinUrl||'');setMsg(null);setShowModal(true);
  };
  const cerrar=()=>{setShowModal(false);setMsg(null);};

  const guardar=async()=>{
    if(!form.fecha||!form.chofer){setMsg({text:'Completá fecha y chofer',ok:false});return;}
    setSaving(true);setMsg(null);
    try{
      const payload:Record<string,unknown>={...form,kmRecorridos:String(kmCalc)};
      if(fotoIniFile){
        const dataUrl=await comprimirImagen(fotoIniFile);
        payload.fotoIniBase64=dataUrl.split(',')[1];
        payload.mimeTypeFotos='image/jpeg';
      }
      if(fotoFinFile){
        const dataUrl=await comprimirImagen(fotoFinFile);
        payload.fotoFinBase64=dataUrl.split(',')[1];
        payload.mimeTypeFotos='image/jpeg';
      }
      form.id?await api.put(`/api/reportes/${form.id}`,payload):await api.post('/api/reportes',payload);
      cerrar();cargar();
    }catch(err:unknown){
      console.error('[REPORTES-KM] guardar error:',err);
      const status=(err as {response?:{status?:number}})?.response?.status;
      if(status===413){setMsg({text:'La foto es muy pesada. Reintentá con una de menor resolución.',ok:false});}
      else{const m=(err as {response?:{data?:{mensaje?:string}}})?.response?.data?.mensaje;setMsg({text:m||'Error al guardar',ok:false});}
    }
    setSaving(false);
  };
  const eliminar=async(id:string)=>{try{await api.delete(`/api/reportes/${id}`);setConfirmDel(null);cargar();}catch{/*silent*/}};

  const onFotoChange=(tipo:'inicio'|'fin')=>(ev:React.ChangeEvent<HTMLInputElement>)=>{
    const file=ev.target.files?.[0]||null;
    if(!file)return;
    const url=URL.createObjectURL(file);
    if(tipo==='inicio'){setFotoIniFile(file);setPrevIni(url);}
    else{setFotoFinFile(file);setPrevFin(url);}
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
      if(km)setForm(f=>({...f,[tipo==='inicio'?'kmInicial':'kmFinal']:km}));
    }catch{/*silent*/}
    tipo==='inicio'?setScanningI(false):setScanningF(false);
  };

  /* ═══════════════════════════════════════════════════════════════════════
     TAB RESUMEN DIARIO
     ═══════════════════════════════════════════════════════════════════════ */
  const [resumenFecha,   setResumenFecha]   = useState(hoyISO());
  const [resumenData,    setResumenData]    = useState<ChoferR[]>([]);
  const [loadingR,       setLoadingR]       = useState(false);
  const [resumenErr,     setResumenErr]     = useState('');
  const [choferSelIdx,   setChoferSelIdx]   = useState(0);

  const cargarResumen=useCallback(async(fecha:string)=>{
    setLoadingR(true);setResumenErr('');setChoferSelIdx(0);
    try{
      const r=await api.get(`/api/reportes-km/resumen-diario?fecha=${fecha}`);
      setResumenData(r.data?.choferes||[]);
    }catch(e:unknown){
      const msg=e instanceof Error?e.message:'Error al cargar el resumen';
      setResumenErr(msg);
      setResumenData([]);
    }
    setLoadingR(false);
  },[]);

  useEffect(()=>{if(tab==='resumen')cargarResumen(resumenFecha);},[tab,resumenFecha,cargarResumen]);

  const choferActivo:ChoferR|null=resumenData[choferSelIdx]??null;

  /* ═══════════════════════════════════════════════════════════════════════
     TAB REPORTE MENSUAL
     ═══════════════════════════════════════════════════════════════════════ */
  const hoyMes=`${anioAct}-${String(hoy.getMonth()+1).padStart(2,'0')}`;
  const [mensualMes,       setMensualMes]      = useState(hoyMes);
  const [mensualData,      setMensualData]     = useState<ChoferR[]>([]);
  const [loadingM,         setLoadingM]        = useState(false);
  const [mensualErr,       setMensualErr]      = useState('');
  const [mensualChoferIdx, setMensualChoferIdx]= useState(0);

  const cargarMensual=useCallback(async(mes:string)=>{
    setLoadingM(true);setMensualErr('');setMensualChoferIdx(0);
    try{
      const r=await api.get(`/api/reportes-km/resumen-mensual?mes=${mes}`);
      setMensualData(r.data?.choferes||[]);
    }catch(e:unknown){
      const errMsg=e instanceof Error?e.message:'Error al cargar el reporte mensual';
      setMensualErr(errMsg);
      setMensualData([]);
    }
    setLoadingM(false);
  },[]);

  useEffect(()=>{if(tab==='mensual')cargarMensual(mensualMes);},[tab,mensualMes,cargarMensual]);

  const mensualChoferActivo:ChoferR|null=mensualData[mensualChoferIdx]??null;

  /* ─── Render ──────────────────────────────────────────────────────────── */
  return (
    <div style={{paddingBottom:'2rem'}}>
      <div className="section-header" style={{marginBottom:'1rem'}}>
        <h2 className="section-title">🛣️ Reportes KM</h2>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:'.35rem',flexWrap:'wrap',marginBottom:'1.25rem',borderBottom:'1px solid var(--border)',paddingBottom:'.75rem'}}>
        {([
          {key:'carga'   as Tab,label:'📝 Carga diaria'},
          {key:'resumen' as Tab,label:'📊 Resumen diario'},
          {key:'mensual' as Tab,label:'📅 Reporte mensual'},
        ] as {key:Tab;label:string}[]).map(t=>(
          <button key={t.key} className={tab===t.key?'btn btn-primary':'btn btn-secondary'}
            style={{fontSize:'.82rem'}} onClick={()=>setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      {/* ══ TAB CARGA DIARIA ══════════════════════════════════════════════ */}
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
            {(filtroChofer||filtroMes)&&(
              <button className="btn btn-secondary" style={{fontSize:'.78rem'}}
                onClick={()=>{setFiltroChofer('');setFiltroMes('');}}>✕</button>
            )}
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
                              {r.fotoIniUrl&&<img src={r.fotoIniUrl} alt="KM inicial"
                                style={{width:36,height:36,objectFit:'cover',borderRadius:4,border:'1px solid var(--border)',flexShrink:0}}
                                onClick={ev=>{ev.stopPropagation();window.open(r.fotoIniUrl,'_blank');}}
                                onError={ev=>(ev.currentTarget.style.display='none')}/>}
                              {r.fotoFinUrl&&<img src={r.fotoFinUrl} alt="KM final"
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
                    <div>
                      <label style={L}>Chofer *</label>
                      <input className="input" placeholder="Nombre" value={form.chofer} onChange={setF('chofer')}
                        readOnly={!esAdmin}
                        style={!esAdmin?{opacity:.7,cursor:'not-allowed'}:undefined}/>
                    </div>
                  </div>
                  <div>
                    <label style={L}>Vehículo</label>
                    <input className="input" placeholder="Ej: AA123BB" value={form.vehiculo} onChange={setF('vehiculo')}
                      readOnly={!esAdmin&&!!miVehiculo}
                      style={(!esAdmin&&!!miVehiculo)?{opacity:.7,cursor:'not-allowed'}:undefined}/>
                  </div>
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
                    <div><label style={L}>Remitos (litros)</label><input type="number" className="input" placeholder="0" value={form.combustibleLitros} onChange={setF('combustibleLitros')}/></div>
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

      {/* ══ TAB RESUMEN DIARIO ════════════════════════════════════════════ */}
      {tab==='resumen'&&(
        <div>
          {/* Controles: fecha + refresh */}
          <div style={{display:'flex',gap:'.75rem',alignItems:'flex-end',marginBottom:'1.5rem',flexWrap:'wrap'}}>
            <div>
              <label style={L}>Fecha</label>
              <input type="date" className="input" style={{width:170}} value={resumenFecha}
                onChange={e=>setResumenFecha(e.target.value)}/>
            </div>
            <button className="btn btn-secondary" onClick={()=>cargarResumen(resumenFecha)} disabled={loadingR}
              style={{fontSize:'.82rem'}}>↻ Actualizar</button>
          </div>

          {loadingR&&(
            <div style={{display:'flex',alignItems:'center',gap:'.75rem',color:'var(--text3)',padding:'2rem'}}>
              <span className="spinner"/> Cargando resumen…
            </div>
          )}

          {!loadingR&&resumenErr&&(
            <div className="card" style={{borderColor:'var(--red-dim)',background:'var(--red-dim)',color:'var(--red)',padding:'1rem'}}>
              ⚠️ {resumenErr}
            </div>
          )}

          {!loadingR&&!resumenErr&&resumenData.length===0&&(
            <div className="empty-state">
              <div className="empty-icon">📊</div>
              <p>Sin actividad registrada para esta fecha</p>
              <p style={{fontSize:'.8rem',color:'var(--text3)',marginTop:'.5rem'}}>Probá con otra fecha o verificá que haya egresos, remitos o reportes KM cargados.</p>
            </div>
          )}

          {!loadingR&&!resumenErr&&resumenData.length>0&&(
            <div>
              {/* Selector de chofer */}
              {resumenData.length>1&&(
                <div style={{marginBottom:'1.25rem'}}>
                  <label style={L}>Chofer</label>
                  <select className="select" style={{maxWidth:320}}
                    value={choferSelIdx}
                    onChange={e=>setChoferSelIdx(Number(e.target.value))}>
                    {resumenData.map((c,i)=>(
                      <option key={c.email} value={i}>{c.nombre}{c.vehiculo?` — ${c.vehiculo}`:''}</option>
                    ))}
                  </select>
                </div>
              )}

              {choferActivo&&<ChoferCard chofer={choferActivo} fecha={resumenFecha} empresa={nombreEmpresa}/>}
            </div>
          )}
        </div>
      )}

      {/* ══ TAB REPORTE MENSUAL ═══════════════════════════════════════════ */}
      {tab==='mensual'&&(
        <div>
          <div style={{display:'flex',gap:'1rem',alignItems:'flex-end',marginBottom:'1.25rem',flexWrap:'wrap'}}>
            <div>
              <label style={L}>Mes</label>
              <input type="month" className="input" style={{width:164}} value={mensualMes}
                onChange={e=>setMensualMes(e.target.value)}/>
            </div>
            <button className="btn btn-secondary" onClick={()=>cargarMensual(mensualMes)} disabled={loadingM}
              style={{padding:'.45rem .9rem'}}>↻</button>
          </div>

          {loadingM&&(
            <div style={{display:'flex',alignItems:'center',gap:'.75rem',color:'var(--text3)',padding:'2rem'}}>
              <span className="spinner"/> Cargando…
            </div>
          )}
          {!loadingM&&mensualErr&&(
            <div className="alert alert-error">{mensualErr}</div>
          )}
          {!loadingM&&!mensualErr&&mensualData.length===0&&(
            <div className="empty-state">
              <div className="empty-icon">📅</div>
              <p>Sin datos para {mesLabel(mensualMes)}</p>
            </div>
          )}
          {!loadingM&&!mensualErr&&mensualData.length>0&&(
            <div>
              {mensualData.length>1&&(
                <div style={{marginBottom:'1.25rem'}}>
                  <label style={L}>Chofer</label>
                  <select className="select" style={{maxWidth:320}}
                    value={mensualChoferIdx}
                    onChange={e=>setMensualChoferIdx(Number(e.target.value))}>
                    {mensualData.map((c,i)=>(
                      <option key={c.email} value={i}>{c.nombre}{c.vehiculo?` — ${c.vehiculo}`:''}</option>
                    ))}
                  </select>
                </div>
              )}
              {mensualChoferActivo&&(
                <ChoferCard chofer={mensualChoferActivo} fecha={mensualMes} empresa={nombreEmpresa} modo="mes"/>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ChoferCard — vista detallada de un chofer en el resumen diario
   ═══════════════════════════════════════════════════════════════════════════ */
function ChoferCard({chofer,fecha,empresa,modo='dia'}:{chofer:ChoferR;fecha:string;empresa:string;modo?:'dia'|'mes'}) {
  const $ar=(n:number)=>`$${n.toLocaleString('es-AR',{minimumFractionDigits:0,maximumFractionDigits:0})}`;
  const esMes=modo==='mes';
  const [exportando,setExportando]=useState(false);

  const handleExport=async()=>{
    setExportando(true);
    try{
      if(esMes) exportarResumenMensualPDF(chofer,fecha,empresa);
      else exportarResumenPDF(chofer,fecha,empresa);
    }
    catch(e){ console.error('[PDF]',e); }
    finally{ setExportando(false); }
  };

  return (
    <div>
      {/* Cabecera del chofer */}
      <div className="card" style={{marginBottom:'1rem',padding:'1.25rem 1.5rem'}}>
        <div style={{display:'flex',flexWrap:'wrap',gap:'1rem',alignItems:'center',justifyContent:'space-between'}}>
          <div>
            <p style={{fontWeight:700,fontSize:'1.05rem',color:'var(--text)'}}>{chofer.nombre}</p>
            {chofer.vehiculo&&(
              <p style={{fontSize:'.83rem',color:'var(--text3)',marginTop:'.2rem'}}>🚗 {chofer.vehiculo}</p>
            )}
          </div>
          <div style={{display:'flex',gap:'1.5rem',flexWrap:'wrap'}}>
            {esMes&&chofer.diasActivos!==undefined&&(
              <div style={{textAlign:'center'}}>
                <p style={{fontSize:'.68rem',color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.07em',fontWeight:700}}>Días activos</p>
                <p style={{fontSize:'1.1rem',fontWeight:700,color:'var(--text2)'}}>{chofer.diasActivos}</p>
              </div>
            )}
            <div style={{textAlign:'center'}}>
              <p style={{fontSize:'.68rem',color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.07em',fontWeight:700}}>{esMes?'KM ini (1er día)':'KM Inicial'}</p>
              <p style={{fontSize:'1.1rem',fontWeight:700,color:'var(--text2)'}}>{chofer.km.inicial.toLocaleString('es-AR')}</p>
            </div>
            <div style={{textAlign:'center'}}>
              <p style={{fontSize:'.68rem',color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.07em',fontWeight:700}}>{esMes?'KM fin (últ. día)':'KM Final'}</p>
              <p style={{fontSize:'1.1rem',fontWeight:700,color:'var(--text2)'}}>{chofer.km.final.toLocaleString('es-AR')}</p>
            </div>
            <div style={{textAlign:'center'}}>
              <p style={{fontSize:'.68rem',color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.07em',fontWeight:700}}>{esMes?'KM del mes':'Recorridos'}</p>
              <p style={{fontSize:'1.25rem',fontWeight:800,color:'var(--purple)'}}>{chofer.km.recorridos.toLocaleString('es-AR')} km</p>
            </div>
            <div style={{textAlign:'center'}}>
              <p style={{fontSize:'.68rem',color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.07em',fontWeight:700}}>Monto total</p>
              <p style={{fontSize:'1.25rem',fontWeight:800,color:'var(--green)'}}>{$ar(chofer.montoTotal)}</p>
            </div>
            <button className="btn btn-secondary" onClick={handleExport} disabled={exportando}
              style={{fontSize:'.78rem',padding:'.4rem .8rem',alignSelf:'center',flexShrink:0}}
              title="Exportar PDF de este chofer">
              {exportando?<><span className="spinner" style={{width:11,height:11}}/>Generando…</>:'📄 Exportar PDF'}
            </button>
          </div>
        </div>
      </div>

      {/* Egresos + Remitos — side by side en desktop */}
      <div style={{display:'flex',gap:'1rem',flexWrap:'wrap',marginBottom:'1rem'}}>

        {/* Cuadro 1: Egresos */}
        <div className="card" style={{flex:'1',minWidth:'260px',padding:'1.25rem'}}>
          <p style={{fontSize:'.75rem',fontWeight:700,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:'.85rem'}}>
            💳 Egresos
          </p>
          {chofer.egresos.length===0?(
            <p style={{fontSize:'.83rem',color:'var(--text3)',fontStyle:'italic'}}>Sin egresos registrados</p>
          ):(
            <div style={{display:'flex',flexDirection:'column',gap:'.55rem'}}>
              {chofer.egresos.map((e,i)=>(
                <div key={i} style={{padding:'.65rem .85rem',background:'var(--bg4)',borderRadius:'var(--radius)',border:'1px solid var(--border)'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:'.5rem'}}>
                    <div style={{minWidth:0}}>
                      {esMes&&e.fecha&&(
                        <p style={{fontSize:'.7rem',color:'var(--text3)',marginBottom:'.15rem',fontWeight:600}}>{e.fecha}</p>
                      )}
                      <p style={{fontSize:'.82rem',fontWeight:600,color:'var(--text)',marginBottom:'.1rem'}}>
                        {e.categoria||'Sin categoría'}
                      </p>
                      {e.proveedor&&<p style={{fontSize:'.75rem',color:'var(--text3)'}}>{e.proveedor}</p>}
                      {e.concepto&&<p style={{fontSize:'.75rem',color:'var(--text3)'}}>{e.concepto}</p>}
                      {e.tipoComprobante&&(
                        <span className="badge badge-gray" style={{marginTop:'.3rem',fontSize:'.68rem'}}>{e.tipoComprobante}</span>
                      )}
                    </div>
                    <p style={{fontWeight:700,color:'var(--amber)',whiteSpace:'nowrap',fontSize:'.9rem',flexShrink:0}}>{$ar(e.monto)}</p>
                  </div>
                </div>
              ))}
              <div style={{borderTop:'1px solid var(--border)',paddingTop:'.6rem',marginTop:'.2rem',display:'flex',justifyContent:'flex-end'}}>
                <p style={{fontSize:'.82rem',fontWeight:700,color:'var(--amber)'}}>
                  Total: {$ar(chofer.egresos.reduce((s,e)=>s+e.monto,0))}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Cuadro 2: Remitos */}
        <div className="card" style={{flex:'1',minWidth:'260px',padding:'1.25rem'}}>
          <p style={{fontSize:'.75rem',fontWeight:700,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:'.85rem'}}>
            ⛽ Remitos
          </p>
          {chofer.remitos.length===0?(
            <p style={{fontSize:'.83rem',color:'var(--text3)',fontStyle:'italic'}}>Sin remitos registrados</p>
          ):(
            <div style={{display:'flex',flexDirection:'column',gap:'.55rem'}}>
              {chofer.remitos.map((r,i)=>(
                <div key={i} style={{padding:'.65rem .85rem',background:'var(--bg4)',borderRadius:'var(--radius)',border:'1px solid var(--border)'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:'.5rem'}}>
                    <div style={{minWidth:0}}>
                      {esMes&&r.fecha&&(
                        <p style={{fontSize:'.7rem',color:'var(--text3)',marginBottom:'.15rem',fontWeight:600}}>{r.fecha}</p>
                      )}
                      {r.nroRemito&&<p style={{fontSize:'.75rem',color:'var(--text3)',marginBottom:'.1rem'}}>N° {r.nroRemito}</p>}
                      <p style={{fontSize:'.82rem',fontWeight:600,color:'var(--text)',marginBottom:'.1rem'}}>
                        {r.razonSocial||'Sin proveedor'}
                      </p>
                      <p style={{fontSize:'.75rem',color:'var(--text3)'}}>
                        {r.tipoCombustible||'—'}{r.combustible>0?` · ${r.combustible} L`:''}
                      </p>
                    </div>
                    <p style={{fontWeight:700,color:'var(--amber)',whiteSpace:'nowrap',fontSize:'.9rem',flexShrink:0}}>{$ar(r.monto)}</p>
                  </div>
                </div>
              ))}
              <div style={{borderTop:'1px solid var(--border)',paddingTop:'.6rem',marginTop:'.2rem',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <p style={{fontSize:'.78rem',color:'var(--text3)'}}>
                  {chofer.remitos.reduce((s,r)=>s+r.combustible,0).toLocaleString('es-AR')} L total
                </p>
                <p style={{fontSize:'.82rem',fontWeight:700,color:'var(--amber)'}}>
                  Total: {$ar(chofer.remitos.reduce((s,r)=>s+r.monto,0))}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Observaciones */}
      {chofer.observaciones&&(
        <div className="card" style={{marginBottom:'1rem',padding:'1rem 1.25rem',borderLeft:'3px solid var(--border2)'}}>
          <p style={{fontSize:'.72rem',fontWeight:700,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:'.4rem'}}>📝 Observaciones</p>
          <p style={{fontSize:'.88rem',color:'var(--text2)'}}>{chofer.observaciones}</p>
        </div>
      )}

      {/* Chicos / Beneficiarios */}
      <div className="card" style={{padding:'1.25rem'}}>
        <p style={{fontSize:'.75rem',fontWeight:700,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:'.85rem'}}>
          👥 {esMes?'Beneficiarios del mes':'Beneficiarios del día'}
          {chofer.chicos.length>0&&(
            <span style={{marginLeft:'.5rem',color:'var(--blue-bright)',fontWeight:600}}>{chofer.chicos.length}</span>
          )}
        </p>
        {chofer.chicos.length===0?(
          <p style={{fontSize:'.83rem',color:'var(--text3)',fontStyle:'italic'}}>
            {esMes?'Sin asistencia en el mes':'Sin asistencia asignada para esta fecha'}
          </p>
        ):(
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:'.5rem'}}>
            {chofer.chicos.map((b,i)=>(
              <div key={i} style={{padding:'.55rem .75rem',background:'var(--bg4)',borderRadius:'var(--radius)',border:'1px solid var(--border)'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:'.4rem'}}>
                  <div style={{minWidth:0}}>
                    <p style={{fontSize:'.83rem',fontWeight:600,color:'var(--text)'}}>{b.nombre}</p>
                    {b.domicilio&&<p style={{fontSize:'.73rem',color:'var(--text3)',marginTop:'.1rem'}}>{b.domicilio}</p>}
                  </div>
                  {esMes&&b.diasTransportado!==undefined&&(
                    <span className="badge badge-blue" style={{fontSize:'.68rem',flexShrink:0}}>{b.diasTransportado}d</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
