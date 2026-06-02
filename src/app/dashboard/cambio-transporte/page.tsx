'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { serializarFirestore, toArray } from '@/lib/utils';
import { useEmpresaTipo } from '@/hooks/useEmpresaTipo';

const MESES_ES = ['enero','febrero','marzo','abril','mayo','junio',
                  'julio','agosto','septiembre','octubre','noviembre','diciembre'];

interface Registro {
  id: string;
  nombreBeneficiario: string;
  dni: string;
  domicilio: string;
  transportistaAnterior: string;
  transportistaNuevo: string;
  cuitNuevo: string;
  domicilioOrigen: string;
  destino: string;
  estado: string;
}

function norm(r: Record<string,unknown>): Registro {
  return {
    id:                   String(r.id                   || ''),
    nombreBeneficiario:   String(r.nombreBeneficiario   || r['APELLIDO Y NOMBRE'] || r.nombre || ''),
    dni:                  String(r.dni                  || r.DNI                  || ''),
    domicilio:            String(r.domicilio            || r.DOMICILIO            || ''),
    transportistaAnterior:String(r.transportistaAnterior|| r['PRESTADOR ACTUAL']  || ''),
    transportistaNuevo:   String(r.transportistaNuevo   || r['PRESTADOR NUEVO']   || ''),
    cuitNuevo:            String(r.cuitNuevo            || r.cuit                 || r.CUIT || ''),
    domicilioOrigen:      String(r.domicilioOrigen      || r.domicilio            || ''),
    destino:              String(r.destino              || r.DESTINO              || ''),
    estado:               String(r.estado               || r.ESTADO               || 'Pendiente'),
  };
}

const printCSS = `
@media print {
  .no-print { display: none !important; }
  .carta-page { page-break-after: always; }
  .carta-page:last-child { page-break-after: auto; }
  @page { size: A4 portrait; margin: 2cm; }
}
`;

