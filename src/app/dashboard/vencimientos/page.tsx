'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { serializarFirestore } from '@/lib/utils';

function calcularEstado(fechaStr: string): 'VENCIDO' | 'PROXIMO' | 'VIGENTE' {
  if (!fechaStr) return 'VIGENTE';
  const fecha = new Date(fechaStr);
  if (isNaN(fecha.getTime())) return 'VIGENTE';
  const hoy = new Date();
  const diffDias = (fecha.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDias < 0) return 'VENCIDO';
  if (diffDias <= 30) return 'PROXIMO';
  return 'VIGENTE';
}

const badgeClass: Record<string, string> = {
  VENCIDO: 'bg-red-900 text-red-400',
  PROXIMO: 'bg-yellow-900 text-yellow-400',
  VIGENTE: 'bg-green-900 text-green-400',
};

export default function VencimientosPage() {
  const [lista, setLista] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/vencimientos').then(r => {
      setLista(r.data.map(serializarFirestore));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const ordenada = [...lista].sort((a, b) => {
    const orden = { VENCIDO: 0, PROXIMO: 1, VIGENTE: 2 };
    return orden[calcularEstado(a.fecha || a.FECHA)] - orden[calcularEstado(b.fecha || b.FECHA)];
  });

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Vencimientos</h2>
      {loading ? <p className="text-gray-400">Cargando...</p> : (
        <div className="space-y-2">
          {ordenada.map((v, i) => {
            const fechaStr = v.fecha || v.FECHA || '';
            const estado = calcularEstado(fechaStr);
            return (
              <div key={v.id || i} className="bg-gray-900 rounded-xl p-4 flex justify-between items-center">
                <div>
                  <p className="text-white font-medium">{v.descripcion || v.DESCRIPCION || v.documento || 'Sin descripción'}</p>
                  <p className="text-gray-400 text-sm">{v.chofer || v.CHOFER || ''}</p>
                </div>
                <div className="flex items-center gap-2 text-right">
                  <p className="text-gray-400 text-sm">{fechaStr || 'Sin fecha'}</p>
                  <span className={`text-xs px-2 py-1 rounded-full ${badgeClass[estado]}`}>{estado}</span>
                </div>
              </div>
            );
          })}
          {ordenada.length === 0 && <p className="text-gray-400">Sin vencimientos.</p>}
        </div>
      )}
    </div>
  );
}
