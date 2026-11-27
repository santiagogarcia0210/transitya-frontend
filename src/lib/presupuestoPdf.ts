import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  DIAS, UNIDAD_TEXTO, fmt, kmPorViajeTexto, periodoLabel, pesos, sentidosTexto,
  type ArancelUsado, type Calculo, type Estado, type Formato,
} from '@/lib/presupuesto';

// PDF del presupuesto. Dos diseños: el multi-viaje ("PRESUPUESTO TRANSPORTE", con cronograma y hoja de conformidad al
// pie, copiado del presupuesto en papel) y el formulario "Servicio de Traslados Programados". Es el mismo PDF para un
// borrador (vista previa) y para uno emitido: sale de los mismos datos, así que un presupuesto emitido se puede volver
// a bajar idéntico.

export interface PresupuestoDoc {
  numeroTexto?: string; fechaEmision?: string; estado?: Estado; formato: Formato; obraNombre: string;
  transportista: { razonSocial?: string; responsable?: string; cuit?: string; domicilio?: string; telefono?: string; mail?: string; aseguradora?: string; poliza?: string };
  beneficiario: { nombre?: string; dni?: string; afiliado?: string; domicilio?: string; localidad?: string; tutor?: string; contacto?: string };
  periodoDesde: string; periodoHasta: string; acompanante?: boolean; vehiculo?: string; observaciones?: string;
  viajes: { id: string; origen?: string; destino?: string; centro?: string; dias?: string[] }[];
  calculo: Calculo; arancel: ArancelUsado;
}
interface DocAT extends jsPDF { lastAutoTable: { finalY: number } }

const M = 14;                       // margen
const NEGRO: [number, number, number] = [20, 20, 20];
const GRIS: [number, number, number] = [235, 235, 235];

/** "Etiqueta: valor" con la etiqueta en negrita y el valor subrayado, como en el formulario en papel. */
function campo(doc: jsPDF, etiqueta: string, valor: string, x: number, y: number, ancho: number) {
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text(`${etiqueta} `, x, y);
  const w = doc.getTextWidth(`${etiqueta} `);
  doc.setFont('helvetica', 'normal'); doc.text(limpio(valor), x + w, y, { maxWidth: ancho - w });
  doc.setDrawColor(120); doc.setLineWidth(0.15); doc.line(x + w, y + 1.2, x + ancho, y + 1.2);
}
/** Las fuentes estándar del PDF no tienen flechas ni símbolos raros: se pasa a ">" y se descarta lo que no se puede dibujar. */
const limpio = (v?: string | null) => String(v ?? '').replace(/→/g, '>').replace(/[^\u0000-\u00FF\u2013\u2014]/g, '');
const linea = (doc: jsPDF, x1: number, x2: number, y: number) => { doc.setDrawColor(90); doc.setLineWidth(0.2); doc.line(x1, y, x2, y); };

