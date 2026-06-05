/**
 * Normalizes backend responses to an array.
 * Backend routes wrap data in different keys: registros, ubicaciones, items, data, etc.
 */
export function toArray(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return [];
  // Try common backend wrapper keys in priority order
  return data.registros
      ?? data.resultados
      ?? data.filas
      ?? data.ubicaciones
      ?? data.items
      ?? data.data
      ?? data.planillas
      ?? data.beneficiarios
      ?? data.choferes
      ?? data.usuarios
      ?? [];
}

export function serializarFirestore(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  // Firestore Timestamp → string
  if (obj._seconds !== undefined && obj._nanoseconds !== undefined) {
    return new Date(obj._seconds * 1000).toLocaleDateString('es-AR');
  }

  if (Array.isArray(obj)) return obj.map(serializarFirestore);

  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, serializarFirestore(v)])
  );
}
