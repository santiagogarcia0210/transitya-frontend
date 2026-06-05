'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { serializarFirestore } from '@/lib/utils';

interface UbicChofer {
  usuario: string; rol?: string;
  lat: number; lng: number;
  hace: string; diffMin: number | null;
  colorIdx: number;
}

interface ChoferEstado {
  id: string; nombre: string; vehiculo: string; patente?: string;
  reporteHoy: boolean; hace?: string; lat?: number; lng?: number;
}

/* ── Mapa Leaflet inline ─────────────────────────────────────────────── */
function MapaLive({ ubicaciones }: { ubicaciones: UbicChofer[] }) {
  const mapRef  = useRef<HTMLDivElement>(null);
  const mapInst = useRef<unknown>(null);
  const marksRef= useRef<unknown[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current) return;
    import('leaflet').then(L => {
      if (!mapInst.current) {
        if (!document.head.querySelector('[href*="leaflet.css"]')) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          document.head.appendChild(link);
        }
        const map = L.map(mapRef.current!).setView([-26.82, -65.22], 11);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          { attribution:'© OSM contributors' }).addTo(map);
        mapInst.current = map;
      }
      const map = mapInst.current as L.Map;
      (marksRef.current as L.Marker[]).forEach(m => map.removeLayer(m));
      marksRef.current = [];

      ubicaciones.forEach(u => {
        if (!u.lat || !u.lng) return;
        const online = u.diffMin !== null && u.diffMin < 15;
        const color  = online ? '#10b981' : '#ef4444';
        const icon = L.divIcon({
          html: `<div style="background:${color};width:34px;height:34px;border-radius:50%;
            display:flex;align-items:center;justify-content:center;font-size:16px;
            border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.4)">🚐</div>`,
          className: '', iconSize: [34, 34], iconAnchor: [17, 17],
        });
        const marker = L.marker([u.lat, u.lng], { icon })
          .bindPopup(`<b>${u.usuario}</b>${u.hace ? `<br>⏱ ${u.hace}` : ''}`)
          .addTo(map);
        (marksRef.current as L.Marker[]).push(marker);
      });
      setTimeout(() => (map as any).invalidateSize(), 150);
    });
  }, [ubicaciones]);

  return (
    <div ref={mapRef} style={{
      width: '100%', height: 380,
      borderRadius: 'var(--radius-lg)', overflow: 'hidden',
    }} />
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */

export default function ChoferesMapaPage() {
  const router = useRouter();

  const [ubicaciones,  setUbicaciones]  = useState<UbicChofer[]>([]);
  const [estadoChof,   setEstadoChof]   = useState<ChoferEstado[]>([]);
  const [loading,      setLoading]      = useState(true);

  const cargarUbicaciones = async () => {
    try {
      const r = await api.get('/api/ubicaciones');
      const lista = (r.data?.ubicaciones ?? []) as Record<string, unknown>[];
      setUbicaciones(lista.map(serializarFirestore).map((u: Record<string, unknown>) => ({
        usuario:  String(u.usuario || u.nombre || ''),
        rol:      String(u.rol     || ''),
        lat:      Number(u.lat     || 0),
        lng:      Number(u.lng     || 0),
        hace:     String(u.hace    || ''),
        diffMin:  u.diffMin !== undefined ? Number(u.diffMin) : null,
        colorIdx: Number(u.colorIdx || 0),
      })));
    } catch { /* silent */ }
  };

  const cargarEstado = async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/dashboard/resumen');
      const d = r.data;
      if (d?.estadoChoferes) {
        setEstadoChof((d.estadoChoferes as Record<string, unknown>[]).map(c => ({
          id:         String(c.uid    || c.id    || ''),
          nombre:     String(c.nombre || c.NOMBRE || ''),
          vehiculo:   String(c.vehiculo || c.VEHICULO || c.patente || ''),
          reporteHoy: Boolean(c.reporteHoy || c.tieneReporte || false),
          hace:       c.hace ? String(c.hace) : undefined,
          lat:        c.lat  ? Number(c.lat)  : undefined,
          lng:        c.lng  ? Number(c.lng)  : undefined,
        })));
      }
    } catch { /* fallback */ }
    setLoading(false);
  };

  useEffect(() => {
    cargarEstado();
    cargarUbicaciones();
    const iv = setInterval(cargarUbicaciones, 30000);
    return () => clearInterval(iv);
  }, []);

  const actualizar = () => { cargarEstado(); cargarUbicaciones(); };

  return (
    <div>
      {/* Header */}
      <div className="section-header">
        <div>
          <h2 className="section-title">🗺️ Choferes en vivo</h2>
          <p style={{ fontSize:'.82rem', color:'var(--text3)', marginTop:'.2rem' }}>
            {ubicaciones.filter(u => u.diffMin !== null && u.diffMin < 15).length} en línea · actualiza cada 30 s
          </p>
        </div>
        <button className="btn btn-secondary" onClick={actualizar} style={{ fontSize:'.8rem' }}>↻ Actualizar</button>
      </div>

      {loading ? (
        <div style={{ display:'flex', alignItems:'center', gap:'.75rem', color:'var(--text3)', padding:'2rem' }}>
          <span className="spinner"/> Cargando…
        </div>
      ) : (
        <>
          {/* Semáforo — tarjetas estilo GAS */}
          {estadoChof.length > 0 && (
            <div style={{ marginBottom:'1.25rem' }}>
              <p style={{ fontSize:'.78rem', fontWeight:700, color:'var(--text3)',
                textTransform:'uppercase', letterSpacing:'.06em', marginBottom:'.75rem' }}>
                🛣 Reporte KM hoy
              </p>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:'.75rem' }}>
                {estadoChof.map((c, i) => {
                  const ok = c.reporteHoy;
                  // Merge GPS data from ubicaciones
                  const ubic = ubicaciones.find(u =>
                    u.usuario.toLowerCase().includes(c.nombre.toLowerCase().split(' ')[0])
                  );
                  const hace   = c.hace || ubic?.hace || null;
                  const online = ubic ? (ubic.diffMin !== null && ubic.diffMin < 15) : false;

                  return (
                    <div key={c.id || i} style={{
                      background:'var(--bg3)', border:'1px solid var(--border)',
                      borderLeft:`4px solid ${ok ? 'var(--green)' : 'var(--red)'}`,
                      borderRadius:'var(--radius-lg)', padding:'1rem 1.1rem',
                      transition:'border-color var(--transition)',
                    }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'.6rem', marginBottom:'.5rem' }}>
                        {/* Semáforo dot */}
                        <span className={`semaforo-dot ${online ? 'verde' : hace ? 'amarillo' : 'rojo'}`} />
                        <div style={{ flex:1, minWidth:0 }}>
                          <p style={{ fontSize:'.9rem', fontWeight:700, color:'var(--text)',
                            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {c.nombre || '—'}
                          </p>
                          {c.vehiculo && (
                            <p style={{ fontSize:'.75rem', color:'var(--text3)', fontWeight:600 }}>
                              🚐 {c.vehiculo}
                            </p>
                          )}
                        </div>
                        <span style={{ fontSize:'.72rem', fontWeight:700,
                          color: ok ? 'var(--green)' : 'var(--red)',
                          background: ok ? 'var(--green-dim)' : 'var(--red-dim)',
                          border: `1px solid ${ok ? 'rgba(16,185,129,.3)' : 'rgba(239,68,68,.3)'}`,
                          padding:'.2rem .5rem', borderRadius:99, whiteSpace:'nowrap' }}>
                          {ok ? '✅ OK' : '❌ Sin rep.'}
                        </span>
                      </div>

                      {hace && (
                        <p style={{ fontSize:'.72rem', color:'var(--text3)', marginBottom:'.6rem' }}>
                          ⏱ {hace}
                        </p>
                      )}

                      {/* Botones */}
                      <div style={{ display:'flex', gap:'.4rem', flexWrap:'wrap' }}>
                        <button className="btn btn-secondary btn-sm"
                          style={{ fontSize:'.72rem', flex:1 }}
                          onClick={() => router.push(`/dashboard/recorridos?chofer=${encodeURIComponent(c.nombre)}`)}>
                          🛣️ Ver recorrido
                        </button>
                        <button className="btn btn-secondary btn-sm"
                          style={{ fontSize:'.72rem', flex:1 }}
                          onClick={() => router.push(`/dashboard/asistencia?chofer=${encodeURIComponent(c.nombre)}`)}>
                          👤 Ver pacientes
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Mapa Leaflet */}
          <div className="card" style={{ padding:'1rem' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'.75rem' }}>
              <p style={{ fontSize:'.85rem', fontWeight:600, color:'var(--text)' }}>📍 Mapa en tiempo real</p>
              <div style={{ display:'flex', gap:'.5rem', flexWrap:'wrap' }}>
                {ubicaciones.map(u => (
                  <span key={u.usuario} style={{
                    display:'flex', alignItems:'center', gap:'.3rem',
                    fontSize:'.72rem', color:'var(--text3)',
                    padding:'.2rem .5rem', background:'var(--bg4)', borderRadius:99,
                  }}>
                    <span style={{ width:6, height:6, borderRadius:'50%', display:'inline-block',
                      background: (u.diffMin !== null && u.diffMin < 15) ? 'var(--green)' : 'var(--red)' }}/>
                    {u.usuario}
                  </span>
                ))}
              </div>
            </div>
            {ubicaciones.length === 0 ? (
              <div style={{ height:380, display:'flex', alignItems:'center', justifyContent:'center',
                color:'var(--text3)', flexDirection:'column', gap:'.75rem',
                background:'var(--bg4)', borderRadius:'var(--radius-lg)' }}>
                <span style={{ fontSize:'2rem' }}>📡</span>
                <p style={{ fontSize:'.875rem' }}>Sin choferes con GPS activo</p>
                <p style={{ fontSize:'.78rem', color:'var(--text3)' }}>
                  Los choferes deben habilitar el GPS en la app
                </p>
              </div>
            ) : (
              <MapaLive ubicaciones={ubicaciones} />
            )}
          </div>
        </>
      )}
    </div>
  );
}
