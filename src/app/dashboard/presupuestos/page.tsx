'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { IconDownload, IconPlus, IconSettings, IconX } from '@tabler/icons-react';
import api from '@/lib/api';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
import { LABEL, OVERLAY, mensajeError } from '@/lib/administrativo';
import DesglosePresupuesto from '@/components/DesglosePresupuesto';
import PresupuestoWizard from '@/components/PresupuestoWizard';
import { bajarDocx, docDesdePresupuesto, mensajeDeBlob, type PresupuestoGuardado, type RespaldoItem } from '@/lib/presupuestoApi';
import { descargarPdf } from '@/lib/presupuestoPdf';
import { ESTADO_UI, periodoLabel, pesos, type Estado } from '@/lib/presupuesto';

interface Fila {
  id: string; numeroTexto: string; estado: Estado; beneficiarioNombre?: string; obraNombre?: string; periodoDesde: string; periodoHasta: string;
  total: number | null; fechaEmision: string; creadoEn: string;
}
const FILTROS: { k: '' | Estado; label: string }[] = [{ k: '', label: 'Todos' }, { k: 'BORRADOR', label: 'Borradores' }, { k: 'EMITIDO', label: 'Emitidos' }, { k: 'ACEPTADO', label: 'Aceptados' }, { k: 'RECHAZADO', label: 'Rechazados' }, { k: 'ANULADO', label: 'Anulados' }];

export default function PresupuestosPage() {
  const authLoading = useRequireAdmin();
  const [filas, setFilas] = useState<Fila[]>([]);
  const [filtro, setFiltro] = useState<'' | Estado>('');
  const [busq, setBusq] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [wizard, setWizard] = useState<null | { editarId?: string }>(null);
  const [abierto, setAbierto] = useState('');

  const cargar = useCallback(() => api.get('/api/presupuestos').then(r => { setFilas(r.data.presupuestos || []); setError(''); })
    .catch(e => setError(mensajeError(e, 'No se pudieron cargar los presupuestos.'))).finally(() => setCargando(false)), []);
  useEffect(() => { if (authLoading) return; cargar(); }, [authLoading, cargar]);

  const visibles = filas.filter(f => (!filtro || f.estado === filtro) && (!busq || (f.beneficiarioNombre || '').toLowerCase().includes(busq.toLowerCase()) || f.numeroTexto.includes(busq)));
  if (authLoading) return null;

  return (
    <div>
      <div className="section-header">
        <div>
          <h2 className="section-title">Presupuestos de transporte</h2>
          <p style={{ fontSize: '.82rem', color: 'var(--text3)', marginTop: '.2rem' }}>{filas.filter(f => f.estado === 'EMITIDO').length} emitidos sin respuesta · {filas.length} en total</p>
        </div>
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
          <Link className="btn btn-secondary" style={{ minHeight: 44 }} href="/dashboard/aranceles">Valor del km</Link>
          <Link className="btn btn-secondary" style={{ minHeight: 44 }} href="/dashboard/presupuestos/config"><IconSettings size={16} /> Configuración</Link>
          <button className="btn btn-primary" style={{ minHeight: 44 }} onClick={() => setWizard({})}><IconPlus size={16} /> Nuevo presupuesto</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '.35rem', flexWrap: 'wrap', marginBottom: '.8rem' }}>
        {FILTROS.map(f => <button key={f.k} className={filtro === f.k ? 'btn btn-primary' : 'btn btn-secondary'} style={{ fontSize: '.82rem', minHeight: 44 }} onClick={() => setFiltro(f.k)}>{f.label}</button>)}
      </div>
      <input className="input" style={{ minHeight: 44, marginBottom: '.9rem' }} placeholder="Buscar por paciente o número…" value={busq} onChange={e => setBusq(e.target.value)} />
      {error && <p role="alert" style={{ color: 'var(--red)', fontSize: '.85rem', marginBottom: '.7rem' }}>{error}</p>}

      {cargando ? <div style={{ color: 'var(--text3)', padding: '2rem' }}><span className="spinner" /> Cargando…</div> : visibles.length === 0 ? (
        <div className="empty-state"><p>No hay presupuestos en esta vista.</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
          {visibles.map(f => (
            <button key={f.id} className="card" style={{ textAlign: 'left', padding: '.75rem 1rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', cursor: 'pointer' }} onClick={() => setAbierto(f.id)}>
              <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                <p style={{ fontSize: '.9rem', fontWeight: 600, color: 'var(--text)' }}>{f.numeroTexto ? `N° ${f.numeroTexto} · ` : ''}{f.beneficiarioNombre || 'Sin paciente'}</p>
                <p style={{ fontSize: '.75rem', color: 'var(--text3)' }}>{f.obraNombre || 'Sin obra social'} · {periodoLabel(f.periodoDesde)}{f.periodoHasta && f.periodoHasta !== f.periodoDesde ? ` a ${periodoLabel(f.periodoHasta)}` : ''}{f.fechaEmision ? ` · emitido ${f.fechaEmision}` : ''}</p>
              </div>
              {f.total !== null && <span style={{ fontSize: '.9rem', fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{pesos(f.total)}</span>}
              <span className={`badge ${ESTADO_UI[f.estado].badge}`}>{ESTADO_UI[f.estado].label}</span>
            </button>
          ))}
        </div>
      )}

      {abierto && <Detalle id={abierto} onCerrar={() => setAbierto('')} onCambio={cargar} onCorregir={id => { setAbierto(''); setWizard({ editarId: id }); }} />}
      {wizard && <PresupuestoWizard editarId={wizard.editarId} onCerrar={() => setWizard(null)} onListo={() => { setWizard(null); cargar(); }} />}
    </div>
  );
}

