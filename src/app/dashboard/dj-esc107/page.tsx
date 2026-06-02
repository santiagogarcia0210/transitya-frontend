'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { serializarFirestore, toArray } from '@/lib/utils';
import { useEmpresaTipo } from '@/hooks/useEmpresaTipo';

interface Beneficiario {
  id: string;
  nombre?: string;
  'APELLIDO Y NOMBRE'?: string;
  dni?: string;
  DNI?: string;
  'N° AFILIADO'?: string;
  obraSocial?: string;
  'OBRA SOCIAL'?: string;
  chofer?: string;
  CHOFER?: string;
  domicilio?: string;
  DOMICILIO?: string;
  localidad?: string;
  LOCALIDAD?: string;
}

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export default function DJEsc107Page() {
  const router = useRouter();
  const { tipo, loading: tipoLoading } = useEmpresaTipo();

  const hoy = new Date();
  const [mes,  setMes]  = useState(hoy.getMonth() + 1);
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [beneficiarios, setBeneficiarios] = useState<Beneficiario[]>([]);
  const [seleccionado,  setSeleccionado]  = useState<Beneficiario | null>(null);
  const [loading,       setLoading]       = useState(false);
  const [busqueda,      setBusqueda]      = useState('');

  useEffect(() => {
    if (!tipoLoading && tipo !== null && tipo !== 'transporte_escolar' && tipo !== 'transporte_especial') {
      router.replace('/dashboard');
    }
  }, [tipo, tipoLoading, router]);

  useEffect(() => {
    if ((tipo === 'transporte_escolar' || tipo === 'transporte_especial')) cargarBenef();
  }, [mes, anio, tipo]);

  const cargarBenef = async () => {
    setLoading(true);
    try {
      // Intentar endpoint dedicado del mes
      let data: Beneficiario[] = [];
      try {
        const r = await api.get(`/api/planillas/dj107?mes=${mes}&anio=${anio}`);
        const d = serializarFirestore(r.data);
        data = toArray(d?.beneficiarios ?? d);
      } catch { /* fallback */ }

      if (data.length === 0) {
        const r = await api.get('/api/beneficiarios');
        data = toArray(r.data).map(serializarFirestore);
      }
      setBeneficiarios(data);
    } finally {
      setLoading(false);
    }
  };

  const nombre = (b: Beneficiario) => b.nombre || b['APELLIDO Y NOMBRE'] || '';

  const benefFiltrados = busqueda
    ? beneficiarios.filter(b =>
        nombre(b).toLowerCase().includes(busqueda.toLowerCase()) ||
        (b.dni || b.DNI || '').includes(busqueda) ||
        (b['N° AFILIADO'] || '').includes(busqueda)
      )
    : beneficiarios;

  const handlePrint = () => window.print();

  if (tipoLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', color: 'var(--text3)', padding: '2rem' }}>
      <span className="spinner" /> Verificando acceso…
    </div>
  );
  if (tipo !== 'transporte_escolar' && tipo !== 'transporte_especial') return null;

  return (
    <div>
      <div className="section-header no-print">
        <h2 className="section-title">📄 DJ — ESC 107</h2>
        {seleccionado && (
          <button className="btn btn-primary" onClick={handlePrint}>🖨️ Imprimir DJ</button>
        )}
      </div>

      {/* Controles */}
      <div className="card no-print" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label className="label">Mes de declaración</label>
            <select className="select" style={{ width: '140px' }} value={mes} onChange={e => setMes(Number(e.target.value))}>
              {MESES.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Año</label>
            <input className="input" type="number" style={{ width: '100px' }} value={anio} onChange={e => setAnio(Number(e.target.value))} />
          </div>
        </div>
      </div>

      {/* Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.25rem' }}>
        {/* Lista de beneficiarios */}
        <div className="no-print">
          <div style={{ marginBottom: '.75rem' }}>
            <input
              className="input"
              placeholder="Buscar por nombre / DNI / afiliado…"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
          </div>
          <div style={{ maxHeight: '70vh', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
            {loading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text3)' }}><span className="spinner" /></div>
            ) : benefFiltrados.length === 0 ? (
              <div className="empty-state"><p>Sin beneficiarios</p></div>
            ) : (
              benefFiltrados.map(b => (
                <div
                  key={b.id}
                  onClick={() => setSeleccionado(b)}
                  style={{
                    padding: '.65rem 1rem',
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    background: seleccionado?.id === b.id ? 'var(--blue-dim)' : 'transparent',
                    borderLeft: seleccionado?.id === b.id ? '3px solid var(--blue)' : '3px solid transparent',
                    transition: 'background 150ms',
                  }}
                >
                  <p style={{ fontSize: '.85rem', fontWeight: 500, color: 'var(--text)' }}>{nombre(b)}</p>
                  <p style={{ fontSize: '.75rem', color: 'var(--text3)' }}>
                    {(b.dni || b.DNI) && `DNI: ${b.dni || b.DNI}`}
                    {b['N° AFILIADO'] && ` · Afil: ${b['N° AFILIADO']}`}
                  </p>
                </div>
              ))
            )}
          </div>
          <p style={{ fontSize: '.75rem', color: 'var(--text3)', marginTop: '.5rem', textAlign: 'center' }}>
            {benefFiltrados.length} de {beneficiarios.length} beneficiarios
          </p>
        </div>

        {/* DJ Form — A4 */}
        <div>
          {!seleccionado ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text3)' }}>
              <p style={{ fontSize: '2rem', marginBottom: '.75rem' }}>👈</p>
              <p>Seleccioná un beneficiario para generar el DJ</p>
            </div>
          ) : (
            <div className="a4-page" id="dj-print">
              {/* Header logos */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', marginBottom: '12pt', borderBottom: '2pt solid #000', paddingBottom: '8pt' }}>
                <div style={{ fontSize: '9pt', fontWeight: 700 }}>
                  <div>ANDIS</div>
                  <div style={{ fontSize: '8pt', fontWeight: 400 }}>Agencia Nacional de Discapacidad</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '12pt', fontWeight: 900, letterSpacing: '1px' }}>DECLARACIÓN JURADA</div>
                  <div style={{ fontSize: '9pt', marginTop: '3px' }}>ESC 107 — Prestación de Transporte</div>
                </div>
                <div style={{ textAlign: 'right', fontSize: '9pt', fontWeight: 700 }}>
                  <div>Gobierno</div>
                  <div style={{ fontSize: '8pt', fontWeight: 400 }}>de la República Argentina</div>
                </div>
              </div>

              {/* Período */}
              <div style={{ textAlign: 'center', marginBottom: '12pt' }}>
                <span style={{ fontSize: '10pt', fontWeight: 700, background: '#f0f0f0', padding: '3px 12px', border: '1px solid #ccc' }}>
                  Período: {MESES[mes-1].toUpperCase()} {anio}
                </span>
              </div>

              {/* Datos del beneficiario */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '12pt', fontSize: '9pt' }}>
                <tbody>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '4px 8px', background: '#f5f5f5', fontWeight: 700, width: '35%' }}>Apellido y Nombre:</td>
                    <td style={{ border: '1px solid #000', padding: '4px 8px', width: '65%' }}>{nombre(seleccionado)}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '4px 8px', background: '#f5f5f5', fontWeight: 700 }}>N° de Beneficio / Afiliado:</td>
                    <td style={{ border: '1px solid #000', padding: '4px 8px' }}>{seleccionado['N° AFILIADO'] || '________________________________________'}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '4px 8px', background: '#f5f5f5', fontWeight: 700 }}>D.N.I.:</td>
                    <td style={{ border: '1px solid #000', padding: '4px 8px' }}>{seleccionado.dni || seleccionado.DNI || '________________________'}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '4px 8px', background: '#f5f5f5', fontWeight: 700 }}>Domicilio:</td>
                    <td style={{ border: '1px solid #000', padding: '4px 8px' }}>{seleccionado.domicilio || seleccionado.DOMICILIO || '___________________________________________________'}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '4px 8px', background: '#f5f5f5', fontWeight: 700 }}>Localidad:</td>
                    <td style={{ border: '1px solid #000', padding: '4px 8px' }}>{seleccionado.localidad || seleccionado.LOCALIDAD || '___________________________________________________'}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '4px 8px', background: '#f5f5f5', fontWeight: 700 }}>Obra Social:</td>
                    <td style={{ border: '1px solid #000', padding: '4px 8px' }}>{seleccionado.obraSocial || seleccionado['OBRA SOCIAL'] || '___________________________________________________'}</td>
                  </tr>
                  {(seleccionado.chofer || seleccionado.CHOFER) && (
                    <tr>
                      <td style={{ border: '1px solid #000', padding: '4px 8px', background: '#f5f5f5', fontWeight: 700 }}>Prestador / Chofer:</td>
                      <td style={{ border: '1px solid #000', padding: '4px 8px' }}>{seleccionado.chofer || seleccionado.CHOFER}</td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Declaración */}
              <div style={{ border: '1px solid #000', padding: '8pt', marginBottom: '12pt', fontSize: '8.5pt', lineHeight: '1.5' }}>
                <p style={{ fontWeight: 700, marginBottom: '4pt' }}>DECLARACIÓN:</p>
                <p>
                  El/la abajo firmante, en carácter de beneficiario/a o tutor/a legal, declara bajo juramento que la persona identificada
                  precedentemente utilizó efectivamente el servicio de transporte durante el período declarado,
                  correspondiente al mes de <strong>{MESES[mes-1]} {anio}</strong>, prestado por el transportista consignado,
                  conforme a lo establecido por ANDIS.
                </p>
              </div>

              {/* Conformidad / Firmas */}
              <div style={{ border: '1px solid #000', padding: '8pt', marginBottom: '12pt', fontSize: '9pt' }}>
                <p style={{ fontWeight: 700, marginBottom: '10pt' }}>CONFORMIDAD DEL BENEFICIARIO / TUTOR LEGAL:</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12pt' }}>
                  <div>
                    <div style={{ borderBottom: '1px solid #000', height: '40pt', marginBottom: '4pt' }} />
                    <p style={{ textAlign: 'center', fontSize: '8pt' }}>Firma del beneficiario / tutor</p>
                  </div>
                  <div>
                    <div style={{ borderBottom: '1px solid #000', height: '40pt', marginBottom: '4pt' }} />
                    <p style={{ textAlign: 'center', fontSize: '8pt' }}>Aclaración y D.N.I.</p>
                  </div>
                </div>
              </div>

              {/* Firma prestador */}
              <div style={{ border: '1px solid #000', padding: '8pt', fontSize: '9pt' }}>
                <p style={{ fontWeight: 700, marginBottom: '10pt' }}>PRESTADOR / TRANSPORTISTA:</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12pt' }}>
                  <div>
                    <div style={{ borderBottom: '1px solid #000', height: '40pt', marginBottom: '4pt' }} />
                    <p style={{ textAlign: 'center', fontSize: '8pt' }}>Firma del prestador</p>
                  </div>
                  <div>
                    <div style={{ borderBottom: '1px solid #000', height: '40pt', marginBottom: '4pt' }} />
                    <p style={{ textAlign: 'center', fontSize: '8pt' }}>Sello / CUIT / Aclaración</p>
                  </div>
                </div>
              </div>

              {/* Fecha */}
              <div style={{ textAlign: 'right', marginTop: '8pt', fontSize: '9pt' }}>
                Fecha de firma: _____ / _____ / ________
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