/* ── Multi-viaje ─────────────────────────────────────────────────────────── */
function multiViaje(d: PresupuestoDoc): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), ancho = W - 2 * M, mitad = ancho / 2 - 3;
  const t = d.transportista, b = d.beneficiario, c = d.calculo;
  doc.setTextColor(...NEGRO);
  let y = 16;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.text('PRESUPUESTO TRANSPORTE', M, y);
  doc.setLineWidth(0.4); doc.line(M, y + 1.2, M + doc.getTextWidth('PRESUPUESTO TRANSPORTE'), y + 1.2);
  if (d.numeroTexto) { doc.setFontSize(9); doc.text(`N° ${d.numeroTexto}`, W - M, y, { align: 'right' }); }
  y += 8;
  campo(doc, 'Fecha de Emisión:', d.fechaEmision || '', M, y, ancho); y += 6;
  campo(doc, 'Razón social del prestador:', t.razonSocial || '', M, y, ancho); y += 6;
  campo(doc, 'CUIT:', t.cuit || '', M, y, ancho); y += 6;
  campo(doc, 'Mail de contacto:', t.mail || '', M, y, mitad); campo(doc, 'Teléfono:', t.telefono || '', M + mitad + 6, y, mitad); y += 6;
  campo(doc, 'Compañía de Seguros:', t.aseguradora || '', M, y, mitad); campo(doc, 'Póliza N°:', t.poliza || '', M + mitad + 6, y, mitad); y += 6;
  campo(doc, 'Beneficiario:', b.nombre || '', M, y, mitad); campo(doc, 'DNI:', b.dni || '', M + mitad + 6, y, mitad); y += 6;
  campo(doc, 'Período: desde', periodoLabel(d.periodoDesde), M, y, mitad); campo(doc, 'hasta', periodoLabel(d.periodoHasta), M + mitad + 6, y, mitad); y += 9;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text('Diagrama de traslado:', M, y); y += 2;
  autoTable(doc, {
    startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { fontSize: 8, cellPadding: 1.6, textColor: NEGRO, lineColor: [150, 150, 150] },
    headStyles: { fillColor: GRIS, textColor: NEGRO, fontStyle: 'bold', halign: 'center' },
    columnStyles: { 0: { cellWidth: 11, halign: 'center' }, 3: { halign: 'center', cellWidth: 26 }, 4: { halign: 'right', cellWidth: 24 }, 5: { halign: 'right', cellWidth: 27 } },
    head: [['Viaje', 'Domicilio de partida', 'Domicilio de destino', 'Km por viaje', 'Importe diario', 'Importe mensual']],
    body: c.viajes.map((f, i) => {
      const v = d.viajes[i] || { id: f.id };
      return [f.id, limpio(v.origen || f.origen), limpio([v.destino || f.destino, v.centro && v.centro !== v.destino ? `(${v.centro})` : ''].filter(Boolean).join(' ')),
        `${kmPorViajeTexto(f)}${f.llevadoAlMinimo ? `\nse cobran ${fmt(f.kmFacturables)} km` : ''}`, pesos(f.importeDiario), pesos(f.importeMensual)];
    }),
  });
  y = (doc as DocAT).lastAutoTable.finalY + 5;

  doc.setFont('helvetica', 'bold'); doc.text('Cronograma de traslado:', M, y);
  const wCrono = doc.getTextWidth('Cronograma de traslado: ');          // se mide en negrita, antes de cambiar la fuente
  doc.setFont('helvetica', 'normal'); doc.text('marcar con una cruz los días de traslado.', M + wCrono, y); y += 2;
  autoTable(doc, {
    startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { fontSize: 8, cellPadding: 1.6, textColor: NEGRO, halign: 'center', lineColor: [150, 150, 150] },
    headStyles: { fillColor: GRIS, textColor: NEGRO, fontStyle: 'bold' }, columnStyles: { 0: { cellWidth: 11 } },
    head: [['Viaje', ...DIAS.map(x => x.label)]],
    body: c.viajes.map((f, i) => [f.id, ...DIAS.map(x => ((d.viajes[i]?.dias || f.dias || []).includes(x.k) ? 'X' : ''))]),
  });
  y = (doc as DocAT).lastAutoTable.finalY + 6;

  doc.setFontSize(9);
  campo(doc, 'Total Km. Mensuales:', `${fmt(c.kmMensuales, 2)} km`, M, y, 75); y += 6;
  const dep = c.valorKm;
  campo(doc, `Adicional dependencia ${fmt(dep.porcentaje)}% (Sujeto a evaluación):`, dep.aplicado ? 'Sí' : 'No', M, y, 135); y += 6;
  campo(doc, 'Valor del km:', dep.aplicado ? `${pesos(dep.final)}  (base ${pesos(dep.base)} + adicional ${pesos(dep.adicional)})` : pesos(dep.base), M, y, 120); y += 6;
  campo(doc, 'Monto mensual:', pesos(c.total), M, y, 75); y += 6;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(90);
  const nota = [`Valor del km según ${d.arancel.resolucion}${d.arancel.mes ? ` · ${d.arancel.mes}` : ''}${d.arancel.verificar ? ' (a verificar contra el Boletín Oficial)' : ''}.`,
    `Cada viaje: km × valor del km × días por semana × ${fmt(c.semanasPorMes)} semanas por mes.`];
  if (c.tramoCorto.activo) nota.push(`Tramo corto: mínimo de ${fmt(c.tramoCorto.kmMinimo)} km ${UNIDAD_TEXTO[c.tramoCorto.unidad || 'sentido']}${c.tramoCorto.viajesLlevadosAlMinimo?.length ? ` (viajes llevados al mínimo: ${c.tramoCorto.viajesLlevadosAlMinimo.join(', ')})` : ''}.`);
  if (c.ajusteDiario) nota.push(`Ajuste por mínimo diario: ${fmt(c.ajusteDiario.kmMes, 2)} km (${pesos(c.ajusteDiario.importeMensual)}).`);
  const sent = c.viajes.map(f => (sentidosTexto(f) ? `Viaje ${f.id}: ${sentidosTexto(f)}` : '')).filter(Boolean);
  if (sent.length) nota.push(sent.join(' · '));
  if (d.observaciones) nota.push(`Observaciones: ${limpio(d.observaciones)}`);
  nota.forEach(n => { const ls = doc.splitTextToSize(n, ancho); doc.text(ls, M, y); y += ls.length * 3.4; });
  doc.setTextColor(...NEGRO);

  // Firma del transportista
  y = Math.max(y + 12, 0);
  if (y > H - 100) { doc.addPage(); y = 25; }
  linea(doc, W / 2 - 38, W / 2 + 38, y); doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.text('Firma y Aclaración del Transportista', W / 2, y + 4.5, { align: 'center' });

  // Hoja de conformidad (la firma queda en blanco)
  y += 12;
  if (y > H - 92) { doc.addPage(); y = 18; }
  const alto = 84;
  doc.setDrawColor(60); doc.setLineWidth(0.3); doc.rect(M, y, ancho, alto);
  const x = M + 5, w = ancho - 10;
  let yy = y + 7;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text('CONFORMIDAD TRANSPORTE', x, yy); doc.line(x, yy + 1, x + doc.getTextWidth('CONFORMIDAD TRANSPORTE'), yy + 1); yy += 7;
  campo(doc, 'Fecha:', '', x, yy, w); yy += 6;
  campo(doc, 'Apellido y nombre del beneficiario:', b.nombre || '', x, yy, w); yy += 6;
  campo(doc, 'Número de Afiliado/DNI:', [b.afiliado, b.dni].filter(Boolean).join(' / '), x, yy, w); yy += 6;
  campo(doc, 'Yo', '', x, yy, w); yy += 6;
  campo(doc, 'con Documento Tipo DNI N°', '', x, yy, w); yy += 6;
  campo(doc, 'doy mi conformidad al diagrama de traslados por el período: desde', periodoLabel(d.periodoDesde), x, yy, w * 0.77); campo(doc, 'hasta', periodoLabel(d.periodoHasta), x + w * 0.79, yy, w * 0.21); yy += 11;
  campo(doc, 'Firma:', '', x, yy, w); yy += 6; campo(doc, 'Aclaración:', '', x, yy, w); yy += 8;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.text('SI EL FIRMANTE NO ES LA PERSONA CON DISCAPACIDAD, COMPLETAR:', x, yy); yy += 5;
  campo(doc, 'Por la presente, dejo constancia que la conformidad brindada es realizada en nombre de:', '', x, yy, w); yy += 5;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.text('Manifiesto ser el familiar responsable / tutor y autorizo el diagrama de traslados.', x, yy);
  return doc;
}

