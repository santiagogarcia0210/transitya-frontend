'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import api from '@/lib/api';

/* ─── Tipos (respuesta de GET /api/agenda-admin/pizarra) ─────────────── */

type Nivel = 'ALTA' | 'MEDIA';
interface Base { urgentes: number; pendientes: number; error?: boolean; mensaje?: string; }

interface FaltaKm { nombre: string; email: string; vehiculo: string; motivo: 'SIN_REPORTE' | 'SIN_KM_FINAL'; }
interface DiaKm { fecha: string; diaSemana: string; esAyer?: boolean; faltan: FaltaKm[]; faltanTotal: number; }
interface ColKm extends Base { sinChoferes: boolean; hoy: DiaKm | null; anterior: DiaKm | null; }

interface ItemTarea { tareaId: string; titulo: string; obraSocial?: string; periodo: string; fecha: string; estado: string; diffDias: number | null; nivel: Nivel; }
interface ColTareas extends Base { configuradas: number; items: ItemTarea[]; total: number; vencidas: number; proximas: number; }

interface ItemVenc { id: string; descripcion: string; persona: string; tipo: string; fechaVenc: string; estado: string; diffDias: number; nivel: Nivel; }
interface ItemPaciente {
  beneficiarioId: string; beneficiario: string; obraSocial: string; vencidos: number; faltantes: number; porVencer: number;
  detalle: { tipo: string; documento: string; diffDias: number | null }[]; nivel: Nivel;
}
interface ColDocs extends Base {
  vencimientos: { items: ItemVenc[]; total: number };
  pacientes: { items: ItemPaciente[]; total: number; hayRequisitos: boolean };
}

interface ItemMail { id: string; asunto: string; deNombre: string; accion?: string; urgencia: string; pacienteNombre?: string; nivel: Nivel; }
interface ColCorreo extends Base {
  conectado: boolean; alerta?: { tipo: 'RECONEXION' | 'ERROR'; mensaje: string } | null; conAccion?: number; total?: number; items?: ItemMail[];
}

interface ItemComprobante { tipo: 'REMITO' | 'EGRESO'; id: string; fecha: string; chofer?: string; detalle: string; }
interface ColComprobantes extends Base { items: ItemComprobante[]; total: number; remitos: number; egresos: number; }

interface Pizarra {
  hoy: string; generadoEn: string;
  resumen: { urgentes: number; pendientes: number; errores: string[] };
  km: ColKm; tareas: ColTareas; documentacion: ColDocs; correo: ColCorreo; comprobantes: ColComprobantes;
}

const REFRESCO_MS = 2 * 60 * 1000;

/* ─── Helpers ────────────────────────────────────────────────────────── */

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
const mayus = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function textoVence(diff: number | null): string {
  if (diff === null) return '';
  if (diff < 0) return `Venció hace ${plural(-diff, 'día', 'días')}`;
  if (diff === 0) return 'Vence hoy';
  if (diff === 1) return 'Vence mañana';
  return `Vence en ${diff} días`;
}

const badgeDe = (nivel: Nivel) => (nivel === 'ALTA' ? 'badge badge-red' : 'badge badge-amber');

