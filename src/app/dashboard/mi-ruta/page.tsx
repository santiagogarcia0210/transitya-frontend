'use client';
import { useEffect, useRef, useState } from 'react';
import api from '@/lib/api';

interface Parada {
  orden:          number;
  beneficiarioId: string;
  fsId:           string;
  nombre:         string;
  domicilio:      string;
  horarioTurno:   string;
  horaIngreso:    string;
  horaEgreso:     string;
  tieneHorariosEspeciales: boolean;
  lat:            number | null;
  lng:            number | null;
  tieneGPS:       boolean;
}

interface RutaData {
  fecha:        string;
  choferNombre: string;
  paradas:      Parada[];
  total:        number;
  sinGPS:       number;
  conGPS:       number;
}

/* ── Mapa Leaflet ──────────────────────────────────────────────────────── */

function MapaRuta({ paradas }: { paradas: Parada[] }) {
  const mapRef  = useRef<HTMLDivElement>(null);
  const mapInst = useRef<unknown>(null);
  const marksRef = useRef<unknown[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current) return;
    import('leaflet').then(L => {
      if (!mapInst.current) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        if (!document.head.querySelector('[href*="leaflet.css"]')) document.head.appendChild(link);
        const map = (L.map as Function)(mapRef.current!).setView([-26.82, -65.22], 12);
        (L.tileLayer as Function)('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM' }).addTo(map);
        mapInst.current = map;
      }

      const map = mapInst.current as { removeLayer:(l:unknown)=>void; invalidateSize:()=>void; addLayer?:(l:unknown)=>void };
      (marksRef.current as unknown[]).forEach(m => map.removeLayer(m));
      marksRef.current = [];

      const conGPS = paradas.filter(p => p.tieneGPS);
      conGPS.forEach(p => {
        if (!p.lat || !p.lng) return;
        const icon = (L.divIcon as Function)({
          html: `<div style="background:var(--blue,#2f81f7);color:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4)">${p.orden}</div>`,
          className: '', iconSize: [28, 28], iconAnchor: [14, 14],
        });
        const marker = (L.marker as Function)([p.lat, p.lng], { icon })
          .bindPopup(`<b>${p.orden}. ${p.nombre}</b><br>${p.domicilio}${
            (p.horaIngreso && p.horaEgreso)
              ? '<br>🕐 ' + (p.tieneHorariosEspeciales ? 'Variable' : p.horaIngreso + ' - ' + p.horaEgreso)
              : p.horarioTurno ? '<br>🕐 ' + p.horarioTurno : ''
          }`)
          .addTo(mapInst.current as L.Map);
        marksRef.current.push(marker);
      });

      // Draw polyline connecting stops in order
      if (conGPS.length > 1) {
        const coords = conGPS.map(p => [p.lat!, p.lng!] as [number, number]);
        const line = (L.polyline as Function)(coords, { color: '#2f81f7', weight: 2, opacity: 0.6 })
          .addTo(mapInst.current as L.Map);
        marksRef.current.push(line);
      }

      setTimeout(() => (map as unknown as { invalidateSize:()=>void }).invalidateSize(), 150);
    });
    return () => {
      if (mapInst.current) {
        (mapInst.current as { remove:()=>void }).remove();
        mapInst.current = null;
      }
    };
  }, [paradas]);

  return (
    <div ref={mapRef} style={{ width: '100%', height: 320, borderRadius: 'var(--radius-lg)', overflow: 'hidden' }} />
  );
}

/* ── Página ────────────────────────────────────────────────────────────── */

