'use client';
import { useState } from 'react';
import { IconLock, IconSparkles } from '@tabler/icons-react';
import api from '@/lib/api';
import { mensajeError } from '@/lib/administrativo';
import CamposClinicos from '@/components/CamposClinicos';
import {
  CAMPOS_CLINICOS, MODALIDADES, TITULO_DOC_CLINICO, clinicoEditable, esBaja, isoADmy,
  type ClinicoEditable, type Confianza, type DocClinico, type ValorClinico,
} from '@/lib/lecturaIA';

interface CampoGuardado { valor: ValorClinico; confianza: Confianza; origen: 'ia' | 'manual'; editado: boolean }
interface Seccion { campos: Record<string, CampoGuardado>; confirmadoEn?: string; confirmadoPor?: string }
interface Sugerencia { modalidad: string; etiqueta: string; motivo: string; fuente: string }
interface Respuesta {
  clinico: { cud: Seccion | null; ordenMedica: Seccion | null; modalidadElegida: string[] | null } | null;
  recomendacion: { sugerencias: Sugerencia[]; base: string };
}
interface Evento { id: string; accion: string; usuario: string; en: string; campos?: string[] }

const fechaHora = (iso: string) => { const d = new Date(iso); return isNaN(+d) ? '' : d.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }); };
const ACCION: Record<string, string> = { ver: 'lo vio', crear: 'lo cargó desde un documento', editar: 'lo editó' };

function mostrar(v: ValorClinico): string {
  return Array.isArray(v) ? v.map(k => MODALIDADES[k] || k).join(', ') : String(v);
}

/** Valor para el PUT: vacío = quitar el dato. */
function paraGuardar(e: ClinicoEditable) {
  const campos: Record<string, ValorClinico> = {};
  for (const d of CAMPOS_CLINICOS[e.documento]) {
    const v = e.valores[d.k];
    if (Array.isArray(v)) campos[d.k] = v;
    else if (!v.trim()) campos[d.k] = '';
    else campos[d.k] = d.tipo === 'fecha' ? isoADmy(v) : d.tipo === 'numero' ? Number(v.replace(/\D/g, '')) : v.trim();
  }
  return campos;
}

/**
 * Datos clínicos de la carpeta (CUD y orden médica) y sugerencia de tipo de centro.
 * Cerrado por defecto: cada vez que se abre queda registrado quién lo vio.
 */
