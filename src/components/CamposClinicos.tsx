'use client';
import { LABEL } from '@/lib/administrativo';
import { CAMPOS_CLINICOS, MODALIDADES, esBaja, etiquetaConfianza, type ClinicoEditable } from '@/lib/lecturaIA';

const ESTILO_DUDOSO: React.CSSProperties = { borderColor: 'var(--amber)', background: 'var(--amber-dim)' };

/**
 * Campos clínicos editables de un CUD o una orden médica. Los datos dudosos de la IA se marcan en ámbar.
 * Se usa en la pantalla de revisión (antes de guardar) y en la ficha clínica de la carpeta.
 */
export default function CamposClinicos({ valor, onCambio, ocultarConfianza }: {
  valor: ClinicoEditable; onCambio: (v: ClinicoEditable) => void; ocultarConfianza?: boolean;
}) {
  const set = (k: string, v: string | string[]) => onCambio({ ...valor, valores: { ...valor.valores, [k]: v } });
  return (
    <div className="form-grid">
      {CAMPOS_CLINICOS[valor.documento].map(d => {
        const conf = ocultarConfianza ? undefined : valor.confianzas[d.k];
        const dudoso = esBaja(conf) ? ESTILO_DUDOSO : undefined;
        const v = valor.valores[d.k];
        return (
          <div key={d.k}>
            <label style={{ ...LABEL, display: 'flex', justifyContent: 'space-between', gap: '.5rem' }}>
              <span>{d.label}</span>
              {conf && conf !== 'alta' && <span style={{ color: esBaja(conf) ? 'var(--amber)' : 'var(--text3)', fontWeight: 600 }}>{etiquetaConfianza(conf)}</span>}
            </label>
            {d.tipo === 'lista' ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.4rem' }}>
                {Object.entries(MODALIDADES).map(([k, nombre]) => {
                  const on = Array.isArray(v) && v.includes(k);
                  return (
                    <button key={k} type="button" aria-pressed={on} className={on ? 'btn btn-primary' : 'btn btn-secondary'}
                      style={{ fontSize: '.76rem', minHeight: 44, ...(on ? {} : dudoso) }}
                      onClick={() => set(d.k, on ? (v as string[]).filter(x => x !== k) : [...(Array.isArray(v) ? v : []), k])}>{nombre}</button>
                  );
                })}
              </div>
            ) : d.tipo === 'fecha' ? (
              <input type="date" className="input" style={{ minHeight: 44, ...dudoso }} value={String(v ?? '')} onChange={e => set(d.k, e.target.value)} />
            ) : (
              <input className="input" style={{ minHeight: 44, ...dudoso }} inputMode={d.tipo === 'numero' ? 'numeric' : undefined}
                value={String(v ?? '')} onChange={e => set(d.k, e.target.value)} autoComplete="off" />
            )}
          </div>
        );
      })}
    </div>
  );
}
