'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';

interface Registro {
  id: string;
  [key: string]: unknown;
}

export default function PresentacionDocsPage() {
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
      const r = await api.get('/api/facturacion/datos/presentacion');
      setRegistros(r.data.registros || []);
      setHeaders(r.data.headers || []);
    } catch {
      setMsg('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const filtrados = busqueda
    ? registros.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(busqueda.toLowerCase())))
    : registros;

  const defaultHeaders = headers.length > 0
    ? headers.slice(0, 8)
    : ['APELLIDO Y NOMBRE', 'DNI', 'OBRA SOCIAL', 'FECHA', 'TIPO DOC', 'ESTADO', 'OBSERVACIONES'];

  const abrirModal = () => {
    const f: Record<string, string> = {};
    defaultHeaders.forEach(h => { f[h] = ''; });
    setForm(f); setModal(true); setMsg('');
  };

  const handleGuardar = async () => {
    setGuardando(true);
    try {
      await api.post('/api/facturacion/datos/presentacion', form);
      setMsg('✅ Registro guardado');
      setModal(false);
      cargarDatos();
    } catch {
      setMsg('❌ Error al guardar');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">📁 Presentación Docs</h2>
        <button className="btn btn-primary" onClick={abrirModal}>+ Nuevo registro</button>
      </div>

      {msg && (
        <div style={{ marginBottom: '1rem', padding: '.65rem 1rem', borderRadius: 'var(--radius)', background: msg.startsWith('✅') ? 'var(--green-dim)' : 'var(--red-dim)', color: msg.startsWith('✅') ? 'var(--green)' : 'var(--red)', border: `1px solid ${msg.startsWith('✅') ? 'rgba(16,185,129,.3)' : 'rgba(239,68,68,.3)'}` }}>
          {msg}
        </div>
      )}

      {/* Buscador */}
      <div className="filter-bar" style={{ marginBottom: '1rem' }}>
        <input className="input" placeholder="Buscar en todos los campos…" value={busqueda} onChange={e => setBusqueda(e.target.value)} style={{ maxWidth: '320px' }} />
        <span style={{ color: 'var(--text3)', fontSize: '.82rem' }}>{filtrados.length} registros</span>
        <button className="btn btn-secondary" onClick={cargarDatos} style={{ marginLeft: 'auto' }}>↻</button>
      </div>

      {/* Tabla */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', color: 'var(--text3)', padding: '2rem' }}>
          <span className="spinner" /> Cargando…
        </div>
      ) : filtrados.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-icon">📁</div>
          <p>Sin registros de presentación</p>
          <p style={{ marginTop: '.5rem', fontSize: '.8rem' }}>Los registros migrados del GAS aparecerán aquí</p>
        </div>
      ) : (
        <div className="tabla-wrap">
          <table className="tabla">
            <thead>
              <tr>
                {defaultHeaders.map(h => <th key={h}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtrados.map(reg => (
                <tr key={reg.id}>
                  {defaultHeaders.map(h => (
                    <td key={h}>{String(reg[h] ?? '—')}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal nuevo registro */}
      {modal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '560px' }}>
            <p className="modal-title">Nuevo registro — Presentación Docs</p>
            <div className="form-grid">
              {defaultHeaders.map(h => (
                <div key={h}>
                  <label className="label">{h}</label>
                  <input className="input" value={form[h] || ''} onChange={e => setForm(f => ({ ...f, [h]: e.target.value }))} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '.5rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleGuardar} disabled={guardando}>
                {guardando ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
