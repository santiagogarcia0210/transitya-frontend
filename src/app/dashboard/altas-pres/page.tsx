'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';

interface Registro {
  id: string;
  [key: string]: unknown;
}

const CAMPOS_DEFAULT = [
  'APELLIDO Y NOMBRE', 'DNI', 'N° AFILIADO', 'OBRA SOCIAL',
  'FECHA ALTA', 'CHOFER', 'DOMICILIO', 'LOCALIDAD', 'TIPO PRES', 'ESTADO', 'OBSERVACIONES'
];

export default function AltasPresPage() {
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [headers,   setHeaders]   = useState<string[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [busqueda,  setBusqueda]  = useState('');
  const [modal,     setModal]     = useState(false);
  const [form,      setForm]      = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [msg,       setMsg]       = useState('');

  useEffect(() => { cargarDatos(); }, []);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/facturacion/datos/altas');
      setRegistros(r.data.registros || []);
      setHeaders(r.data.headers || []);
    } catch {
      setMsg('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const camposActivos = headers.length > 0 ? headers.slice(0, 11) : CAMPOS_DEFAULT;

  const filtrados = busqueda
    ? registros.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(busqueda.toLowerCase())))
    : registros;

  const abrirModal = () => {
    const f: Record<string, string> = {};
    camposActivos.forEach(h => { f[h] = ''; });
    f['FECHA ALTA'] = new Date().toLocaleDateString('es-AR');
    f['ESTADO'] = 'PENDIENTE';
    setForm(f); setModal(true); setMsg('');
  };

  const handleGuardar = async () => {
    if (!form['APELLIDO Y NOMBRE'] && !form[camposActivos[0]]) {
      setMsg('❌ Completá el nombre del beneficiario');
      return;
    }
    setGuardando(true);
    try {
      await api.post('/api/facturacion/datos/altas', form);
      setMsg('✅ Alta registrada');
      setModal(false);
      cargarDatos();
    } catch {
      setMsg('❌ Error al guardar');
    } finally {
      setGuardando(false);
    }
  };

  const estadoBadge = (estado: string) => {
    const s = String(estado || '').toUpperCase();
    if (s === 'APROBADO' || s === 'ACTIVO') return <span className="badge badge-green">{estado}</span>;
    if (s === 'RECHAZADO' || s === 'BAJA') return <span className="badge badge-red">{estado}</span>;
    if (s === 'PENDIENTE') return <span className="badge badge-amber">Pendiente</span>;
    return <span className="badge badge-gray">{estado || '—'}</span>;
  };

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">📋 Altas (PRES IS)</h2>
        <button className="btn btn-primary" onClick={abrirModal}>+ Nueva alta</button>
      </div>

      {msg && (
        <div style={{ marginBottom: '1rem', padding: '.65rem 1rem', borderRadius: 'var(--radius)', background: msg.startsWith('✅') ? 'var(--green-dim)' : 'var(--red-dim)', color: msg.startsWith('✅') ? 'var(--green)' : 'var(--red)', border: `1px solid ${msg.startsWith('✅') ? 'rgba(16,185,129,.3)' : 'rgba(239,68,68,.3)'}` }}>
          {msg}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
        {[
          { label: 'Total altas', value: registros.length, color: 'var(--blue)' },
          { label: 'Pendientes', value: registros.filter(r => String(r['ESTADO'] || '').toUpperCase() === 'PENDIENTE').length, color: 'var(--amber)' },
          { label: 'Aprobadas', value: registros.filter(r => ['APROBADO','ACTIVO'].includes(String(r['ESTADO'] || '').toUpperCase())).length, color: 'var(--green)' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <p className="stat-label">{s.label}</p>
            <p className="stat-value" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="filter-bar">
        <input className="input" placeholder="Buscar por nombre, DNI, obra social…" value={busqueda} onChange={e => setBusqueda(e.target.value)} style={{ maxWidth: '320px' }} />
        <span style={{ color: 'var(--text3)', fontSize: '.82rem' }}>{filtrados.length} de {registros.length}</span>
        <button className="btn btn-secondary" onClick={cargarDatos} style={{ marginLeft: 'auto' }}>↻</button>
      </div>

      {/* Tabla */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', color: 'var(--text3)', padding: '2rem' }}>
          <span className="spinner" /> Cargando…
        </div>
      ) : filtrados.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-icon">📋</div>
          <p>Sin altas PRES IS registradas</p>
          <p style={{ marginTop: '.5rem', fontSize: '.8rem' }}>Registrá las altas de prestación para los beneficiarios</p>
        </div>
      ) : (
        <div className="tabla-wrap">
          <table className="tabla">
            <thead>
              <tr>
                <th>Beneficiario</th>
                <th>DNI</th>
                <th>N° Afiliado</th>
                <th>Obra Social</th>
                <th>Fecha Alta</th>
                <th>Tipo Pres.</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(reg => (
                <tr key={reg.id}>
                  <td style={{ fontWeight: 500, color: 'var(--text)' }}>{String(reg['APELLIDO Y NOMBRE'] || '—')}</td>
                  <td>{String(reg['DNI'] || '—')}</td>
                  <td>{String(reg['N° AFILIADO'] || '—')}</td>
                  <td>{String(reg['OBRA SOCIAL'] || '—')}</td>
                  <td>{String(reg['FECHA ALTA'] || '—')}</td>
                  <td>{String(reg['TIPO PRES'] || '—')}</td>
                  <td>{estadoBadge(String(reg['ESTADO'] || ''))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '600px' }}>
            <p className="modal-title">📋 Nueva Alta PRES IS</p>
            <div className="form-grid form-grid-2">
              {camposActivos.map(h => (
                <div key={h} style={h === 'OBSERVACIONES' ? { gridColumn: '1 / -1' } : {}}>
                  <label className="label">{h}</label>
                  {h === 'ESTADO' ? (
                    <select className="select" value={form[h] || ''} onChange={e => setForm(f => ({ ...f, [h]: e.target.value }))}>
                      <option value="PENDIENTE">Pendiente</option>
                      <option value="APROBADO">Aprobado</option>
                      <option value="ACTIVO">Activo</option>
                      <option value="BAJA">Baja</option>
                      <option value="RECHAZADO">Rechazado</option>
                    </select>
                  ) : h === 'OBSERVACIONES' ? (
                    <textarea className="textarea" rows={3} value={form[h] || ''} onChange={e => setForm(f => ({ ...f, [h]: e.target.value }))} />
                  ) : (
                    <input className="input" value={form[h] || ''} onChange={e => setForm(f => ({ ...f, [h]: e.target.value }))} />
                  )}
                </div>
              ))}
            </div>
            {msg && <p style={{ color: 'var(--red)', fontSize: '.85rem', marginTop: '.75rem' }}>{msg}</p>}
            <div style={{ display: 'flex', gap: '.5rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button className="btn btn-secondary" onClick={() => { setModal(false); setMsg(''); }}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleGuardar} disabled={guardando}>
                {guardando ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Guardar alta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
