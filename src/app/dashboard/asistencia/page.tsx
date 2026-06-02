'use client';
import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import { serializarFirestore, toArray } from '@/lib/utils';

/* ─── Helpers fecha ──────────────────────────────────────────────────── */

/** YYYY-MM-DD → dd/MM/YYYY (formato GAS) */
const isoToES = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};
/** true si YYYY-MM-DD es sábado (6) o domingo (0) */
const esFindeSemana = (iso: string) => {
  const dow = new Date(iso + 'T00:00:00').getDay();
  return dow === 0 || dow === 6;
};
/** Date → YYYY-MM-DD */
const toISO = (d: Date) => d.toISOString().split('T')[0];

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DOW   = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];

/* ─── Tipos ──────────────────────────────────────────────────────────── */

type Tab = 'tomar'|'reporte'|'calendario'|'buscar'|'asignacion';

interface BenefHoy   { id:string; nombre:string; chofer:string; }
interface ChoferGrupo { chofer:string; rows:{ nombre:string; presentes:number; ausentes:number; total:number }[]; }
interface CalDia     { presentes:number; ausentes:number; cerrado:boolean; }
interface BenefSimple{ id:string; nombre:string; chofer:string; }
interface Perfil     { id:string; rol:string; vehiculo:string; nombre:string; }

/* ─── Constantes UI ──────────────────────────────────────────────────── */

const L: React.CSSProperties = { display:'block', fontSize:'.78rem', color:'var(--text3)', marginBottom:'.3rem', fontWeight:500 };
const TABS_DEF: { key:Tab; label:string }[] = [
  { key:'tomar',     label:'✅ Tomar asistencia' },
  { key:'reporte',   label:'📊 Reporte mensual' },
  { key:'calendario',label:'📅 Calendario' },
  { key:'buscar',    label:'🔍 Buscar beneficiario' },
];

/* ═══════════════════════════════════════════════════════════════════════ */

