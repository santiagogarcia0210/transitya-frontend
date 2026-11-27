'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { IconAlertTriangle, IconPlus, IconTrash } from '@tabler/icons-react';
import api from '@/lib/api';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
import { LABEL, OVERLAY, mensajeError } from '@/lib/administrativo';
import { pesos } from '@/lib/presupuesto';

interface Arancel {
  id: string; vigenteDesde: string; vigenteHasta?: string; valorKmTransporte: number; resolucion: string; fuente?: string; mes?: string;
  obraId: string | null; verificar?: boolean;
}
interface Estado { desactualizado: boolean; mensaje: string; diasDesde: number | null }
interface Obra { obraId: string; nombre: string }

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const mesDe = (iso: string) => { const m = iso.match(/^(\d{4})-(\d{2})/); return m ? `${MESES[Number(m[2]) - 1][0].toUpperCase()}${MESES[Number(m[2]) - 1].slice(1)} ${m[1]}` : ''; };
const primeroDeMes = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; };

export default function ArancelesPage() {
  const authLoading = useRequireAdmin();
  const [lista, setLista] = useState<Arancel[]>([]);
  const [estado, setEstado] = useState<Estado | null>(null);
  const [obras, setObras] = useState<Obra[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState<null | { desde: string; valor: string; resolucion: string; fuente: string; obraId: string; verificar: boolean }>(null);
  const [guardando, setGuardando] = useState(false);

  const pedir = useCallback(() => Promise.all([api.get('/api/aranceles'), api.get('/api/presupuestos/config')]).then(([a, c]) => {
    setLista(a.data.aranceles || []); setEstado(a.data.estado || null); setObras((c.data.obras || []).map((o: Obra) => ({ obraId: o.obraId, nombre: o.nombre })));
  }).catch(e => setError(mensajeError(e, 'No se pudieron cargar los aranceles.'))).finally(() => setCargando(false)), []);
  const cargar = pedir;
  useEffect(() => { if (authLoading) return; pedir(); }, [authLoading, pedir]);

  const nombreObra = (id: string | null) => (id ? obras.find(o => o.obraId === id)?.nombre || id : 'Nomenclador (todas)');

  const guardar = async () => {
    if (!form) return;
    setGuardando(true); setError('');
    try {
      await api.post('/api/aranceles', {
        vigenteDesde: form.desde, valorKmTransporte: form.valor.replace(/\./g, '').replace(',', '.'), resolucion: form.resolucion, fuente: form.fuente,
        mes: mesDe(form.desde), obraId: form.obraId || null, verificar: form.verificar,
      });
      setForm(null); await cargar();
    } catch (e) { setError(mensajeError(e, 'No se pudo guardar.')); }
    setGuardando(false);
  };
  const sembrar = async () => { try { await api.post('/api/aranceles/sembrar'); await cargar(); } catch (e) { setError(mensajeError(e, 'No se pudo cargar el valor inicial.')); } };
  const borrar = async (id: string) => {
    if (!window.confirm('¿Borrar este valor? Los presupuestos ya emitidos conservan el que usaron.')) return;
    try { await api.delete(`/api/aranceles/${id}`); await cargar(); } catch (e) { setError(mensajeError(e, 'No se pudo borrar.')); }
  };

  if (authLoading) return null;
  return (
    <div>
      <div className="section-header">
        <div>
          <h2 className="section-title">Valor del km (arancel del nomenclador)</h2>
          <p style={{ fontSize: '.82rem', color: 'var(--text3)', marginTop: '.2rem' }}>Se carga una vez por mes. Cada presupuesto usa el valor que rige a su fecha.</p>
        </div>
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
          <Link className="btn btn-secondary" style={{ minHeight: 44 }} href="/dashboard/presupuestos">Presupuestos</Link>
          <button className="btn btn-primary" style={{ minHeight: 44 }} onClick={() => { setError(''); setForm({ desde: primeroDeMes(), valor: '', resolucion: '', fuente: '', obraId: '', verificar: false }); }}>
            <IconPlus size={16} /> Cargar valor
          </button>
        </div>
      </div>

      {estado?.desactualizado && (
        <div role="alert" className="card" style={{ padding: '.8rem 1rem', marginBottom: '1rem', borderColor: 'var(--amber)', display: 'flex', gap: '.6rem', alignItems: 'center' }}>
          <IconAlertTriangle size={18} color="var(--amber)" /><p style={{ fontSize: '.85rem', color: 'var(--text)' }}>{estado.mensaje}</p>
        </div>
      )}
      {error && !form && <p role="alert" style={{ color: 'var(--red)', fontSize: '.85rem', marginBottom: '.75rem' }}>{error}</p>}

      {cargando ? <div style={{ color: 'var(--text3)', padding: '2rem' }}><span className="spinner" /> Cargando…</div> : lista.length === 0 ? (
        <div className="card" style={{ padding: '1.25rem' }}>
          <p style={{ fontSize: '.9rem', color: 'var(--text)', marginBottom: '.4rem' }}>Todavía no hay un valor del km cargado.</p>
          <p style={{ fontSize: '.8rem', color: 'var(--text3)', marginBottom: '.9rem' }}>Podés cargar el de noviembre 2026 (Resolución 3715/2026 de la Secretaría Nacional de Discapacidad, transporte $953,22 por km). Es un dato de prensa: queda marcado para verificarlo contra el Boletín Oficial.</p>
          <button className="btn btn-primary" style={{ minHeight: 44 }} onClick={sembrar}>Cargar el valor de noviembre 2026</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
          {lista.map(a => (
            <div key={a.id} className="card" style={{ padding: '.75rem 1rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                <p style={{ fontSize: '.95rem', fontWeight: 700, color: 'var(--text)' }}>{pesos(a.valorKmTransporte)} <span style={{ fontWeight: 400, fontSize: '.78rem', color: 'var(--text3)' }}>por km</span></p>
                <p style={{ fontSize: '.76rem', color: 'var(--text3)', overflowWrap: 'anywhere' }}>{a.resolucion}{a.fuente ? ` · ${a.fuente}` : ''}</p>
              </div>
              <div style={{ fontSize: '.78rem', color: 'var(--text2)' }}>
                <p>{a.mes || 'Desde'} · {a.vigenteDesde}{a.vigenteHasta ? ` a ${a.vigenteHasta}` : ' (vigente)'}</p>
                <p style={{ color: 'var(--text3)' }}>{nombreObra(a.obraId)}</p>
              </div>
              {a.verificar && <span className="badge badge-amber">Verificar contra Boletín Oficial</span>}
              <button className="btn btn-secondary" style={{ minWidth: 44, minHeight: 44 }} onClick={() => borrar(a.id)} aria-label="Borrar este valor"><IconTrash size={16} /></button>
            </div>
          ))}
        </div>
      )}

      {form && (
        <div style={{ ...OVERLAY, zIndex: 60 }} onClick={e => { if (e.target === e.currentTarget) setForm(null); }}>
          <div className="card" role="dialog" aria-label="Cargar valor del km" style={{ width: '100%', maxWidth: 480, padding: '1.25rem', maxHeight: '92vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', marginBottom: '.9rem' }}>Cargar valor del km</h3>
            <div className="form-grid">
              <div><label style={LABEL}>Rige desde *</label><input type="date" className="input" style={{ minHeight: 44 }} value={form.desde} onChange={e => setForm({ ...form, desde: e.target.value })} /></div>
              <div><label style={LABEL}>Valor del km ($) *</label><input className="input" inputMode="decimal" style={{ minHeight: 44 }} value={form.valor} placeholder="Ej: 953,22" onChange={e => setForm({ ...form, valor: e.target.value })} /></div>
              <div><label style={LABEL}>Resolución *</label><input className="input" style={{ minHeight: 44 }} value={form.resolucion} placeholder="Ej: Resolución 3715/2026" onChange={e => setForm({ ...form, resolucion: e.target.value })} /></div>
              <div><label style={LABEL}>Fuente</label><input className="input" style={{ minHeight: 44 }} value={form.fuente} placeholder="Boletín Oficial, prensa…" onChange={e => setForm({ ...form, fuente: e.target.value })} /></div>
              <div><label style={LABEL}>Obra social</label>
                <select className="select" style={{ minHeight: 44 }} value={form.obraId} onChange={e => setForm({ ...form, obraId: e.target.value })}>
                  <option value="">Nomenclador (todas las obras sociales)</option>
                  {obras.map(o => <option key={o.obraId} value={o.obraId}>Solo {o.nombre}</option>)}
                </select>
                <p style={{ fontSize: '.7rem', color: 'var(--text3)', marginTop: '.2rem' }}>PAMI y otras pueden no usar el nomenclador: cargales su propio valor.</p>
              </div>
              <label style={{ display: 'flex', gap: '.5rem', alignItems: 'center', minHeight: 44, fontSize: '.82rem', color: 'var(--text)' }}>
                <input type="checkbox" style={{ width: 20, height: 20 }} checked={form.verificar} onChange={e => setForm({ ...form, verificar: e.target.checked })} /> Marcar para verificar contra el Boletín Oficial
              </label>
            </div>
            {form.valor && Number.isFinite(Number(form.valor.replace(/\./g, '').replace(',', '.'))) && <p style={{ fontSize: '.74rem', color: 'var(--text3)', marginTop: '.5rem' }}>Se guardará como {pesos(Number(form.valor.replace(/\./g, '').replace(',', '.')))}.</p>}
            {error && <p role="alert" style={{ fontSize: '.82rem', color: 'var(--red)', marginTop: '.6rem' }}>{error}</p>}
            <div style={{ display: 'flex', gap: '.6rem', marginTop: '1.1rem' }}>
              <button className="btn btn-secondary" style={{ flex: 1, minHeight: 44 }} onClick={() => setForm(null)}>Cancelar</button>
              <button className="btn btn-primary" style={{ flex: 1, minHeight: 44 }} onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
