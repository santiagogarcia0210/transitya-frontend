'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { IconCamera } from '@tabler/icons-react';
import LecturaIA from '@/components/LecturaIA';
import api from '@/lib/api';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
import {
  ESTADO_UI, TRAMITE_UI, LABEL, OVERLAY, archivoABase64, dmyAIso, mensajeError, sumarMesesIso, textoDias,
  type DocLegajo, type EstadoTramite, type ItemChecklist, type ObraSocial, type Requisito, type ResumenCarpeta,
} from '@/lib/administrativo';

interface Carpeta {
  id: string; nombre: string; dni: string; afiliado: string; obraSocial: string; localidad: string;
  obraId: string | null; obraNombre: string; resumen: ResumenCarpeta;
}

interface Detalle {
  beneficiario: Omit<Carpeta, 'obraId' | 'obraNombre' | 'resumen'>;
  obra: ObraSocial | null; checklist: ItemChecklist[]; resumen: ResumenCarpeta; otros: DocLegajo[];
}

type Filtro = 'todas' | 'pendientes' | 'vencidos' | 'completas' | 'sin_os';

interface FormDoc {
  docId: string; requisito: Requisito | null; nombre: string;
  fechaEmision: string; fechaVenc: string; estadoTramite: EstadoTramite; notas: string; archivo: File | null;
  archivoActual: string;
}

const hoyIso = () => new Date().toISOString().slice(0, 10);

