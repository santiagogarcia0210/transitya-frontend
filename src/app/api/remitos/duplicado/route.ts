import { NextRequest } from 'next/server';

const BACKEND = process.env.BACKEND_URL || 'https://transitya-backend-production.up.railway.app';

// Verifica si ya existe un remito con el mismo nroRemito + cuit.
// Primero intenta el endpoint nativo en Railway; si falla, busca en la lista.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const nroRemito = params.get('nroRemito') || '';
  const cuit      = params.get('cuit')      || '';
  const auth      = request.headers.get('Authorization') || '';

  if (!nroRemito) {
    return Response.json({ duplicado: false });
  }

  try {
    // 1. Intentar endpoint nativo del backend
    const nativeRes = await fetch(
      `${BACKEND}/api/remitos/duplicado?${params.toString()}`,
      { headers: { Authorization: auth }, signal: AbortSignal.timeout(4000) }
    );
    if (nativeRes.ok) {
      const data = await nativeRes.json();
      return Response.json(data);
    }
  } catch { /* backend no tiene el endpoint */ }

  try {
    // 2. Fallback: buscar en la lista completa
    const listRes = await fetch(`${BACKEND}/api/remitos`, {
      headers: { Authorization: auth }, signal: AbortSignal.timeout(6000)
    });
    if (!listRes.ok) return Response.json({ duplicado: false });

    const body = await listRes.json();
    const items: Record<string, unknown>[] = Array.isArray(body) ? body : (body?.data ?? []);

    const existe = items.some(r => {
      const rNro  = String(r.nroRemito  || r.NROREMITO  || r['NRO REMITO']  || '');
      const rCuit = String(r.cuit       || r.CUIT       || '');
      return rNro === nroRemito && (!cuit || rCuit === cuit);
    });

    return Response.json({ duplicado: existe });
  } catch {
    return Response.json({ duplicado: false });
  }
}
