'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
import { ESTADO_UI, LABEL, OVERLAY, dmyAIso, mensajeError, textoDias } from '@/lib/administrativo';

interface Ocurrencia {
  tareaId: string; titulo: string; obraSocial: string; notas: string; frecuencia: string;
  periodo: string; fecha: string; estado: 'VENCIDO' | 'PROXIMO' | 'PENDIENTE' | 'HECHO'; diffDias: number | null;
  hechoPor: string; hechoEn: string;
}
interface AlertaDoc {
  tipo: string; beneficiarioId: string; beneficiario: string; obraSocial?: string;
  detalle: string; fechaVenc?: string; diffDias: number | null;
}
interface VencFlota { id: string; descripcion: string; persona: string; tipo: string; fechaVenc: string; estado: string; diffDias: number }
interface Panel {
  tareas: Ocurrencia[]; docsPacientes: AlertaDoc[]; vencimientos: VencFlota[];
  resumen: { urgentes: number; tareasPendientes: number; tareasHechas: number; carpetasCompletas: number; carpetasTotal: number };
  hayTareas: boolean; hayRequisitos: boolean;
}
interface Tarea {
  id: string; titulo: string; obraSocial: string; frecuencia: 'MENSUAL' | 'ANUAL' | 'UNICA';
  dia: number; mes: number; fecha: string; diasAviso: number; notas: string; activo: boolean;
}

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const TAREA_VACIA: Tarea = { id: '', titulo: '', obraSocial: '', frecuencia: 'MENSUAL', dia: 5, mes: 1, fecha: '', diasAviso: 3, notas: '', activo: true };

const describirFrecuencia = (t: Tarea) =>
  t.frecuencia === 'MENSUAL' ? `Todos los meses, día ${t.dia}`
    : t.frecuencia === 'ANUAL' ? `Cada año, ${t.dia} de ${MESES[(t.mes || 1) - 1].toLowerCase()}`
      : `Una vez, ${t.fecha}`;

function Kpi({ valor, label, color }: { valor: string; label: string; color?: string }) {
  return (
    <div className="card" style={{ padding: '.9rem 1rem' }}>
      <p style={{ fontSize: '1.5rem', fontWeight: 800, color: color || 'var(--text)', lineHeight: 1 }}>{valor}</p>
      <p style={{ fontSize: '.74rem', color: 'var(--text3)', marginTop: '.3rem' }}>{label}</p>
    </div>
  );
}

function Seccion({ titulo, accion, children }: { titulo: string; accion?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: '1rem 1.1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.6rem', gap: '.5rem' }}>
        <p style={{ fontSize: '.95rem', fontWeight: 700, color: 'var(--text)' }}>{titulo}</p>
        {accion}
      </div>
      {children}
    </div>
  );
}

