'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { serializarFirestore, toArray } from '@/lib/utils';
import { useEmpresaTipo } from '@/hooks/useEmpresaTipo';

const MESES_ES = ['enero','febrero','marzo','abril','mayo','junio',
                  'julio','agosto','septiembre','octubre','noviembre','diciembre'];

/* Normaliza un campo de texto: si el valor es un placeholder de error devuelve vacío */
function cleanVal(v: unknown): string {
  const s = String(v || '');
  const PLACEHOLDERS = ['XXXXXXXXXX','XXXXXXXXXXXXXX','XXXXXXXXXXXXXXXX','XXXXXXXXXXXXXXX','#ERROR!'];
  return PLACEHOLDERS.includes(s.trim()) ? '' : s;
}

/* Obtiene un campo del registro buscando varias claves posibles (igual que GAS get()) */
function getField(reg: Record<string,unknown>, ...claves: string[]): string {
  const norm = (s: string) =>
    s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
  for (const clave of claves) {
    const key = Object.keys(reg).find(k => norm(k).includes(norm(clave)));
    if (key && reg[key] && String(reg[key]) !== '#ERROR!') return String(reg[key]);
  }
  return '';
}

interface Carta {
  idx: number;
  nombre: string; dniTut: string; dniaBenef: string;
  transportistaViejo: string; transportistaNuevo: string; dniNuevo: string;
  domicilio: string; clinica: string; tutor: string;
}

function normCarta(reg: Record<string,unknown>, idx: number): Carta {
  return {
    idx,
    nombre:              cleanVal(getField(reg,'APELLIDO','NOMBRE','BENEFICIARIO')) || '',
    dniTut:              cleanVal(getField(reg,'DNI TUTOR','DNI MADRE','DNI')) || '',
    dniaBenef:           cleanVal(getField(reg,'DNI BENEF','DNI')) || '',
    transportistaViejo:  cleanVal(getField(reg,'TRANSPORTISTA ACTUAL','TRANSPORTE ACTUAL','TRANSPORTA')) || '',
    transportistaNuevo:  cleanVal(getField(reg,'NUEVO TRANSPORTE','TRANSPORTISTA NUEVO','NUEVO')) || '',
    dniNuevo:            cleanVal(getField(reg,'DNI NUEVO','DNI TRANSPORT')) || '',
    domicilio:           cleanVal(getField(reg,'DOMICILIO','DOM')) || '',
    clinica:             cleanVal(getField(reg,'CLINICA','PRESTADOR','DEPENDENCIA')) || '',
    tutor:               cleanVal(getField(reg,'TUTOR','MADRE','PADRE','RESPONSABLE')) || '',
  };
}

