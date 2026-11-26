// Lectura de documentos del legajo con IA: tipos, preparación de archivos en el navegador y helpers puros.
// Lo que toca el navegador (canvas, FileReader) vive dentro de funciones; el resto es puro y se prueba en tests/.

export type Confianza = 'alta' | 'media' | 'baja';

export interface DatosPresupuesto {
  importe: number | null; concepto: string; fecha: string; validez: string;
  confianza: { importe: Confianza; concepto: Confianza; fecha: Confianza; validez: Confianza };
}

/** Un archivo que el servidor leyó bien (propuesta de la IA, todavía sin guardar). */
export interface LecturaOk {
  ok: true; indice: number; nombreArchivo: string; hash: string; archivoUrl: string; archivoNombre: string;
  repetido: boolean; yaCargado: { docId: string } | null;
  legible: boolean; requisitoKey: string; tipoSugerido: string;
  fechaEmision: string; fechaVenc: string; fechaVencCalculada: boolean;
  paciente: { nombre: string; dni: string; obraSocial: string; afiliado: string };
  emisor: string; presupuesto: DatosPresupuesto | null;
  confianza: { tipo: Confianza; fechaEmision: Confianza; fechaVenc: Confianza; paciente: Confianza; emisor: Confianza };
  confianzaGeneral: Confianza; advertencias: string[];
  coincidePaciente: boolean | null; posiblePacienteEquivocado: boolean;
  clinico?: ClinicoLeido | null;       // solo CUD/orden médica y solo si el usuario puede verlos
  clinicoOmitido?: boolean;            // archivo ya leído antes: los datos clínicos no se conservan en la caché
}

/* ── Datos clínicos (solo CUD y orden médica; confidenciales) ─────────────── */

export type DocClinico = 'cud' | 'orden_medica';
export type ValorClinico = string | number | string[];
export interface CampoClinico { valor: ValorClinico; confianza: Confianza }
export interface ClinicoLeido { documento: DocClinico; campos: Record<string, CampoClinico>; advertencias: string[] }

/** Modalidades del Nomenclador que la IA puede nombrar y que se sugieren (mismas claves que el servidor). */
export const MODALIDADES: Record<string, string> = {
  estimulacion_temprana: 'Estimulación temprana',
  centro_dia: 'Centro de día',
  centro_educativo_terapeutico: 'Centro educativo terapéutico',
  escuela_especial: 'Escuela especial',
  integracion_escolar: 'Apoyo a la integración escolar',
  rehabilitacion_ambulatoria: 'Rehabilitación ambulatoria',
  hogar: 'Hogar / residencia',
  taller_protegido: 'Taller protegido / formación laboral',
};

export interface DefCampo { k: string; label: string; tipo: 'texto' | 'fecha' | 'lista' | 'numero'; largo?: boolean }
export const CAMPOS_CLINICOS: Record<DocClinico, DefCampo[]> = {
  cud: [
    { k: 'diagnostico', label: 'Diagnóstico', tipo: 'texto', largo: true },
    { k: 'cie10', label: 'Código CIE-10', tipo: 'texto' },
    { k: 'tipoDiscapacidad', label: 'Tipo de discapacidad', tipo: 'texto' },
    { k: 'nroCertificado', label: 'N° de certificado', tipo: 'texto' },
    { k: 'vencimientoCertificado', label: 'Vencimiento del certificado', tipo: 'fecha' },
    { k: 'orientacionTexto', label: 'Orientación prestacional (texto del CUD)', tipo: 'texto', largo: true },
    { k: 'orientacionPrestaciones', label: 'Prestaciones recomendadas', tipo: 'lista' },
  ],
  orden_medica: [
    { k: 'diagnostico', label: 'Diagnóstico', tipo: 'texto', largo: true },
    { k: 'prestacionIndicada', label: 'Prestación y frecuencia indicadas', tipo: 'texto', largo: true },
    { k: 'diasPorSemana', label: 'Días por semana', tipo: 'numero' },
    { k: 'profesional', label: 'Profesional', tipo: 'texto' },
  ],
};
export const TITULO_DOC_CLINICO: Record<DocClinico, string> = { cud: 'CUD', orden_medica: 'Orden médica' };

/** Lo que se edita en pantalla: texto (las fechas en ISO) o lista de claves, más lo que leyó la IA para detectar ediciones. */
export interface ClinicoEditable {
  documento: DocClinico;
  valores: Record<string, string | string[]>;
  confianzas: Record<string, Confianza>;
  original: Record<string, string | string[]>;
  advertencias: string[];
}

