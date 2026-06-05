'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { serializarFirestore, toArray } from '@/lib/utils';
import { useEmpresaTipo } from '@/hooks/useEmpresaTipo';

interface Beneficiario {
  id: string; nombre: string; nroAfiliado: string;
}

function norm(b: Record<string,unknown>): Beneficiario {
  return {
    id:          String(b.id          || ''),
    nombre:      String(b.nombre      || b['APELLIDO Y NOMBRE'] || b.NOMBRE || ''),
    nroAfiliado: String(b.nroAfiliado || b['N° AFILIADO']      || b.nroAfiliado || ''),
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

function CartaAlta({ b }: { b: Beneficiario }) {
  return (
    <div className="carta-page" style={{ fontFamily:'Arial, sans-serif', color:'#000', background:'#fff',
      padding:'1.5cm', marginBottom:'2rem', border:'1px solid #ddd', fontSize:'10pt' }}>
      {/* Header */}
      <div style={{ borderBottom:'2pt solid #000', paddingBottom:'8pt', marginBottom:'16pt', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <div style={{ fontWeight:900, fontSize:'12pt' }}>Servicio de Traslados Programados</div>
          <div style={{ fontSize:'9pt', color:'#555' }}>Incluir Salud — Transporte Especial</div>
        </div>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontWeight:900, fontSize:'14pt', letterSpacing:'1px' }}>INSCRIPCIÓN DE DOCUMENTACION</div>
        </div>
      </div>

      {/* Fecha */}
      <div style={{ textAlign:'right', marginBottom:'16pt' }}>
        FECHA: <span style={{ display:'inline-block', minWidth:120, borderBottom:'1pt solid #000' }}>&nbsp;</span>
      </div>

      {/* Destinatario */}
      <div style={{ marginBottom:'12pt' }}>
        <strong>A las autoridades de: Incluir Salud</strong>
      </div>

      <p style={{ marginBottom:'12pt' }}>
        Por la presente se hace entrega de la documentación necesaria para la tramitación del servicio de transporte:
      </p>

      {/* Lista de documentos */}
      <ul style={{ paddingLeft:'1.5rem', marginBottom:'16pt', lineHeight:'1.8' }}>
        {[
          'Receta prescripta por el médico del centro de tratamiento',
          'Módulo de Incapacidades Permanentes (PIM)',
          'Informe clínico de Discapacidad (CUD)',
          'Documento Nacional de Identidad (DNI)',
          'Boleta de servicio (agua/luz) con domicilio de residencia',
          'Poder notarial (para agentes de terceros o de más de 18 años)',
          'Prueba escrita de solicitud de cambio de transportista',
          'Solicitud escrita',
          'Atención social',
          'Constancia de obra (Preferencia Económica)',
          'Foto de vida',
        ].map(doc => <li key={doc} style={{ marginBottom:'2pt' }}>{doc}</li>)}
      </ul>

      <p style={{ marginBottom:'16pt' }}>
        Dicha documentación es presentada por el beneficiario o su representante legal, para dar inicio
        o continuidad al trámite correspondiente ante el Programa Incluir Salud.
      </p>

      {/* Datos del beneficiario */}
      <div style={{ border:'1pt solid #000', padding:'8pt', marginBottom:'16pt' }}>
        <div style={{ fontWeight:700, marginBottom:'6pt' }}>Datos del beneficiario:</div>
        <div style={{ display:'grid', gap:'6pt' }}>
          <div style={{ display:'flex', gap:'8pt' }}>
            <strong style={{ minWidth:160 }}>Apellido y nombre:</strong>
            <span style={{ flex:1, borderBottom:'1pt solid #000' }}>{b.nombre || '___________________________________'}</span>
          </div>
          <div style={{ display:'flex', gap:'8pt' }}>
            <strong style={{ minWidth:160 }}>N° del beneficiario:</strong>
            <span style={{ flex:1, borderBottom:'1pt solid #000' }}>{b.nroAfiliado || '___________________________________'}</span>
          </div>
        </div>
      </div>

      {/* Firmas */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'2rem', marginTop:'2rem' }}>
        <div>
          <div style={{ borderTop:'1pt solid #000', paddingTop:'4pt', marginTop:'40pt', textAlign:'center', fontSize:'9pt' }}>
            Firma y aclaración de quien recibe
          </div>
        </div>
        <div>
          <div style={{ borderTop:'1pt solid #000', paddingTop:'4pt', marginTop:'40pt', textAlign:'center', fontSize:'9pt' }}>
            Fecha de recepción: ___/___/______
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AltasPresPage() {
  const router = useRouter();
  const { tipo, loading: tipoLoading } = useEmpresaTipo();

  const [lista,   setLista]   = useState<Beneficiario[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tipoLoading && tipo !== null && tipo !== 'transporte_escolar' && tipo !== 'transporte_especial') router.replace('/dashboard');
  }, [tipo, tipoLoading, router]);

  const cargar = async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/altas-pres');
      const rows = (r.data?.registros ?? toArray(r.data)) as Record<string,unknown>[];
      setLista(rows.map(serializarFirestore).map(norm));
    } catch { /* silent */ }
    setLoading(false);
  };

  useEffect(() => { if ((tipo === 'transporte_escolar' || tipo === 'transporte_especial')) cargar(); }, [tipo]);

  if (tipoLoading) return <div style={{padding:'2rem',color:'var(--text3)'}}><span className="spinner"/> Verificando…</div>;
  if (tipo !== 'transporte_escolar' && tipo !== 'transporte_especial') return null;

  return (
    <div>
      <style>{printCSS}</style>

      {/* Controles */}
      <div className="no-print section-header" style={{ marginBottom:'1.25rem' }}>
        <h2 className="section-title">📋 Altas PRES IS</h2>
        <div style={{ display:'flex', gap:'.5rem' }}>
          <button className="btn btn-secondary" onClick={cargar} disabled={loading}>↻ Recargar</button>
          <button className="btn btn-primary" onClick={()=>window.print()}>🖨️ Imprimir todos</button>
        </div>
      </div>

      {loading ? (
        <div style={{display:'flex',alignItems:'center',gap:'.75rem',color:'var(--text3)',padding:'2rem'}}><span className="spinner"/> Cargando…</div>
      ) : lista.length === 0 ? (
        <div className="empty-state no-print"><div className="empty-icon">📋</div><p>Sin altas registradas</p></div>
      ) : (
        <div>
          <p className="no-print" style={{ fontSize:'.82rem', color:'var(--text3)', marginBottom:'1rem' }}>
            {lista.length} carta{lista.length!==1?'s':''} de inscripción listas para imprimir
          </p>
          {lista.map(b => <CartaAlta key={b.id} b={b} />)}
        </div>
      )}
    </div>
  );
}
