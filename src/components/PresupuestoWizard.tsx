'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { IconAlertTriangle, IconCheck, IconDownload, IconPlus, IconX } from '@tabler/icons-react';
import api from '@/lib/api';
import { LABEL, OVERLAY, mensajeError } from '@/lib/administrativo';
import DesglosePresupuesto from '@/components/DesglosePresupuesto';
import ViajeCard from '@/components/ViajeCard';
import { bajarDocx, mensajeDeBlob, viajesDesdeGuardado, type PresupuestoGuardado, type RespaldoItem } from '@/lib/presupuestoApi';
import { descargarPdf, type PresupuestoDoc } from '@/lib/presupuestoPdf';
import {
  DIAS, faltantesViaje, mesActual, periodoLabel, pesos, viajePayload, viajeVacio,
  type ArancelUsado, type Calculo, type Formato, type LecturaRecorrido, type ViajeEditable,
} from '@/lib/presupuesto';

interface Carpeta { id: string; nombre: string; dni: string; obraNombre: string; obraSocial: string }
interface Prefill {
  beneficiario: { id: string; nombre: string; dni: string; afiliado: string; obraSocial: string; domicilio: string; localidad: string; tutor: string; contacto: string };
  obra: { id: string | null; nombre: string; formato: Formato; tieneUnaPlantilla: boolean; tramoCorto: { activo: boolean }; semanasPorMes: number; dependenciaPct: number };
  arancel: { valorKmTransporte: number; resolucion: string; mes: string; origen: string; verificar: boolean } | null;
  aviso: { desactualizado: boolean; mensaje: string }; transportista: { faltan: string[]; avisos: string[] }; pistas: { diasPorSemana?: number };
}
interface Calculado { calculo: Calculo; arancel: ArancelUsado; aviso: { desactualizado: boolean; mensaje: string }; cfg: { formato: Formato; tienePlantilla: boolean } }
interface OpcionDoc { id: string; nombre: string }
type Transportista = PresupuestoDoc['transportista'];

const PASOS = ['Paciente', 'Viajes', 'Datos', 'Revisar y emitir'];

