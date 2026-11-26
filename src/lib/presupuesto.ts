// Presupuestos de transporte: tipos, formato es-AR y helpers puros del asistente. Lo que toca el navegador (archivos,
// PDF) está en otros módulos; esto se prueba en tests/.

export type Formato = 'traslados_programados' | 'multi_viaje';
export type Modalidad = 'solo_ida' | 'ida_vuelta_total' | 'dos_recorridos';
export type Estado = 'BORRADOR' | 'EMITIDO' | 'ACEPTADO' | 'RECHAZADO' | 'ANULADO';
export type Confianza = 'alta' | 'media' | 'baja';
export type UnidadTramoCorto = 'sentido' | 'viaje' | 'dia';

export const DIAS = [
  { k: 'lunes', label: 'Lunes', corto: 'L' }, { k: 'martes', label: 'Martes', corto: 'M' }, { k: 'miercoles', label: 'Miércoles', corto: 'X' },
  { k: 'jueves', label: 'Jueves', corto: 'J' }, { k: 'viernes', label: 'Viernes', corto: 'V' }, { k: 'sabado', label: 'Sábado', corto: 'S' },
] as const;
export const MODALIDADES: { k: Modalidad; label: string; ayuda: string }[] = [
  { k: 'ida_vuelta_total', label: 'Ida y vuelta (total)', ayuda: 'Los km son el total del recorrido de ida y vuelta. No se duplican.' },
  { k: 'solo_ida', label: 'Solo ida', ayuda: 'Los km son de un solo sentido (la vuelta se carga como otro viaje, o marcá "incluye la vuelta").' },
  { k: 'dos_recorridos', label: 'Dos recorridos separados', ayuda: 'Un recorrido de ida y otro de vuelta, cada uno con sus km.' },
];
export const UNIDADES_TRAMO_CORTO: { k: UnidadTramoCorto; label: string }[] = [
  { k: 'sentido', label: 'Por sentido (cada ida y cada vuelta)' }, { k: 'viaje', label: 'Por viaje de ida y vuelta' }, { k: 'dia', label: 'Por día' },
];
export const FORMATOS: { k: Formato; label: string }[] = [
  { k: 'multi_viaje', label: 'Presupuesto transporte (multi-viaje)' }, { k: 'traslados_programados', label: 'Servicio de Traslados Programados (formulario)' },
];

/* ── Formato es-AR ─────────────────────────────────────────────────────── */

/** 1234567.5 → "1.234.567,50". `dec` fija los decimales; sin `dec`, hasta 2 sin ceros de más. */
export function fmt(n: number | string | null | undefined, dec?: number): string {
  const x = Number(n);
  if (n === null || n === undefined || n === '' || !Number.isFinite(x)) return '';
  const [ent, d] = (dec === undefined ? String(Math.round(x * 100) / 100) : x.toFixed(dec)).split('.');
  const miles = ent.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return d ? `${miles},${d}` : miles;
}
export const pesos = (n: number | string | null | undefined) => (n === null || n === undefined || n === '' ? '' : `$${fmt(n, 2)}`);

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
/** "2026-09" → "Septiembre/2026". */
export function periodoLabel(ym?: string): string {
  const m = String(ym || '').match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  return m ? `${MESES[Number(m[2]) - 1]}/${m[1]}` : '';
}
export const mesActual = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/* ── Números que se escriben a mano ────────────────────────────────────── */

/** "12,4" / "12.4" / "12,4 km" → 12.4; NaN si no es un número positivo. */
export function parseKm(t: string | number | undefined): number {
  const s = String(t ?? '').toLowerCase().replace(/km|\s/g, '').replace(',', '.');
  const n = Number(s);
  return s && Number.isFinite(n) && n > 0 ? n : NaN;
}
/** "2,9 + 5,7" → [2.9, 5.7]; null si no hay "+" (un solo valor) o algún tramo es inválido. */
export function parseTramos(t: string): number[] | null {
  if (!t.includes('+')) return null;
  const partes = t.split('+').map(parseKm);
  return partes.length >= 2 && partes.every(Number.isFinite) ? partes : null;
}

/* ── Lecturas de la impresión de Google Maps ───────────────────────────── */

