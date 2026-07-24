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
    fontSize: '11pt', fontWeight: 'bold', textAlign: 'center',
    color: '#000',
    WebkitPrintColorAdjust: 'exact',
    printColorAdjust: 'exact',
  };

  const tdBase: React.CSSProperties = {
    border: '1px solid #000',
    verticalAlign: 'top',
    padding: 0,
    WebkitPrintColorAdjust: 'exact',
    printColorAdjust: 'exact',
    width: '14.28%',
    height: '58pt',
  };

  const DATO: React.CSSProperties = {
    display: 'flex', alignItems: 'flex-end', gap: '6pt',
    fontSize: '9.5pt', marginBottom: '5pt',
  };

  const SIG_BOX: React.CSSProperties = {
    flexShrink: 0,
    border: '1.2pt solid #000', borderRadius: '8pt',
    padding: '3pt 10pt', marginBottom: '5pt',
    WebkitPrintColorAdjust: 'exact',
    printColorAdjust: 'exact',
  };

  const SIG_VAL: React.CSSProperties = {
    display: 'flex', alignItems: 'flex-end',
    minHeight: '38pt', fontSize: '9pt',
  };

  const SIG_LBL: React.CSSProperties = {
    display: 'flex', borderTop: '1px dotted #666',
    paddingTop: '2pt', fontSize: '7.5pt',
  };

  return (
    <div className="dj-page planilla-incluir-page" style={{
      width: '210mm', height: '297mm', boxSizing: 'border-box',
      padding: '10mm 12mm 8mm 14mm',
      fontFamily: 'Arial, sans-serif', fontSize: '10pt', color: '#000',
      background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>

      {/* LOGO IS */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <div style={{ flexShrink: 0, marginBottom: '4pt' }}><img src={LOGO_IS} alt="IS" style={{ height: '50pt', width: 'auto', display: 'block' }} /></div>

      {/* TITULO */}
      <div style={BANDA}>PLANILLA CONFORMIDAD EFECTIVA PRESTACIÓN TRANSPORTE</div>

      {/* SUBTITULO */}
      <div style={{ flexShrink: 0, fontSize: '10.5pt', fontWeight: 'bold', textAlign: 'center', padding: '3pt 0 6pt' }}>
        Incluir Salud U.G.P. Tucumán
      </div>

      {/* DATOS DEL BENEFICIARIO */}
      <div style={{ flexShrink: 0, marginBottom: '4pt' }}>
        <div style={DATO}>
          <span style={{ minWidth: '95pt' }}>Transportista:</span>
          <span style={{ borderBottom: '1px dotted #555', flex: 1, fontWeight: 'bold' }}>FLORES MARIA JOSE</span>
        </div>
        <div style={DATO}>
          <span style={{ minWidth: '95pt' }}>Apellido y Nombre:</span>
          <span style={{ borderBottom: '1px dotted #555', flex: 1, fontWeight: 'bold' }}>{nombre}</span>
        </div>
        <div style={DATO}>
          <span style={{ minWidth: '95pt' }}>Beneficio Nro.:</span>
          <span style={{ borderBottom: '1px dotted #555', minWidth: '200pt', fontWeight: 'bold' }}>{nroAfiliado}</span>
        </div>
        <div style={{ ...DATO, marginBottom: 0 }}>
          <span style={{ minWidth: '95pt' }}>Año y mes declarado:</span>
          <span style={{ fontWeight: 'bold', fontSize: '10.5pt', paddingLeft: '20pt' }}>{mesNombre.toUpperCase()}/{anio}</span>
        </div>
      </div>

      {/* CALENDARIO */}
      <table style={{ flexShrink: 0, width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', marginBottom: '6pt' }}>
        <tbody>
          {rows.map((row, rIdx) => {
            const isLast = rIdx === rows.length - 1;
            const remaining = 7 - row.length;
            return (
              <tr key={rIdx}>
                {row.map((d, ci) => (
                  <td key={ci} style={tdBase}>
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                      <div style={{ fontSize: '10pt', fontWeight: 'bold', textAlign: 'center', lineHeight: 1.35, borderBottom: '1px solid #000' }}>
                        {d.dia}
                      </div>
                      <div style={{ fontSize: '6.5pt', color: '#333', textAlign: 'center', padding: '1pt 0', borderBottom: '1px solid #999' }}>
                        {String(d.dia).padStart(2, '0')}/{mesStr}/{anio}
                      </div>
                      <div style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '8.5pt', fontWeight: 'bold',
                        background: d.esDomingo || d.esSabado ? '#c0c0c0' : 'transparent',
                        WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
                      }}>
                        {d.esDomingo ? 'DOMINGO' : d.esSabado ? 'SÁBADO' : ''}
                      </div>
                    </div>
                  </td>
                ))}
                {/* Referencias / Anexo — 4 celdas separadas, igual al original:
                    Referencias | Presenta Anexo (header) | NO/SI apilado | Cantidad de Hojas */}
                {isLast && remaining > 0 && (() => {
                  const infoTd: React.CSSProperties = {
                    border: '1px solid #000', padding: '3pt 5pt', verticalAlign: 'top',
                    height: '58pt', fontSize: '7.5pt', lineHeight: 1.35,
                  };
                  // remaining >= 4 siempre (4 para 31 días, 7 para la fila extra de 28 días).
                  // El excedente sobre el mínimo de 1 columna por celda se lo lleva primero
                  // Referencias (tiene el texto más largo) y luego Presenta Anexo.
                  const extra      = remaining - 4;
                  const refCols    = 1 + Math.min(extra, 2);
                  const anexoCols  = 1 + Math.max(0, extra - 2);
                  const noSiCols   = 1;
                  const hojasCols  = remaining - refCols - anexoCols - noSiCols;
                  return (
                    <>
                      <td colSpan={refCols} style={infoTd}>
                        <strong>Referencias:</strong><br />X = Asistencia normal<br />A = Ausente<br />AP = Ausencia prolongada<br />E = Enfermedad<br />F = Feriado
                      </td>
                      <td colSpan={anexoCols} style={{ ...infoTd, lineHeight: 1.5 }}>
                        <strong>Presenta Anexo<br />(Observaciones):</strong>
                      </td>
                      <td colSpan={noSiCols} style={{ ...infoTd, lineHeight: 1.6 }}>
                        NO&nbsp;☐<br />SI&nbsp;☐
                      </td>
                      <td colSpan={hojasCols} style={{ ...infoTd, lineHeight: 1.5 }}>
                        Cantidad de<br />Hojas: ____
                      </td>
                    </>
                  );
                })()}
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ flex: '1 1 auto' }} />

      {/* FIRMA TRANSPORTISTA */}
      <div style={SIG_BOX}>
        <div style={SIG_VAL}>
          <span style={{ width: '32%' }} />
          <span style={{ width: '30%', textAlign: 'center' }}>Flores Maria Jose</span>
          <span style={{ width: '18%', textAlign: 'center' }}>26.638.377</span>
          <span style={{ width: '20%', textAlign: 'center' }}>{fechaFirma}</span>
        </div>
        <div style={SIG_LBL}>
          <span style={{ width: '32%' }}>Firma/Sello Transportista</span>
          <span style={{ width: '30%', textAlign: 'center' }}>Aclaración</span>
          <span style={{ width: '18%', textAlign: 'center' }}>DNI</span>
          <span style={{ width: '20%', textAlign: 'center' }}>Fecha</span>
        </div>
      </div>

      {/* FIRMA FAMILIAR/TUTOR */}
      <div style={SIG_BOX}>
        <div style={SIG_VAL}>
          <span style={{ width: '32%' }} />
          <span style={{ width: '30%' }} />
          <span style={{ width: '18%' }} />
          <span style={{ width: '20%', textAlign: 'center' }}>{fechaFirma}</span>
        </div>
        <div style={SIG_LBL}>
          <span style={{ width: '32%' }}>Firma Familiar/Responsable/Tutor</span>
          <span style={{ width: '30%', textAlign: 'center' }}>Aclaración</span>
          <span style={{ width: '18%', textAlign: 'center' }}>DNI</span>
          <span style={{ width: '20%', textAlign: 'center' }}>Fecha</span>
        </div>
      </div>

      {/* FIRMA RESPONSABLE CENTRO */}
      <div style={{ ...SIG_BOX, marginBottom: '8pt' }}>
        <div style={SIG_VAL} />
        <div style={SIG_LBL}>
          <span style={{ width: '28%' }}>Firma Responsable Centro</span>
          <span style={{ width: '24%', textAlign: 'center' }}>Aclaración</span>
          <span style={{ width: '28%', textAlign: 'center' }}>Sello Centro</span>
          <span style={{ width: '20%', textAlign: 'center' }}>Fecha</span>
        </div>
      </div>

      {/* LOGOS FOOTER — Incluir Salud destacado a la izquierda, resto distribuido a lo ancho */}
      <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO_IS_COLOR} alt="Incluir Salud" style={{ height: '38pt', width: 'auto' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '14pt' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_ANDIS} alt="ANDIS" style={{ height: '32pt', width: 'auto' }} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_GOB} alt="Gobierno de Tucumán" style={{ height: '32pt', width: 'auto' }} />
        </div>
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

          /*
           * margin:0 depende de que el driver de impresión lo respete —
           * varios (ej. "Microsoft Print to PDF" en Windows) imponen su
           * propio margen mínimo igual, lo que desborda el contenido
           * calculado para 297mm completos a una segunda hoja. Se declara
           * un margen explícito que el driver va a respetar sin recortar
           * nada por su cuenta (mismo criterio aplicado en dj-esc107).
           */
          @page { size: A4 portrait; margin: 10mm; }

          /*
           * globals.css fuerza .dj-page a display:block + overflow:visible
           * en @media print (regla compartida con dj-esc107, cambio-transporte
           * y presentacion-docs). Esta plantilla depende de flex-column +
           * overflow:hidden para repartir el espacio vertical entre la
           * grilla, las firmas y el footer. Se restaura sólo para esta
           * plantilla vía clase propia (mayor especificidad que globals.css),
           * sin tocar la regla global ni afectar a las otras plantillas.
           */
          .dj-page.planilla-incluir-page {
            display: flex !important;
            flex-direction: column !important;
            overflow: hidden !important;
            width: 190mm !important;
            height: 277mm !important;
            max-height: 277mm !important;
            padding: 10mm 12mm 8mm 14mm !important;
          }
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
