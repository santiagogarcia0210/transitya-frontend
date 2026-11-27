'use client';
import { useState } from 'react';
import { canonicaObraSocial, opcionesObraSocial, OTRA_OBRA_SOCIAL } from '@/lib/beneficiarioForm';

/**
 * Selector de obra social del alta/edición de pacientes. Guarda siempre el valor canónico (cualquier grafía de
 * Incluir queda como "INCLUIR SALUD"), así las planillas y la carpeta no dependen de cómo se tipeó.
 * Las obras sociales que ya existen cargadas aparecen como opciones; "Otra" permite escribir una nueva.
 */
export default function ObraSocialSelect({ value, onChange, existentes = [] }: {
  value: string; onChange: (v: string) => void; existentes?: string[];
}) {
  const [otra, setOtra] = useState(false);
  const opciones = opcionesObraSocial([...existentes, value]);
  const seleccion = otra ? OTRA_OBRA_SOCIAL : canonicaObraSocial(value);

  return (
    <>
      <select className="select" value={seleccion} aria-label="Obra social"
        onChange={e => {
          if (e.target.value === OTRA_OBRA_SOCIAL) { setOtra(true); onChange(''); return; }
          setOtra(false); onChange(e.target.value);
        }}>
        <option value="">Sin obra social (elegí una)</option>
        {opciones.map(o => <option key={o} value={o}>{o}</option>)}
        <option value={OTRA_OBRA_SOCIAL}>Otra (escribir)…</option>
      </select>
      {otra && (
        <input className="input" style={{ marginTop: '.4rem' }} placeholder="Nombre de la obra social" value={value}
          onChange={e => onChange(e.target.value)} onBlur={() => onChange(canonicaObraSocial(value))} />
      )}
    </>
  );
}
