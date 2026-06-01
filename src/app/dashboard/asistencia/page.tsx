'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { serializarFirestore, toArray } from '@/lib/utils';

export default function AsistenciaPage() {
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [beneficiarios, setBeneficiarios] = useState<any[]>([]);
  const [asistencia, setAsistencia] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/api/beneficiarios'),
      api.get(`/api/asistencia?fecha=${fecha}`).catch(() => ({ data: [] })),
    ]).then(([bRes, aRes]) => {
      const bens = toArray(bRes.data).map(serializarFirestore);
      setBeneficiarios(bens);
      const map: Record<string, boolean> = {};
      bens.forEach(b => { map[b.id] = false; });
      toArray(aRes.data).map(serializarFirestore).forEach((a: any) => {
        const id = a.beneficiarioId || a.id;
        if (id in map) map[id] = a.presente !== false;
      });
      setAsistencia(map);
      setLoading(false);
    });
  }, [fecha]);

  const toggle = (id: string) => setAsistencia(p => ({ ...p, [id]: !p[id] }));

  const guardar = async () => {
    setSaving(true); setMsg('');
    try {
      await api.post('/api/asistencia', {
        fecha,
        asistencias: beneficiarios.map(b => ({
          id: b.id,
          nombre: b.nombre || b['APELLIDO Y NOMBRE'] || b.NOMBRE || '',
          presente: asistencia[b.id] ?? false,
        })),
      });
      setMsg('Asistencia guardada');
    } catch { setMsg('Error al guardar'); }
    setSaving(false);
  };

  const presentes = Object.values(asistencia).filter(Boolean).length;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Asistencia</h2>
        <span className="text-sm text-gray-400">{presentes}/{beneficiarios.length} presentes</span>
      </div>

      <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
        className="bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-700 mb-4 focus:outline-none" />

      {loading ? <p className="text-gray-400">Cargando...</p> : (
        <>
          <div className="space-y-2 mb-4">
            {beneficiarios.map(b => {
              const nombre = b.nombre || b['APELLIDO Y NOMBRE'] || b.NOMBRE || `ID: ${b.id}`;
              const presente = asistencia[b.id] ?? false;
              return (
                <div key={b.id}
                  className="bg-gray-900 rounded-xl p-4 flex justify-between items-center cursor-pointer select-none"
                  onClick={() => toggle(b.id)}>
                  <p className="text-white font-medium">{nombre}</p>
                  <span className={`text-xs px-3 py-1 rounded-full ${presente ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'}`}>
                    {presente ? 'PRESENTE' : 'AUSENTE'}
                  </span>
                </div>
              );
            })}
            {beneficiarios.length === 0 && <p className="text-gray-400">Sin beneficiarios.</p>}
          </div>
          {beneficiarios.length > 0 && (
            <div className="flex items-center gap-3">
              <button onClick={guardar} disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm disabled:opacity-50">
                {saving ? 'Guardando...' : 'Guardar asistencia'}
              </button>
              {msg && <span className={`text-sm ${msg.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>{msg}</span>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
