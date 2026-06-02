'use client';
import { use, useEffect, useRef, useState } from 'react';

interface ViajeData {
  id: string;
  estado: string;
  pasajero: string;
  chofer: string;
  origen: string;
  destino: string;
  fecha: string;
  hora: string;
  choferLat?: number | string;
  choferLng?: number | string;
  choferUltimaActualizacion?: string;
}

const ESTADO_COLOR: Record<string, { bg: string; text: string; icon: string }> = {
  Reservado:   { bg:'rgba(107,114,128,.15)',  text:'#9ca3af',  icon:'🕐' },
  Confirmado:  { bg:'rgba(59,130,246,.15)',   text:'#60a5fa',  icon:'✅' },
  'En curso':  { bg:'rgba(245,158,11,.15)',   text:'#fbbf24',  icon:'🚕' },
  Completado:  { bg:'rgba(16,185,129,.15)',   text:'#34d399',  icon:'🏁' },
  Cancelado:   { bg:'rgba(239,68,68,.15)',    text:'#f87171',  icon:'❌' },
};

// Componente mapa aislado (Leaflet no funciona en SSR)
function MapaChofer({ lat, lng, nombre }: { lat: number; lng: number; nombre: string }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInst = useRef<unknown>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current) return;
    import('leaflet').then(L => {
      if (!mapInst.current) {
        const map = L.map(mapRef.current!).setView([lat, lng], 14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM' }).addTo(map);

        const icon = L.divIcon({
          html: '<div style="background:#f59e0b;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.4)">🚕</div>',
          className: '',
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });
        L.marker([lat, lng], { icon }).bindPopup(`<b>${nombre}</b><br>Última posición conocida`).addTo(map).openPopup();
        setTimeout(() => map.invalidateSize(), 100);
        mapInst.current = map;
      }
    });
  }, [lat, lng, nombre]);

  return <div ref={mapRef} style={{ width:'100%', height:280, borderRadius:10, overflow:'hidden' }} />;
}

