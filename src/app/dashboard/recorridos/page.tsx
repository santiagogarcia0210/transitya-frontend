'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { serializarFirestore, toArray } from '@/lib/utils';
import dynamic from 'next/dynamic';

const MapaRecorrido = dynamic(() => import('@/components/MapaRecorrido'), { ssr: false });

const normalizar = (b: any) => ({
  ...b,
  nombre: b.nombre || b['APELLIDO Y NOMBRE'] || b.NOMBRE || 'Sin nombre',
  domicilio: b.domicilio || b.DOMICILIO || b.direccion || 'Sin domicilio',
});

export default function RecorridosPage() {
  const [beneficiarios, setBeneficiarios] = useState<any[]>([]);
  const [optimizado, setOptimizado] = useState<any>(null);
  const [loadingIA, setLoadingIA] = useState(false);

  useEffect(() => {
    api.get('/api/beneficiarios').then(r => {
      const conGPS = toArray(r.data)
        .map(serializarFirestore)
        .filter((b: any) => b.lat && b.lng && parseFloat(b.lat) !== 0 && parseFloat(b.lng) !== 0)
        .map(normalizar);
      setBeneficiarios(conGPS);
    });
  }, []);

  const optimizar = async () => {
    setLoadingIA(true);
    try {
      const r = await api.post('/api/ia/optimizar-recorrido', {
        paradas: beneficiarios.map(b => ({ nombre: b.nombre, domicilio: b.domicilio, lat: b.lat, lng: b.lng }))
      });
      setOptimizado(r.data.resultado);
    } catch(e) { console.error(e); }
    finally { setLoadingIA(false); }
  };

  const paradasOrdenadas = optimizado
    ? optimizado.orden.map((i: number) => beneficiarios[i])
    : beneficiarios;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Recorridos</h2>
        {beneficiarios.length >= 3 && (
          <button
            onClick={optimizar}
            disabled={loadingIA}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition disabled:opacity-50"
          >
            {loadingIA ? 'Consultando IA...' : '✨ Optimizar con IA'}
          </button>
        )}
      </div>
      {optimizado && (
        <div className="bg-gray-900 rounded-xl p-4 mb-4">
          <p className="text-white">📏 {optimizado.distancia_estimada_km} km estimados</p>
          <p className="text-gray-400 text-sm mt-1">{optimizado.explicacion}</p>
        </div>
      )}
      <div className="bg-gray-900 rounded-xl overflow-hidden mb-4" style={{ height: '400px' }}>
        <MapaRecorrido paradas={paradasOrdenadas} />
      </div>
      <div className="space-y-2">
        {paradasOrdenadas.map((b: any, i: number) => (
          <div key={b.id} className="bg-gray-900 rounded-xl p-4 flex items-center gap-4">
            <span className="text-purple-400 font-bold text-lg w-8">{i + 1}</span>
            <div>
              <p className="text-white font-medium">{b.nombre || 'Sin nombre'}</p>
              <p className="text-gray-400 text-sm">{b.domicilio || 'Sin domicilio'}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
