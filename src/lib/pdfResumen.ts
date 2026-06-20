import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/* ── Brand colors ────────────────────────────────────────────────────────── */
type RGB = [number, number, number];
const PURPLE:  RGB = [108, 95, 255];
const PURPLE_D:RGB = [75,  71, 219];
const BG:      RGB = [26,  33,  66];
const WHITE:   RGB = [255, 255, 255];
const TEXT2:   RGB = [176, 184, 212];
const TEXT3:   RGB = [107, 118, 153];
const AMBER:   RGB = [245, 158,  11];
const GREEN:   RGB = [16,  185, 129];
const BORDER:  RGB = [45,   58, 110];

/* ── Helpers de color (evita problemas con spread en overloads) ──────────── */
const fill  = (doc:jsPDF, c:RGB) => doc.setFillColor (c[0], c[1], c[2]);
const tColor= (doc:jsPDF, c:RGB) => doc.setTextColor (c[0], c[1], c[2]);

/* ── Tipos exportados ────────────────────────────────────────────────────── */
export interface EgresoR { categoria:string; proveedor:string; monto:number; concepto:string; tipoComprobante:string; }
export interface RemitoR { nroRemito:string; razonSocial:string; combustible:number; monto:number; tipoCombustible:string; }
export interface ChicoR  { nombre:string; domicilio:string; }
export interface ChoferR {
  email:string; nombre:string; vehiculo:string;
  km:{ inicial:number; final:number; recorridos:number };
  montoTotal:number; observaciones:string;
  egresos:EgresoR[]; remitos:RemitoR[]; chicos:ChicoR[];
}

/* ── Helpers de formato ──────────────────────────────────────────────────── */
const $ar  = (n:number) => `$${n.toLocaleString('es-AR',{minimumFractionDigits:0,maximumFractionDigits:0})}`;
const safe = (s:string) => s.replace(/[^a-zA-Z0-9_-]/g,'_');
const isoToDMY = (iso:string) => iso.split('-').reverse().join('/');

/* ── jsPDF + autoTable: tipo extendido ───────────────────────────────────── */
interface JsPDFAT extends jsPDF {
  lastAutoTable: { finalY: number };
}

/* ════════════════════════════════════════════════════════════════════════════
   exportarResumenPDF
   ════════════════════════════════════════════════════════════════════════════ */
