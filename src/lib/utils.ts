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
