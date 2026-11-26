'use client';
import { useRef, useState } from 'react';
import { IconAlertTriangle, IconCamera, IconCheck, IconFileTypePdf, IconLock, IconPhoto, IconX } from '@tabler/icons-react';
import CamposClinicos from '@/components/CamposClinicos';
import api from '@/lib/api';
import { LABEL, OVERLAY, mensajeError, type Requisito } from '@/lib/administrativo';
import {
  ErrorArchivo, TITULO_DOC_CLINICO, esBaja, etiquetaConfianza, itemConfirmar, prepararArchivo, propuestaDe, puedeConfirmar, separarResultados,
  type Confianza, type LecturaError, type LecturaOk, type Propuesta,
} from '@/lib/lecturaIA';

const MAX_ARCHIVOS = 12;

type Fase = 'elegir' | 'leyendo' | 'revisar';

/** Marca un dato dudoso: ámbar si la IA no estaba segura, para que el ojo vaya ahí primero. */
const ESTILO_DUDOSO: React.CSSProperties = { borderColor: 'var(--amber)', background: 'var(--amber-dim)' };

function Dato({ etiqueta, confianza, children, nota }: { etiqueta: string; confianza?: Confianza; children: React.ReactNode; nota?: string }) {
  return (
    <div>
      <label style={{ ...LABEL, display: 'flex', justifyContent: 'space-between', gap: '.5rem' }}>
        <span>{etiqueta}</span>
        {confianza && confianza !== 'alta' && (
          <span style={{ color: esBaja(confianza) ? 'var(--amber)' : 'var(--text3)', fontWeight: 600 }}>{etiquetaConfianza(confianza)}</span>
        )}
      </label>
      {children}
      {nota && <p style={{ fontSize: '.7rem', color: 'var(--text3)', marginTop: '.2rem' }}>{nota}</p>}
    </div>
  );
}

