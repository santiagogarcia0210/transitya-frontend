'use client';
import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

export default function MapaRecorrido({ paradas }: { paradas: any[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current) return;

    import('leaflet').then((L) => {
      if (!mapInstanceRef.current) {
        mapInstanceRef.current = L.map(mapRef.current!).setView([-26.82, -65.22], 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OSM'
        }).addTo(mapInstanceRef.current);
      }

      const map = mapInstanceRef.current;
      map.eachLayer((layer: any) => {
        if (layer instanceof L.Marker || layer instanceof L.Polyline) map.removeLayer(layer);
      });

      const coords: [number, number][] = [];
      paradas.forEach((p, i) => {
        if (!p?.lat || !p?.lng) return;
        const lat = parseFloat(p.lat);
        const lng = parseFloat(p.lng);
        coords.push([lat, lng]);
        L.marker([lat, lng])
          .bindPopup(`<b>${i + 1}. ${p.nombre || 'Sin nombre'}</b><br>${p.domicilio || ''}`)
          .addTo(map);
      });

      if (coords.length > 1) {
        L.polyline(coords, { color: '#7c3aed', weight: 3 }).addTo(map);
        map.fitBounds(coords);
      }

      setTimeout(() => map.invalidateSize(), 100);
    });
  }, [paradas]);

  return <div ref={mapRef} style={{ height: '100%', width: '100%' }} />;
}