const aEditable = (def: DefCampo, v: ValorClinico | undefined): string | string[] => {
  if (def.tipo === 'lista') return Array.isArray(v) ? v.map(String) : [];
  if (v === undefined || v === null) return '';
  return def.tipo === 'fecha' ? dmyAIso(String(v)) : String(v);
};
const clave = (v: string | string[]) => (Array.isArray(v) ? [...v].sort().join('|') : v.trim());

export function clinicoEditable(c: ClinicoLeido): ClinicoEditable {
  const valores: Record<string, string | string[]> = {}, confianzas: Record<string, Confianza> = {};
  for (const d of CAMPOS_CLINICOS[c.documento]) {
    valores[d.k] = aEditable(d, c.campos[d.k]?.valor);
    if (c.campos[d.k]) confianzas[d.k] = c.campos[d.k].confianza;
  }
  return { documento: c.documento, valores, confianzas, original: { ...valores }, advertencias: c.advertencias || [] };
}

/** Cuerpo `clinico` de confirmar-lectura: solo campos con valor; `editado` marca lo que cambió la persona. */
export function clinicoParaConfirmar(e: ClinicoEditable | null) {
  if (!e) return undefined;
  const campos: Record<string, { valor: ValorClinico; confianza: Confianza; editado: boolean }> = {};
  for (const d of CAMPOS_CLINICOS[e.documento]) {
    const v = e.valores[d.k];
    if (Array.isArray(v) ? v.length === 0 : !String(v ?? '').trim()) continue;
    const valor: ValorClinico = d.tipo === 'lista' ? (v as string[]) : d.tipo === 'fecha' ? isoADmy(String(v)) : d.tipo === 'numero' ? Number(String(v).replace(/\D/g, '')) : String(v).trim();
    if (d.tipo === 'fecha' && !valor) continue;
    campos[d.k] = { valor, confianza: e.confianzas[d.k] || 'baja', editado: clave(v) !== clave(e.original[d.k] ?? '') };
  }
  return Object.keys(campos).length ? { documento: e.documento, campos } : undefined;
}

/** Un archivo que no se pudo leer (formato, tamaño, IA ocupada…). */
export interface LecturaError { ok: false; indice: number; nombreArchivo: string; mensaje: string }

/** Lo que el administrativo está revisando: la propuesta + lo que fue editando. */
export interface Propuesta {
  clave: string;                       // hash del archivo
  lectura: LecturaOk;
  requisitoKey: string;                // 'otro' o la clave de un requisito
  nombre: string;                      // solo si es "otro"
  fechaEmision: string;                // ISO (yyyy-mm-dd) para el <input type="date">
  fechaVenc: string;
  notas: string;
  importe: string; concepto: string; validez: string;
  aceptarPacienteDistinto: boolean;
  clinico: ClinicoEditable | null;
  estado: 'pendiente' | 'guardando' | 'guardada' | 'descartada' | 'error';
  mensaje: string;
}

export const MAX_PDF_BYTES = 3 * 1024 * 1024;       // el proxy de Vercel corta cerca de 4,5 MB por pedido
export const LADO_MAX_PX = 1600;
const BASE64_MAX_CHARS = 3_600_000;                  // ≈ 2,7 MB de imagen: entra holgado en un pedido

/* ── Fechas: el servidor habla dd/MM/yyyy; los <input type="date"> yyyy-mm-dd ── */