function Miniatura({ l }: { l: LecturaOk }) {
  const esPdf = /\.pdf$/i.test(l.archivoNombre);
  return (
    <a href={l.archivoUrl} target="_blank" rel="noreferrer" aria-label={`Ver ${l.nombreArchivo}`}
      style={{ width: 88, height: 112, flexShrink: 0, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--bg4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {esPdf
        ? <IconFileTypePdf size={36} color="var(--text3)" />
        // eslint-disable-next-line @next/next/no-img-element
        : <img src={l.archivoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
    </a>
  );
}

function TarjetaPropuesta({ p, requisitos, onCambio, onConfirmar, onDescartar, bloqueada }: {
  p: Propuesta; requisitos: Requisito[]; onCambio: (c: Partial<Propuesta>) => void;
  onConfirmar: () => void; onDescartar: () => void; bloqueada: boolean;
}) {
  const l = p.lectura;
  const req = requisitos.find(r => r.key === p.requisitoKey) || null;
  const cerrada = p.estado === 'guardada' || p.estado === 'descartada';
  const esPresupuesto = p.requisitoKey === 'presupuesto' || !!l.presupuesto;
  const dudoso = (c?: Confianza) => (esBaja(c) ? ESTILO_DUDOSO : undefined);

  return (
    <div className="card" style={{ padding: '1rem', opacity: cerrada ? 0.6 : 1, borderColor: l.posiblePacienteEquivocado ? 'var(--red)' : undefined }}>
      <div style={{ display: 'flex', gap: '.85rem', alignItems: 'flex-start' }}>
        <Miniatura l={l} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '.8rem', color: 'var(--text3)', overflowWrap: 'anywhere' }}>{l.nombreArchivo}</p>
          <p style={{ fontSize: '.95rem', fontWeight: 700, color: 'var(--text)', marginTop: '.1rem' }}>
            {req?.nombre || l.tipoSugerido || 'Documento sin clasificar'}
          </p>
          {p.estado === 'guardada' && <p style={{ fontSize: '.78rem', color: 'var(--green)', marginTop: '.25rem' }}><IconCheck size={14} style={{ verticalAlign: '-2px' }} /> {p.mensaje || 'Guardado en la carpeta'}</p>}
          {p.estado === 'descartada' && <p style={{ fontSize: '.78rem', color: 'var(--text3)', marginTop: '.25rem' }}>Descartado (no se guardó nada)</p>}
        </div>
      </div>

      {!cerrada && (
        <>
          {l.posiblePacienteEquivocado && (
            <div role="alert" style={{ marginTop: '.85rem', padding: '.7rem .85rem', borderRadius: 8, border: '1px solid var(--red)', background: 'rgba(239,68,68,.1)' }}>
              <p style={{ fontSize: '.84rem', color: 'var(--text)', fontWeight: 600, display: 'flex', gap: '.4rem', alignItems: 'center' }}>
                <IconAlertTriangle size={16} color="var(--red)" /> Parece ser de otra persona
              </p>
              <p style={{ fontSize: '.78rem', color: 'var(--text2)', marginTop: '.25rem' }}>
                El documento dice {l.paciente.nombre ? <b>{l.paciente.nombre}</b> : 'otro nombre'}{l.paciente.dni && <> (DNI {l.paciente.dni})</>}, y no coincide con esta carpeta.
              </p>
              <label style={{ display: 'flex', gap: '.5rem', alignItems: 'center', marginTop: '.5rem', fontSize: '.8rem', color: 'var(--text)', minHeight: 44, cursor: 'pointer' }}>
                <input type="checkbox" checked={p.aceptarPacienteDistinto} onChange={e => onCambio({ aceptarPacienteDistinto: e.target.checked })} style={{ width: 20, height: 20 }} />
                Es de este paciente, guardarlo igual
              </label>
            </div>
          )}
          {!l.posiblePacienteEquivocado && l.coincidePaciente === null && (
            <p style={{ fontSize: '.76rem', color: 'var(--text3)', marginTop: '.7rem' }}>No se pudo comprobar de quién es el documento (no se leyó el nombre ni el DNI). Revisalo a ojo.</p>
          )}
          {l.advertencias.map(a => (
            <p key={a} style={{ fontSize: '.76rem', color: 'var(--amber)', marginTop: '.5rem' }}>{a}</p>
          ))}

          <div className="form-grid" style={{ marginTop: '.85rem' }}>
            <Dato etiqueta="Tipo de documento" confianza={l.confianza.tipo}>
              <select className="select" style={{ minHeight: 44, ...dudoso(l.confianza.tipo) }} value={p.requisitoKey} onChange={e => onCambio({ requisitoKey: e.target.value })}>
                {requisitos.map(r => <option key={r.key} value={r.key}>{r.nombre}</option>)}
                <option value="otro">Otro documento</option>
              </select>
            </Dato>
            {p.requisitoKey === 'otro' && (
              <Dato etiqueta="Nombre del documento *">
                <input className="input" style={{ minHeight: 44 }} value={p.nombre} onChange={e => onCambio({ nombre: e.target.value })} />
              </Dato>
            )}
            <div className="form-grid form-grid-2">
              <Dato etiqueta="Fecha de emisión" confianza={p.fechaEmision ? l.confianza.fechaEmision : 'baja'}>
                <input type="date" className="input" style={{ minHeight: 44, ...dudoso(p.fechaEmision ? l.confianza.fechaEmision : 'baja') }} value={p.fechaEmision} onChange={e => onCambio({ fechaEmision: e.target.value })} />
              </Dato>
              {(!req || req.vencimiento !== 'no') && (
                <Dato etiqueta={`Vence${req?.vencimiento === 'fecha_doc' ? ' *' : ''}`} confianza={p.fechaVenc ? l.confianza.fechaVenc : undefined}
                  nota={l.fechaVencCalculada && p.fechaVenc ? `Calculado: ${req?.vigenciaMeses} mes(es) desde la emisión, no figura en el papel` : undefined}>
                  <input type="date" className="input" style={{ minHeight: 44, ...dudoso(p.fechaVenc ? l.confianza.fechaVenc : undefined) }} value={p.fechaVenc} onChange={e => onCambio({ fechaVenc: e.target.value })} />
                </Dato>
              )}
            </div>
            {esPresupuesto && (
              <div className="form-grid form-grid-2">
                <Dato etiqueta="Importe ($)" confianza={l.presupuesto?.confianza.importe}>
                  <input className="input" inputMode="decimal" style={{ minHeight: 44, ...dudoso(l.presupuesto?.confianza.importe) }} value={p.importe} onChange={e => onCambio({ importe: e.target.value })} />
                </Dato>
                <Dato etiqueta="Validez" confianza={l.presupuesto?.confianza.validez}>
                  <input className="input" style={{ minHeight: 44, ...dudoso(l.presupuesto?.confianza.validez) }} value={p.validez} onChange={e => onCambio({ validez: e.target.value })} />
                </Dato>
                <div style={{ gridColumn: '1 / -1' }}>
                  <Dato etiqueta="Concepto" confianza={l.presupuesto?.confianza.concepto}>
                    <input className="input" style={{ minHeight: 44, ...dudoso(l.presupuesto?.confianza.concepto) }} value={p.concepto} onChange={e => onCambio({ concepto: e.target.value })} />
                  </Dato>
                </div>
              </div>
            )}
            <Dato etiqueta="Notas">
              <input className="input" style={{ minHeight: 44 }} value={p.notas} placeholder="Opcional…" onChange={e => onCambio({ notas: e.target.value })} />
            </Dato>
          </div>

          {p.clinico && (
            <div style={{ marginTop: '.9rem', padding: '.85rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg4)' }}>
              <p style={{ fontSize: '.84rem', fontWeight: 700, color: 'var(--text)', display: 'flex', gap: '.4rem', alignItems: 'center' }}>
                <IconLock size={16} /> Datos clínicos · {TITULO_DOC_CLINICO[p.clinico.documento]}
              </p>
              <p style={{ fontSize: '.74rem', color: 'var(--text3)', margin: '.2rem 0 .75rem' }}>
                Son datos de salud: solo los ve administración y queda registrado quién los consulta. Se guardan recién al confirmar.
              </p>
              {p.clinico.advertencias.map(a => <p key={a} style={{ fontSize: '.76rem', color: 'var(--amber)', marginBottom: '.4rem' }}>{a}</p>)}
              <CamposClinicos valor={p.clinico} onCambio={c => onCambio({ clinico: c })} />
            </div>
          )}
          {l.clinicoOmitido && !p.clinico && (
            <p style={{ fontSize: '.76rem', color: 'var(--text3)', marginTop: '.7rem' }}>
              Este archivo ya se había leído: sus datos clínicos no se muestran de nuevo. Se ven y se corrigen en la ficha clínica de la carpeta.
            </p>
          )}
          {p.estado === 'error' && <p style={{ fontSize: '.8rem', color: 'var(--red)', marginTop: '.6rem' }}>{p.mensaje}</p>}
          <div style={{ display: 'flex', gap: '.6rem', marginTop: '.9rem' }}>
            <button className="btn btn-secondary" style={{ flex: 1, minHeight: 44 }} onClick={onDescartar} disabled={bloqueada}>Descartar</button>
            <button className="btn btn-primary" style={{ flex: 1, minHeight: 44 }} onClick={onConfirmar} disabled={bloqueada || !puedeConfirmar(p)}>
              {p.estado === 'guardando' ? <><span className="spinner" style={{ width: 12, height: 12 }} />Guardando…</> : 'Confirmar este'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Cargar documentos de un paciente con fotos o PDF: la IA los lee y propone; nada se guarda hasta que el
 * administrativo revisa y confirma.
 */
export default function LecturaIA({ beneficiarioId, beneficiarioNombre, requisitos, onCerrar, onGuardado }: {
  beneficiarioId: string; beneficiarioNombre: string; requisitos: Requisito[];
  onCerrar: () => void; onGuardado: () => void;
}) {
  const [fase, setFase] = useState<Fase>('elegir');
  const [progreso, setProgreso] = useState('');
  const [aviso, setAviso] = useState('');                       // errores generales (sin clave, límite…)
  const [fallidos, setFallidos] = useState<{ nombre: string; mensaje: string }[]>([]);
  const [propuestas, setPropuestas] = useState<Propuesta[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [huboGuardado, setHuboGuardado] = useState(false);
  const inputArchivos = useRef<HTMLInputElement>(null);
  const inputCamara = useRef<HTMLInputElement>(null);

  const cambiar = (clave: string, c: Partial<Propuesta>) => setPropuestas(ps => ps.map(p => (p.clave === clave ? { ...p, ...c } : p)));

  const cerrar = () => { if (ocupado || fase === 'leyendo') return; if (huboGuardado) onGuardado(); onCerrar(); };

  const leer = async (lista: FileList | null) => {
    const archivos = Array.from(lista || []);
    if (!archivos.length) return;
    if (archivos.length > MAX_ARCHIVOS) { setAviso(`Elegí hasta ${MAX_ARCHIVOS} archivos por vez.`); return; }
    setAviso(''); setFallidos([]); setFase('leyendo');
    const nuevos: Propuesta[] = [], malos: { nombre: string; mensaje: string }[] = [];
    let detener = '';
    for (let i = 0; i < archivos.length && !detener; i++) {
      const f = archivos[i];
      setProgreso(`Leyendo ${i + 1} de ${archivos.length}…`);
      try {
        const prep = await prepararArchivo(f);
        // Uno por pedido: pasa el límite de tamaño del proxy y se ve el avance.
        const r = await api.post(`/api/legajos/${beneficiarioId}/leer-ia`, { archivos: [prep] });
        const { buenos, fallidos: fall } = separarResultados(r.data.resultados as Array<LecturaOk | LecturaError>);
        nuevos.push(...buenos.map(propuestaDe));
        malos.push(...fall.map(x => ({ nombre: f.name, mensaje: x.mensaje })));
      } catch (e) {
        if (e instanceof ErrorArchivo) { malos.push({ nombre: f.name, mensaje: e.message }); continue; }
        const st = (e as { response?: { status?: number } })?.response?.status;
        const msg = mensajeError(e, 'No se pudo leer el documento.');
        if (st === 503 || st === 429 || st === 401 || st === 403) detener = msg;   // seguir no tiene sentido
        else malos.push({ nombre: f.name, mensaje: msg });
      }
    }
    // Lo ya leído en una tanda anterior se conserva, sin repetir el mismo archivo.
    setPropuestas(ps => [...ps, ...nuevos.filter(n => !ps.some(p => p.clave === n.clave))]);
    setFallidos(malos); setAviso(detener); setProgreso('');
    setFase(nuevos.length || propuestas.length ? 'revisar' : 'elegir');
    if (inputArchivos.current) inputArchivos.current.value = '';
    if (inputCamara.current) inputCamara.current.value = '';
  };

  const confirmar = async (claves: string[]) => {
    const aEnviar = propuestas.filter(p => claves.includes(p.clave) && puedeConfirmar(p));
    if (!aEnviar.length) return;
    setOcupado(true);
    setPropuestas(ps => ps.map(p => (aEnviar.some(a => a.clave === p.clave) ? { ...p, estado: 'guardando', mensaje: '' } : p)));
    try {
      const r = await api.post(`/api/legajos/${beneficiarioId}/confirmar-lectura`, { items: aEnviar.map(itemConfirmar) });
      const res = r.data.resultados as { hash: string; ok: boolean; mensaje?: string; yaExistia?: boolean }[];
      setPropuestas(ps => ps.map(p => {
        const x = res.find(z => z.hash === p.clave);
        if (!x) return p;
        return x.ok ? { ...p, estado: 'guardada', mensaje: x.yaExistia ? 'Ya estaba guardado' : 'Guardado en la carpeta' } : { ...p, estado: 'error', mensaje: x.mensaje || 'No se pudo guardar.' };
      }));
      if (res.some(x => x.ok)) setHuboGuardado(true);
    } catch (e) {
      const m = mensajeError(e, 'No se pudo guardar. Probá de nuevo.');
      setPropuestas(ps => ps.map(p => (aEnviar.some(a => a.clave === p.clave) ? { ...p, estado: 'error', mensaje: m } : p)));
    }
    setOcupado(false);
  };

  const pendientes = propuestas.filter(p => puedeConfirmar(p));
  const sinResolver = propuestas.filter(p => p.estado === 'pendiente' || p.estado === 'error').length;

  return (
    <div style={{ ...OVERLAY, zIndex: 60 }} onClick={e => { if (e.target === e.currentTarget) cerrar(); }}>
      <div className="card" role="dialog" aria-label="Cargar con fotos" style={{ width: '100%', maxWidth: 760, padding: '1.25rem', maxHeight: '94vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text)' }}>Cargar con fotos</h3>
            <p style={{ fontSize: '.8rem', color: 'var(--text3)', marginTop: '.15rem' }}>{beneficiarioNombre} · la IA lee y propone; vos revisás y confirmás</p>
          </div>
          <button className="btn btn-secondary" style={{ minWidth: 44, minHeight: 44 }} onClick={cerrar} aria-label="Cerrar" disabled={fase === 'leyendo' || ocupado}><IconX size={18} /></button>
        </div>

        {aviso && <div role="alert" className="card" style={{ padding: '.75rem 1rem', marginBottom: '1rem', borderColor: 'var(--amber)' }}><p style={{ fontSize: '.84rem', color: 'var(--text)' }}>{aviso}</p></div>}

        {fase === 'leyendo' && (
          <div style={{ display: 'flex', gap: '.75rem', alignItems: 'center', color: 'var(--text2)', padding: '2rem .5rem' }} aria-live="polite">
            <span className="spinner" /> {progreso || 'Leyendo…'}
          </div>
        )}

        {fase !== 'leyendo' && (
          <>
            {(fase === 'elegir' || propuestas.length === 0) && (
              <div>
                <p style={{ fontSize: '.84rem', color: 'var(--text2)', marginBottom: '.9rem' }}>
                  Sacá fotos de los documentos (orden médica, DNI, credencial, CUD, autorización, presupuesto…) o subí PDF. Podés elegir varios a la vez.
                </p>
                <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
                  <button className="btn btn-primary" style={{ minHeight: 48, flex: '1 1 200px' }} onClick={() => inputCamara.current?.click()}>
                    <IconCamera size={18} /> Sacar foto
                  </button>
                  <button className="btn btn-secondary" style={{ minHeight: 48, flex: '1 1 200px' }} onClick={() => inputArchivos.current?.click()}>
                    <IconPhoto size={18} /> Elegir fotos o PDF
                  </button>
                </div>
                <p style={{ fontSize: '.74rem', color: 'var(--text3)', marginTop: '.75rem' }}>
                  Las fotos se achican antes de subirse. Hasta {MAX_ARCHIVOS} archivos por vez; los PDF, hasta 3 MB.
                </p>
              </div>
            )}

            {fallidos.length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                {fallidos.map((f, i) => (
                  <p key={i} style={{ fontSize: '.8rem', color: 'var(--red)', marginBottom: '.35rem' }}><b>{f.nombre}:</b> {f.mensaje}</p>
                ))}
              </div>
            )}

            {propuestas.length > 0 && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem', marginTop: fase === 'revisar' ? 0 : '1rem' }}>
                  {propuestas.map(p => (
                    <TarjetaPropuesta key={p.clave} p={p} requisitos={requisitos} bloqueada={ocupado}
                      onCambio={c => cambiar(p.clave, c)}
                      onConfirmar={() => confirmar([p.clave])}
                      onDescartar={() => cambiar(p.clave, { estado: 'descartada' })} />
                  ))}
                </div>

                <div style={{ position: 'sticky', bottom: -1, background: 'var(--bg3)', paddingTop: '.9rem', marginTop: '.9rem', display: 'flex', gap: '.6rem', flexWrap: 'wrap', borderTop: '1px solid var(--border)' }}>
                  <button className="btn btn-secondary" style={{ minHeight: 44, flex: '1 1 160px' }} onClick={() => inputArchivos.current?.click()} disabled={ocupado}>
                    <IconPhoto size={16} /> Agregar más
                  </button>
                  {sinResolver === 0 ? (
                    <button className="btn btn-primary" style={{ minHeight: 44, flex: '1 1 200px' }} onClick={cerrar}>Listo</button>
                  ) : (
                    <button className="btn btn-primary" style={{ minHeight: 44, flex: '1 1 200px' }} disabled={ocupado || pendientes.length === 0}
                      onClick={() => confirmar(pendientes.map(p => p.clave))}>
                      Confirmar todo ({pendientes.length})
                    </button>
                  )}
                </div>
                {pendientes.length < sinResolver && (
                  <p style={{ fontSize: '.74rem', color: 'var(--text3)', marginTop: '.5rem' }}>
                    {sinResolver - pendientes.length} documento(s) necesitan que completes un dato o confirmes que son de este paciente.
                  </p>
                )}
              </>
            )}
          </>
        )}

        {/* El mismo input sirve para elegir y para "agregar más"; el de la cámara abre directo la cámara del celular. */}
        <input ref={inputArchivos} type="file" multiple accept="image/*,.heic,.heif,application/pdf" hidden onChange={e => leer(e.target.files)} />
        <input ref={inputCamara} type="file" accept="image/*" capture="environment" hidden onChange={e => leer(e.target.files)} />
      </div>
    </div>
  );
}
