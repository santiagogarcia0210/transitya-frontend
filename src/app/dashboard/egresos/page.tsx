'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { serializarFirestore, toArray } from '@/lib/utils';

const INPUT = 'w-full bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-700 focus:outline-none focus:border-blue-500 text-sm';
const CATEGORIAS = ['combustible', 'repuesto', 'peaje', 'viático', 'otro'];
const EMPTY = { fecha: '', concepto: '', monto: '', categoria: 'combustible', chofer: '' };

export default function EgresosPage() {
  const [lista, setLista] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const cargar = () => {
    api.get('/api/egresos').then(r => {
      const datos = toArray(r.data).map(serializarFirestore);
      setLista(datos);
      setTotal(datos.reduce((acc: number, e: any) => acc + (parseFloat(e.monto || e.MONTO || 0) || 0), 0));
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { cargar(); }, []);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async () => {
    setSaving(true); setMsg('');
    try {
      await api.post('/api/egresos', form);
      setMsg('Egreso guardado');
      setShowForm(false);
      setForm(EMPTY);
      cargar();
    } catch { setMsg('Error al guardar'); }
    setSaving(false);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-2xl font-bold text-white">Egresos</h2>
        <button onClick={() => { setShowForm(true); setMsg(''); }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm">
          + Nuevo egreso
        </button>
      </div>
      <p className="text-yellow-400 text-3xl font-bold mb-6">$ {total.toLocaleString('es-AR')}</p>

      {loading ? <p className="text-gray-400">Cargando...</p> : (
        <div className="space-y-2">
          {lista.map(e => (
            <div key={e.id} className="bg-gray-900 rounded-xl p-4 flex justify-between">
              <div>
                <p className="text-white font-medium">{e.concepto || e.CONCEPTO}</p>
                <p className="text-gray-400 text-sm">
                  {e.fecha || e.FECHA} · {e.categoria || e.CATEGORIA} · {e.chofer || e.CHOFER || ''}
                </p>
              </div>
              <p className="text-yellow-400 font-bold">$ {parseFloat(e.monto || e.MONTO || 0).toLocaleString('es-AR')}</p>
            </div>
          ))}
          {lista.length === 0 && <p className="text-gray-400">Sin egresos.</p>}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-white mb-4">Nuevo egreso</h3>
            <div className="space-y-3">
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Fecha</label>
                <input type="date" value={form.fecha} onChange={set('fecha')} className={INPUT} />
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
                <label className="text-gray-400 text-xs mb-1 block">Categoría</label>
                <select value={form.categoria} onChange={set('categoria')} className={INPUT}>
                  {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Chofer</label>
                <input type="text" value={form.chofer} onChange={set('chofer')} className={INPUT} />
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
