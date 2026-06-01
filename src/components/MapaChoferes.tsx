'use client';
import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

export default function MapaChoferes({ ubicaciones }: { ubicaciones: any[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current) return;

    import('leaflet').then((L) => {
      if (!mapInstanceRef.current) {
        mapInstanceRef.current = L.map(mapRef.current!).setView([-26.82, -65.22], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInstanceRef.current);
      }

      const map = mapInstanceRef.current;
      map.eachLayer((layer: any) => {
        if (layer instanceof L.Marker) map.removeLayer(layer);
      });

      ubicaciones.forEach((u) => {
        if (!u.lat || !u.lng) return;
        L.marker([parseFloat(u.lat), parseFloat(u.lng)])
          .bindPopup(`<b>🚐 ${u.id}</b>`)
          .addTo(map);
      });

      setTimeout(() => map.invalidateSize(), 100);
    });
  }, [ubicaciones]);

  return <div ref={mapRef} style={{ height: '100%', width: '100%' }} />;
}