export function exportarResumenPDF(chofer:ChoferR, fechaISO:string, empresa = 'Transit·Ya') {
  const doc  = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' }) as JsPDFAT;
  const W    = doc.internal.pageSize.getWidth();
  const fecha= isoToDMY(fechaISO);
  let   y    = 0;

  /* ── Header band ──────────────────────────────────────────────────────── */
  fill(doc, PURPLE);
  doc.rect(0, 0, W, 22, 'F');

  tColor(doc, WHITE);
  doc.setFontSize(15);
  doc.setFont('helvetica','bold');
  doc.text(empresa.toUpperCase(), 14, 10);

  doc.setFontSize(9);
  doc.setFont('helvetica','normal');
  tColor(doc, TEXT2);
  doc.text('RESUMEN DIARIO', 14, 17);
  doc.text(fecha, W - 14, 17, {align:'right'});
  y = 30;

  /* ── Datos del chofer ─────────────────────────────────────────────────── */
  fill(doc, BG);
  doc.roundedRect(14, y, W - 28, 22, 3, 3, 'F');

  doc.setFont('helvetica','bold');
  doc.setFontSize(11);
  tColor(doc, WHITE);
  doc.text(chofer.nombre, 20, y + 7);

  doc.setFont('helvetica','normal');
  doc.setFontSize(9);
  tColor(doc, TEXT2);
  if (chofer.vehiculo) doc.text(`Vehiculo: ${chofer.vehiculo}`, 20, y + 14);

  /* KM + monto en columnas derechas */
  const kmCols: {l:string;v:string;c:RGB}[] = [
    {l:'KM INICIAL',  v:String(chofer.km.inicial),            c:TEXT2},
    {l:'KM FINAL',    v:String(chofer.km.final),              c:TEXT2},
    {l:'RECORRIDOS',  v:`${chofer.km.recorridos} km`,         c:PURPLE},
    {l:'MONTO TOTAL', v:$ar(chofer.montoTotal),               c:GREEN},
  ];
  kmCols.forEach((col, i) => {
    const xBase = W - 14 - (kmCols.length - i - 1) * 40;
    doc.setFontSize(7);
    tColor(doc, TEXT3);
    doc.text(col.l, xBase, y + 6, {align:'right'});
    doc.setFontSize(10);
    doc.setFont('helvetica','bold');
    tColor(doc, col.c);
    doc.text(col.v, xBase, y + 14, {align:'right'});
    doc.setFont('helvetica','normal');
  });
  y += 30;

  /* ── Tabla egresos ────────────────────────────────────────────────────── */
  y = sectionTitle(doc, 'EGRESOS', y, W) + 2;

  if (chofer.egresos.length === 0) {
    y = emptyRow(doc, 'Sin egresos registrados', y, W) + 4;
  } else {
    autoTable(doc, {
      startY: y,
      margin: {left:14, right:14},
      head: [['Categoria','Proveedor','Concepto','Tipo','Monto']],
      body: chofer.egresos.map(e => [
        e.categoria||'—', e.proveedor||'—', e.concepto||'—', e.tipoComprobante||'—', $ar(e.monto),
      ]),
      foot: [[
        {content:'TOTAL', colSpan:4, styles:{halign:'right' as const,fontStyle:'bold' as const,fillColor:BG,textColor:TEXT3}},
        {content:$ar(chofer.egresos.reduce((s,e)=>s+e.monto,0)), styles:{fontStyle:'bold' as const,fillColor:BG,textColor:AMBER}},
      ]],
      styles:       tStyles(),
      headStyles:   hStyles(),
      columnStyles: {4:{halign:'right' as const}},
      showFoot:    'lastPage',
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  /* ── Tabla remitos ────────────────────────────────────────────────────── */
  y = sectionTitle(doc, 'REMITOS', y, W) + 2;

  if (chofer.remitos.length === 0) {
    y = emptyRow(doc, 'Sin remitos registrados', y, W) + 4;
  } else {
    const totalL = chofer.remitos.reduce((s,r)=>s+r.combustible,0);
    autoTable(doc, {
      startY: y,
      margin: {left:14, right:14},
      head: [['Nro Remito','Razon Social','Litros','Tipo','Monto']],
      body: chofer.remitos.map(r => [
        r.nroRemito||'—', r.razonSocial||'—',
        r.combustible>0 ? `${r.combustible} L` : '—',
        r.tipoCombustible||'—', $ar(r.monto),
      ]),
      foot: [[
        {content:`${totalL.toLocaleString('es-AR')} L total`, colSpan:2, styles:{halign:'left' as const,fillColor:BG,textColor:TEXT3}},
        {content:'', colSpan:2, styles:{fillColor:BG,textColor:TEXT3}},
        {content:$ar(chofer.remitos.reduce((s,r)=>s+r.monto,0)), styles:{fontStyle:'bold' as const,fillColor:BG,textColor:AMBER}},
      ]],
      styles:       tStyles(),
      headStyles:   hStyles(),
      columnStyles: {4:{halign:'right' as const}},
      showFoot:    'lastPage',
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  /* ── Observaciones ────────────────────────────────────────────────────── */
  if (chofer.observaciones) {
    y = sectionTitle(doc, 'OBSERVACIONES', y, W) + 2;
    fill(doc, BG);
    doc.rect(14, y, W - 28, 13, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica','normal');
    tColor(doc, TEXT2);
    doc.text(chofer.observaciones, 19, y + 7, {maxWidth: W - 42});
    y += 19;
  }

  /* ── Beneficiarios ────────────────────────────────────────────────────── */
  y = sectionTitle(doc, `BENEFICIARIOS (${chofer.chicos.length})`, y, W) + 2;

  if (chofer.chicos.length === 0) {
    emptyRow(doc, 'Sin asistencia asignada para esta fecha', y, W);
  } else {
    autoTable(doc, {
      startY: y,
      margin: {left:14, right:14},
      head: [['#','Nombre','Domicilio']],
      body: chofer.chicos.map((b,i) => [String(i+1), b.nombre, b.domicilio||'—']),
      styles:       tStyles(),
      headStyles:   hStyles(),
      columnStyles: {0:{cellWidth:10,halign:'center' as const}},
    });
  }

  /* ── Footer en cada página ────────────────────────────────────────────── */
  const totalPags = doc.getNumberOfPages();
  const now = new Date().toLocaleString('es-AR',{
    day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'
  });
  for (let p = 1; p <= totalPags; p++) {
    doc.setPage(p);
    const H = doc.internal.pageSize.getHeight();
    fill(doc, BG);
    doc.rect(0, H - 10, W, 10, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica','normal');
    tColor(doc, TEXT3);
    doc.text(`Generado el ${now} — ${empresa}`, 14, H - 3);
    doc.text(`Pag. ${p} / ${totalPags}`, W - 14, H - 3, {align:'right'});
  }

  doc.save(`resumen_${safe(chofer.nombre)}_${fechaISO}.pdf`);
}

/* ── Helpers internos ────────────────────────────────────────────────────── */
function sectionTitle(doc:jsPDF, title:string, y:number, W:number): number {
  fill(doc, PURPLE_D);
  doc.rect(14, y, W - 28, 7, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica','bold');
  tColor(doc, WHITE);
  doc.text(title, 18, y + 4.8);
  return y + 7;
}

function emptyRow(doc:jsPDF, text:string, y:number, W:number): number {
  fill(doc, BG);
  doc.rect(14, y, W - 28, 8, 'F');
  doc.setFontSize(8.5);
  doc.setFont('helvetica','italic');
  tColor(doc, TEXT3);
  doc.text(text, 18, y + 5.2);
  return y + 8;
}

function tStyles(): object {
  return {
    fontSize: 8.5,
    cellPadding: {top:2.5, right:3, bottom:2.5, left:3},
    fillColor: BG,
    textColor: TEXT2,
    lineColor: BORDER,
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
