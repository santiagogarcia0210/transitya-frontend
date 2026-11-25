/**
 * Fechas de remitos y egresos.
 *
 * El sistema guarda las fechas como dd/MM/yyyy (texto) y así se muestran. Pero el backend puede
 * devolver también ISO (yyyy-MM-dd, lo que manda <input type="date">) en documentos guardados
 * antes del arreglo, o d/M/yyyy (serializarFirestore pasa los Timestamps por toLocaleDateString).
 * Comparar esos textos entre sí no sirve ("05/11/2026" < "2026-11-01" no significa nada), así que
 * todo se lleva a una forma única antes de ordenar, filtrar o mostrar.
 *
 * Es el espejo de utils/fechas.js del backend: mismos formatos aceptados, mismas fechas
 * inválidas. Sin dependencias.
 */

// Misma zona que el backend: un instante (Date, ISO con "Z") se pasa a hora de Argentina antes de
// sacar el día, así un remito cargado de noche no se corre al día siguiente.
const ZONA = 'America/Argentina/Tucuman';
const ANIO_MIN = 1900;
const ANIO_MAX = 2100;

const fmtZona = new Intl.DateTimeFormat('en-US', { timeZone: ZONA, day: '2-digit', month: '2-digit', year: 'numeric' });

interface Partes { d: number; m: number; y: number }

const pad2 = (n: number) => String(n).padStart(2, '0');
const diasEnMes = (anio: number, mes: number) => new Date(Date.UTC(anio, mes, 0)).getUTCDate(); // mes 1-12

/** Día/mes/año si forman una fecha real del calendario; si no, null. */
function armar(dia: unknown, mes: unknown, anio: unknown): Partes | null {
  const d = Number(dia), m = Number(mes), y = Number(anio);
  if (!Number.isInteger(d) || !Number.isInteger(m) || !Number.isInteger(y)) return null;
  if (y < ANIO_MIN || y > ANIO_MAX || m < 1 || m > 12 || d < 1 || d > diasEnMes(y, m)) return null;
  return { d, m, y };
}

/** Un instante → su día en hora de Argentina. */
function desdeInstante(date: Date): Partes | null {
  if (isNaN(date.getTime())) return null;
  const p = Object.fromEntries(fmtZona.formatToParts(date).map(x => [x.type, x.value]));
  return armar(p.day, p.month, p.year);
}

// yyyy-MM-dd, con hora y zona opcionales: "2026-11-05", "2026-11-05T14:30:00.000Z", "2026-11-05 14:30"
const RE_ISO = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2})(?:[.,]\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})?)?$/i;
// d/M/yyyy, dd/MM/yy, con "/", "-" o "." y una hora opcional al final
const RE_DMY = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})(?:[ T,]+\d{1,2}:\d{2}(?::\d{2})?)?$/;

function partes(v: unknown): Partes | null {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return desdeInstante(v);
  if (typeof v === 'object') {
    // Timestamp de Firestore sin serializar: { _seconds, _nanoseconds } o { seconds, nanoseconds }
    const o = v as Record<string, unknown>;
    const seg = Number(o.seconds ?? o._seconds);
    if (o.seconds !== undefined || o._seconds !== undefined) {
      return Number.isFinite(seg) ? desdeInstante(new Date(seg * 1000)) : null;
    }
    return null;
  }
  if (typeof v !== 'string') return null;

  const s = v.trim();
  let m = RE_ISO.exec(s);
  if (m) {
    const [, anio, mes, dia, hora, , , zona] = m;
    // Con hora y zona explícita es un instante: se convierte. Sin zona, es hora local de pared.
    if (hora !== undefined && zona) return desdeInstante(new Date(s.replace(' ', 'T')));
    return armar(dia, mes, anio);
  }
  m = RE_DMY.exec(s);
  if (m) {
    const [, dia, mes, anio] = m;
    return armar(dia, mes, anio.length === 2 ? 2000 + Number(anio) : Number(anio));
  }
  return null;
}

/**
 * Cualquier fecha reconocible → "dd/MM/yyyy", o "" si no se puede interpretar (fechas imposibles
 * como 31/02, años fuera de 1900-2100, texto cualquiera). Con año de 2 dígitos se asume 20yy.
 */
export function normalizarFecha(v: unknown): string {
  const p = partes(v);
  return p ? `${pad2(p.d)}/${pad2(p.m)}/${p.y}` : '';
}

/** Cualquier fecha reconocible → "yyyy-MM-dd" (lo que usa <input type="date"> y se puede comparar como texto), o "". */
export function fechaISO(v: unknown): string {
  const p = partes(v);
  return p ? `${p.y}-${pad2(p.m)}-${pad2(p.d)}` : '';
}

/**
 * Para mostrar: siempre "dd/MM/yyyy" si la fecha se entiende. Si no se entiende, el texto tal
 * cual vino, para que se vea que hay algo para corregir en vez de esconderlo.
 */
export function fechaDMY(v: unknown): string {
  return normalizarFecha(v) || (typeof v === 'string' ? v : '');
}

/**
 * Ordena por fecha descendente. Los que no tienen una fecha válida van al final. Devuelve una
 * lista nueva y es estable: a igual fecha se conserva el orden de entrada (el servidor ya los
 * manda con el cargado más tarde primero, y acá ese dato no llega como fecha completa).
 */
export function ordenarPorFechaDesc<T extends { fecha: string }>(lista: T[]): T[] {
  const claves = new Map(lista.map(x => [x, fechaISO(x.fecha)] as const));
  return [...lista].sort((a, b) => {
    const fa = claves.get(a) ?? '', fb = claves.get(b) ?? '';
    return fa === fb ? 0 : fb < fa ? -1 : 1;     // '' es menor que cualquier ISO: queda último
  });
}
