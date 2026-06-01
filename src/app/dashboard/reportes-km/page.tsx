'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { serializarFirestore } from '@/lib/utils';

export default function ReportesKMPage() {
  const [lista, setLista] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalKM, setTotalKM] = useState(0);

  useEffect(() => {
    api.get('/api/reportes').then(r => {
      const data = r.data.map(serializarFirestore);
      setLista(data);
      setTotalKM(data.reduce((acc: number, e: any) => acc + (parseFloat(e.kmRecorridos || e['KM RECORRIDOS'] || e.km || 0)), 0));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-2">Reportes KM</h2>
      <p className="text-purple-400 text-3xl font-bold mb-6">{totalKM.toLocaleString('es-AR')} km</p>
      {loading ? <p className="text-gray-400">Cargando...</p> : (
        <div className="space-y-2">
          {lista.map((e, i) => (
            <div key={e.id || i} className="bg-gray-900 rounded-xl p-4 flex justify-between">
              <div>
                <p className="text-white font-medium">{e.chofer || e.CHOFER || 'Sin chofer'}</p>
                <p className="text-gray-400 text-sm">{e.fecha || e.FECHA} · {e.vehiculo || e.VEHICULO || ''}</p>
              </div>
              <p className="text-purple-400 font-bold">{parseFloat(e.kmRecorridos || e['KM RECORRIDOS'] || e.km || 0).toLocaleString('es-AR')} km</p>
            </div>
          ))}
          {lista.length === 0 && <p className="text-gray-400">Sin registros.</p>}
        </div>
      )}
    </div>
  );
}
