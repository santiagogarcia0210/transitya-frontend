// Alta y edición de pacientes: lo que comparten Beneficiarios y Registro, y la lectura de las planillas de Incluir.
// Funciones puras (sin React ni red) para poder probarlas. El backend hace la misma limpieza (utils/beneficiarios.js):
// acá se hace también para que lo que se manda ya salga prolijo y el error, si lo hay, sea el real.

export const INCLUIR = 'INCLUIR SALUD';
export const OTRA_OBRA_SOCIAL = '__otra__';

const sinAcentos = (s: unknown) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
const lleno = (v: unknown) => v !== undefined && v !== null && String(v).trim() !== '';

/** Obra social en su valor canónico: cualquier grafía de Incluir pasa a 'INCLUIR SALUD'; el resto se conserva. */
export function canonicaObraSocial(v: unknown): string {
  if (!lleno(v)) return '';
  return /\bINCLUIR/.test(sinAcentos(v)) ? INCLUIR : String(v).trim();
}

/** Opciones del selector: Incluir siempre, más las obras sociales que ya existen cargadas (sin repetir grafías). */
export function opcionesObraSocial(existentes: unknown[]): string[] {
  // Sin repetir por mayúsculas/acentos/espacios ("PNC" y "pnc " son la misma opción): gana la primera grafía.
  const porClave = new Map<string, string>([[sinAcentos(INCLUIR), INCLUIR]]);
  for (const v of existentes) { const c = canonicaObraSocial(v); if (c && !porClave.has(sinAcentos(c))) porClave.set(sinAcentos(c), c); }
  const resto = [...porClave.values()].filter(x => x !== INCLUIR).sort((a, b) => a.localeCompare(b, 'es'));
  return [INCLUIR, ...resto];
}

const INTERNOS = new Set(['id', 'ID', '_id', '_fsId', 'creadoEn', 'creadoPor', 'actualizadoEn', '_updatedAt']);
const CLAVES_AFILIADO = ['N° AFILIADO', 'Nº AFILIADO', 'nroAfiliado', 'NRO_AFILIADO', 'nro_afiliado', 'NRO AFILIADO', 'N AFILIADO', 'AFILIADO', 'afiliado'];
const CLAVES_OS = ['OBRA SOCIAL', 'OS', 'obraSocial', 'OBRASOCIAL', 'obra_social'];

const primero = (o: Record<string, unknown>, claves: string[]) => {
  for (const k of claves) if (lleno(o[k])) return String(o[k]).trim();
  return '';
};

/** Lo que el formulario manda → lo que se envía: sin id ni campos del sistema, sin `undefined`, con el N° de
 *  afiliado y la obra social escritos en todas las claves que leen las pantallas y las planillas. */
export function limpiarPayloadBeneficiario(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload || {})) {
    if (INTERNOS.has(k) || v === undefined || typeof v === 'function') continue;
    out[k] = v;
  }
  if (CLAVES_AFILIADO.some(k => k in out)) {
    const af = primero(out, CLAVES_AFILIADO);
    out['N° AFILIADO'] = af; out.nroAfiliado = af;
  }
  if (CLAVES_OS.some(k => k in out)) {
    const os = canonicaObraSocial(primero(out, CLAVES_OS));
    out['OBRA SOCIAL'] = os; out.obraSocial = os;
  }
  return out;
}

/** El error REAL de un guardado: el mensaje que mandó el backend (y el código HTTP); si el servidor no
 *  respondió, lo dice. Nunca un "Error al guardar" a secas. */
export function mensajeGuardado(e: unknown, accion = 'guardar'): string {
  const err = e as { response?: { status?: number; data?: { mensaje?: string; error?: string } }; message?: string; request?: unknown };
  const r = err?.response;
  if (r) {
    const txt = r.data?.mensaje || r.data?.error || err.message || 'Sin detalle';
    return `No se pudo ${accion} (error ${r.status ?? '?'}): ${txt}`;
  }
  if (err?.request) return `No se pudo ${accion}: el servidor no respondió. Revisá tu conexión e intentá de nuevo.`;
  return `No se pudo ${accion}: ${err?.message || 'error desconocido'}`;
}

/* ── Planillas de Incluir ───────────────────────────────────────────────────────────────────────── */

export interface FilaPlanilla {
  id: string; nombre: string; nroAfiliado: string; faltaAfiliado: boolean;
  dni: string; chofer: string;
}

/** Una fila de /api/planillas/incluir o /dj107 → lo que usan las pantallas. Lee el N° de cualquier variante
 *  (`afiliado` en Incluir, `nroAfiliado` en DJ ESC 107, 'N° AFILIADO' …) y nunca descarta una fila por no tenerlo. */
export function normalizarFilaPlanilla(f: Record<string, unknown>): FilaPlanilla {
  const nroAfiliado = primero(f, ['afiliado', 'nroAfiliado', ...CLAVES_AFILIADO]);
  return {
    id: String(f.id || f.ID || ''),
    nombre: String(f.nombre || f.apellidoNombre || f['APELLIDO Y NOMBRE'] || f.NOMBRE || ''),
    nroAfiliado,
    faltaAfiliado: !nroAfiliado,
    dni: String(f.dni || f.DNI || ''),
    chofer: String(f.chofer || f.CHOFER || ''),
  };
}

export interface SinObraSocial { id: string; nombre: string }

/** Respuesta completa de la planilla → filas + aviso de los que no tienen obra social. Sin fallback silencioso. */
export function leerPlanilla(data: unknown): { filas: FilaPlanilla[]; sinObraSocial: SinObraSocial[] } {
  const d = (data || {}) as { filas?: unknown; sinObraSocial?: unknown };
  const filas = Array.isArray(d.filas) ? (d.filas as Record<string, unknown>[]).map(normalizarFilaPlanilla) : [];
  const sin = Array.isArray(d.sinObraSocial) ? (d.sinObraSocial as Record<string, unknown>[]) : [];
  return {
    filas,
    sinObraSocial: sin.map(x => ({ id: String(x.id || ''), nombre: String(x.nombre || '') })).filter(x => x.id),
  };
}

/** "2 pacientes sin obra social: revisar" (singular/plural). Vacío si no hay ninguno. */
export function textoAvisoSinObraSocial(n: number): string {
  if (n <= 0) return '';
  return `${n} ${n === 1 ? 'paciente sin obra social' : 'pacientes sin obra social'}: revisar`;
}

/** Link a la ficha del paciente (Beneficiarios abre la edición con ese id). */
export const fichaHref = (id: string) => `/dashboard/beneficiarios?editar=${encodeURIComponent(id)}`;

/** Texto del N° de afiliado en la hoja impresa: el N° o nada (la hoja sale en blanco para completarlo a mano). */
export const textoAfiliadoImpreso = (nroAfiliado: string | undefined | null) => String(nroAfiliado ?? '').trim();
