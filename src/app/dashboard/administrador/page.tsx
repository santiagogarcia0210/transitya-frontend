'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { serializarFirestore } from '@/lib/utils';

type Tab = 'usuarios' | 'fiscal';

export default function AdministradorPage() {
  const [tab, setTab] = useState<Tab>('usuarios');
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [fiscal, setFiscal] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/usuarios').then(r => {
      setUsuarios(r.data.map(serializarFirestore));
      setLoading(false);
    }).catch(() => setLoading(false));

    api.get('/api/facturacion/datos-fiscales').then(r => {
      setFiscal(serializarFirestore(r.data));
    }).catch(() => {});
  }, []);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'usuarios', label: '👥 Usuarios' },
    { key: 'fiscal', label: '🏢 Datos fiscales' },
  ];

  const rolBadge = (rol: string) => {
    const r = (rol || '').toLowerCase();
    if (r === 'admin') return 'bg-red-900 text-red-400';
    if (r === 'chofer') return 'bg-blue-900 text-blue-400';
    return 'bg-gray-800 text-gray-400';
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Administrador</h2>
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

      {tab === 'usuarios' && (
        loading ? <p className="text-gray-400">Cargando...</p> : (
          <div className="space-y-2">
            {usuarios.map((u, i) => (
              <div key={u.id || i} className="bg-gray-900 rounded-xl p-4 flex justify-between items-center">
                <div>
                  <p className="text-white font-medium">{u.nombre || u.usuario || u.email || `Usuario #${i + 1}`}</p>
                  <p className="text-gray-400 text-sm">{u.email || ''}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${rolBadge(u.rol)}`}>
                  {u.rol || 'sin rol'}
                </span>
              </div>
            ))}
            {usuarios.length === 0 && <p className="text-gray-400">Sin usuarios.</p>}
          </div>
        )
      )}

      {tab === 'fiscal' && (
        fiscal ? (
          <div className="bg-gray-900 rounded-xl p-6 space-y-3">
            {Object.entries(fiscal).filter(([k]) => k !== 'id').map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-gray-800 pb-2">
                <span className="text-gray-400 text-sm capitalize">{k.replace(/([A-Z])/g, ' $1').toLowerCase()}</span>
                <span className="text-white text-sm">{String(v)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-gray-900 rounded-xl p-8 text-center">
            <p className="text-gray-400">Sin datos fiscales cargados.</p>
          </div>
        )
      )}
    </div>
  );
}
