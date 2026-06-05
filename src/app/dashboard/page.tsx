'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { serializarFirestore, toArray } from '@/lib/utils';
import { useEmpresaTipo } from '@/hooks/useEmpresaTipo';

/* ─── Tipos ─────────────────────────────────────────────────────────── */

interface ChoferEstado { nombre:string; usuario:string; vehiculo:string; tieneReporte:boolean; hace?:string; lat?:number; lng?:number; }
interface UbicChofer  { nombre:string; vehiculo:string; lat:number; lng:number; hace:string; online:boolean; }
interface AsistHoy    { chofer:string; presentes:number; ausentes:number; pendientes:number; total:number; }

interface Tablero {
  beneficiariosActivos:number; bajasMes:number;
  egresosMes:number; totalEgresosMes:number;
  ingresosMes:number; totalIngresosMes:number;
  totalPagadoMes:number; totalPresentadoMes:number;
  kmMes:number; combustibleMes:number;
  estadoChoferes:ChoferEstado[]; mesNombre:string; anio:number;
  empresaNombre:string; empresaLogo?:string;
}

interface Movimiento { id:string; tipo:'ingreso'|'egreso'; fecha:string; concepto:string; monto:number; estado:string; }

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

/* ─── Helpers ────────────────────────────────────────────────────────── */

