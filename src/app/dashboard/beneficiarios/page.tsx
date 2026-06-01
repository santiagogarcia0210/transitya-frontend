'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { serializarFirestore } from '@/lib/utils';

const normalizar = (b: any) => ({
  ...b,
  nombre: b.nombre || b['APELLIDO Y NOMBRE'] || b.NOMBRE || 'Sin nombre',
  domicilio: b.domicilio || b.DOMICILIO || b.direccion || 'Sin domicilio',
  dni: b.dni || b.DNI || b.DOCUMENTO || '',
});

export default function BeneficiariosPage() {
  const [lista, setLista] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    api.get('/api/beneficiarios').then(r => {
      setLista(r.data.map(serializarFirestore).map(normalizar));
      setLoading(false);
    });
  }, []);

  const filtrados = lista.filter(b =>
    b.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    b.dni.includes(busqueda)
  );

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Beneficiarios</h2>
      <input
        type="text"
        placeholder="Buscar por nombre o DNI..."
        value={busqueda}
        onChange={e => setBusqueda(e.target.value)}
        className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg border border-gray-700 mb-4 focus:outline-none focus:border-blue-500"
      />
      {loading ? (
        <p className="text-gray-400">Cargando...</p>
      ) : (
        <div className="space-y-2">
          {filtrados.map(b => (
            <div key={b.id} className="bg-gray-900 rounded-xl p-4 flex justify-between items-center">
              <div>
                <p className="text-white font-medium">{b.nombre}</p>
                <p className="text-gray-400 text-sm">{b.domicilio} · DNI: {b.dni}</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${b.lat && b.lng ? 'bg-green-900 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
                {b.lat && b.lng ? '📍 GPS' : 'Sin GPS'}
              </span>
            </div>
          ))}
          {filtrados.length === 0 && <p className="text-gray-400">No hay resultados.</p>}
        </div>
      )}
    </div>
  );
}
