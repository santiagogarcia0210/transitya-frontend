import api from '@/lib/api';
import type { PresupuestoDoc } from '@/lib/presupuestoPdf';
import type { ArancelUsado, Calculo, LecturaRecorrido, Modalidad, PropuestaRecorrido, ViajeEditable } from '@/lib/presupuesto';
import { viajeVacio } from '@/lib/presupuesto';

/** Lo que guarda el servidor de cada viaje (entradas validadas) y de cada impresión adjunta. */
export interface ViajeGuardado {
  id: string; origen?: string; destino?: string; centro?: string; modalidad?: Modalidad; incluyeVuelta?: boolean; kmIda?: number; kmVuelta?: number; km?: number; tramos?: number[];
  dias?: string[]; mapa?: { hashes: string[]; origen: 'impresion' | 'manual'; confianza: string; coincide: boolean | null; confirmadoManual: boolean };
}
export interface RespaldoItem { tipo: 'documento' | 'google_maps'; nombre: string; archivoUrl: string; viaje?: string; hash?: string; propuesta?: PropuestaRecorrido }
export interface PresupuestoGuardado {
  id: string; estado: string; numeroTexto?: string; numero?: number; fechaEmision?: string; beneficiarioId: string; obraId: string | null; obraNombre: string;
  formato?: 'traslados_programados' | 'multi_viaje'; periodoDesde: string; periodoHasta: string; acompanante?: boolean; vehiculo?: string; observaciones?: string;
  dependencia?: { activa: boolean; porcentaje?: number }; respaldoDocs?: string[]; viajes: ViajeGuardado[];
  beneficiario: PresupuestoDoc['beneficiario'] & { obraSocial?: string }; transportista?: PresupuestoDoc['transportista']; calculo?: Calculo; arancel?: ArancelUsado;
  plantillaUsada?: { nombre: string } | null; motivoAnulacion?: string; origenDuplicado?: string;
}

const coma = (n: number) => String(n).replace('.', ',');

/** Vuelve a armar los viajes del asistente desde un borrador guardado (para poder corregirlo). */
export function viajesDesdeGuardado(viajes: ViajeGuardado[], respaldo: RespaldoItem[]): ViajeEditable[] {
  return viajes.map((g, i) => {
    const base = viajeVacio(i);
    const kmTexto = g.tramos && g.tramos.length ? g.tramos.map(coma).join(' + ') : g.km !== undefined ? coma(g.km) : '';
    const lecturas: LecturaRecorrido[] = respaldo.filter(r => r.tipo === 'google_maps' && r.viaje === g.id && r.hash && r.propuesta).map(r => {
      const p = r.propuesta as PropuestaRecorrido;
      const guardado = g.km ?? (g.tramos ? g.tramos.reduce((a, k) => a + k, 0) : undefined);
      const idx = p.rutas.findIndex(x => guardado !== undefined && Math.abs(x.km - guardado) < 0.011);
      return {
        hash: r.hash as string, archivoUrl: r.archivoUrl, archivoNombre: r.nombre, propuesta: p,
        verificacion: { pacienteOk: null, centroOk: null, coincide: g.mapa ? g.mapa.coincide : null, advertencias: g.mapa && g.mapa.coincide === false ? ['El recorrido no coincidía con el paciente o el centro (ya lo habías revisado).'] : [] },
        rutaElegida: idx >= 0 ? idx : p.rutaElegida ?? (p.rutas.length ? 0 : null),
      };
    });
    return {
      ...base, id: g.id, origen: g.origen || '', destino: g.destino || '', centro: g.centro || '', kmTexto, modalidad: g.modalidad || 'solo_ida', incluyeVuelta: !!g.incluyeVuelta,
      kmIdaTexto: g.kmIda !== undefined ? coma(g.kmIda) : '', kmVueltaTexto: g.kmVuelta !== undefined ? coma(g.kmVuelta) : '', dias: g.dias || [],
      lecturas, kmOrigen: g.mapa ? g.mapa.origen : 'manual', confirmadoManual: !!(g.mapa && g.mapa.confirmadoManual),
    };
  });
}

/** El documento que dibuja el PDF, desde un presupuesto emitido (con los datos que se congelaron al emitir). */
export function docDesdePresupuesto(p: PresupuestoGuardado, transportistaActual?: PresupuestoDoc['transportista']): PresupuestoDoc | null {
  if (!p.calculo || !p.arancel) return null;
  return {
    numeroTexto: p.numeroTexto, fechaEmision: p.fechaEmision, estado: p.estado as PresupuestoDoc['estado'], formato: p.formato || 'multi_viaje', obraNombre: p.obraNombre,
    transportista: p.transportista || transportistaActual || {}, beneficiario: p.beneficiario, periodoDesde: p.periodoDesde, periodoHasta: p.periodoHasta,
    acompanante: p.acompanante, vehiculo: p.vehiculo, observaciones: p.observaciones, viajes: p.viajes, calculo: p.calculo, arancel: p.arancel,
  };
}

/** Baja el .docx del formulario rellenado (solo existe para obras sociales con plantilla propia). */
export async function bajarDocx(id: string, nombre: string, duplicado = false) {
  const r = await api.get(`/api/presupuestos/${id}/docx${duplicado ? '?duplicado=1' : ''}`, { responseType: 'blob' });
  const url = URL.createObjectURL(r.data as Blob);
  const a = document.createElement('a');
  a.href = url; a.download = `presupuesto-${nombre || 'borrador'}.docx`; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Con `responseType: 'blob'` los errores llegan como Blob: se lee el mensaje. */
export async function mensajeDeBlob(e: unknown, defecto: string): Promise<string> {
  const data = (e as { response?: { data?: unknown } })?.response?.data;
  if (data instanceof Blob) { try { const j = JSON.parse(await data.text()); return j.mensaje || defecto; } catch { return defecto; } }
  return (e as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje || defecto;
}
