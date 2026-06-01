'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { serializarFirestore, toArray } from '@/lib/utils';

export default function FacturacionPage() {
  const [facturas, setFacturas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/facturacion/facturas').then(r => {
      setFacturas(toArray(r.data).map(serializarFirestore));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const estadoBadge = (estado: string) => {
    const e = (estado || '').toUpperCase();
    if (e === 'PAGADO') return 'bg-green-900 text-green-400';
    if (e === 'PENDIENTE') return 'bg-yellow-900 text-yellow-400';
    return 'bg-gray-800 text-gray-400';
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Facturación</h2>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition">
          + Nueva factura
        </button>
      </div>
      {loading ? <p className="text-gray-400">Cargando...</p> : (
        <div className="space-y-2">
          {facturas.map((f, i) => (
            <div key={f.id || i} className="bg-gray-900 rounded-xl p-4 flex justify-between items-center">
              <div>
                <p className="text-white font-medium">Nº {f.nro || f.numero || f.nroFactura || i + 1}</p>
                <p className="text-gray-400 text-sm">{f.fecha || f.FECHA} · {f.cliente || f.CLIENTE || ''}</p>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-white font-bold">$ {parseFloat(f.monto || f.MONTO || f.total || 0).toLocaleString('es-AR')}</p>
                <span className={`text-xs px-2 py-1 rounded-full ${estadoBadge(f.estado || f.ESTADO)}`}>
                  {(f.estado || f.ESTADO || 'SIN ESTADO').toUpperCase()}
                </span>
              </div>
            </div>
          ))}
          {facturas.length === 0 && <p className="text-gray-400">Sin facturas.</p>}
        </div>
      )}
    </div>
  );
}