function horaAR(iso: string): string {
  try { return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Tucuman' }); }
  catch { return ''; }
}

const pedirPizarra = (refrescar: boolean) =>
  api.get('/api/agenda-admin/pizarra', { params: refrescar ? { refrescar: 1 } : undefined }).then(r => r.data as Pizarra);

/* ─── Columna genérica ───────────────────────────────────────────────── */

function Columna({ titulo, col, hayAlgo, vacio, children, pie }: {
  titulo: string; col: Base; hayAlgo: boolean; vacio?: string; children: ReactNode; pie?: ReactNode;
}) {
  const total = col.urgentes + col.pendientes;
  return (
    <section className="pizarra-col" aria-label={titulo}>
      <div className="pizarra-col-head">
        <h3 className="pizarra-col-titulo">{titulo}</h3>
        {!col.error && (
          <span className={total === 0 ? 'badge badge-green' : col.urgentes > 0 ? 'badge badge-red' : 'badge badge-amber'}>
            {total === 0 ? 'Al día' : total}
          </span>
        )}
      </div>
      {col.error ? (
        <p className="pizarra-error">{col.mensaje || 'No se pudo cargar esta sección.'} Probá actualizar en un momento.</p>
      ) : !hayAlgo ? (
        <p className="pizarra-vacio">{vacio || 'Todo al día'}</p>
      ) : children}
      {pie && <div className="pizarra-pie">{pie}</div>}
    </section>
  );
}

/* ─── Componente ─────────────────────────────────────────────────────── */

export default function PizarraInicio() {
  const [data, setData] = useState<Pizarra | null>(null);
  const [cargando, setCargando] = useState(true);
  const [fallo, setFallo] = useState(false);      // la última carga falló
  const [aviso, setAviso] = useState('');
  const [marcando, setMarcando] = useState<Set<string>>(new Set());
  const pedido = useRef(0);                       // descarta respuestas viejas si se pisan dos cargas

  // Carga manual (botones y re-sincronización): prende el spinner si se pide.
  const cargar = useCallback(async (refrescar = false, visible = false) => {
    const mio = ++pedido.current;
    if (visible) setCargando(true);
    try {
      const d = await pedirPizarra(refrescar);
      if (mio !== pedido.current) return;
      setData(d);
      setFallo(false);
    } catch {
      if (mio !== pedido.current) return;
      setFallo(true);
    } finally {
      if (mio === pedido.current) setCargando(false);
    }
  }, []);

  // Carga inicial y refresco automático cada 2 minutos (sin spinner: no hace falta que parpadee).
  useEffect(() => {
    let vivo = true;
    const tick = () => {
      const mio = ++pedido.current;
      pedirPizarra(false)
        .then(d => { if (vivo && mio === pedido.current) { setData(d); setFallo(false); setCargando(false); } })
        .catch(() => { if (vivo && mio === pedido.current) { setFallo(true); setCargando(false); } });
    };
    tick();
    const id = setInterval(() => { if (!document.hidden) tick(); }, REFRESCO_MS);
    return () => { vivo = false; clearInterval(id); };
  }, []);

  const marcarHecha = async (t: ItemTarea) => {
    const k = `${t.tareaId}_${t.periodo}`;
    if (marcando.has(k)) return;
    setMarcando(s => new Set(s).add(k));
    setAviso('');
    // Optimista: la tarea sale de la lista y los contadores bajan al instante.
    setData(d => {
      if (!d) return d;
      const venc = t.estado === 'VENCIDO';
      const tareas: ColTareas = {
        ...d.tareas,
        items: d.tareas.items.filter(x => !(x.tareaId === t.tareaId && x.periodo === t.periodo)),
        total: d.tareas.total - 1,
        vencidas: d.tareas.vencidas - (venc ? 1 : 0), proximas: d.tareas.proximas - (venc ? 0 : 1),
        urgentes: d.tareas.urgentes - (venc ? 1 : 0), pendientes: d.tareas.pendientes - (venc ? 0 : 1),
      };
      return { ...d, tareas, resumen: { ...d.resumen, urgentes: d.resumen.urgentes - (venc ? 1 : 0), pendientes: d.resumen.pendientes - (venc ? 0 : 1) } };
    });
    try {
      await api.post(`/api/agenda-admin/tareas/${t.tareaId}/hecho`, { periodo: t.periodo, hecho: true });
    } catch {
      setAviso(`No se pudo marcar "${t.titulo}" como hecha. Volvió a la lista.`);
    } finally {
      setMarcando(s => { const n = new Set(s); n.delete(k); return n; });
      cargar();       // re-sincroniza: si falló, la tarea vuelve; si salió bien, aparece lo que la reemplaza
    }
  };

  /* — Estados de carga y error: nunca rompen el resto del Inicio — */
  if (!data) {
    return (
      <section className="card pizarra" aria-busy={cargando}>
        <h2 className="pizarra-titulo">Pizarra</h2>
        {cargando ? (
          <p className="pizarra-cargando"><span className="spinner" /> Cargando pendientes…</p>
        ) : (
          <div className="pizarra-cargando">
            <span>No se pudo cargar la pizarra.</span>
            <button className="btn btn-secondary" onClick={() => cargar(true, true)}>Reintentar</button>
          </div>
        )}
      </section>
    );
  }

  const { km, tareas, documentacion: docs, correo, comprobantes } = data;
  const { urgentes, pendientes } = data.resumen;
  const kmHayAlgo = !km.error && !km.sinChoferes && ((km.hoy?.faltan.length ?? 0) > 0 || (km.anterior?.faltan.length ?? 0) > 0);
  const docsHayAlgo = !docs.error && (docs.vencimientos.items.length > 0 || docs.pacientes.items.length > 0);

  return (
    <section className="card pizarra" aria-labelledby="pizarra-titulo" aria-busy={cargando}>
      <div className="pizarra-head">
        <div>
          <h2 className="pizarra-titulo" id="pizarra-titulo">Pizarra</h2>
          <p className="pizarra-resumen" aria-live="polite">
            {urgentes === 0 && pendientes === 0
              ? <strong className="pz-verde">Todo al día</strong>
              : <>
                  <strong className={urgentes > 0 ? 'pz-rojo' : undefined}>{plural(urgentes, 'urgente', 'urgentes')}</strong>
                  {' · '}
                  <strong className={pendientes > 0 ? 'pz-ambar' : undefined}>{plural(pendientes, 'pendiente', 'pendientes')}</strong>
                </>}
          </p>
        </div>
        <div className="pizarra-acciones">
          <span className="pizarra-hora">Actualizado {horaAR(data.generadoEn)}</span>
          <button className="btn btn-secondary" onClick={() => cargar(true, true)} disabled={cargando} style={{ minHeight: 44 }}>
            {cargando ? <span className="spinner" /> : null} Actualizar
          </button>
        </div>
      </div>

      {(fallo || aviso) && <p className="pizarra-aviso" role="status">{aviso || 'No se pudo actualizar. Se muestran los últimos datos.'}</p>}

      <div className="pizarra-grid">
        {/* 1 · Km de choferes */}
        <Columna titulo="Km de choferes" col={km} hayAlgo={kmHayAlgo}
          vacio={km.sinChoferes ? 'No hay choferes activos cargados.' : 'Todo al día'}
          pie={<Link className="pizarra-link" href="/dashboard/reportes-km">Abrir Reportes KM</Link>}>
          {km.anterior && km.anterior.faltan.length > 0 && (
            <>
              <p className="pizarra-sub">{km.anterior.esAyer ? 'Ayer' : mayus(km.anterior.diaSemana)} {km.anterior.fecha.slice(0, 5)}, sin cerrar</p>
              <ul className="pizarra-lista">
                {km.anterior.faltan.map(f => (
                  <li className="pizarra-item" key={`a-${f.email || f.nombre}`}>
                    <div className="pizarra-item-main">
                      <p className="pizarra-item-titulo">{f.nombre}</p>
                      <p className="pizarra-item-sub">{f.motivo === 'SIN_KM_FINAL' ? 'Cargó el inicial, falta el final' : 'No cargó nada'}{f.vehiculo ? ` · ${f.vehiculo}` : ''}</p>
                    </div>
                    <span className="badge badge-red">Sin cargar</span>
                  </li>
                ))}
              </ul>
              {km.anterior.faltanTotal > km.anterior.faltan.length && <p className="pizarra-mas">y {km.anterior.faltanTotal - km.anterior.faltan.length} más</p>}
            </>
          )}
          {km.hoy && km.hoy.faltan.length > 0 && (
            <>
              <p className="pizarra-sub">Hoy</p>
              <ul className="pizarra-lista">
                {km.hoy.faltan.map(f => (
                  <li className="pizarra-item" key={`h-${f.email || f.nombre}`}>
                    <div className="pizarra-item-main">
                      <p className="pizarra-item-titulo">{f.nombre}</p>
                      <p className="pizarra-item-sub">Todavía no cargó{f.vehiculo ? ` · ${f.vehiculo}` : ''}</p>
                    </div>
                    <span className="badge badge-amber">Pendiente</span>
                  </li>
                ))}
              </ul>
              {km.hoy.faltanTotal > km.hoy.faltan.length && <p className="pizarra-mas">y {km.hoy.faltanTotal - km.hoy.faltan.length} más</p>}
            </>
          )}
        </Columna>

        {/* 2 · Administración (agenda) */}
        <Columna titulo="Administración" col={tareas} hayAlgo={tareas.items.length > 0}
          vacio={tareas.configuradas === 0 ? 'Todavía no hay tareas en la agenda.' : 'Todo al día'}
          pie={<Link className="pizarra-link" href="/dashboard/panel-admin">Abrir Panel administrativo</Link>}>
          <ul className="pizarra-lista">
            {tareas.items.map(t => {
              const k = `${t.tareaId}_${t.periodo}`;
              return (
                <li className="pizarra-item" key={k}>
                  <button className="pizarra-check" onClick={() => marcarHecha(t)} disabled={marcando.has(k)} aria-label={`Marcar como hecha: ${t.titulo}`} title="Marcar como hecha">
                    <span aria-hidden="true">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6.5l2.5 2.5L10 3.5" /></svg>
                    </span>
                  </button>
                  <div className="pizarra-item-main">
                    <p className="pizarra-item-titulo">{t.titulo}</p>
                    <p className="pizarra-item-sub">{textoVence(t.diffDias)}{t.fecha ? ` · ${t.fecha}` : ''}{t.obraSocial ? ` · ${t.obraSocial}` : ''}</p>
                  </div>
                  <span className={badgeDe(t.nivel)}>{t.nivel === 'ALTA' ? 'Vencida' : 'Próxima'}</span>
                </li>
              );
            })}
          </ul>
          {tareas.total > tareas.items.length && <p className="pizarra-mas">y {tareas.total - tareas.items.length} más en el panel</p>}
        </Columna>

        {/* 3 · Documentación */}
        <Columna titulo="Documentación" col={docs} hayAlgo={docsHayAlgo}
          pie={<>
            <Link className="pizarra-link" href="/dashboard/vencimientos">Vencimientos</Link>
            <Link className="pizarra-link" href="/dashboard/legajos">Legajos</Link>
          </>}>
          {!docs.error && docs.vencimientos.items.length > 0 && (
            <>
              <p className="pizarra-sub">Vencimientos</p>
              <ul className="pizarra-lista">
                {docs.vencimientos.items.map(v => (
                  <li className="pizarra-item" key={v.id}>
                    <div className="pizarra-item-main">
                      <p className="pizarra-item-titulo">{v.descripcion || v.tipo}</p>
                      <p className="pizarra-item-sub">{textoVence(v.diffDias)}{v.fechaVenc ? ` · ${v.fechaVenc}` : ''}{v.persona ? ` · ${v.persona}` : ''}</p>
                    </div>
                    <span className={badgeDe(v.nivel)}>{v.nivel === 'ALTA' ? 'Vencido' : 'Próximo'}</span>
                  </li>
                ))}
              </ul>
              {docs.vencimientos.total > docs.vencimientos.items.length && <p className="pizarra-mas">y {docs.vencimientos.total - docs.vencimientos.items.length} más</p>}
            </>
          )}
          {!docs.error && docs.pacientes.items.length > 0 && (
            <>
              <p className="pizarra-sub">Legajos de pacientes</p>
              <ul className="pizarra-lista">
                {docs.pacientes.items.map(p => {
                  const partes = [
                    p.vencidos > 0 ? plural(p.vencidos, 'vencido', 'vencidos') : '',
                    p.faltantes > 0 ? plural(p.faltantes, 'faltante', 'faltantes') : '',
                    p.porVencer > 0 ? `${p.porVencer} por vencer` : '',
                  ].filter(Boolean).join(' · ');
                  return (
                    <li className="pizarra-item" key={p.beneficiarioId || p.beneficiario}>
                      <div className="pizarra-item-main">
                        <p className="pizarra-item-titulo">{p.beneficiario}</p>
                        <p className="pizarra-item-sub">{partes}{p.obraSocial ? ` · ${p.obraSocial}` : ''}</p>
                      </div>
                      <span className={badgeDe(p.nivel)}>{p.nivel === 'ALTA' ? 'Vencido' : 'Falta'}</span>
                    </li>
                  );
                })}
              </ul>
              {docs.pacientes.total > docs.pacientes.items.length && <p className="pizarra-mas">y {docs.pacientes.total - docs.pacientes.items.length} pacientes más</p>}
            </>
          )}
        </Columna>

        {/* 4 · Correo (la columna no existe si la casilla no está conectada) */}
        {(correo.conectado || correo.error) && (
          <Columna titulo="Correo" col={correo} hayAlgo={(correo.items?.length ?? 0) > 0 || !!correo.alerta}
            pie={<Link className="pizarra-link" href="/dashboard/correo">Abrir Correo</Link>}>
            {correo.alerta && (
              <p className={`pizarra-banner${correo.alerta.tipo === 'RECONEXION' ? ' pz-rojo' : ''}`}>{correo.alerta.mensaje}</p>
            )}
            <ul className="pizarra-lista">
              {(correo.items ?? []).map(m => (
                <li className="pizarra-item" key={m.id}>
                  <div className="pizarra-item-main">
                    <p className="pizarra-item-titulo">{m.asunto || '(sin asunto)'}</p>
                    <p className="pizarra-item-sub">{m.accion ? `${m.accion} · ` : ''}{m.deNombre}{m.pacienteNombre ? ` · ${m.pacienteNombre}` : ''}</p>
                  </div>
                  <span className={badgeDe(m.nivel)}>{m.urgencia === 'ALTA' ? 'Urgente' : 'Acción'}</span>
                </li>
              ))}
            </ul>
            {(correo.total ?? 0) > (correo.items?.length ?? 0) && <p className="pizarra-mas">y {(correo.total ?? 0) - (correo.items?.length ?? 0)} más</p>}
          </Columna>
        )}

        {/* 5 · Comprobantes sin foto */}
        <Columna titulo="Comprobantes" col={comprobantes} hayAlgo={comprobantes.items.length > 0}
          vacio="Todo al día: los últimos 7 días tienen foto."
          pie={<>
            <Link className="pizarra-link" href="/dashboard/remitos">Remitos</Link>
            <Link className="pizarra-link" href="/dashboard/egresos">Egresos</Link>
          </>}>
          <p className="pizarra-sub">Sin foto, últimos 7 días</p>
          <ul className="pizarra-lista">
            {comprobantes.items.map(c => (
              <li className="pizarra-item" key={`${c.tipo}-${c.id}`}>
                <div className="pizarra-item-main">
                  <p className="pizarra-item-titulo">{c.detalle}</p>
                  <p className="pizarra-item-sub">{c.fecha}{c.chofer ? ` · ${c.chofer}` : ''}</p>
                </div>
                <span className="badge badge-amber">{c.tipo === 'REMITO' ? 'Remito' : 'Egreso'}</span>
              </li>
            ))}
          </ul>
          {comprobantes.total > comprobantes.items.length && <p className="pizarra-mas">y {comprobantes.total - comprobantes.items.length} más</p>}
        </Columna>
      </div>
    </section>
  );
}
