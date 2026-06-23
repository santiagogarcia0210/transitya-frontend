'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { serializarFirestore, toArray } from '@/lib/utils';
import { useEmpresaTipo } from '@/hooks/useEmpresaTipo';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

interface Beneficiario { id: string; nombre: string; nroAfiliado: string; }

function normB(b: Record<string,unknown>): Beneficiario {
  return {
    id:          String(b.id          || ''),
    nombre:      String(b.nombre      || b['APELLIDO Y NOMBRE'] || b.NOMBRE || ''),
    nroAfiliado: String(b.nroAfiliado || b['N° AFILIADO'] || b.nro_afiliado || ''),
  };
}

/* ── Genera array de días igual al GAS ─────────────────────────────────── */
function diasDelMes(mes: number, anio: number) {
  const total = new Date(anio, mes, 0).getDate();
  const arr: { dia: number; esDomingo: boolean; esSabado: boolean }[] = [];
  for (let d = 1; d <= total; d++) {
    const dow = new Date(anio, mes - 1, d).getDay();
    arr.push({ dia: d, esDomingo: dow === 0, esSabado: dow === 6 });
  }
  return arr;
}

/* ── Planilla A4 — idéntica al GAS renderPlanillaIncluir ───────────────── */
function PlanillaIncluir({ nombre, nroAfiliado, mes, anio }: {
  nombre: string; nroAfiliado: string; mes: number; anio: number;
}) {
  const LOGO_IS       = '/logos/logo-is.jpg';
  const LOGO_IS_COLOR = '/logos/logo-is-color.jpg';
  const LOGO_ANDIS    = '/logos/logo-andis.jpg';
  const LOGO_GOB      = '/logos/logo-gob.jpg';

  const mesNombre  = MESES[mes - 1];
  const mesStr     = String(mes).padStart(2, '0');
  const ultimoDia  = new Date(anio, mes, 0).getDate();
  const fechaFirma = String(ultimoDia).padStart(2, '0') + '/' + mesStr + '/' + anio;

  const dias = diasDelMes(mes, anio);
  // Armar filas de 7, igual que GAS
  const rows: typeof dias[] = [];
  let row: typeof dias = [];
  dias.forEach(d => { row.push(d); if (row.length === 7) { rows.push(row); row = []; } });
  if (row.length) rows.push(row);

  const BANDA: React.CSSProperties = {
    flexShrink: 0,
    background: '#b0b0b0', padding: '4pt 8pt',
    fontSize: '10.5pt', fontWeight: 'bold',
    color: '#000',
    WebkitPrintColorAdjust: 'exact',
    printColorAdjust: 'exact',
  };

  const tdBase: React.CSSProperties = {
    border: '1px solid #000',
    verticalAlign: 'top',
    padding: '2pt 2pt',
    WebkitPrintColorAdjust: 'exact',
    printColorAdjust: 'exact',
    width: '14.28%',
    height: '52pt',
  };

  return (
    <div className="dj-page" style={{
      width: '210mm', height: '297mm', boxSizing: 'border-box',
      padding: '10mm 14mm 8mm 16mm',
      fontFamily: 'Arial, sans-serif', fontSize: '10pt', color: '#000',
      background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>

      {/* LOGO IS */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <div style={{ flexShrink: 0, marginBottom: '3pt' }}><img src={LOGO_IS} alt="IS" style={{ height: '54pt', width: 'auto', display: 'block' }} /></div>

      {/* TITULO */}
      <div style={BANDA}>PLANILLA CONFORMIDAD EFECTIVA PRESTACIÓN DE TRANSPORTE</div>

      {/* SUBTITULO */}
      <div style={{ flexShrink: 0, fontSize: '8.5pt', fontWeight: 'bold', textAlign: 'center', padding: '2pt 0 3pt', color: '#333' }}>
        Incluir Salud — U.G.P. Tucumán
      </div>

      {/* DATOS DEL BENEFICIARIO */}
      <div style={{ flexShrink: 0, border: '1px solid #000', padding: '3pt 6pt', marginBottom: '3pt' }}>
        <div style={{ display: 'flex', gap: '4pt', fontSize: '9.5pt', marginBottom: '2pt' }}>
          <span style={{ fontWeight: 'bold', minWidth: '90pt' }}>Transportista:</span>
          <span style={{ fontWeight: 'bold' }}>FLORES MARIA JOSE</span>
        </div>
        <div style={{ display: 'flex', gap: '4pt', fontSize: '9.5pt', marginBottom: '2pt' }}>
          <span style={{ fontWeight: 'bold', minWidth: '90pt' }}>Apellido y Nombre:</span>
          <span style={{ borderBottom: '1px solid #555', flex: 1, fontWeight: 'bold' }}>{nombre}</span>
        </div>
        <div style={{ display: 'flex', gap: '4pt', fontSize: '9.5pt', marginBottom: '2pt' }}>
          <span style={{ fontWeight: 'bold', minWidth: '90pt' }}>Beneficio Nro.:</span>
          <span style={{ borderBottom: '1px solid #555', minWidth: '140pt' }}>{nroAfiliado}</span>
        </div>
        <div style={{ display: 'flex', gap: '4pt', fontSize: '9.5pt' }}>
          <span style={{ fontWeight: 'bold', minWidth: '90pt' }}>Período:</span>
          <span style={{ fontWeight: 'bold' }}>{mesNombre} / {anio}</span>
        </div>
      </div>

      {/* CALENDARIO */}
      <table style={{ flexShrink: 0, width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', marginBottom: '3pt' }}>
        <tbody>
          {rows.map((row, rIdx) => {
            const isLast = rIdx === rows.length - 1;
            const remaining = 7 - row.length;
            return (
              <tr key={rIdx}>
                {row.map((d, ci) => {
                  const bg = d.esDomingo ? '#888888' : d.esSabado ? '#c0c0c0' : '#fff';
                  return (
                    <td key={ci} style={{ ...tdBase, background: bg }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', gap: '1pt' }}>
                        <div style={{ fontSize: '11pt', fontWeight: 'bold', width: '100%', textAlign: 'center', lineHeight: 1.3, borderBottom: '1px solid #555' }}>
                          {String(d.dia).padStart(2, '0')}
                        </div>
                        <div style={{ fontSize: '7pt', color: '#333', width: '100%', textAlign: 'center', borderBottom: '1px solid #aaa' }}>
                          {String(d.dia).padStart(2, '0')}/{mesStr}/{anio}
                        </div>
                        {d.esDomingo ? (
                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10pt', fontWeight: 'bold' }}>DOMINGO</div>
                        ) : d.esSabado ? (
                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10pt', fontWeight: 'bold' }}>SÁBADO</div>
                        ) : (
                          <div style={{ flex: 1 }} />
                        )}
                      </div>
                    </td>
                  );
                })}
                {/* Últimas celdas con Referencias y Anexo */}
                {isLast && remaining > 0 && (() => {
                  const refCols = Math.ceil(remaining / 2);
                  const aneCols = Math.floor(remaining / 2);
                  return (
                    <>
                      <td colSpan={refCols} style={{ border: '1px solid #000', padding: '4pt 6pt', verticalAlign: 'top', height: '52pt', fontSize: '8pt' }}>
                        <strong>Referencias:</strong><br />X = Asistencia normal<br />A = Ausente<br />AP = Ausencia prolongada<br />E = Enfermedad<br />F = Feriado
                      </td>
                      {aneCols > 0 && (
                        <td colSpan={aneCols} style={{ border: '1px solid #000', padding: '4pt 6pt', verticalAlign: 'top', height: '52pt', fontSize: '8pt' }}>
                          <strong>Presenta Anexo<br />(Observaciones)</strong><br />NO<br />SI<br />Cantidad de Hojas:
                        </td>
                      )}
                    </>
                  );
                })()}
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* FIRMA TRANSPORTISTA */}
      <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', marginBottom: '3pt' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', fontSize: '8.5pt' }}>
          <tbody>
            <tr>
              <td style={{ padding: '12pt 4pt 2pt', textAlign: 'center', borderRight: '1px solid #000', width: '30%' }}></td>
              <td style={{ padding: '2pt 4pt', textAlign: 'center', borderRight: '1px solid #000', width: '28%' }}>Flores Maria Jose</td>
              <td style={{ padding: '2pt 4pt', textAlign: 'center', borderRight: '1px solid #000', width: '18%' }}>26.638.377</td>
              <td style={{ padding: '2pt 4pt', textAlign: 'center', width: '24%' }}>{fechaFirma}</td>
            </tr>
            <tr style={{ borderTop: '1px solid #000' }}>
              <td style={{ padding: '2pt 4pt', textAlign: 'center', borderRight: '1px solid #000', fontSize: '7.5pt' }}>Firma/Sello Transportista</td>
              <td style={{ padding: '2pt 4pt', textAlign: 'center', borderRight: '1px solid #000', fontSize: '7.5pt' }}>Aclaración</td>
              <td style={{ padding: '2pt 4pt', textAlign: 'center', borderRight: '1px solid #000', fontSize: '7.5pt' }}>DNI</td>
              <td style={{ padding: '2pt 4pt', textAlign: 'center', fontSize: '7.5pt' }}>Fecha</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* FIRMA FAMILIAR/TUTOR */}
      <div style={{ flexShrink: 0, marginBottom: '3pt' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8.5pt' }}>
          <tbody>
            <tr style={{ borderTop: '1px solid #000' }}>
              <td style={{ padding: '10pt 4pt 2pt', width: '36%' }}>Firma Familiar/Responsable/Tutor</td>
              <td style={{ padding: '10pt 4pt 2pt', width: '24%' }}>Aclaración</td>
              <td style={{ padding: '10pt 4pt 2pt', width: '18%' }}>DNI</td>
              <td style={{ padding: '10pt 4pt 2pt', width: '22%', textAlign: 'right' }}>{fechaFirma}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* FIRMA RESPONSABLE CENTRO */}
      <div style={{ flexShrink: 0, marginBottom: '4pt' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', fontSize: '8.5pt' }}>
          <tbody>
            <tr>
              <td style={{ padding: '12pt 4pt 2pt', textAlign: 'center', borderRight: '1px solid #000', width: '34%' }}></td>
              <td style={{ padding: '12pt 4pt 2pt', textAlign: 'center', borderRight: '1px solid #000', width: '32%' }}></td>
              <td style={{ padding: '12pt 4pt 2pt', textAlign: 'center', width: '34%' }}></td>
            </tr>
            <tr style={{ borderTop: '1px solid #000' }}>
              <td style={{ padding: '2pt 4pt', textAlign: 'center', borderRight: '1px solid #000', fontSize: '7.5pt' }}>Firma Responsable Centro</td>
              <td style={{ padding: '2pt 4pt', textAlign: 'center', borderRight: '1px solid #000', fontSize: '7.5pt' }}>Aclaración</td>
              <td style={{ padding: '2pt 4pt', textAlign: 'center', fontSize: '7.5pt' }}>Sello Centro</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* LOGOS FOOTER */}
      <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10pt' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO_IS_COLOR} alt="IS Color" style={{ height: '30pt', width: 'auto' }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO_ANDIS} alt="ANDIS" style={{ height: '30pt', width: 'auto' }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO_GOB} alt="Gobierno" style={{ height: '30pt', width: 'auto' }} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */

export default function PlanillaIncluirPage() {
  const authLoading = useRequireAdmin();
  const router = useRouter();
  const { tipo, loading: tipoLoading } = useEmpresaTipo();

  const hoy = new Date();
  const [mes,          setMes]          = useState(hoy.getMonth() + 1);
  const [anio,         setAnio]         = useState(hoy.getFullYear());
  const [beneficiarios,setBeneficiarios]= useState<Beneficiario[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [resumen,      setResumen]      = useState('');

  useEffect(() => {
    if (!tipoLoading && tipo !== null && tipo !== 'transporte_escolar' && tipo !== 'transporte_especial')
      router.replace('/dashboard');
  }, [tipo, tipoLoading, router]);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      let data: Beneficiario[] = [];
      try {
        const r = await api.get(`/api/planillas/incluir?mes=${mes}&anio=${anio}`);
        const d = serializarFirestore(r.data);
        const arr = toArray(d?.planillas ?? d?.beneficiarios ?? d);
        data = arr.filter((b: Record<string,unknown>) =>
          (b.nroAfiliado || b['N° AFILIADO'] || b.nro_afiliado || b.beneficiario)
        ).map(normB);
      } catch { /* fallback */ }
      if (!data.length) {
        const r = await api.get('/api/beneficiarios');
        data = toArray(r.data).map(serializarFirestore)
          .filter((b: Record<string,unknown>) => b.nroAfiliado || b['N° AFILIADO'])
          .map(normB);
      }
      setBeneficiarios(data);
      setResumen(`${MESES[mes-1]} ${anio} — ${data.length} planillas`);
    } catch { /* silent */ }
    setLoading(false);
  }, [mes, anio]);

  useEffect(() => {
    if (tipo === 'transporte_escolar' || tipo === 'transporte_especial') cargar();
  }, [tipo, cargar]);

  function cambiarMes(delta: number) {
    let m = mes + delta, a = anio;
    if (m < 1) { m = 12; a--; }
    if (m > 12) { m = 1; a++; }
    setMes(m); setAnio(a);
  }

  if (authLoading) return null;
  if (tipoLoading) return <div style={{ padding:'2rem', color:'var(--text3)' }}><span className="spinner"/> Verificando…</div>;
  if (tipo !== 'transporte_escolar' && tipo !== 'transporte_especial') return null;

  return (
    <div>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; background: #fff !important; }
          .dj-page { page-break-after: always; }
          .dj-page:last-child { page-break-after: auto; }
          @page { size: A4 portrait; margin: 0; }
        }
      `}</style>

      {/* Controles */}
      <div className="no-print card" style={{ padding:'1rem 1.25rem', marginBottom:'1.25rem' }}>
        <div style={{ display:'flex', gap:'1rem', flexWrap:'wrap', alignItems:'center' }}>
          <button className="btn btn-secondary" onClick={() => cambiarMes(-1)}>← Anterior</button>
          <select className="select" style={{ width:140 }} value={mes} onChange={e => setMes(Number(e.target.value))}>
            {MESES.map((m,i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
          <input type="number" className="input" style={{ width:90 }} value={anio} onChange={e => setAnio(Number(e.target.value))} />
          <button className="btn btn-secondary" onClick={() => cambiarMes(1)}>Siguiente →</button>
          <span style={{ fontSize:'.82rem', color:'var(--text3)' }}>{resumen}</span>
          <button className="btn btn-secondary" onClick={cargar} disabled={loading} style={{ marginLeft:'auto' }}>↻ Actualizar</button>
          <button className="btn btn-primary" onClick={() => window.print()}>🖨️ Imprimir todos</button>
        </div>
      </div>

      {loading ? (
        <div style={{ display:'flex', alignItems:'center', gap:'.75rem', color:'var(--text3)', padding:'2rem' }}>
          <span className="spinner"/> Cargando planillas…
        </div>
      ) : beneficiarios.length === 0 ? (
        <div className="empty-state no-print">
          <div className="empty-icon">📝</div>
          <p>No hay afiliados con número de beneficiario para {MESES[mes-1]} {anio}</p>
        </div>
      ) : (
        <div className="dj-pages">
          {beneficiarios.map(b => (
            <PlanillaIncluir key={b.id} nombre={b.nombre} nroAfiliado={b.nroAfiliado} mes={mes} anio={anio} />
          ))}
        </div>
      )}
    </div>
  );
}
