// Fuente única de verdad: hrefs accesibles para rol 'chofer'.
// Sidebar y BottomNav derivan de este Set — nunca duplicar esta lógica.
// Para agregar/quitar rutas del chofer: editar SOLO aquí.
export const CHOFER_HREFS: ReadonlySet<string> = new Set([
  '/dashboard',
  '/dashboard/asistencia',
  '/dashboard/mi-ruta',
  '/dashboard/egresos',
  '/dashboard/remitos',
  '/dashboard/reportes-km',
  '/dashboard/vencimientos',
]);
