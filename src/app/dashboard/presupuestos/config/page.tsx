'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { IconAlertTriangle, IconCheck, IconUpload } from '@tabler/icons-react';
import api from '@/lib/api';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
import { LABEL, mensajeError } from '@/lib/administrativo';
import { FORMATOS, UNIDADES_TRAMO_CORTO, type Formato, type UnidadTramoCorto } from '@/lib/presupuesto';

interface Transportista { razonSocial: string; responsable: string; cuit: string; domicilio: string; telefono: string; mail: string; aseguradora: string; poliza: string }
interface Faltantes { faltan: string[]; avisos: string[] }
interface Obra {
  obraId: string; nombre: string; cuit: string; formato: Formato; plantilla: { nombre: string; copias?: number } | null;
  tramoCorto: { activo: boolean; kmMinimo: number; unidad: UnidadTramoCorto | null }; semanasPorMes: number; dependenciaPct: number;
}
const VACIO: Transportista = { razonSocial: '', responsable: '', cuit: '', domicilio: '', telefono: '', mail: '', aseguradora: '', poliza: '' };
const CAMPOS_T: [keyof Transportista, string, string?][] = [
  ['razonSocial', 'Razón social *'], ['responsable', 'Nombre del responsable'], ['cuit', 'CUIT *', 'Ej: 30-12345678-1'], ['domicilio', 'Domicilio *'],
  ['telefono', 'Teléfono *'], ['mail', 'Mail de contacto *'], ['aseguradora', 'Compañía de seguros'], ['poliza', 'Póliza N°'],
];

