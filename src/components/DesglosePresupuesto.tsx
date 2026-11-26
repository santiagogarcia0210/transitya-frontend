'use client';
import { IconAlertTriangle } from '@tabler/icons-react';
import { DIAS, UNIDAD_TEXTO, fmt, kmPorViajeTexto, pesos, sentidosTexto, type ArancelUsado, type Calculo } from '@/lib/presupuesto';

const th: React.CSSProperties = { textAlign: 'right', fontSize: '.7rem', fontWeight: 600, color: 'var(--text3)', padding: '.35rem .5rem', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { textAlign: 'right', fontSize: '.8rem', color: 'var(--text)', padding: '.45rem .5rem', borderTop: '1px solid var(--border)', fontVariantNumeric: 'tabular-nums' };

/**
 * Desglose completo del presupuesto: por viaje (km, sentidos, tramo corto, viajes, importes), valor del km con su
 * adicional, resolución y mes de referencia, y total. Es el mismo en el asistente y en el presupuesto emitido.
 */
export default function DesglosePresupuesto({ calculo: c, arancel, viajes }: { calculo: Calculo; arancel: ArancelUsado; viajes?: { id: string; origen?: string; destino?: string; centro?: string }[] }) {
  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: 'left' }}>Viaje</th><th style={{ ...th, textAlign: 'left' }}>Km por viaje</th><th style={th}>Km a cobrar</th><th style={th}>Días</th>
              <th style={th}>Viajes/mes</th><th style={th}>Km/mes</th><th style={th}>Importe diario</th><th style={th}>Importe mensual</th>
            </tr>
          </thead>
          <tbody>
            {c.viajes.map((f, i) => {
              const info = viajes?.[i];
              const dias = (f.dias || []).map(k => DIAS.find(d => d.k === k)?.corto).join(' ');
              return (
                <tr key={f.id}>
                  <td style={{ ...td, textAlign: 'left', verticalAlign: 'top' }}>
                    <b>{f.id}</b>
                    {info && (info.origen || info.destino) && <span style={{ display: 'block', fontSize: '.7rem', color: 'var(--text3)', maxWidth: 220, overflowWrap: 'anywhere' }}>{info.origen} &gt; {info.destino || info.centro}</span>}
                  </td>
                  <td style={{ ...td, textAlign: 'left', verticalAlign: 'top' }}>
                    {kmPorViajeTexto(f)}
                    {sentidosTexto(f) && <span style={{ display: 'block', fontSize: '.7rem', color: 'var(--text3)' }}>{sentidosTexto(f)}</span>}
                  </td>
                  <td style={td}>
                    {fmt(f.kmFacturables)} km
                    {f.llevadoAlMinimo && <span className="badge badge-amber" style={{ display: 'block', marginTop: 2, fontSize: '.62rem' }}>llevado al mínimo</span>}
                  </td>
                  <td style={td}>{f.diasPorSemana}{dias && <span style={{ display: 'block', fontSize: '.66rem', color: 'var(--text3)' }}>{dias}</span>}</td>
                  <td style={td}>{fmt(f.viajesMes)}</td><td style={td}>{fmt(f.kmMes, 2)}</td><td style={td}>{pesos(f.importeDiario)}</td><td style={{ ...td, fontWeight: 600 }}>{pesos(f.importeMensual)}</td>
                </tr>
              );
            })}
            {c.ajusteDiario && (
              <tr>
                <td style={{ ...td, textAlign: 'left' }} colSpan={5}>Ajuste por mínimo diario ({c.ajusteDiario.dias.map(d => `${DIAS.find(x => x.k === d.dia)?.label}: ${fmt(d.kmReales)} → ${fmt(d.kmFacturables)} km`).join(' · ')})</td>
                <td style={td}>{fmt(c.ajusteDiario.kmMes, 2)}</td><td style={td} /><td style={{ ...td, fontWeight: 600 }}>{pesos(c.ajusteDiario.importeMensual)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '.9rem', display: 'grid', gap: '.3rem', fontSize: '.84rem' }}>
        <Fila etiqueta="Total km mensuales" valor={`${fmt(c.kmMensuales, 2)} km`} />
        {c.valorKm.aplicado
          ? <Fila etiqueta={`Valor del km: base ${pesos(c.valorKm.base)} + adicional por dependencia ${fmt(c.valorKm.porcentaje)}% ${pesos(c.valorKm.adicional)}`} valor={pesos(c.valorKm.final)} />
          : <Fila etiqueta="Valor del km" valor={pesos(c.valorKm.base)} />}
        <Fila etiqueta="Monto mensual" valor={pesos(c.total)} fuerte />
      </div>

      <div style={{ marginTop: '.8rem', fontSize: '.74rem', color: 'var(--text3)', display: 'grid', gap: '.2rem' }}>
        <p>Valor del km según {arancel.resolucion}{arancel.mes ? ` · ${arancel.mes}` : ''} ({arancel.origen === 'obra_social' ? 'valor propio de la obra social' : 'nomenclador'}).</p>
        <p>Cada viaje: km × valor del km × días por semana × {fmt(c.semanasPorMes)} semanas por mes. Sin días hábiles reales ni feriados.</p>
        <p>{c.tramoCorto.activo
          ? `Tramo corto: mínimo de ${fmt(c.tramoCorto.kmMinimo)} km ${UNIDAD_TEXTO[c.tramoCorto.unidad || 'sentido']}${c.tramoCorto.viajesLlevadosAlMinimo?.length ? ` · llevados al mínimo: viaje ${c.tramoCorto.viajesLlevadosAlMinimo.join(', ')}` : ' · ningún viaje llegó a necesitarlo'}.`
          : 'Tramo corto: no aplicado (km reales).'}</p>
        {arancel.verificar && (
          <p style={{ color: 'var(--amber)', display: 'flex', gap: '.35rem', alignItems: 'center' }}><IconAlertTriangle size={14} /> El valor del km está marcado para verificar contra el Boletín Oficial.</p>
        )}
      </div>
    </div>
  );
}

function Fila({ etiqueta, valor, fuerte }: { etiqueta: string; valor: string; fuerte?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', padding: '.3rem 0', borderTop: fuerte ? '1px solid var(--border)' : undefined }}>
      <span style={{ color: fuerte ? 'var(--text)' : 'var(--text2)', fontWeight: fuerte ? 700 : 400, overflowWrap: 'anywhere' }}>{etiqueta}</span>
      <span style={{ color: 'var(--text)', fontWeight: fuerte ? 800 : 600, fontSize: fuerte ? '1.05rem' : undefined, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{valor}</span>
    </div>
  );
}