export default function PresupuestoWizard({ editarId, onCerrar, onListo }: { editarId?: string; onCerrar: () => void; onListo: () => void }) {
  const [paso, setPaso] = useState(editarId ? 2 : 1);
  const [carpetas, setCarpetas] = useState<Carpeta[]>([]);
  const [busq, setBusq] = useState('');
  const [benId, setBenId] = useState('');
  const [pre, setPre] = useState<Prefill | null>(null);
  const [transportista, setTransportista] = useState<Transportista>({});
  const [domicilio, setDomicilio] = useState(''); const [tutor, setTutor] = useState(''); const [contacto, setContacto] = useState('');
  const [viajes, setViajes] = useState<ViajeEditable[]>([viajeVacio(0)]);
  const [periodoDesde, setPeriodoDesde] = useState(mesActual()); const [periodoHasta, setPeriodoHasta] = useState(mesActual());
  const [acompanante, setAcompanante] = useState(false); const [vehiculo, setVehiculo] = useState(''); const [observaciones, setObservaciones] = useState('');
  const [depActiva, setDepActiva] = useState(false); const [depPct, setDepPct] = useState('35');
  const [docs, setDocs] = useState<OpcionDoc[]>([]); const [respaldoDocs, setRespaldoDocs] = useState<string[]>([]);
  const [resCalc, setResCalc] = useState<{ clave: string; calc?: Calculado; error?: string }>({ clave: '' });
  const [id, setId] = useState(editarId || ''); const [ocupado, setOcupado] = useState(false); const [error, setError] = useState('');
  const [emitido, setEmitido] = useState<{ id: string; numeroTexto: string } | null>(null);
  const [cargandoPre, setCargandoPre] = useState(false);

  /* ── Carga inicial ───────────────────────────────────────────────────── */
  useEffect(() => {
    api.get('/api/legajos').then(r => setCarpetas(r.data.carpetas || [])).catch(() => {});
    api.get('/api/presupuestos/config').then(r => setTransportista(r.data.transportista || {})).catch(() => {});
  }, []);

  const elegirPaciente = useCallback(async (idBen: string, conservar = false) => {
    setBenId(idBen); setCargandoPre(true); setError('');
    try {
      const p = (await api.get(`/api/presupuestos/prefill/${idBen}`)).data as Prefill;
      setPre(p); setDepPct(String(p.obra.dependenciaPct));
      if (!conservar) { setDomicilio(p.beneficiario.domicilio); setTutor(p.beneficiario.tutor); setContacto(p.beneficiario.contacto); setViajes([{ ...viajeVacio(0), origen: p.beneficiario.domicilio }]); }
      const det = (await api.get(`/api/legajos/${idBen}`)).data as { checklist?: { requisito: { key: string; nombre: string }; documento: { id: string } | null }[]; otros?: { id: string; nombre?: string }[] };
      const lista: OpcionDoc[] = [...(det.checklist || []).filter(i => i.documento).map(i => ({ id: i.documento!.id, nombre: i.requisito.nombre })), ...(det.otros || []).map(d => ({ id: d.id, nombre: d.nombre || 'Documento' }))];
      setDocs(lista);
      if (!conservar) setRespaldoDocs((det.checklist || []).filter(i => i.documento && /cud|orden|autoriz/i.test(i.requisito.key)).map(i => i.documento!.id));
    } catch (e) { setError(mensajeError(e, 'No se pudo cargar el paciente.')); }
    setCargandoPre(false);
  }, []);

  useEffect(() => {
    if (!editarId) return;
    (async () => {
      try {
        const r = (await api.get(`/api/presupuestos/${editarId}`)).data as { presupuesto: PresupuestoGuardado; respaldo: RespaldoItem[] };
        const p = r.presupuesto;
        await elegirPaciente(p.beneficiarioId, true);
        setDomicilio(p.beneficiario.domicilio || ''); setTutor(p.beneficiario.tutor || ''); setContacto(p.beneficiario.contacto || '');
        setViajes(viajesDesdeGuardado(p.viajes, r.respaldo)); setPeriodoDesde(p.periodoDesde); setPeriodoHasta(p.periodoHasta);
        setAcompanante(!!p.acompanante); setVehiculo(p.vehiculo || ''); setObservaciones(p.observaciones || '');
        setDepActiva(!!p.dependencia?.activa); if (p.dependencia?.porcentaje !== undefined) setDepPct(String(p.dependencia.porcentaje)); setRespaldoDocs(p.respaldoDocs || []);
      } catch (e) { setError(mensajeError(e, 'No se pudo abrir el borrador.')); }
    })();
  }, [editarId, elegirPaciente]);

  /* ── Pedidos al servidor ─────────────────────────────────────────────── */
  const cuerpo = useMemo(() => ({
    beneficiarioId: benId, obraId: pre?.obra.id ?? null, obraNombre: pre?.obra.nombre || pre?.beneficiario.obraSocial || '', periodoDesde, periodoHasta, acompanante, vehiculo, observaciones,
    dependencia: { activa: depActiva, porcentaje: Number(depPct.replace(',', '.')) }, viajes: viajes.map(viajePayload), respaldoDocs, domicilioOrigen: domicilio, tutor, contacto,
  }), [benId, pre, periodoDesde, periodoHasta, acompanante, vehiculo, observaciones, depActiva, depPct, viajes, respaldoDocs, domicilio, tutor, contacto]);

  // El cálculo lo hace el servidor (valor vigente, tramo corto de la obra social). Se identifica cada pedido con una clave:
  // si cambian los datos, el resultado viejo deja de valer solo, sin tocar el estado dentro del efecto.
  const claveCalc = paso === 4 && pre ? JSON.stringify([cuerpo.obraId, cuerpo.dependencia, cuerpo.viajes]) : '';
  useEffect(() => {
    if (!claveCalc) return;
    let vivo = true;
    api.post('/api/presupuestos/calcular', { obraId: cuerpo.obraId, obraNombre: cuerpo.obraNombre, dependencia: cuerpo.dependencia, viajes: cuerpo.viajes })
      .then(r => { if (vivo) setResCalc({ clave: claveCalc, calc: r.data }); })
      .catch(e => { if (vivo) setResCalc({ clave: claveCalc, error: mensajeError(e, 'No se pudo calcular.') }); });
    return () => { vivo = false; };
  }, [claveCalc, cuerpo]);
  const calc = resCalc.clave === claveCalc && claveCalc ? resCalc.calc ?? null : null;
  const calcError = resCalc.clave === claveCalc && claveCalc ? resCalc.error ?? '' : '';
  const calculando = !!claveCalc && resCalc.clave !== claveCalc;

  const guardar = async (): Promise<string> => {
    if (id) { await api.put(`/api/presupuestos/${id}`, cuerpo); return id; }
    const nuevo = (await api.post('/api/presupuestos', cuerpo)).data.id as string;
    setId(nuevo); return nuevo;
  };
  const guardarBorrador = async () => { setOcupado(true); setError(''); try { await guardar(); onListo(); } catch (e) { setError(mensajeError(e, 'No se pudo guardar el borrador.')); } setOcupado(false); };
  const emitir = async () => {
    setOcupado(true); setError('');
    try {
      const pid = await guardar();
      const r = (await api.post(`/api/presupuestos/${pid}/emitir`)).data;
      setEmitido({ id: pid, numeroTexto: r.numeroTexto });
    } catch (e) { setError(mensajeError(e, 'No se pudo emitir.')); }
    setOcupado(false);
  };

  const docPdf = (numeroTexto?: string): PresupuestoDoc | null => !calc || !pre ? null : ({
    numeroTexto, fechaEmision: new Date().toLocaleDateString('es-AR'), formato: calc.cfg.formato, obraNombre: pre.obra.nombre || pre.beneficiario.obraSocial, transportista,
    beneficiario: { ...pre.beneficiario, domicilio, tutor, contacto }, periodoDesde, periodoHasta, acompanante, vehiculo, observaciones,
    viajes: viajes.map(v => ({ id: v.id, origen: v.origen, destino: v.destino, centro: v.centro, dias: v.dias })), calculo: calc.calculo, arancel: calc.arancel,
  });

  /* ── Validaciones por paso ───────────────────────────────────────────── */
  const faltasViajes = viajes.flatMap(v => faltantesViaje(v).map(f => `Viaje ${v.id}: ${f}`));
  const faltasDatos = [!periodoDesde && 'el período "desde"', !periodoHasta && 'el período "hasta"', periodoDesde && periodoHasta && periodoHasta < periodoDesde && 'que el período "hasta" no sea anterior al "desde"'].filter(Boolean) as string[];
  const bloqueoEmision = [
    ...(pre?.transportista.faltan.length ? [`Faltan datos del transportista: ${pre.transportista.faltan.join(', ')}.`] : []),
    ...(!pre?.arancel ? ['No hay un valor del km cargado.'] : []), ...faltasViajes, ...faltasDatos.map(f => `Falta ${f}.`),
  ];
  const siguiente = () => { setError(''); setPaso(p => p + 1); };
  const filtradas = carpetas.filter(c => !busq || c.nombre.toLowerCase().includes(busq.toLowerCase()) || c.dni.includes(busq)).slice(0, 8);
  const otrasLecturas = (i: number): LecturaRecorrido[] => viajes.flatMap((v, k) => (k === i ? [] : v.lecturas)).filter((l, k, a) => l.propuesta.legible && a.findIndex(x => x.hash === l.hash) === k);

  const cambiarDiasPorPista = () => { if (pre?.pistas.diasPorSemana) setViajes(vs => vs.map(v => ({ ...v, dias: DIAS.slice(0, Math.min(6, pre.pistas.diasPorSemana as number)).map(d => d.k) }))); };

  /* ── Pantalla final (emitido) ────────────────────────────────────────── */
  if (emitido) {
    return (
      <div style={{ ...OVERLAY, zIndex: 60 }}>
        <div className="card" role="dialog" aria-label="Presupuesto emitido" style={{ width: '100%', maxWidth: 520, padding: '1.5rem' }}>
          <p style={{ color: 'var(--green)', display: 'flex', gap: '.4rem', alignItems: 'center', fontWeight: 700 }}><IconCheck size={18} /> Presupuesto N° {emitido.numeroTexto} emitido</p>
          <p style={{ fontSize: '.84rem', color: 'var(--text2)', margin: '.5rem 0 1rem' }}>Ya quedó guardado con el desglose, el valor del km y los archivos de respaldo. Un presupuesto emitido no se edita: si hay que corregirlo, se anula y se genera otro.</p>
          {error && <p role="alert" style={{ fontSize: '.8rem', color: 'var(--red)', marginBottom: '.6rem' }}>{error}</p>}
          <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" style={{ minHeight: 44 }} onClick={() => { const d = docPdf(emitido.numeroTexto); if (d) descargarPdf(d); }}><IconDownload size={16} /> Descargar PDF</button>
            {calc?.cfg.tienePlantilla && <button className="btn btn-secondary" style={{ minHeight: 44 }} onClick={async () => { try { await bajarDocx(emitido.id, emitido.numeroTexto); } catch (e) { setError(await mensajeDeBlob(e, 'No se pudo generar el .docx.')); } }}><IconDownload size={16} /> Descargar .docx</button>}
            <button className="btn btn-secondary" style={{ minHeight: 44 }} onClick={onListo}>Cerrar</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...OVERLAY, zIndex: 60, alignItems: 'flex-start', overflowY: 'auto' }}>
      <div className="card" role="dialog" aria-label="Nuevo presupuesto de transporte" style={{ width: '100%', maxWidth: 860, padding: '1.25rem', margin: '1rem auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', marginBottom: '.9rem' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text)' }}>{editarId ? 'Corregir borrador' : 'Nuevo presupuesto de transporte'}</h3>
            <p style={{ fontSize: '.78rem', color: 'var(--text3)', marginTop: '.15rem' }}>Paso {paso} de 4 · {PASOS[paso - 1]}</p>
          </div>
          <button className="btn btn-secondary" style={{ minWidth: 44, minHeight: 44 }} onClick={onCerrar} aria-label="Cerrar"><IconX size={18} /></button>
        </div>
        <div aria-hidden="true" style={{ display: 'flex', gap: '.3rem', marginBottom: '1rem' }}>
          {PASOS.map((_, i) => <span key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i < paso ? 'var(--purple)' : 'var(--border)' }} />)}
        </div>

        {/* 1 · Paciente */}
        {paso === 1 && (
          <div>
            {!pre ? (
              <>
                <label style={LABEL}>Buscá al paciente</label>
                <input className="input" style={{ minHeight: 44 }} placeholder="Nombre o DNI…" value={busq} onChange={e => setBusq(e.target.value)} autoFocus />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '.35rem', marginTop: '.6rem' }}>
                  {filtradas.map(c => (
                    <button key={c.id} className="card" style={{ textAlign: 'left', padding: '.7rem .9rem', minHeight: 44, cursor: 'pointer' }} onClick={() => elegirPaciente(c.id)} disabled={cargandoPre}>
                      <span style={{ fontSize: '.9rem', fontWeight: 600, color: 'var(--text)' }}>{c.nombre}</span>
                      <span style={{ display: 'block', fontSize: '.74rem', color: 'var(--text3)' }}>DNI {c.dni || '—'} · {c.obraNombre || c.obraSocial || 'Sin obra social'}</span>
                    </button>
                  ))}
                  {filtradas.length === 0 && <p style={{ fontSize: '.82rem', color: 'var(--text3)' }}>No hay pacientes con ese nombre o DNI.</p>}
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.5rem', alignItems: 'center' }}>
                  <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)' }}>{pre.beneficiario.nombre}</p>
                  {!editarId && <button className="btn btn-secondary" style={{ minHeight: 44 }} onClick={() => { setPre(null); setBenId(''); }}>Cambiar</button>}
                </div>
                <p style={{ fontSize: '.8rem', color: 'var(--text3)', margin: '.2rem 0 .9rem' }}>DNI {pre.beneficiario.dni || '—'} · {pre.obra.nombre || pre.beneficiario.obraSocial || 'Sin obra social'} · Afiliado {pre.beneficiario.afiliado || '—'} · Formato: {pre.obra.formato === 'traslados_programados' ? 'Servicio de Traslados Programados' : 'Presupuesto transporte (multi-viaje)'}</p>
                <div className="form-grid form-grid-2">
                  <div><label style={LABEL}>Domicilio de origen (del legajo, editable)</label><input className="input" style={{ minHeight: 44 }} value={domicilio} onChange={e => setDomicilio(e.target.value)} /></div>
                  <div><label style={LABEL}>Tutor o encargado</label><input className="input" style={{ minHeight: 44 }} value={tutor} onChange={e => setTutor(e.target.value)} /></div>
                  <div><label style={LABEL}>N° de contacto</label><input className="input" style={{ minHeight: 44 }} value={contacto} onChange={e => setContacto(e.target.value)} /></div>
                </div>
                <div style={{ marginTop: '.9rem', display: 'grid', gap: '.5rem' }}>
                  {pre.arancel
                    ? <p style={{ fontSize: '.82rem', color: 'var(--text2)' }}>Valor del km vigente: <b>{pesos(pre.arancel.valorKmTransporte)}</b> · {pre.arancel.resolucion}{pre.arancel.mes ? ` · ${pre.arancel.mes}` : ''}</p>
                    : <Aviso>No hay un valor del km cargado para hoy. <Link href="/dashboard/aranceles" style={{ color: 'var(--amber)', fontWeight: 600 }}>Cargalo en Valor del km</Link> antes de emitir.</Aviso>}
                  {pre.aviso.desactualizado && pre.arancel && <Aviso>{pre.aviso.mensaje}</Aviso>}
                  {pre.arancel?.verificar && <Aviso>El valor del km está marcado para verificar contra el Boletín Oficial.</Aviso>}
                  {pre.transportista.faltan.length > 0 && <Aviso>Faltan datos del transportista ({pre.transportista.faltan.join(', ')}). <Link href="/dashboard/presupuestos/config" style={{ color: 'var(--amber)', fontWeight: 600 }}>Completalos en la configuración</Link> para poder emitir.</Aviso>}
                  {pre.pistas.diasPorSemana && <p style={{ fontSize: '.8rem', color: 'var(--text2)' }}>La orden médica indica {pre.pistas.diasPorSemana} día{pre.pistas.diasPorSemana === 1 ? '' : 's'} por semana.</p>}
                </div>
              </>
            )}
          </div>
        )}

        {/* 2 · Viajes */}
        {paso === 2 && pre && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.85rem' }}>
            {pre.pistas.diasPorSemana && <button className="btn btn-secondary" style={{ minHeight: 44, alignSelf: 'flex-start' }} onClick={cambiarDiasPorPista}>Usar los {pre.pistas.diasPorSemana} días de la orden médica en todos los viajes</button>}
            {viajes.map((v, i) => (
              <ViajeCard key={i} viaje={v} beneficiarioId={benId} otrasLecturas={otrasLecturas(i)} puedeQuitar={viajes.length > 1}
                onCambio={nv => setViajes(vs => vs.map((x, k) => (k === i ? nv : x)))} onQuitar={() => setViajes(vs => vs.filter((_, k) => k !== i))} />
            ))}
            {viajes.length < 12 && <button className="btn btn-secondary" style={{ minHeight: 44, alignSelf: 'flex-start' }} onClick={() => setViajes(vs => [...vs, { ...viajeVacio(vs.length), origen: vs.length % 2 === 1 ? vs[vs.length - 1].destino : domicilio }])}><IconPlus size={16} /> Agregar viaje</button>}
          </div>
        )}

        {/* 3 · Datos */}
        {paso === 3 && (
          <div className="form-grid form-grid-2">
            <div><label style={LABEL}>Período desde *</label><input type="month" className="input" style={{ minHeight: 44 }} value={periodoDesde} onChange={e => setPeriodoDesde(e.target.value)} /></div>
            <div><label style={LABEL}>Período hasta *</label><input type="month" className="input" style={{ minHeight: 44 }} value={periodoHasta} min={periodoDesde} onChange={e => setPeriodoHasta(e.target.value)} /></div>
            <div><label style={LABEL}>Tipo de vehículo</label><input className="input" style={{ minHeight: 44 }} value={vehiculo} placeholder="Ej: utilitario con rampa" onChange={e => setVehiculo(e.target.value)} /></div>
            <div><label style={LABEL}>Beneficiario con acompañante</label>
              <div style={{ display: 'flex', gap: '.4rem' }}>
                {[true, false].map(s => <button key={String(s)} type="button" aria-pressed={acompanante === s} className={acompanante === s ? 'btn btn-primary' : 'btn btn-secondary'} style={{ minHeight: 44, flex: 1 }} onClick={() => setAcompanante(s)}>{s ? 'Sí' : 'No'}</button>)}
              </div></div>
            <div style={{ gridColumn: '1 / -1', padding: '.8rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg4)' }}>
              <label style={{ display: 'flex', gap: '.5rem', alignItems: 'center', minHeight: 44, fontSize: '.86rem', fontWeight: 600, color: 'var(--text)', cursor: 'pointer' }}>
                <input type="checkbox" style={{ width: 20, height: 20 }} checked={depActiva} onChange={e => setDepActiva(e.target.checked)} /> Adicional por dependencia
              </label>
              {depActiva && <div style={{ maxWidth: 220 }}><label style={LABEL}>Porcentaje sobre el valor del km</label><input className="input" inputMode="decimal" style={{ minHeight: 44 }} value={depPct} onChange={e => setDepPct(e.target.value)} /></div>}
              <p style={{ fontSize: '.72rem', color: 'var(--text3)', marginTop: '.3rem' }}>Se muestra el valor base, el adicional y el valor final del km.</p>
            </div>
            <div style={{ gridColumn: '1 / -1' }}><label style={LABEL}>Observaciones</label><input className="input" style={{ minHeight: 44 }} value={observaciones} placeholder="Opcional" onChange={e => setObservaciones(e.target.value)} /></div>
            {docs.length > 0 && (
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={LABEL}>Documentos del legajo que quedan como respaldo</label>
                {docs.map(d => (
                  <label key={d.id} style={{ display: 'flex', gap: '.5rem', alignItems: 'center', minHeight: 44, fontSize: '.84rem', color: 'var(--text)', cursor: 'pointer' }}>
                    <input type="checkbox" style={{ width: 20, height: 20 }} checked={respaldoDocs.includes(d.id)} onChange={e => setRespaldoDocs(r => (e.target.checked ? [...r, d.id] : r.filter(x => x !== d.id)))} /> {d.nombre}
                  </label>
                ))}
                <p style={{ fontSize: '.72rem', color: 'var(--text3)' }}>Solo se guarda el vínculo al documento: el presupuesto no copia datos clínicos.</p>
              </div>
            )}
          </div>
        )}

        {/* 4 · Revisar */}
        {paso === 4 && (
          <div>
            <p style={{ fontSize: '.84rem', color: 'var(--text2)', marginBottom: '.7rem' }}>{pre?.beneficiario.nombre} · {pre?.obra.nombre || pre?.beneficiario.obraSocial} · {periodoLabel(periodoDesde)} a {periodoLabel(periodoHasta)}{acompanante ? ' · con acompañante' : ''}</p>
            {calculando && <div style={{ color: 'var(--text3)', padding: '1rem 0' }}><span className="spinner" /> Calculando…</div>}
            {calcError && <Aviso>{calcError}</Aviso>}
            {calc && <DesglosePresupuesto calculo={calc.calculo} arancel={calc.arancel} viajes={viajes} />}
            {calc?.aviso.desactualizado && <div style={{ marginTop: '.6rem' }}><Aviso>{calc.aviso.mensaje}</Aviso></div>}
            {bloqueoEmision.length > 0 && (
              <div role="alert" style={{ marginTop: '.9rem' }}>
                <Aviso>No se puede emitir todavía:<ul style={{ margin: '.3rem 0 0 1rem' }}>{bloqueoEmision.map(b => <li key={b}>{b}</li>)}</ul></Aviso>
              </div>
            )}
            {calc && pre?.obra.formato === 'traslados_programados' && !calc.cfg.tienePlantilla && <p style={{ fontSize: '.76rem', color: 'var(--text3)', marginTop: '.6rem' }}>Esta obra social usa el formulario de Traslados, pero todavía no tiene plantilla .docx: se emite igual y se descarga el PDF.</p>}
          </div>
        )}

        {error && <p role="alert" style={{ fontSize: '.84rem', color: 'var(--red)', marginTop: '.8rem' }}>{error}</p>}

        <div style={{ display: 'flex', gap: '.6rem', marginTop: '1.2rem', flexWrap: 'wrap', position: 'sticky', bottom: 0, background: 'var(--bg3)', paddingTop: '.7rem', borderTop: '1px solid var(--border)' }}>
          {paso > 1 && !(editarId && paso === 2) && <button className="btn btn-secondary" style={{ minHeight: 44 }} onClick={() => setPaso(p => p - 1)} disabled={ocupado}>Atrás</button>}
          <span style={{ flex: 1 }} />
          {paso === 1 && <button className="btn btn-primary" style={{ minHeight: 44 }} disabled={!pre} onClick={siguiente}>Siguiente</button>}
          {paso === 2 && <button className="btn btn-primary" style={{ minHeight: 44 }} disabled={faltasViajes.length > 0} onClick={siguiente} title={faltasViajes[0]}>Siguiente</button>}
          {paso === 3 && <button className="btn btn-primary" style={{ minHeight: 44 }} disabled={faltasDatos.length > 0} onClick={siguiente}>Calcular y revisar</button>}
          {paso === 4 && (
            <>
              <button className="btn btn-secondary" style={{ minHeight: 44 }} disabled={!calc || ocupado} onClick={() => { const d = docPdf(undefined); if (d) descargarPdf(d); }}><IconDownload size={16} /> Vista previa PDF</button>
              <button className="btn btn-secondary" style={{ minHeight: 44 }} disabled={ocupado} onClick={guardarBorrador}>Guardar borrador</button>
              <button className="btn btn-primary" style={{ minHeight: 44 }} disabled={ocupado || !calc || bloqueoEmision.length > 0} onClick={emitir}>{ocupado ? 'Emitiendo…' : 'Emitir presupuesto'}</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: '.5rem', alignItems: 'flex-start', padding: '.65rem .8rem', borderRadius: 8, border: '1px solid var(--amber)', background: 'var(--amber-dim)' }}>
      <IconAlertTriangle size={16} color="var(--amber)" style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ fontSize: '.8rem', color: 'var(--text)' }}>{children}</div>
    </div>
  );
}