export default function PanelAdminPage() {
  const authLoading = useRequireAdmin();
  const [panel, setPanel] = useState<Panel | null>(null);
  const [loading, setLoading] = useState(true);
  const [verTodasDocs, setVerTodasDocs] = useState(false);
  const [gestion, setGestion] = useState(false);
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [form, setForm] = useState<Tarea | null>(null);
  const [error, setError] = useState('');

  const pedirPanel = () => api.get('/api/agenda-admin/panel').then(r => r.data as Panel);
  const cargar = useCallback(async () => {
    try { setPanel(await pedirPanel()); } catch { /* silent */ }
  }, []);
  const cargarTareas = useCallback(async () => {
    try { const r = await api.get('/api/agenda-admin/tareas'); setTareas(r.data.tareas || []); } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    let vivo = true;
    pedirPanel().then(p => { if (vivo) setPanel(p); }).catch(() => {}).finally(() => { if (vivo) setLoading(false); });
    return () => { vivo = false; };
  }, [authLoading]);

  const abrirGestion = () => { setGestion(true); cargarTareas(); };

  const marcar = async (o: Ocurrencia) => {
    const hecho = o.estado !== 'HECHO';
    setPanel(p => p && ({ ...p, tareas: p.tareas.map(t => t.tareaId === o.tareaId && t.periodo === o.periodo ? { ...t, estado: hecho ? 'HECHO' : 'PENDIENTE' } : t) }));
    try { await api.post(`/api/agenda-admin/tareas/${o.tareaId}/hecho`, { periodo: o.periodo, hecho }); } catch { /* se re-sincroniza abajo */ }
    cargar();
  };

  const sugeridas = async () => {
    try { await api.post('/api/agenda-admin/tareas/semilla'); await cargar(); } catch { /* silent */ }
  };

  const guardarTarea = async () => {
    if (!form) return;
    if (!form.titulo.trim()) { setError('Poné qué hay que hacer.'); return; }
    if (form.frecuencia === 'UNICA' && !form.fecha) { setError('Elegí la fecha.'); return; }
    setError('');
    try {
      if (form.id) await api.put(`/api/agenda-admin/tareas/${form.id}`, form);
      else await api.post('/api/agenda-admin/tareas', form);
      setForm(null); await Promise.all([cargarTareas(), cargar()]);
    } catch (e) { setError(mensajeError(e, 'No se pudo guardar')); }
  };

  const borrarTarea = async (t: Tarea) => {
    if (!window.confirm(`¿Borrar "${t.titulo}"?`)) return;
    try { await api.delete(`/api/agenda-admin/tareas/${t.id}`); await Promise.all([cargarTareas(), cargar()]); } catch { /* silent */ }
  };

  if (authLoading) return null;

  const docs = panel?.docsPacientes || [];
  const docsVisibles = verTodasDocs ? docs : docs.slice(0, 12);
  const mesActual = MESES[new Date().getMonth()];

  return (
    <div>
      <div className="section-header">
        <div>
          <h2 className="section-title">🧭 Panel administrativo</h2>
          <p style={{ fontSize: '.82rem', color: 'var(--text3)', marginTop: '.2rem' }}>Todo lo que hay que hacer, en una sola pantalla. Empezá por lo rojo.</p>
        </div>
        <button className="btn btn-secondary" onClick={abrirGestion}>⚙️ Tareas recurrentes</button>
      </div>

      {loading || !panel ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', color: 'var(--text3)', padding: '2rem' }}><span className="spinner" /> Armando el panel…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '.6rem' }}>
            <Kpi valor={String(panel.resumen.urgentes)} label="Cosas vencidas" color={panel.resumen.urgentes ? 'var(--red)' : 'var(--green)'} />
            <Kpi valor={`${panel.resumen.tareasHechas}/${panel.resumen.tareasHechas + panel.resumen.tareasPendientes}`} label={`Tareas de ${mesActual.toLowerCase()} hechas`} />
            <Kpi valor={`${panel.resumen.carpetasCompletas}/${panel.resumen.carpetasTotal}`} label="Carpetas de pacientes completas" />
            <Kpi valor={String(panel.vencimientos.length)} label="Vencimientos de choferes y vehículos" color={panel.vencimientos.some(v => v.estado === 'VENCIDO') ? 'var(--red)' : panel.vencimientos.length ? 'var(--amber)' : 'var(--green)'} />
          </div>

          <Seccion titulo={`Tareas de ${mesActual.toLowerCase()}`}>
            {!panel.hayTareas ? (
              <div style={{ textAlign: 'center', padding: '.75rem' }}>
                <p style={{ fontSize: '.84rem', color: 'var(--text2)' }}>No hay tareas recurrentes cargadas.</p>
                <p style={{ fontSize: '.76rem', color: 'var(--text3)', margin: '.3rem 0 .8rem' }}>
                  Hay una lista sugerida para el ciclo mensual: planillas, DJ-ESC107, facturación, presentación y cobros. Las fechas se pueden cambiar.
                </p>
                <button className="btn btn-primary" onClick={sugeridas}>Cargar tareas sugeridas</button>
              </div>
            ) : panel.tareas.length === 0 ? (
              <p style={{ fontSize: '.82rem', color: 'var(--text3)' }}>Nada para este período.</p>
            ) : panel.tareas.map(o => {
              const ui = ESTADO_UI[o.estado];
              const hecho = o.estado === 'HECHO';
              return (
                <div key={o.tareaId + o.periodo} style={{ display: 'flex', gap: '.75rem', alignItems: 'flex-start', padding: '.6rem 0', borderBottom: '1px solid var(--border)' }}>
                  <input type="checkbox" checked={hecho} onChange={() => marcar(o)} style={{ width: 18, height: 18, marginTop: 2, cursor: 'pointer', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '.86rem', color: hecho ? 'var(--text3)' : 'var(--text)', fontWeight: 600, textDecoration: hecho ? 'line-through' : 'none' }}>{o.titulo}</p>
                    <p style={{ fontSize: '.74rem', color: 'var(--text3)', marginTop: '.1rem' }}>
                      {o.fecha}{!hecho && o.diffDias !== null && <span style={{ color: ui.color }}> · {textoDias(o.diffDias)}</span>}
                      {o.obraSocial && <> · {o.obraSocial}</>}
                      {hecho && o.hechoPor && <> · hecho por {o.hechoPor}</>}
                    </p>
                    {o.notas && !hecho && <p style={{ fontSize: '.74rem', color: 'var(--text3)', marginTop: '.15rem' }}>{o.notas}</p>}
                  </div>
                  <span className={`badge ${ui.badge}`} style={{ flexShrink: 0 }}>{o.estado === 'VENCIDO' ? 'Atrasada' : ui.label}</span>
                </div>
              );
            })}
          </Seccion>

          <Seccion titulo="Documentos de pacientes"
            accion={<Link className="btn btn-secondary" style={{ fontSize: '.75rem' }} href="/dashboard/legajos">Abrir carpetas →</Link>}>
            {!panel.hayRequisitos ? (
              <p style={{ fontSize: '.82rem', color: 'var(--text2)' }}>
                Primero cargá los <Link href="/dashboard/requisitos-os" style={{ color: 'var(--amber)', fontWeight: 600 }}>requisitos por obra social</Link> para saber qué le falta a cada paciente.
              </p>
            ) : docs.length === 0 ? (
              <p style={{ fontSize: '.82rem', color: 'var(--green)' }}>✓ Todas las carpetas al día.</p>
            ) : (
              <>
                {docsVisibles.map((a, i) => {
                  const ui = ESTADO_UI[a.tipo] || ESTADO_UI.PENDIENTE;
                  return (
                    <div key={i} style={{ display: 'flex', gap: '.75rem', alignItems: 'center', padding: '.5rem 0', borderBottom: '1px solid var(--border)' }}>
                      <span className={`badge ${ui.badge}`} style={{ minWidth: 86, textAlign: 'center', flexShrink: 0 }}>{ui.label}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '.84rem', color: 'var(--text)' }}><b>{a.beneficiario}</b> · {a.detalle}</p>
                        <p style={{ fontSize: '.72rem', color: 'var(--text3)' }}>
                          {a.obraSocial}{a.fechaVenc && <> · vence {a.fechaVenc}</>}{a.diffDias !== null && <span style={{ color: ui.color }}> ({textoDias(a.diffDias)})</span>}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {docs.length > 12 && (
                  <button className="btn btn-secondary" style={{ fontSize: '.78rem', marginTop: '.6rem' }} onClick={() => setVerTodasDocs(v => !v)}>
                    {verTodasDocs ? 'Ver menos' : `Ver los ${docs.length}`}
                  </button>
                )}
              </>
            )}
          </Seccion>

          <Seccion titulo="Choferes y vehículos"
            accion={<Link className="btn btn-secondary" style={{ fontSize: '.75rem' }} href="/dashboard/vencimientos">Vencimientos →</Link>}>
            {panel.vencimientos.length === 0 ? (
              <p style={{ fontSize: '.82rem', color: 'var(--green)' }}>✓ Nada vencido ni por vencer en los próximos días.</p>
            ) : panel.vencimientos.map(v => {
              const ui = ESTADO_UI[v.estado];
              return (
                <div key={v.id} style={{ display: 'flex', gap: '.75rem', alignItems: 'center', padding: '.5rem 0', borderBottom: '1px solid var(--border)' }}>
                  <span className={`badge ${ui.badge}`} style={{ minWidth: 86, textAlign: 'center', flexShrink: 0 }}>{ui.label}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '.84rem', color: 'var(--text)' }}>{v.descripcion}{v.persona && <> · {v.persona}</>}</p>
                    <p style={{ fontSize: '.72rem', color: 'var(--text3)' }}>{v.tipo} · {v.fechaVenc} <span style={{ color: ui.color }}>({textoDias(v.diffDias)})</span></p>
                  </div>
                </div>
              );
            })}
          </Seccion>
        </div>
      )}

      {/* ── Gestión de tareas recurrentes ── */}
      {gestion && (
        <div style={OVERLAY} onClick={e => { if (e.target === e.currentTarget && !form) setGestion(false); }}>
          <div className="card" style={{ width: '100%', maxWidth: 640, padding: '1.5rem', maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)' }}>Tareas recurrentes</h3>
              <div style={{ display: 'flex', gap: '.4rem' }}>
                <button className="btn btn-primary" style={{ fontSize: '.8rem' }} onClick={() => { setError(''); setForm({ ...TAREA_VACIA }); }}>+ Nueva</button>
                <button className="btn btn-secondary" onClick={() => setGestion(false)}>✕</button>
              </div>
            </div>
            {tareas.length === 0 ? (
              <p style={{ fontSize: '.82rem', color: 'var(--text3)' }}>No hay tareas. Cargá las sugeridas desde el panel o creá una nueva.</p>
            ) : tareas.map(t => (
              <div key={t.id} style={{ display: 'flex', gap: '.75rem', alignItems: 'center', padding: '.55rem 0', borderBottom: '1px solid var(--border)', opacity: t.activo ? 1 : .5 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '.85rem', color: 'var(--text)', fontWeight: 600 }}>{t.titulo}</p>
                  <p style={{ fontSize: '.73rem', color: 'var(--text3)' }}>{describirFrecuencia(t)}{t.obraSocial && <> · {t.obraSocial}</>}{!t.activo && ' · pausada'}</p>
                </div>
                <button className="btn btn-secondary" style={{ fontSize: '.72rem', padding: '.3rem .6rem' }}
                  onClick={() => { setError(''); setForm({ ...t, fecha: dmyAIso(t.fecha) }); }}>Editar</button>
                <button className="btn btn-secondary" style={{ fontSize: '.72rem', padding: '.3rem .6rem' }} onClick={() => borrarTarea(t)}>🗑</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {form && (
        <div style={{ ...OVERLAY, zIndex: 60 }} onClick={e => { if (e.target === e.currentTarget) setForm(null); }}>
          <div className="card" style={{ width: '100%', maxWidth: 480, padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', marginBottom: '1rem' }}>{form.id ? 'Editar tarea' : 'Nueva tarea'}</h3>
            <div className="form-grid">
              <div><label style={LABEL}>¿Qué hay que hacer? *</label>
                <input className="input" value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} /></div>
              <div className="form-grid form-grid-2">
                <div><label style={LABEL}>Se repite</label>
                  <select className="select" value={form.frecuencia} onChange={e => setForm({ ...form, frecuencia: e.target.value as Tarea['frecuencia'] })}>
                    <option value="MENSUAL">Todos los meses</option>
                    <option value="ANUAL">Una vez por año</option>
                    <option value="UNICA">Una sola vez</option>
                  </select></div>
                {form.frecuencia === 'UNICA' ? (
                  <div><label style={LABEL}>Fecha *</label>
                    <input type="date" className="input" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} /></div>
                ) : (
                  <div><label style={LABEL}>Día del mes</label>
                    <input type="number" min={1} max={31} className="input" value={form.dia} onChange={e => setForm({ ...form, dia: Number(e.target.value) })} /></div>
                )}
              </div>
              {form.frecuencia === 'ANUAL' && (
                <div><label style={LABEL}>Mes</label>
                  <select className="select" value={form.mes} onChange={e => setForm({ ...form, mes: Number(e.target.value) })}>
                    {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                  </select></div>
              )}
              <div className="form-grid form-grid-2">
                <div><label style={LABEL}>Obra social (opcional)</label>
                  <input className="input" value={form.obraSocial} onChange={e => setForm({ ...form, obraSocial: e.target.value })} /></div>
                <div><label style={LABEL}>Avisar con días de anticipación</label>
                  <input type="number" min={0} max={60} className="input" value={form.diasAviso} onChange={e => setForm({ ...form, diasAviso: Number(e.target.value) })} /></div>
              </div>
              <div><label style={LABEL}>Instrucciones</label>
                <textarea className="input" rows={3} value={form.notas} placeholder="Cómo se hace, dónde, qué revisar…" onChange={e => setForm({ ...form, notas: e.target.value })} /></div>
              <label style={{ fontSize: '.8rem', color: 'var(--text2)', display: 'flex', gap: '.35rem', alignItems: 'center' }}>
                <input type="checkbox" checked={form.activo} onChange={e => setForm({ ...form, activo: e.target.checked })} /> Activa
              </label>
            </div>
            {error && <p style={{ fontSize: '.82rem', color: 'var(--red)', marginTop: '.75rem' }}>{error}</p>}
            <div style={{ display: 'flex', gap: '.75rem', marginTop: '1.25rem' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setForm(null)}>Cancelar</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={guardarTarea}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
