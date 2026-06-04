'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { serializarFirestore } from '@/lib/utils';

export default function IngresosPage() {
  const [lista, setLista] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    api.get('/api/ingresos').then(r => {
      const data = r.data.map(serializarFirestore);
      setLista(data);
      setTotal(data.reduce((acc: number, e: any) => acc + (parseFloat(e.monto || e.MONTO || 0)), 0));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-2">Ingresos</h2>
      <p className="text-green-400 text-3xl font-bold mb-6">$ {total.toLocaleString('es-AR')}</p>
      {loading ? <p className="text-gray-400">Cargando...</p> : (
        <div className="space-y-2">
          {lista.map((e, i) => (
            <div key={e.id || i} className="bg-gray-900 rounded-xl p-4 flex justify-between">
              <div>
                <p className="text-white font-medium">{e.concepto || e.CONCEPTO || e.descripcion || 'Sin concepto'}</p>
                <p className="text-gray-400 text-sm">{e.fecha || e.FECHA} · {e.obraSocial || e['OBRA SOCIAL'] || ''}</p>
              </div>
              <p className="text-green-400 font-bold">$ {parseFloat(e.monto || e.MONTO || 0).toLocaleString('es-AR')}</p>
            </div>
          ))}
          {lista.length === 0 && <p className="text-gray-400">Sin registros.</p>}
        </div>
      )}
    </div>
  );
}
