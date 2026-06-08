'use client';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '@/lib/api';

interface EmpresaOpt { id: string; nombre: string; plan: string; }

interface Features {
  reportesKm: boolean; gpsRealtime: boolean; beneficiarios: boolean;
  planillas: boolean; hojaRuta: boolean; exportarPdf: boolean;
  exportarExcel: boolean; multiTurno: boolean; apiAccess: boolean;
  soportePrioritario: boolean; [key: string]: boolean;
}

const PLAN_BASE: Record<string, string[]> = {
  esencial: ['beneficiarios', 'planillas', 'hojaRuta'],
  pro:      ['beneficiarios', 'planillas', 'hojaRuta', 'reportesKm', 'exportarPdf', 'exportarExcel', 'gpsRealtime'],
  flota:    ['beneficiarios', 'planillas', 'hojaRuta', 'reportesKm', 'exportarPdf', 'exportarExcel', 'gpsRealtime', 'multiTurno', 'apiAccess', 'soportePrioritario'],
};

const FEATURE_LABEL: Record<string, string> = {
  reportesKm: 'Reportes KM', gpsRealtime: 'GPS Tiempo real',
  beneficiarios: 'Beneficiarios', planillas: 'Planillas',
  hojaRuta: 'Hoja de ruta', exportarPdf: 'Exportar PDF',
  exportarExcel: 'Exportar Excel', multiTurno: 'Multi-turno',
  apiAccess: 'API Access', soportePrioritario: 'Soporte prioritario',
};

const ALL_FEATURES = Object.keys(FEATURE_LABEL);
const PLAN_LABEL: Record<string,string> = { esencial:'Esencial', pro:'Pro', flota:'Flota', prueba:'Prueba' };

