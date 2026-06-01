'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { serializarFirestore, toArray } from '@/lib/utils';

const INPUT = 'w-full bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-700 focus:outline-none focus:border-blue-500 text-sm';
const TIPOS = ['licencia', 'VTV', 'seguro', 'revisión', 'otro'];
const EMPTY = { descripcion: '', chofer: '', fechaVencimiento: '', tipo: 'licencia' };

function calcularEstado(fechaStr: string): 'VENCIDO' | 'PROXIMO' | 'VIGENTE' {
  if (!fechaStr) return 'VIGENTE';
  const fecha = new Date(fechaStr);
  if (isNaN(fecha.getTime())) return 'VIGENTE';
  const hoy = new Date();
  const diffDias = (fecha.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDias < 0) return 'VENCIDO';
  if (diffDias <= 30) return 'PROXIMO';
  return 'VIGENTE';
}

const badgeClass: Record<string, string> = {
  VENCIDO: 'bg-red-900 text-red-400',
  PROXIMO: 'bg-yellow-900 text-yellow-400',
  VIGENTE: 'bg-green-900 text-green-400',
};

export default function VencimientosPage() {
  const [lista, setLista] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const cargar = () => {
    api.get('/api/vencimientos').then(r => {
      setLista(toArray(r.data).map(serializarFirestore));
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { cargar(); }, []);

  const ordenada = [...lista].sort((a, b) => {
    const orden = { VENCIDO: 0, PROXIMO: 1, VIGENTE: 2 };
    return orden[calcularEstado(a.fechaVencimiento || a.fecha || a.FECHA)] -
      orden[calcularEstado(b.fechaVencimiento || b.fecha || b.FECHA)];
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async () => {
    setSaving(true); setMsg('');
    try {
      await api.post('/api/vencimientos', form);
      setMsg('Vencimiento guardado');
      setShowForm(false);
      setForm(EMPTY);
      cargar();
    } catch { setMsg('Error al guardar'); }
    setSaving(false);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Vencimientos</h2>
        <button onClick={() => { setShowForm(true); setMsg(''); }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm">
          + Nuevo
        </button>
      </div>

      {loading ? <p className="text-gray-400">Cargando...</p> : (
        <div className="space-y-2">
          {ordenada.map((v, i) => {
            const fechaStr = v.fechaVencimiento || v.fecha || v.FECHA || '';
            const estado = calcularEstado(fechaStr);
            return (
              <div key={v.id || i} className="bg-gray-900 rounded-xl p-4 flex justify-between items-center">
                <div>
                  <p className="text-white font-medium">{v.descripcion || v.DESCRIPCION || v.documento || 'Sin descripción'}</p>
                  <p className="text-gray-400 text-sm">{v.chofer || v.CHOFER || ''} · {v.tipo || v.TIPO || ''}</p>
                </div>
                <div className="flex items-center gap-2 text-right">
                  <p className="text-gray-400 text-sm">{fechaStr || 'Sin fecha'}</p>
                  <span className={`text-xs px-2 py-1 rounded-full ${badgeClass[estado]}`}>{estado}</span>
                </div>
              </div>
            );
          })}
          {ordenada.length === 0 && <p className="text-gray-400">Sin vencimientos.</p>}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-white mb-4">Nuevo vencimiento</h3>
            <div className="space-y-3">
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Descripción</label>
                <input type="text" value={form.descripcion} onChange={set('descripcion')} className={INPUT} />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Chofer</label>
                <input type="text" value={form.chofer} onChange={set('chofer')} className={INPUT} />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Fecha Vencimiento</label>
                <input type="date" value={form.fechaVencimiento} onChange={set('fechaVencimiento')} className={INPUT} />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Tipo</label>
                <select value={form.tipo} onChange={set('tipo')} className={INPUT}>
                  {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
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
