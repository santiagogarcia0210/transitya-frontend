'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { serializarFirestore, toArray } from '@/lib/utils';

const INPUT = 'w-full bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-700 focus:outline-none focus:border-blue-500 text-sm';

const normalizar = (b: any) => ({
  ...b,
  nombre: b.nombre || b['APELLIDO Y NOMBRE'] || b.NOMBRE || 'Sin nombre',
  domicilio: b.domicilio || b.DOMICILIO || b.direccion || '',
  dni: b.dni || b.DNI || b.DOCUMENTO || '',
});

const EMPTY = {
  apellidoNombre: '', dni: '', nroAfiliado: '', domicilio: '', localidad: '',
  telefono: '', prestador: '', obraSocial: '', codigoPrestador: '', dependencia: '',
  horarioIda: '', horarioVuelta: '', observaciones: '',
};

export default function RegistroPage() {
  const [lista, setLista] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const cargar = () => {
    api.get('/api/beneficiarios').then(r => {
      setLista(toArray(r.data).map(serializarFirestore).map(normalizar));
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { cargar(); }, []);

  const filtrados = lista.filter(b =>
    b.nombre.toLowerCase().includes(busqueda.toLowerCase()) || b.dni.includes(busqueda)
  );

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async () => {
    setSaving(true); setMsg('');
    try {
      await api.post('/api/beneficiarios', {
        'APELLIDO Y NOMBRE': form.apellidoNombre,
        DNI: form.dni,
        'N° AFILIADO': form.nroAfiliado,
        DOMICILIO: form.domicilio,
        LOCALIDAD: form.localidad,
        TELEFONO: form.telefono,
        PRESTADOR: form.prestador,
        'OBRA SOCIAL': form.obraSocial,
        'CODIGO PRESTADOR': form.codigoPrestador,
        DEPENDENCIA: form.dependencia,
        'HORARIO IDA': form.horarioIda,
        'HORARIO VUELTA': form.horarioVuelta,
        OBSERVACIONES: form.observaciones,
      });
      setMsg('Alta guardada');
      setShowForm(false);
      setForm(EMPTY);
      cargar();
    } catch { setMsg('Error al guardar'); }
    setSaving(false);
  };

  const handleBaja = async (id: string, nombre: string) => {
    if (!window.confirm(`¿Dar de baja a ${nombre}?`)) return;
    try {
      await api.delete(`/api/beneficiarios/${id}`);
      cargar();
    } catch { alert('Error al dar de baja'); }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Registro</h2>
        <button onClick={() => { setShowForm(true); setMsg(''); }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm">
          + Nueva alta
        </button>
      </div>

      <input type="text" placeholder="Buscar por nombre o DNI..." value={busqueda}
        onChange={e => setBusqueda(e.target.value)} className={`${INPUT} mb-4`} />

      {loading ? <p className="text-gray-400">Cargando...</p> : (
        <div className="space-y-2">
          {filtrados.map(b => (
            <div key={b.id} className="bg-gray-900 rounded-xl p-4 flex justify-between items-center">
              <div>
                <p className="text-white font-medium">{b.nombre}</p>
                <p className="text-gray-400 text-sm">{b.domicilio} · DNI: {b.dni}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded-full ${b.lat && b.lng ? 'bg-green-900 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
                  {b.lat && b.lng ? '📍 GPS' : 'Sin GPS'}
                </span>
                <button onClick={() => handleBaja(b.id, b.nombre)}
                  className="text-xs px-2 py-1 bg-red-900 text-red-400 rounded-full hover:bg-red-800">
                  Dar de baja
                </button>
              </div>
            </div>
          ))}
          {filtrados.length === 0 && <p className="text-gray-400">No hay resultados.</p>}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-white mb-4">Nueva alta</h3>
            <div className="space-y-3">
              {([
                ['apellidoNombre', 'Apellido y Nombre'],
                ['dni', 'DNI'],
                ['nroAfiliado', 'N° Afiliado'],
                ['domicilio', 'Domicilio'],
                ['localidad', 'Localidad'],
                ['telefono', 'Teléfono'],
                ['prestador', 'Prestador'],
                ['obraSocial', 'Obra Social'],
                ['codigoPrestador', 'Código Prestador'],
                ['dependencia', 'Dependencia'],
                ['horarioIda', 'Horario Ida'],
                ['horarioVuelta', 'Horario Vuelta'],
              ] as [string, string][]).map(([k, label]) => (
                <div key={k}>
                  <label className="text-gray-400 text-xs mb-1 block">{label}</label>
                  <input type="text" value={(form as any)[k]} onChange={set(k)} className={INPUT} />
                </div>
              ))}
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Observaciones</label>
                <textarea value={form.observaciones} onChange={set('observaciones')} rows={3}
                  className="w-full bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-700 focus:outline-none focus:border-blue-500 text-sm" />
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