/* ── Formulario de carga de un documento ─────────────────────────────── */
function ModalDocumento({ form, setForm, onCerrar, onGuardar, guardando, error }: {
  form: FormDoc; setForm: (f: FormDoc) => void; onCerrar: () => void; onGuardar: () => void;
  guardando: boolean; error: string;
}) {
  const req = form.requisito;
  const set = <K extends keyof FormDoc>(k: K, v: FormDoc[K]) => {
    const f = { ...form, [k]: v };
    // Si el requisito vence por meses, la fecha de vencimiento se calcula sola desde la emisión.
    if (k === 'fechaEmision' && req?.vencimiento === 'meses') f.fechaVenc = sumarMesesIso(String(v), req.vigenciaMeses);
    setForm(f);
  };
  return (
    <div style={{ ...OVERLAY, zIndex: 60 }} onClick={e => { if (e.target === e.currentTarget) onCerrar(); }}>
      <div className="card" style={{ width: '100%', maxWidth: 480, padding: '1.5rem', maxHeight: '92vh', overflowY: 'auto' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', marginBottom: '.25rem' }}>
          {form.docId ? 'Editar documento' : 'Cargar documento'}
        </h3>
        <p style={{ fontSize: '.8rem', color: 'var(--text3)', marginBottom: '1rem' }}>{req?.nombre || 'Otro documento'}</p>
        <div className="form-grid">
          {!req && (
            <div><label style={LABEL}>Nombre del documento *</label>
              <input className="input" value={form.nombre} placeholder="Ej: Nota de la familia"
                onChange={e => set('nombre', e.target.value)} /></div>
          )}
          <div className="form-grid form-grid-2">
            <div><label style={LABEL}>Fecha de emisión</label>
              <input type="date" className="input" value={form.fechaEmision} onChange={e => set('fechaEmision', e.target.value)} /></div>
            {req?.vencimiento !== 'no' && (
              <div><label style={LABEL}>Vence {req?.vencimiento === 'fecha_doc' ? '*' : ''}</label>
                <input type="date" className="input" value={form.fechaVenc} onChange={e => set('fechaVenc', e.target.value)} />
                {req?.vencimiento === 'meses' && (
                  <p style={{ fontSize: '.7rem', color: 'var(--text3)', marginTop: '.2rem' }}>
                    Se calcula: {req.vigenciaMeses} mes{req.vigenciaMeses === 1 ? '' : 'es'} desde la emisión
                  </p>
                )}
              </div>
            )}
          </div>
          <div><label style={LABEL}>Estado del trámite</label>
            <select className="select" value={form.estadoTramite} onChange={e => set('estadoTramite', e.target.value as EstadoTramite)}>
              {(Object.keys(TRAMITE_UI) as EstadoTramite[]).map(k => <option key={k} value={k}>{TRAMITE_UI[k]}</option>)}
            </select></div>
          <div><label style={LABEL}>Archivo (PDF o foto)</label>
            <input type="file" className="input" accept="application/pdf,image/*"
              onChange={e => set('archivo', e.target.files?.[0] || null)} />
            {form.archivoActual && !form.archivo && (
              <p style={{ fontSize: '.72rem', color: 'var(--text3)', marginTop: '.2rem' }}>Actual: {form.archivoActual} (subí otro para reemplazarlo)</p>
            )}</div>
          <div><label style={LABEL}>Notas</label>
            <input className="input" value={form.notas} placeholder="Opcional…" onChange={e => set('notas', e.target.value)} /></div>
        </div>
        {req?.notas && <p style={{ fontSize: '.74rem', color: 'var(--text3)', marginTop: '.75rem' }}>ℹ️ {req.notas}</p>}
        {error && <p style={{ fontSize: '.82rem', color: 'var(--red)', marginTop: '.75rem' }}>{error}</p>}
        <div style={{ display: 'flex', gap: '.75rem', marginTop: '1.25rem' }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onCerrar}>Cancelar</button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={onGuardar} disabled={guardando}>
            {guardando ? <><span className="spinner" style={{ width: 12, height: 12 }} />Guardando…</> : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Fila del checklist ──────────────────────────────────────────────── */
function FilaRequisito({ it, onCargar, onEditar }: { it: ItemChecklist; onCargar: () => void; onEditar: (d: DocLegajo) => void }) {
  const ui = ESTADO_UI[it.estado];
  const d = it.documento;
  return (
    <div style={{ display: 'flex', gap: '.75rem', alignItems: 'flex-start', padding: '.7rem 0', borderBottom: '1px solid var(--border)' }}>
      <span className={`badge ${ui.badge}`} style={{ minWidth: 78, textAlign: 'center', flexShrink: 0 }}>{ui.label}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '.86rem', color: 'var(--text)', fontWeight: 600 }}>{it.requisito.nombre}</p>
        <p style={{ fontSize: '.74rem', color: 'var(--text3)', marginTop: '.1rem' }}>
          {it.requisito.condicion && <>{it.requisito.condicion} · </>}
          {d ? (
            <>
              {it.fechaVenc ? <>Vence {it.fechaVenc}{it.diffDias !== null && <span style={{ color: ui.color }}> ({textoDias(it.diffDias)})</span>}</>
                : it.requisito.vencimiento === 'no' ? 'No vence' : 'Falta cargar la fecha de vencimiento'}
              {d.estadoTramite && <> · {TRAMITE_UI[d.estadoTramite]}</>}
              {it.historial.length > 0 && <> · {it.historial.length} versión{it.historial.length === 1 ? '' : 'es'} anterior{it.historial.length === 1 ? '' : 'es'}</>}
            </>
          ) : it.requisito.vencimiento === 'meses' ? `Dura ${it.requisito.vigenciaMeses} mes${it.requisito.vigenciaMeses === 1 ? '' : 'es'}` : ''}
        </p>
      </div>
      <div style={{ display: 'flex', gap: '.35rem', flexShrink: 0 }}>
        {d?.archivoUrl && (
          <a className="btn btn-secondary" style={{ fontSize: '.72rem', padding: '.3rem .6rem' }} href={d.archivoUrl} target="_blank" rel="noreferrer">Ver</a>
        )}
        {d && <button className="btn btn-secondary" style={{ fontSize: '.72rem', padding: '.3rem .6rem' }} onClick={() => onEditar(d)}>Editar</button>}
        <button className={`btn ${d ? 'btn-secondary' : 'btn-primary'}`} style={{ fontSize: '.72rem', padding: '.3rem .6rem' }} onClick={onCargar}>
          {d ? 'Renovar' : 'Cargar'}
        </button>
      </div>
    </div>
  );
}

/* ── Página ──────────────────────────────────────────────────────────── */
export default function LegajosPage() {
  const authLoading = useRequireAdmin();
  const [carpetas, setCarpetas] = useState<Carpeta[]>([]);
  const [hayRequisitos, setHayRequisitos] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busq, setBusq] = useState('');
  const [filtroOS, setFiltroOS] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [abierta, setAbierta] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [cargandoDet, setCargandoDet] = useState(false);
  const [form, setForm] = useState<FormDoc | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [leyendoIA, setLeyendoIA] = useState(false);

  const aplicarLista = (data: { carpetas?: Carpeta[]; hayRequisitos?: boolean }) => {
    setCarpetas(data.carpetas || []);
    setHayRequisitos(data.hayRequisitos !== false);
  };
  const cargar = useCallback(async () => {
    try { const r = await api.get('/api/legajos'); aplicarLista(r.data); } catch { /* silent */ }
  }, []);

  const cargarDetalle = useCallback(async (id: string) => {
    try { const r = await api.get(`/api/legajos/${id}`); setDetalle(r.data); }
    catch { setDetalle(null); }
    setCargandoDet(false);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    let vivo = true;
    api.get('/api/legajos').then(r => { if (vivo) aplicarLista(r.data); }).catch(() => {}).finally(() => { if (vivo) setLoading(false); });
    return () => { vivo = false; };
  }, [authLoading]);

  const abrir = (id: string) => { setAbierta(id); setDetalle(null); setCargandoDet(true); cargarDetalle(id); };
  const cerrarCarpeta = () => { setAbierta(null); setDetalle(null); };

  const obrasEnUso = useMemo(() => [...new Set(carpetas.map(c => c.obraNombre || c.obraSocial).filter(Boolean))].sort(), [carpetas]);

  const filtradas = carpetas.filter(c => {
    if (busq) {
      const q = busq.toLowerCase();
      if (!c.nombre.toLowerCase().includes(q) && !c.dni.includes(q) && !c.afiliado.includes(q)) return false;
    }
    if (filtroOS && (c.obraNombre || c.obraSocial) !== filtroOS) return false;
    if (filtro === 'pendientes') return !c.resumen.completo && !!c.obraId;
    if (filtro === 'vencidos') return c.resumen.VENCIDO > 0;
    if (filtro === 'completas') return c.resumen.completo;
    if (filtro === 'sin_os') return !c.obraId;
    return true;
  });

  const cont = {
    pendientes: carpetas.filter(c => !c.resumen.completo && c.obraId).length,
    vencidos: carpetas.filter(c => c.resumen.VENCIDO > 0).length,
    completas: carpetas.filter(c => c.resumen.completo).length,
    sin_os: carpetas.filter(c => !c.obraId).length,
  };

  const abrirCarga = (req: Requisito | null) => {
    setError('');
    setForm({ docId: '', requisito: req, nombre: '', fechaEmision: hoyIso(),
      fechaVenc: req?.vencimiento === 'meses' ? sumarMesesIso(hoyIso(), req.vigenciaMeses) : '',
      estadoTramite: 'CARGADO', notas: '', archivo: null, archivoActual: '' });
  };

  const abrirEdicion = (d: DocLegajo, req: Requisito | null) => {
    setError('');
    setForm({ docId: d.id, requisito: req, nombre: d.nombre || '', fechaEmision: dmyAIso(d.fechaEmision),
      fechaVenc: dmyAIso(d.fechaVenc), estadoTramite: d.estadoTramite || 'CARGADO', notas: d.notas || '',
      archivo: null, archivoActual: d.archivoNombre || '' });
  };

  const guardar = async () => {
    if (!form || !detalle) return;
    if (!form.requisito && !form.nombre.trim()) { setError('Poné el nombre del documento.'); return; }
    if (form.requisito?.vencimiento === 'fecha_doc' && !form.fechaVenc) { setError('Este documento necesita la fecha de vencimiento.'); return; }
    setGuardando(true); setError('');
    try {
      const body: Record<string, unknown> = {
        requisitoKey: form.requisito?.key || 'otro', nombre: form.requisito?.nombre || form.nombre.trim(),
        fechaEmision: form.fechaEmision, fechaVenc: form.fechaVenc, estadoTramite: form.estadoTramite,
        notas: form.notas, beneficiarioNombre: detalle.beneficiario.nombre,
      };
      if (form.archivo) body.archivo = await archivoABase64(form.archivo);
      if (form.docId) await api.put(`/api/legajos/documentos/${form.docId}`, body);
      else await api.post(`/api/legajos/${detalle.beneficiario.id}/documentos`, body);
      setForm(null);
      await Promise.all([cargarDetalle(detalle.beneficiario.id), cargar()]);
    } catch (e) { setError(mensajeError(e, 'No se pudo guardar')); }
    setGuardando(false);
  };

  const eliminarDoc = async (id: string) => {
    if (!detalle || !window.confirm('¿Borrar este documento de la carpeta?')) return;
    try { await api.delete(`/api/legajos/documentos/${id}`); await Promise.all([cargarDetalle(detalle.beneficiario.id), cargar()]); }
    catch { /* silent */ }
  };

  if (authLoading) return null;

  return (
    <div>
      <div className="section-header">
        <div>
          <h2 className="section-title">🗂️ Carpeta de pacientes</h2>
          <p style={{ fontSize: '.82rem', color: 'var(--text3)', marginTop: '.2rem' }}>
            {cont.completas} de {carpetas.length} carpetas completas
            {cont.vencidos > 0 && <span style={{ color: 'var(--red)' }}> · {cont.vencidos} con documentos vencidos</span>}
          </p>
        </div>
        <Link className="btn btn-secondary" href="/dashboard/requisitos-os">⚙️ Requisitos por obra social</Link>
      </div>

      {!loading && !hayRequisitos && (
        <div className="card" style={{ padding: '1rem', marginBottom: '1rem', borderColor: 'var(--amber)' }}>
          <p style={{ fontSize: '.85rem', color: 'var(--text)' }}>
            Todavía no hay requisitos cargados, así que no se puede saber qué le falta a cada carpeta.{' '}
            <Link href="/dashboard/requisitos-os" style={{ color: 'var(--amber)', fontWeight: 600 }}>Cargá el borrador de requisitos →</Link>
          </p>
        </div>
      )}

      <div style={{ display: 'flex', gap: '.35rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        {([
          ['todas', 'Todas', carpetas.length], ['pendientes', 'Incompletas', cont.pendientes],
          ['vencidos', 'Con vencidos', cont.vencidos], ['completas', 'Completas', cont.completas],
          ['sin_os', 'Sin requisitos', cont.sin_os],
        ] as [Filtro, string, number][]).map(([k, label, n]) => (
          <button key={k} className={filtro === k ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{ fontSize: '.82rem' }} onClick={() => setFiltro(k)}>{label} ({n})</button>
        ))}
      </div>

      <div className="filter-bar" style={{ marginBottom: '1rem' }}>
        <input className="input" placeholder="Buscar por nombre, DNI o afiliado…" value={busq} onChange={e => setBusq(e.target.value)} />
        <select className="select" value={filtroOS} onChange={e => setFiltroOS(e.target.value)}>
          <option value="">Todas las obras sociales</option>
          {obrasEnUso.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', color: 'var(--text3)', padding: '2rem' }}>
          <span className="spinner" /> Cargando carpetas…
        </div>
      ) : filtradas.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">🗂️</div><p>No hay carpetas en esta vista</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
          {filtradas.map(c => {
            const r = c.resumen;
            const pct = r.total ? Math.round((r.OK / r.total) * 100) : 0;
            return (
              <div key={c.id} className="card" style={{ padding: '.75rem 1rem', cursor: 'pointer', display: 'flex', gap: '1rem', alignItems: 'center' }}
                onClick={() => abrir(c.id)}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '.9rem', fontWeight: 600, color: 'var(--text)' }}>{c.nombre}</span>
                    <span className={`badge ${c.obraId ? 'badge-blue' : 'badge-gray'}`}>{c.obraNombre || c.obraSocial || 'Sin obra social'}</span>
                  </div>
                  <p style={{ fontSize: '.75rem', color: 'var(--text3)', marginTop: '.15rem' }}>
                    {c.dni && <>DNI {c.dni}</>}{c.afiliado && <> · Afiliado {c.afiliado}</>}{c.localidad && <> · {c.localidad}</>}
                  </p>
                </div>
                {c.obraId ? (
                  <div style={{ display: 'flex', gap: '.35rem', alignItems: 'center', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {r.VENCIDO > 0 && <span className="badge badge-red">{r.VENCIDO} vencido{r.VENCIDO === 1 ? '' : 's'}</span>}
                    {r.FALTA > 0 && <span className="badge badge-red">faltan {r.FALTA}</span>}
                    {r.PROXIMO > 0 && <span className="badge badge-amber">{r.PROXIMO} por vencer</span>}
                    {r.completo && <span className="badge badge-green">Completa</span>}
                    <span style={{ fontSize: '.78rem', fontWeight: 700, color: pct === 100 ? 'var(--green)' : 'var(--text2)', minWidth: 42, textAlign: 'right' }}>{r.OK}/{r.total}</span>
                  </div>
                ) : <span className="badge badge-purple" style={{ flexShrink: 0 }}>Configurar OS</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Detalle de la carpeta ── */}
      {abierta && (
        <div style={OVERLAY} onClick={e => { if (e.target === e.currentTarget) cerrarCarpeta(); }}>
          <div className="card" style={{ width: '100%', maxWidth: 760, padding: '1.5rem', maxHeight: '92vh', overflowY: 'auto' }}>
            {cargandoDet && !detalle ? (
              <div style={{ display: 'flex', gap: '.75rem', color: 'var(--text3)' }}><span className="spinner" /> Abriendo carpeta…</div>
            ) : !detalle ? (
              <p style={{ color: 'var(--red)' }}>No se pudo abrir la carpeta.</p>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)' }}>{detalle.beneficiario.nombre}</h3>
                    <p style={{ fontSize: '.8rem', color: 'var(--text3)', marginTop: '.15rem' }}>
                      {detalle.obra?.nombre || detalle.beneficiario.obraSocial || 'Sin obra social'}
                      {detalle.beneficiario.dni && <> · DNI {detalle.beneficiario.dni}</>}
                      {detalle.beneficiario.afiliado && <> · Afiliado {detalle.beneficiario.afiliado}</>}
                    </p>
                  </div>
                  <button className="btn btn-secondary" style={{ alignSelf: 'flex-start' }} onClick={cerrarCarpeta}>✕</button>
                </div>

                {!detalle.obra ? (
                  <div className="card" style={{ padding: '1rem', borderColor: 'var(--amber)' }}>
                    <p style={{ fontSize: '.85rem', color: 'var(--text)' }}>
                      {detalle.beneficiario.obraSocial
                        ? <>La obra social <b>“{detalle.beneficiario.obraSocial}”</b> no coincide con ninguna configurada.</>
                        : <>Este paciente no tiene obra social cargada en el Registro.</>}
                    </p>
                    <p style={{ fontSize: '.8rem', color: 'var(--text3)', marginTop: '.4rem' }}>
                      Corregí la obra social en Registro, o agregá ese nombre como alias en{' '}
                      <Link href="/dashboard/requisitos-os" style={{ color: 'var(--amber)' }}>Requisitos por obra social</Link>.
                    </p>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '.75rem', flexWrap: 'wrap', marginBottom: '.25rem' }}>
                      <p style={{ fontSize: '.8rem', color: 'var(--text2)' }}>
                        {detalle.resumen.OK} de {detalle.resumen.total} documentos al día
                      </p>
                      <button className="btn btn-primary" style={{ minHeight: 44 }} onClick={() => setLeyendoIA(true)}>
                        <IconCamera size={18} /> Cargar con fotos / leer con IA
                      </button>
                    </div>
                    <div>
                      {detalle.checklist.map(it => (
                        <FilaRequisito key={it.requisito.key} it={it}
                          onCargar={() => abrirCarga(it.requisito)} onEditar={d => abrirEdicion(d, it.requisito)} />
                      ))}
                    </div>
                  </>
                )}

                <div style={{ marginTop: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.4rem' }}>
                    <p style={{ fontSize: '.85rem', fontWeight: 700, color: 'var(--text)' }}>Otros documentos</p>
                    <button className="btn btn-secondary" style={{ fontSize: '.75rem' }} onClick={() => abrirCarga(null)}>+ Agregar</button>
                  </div>
                  {detalle.otros.length === 0 ? (
                    <p style={{ fontSize: '.78rem', color: 'var(--text3)' }}>Nada más cargado.</p>
                  ) : detalle.otros.map(d => (
                    <div key={d.id} style={{ display: 'flex', gap: '.75rem', alignItems: 'center', padding: '.5rem 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '.84rem', color: 'var(--text)' }}>{d.nombre || d.requisitoKey}</p>
                        <p style={{ fontSize: '.72rem', color: 'var(--text3)' }}>
                          {d.fechaEmision && <>Emitido {d.fechaEmision}</>}{d.fechaVenc && <> · Vence {d.fechaVenc}</>}{d.notas && <> · {d.notas}</>}
                        </p>
                      </div>
                      {d.archivoUrl && <a className="btn btn-secondary" style={{ fontSize: '.72rem', padding: '.3rem .6rem' }} href={d.archivoUrl} target="_blank" rel="noreferrer">Ver</a>}
                      <button className="btn btn-secondary" style={{ fontSize: '.72rem', padding: '.3rem .6rem' }} onClick={() => abrirEdicion(d, null)}>Editar</button>
                      <button className="btn btn-secondary" style={{ fontSize: '.72rem', padding: '.3rem .6rem' }} onClick={() => eliminarDoc(d.id)}>🗑</button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {leyendoIA && detalle && (
        <LecturaIA beneficiarioId={detalle.beneficiario.id} beneficiarioNombre={detalle.beneficiario.nombre}
          requisitos={(detalle.obra?.requisitos || []).filter(r => r.categoria === 'paciente')}
          onCerrar={() => setLeyendoIA(false)}
          onGuardado={() => Promise.all([cargarDetalle(detalle.beneficiario.id), cargar()])} />
      )}

      {form && <ModalDocumento form={form} setForm={setForm} onCerrar={() => setForm(null)} onGuardar={guardar} guardando={guardando} error={error} />}
    </div>
  );
}
