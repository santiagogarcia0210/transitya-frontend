'use client';
import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';

interface Pago {
  id: string; tenantId: string; empresa: string;
  monto: number; plan: string; estado: string; fecha: string;
  dias: number; metodo: string; observaciones: string;
}

interface EmpresaOpt { id: string; nombre: string; plan: string; fechaProximoCobro: string; }

const PLAN_LABEL: Record<string,string> = { esencial:'Esencial', pro:'Pro', flota:'Flota', prueba:'Prueba', basico:'Básico' };

function diasBadge(fecha: string) {
  if (!fecha) return <span className="badge badge-gray">—</span>;
  const dias = Math.ceil((new Date(fecha).getTime() - Date.now()) / 86400000);
  const cls  = dias > 10 ? 'badge-green' : dias > 0 ? 'badge-amber' : 'badge-red';
  return <span className={`badge ${cls}`}>{dias > 0 ? `${dias} días` : 'Vencida'}</span>;
}

const L: React.CSSProperties = { display:'block', fontSize:'.78rem', color:'var(--text3)', marginBottom:'.3rem', fontWeight:500 };

export default function PagosPage() {
  const [pagos,    setPagos]    = useState<Pago[]>([]);
  const [empresas, setEmpresas] = useState<EmpresaOpt[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [filtroEmp, setFiltroEmp] = useState('');
  const [filtroMes, setFiltroMes] = useState('');
  const [filtroEst, setFiltroEst] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [msg,      setMsg]      = useState<{text:string;ok:boolean}|null>(null);
  const [form, setForm] = useState({
    tenantId:'', monto:'', plan:'pro', dias:'30', metodo:'transferencia', observaciones:''
  });

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtroEmp) params.set('tenantId', filtroEmp);
      if (filtroMes) params.set('mes', filtroMes);
      if (filtroEst) params.set('estado', filtroEst);
      const [rP, rE] = await Promise.all([
        api.get('/api/superadmin/pagos?' + params.toString()),
        api.get('/api/superadmin/empresas'),
      ]);
      setPagos(rP.data.pagos || []);
      setEmpresas((rE.data.empresas || []).map((e: Record<string,string>) => ({
        id: e.tenantId, nombre: e.nombre, plan: e.plan, fechaProximoCobro: e.fechaProximoCobro
      })));
    } catch { /* silent */ }
    setLoading(false);
  }, [filtroEmp, filtroMes, filtroEst]);

  useEffect(() => { cargar(); }, [cargar]);

  const registrar = async () => {
    if (!form.tenantId || !form.monto) { setMsg({ text:'Completá empresa y monto.', ok:false }); return; }
    setSaving(true); setMsg(null);
    try {
      await api.post(`/api/superadmin/pagos/${form.tenantId}/registrar`, {
        monto: Number(form.monto), plan: form.plan, dias: Number(form.dias),
        metodo: form.metodo, observaciones: form.observaciones,
      });
      setMsg({ text:'✅ Pago registrado y suscripción extendida.', ok:true });
      setShowModal(false);
      setForm({ tenantId:'', monto:'', plan:'pro', dias:'30', metodo:'transferencia', observaciones:'' });
      cargar();
    } catch { setMsg({ text:'Error al registrar.', ok:false }); }
    setSaving(false);
  };

  const meses = Array.from({ length:6 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - i);
    return { value: d.toISOString().slice(0,7), label: d.toLocaleDateString('es-AR', { month:'long', year:'numeric' }) };
  });

  const totalFiltrado = pagos.filter(p => p.estado === 'pagado').reduce((s,p) => s + Number(p.monto||0), 0);

  return (
    <div>
      <div className="section-header" style={{ marginBottom:'1.25rem' }}>
        <div>
          <div className="section-title">💳 Pagos</div>
          <div className="section-sub">
            {pagos.length} pago{pagos.length !== 1 ? 's' : ''}
            {totalFiltrado > 0 && <span style={{ marginLeft:'.5rem', color:'var(--green)', fontWeight:700 }}>· ${totalFiltrado.toLocaleString('es-AR')} cobrado</span>}
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowModal(true); setMsg(null); }}>+ Registrar pago</button>
      </div>

      <div className="filter-bar" style={{ marginBottom:'1rem' }}>
        <select className="select" value={filtroEmp} onChange={e => setFiltroEmp(e.target.value)}>
          <option value="">Todas las empresas</option>
          {empresas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </select>
        <select className="select" value={filtroMes} onChange={e => setFiltroMes(e.target.value)}>
          <option value="">Todos los meses</option>
          {meses.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <select className="select" value={filtroEst} onChange={e => setFiltroEst(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="pagado">Pagado</option>
          <option value="pendiente">Pendiente</option>
          <option value="vencido">Vencido</option>
        </select>
        {(filtroEmp || filtroMes || filtroEst) && (
          <button className="btn btn-secondary btn-sm" onClick={() => { setFiltroEmp(''); setFiltroMes(''); setFiltroEst(''); }}>✕</button>
        )}
      </div>

      {loading ? (
        <div style={{ display:'flex', gap:'.75rem', color:'var(--text3)', padding:'2rem' }}>
          <span className="spinner" /> Cargando…
        </div>
      ) : pagos.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">💳</div><p>Sin pagos</p></div>
      ) : (
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'.82rem' }}>
            <thead>
              <tr style={{ borderBottom:'1px solid var(--border)', color:'var(--text3)' }}>
                {['Empresa','Fecha','Monto','Plan','Método','Estado','Días suscripción','Obs.'].map(h => (
                  <th key={h} style={{ textAlign:'left', padding:'8px 10px', fontWeight:600, whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagos.map(p => (
                <tr key={p.id} style={{ borderBottom:'1px solid var(--border)' }}>
                  <td style={{ padding:'8px 10px', fontWeight:600, color:'var(--text)' }}>{p.empresa}</td>
                  <td style={{ padding:'8px 10px', color:'var(--text2)' }}>
                    {p.fecha ? new Date(p.fecha).toLocaleDateString('es-AR') : '—'}
                  </td>
                  <td style={{ padding:'8px 10px', fontWeight:700, color:'var(--green)' }}>
                    ${Number(p.monto||0).toLocaleString('es-AR')}
                  </td>
                  <td style={{ padding:'8px 10px' }}>
                    <span className="badge badge-blue" style={{ fontSize:'.72rem' }}>{PLAN_LABEL[p.plan]||p.plan||'—'}</span>
                  </td>
                  <td style={{ padding:'8px 10px', color:'var(--text3)', fontSize:'.78rem' }}>{p.metodo||'—'}</td>
                  <td style={{ padding:'8px 10px' }}>
                    <span className={`badge ${p.estado==='pagado'?'badge-green':p.estado==='vencido'?'badge-red':'badge-amber'}`} style={{ fontSize:'.72rem' }}>
                      {p.estado||'—'}
                    </span>
                  </td>
                  <td style={{ padding:'8px 10px' }}>
                    {p.dias ? <span className="badge badge-teal" style={{ fontSize:'.72rem' }}>{p.dias}d</span> : '—'}
                  </td>
                  <td style={{ padding:'8px 10px', color:'var(--text3)', fontSize:'.75rem', maxWidth:120, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
                    {p.observaciones || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal registrar pago */}
      {showModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.65)', display:'flex',
          alignItems:'center', justifyContent:'center', zIndex:50, padding:'1rem' }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="card" style={{ width:'100%', maxWidth:460, padding:'1.5rem' }}>
            <h3 style={{ fontSize:'1rem', fontWeight:700, color:'var(--text)', marginBottom:'1.25rem' }}>
              + Registrar pago manual
            </h3>
            <div className="form-grid">
              <div>
                <label style={L}>Empresa *</label>
                <select className="select" value={form.tenantId} onChange={e => setForm(f => ({ ...f, tenantId:e.target.value }))}>
                  <option value="">Seleccioná una empresa…</option>
                  {empresas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                </select>
              </div>
              <div className="form-grid form-grid-2">
                <div><label style={L}>Monto ($) *</label>
                  <input type="number" className="input" placeholder="0" value={form.monto}
                    onChange={e => setForm(f => ({ ...f, monto:e.target.value }))} /></div>
                <div><label style={L}>Días de extensión</label>
                  <input type="number" className="input" placeholder="30" value={form.dias}
                    onChange={e => setForm(f => ({ ...f, dias:e.target.value }))} /></div>
              </div>
              <div className="form-grid form-grid-2">
                <div><label style={L}>Plan</label>
                  <select className="select" value={form.plan} onChange={e => setForm(f => ({ ...f, plan:e.target.value }))}>
                    <option value="esencial">Esencial</option>
                    <option value="pro">Pro</option>
                    <option value="flota">Flota</option>
                  </select></div>
                <div><label style={L}>Método de pago</label>
                  <select className="select" value={form.metodo} onChange={e => setForm(f => ({ ...f, metodo:e.target.value }))}>
                    <option value="transferencia">Transferencia</option>
                    <option value="mercadopago">MercadoPago</option>
                    <option value="efectivo">Efectivo</option>
                    <option value="otro">Otro</option>
                  </select></div>
              </div>
              <div><label style={L}>Observaciones</label>
                <input className="input" placeholder="Opcional…" value={form.observaciones}
                  onChange={e => setForm(f => ({ ...f, observaciones:e.target.value }))} /></div>
            </div>
            {msg && (
              <p style={{ fontSize:'.82rem', color: msg.ok ? 'var(--green)' : 'var(--red)', marginTop:'.75rem' }}>{msg.text}</p>
            )}
            <div style={{ display:'flex', gap:'.75rem', marginTop:'1.25rem' }}>
              <button className="btn btn-secondary" style={{ flex:1 }} onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" style={{ flex:1 }} onClick={registrar} disabled={saving}>
                {saving ? <><span className="spinner" style={{ width:12, height:12 }} /> Guardando…</> : '✓ Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