function Detalle({ id, onCerrar, onCambio, onCorregir }: { id: string; onCerrar: () => void; onCambio: () => void; onCorregir: (id: string) => void }) {
  const [p, setP] = useState<PresupuestoGuardado | null>(null);
  const [respaldo, setRespaldo] = useState<RespaldoItem[]>([]);
  const [error, setError] = useState('');
  const [anulando, setAnulando] = useState<null | string>(null);
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(() => api.get(`/api/presupuestos/${id}`).then(({ data: r }) => { setP(r.presupuesto); setRespaldo(r.respaldo || []); })
    .catch(e => setError(mensajeError(e, 'No se pudo abrir el presupuesto.'))), [id]);
  useEffect(() => { cargar(); }, [cargar]);

  const accion = async (fn: () => Promise<void>) => { setOcupado(true); setError(''); try { await fn(); await cargar(); onCambio(); } catch (e) { setError(await mensajeDeBlob(e, mensajeError(e, 'No se pudo completar la acción.'))); } setOcupado(false); };
  const doc = p ? docDesdePresupuesto(p) : null;
  const emitido = !!p && p.estado !== 'BORRADOR';

  return (
    <div style={{ ...OVERLAY, zIndex: 55, alignItems: 'flex-start', overflowY: 'auto' }} onClick={e => { if (e.target === e.currentTarget) onCerrar(); }}>
      <div className="card" role="dialog" aria-label="Presupuesto" style={{ width: '100%', maxWidth: 860, padding: '1.25rem', margin: '1rem auto' }}>
        {!p ? (error ? <p role="alert" style={{ color: 'var(--red)' }}>{error}</p> : <div style={{ color: 'var(--text3)' }}><span className="spinner" /> Abriendo…</div>) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text)' }}>{p.numeroTexto ? `Presupuesto N° ${p.numeroTexto}` : 'Borrador de presupuesto'} <span className={`badge ${ESTADO_UI[p.estado as Estado].badge}`} style={{ marginLeft: '.4rem' }}>{ESTADO_UI[p.estado as Estado].label}</span></h3>
                <p style={{ fontSize: '.8rem', color: 'var(--text3)', marginTop: '.2rem' }}>{p.beneficiario.nombre} · DNI {p.beneficiario.dni} · {p.obraNombre} · {periodoLabel(p.periodoDesde)} a {periodoLabel(p.periodoHasta)}{p.fechaEmision ? ` · emitido ${p.fechaEmision}` : ''}</p>
              </div>
              <button className="btn btn-secondary" style={{ minWidth: 44, minHeight: 44 }} onClick={onCerrar} aria-label="Cerrar"><IconX size={18} /></button>
            </div>

            {p.estado === 'ANULADO' && <p style={{ fontSize: '.82rem', color: 'var(--text2)', marginTop: '.7rem' }}>Anulado: {p.motivoAnulacion}</p>}
            <div style={{ marginTop: '1rem' }}>
              {p.calculo && p.arancel ? <DesglosePresupuesto calculo={p.calculo} arancel={p.arancel} viajes={p.viajes} /> : <p style={{ fontSize: '.84rem', color: 'var(--text2)' }}>Es un borrador: el desglose se calcula al revisarlo. {p.viajes.length} viaje{p.viajes.length === 1 ? '' : 's'} cargado{p.viajes.length === 1 ? '' : 's'}.</p>}
            </div>

            {respaldo.length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <p style={{ fontSize: '.82rem', fontWeight: 700, color: 'var(--text)', marginBottom: '.3rem' }}>Archivos de respaldo</p>
                {respaldo.map((r, i) => (
                  <p key={i} style={{ fontSize: '.8rem' }}><a href={r.archivoUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--purple-light, var(--text))' }}>{r.tipo === 'google_maps' ? `Google Maps (viaje ${r.viaje})` : r.nombre}: {r.nombre}</a></p>
                ))}
              </div>
            )}

            {error && <p role="alert" style={{ fontSize: '.84rem', color: 'var(--red)', marginTop: '.8rem' }}>{error}</p>}
            {anulando !== null && (
              <div style={{ marginTop: '.9rem' }}>
                <label style={LABEL}>Motivo de la anulación *</label>
                <input className="input" style={{ minHeight: 44 }} value={anulando} onChange={e => setAnulando(e.target.value)} autoFocus />
                <div style={{ display: 'flex', gap: '.5rem', marginTop: '.5rem' }}>
                  <button className="btn btn-secondary" style={{ minHeight: 44 }} onClick={() => setAnulando(null)}>Cancelar</button>
                  <button className="btn btn-primary" style={{ minHeight: 44 }} disabled={ocupado || !anulando.trim()} onClick={() => accion(async () => { await api.post(`/api/presupuestos/${id}/anular`, { motivo: anulando }); setAnulando(null); })}>Anular presupuesto</button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginTop: '1.1rem' }}>
              {p.estado === 'BORRADOR' && <>
                <button className="btn btn-primary" style={{ minHeight: 44 }} onClick={() => onCorregir(id)}>Corregir y emitir</button>
                <button className="btn btn-secondary" style={{ minHeight: 44 }} disabled={ocupado} onClick={() => { if (window.confirm('¿Borrar este borrador?')) accion(async () => { await api.delete(`/api/presupuestos/${id}`); onCerrar(); }); }}>Borrar borrador</button>
              </>}
              {emitido && doc && <button className="btn btn-secondary" style={{ minHeight: 44 }} onClick={() => descargarPdf(doc)}><IconDownload size={16} /> PDF</button>}
              {emitido && p.plantillaUsada && <>
                <button className="btn btn-secondary" style={{ minHeight: 44 }} disabled={ocupado} onClick={() => accion(() => bajarDocx(id, p.numeroTexto || ''))}><IconDownload size={16} /> .docx</button>
                <button className="btn btn-secondary" style={{ minHeight: 44 }} disabled={ocupado} onClick={() => accion(() => bajarDocx(id, p.numeroTexto || '', true))} title="El formulario trae dos copias iguales: una para cada parte">.docx con duplicado</button>
              </>}
              {p.estado === 'EMITIDO' && <>
                <button className="btn btn-secondary" style={{ minHeight: 44 }} disabled={ocupado} onClick={() => accion(async () => { await api.post(`/api/presupuestos/${id}/respuesta`, { estado: 'ACEPTADO' }); })}>Marcar aceptado</button>
                <button className="btn btn-secondary" style={{ minHeight: 44 }} disabled={ocupado} onClick={() => accion(async () => { await api.post(`/api/presupuestos/${id}/respuesta`, { estado: 'RECHAZADO' }); })}>Marcar rechazado</button>
              </>}
              {emitido && p.estado !== 'ANULADO' && <button className="btn btn-secondary" style={{ minHeight: 44 }} onClick={() => setAnulando('')}>Anular</button>}
              {emitido && <button className="btn btn-secondary" style={{ minHeight: 44 }} disabled={ocupado} onClick={async () => { setOcupado(true); try { const nuevo = (await api.post(`/api/presupuestos/${id}/duplicar`)).data.id; onCambio(); onCorregir(nuevo); } catch (e) { setError(mensajeError(e, 'No se pudo duplicar.')); } setOcupado(false); }}>Generar otro a partir de este</button>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
