'use client';
import React, { useEffect, useState } from 'react';
import api from '@/lib/api';

/* ─── Tipos ─────────────────────────────────────────────────────── */

interface Props {
  cuit:        string;
  condicionIva: string;
  onComplete:  () => void;
}

interface EstadoArca {
  configurado:              boolean;
  cuit?:                    string;
  condicionIva?:            string;
  puntoVenta?:              number | null;
  ambiente?:                string;
  certVencimiento?:         string;
  certVencimientoEstimado?: boolean;
  wsAutorizado?:            boolean;
}

interface PuntoVenta {
  Nro:          number;
  Bloqueado?:   string;
  EmisionTipo?: string;
}

/* ─── Constantes ────────────────────────────────────────────────── */

const PASO_LABELS = ['Datos fiscales', 'Conectar ARCA', 'Punto de venta', 'Listo'];

const LS: React.CSSProperties = {
  display: 'block', fontSize: '.78rem', color: 'var(--text3)',
  marginBottom: '.3rem', fontWeight: 500,
};

/* ─── Componente ────────────────────────────────────────────────── */

export default function WizardArca({ cuit, condicionIva, onComplete }: Props) {

  /* ── Estado inicial (ya configurado o no) ── */
  const [loadingEstado, setLoadingEstado] = useState(true);
  const [estadoArca,    setEstadoArca]    = useState<EstadoArca | null>(null);
  const [reconfigurar,  setReconfigurar]  = useState(false);

  /* ── Wizard ── */
  const [paso,        setPaso]       = useState(0);
  const [claveFiscal, setClaveFiscal]= useState('');
  const [ambiente,    setAmbiente]   = useState<'produccion' | 'homologacion'>('produccion');
  const [connecting,  setConnecting] = useState(false);
  const [errConectar, setErrConectar]= useState('');
  const [progressMsg, setProgressMsg]= useState('');

  /* ── Puntos de venta ── */
  const [puntosVenta,  setPuntosVenta] = useState<PuntoVenta[]>([]);
  const [loadingPVs,   setLoadingPVs]  = useState(false);
  const [pvTrigger,    setPvTrigger]   = useState(0);
  const [pvSel,        setPvSel]       = useState<number | null>(null);
  const [savingPV,     setSavingPV]    = useState(false);
  const [errPV,        setErrPV]       = useState('');

  /* ── Carga el estado de ARCA al montar ── */
  useEffect(() => {
    api.get('/api/arca/estado')
      .then(r => setEstadoArca(r.data))
      .catch(() => setEstadoArca({ configurado: false }))
      .finally(() => setLoadingEstado(false));
  }, []);

  /* ── Carga puntos de venta al entrar al paso 2 ── */
  useEffect(() => {
    if (paso !== 2) return;
    let cancelled = false;
    setLoadingPVs(true); setErrPV(''); setPuntosVenta([]);
    api.get('/api/arca/puntos-venta')
      .then(r => {
        if (cancelled) return;
        const pvs: PuntoVenta[] = r.data?.puntosVenta || [];
        setPuntosVenta(pvs);
        if (pvs.length === 1) setPvSel(pvs[0].Nro);
      })
      .catch(() => {
        if (!cancelled) setErrPV('Error al consultar puntos de venta. Intentá de nuevo.');
      })
      .finally(() => { if (!cancelled) setLoadingPVs(false); });
    return () => { cancelled = true; };
  }, [paso, pvTrigger]);

  /* ── POST /api/arca/conectar ── */
  const conectar = async () => {
    if (!claveFiscal || connecting) return;
    setConnecting(true); setErrConectar('');
    setProgressMsg('Generando certificado digital…');
    const msgs = [
      'Esperando propagación en ARCA (puede demorar ~20 seg.)…',
      'Autorizando servicio de facturación electrónica (wsfe)…',
    ];
    let phase = 0;
    const timer = setInterval(() => {
      phase = Math.min(phase + 1, msgs.length - 1);
      setProgressMsg(msgs[phase]);
    }, 10000);

    try {
      await api.post('/api/arca/conectar', { cuit, claveFiscal, condicionIva, ambiente });
      setClaveFiscal('');   // descartada tras el uso
      setPaso(2);
    } catch (err: unknown) {
      setClaveFiscal('');   // descartada también en error
      const msg = (err as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje;
      setErrConectar(msg || 'Error al conectar con ARCA. Verificá el CUIT y la clave fiscal.');
    } finally {
      clearInterval(timer);
      setProgressMsg('');
      setConnecting(false);
    }
  };

  /* ── POST /api/arca/punto-venta ── */
  const guardarPV = async () => {
    if (!pvSel || savingPV) return;
    setSavingPV(true); setErrPV('');
    try {
      await api.post('/api/arca/punto-venta', { puntoVenta: pvSel });
      setPaso(3);
    } catch {
      setErrPV('Error al guardar el punto de venta. Intentá de nuevo.');
    }
    setSavingPV(false);
  };

  /* ── Cerrar el wizard (paso 3) ── */
  const handleComplete = () => {
    setEstadoArca({ configurado: true, cuit, condicionIva, puntoVenta: pvSel, ambiente });
    setReconfigurar(false);
    onComplete();
  };

  /* ─── Loading estado inicial ──────────────────────────────── */
  if (loadingEstado) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', color: 'var(--text3)', padding: '1.5rem 0' }}>
        <span className="spinner" /> Verificando configuración ARCA…
      </div>
    );
  }

  /* ─── Ya configurado ──────────────────────────────────────── */
  if (estadoArca?.configurado && !reconfigurar) {
    return (
      <div className="card" style={{ marginTop: '1.5rem', border: '1px solid rgba(16,185,129,.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <p style={{ fontWeight: 700, color: 'var(--green)', marginBottom: '.65rem', fontSize: '.95rem' }}>
              ✓ ARCA configurado
            </p>
            <div style={{ display: 'grid', gap: '.35rem', fontSize: '.85rem', color: 'var(--text2)' }}>
              <span><strong style={{ color: 'var(--text3)' }}>CUIT:</strong> {estadoArca.cuit}</span>
              {estadoArca.puntoVenta != null && (
                <span>
                  <strong style={{ color: 'var(--text3)' }}>Punto de venta:</strong>{' '}
                  {String(estadoArca.puntoVenta).padStart(4, '0')}
                </span>
              )}
              <span>
                <strong style={{ color: 'var(--text3)' }}>Ambiente:</strong>{' '}
                <span className={`badge ${estadoArca.ambiente === 'produccion' ? 'badge-green' : 'badge-blue'}`} style={{ fontSize: '.72rem' }}>
                  {estadoArca.ambiente}
                </span>
              </span>
              <span>
                <strong style={{ color: 'var(--text3)' }}>WS autorizado:</strong>{' '}
                {estadoArca.wsAutorizado ? '✓ Sí' : '✗ No'}
              </span>
              {estadoArca.certVencimiento && (
                <span>
                  <strong style={{ color: 'var(--text3)' }}>Cert. vence:</strong>{' '}
                  {new Date(estadoArca.certVencimiento).toLocaleDateString('es-AR')}
                  {estadoArca.certVencimientoEstimado ? ' (estimado)' : ''}
                </span>
              )}
            </div>
          </div>
          <button className="btn btn-secondary" style={{ fontSize: '.82rem', flexShrink: 0 }}
            onClick={() => { setReconfigurar(true); setPaso(0); }}>
            Reconfigurar
          </button>
        </div>
      </div>
    );
  }

  /* ─── Wizard ──────────────────────────────────────────────── */
  return (
    <div className="card" style={{ marginTop: '1.5rem' }}>

      {/* Título */}
      <h3 style={{ fontSize: '.95rem', fontWeight: 700, color: 'var(--text)', marginBottom: '1.5rem' }}>
        🏛 Configurar ARCA (facturación electrónica)
      </h3>

      {/* ── Indicador de pasos ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '1.75rem' }}>
        {PASO_LABELS.map((label, i) => {
          const done   = i < paso;
          const active = i === paso;
          return (
            <React.Fragment key={i}>
              {/* Círculo + label */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '.28rem', flexShrink: 0 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '.75rem', fontWeight: 700,
                  background: done ? 'var(--green)' : active ? 'var(--purple)' : 'var(--bg4)',
                  color: (done || active) ? '#fff' : 'var(--text3)',
                  boxShadow: active ? '0 0 12px var(--purple-glow)' : 'none',
                  transition: 'background .25s, box-shadow .25s',
                }}>
                  {done ? '✓' : i + 1}
                </div>
                <span style={{
                  fontSize: '.63rem', textAlign: 'center', lineHeight: 1.25,
                  maxWidth: 58, color: active ? 'var(--text2)' : 'var(--text3)',
                }}>
                  {label}
                </span>
              </div>
              {/* Línea conectora (entre círculos) */}
              {i < PASO_LABELS.length - 1 && (
                <div style={{
                  flex: 1, height: 2, marginTop: 13,
                  background: done ? 'var(--green)' : 'var(--border2)',
                  transition: 'background .3s',
                }} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* ══ Paso 0: Datos fiscales ══════════════════════════════ */}
      {paso === 0 && (
        <div>
          <p style={{ fontSize: '.82rem', color: 'var(--text3)', marginBottom: '1.25rem', lineHeight: 1.55 }}>
            Confirmá los datos fiscales que se usarán para conectar tu cuenta ARCA.
          </p>
          <div className="form-grid">
            <div className="form-grid form-grid-2">
              <div>
                <label style={LS}>CUIT</label>
                <input className="input" value={cuit || '—'} readOnly
                  style={{ opacity: .65, cursor: 'default', background: 'var(--bg5)' }} />
              </div>
              <div>
                <label style={LS}>Condición IVA</label>
                <input className="input" value={condicionIva || '—'} readOnly
                  style={{ opacity: .65, cursor: 'default', background: 'var(--bg5)' }} />
              </div>
            </div>
            {(!cuit || !condicionIva) && (
              <div style={{
                background: 'var(--amber-dim)', border: '1px solid rgba(245,158,11,.3)',
                borderRadius: 'var(--radius)', padding: '.85rem 1rem',
                fontSize: '.82rem', color: 'var(--amber)', lineHeight: 1.5,
              }}>
                ⚠️ Completá primero el CUIT y la Condición IVA en el formulario de arriba y guardá los datos fiscales.
              </div>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
            <button className="btn btn-primary" disabled={!cuit || !condicionIva}
              onClick={() => setPaso(1)}>
              Siguiente →
            </button>
          </div>
        </div>
      )}

      {/* ══ Paso 1: Conectar ARCA ════════════════════════════════ */}
      {paso === 1 && (
        <div>
          {/* Aviso de seguridad */}
          <div style={{
            background: 'rgba(59,130,246,.1)', border: '1px solid rgba(59,130,246,.35)',
            borderRadius: 'var(--radius)', padding: '1rem 1.1rem', marginBottom: '1.25rem',
            display: 'flex', gap: '.75rem', alignItems: 'flex-start',
          }}>
            <span style={{ fontSize: '1.15rem', lineHeight: 1, flexShrink: 0 }}>🔒</span>
            <div>
              <p style={{ fontSize: '.85rem', color: 'var(--blue-bright)', fontWeight: 700, marginBottom: '.3rem' }}>
                Tu clave fiscal es privada
              </p>
              <p style={{ fontSize: '.78rem', color: 'var(--text2)', lineHeight: 1.55 }}>
                Se usa <strong>una sola vez</strong> para generar tu certificado digital y{' '}
                <strong>no se guarda en nuestros servidores</strong>. Solo viaja a ARCA para crear el certificado
                y es descartada de inmediato.
              </p>
            </div>
          </div>

          <div className="form-grid">
            <div>
              <label style={LS} htmlFor="arca-clave">Clave fiscal (ARCA / AFIP)</label>
              <input
                id="arca-clave"
                type="password"
                className="input"
                placeholder="Tu clave fiscal"
                value={claveFiscal}
                onChange={e => setClaveFiscal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && claveFiscal && !connecting) conectar(); }}
                disabled={connecting}
                autoComplete="new-password"
                aria-label="Clave fiscal de ARCA"
              />
            </div>

            <div>
              <label style={LS}>Ambiente</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '.6rem' }}>
                {(['produccion', 'homologacion'] as const).map(a => (
                  <label key={a} style={{
                    display: 'flex', alignItems: 'center', gap: '.5rem',
                    cursor: connecting ? 'default' : 'pointer',
                    fontSize: '.85rem',
                    color: ambiente === a ? 'var(--text)' : 'var(--text3)',
                  }}>
                    <input
                      type="radio" name="arca-ambiente" value={a}
                      checked={ambiente === a} onChange={() => setAmbiente(a)}
                      disabled={connecting}
                      style={{ accentColor: 'var(--purple)', cursor: 'pointer' }}
                    />
                    {a === 'produccion'
                      ? '🟢 Producción (facturas reales)'
                      : '🔵 Homologación (pruebas / testing)'}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {errConectar && (
            <div style={{
              marginTop: '1rem', background: 'var(--red-dim)',
              border: '1px solid rgba(239,68,68,.3)', borderRadius: 'var(--radius)',
              padding: '.85rem 1rem', fontSize: '.82rem', color: 'var(--red)', lineHeight: 1.5,
            }}>
              ✗ {errConectar}
            </div>
          )}

          {connecting && progressMsg && (
            <div style={{
              marginTop: '1rem', display: 'flex', alignItems: 'center',
              gap: '.75rem', color: 'var(--text3)', fontSize: '.82rem',
            }}>
              <span className="spinner" /> {progressMsg}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.25rem' }}>
            <button className="btn btn-secondary" disabled={connecting}
              onClick={() => { setPaso(0); setErrConectar(''); setClaveFiscal(''); }}>
              ← Anterior
            </button>
            <button className="btn btn-primary" disabled={connecting || !claveFiscal} onClick={conectar}>
              {connecting
                ? <><span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> Conectando…</>
                : '🔗 Conectar con ARCA'}
            </button>
          </div>
        </div>
      )}

      {/* ══ Paso 2: Punto de venta ═══════════════════════════════ */}
      {paso === 2 && (
        <div>
          <p style={{ fontSize: '.82rem', color: 'var(--text3)', marginBottom: '1.25rem', lineHeight: 1.55 }}>
            Seleccioná el punto de venta habilitado para emitir comprobantes electrónicos.
          </p>

          {loadingPVs ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', color: 'var(--text3)', padding: '.75rem 0' }}>
              <span className="spinner" /> Consultando puntos de venta en ARCA…
            </div>
          ) : errPV && puntosVenta.length === 0 ? (
            <div style={{
              background: 'var(--red-dim)', border: '1px solid rgba(239,68,68,.3)',
              borderRadius: 'var(--radius)', padding: '.85rem 1rem',
              fontSize: '.82rem', color: 'var(--red)', lineHeight: 1.5,
              display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap',
            }}>
              <span>✗ {errPV}</span>
              <button className="btn btn-secondary" style={{ fontSize: '.78rem', padding: '.3rem .7rem', minHeight: 'unset' }}
                onClick={() => setPvTrigger(t => t + 1)}>
                Reintentar
              </button>
            </div>
          ) : puntosVenta.length === 0 ? (
            <div style={{
              background: 'var(--amber-dim)', border: '1px solid rgba(245,158,11,.3)',
              borderRadius: 'var(--radius)', padding: '.85rem 1rem',
              fontSize: '.82rem', color: 'var(--amber)',
            }}>
              ⚠️ No se encontraron puntos de venta habilitados para este CUIT.
            </div>
          ) : (
            <div>
              <label style={LS} htmlFor="arca-pv">Punto de venta</label>
              <select id="arca-pv" className="select" value={pvSel ?? ''}
                onChange={e => setPvSel(Number(e.target.value))}>
                <option value="">— Seleccioná un punto de venta —</option>
                {puntosVenta
                  .filter(pv => pv.Bloqueado !== 'S')
                  .map(pv => (
                    <option key={pv.Nro} value={pv.Nro}>
                      {String(pv.Nro).padStart(4, '0')} — {pv.EmisionTipo || 'CAE'}
                    </option>
                  ))}
                {puntosVenta
                  .filter(pv => pv.Bloqueado === 'S')
                  .map(pv => (
                    <option key={`bloq-${pv.Nro}`} value={pv.Nro} disabled>
                      {String(pv.Nro).padStart(4, '0')} — (bloqueado)
                    </option>
                  ))}
              </select>
            </div>
          )}

          {errPV && puntosVenta.length > 0 && (
            <div style={{
              marginTop: '1rem', background: 'var(--red-dim)',
              border: '1px solid rgba(239,68,68,.3)', borderRadius: 'var(--radius)',
              padding: '.85rem 1rem', fontSize: '.82rem', color: 'var(--red)',
            }}>
              ✗ {errPV}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.25rem' }}>
            <button className="btn btn-secondary" disabled={savingPV}
              onClick={() => { setPaso(1); setErrPV(''); setPuntosVenta([]); setPvSel(null); }}>
              ← Anterior
            </button>
            <button className="btn btn-primary" disabled={savingPV || !pvSel} onClick={guardarPV}>
              {savingPV
                ? <><span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> Guardando…</>
                : 'Guardar y continuar →'}
            </button>
          </div>
        </div>
      )}

      {/* ══ Paso 3: Listo ════════════════════════════════════════ */}
      {paso === 3 && (
        <div style={{ textAlign: 'center', padding: '.5rem 0 1rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '.75rem' }}>🎉</div>
          <p style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text)', marginBottom: '.4rem' }}>
            ¡Configuración completada!
          </p>
          <p style={{ fontSize: '.85rem', color: 'var(--text3)', marginBottom: '1.5rem', lineHeight: 1.55 }}>
            ARCA quedó conectado. Ya podés emitir facturas electrónicas.
          </p>

          <div style={{
            display: 'inline-grid', gap: '.4rem', textAlign: 'left',
            background: 'var(--bg4)', borderRadius: 'var(--radius)',
            padding: '.85rem 1.25rem', marginBottom: '1.5rem', fontSize: '.85rem',
          }}>
            <div>
              <strong style={{ color: 'var(--text3)' }}>CUIT:</strong>{' '}
              <span style={{ color: 'var(--text)' }}>{cuit}</span>
            </div>
            <div>
              <strong style={{ color: 'var(--text3)' }}>Punto de venta:</strong>{' '}
              <span style={{ color: 'var(--text)' }}>
                {pvSel != null ? String(pvSel).padStart(4, '0') : '—'}
              </span>
            </div>
            <div>
              <strong style={{ color: 'var(--text3)' }}>Ambiente:</strong>{' '}
              <span
                className={`badge ${ambiente === 'produccion' ? 'badge-green' : 'badge-blue'}`}
                style={{ fontSize: '.72rem' }}>
                {ambiente}
              </span>
            </div>
          </div>

          <div>
            <button className="btn btn-success" onClick={handleComplete}>
              ✓ Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
