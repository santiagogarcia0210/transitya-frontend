'use client';
import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';

interface LogEntry {
  id: string; accion: string; tipo: string; tenantId: string; empresa: string;
  descripcion: string; motivo: string; uid: string; email: string; ip: string;
  fecha: string; creadoEn: string; datos: Record<string,unknown>;
  [key: string]: unknown;
}

interface EmpresaOpt { id: string; nombre: string; }

const TIPO_BADGE: Record<string,string> = {
  PAGO:'badge-green', SUSPENDER:'badge-red', REACTIVAR:'badge-teal',
  FEATURES:'badge-purple', ACTIVAR_USUARIO:'badge-teal', SUSPENDER_USUARIO:'badge-red',
  pago:'badge-green', suspension:'badge-red', reactivacion:'badge-teal',
  feature_update:'badge-purple', estado_usuario:'badge-amber',
  comunicacion:'badge-blue', login:'badge-gray', otro:'badge-gray',
};

const TIPO_ICONO: Record<string,string> = {
  PAGO:'💳', SUSPENDER:'⛔', REACTIVAR:'✅', FEATURES:'⚙️',
  ACTIVAR_USUARIO:'✅', SUSPENDER_USUARIO:'⛔',
  pago:'💳', suspension:'⛔', reactivacion:'✅', feature_update:'⚙️',
  estado_usuario:'👤', comunicacion:'📢', login:'🔐', otro:'📝',
};

