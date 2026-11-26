// src/lib/lecturaIA.ts: helpers puros de la lectura de documentos con IA (fechas, propuesta, confirmación).
// La parte que usa el navegador (canvas, createImageBitmap) no se prueba acá.
import { test, describe } from 'node:test';
import assert from 'node:assert';

const L = await import('../src/lib/lecturaIA.ts');

const lectura = (extra = {}) => ({
  ok: true, indice: 0, nombreArchivo: 'foto.jpg', hash: 'a'.repeat(64), archivoUrl: 'https://x.test/a', archivoNombre: 'foto.jpg',
  repetido: false, yaCargado: null, legible: true, requisitoKey: 'orden_medica', tipoSugerido: 'Orden médica',
  fechaEmision: '10/10/2026', fechaVenc: '10/04/2027', fechaVencCalculada: true,
  paciente: { nombre: '', dni: '', obraSocial: '', afiliado: '' }, emisor: '', presupuesto: null,
  confianza: { tipo: 'alta', fechaEmision: 'alta', fechaVenc: 'media', paciente: 'baja', emisor: 'baja' }, confianzaGeneral: 'media',
  advertencias: [], coincidePaciente: true, posiblePacienteEquivocado: false, ...extra,
});

describe('fechas', () => {
  test('dd/MM/yyyy ↔ yyyy-mm-dd', () => {
    assert.strictEqual(L.dmyAIso('05/11/2026'), '2026-11-05');
    assert.strictEqual(L.dmyAIso('5/1/2026'), '2026-01-05');
    assert.strictEqual(L.isoADmy('2026-11-05'), '05/11/2026');
    assert.strictEqual(L.dmyAIso(''), '');
    assert.strictEqual(L.isoADmy('basura'), '');
  });
});

describe('propuesta y confirmación', () => {
  test('la propuesta parte de lo que leyó la IA, con fechas listas para el <input type="date">', () => {
    const p = L.propuestaDe(lectura());
    assert.strictEqual(p.fechaEmision, '2026-10-10');
    assert.strictEqual(p.fechaVenc, '2027-04-10');
    assert.strictEqual(p.estado, 'pendiente');
  });
  test('un archivo que ya estaba cargado en la carpeta entra como guardado (no se vuelve a confirmar)', () => {
    const p = L.propuestaDe(lectura({ yaCargado: { docId: 'd1' } }));
    assert.strictEqual(p.estado, 'guardada');
    assert.strictEqual(L.puedeConfirmar(p), false);
  });
  test('documento de otra persona: no se puede confirmar sin tildar la confirmación explícita', () => {
    const p = L.propuestaDe(lectura({ posiblePacienteEquivocado: true, coincidePaciente: false }));
    assert.strictEqual(L.puedeConfirmar(p), false);
    assert.strictEqual(L.puedeConfirmar({ ...p, aceptarPacienteDistinto: true }), true);
  });
  test('"otro" sin nombre no se puede confirmar', () => {
    const p = L.propuestaDe(lectura({ requisitoKey: 'otro', tipoSugerido: '' }));
    assert.strictEqual(L.puedeConfirmar(p), false);
    assert.strictEqual(L.puedeConfirmar({ ...p, nombre: 'Nota de la familia' }), true);
  });
  test('lo descartado o ya guardado no se reenvía', () => {
    const p = L.propuestaDe(lectura());
    assert.strictEqual(L.puedeConfirmar({ ...p, estado: 'descartada' }), false);
    assert.strictEqual(L.puedeConfirmar({ ...p, estado: 'guardando' }), false);
    assert.strictEqual(L.puedeConfirmar({ ...p, estado: 'error' }), true);
  });
  test('el cuerpo que se manda lleva las fechas editadas en dd/MM/yyyy y NO la URL del archivo', () => {
    const p = { ...L.propuestaDe(lectura()), fechaEmision: '2026-09-01', importe: ' 1250000 ', concepto: 'Traslados' };
    const it = L.itemConfirmar(p);
    assert.strictEqual(it.fechaEmision, '01/09/2026');
    assert.strictEqual(it.hash, 'a'.repeat(64));
    assert.deepStrictEqual(it.datos, { importe: '1250000', concepto: 'Traslados' });
    assert.ok(!('archivoUrl' in it));
  });
  test('separarResultados reparte lo leído y lo que falló', () => {
    const { buenos, fallidos } = L.separarResultados([lectura(), { ok: false, indice: 1, nombreArchivo: 'x', mensaje: 'no' }]);
    assert.strictEqual(buenos.length, 1);
    assert.strictEqual(fallidos.length, 1);
  });
});

describe('confianza', () => {
  test('solo "baja" se marca como dudosa', () => {
    assert.strictEqual(L.esBaja('baja'), true);
    assert.strictEqual(L.esBaja('media'), false);
    assert.match(L.etiquetaConfianza('baja'), /verificalo/);
  });
});
