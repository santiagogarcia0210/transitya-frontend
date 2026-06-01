'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { serializarFirestore, toArray } from '@/lib/utils';

type Tab = 'usuarios' | 'fiscal';
const INPUT = 'w-full bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-700 focus:outline-none focus:border-blue-500 text-sm';
const EMPTY_USER = { nombre: '', email: '', rol: 'chofer', vehiculo: '', clave: '' };
const EMPTY_FISCAL = { razonSocial: '', cuit: '', domicilio: '', condicionIVA: '' };

export default function AdministradorPage() {
  const [tab, setTab] = useState<Tab>('usuarios');
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUserForm, setShowUserForm] = useState(false);
  const [userForm, setUserForm] = useState(EMPTY_USER);
  const [savingUser, setSavingUser] = useState(false);
  const [userMsg, setUserMsg] = useState('');
  const [fiscalForm, setFiscalForm] = useState(EMPTY_FISCAL);
  const [editingFiscal, setEditingFiscal] = useState(false);
  const [savingFiscal, setSavingFiscal] = useState(false);
  const [fiscalMsg, setFiscalMsg] = useState('');

  const cargarUsuarios = () => {
    api.get('/api/usuarios').then(r => {
      setUsuarios(toArray(r.data).map(serializarFirestore));
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => {
    cargarUsuarios();
    api.get('/api/facturacion/datos-fiscales').then(r => {
      const d = serializarFirestore(r.data);
      setFiscalForm({
        razonSocial: d.razonSocial || d['RAZON SOCIAL'] || '',
        cuit: d.cuit || d.CUIT || '',
        domicilio: d.domicilio || d.DOMICILIO || '',
        condicionIVA: d.condicionIVA || d['CONDICION IVA'] || '',
      });
    }).catch(() => {});
  }, []);

  const setU = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setUserForm(f => ({ ...f, [k]: e.target.value }));

  const setF = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFiscalForm(f => ({ ...f, [k]: e.target.value }));

  const handleSaveUser = async () => {
    setSavingUser(true); setUserMsg('');
    try {
      await api.post('/api/usuarios', userForm);
      setUserMsg('Usuario creado');
      setShowUserForm(false);
      setUserForm(EMPTY_USER);
      cargarUsuarios();
    } catch { setUserMsg('Error al crear usuario'); }
    setSavingUser(false);
  };

  const handleSaveFiscal = async () => {
    setSavingFiscal(true); setFiscalMsg('');
    try {
      await api.put('/api/facturacion/datos-fiscales', fiscalForm);
      setFiscalMsg('Datos fiscales guardados');
      setEditingFiscal(false);
    } catch { setFiscalMsg('Error al guardar'); }
    setSavingFiscal(false);
  };

  const rolBadge = (rol: string) => {
    const r = (rol || '').toLowerCase();
    if (r === 'admin') return 'bg-red-900 text-red-400';
    if (r === 'chofer') return 'bg-blue-900 text-blue-400';
    return 'bg-gray-800 text-gray-400';
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'usuarios', label: '👥 Usuarios' },
    { key: 'fiscal', label: '🏢 Datos fiscales' },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Administrador</h2>
      <div className="flex gap-2 mb-6">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm transition ${tab === t.key ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'usuarios' && (
        <>
          <div className="flex justify-end mb-4">
            <button onClick={() => { setShowUserForm(true); setUserMsg(''); }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm">
              + Nuevo usuario
            </button>
          </div>
          {loading ? <p className="text-gray-400">Cargando...</p> : (
            <div className="space-y-2">
              {usuarios.map((u, i) => (
                <div key={u.id || i} className="bg-gray-900 rounded-xl p-4 flex justify-between items-center">
                  <div>
                    <p className="text-white font-medium">{u.nombre || u.usuario || u.email || `Usuario #${i + 1}`}</p>
                    <p className="text-gray-400 text-sm">{u.email || ''} {u.vehiculo ? `· ${u.vehiculo}` : ''}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${rolBadge(u.rol)}`}>{u.rol || 'sin rol'}</span>
                </div>
              ))}
              {usuarios.length === 0 && <p className="text-gray-400">Sin usuarios.</p>}
            </div>
          )}

          {showUserForm && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
              <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md">
                <h3 className="text-lg font-bold text-white mb-4">Nuevo usuario</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Nombre</label>
                    <input type="text" value={userForm.nombre} onChange={setU('nombre')} className={INPUT} />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Email</label>
                    <input type="email" value={userForm.email} onChange={setU('email')} className={INPUT} />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Rol</label>
                    <select value={userForm.rol} onChange={setU('rol')} className={INPUT}>
                      <option value="admin">admin</option>
                      <option value="chofer">chofer</option>
                      <option value="operador">operador</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Vehículo</label>
                    <input type="text" value={userForm.vehiculo} onChange={setU('vehiculo')} className={INPUT} />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Clave</label>
                    <input type="password" value={userForm.clave} onChange={setU('clave')} className={INPUT} />
                  </div>
                </div>
                {userMsg && <p className={`text-sm mt-3 ${userMsg.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>{userMsg}</p>}
                <div className="flex gap-2 mt-4">
                  <button onClick={() => setShowUserForm(false)}
                    className="flex-1 bg-gray-800 text-gray-400 py-2 rounded-lg text-sm">Cancelar</button>
                  <button onClick={handleSaveUser} disabled={savingUser}
                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm disabled:opacity-50">
                    {savingUser ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'fiscal' && (
        <div className="bg-gray-900 rounded-xl p-6">
          {editingFiscal ? (
            <>
              <div className="space-y-3">
                {([
                  ['razonSocial', 'Razón Social'],
                  ['cuit', 'CUIT'],
                  ['domicilio', 'Domicilio'],
                  ['condicionIVA', 'Condición IVA'],
                ] as [string, string][]).map(([k, label]) => (
                  <div key={k}>
                    <label className="text-gray-400 text-xs mb-1 block">{label}</label>
                    <input type="text" value={(fiscalForm as any)[k]} onChange={setF(k)} className={INPUT} />
                  </div>
                ))}
              </div>
              {fiscalMsg && <p className={`text-sm mt-3 ${fiscalMsg.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>{fiscalMsg}</p>}
              <div className="flex gap-2 mt-4">
                <button onClick={() => setEditingFiscal(false)}
                  className="flex-1 bg-gray-800 text-gray-400 py-2 rounded-lg text-sm">Cancelar</button>
                <button onClick={handleSaveFiscal} disabled={savingFiscal}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm disabled:opacity-50">
                  {savingFiscal ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-3 mb-4">
                {([
                  ['Razón Social', fiscalForm.razonSocial],
                  ['CUIT', fiscalForm.cuit],
                  ['Domicilio', fiscalForm.domicilio],
                  ['Condición IVA', fiscalForm.condicionIVA],
                ] as [string, string][]).map(([label, val]) => (
                  <div key={label} className="flex justify-between border-b border-gray-800 pb-2">
                    <span className="text-gray-400 text-sm">{label}</span>
                    <span className="text-white text-sm">{val || '—'}</span>
                  </div>
                ))}
              </div>
              {fiscalMsg && <p className={`text-sm mb-3 ${fiscalMsg.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>{fiscalMsg}</p>}
              <button onClick={() => setEditingFiscal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm">
                Editar
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