export default function FichaClinica({ beneficiarioId }: { beneficiarioId: string }) {
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [editando, setEditando] = useState<{ doc: DocClinico; valor: ClinicoEditable } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [eventos, setEventos] = useState<Evento[] | null>(null);

  const url = `/api/legajos/${beneficiarioId}/clinico`;
  const abrir = async () => {
    setCargando(true); setError('');
    try { setDatos((await api.get(url)).data); }
    catch (e) { setError(mensajeError(e, 'No se pudieron cargar los datos clínicos.')); }
    setCargando(false);
  };
  const cerrar = () => { setDatos(null); setEditando(null); setEventos(null); setError(''); };

  const guardar = async (cuerpo: Record<string, unknown>) => {
    setGuardando(true); setError('');
    try { setDatos((await api.put(url, cuerpo)).data); setEditando(null); setEventos(null); }
    catch (e) { setError(mensajeError(e, 'No se pudo guardar.')); }
    setGuardando(false);
  };

  const verAuditoria = async () => {
    try { setEventos((await api.get(`${url}/auditoria`)).data.eventos || []); }
    catch (e) { setError(mensajeError(e, 'No se pudo cargar el registro de accesos.')); }
  };

  const elegidas = datos?.clinico?.modalidadElegida || null;
  const alternar = (k: string) => {
    const base = elegidas || [];
    const nuevas = base.includes(k) ? base.filter(x => x !== k) : [...base, k].slice(0, 3);
    guardar({ modalidadElegida: nuevas });
  };

  const seccion = (doc: DocClinico, s: Seccion | null | undefined) => {
    if (!s) return null;
    const editable = clinicoEditable({ documento: doc, campos: Object.fromEntries(Object.entries(s.campos).map(([k, c]) => [k, { valor: c.valor, confianza: c.confianza }])), advertencias: [] });
    return (
      <div key={doc} style={{ marginTop: '.85rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '.5rem' }}>
          <p style={{ fontSize: '.84rem', fontWeight: 700, color: 'var(--text)' }}>{TITULO_DOC_CLINICO[doc]}</p>
          {editando?.doc !== doc && <button className="btn btn-secondary" style={{ fontSize: '.74rem', minHeight: 44 }} onClick={() => setEditando({ doc, valor: { ...editable, confianzas: {} } })}>Editar</button>}
        </div>
        {editando?.doc === doc ? (
          <>
            <div style={{ marginTop: '.5rem' }}><CamposClinicos ocultarConfianza valor={editando.valor} onCambio={v => setEditando({ doc, valor: v })} /></div>
            <div style={{ display: 'flex', gap: '.6rem', marginTop: '.75rem' }}>
              <button className="btn btn-secondary" style={{ flex: 1, minHeight: 44 }} onClick={() => setEditando(null)} disabled={guardando}>Cancelar</button>
              <button className="btn btn-primary" style={{ flex: 1, minHeight: 44 }} disabled={guardando} onClick={() => guardar({ documento: doc, campos: paraGuardar(editando.valor) })}>
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </>
        ) : (
          <dl style={{ marginTop: '.4rem' }}>
            {CAMPOS_CLINICOS[doc].filter(d => s.campos[d.k]).map(d => {
              const c = s.campos[d.k];
              const dudoso = c.origen === 'ia' && !c.editado && esBaja(c.confianza);
              return (
                <div key={d.k} style={{ padding: '.35rem 0', borderBottom: '1px solid var(--border)' }}>
                  <dt style={{ fontSize: '.72rem', color: 'var(--text3)' }}>{d.label}</dt>
                  <dd style={{ fontSize: '.86rem', color: 'var(--text)', overflowWrap: 'anywhere' }}>
                    {d.tipo === 'fecha' ? String(c.valor) : mostrar(c.valor)}
                    <span style={{ fontSize: '.68rem', marginLeft: '.5rem', color: dudoso ? 'var(--amber)' : 'var(--text3)' }}>
                      {c.origen === 'manual' ? 'cargado a mano' : c.editado ? 'leído por IA y corregido' : dudoso ? 'leído por IA · poco seguro' : 'leído por IA'}
                    </span>
                  </dd>
                </div>
              );
            })}
            {Object.keys(s.campos).length === 0 && <p style={{ fontSize: '.78rem', color: 'var(--text3)' }}>Sin datos.</p>}
          </dl>
        )}
        {s.confirmadoEn && <p style={{ fontSize: '.7rem', color: 'var(--text3)', marginTop: '.3rem' }}>Confirmado {fechaHora(s.confirmadoEn)}{s.confirmadoPor && <> por {s.confirmadoPor}</>}</p>}
      </div>
    );
  };

  return (
    <div style={{ marginTop: '1.25rem', padding: '1rem', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '.75rem', flexWrap: 'wrap' }}>
        <p style={{ fontSize: '.9rem', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '.4rem' }}>
          <IconLock size={16} /> Datos clínicos
        </p>
        {datos
          ? <button className="btn btn-secondary" style={{ minHeight: 44 }} onClick={cerrar}>Ocultar</button>
          : <button className="btn btn-secondary" style={{ minHeight: 44 }} onClick={abrir} disabled={cargando}>{cargando ? 'Abriendo…' : 'Ver datos clínicos'}</button>}
      </div>
      {!datos && <p style={{ fontSize: '.74rem', color: 'var(--text3)', marginTop: '.3rem' }}>Datos de salud: solo administración. Cada vez que se abren queda registrado quién los vio.</p>}
      {error && <p role="alert" style={{ fontSize: '.8rem', color: 'var(--red)', marginTop: '.6rem' }}>{error}</p>}

      {datos && (
        <>
          {!datos.clinico && <p style={{ fontSize: '.82rem', color: 'var(--text2)', marginTop: '.75rem' }}>Todavía no hay datos clínicos. Se completan al cargar un CUD o una orden médica con “Cargar con fotos / leer con IA”.</p>}
          {seccion('cud', datos.clinico?.cud)}
          {seccion('orden_medica', datos.clinico?.ordenMedica)}

          <div style={{ marginTop: '1.1rem', paddingTop: '.9rem', borderTop: '1px solid var(--border)' }}>
            <p style={{ fontSize: '.84rem', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '.4rem' }}>
              <IconSparkles size={16} /> Tipo de centro sugerido <span className="badge badge-purple">sugerido por IA</span>
            </p>
            {datos.recomendacion.sugerencias.length === 0 ? (
              <p style={{ fontSize: '.78rem', color: 'var(--text3)', marginTop: '.3rem' }}>No hay datos suficientes para sugerir una modalidad. Podés elegirla a mano.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, marginTop: '.4rem' }}>
                {datos.recomendacion.sugerencias.map(s => (
                  <li key={s.modalidad} style={{ padding: '.35rem 0' }}>
                    <span style={{ fontSize: '.86rem', color: 'var(--text)', fontWeight: 600 }}>{s.etiqueta}</span>
                    <span style={{ display: 'block', fontSize: '.74rem', color: 'var(--text3)' }}>{s.motivo}</span>
                  </li>
                ))}
              </ul>
            )}
            <p style={{ fontSize: '.72rem', color: 'var(--text3)', margin: '.4rem 0' }}>
              Es solo una sugerencia, sin valor clínico: la decisión es de la familia y el equipo tratante. Elegí hasta 3 modalidades para esta carpeta:
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.4rem' }}>
              {Object.entries(MODALIDADES).map(([k, nombre]) => {
                const on = !!elegidas?.includes(k);
                return <button key={k} type="button" aria-pressed={on} disabled={guardando} className={on ? 'btn btn-primary' : 'btn btn-secondary'} style={{ fontSize: '.76rem', minHeight: 44 }} onClick={() => alternar(k)}>{nombre}</button>;
              })}
            </div>
          </div>

          <div style={{ marginTop: '1rem' }}>
            {eventos === null
              ? <button className="btn btn-secondary" style={{ fontSize: '.74rem', minHeight: 44 }} onClick={verAuditoria}>Ver quién consultó estos datos</button>
              : (
                <div>
                  <p style={{ fontSize: '.78rem', fontWeight: 600, color: 'var(--text2)', marginBottom: '.3rem' }}>Últimos accesos</p>
                  {eventos.slice(0, 8).map(ev => <p key={ev.id} style={{ fontSize: '.74rem', color: 'var(--text3)' }}>{fechaHora(ev.en)} · {ev.usuario || 'alguien'} {ACCION[ev.accion] || ev.accion}</p>)}
                  {eventos.length === 0 && <p style={{ fontSize: '.74rem', color: 'var(--text3)' }}>Sin registros.</p>}
                </div>
              )}
          </div>
        </>
      )}
    </div>
  );
}
