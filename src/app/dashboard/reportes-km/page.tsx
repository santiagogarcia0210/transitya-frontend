'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { serializarFirestore, toArray } from '@/lib/utils';

const INPUT = 'w-full bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-700 focus:outline-none focus:border-blue-500 text-sm';
const EMPTY = { fecha: '', chofer: '', vehiculo: '', kmInicial: '', kmFinal: '', combustibleLitros: '', combustibleImporte: '' };
const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function mesLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split('-');
  return `${MESES[parseInt(month) - 1] || month} ${year}`;
}

export default function ReportesKMPage() {
  const [lista, setLista] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalKM, setTotalKM] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const kmRecorridos = Math.max(0, (parseFloat(form.kmFinal) || 0) - (parseFloat(form.kmInicial) || 0));

  const cargar = () => {
    api.get('/api/reportes').then(r => {
      const data = toArray(r.data).map(serializarFirestore);
      setLista(data);
      setTotalKM(data.reduce((acc: number, e: any) => acc + (parseFloat(e.kmRecorridos || e['KM RECORRIDOS'] || e.km || 0)), 0));
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { cargar(); }, []);

  const porMes: Record<string, any[]> = {};
  lista.forEach(e => {
    const f = e.fecha || e.FECHA || '';
    const mes = f.slice(0, 7) || 'sin-mes';
    if (!porMes[mes]) porMes[mes] = [];
    porMes[mes].push(e);
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async () => {
    setSaving(true); setMsg('');
    try {
      await api.post('/api/reportes', { ...form, kmRecorridos: kmRecorridos.toString() });
      setMsg('Reporte guardado');
      setShowForm(false);
      setForm(EMPTY);
      cargar();
    } catch { setMsg('Error al guardar'); }
    setSaving(false);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-2xl font-bold text-white">Reportes KM</h2>
        <button onClick={() => { setShowForm(true); setMsg(''); }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm">
          + Nuevo reporte
        </button>
      </div>
      <p className="text-purple-400 text-3xl font-bold mb-6">{totalKM.toLocaleString('es-AR')} km</p>

      {loading ? <p className="text-gray-400">Cargando...</p> : (
        <>
          {Object.entries(porMes).sort((a, b) => b[0].localeCompare(a[0])).map(([mes, items]) => (
            <div key={mes} className="mb-6">
              <h3 className="text-gray-400 text-sm font-semibold mb-2 uppercase tracking-wide">
                {mes === 'sin-mes' ? 'Sin fecha' : mesLabel(mes)}
              </h3>
              <div className="space-y-2">
                {items.map((e, i) => (
                  <div key={e.id || i} className="bg-gray-900 rounded-xl p-4 flex justify-between">
                    <div>
                      <p className="text-white font-medium">{e.chofer || e.CHOFER || 'Sin chofer'} · {e.vehiculo || e.VEHICULO || ''}</p>
                      <p className="text-gray-400 text-sm">
                        {e.fecha || e.FECHA} · Comb: {e.combustibleLitros || e['COMBUSTIBLE LITROS'] || ''} L · $ {e.combustibleImporte || e['COMBUSTIBLE IMPORTE'] || ''}
                      </p>
                    </div>
                    <p className="text-purple-400 font-bold">
                      {parseFloat(e.kmRecorridos || e['KM RECORRIDOS'] || e.km || 0).toLocaleString('es-AR')} km
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {lista.length === 0 && <p className="text-gray-400">Sin registros.</p>}
        </>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-white mb-4">Nuevo reporte KM</h3>
            <div className="space-y-3">
              {([
                ['fecha', 'Fecha', 'date'],
                ['chofer', 'Chofer', 'text'],
                ['vehiculo', 'Vehículo', 'text'],
                ['kmInicial', 'KM Inicial', 'number'],
                ['kmFinal', 'KM Final', 'number'],
              ] as [string, string, string][]).map(([k, label, type]) => (
                <div key={k}>
                  <label className="text-gray-400 text-xs mb-1 block">{label}</label>
                  <input type={type} value={(form as any)[k]} onChange={set(k)} className={INPUT} />
                </div>
              ))}
              <div>
                <label className="text-gray-400 text-xs mb-1 block">KM Recorridos (calculado)</label>
                <input type="number" value={kmRecorridos} readOnly
                  className={`${INPUT} opacity-60 cursor-not-allowed`} />
              </div>
              {([
                ['combustibleLitros', 'Combustible Litros', 'number'],
                ['combustibleImporte', 'Combustible Importe', 'number'],
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