function CartaCambio({ r }: { r: Registro }) {
  const hoy = new Date();
  const dia  = hoy.getDate();
  const mes  = MESES_ES[hoy.getMonth()];
  const anio = hoy.getFullYear();

  return (
    <div className="carta-page" style={{ fontFamily:'Arial, sans-serif', color:'#000', background:'#fff',
      padding:'1.5cm', marginBottom:'2rem', border:'1px solid #ddd', fontSize:'10.5pt', lineHeight:'1.6' }}>
      {/* Fecha */}
      <div style={{ textAlign:'right', marginBottom:'20pt', fontSize:'10pt' }}>
        {dia} de {mes} del {anio}
      </div>

      {/* Destinatario */}
      <div style={{ marginBottom:'16pt' }}>
        <div><strong>Al Programa Incluir Salud</strong></div>
        <div>USP - Tucumán</div>
        <div>A quien corresponda</div>
      </div>

      {/* Cuerpo */}
      <p style={{ marginBottom:'12pt', textAlign:'justify' }}>
        Yo,{' '}
        <span contentEditable suppressContentEditableWarning
          style={{ display:'inline-block', minWidth:200, borderBottom:'1pt solid #555', outline:'none', padding:'0 2pt' }}>
          {r.nombreBeneficiario || '___________________________'}
        </span>
        , con D.N.I.{' '}
        <span contentEditable suppressContentEditableWarning
          style={{ display:'inline-block', minWidth:80, borderBottom:'1pt solid #555', outline:'none', padding:'0 2pt' }}>
          {r.dni || '______________'}
        </span>
        , con domicilio en{' '}
        <span contentEditable suppressContentEditableWarning
          style={{ display:'inline-block', minWidth:200, borderBottom:'1pt solid #555', outline:'none', padding:'0 2pt' }}>
          {r.domicilio || '___________________________'}
        </span>
        , me dirijo a ustedes con el fin de informar un cambio en el transporte programado,
        actualmente es favorito por{' '}
        <span contentEditable suppressContentEditableWarning
          style={{ display:'inline-block', minWidth:180, borderBottom:'1pt solid #555', outline:'none', padding:'0 2pt' }}>
          {r.transportistaAnterior || '___________________________'}
        </span>
        , y planea a realizarse por{' '}
        <span contentEditable suppressContentEditableWarning
          style={{ display:'inline-block', minWidth:180, borderBottom:'1pt solid #555', outline:'none', padding:'0 2pt' }}>
          {r.transportistaNuevo || '___________________________'}
        </span>
        , con CUIT{' '}
        <span contentEditable suppressContentEditableWarning
          style={{ display:'inline-block', minWidth:130, borderBottom:'1pt solid #555', outline:'none', padding:'0 2pt' }}>
          {r.cuitNuevo || '_______________'}
        </span>
        , desde mi domicilio particular{' '}
        <span contentEditable suppressContentEditableWarning
          style={{ display:'inline-block', minWidth:200, borderBottom:'1pt solid #555', outline:'none', padding:'0 2pt' }}>
          {r.domicilioOrigen || '___________________________'}
        </span>
        , hasta la clínica / Dbi en:{' '}
        <span contentEditable suppressContentEditableWarning
          style={{ display:'inline-block', minWidth:200, borderBottom:'1pt solid #555', outline:'none', padding:'0 2pt' }}>
          {r.destino || '___________________________'}
        </span>
        .
      </p>

      <p style={{ marginBottom:'30pt' }}>
        Sin otro particular, saludo a Ud. muy Atte.
      </p>

      {/* Firmas */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'2rem', marginTop:'40pt' }}>
        {['Firma','Aclaración','DNI'].map(l => (
          <div key={l} style={{ textAlign:'center' }}>
            <div style={{ borderTop:'1pt solid #000', paddingTop:'4pt', fontSize:'9pt' }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Nota al pie */}
      <div style={{ marginTop:'20pt', padding:'6pt', background:'#f5f5f5', border:'1pt solid #ccc', fontSize:'8pt', color:'#555' }}>
        <strong>[NOTA:]</strong> AGREGAR fotocopia de DNI, origen, nuevo presupuesto de transporte y viaje google.
      </div>
    </div>
  );
}

export default function CambioTransportePage() {
  const router = useRouter();
  const { tipo, loading: tipoLoading } = useEmpresaTipo();

  const [lista,   setLista]   = useState<Registro[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tipoLoading && tipo !== null && tipo !== 'transporte_escolar') router.replace('/dashboard');
  }, [tipo, tipoLoading, router]);

  const cargar = async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/cambio-transporte');
      setLista(toArray(r.data).map(serializarFirestore).map(norm));
    } catch { /* silent */ }
    setLoading(false);
  };

  useEffect(() => { if (tipo === 'transporte_escolar') cargar(); }, [tipo]);

  if (tipoLoading) return <div style={{padding:'2rem',color:'var(--text3)'}}><span className="spinner"/> Verificando…</div>;
  if (tipo !== 'transporte_escolar') return null;

  return (
    <div>
      <style>{printCSS}</style>

      {/* Controles */}
      <div className="no-print section-header" style={{ marginBottom:'1.25rem' }}>
        <h2 className="section-title">🔄 Nota de Cambio de Transporte</h2>
        <div style={{ display:'flex', gap:'.5rem' }}>
          <button className="btn btn-secondary" onClick={cargar} disabled={loading}>↻ Recargar</button>
          <button className="btn btn-primary" onClick={()=>window.print()}>🖨️ Imprimir todos</button>
        </div>
      </div>

      {loading ? (
        <div style={{display:'flex',alignItems:'center',gap:'.75rem',color:'var(--text3)',padding:'2rem'}}><span className="spinner"/> Cargando…</div>
      ) : lista.length === 0 ? (
        <div className="empty-state no-print"><div className="empty-icon">🔄</div><p>Sin notas de cambio registradas</p></div>
      ) : (
        <div>
          <p className="no-print" style={{ fontSize:'.82rem', color:'var(--text3)', marginBottom:'1rem' }}>
            {lista.length} carta{lista.length!==1?'s':''} listas para imprimir.
            Los campos subrayados son editables antes de imprimir.
          </p>
          {lista.map(r => <CartaCambio key={r.id} r={r} />)}
        </div>
      )}
    </div>
  );
}