const num = (v:unknown):number => { const n=Number(v); return isFinite(n)?n:0; };
const str = (v:unknown):string => { if(!v)return''; if(typeof v==='string')return v; return String(v); };
const getFecha = (d:Record<string,unknown>) => str(d.fecha??d.FECHA??'');
const getMonto  = (d:Record<string,unknown>) => num(d.monto??d.MONTO??0);
const getEstado = (d:Record<string,unknown>) => str(d.estado??d.ESTADO??'').toUpperCase();
const getConcepto=(d:Record<string,unknown>) => str(d.concepto??d.CONCEPTO??d.descripcion??d.DESCRIPCION??'');
const fechaEnMes=(f:string,m:string,y:number)=>f.includes(`/${m}/${y}`)||f.startsWith(`${y}-${m}`);
const parseFecha=(f:string)=>{const m=f.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);if(m)return new Date(+m[3],+m[2]-1,+m[1]).getTime();return new Date(f).getTime()||0;};
const fmt  = (n:number) => n.toLocaleString('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0});
const fmtK = (n:number) => { if(Math.abs(n)>=1_000_000)return`$${(n/1_000_000).toFixed(1)}M`; if(Math.abs(n)>=1_000)return`$${(n/1_000).toFixed(0)}k`; return`$${n.toFixed(0)}`; };

/* ─── Módulos grid ───────────────────────────────────────────────────── */

interface ModCard { href:string; icon:string; nombre:string; desc:string; tipos?:string[]; }
const MODULOS: ModCard[] = [
  { href:'/dashboard/registro',           icon:'👤', nombre:'Registro',          desc:'Alta y baja de beneficiarios' },
  { href:'/dashboard/asistencia',         icon:'✅', nombre:'Asistencia',         desc:'Control diario de presencias' },
  { href:'/dashboard/egresos',            icon:'💸', nombre:'Egresos',            desc:'Gastos y comprobantes' },
  { href:'/dashboard/ingresos',           icon:'💰', nombre:'Ingresos',           desc:'Facturación y cobros' },
  { href:'/dashboard/remitos',            icon:'🧾', nombre:'Remitos',            desc:'Remitos de combustible' },
  { href:'/dashboard/reportes-km',        icon:'📊', nombre:'Reportes KM',        desc:'Kilometraje y combustible' },
  { href:'/dashboard/vencimientos',       icon:'📅', nombre:'Vencimientos',       desc:'Documentos por vencer' },
  { href:'/dashboard/planilla-incluir',   icon:'📝', nombre:'Planilla Incluir',   desc:'Planilla de asistencia mensual', tipos:['transporte_escolar'] },
  { href:'/dashboard/dj-esc107',          icon:'📄', nombre:'DJ ESC 107',         desc:'Declaración jurada ANDIS', tipos:['transporte_escolar'] },
  { href:'/dashboard/cambio-transporte',  icon:'🔄', nombre:'Cambio Transporte',  desc:'Notas de cambio de prestador', tipos:['transporte_escolar'] },
  { href:'/dashboard/altas-pres',         icon:'📋', nombre:'Altas PRES IS',      desc:'Inscripción de documentación', tipos:['transporte_escolar'] },
  { href:'/dashboard/presentacion-docs',  icon:'📁', nombre:'Presentación Docs',  desc:'Documentos presentados', tipos:['transporte_escolar'] },
  { href:'/dashboard/envios',             icon:'📦', nombre:'Envíos',             desc:'Gestión de paquetes', tipos:['paqueteria'] },
  { href:'/dashboard/repartidores',       icon:'🚴', nombre:'Repartidores',       desc:'Personal de reparto', tipos:['paqueteria'] },
  { href:'/dashboard/clientes',           icon:'👥', nombre:'Clientes',           desc:'Cartera de clientes', tipos:['paqueteria'] },
  { href:'/dashboard/rutas',              icon:'🗺️', nombre:'Rutas',              desc:'Planificación de rutas', tipos:['paqueteria'] },
  { href:'/dashboard/viajes',             icon:'🚕', nombre:'Viajes',             desc:'Gestión de traslados', tipos:['traslado'] },
  { href:'/dashboard/pasajeros',          icon:'🧑‍🤝‍🧑', nombre:'Pasajeros',          desc:'Registro de pasajeros', tipos:['traslado'] },
  { href:'/dashboard/reservas',           icon:'🗓️', nombre:'Reservas',           desc:'Reservas de viajes', tipos:['traslado'] },
];

/* ─── Mapa inline ────────────────────────────────────────────────────── */

function MapaChoferes({ ubicaciones, fullscreen }: { ubicaciones:UbicChofer[]; fullscreen:boolean }) {
  const mapRef  = useRef<HTMLDivElement>(null);
  const mapInst = useRef<unknown>(null);
  const marksRef= useRef<unknown[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current) return;
    import('leaflet').then(L => {
      // Inicializar mapa una sola vez
      if (!mapInst.current) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        if (!document.head.querySelector('[href*="leaflet.css"]')) document.head.appendChild(link);
        const map = L.map(mapRef.current!).setView([-26.82, -65.22], 11);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution:'© OSM' }).addTo(map);
        mapInst.current = map;
      }
      const map = mapInst.current as { removeLayer:(l:unknown)=>void; invalidateSize:()=>void };
      // Limpiar marcadores anteriores
      (marksRef.current as unknown[]).forEach(m => map.removeLayer(m));
      marksRef.current = [];
      // Agregar nuevos
      ubicaciones.forEach(u => {
        if (!u.lat || !u.lng) return;
        const color = u.online ? '#10b981' : '#ef4444';
        const icon = L.divIcon({
          html: `<div style="background:${color};width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:15px;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35)">🚐</div>`,
          className:'', iconSize:[30,30], iconAnchor:[15,15],
        });
        const marker = L.marker([u.lat, u.lng], { icon })
          .bindPopup(`<b>${u.nombre}</b>${u.vehiculo?`<br>${u.vehiculo}`:''}${u.hace?`<br>⏱ ${u.hace}`:''}`)
          .addTo(mapInst.current as L.Map);
        marksRef.current.push(marker);
      });
      setTimeout(() => map.invalidateSize(), 150);
    });
  }, [ubicaciones]);

  return (
    <div ref={mapRef} style={{ width:'100%', height: fullscreen ? '70vh' : 280,
      borderRadius:'var(--radius-lg)', overflow:'hidden', transition:'height .25s ease' }} />
  );
}

/* ─── Módulo Chofer ──────────────────────────────────────────────────── */

interface PerfilChofer { rol:string; nombre:string; email:string; vehiculo:string; }

