'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import Link from 'next/link';
import {
  IconCheck, IconCircleCheck, IconClipboardCheck, IconFiles, IconMail, IconReceipt, IconRefresh, IconRoute,
} from '@tabler/icons-react';
import api from '@/lib/api';

/* ─── Tipos (respuesta de GET /api/agenda-admin/pizarra) ─────────────── */

type Nivel = 'ALTA' | 'MEDIA';
interface Base { urgentes: number; pendientes: number; error?: boolean; mensaje?: string; }

interface FaltaKm { nombre: string; email: string; vehiculo: string; motivo: 'SIN_REPORTE' | 'SIN_KM_FINAL'; }
interface DiaKm { fecha: string; diaSemana: string; esAyer?: boolean; faltan: FaltaKm[]; faltanTotal: number; }
interface ColKm extends Base { sinChoferes: boolean; hoy: DiaKm | null; anterior: DiaKm | null; }

interface ItemTarea { tareaId: string; titulo: string; obraSocial?: string; periodo: string; fecha: string; estado: string; diffDias: number | null; nivel: Nivel; }
interface ItemPresupuesto { id: string; numeroTexto: string; beneficiario: string; obraSocial: string; fechaEmision: string; diasSinRespuesta: number; nivel: Nivel; }
interface ColTareas extends Base { configuradas: number; items: ItemTarea[]; total: number; vencidas: number; proximas: number; presupuestos?: { dias: number; total: number; items: ItemPresupuesto[] }; }

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

/** Clase de color de urgencia de una tarjetita y de su etiqueta (siempre va acompañada de texto). */
const urgencia = (nivel: Nivel) => (nivel === 'ALTA' ? 'alta' : 'media');

/** Lo urgente primero. Es un orden estable: dentro de cada grupo queda el orden que mandó el servidor. */
const urgentesPrimero = <T extends { nivel: Nivel }>(items: T[]): T[] =>
  [...items].sort((a, b) => Number(b.nivel === 'ALTA') - Number(a.nivel === 'ALTA'));

