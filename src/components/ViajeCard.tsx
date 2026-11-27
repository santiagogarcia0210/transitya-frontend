'use client';
import { useRef, useState } from 'react';
import { IconAlertTriangle, IconMap2, IconTrash, IconUpload } from '@tabler/icons-react';
import api from '@/lib/api';
import { LABEL, mensajeError } from '@/lib/administrativo';
import { ErrorArchivo, prepararArchivo } from '@/lib/lecturaIA';
import {
  DIAS, MODALIDADES, aplicarLecturas, fmt, faltantesViaje, parseKm,
  type LecturaRecorrido, type Modalidad, type ViajeEditable,
} from '@/lib/presupuesto';

const AMBAR: React.CSSProperties = { borderColor: 'var(--amber)', background: 'var(--amber-dim)' };

/**
 * Un viaje del presupuesto: origen, destino, días y el recuadro "Recorrido de Google Maps". La impresión se lee con IA
 * (origen, destino, km, tiempo y ruta elegida), pero los km finales siempre quedan en un recuadro editable.
 */
export default function ViajeCard({ viaje: v, beneficiarioId, otrasLecturas, onCambio, onQuitar, puedeQuitar }: {
  viaje: ViajeEditable; beneficiarioId: string; otrasLecturas: LecturaRecorrido[]; onCambio: (v: ViajeEditable) => void; onQuitar: () => void; puedeQuitar: boolean;
}) {
  const [leyendo, setLeyendo] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const cupo = v.modalidad === 'dos_recorridos' ? 2 : 1;
  const falta = faltantesViaje(v);

  const set = (c: Partial<ViajeEditable>) => onCambio({ ...v, ...c });
  const conLecturas = (lecturas: LecturaRecorrido[], extra: Partial<ViajeEditable> = {}) => onCambio(aplicarLecturas({ ...v, ...extra, lecturas, confirmadoManual: false }));

  const cambiarModalidad = (m: Modalidad) => {
    const lecturas = v.lecturas.slice(0, m === 'dos_recorridos' ? 2 : 1);
    onCambio(aplicarLecturas({ ...v, modalidad: m, lecturas }));
  };

  const leer = async (file: File | undefined) => {
    if (!file) return;
    setLeyendo(true); setError('');
    try {
      const prep = await prepararArchivo(file);
      const r = (await api.post('/api/presupuestos/leer-recorrido', { beneficiarioId, centro: v.centro || v.destino, archivo: prep })).data;
      const lectura: LecturaRecorrido = { hash: r.hash, archivoUrl: r.archivoUrl, archivoNombre: r.archivoNombre, propuesta: r.propuesta, verificacion: r.verificacion, rutaElegida: r.propuesta.rutaElegida };
      const lecturas = cupo === 2 ? [...v.lecturas.filter(l => l.hash !== lectura.hash), lectura].slice(0, 2) : [lectura];
      conLecturas(lecturas, { origen: v.origen || r.propuesta.origen.texto || '', destino: v.destino || r.propuesta.destino.texto || '' });
    } catch (e) { setError(e instanceof ErrorArchivo ? e.message : mensajeError(e, 'No se pudo leer el recorrido. Cargá los km a mano.')); }
    setLeyendo(false);
    if (input.current) input.current.value = '';
  };

  const elegirRuta = (i: number, ruta: number) => conLecturas(v.lecturas.map((l, k) => (k === i ? { ...l, rutaElegida: ruta } : l)));
  const quitar = (i: number) => conLecturas(v.lecturas.filter((_, k) => k !== i));
  const sugerida = v.lecturas[0]?.propuesta.legible ? v.lecturas[0].propuesta.modalidadSugerida : null;
  const rotulo = (i: number) => (v.modalidad === 'dos_recorridos' ? (i === 0 ? 'Ida' : 'Vuelta') : 'Recorrido');
  const kmChip = v.kmOrigen === 'impresion' ? 'Leído de la impresión de Google Maps' : 'Cargado a mano';
  const confGeneral = v.lecturas.length ? (v.lecturas.some(l => l.propuesta.confianzaGeneral === 'baja') ? 'baja' : v.lecturas.some(l => l.propuesta.confianzaGeneral === 'media') ? 'media' : 'alta') : null;

  return (
    <section className="card" style={{ padding: '1rem' }} aria-label={`Viaje ${v.id}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.7rem' }}>
        <p style={{ fontSize: '.95rem', fontWeight: 700, color: 'var(--text)' }}>Viaje {v.id}</p>
        {puedeQuitar && <button className="btn btn-secondary" style={{ minHeight: 44, minWidth: 44 }} onClick={onQuitar} aria-label={`Quitar el viaje ${v.id}`}><IconTrash size={16} /></button>}
      </div>

      <div className="form-grid form-grid-2">
        <div><label style={LABEL}>Domicilio de partida *</label><input className="input" style={{ minHeight: 44 }} value={v.origen} onChange={e => set({ origen: e.target.value })} /></div>
        <div><label style={LABEL}>Domicilio de destino *</label><input className="input" style={{ minHeight: 44 }} value={v.destino} onChange={e => set({ destino: e.target.value })} /></div>
        <div><label style={LABEL}>Centro / institución (para comprobar el recorrido)</label><input className="input" style={{ minHeight: 44 }} value={v.centro} placeholder="Opcional" onChange={e => set({ centro: e.target.value })} /></div>
      </div>

      <div style={{ marginTop: '.8rem' }}>
        <label style={LABEL}>Días de traslado *</label>
        <div style={{ display: 'flex', gap: '.35rem', flexWrap: 'wrap' }}>
          {DIAS.map(d => {
            const on = v.dias.includes(d.k);
            return <button key={d.k} type="button" aria-pressed={on} className={on ? 'btn btn-primary' : 'btn btn-secondary'} style={{ minHeight: 44, minWidth: 48, fontSize: '.8rem' }}
              onClick={() => set({ dias: on ? v.dias.filter(x => x !== d.k) : [...v.dias, d.k] })}>{d.label.slice(0, 3)}</button>;
          })}
        </div>
      </div>

      <fieldset style={{ marginTop: '1rem', padding: '.85rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg4)' }}>
        <legend style={{ fontSize: '.82rem', fontWeight: 700, color: 'var(--text)', padding: '0 .35rem', display: 'flex', gap: '.35rem', alignItems: 'center' }}><IconMap2 size={15} /> Recorrido de Google Maps</legend>
        <p style={{ fontSize: '.78rem', color: 'var(--text2)', marginBottom: '.5rem' }}>Los km del recorrido son…</p>
        <div role="radiogroup" aria-label="Los km del recorrido son" style={{ display: 'flex', flexDirection: 'column', gap: '.15rem' }}>
          {MODALIDADES.map(m => (
            <label key={m.k} style={{ display: 'flex', gap: '.55rem', alignItems: 'flex-start', minHeight: 44, cursor: 'pointer', fontSize: '.84rem', color: 'var(--text)' }}>
              <input type="radio" name={`mod-${v.id}`} checked={v.modalidad === m.k} onChange={() => cambiarModalidad(m.k)} style={{ width: 20, height: 20, marginTop: 10, flexShrink: 0 }} />
              <span style={{ paddingTop: 10 }}>{m.label}<span style={{ display: 'block', fontSize: '.72rem', color: 'var(--text3)' }}>{m.ayuda}</span></span>
            </label>
          ))}
        </div>
        {sugerida && sugerida !== v.modalidad && (
          <p style={{ fontSize: '.76rem', color: 'var(--text2)', margin: '.4rem 0' }}>
            Por la impresión, la IA propone “{MODALIDADES.find(m => m.k === sugerida)?.label}”.{' '}
            <button type="button" className="btn btn-secondary" style={{ minHeight: 44, fontSize: '.74rem' }} onClick={() => cambiarModalidad(sugerida)}>Usar esa</button>
          </p>
        )}

        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', alignItems: 'center', margin: '.6rem 0' }}>
          {v.lecturas.length < cupo && (
            <button className="btn btn-secondary" style={{ minHeight: 44 }} onClick={() => input.current?.click()} disabled={leyendo}>
              {leyendo ? <><span className="spinner" style={{ width: 12, height: 12 }} /> Leyendo…</> : <><IconUpload size={16} /> {cupo === 2 ? `Subir impresión de la ${v.lecturas.length === 0 ? 'ida' : 'vuelta'}` : 'Subir impresión de Google Maps'}</>}
            </button>
          )}
          {otrasLecturas.length > 0 && v.lecturas.length < cupo && (
            <select className="select" style={{ minHeight: 44, maxWidth: 260 }} value="" aria-label="Usar una impresión ya subida en otro viaje"
              onChange={e => { const l = otrasLecturas.find(x => x.hash === e.target.value); if (l) conLecturas(cupo === 2 ? [...v.lecturas, l].slice(0, 2) : [l]); }}>
              <option value="">Usar una impresión ya subida…</option>
              {otrasLecturas.map(l => <option key={l.hash} value={l.hash}>{l.archivoNombre} · {fmt(l.propuesta.rutas[l.rutaElegida ?? 0]?.km)} km</option>)}
            </select>
          )}
          <input ref={input} type="file" hidden accept="image/*,application/pdf" onChange={e => leer(e.target.files?.[0])} />
        </div>
        {error && <p role="alert" style={{ fontSize: '.8rem', color: 'var(--red)', marginBottom: '.5rem' }}>{error}</p>}

        {v.lecturas.map((l, i) => (
          <div key={l.hash} style={{ padding: '.65rem .75rem', borderRadius: 8, border: `1px solid ${l.verificacion.coincide === false ? 'var(--red)' : 'var(--border)'}`, marginBottom: '.5rem', background: 'var(--bg3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.5rem', alignItems: 'center' }}>
              <a href={l.archivoUrl} target="_blank" rel="noreferrer" style={{ fontSize: '.8rem', color: 'var(--purple-light, var(--text))', overflowWrap: 'anywhere' }}>{rotulo(i)}: {l.archivoNombre}</a>
              <button className="btn btn-secondary" style={{ minHeight: 44, minWidth: 44 }} onClick={() => quitar(i)} aria-label="Quitar esta impresión"><IconTrash size={14} /></button>
            </div>
            {!l.propuesta.legible ? <p style={{ fontSize: '.78rem', color: 'var(--amber)' }}>{l.propuesta.advertencias[0]}</p> : (
              <>
                <p style={{ fontSize: '.76rem', color: 'var(--text3)', margin: '.2rem 0' }}>{l.propuesta.origen.texto} &gt; {l.propuesta.destino.texto}</p>
                {l.propuesta.requiereElegir && <p style={{ fontSize: '.78rem', color: 'var(--amber)', fontWeight: 600 }}>Hay varias rutas y no se sabe cuál está elegida: marcá la correcta.</p>}
                <div role="radiogroup" aria-label="Ruta elegida">
                  {l.propuesta.rutas.map((r, k) => (
                    <label key={k} style={{ display: 'flex', gap: '.5rem', alignItems: 'center', minHeight: 44, fontSize: '.84rem', color: 'var(--text)', cursor: 'pointer' }}>
                      <input type="radio" name={`ruta-${v.id}-${i}`} checked={l.rutaElegida === k} onChange={() => elegirRuta(i, k)} style={{ width: 20, height: 20 }} />
                      {fmt(r.km)} km{r.tiempo ? ` · ${r.tiempo}` : ''}{r.confianza !== 'alta' && <span style={{ fontSize: '.7rem', color: r.confianza === 'baja' ? 'var(--amber)' : 'var(--text3)' }}> · {r.confianza === 'baja' ? 'poco seguro' : 'revisalo'}</span>}
                    </label>
                  ))}
                </div>
                {[...l.propuesta.advertencias, ...l.verificacion.advertencias].map(a => (
                  <p key={a} style={{ fontSize: '.76rem', color: 'var(--amber)', display: 'flex', gap: '.35rem', alignItems: 'flex-start', marginTop: '.2rem' }}><IconAlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />{a}</p>
                ))}
              </>
            )}
          </div>
        ))}
        {v.lecturas.some(l => l.verificacion.coincide === false) && (
          <label style={{ display: 'flex', gap: '.5rem', alignItems: 'center', minHeight: 44, fontSize: '.8rem', color: 'var(--text)', cursor: 'pointer' }}>
            <input type="checkbox" style={{ width: 20, height: 20 }} checked={v.confirmadoManual} onChange={e => set({ confirmadoManual: e.target.checked })} />
            El recorrido no coincide con el domicilio del paciente o el centro, pero es correcto: lo confirmo
          </label>
        )}
      </fieldset>

      <div style={{ marginTop: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.5rem', flexWrap: 'wrap' }}>
          <label style={LABEL}>Km finales del viaje *</label>
          <span style={{ fontSize: '.7rem', fontWeight: 600, color: confGeneral === 'baja' ? 'var(--amber)' : 'var(--text3)' }}>{kmChip}{confGeneral && confGeneral !== 'alta' ? ` · confianza ${confGeneral}` : ''}</span>
        </div>
        {v.modalidad === 'dos_recorridos' ? (
          <div className="form-grid form-grid-2">
            <div><label style={LABEL}>Km de la ida</label><input className="input" inputMode="decimal" style={{ minHeight: 44, ...(confGeneral === 'baja' ? AMBAR : {}) }} value={v.kmIdaTexto} onChange={e => set({ kmIdaTexto: e.target.value, kmOrigen: 'manual' })} /></div>
            <div><label style={LABEL}>Km de la vuelta</label><input className="input" inputMode="decimal" style={{ minHeight: 44, ...(confGeneral === 'baja' ? AMBAR : {}) }} value={v.kmVueltaTexto} onChange={e => set({ kmVueltaTexto: e.target.value, kmOrigen: 'manual' })} /></div>
          </div>
        ) : (
          <>
            <input className="input" inputMode="decimal" style={{ minHeight: 44, ...(confGeneral === 'baja' ? AMBAR : {}) }} value={v.kmTexto} placeholder="Ej: 12,4  ·  o una suma de tramos: 2,9 + 5,7" onChange={e => set({ kmTexto: e.target.value, kmOrigen: 'manual' })} />
            {v.modalidad === 'solo_ida' && (
              <label style={{ display: 'flex', gap: '.5rem', alignItems: 'center', minHeight: 44, fontSize: '.8rem', color: 'var(--text2)', cursor: 'pointer' }}>
                <input type="checkbox" style={{ width: 20, height: 20 }} checked={v.incluyeVuelta} onChange={e => set({ incluyeVuelta: e.target.checked })} />
                Este viaje incluye la vuelta por el mismo camino (se duplican los km)
              </label>
            )}
          </>
        )}
        {v.kmTexto && !v.kmTexto.includes('+') && !Number.isFinite(parseKm(v.kmTexto)) && <p style={{ fontSize: '.76rem', color: 'var(--red)' }}>Escribí un número, por ejemplo 12,4.</p>}
      </div>
      {falta.length > 0 && <p style={{ fontSize: '.74rem', color: 'var(--text3)', marginTop: '.5rem' }}>Falta: {falta.join(', ')}.</p>}
    </section>
  );
}
