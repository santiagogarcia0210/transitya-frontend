'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { serializarFirestore, toArray } from '@/lib/utils';
import { useEmpresaTipo } from '@/hooks/useEmpresaTipo';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';

function getField(reg: Record<string,unknown>, ...claves: string[]): string {
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
  for (const clave of claves) {
    const key = Object.keys(reg).find(k => norm(k).includes(norm(clave)));
    if (key && reg[key] && String(reg[key]) !== '#ERROR!') return String(reg[key]);
  }
  return '';
}

interface Registro {
  id: string; nombre: string; nroBenef: string;
  tipo?: string; estado?: string; fecha?: string; organismo?: string; nroExpediente?: string; observaciones?: string;
}

function normR(r: Record<string,unknown>): Registro {
  return {
    id:             String(r.id || ''),
    nombre:         getField(r,'APELLIDO','NOMBRE','BENEFICIARIO') || String(r.beneficiario||r.nombre||r.NOMBRE||''),
    nroBenef:       getField(r,'AFILIADO','BENEFICIO','NRO') || String(r.nroAfiliado||r['N° AFILIADO']||'No encontrado'),
    tipo:           String(r.tipo || r.TIPO || r['TIPO DOC'] || 'Alta'),
    estado:         String(r.estado || r.ESTADO || 'Pendiente'),
    fecha:          String(r.fecha || r.FECHA || ''),
    organismo:      String(r.organismo || r.ORGANISMO || ''),
    nroExpediente:  String(r.nroExpediente || r['NRO EXPEDIENTE'] || r.expediente || ''),
    observaciones:  String(r.observaciones || r.OBSERVACIONES || ''),
  };
}

/* ── Recibo A4 — idéntico al GAS renderPresentacionDocumento ───────────── */
const DOCS_LIST = [
  'Nota manuscrita para solicitud de autorizacion de transporte',
  'Medida de Independencia Funcional (FIM)',
  'Certificado Unico de Discapacidad (CUD)',
  'Documento Nacional de Identidad (DNI)',
  'Boleta de haberes (con vigencia no superior a 30 dias)',
  'Pedido medico de solicitud de transporte',
  'Historia clinica',
  'Informe social',
  'Consolidado e-Gov (Publicacion de Autorizacion)',
  'Presupuesto del servicio',
  'Hoja de ruta',
];

