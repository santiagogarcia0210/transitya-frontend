'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { serializarFirestore, toArray } from '@/lib/utils';

const INPUT = 'w-full bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-700 focus:outline-none focus:border-blue-500 text-sm';
const EMPTY = { fecha: '', nroFactura: '', concepto: '', monto: '', obraSocial: '', estado: 'PRESENTADO' };

export default function IngresosPage() {
  const [lista, setLista] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const cargar = () => {
    api.get('/api/ingresos').then(r => {
      const data = toArray(r.data).map(serializarFirestore);
      setLista(data);
      setTotal(data.reduce((acc: number, e: any) => acc + (parseFloat(e.monto || e.MONTO || 0)), 0));
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { cargar(); }, []);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async () => {
    setSaving(true); setMsg('');
    try {
      await api.post('/api/ingresos', form);
      setMsg('Ingreso guardado');
      setShowForm(false);
      setForm(EMPTY);
      cargar();
    } catch { setMsg('Error al guardar'); }
    setSaving(false);
  };

  const marcarCobrado = async (id: string) => {
    try {
      await api.patch(`/api/ingresos/${id}`, { estado: 'COBRADO' });
      cargar();
    } catch { alert('Error al actualizar'); }
  };

  const estadoBadge = (estado: string) =>
    estado.toUpperCase() === 'COBRADO' ? 'bg-green-900 text-green-400' : 'bg-yellow-900 text-yellow-400';

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-2xl font-bold text-white">Ingresos</h2>
        <button onClick={() => { setShowForm(true); setMsg(''); }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm">
          + Nuevo ingreso
        </button>
      </div>
      <p className="text-green-400 text-3xl font-bold mb-6">$ {total.toLocaleString('es-AR')}</p>

      {loading ? <p className="text-gray-400">Cargando...</p> : (
        <div className="space-y-2">
          {lista.map((e, i) => {
            const estado = (e.estado || e.ESTADO || 'PRESENTADO').toUpperCase();
            return (
              <div key={e.id || i} className="bg-gray-900 rounded-xl p-4 flex justify-between items-center">
                <div>
                  <p className="text-white font-medium">{e.concepto || e.CONCEPTO || e.descripcion || 'Sin concepto'}</p>
                  <p className="text-gray-400 text-sm">
                    {e.fecha || e.FECHA} · {e.obraSocial || e['OBRA SOCIAL'] || ''} · Fact. {e.nroFactura || e['NRO FACTURA'] || ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-green-400 font-bold">$ {parseFloat(e.monto || e.MONTO || 0).toLocaleString('es-AR')}</p>
                  <span className={`text-xs px-2 py-1 rounded-full ${estadoBadge(estado)}`}>{estado}</span>
                  {estado !== 'COBRADO' && e.id && (
                    <button onClick={() => marcarCobrado(e.id)}
                      className="text-xs px-2 py-1 bg-blue-900 text-blue-400 rounded-full hover:bg-blue-800">
                      Marcar cobrado
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {lista.length === 0 && <p className="text-gray-400">Sin registros.</p>}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-white mb-4">Nuevo ingreso</h3>
            <div className="space-y-3">
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Fecha</label>
                <input type="date" value={form.fecha} onChange={set('fecha')} className={INPUT} />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">N° Factura</label>
                <input type="text" value={form.nroFactura} onChange={set('nroFactura')} className={INPUT} />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Concepto</label>
                <input type="text" value={form.concepto} onChange={set('concepto')} className={INPUT} />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Monto</label>
                <input type="number" value={form.monto} onChange={set('monto')} className={INPUT} />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Obra Social</label>
                <input type="text" value={form.obraSocial} onChange={set('obraSocial')} className={INPUT} />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Estado</label>
                <select value={form.estado} onChange={set('estado')} className={INPUT}>
                  <option value="PRESENTADO">PRESENTADO</option>
                  <option value="COBRADO">COBRADO</option>
                </select>
              </div>
            </div>
            {msg && <p className={`text-sm mt-3 ${msg.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>{msg}</p>}
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowForm(false)}
                className="flex-1 bg-gray-800 text-gray-400 py-2 rounded-lg text-sm">Cancelar</button>
              <button onClick={handleSubmit} disabled={saving}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm disabled:opacity-50">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
