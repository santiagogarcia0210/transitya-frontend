'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { serializarFirestore, toArray } from '@/lib/utils';

export default function EgresosPage() {
  const [lista, setLista] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    api.get('/api/egresos').then(r => {
      const datos = toArray(r.data).map(serializarFirestore);
      setLista(datos);
      console.log('[EGRESOS] first item:', JSON.stringify(datos[0]));
      setTotal(datos.reduce((acc: number, e: any) => acc + (parseFloat(e.monto) || 0), 0));
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-2">Egresos</h2>
      <p className="text-yellow-400 text-3xl font-bold mb-6">$ {total.toLocaleString('es-AR')}</p>
      {loading ? <p className="text-gray-400">Cargando...</p> : (
        <div className="space-y-2">
          {lista.map(e => (
            <div key={e.id} className="bg-gray-900 rounded-xl p-4 flex justify-between">
              <div>
                <p className="text-white font-medium">{e.concepto}</p>
                <p className="text-gray-400 text-sm">{e.fecha} · {e.categoria}</p>
              </div>
              <p className="text-yellow-400 font-bold">$ {parseFloat(e.monto || 0).toLocaleString('es-AR')}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