function horaAR(iso: string): string {
  try { return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Tucuman' }); }
  catch { return ''; }
}

const pedirPizarra = (refrescar: boolean) =>
  api.get('/api/agenda-admin/pizarra', { params: refrescar ? { refrescar: 1 } : undefined }).then(r => r.data as Pizarra);

/* ─── Piezas del contorno (todo CSS/SVG, sin imágenes externas) ───────── */

/** Bandeja de la pizarra con cuatro marcadores y un borrador. Es decoración: va oculta a lectores de pantalla. */
function Bandeja() {
  const marcador = (x: number, giro: number, color: string) => (
    <g transform={`translate(${x} 20) rotate(${giro} 32 6)`}>
      <rect x="-6" y="3" width="9" height="6" rx="2" fill="#2a2f3a" />
      <rect width="64" height="12" rx="5" fill={color} />
      <rect x="16" width="24" height="12" fill="#ffffff" opacity=".88" />
      <rect x="46" y="-1" width="20" height="14" rx="4" fill={color} />
      <rect x="46" y="-1" width="20" height="14" rx="4" fill="#000" opacity=".28" />
      <rect x="4" y="2" width="56" height="2" rx="1" fill="#ffffff" opacity=".4" />
    </g>
  );
  return (
    <div className="pz-bandeja" aria-hidden="true">
      <svg className="pz-bandeja-items" viewBox="0 0 420 36" preserveAspectRatio="xMidYMax meet" focusable="false">
        {marcador(18, -2, '#2563eb')}
        {marcador(98, 1.5, '#dc2626')}
        {marcador(178, -1, '#16a34a')}
        {marcador(258, 2, '#1f2937')}
        {/* borrador: base de fieltro oscura y cuerpo claro */}
        <g transform="translate(346 15) rotate(-1 28 10)">
          <rect y="9" width="56" height="12" rx="3" fill="#2b2f3a" />
          <rect width="56" height="14" rx="4" fill="#e6e9ef" />
          <rect x="4" y="3" width="48" height="2" rx="1" fill="#ffffff" opacity=".7" />
          <rect x="8" y="8" width="40" height="3" rx="1.5" fill="#6d7ae0" opacity=".85" />
        </g>
      </svg>
    </div>
  );
}

/** Marco de aluminio + superficie blanca con los cuatro tornillos. Lo usan el estado de carga y el normal. */
function Marco({ children, ocupado, raizRef }: { children: ReactNode; ocupado: boolean; raizRef: RefObject<HTMLElement | null> }) {
  return (
    <section className="pizarra" aria-labelledby="pizarra-titulo" aria-busy={ocupado} ref={raizRef}>
      <div className="pz-marco">
        <span className="pz-tornillo pz-tornillo--a" aria-hidden="true" />
        <span className="pz-tornillo pz-tornillo--b" aria-hidden="true" />
        <span className="pz-tornillo pz-tornillo--c" aria-hidden="true" />
        <span className="pz-tornillo pz-tornillo--d" aria-hidden="true" />
        <div className="pz-superficie">{children}</div>
      </div>
      <Bandeja />
    </section>
  );
}

/* ─── Mosaico (una columna de la pizarra) ────────────────────────────── */

function Mosaico({ clase, titulo, icono, col, hayAlgo, vacio, children, pie }: {
  clase: 'km' | 'adm' | 'doc' | 'cor' | 'com'; titulo: string; icono: ReactNode; col: Base; hayAlgo: boolean;
  vacio?: string; children: ReactNode; pie?: ReactNode;
}) {
  const total = col.urgentes + col.pendientes;
  const estado = total === 0 ? 'ok' : col.urgentes > 0 ? 'alta' : 'media';
  const idTitulo = `pz-h-${clase}`;
  const leyenda = total === 0 ? 'Al día' : `${plural(total, 'pendiente', 'pendientes')}, ${plural(col.urgentes, 'urgente', 'urgentes')}`;

  // El cuerpo scrollea por su cuenta cuando no entra. Si desborda, se vuelve alcanzable con el teclado
  // (tabindex + nombre); si no, no suma una parada de tabulación inútil. Se toca el DOM directo y no el
  // estado para no encadenar renders desde un efecto.
  const cuerpoRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = cuerpoRef.current;
    if (!el) return;
    const revisar = () => {
      if (el.scrollHeight > el.clientHeight + 1) {
        el.setAttribute('tabindex', '0');
        el.setAttribute('role', 'region');
        el.setAttribute('aria-label', `${titulo}: lista con desplazamiento`);
      } else {
        el.removeAttribute('tabindex');
        el.removeAttribute('role');
        el.removeAttribute('aria-label');
      }
    };
    revisar();
    const ro = new ResizeObserver(revisar);
    ro.observe(el);
    return () => ro.disconnect();
  });

  return (
    <section className={`pz-mosaico pz-t-${clase}`} aria-labelledby={idTitulo}>
      <div className="pz-mosaico-cab">
        <span className="pz-icono" aria-hidden="true">{icono}</span>
        <h3 className="pz-mosaico-titulo" id={idTitulo}>{titulo}</h3>
        {!col.error && (
          <span className={`pz-contador pz-contador--${estado}`} title={leyenda}>
            <span aria-hidden="true">{total === 0 ? 'Al día' : total}</span>
            <span className="pz-solo-lector">{leyenda}</span>
          </span>
        )}
      </div>
      <div className="pz-cuerpo" ref={cuerpoRef}>
        {col.error ? (
          <p className="pz-error">{col.mensaje || 'No se pudo cargar esta sección.'} Probá actualizar en un momento.</p>
        ) : !hayAlgo ? (
          <p className="pz-vacio"><IconCircleCheck size={20} stroke={2} aria-hidden="true" /> {vacio || 'Todo al día'}</p>
        ) : children}
      </div>
      {pie && <div className="pz-pie">{pie}</div>}
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
  const raizRef = useRef<HTMLElement>(null);
  const tableroRef = useRef<HTMLDivElement>(null);
  const hayDatos = data !== null;

  // Cuánto alto le queda a la pizarra: se mide dónde arranca el tablero (cabecera, chips y barra de datos
  // pueden cambiar de alto) y se lo pasa al CSS como variable. El CSS le resta lo de abajo y limita cada
  // mosaico a lo que cabe en pantalla. Se escribe directo en el DOM: no hay render ni estado de por medio.
  useEffect(() => {
    const raiz = raizRef.current;
    const tablero = tableroRef.current;
    if (!raiz || !tablero) return;
    const medir = () => {
      const arriba = tablero.getBoundingClientRect().top + window.scrollY;
      raiz.style.setProperty('--pz-arriba', `${Math.round(arriba)}px`);
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(document.body);
    window.addEventListener('resize', medir);
    return () => { ro.disconnect(); window.removeEventListener('resize', medir); };
  }, [hayDatos]);

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
      <Marco ocupado={cargando} raizRef={raizRef}>
        <h2 className="pz-titulo" id="pizarra-titulo">Pizarra</h2>
        {cargando ? (
          <p className="pz-cargando"><span className="spinner" /> Cargando pendientes…</p>
        ) : (
          <div className="pz-cargando">
            <span>No se pudo cargar la pizarra.</span>
            <button className="pz-btn" onClick={() => cargar(true, true)}>Reintentar</button>
          </div>
        )}
      </Marco>
    );
  }

  const { km, tareas, documentacion: docs, correo, comprobantes } = data;
  const { urgentes, pendientes } = data.resumen;
  const kmHayAlgo = !km.error && !km.sinChoferes && ((km.hoy?.faltan.length ?? 0) > 0 || (km.anterior?.faltan.length ?? 0) > 0);
  const docsHayAlgo = !docs.error && (docs.vencimientos.items.length > 0 || docs.pacientes.items.length > 0);
  const hayCorreo = correo.conectado || !!correo.error;   // la columna no existe si la casilla no está conectada

  // Lo más urgente arriba de cada lista; en Documentación, además, primero la sección que tiene algo vencido.
  const itemsTareas = urgentesPrimero(tareas.items);
  const presup = tareas.presupuestos ?? { dias: 7, total: 0, items: [] };   // presupuestos emitidos sin respuesta (sin datos clínicos)
  const itemsVenc = urgentesPrimero(docs.vencimientos.items);
  const itemsPac = urgentesPrimero(docs.pacientes.items);
  const itemsMail = urgentesPrimero(correo.items ?? []);
  const pacientesPrimero = !itemsVenc.some(v => v.nivel === 'ALTA') && itemsPac.some(p => p.nivel === 'ALTA');

  const seccionVencimientos = !docs.error && itemsVenc.length > 0 && (
    <>
      <p className="pz-sub">Vencimientos</p>
      <ul className="pz-lista">
        {itemsVenc.map(v => (
          <li className={`pz-item pz-item--${urgencia(v.nivel)}`} key={v.id}>
            <div className="pz-item-main">
              <p className="pz-item-titulo">{v.descripcion || v.tipo}</p>
              <p className="pz-item-sub">{textoVence(v.diffDias)}{v.fechaVenc ? ` · ${v.fechaVenc}` : ''}{v.persona ? ` · ${v.persona}` : ''}</p>
            </div>
            <span className={`pz-etiqueta pz-etiqueta--${urgencia(v.nivel)}`}>{v.nivel === 'ALTA' ? 'Vencido' : 'Próximo'}</span>
          </li>
        ))}
      </ul>
      {docs.vencimientos.total > itemsVenc.length && <p className="pz-mas">y {docs.vencimientos.total - itemsVenc.length} más</p>}
    </>
  );
  const seccionPacientes = !docs.error && itemsPac.length > 0 && (
    <>
      <p className="pz-sub">Legajos de pacientes</p>
      <ul className="pz-lista">
        {itemsPac.map(p => {
          const partes = [
            p.vencidos > 0 ? plural(p.vencidos, 'vencido', 'vencidos') : '',
            p.faltantes > 0 ? plural(p.faltantes, 'faltante', 'faltantes') : '',
            p.porVencer > 0 ? `${p.porVencer} por vencer` : '',
          ].filter(Boolean).join(' · ');
          return (
            <li className={`pz-item pz-item--${urgencia(p.nivel)}`} key={p.beneficiarioId || p.beneficiario}>
              <div className="pz-item-main">
                <p className="pz-item-titulo">{p.beneficiario}</p>
                <p className="pz-item-sub">{partes}{p.obraSocial ? ` · ${p.obraSocial}` : ''}</p>
              </div>
              <span className={`pz-etiqueta pz-etiqueta--${urgencia(p.nivel)}`}>{p.nivel === 'ALTA' ? 'Vencido' : 'Falta'}</span>
            </li>
          );
        })}
      </ul>
      {docs.pacientes.total > itemsPac.length && <p className="pz-mas">y {docs.pacientes.total - itemsPac.length} pacientes más</p>}
    </>
  );

  return (
    <Marco ocupado={cargando} raizRef={raizRef}>
      <header className="pz-cabecera">
        <div className="pz-cab-izq">
          <h2 className="pz-titulo" id="pizarra-titulo">Pizarra</h2>
          <p className="pz-resumen" aria-live="polite">
            {urgentes === 0 && pendientes === 0
              ? <strong className="pz-verde">Todo al día</strong>
              : <>
                  <strong className={urgentes > 0 ? 'pz-rojo' : undefined}>{plural(urgentes, 'urgente', 'urgentes')}</strong>
                  {' · '}
                  <strong className={pendientes > 0 ? 'pz-ambar' : undefined}>{plural(pendientes, 'pendiente', 'pendientes')}</strong>
                </>}
          </p>
        </div>
        <div className="pz-acciones">
          <span className="pz-hora">Actualizado {horaAR(data.generadoEn)}</span>
          <button className="pz-btn" onClick={() => cargar(true, true)} disabled={cargando}>
            {cargando ? <span className="spinner" /> : <IconRefresh size={18} stroke={2} aria-hidden="true" />} Actualizar
          </button>
        </div>
      </header>

      {(fallo || aviso) && <p className="pz-aviso" role="status">{aviso || 'No se pudo actualizar. Se muestran los últimos datos.'}</p>}

      <div className={`pz-tablero${hayCorreo ? '' : ' pz-sin-correo'}`} ref={tableroRef}>
        {/* 1 · Km de choferes */}
        <Mosaico clase="km" titulo="Km de choferes" icono={<IconRoute size={18} stroke={2} />} col={km} hayAlgo={kmHayAlgo}
          vacio={km.sinChoferes ? 'No hay choferes activos cargados.' : 'Todo al día'}
          pie={<Link className="pz-link" href="/dashboard/reportes-km">Abrir Reportes KM</Link>}>
          {km.anterior && km.anterior.faltan.length > 0 && (
            <>
              <p className="pz-sub">{km.anterior.esAyer ? 'Ayer' : mayus(km.anterior.diaSemana)} {km.anterior.fecha.slice(0, 5)}, sin cerrar</p>
              <ul className="pz-lista">
                {km.anterior.faltan.map(f => (
                  <li className="pz-item pz-item--alta" key={`a-${f.email || f.nombre}`}>
                    <div className="pz-item-main">
                      <p className="pz-item-titulo">{f.nombre}</p>
                      <p className="pz-item-sub">{f.motivo === 'SIN_KM_FINAL' ? 'Cargó el inicial, falta el final' : 'No cargó nada'}{f.vehiculo ? ` · ${f.vehiculo}` : ''}</p>
                    </div>
                    <span className="pz-etiqueta pz-etiqueta--alta">Sin cargar</span>
                  </li>
                ))}
              </ul>
              {km.anterior.faltanTotal > km.anterior.faltan.length && <p className="pz-mas">y {km.anterior.faltanTotal - km.anterior.faltan.length} más</p>}
            </>
          )}
          {km.hoy && km.hoy.faltan.length > 0 && (
            <>
              <p className="pz-sub">Hoy</p>
              <ul className="pz-lista">
                {km.hoy.faltan.map(f => (
                  <li className="pz-item pz-item--media" key={`h-${f.email || f.nombre}`}>
                    <div className="pz-item-main">
                      <p className="pz-item-titulo">{f.nombre}</p>
                      <p className="pz-item-sub">Todavía no cargó{f.vehiculo ? ` · ${f.vehiculo}` : ''}</p>
                    </div>
                    <span className="pz-etiqueta pz-etiqueta--media">Pendiente</span>
                  </li>
                ))}
              </ul>
              {km.hoy.faltanTotal > km.hoy.faltan.length && <p className="pz-mas">y {km.hoy.faltanTotal - km.hoy.faltan.length} más</p>}
            </>
          )}
        </Mosaico>

        {/* 2 · Administración (agenda) */}
        <Mosaico clase="adm" titulo="Administración" icono={<IconClipboardCheck size={18} stroke={2} />} col={tareas} hayAlgo={itemsTareas.length > 0 || presup.items.length > 0}
          vacio={tareas.configuradas === 0 ? 'Todavía no hay tareas en la agenda.' : 'Todo al día'}
          pie={<>
            <Link className="pz-link" href="/dashboard/panel-admin">Abrir Panel administrativo</Link>
            {presup.total > 0 && <Link className="pz-link" href="/dashboard/presupuestos">Presupuestos</Link>}
          </>}>
          <ul className="pz-lista">
            {itemsTareas.map(t => {
              const k = `${t.tareaId}_${t.periodo}`;
              return (
                <li className={`pz-item pz-item--${urgencia(t.nivel)}`} key={k}>
                  <button type="button" className="pz-check" onClick={() => marcarHecha(t)} disabled={marcando.has(k)} aria-label={`Marcar como hecha: ${t.titulo}`} title="Marcar como hecha">
                    <span aria-hidden="true"><IconCheck size={14} stroke={3} /></span>
                  </button>
                  <div className="pz-item-main">
                    <p className="pz-item-titulo">{t.titulo}</p>
                    <p className="pz-item-sub">{textoVence(t.diffDias)}{t.fecha ? ` · ${t.fecha}` : ''}{t.obraSocial ? ` · ${t.obraSocial}` : ''}</p>
                  </div>
                  <span className={`pz-etiqueta pz-etiqueta--${urgencia(t.nivel)}`}>{t.nivel === 'ALTA' ? 'Vencida' : 'Próxima'}</span>
                </li>
              );
            })}
          </ul>
          {tareas.total > itemsTareas.length && <p className="pz-mas">y {tareas.total - itemsTareas.length} más en el panel</p>}
          {presup.items.length > 0 && (
            <>
              <p className="pz-sub">Presupuestos sin respuesta (más de {presup.dias} días)</p>
              <ul className="pz-lista">
                {presup.items.map(p => (
                  <li className="pz-item pz-item--media" key={p.id}>
                    <div className="pz-item-main">
                      <p className="pz-item-titulo">Presupuesto N° {p.numeroTexto}{p.beneficiario ? ` · ${p.beneficiario}` : ''}</p>
                      <p className="pz-item-sub">{p.obraSocial}{p.obraSocial ? ' · ' : ''}emitido {p.fechaEmision} · hace {p.diasSinRespuesta} días</p>
                    </div>
                    <span className="pz-etiqueta pz-etiqueta--media">Sin respuesta</span>
                  </li>
                ))}
              </ul>
              {presup.total > presup.items.length && <p className="pz-mas">y {presup.total - presup.items.length} más</p>}
            </>
          )}
        </Mosaico>

        {/* 3 · Documentación */}
        <Mosaico clase="doc" titulo="Documentación" icono={<IconFiles size={18} stroke={2} />} col={docs} hayAlgo={docsHayAlgo}
          pie={<>
            <Link className="pz-link" href="/dashboard/vencimientos">Vencimientos</Link>
            <Link className="pz-link" href="/dashboard/legajos">Legajos</Link>
          </>}>
          {pacientesPrimero ? <>{seccionPacientes}{seccionVencimientos}</> : <>{seccionVencimientos}{seccionPacientes}</>}
        </Mosaico>

        {/* 4 · Correo (la columna no existe si la casilla no está conectada) */}
        {hayCorreo && (
          <Mosaico clase="cor" titulo="Correo" icono={<IconMail size={18} stroke={2} />} col={correo} hayAlgo={itemsMail.length > 0 || !!correo.alerta}
            pie={<Link className="pz-link" href="/dashboard/correo">Abrir Correo</Link>}>
            {correo.alerta && (
              <p className={`pz-banner${correo.alerta.tipo === 'RECONEXION' ? ' pz-banner--alta' : ''}`}>{correo.alerta.mensaje}</p>
            )}
            <ul className="pz-lista">
              {itemsMail.map(m => (
                <li className={`pz-item pz-item--${urgencia(m.nivel)}`} key={m.id}>
                  <div className="pz-item-main">
                    <p className="pz-item-titulo">{m.asunto || '(sin asunto)'}</p>
                    <p className="pz-item-sub">{m.accion ? `${m.accion} · ` : ''}{m.deNombre}{m.pacienteNombre ? ` · ${m.pacienteNombre}` : ''}</p>
                  </div>
                  <span className={`pz-etiqueta pz-etiqueta--${urgencia(m.nivel)}`}>{m.urgencia === 'ALTA' ? 'Urgente' : 'Acción'}</span>
                </li>
              ))}
            </ul>
            {(correo.total ?? 0) > itemsMail.length && <p className="pz-mas">y {(correo.total ?? 0) - itemsMail.length} más</p>}
          </Mosaico>
        )}

        {/* 5 · Comprobantes sin foto */}
        <Mosaico clase="com" titulo="Comprobantes" icono={<IconReceipt size={18} stroke={2} />} col={comprobantes} hayAlgo={comprobantes.items.length > 0}
          vacio="Todo al día: los últimos 7 días tienen foto."
          pie={<>
            <Link className="pz-link" href="/dashboard/remitos">Remitos</Link>
            <Link className="pz-link" href="/dashboard/egresos">Egresos</Link>
          </>}>
          <p className="pz-sub">Sin foto, últimos 7 días</p>
          <ul className="pz-lista">
            {comprobantes.items.map(c => (
              <li className="pz-item pz-item--media" key={`${c.tipo}-${c.id}`}>
                <div className="pz-item-main">
                  <p className="pz-item-titulo">{c.detalle}</p>
                  <p className="pz-item-sub">{c.fecha}{c.chofer ? ` · ${c.chofer}` : ''}</p>
                </div>
                <span className="pz-etiqueta pz-etiqueta--media">{c.tipo === 'REMITO' ? 'Remito' : 'Egreso'}</span>
              </li>
            ))}
          </ul>
          {comprobantes.total > comprobantes.items.length && <p className="pz-mas">y {comprobantes.total - comprobantes.items.length} más</p>}
        </Mosaico>
      </div>
    </Marco>
  );
}