export default function MiRutaPage() {
  const hoy = new Date().toISOString().split('T')[0];
  const [fecha,       setFecha]       = useState(hoy);
  const [ruta,        setRuta]        = useState<RutaData | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [errLoad,     setErrLoad]     = useState<string | null>(null);
  const [geocodando,  setGeocodando]  = useState(false);
  const [gpsMsg,      setGpsMsg]      = useState<{ id: string; text: string; ok: boolean } | null>(null);

  const cargar = async (f = fecha) => {
    setLoading(true); setErrLoad(null);
    try {
      const r = await api.get(`/api/asistencia/mi-ruta?fecha=${f}`);
      setRuta(r.data);
    } catch (err: unknown) {
      console.error('[mi-ruta] cargar:', err);
      setErrLoad('No se pudo cargar la ruta. Verificá que tenés asistencia asignada para este día.');
    }
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Geocodificar una parada ── */
  const geocodificarUna = async (p: Parada): Promise<{ lat: number; lng: number } | null> => {
    if (!p.domicilio) return null;
    const query = encodeURIComponent(`${p.domicilio}, Tucumán, Argentina`);
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`, {
        headers: { 'User-Agent': 'TransitYa/1.0' },
      });
      const data = await r.json();
      if (!data.length) return null;
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    } catch { return null; }
  };

  const actualizarGPS = async (p: Parada, coords?: { lat: number; lng: number }) => {
    setGpsMsg(null);
    try {
      let latLng = coords;
      if (!latLng) {
        latLng = await geocodificarUna(p) || undefined;
        if (!latLng) {
          setGpsMsg({ id: p.beneficiarioId, text: 'No se encontró la dirección.', ok: false });
          return;
        }
      }
      await api.put(`/api/beneficiarios/${p.fsId || p.beneficiarioId}/gps`, latLng);
      setGpsMsg({ id: p.beneficiarioId, text: '✅ GPS actualizado.', ok: true });
      await cargar(fecha);
    } catch {
      setGpsMsg({ id: p.beneficiarioId, text: 'Error al guardar GPS.', ok: false });
    }
  };

  /* ── Geocodificar todos los pendientes ── */
  const geocodificarPendientes = async () => {
    if (!ruta) return;
    setGeocodando(true);
    const pendientes = ruta.paradas.filter(p => !p.tieneGPS && p.domicilio);
    let ok = 0;
    for (const p of pendientes) {
      const coords = await geocodificarUna(p);
      if (coords) {
        try {
          await api.put(`/api/beneficiarios/${p.fsId || p.beneficiarioId}/gps`, coords);
          ok++;
        } catch { /* continua */ }
        await new Promise(res => setTimeout(res, 1100)); // Nominatim rate limit: 1 req/s
      }
    }
    setGeocodando(false);
    setGpsMsg({ id: 'bulk', text: `✅ ${ok} de ${pendientes.length} geolocalizados.`, ok: true });
    await cargar(fecha);
  };

  /* ─── Render ──────────────────────────────────────────────────────────── */
  return (
    <div>
      {/* Header */}
      <div className="section-header">
        <div>
          <h2 className="section-title">🗺️ Mi ruta</h2>
          <p style={{ fontSize: '.82rem', color: 'var(--text3)', marginTop: '.2rem' }}>
            Hoja de ruta diaria
          </p>
        </div>
      </div>

      {/* Selector de fecha */}
      <div className="filter-bar" style={{ marginBottom: '1rem' }}>
        <input
          type="date"
          className="input"
          value={fecha}
          onChange={e => { setFecha(e.target.value); cargar(e.target.value); }}
          style={{ maxWidth: 180 }}
        />
        <button className="btn btn-secondary" style={{ fontSize: '.8rem' }}
          onClick={() => cargar(fecha)}>
          ↻ Actualizar
        </button>
      </div>

      {/* Error */}
      {errLoad && (
        <div style={{ background: 'var(--red-dim)', border: '1px solid rgba(239,68,68,.3)',
          borderRadius: 'var(--radius)', padding: '.65rem .85rem', fontSize: '.82rem',
          color: 'var(--red)', marginBottom: '1rem' }}>
          ⚠️ {errLoad}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', color: 'var(--text3)', padding: '2rem 0' }}>
          <span className="spinner" /> Cargando ruta…
        </div>
      ) : ruta && (
        <>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '.75rem', marginBottom: '1rem' }}>
            <div className="card" style={{ textAlign: 'center', padding: '1rem' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--blue)' }}>{ruta.total}</div>
              <div style={{ fontSize: '.75rem', color: 'var(--text3)' }}>Paradas</div>
            </div>
            <div className="card" style={{ textAlign: 'center', padding: '1rem' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--green)' }}>{ruta.conGPS}</div>
              <div style={{ fontSize: '.75rem', color: 'var(--text3)' }}>Con GPS</div>
            </div>
            <div className="card" style={{ textAlign: 'center', padding: '1rem' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: ruta.sinGPS > 0 ? 'var(--amber)' : 'var(--green)' }}>
                {ruta.sinGPS}
              </div>
              <div style={{ fontSize: '.75rem', color: 'var(--text3)' }}>Sin GPS</div>
            </div>
          </div>

          {/* Mapa */}
          {ruta.conGPS > 0 ? (
            <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
              <MapaRuta key={ruta.paradas.filter(p => p.lat).length} paradas={ruta.paradas} />
            </div>
          ) : (
            <div className="card" style={{ padding: '1rem', marginBottom: '1rem', textAlign: 'center', color: 'var(--text3)', fontSize: '.84rem' }}>
              Sin coordenadas GPS — geocodificá las paradas para ver el mapa.
            </div>
          )}

          {/* Geocodificar pendientes */}
          {ruta.sinGPS > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <button
                className="btn btn-primary"
                disabled={geocodando}
                onClick={geocodificarPendientes}
              >
                {geocodando
                  ? <><span className="spinner" style={{ width: 12, height: 12, borderWidth: '2px' }} /> Geocodificando…</>
                  : `📍 Geocodificar ${ruta.sinGPS} pendiente${ruta.sinGPS !== 1 ? 's' : ''}`}
              </button>
              {gpsMsg?.id === 'bulk' && (
                <span style={{ marginLeft: '1rem', fontSize: '.8rem',
                  color: gpsMsg.ok ? 'var(--green)' : 'var(--red)' }}>
                  {gpsMsg.text}
                </span>
              )}
            </div>
          )}

          {/* Lista de paradas */}
          {ruta.total === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🗺️</div>
              <p>Sin paradas asignadas para esta fecha</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
              {ruta.paradas.map(p => (
                <div key={p.beneficiarioId} className="card"
                  style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', padding: '.75rem 1rem' }}>
                  {/* Número de orden */}
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                    background: p.tieneGPS ? 'var(--blue-dim)' : 'var(--bg4)',
                    border: `2px solid ${p.tieneGPS ? 'var(--blue)' : 'var(--border)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '.82rem', fontWeight: 700,
                    color: p.tieneGPS ? 'var(--blue)' : 'var(--text3)',
                  }}>
                    {p.orden}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '.88rem', fontWeight: 600, color: 'var(--text)' }}>
                      {p.nombre}
                    </div>
                    <div style={{ fontSize: '.78rem', color: 'var(--text3)', marginTop: '.1rem' }}>
                      {p.domicilio || '—'}
                      {(p.horaIngreso && p.horaEgreso) ? (
                        <span style={{ marginLeft: '.4rem' }}>· 🕐 {p.tieneHorariosEspeciales ? 'Variable' : `${p.horaIngreso} - ${p.horaEgreso}`}</span>
                      ) : p.horarioTurno ? (
                        <span style={{ marginLeft: '.4rem' }}>· 🕐 {p.horarioTurno}</span>
                      ) : null}
                    </div>
                    {!p.tieneGPS && (
                      <div style={{ fontSize: '.72rem', color: 'var(--amber)', marginTop: '.1rem' }}>
                        Sin coordenadas GPS
                      </div>
                    )}
                    {gpsMsg?.id === p.beneficiarioId && (
                      <div style={{ fontSize: '.72rem', marginTop: '.2rem',
                        color: gpsMsg.ok ? 'var(--green)' : 'var(--red)' }}>
                        {gpsMsg.text}
                      </div>
                    )}
                  </div>

                  {/* Acción GPS */}
                  <div style={{ flexShrink: 0 }}>
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: '.72rem', padding: '.3rem .6rem' }}
                      onClick={() => actualizarGPS(p)}
                    >
                      📍 {p.tieneGPS ? 'Reubic.' : 'GPS'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {!loading && !ruta && !errLoad && (
        <div className="empty-state">
          <div className="empty-icon">🗺️</div>
          <p>Seleccioná una fecha para ver tu ruta</p>
        </div>
      )}
    </div>
  );
}
