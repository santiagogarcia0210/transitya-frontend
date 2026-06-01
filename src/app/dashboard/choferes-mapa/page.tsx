'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { toArray } from '@/lib/utils';
import dynamic from 'next/dynamic';

const MapaChoferes = dynamic(() => import('@/components/MapaChoferes'), { ssr: false });

export default function ChoferesMapaPage() {
  const [ubicaciones, setUbicaciones] = useState<any[]>([]);

  const cargar = () => {
    api.get('/api/ubicaciones').then(r => setUbicaciones(toArray(r.data)));
  };

  useEffect(() => {
    cargar();
    const interval = setInterval(cargar, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Choferes en vivo</h2>
        <button onClick={cargar} className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm">🔄 Actualizar</button>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {ubicaciones.map((u, i) => (
          <div key={i} className="bg-gray-900 rounded-xl p-3">
            <p className="text-white font-medium">🚐 {u.id}</p>
            <p className="text-gray-400 text-xs">{u.lat && u.lng ? '📍 En línea' : '⚫ Sin GPS'}</p>
          </div>
        ))}
      </div>
      <div className="bg-gray-900 rounded-xl overflow-hidden" style={{ height: '450px' }}>
        <MapaChoferes ubicaciones={ubicaciones} />
      </div>
    </div>
  );
}