export interface RutaLeida { km: number; tiempo: string; seleccionada: boolean | null; confianza: Confianza }
export interface PropuestaRecorrido {
  legible: boolean; origen: { texto: string; confianza: Confianza }; destino: { texto: string; confianza: Confianza };
  rutas: RutaLeida[]; rutaElegida: number | null; requiereElegir: boolean; modalidadSugerida: Modalidad; confianzaGeneral: Confianza; advertencias: string[];
}
export interface Verificacion { pacienteOk: boolean | null; centroOk: boolean | null; coincide: boolean | null; advertencias: string[] }
export interface LecturaRecorrido {
  hash: string; archivoUrl: string; archivoNombre: string; propuesta: PropuestaRecorrido; verificacion: Verificacion;
  rutaElegida: number | null;           // la que marcó la persona (o la que leyó la IA)
}

/** Km de la ruta elegida de una lectura, o null si falta elegir. */
export const kmDeLectura = (l: LecturaRecorrido | undefined): number | null =>
  l && l.rutaElegida !== null && l.propuesta.rutas[l.rutaElegida] ? l.propuesta.rutas[l.rutaElegida].km : null;

/* ── Viaje en el asistente ─────────────────────────────────────────────── */

export interface ViajeEditable {
  id: string; origen: string; destino: string; centro: string;
  kmTexto: string;                       // km (o suma de tramos: "2,9 + 5,7")
  modalidad: Modalidad; incluyeVuelta: boolean; kmIdaTexto: string; kmVueltaTexto: string;
  dias: string[];
  lecturas: LecturaRecorrido[];          // 0, 1 o 2 impresiones de Google Maps
  kmOrigen: 'impresion' | 'manual';
  confirmadoManual: boolean;             // la persona confirmó un recorrido que no coincide con el paciente/centro
}
const ID_VIAJES = ['1', '2', '2B', '3', '3B', '4', '4B', '5', '5B', '6', '6B', '7'];
export const viajeVacio = (n: number): ViajeEditable => ({
  id: ID_VIAJES[n] || String(n + 1), origen: '', destino: '', centro: '', kmTexto: '', modalidad: 'ida_vuelta_total', incluyeVuelta: false,
  kmIdaTexto: '', kmVueltaTexto: '', dias: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'], lecturas: [], kmOrigen: 'manual', confirmadoManual: false,
});

/** Completa los km del viaje con lo leído de las impresiones, según la modalidad elegida. Nunca duplica un ida y vuelta. */
export function aplicarLecturas(v: ViajeEditable): ViajeEditable {
  const k = v.lecturas.map(kmDeLectura);
  const txt = (x: number | null) => (x === null ? '' : String(x).replace('.', ','));
  if (!v.lecturas.length) return { ...v, kmOrigen: 'manual' };
  const base = { ...v, kmOrigen: 'impresion' as const };
  if (v.modalidad === 'dos_recorridos') return { ...base, kmIdaTexto: txt(k[0] ?? null) || v.kmIdaTexto, kmVueltaTexto: txt(k[1] ?? null) || v.kmVueltaTexto };
  return { ...base, kmTexto: txt(k[0] ?? null) || v.kmTexto };
}

/** Lo que mandan /calcular y los presupuestos: km parseados y mapa con los hashes de respaldo. */
export function viajePayload(v: ViajeEditable) {
  const out: Record<string, unknown> = { id: v.id, origen: v.origen.trim(), destino: v.destino.trim(), centro: v.centro.trim(), modalidad: v.modalidad, incluyeVuelta: v.incluyeVuelta, dias: v.dias };
  if (v.modalidad === 'dos_recorridos') { out.kmIda = parseKm(v.kmIdaTexto); out.kmVuelta = parseKm(v.kmVueltaTexto); }
  else { const t = parseTramos(v.kmTexto); if (t) out.tramos = t; else out.km = parseKm(v.kmTexto); }
  if (v.lecturas.length) {
    out.mapa = {
      hashes: v.lecturas.map(l => l.hash), origen: v.kmOrigen,
      confianza: v.lecturas.map(l => l.propuesta.confianzaGeneral).reduce((m, c) => (c === 'baja' || m === 'baja' ? 'baja' : c === 'media' || m === 'media' ? 'media' : 'alta'), 'alta'),
      coincide: v.lecturas.some(l => l.verificacion.coincide === false) ? false : v.lecturas.some(l => l.verificacion.coincide === true) ? true : null,
      confirmadoManual: v.confirmadoManual,
    };
  }
  return out;
}

