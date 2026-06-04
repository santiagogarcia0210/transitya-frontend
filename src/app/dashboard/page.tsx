'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';

interface Stats {
  beneficiarios: number;
  usuarios: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({ beneficiarios: 0, usuarios: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [benef, usuarios] = await Promise.all([
          api.get('/api/beneficiarios'),
          api.get('/api/usuarios')
        ]);
        setStats({
          beneficiarios: benef.data.length,
          usuarios: usuarios.data.length
        });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const cards = [
    { label: 'Beneficiarios activos', value: stats.beneficiarios, color: 'text-blue-400' },
    { label: 'Usuarios', value: stats.usuarios, color: 'text-green-400' },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Dashboard</h2>
      {loading ? (
        <p className="text-gray-400">Cargando...</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 mb-8">
          {cards.map(card => (
            <div key={card.label} className="bg-gray-900 rounded-xl p-6">
              <p className="text-gray-400 text-sm mb-1">{card.label}</p>
              <p className={`text-4xl font-bold ${card.color}`}>{card.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