/* ── Carta editable — idéntica al GAS renderCartasCambioTransporte ─────── */
function CartaCambio({ c, onPrint }: { c: Carta; onPrint: (idx: number) => void }) {
  const hoy  = new Date();
  const fTxt = `${hoy.getDate()} de ${MESES_ES[hoy.getMonth()]} del ${hoy.getFullYear()}`;

  const [f, setF] = useState({
    tut: c.tutor,   dt:  c.dniTut,      bn:  c.nombre,
    db:  c.dniaBenef, tv: c.transportistaViejo,
    tn:  c.transportistaNuevo, dn: c.dniNuevo,
    dom: c.domicilio, cl:  c.clinica,
  });

  const inp = (k: keyof typeof f, w: number, placeholder?: string) => (
    <input
      type="text"
      value={f[k]}
      placeholder={placeholder || ''}
      onChange={e => setF(p => ({ ...p, [k]: e.target.value }))}
      style={{
        display: 'inline-block', width: w,
        border: 'none', borderBottom: '1px solid #555',
        background: 'transparent', fontSize: '10px',
        fontFamily: 'Arial', color: '#111',
        padding: '0 2px', outline: 'none',
      }}
    />
  );

  return (
    <div className="dj-page carta-cambio" id={`carta-${c.idx}`}
      style={{ padding: '22px 28px', minHeight: 'auto', height: 'auto' }}>

      {/* Fecha */}
      <div style={{ textAlign: 'right', fontSize: '10px', marginBottom: '14px', color: '#333' }}>{fTxt}</div>

      {/* Destinatario */}
      <div style={{ fontSize: '10px', lineHeight: 1.8, marginBottom: '12px' }}>
        Al Programa Incluir Salud<br />
        UGP - Tucuman<br />
        A quien corresponda:
      </div>

      {/* Cuerpo */}
      <div style={{ fontSize: '10px', lineHeight: 2.2, color: '#111' }}>
        <span style={{ display: 'inline-block', minWidth: '40px' }}>Yo</span>
        {' '}{inp('tut', 200)} <br />
        con D.N.I. {inp('dt', 140)} (madre/padre o tutor) de {inp('bn', 220)} <br />
        con D.N.I. {inp('db', 140)} , me dirijo a ustedes con el fin de informar un cambio en el transporte programado, actualmente es llevado/a por {inp('tv', 200)} <br />
        y pasara a realizarse por {inp('tn', 220)} , con D.N.I. {inp('dn', 160)} <br />
        desde mi domicilio particular: {inp('dom', 220)} <br />
        hasta la clinica, cita en: {inp('cl', 220)} <br />
      </div>

      {/* Cierre */}
      <div style={{ textAlign: 'center', fontSize: '10px', margin: '8px 0 18px 0' }}>
        Sin otro particular, saludo a Ud./es muy atte.-
      </div>

      {/* Firmas */}
      <div style={{ fontSize: '10px', lineHeight: 2.4 }}>
        Firma: <span style={{ display: 'inline-block', width: 280, borderBottom: '1px solid #555' }} /><br />
        Aclaracion: <span style={{ display: 'inline-block', width: 250, borderBottom: '1px solid #555' }} /><br />
        DNI: <span style={{ display: 'inline-block', width: 200, borderBottom: '1px solid #555' }} />
      </div>

      {/* Nota */}
      <div style={{ fontSize: '9px', color: '#333', border: '1px solid #999', padding: '6px 8px', marginTop: '8px' }}>
        {'{AGREGAR fotocopia de DNI, e-gov, nuevo presupuesto de transporte y mapa google}.'}
      </div>

      {/* Botón imprimir (no-print) */}
      <div style={{ textAlign: 'right', marginTop: '12px' }} className="no-print">
        <button className="btn btn-secondary btn-sm" onClick={() => onPrint(c.idx)}>
          Imprimir esta carta
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */

export default function CambioTransportePage() {
  const router = useRouter();
  const { tipo, loading: tipoLoading } = useEmpresaTipo();

  const [cartas,  setCartas]  = useState<Carta[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tipoLoading && tipo !== null && tipo !== 'transporte_escolar' && tipo !== 'transporte_especial')
      router.replace('/dashboard');
  }, [tipo, tipoLoading, router]);

  const cargar = async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/cambio-transporte');
      const rows = toArray(r.data).map(serializarFirestore);
      setCartas(rows.map(normCarta));
    } catch { /* silent */ }
    setLoading(false);
  };

  useEffect(() => {
    if (tipo === 'transporte_escolar' || tipo === 'transporte_especial') cargar();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo]);

  const imprimirTodas = () => window.print();

  const imprimirCarta = (idx: number) => {
    const el = document.getElementById(`carta-${idx}`);
    if (!el) return;
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    win.document.write(
      `<html><head><style>
        body{font-family:Arial,sans-serif;margin:0;padding:22px 28px;}
        .no-print{display:none!important;}
        input{border:none!important;border-bottom:1px solid #555!important;background:transparent!important;}
        @page{size:A4 portrait;margin:0;}
      </style></head><body>${el.innerHTML}</body></html>`
    );
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  if (tipoLoading) return <div style={{ padding:'2rem', color:'var(--text3)' }}><span className="spinner"/> Verificando…</div>;
  if (tipo !== 'transporte_escolar' && tipo !== 'transporte_especial') return null;

  return (
    <div>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; background: #fff !important; }
          .carta-cambio { page-break-after: always; }
          .carta-cambio:last-child { page-break-after: auto; }
          @page { size: A4 portrait; margin: 0; }
          input { border: none !important; border-bottom: 1px solid #555 !important; background: transparent !important; }
        }
      `}</style>

      {/* Controles */}
      <div className="no-print section-header" style={{ marginBottom:'1.25rem' }}>
        <h2 className="section-title">🔄 Nota de Cambio de Transporte</h2>
        <div style={{ display:'flex', gap:'.5rem' }}>
          <button className="btn btn-secondary" onClick={cargar} disabled={loading}>↻ Recargar</button>
          <button className="btn btn-primary" onClick={imprimirTodas}>🖨️ Imprimir todos</button>
        </div>
      </div>

      {loading ? (
        <div style={{ display:'flex', alignItems:'center', gap:'.75rem', color:'var(--text3)', padding:'2rem' }}>
          <span className="spinner"/> Cargando…
        </div>
      ) : cartas.length === 0 ? (
        <div className="empty-state no-print">
          <div className="empty-icon">🔄</div>
          <p>No hay registros en CBIO TRANSPORTE</p>
        </div>
      ) : (
        <div>
          <p className="no-print" style={{ fontSize:'.82rem', color:'var(--text3)', marginBottom:'1rem' }}>
            {cartas.length} carta{cartas.length !== 1 ? 's' : ''} listas para imprimir. Los campos son editables antes de imprimir.
          </p>
          {cartas.map((c, i) => (
            <div key={c.idx}>
              {i > 0 && <hr style={{ border:'none', borderTop:'2px dashed var(--border2)', margin:'20px 0' }} className="no-print" />}
              <CartaCambio c={c} onPrint={imprimirCarta} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