export default function FeaturesPage() {
  const searchParams = useSearchParams();
  const [empresas, setEmpresas] = useState<EmpresaOpt[]>([]);
  const [selTenant, setSelTenant] = useState('');
  const [selPlan,   setSelPlan]   = useState('');
  const [features,  setFeatures]  = useState<Features | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [msg,       setMsg]       = useState<{text:string;ok:boolean}|null>(null);

  useEffect(() => {
    api.get('/api/superadmin/empresas').then(r => {
      const list = (r.data.empresas || []).map((e: Record<string,string>) => ({
        id: e.tenantId, nombre: e.nombre, plan: e.plan,
      }));
      setEmpresas(list);
      const pre = searchParams.get('tenant');
      if (pre) {
        setSelTenant(pre);
        const found = list.find((e: EmpresaOpt) => e.id === pre);
        if (found) setSelPlan(found.plan);
      }
    }).catch(() => {});
  }, [searchParams]);

  const cargarFeatures = useCallback(async (tenantId: string) => {
    if (!tenantId) return;
    setLoading(true); setFeatures(null); setMsg(null);
    try {
      const r = await api.get(`/api/superadmin/features/${tenantId}`);
      setFeatures(r.data.features || {});
    } catch { setMsg({ text:'Error al cargar features.', ok:false }); }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (selTenant) cargarFeatures(selTenant);
  }, [selTenant, cargarFeatures]);

  const handleEmpresaChange = (tenantId: string) => {
    setSelTenant(tenantId);
    const found = empresas.find(e => e.id === tenantId);
    setSelPlan(found?.plan || '');
  };

  const toggle = (key: string) => {
    if (!features) return;
    setFeatures(prev => prev ? { ...prev, [key]: !prev[key] } : null);
  };

  const resetFromPlan = (plan: string) => {
    const base = PLAN_BASE[plan] || [];
    const next: Features = {} as Features;
    ALL_FEATURES.forEach(k => { next[k] = base.includes(k); });
    setFeatures(next);
    setMsg({ text:'Features reseteadas al plan base. Guardá para confirmar.', ok:false });
  };

  const guardar = async () => {
    if (!selTenant || !features) return;
    setSaving(true); setMsg(null);
    try {
      await api.put(`/api/superadmin/features/${selTenant}`, features);
      setMsg({ text:'✅ Features guardadas correctamente.', ok:true });
    } catch { setMsg({ text:'Error al guardar.', ok:false }); }
    setSaving(false);
  };

  const planBase = selPlan ? (PLAN_BASE[selPlan] || []) : [];

  return (
    <div>
      <div className="section-header" style={{ marginBottom:'1.25rem' }}>
        <div>
          <div className="section-title">⚙️ Features</div>
          <div className="section-sub">Activar / desactivar módulos por empresa</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom:'1rem' }}>
        <div style={{ display:'flex', gap:'1rem', alignItems:'flex-end', flexWrap:'wrap' }}>
          <div>
            <label style={{ display:'block', fontSize:'.78rem', color:'var(--text3)', marginBottom:'.3rem', fontWeight:500 }}>
              Empresa
            </label>
            <select className="select" style={{ minWidth:220 }} value={selTenant}
              onChange={e => handleEmpresaChange(e.target.value)}>
              <option value="">Seleccioná una empresa…</option>
              {empresas.map(e => (
                <option key={e.id} value={e.id}>{e.nombre} — {PLAN_LABEL[e.plan]||e.plan}</option>
              ))}
            </select>
          </div>
          {selPlan && (
            <div>
              <label style={{ display:'block', fontSize:'.78rem', color:'var(--text3)', marginBottom:'.3rem', fontWeight:500 }}>
                Plan
              </label>
              <span className="badge badge-blue" style={{ fontSize:'.8rem', padding:'.4rem .8rem' }}>
                {PLAN_LABEL[selPlan] || selPlan}
              </span>
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div style={{ display:'flex', gap:'.75rem', color:'var(--text3)', padding:'2rem' }}>
          <span className="spinner" /> Cargando features…
        </div>
      )}

      {features && !loading && (
        <div className="card">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
            <div className="card-title">Módulos activos</div>
            {selPlan && PLAN_BASE[selPlan] && (
              <button className="btn btn-secondary btn-sm" onClick={() => resetFromPlan(selPlan)}>
                ↺ Resetear al plan {PLAN_LABEL[selPlan]||selPlan}
              </button>
            )}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:'.6rem', marginBottom:'1.25rem' }}>
            {ALL_FEATURES.map(key => {
              const isOn   = features[key] || false;
              const inBase = planBase.includes(key);
              return (
                <button key={key} onClick={() => toggle(key)}
                  style={{ display:'flex', alignItems:'center', gap:'.6rem', padding:'.6rem .85rem',
                    border:`1px solid ${isOn ? 'var(--green)' : 'var(--border)'}`,
                    borderRadius:'var(--radius)', background: isOn ? 'rgba(16,185,129,.07)' : 'var(--bg3)',
                    cursor:'pointer', textAlign:'left', transition:'all .15s' }}>
                  <span style={{ fontSize:'1.1rem' }}>{isOn ? '✅' : '⬜'}</span>
                  <div>
                    <div style={{ fontSize:'.82rem', fontWeight:600, color: isOn ? 'var(--green)' : 'var(--text2)' }}>
                      {FEATURE_LABEL[key]}
                    </div>
                    {inBase && (
                      <div style={{ fontSize:'.68rem', color:'var(--text3)' }}>incluido en {PLAN_LABEL[selPlan]||selPlan}</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {msg && (
            <p style={{ fontSize:'.82rem', color: msg.ok ? 'var(--green)' : 'var(--amber)', marginBottom:'.75rem' }}>{msg.text}</p>
          )}

          <button className="btn btn-primary" onClick={guardar} disabled={saving} style={{ minWidth:140 }}>
            {saving ? <><span className="spinner" style={{ width:12, height:12 }} /> Guardando…</> : '✓ Guardar cambios'}
          </button>
        </div>
      )}

      {!selTenant && !loading && (
        <div className="empty-state">
          <div className="empty-icon">⚙️</div>
          <p>Seleccioná una empresa para ver y editar sus features</p>
        </div>
      )}
    </div>
  );
}