function ReciboPresDoc({ r, idx, logoEmpresa }: { r: Registro; idx: number; logoEmpresa?: string }) {
  const LOGO_SRC = logoEmpresa || '/logos/logo-empresa.jpg';
  const hoy      = new Date();
  const fechaHoy = `${String(hoy.getDate()).padStart(2,'0')}/${String(hoy.getMonth()+1).padStart(2,'0')}/${hoy.getFullYear()}`;
  const [fecha,      setFecha]      = useState(r.fecha || fechaHoy);
  const [checks,     setChecks]     = useState<boolean[]>(() => DOCS_LIST.map(() => true));
  const [firmaNombre,setFirmaNombre]= useState('');
  const [firmaFecha, setFirmaFecha] = useState(fechaHoy);

  const toggleCheck = (i: number) => setChecks(cs => cs.map((c,j) => j===i ? !c : c));

  const inputPrint: React.CSSProperties = {
    border:'none', borderBottom:'1px solid #555', fontSize:'9px',
    fontFamily:'Arial', background:'transparent', outline:'none', width:'100%',
  };

  return (
    <div className="dj-page" id={`presdoc-${idx}`}
      style={{ fontFamily:'Arial,sans-serif', color:'#111', fontSize:'9px', padding:'12mm 14mm 10mm 14mm', height:'auto', minHeight:'auto' }}>

      {/* Header con logo empresa */}
      <table style={{ width:'100%', borderCollapse:'collapse', marginBottom:'8px' }}>
        <tbody>
          <tr>
            <td style={{ fontSize:'10px', fontWeight:700 }}>Servicio de Traslados Programados</td>
            <td style={{ textAlign:'right', width:'80px' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={LOGO_SRC} alt="Empresa"
                style={{ height:'60px', width:'60px', borderRadius:'50%', objectFit:'cover' }}
                onError={ev => { (ev.currentTarget as HTMLImageElement).style.display='none'; }} />
            </td>
          </tr>
        </tbody>
      </table>

      {/* Título */}
      <div style={{ fontSize:'12px', fontWeight:700, textDecoration:'underline', textAlign:'center', marginBottom:'10px' }}>
        RECEPCION DE DOCUMENTACION
      </div>

      {/* Fecha */}
      <div style={{ textAlign:'right', fontSize:'9px', marginBottom:'10px' }}>
        FECHA: &nbsp;
        <input type="text" value={fecha} onChange={e => setFecha(e.target.value)}
          style={{ width:'80px', ...inputPrint, textAlign:'center' }} />
      </div>

      {/* Destinatario */}
      <div style={{ fontSize:'9px', marginBottom:'12px' }}>
        A las autoridades de<br />
        <span style={{ display:'inline-block', borderBottom:'1px solid #555', minWidth:'150px', fontWeight:700 }}>
          Incluir Salud
        </span>
      </div>

      {/* Texto */}
      <div style={{ fontSize:'9px', textAlign:'center', marginBottom:'8px' }}>
        En el dia de la fecha se hace entrega de la siguiente documentacion:
      </div>

      {/* Lista de documentos con checkboxes */}
      <div style={{ border:'1px solid #bbb', padding:'8px 12px', marginBottom:'10px', fontSize:'8.5px', lineHeight:1.9 }}>
        {DOCS_LIST.map((d, i) => (
          <div key={d} style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer' }}
            onClick={() => toggleCheck(i)}>
            <span style={{
              display:'inline-flex', alignItems:'center', justifyContent:'center',
              width:11, height:11, flexShrink:0,
              border:'1px solid #666', borderRadius:2,
              background: checks[i] ? '#2563eb' : 'transparent',
              color:'#fff', fontSize:8, fontWeight:900,
            }}>
              {checks[i] ? '✓' : ''}
            </span>
            <span style={{ textDecoration: checks[i] ? 'none' : 'line-through', color: checks[i] ? '#111' : '#aaa' }}>
              {d}
            </span>
          </div>
        ))}
      </div>

      {/* Párrafo */}
      <div style={{ fontSize:'9px', lineHeight:1.6, marginBottom:'14px', padding:'0 10px' }}>
        Dicha documentacion es presentada por el beneficiario o tutor del mismo, con la finalidad de solicitar el alta o autorizacion por parte vuestra, para realizar los traslados desde el domicilio particular del paciente hasta la clinica o centro de rehabilitacion correspondiente ida y vuelta.-
      </div>

      {/* Datos beneficiario */}
      <div style={{ fontWeight:700, fontSize:'9px', marginBottom:'8px' }}>Datos del beneficiario:</div>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'9px', marginBottom:'24px' }}>
        <tbody>
          <tr>
            <td style={{ width:'50%', paddingRight:'10px' }}>
              <div style={{ fontWeight:700, marginBottom:'4px' }}>Apellido y nombre</div>
              <div style={{ borderBottom:'1px solid #555', minHeight:'18px', fontWeight:700 }}>{r.nombre}</div>
            </td>
            <td style={{ width:'50%', paddingLeft:'10px' }}>
              <div style={{ fontWeight:700, marginBottom:'4px' }}>N de Beneficiario</div>
              <div style={{ borderBottom:'1px solid #555', minHeight:'18px' }}>{r.nroBenef}</div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Firmas */}
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'9px', marginBottom:6 }}>
        <tbody>
          <tr>
            <td style={{ width:'55%', paddingRight:16 }}>
              <div style={{ marginBottom:20 }} />
              <div style={{ borderTop:'1px solid #999', paddingTop:4 }}>Firma y aclaracion de quien recibe</div>
              <input type="text" value={firmaNombre} onChange={e => setFirmaNombre(e.target.value)}
                placeholder="Nombre y apellido" style={{ ...inputPrint, marginTop:4 }} />
            </td>
            <td style={{ width:'45%', paddingLeft:16 }}>
              <div style={{ marginBottom:20 }} />
              <div style={{ borderTop:'1px solid #999', paddingTop:4 }}>Fecha de recepcion</div>
              <input type="text" value={firmaFecha} onChange={e => setFirmaFecha(e.target.value)}
                style={{ ...inputPrint, marginTop:4, width:'120px' }} />
            </td>
          </tr>
        </tbody>
      </table>

      {/* Botón imprimir */}
      <div style={{ textAlign:'right', marginTop:'12px' }} className="no-print">
        <button className="btn btn-secondary btn-sm" onClick={() => {
          const el = document.getElementById(`presdoc-${idx}`);
          if (!el) return;
          const win = window.open('', '_blank', 'width=900,height=700');
          if (!win) return;
          win.document.write(`<html><head><style>body{margin:0;font-family:Arial,sans-serif;}.no-print{display:none!important;}input{border:none!important;border-bottom:1px solid #555!important;background:transparent!important;outline:none!important;}@page{size:A4;margin:0;}</style></head><body>${el.innerHTML}</body></html>`);
          win.document.close(); win.focus(); win.print(); win.close();
        }}>
          🖨️ Imprimir este
        </button>
      </div>
    </div>
  );
}

