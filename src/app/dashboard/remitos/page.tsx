'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { serializarFirestore, toArray } from '@/lib/utils';

const INPUT = 'w-full bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-700 focus:outline-none focus:border-blue-500 text-sm';
const EMPTY = { fecha: '', nroRemito: '', chofer: '', vehiculo: '', kmInicial: '', kmFinal: '', litros: '', importe: '' };

export default function RemitosPage() {
  const [lista, setLista] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const cargar = () => {
    api.get('/api/remitos').then(r => {
      setLista(toArray(r.data).map(serializarFirestore));
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { cargar(); }, []);

  const filtrados = lista.filter(r => {
    const q = busqueda.toLowerCase();
    return (r.chofer || r.CHOFER || '').toLowerCase().includes(q) ||
      (r.nroRemito || r['NRO REMITO'] || '').includes(q) ||
      (r.vehiculo || r.VEHICULO || '').toLowerCase().includes(q);
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async () => {
    setSaving(true); setMsg('');
    try {
      await api.post('/api/remitos', form);
      setMsg('Remito guardado');
      setShowForm(false);
      setForm(EMPTY);
      cargar();
    } catch { setMsg('Error al guardar'); }
    setSaving(false);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Remitos</h2>
        <button onClick={() => { setShowForm(true); setMsg(''); }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm">
          + Nuevo remito
        </button>
      </div>

      <input type="text" placeholder="Buscar por chofer, remito o vehículo..." value={busqueda}
        onChange={e => setBusqueda(e.target.value)} className={`${INPUT} mb-4`} />

      {loading ? <p className="text-gray-400">Cargando...</p> : (
        <div className="space-y-2">
          {filtrados.map((r, i) => (
            <div key={r.id || i} className="bg-gray-900 rounded-xl p-4 flex justify-between">
              <div>
                <p className="text-white font-medium">
                  {r.chofer || r.CHOFER || 'Sin chofer'} · Remito #{r.nroRemito || r['NRO REMITO'] || ''}
                </p>
                <p className="text-gray-400 text-sm">
                  {r.fecha || r.FECHA} · {r.vehiculo || r.VEHICULO || ''} · KM: {r.kmInicial || r['KM INICIAL'] || ''}–{r.kmFinal || r['KM FINAL'] || ''}
                </p>
              </div>
              <p className="text-blue-400 font-bold">{r.litros || r.LITROS || ''} L</p>
            </div>
          ))}
          {filtrados.length === 0 && <p className="text-gray-400">Sin remitos.</p>}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-white mb-4">Nuevo remito</h3>
            <div className="space-y-3">
              {([
                ['fecha', 'Fecha', 'date'],
                ['nroRemito', 'N° Remito', 'text'],
                ['chofer', 'Chofer', 'text'],
                ['vehiculo', 'Vehículo', 'text'],
                ['kmInicial', 'KM Inicial', 'number'],
                ['kmFinal', 'KM Final', 'number'],
                ['litros', 'Litros', 'number'],
                ['importe', 'Importe', 'number'],
              ] as [string, string, string][]).map(([k, label, type]) => (
                <div key={k}>
                  <label className="text-gray-400 text-xs mb-1 block">{label}</label>
                  <input type={type} value={(form as any)[k]} onChange={set(k)} className={INPUT} />
                </div>
              ))}
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
