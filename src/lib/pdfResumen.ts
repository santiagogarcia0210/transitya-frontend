import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/* ── Paleta PDF (fondo claro, imprimible) ────────────────────────────────── */
type RGB = [number, number, number];
const PURPLE:  RGB = [108,  95, 255];  // #6C5FFF
const WHITE:   RGB = [255, 255, 255];
const GRAY_BG: RGB = [245, 245, 245];
const GRAY_TOT:RGB = [234, 234, 234];
const GRAY_BOR:RGB = [221, 221, 221];
const BLACK:   RGB = [ 26,  26,  26];
const GRAY_LB: RGB = [102, 102, 102];
const GREEN_D: RGB = [ 26, 127,  75];
const GRAY_FT: RGB = [120, 120, 120];

const fill  = (doc:jsPDF, c:RGB) => doc.setFillColor(c[0], c[1], c[2]);
const tColor= (doc:jsPDF, c:RGB) => doc.setTextColor(c[0], c[1], c[2]);

/* ── Tipos exportados ────────────────────────────────────────────────────── */
export interface EgresoR { fecha?:string; categoria:string; proveedor:string; monto:number; concepto:string; tipoComprobante:string; }
export interface RemitoR { fecha?:string; nroRemito:string; razonSocial:string; combustible:number; monto:number; tipoCombustible:string; }
export interface ChicoR  { nombre:string; domicilio:string; diasTransportado?:number; }
export interface ChoferR {
  email:string; nombre:string; vehiculo:string;
  km:{ inicial:number; final:number; recorridos:number };
  diasActivos?:number;
  montoTotal:number; observaciones:string;
  egresos:EgresoR[]; remitos:RemitoR[]; chicos:ChicoR[];
}

/* ── Tipo para export de egresos consolidado ─────────────────────────────── */
export interface EgresoExport {
  fecha:string; chofer:string; categoria:string; proveedor:string; concepto:string; monto:number;
}

/* ── Helpers de formato ──────────────────────────────────────────────────── */
const $ar  = (n:number) => `$${n.toLocaleString('es-AR',{minimumFractionDigits:0,maximumFractionDigits:0})}`;
const safe = (s:string) => s.replace(/[^a-zA-Z0-9_-]/g,'_');
const isoToDMY = (iso:string) => iso.split('-').reverse().join('/');

const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const mesLabel = (ym:string) => {
  const [y,m] = ym.split('-');
  return `${MESES_ES[parseInt(m)-1]||m} ${y}`;
};

interface JsPDFAT extends jsPDF { lastAutoTable: { finalY: number }; }

