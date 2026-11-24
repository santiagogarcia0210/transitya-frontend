'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
import {
  CATEGORIA_UI, LABEL, mensajeError,
  type Categoria, type ObraSocial, type Requisito, type TipoVenc,
} from '@/lib/administrativo';

const CATEGORIAS: Categoria[] = ['paciente', 'prestador', 'mensual'];
const AYUDA: Record<Categoria, string> = {
  paciente: 'Lo que tiene que estar en la carpeta de cada paciente. Esto es lo que controla la Carpeta de pacientes.',
  prestador: 'Papeles de la empresa, los choferes y los vehículos que pide la obra social. Los vencimientos se siguen en Vencimientos.',
  mensual: 'Lo que se presenta todos los meses junto con la factura.',
};

const nuevoReq = (categoria: Categoria): Requisito => ({
  key: '', nombre: '', categoria, vencimiento: categoria === 'paciente' ? 'meses' : 'no',
  vigenciaMeses: 12, obligatorio: true, condicion: '', notas: '',
});

const vacia = (): ObraSocial => ({
  id: '', nombre: '', alias: [], notas: '', borrador: false,
  presentacion: { dia: 10, canal: '', notas: '' }, requisitos: [],
});

export default function RequisitosOSPage() {
  const authLoading = useRequireAdmin();
  const [obras, setObras] = useState<ObraSocial[]>([]);
  const [loading, setLoading] = useState(true);
  const [selId, setSelId] = useState<string>('');
  const [edit, setEdit] = useState<ObraSocial | null>(null);
  const [aliasTxt, setAliasTxt] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [sucio, setSucio] = useState(false);

  const mostrar = (o: ObraSocial | undefined) => {
    setSelId(o?.id || '');
    setEdit(o ? JSON.parse(JSON.stringify(o)) : null);
    setAliasTxt((o?.alias || []).join(', '));
    setSucio(false);
  };

  const aplicarLista = useCallback((lista: ObraSocial[], mantener?: string) => {
    setObras(lista);
    mostrar(lista.find(o => o.id === mantener) || lista[0]);
  }, []);

  const cargar = useCallback(async (mantener?: string) => {
    try { const r = await api.get('/api/requisitos-os'); aplicarLista(r.data.obras || [], mantener); } catch { /* silent */ }
  }, [aplicarLista]);

  useEffect(() => {
    if (authLoading) return;
    let vivo = true;
    api.get('/api/requisitos-os').then(r => { if (vivo) aplicarLista(r.data.obras || []); })
      .catch(() => {}).finally(() => { if (vivo) setLoading(false); });
    return () => { vivo = false; };
  }, [authLoading, aplicarLista]);

  const elegir = (id: string) => {
    if (sucio && !window.confirm('Tenés cambios sin guardar. ¿Descartarlos?')) return;
    setMsg(null);
    mostrar(obras.find(o => o.id === id));
  };

  const cargarBorrador = async () => {
    try { const r = await api.post('/api/requisitos-os/semilla'); setMsg({ text: r.data.mensaje, ok: true }); await cargar(); }
    catch (e) { setMsg({ text: mensajeError(e), ok: false }); }
  };

  const nueva = () => {
    if (sucio && !window.confirm('Tenés cambios sin guardar. ¿Descartarlos?')) return;
    setSelId(''); setEdit(vacia()); setAliasTxt(''); setSucio(true); setMsg(null);
  };

  const upd = (f: (o: ObraSocial) => void) => {
    setEdit(prev => { if (!prev) return prev; const c: ObraSocial = JSON.parse(JSON.stringify(prev)); f(c); return c; });
    setSucio(true);
  };
  const updReq = (i: number, campo: keyof Requisito, v: unknown) =>
    upd(o => { (o.requisitos[i] as unknown as Record<string, unknown>)[campo] = v; });

  const guardar = async () => {
    if (!edit) return;
    if (!edit.nombre.trim()) { setMsg({ text: 'Poné el nombre de la obra social.', ok: false }); return; }
    setGuardando(true); setMsg(null);
    const body = { ...edit, alias: aliasTxt.split(',').map(a => a.trim()).filter(Boolean), requisitos: edit.requisitos.filter(r => r.nombre.trim()) };
    try {
      if (edit.id) { await api.put(`/api/requisitos-os/${edit.id}`, body); await cargar(edit.id); }
      else { const r = await api.post('/api/requisitos-os', body); await cargar(r.data.id); }
      setMsg({ text: 'Guardado ✓', ok: true }); setSucio(false);
    } catch (e) { setMsg({ text: mensajeError(e, 'No se pudo guardar'), ok: false }); }
    setGuardando(false);
  };

  const eliminar = async () => {
    if (!edit?.id || !window.confirm(`¿Eliminar ${edit.nombre}? Las carpetas de sus pacientes quedan sin requisitos.`)) return;
    try { await api.delete(`/api/requisitos-os/${edit.id}`); setEdit(null); await cargar(); }
    catch (e) { setMsg({ text: mensajeError(e), ok: false }); }
  };

  if (authLoading) return null;

  return (
    <div>
      <div className="section-header">
        <div>
          <h2 className="section-title">📋 Requisitos por obra social</h2>
          <p style={{ fontSize: '.82rem', color: 'var(--text3)', marginTop: '.2rem' }}>
            Qué documentación pide cada obra social y cuánto dura. La <Link href="/dashboard/legajos" style={{ color: 'var(--text2)', textDecoration: 'underline' }}>Carpeta de pacientes</Link> se arma con esto.
          </p>
        </div>
        <button className="btn btn-primary" onClick={nueva}>+ Obra social</button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', color: 'var(--text3)', padding: '2rem' }}><span className="spinner" /> Cargando…</div>
      ) : obras.length === 0 && !edit ? (
        <div className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <p style={{ fontSize: '.95rem', color: 'var(--text)', fontWeight: 600 }}>Todavía no hay obras sociales configuradas</p>
          <p style={{ fontSize: '.82rem', color: 'var(--text3)', margin: '.5rem 0 1rem' }}>
            Hay un borrador listo con Incluir Salud, PAMI y OSPRERA. Cargalo y después corregí lo que no coincida con lo que te piden en la práctica.
          </p>
          <button className="btn btn-primary" onClick={cargarBorrador}>Cargar borrador</button>
          {msg && <p style={{ fontSize: '.82rem', color: msg.ok ? 'var(--green)' : 'var(--red)', marginTop: '.75rem' }}>{msg.text}</p>}
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '.35rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            {obras.map(o => (
              <button key={o.id} className={o.id === selId ? 'btn btn-primary' : 'btn btn-secondary'} style={{ fontSize: '.82rem' }} onClick={() => elegir(o.id)}>
                {o.nombre}{o.borrador && ' · borrador'}
              </button>
            ))}
            {!selId && edit && <button className="btn btn-primary" style={{ fontSize: '.82rem' }}>Nueva…</button>}
          </div>

          {edit && (
            <div className="card" style={{ padding: '1.25rem' }}>
              {edit.borrador && (
                <div style={{ background: 'var(--amber-dim)', border: '1px solid var(--amber)', borderRadius: 'var(--radius-lg)', padding: '.7rem .9rem', marginBottom: '1rem' }}>
                  <p style={{ fontSize: '.8rem', color: 'var(--amber)', fontWeight: 600 }}>Borrador: revisalo contra lo que te pide la obra social en la práctica.</p>
                  {edit.notas && <p style={{ fontSize: '.76rem', color: 'var(--text2)', marginTop: '.25rem' }}>{edit.notas}</p>}
                </div>
              )}

              <div className="form-grid form-grid-2">
                <div><label style={LABEL}>Nombre *</label>
                  <input className="input" value={edit.nombre} onChange={e => upd(o => { o.nombre = e.target.value; })} /></div>
                <div><label style={LABEL}>Cómo aparece en el Registro (separado por comas)</label>
                  <input className="input" value={aliasTxt} placeholder="Ej: PROFE, INCLUIR" onChange={e => { setAliasTxt(e.target.value); setSucio(true); }} /></div>
              </div>
              <div className="form-grid form-grid-2" style={{ marginTop: '.75rem' }}>
                <div><label style={LABEL}>Día límite de presentación mensual</label>
                  <input type="number" min={1} max={31} className="input" value={edit.presentacion.dia}
                    onChange={e => upd(o => { o.presentacion.dia = Number(e.target.value); })} /></div>
                <div><label style={LABEL}>Dónde / cómo se presenta</label>
                  <input className="input" value={edit.presentacion.canal} placeholder="Ej: UGP Tucumán, mail, portal…"
                    onChange={e => upd(o => { o.presentacion.canal = e.target.value; })} /></div>
              </div>
              <div style={{ marginTop: '.75rem' }}><label style={LABEL}>Notas de la presentación</label>
                <textarea className="input" rows={2} value={edit.presentacion.notas}
                  onChange={e => upd(o => { o.presentacion.notas = e.target.value; })} /></div>

              {CATEGORIAS.map(cat => (
                <div key={cat} style={{ marginTop: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={{ fontSize: '.92rem', fontWeight: 700, color: 'var(--text)' }}>{CATEGORIA_UI[cat]}</p>
                    <button className="btn btn-secondary" style={{ fontSize: '.75rem' }} onClick={() => upd(o => { o.requisitos.push(nuevoReq(cat)); })}>+ Agregar</button>
                  </div>
                  <p style={{ fontSize: '.74rem', color: 'var(--text3)', margin: '.2rem 0 .5rem' }}>{AYUDA[cat]}</p>
                  {edit.requisitos.map((r, i) => r.categoria !== cat ? null : (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: '.4rem', padding: '.6rem 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '.35rem' }}>
                        <input className="input" value={r.nombre} placeholder="Nombre del documento" onChange={e => updReq(i, 'nombre', e.target.value)} />
                        <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                          {cat !== 'mensual' && (
                            <select className="select" style={{ width: 'auto' }} value={r.vencimiento} onChange={e => updReq(i, 'vencimiento', e.target.value as TipoVenc)}>
                              <option value="no">No vence</option>
                              <option value="fecha_doc">Vence en la fecha del documento</option>
                              <option value="meses">Dura X meses desde que se emite</option>
                            </select>
                          )}
                          {r.vencimiento === 'meses' && cat !== 'mensual' && (
                            <input type="number" min={1} max={60} className="input" style={{ width: 80 }} value={r.vigenciaMeses}
                              onChange={e => updReq(i, 'vigenciaMeses', Number(e.target.value))} />
                          )}
                          <label style={{ fontSize: '.78rem', color: 'var(--text2)', display: 'flex', gap: '.3rem', alignItems: 'center' }}>
                            <input type="checkbox" checked={r.obligatorio} onChange={e => updReq(i, 'obligatorio', e.target.checked)} /> Obligatorio
                          </label>
                          {!r.obligatorio && (
                            <input className="input" style={{ flex: 1, minWidth: 160 }} value={r.condicion} placeholder="¿Cuándo corresponde?"
                              onChange={e => updReq(i, 'condicion', e.target.value)} />
                          )}
                        </div>
                        <input className="input" value={r.notas} placeholder="Notas / qué tiene que tener" style={{ fontSize: '.8rem' }}
                          onChange={e => updReq(i, 'notas', e.target.value)} />
                      </div>
                      <button className="btn btn-secondary" style={{ fontSize: '.72rem', padding: '.3rem .6rem', alignSelf: 'flex-start' }}
                        onClick={() => upd(o => { o.requisitos.splice(i, 1); })}>🗑</button>
                    </div>
                  ))}
                </div>
              ))}

              <div style={{ display: 'flex', gap: '.75rem', marginTop: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                {edit.borrador && (
                  <label style={{ fontSize: '.8rem', color: 'var(--text2)', display: 'flex', gap: '.35rem', alignItems: 'center' }}>
                    <input type="checkbox" checked={!edit.borrador} onChange={e => upd(o => { o.borrador = !e.target.checked; })} />
                    Ya lo revisé, sacar la marca de borrador
                  </label>
                )}
                <div style={{ flex: 1 }} />
                {edit.id && <button className="btn btn-danger" onClick={eliminar}>Eliminar</button>}
                <button className="btn btn-primary" onClick={guardar} disabled={guardando || !sucio}>
                  {guardando ? <><span className="spinner" style={{ width: 12, height: 12 }} />Guardando…</> : 'Guardar cambios'}
                </button>
              </div>
              {msg && <p style={{ fontSize: '.82rem', color: msg.ok ? 'var(--green)' : 'var(--red)', marginTop: '.75rem', textAlign: 'right' }}>{msg.text}</p>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
