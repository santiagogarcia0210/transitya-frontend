'use client';
import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';

const MESES_CORTOS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const PLAN_LABEL: Record<string,string> = { esencial:'Esencial', pro:'Pro', flota:'Flota', prueba:'Prueba', basico:'Básico' };
const PLAN_COLOR: Record<string,string> = { esencial:'var(--blue)', pro:'var(--green)', flota:'var(--purple)', prueba:'var(--text3)', basico:'var(--amber)' };

interface DashData {
  totalEmpresas: number; activas: number; suspendidas: number;
  totalUsuarios: number; ingresosMes: number;
  distribucionPlan: Record<string,number>;
  porVencer: { tenantId:string; nombre:string; plan:string; diasRestantes:number; fechaVencimiento:string }[];
  ultimosPagos: { id:string; empresa:string; monto:number; estado:string; plan:string; fecha:string }[];
  nuevasPorMes: Record<string,number>;
}

function diasBadge(dias: number) {
  const cls = dias > 10 ? 'badge-green' : dias > 0 ? 'badge-amber' : 'badge-red';
  return <span className={`badge ${cls}`}>{dias > 0 ? `${dias}d` : 'Vencida'}</span>;
}

export default function SADashboard() {
  const [data,    setData]    = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const cargar = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const r = await api.get('/api/superadmin/dashboard');
      if (r.data?.ok === false) throw new Error(r.data.mensaje || 'El endpoint devolvió ok:false');
      setData(r.data);
    } catch (err: unknown) {
      const msg = (err as {response?: {data?: {mensaje?: string}; status?: number}; message?: string})?.response?.data?.mensaje
        || (err as {message?: string})?.message
        || 'Error desconocido';
      const status = (err as {response?: {status?: number}})?.response?.status;
      setError(status ? `${status} — ${msg}` : msg);
    }
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', gap:'.75rem', padding:'3rem', color:'var(--text3)' }}>
      <span className="spinner" /> Cargando dashboard…
    </div>
  );

  if (error) return (
    <div style={{ padding:'2rem' }}>
      <div style={{ background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.3)',
        borderRadius:'var(--radius)', padding:'1rem 1.25rem', marginBottom:'1rem' }}>
        <div style={{ fontWeight:700, color:'var(--red)', marginBottom:'.35rem' }}>❌ Error al cargar el dashboard</div>
        <code style={{ fontSize:'.8rem', color:'var(--text2)', fontFamily:'monospace' }}>{error}</code>
      </div>
      <button className="btn btn-secondary" onClick={cargar}>↻ Reintentar</button>
    </div>
  );

  if (!data) return (
    <div className="empty-state"><div className="empty-icon">📊</div><p>Sin datos</p></div>
  );

  const mesKeys = Object.keys(data.nuevasPorMes);
  const maxNuevas = Math.max(1, ...Object.values(data.nuevasPorMes));
  const planEntries = Object.entries(data.distribucionPlan);

  return (
    <div>
      <div className="section-header" style={{ marginBottom:'1.5rem' }}>
        <div>
          <div className="section-title">📊 Dashboard</div>
          <div className="section-sub">Vista global de la plataforma</div>
        </div>
        <button className="btn btn-secondary" style={{ fontSize:'.8rem' }} onClick={cargar}>↻ Actualizar</button>
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:'1rem', marginBottom:'1.5rem' }}>
        {[
          { l:'Total empresas',  v:data.totalEmpresas, c:'var(--blue)',   icon:'🏢' },
          { l:'Activas',         v:data.activas,       c:'var(--green)',  icon:'✅' },
          { l:'Suspendidas',     v:data.suspendidas,   c:'var(--red)',    icon:'⛔' },
          { l:'Usuarios',        v:data.totalUsuarios, c:'var(--purple)', icon:'👥' },
          { l:'Ingresos del mes',v:`$${(data.ingresosMes||0).toLocaleString('es-AR')}`, c:'var(--amber)', icon:'💰' },
        ].map(s => (
          <div key={s.l} className="stat-card">
            <p className="stat-label">{s.icon} {s.l}</p>
            <p className="stat-value" style={{ color: s.c, fontSize:'1.6rem' }}>{s.v}</p>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', marginBottom:'1.5rem' }}>
        {/* Distribución por plan */}
        <div className="card">
          <div className="card-title">Distribución por plan</div>
          {planEntries.length === 0
            ? <p style={{ color:'var(--text3)', fontSize:'.84rem' }}>Sin datos</p>
            : planEntries.map(([plan, cant]) => (
              <div key={plan} style={{ marginBottom:'.6rem' }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:'.8rem', marginBottom:'.25rem' }}>
                  <span style={{ color:'var(--text2)' }}>{PLAN_LABEL[plan] || plan}</span>
                  <span style={{ fontWeight:700, color: PLAN_COLOR[plan] || 'var(--text)' }}>{cant}</span>
                </div>
                <div style={{ height:6, background:'var(--bg4)', borderRadius:99, overflow:'hidden' }}>
                  <div style={{ height:'100%', borderRadius:99, background: PLAN_COLOR[plan] || 'var(--blue)',
                    width: `${Math.round((cant / Math.max(1, data.activas)) * 100)}%` }} />
                </div>
              </div>
            ))
          }
        </div>

        {/* Nuevas empresas por mes */}
        <div className="card">
          <div className="card-title">Nuevas empresas (6 meses)</div>
          <div style={{ display:'flex', alignItems:'flex-end', gap:'.5rem', height:100 }}>
            {mesKeys.map(k => {
              const v = data.nuevasPorMes[k];
              const h = Math.max(4, Math.round((v / maxNuevas) * 100));
              const [y, m] = k.split('-');
              return (
                <div key={k} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:'.25rem' }}>
                  <span style={{ fontSize:'.65rem', color:'var(--text3)', fontWeight:700 }}>{v}</span>
                  <div style={{ width:'100%', background:'var(--blue)', borderRadius:'4px 4px 0 0', height:h }} />
                  <span style={{ fontSize:'.65rem', color:'var(--text3)' }}>{MESES_CORTOS[parseInt(m)-1]}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
        {/* Por vencer */}
        <div className="card">
          <div className="card-title" style={{ marginBottom:'.75rem' }}>
            ⚠️ Por vencer (7 días)
            <span style={{ marginLeft:'.5rem', fontSize:'.75rem', color:'var(--text3)' }}>{data.porVencer.length} empresa{data.porVencer.length !== 1 ? 's' : ''}</span>
          </div>
          {data.porVencer.length === 0
            ? <p style={{ color:'var(--green)', fontSize:'.84rem' }}>✅ Ninguna empresa por vencer</p>
            : data.porVencer.map(e => (
              <div key={e.tenantId} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                padding:'.5rem 0', borderBottom:'1px solid var(--border)', fontSize:'.82rem' }}>
                <div>
                  <div style={{ fontWeight:600, color:'var(--text)' }}>{e.nombre}</div>
                  <div style={{ color:'var(--text3)', fontSize:'.75rem' }}>{PLAN_LABEL[e.plan] || e.plan}</div>
                </div>
                {diasBadge(e.diasRestantes)}
              </div>
            ))
          }
        </div>

        {/* Últimos pagos */}
        <div className="card">
          <div className="card-title" style={{ marginBottom:'.75rem' }}>💳 Últimos pagos</div>
          {data.ultimosPagos.length === 0
            ? <p style={{ color:'var(--text3)', fontSize:'.84rem' }}>Sin pagos registrados</p>
            : data.ultimosPagos.map((p, i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                padding:'.5rem 0', borderBottom:'1px solid var(--border)', fontSize:'.82rem' }}>
                <div>
                  <div style={{ fontWeight:600, color:'var(--text)' }}>{p.empresa}</div>
                  <div style={{ color:'var(--text3)', fontSize:'.75rem' }}>
                    {new Date(p.fecha).toLocaleDateString('es-AR')} · {PLAN_LABEL[p.plan] || p.plan}
                  </div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontWeight:700, color:'var(--green)' }}>${(p.monto||0).toLocaleString('es-AR')}</div>
                  <span className={`badge ${p.estado === 'pagado' ? 'badge-green' : 'badge-amber'}`} style={{ fontSize:'.68rem' }}>
                    {p.estado}
                  </span>
                </div>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
}
