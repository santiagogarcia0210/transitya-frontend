// Helpers compartidos por Panel administrativo, Carpeta de pacientes y Requisitos por obra social.

export type Categoria = 'paciente' | 'prestador' | 'mensual';
export type TipoVenc = 'no' | 'fecha_doc' | 'meses';

export interface Requisito {
  key: string; nombre: string; categoria: Categoria; vencimiento: TipoVenc;
  vigenciaMeses: number; obligatorio: boolean; condicion: string; notas: string;
}

export interface ObraSocial {
  id: string; nombre: string; alias: string[]; borrador?: boolean; notas: string;
  presentacion: { dia: number; canal: string; notas: string };
  requisitos: Requisito[];
}

export type EstadoItem = 'FALTA' | 'OPCIONAL' | 'NO_VENCE' | 'VIGENTE' | 'PROXIMO' | 'VENCIDO' | 'SIN_FECHA';
export type EstadoTramite = 'CARGADO' | 'PRESENTADO' | 'APROBADO' | 'OBSERVADO';

export interface DocLegajo {
  id: string; requisitoKey: string; nombre?: string; fechaEmision?: string; fechaVenc?: string;
  estadoTramite?: EstadoTramite; archivoUrl?: string; archivoNombre?: string; notas?: string;
  creadoEn?: string; creadoPor?: string;
}

export interface ItemChecklist {
  requisito: Requisito; estado: EstadoItem; documento: DocLegajo | null;
  historial: DocLegajo[]; fechaVenc: string; diffDias: number | null;
}

export interface ResumenCarpeta {
  FALTA: number; VENCIDO: number; PROXIMO: number; SIN_FECHA: number; OK: number; total: number; completo: boolean;
}

export const ESTADO_UI: Record<string, { label: string; badge: string; color: string }> = {
  FALTA:      { label: 'Falta',        badge: 'badge-red',   color: 'var(--red)' },
  VENCIDO:    { label: 'Vencido',      badge: 'badge-red',   color: 'var(--red)' },
  PROXIMO:    { label: 'Por vencer',   badge: 'badge-amber', color: 'var(--amber)' },
  SIN_FECHA:  { label: 'Sin fecha',    badge: 'badge-amber', color: 'var(--amber)' },
  VIGENTE:    { label: 'Vigente',      badge: 'badge-green', color: 'var(--green)' },
  NO_VENCE:   { label: 'OK',           badge: 'badge-green', color: 'var(--green)' },
  OPCIONAL:   { label: 'Si corresponde', badge: 'badge-gray', color: 'var(--text3)' },
  PENDIENTE:  { label: 'Pendiente',    badge: 'badge-gray',  color: 'var(--text3)' },
  HECHO:      { label: 'Hecho',        badge: 'badge-green', color: 'var(--green)' },
  SIN_OBRA_SOCIAL: { label: 'Sin requisitos', badge: 'badge-purple', color: 'var(--text3)' },
};

export const TRAMITE_UI: Record<EstadoTramite, string> = {
  CARGADO: 'Cargado', PRESENTADO: 'Presentado a la OS', APROBADO: 'Aprobado', OBSERVADO: 'Observado',
};

export const CATEGORIA_UI: Record<Categoria, string> = {
  paciente: 'Carpeta del paciente', prestador: 'Documentación de la empresa', mensual: 'Presentación mensual',
};

/** 'dd/MM/yyyy' → 'yyyy-MM-dd' (para input type=date) */
export function dmyAIso(v?: string): string {
  const m = String(v || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return /^\d{4}-\d{2}-\d{2}/.test(String(v || '')) ? String(v).slice(0, 10) : '';
}

/** Acepta dd/MM/yyyy o yyyy-MM-dd → Date local, o null */
export function parseFecha(v?: string): Date | null {
  const iso = dmyAIso(v);
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** yyyy-MM-dd + N meses → yyyy-MM-dd (respeta fin de mes) */
export function sumarMesesIso(iso: string, meses: number): string {
  const f = parseFecha(iso);
  if (!f || !meses) return '';
  const ultimo = new Date(f.getFullYear(), f.getMonth() + meses + 1, 0).getDate();
  const r = new Date(f.getFullYear(), f.getMonth() + meses, Math.min(f.getDate(), ultimo));
  return `${r.getFullYear()}-${String(r.getMonth() + 1).padStart(2, '0')}-${String(r.getDate()).padStart(2, '0')}`;
}

export function textoDias(diff: number | null | undefined): string {
  if (diff === null || diff === undefined) return '';
  if (diff === 0) return 'hoy';
  if (diff < 0) return `hace ${-diff} día${diff === -1 ? '' : 's'}`;
  return `en ${diff} día${diff === 1 ? '' : 's'}`;
}

const MAX_PDF = 3 * 1024 * 1024;

/**
 * Convierte el archivo a base64 para subirlo. Las fotos se achican a 1800 px y JPEG
 * (las fotos de celular pesan 4-8 MB). PDFs: máximo 3 MB por el límite del proxy.
 */
export async function archivoABase64(file: File): Promise<{ base64: string; mimeType: string; nombre: string }> {
  if (file.type.startsWith('image/') && file.type !== 'image/heic') {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url;
      });
      const escala = Math.min(1, 1800 / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * escala);
      canvas.height = Math.round(img.height * escala);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
      return { base64: dataUrl.split(',')[1], mimeType: 'image/jpeg', nombre: file.name.replace(/\.\w+$/, '') + '.jpg' };
    } finally { URL.revokeObjectURL(url); }
  }
  if (file.size > MAX_PDF) throw new Error('El PDF supera 3 MB. Comprimilo o escanealo en menor calidad.');
  const base64 = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(file);
  });
  return { base64, mimeType: file.type || 'application/pdf', nombre: file.name };
}

export function mensajeError(e: unknown, fallback = 'Ocurrió un error'): string {
  const err = e as { response?: { data?: { mensaje?: string } }; message?: string };
  return err?.response?.data?.mensaje || err?.message || fallback;
}

export const LABEL: React.CSSProperties = {
  display: 'block', fontSize: '.78rem', color: 'var(--text3)', marginBottom: '.3rem', fontWeight: 500,
};

export const OVERLAY: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', display: 'flex', alignItems: 'center',
  justifyContent: 'center', zIndex: 50, padding: '1rem',
};
