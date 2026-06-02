'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { serializarFirestore, toArray } from '@/lib/utils';
import { useEmpresaTipo } from '@/hooks/useEmpresaTipo';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

interface Beneficiario {
  id: string; nombre: string; nroAfiliado: string; chofer: string;
}

function norm(b: Record<string,unknown>): Beneficiario {
  return {
    id:          String(b.id          || ''),
    nombre:      String(b.nombre      || b['APELLIDO Y NOMBRE'] || b.NOMBRE || ''),
    nroAfiliado: String(b.nroAfiliado || b['N° AFILIADO']      || b.nro_afiliado || ''),
    chofer:      String(b.chofer      || b.CHOFER      || ''),
  };
}

function diasDelMes(mes: number, anio: number): number {
  return new Date(anio, mes, 0).getDate();
}
function primerDia(mes: number, anio: number): number {
  return new Date(anio, mes - 1, 1).getDay(); // 0=Dom
}
function esFindeSemana(anio: number, mes: number, dia: number): boolean {
  const d = new Date(anio, mes - 1, dia).getDay();
  return d === 0 || d === 6;
}
function ultimoDia(mes: number, anio: number): string {
  const d = new Date(anio, mes, 0);
  return `${String(d.getDate()).padStart(2,'0')}/${String(mes).padStart(2,'0')}/${anio}`;
}

/* ── Estilos impresión ─────────────────────────────────────────────── */
const printCSS = `
@media print {
  .no-print { display: none !important; }
  body { margin: 0; }
  .doc-page { page-break-after: always; margin: 0; }
  .doc-page:last-child { page-break-after: auto; }
  @page { size: A4 portrait; margin: 1.5cm; }
}
`;