/* ── Formulario "Servicio de Traslados Programados" ──────────────────────── */
function traslados(d: PresupuestoDoc): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth(), ancho = W - 2 * M, mitad = ancho / 2 - 3;
  const t = d.transportista, b = d.beneficiario, c = d.calculo;
  doc.setTextColor(...NEGRO);
  let y = 16;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text('Servicio de Traslados Programados', M, y);
  doc.setFontSize(14); doc.text('PRESUPUESTO', W / 2, y + 9, { align: 'center' });
  if (d.numeroTexto) { doc.setFontSize(9); doc.text(`N° ${d.numeroTexto}`, W - M, y, { align: 'right' }); }
  y += 20; doc.setFontSize(9); doc.text('Datos del Transportista:', M, y); linea(doc, M, W - M, y + 1.5); y += 7;
  campo(doc, 'Razón Social:', t.razonSocial || '', M, y, ancho); y += 6;
  campo(doc, 'Nombre del Responsable:', t.responsable || '', M, y, ancho); y += 6;
  campo(doc, 'C.U.I.T.:', t.cuit || '', M, y, ancho); y += 6;
  campo(doc, 'Domicilio:', t.domicilio || '', M, y, ancho); y += 6;
  campo(doc, 'Cel.:', t.telefono || '', M, y, mitad); campo(doc, 'Mail:', t.mail || '', M + mitad + 6, y, mitad); y += 9;
  doc.setFont('helvetica', 'bold'); doc.text('Datos del Beneficiado', M, y);
  doc.setFont('helvetica', 'normal'); doc.text(`Obra Social [X]   Particular [  ]`, M + 50, y); y += 6;
  campo(doc, 'Prestadora:', d.obraNombre, M, y, mitad); campo(doc, 'N° de Afiliado:', b.afiliado || '', M + mitad + 6, y, mitad); y += 6;
  campo(doc, 'Apellido y Nombre:', b.nombre || '', M, y, ancho); y += 6;
  campo(doc, 'D.N.I.:', b.dni || '', M, y, ancho); y += 6;
  campo(doc, 'Domicilio de Origen:', b.domicilio || '', M, y, ancho); y += 6;
  campo(doc, 'Localidad:', b.localidad || '', M, y, ancho); y += 6;
  campo(doc, 'Tutor o Encargado:', b.tutor || '', M, y, ancho); y += 6;
  campo(doc, 'N° de contacto:', b.contacto || '', M, y, ancho); y += 9;
  doc.setFont('helvetica', 'bold'); doc.text('Beneficiado debe ser trasladado a:', M, y); y += 2;
  autoTable(doc, {
    startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { fontSize: 8, cellPadding: 1.6, textColor: NEGRO, lineColor: [150, 150, 150] },
    headStyles: { fillColor: GRIS, textColor: NEGRO, fontStyle: 'bold', halign: 'center' }, columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' }, 4: { halign: 'center' } },
    head: [['Destino / Prestador', 'Días', 'Km diarios (ida y vta.)', 'Viajes mens.', 'Km mens.']],
    body: c.viajes.map((f, i) => {
      const v = d.viajes[i] || { id: f.id };
      return [limpio([v.destino, v.centro && v.centro !== v.destino ? v.centro : ''].filter(Boolean).join(' · ') || f.destino),
        (v.dias || f.dias || []).map(k => DIAS.find(x => x.k === k)?.label.slice(0, 3)).join(', '), fmt(f.kmFacturables), fmt(f.viajesMes), fmt(f.kmMes, 1)];
    }),
  });
  y = (doc as DocAT).lastAutoTable.finalY + 6; doc.setFontSize(9);
  const fila = (et: string, val: string, negrita = false) => { doc.setFont('helvetica', negrita ? 'bold' : 'normal'); doc.text(et, M, y); doc.text(val, W - M - 20, y, { align: 'right' }); y += 5.5; };
  fila('Cantidad de viajes mensuales (ida y vuelta):', fmt(c.viajes.reduce((s, f) => s + f.viajesMes, 0)));
  fila('Km. mensuales:', fmt(c.kmMensuales, 2));
  fila(c.valorKm.aplicado ? `Valor del km (incluye adicional por dependencia ${fmt(c.valorKm.porcentaje)}%):` : 'Valor del km:', pesos(c.valorKm.final));
  fila('Valor mensual del traslado:', pesos(c.total), true);
  y += 2; doc.setFontSize(8);
  const obs = limpio(['Sujeto a cambios en el valor mensual dependiendo de la legislación vigente por parte del Ministerio de Salud y la Agencia Nacional de Discapacidad.',
    `Valor del km según ${d.arancel.resolucion}${d.arancel.mes ? ` · ${d.arancel.mes}` : ''}.`, d.observaciones || ''].filter(Boolean).join(' '));
  doc.setFont('helvetica', 'bold'); doc.text('Observaciones:', M, y); doc.setFont('helvetica', 'normal');
  const ls = doc.splitTextToSize(obs, ancho - 28); doc.text(ls, M + 26, y); y += ls.length * 3.6 + 6;
  doc.setFontSize(9); doc.text(`Beneficiario con acompañante:   SI [${d.acompanante ? 'X' : ' '}]   NO [${d.acompanante ? ' ' : 'X'}]`, M, y); y += 26;
  linea(doc, M, M + 70, y); linea(doc, W - M - 70, W - M, y);
  doc.setFontSize(8.5); doc.text('Firma y aclaración beneficiario', M + 35, y + 4.5, { align: 'center' }); doc.text('Firma responsable', W - M - 35, y + 4.5, { align: 'center' }); doc.text('DNI', W - M - 35, y + 10, { align: 'center' });
  return doc;
}

export function generarPdf(d: PresupuestoDoc): jsPDF { return d.formato === 'traslados_programados' ? traslados(d) : multiViaje(d); }
export function nombreArchivo(d: PresupuestoDoc): string {
  const base = (d.beneficiario.nombre || 'paciente').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 30);
  return `presupuesto-${d.numeroTexto || 'borrador'}-${base}.pdf`;
}
export function descargarPdf(d: PresupuestoDoc) { generarPdf(d).save(nombreArchivo(d)); }