export function dmyAIso(v?: string): string {
  const m = String(v || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : '';
}

export function isoADmy(v?: string): string {
  const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

/* ── Confianza ─────────────────────────────────────────────────────────── */

export const esBaja = (c?: Confianza) => c === 'baja';

/** Texto para el indicador de un dato según cuánta seguridad tuvo la IA. */
export function etiquetaConfianza(c?: Confianza): string {
  return c === 'alta' ? 'Se lee claro' : c === 'media' ? 'Revisalo' : 'Poco seguro: verificalo';
}

/* ── De lectura a propuesta editable, y de propuesta a lo que se confirma ─── */

export function propuestaDe(l: LecturaOk): Propuesta {
  const p = l.presupuesto;
  return {
    clave: l.hash, lectura: l, requisitoKey: l.requisitoKey || 'otro', nombre: l.tipoSugerido || '',
    fechaEmision: dmyAIso(l.fechaEmision), fechaVenc: dmyAIso(l.fechaVenc), notas: '',
    importe: p && p.importe !== null ? String(p.importe) : '', concepto: p?.concepto || '', validez: p?.validez || '',
    aceptarPacienteDistinto: false, clinico: l.clinico ? clinicoEditable(l.clinico) : null,
    estado: l.yaCargado ? 'guardada' : 'pendiente', mensaje: l.yaCargado ? 'Este archivo ya está cargado en la carpeta.' : '',
  };
}

/** ¿Se puede confirmar? Un documento de otra persona necesita la confirmación explícita. */
export function puedeConfirmar(p: Propuesta): boolean {
  if (p.estado !== 'pendiente' && p.estado !== 'error') return false;
  if (p.lectura.posiblePacienteEquivocado && !p.aceptarPacienteDistinto) return false;
  if (p.requisitoKey === 'otro' && !p.nombre.trim()) return false;
  return true;
}

/** Cuerpo de POST /confirmar-lectura para un documento. */
export function itemConfirmar(p: Propuesta) {
  const datos: Record<string, string> = {};
  if (p.importe.trim()) datos.importe = p.importe.trim();
  if (p.concepto.trim()) datos.concepto = p.concepto.trim();
  if (p.validez.trim()) datos.validez = p.validez.trim();
  return {
    hash: p.clave, requisitoKey: p.requisitoKey, nombre: p.requisitoKey === 'otro' ? p.nombre.trim() : undefined,
    fechaEmision: isoADmy(p.fechaEmision), fechaVenc: isoADmy(p.fechaVenc), estadoTramite: 'CARGADO',
    notas: p.notas.trim(), datos, aceptarPacienteDistinto: p.aceptarPacienteDistinto,
    clinico: clinicoParaConfirmar(p.clinico),
  };
}

/** Los resultados del servidor, separados en lo que se puede revisar y lo que falló. */
export function separarResultados(resultados: Array<LecturaOk | LecturaError>) {
  const buenos: LecturaOk[] = [], fallidos: LecturaError[] = [];
  for (const r of resultados) (r.ok ? buenos : fallidos).push(r as never);
  return { buenos, fallidos };
}

/* ── Preparación del archivo en el navegador ─────────────────────────────── */

export class ErrorArchivo extends Error {}

const esHeic = (f: { type: string; name: string }) => /heic|heif/i.test(f.type) || /\.(heic|heif)$/i.test(f.name);

export interface ArchivoPreparado { base64: string; mimeType: string; nombre: string }

/**
 * Deja el archivo listo para mandar: las fotos se achican a ~1600 px y se pasan a JPEG (también las HEIC, si el
 * navegador las puede abrir); los PDF van tal cual si pesan hasta 3 MB. Si no se puede, lanza ErrorArchivo con un
 * mensaje que se le muestra al usuario.
 */
export async function prepararArchivo(file: File): Promise<ArchivoPreparado> {
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    if (file.size > MAX_PDF_BYTES) throw new ErrorArchivo('El PDF pesa más de 3 MB. Escanealo en menor calidad o sacale foto a las hojas.');
    const base64 = await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej(new ErrorArchivo('No se pudo leer el PDF.'));
      r.readAsDataURL(file);
    });
    return { base64, mimeType: 'application/pdf', nombre: file.name };
  }
  if (!file.type.startsWith('image/') && !esHeic(file)) throw new ErrorArchivo('Formato no permitido: subí fotos (JPG, PNG) o PDF.');

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new ErrorArchivo(esHeic(file)
      ? 'Este navegador no puede abrir fotos HEIC de iPhone. Sacala de nuevo como "Más compatible" (JPG) o abrí esta página desde Safari.'
      : 'No se pudo abrir la foto. ¿Está dañada?');
  }
  try {
    const escala = Math.min(1, LADO_MAX_PX / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * escala));
    canvas.height = Math.max(1, Math.round(bitmap.height * escala));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new ErrorArchivo('No se pudo procesar la foto en este navegador.');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);   // PNG con transparencia → fondo blanco
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    let base64 = canvas.toDataURL('image/jpeg', 0.82).split(',')[1];
    if (base64.length > BASE64_MAX_CHARS) base64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
    if (base64.length > BASE64_MAX_CHARS) throw new ErrorArchivo('La foto es demasiado pesada. Sacala con menos resolución.');
    return { base64, mimeType: 'image/jpeg', nombre: file.name.replace(/\.\w+$/, '') + '.jpg' };
  } finally { bitmap.close(); }
}
