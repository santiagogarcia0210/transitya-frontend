'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { serializarFirestore } from '@/lib/utils';

export default function ChoferesPage() {
  const [lista, setLista] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/usuarios').then(r => {
      setLista(
        r.data.map(serializarFirestore).filter((u: any) => u.rol?.toLowerCase() === 'chofer')
      );
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Choferes</h2>
      {loading ? <p className="text-gray-400">Cargando...</p> : (
        <div className="space-y-2">
          {lista.map(c => (
            <div key={c.id} className="bg-gray-900 rounded-xl p-4 flex justify-between items-center">
              <div>
                <p className="text-white font-medium">{c.nombre || c.usuario}</p>
                <p className="text-gray-400 text-sm">{c.vehiculo || 'Sin vehículo'}</p>
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-blue-900 text-blue-400">Chofer</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