export default function AsistenciaPage() {
  /* ── Perfil del usuario ─────────────────────────────────────────────── */
  const [perfil,    setPerfil]    = useState<Perfil|null>(null);
  const esAdmin  = perfil?.rol === 'admin';
  const esChofer = perfil?.rol === 'chofer';

  useEffect(() => {
    api.get('/api/usuarios/perfil')
      .then(r => setPerfil(serializarFirestore(r.data) as Perfil))
      .catch(() => { /* sin perfil: sin privilegios extra */ });
  }, []);

  /* ── Tab activa ─────────────────────────────────────────────────────── */
  const [tab, setTab] = useState<Tab>('tomar');
  const tabs = [...TABS_DEF, ...(esAdmin ? [{ key:'asignacion' as Tab, label:'👥 Asignación' }] : [])];

  /* ═══════════════════════════════════════════════════════════════════════
     TAB 1 — TOMAR ASISTENCIA
     ═══════════════════════════════════════════════════════════════════════ */
  const [fechaISO,    setFechaISO]   = useState(toISO(new Date()));
  const [benefHoy,    setBenefHoy]   = useState<BenefHoy[]>([]);
  const [presencias,  setPresencias] = useState<Record<string,boolean>>({});
  const [filtroChH,   setFiltroChH]  = useState('');
  const [loadingH,    setLoadingH]   = useState(false);
  const [savingH,     setSavingH]    = useState(false);
  const [cerrandoD,   setCerrandoD]  = useState(false);
  const [msgH,        setMsgH]       = useState<{text:string;ok:boolean}|null>(null);
  /* Mi Vehículo */
  const [vehiculoVal, setVehiculoVal]= useState('');
  const [savingVeh,   setSavingVeh]  = useState(false);

  useEffect(() => {
    if (perfil) setVehiculoVal(perfil.vehiculo || '');
  }, [perfil]);

  const cargarHoy = useCallback(async (iso: string) => {
    // No hay asistencia los fines de semana
    if (esFindeSemana(iso)) { setBenefHoy([]); setPresencias({}); setLoadingH(false); return; }
    setLoadingH(true); setMsgH(null);
    try {
      const fechaES = isoToES(iso);
      const r = await api.get(`/api/asistencia/beneficiarios?fecha=${encodeURIComponent(fechaES)}`);
      const bens: BenefHoy[] = toArray(r.data).map(serializarFirestore).map((b: Record<string,unknown>) => ({
        id:     String(b.id     || ''),
        nombre: String(b.nombre || b['APELLIDO Y NOMBRE'] || b.NOMBRE || ''),
        chofer: String(b.chofer || b.CHOFER || ''),
      }));
      setBenefHoy(bens);

      /* Cargar estado actual del día via endpoint dedicado */
      try {
        const aRes = await api.get(`/api/asistencia/estado?fecha=${encodeURIComponent(fechaES)}`);
        const mapa: Record<string,boolean> = {};
        bens.forEach(b => { mapa[b.id] = false; });
        toArray(aRes.data).map(serializarFirestore).forEach((a: Record<string,unknown>) => {
          const id = String(a.beneficiarioId || a.id || '');
          if (id in mapa) mapa[id] = a.presente !== false;
        });
        setPresencias(mapa);
      } catch {
        const mapa: Record<string,boolean> = {};
        bens.forEach(b => { mapa[b.id] = false; });
        setPresencias(mapa);
      }
    } catch { setBenefHoy([]); setPresencias({}); }
    setLoadingH(false);
  }, []);

  useEffect(() => { if (tab === 'tomar') cargarHoy(fechaISO); }, [fechaISO, tab, cargarHoy]);

  const chofesHoy = [...new Set(benefHoy.map(b => b.chofer).filter(Boolean))].sort();
  const filtradosH = filtroChH ? benefHoy.filter(b => b.chofer === filtroChH) : benefHoy;
  const presentesH = filtradosH.filter(b => presencias[b.id]).length;

  const toggleH = (id: string) => setPresencias(p => ({ ...p, [id]: !p[id] }));
  const toggleTodosH = (v: boolean) => {
    const next = { ...presencias };
    filtradosH.forEach(b => { next[b.id] = v; });
    setPresencias(next);
  };

  const guardarAsistencia = async () => {
    setSavingH(true); setMsgH(null);
    try {
      // Body: solo IDs de los presentes + fecha en formato GAS
      const presentes = benefHoy.filter(b => presencias[b.id] ?? false).map(b => b.id);
      await api.post('/api/asistencia', { fecha: isoToES(fechaISO), presentes });
      setMsgH({ text: '✓ Asistencia guardada', ok: true });
    } catch { setMsgH({ text: 'Error al guardar', ok: false }); }
    setSavingH(false);
  };

  const cerrarDia = async () => {
    if (!confirm(`¿Cerrar el día ${isoToES(fechaISO)}? No se podrá modificar.`)) return;
    setCerrandoD(true); setMsgH(null);
    try {
      await api.post('/api/asistencia/cerrar-dia', { fecha: isoToES(fechaISO) });
      setMsgH({ text: '✓ Día cerrado', ok: true });
    } catch { setMsgH({ text: 'Error al cerrar el día', ok: false }); }
    setCerrandoD(false);
  };

  const guardarVehiculo = async () => {
    setSavingVeh(true);
    try { await api.put('/api/usuarios/vehiculo', { vehiculo: vehiculoVal }); }
    catch { /* silent */ }
    setSavingVeh(false);
  };

  /* ═══════════════════════════════════════════════════════════════════════
     TAB 2 — REPORTE MENSUAL
     ═══════════════════════════════════════════════════════════════════════ */
  const hoy = new Date();
  const [repMes,    setRepMes]    = useState(hoy.getMonth() + 1);
  const [repAnio,   setRepAnio]   = useState(hoy.getFullYear());
  const [reporte,   setReporte]   = useState<ChoferGrupo[]>([]);
  const [loadingR,  setLoadingR]  = useState(false);
  const [diasHab,   setDiasHab]   = useState(0);

  const cargarReporte = useCallback(async (mes: number, anio: number) => {
    setLoadingR(true);
    try {
      const r = await api.get(`/api/asistencia/reporte-mensual?mes=${mes}&anio=${anio}`);
      const d = serializarFirestore(r.data);
      setDiasHab(Number(d.diasHabiles || 0));

      if (Array.isArray(d.choferes)) {
        // Ya viene agrupado
        setReporte(d.choferes.map((c: Record<string,unknown>) => ({
          chofer: String(c.chofer || c.nombre || ''),
          rows: toArray(c.beneficiarios || []).map((b: Record<string,unknown>) => ({
            nombre: String(b.nombre || ''), presentes: Number(b.presentes||0),
            ausentes: Number(b.ausentes||0), total: Number(b.total||0),
          })),
        })));
      } else {
        // Agrupar registros crudos
        const registros = toArray(d.registros ?? d).map(serializarFirestore);
        const grupos: Record<string, Record<string, {p:number;a:number;t:number}>> = {};
        registros.forEach((reg: Record<string,unknown>) => {
          const chofer  = String(reg.chofer || reg.CHOFER || 'Sin chofer');
          const nombre  = String(reg.nombre || reg.NOMBRE || reg.beneficiario || '');
          if (!grupos[chofer]) grupos[chofer] = {};
          if (!grupos[chofer][nombre]) grupos[chofer][nombre] = {p:0,a:0,t:0};
          grupos[chofer][nombre].t++;
          if (reg.presente !== false) grupos[chofer][nombre].p++;
          else grupos[chofer][nombre].a++;
        });
        setReporte(Object.entries(grupos).map(([chofer, bens]) => ({
          chofer,
          rows: Object.entries(bens).map(([nombre, v]) => ({ nombre, presentes:v.p, ausentes:v.a, total:v.t })),
        })));
      }
    } catch { setReporte([]); }
    setLoadingR(false);
  }, []);

  useEffect(() => { if (tab === 'reporte') cargarReporte(repMes, repAnio); }, [repMes, repAnio, tab, cargarReporte]);

  /* ═══════════════════════════════════════════════════════════════════════
     TAB 3 — CALENDARIO
     ═══════════════════════════════════════════════════════════════════════ */
  const [calMes,    setCalMes]    = useState(hoy.getMonth() + 1);
  const [calAnio,   setCalAnio]   = useState(hoy.getFullYear());
  const [calData,   setCalData]   = useState<Record<string,CalDia>>({});
  const [loadingC,  setLoadingC]  = useState(false);
  const [diaModal,  setDiaModal]  = useState<{dia:string;data:CalDia}|null>(null);

  const cargarCal = useCallback(async (mes: number, anio: number) => {
    setLoadingC(true);
    try {
      const r = await api.get(`/api/asistencia/calendario?mes=${mes}&anio=${anio}`);
      const d = serializarFirestore(r.data);
      // Normalizar: d.dias puede ser un Record<"01"|"02"…, CalDia>
      const dias: Record<string,CalDia> = {};
      const src = d.dias ?? d;
      Object.entries(src as Record<string,unknown>).forEach(([k, v]) => {
        const obj = v as Record<string,unknown>;
        dias[k] = { presentes: Number(obj.presentes||0), ausentes: Number(obj.ausentes||0), cerrado: Boolean(obj.cerrado) };
      });
      setCalData(dias);
    } catch { setCalData({}); }
    setLoadingC(false);
  }, []);

  useEffect(() => { if (tab === 'calendario') cargarCal(calMes, calAnio); }, [calMes, calAnio, tab, cargarCal]);

  /* Construcción de la grilla */
  const diasEnMes   = new Date(calAnio, calMes, 0).getDate();
  const primerDia   = new Date(calAnio, calMes - 1, 1).getDay(); // 0=dom
  const offsetLun   = (primerDia + 6) % 7; // 0=lun

  /* ═══════════════════════════════════════════════════════════════════════
     TAB 4 — BUSCAR BENEFICIARIO
     Endpoint: GET /api/asistencia/buscar?nombre=X
     Respuesta: { beneficiario: {...}, meses: [{ mes, anio, dias: [{fecha, estado}] }] }
     ═══════════════════════════════════════════════════════════════════════ */
  const [busqTxt,      setBusqTxt]      = useState('');
  const [busqResultado,setBusqResultado]= useState<{
    beneficiario:{ nombre:string; chofer:string };
    meses:{ mes:number; anio:number; dias:{ fecha:string; presente:boolean }[] }[];
  }|null>(null);
  const [loadingBq,    setLoadingBq]    = useState(false);

  // busqBenefs y busqSel mantenidos para compatibilidad con el render existente
  const [busqBenefs] = useState<BenefSimple[]>([]);
  const busqSel      = null;

  const buscarAsistencia = useCallback(async (nombre: string) => {
    if (nombre.length < 2) { setBusqResultado(null); return; }
    setLoadingBq(true);
    try {
      const r = await api.get(`/api/asistencia/buscar?nombre=${encodeURIComponent(nombre)}`);
      const d = serializarFirestore(r.data);
      setBusqResultado({
        beneficiario: {
          nombre: String(d.beneficiario?.nombre || d.nombre || nombre),
          chofer: String(d.beneficiario?.chofer || d.chofer || ''),
        },
        meses: toArray(d.meses ?? d.historial ?? []).map((m: Record<string,unknown>) => ({
          mes:  Number(m.mes  || 0),
          anio: Number(m.anio || 0),
          dias: toArray(m.dias ?? []).map((x: Record<string,unknown>) => ({
            fecha:   String(x.fecha || x.FECHA || ''),
            presente:x.presente !== false && String(x.estado || x.ESTADO || 'P').toUpperCase().startsWith('P'),
          })),
        })),
      });
    } catch { setBusqResultado(null); }
    setLoadingBq(false);
  }, []);

  /* ═══════════════════════════════════════════════════════════════════════
     TAB 5 — ASIGNACIÓN (admin)
     ═══════════════════════════════════════════════════════════════════════ */
  const [asigBenefs,  setAsigBenefs]  = useState<BenefSimple[]>([]);
  /** { nombre: email } para el select — valor = email del chofer */
  const [asigChsMap,  setAsigChsMap]  = useState<{nombre:string;email:string}[]>([]);
  /** { nombre_beneficiario: email_chofer } */
  const [asigCambios, setAsigCambios] = useState<Record<string,string>>({});
  const [loadingAsig, setLoadingAsig] = useState(false);
  const [savingAsig,  setSavingAsig]  = useState(false);
  const [msgAsig,     setMsgAsig]     = useState<{text:string;ok:boolean}|null>(null);

  const cargarAsig = useCallback(async () => {
    setLoadingAsig(true);
    try {
      const [bRes, uRes] = await Promise.allSettled([
        api.get('/api/beneficiarios'),
        api.get('/api/usuarios?rol=chofer'),
      ]);
      if (bRes.status === 'fulfilled')
        setAsigBenefs(toArray(bRes.value.data).map(serializarFirestore).map((b: Record<string,unknown>) => ({
          id:     String(b.id     || ''),
          nombre: String(b.nombre || b['APELLIDO Y NOMBRE'] || ''),
          chofer: String(b.chofer || b.CHOFER || ''),
        })));
      if (uRes.status === 'fulfilled')
        setAsigChsMap(
          toArray(uRes.value.data).map(serializarFirestore)
            .filter((u: Record<string,unknown>) => String(u.rol || '').toLowerCase() === 'chofer')
            .map((u: Record<string,unknown>) => ({
              nombre: String(u.nombre || u.usuario || ''),
              email:  String(u.email  || u.EMAIL   || ''),
            }))
            .filter(c => c.nombre)
        );
    } catch { /* silent */ }
    setLoadingAsig(false);
  }, []);

  useEffect(() => { if (tab === 'asignacion' && esAdmin) cargarAsig(); }, [tab, esAdmin, cargarAsig]);

  const guardarAsig = async () => {
    setSavingAsig(true); setMsgAsig(null);
    // Body: { asignaciones: { "nombre beneficiario": "email chofer" } }
    try {
      await api.put('/api/asistencia/asignaciones', { asignaciones: asigCambios });
      const n = Object.keys(asigCambios).length;
      setMsgAsig({ text: `✓ ${n} asignación${n!==1?'es':''} guardada${n!==1?'s':''}`, ok: true });
      setAsigCambios({});
      cargarAsig();
    } catch { setMsgAsig({ text: 'Error al guardar', ok: false }); }
    setSavingAsig(false);
  };

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════════════ */
  return (
    <div>
      {/* Header */}
      <div className="section-header" style={{ marginBottom: '1rem' }}>
        <h2 className="section-title">✅ Asistencia</h2>
        {esAdmin && <span className="badge badge-red" style={{ fontSize: '.72rem' }}>Admin</span>}
      </div>

      {/* Mi Vehículo — ENCIMA de los tabs, solo visible para choferes */}
      {esChofer && (
        <div className="card" style={{ padding:'.75rem 1.25rem', marginBottom:'1rem',
          display:'flex', alignItems:'center', gap:'.75rem', flexWrap:'wrap' }}>
          <span style={{ fontSize:'.85rem', fontWeight:600, color:'var(--text)', whiteSpace:'nowrap' }}>🚗 Mi Vehículo</span>
          <input className="input" style={{ flex:1, minWidth:160, maxWidth:280 }}
            placeholder="Ej: VW Crafter AA123BB"
            value={vehiculoVal} onChange={e => setVehiculoVal(e.target.value)}
            onKeyDown={e => e.key==='Enter' && guardarVehiculo()} />
          <button className="btn btn-secondary" style={{ whiteSpace:'nowrap' }}
            onClick={guardarVehiculo} disabled={savingVeh}>
            {savingVeh ? <span className="spinner" style={{width:12,height:12}}/> : 'Guardar'}
          </button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '.35rem', flexWrap: 'wrap', marginBottom: '1.25rem',
        borderBottom: '1px solid var(--border)', paddingBottom: '.75rem' }}>
        {tabs.map(t => (
          <button key={t.key}
            className={tab === t.key ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{ fontSize: '.82rem' }}
            onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: TOMAR ASISTENCIA ──────────────────────────────────────── */}
      {tab === 'tomar' && (
        <div>
          {/* Controles de fecha + filtro */}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '1rem' }}>
            <div>
              <label style={L}>Fecha</label>
              <input type="date" className="input" style={{ width: 160 }}
                value={fechaISO} onChange={e => setFechaISO(e.target.value)} />
            </div>
            {chofesHoy.length > 0 && (
              <div>
                <label style={L}>Chofer</label>
                <select className="select" style={{ width: 180 }} value={filtroChH} onChange={e => setFiltroChH(e.target.value)}>
                  <option value="">Todos</option>
                  {chofesHoy.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}
            <button className="btn btn-secondary" onClick={() => cargarHoy(fechaISO)} disabled={loadingH}>↻</button>
          </div>

          {/* Contador */}
          {!loadingH && benefHoy.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '.6rem 1rem', background: 'var(--bg3)', borderRadius: 'var(--radius)',
              marginBottom: '.75rem' }}>
              <p style={{ fontSize: '.9rem', color: 'var(--text)' }}>
                <strong style={{ color: 'var(--green)', fontSize: '1.15rem' }}>{presentesH}</strong>
                <span style={{ color: 'var(--text3)' }}> / {filtradosH.length} presentes</span>
              </p>
              <div style={{ display: 'flex', gap: '.4rem' }}>
                <button className="btn btn-secondary" style={{ fontSize: '.75rem' }} onClick={() => toggleTodosH(true)}>Todos ✓</button>
                <button className="btn btn-secondary" style={{ fontSize: '.75rem' }} onClick={() => toggleTodosH(false)}>Ninguno ✗</button>
              </div>
            </div>
          )}

          {esFindeSemana(fechaISO) ? (
            <div className="card" style={{ textAlign:'center', padding:'2rem', color:'var(--text3)' }}>
              <p style={{ fontSize:'1.5rem', marginBottom:'.5rem' }}>🏖️</p>
              <p style={{ fontSize:'.95rem', fontWeight:600 }}>No hay asistencia los fines de semana</p>
              <p style={{ fontSize:'.8rem', marginTop:'.25rem' }}>
                {new Date(fechaISO+'T00:00:00').toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'})}
              </p>
            </div>
          ) : loadingH ? (
            <div style={{ display:'flex', alignItems:'center', gap:'.75rem', color:'var(--text3)', padding:'2rem' }}>
              <span className="spinner" /> Cargando beneficiarios del día…
            </div>
          ) : filtradosH.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📅</div>
              <p>Sin beneficiarios programados para este día</p>
              <p style={{ fontSize: '.8rem', marginTop: '.25rem' }}>
                {new Date(fechaISO + 'T00:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
          ) : (
            <>
              <div style={{ display:'flex', flexDirection:'column', gap:'.3rem', marginBottom:'1rem' }}>
                {filtradosH.map(b => {
                  const p = presencias[b.id] ?? false;
                  return (
                    <div key={b.id}
                      style={{ display:'flex', alignItems:'center', gap:'.75rem', padding:'.6rem 1rem',
                        background:'var(--bg3)', borderRadius:'var(--radius)',
                        borderLeft:`3px solid ${p ? 'var(--green)' : 'var(--border)'}`,
                        cursor:'pointer', userSelect:'none', transition:'border-color .15s' }}
                      onClick={() => toggleH(b.id)}>
                      <span style={{ width:20, height:20, borderRadius:4, flexShrink:0,
                        border:`2px solid ${p ? 'var(--green)' : 'var(--border2)'}`,
                        background: p ? 'var(--green)' : 'transparent',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:'.7rem', color:'#fff', transition:'all .15s' }}>
                        {p ? '✓' : ''}
                      </span>
                      <span style={{ flex:1, fontSize:'.88rem', fontWeight:p?600:400, color:'var(--text)' }}>{b.nombre}</span>
                      {b.chofer && <span style={{ fontSize:'.72rem', color:'var(--text3)' }}>{b.chofer}</span>}
                      <span className={`badge ${p ? 'badge-green' : 'badge-gray'}`} style={{ fontSize:'.7rem' }}>
                        {p ? 'PRESENTE' : 'AUSENTE'}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div style={{ display:'flex', alignItems:'center', gap:'.75rem', flexWrap:'wrap' }}>
                <button className="btn btn-primary" onClick={guardarAsistencia} disabled={savingH}>
                  {savingH ? <><span className="spinner" style={{width:12,height:12}}/> Guardando…</> : '💾 Guardar asistencia'}
                </button>
                {esAdmin && (
                  <button className="btn btn-danger" style={{ fontSize:'.82rem' }} onClick={cerrarDia} disabled={cerrandoD}>
                    {cerrandoD ? <><span className="spinner" style={{width:12,height:12}}/> …</> : '🔒 Cerrar día'}
                  </button>
                )}
                {msgH && (
                  <span style={{ fontSize:'.82rem', color: msgH.ok ? 'var(--green)' : 'var(--red)' }}>{msgH.text}</span>
                )}
              </div>
            </>
          )}

        </div>
      )}

      {/* ── TAB: REPORTE MENSUAL ──────────────────────────────────────── */}
      {tab === 'reporte' && (
        <div>
          <div style={{ display:'flex', gap:'1rem', alignItems:'flex-end', marginBottom:'1.25rem', flexWrap:'wrap' }}>
            <div>
              <label style={L}>Mes</label>
              <select className="select" style={{ width:140 }} value={repMes} onChange={e => setRepMes(Number(e.target.value))}>
                {MESES.map((m,i) => <option key={i} value={i+1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label style={L}>Año</label>
              <input type="number" className="input" style={{ width:100 }} value={repAnio} onChange={e => setRepAnio(Number(e.target.value))} />
            </div>
            <button className="btn btn-secondary" onClick={() => cargarReporte(repMes, repAnio)} disabled={loadingR}>↻</button>
            {diasHab > 0 && <span style={{ fontSize:'.82rem', color:'var(--text3)', alignSelf:'center' }}>{diasHab} días hábiles</span>}
          </div>

          {loadingR ? (
            <div style={{ display:'flex', alignItems:'center', gap:'.75rem', color:'var(--text3)', padding:'2rem' }}><span className="spinner"/> Cargando reporte…</div>
          ) : reporte.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">📊</div><p>Sin datos para {MESES[repMes-1]} {repAnio}</p></div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
              {reporte.map(grupo => {
                const totalP = grupo.rows.reduce((s,r) => s+r.presentes, 0);
                const totalA = grupo.rows.reduce((s,r) => s+r.ausentes, 0);
                const totalT = grupo.rows.reduce((s,r) => s+r.total, 0);
                return (
                  <div key={grupo.chofer}>
                    <p style={{ fontSize:'.82rem', fontWeight:700, color:'var(--text3)', textTransform:'uppercase',
                      letterSpacing:'.06em', marginBottom:'.5rem' }}>
                      🚗 {grupo.chofer || 'Sin chofer'}
                    </p>
                    <div className="tabla-wrap">
                      <table className="tabla">
                        <thead>
                          <tr>
                            <th>Beneficiario</th>
                            <th style={{ textAlign:'center' }}>Presentes</th>
                            <th style={{ textAlign:'center' }}>Ausentes</th>
                            <th style={{ textAlign:'center' }}>Total</th>
                            <th style={{ textAlign:'center' }}>%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {grupo.rows.map(r => (
                            <tr key={r.nombre}>
                              <td>{r.nombre}</td>
                              <td style={{ textAlign:'center', color:'var(--green)', fontWeight:600 }}>{r.presentes}</td>
                              <td style={{ textAlign:'center', color:'var(--red)' }}>{r.ausentes}</td>
                              <td style={{ textAlign:'center' }}>{r.total}</td>
                              <td style={{ textAlign:'center' }}>
                                <span className={`badge ${r.total>0&&r.presentes/r.total>=.8?'badge-green':r.total>0&&r.presentes/r.total>=.5?'badge-amber':'badge-red'}`}>
                                  {r.total>0 ? `${Math.round(r.presentes/r.total*100)}%` : '—'}
                                </span>
                              </td>
                            </tr>
                          ))}
                          <tr style={{ fontWeight:700, background:'var(--bg4)' }}>
                            <td>TOTAL</td>
                            <td style={{ textAlign:'center', color:'var(--green)' }}>{totalP}</td>
                            <td style={{ textAlign:'center', color:'var(--red)' }}>{totalA}</td>
                            <td style={{ textAlign:'center' }}>{totalT}</td>
                            <td style={{ textAlign:'center' }}>{totalT>0?`${Math.round(totalP/totalT*100)}%`:'—'}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: CALENDARIO ──────────────────────────────────────────── */}
      {tab === 'calendario' && (
        <div>
          <div style={{ display:'flex', gap:'1rem', alignItems:'flex-end', marginBottom:'1.25rem', flexWrap:'wrap' }}>
            <div>
              <label style={L}>Mes</label>
              <select className="select" style={{ width:140 }} value={calMes} onChange={e => setCalMes(Number(e.target.value))}>
                {MESES.map((m,i) => <option key={i} value={i+1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label style={L}>Año</label>
              <input type="number" className="input" style={{ width:100 }} value={calAnio} onChange={e => setCalAnio(Number(e.target.value))} />
            </div>
            <button className="btn btn-secondary" onClick={() => cargarCal(calMes, calAnio)} disabled={loadingC}>↻</button>
          </div>

          {loadingC ? (
            <div style={{ display:'flex', alignItems:'center', gap:'.75rem', color:'var(--text3)' }}><span className="spinner"/> Cargando…</div>
          ) : (
            <div style={{ maxWidth:560 }}>
              <p style={{ fontSize:'.9rem', fontWeight:700, color:'var(--text)', marginBottom:'.75rem', textAlign:'center' }}>
                {MESES[calMes-1]} {calAnio}
              </p>
              {/* Header días */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, marginBottom:4 }}>
                {DOW.map(d => (
                  <div key={d} style={{ textAlign:'center', fontSize:'.72rem', fontWeight:700,
                    color:'var(--text3)', padding:'.3rem 0' }}>{d}</div>
                ))}
              </div>
              {/* Celdas */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2 }}>
                {Array.from({ length: offsetLun }).map((_, i) => <div key={`e${i}`} />)}
                {Array.from({ length: diasEnMes }, (_, i) => {
                  const dia    = String(i + 1).padStart(2, '0');
                  const datos  = calData[dia];
                  const dowNum = new Date(calAnio, calMes-1, i+1).getDay();
                  const finSem = dowNum === 0 || dowNum === 6;
                  const pct    = datos?.presentes && datos.presentes + datos.ausentes > 0
                    ? datos.presentes / (datos.presentes + datos.ausentes) : null;
                  const bg = finSem ? 'var(--bg4)' : datos?.cerrado ? 'rgba(16,185,129,.1)'
                    : pct !== null ? (pct >= .8 ? 'rgba(16,185,129,.12)' : pct >= .5 ? 'rgba(245,158,11,.12)' : 'rgba(239,68,68,.1)') : 'var(--bg3)';
                  return (
                    <div key={dia}
                      onClick={() => datos && setDiaModal({ dia, data: datos })}
                      style={{ padding:'.45rem .2rem', textAlign:'center', borderRadius:'var(--radius)',
                        background: bg, cursor: datos ? 'pointer' : 'default',
                        border:`1px solid ${datos?.cerrado ? 'var(--green)' : 'var(--border)'}`,
                        transition:'opacity .15s' }}>
                      <p style={{ fontSize:'.78rem', fontWeight:600, color: finSem ? 'var(--text3)' : 'var(--text)' }}>{i+1}</p>
                      {datos && (
                        <p style={{ fontSize:'.65rem', color:'var(--text3)', marginTop:1 }}>
                          {datos.presentes}P {datos.ausentes>0?`${datos.ausentes}A`:''}
                        </p>
                      )}
                      {datos?.cerrado && <p style={{ fontSize:'.6rem', color:'var(--green)' }}>🔒</p>}
                    </div>
                  );
                })}
              </div>
              <div style={{ display:'flex', gap:'1rem', marginTop:'.75rem', fontSize:'.72rem', color:'var(--text3)' }}>
                <span>🟩 ≥80% · 🟨 ≥50% · 🟥 &lt;50% · 🔒 Cerrado</span>
              </div>
            </div>
          )}

          {/* Modal detalle día */}
          {diaModal && (
            <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.65)', display:'flex',
              alignItems:'center', justifyContent:'center', zIndex:50, padding:'1rem' }}
              onClick={() => setDiaModal(null)}>
              <div className="card" style={{ padding:'1.5rem', width:280 }} onClick={e => e.stopPropagation()}>
                <h3 style={{ fontSize:'.95rem', fontWeight:700, color:'var(--text)', marginBottom:'1rem' }}>
                  Día {diaModal.dia} — {MESES[calMes-1]} {calAnio}
                </h3>
                <div style={{ display:'grid', gap:'.5rem' }}>
                  <div style={{ display:'flex', justifyContent:'space-between' }}>
                    <span style={{ color:'var(--text3)', fontSize:'.85rem' }}>Presentes</span>
                    <span style={{ fontWeight:700, color:'var(--green)' }}>{diaModal.data.presentes}</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between' }}>
                    <span style={{ color:'var(--text3)', fontSize:'.85rem' }}>Ausentes</span>
                    <span style={{ fontWeight:700, color:'var(--red)' }}>{diaModal.data.ausentes}</span>
                  </div>
                  {diaModal.data.cerrado && <span className="badge badge-green" style={{ alignSelf:'flex-start' }}>🔒 Día cerrado</span>}
                </div>
                <button className="btn btn-secondary" style={{ width:'100%', marginTop:'1rem' }} onClick={() => setDiaModal(null)}>Cerrar</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: BUSCAR BENEFICIARIO ──────────────────────────────────── */}
      {tab === 'buscar' && (
        <div>
          <div style={{ display:'flex', gap:'.5rem', marginBottom:'1rem' }}>
            <input className="input" placeholder="Escribí el nombre del beneficiario…"
              value={busqTxt} onChange={e => setBusqTxt(e.target.value)} />
            <button className="btn btn-primary" style={{ flexShrink:0 }}
              onClick={() => buscarAsistencia(busqTxt)} disabled={loadingBq||busqTxt.length<2}>
              {loadingBq ? <span className="spinner" style={{width:12,height:12}}/> : '🔍 Buscar'}
            </button>
            {busqTxt && <button className="btn btn-secondary" onClick={()=>{setBusqTxt('');setBusqResultado(null);}}>✕</button>}
          </div>

          {loadingBq && (
            <div style={{ display:'flex', alignItems:'center', gap:'.75rem', color:'var(--text3)' }}><span className="spinner"/> Buscando…</div>
          )}

          {busqResultado && (
            <div>
              {/* Info del beneficiario */}
              <div className="card" style={{ padding:'.75rem 1rem', marginBottom:'1rem' }}>
                <p style={{ fontWeight:600, color:'var(--text)' }}>{busqResultado.beneficiario.nombre}</p>
                {busqResultado.beneficiario.chofer && (
                  <p style={{ fontSize:'.78rem', color:'var(--text3)' }}>🚗 {busqResultado.beneficiario.chofer}</p>
                )}
              </div>

              {/* Historial agrupado por mes */}
              {busqResultado.meses.length === 0 ? (
                <div className="empty-state"><p>Sin historial de asistencia</p></div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
                  {busqResultado.meses.map(m => {
                    const presentes = m.dias.filter(d=>d.presente).length;
                    return (
                      <div key={`${m.mes}-${m.anio}`}>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'.5rem' }}>
                          <p style={{ fontSize:'.82rem', fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.06em' }}>
                            {MESES[m.mes-1]} {m.anio}
                          </p>
                          <span style={{ fontSize:'.78rem', color:'var(--text3)' }}>
                            <strong style={{ color:'var(--green)' }}>{presentes}</strong> P · <strong style={{ color:'var(--red)' }}>{m.dias.length-presentes}</strong> A
                          </span>
                        </div>
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(110px,1fr))', gap:'.3rem' }}>
                          {m.dias.map(d=>(
                            <div key={d.fecha} style={{ padding:'.4rem .6rem', borderRadius:'var(--radius)',
                              background:d.presente?'var(--green-dim)':'var(--red-dim)',
                              border:`1px solid ${d.presente?'rgba(16,185,129,.3)':'rgba(239,68,68,.3)'}`,
                              display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                              <span style={{ fontSize:'.78rem', color:'var(--text)' }}>{d.fecha}</span>
                              <span style={{ fontSize:'.72rem', fontWeight:700, color:d.presente?'var(--green)':'var(--red)' }}>
                                {d.presente?'P':'A'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {!busqResultado && !loadingBq && busqTxt.length >= 2 && (
            <div className="empty-state"><p>Sin resultados para "{busqTxt}"</p></div>
          )}
        </div>
      )}

      {/* ── TAB: ASIGNACIÓN (admin) ───────────────────────────────────── */}
      {tab === 'asignacion' && esAdmin && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
            <p style={{ fontSize:'.85rem', color:'var(--text3)' }}>
              Asigná un chofer a cada beneficiario. Los cambios se guardan en bloque.
            </p>
            <div style={{ display:'flex', gap:'.5rem', alignItems:'center' }}>
              {Object.keys(asigCambios).length > 0 && (
                <span style={{ fontSize:'.78rem', color:'var(--amber)' }}>{Object.keys(asigCambios).length} cambio{Object.keys(asigCambios).length!==1?'s':''} sin guardar</span>
              )}
              <button className="btn btn-primary" onClick={guardarAsig}
                disabled={savingAsig || Object.keys(asigCambios).length === 0}>
                {savingAsig ? <><span className="spinner" style={{width:12,height:12}}/> Guardando…</> : '💾 Guardar cambios'}
              </button>
            </div>
          </div>

          {msgAsig && (
            <p style={{ fontSize:'.82rem', color: msgAsig.ok ? 'var(--green)' : 'var(--red)', marginBottom:'.75rem' }}>{msgAsig.text}</p>
          )}

          {loadingAsig ? (
            <div style={{ display:'flex', alignItems:'center', gap:'.75rem', color:'var(--text3)', padding:'2rem' }}><span className="spinner"/> Cargando…</div>
          ) : asigBenefs.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">👥</div><p>Sin beneficiarios</p></div>
          ) : (
            <div className="tabla-wrap">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Beneficiario</th>
                    <th>Chofer actual</th>
                    <th>Nuevo chofer</th>
                  </tr>
                </thead>
                <tbody>
                  {asigBenefs.map(b => {
                    // key = nombre beneficiario, value = email chofer
                    const currentEmail = asigCambios[b.nombre] ?? asigChsMap.find(c=>c.nombre===b.chofer)?.email ?? '';
                    const changed = b.nombre in asigCambios;
                    return (
                      <tr key={b.id} style={{ background: changed ? 'rgba(59,130,246,.07)' : undefined }}>
                        <td style={{ fontWeight:500, color:'var(--text)' }}>{b.nombre}</td>
                        <td style={{ color:'var(--text3)' }}>{b.chofer || '—'}</td>
                        <td>
                          <select className="select" style={{ fontSize:'.82rem', padding:'.25rem .5rem' }}
                            value={currentEmail}
                            onChange={e => setAsigCambios(p => {
                              const next = { ...p };
                              const origEmail = asigChsMap.find(c=>c.nombre===b.chofer)?.email ?? '';
                              if (e.target.value === origEmail) delete next[b.nombre];
                              else next[b.nombre] = e.target.value;
                              return next;
                            })}>
                            <option value="">Sin asignar</option>
                            {asigChsMap.map(c => <option key={c.email} value={c.email}>{c.nombre}</option>)}
                          </select>
                          {changed && <span style={{ fontSize:'.68rem', color:'var(--blue)', marginLeft:'.4rem' }}>✎ modificado</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
