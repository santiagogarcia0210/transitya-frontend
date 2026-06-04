'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { serializarFirestore } from '@/lib/utils';

type Tab = 'envios' | 'repartidores' | 'clientes';

export default function PaqueteriaPage() {
  const [tab, setTab] = useState<Tab>('envios');
  const [datos, setDatos] = useState<Record<Tab, any[]>>({ envios: [], repartidores: [], clientes: [] });
  const [loading, setLoading] = useState<Record<Tab, boolean>>({ envios: true, repartidores: true, clientes: true });

  useEffect(() => {
    const tabs: Tab[] = ['envios', 'repartidores', 'clientes'];
    tabs.forEach(t => {
      api.get(`/api/paqueteria/${t}`).then(r => {
        setDatos(prev => ({ ...prev, [t]: r.data.map(serializarFirestore) }));
        setLoading(prev => ({ ...prev, [t]: false }));
      }).catch(() => setLoading(prev => ({ ...prev, [t]: false })));
    });
  }, []);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'envios', label: '📦 Envíos' },
    { key: 'repartidores', label: '🚴 Repartidores' },
    { key: 'clientes', label: '👤 Clientes' },
  ];

  const lista = datos[tab];
  const isLoading = loading[tab];

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Paquetería</h2>
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
              {tab === 'envios' && (
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-white font-medium">{item.descripcion || item.paquete || item.DESCRIPCION || `Envío #${i + 1}`}</p>
                    <p className="text-gray-400 text-sm">{item.cliente || item.CLIENTE || ''} · {item.repartidor || item.REPARTIDOR || ''}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${(item.estado || '').toUpperCase() === 'ENTREGADO' ? 'bg-green-900 text-green-400' : 'bg-yellow-900 text-yellow-400'}`}>
                    {item.estado || item.ESTADO || 'PENDIENTE'}
                  </span>
                </div>
              )}
              {tab === 'repartidores' && (
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-white font-medium">{item.nombre || item.NOMBRE || `Repartidor #${i + 1}`}</p>
                    <p className="text-gray-400 text-sm">{item.telefono || item.TELEFONO || ''} · {item.zona || item.ZONA || ''}</p>
                  </div>
                </div>
              )}
              {tab === 'clientes' && (
                <div>
                  <p className="text-white font-medium">{item.nombre || item.NOMBRE || item.razonSocial || `Cliente #${i + 1}`}</p>
                  <p className="text-gray-400 text-sm">{item.telefono || item.TELEFONO || ''} · {item.direccion || item.DIRECCION || ''}</p>
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