/* ── Vista lista (CRUD) ──────────────────────────────────────────────────── */

const TIPOS   = ['Alta', 'Baja', 'Modificación'] as const;
const ESTADOS = ['Pendiente', 'Presentado', 'Aprobado', 'Observado'] as const;

const BADGE_EST: Record<string, string> = {
  Pendiente:'badge-gray', Presentado:'badge-blue', Aprobado:'badge-green', Observado:'badge-amber',
};

const labelStyle: React.CSSProperties = {
  display:'block', fontSize:'.78rem', color:'var(--text3)', marginBottom:'.3rem', fontWeight:500,
};

type FormState = { id:string; tipo:string; beneficiario:string; fecha:string; organismo:string; nroExpediente:string; estado:string; observaciones:string; };
const EMPTY: FormState = { id:'', tipo:'Alta', beneficiario:'', fecha:'', organismo:'', nroExpediente:'', estado:'Pendiente', observaciones:'' };

/* ═══════════════════════════════════════════════════════════════════════ */

export default function PresentacionDocsPage() {
  const authLoading = useRequireAdmin();
  const router = useRouter();
  const { tipo: empresaTipo, loading: tipoLoading } = useEmpresaTipo();

  const [lista,         setLista]         = useState<Registro[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [vistaImp,      setVistaImp]      = useState(false);  // false = lista, true = impresión
  const [logoEmpresa,   setLogoEmpresa]   = useState('');
  const [filtroBusq,    setFiltroBusq]    = useState('');
  const [showModal,     setShowModal]     = useState(false);
  const [form,          setForm]          = useState<FormState>(EMPTY);
  const [saving,        setSaving]        = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string|null>(null);
  const [msg,           setMsg]           = useState<{text:string;ok:boolean}|null>(null);

  useEffect(() => {
    if (!tipoLoading && empresaTipo !== null && empresaTipo !== 'transporte_escolar' && empresaTipo !== 'transporte_especial')
      router.replace('/dashboard');
  }, [empresaTipo, tipoLoading, router]);

  const cargar = async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/presentacion-docs');
      setLista(toArray(r.data).map(serializarFirestore).map(normR));
    } catch { /* silent */ }
    setLoading(false);
  };

  useEffect(() => {
    if (empresaTipo === 'transporte_escolar' || empresaTipo === 'transporte_especial') {
      cargar();
      api.get('/api/dashboard').then(r => {
        const logo = r.data?.empresaLogo || r.data?.tablero?.empresaLogo || '';
        if (logo) setLogoEmpresa(logo);
      }).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaTipo]);

  const filtrados = lista.filter(r => {
    if (!filtroBusq) return true;
    const q = filtroBusq.toLowerCase();
    return r.nombre.toLowerCase().includes(q) || r.nroBenef.includes(q);
  });

  const setF = (k: keyof FormState) =>
    (ev: React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: ev.target.value }));

  const abrirNuevo   = () => { setForm({ ...EMPTY, fecha: new Date().toISOString().split('T')[0] }); setMsg(null); setShowModal(true); };
  const abrirEdicion = (r: Registro) => { setForm({ id:r.id, tipo:r.tipo||'Alta', beneficiario:r.nombre, fecha:r.fecha||'', organismo:r.organismo||'', nroExpediente:r.nroExpediente||'', estado:r.estado||'Pendiente', observaciones:r.observaciones||'' }); setMsg(null); setShowModal(true); };
  const cerrar       = () => { setShowModal(false); setMsg(null); };

  const guardar = async () => {
    if (!form.beneficiario) { setMsg({ text:'El beneficiario es obligatorio', ok:false }); return; }
    setSaving(true); setMsg(null);
    try {
      form.id ? await api.put(`/api/presentacion-docs/${form.id}`, form)
              : await api.post('/api/presentacion-docs', form);
      cerrar(); cargar();
    } catch { setMsg({ text:'Error al guardar', ok:false }); }
    setSaving(false);
  };

  const eliminar = async (id: string) => {
    try { await api.delete(`/api/presentacion-docs/${id}`); setConfirmDelete(null); cargar(); }
    catch { /* silent */ }
  };

  if (authLoading) return null;
  if (tipoLoading) return <div style={{ padding:'2rem', color:'var(--text3)' }}><span className="spinner"/> Verificando…</div>;
  if (empresaTipo !== 'transporte_escolar' && empresaTipo !== 'transporte_especial') return null;

  return (
    <div>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; background: #fff !important; }
          .dj-page { page-break-after: always; }
          .dj-page:last-child { page-break-after: auto; }
          @page { size: A4 portrait; margin: 0; }
          input { border: none !important; border-bottom: 1px solid #555 !important; background: transparent !important; }
        }
      `}</style>

      {/* Header */}
      <div className="no-print section-header" style={{ marginBottom:'1.25rem' }}>
        <div>
          <h2 className="section-title">📁 Presentación Docs</h2>
          <p style={{ fontSize:'.82rem', color:'var(--text3)', marginTop:'.2rem' }}>{lista.length} registro{lista.length!==1?'s':''}</p>
        </div>
        <div style={{ display:'flex', gap:'.5rem' }}>
          <button className={`btn ${vistaImp ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setVistaImp(v => !v)}>
            {vistaImp ? '📋 Vista lista' : '🖨️ Vista impresión'}
          </button>
          {vistaImp && (
            <button className="btn btn-primary" onClick={() => window.print()}>🖨️ Imprimir todos</button>
          )}
          {!vistaImp && (
            <button className="btn btn-primary" onClick={abrirNuevo}>+ Nuevo</button>
          )}
          <button className="btn btn-secondary" onClick={cargar} disabled={loading}>↻</button>
        </div>
      </div>

      {/* ── Vista impresión (A4 GAS) ─────────────────────────────────────── */}
      {vistaImp ? (
        loading ? (
          <div style={{ display:'flex', alignItems:'center', gap:'.75rem', color:'var(--text3)', padding:'2rem' }}>
            <span className="spinner"/> Cargando…
          </div>
        ) : filtrados.length === 0 ? (
          <div className="empty-state no-print"><div className="empty-icon">📁</div><p>Sin registros</p></div>
        ) : (
          <div className="dj-pages">
            {filtrados.map((r, i) => (
              <div key={r.id}>
                {i > 0 && <hr style={{ border:'none', borderTop:'2px dashed var(--border2)', margin:'20px 0' }} className="no-print" />}
                <ReciboPresDoc r={r} idx={i} logoEmpresa={logoEmpresa} />
              </div>
            ))}
          </div>
        )
      ) : (
        /* ── Vista lista (CRUD) ────────────────────────────────────────────── */
        <>
          <div className="filter-bar no-print">
            <input className="input" placeholder="Buscar beneficiario…"
              value={filtroBusq} onChange={e => setFiltroBusq(e.target.value)} />
            {filtroBusq && (
              <button className="btn btn-secondary" style={{ fontSize:'.78rem' }} onClick={() => setFiltroBusq('')}>✕ Limpiar</button>
            )}
          </div>

          {loading ? (
            <div style={{ display:'flex', alignItems:'center', gap:'.75rem', color:'var(--text3)', padding:'2rem' }}>
              <span className="spinner"/> Cargando…
            </div>
          ) : filtrados.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">📁</div><p>Sin registros</p></div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'.4rem' }}>
              {filtrados.map(r => (
                <div key={r.id} className="card"
                  style={{ display:'flex', alignItems:'center', gap:'1rem', padding:'.75rem 1rem', cursor:'pointer' }}
                  onClick={() => abrirEdicion(r)}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'.5rem', flexWrap:'wrap' }}>
                      <span style={{ fontSize:'.88rem', fontWeight:600, color:'var(--text)' }}>{r.nombre}</span>
                      <span className={`badge ${BADGE_EST[r.estado||''] || 'badge-gray'}`}>{r.estado}</span>
                    </div>
                    <p style={{ fontSize:'.78rem', color:'var(--text3)', marginTop:'.15rem' }}>
                      {r.nroBenef && `Benef: ${r.nroBenef}`}
                      {r.fecha && ` · ${r.fecha}`}
                    </p>
                  </div>
                  {confirmDelete === r.id ? (
                    <div style={{ display:'flex', gap:'.4rem' }} onClick={ev => ev.stopPropagation()}>
                      <button className="btn btn-danger" style={{ fontSize:'.72rem', padding:'.3rem .6rem' }} onClick={() => eliminar(r.id)}>Confirmar</button>
                      <button className="btn btn-secondary" style={{ fontSize:'.72rem', padding:'.3rem .6rem' }} onClick={() => setConfirmDelete(null)}>✕</button>
                    </div>
                  ) : (
                    <button className="btn btn-secondary" style={{ fontSize:'.72rem', padding:'.3rem .6rem' }}
                      onClick={ev => { ev.stopPropagation(); setConfirmDelete(r.id); }}>🗑</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal nuevo/editar */}
      {showModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.65)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50, padding:'1rem' }}
          onClick={e => { if (e.target === e.currentTarget) cerrar(); }}>
          <div className="card" style={{ width:'100%', maxWidth:'520px', maxHeight:'90vh', overflowY:'auto', padding:'1.5rem' }}>
            <h3 style={{ fontSize:'1rem', fontWeight:700, color:'var(--text)', marginBottom:'1.25rem' }}>
              {form.id ? '✏️ Editar' : '+ Nuevo registro'}
            </h3>
            <div className="form-grid">
              <div>
                <label style={labelStyle}>Beneficiario *</label>
                <input className="input" placeholder="Apellido y Nombre" value={form.beneficiario} onChange={setF('beneficiario')} />
              </div>
              <div className="form-grid form-grid-2">
                <div>
                  <label style={labelStyle}>Tipo</label>
                  <select className="select" value={form.tipo} onChange={setF('tipo')}>
                    {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Estado</label>
                  <select className="select" value={form.estado} onChange={setF('estado')}>
                    {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-grid form-grid-2">
                <div>
                  <label style={labelStyle}>Fecha</label>
                  <input type="date" className="input" value={form.fecha} onChange={setF('fecha')} />
                </div>
                <div>
                  <label style={labelStyle}>N° Beneficiario</label>
                  <input className="input" placeholder="Nro afiliado" value={form.nroExpediente} onChange={setF('nroExpediente')} />
                </div>
              </div>
            </div>
            {msg && <p style={{ fontSize:'.82rem', color:msg.ok?'var(--green)':'var(--red)', marginTop:'.75rem' }}>{msg.text}</p>}
            <div style={{ display:'flex', gap:'.75rem', marginTop:'1.25rem' }}>
              <button className="btn btn-secondary" style={{ flex:1 }} onClick={cerrar}>Cancelar</button>
              <button className="btn btn-primary" style={{ flex:1 }} onClick={guardar} disabled={saving}>
                {saving ? <><span className="spinner" style={{ width:12, height:12 }}/> Guardando…</> : form.id ? 'Actualizar' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