export default function SeguimientoViajePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [viaje,   setViaje]   = useState<ViajeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    if (!id) return;
    const buscar = async () => {
      setLoading(true); setError('');
      try {
        const res = await fetch(`/api/seguimiento/viaje/${encodeURIComponent(id)}`);
        if (!res.ok) {
          setError(res.status === 404 ? 'Viaje no encontrado.' : 'Error al obtener el viaje.');
          return;
        }
        setViaje(await res.json());
      } catch {
        setError('Error de conexión.');
      } finally { setLoading(false); }
    };
    buscar();
    // Refrescar ubicación cada 30 segundos si viaje en curso
    const interval = setInterval(buscar, 30000);
    return () => clearInterval(interval);
  }, [id]);

  const info = viaje ? (ESTADO_COLOR[viaje.estado] ?? ESTADO_COLOR.Reservado) : null;
  const choferLat = viaje?.choferLat ? parseFloat(String(viaje.choferLat)) : null;
  const choferLng = viaje?.choferLng ? parseFloat(String(viaje.choferLng)) : null;
  const tieneUbicacion = choferLat && choferLng && !isNaN(choferLat) && !isNaN(choferLng);

  return (
    <div style={{
      minHeight:'100vh',
      background:'linear-gradient(135deg,#0f172a 0%,#1e293b 100%)',
      display:'flex', flexDirection:'column', alignItems:'center',
      padding:'2rem 1rem',
      fontFamily:'system-ui,-apple-system,sans-serif',
    }}>
      {/* Header */}
      <div style={{textAlign:'center',marginBottom:'2rem'}}>
        <div style={{fontSize:'2.5rem',marginBottom:'.5rem'}}>🚌</div>
        <h1 style={{fontSize:'1.5rem',fontWeight:800,color:'#f1f5f9',margin:0}}>Transit·Ya</h1>
        <p style={{color:'#94a3b8',fontSize:'.9rem',margin:'.25rem 0 0'}}>Estado de tu viaje</p>
      </div>

      {loading && (
        <div style={{display:'flex',alignItems:'center',gap:'.75rem',color:'#94a3b8',padding:'3rem'}}>
          <div style={{width:24,height:24,border:'3px solid #334155',borderTopColor:'#3b82f6',
            borderRadius:'50%',animation:'spin 1s linear infinite'}}/>
          Cargando información del viaje…
        </div>
      )}

      {error && (
        <div style={{width:'100%',maxWidth:480,background:'rgba(239,68,68,.15)',border:'1px solid rgba(239,68,68,.4)',
          borderRadius:10,padding:'1rem 1.25rem',color:'#fca5a5',fontSize:'.88rem',textAlign:'center'}}>
          ⚠️ {error}
        </div>
      )}

      {viaje && info && (
        <div style={{width:'100%',maxWidth:480,display:'flex',flexDirection:'column',gap:'1rem'}}>

          {/* Card estado */}
          <div style={{background:'#1e293b',borderRadius:12,padding:'1.5rem',border:`2px solid ${info.text}30`}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1.25rem'}}>
              <div>
                <p style={{color:'#64748b',fontSize:'.75rem',marginBottom:'.2rem'}}>ID del viaje</p>
                <p style={{color:'#f1f5f9',fontFamily:'monospace',fontSize:'.9rem',fontWeight:700}}>{viaje.id}</p>
              </div>
              <span style={{display:'inline-flex',alignItems:'center',gap:'.4rem',
                background:info.bg,color:info.text,padding:'.4rem .9rem',
                borderRadius:20,fontSize:'.88rem',fontWeight:700,border:`1px solid ${info.text}30`}}>
                {info.icon} {viaje.estado}
              </span>
            </div>

            <div style={{display:'grid',gap:'.75rem'}}>
              {[
                ['👤','Pasajero',  viaje.pasajero],
                ['🚗','Chofer',    viaje.chofer],
                ['📅','Fecha / Hora', `${viaje.fecha}${viaje.hora?' '+viaje.hora:''}`],
                ['📍','Origen',    viaje.origen],
                ['🏁','Destino',   viaje.destino],
              ].filter(([,,v])=>v).map(([icon,label,val])=>(
                <div key={String(label)} style={{display:'flex',gap:'.75rem',alignItems:'flex-start'}}>
                  <span style={{fontSize:'1rem',flexShrink:0,marginTop:'.1rem'}}>{icon}</span>
                  <div>
                    <p style={{color:'#64748b',fontSize:'.72rem',marginBottom:'.1rem'}}>{label}</p>
                    <p style={{color:'#e2e8f0',fontSize:'.88rem'}}>{String(val)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mapa ubicación chofer */}
          {tieneUbicacion && (
            <div style={{background:'#1e293b',borderRadius:12,padding:'1.25rem',border:'1px solid #334155'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'.75rem'}}>
                <p style={{color:'#f1f5f9',fontWeight:700,fontSize:'.9rem'}}>📍 Ubicación del chofer</p>
                {viaje.choferUltimaActualizacion && (
                  <p style={{color:'#64748b',fontSize:'.72rem'}}>
                    Actualizado: {new Date(viaje.choferUltimaActualizacion).toLocaleTimeString('es-AR')}
                  </p>
                )}
              </div>
              <MapaChofer lat={choferLat!} lng={choferLng!} nombre={viaje.chofer||'Chofer'} />
              {viaje.estado==='En curso'&&(
                <p style={{color:'#94a3b8',fontSize:'.75rem',marginTop:'.5rem',textAlign:'center'}}>
                  🔄 La ubicación se actualiza automáticamente cada 30 segundos
                </p>
              )}
            </div>
          )}

          {!tieneUbicacion && viaje.estado==='En curso' && (
            <div style={{background:'#1e293b',borderRadius:12,padding:'1.25rem',border:'1px solid #334155',
              textAlign:'center',color:'#94a3b8',fontSize:'.85rem'}}>
              📍 El chofer aún no ha compartido su ubicación
            </div>
          )}
        </div>
      )}

      {/* Spinner CSS */}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <p style={{color:'#475569',fontSize:'.78rem',marginTop:'auto',paddingTop:'2rem',textAlign:'center'}}>
        Transit·Ya · Seguimiento en tiempo real
      </p>
    </div>
  );
}
