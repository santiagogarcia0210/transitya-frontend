// Normaliza respuestas de la API a un array. El backend a veces devuelve
// un array directo y otras veces lo envuelve en { items } o { data }.
export function toArray(data: any): any[] {
  if (Array.isArray(data)) return data;
  return data?.items || data?.data || [];
}

export function serializarFirestore(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  // Convertir Timestamp de Firestore a string
  if (obj._seconds !== undefined && obj._nanoseconds !== undefined) {
    return new Date(obj._seconds * 1000).toLocaleDateString('es-AR');
  }

  // Recursivo para arrays y objetos
  if (Array.isArray(obj)) return obj.map(serializarFirestore);

  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, serializarFirestore(v)])
  );
}