/* ── Helpers internos ────────────────────────────────────────────────────── */
function sectionTitle(doc:jsPDF, title:string, y:number, W:number): number {
  fill(doc, PURPLE);
  doc.rect(14, y, W - 28, 7, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica','bold');
  tColor(doc, WHITE);
  doc.text(title, 18, y + 4.8);
  return y + 7;
}

function emptyRow(doc:jsPDF, text:string, y:number, W:number): number {
  fill(doc, GRAY_BG);
  doc.rect(14, y, W - 28, 8, 'F');
  doc.setFontSize(8.5);
  doc.setFont('helvetica','italic');
  tColor(doc, GRAY_LB);
  doc.text(text, 18, y + 5.2);
  return y + 8;
}

function tStyles(): object {
  return {
    fontSize: 8.5,
    cellPadding: {top:2.5, right:3, bottom:2.5, left:3},
    fillColor: WHITE,
    textColor: BLACK,
    lineColor: GRAY_BOR,
    lineWidth: 0.2,
    font: 'helvetica',
  };
}

function hStyles(): object {
  return {
    fillColor: PURPLE,
    textColor: WHITE,
    fontStyle: 'bold' as const,
    fontSize: 8,
    cellPadding: {top:3, right:3, bottom:3, left:3},
  };
}

function buildHeader(doc:jsPDF, W:number, empresa:string, subtitle:string, fechaLabel:string): number {
  fill(doc, WHITE);
  doc.rect(0, 0, W, doc.internal.pageSize.getHeight(), 'F');

  fill(doc, PURPLE);
  doc.rect(0, 0, W, 22, 'F');
  tColor(doc, WHITE);
  doc.setFontSize(15);
  doc.setFont('helvetica','bold');
  doc.text(empresa.toUpperCase(), 14, 10);
  doc.setFontSize(9);
  doc.setFont('helvetica','normal');
  doc.text(subtitle, 14, 17);
  doc.text(fechaLabel, W - 14, 17, {align:'right'});
  return 30;
}

function buildChoferBlock(
  doc:jsPDF, W:number, y:number, chofer:ChoferR,
  kmCols:{l:string;v:string;c:RGB}[]
): number {
  fill(doc, GRAY_BG);
  doc.setDrawColor(GRAY_BOR[0], GRAY_BOR[1], GRAY_BOR[2]);
  doc.setLineWidth(0.3);
  doc.roundedRect(14, y, W - 28, 24, 3, 3, 'FD');

  doc.setFont('helvetica','bold');
  doc.setFontSize(12);
  tColor(doc, BLACK);
  doc.text(chofer.nombre, 20, y + 8);

  doc.setFont('helvetica','normal');
  doc.setFontSize(9);
  tColor(doc, GRAY_LB);
  if (chofer.vehiculo) doc.text(`Vehiculo: ${chofer.vehiculo}`, 20, y + 15);

  kmCols.forEach((col, i) => {
    const xBase = W - 14 - (kmCols.length - i - 1) * 40;
    doc.setFontSize(7);
    tColor(doc, GRAY_LB);
    doc.text(col.l, xBase, y + 7, {align:'right'});
    doc.setFontSize(10);
    doc.setFont('helvetica','bold');
    tColor(doc, col.c);
    doc.text(col.v, xBase, y + 15, {align:'right'});
    doc.setFont('helvetica','normal');
  });
  return y + 32;
}

function addFooters(doc:jsPDF, W:number, empresa:string): void {
  const totalPags = doc.getNumberOfPages();
  const now = new Date().toLocaleString('es-AR',{
    day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit',
  });
  for (let p = 1; p <= totalPags; p++) {
    doc.setPage(p);
    const H = doc.internal.pageSize.getHeight();
    doc.setDrawColor(GRAY_BOR[0], GRAY_BOR[1], GRAY_BOR[2]);
    doc.setLineWidth(0.3);
    doc.line(14, H - 11, W - 14, H - 11);
    doc.setFontSize(7);
    doc.setFont('helvetica','normal');
    tColor(doc, GRAY_FT);
    doc.text(`Generado el ${now} — ${empresa}`, 14, H - 4);
    doc.text(`Pag. ${p} / ${totalPags}`, W - 14, H - 4, {align:'right'});
  }
}

/* ════════════════════════════════════════════════════════════════════════════
   exportarResumenPDF — Resumen DIARIO
   ════════════════════════════════════════════════════════════════════════════ */
export function exportarResumenPDF(chofer:ChoferR, fechaISO:string, empresa = 'Transit·Ya') {
  const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' }) as JsPDFAT;
  const W   = doc.internal.pageSize.getWidth();

  let y = buildHeader(doc, W, empresa, 'RESUMEN DIARIO', isoToDMY(fechaISO));

  const kmCols: {l:string;v:string;c:RGB}[] = [
    {l:'KM INICIAL',  v:String(chofer.km.inicial),    c:BLACK},
    {l:'KM FINAL',    v:String(chofer.km.final),      c:BLACK},
    {l:'RECORRIDOS',  v:`${chofer.km.recorridos} km`, c:BLACK},
    {l:'MONTO TOTAL', v:$ar(chofer.montoTotal),        c:GREEN_D},
  ];
  y = buildChoferBlock(doc, W, y, chofer, kmCols);

  /* EGRESOS */
  y = sectionTitle(doc, 'EGRESOS', y, W) + 2;
  if (chofer.egresos.length === 0) {
    y = emptyRow(doc, 'Sin egresos registrados', y, W) + 4;
  } else {
    const totalEg = chofer.egresos.reduce((s,e)=>s+e.monto,0);
    autoTable(doc, {
      startY: y, margin: {left:14, right:14},
      head: [['Categoria','Proveedor','Concepto','Tipo','Monto']],
      body: chofer.egresos.map(e => [
        e.categoria||'—', e.proveedor||'—', e.concepto||'—', e.tipoComprobante||'—', $ar(e.monto),
      ]),
      foot: [[
        {content:'TOTAL', colSpan:4, styles:{halign:'right' as const, fontStyle:'bold' as const, fillColor:GRAY_TOT, textColor:GRAY_LB}},
        {content:$ar(totalEg), styles:{fontStyle:'bold' as const, fillColor:GRAY_TOT, textColor:BLACK}},
      ]],
      styles: tStyles(), headStyles: hStyles(), alternateRowStyles: {fillColor:GRAY_BG},
      columnStyles: {4:{halign:'right' as const}}, showFoot:'lastPage',
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  /* REMITOS */
  y = sectionTitle(doc, 'REMITOS', y, W) + 2;
  if (chofer.remitos.length === 0) {
    y = emptyRow(doc, 'Sin remitos registrados', y, W) + 4;
  } else {
    const totalL  = chofer.remitos.reduce((s,r)=>s+r.combustible,0);
    const totalRm = chofer.remitos.reduce((s,r)=>s+r.monto,0);
    autoTable(doc, {
      startY: y, margin: {left:14, right:14},
      head: [['Nro Remito','Razon Social','Litros','Tipo','Monto']],
      body: chofer.remitos.map(r => [
        r.nroRemito||'—', r.razonSocial||'—',
        r.combustible>0 ? `${r.combustible} L` : '—',
        r.tipoCombustible||'—', $ar(r.monto),
      ]),
      foot: [[
        {content:`${totalL.toLocaleString('es-AR')} L total`, colSpan:2, styles:{halign:'left' as const, fillColor:GRAY_TOT, textColor:GRAY_LB}},
        {content:'', colSpan:2, styles:{fillColor:GRAY_TOT, textColor:GRAY_LB}},
        {content:$ar(totalRm), styles:{fontStyle:'bold' as const, fillColor:GRAY_TOT, textColor:BLACK}},
      ]],
      styles: tStyles(), headStyles: hStyles(), alternateRowStyles: {fillColor:GRAY_BG},
      columnStyles: {4:{halign:'right' as const}}, showFoot:'lastPage',
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  /* OBSERVACIONES */
  if (chofer.observaciones) {
    y = sectionTitle(doc, 'OBSERVACIONES', y, W) + 2;
    fill(doc, GRAY_BG);
    doc.setDrawColor(GRAY_BOR[0], GRAY_BOR[1], GRAY_BOR[2]);
    doc.rect(14, y, W - 28, 13, 'FD');
    doc.setFontSize(9);
    doc.setFont('helvetica','normal');
    tColor(doc, BLACK);
    doc.text(chofer.observaciones, 19, y + 7, {maxWidth: W - 42});
    y += 19;
  }

  /* BENEFICIARIOS */
  y = sectionTitle(doc, `BENEFICIARIOS (${chofer.chicos.length})`, y, W) + 2;
  if (chofer.chicos.length === 0) {
    emptyRow(doc, 'Sin asistencia asignada para esta fecha', y, W);
  } else {
    autoTable(doc, {
      startY: y, margin: {left:14, right:14},
      head: [['#','Nombre','Domicilio']],
      body: chofer.chicos.map((b,i) => [String(i+1), b.nombre, b.domicilio||'—']),
      styles: tStyles(), headStyles: hStyles(), alternateRowStyles: {fillColor:GRAY_BG},
      columnStyles: {0:{cellWidth:10, halign:'center' as const}},
    });
  }

  addFooters(doc, W, empresa);
  doc.save(`resumen_${safe(chofer.nombre)}_${fechaISO}.pdf`);
}

/* ════════════════════════════════════════════════════════════════════════════
   exportarResumenMensualPDF — Resumen MENSUAL
   ════════════════════════════════════════════════════════════════════════════ */
export function exportarResumenMensualPDF(chofer:ChoferR, mesISO:string, empresa = 'Transit·Ya') {
  const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' }) as JsPDFAT;
  const W   = doc.internal.pageSize.getWidth();

  let y = buildHeader(doc, W, empresa, 'RESUMEN MENSUAL', mesLabel(mesISO));

  const kmCols: {l:string;v:string;c:RGB}[] = [
    {l:'KM INI (1er día)',  v:String(chofer.km.inicial),    c:BLACK},
    {l:'KM FIN (últ. día)', v:String(chofer.km.final),      c:BLACK},
    {l:'KM DEL MES',        v:`${chofer.km.recorridos} km`, c:BLACK},
    {l:'MONTO TOTAL',       v:$ar(chofer.montoTotal),        c:GREEN_D},
  ];
  y = buildChoferBlock(doc, W, y, chofer, kmCols);

  /* EGRESOS (con columna Fecha) */
  y = sectionTitle(doc, 'EGRESOS', y, W) + 2;
  if (chofer.egresos.length === 0) {
    y = emptyRow(doc, 'Sin egresos en el mes', y, W) + 4;
  } else {
    const totalEg = chofer.egresos.reduce((s,e)=>s+e.monto,0);
    autoTable(doc, {
      startY: y, margin: {left:14, right:14},
      head: [['Fecha','Categoria','Proveedor','Concepto','Tipo','Monto']],
      body: chofer.egresos.map(e => [
        e.fecha||'—', e.categoria||'—', e.proveedor||'—', e.concepto||'—', e.tipoComprobante||'—', $ar(e.monto),
      ]),
      foot: [[
        {content:'TOTAL', colSpan:5, styles:{halign:'right' as const, fontStyle:'bold' as const, fillColor:GRAY_TOT, textColor:GRAY_LB}},
        {content:$ar(totalEg), styles:{fontStyle:'bold' as const, fillColor:GRAY_TOT, textColor:BLACK}},
      ]],
      styles: tStyles(), headStyles: hStyles(), alternateRowStyles: {fillColor:GRAY_BG},
      columnStyles: {0:{cellWidth:22}, 5:{halign:'right' as const}}, showFoot:'lastPage',
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  /* REMITOS (con columna Fecha) */
  y = sectionTitle(doc, 'REMITOS', y, W) + 2;
  if (chofer.remitos.length === 0) {
    y = emptyRow(doc, 'Sin remitos en el mes', y, W) + 4;
  } else {
    const totalL  = chofer.remitos.reduce((s,r)=>s+r.combustible,0);
    const totalRm = chofer.remitos.reduce((s,r)=>s+r.monto,0);
    autoTable(doc, {
      startY: y, margin: {left:14, right:14},
      head: [['Fecha','Nro Remito','Razon Social','Litros','Tipo','Monto']],
      body: chofer.remitos.map(r => [
        r.fecha||'—', r.nroRemito||'—', r.razonSocial||'—',
        r.combustible>0 ? `${r.combustible} L` : '—',
        r.tipoCombustible||'—', $ar(r.monto),
      ]),
      foot: [[
        {content:`${totalL.toLocaleString('es-AR')} L total`, colSpan:3, styles:{halign:'left' as const, fillColor:GRAY_TOT, textColor:GRAY_LB}},
        {content:'', colSpan:2, styles:{fillColor:GRAY_TOT, textColor:GRAY_LB}},
        {content:$ar(totalRm), styles:{fontStyle:'bold' as const, fillColor:GRAY_TOT, textColor:BLACK}},
      ]],
      styles: tStyles(), headStyles: hStyles(), alternateRowStyles: {fillColor:GRAY_BG},
      columnStyles: {0:{cellWidth:22}, 5:{halign:'right' as const}}, showFoot:'lastPage',
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  /* OBSERVACIONES */
  if (chofer.observaciones) {
    y = sectionTitle(doc, 'OBSERVACIONES', y, W) + 2;
    fill(doc, GRAY_BG);
    doc.setDrawColor(GRAY_BOR[0], GRAY_BOR[1], GRAY_BOR[2]);
    const obsH = Math.max(13, chofer.observaciones.split('\n').length * 5 + 6);
    doc.rect(14, y, W - 28, obsH, 'FD');
    doc.setFontSize(9);
    doc.setFont('helvetica','normal');
    tColor(doc, BLACK);
    doc.text(chofer.observaciones, 19, y + 5, {maxWidth: W - 42});
    y += obsH + 6;
  }

  /* BENEFICIARIOS DEL MES */
  y = sectionTitle(doc, `BENEFICIARIOS DEL MES (${chofer.chicos.length})`, y, W) + 2;
  if (chofer.chicos.length === 0) {
    emptyRow(doc, 'Sin asistencia en el mes', y, W);
  } else {
    autoTable(doc, {
      startY: y, margin: {left:14, right:14},
      head: [['#','Nombre','Domicilio','Días']],
      body: chofer.chicos.map((b,i) => [
        String(i+1), b.nombre, b.domicilio||'—', String(b.diasTransportado||1),
      ]),
      styles: tStyles(), headStyles: hStyles(), alternateRowStyles: {fillColor:GRAY_BG},
      columnStyles: {
        0:{cellWidth:10, halign:'center' as const},
        3:{cellWidth:14, halign:'center' as const},
      },
    });
  }

  addFooters(doc, W, empresa);
  doc.save(`resumen_mensual_${safe(chofer.nombre)}_${mesISO}.pdf`);
}

/* ════════════════════════════════════════════════════════════════════════════
   exportarEgresosMensualPDF — todos los choferes, cronológico
   ════════════════════════════════════════════════════════════════════════════ */
export function exportarEgresosMensualPDF(
  egresos: EgresoExport[],
  mesISO: string,
  empresa = 'Transit·Ya',
) {
  const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' }) as JsPDFAT;
  const W   = doc.internal.pageSize.getWidth();

  let y = buildHeader(doc, W, empresa, 'EGRESOS', mesLabel(mesISO));

  /* Línea resumen */
  const totalMonto = egresos.reduce((s, e) => s + e.monto, 0);
  doc.setFontSize(9);
  doc.setFont('helvetica','normal');
  tColor(doc, GRAY_LB);
  doc.text(`Total de registros: ${egresos.length}`, 14, y);
  tColor(doc, BLACK);
  doc.setFont('helvetica','bold');
  doc.text($ar(totalMonto), W - 14, y, { align:'right' });
  doc.setFont('helvetica','normal');
  y += 9;

  if (egresos.length === 0) {
    emptyRow(doc, 'Sin egresos para el período seleccionado', y, W);
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left:14, right:14 },
      head: [['Fecha','Chofer','Categoría','Proveedor','Concepto','Monto']],
      body: egresos.map(e => [
        e.fecha||'—', e.chofer||'—', e.categoria||'—',
        e.proveedor||'—', e.concepto||'—', $ar(e.monto),
      ]),
      foot: [[
        { content:'TOTAL', colSpan:5,
          styles:{ halign:'right' as const, fontStyle:'bold' as const, fillColor:GRAY_TOT, textColor:GRAY_LB } },
        { content:$ar(totalMonto),
          styles:{ fontStyle:'bold' as const, fillColor:GRAY_TOT, textColor:BLACK } },
      ]],
      styles: tStyles(),
      headStyles: hStyles(),
      alternateRowStyles: { fillColor:GRAY_BG },
      columnStyles: {
        0:{ cellWidth:22 },
        5:{ halign:'right' as const },
      },
      showFoot: 'lastPage',
    });
  }

  addFooters(doc, W, empresa);
  doc.save(`egresos_${mesISO}.pdf`);
}