/** Qué le falta a un viaje para poder calcularse (mensajes para la persona). */
export function faltantesViaje(v: ViajeEditable): string[] {
  const f: string[] = [];
  if (!v.destino.trim() && !v.centro.trim()) f.push('el destino');
  if (!v.origen.trim()) f.push('el origen');
  if (!v.dias.length) f.push('los días de traslado');
  if (v.modalidad === 'dos_recorridos') { if (!Number.isFinite(parseKm(v.kmIdaTexto))) f.push('los km de la ida'); if (!Number.isFinite(parseKm(v.kmVueltaTexto))) f.push('los km de la vuelta'); }
  else if (!Number.isFinite(parseKm(v.kmTexto.includes('+') ? (parseTramos(v.kmTexto) || [NaN])[0] : v.kmTexto))) f.push('los km');
  if (v.lecturas.some(l => l.propuesta.requiereElegir && l.rutaElegida === null)) f.push('elegir la ruta de la impresión');
  if (v.lecturas.some(l => l.verificacion.coincide === false) && !v.confirmadoManual) f.push('confirmar que el recorrido corresponde a este paciente y centro');
  return f;
}

/* ── Resultado del cálculo (lo devuelve el servidor) ───────────────────── */

export interface FilaCalculo {
  id: string; origen: string; destino: string; tramos: number[] | null; modalidad: Modalidad; sentidos: number[]; diasPorSemana: number; dias: string[] | null;
  kmReales: number; kmFacturables: number; llevadoAlMinimo: boolean; viajesMes: number; kmMes: number; importeDiario: number; importeMensual: number;
}
export interface Calculo {
  valorKm: { base: number; adicional: number; porcentaje: number; aplicado: boolean; final: number }; semanasPorMes: number;
  tramoCorto: { activo: boolean; unidad?: UnidadTramoCorto; kmMinimo?: number; viajesLlevadosAlMinimo?: string[] };
  viajes: FilaCalculo[];
  ajusteDiario: { unidad: 'dia'; minimo: number; dias: { dia: string; kmReales: number; kmFacturables: number }[]; kmMes: number; importeMensual: number } | null;
  kmMensuales: number; total: number;
}
export interface ArancelUsado { id: string; valorKmTransporte: number; resolucion: string; mes: string; vigenteDesde: string; origen: 'obra_social' | 'nomenclador'; verificar: boolean }

/** "Km por viaje" como en el presupuesto en papel: "2,9 km + 5,7 km" si es suma de tramos, o "5,6 km". */
export function kmPorViajeTexto(f: FilaCalculo): string {
  if (f.tramos && f.tramos.length > 1) return f.tramos.map(k => `${fmt(k)} km`).join(' + ');
  return `${fmt(f.kmReales)} km`;
}
/** Texto de los sentidos de un viaje con ida y vuelta ("Ida 9 km · Vuelta 9 km"), o '' si es un solo sentido. */
export function sentidosTexto(f: FilaCalculo): string {
  return f.sentidos.length === 2 ? `Ida ${fmt(f.sentidos[0])} km · Vuelta ${fmt(f.sentidos[1])} km` : '';
}
export const UNIDAD_TEXTO: Record<UnidadTramoCorto, string> = { sentido: 'por sentido', viaje: 'por viaje de ida y vuelta', dia: 'por día' };

/** Estados que se pueden recorrer: para los botones de la pantalla. */
export const ESTADO_UI: Record<Estado, { label: string; badge: string }> = {
  BORRADOR: { label: 'Borrador', badge: 'badge-gray' }, EMITIDO: { label: 'Emitido', badge: 'badge-blue' }, ACEPTADO: { label: 'Aceptado', badge: 'badge-green' },
  RECHAZADO: { label: 'Rechazado', badge: 'badge-red' }, ANULADO: { label: 'Anulado', badge: 'badge-gray' },
};