function ChoferDashboard({ perfil }: { perfil: PerfilChofer }) {
  const router   = useRouter();
  const hoy      = new Date();
  const isoToES  = (iso: string) => { const [y,m,d]=iso.split('-'); return `${d}/${m}/${y}`; };
  const fechaES  = isoToES(hoy.toISOString().split('T')[0]);
  const DIAS_SEM = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const MESES_ES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const fechaTxt = `${DIAS_SEM[hoy.getDay()]} ${hoy.getDate()} de ${MESES_ES[hoy.getMonth()]}`;

  const [chicosHoy, setChicosHoy] = useState<number|null>(null);
  const [asistStat, setAsistStat] = useState<{presentes:number;pendientes:number}|null>(null);

  useEffect(() => {
    api.get(`/api/asistencia/beneficiarios?fecha=${encodeURIComponent(fechaES)}`)
      .then(r => setChicosHoy(toArray(r.data).length))
      .catch(() => setChicosHoy(0));

    api.get(`/api/asistencia/estado?fecha=${encodeURIComponent(fechaES)}`)
      .then(r => {
        const items = toArray(r.data).map(serializarFirestore);
        const presentes  = items.filter((a:Record<string,unknown>) => a.presente !== false).length;
        const pendientes = items.filter((a:Record<string,unknown>) => a.presente === undefined || a.presente === null).length;
        setAsistStat({ presentes, pendientes });
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 18px',
        background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', marginBottom:12 }}>
        <div style={{ width:44, height:44, borderRadius:'50%', background:'rgba(47,129,247,0.15)',
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>
          🚗
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:'1rem', fontWeight:700, color:'var(--text)' }}>
            Hola, {perfil.nombre || perfil.email}
          </div>
          <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>{fechaTxt}</div>
        </div>
      </div>

      {/* Resumen día */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
        <div className="tablero-card blue" style={{ padding:14 }}>
          <div className="tablero-label">Mis chicos hoy</div>
          <div className="tablero-value">
            {chicosHoy === null ? <span className="spinner" style={{width:20,height:20}}/> : chicosHoy}
          </div>
        </div>
        <div className="tablero-card green" style={{ padding:14 }}>
          <div className="tablero-label">Asistencia</div>
          <div className="tablero-value">
            {asistStat === null ? <span className="spinner" style={{width:20,height:20}}/> : asistStat.presentes}
          </div>
          <div className="tablero-sub" style={{ color: asistStat?.pendientes===0 ? 'var(--green)' : 'var(--amber)' }}>
            {asistStat === null ? '' : asistStat.pendientes > 0 ? `${asistStat.pendientes} pendientes` : '✓ Completado'}
          </div>
        </div>
      </div>

      {/* KM / Velocidad / GPS */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:12 }}>
        {([
          { label:'hoy',       value:'0 km',   color:'var(--blue)' },
          { label:'velocidad', value:'— km/h', color:'var(--green)' },
          { label:'GPS',       value:'📍',     color:'var(--text3)' },
        ] as { label:string; value:string; color:string }[]).map((s,i) => (
          <div key={i} style={{ background:'var(--bg3)', borderRadius:10, padding:10, textAlign:'center' }}>
            <div style={{ fontSize:18, fontWeight:800, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:10, color:'var(--text3)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:12 }}>
        <button className="btn btn-primary"
          style={{ flexDirection:'column', height:66, gap:4 }}
          onClick={() => router.push('/dashboard/asistencia')}>
          <span style={{ fontSize:18 }}>📋</span>
          <span style={{ fontSize:12 }}>Asistencia</span>
        </button>
        <button className="btn btn-primary"
          style={{ flexDirection:'column', height:66, gap:4, background:'linear-gradient(135deg,#1a73e8,#0d47a1)' }}
          onClick={() => router.push('/dashboard/reportes-km')}>
          <span style={{ fontSize:18 }}>🗺</span>
          <span style={{ fontSize:12 }}>Mi ruta</span>
        </button>
        <button className="btn btn-secondary"
          style={{ flexDirection:'column', height:66, gap:4 }}
          onClick={() => router.push('/dashboard/egresos')}>
          <span style={{ fontSize:18 }}>💸</span>
          <span style={{ fontSize:12 }}>Egresos</span>
        </button>
      </div>

      {perfil.vehiculo && (
        <div style={{ padding:'.65rem 1rem', background:'var(--bg3)', borderRadius:'var(--radius)',
          fontSize:'.82rem', color:'var(--text3)' }}>
          🚐 {perfil.vehiculo}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */

export default function DashboardPage() {
  const router        = useRouter();
  const { tipo }      = useEmpresaTipo();

  /* — Perfil (para detección de rol chofer) — */
  const [perfil,        setPerfil]       = useState<PerfilChofer|null>(null);
  const [perfilLoaded,  setPerfilLoaded] = useState(false);

  const [tab,           setTab]         = useState<Tablero|null>(null);
  const [movimientos,   setMovimientos] = useState<Movimiento[]>([]);
  const [loading,       setLoading]     = useState(true);
  const [error,         setError]       = useState('');

  const [ubicaciones,   setUbicaciones] = useState<UbicChofer[]>([]);
  const [mapaFull,      setMapaFull]    = useState(false);
  const [asistHoy,      setAsistHoy]    = useState<AsistHoy[]>([]);

  /* ── Carga principal ─────────────────────────────────────────────── */
  const fetchTablero = async () => {
    setLoading(true); setError('');
    try {
      const hoy    = new Date();
      const mes    = hoy.getMonth() + 1;
      const anio   = hoy.getFullYear();
      const mesStr = String(mes).padStart(2,'0');

      /* 1. Intentar endpoint resumen */
      let resumenOk = false;
      try {
        const r = await api.get('/api/dashboard/resumen');
        const d = serializarFirestore(r.data);
        // Resumen ok si tiene al menos beneficiariosActivos o totalEgresosMes
        if (d && (typeof d.beneficiariosActivos !== 'undefined' || typeof d.totalEgresosMes !== 'undefined')) {
          setTab({
            beneficiariosActivos: num(d.beneficiariosActivos),
            bajasMes:             num(d.bajasMes),
            egresosMes:           num(d.egresosMes),
            totalEgresosMes:      num(d.totalEgresosMes),
            ingresosMes:          num(d.ingresosMes),
            totalIngresosMes:     num(d.totalIngresosMes),
            totalPagadoMes:       num(d.totalPagadoMes),
            totalPresentadoMes:   num(d.totalPresentadoMes),
            kmMes:                num(d.kmMes),
            combustibleMes:       num(d.combustibleMes),
            estadoChoferes: (Array.isArray(d.estadoChoferes) ? d.estadoChoferes : []).map((c:Record<string,unknown>) => ({
              nombre:       str(c.nombre??c.NOMBRE??c.usuario??c.USUARIO??''),
              usuario:      str(c.usuario??c.USUARIO??''),
              vehiculo:     str(c.vehiculo??c.VEHICULO??c.patente??c.PATENTE??''),
              tieneReporte: Boolean(c.reporteHoy??c.reportehoy??c.tieneReporte??false),
              hace:         str(c.hace??''),
              lat:          c.lat ? num(c.lat) : undefined,
              lng:          c.lng ? num(c.lng) : undefined,
            })),
            mesNombre:    str(d.mesNombre)||MESES[mes-1],
            anio:         num(d.anio)||anio,
            empresaNombre:str(d.empresaNombre??d.empresa?.nombre??''),
            empresaLogo:  str(d.empresaLogo??d.logo??''),
          });
          resumenOk = true;
        }
      } catch { /* fallback */ }

      /* 2. Fallback: endpoints individuales */
      if (!resumenOk) {
        const [bResp,eResp,iResp,rResp,uResp] = await Promise.allSettled([
          api.get('/api/beneficiarios'),
          api.get('/api/egresos'),
          api.get('/api/ingresos'),
          api.get(`/api/reportes/mensual?mes=${mes}&anio=${anio}`),
          api.get('/api/usuarios'),
        ]);
        const benefs = bResp.status==='fulfilled'?toArray(bResp.value.data).map(serializarFirestore):[];
        const egresos= eResp.status==='fulfilled'?toArray(eResp.value.data).map(serializarFirestore):[];
        const ingresos=iResp.status==='fulfilled'?toArray(iResp.value.data).map(serializarFirestore):[];
        const repMens= rResp.status==='fulfilled'?rResp.value.data:null;
        const chs    = uResp.status==='fulfilled'
          ? toArray(uResp.value.data).map(serializarFirestore)
              .filter((u:Record<string,unknown>)=>str(u.rol??u.ROL??'').toLowerCase()==='chofer'):[];

        const egMes  = egresos.filter((e:Record<string,unknown>)=>fechaEnMes(getFecha(e),mesStr,anio));
        const ingMes = ingresos.filter((i:Record<string,unknown>)=>fechaEnMes(getFecha(i),mesStr,anio));
        const totEg  = egMes.reduce((s:number,e:Record<string,unknown>)=>s+getMonto(e),0);
        const totIng = ingMes.reduce((s:number,i:Record<string,unknown>)=>s+getMonto(i),0);
        const totPag = ingMes.filter((i:Record<string,unknown>)=>getEstado(i)==='PAGADO').reduce((s:number,i:Record<string,unknown>)=>s+getMonto(i),0);
        const totPres= ingMes.filter((i:Record<string,unknown>)=>getEstado(i)==='PRESENTADO').reduce((s:number,i:Record<string,unknown>)=>s+getMonto(i),0);

        setTab({
          beneficiariosActivos: benefs.filter((b:Record<string,unknown>)=>b.activo!==false).length,
          bajasMes:0, egresosMes:egMes.length, totalEgresosMes:totEg,
          ingresosMes:ingMes.length, totalIngresosMes:totIng,
          totalPagadoMes:totPag, totalPresentadoMes:totPres,
          kmMes:num(repMens?.resumen?.kmTotal), combustibleMes:num(repMens?.resumen?.litrosTotal),
          estadoChoferes: chs.map((c:Record<string,unknown>)=>({
            nombre:str(c.nombre??c.NOMBRE??c.usuario??''), usuario:str(c.usuario??c.USUARIO??''),
            vehiculo:str(c.vehiculo??c.VEHICULO??''),
            tieneReporte:Boolean(c.reporteHoy??c.reportehoy??c.tieneReporte??false),
          })),
          mesNombre:MESES[mes-1], anio, empresaNombre:'',
        });

        const movs:Movimiento[] = [
          ...egMes.map((e:Record<string,unknown>)=>({ id:str(e.id), tipo:'egreso' as const, fecha:getFecha(e), concepto:getConcepto(e), monto:getMonto(e), estado:getEstado(e) })),
          ...ingMes.map((i:Record<string,unknown>)=>({ id:str(i.id), tipo:'ingreso' as const, fecha:getFecha(i), concepto:getConcepto(i), monto:getMonto(i), estado:getEstado(i) })),
        ].filter(m=>m.monto>0||m.concepto).sort((a,b)=>parseFecha(b.fecha)-parseFecha(a.fecha)).slice(0,10);
        setMovimientos(movs);
      }
    } catch(e) { console.error('[DASHBOARD]',e); setError('Error al cargar el tablero'); }
    finally { setLoading(false); }
  };

  /* ── Ubicaciones en tiempo real ─────────────────────────────────── */
  const fetchUbicaciones = async () => {
    try {
      const r = await api.get('/api/ubicaciones');
      // Backend returns { ok, ubicaciones: [...] }
      const lista = r.data?.ubicaciones ?? toArray(r.data);
      setUbicaciones(lista.map(serializarFirestore).map((u:Record<string,unknown>)=>({
        nombre:  str(u.nombre||u.NOMBRE||u.usuario||''),
        vehiculo:str(u.vehiculo||u.VEHICULO||''),
        lat:     num(u.lat||u.LAT||0),
        lng:     num(u.lng||u.LNG||u.lon||0),
        hace:    str(u.hace||u.tiempoDesde||''),
        online:  Boolean(u.online??u.activo??false),
      })));
    } catch { /* sin mapa */ }
  };

  /* ── Asistencia hoy ─────────────────────────────────────────────── */
  const fetchAsistHoy = async () => {
    try {
      const r = await api.get('/api/asistencia/estado-hoy');
      setAsistHoy(toArray(r.data).map(serializarFirestore).map((a:Record<string,unknown>)=>({
        chofer:    str(a.chofer||a.CHOFER||a.nombre||''),
        presentes: num(a.presentes||0),
        ausentes:  num(a.ausentes||0),
        pendientes:num(a.pendientes||0),
        total:     num(a.total||0),
      })));
    } catch { /* opcional */ }
  };

  /* Fetch perfil first, then conditionally load admin data */
  useEffect(() => {
    api.get('/api/usuarios/perfil')
      .then(r => setPerfil(serializarFirestore(r.data) as PerfilChofer))
      .catch(() => {})
      .finally(() => setPerfilLoaded(true));
  }, []);

  useEffect(() => {
    if (!perfilLoaded) return;
    if (perfil?.rol === 'chofer') { setLoading(false); return; }
    fetchTablero();
    fetchUbicaciones();
    fetchAsistHoy();
    const interval = setInterval(fetchUbicaciones, 30000);
    return () => clearInterval(interval);
  }, [perfilLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Estados de carga ─────────────────────────────────────────── */
  if (!perfilLoaded) return (
    <div style={{ display:'flex', alignItems:'center', gap:'.75rem', color:'var(--text3)', paddingTop:'2rem' }}>
      <span className="spinner" /> Cargando…
    </div>
  );

  /* ─── Módulo chofer ─────────────────────────────────────────────── */
  if (perfil?.rol === 'chofer') return <ChoferDashboard perfil={perfil} />;

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', gap:'.75rem', color:'var(--text3)', paddingTop:'2rem' }}>
      <span className="spinner" /> Cargando tablero…
    </div>
  );
  if (error) return (
    <div style={{ display:'flex', alignItems:'center', gap:'.75rem', color:'var(--red)', paddingTop:'2rem' }}>
      ⚠️ {error}
      <button className="btn btn-secondary" onClick={fetchTablero} style={{ fontSize:'.8rem' }}>Reintentar</button>
    </div>
  );
  if (!tab) return null;

  const saldo = tab.totalPagadoMes - tab.totalEgresosMes;

  const kpis = [
    { label:'Beneficiarios activos', value:String(tab.beneficiariosActivos), color:'var(--blue)', icon:'👥',
      sub: tab.bajasMes>0 ? `${tab.bajasMes} baja${tab.bajasMes!==1?'s':''} este mes` : tab.mesNombre },
    { label:'Egresos del mes', value:fmtK(tab.totalEgresosMes), color:'var(--red)', icon:'💸',
      sub:`${tab.egresosMes} registro${tab.egresosMes!==1?'s':''}` },
    { label:'Ingresos del mes', value:fmtK(tab.totalIngresosMes), color:'var(--green)', icon:'💰',
      sub:`Cobrado: ${fmtK(tab.totalPagadoMes)}` },
    { label:'KM del mes', value:tab.kmMes>0?tab.kmMes.toLocaleString('es-AR'):'—', color:'var(--purple)', icon:'🛣️',
      sub:tab.combustibleMes>0?`${tab.combustibleMes.toFixed(0)} L`:' Sin reportes' },
  ];

  // Módulos visibles para este tipo de empresa
  const modVisibles = MODULOS.filter(m => !m.tipos || (tipo && m.tipos.includes(tipo)));

  /* ─── Render ──────────────────────────────────────────────────────── */
  return (
    <div>
      {/* ── Header estilo GAS: logo empresa circular + nombre + mes/año + semáforo chips ── */}
      <div style={{ marginBottom:'1.25rem' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'16px', flexWrap:'wrap' }}>
          {/* Logo empresa circular — desde Firestore o fallback iniciales */}
          {tab.empresaLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tab.empresaLogo}
              alt="Empresa"
              style={{ height:64, width:64, borderRadius:'50%', objectFit:'cover',
                border:'3px solid var(--blue)', boxShadow:'0 0 0 6px rgba(59,130,246,0.15)',
                flexShrink:0 }}
            />
          ) : (
            <div style={{
              height:64, width:64, borderRadius:'50%', flexShrink:0,
              background:'var(--blue-dim)', border:'3px solid var(--blue)',
              boxShadow:'0 0 0 6px rgba(59,130,246,0.15)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:'1.4rem', fontWeight:800, color:'var(--blue)',
            }}>
              {(tab.empresaNombre || 'T').split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase() || '🚐'}
            </div>
          )}
          <div>
            <div style={{ fontSize:'1.15rem', fontWeight:800, color:'var(--text)', letterSpacing:'-.01em' }}>
              {tab.empresaNombre || 'TRANSPORTE FLORES'}
            </div>
            <div style={{ fontSize:'.82rem', color:'var(--text3)', marginTop:'2px' }}>
              {tab.mesNombre} {tab.anio} · Datos en tiempo real
            </div>
          </div>
          <div style={{ marginLeft:'auto' }}>
            <button className="btn btn-secondary" onClick={()=>{fetchTablero();fetchUbicaciones();fetchAsistHoy();}} style={{ fontSize:'.8rem' }}>
              ↻ Actualizar
            </button>
          </div>
        </div>

        {/* Semáforo reportes KM — chips idénticos al GAS */}
        {tab.estadoChoferes.length > 0 && (
          <div style={{ marginTop:'12px', padding:'10px 12px', background:'var(--bg3)', borderRadius:'10px' }}>
            <div style={{ fontSize:'11px', fontWeight:700, color:'var(--text3)', marginBottom:'8px' }}>🛣 Reporte KM hoy</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:'8px' }}>
              {tab.estadoChoferes.map((ch,i) => (
                <div key={ch.nombre||i} style={{
                  display:'flex', alignItems:'center', gap:'5px',
                  padding:'5px 10px', borderRadius:'20px',
                  background: ch.tieneReporte ? 'rgba(63,185,80,0.12)' : 'rgba(248,81,73,0.12)',
                  border: `1px solid ${ch.tieneReporte ? 'rgba(63,185,80,0.3)' : 'rgba(248,81,73,0.3)'}`,
                }}>
                  <span style={{ fontSize:'14px' }}>{ch.tieneReporte ? '✅' : '❌'}</span>
                  <div>
                    <div style={{ fontSize:'11px', fontWeight:600, color:'var(--text)' }}>{ch.nombre||ch.usuario}</div>
                    {ch.vehiculo && <div style={{ fontSize:'10px', color:'var(--text3)' }}>{ch.vehiculo}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── KPIs — tablero-card estilo GAS ─────────────────────────────────── */}
      <div className="tablero" style={{ marginBottom:'1.5rem' }}>
        {[
          { id:'t-activos', label:'Beneficiarios activos', value:String(tab.beneficiariosActivos), color:'blue',  sub: tab.bajasMes>0 ? `${tab.bajasMes} baja${tab.bajasMes!==1?'s':''} este mes` : tab.mesNombre },
          { id:'t-bajas',   label:'Bajas del mes',          value:String(tab.bajasMes),            color:'red',   sub:'' },
          { id:'t-egresos', label:'Gasto del mes',          value:fmtK(tab.totalEgresosMes),       color:'amber', sub:`${tab.egresosMes} registros` },
          { id:'t-ingresos',label:'Facturado pagado',       value:fmtK(tab.totalPagadoMes),        color:'green', sub:`Presentado: ${fmtK(tab.totalPresentadoMes)}` },
          { id:'t-km',      label:'KM del mes',             value:tab.kmMes>0?tab.kmMes.toLocaleString('es-AR')+'km':'—', color:'purple', sub: tab.combustibleMes>0?`${tab.combustibleMes.toFixed(0)} L`:'' },
        ].map(k => (
          <div key={k.id} className={`tablero-card ${k.color}`}>
            <div className="tablero-label">{k.label}</div>
            <div className="tablero-value" id={k.id}>{k.value}</div>
            {k.sub && <div className="tablero-sub">{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* Saldo + Movimientos */}
      <div style={{ display:'grid', gridTemplateColumns:'minmax(200px,1fr) minmax(280px,2fr)', gap:'1rem', marginBottom:'1.5rem', alignItems:'start' }}>
        {/* Saldo */}
        <div className="card" style={{ borderLeft:`4px solid ${saldo>=0?'var(--green)':'var(--red)'}` }}>
          <p style={{ fontSize:'.78rem', color:'var(--text3)', marginBottom:'.35rem' }}>Saldo del mes · cobrado − egresos</p>
          <p style={{ fontSize:'1.6rem', fontWeight:700, color:saldo>=0?'var(--green)':'var(--red)' }}>
            {saldo>=0?'+':''}{fmt(saldo)}
          </p>
          <div style={{ display:'flex', gap:'1rem', marginTop:'.5rem', flexWrap:'wrap' }}>
            {[['Cobrado',tab.totalPagadoMes,'var(--green)'],['Pendiente',tab.totalPresentadoMes,'var(--amber)'],['Egresos',tab.totalEgresosMes,'var(--red)']].map(([l,v,c])=>(
              <div key={String(l)}>
                <p style={{ fontSize:'.7rem', color:'var(--text3)' }}>{l}</p>
                <p style={{ fontSize:'.88rem', fontWeight:600, color:String(c) }}>{fmt(Number(v))}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Últimos movimientos */}
        <div className="card">
          <p style={{ fontSize:'.85rem', fontWeight:600, color:'var(--text)', marginBottom:'.85rem' }}>
            📋 Últimos movimientos — {tab.mesNombre}
          </p>
          {movimientos.length===0 ? (
            <p style={{ fontSize:'.82rem', color:'var(--text3)' }}>Sin movimientos registrados este mes</p>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'.35rem' }}>
              {movimientos.map((m,i)=>(
                <div key={m.id||i} style={{ display:'flex', alignItems:'center', gap:'.75rem',
                  padding:'.4rem .5rem', borderRadius:'var(--radius)', background:'var(--bg4)' }}>
                  <span style={{ fontSize:'.95rem', flexShrink:0 }}>{m.tipo==='ingreso'?'💰':'💸'}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize:'.82rem', color:'var(--text)', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {m.concepto||(m.tipo==='ingreso'?'Ingreso':'Egreso')}
                    </p>
                    <p style={{ fontSize:'.72rem', color:'var(--text3)' }}>{m.fecha}{m.estado&&` · ${m.estado}`}</p>
                  </div>
                  <p style={{ fontSize:'.88rem', fontWeight:700, whiteSpace:'nowrap',
                    color:m.tipo==='ingreso'?'var(--green)':'var(--red)' }}>
                    {m.tipo==='ingreso'?'+':'−'}{fmtK(m.monto)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mapa en tiempo real */}
      {ubicaciones.length > 0 && (
        <div className="card" style={{ marginBottom:'1.5rem', padding:'1rem' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'.75rem' }}>
            <div>
              <p style={{ fontSize:'.85rem', fontWeight:600, color:'var(--text)' }}>📍 Choferes en tiempo real</p>
              <p style={{ fontSize:'.72rem', color:'var(--text3)' }}>
                {ubicaciones.filter(u=>u.online).length} en línea · actualiza cada 30 s
              </p>
            </div>
            <div style={{ display:'flex', gap:'.4rem', alignItems:'center' }}>
              {ubicaciones.map(u=>(
                <span key={u.nombre} style={{ display:'flex', alignItems:'center', gap:'.3rem',
                  fontSize:'.72rem', color:'var(--text3)', padding:'.2rem .5rem',
                  background:'var(--bg4)', borderRadius:99 }}>
                  <span style={{ width:6, height:6, borderRadius:'50%', background:u.online?'var(--green)':'var(--red)', display:'inline-block' }}/>
                  {u.nombre}
                </span>
              ))}
              <button className="btn btn-secondary" style={{ fontSize:'.75rem', padding:'.3rem .6rem' }}
                onClick={()=>setMapaFull(f=>!f)}>
                {mapaFull?'⊡ Reducir':'⊞ Ampliar'}
              </button>
            </div>
          </div>
          <MapaChoferes ubicaciones={ubicaciones} fullscreen={mapaFull} />
        </div>
      )}

      {/* Asistencia hoy */}
      {asistHoy.length > 0 && (
        <div className="card" style={{ marginBottom:'1.5rem' }}>
          <p style={{ fontSize:'.85rem', fontWeight:600, color:'var(--text)', marginBottom:'.75rem' }}>✅ Asistencia hoy por chofer</p>
          <div className="tabla-wrap">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Chofer</th>
                  <th style={{ textAlign:'center' }}>Presentes</th>
                  <th style={{ textAlign:'center' }}>Ausentes</th>
                  <th style={{ textAlign:'center' }}>Pendientes</th>
                  <th style={{ textAlign:'center' }}>Total</th>
                  <th style={{ textAlign:'center' }}>%</th>
                </tr>
              </thead>
              <tbody>
                {asistHoy.map(a=>(
                  <tr key={a.chofer}>
                    <td style={{ fontWeight:500 }}>{a.chofer||'Sin asignar'}</td>
                    <td style={{ textAlign:'center', color:'var(--green)', fontWeight:600 }}>{a.presentes}</td>
                    <td style={{ textAlign:'center', color:'var(--red)' }}>{a.ausentes}</td>
                    <td style={{ textAlign:'center', color:'var(--amber)' }}>{a.pendientes}</td>
                    <td style={{ textAlign:'center' }}>{a.total}</td>
                    <td style={{ textAlign:'center' }}>
                      {a.total>0&&(
                        <span className={`badge ${a.presentes/a.total>=.8?'badge-green':a.presentes/a.total>=.5?'badge-amber':'badge-red'}`}>
                          {Math.round(a.presentes/a.total*100)}%
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Grid de módulos */}
      {modVisibles.length > 0 && (
        <div>
          <p style={{ fontSize:'.82rem', fontWeight:700, color:'var(--text3)', textTransform:'uppercase',
            letterSpacing:'.06em', marginBottom:'.75rem' }}>
            Módulos disponibles
          </p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:'.75rem' }}>
            {modVisibles.map(m=>(
              <div key={m.href} className="card"
                style={{ padding:'1rem', cursor:'pointer', textAlign:'center',
                  transition:'transform .15s,box-shadow .15s' }}
                onClick={()=>router.push(m.href)}
                onMouseEnter={e=>{(e.currentTarget as HTMLDivElement).style.transform='translateY(-2px)';(e.currentTarget as HTMLDivElement).style.boxShadow='0 4px 12px rgba(0,0,0,.2)';}}
                onMouseLeave={e=>{(e.currentTarget as HTMLDivElement).style.transform='';(e.currentTarget as HTMLDivElement).style.boxShadow='';}}>
                <div style={{ fontSize:'1.6rem', marginBottom:'.4rem' }}>{m.icon}</div>
                <p style={{ fontSize:'.82rem', fontWeight:600, color:'var(--text)', marginBottom:'.15rem' }}>{m.nombre}</p>
                <p style={{ fontSize:'.72rem', color:'var(--text3)', lineHeight:1.3 }}>{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
