'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { serializarFirestore, toArray } from '@/lib/utils';
import { useEmpresaTipo } from '@/hooks/useEmpresaTipo';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

interface Beneficiario {
  id: string; nombre: string; nroAfiliado: string;
  dni?: string; chofer?: string;
}

function normB(b: Record<string,unknown>): Beneficiario {
  return {
    id:          String(b.id          || ''),
    nombre:      String(b.nombre      || b['APELLIDO Y NOMBRE'] || b.NOMBRE || ''),
    nroAfiliado: String(b.nroAfiliado || b['N° AFILIADO'] || b.nro_afiliado || b.beneficiario || ''),
    dni:         String(b.dni         || b.DNI || ''),
    chofer:      String(b.chofer      || b.CHOFER || ''),
  };
}

/* ── Planilla DJ A4 — idéntica al GAS renderDjPage ─────────────────────── */
function DjPage({ b, mes, anio }: { b: Beneficiario; mes: number; anio: number }) {
  const LOGO_IS    = '/logos/logo-is.jpg';
  const LOGO_ANDIS = '/logos/logo-andis.jpg';
  const LOGO_GOB   = '/logos/logo-gob.jpg';

  const mesNombre     = MESES[mes - 1];
  const anioFormateado = String(anio);
  // Último día del mes (DD)
  const ultimoDia = String(new Date(anio, mes, 0).getDate()).padStart(2, '0');

  const BANDA: React.CSSProperties = {
    flexShrink: 0,
    background: '#b0b0b0', padding: '5pt 8pt',
    fontSize: '11pt', fontWeight: 'bold', color: '#000',
    WebkitPrintColorAdjust: 'exact',
    printColorAdjust: 'exact',
  };

  return (
    <div className="dj-page" style={{
      width: '210mm', height: '297mm', boxSizing: 'border-box',
      padding: '14mm 15mm 10mm 20mm',
      fontFamily: 'Arial, sans-serif', fontSize: '11pt', color: '#000',
      background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>

      {/* LOGO IS */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <div style={{ flexShrink: 0, marginBottom: '6pt' }}>
        <img src={LOGO_IS} alt="Incluir Salud" style={{ height: '65pt', width: 'auto', display: 'block' }} />
      </div>

      {/* TITULO */}
      <div style={BANDA}>PLANILLA CONFORMIDAD EFECTIVA PRESTACIÓN DE TRANSPORTE</div>

      <div style={{ flex: '1 1 auto' }} />

      {/* MES / AÑO */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6pt', fontSize: '11pt' }}>
        <span style={{ fontWeight: 'bold', minWidth: '32pt' }}>MES:</span>
        <span style={{ border: '1px solid #000', padding: '3pt 0', minWidth: '160pt', textAlign: 'center', fontWeight: 'bold' }}>
          {mesNombre}
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ fontWeight: 'bold', minWidth: '24pt' }}>AÑO:</span>
        <span style={{ border: '1px solid #000', padding: '3pt 6pt', minWidth: '40pt', textAlign: 'center' }}>
          {anioFormateado}
        </span>
      </div>

      <div style={{ flex: '1 1 auto' }} />

      {/* DATOS BENEFICIARIO */}
      <div style={{ flexShrink: 0, fontWeight: 'bold', fontSize: '11pt', marginBottom: '4pt' }}>DATOS BENEFICIARIO:</div>
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'stretch', fontSize: '11pt' }}>
        <span style={{ minWidth: '130pt', display: 'flex', alignItems: 'center' }}>APELLIDO Y NOMBRE</span>
        <span style={{ border: '1px solid #000', flex: 1, padding: '3pt 6pt', fontWeight: 'bold' }}>{b.nombre}</span>
      </div>
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'stretch', fontSize: '11pt' }}>
        <span style={{ minWidth: '130pt', display: 'flex', alignItems: 'center' }}>BENEFICIO Nro</span>
        <span style={{ border: '1px solid #000', borderTop: 'none', padding: '3pt 6pt', minWidth: '185pt' }}>
          Beneficio Nro.: {b.nroAfiliado}
        </span>
        <span style={{ flex: 1 }} />
      </div>

      {/* CONFORMIDAD TUTOR */}
      <div style={{ ...BANDA, marginTop: '6pt' }}>CONFORMIDAD TUTOR:</div>
      <div style={{ flexShrink: 0, paddingTop: '6pt', fontSize: '11pt', lineHeight: 1.7 }}>
        Por la presente manifiesto conformidad por el servicio prestado de Transporte al beneficiario a mi cargo
      </div>

      <div style={{ flex: '1 1 auto' }} />

      {/* FECHA TUTOR */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'flex-end', gap: '4pt', fontSize: '11pt' }}>
        <span style={{ minWidth: '128pt' }}>Fecha (DD/MM/YYYY):</span>
        <span style={{ borderBottom: '1px solid #000', minWidth: '30pt', textAlign: 'center', display: 'inline-block', padding: '0 4pt' }}>{ultimoDia}</span>
        <span style={{ padding: '0 3pt' }}>/</span>
        <span style={{ borderBottom: '1px solid #000', minWidth: '54pt', textAlign: 'center', display: 'inline-block', padding: '0 4pt' }}>{mesNombre}</span>
        <span style={{ padding: '0 3pt' }}>/</span>
        <span style={{ borderBottom: '1px solid #000', minWidth: '44pt', textAlign: 'center', display: 'inline-block', padding: '0 4pt' }}>{anioFormateado}</span>
      </div>

      <div style={{ flex: '3 1 auto' }} />

      {/* FIRMA TUTOR */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'flex-end', gap: '6pt', fontSize: '11pt', marginBottom: '8pt' }}>
        <span style={{ minWidth: '185pt', whiteSpace: 'nowrap' }}>Firma Titular/Familiar/Responsable/Tutor</span>
        <span style={{ flex: 1, borderBottom: '1px solid #000', display: 'inline-block' }} />
      </div>
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'flex-end', gap: '6pt', fontSize: '11pt', marginBottom: '8pt' }}>
        <span style={{ minWidth: '70pt', whiteSpace: 'nowrap' }}>Aclaración</span>
        <span style={{ borderBottom: '1px solid #000', display: 'inline-block', minWidth: '170pt' }} />
      </div>
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'flex-end', gap: '6pt', fontSize: '11pt' }}>
        <span style={{ minWidth: '30pt', whiteSpace: 'nowrap' }}>DNI</span>
        <span style={{ borderBottom: '1px solid #000', display: 'inline-block', minWidth: '130pt' }} />
      </div>

      <div style={{ flex: '1 1 auto', minHeight: '6pt' }} />

      {/* CONFORMIDAD INSTITUCIÓN */}
      <div style={BANDA}>CONFORMIDAD INSTITUCIÓN / CENTRO:</div>
      <div style={{ flexShrink: 0, height: '10pt' }} />

      {/* FECHA INSTITUCIÓN */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'flex-end', gap: '4pt', fontSize: '11pt' }}>
        <span style={{ minWidth: '128pt' }}>Fecha (DD/MM/YYYY)</span>
        <span style={{ borderBottom: '1px solid #000', minWidth: '30pt', textAlign: 'center', display: 'inline-block', padding: '0 4pt' }}>{ultimoDia}</span>
        <span style={{ padding: '0 3pt' }}>/</span>
        <span style={{ borderBottom: '1px solid #000', minWidth: '54pt', textAlign: 'center', display: 'inline-block', padding: '0 4pt' }}>{mesNombre}</span>
        <span style={{ padding: '0 3pt' }}>/</span>
        <span style={{ borderBottom: '1px solid #000', minWidth: '44pt', textAlign: 'center', display: 'inline-block', padding: '0 4pt' }}>{anioFormateado}</span>
      </div>

      <div style={{ flex: '3 1 auto' }} />

      {/* FIRMA INSTITUCIÓN */}
      <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: '11pt' }}>
        <span>Firma y Sello Responsable Institución</span>
        <span>Sello Institución</span>
      </div>

      <div style={{ flex: '1 1 auto' }} />

      {/* LOGOS FOOTER */}
      <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16pt' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO_ANDIS} alt="ANDIS" style={{ height: '48pt', width: 'auto' }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO_GOB} alt="Gobierno" style={{ height: '48pt', width: 'auto' }} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */

export default function DJEsc107Page() {
  const router = useRouter();
  const { tipo, loading: tipoLoading } = useEmpresaTipo();

  const hoy = new Date();
  const [mes,          setMes]          = useState(hoy.getMonth() + 1);
  const [anio,         setAnio]         = useState(hoy.getFullYear());
  const [beneficiarios,setBeneficiarios]= useState<Beneficiario[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [resumen,      setResumen]      = useState('');
  const [busqueda,     setBusqueda]     = useState('');
  const [seleccionado, setSeleccionado] = useState<Beneficiario | null>(null);
  const [modoTodos,    setModoTodos]    = useState(false);

  useEffect(() => {
    if (!tipoLoading && tipo !== null && tipo !== 'transporte_escolar' && tipo !== 'transporte_especial')
      router.replace('/dashboard');
  }, [tipo, tipoLoading, router]);

  const cargar = async () => {
    setLoading(true);
    try {
      let data: Beneficiario[] = [];
      try {
        const r = await api.get(`/api/planillas/dj107?mes=${mes}&anio=${anio}`);
        const d = serializarFirestore(r.data);
        const arr = toArray(d?.planillas ?? d?.beneficiarios ?? d);
        data = arr.filter((b: Record<string,unknown>) =>
          (b.nroAfiliado || b['N° AFILIADO'] || b.beneficiario)
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
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (tipo === 'transporte_escolar' || tipo === 'transporte_especial') cargar();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes, anio, tipo]);

  function cambiarMes(delta: number) {
    let m = mes + delta, a = anio;
    if (m < 1) { m = 12; a--; }
    if (m > 12) { m = 1; a++; }
    setMes(m); setAnio(a);
  }

  const filtrados = busqueda
    ? beneficiarios.filter(b =>
        b.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        b.nroAfiliado.includes(busqueda) ||
        (b.dni || '').includes(busqueda)
      )
    : beneficiarios;

  if (tipoLoading) return <div style={{ padding:'2rem', color:'var(--text3)' }}><span className="spinner"/> Verificando…</div>;
  if (tipo !== 'transporte_escolar' && tipo !== 'transporte_especial') return null;

  // Modo impresión: muestra todas o sólo la seleccionada
  const paginas = modoTodos ? filtrados : seleccionado ? [seleccionado] : [];

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
          <button className="btn btn-primary" onClick={() => { setModoTodos(true); setTimeout(() => window.print(), 80); }}>
            🖨️ Imprimir todos
          </button>
          {seleccionado && (
            <button className="btn btn-primary" onClick={() => { setModoTodos(false); setTimeout(() => window.print(), 80); }}>
              🖨️ Imprimir este
            </button>
          )}
        </div>
      </div>

      <div className="no-print" style={{ display:'grid', gridTemplateColumns:'300px 1fr', gap:'1.25rem' }}>
        {/* Lista beneficiarios */}
        <div>
          <input className="input" placeholder="Buscar por nombre / afiliado…" value={busqueda}
            onChange={e => setBusqueda(e.target.value)} style={{ marginBottom:'.75rem' }} />
          <div style={{ maxHeight:'68vh', overflowY:'auto', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)' }}>
            {loading ? (
              <div style={{ padding:'2rem', textAlign:'center', color:'var(--text3)' }}><span className="spinner"/></div>
            ) : filtrados.length === 0 ? (
              <div className="empty-state"><p>Sin beneficiarios con afiliado</p></div>
            ) : filtrados.map(b => (
              <div key={b.id} onClick={() => { setSeleccionado(b); setModoTodos(false); }}
                style={{
                  padding:'.65rem 1rem', borderBottom:'1px solid var(--border)',
                  cursor:'pointer',
                  background: seleccionado?.id === b.id ? 'var(--blue-dim)' : 'transparent',
                  borderLeft: seleccionado?.id === b.id ? '3px solid var(--blue)' : '3px solid transparent',
                  transition: 'background 150ms',
                }}>
                <p style={{ fontSize:'.85rem', fontWeight:500, color:'var(--text)' }}>{b.nombre}</p>
                <p style={{ fontSize:'.75rem', color:'var(--text3)' }}>
                  {b.nroAfiliado && `Afil: ${b.nroAfiliado}`}
                  {b.dni && ` · DNI: ${b.dni}`}
                </p>
              </div>
            ))}
          </div>
          <p style={{ fontSize:'.75rem', color:'var(--text3)', marginTop:'.5rem', textAlign:'center' }}>
            {filtrados.length} de {beneficiarios.length} beneficiarios
          </p>
        </div>

        {/* Preview */}
        <div>
          {!seleccionado ? (
            <div className="card" style={{ textAlign:'center', padding:'3rem', color:'var(--text3)' }}>
              <p style={{ fontSize:'2rem', marginBottom:'.75rem' }}>👈</p>
              <p>Seleccioná un beneficiario para ver el DJ</p>
            </div>
          ) : (
            <DjPage b={seleccionado} mes={mes} anio={anio} />
          )}
        </div>
      </div>

      {/* Zona de impresión — oculta en pantalla */}
      <div style={{ display:'none' }} className="print-zone">
        <div className="dj-pages">
          {paginas.map(b => <DjPage key={b.id} b={b} mes={mes} anio={anio} />)}
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-zone { display: block !important; }
        }
      `}</style>
    </div>
  );
}
