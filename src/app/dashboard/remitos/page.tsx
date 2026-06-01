'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { serializarFirestore, toArray } from '@/lib/utils';

export default function RemitosPage() {
  const [lista, setLista] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/remitos').then(r => {
      setLista(toArray(r.data).map(serializarFirestore));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Remitos</h2>
      {loading ? <p className="text-gray-400">Cargando...</p> : (
        <div className="space-y-2">
          {lista.map((r, i) => (
            <div key={r.id || i} className="bg-gray-900 rounded-xl p-4 flex justify-between">
              <div>
                <p className="text-white font-medium">{r.chofer || r.CHOFER || 'Sin chofer'}</p>
                <p className="text-gray-400 text-sm">{r.fecha || r.FECHA} · {r.vehiculo || r.VEHICULO || ''}</p>
              </div>
              <p className="text-blue-400 font-bold">{r.litros || r.LITROS || ''} L</p>
            </div>
          ))}
          {lista.length === 0 && <p className="text-gray-400">Sin remitos.</p>}
        </div>
      )}
    </div>
  );
}
