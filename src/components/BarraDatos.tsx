import type { ReactNode } from 'react';

/** Color de significado de cada número (los mismos del Inicio de siempre). */
export type TonoDato = 'blue' | 'red' | 'amber' | 'green' | 'purple';

export interface SegmentoDato {
  id: string;
  etiqueta: string;
  valor: ReactNode;
  sub?: string;
  tono: TonoDato;
  /** Desglose en una línea chica debajo del número (lo usa el saldo: cobrado · pendiente · egresos). */
  desglose?: { etiqueta: string; valor: string; tono: TonoDato; completo?: string }[];
  /** Número más chico, para cifras largas como un importe completo. */
  largo?: boolean;
}

/**
 * Una sola franja horizontal de datos, con un segmento por dato separados por divisores finos.
 * El reparto de columnas lo decide el ancho de la propia franja (container query en globals.css):
 * 6 en fila, 3 × 2 o 2 × 3, y siempre rellena la grilla sin celdas vacías.
 */
export default function BarraDatos({ segmentos, titulo }: { segmentos: SegmentoDato[]; titulo: string }) {
  return (
    <section className="databar" aria-label={titulo}>
      <dl className="databar-grid">
        {segmentos.map(s => (
          <div className={`databar-seg databar-seg--${s.tono}`} key={s.id}>
            <dt className="databar-etiqueta">{s.etiqueta}</dt>
            <dd className="databar-cuerpo">
              <span className={`databar-valor${s.largo ? ' databar-valor--largo' : ''}`} id={s.id}>{s.valor}</span>
              {s.sub && <span className="databar-sub">{s.sub}</span>}
              {s.desglose && (
                <span className="databar-desglose" title={s.desglose.map(d => `${d.etiqueta} ${d.completo ?? d.valor}`).join(' · ')}>
                  {s.desglose.map((d, i) => (
                    <span className="databar-d" key={d.etiqueta}>
                      {i > 0 && <span className="databar-sep" aria-hidden="true"> · </span>}
                      <span className="databar-d-item">{d.etiqueta} <strong className={`databar-tono-${d.tono}`}>{d.valor}</strong></span>
                    </span>
                  ))}
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