export default function LogsPage() {
  const [logs,     setLogs]     = useState<LogEntry[]>([]);
  const [empresas, setEmpresas] = useState<EmpresaOpt[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [filtroEmp, setFiltroEmp] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroFecha, setFiltroFecha] = useState('');
  const [expandId, setExpandId] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtroEmp)   params.set('tenantId', filtroEmp);
      if (filtroTipo)  params.set('tipo', filtroTipo);
      if (filtroFecha) params.set('fecha', filtroFecha);
      const [rL, rE] = await Promise.all([
        api.get('/api/superadmin/logs?' + params.toString()),
        api.get('/api/superadmin/empresas'),
      ]);
      setLogs(rL.data.logs || []);
      setEmpresas((rE.data.empresas || []).map((e: Record<string,string>) => ({
        id: e.tenantId, nombre: e.nombre,
      })));
    } catch { /* silent */ }
    setLoading(false);
  }, [filtroEmp, filtroTipo, filtroFecha]);

  useEffect(() => { cargar(); }, [cargar]);

  const exportarCsv = () => {
    const rows = [
      ['Fecha','Accion','Empresa','TenantID','Usuario','Email','Descripcion','IP'],
      ...logs.map(l => {
        const tipo = l.accion || l.tipo || '';
        const fecha = l.fecha || l.creadoEn || '';
        const desc = l.descripcion || l.motivo || '';
        return [
          fecha ? new Date(fecha).toLocaleString('es-AR') : '',
          tipo, l.empresa||'', l.tenantId||'', l.uid||'', l.email||'',
          `"${desc.replace(/"/g,'""')}"`, l.ip||'',
        ];
      }),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type:'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `logs_${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const tiposUnicos = [...new Set(logs.map(l => l.accion || l.tipo).filter(Boolean))].sort();

  return (
    <div>
      <div className="section-header" style={{ marginBottom:'1.25rem' }}>
        <div>
          <div className="section-title">📋 Logs de auditoría</div>
          <div className="section-sub">{logs.length} registro{logs.length !== 1 ? 's' : ''}</div>
        </div>
        <button className="btn btn-secondary" style={{ fontSize:'.8rem' }} onClick={exportarCsv} disabled={logs.length === 0}>
          ⬇ Exportar CSV
        </button>
      </div>

      <div className="filter-bar" style={{ marginBottom:'1rem', flexWrap:'wrap' }}>
        <select className="select" value={filtroEmp} onChange={e => setFiltroEmp(e.target.value)}>
          <option value="">Todas las empresas</option>
          {empresas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </select>
        <select className="select" value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
          <option value="">Todos los tipos</option>
          {tiposUnicos.map(t => (
            <option key={t} value={t}>{TIPO_ICONO[t]||'📝'} {t}</option>
          ))}
        </select>
        <input type="date" className="input" style={{ maxWidth:160 }} value={filtroFecha}
          onChange={e => setFiltroFecha(e.target.value)} />
        {(filtroEmp || filtroTipo || filtroFecha) && (
          <button className="btn btn-secondary btn-sm"
            onClick={() => { setFiltroEmp(''); setFiltroTipo(''); setFiltroFecha(''); }}>✕</button>
        )}
      </div>

      {loading ? (
        <div style={{ display:'flex', gap:'.75rem', color:'var(--text3)', padding:'2rem' }}>
          <span className="spinner" /> Cargando logs…
        </div>
      ) : logs.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">📋</div><p>Sin logs</p></div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'.4rem' }}>
          {logs.map(l => {
            const tipo   = l.accion || l.tipo || 'otro';
            const fecha  = l.fecha  || l.creadoEn || '';
            const desc   = l.descripcion || l.motivo || '';
            const extras = Object.fromEntries(
              Object.entries(l).filter(([k]) => !['id','accion','tipo','tenantId','empresa','descripcion','motivo','uid','email','ip','fecha','creadoEn'].includes(k))
            );
            const hasDatos = Object.keys(extras).length > 0;
            const isOpen = expandId === l.id;
            return (
              <div key={l.id} className="card" style={{ padding:'.7rem 1rem', cursor: hasDatos ? 'pointer' : 'default' }}
                onClick={() => hasDatos && setExpandId(isOpen ? null : l.id)}>
                <div style={{ display:'flex', alignItems:'flex-start', gap:'.75rem' }}>
                  <span style={{ fontSize:'1.1rem', lineHeight:1, marginTop:'.1rem' }}>{TIPO_ICONO[tipo]||'📝'}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'.45rem', flexWrap:'wrap', marginBottom:'.25rem' }}>
                      <span className={`badge ${TIPO_BADGE[tipo]||'badge-gray'}`} style={{ fontSize:'.7rem' }}>
                        {tipo}
                      </span>
                      {(l.empresa || l.tenantId) && (
                        <span style={{ fontSize:'.78rem', fontWeight:600, color:'var(--text)' }}>{l.empresa || l.tenantId}</span>
                      )}
                    </div>
                    {desc && (
                      <p style={{ fontSize:'.82rem', color:'var(--text2)', margin:0, marginBottom:'.2rem' }}>{desc}</p>
                    )}
                    <div style={{ display:'flex', gap:'.75rem', fontSize:'.72rem', color:'var(--text3)', flexWrap:'wrap' }}>
                      {l.email && <span>👤 {l.email}</span>}
                      {l.ip && <span>🌐 {l.ip}</span>}
                    </div>
                  </div>
                  <div style={{ fontSize:'.73rem', color:'var(--text3)', whiteSpace:'nowrap', textAlign:'right' }}>
                    <div>{fecha ? new Date(fecha).toLocaleDateString('es-AR') : '—'}</div>
                    <div>{fecha ? new Date(fecha).toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit' }) : ''}</div>
                    {hasDatos && <div style={{ color:'var(--blue)', marginTop:'.15rem' }}>{isOpen ? '▲' : '▼'} datos</div>}
                  </div>
                </div>
                {isOpen && hasDatos && (
                  <pre style={{ marginTop:'.6rem', padding:'.6rem', background:'var(--bg3)',
                    borderRadius:'var(--radius)', fontSize:'.72rem', color:'var(--text2)',
                    overflowX:'auto', whiteSpace:'pre-wrap', wordBreak:'break-all', lineHeight:1.5 }}>
                    {JSON.stringify(extras, null, 2)}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
