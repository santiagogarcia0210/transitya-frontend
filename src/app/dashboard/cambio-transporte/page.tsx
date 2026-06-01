'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';

interface Registro {
  id: string;
  [key: string]: unknown;
}

const CAMPOS_DEFAULT = [
  'APELLIDO Y NOMBRE', 'DNI', 'N° AFILIADO', 'OBRA SOCIAL',
  'PRESTADOR ACTUAL', 'PRESTADOR NUEVO', 'FECHA', 'MOTIVO', 'ESTADO', 'OBSERVACIONES'
];

export default function CambioTransportePage() {
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [headers,   setHeaders]   = useState<string[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [busqueda,  setBusqueda]  = useState('');
  const [modal,     setModal]     = useState(false);
  const [form,      setForm]      = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [msg,       setMsg]       = useState('');
  const [vista,     setVista]     = useState<Registro | null>(null);

  useEffect(() => { cargarDatos(); }, []);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/facturacion/datos/cambio-transporte');
      setRegistros(r.data.registros || []);
      setHeaders(r.data.headers || []);
    } catch {
      setMsg('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const camposActivos = headers.length > 0 ? headers.slice(0, 10) : CAMPOS_DEFAULT;

  const filtrados = busqueda
    ? registros.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(busqueda.toLowerCase())))
    : registros;

  const abrirModal = () => {
    const f: Record<string, string> = {};
    camposActivos.forEach(h => { f[h] = ''; });
    f['FECHA'] = new Date().toLocaleDateString('es-AR');
    f['ESTADO'] = 'PENDIENTE';
    setForm(f); setModal(true); setMsg('');
  };

  const handleGuardar = async () => {
    if (!form['APELLIDO Y NOMBRE'] && !form[camposActivos[0]]) {
      setMsg('❌ Completá al menos el nombre del beneficiario');
      return;
    }
    setGuardando(true);
    try {
      await api.post('/api/facturacion/datos/cambio-transporte', form);
      setMsg('✅ Nota guardada');
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
    if (s === 'APROBADO') return <span className="badge badge-green">Aprobado</span>;
    if (s === 'RECHAZADO') return <span className="badge badge-red">Rechazado</span>;
    if (s === 'PENDIENTE') return <span className="badge badge-amber">Pendiente</span>;
    return <span className="badge badge-gray">{estado || '—'}</span>;
  };

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">🔄 Nota de Cambio de Transporte</h2>
        <button className="btn btn-primary" onClick={abrirModal}>+ Nueva nota</button>
      </div>

      {msg && (
        <div style={{ marginBottom: '1rem', padding: '.65rem 1rem', borderRadius: 'var(--radius)', background: msg.startsWith('✅') ? 'var(--green-dim)' : 'var(--red-dim)', color: msg.startsWith('✅') ? 'var(--green)' : 'var(--red)', border: `1px solid ${msg.startsWith('✅') ? 'rgba(16,185,129,.3)' : 'rgba(239,68,68,.3)'}` }}>
          {msg}
        </div>
      )}

      {/* Estadísticas rápidas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
        {[
          { label: 'Total notas', value: registros.length, color: 'var(--blue)' },
          { label: 'Pendientes', value: registros.filter(r => String(r['ESTADO'] || '').toUpperCase() === 'PENDIENTE').length, color: 'var(--amber)' },
          { label: 'Aprobadas', value: registros.filter(r => String(r['ESTADO'] || '').toUpperCase() === 'APROBADO').length, color: 'var(--green)' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <p className="stat-label">{s.label}</p>
            <p className="stat-value" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Buscador */}
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
          <div className="empty-icon">🔄</div>
          <p>Sin notas de cambio de transporte</p>
          <p style={{ marginTop: '.5rem', fontSize: '.8rem' }}>Registrá cuando un beneficiario cambia de prestador</p>
        </div>
      ) : (
        <div className="tabla-wrap">
          <table className="tabla">
            <thead>
              <tr>
                <th>Beneficiario</th>
                <th>DNI</th>
                <th>Prestador Actual</th>
                <th>Prestador Nuevo</th>
                <th>Fecha</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(reg => (
                <tr key={reg.id}>
                  <td style={{ fontWeight: 500, color: 'var(--text)' }}>{String(reg['APELLIDO Y NOMBRE'] || reg[camposActivos[0]] || '—')}</td>
                  <td>{String(reg['DNI'] || '—')}</td>
                  <td>{String(reg['PRESTADOR ACTUAL'] || '—')}</td>
                  <td>{String(reg['PRESTADOR NUEVO'] || '—')}</td>
                  <td>{String(reg['FECHA'] || '—')}</td>
                  <td>{estadoBadge(String(reg['ESTADO'] || ''))}</td>
                  <td>
                    <button className="btn btn-secondary" style={{ fontSize: '.75rem', padding: '.25rem .6rem' }} onClick={() => setVista(reg)}>Ver</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal nueva nota */}
      {modal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '600px' }}>
            <p className="modal-title">🔄 Nueva nota de cambio de transporte</p>
            <div className="form-grid form-grid-2">
              {camposActivos.map(h => (
                <div key={h} style={h === 'MOTIVO' || h === 'OBSERVACIONES' ? { gridColumn: '1 / -1' } : {}}>
                  <label className="label">{h}</label>
                  {h === 'ESTADO' ? (
                    <select className="select" value={form[h] || ''} onChange={e => setForm(f => ({ ...f, [h]: e.target.value }))}>
                      <option value="PENDIENTE">Pendiente</option>
                      <option value="APROBADO">Aprobado</option>
                      <option value="RECHAZADO">Rechazado</option>
                    </select>
                  ) : h === 'MOTIVO' || h === 'OBSERVACIONES' ? (
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
                {guardando ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Guardar nota'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal detalle */}
      {vista && (
        <div className="modal-overlay" onClick={() => setVista(null)}>
          <div className="modal" style={{ maxWidth: '560px' }} onClick={e => e.stopPropagation()}>
            <p className="modal-title">Detalle — Cambio de Transporte</p>
            <div style={{ display: 'grid', gap: '.5rem' }}>
              {Object.entries(vista).filter(([k]) => !k.startsWith('_') && k !== 'id').map(([k, v]) => (
                <div key={k} style={{ display: 'flex', gap: '.5rem' }}>
                  <span style={{ fontSize: '.8rem', color: 'var(--text3)', minWidth: '140px', fontWeight: 500 }}>{k}:</span>
                  <span style={{ fontSize: '.85rem', color: 'var(--text)' }}>{String(v || '—')}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '1.25rem', textAlign: 'right' }}>
              <button className="btn btn-secondary" onClick={() => setVista(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
