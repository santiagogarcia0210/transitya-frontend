'use client';
import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';

interface Comunicacion {
  id: string; asunto: string; mensaje: string; tipo: string;
  destinatario: string; tenantId: string; empresa: string;
  fecha: string; creadoEn: string; de: string; creadoPor: string;
}

interface EmpresaOpt { id: string; nombre: string; }

const TIPO_LABEL: Record<string,string> = { info:'Info', advertencia:'Advertencia', alerta:'Alerta' };
const TIPO_BADGE: Record<string,string> = { info:'badge-blue', advertencia:'badge-amber', alerta:'badge-red' };

const L: React.CSSProperties = { display:'block', fontSize:'.78rem', color:'var(--text3)', marginBottom:'.3rem', fontWeight:500 };

export default function ComunicacionesPage() {
  const [lista,    setLista]    = useState<Comunicacion[]>([]);
  const [empresas, setEmpresas] = useState<EmpresaOpt[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [msg,      setMsg]      = useState<{text:string;ok:boolean}|null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    destinatario: 'todas', tenantId: '', asunto: '', mensaje: '', tipo: 'info',
  });

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [rC, rE] = await Promise.all([
        api.get('/api/superadmin/comunicaciones'),
        api.get('/api/superadmin/empresas'),
      ]);
      setLista(rC.data.comunicaciones || []);
      setEmpresas((rE.data.empresas || []).map((e: Record<string,string>) => ({
        id: e.tenantId, nombre: e.nombre,
      })));
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const enviar = async () => {
    if (!form.asunto.trim() || !form.mensaje.trim()) {
      setMsg({ text:'Completá asunto y mensaje.', ok:false }); return;
    }
    if (form.destinatario === 'empresa' && !form.tenantId) {
      setMsg({ text:'Seleccioná una empresa.', ok:false }); return;
    }
    setSaving(true); setMsg(null);
    try {
      await api.post('/api/superadmin/comunicaciones', {
        destinatario: form.destinatario,
        tenantId: form.destinatario === 'empresa' ? form.tenantId : undefined,
        asunto: form.asunto.trim(), mensaje: form.mensaje.trim(), tipo: form.tipo,
      });
      setMsg({ text:'✅ Comunicación enviada correctamente.', ok:true });
      setShowForm(false);
      setForm({ destinatario:'todas', tenantId:'', asunto:'', mensaje:'', tipo:'info' });
      cargar();
    } catch { setMsg({ text:'Error al enviar comunicación.', ok:false }); }
    setSaving(false);
  };

  return (
    <div>
      <div className="section-header" style={{ marginBottom:'1.25rem' }}>
        <div>
          <div className="section-title">📢 Comunicaciones</div>
          <div className="section-sub">{lista.length} comunicación{lista.length !== 1 ? 'es' : ''} enviada{lista.length !== 1 ? 's' : ''}</div>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowForm(true); setMsg(null); }}>+ Nueva comunicación</button>
      </div>

      {msg && !showForm && (
        <div style={{ background: msg.ok ? 'rgba(16,185,129,.1)' : 'rgba(239,68,68,.1)',
          border:`1px solid ${msg.ok ? 'rgba(16,185,129,.3)' : 'rgba(239,68,68,.3)'}`,
          borderRadius:'var(--radius)', padding:'.5rem .85rem', fontSize:'.82rem',
          color: msg.ok ? 'var(--green)' : 'var(--red)', marginBottom:'.75rem' }}>
          {msg.text}
        </div>
      )}

      {/* Form inline */}
      {showForm && (
        <div className="card" style={{ marginBottom:'1.25rem' }}>
          <div className="card-title" style={{ marginBottom:'1rem' }}>Nueva comunicación</div>
          <div className="form-grid" style={{ gap:'.85rem' }}>
            <div className="form-grid form-grid-2">
              <div>
                <label style={L}>Destinatario</label>
                <select className="select" value={form.destinatario}
                  onChange={e => setForm(f => ({ ...f, destinatario:e.target.value, tenantId:'' }))}>
                  <option value="todas">Todas las empresas</option>
                  <option value="empresa">Empresa específica</option>
                </select>
              </div>
              <div>
                <label style={L}>Tipo</label>
                <select className="select" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo:e.target.value }))}>
                  <option value="info">ℹ️ Info</option>
                  <option value="advertencia">⚠️ Advertencia</option>
                  <option value="alerta">🚨 Alerta</option>
                </select>
              </div>
            </div>

            {form.destinatario === 'empresa' && (
              <div>
                <label style={L}>Empresa *</label>
                <select className="select" value={form.tenantId}
                  onChange={e => setForm(f => ({ ...f, tenantId:e.target.value }))}>
                  <option value="">Seleccioná una empresa…</option>
                  {empresas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                </select>
              </div>
            )}

            <div>
              <label style={L}>Asunto *</label>
              <input className="input" placeholder="Ej: Mantenimiento programado" value={form.asunto}
                onChange={e => setForm(f => ({ ...f, asunto:e.target.value }))} />
            </div>
            <div>
              <label style={L}>Mensaje *</label>
              <textarea className="input" rows={4} placeholder="Escribí el mensaje aquí…"
                style={{ resize:'vertical', fontFamily:'inherit' }}
                value={form.mensaje} onChange={e => setForm(f => ({ ...f, mensaje:e.target.value }))} />
            </div>
          </div>

          {msg && (
            <p style={{ fontSize:'.82rem', color: msg.ok ? 'var(--green)' : 'var(--red)', marginTop:'.75rem' }}>{msg.text}</p>
          )}

          <div style={{ display:'flex', gap:'.75rem', marginTop:'1rem' }}>
            <button className="btn btn-secondary" onClick={() => { setShowForm(false); setMsg(null); }}>Cancelar</button>
            <button className="btn btn-primary" onClick={enviar} disabled={saving} style={{ minWidth:130 }}>
              {saving ? <><span className="spinner" style={{ width:12, height:12 }} /> Enviando…</> : '📢 Enviar'}
            </button>
          </div>
        </div>
      )}

      {/* Historial */}
      {loading ? (
        <div style={{ display:'flex', gap:'.75rem', color:'var(--text3)', padding:'2rem' }}>
          <span className="spinner" /> Cargando…
        </div>
      ) : lista.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">📢</div><p>Sin comunicaciones enviadas</p></div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'.65rem' }}>
          {lista.map(c => (
            <div key={c.id} className="card" style={{ padding:'.85rem 1rem' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'1rem' }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'.5rem', marginBottom:'.3rem' }}>
                    <span className={`badge ${TIPO_BADGE[c.tipo]||'badge-blue'}`} style={{ fontSize:'.72rem' }}>
                      {TIPO_LABEL[c.tipo]||c.tipo}
                    </span>
                    <span style={{ fontWeight:700, color:'var(--text)', fontSize:'.88rem' }}>{c.asunto}</span>
                  </div>
                  <p style={{ fontSize:'.82rem', color:'var(--text2)', margin:0, marginBottom:'.35rem',
                    overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>
                    {c.mensaje}
                  </p>
                  <div style={{ display:'flex', gap:'.75rem', fontSize:'.73rem', color:'var(--text3)' }}>
                    <span>→ {(!c.tenantId || c.tenantId === 'todos') ? 'Todas las empresas' : c.empresa || c.tenantId}</span>
                    {(c.de || c.creadoPor) && <span>por {c.de || c.creadoPor}</span>}
                  </div>
                </div>
                <div style={{ fontSize:'.75rem', color:'var(--text3)', whiteSpace:'nowrap' }}>
                  {(c.fecha||c.creadoEn) ? new Date(c.fecha||c.creadoEn).toLocaleDateString('es-AR', { day:'2-digit', month:'short', year:'numeric' }) : '—'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
