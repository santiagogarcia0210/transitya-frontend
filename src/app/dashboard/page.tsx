'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';

interface Tablero {
  beneficiariosActivos: number;
  bajasMes: number;
  egresosMes: number;
  totalEgresosMes: number;
  ingresosMes: number;
  totalIngresosMes: number;
  totalPagadoMes: number;
  totalPresentadoMes: number;
  kmMes: number;
  combustibleMes: number;
  estadoChoferes: Array<{ usuario: string; vehiculo: string; tieneReporte: boolean }>;
  mesNombre: string;
  anio: number;
}

export default function DashboardPage() {
  const [tab, setTab]     = useState<Tablero | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchTablero();
  }, []);

  const fetchTablero = async () => {
    try {
      setLoading(true);
      // Agregamos datos desde múltiples endpoints del backend
      const hoy = new Date();
      const mes = hoy.getMonth() + 1;
      const anio = hoy.getFullYear();

      const [benefResp, egresosResp, ingresosResp, reportesResp, usuariosResp, vencimientosResp] = await Promise.allSettled([
        api.get('/api/beneficiarios'),
        api.get('/api/egresos'),
        api.get('/api/ingresos'),
        api.get(`/api/reportes/mensual?mes=${mes}&anio=${anio}`),
        api.get('/api/usuarios/choferes'),
        api.get('/api/vencimientos'),
      ]);

      const beneficiarios = benefResp.status === 'fulfilled' ? (benefResp.value.data || []) : [];
      const egresos       = egresosResp.status === 'fulfilled' ? (egresosResp.value.data || []) : [];
      const ingresos      = ingresosResp.status === 'fulfilled' ? (ingresosResp.value.data || []) : [];
      const reportesMens  = reportesResp.status === 'fulfilled' ? reportesResp.value.data : null;
      const choferes      = usuariosResp.status === 'fulfilled' ? (usuariosResp.value.data || []) : [];

      // Filtrar del mes actual
      const mesStr = String(mes).padStart(2, '0');
      const egresosMes = egresos.filter((e: Record<string, string>) => {
        const f = String(e.FECHA || '');
        return f.includes(`/${mesStr}/${anio}`) || f.startsWith(`${anio}-${mesStr}`);
      });
      const ingresosMes = ingresos.filter((i: Record<string, string>) => {
        const f = String(i.FECHA || '');
        return f.includes(`/${mesStr}/${anio}`) || f.startsWith(`${anio}-${mesStr}`);
      });

      const totalEgresos   = egresosMes.reduce((s: number, e: Record<string, string | number>) => s + (Number(e.MONTO) || 0), 0);
      const totalIngresos  = ingresosMes.reduce((s: number, i: Record<string, string | number>) => s + (Number(i.MONTO) || 0), 0);
      const totalPagado    = ingresosMes.filter((i: Record<string, string>) => i.ESTADO === 'PAGADO').reduce((s: number, i: Record<string, string | number>) => s + (Number(i.MONTO) || 0), 0);
      const totalPresentado = ingresosMes.filter((i: Record<string, string>) => i.ESTADO === 'PRESENTADO').reduce((s: number, i: Record<string, string | number>) => s + (Number(i.MONTO) || 0), 0);

      const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

      setTab({
        beneficiariosActivos: beneficiarios.length,
        bajasMes: 0,
        egresosMes: egresosMes.length,
        totalEgresosMes: totalEgresos,
        ingresosMes: ingresosMes.length,
        totalIngresosMes: totalIngresos,
        totalPagadoMes: totalPagado,
        totalPresentadoMes: totalPresentado,
        kmMes: reportesMens?.resumen?.kmTotal || 0,
        combustibleMes: reportesMens?.resumen?.litrosTotal || 0,
        estadoChoferes: (choferes || []).map((c: Record<string, string>) => ({ usuario: c.usuario || c.nombre || '', vehiculo: c.vehiculo || '', tieneReporte: false })),
        mesNombre: MESES[mes - 1],
        anio,
      });
    } catch (e) {
      setError('Error al cargar el tablero');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n: number) =>
    n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(0)}`;

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', color: 'var(--text3)', paddingTop: '2rem' }}>
      <span className="spinner" /> Cargando tablero…
    </div>
  );

  if (error) return <p style={{ color: 'var(--red)' }}>{error}</p>;
  if (!tab)  return null;

  const kpis = [
    { label: 'Beneficiarios activos', value: tab.beneficiariosActivos, color: 'var(--blue)',   icon: '👥', sub: tab.mesNombre },
    { label: 'Egresos del mes',       value: fmt(tab.totalEgresosMes), color: 'var(--red)',    icon: '💸', sub: `${tab.egresosMes} registros` },
    { label: 'Ingresos del mes',      value: fmt(tab.totalIngresosMes), color: 'var(--green)', icon: '💰', sub: `Pagado: ${fmt(tab.totalPagadoMes)}` },
    { label: 'KM del mes',            value: `${tab.kmMes.toLocaleString()}`, color: 'var(--amber)', icon: '🛣️', sub: `${tab.combustibleMes.toFixed(0)}L combustible` },
  ];

  return (
    <div>
      {/* Header */}
      <div className="section-header">
        <h2 className="section-title">Tablero — {tab.mesNombre} {tab.anio}</h2>
        <button className="btn btn-secondary" onClick={fetchTablero} style={{ fontSize: '.8rem' }}>
          ↻ Actualizar
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {kpis.map(k => (
          <div key={k.label} className="stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p className="stat-label">{k.label}</p>
                <p className="stat-value" style={{ color: k.color }}>{k.value}</p>
                <p className="stat-sub">{k.sub}</p>
              </div>
              <span style={{ fontSize: '1.6rem', opacity: .7 }}>{k.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Semáforo choferes */}
      {tab.estadoChoferes.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <p style={{ fontSize: '.85rem', fontWeight: 600, color: 'var(--text)', marginBottom: '1rem' }}>
            🚦 Estado choferes — {tab.mesNombre}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '.6rem' }}>
            {tab.estadoChoferes.map(c => (
              <div key={c.usuario} style={{
                display: 'flex', alignItems: 'center', gap: '.6rem',
                padding: '.5rem .75rem',
                background: 'var(--bg4)', borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
              }}>
                <span className={`semaforo-dot ${c.tieneReporte ? 'verde' : 'rojo'}`} />
                <div>
                  <p style={{ fontSize: '.82rem', color: 'var(--text)', fontWeight: 500 }}>{c.usuario}</p>
                  {c.vehiculo && <p style={{ fontSize: '.75rem', color: 'var(--text3)' }}>{c.vehiculo}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ingresos pendientes */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div className="card">
          <p style={{ fontSize: '.8rem', color: 'var(--text3)', marginBottom: '.5rem' }}>Ingresos cobrados</p>
          <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--green)' }}>{fmt(tab.totalPagadoMes)}</p>
        </div>
        <div className="card">
          <p style={{ fontSize: '.8rem', color: 'var(--text3)', marginBottom: '.5rem' }}>Ingresos pendientes</p>
          <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--amber)' }}>{fmt(tab.totalPresentadoMes)}</p>
        </div>
      </div>
    </div>
  );
}
