'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { serializarFirestore } from '@/lib/utils';

type Tab = 'viajes' | 'pasajeros' | 'choferes';

export default function TrasladoPage() {
  const [tab, setTab] = useState<Tab>('viajes');
  const [datos, setDatos] = useState<Record<Tab, any[]>>({ viajes: [], pasajeros: [], choferes: [] });
  const [loading, setLoading] = useState<Record<Tab, boolean>>({ viajes: true, pasajeros: true, choferes: true });

  useEffect(() => {
    const tabs: Tab[] = ['viajes', 'pasajeros', 'choferes'];
    tabs.forEach(t => {
      api.get(`/api/traslado/${t}`).then(r => {
        setDatos(prev => ({ ...prev, [t]: r.data.map(serializarFirestore) }));
        setLoading(prev => ({ ...prev, [t]: false }));
      }).catch(() => setLoading(prev => ({ ...prev, [t]: false })));
    });
  }, []);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'viajes', label: '🚕 Viajes' },
    { key: 'pasajeros', label: '👥 Pasajeros' },
    { key: 'choferes', label: '🚗 Choferes' },
  ];

  const lista = datos[tab];
  const isLoading = loading[tab];

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Traslado</h2>
      <div className="flex gap-2 mb-6">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm transition ${
              tab === t.key ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {isLoading ? <p className="text-gray-400">Cargando...</p> : (
        <div className="space-y-2">
          {lista.map((item, i) => (
            <div key={item.id || i} className="bg-gray-900 rounded-xl p-4">
              {tab === 'viajes' && (
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-white font-medium">{item.pasajero || item.PASAJERO || item.nombre || `Viaje #${i + 1}`}</p>
                    <p className="text-gray-400 text-sm">{item.origen || item.ORIGEN || ''} → {item.destino || item.DESTINO || ''}</p>
                    <p className="text-gray-500 text-xs">{item.chofer || item.CHOFER || ''} · {item.fecha || item.FECHA || ''}</p>
                  </div>
                  <p className="text-blue-400 font-bold">$ {parseFloat(item.monto || item.MONTO || 0).toLocaleString('es-AR')}</p>
                </div>
              )}
              {tab === 'pasajeros' && (
                <div>
                  <p className="text-white font-medium">{item.nombre || item.NOMBRE || item['APELLIDO Y NOMBRE'] || `Pasajero #${i + 1}`}</p>
                  <p className="text-gray-400 text-sm">{item.telefono || item.TELEFONO || ''} · {item.domicilio || item.DOMICILIO || ''}</p>
                </div>
              )}
              {tab === 'choferes' && (
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-white font-medium">{item.nombre || item.NOMBRE || item.usuario || `Chofer #${i + 1}`}</p>
                    <p className="text-gray-400 text-sm">{item.vehiculo || item.VEHICULO || 'Sin vehículo'}</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-blue-900 text-blue-400">Chofer</span>
                </div>
              )}
            </div>
          ))}
          {lista.length === 0 && <p className="text-gray-400">Sin registros.</p>}
        </div>
      )}
    </div>
  );
}