/* ── Documento 1: Conformidad ──────────────────────────────────────── */
function DocConformidad({ b, mes, anio }: { b: Beneficiario; mes: number; anio: number }) {
  const ultimo = ultimoDia(mes, anio);
  return (
    <div className="doc-page" style={{ fontFamily:'Arial, sans-serif', color:'#000', background:'#fff', padding:'1.5cm', border:'1px solid #ccc', marginBottom:'2rem', fontSize:'10pt' }}>
      {/* Header */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr', alignItems:'center', borderBottom:'2pt solid #000', paddingBottom:'8pt', marginBottom:'10pt' }}>
        <div style={{ fontSize:'9pt', fontWeight:700 }}>
          <div style={{ fontSize:'16pt', fontWeight:900 }}>T</div>
          <div>Programa Federal</div>
          <div>Incluir Salud</div>
        </div>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:'10pt', fontWeight:900 }}>PLANILLA CONFORMIDAD</div>
          <div style={{ fontSize:'9pt', fontWeight:700 }}>EFECTIVA PRESTACIÓN DE TRANSPORTE</div>
        </div>
        <div style={{ textAlign:'right', fontSize:'8pt' }}>
          <div>Agencia Nacional de Discapacidad</div>
          <div>Ministerio de Salud</div>
          <div>Gobierno de Tucumán</div>
        </div>
      </div>

      {/* Período */}
      <div style={{ display:'flex', gap:'2rem', marginBottom:'12pt' }}>
        <span><strong>MES:</strong> {MESES[mes-1].toUpperCase()}</span>
        <span><strong>AÑO:</strong> {anio}</span>
      </div>

      {/* Dato beneficiario */}
      <div style={{ border:'1pt solid #000', marginBottom:'12pt' }}>
        <div style={{ background:'#555', color:'#fff', padding:'3pt 6pt', fontSize:'9pt', fontWeight:700 }}>DATO BENEFICIARIO</div>
        <div style={{ padding:'6pt', display:'grid', gap:'6pt' }}>
          <div style={{ display:'flex', gap:'8pt', borderBottom:'1pt solid #ccc', paddingBottom:'4pt' }}>
            <strong style={{ minWidth:160 }}>APELLIDO Y NOMBRE:</strong>
            <span style={{ flex:1, borderBottom:'1pt solid #000' }}>{b.nombre}</span>
          </div>
          <div style={{ display:'flex', gap:'8pt' }}>
            <strong style={{ minWidth:160 }}>BENEFICIO Nro:</strong>
            <span style={{ flex:1, borderBottom:'1pt solid #000' }}>{b.nroAfiliado || '___________________________'}</span>
          </div>
        </div>
      </div>

      {/* Conformidad tutor */}
      <div style={{ border:'1pt solid #000', marginBottom:'12pt' }}>
        <div style={{ background:'#555', color:'#fff', padding:'3pt 6pt', fontSize:'9pt', fontWeight:700 }}>CONFORMIDAD TUTOR</div>
        <div style={{ padding:'8pt', fontSize:'9pt' }}>
          <p style={{ marginBottom:'8pt' }}>
            Por la presente manifiesto conformidad por el servicio prestado de Transporte al beneficiario a mi cargo.
          </p>
          <p style={{ marginBottom:'12pt' }}>
            <strong>Fecha (DD/MM/YYYY):</strong> {ultimo}
          </p>
          <div style={{ display:'grid', gap:'12pt' }}>
            <div>Firma Titular/Familiar/Responsable/Tutor: <span style={{ display:'inline-block', width:'60%', borderBottom:'1pt solid #000' }}>&nbsp;</span></div>
            <div>Aclaración: <span style={{ display:'inline-block', width:'70%', borderBottom:'1pt solid #000' }}>&nbsp;</span></div>
            <div>DNI: <span style={{ display:'inline-block', width:'40%', borderBottom:'1pt solid #000' }}>&nbsp;</span></div>
          </div>
        </div>
      </div>

      {/* Conformidad institución */}
      <div style={{ border:'1pt solid #000' }}>
        <div style={{ background:'#555', color:'#fff', padding:'3pt 6pt', fontSize:'9pt', fontWeight:700 }}>CONFORMIDAD INSTITUCIÓN / CENTRO</div>
        <div style={{ padding:'8pt', fontSize:'9pt' }}>
          <p style={{ marginBottom:'12pt' }}><strong>Fecha (DD/MM/YYYY):</strong> {ultimo}</p>
          <div style={{ display:'grid', gap:'12pt' }}>
            <div>Firma y Sello Responsable Institución: <span style={{ display:'inline-block', width:'55%', borderBottom:'1pt solid #000' }}>&nbsp;</span></div>
            <div>Sello Institución: <span style={{ display:'inline-block', width:'65%', borderBottom:'1pt solid #000' }}>&nbsp;</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Documento 2: Planilla mensual ─────────────────────────────────── */
function DocPlanillaMensual({ b, mes, anio }: { b: Beneficiario; mes: number; anio: number }) {
  const total = diasDelMes(mes, anio);
  const offset = (primerDia(mes, anio) + 6) % 7; // 0=Lun
  const semanas: (number|null)[][] = [];
  let semana: (number|null)[] = Array(offset).fill(null);
  for (let d = 1; d <= total; d++) {
    semana.push(d);
    if (semana.length === 7) { semanas.push(semana); semana = []; }
  }
  if (semana.length) { while (semana.length < 7) semana.push(null); semanas.push(semana); }

  const DOW_LABELS = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  const ultimo = ultimoDia(mes, anio);

  return (
    <div className="doc-page" style={{ fontFamily:'Arial, sans-serif', color:'#000', background:'#fff', padding:'1.5cm', border:'1px solid #ccc', marginBottom:'2rem', fontSize:'8.5pt' }}>
      {/* Header */}
      <div style={{ borderBottom:'2pt solid #000', paddingBottom:'6pt', marginBottom:'8pt', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8pt' }}>
        <div>
          <div style={{ fontWeight:700, fontSize:'9pt' }}>Transportista: FLORES MARIA JOSE</div>
          <div>Motor Salud — U.G.P. Tucumán</div>
        </div>
        <div style={{ textAlign:'right' }}>
          <div><strong>Apellido y Nombre:</strong> {b.nombre}</div>
          <div><strong>Beneficio Nro.:</strong> {b.nroAfiliado || '_______________'}</div>
          <div><strong>Período:</strong> {MESES[mes-1].toUpperCase()} / {anio}</div>
        </div>
      </div>

      {/* Grilla semanal */}
      <table style={{ width:'100%', borderCollapse:'collapse', marginBottom:'8pt', fontSize:'7.5pt' }}>
        <thead>
          <tr>
            {DOW_LABELS.map(d => (
              <th key={d} style={{ border:'1pt solid #000', padding:'2pt 3pt', background:'#ddd', textAlign:'center', width:`${100/7}%` }}>{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {semanas.map((sem, si) => (
            <tr key={si}>
              {sem.map((dia, di) => {
                const finSem = dia ? esFindeSemana(anio, mes, dia) : false;
                return (
                  <td key={di} style={{ border:'1pt solid #000', verticalAlign:'top', background: finSem ? '#e0e0e0' : '#fff', height:28 }}>
                    {dia ? (
                      <div>
                        <div style={{ fontSize:'6pt', textAlign:'right', paddingRight:'2pt', color:'#555' }}>{dia}</div>
                        {!finSem && (
                          <div style={{ display:'grid', gridTemplateRows:'1fr 1fr', height:18 }}>
                            <div style={{ borderBottom:'0.5pt solid #ccc', fontSize:'6pt', paddingLeft:'2pt', color:'#777' }}>IDA</div>
                            <div style={{ fontSize:'6pt', paddingLeft:'2pt', color:'#777' }}>VTA</div>
                          </div>
                        )}
                      </div>
                    ) : null}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Leyenda */}
      <div style={{ fontSize:'7pt', color:'#555', marginBottom:'8pt', padding:'3pt', border:'1pt solid #ccc' }}>
        <strong>Referencias:</strong> I = Asistencia normal · A = Ausente · P = Asistencia prolongada · C = Colectividad · F = Feriado
        <br/>Presencia Final (DÍAS/VIAJES): ______ &nbsp; Cantidad de Viaje: ______
      </div>

      {/* Firmas */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8pt', fontSize:'7.5pt', marginBottom:'6pt' }}>
        {[
          ['Firma/Sello Transportista', 'FLORES MARIA JOSE'],
          ['Firma Familiar/Responsable/Tutor', ''],
          ['Firma y Sello Centro', ''],
        ].map(([label, val]) => (
          <div key={label} style={{ border:'1pt solid #000', padding:'4pt' }}>
            <div style={{ fontWeight:700, marginBottom:'2pt', fontSize:'7pt' }}>{label}</div>
            <div style={{ borderBottom:'0.5pt solid #000', minHeight:20, fontSize:'7pt' }}>{val}</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4pt', marginTop:'3pt' }}>
              <div>Aclaración: <span style={{ display:'inline-block', width:'60%', borderBottom:'0.5pt solid #000' }}>&nbsp;</span></div>
              <div>{label.includes('Transportista') ? `DNI: 26-XXX-XXX  Fecha: ${ultimo}` : 'DNI: ______'}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */

export default function PlanillaIncluirPage() {
  const router = useRouter();
  const { tipo, loading: tipoLoading } = useEmpresaTipo();

  const hoy = new Date();
  const [mes,          setMes]          = useState(hoy.getMonth() + 1);
  const [anio,         setAnio]         = useState(hoy.getFullYear());
  const [beneficiarios,setBeneficiarios]= useState<Beneficiario[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [idxActual,    setIdxActual]    = useState(0);

  useEffect(() => {
    if (!tipoLoading && tipo !== null && tipo !== 'transporte_escolar' && tipo !== 'transporte_especial') router.replace('/dashboard');
  }, [tipo, tipoLoading, router]);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      let data: Beneficiario[] = [];
      try {
        const r = await api.get(`/api/planillas/incluir?mes=${mes}&anio=${anio}`);
        const d = serializarFirestore(r.data);
        data = toArray(d?.beneficiarios ?? d).map(norm);
      } catch { /* fallback */ }
      if (data.length === 0) {
        const r = await api.get('/api/beneficiarios');
        data = toArray(r.data).map(serializarFirestore).map(norm);
      }
      setBeneficiarios(data);
      setIdxActual(0);
    } catch { /* silent */ }
    setLoading(false);
  }, [mes, anio]);

  useEffect(() => { if ((tipo === 'transporte_escolar' || tipo === 'transporte_especial')) cargar(); }, [tipo, cargar]);

  const benef = beneficiarios[idxActual] || null;

  if (tipoLoading) return <div style={{padding:'2rem',color:'var(--text3)'}}><span className="spinner"/> Verificando…</div>;
  if (tipo !== 'transporte_escolar' && tipo !== 'transporte_especial') return null;

  return (
    <div>
      <style>{printCSS}</style>

      {/* Controles */}
      <div className="no-print card" style={{ padding:'1rem 1.25rem', marginBottom:'1.25rem' }}>
        <div style={{ display:'flex', gap:'1rem', flexWrap:'wrap', alignItems:'center' }}>
          {/* Mes / Año */}
          <select className="select" style={{ width:140 }} value={mes} onChange={e=>setMes(Number(e.target.value))}>
            {MESES.map((m,i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
          <input type="number" className="input" style={{ width:100 }} value={anio} onChange={e=>setAnio(Number(e.target.value))}/>

          {/* Navegación entre beneficiarios */}
          <div style={{ display:'flex', alignItems:'center', gap:'.5rem' }}>
            <button className="btn btn-secondary" onClick={()=>setIdxActual(i=>Math.max(0,i-1))} disabled={idxActual===0}>← Anterior</button>
            <span style={{ fontSize:'.82rem', color:'var(--text3)', whiteSpace:'nowrap' }}>
              {beneficiarios.length > 0 ? `Beneficiario ${idxActual+1} de ${beneficiarios.length}` : 'Sin datos'}
            </span>
            <button className="btn btn-secondary" onClick={()=>setIdxActual(i=>Math.min(beneficiarios.length-1,i+1))} disabled={idxActual>=beneficiarios.length-1}>Siguiente →</button>
          </div>

          <button className="btn btn-secondary" onClick={cargar} disabled={loading}>↻ Actualizar</button>
          <button className="btn btn-primary" onClick={()=>window.print()}>🖨️ Imprimir</button>
          <button className="btn btn-secondary" onClick={()=>{
            // Imprimir todos: mostrar todos y hacer print
            setIdxActual(-1); // -1 = mostrar todos
            setTimeout(()=>window.print(), 100);
          }}>🖨️ Imprimir todos</button>
        </div>
      </div>

      {loading ? (
        <div style={{display:'flex',alignItems:'center',gap:'.75rem',color:'var(--text3)',padding:'2rem'}}><span className="spinner"/> Cargando…</div>
      ) : beneficiarios.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">📝</div><p>Sin beneficiarios para {MESES[mes-1]} {anio}</p></div>
      ) : (
        <div>
          {/* Mostrar solo el actual (o todos si idx=-1) */}
          {(idxActual === -1 ? beneficiarios : beneficiarios.slice(idxActual, idxActual+1)).map(b => (
            <div key={b.id}>
              <DocConformidad b={b} mes={mes} anio={anio} />
              <DocPlanillaMensual b={b} mes={mes} anio={anio} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
