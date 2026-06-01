'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';

interface Beneficiario {
  id: string;
  nombre?: string;
  'APELLIDO Y NOMBRE'?: string;
  DNI?: string;
  'N° AFILIADO'?: string;
  'OBRA SOCIAL'?: string;
  CHOFER?: string;
  DOMICILIO?: string;
  LOCALIDAD?: string;
}

interface AsistenciaReg {
  fecha: string;
  ESTADO?: string;
  beneficiario?: string;
  BENEFICIARIO?: string;
}

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export default function PlanillaIncluirPage() {
  const hoy = new Date();
  const [mes,  setMes]  = useState(hoy.getMonth() + 1);
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [beneficiarios, setBeneficiarios] = useState<Beneficiario[]>([]);
  const [asistencia,    setAsistencia]    = useState<AsistenciaReg[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [choferes,      setChoferes]      = useState<string[]>([]);
  const [filtroChofer,  setFiltroChofer]  = useState('');

  useEffect(() => { cargarDatos(); }, [mes, anio]);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [bResp, aResp] = await Promise.all([
        api.get('/api/beneficiarios'),
        api.get('/api/asistencia'),
      ]);
      const bs: Beneficiario[] = bResp.data || [];
      const as: AsistenciaReg[] = aResp.data || [];

      // Filtrar asistencia del mes seleccionado
      const mesStr = String(mes).padStart(2, '0');
      const asMes = as.filter(a => {
        const f = String(a.fecha || '');
        return f.includes(`/${mesStr}/${anio}`) || f.startsWith(`${anio}-${mesStr}`);
      });

      setBeneficiarios(bs);
      setAsistencia(asMes);

      const chs = [...new Set(bs.map(b => b.CHOFER || '').filter(Boolean))].sort();
      setChoferes(chs);
    } finally {
      setLoading(false);
    }
  };

  const diasDelMes = new Date(anio, mes, 0).getDate();
  const dias = Array.from({ length: diasDelMes }, (_, i) => i + 1);

  const tieneFalta = (benef: Beneficiario, dia: number) => {
    const nombre = benef.nombre || benef['APELLIDO Y NOMBRE'] || '';
    const fecha1 = `${String(dia).padStart(2,'0')}/${String(mes).padStart(2,'0')}/${anio}`;
    const fecha2 = `${anio}-${String(mes).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
    const reg = asistencia.find(a => {
      const bn = a.beneficiario || a.BENEFICIARIO || '';
      const fOk = a.fecha === fecha1 || a.fecha === fecha2;
      return fOk && bn.toLowerCase().includes(nombre.toLowerCase().slice(0, 10));
    });
    return reg ? reg.ESTADO : null;
  };

  const benefFiltrados = filtroChofer
    ? beneficiarios.filter(b => b.CHOFER === filtroChofer)
    : beneficiarios;

  const handlePrint = () => window.print();

  return (
    <div>
      {/* Header */}
      <div className="section-header no-print">
        <h2 className="section-title">📝 Planilla Incluir</h2>
        <button className="btn btn-primary" onClick={handlePrint}>🖨️ Imprimir</button>
      </div>

      {/* Controles */}
      <div className="card no-print" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label className="label">Mes</label>
            <select className="select" style={{ width: '140px' }} value={mes} onChange={e => setMes(Number(e.target.value))}>
              {MESES.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Año</label>
            <input className="input" type="number" style={{ width: '100px' }} value={anio} onChange={e => setAnio(Number(e.target.value))} />
          </div>
          <div>
            <label className="label">Chofer</label>
            <select className="select" style={{ width: '180px' }} value={filtroChofer} onChange={e => setFiltroChofer(e.target.value)}>
              <option value="">Todos</option>
              {choferes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <button className="btn btn-secondary" onClick={cargarDatos}>↻ Actualizar</button>
        </div>
      </div>

      {/* Info */}
      <div className="card no-print" style={{ marginBottom: '1rem', display: 'flex', gap: '1.5rem' }}>
        <span style={{ color: 'var(--text3)', fontSize: '.85rem' }}>
          📋 <strong style={{ color: 'var(--text)' }}>{benefFiltrados.length}</strong> beneficiarios
        </span>
        <span style={{ color: 'var(--text3)', fontSize: '.85rem' }}>
          📅 <strong style={{ color: 'var(--text)' }}>{diasDelMes}</strong> días — {MESES[mes-1]} {anio}
        </span>
        <span style={{ color: 'var(--text3)', fontSize: '.85rem' }}>
          ✅ <strong style={{ color: 'var(--green)' }}>{asistencia.length}</strong> registros de asistencia
        </span>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', color: 'var(--text3)', padding: '2rem' }}>
          <span className="spinner" /> Cargando…
        </div>
      ) : (
        <>
          {/* Planilla imprimible */}
          <div className="a4-page" id="planilla-print">
            <div style={{ textAlign: 'center', marginBottom: '1rem', borderBottom: '2px solid #000', paddingBottom: '1rem' }}>
              <h2 style={{ fontSize: '14pt', fontWeight: 700 }}>PLANILLA DE ASISTENCIA — INCLUSIÓN</h2>
              <p style={{ fontSize: '11pt' }}>Mes: {MESES[mes-1].toUpperCase()} {anio}</p>
              {filtroChofer && <p style={{ fontSize: '10pt' }}>Chofer: {filtroChofer}</p>}
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8pt' }}>
              <thead>
                <tr>
                  <th style={{ border: '1px solid #000', padding: '3px 5px', background: '#eee', textAlign: 'left', minWidth: '120px' }}>Apellido y Nombre</th>
                  <th style={{ border: '1px solid #000', padding: '3px 5px', background: '#eee', minWidth: '60px' }}>DNI</th>
                  <th style={{ border: '1px solid #000', padding: '3px 5px', background: '#eee', minWidth: '60px' }}>N° Afil.</th>
                  {dias.map(d => (
                    <th key={d} style={{ border: '1px solid #000', padding: '2px', background: '#eee', width: '18px', textAlign: 'center' }}>{d}</th>
                  ))}
                  <th style={{ border: '1px solid #000', padding: '3px 5px', background: '#eee', textAlign: 'center' }}>Total P.</th>
                  <th style={{ border: '1px solid #000', padding: '3px 5px', background: '#eee', textAlign: 'center' }}>Total A.</th>
                </tr>
              </thead>
              <tbody>
                {benefFiltrados.map(b => {
                  let presentes = 0, ausentes = 0;
                  return (
                    <tr key={b.id}>
                      <td style={{ border: '1px solid #000', padding: '2px 5px' }}>{b.nombre || b['APELLIDO Y NOMBRE'] || '—'}</td>
                      <td style={{ border: '1px solid #000', padding: '2px 5px', textAlign: 'center' }}>{b.DNI || '—'}</td>
                      <td style={{ border: '1px solid #000', padding: '2px 5px', textAlign: 'center' }}>{b['N° AFILIADO'] || '—'}</td>
                      {dias.map(d => {
                        const estado = tieneFalta(b, d);
                        if (estado === 'P' || estado === 'PRESENTE') presentes++;
                        if (estado === 'A' || estado === 'AUSENTE') ausentes++;
                        return (
                          <td key={d} style={{ border: '1px solid #000', padding: '1px', textAlign: 'center', background: estado ? (String(estado).startsWith('P') ? '#d4edda' : '#f8d7da') : '#fff' }}>
                            {estado ? String(estado).charAt(0) : ''}
                          </td>
                        );
                      })}
                      <td style={{ border: '1px solid #000', padding: '2px 5px', textAlign: 'center', fontWeight: 700 }}>{presentes}</td>
                      <td style={{ border: '1px solid #000', padding: '2px 5px', textAlign: 'center', fontWeight: 700 }}>{ausentes}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div style={{ marginTop: '2rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '2rem' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ borderTop: '1px solid #000', paddingTop: '4px', marginTop: '40px', fontSize: '9pt' }}>Firma Responsable</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ borderTop: '1px solid #000', paddingTop: '4px', marginTop: '40px', fontSize: '9pt' }}>Aclaración</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ borderTop: '1px solid #000', paddingTop: '4px', marginTop: '40px', fontSize: '9pt' }}>DNI / Sello</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
