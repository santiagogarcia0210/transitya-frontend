'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { serializarFirestore } from '@/lib/utils';

export default function AsistenciaPage() {
  const [lista, setLista] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);

  const cargar = () => {
    setLoading(true);
    api.get(`/api/asistencia?fecha=${fecha}`).then(r => {
      setLista(r.data.map(serializarFirestore));
      setLoading(false);
    });
  };

  useEffect(() => { cargar(); }, [fecha]);

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Asistencia</h2>
      <input
        type="date"
        value={fecha}
        onChange={e => setFecha(e.target.value)}
        className="bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-700 mb-4 focus:outline-none"
      />
      {loading ? <p className="text-gray-400">Cargando...</p> : (
        <div className="space-y-2">
          {lista.length === 0 && <p className="text-gray-400">Sin registros para esta fecha.</p>}
          {lista.map(a => (
            <div key={a.id} className="bg-gray-900 rounded-xl p-4">
              <p className="text-white font-medium">{a.nombre || a.beneficiario}</p>
              <p className="text-gray-400 text-sm">{a.chofer} · {a.estado}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