export default function ConfigPresupuestosPage() {
  const authLoading = useRequireAdmin();
  const [t, setT] = useState<Transportista>(VACIO);
  const [faltantes, setFaltantes] = useState<Faltantes>({ faltan: [], avisos: [] });
  const [obras, setObras] = useState<Obra[]>([]);
  const [dias, setDias] = useState('7');
  const [cargando, setCargando] = useState(true);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState('');

  const cargar = useCallback(() => api.get('/api/presupuestos/config').then(({ data: r }) => {
    setT({ ...VACIO, ...(r.transportista || {}) }); setFaltantes(r.faltantes || { faltan: [], avisos: [] }); setObras(r.obras || []); setDias(String(r.diasSinRespuesta || 7));
  }).catch(e => setMsg({ ok: false, texto: mensajeError(e, 'No se pudo cargar la configuración.') })).finally(() => setCargando(false)), []);
  useEffect(() => { if (authLoading) return; cargar(); }, [authLoading, cargar]);

  const ejecutar = async (clave: string, fn: () => Promise<void>, ok: string) => {
    setOcupado(clave); setMsg(null);
    try { await fn(); setMsg({ ok: true, texto: ok }); await cargar(); } catch (e) { setMsg({ ok: false, texto: mensajeError(e, 'No se pudo guardar.') }); }
    setOcupado('');
  };

  const guardarT = () => ejecutar('t', async () => { await api.put('/api/presupuestos/transportista', t); }, 'Datos del transportista guardados.');
  const guardarObra = (o: Obra) => ejecutar(o.obraId, async () => {
    await api.put(`/api/presupuestos/obras/${o.obraId}`, { nombre: o.nombre, cuit: o.cuit, formato: o.formato, tramoCorto: o.tramoCorto, semanasPorMes: o.semanasPorMes, dependenciaPct: o.dependenciaPct });
  }, `${o.nombre}: configuración guardada.`);
  const subirPlantilla = (o: Obra, f: File | undefined) => {
    if (!f) return;
    if (f.size > 3 * 1024 * 1024) { setMsg({ ok: false, texto: 'La plantilla pesa más de 3 MB. Guardala sin imágenes pesadas.' }); return; }
    ejecutar(o.obraId, async () => {
      const base64 = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej(new Error('No se pudo leer el archivo.')); r.readAsDataURL(f); });
      await api.post(`/api/presupuestos/obras/${o.obraId}/plantilla`, { archivo: { base64, nombre: f.name } });
    }, `${o.nombre}: plantilla cargada. Esta obra social ahora usa el formulario de Traslados Programados.`);
  };
  const quitarPlantilla = (o: Obra) => ejecutar(o.obraId, async () => { await api.delete(`/api/presupuestos/obras/${o.obraId}/plantilla`); }, `${o.nombre}: vuelve al formato multi-viaje.`);
  const cambiar = (id: string, c: Partial<Obra>) => setObras(os => os.map(o => (o.obraId === id ? { ...o, ...c } : o)));

  if (authLoading) return null;
  return (
    <div>
      <div className="section-header">
        <div>
          <h2 className="section-title">Configuración de presupuestos</h2>
          <p style={{ fontSize: '.82rem', color: 'var(--text3)', marginTop: '.2rem' }}>Datos del transportista y, por obra social, el formato y los parámetros de cálculo.</p>
        </div>
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
          <Link className="btn btn-secondary" style={{ minHeight: 44 }} href="/dashboard/presupuestos">Presupuestos</Link>
          <Link className="btn btn-secondary" style={{ minHeight: 44 }} href="/dashboard/aranceles">Valor del km</Link>
        </div>
      </div>

      {msg && <p role={msg.ok ? 'status' : 'alert'} style={{ fontSize: '.84rem', color: msg.ok ? 'var(--green)' : 'var(--red)', marginBottom: '.9rem' }}>{msg.texto}</p>}
      {cargando ? <div style={{ color: 'var(--text3)', padding: '2rem' }}><span className="spinner" /> Cargando…</div> : (
        <>
          <section className="card" style={{ padding: '1.1rem', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '.95rem', fontWeight: 700, color: 'var(--text)' }}>Datos del transportista</h3>
            <p style={{ fontSize: '.76rem', color: 'var(--text3)', margin: '.2rem 0 .9rem' }}>Se cargan una sola vez: salen en todos los presupuestos.</p>
            {(faltantes.faltan.length > 0 || faltantes.avisos.length > 0) && (
              <div style={{ display: 'flex', gap: '.5rem', alignItems: 'flex-start', marginBottom: '.9rem' }}>
                <IconAlertTriangle size={16} color="var(--amber)" style={{ flexShrink: 0, marginTop: 2 }} />
                <p style={{ fontSize: '.8rem', color: 'var(--text2)' }}>
                  {faltantes.faltan.length > 0 && <>Para emitir presupuestos falta: <b>{faltantes.faltan.join(', ')}</b>. </>}{faltantes.avisos.join(' ')}
                </p>
              </div>
            )}
            <div className="form-grid form-grid-2">
              {CAMPOS_T.map(([k, label, ph]) => (
                <div key={k}><label style={LABEL}>{label}</label>
                  <input className="input" style={{ minHeight: 44 }} value={t[k]} placeholder={ph} onChange={e => setT({ ...t, [k]: e.target.value })} autoComplete="off" /></div>
              ))}
            </div>
            <button className="btn btn-primary" style={{ minHeight: 44, marginTop: '1rem' }} onClick={guardarT} disabled={ocupado === 't'}>{ocupado === 't' ? 'Guardando…' : 'Guardar datos'}</button>
          </section>

          <h3 style={{ fontSize: '.95rem', fontWeight: 700, color: 'var(--text)', marginBottom: '.2rem' }}>Obras sociales</h3>
          <p style={{ fontSize: '.76rem', color: 'var(--text3)', marginBottom: '.8rem' }}>La obra social sin plantilla propia usa el formato multi-viaje. El tramo corto está apagado hasta que lo configures.</p>
          {obras.length === 0 && <p style={{ fontSize: '.84rem', color: 'var(--text3)' }}>Todavía no hay obras sociales cargadas en Requisitos por obra social.</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
            {obras.map(o => (
              <section key={o.obraId} className="card" style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <p style={{ fontSize: '.95rem', fontWeight: 700, color: 'var(--text)' }}>{o.nombre}</p>
                  <span className="badge badge-blue">{o.plantilla ? 'Formulario de Traslados' : 'Multi-viaje'}</span>
                </div>
                <div className="form-grid form-grid-2" style={{ marginTop: '.8rem' }}>
                  <div><label style={LABEL}>CUIT de la obra social</label><input className="input" style={{ minHeight: 44 }} value={o.cuit} onChange={e => cambiar(o.obraId, { cuit: e.target.value })} /></div>
                  <div><label style={LABEL}>Formato</label>
                    <select className="select" style={{ minHeight: 44 }} value={o.formato} onChange={e => cambiar(o.obraId, { formato: e.target.value as Formato })}>
                      {FORMATOS.map(f => <option key={f.k} value={f.k}>{f.label}</option>)}
                    </select></div>
                  <div><label style={LABEL}>Semanas por mes</label><input className="input" inputMode="decimal" style={{ minHeight: 44 }} value={o.semanasPorMes} onChange={e => cambiar(o.obraId, { semanasPorMes: Number(e.target.value.replace(',', '.')) || 0 })} /></div>
                  <div><label style={LABEL}>Adicional por dependencia (%)</label><input className="input" inputMode="decimal" style={{ minHeight: 44 }} value={o.dependenciaPct} onChange={e => cambiar(o.obraId, { dependenciaPct: Number(e.target.value.replace(',', '.')) || 0 })} /></div>
                </div>

                <div style={{ marginTop: '.9rem', padding: '.8rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg4)' }}>
                  <label style={{ display: 'flex', gap: '.5rem', alignItems: 'center', minHeight: 44, fontSize: '.85rem', fontWeight: 600, color: 'var(--text)' }}>
                    <input type="checkbox" style={{ width: 20, height: 20 }} checked={o.tramoCorto.activo} onChange={e => cambiar(o.obraId, { tramoCorto: { ...o.tramoCorto, activo: e.target.checked } })} />
                    Aplicar tramo corto (Resolución Conjunta 1/2023)
                  </label>
                  <p style={{ fontSize: '.74rem', color: 'var(--text3)', margin: '.1rem 0 .6rem' }}>La resolución no dice si el mínimo es por sentido, por viaje o por día: elegí cómo lo aplica esta obra social. Mientras esté apagado, se usan los km reales.</p>
                  {o.tramoCorto.activo && (
                    <div className="form-grid form-grid-2">
                      <div><label style={LABEL}>Km mínimo</label><input className="input" inputMode="decimal" style={{ minHeight: 44 }} value={o.tramoCorto.kmMinimo} onChange={e => cambiar(o.obraId, { tramoCorto: { ...o.tramoCorto, kmMinimo: Number(e.target.value.replace(',', '.')) || 0 } })} /></div>
                      <div><label style={LABEL}>Se aplica *</label>
                        <select className="select" style={{ minHeight: 44 }} value={o.tramoCorto.unidad || ''} onChange={e => cambiar(o.obraId, { tramoCorto: { ...o.tramoCorto, unidad: (e.target.value || null) as UnidadTramoCorto | null } })}>
                          <option value="">Elegí la unidad…</option>
                          {UNIDADES_TRAMO_CORTO.map(u => <option key={u.k} value={u.k}>{u.label}</option>)}
                        </select></div>
                    </div>
                  )}
                </div>

                <div style={{ marginTop: '.9rem', display: 'flex', gap: '.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <PlantillaInput o={o} onArchivo={f => subirPlantilla(o, f)} ocupado={ocupado === o.obraId} />
                  {o.plantilla && <button className="btn btn-secondary" style={{ minHeight: 44 }} onClick={() => quitarPlantilla(o)} disabled={ocupado === o.obraId}>Quitar plantilla</button>}
                  <button className="btn btn-primary" style={{ minHeight: 44, marginLeft: 'auto' }} onClick={() => guardarObra(o)} disabled={ocupado === o.obraId}>{ocupado === o.obraId ? 'Guardando…' : 'Guardar'}</button>
                </div>
                {o.plantilla && <p style={{ fontSize: '.74rem', color: 'var(--text3)', marginTop: '.4rem' }}><IconCheck size={13} style={{ verticalAlign: '-2px' }} /> Plantilla: {o.plantilla.nombre}{o.plantilla.copias ? ` (${o.plantilla.copias} copia${o.plantilla.copias === 1 ? '' : 's'} en el archivo; se rellena una sola salvo que pidas el duplicado)` : ''}</p>}
              </section>
            ))}
          </div>

          <section className="card" style={{ padding: '1rem', marginTop: '1.25rem' }}>
            <h3 style={{ fontSize: '.95rem', fontWeight: 700, color: 'var(--text)' }}>Pizarra del Inicio</h3>
            <p style={{ fontSize: '.76rem', color: 'var(--text3)', margin: '.2rem 0 .7rem' }}>Los presupuestos emitidos sin respuesta aparecen en Administración pasados estos días.</p>
            <div style={{ display: 'flex', gap: '.6rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div><label style={LABEL}>Días sin respuesta</label><input className="input" inputMode="numeric" style={{ minHeight: 44, width: 120 }} value={dias} onChange={e => setDias(e.target.value)} /></div>
              <button className="btn btn-primary" style={{ minHeight: 44 }} disabled={ocupado === 'dias'} onClick={() => ejecutar('dias', async () => { await api.put('/api/presupuestos/ajustes', { diasSinRespuesta: Number(dias) }); }, 'Guardado.')}>Guardar</button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function PlantillaInput({ o, onArchivo, ocupado }: { o: Obra; onArchivo: (f: File | undefined) => void; ocupado: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button className="btn btn-secondary" style={{ minHeight: 44 }} onClick={() => ref.current?.click()} disabled={ocupado}>
        <IconUpload size={16} /> {o.plantilla ? 'Reemplazar plantilla (.docx)' : 'Subir plantilla (.docx)'}
      </button>
      <input ref={ref} type="file" hidden accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={e => { onArchivo(e.target.files?.[0]); e.target.value = ''; }} />
    </>
  );
}
