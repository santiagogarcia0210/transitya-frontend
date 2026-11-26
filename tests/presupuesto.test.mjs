// src/lib/presupuesto.ts: formato es-AR, números escritos a mano y viajes del asistente (ida y vuelta sin duplicar).
// El cálculo del importe lo hace el servidor (y se prueba allá); acá solo lo que arma lo que se le manda.
import { test, describe } from 'node:test';
import assert from 'node:assert';

const P = await import('../src/lib/presupuesto.ts');

const lectura = (km, extra = {}) => ({
  hash: 'a'.repeat(64), archivoUrl: 'https://x.test/a', archivoNombre: 'mapa.png',
  propuesta: { legible: true, origen: { texto: 'A', confianza: 'alta' }, destino: { texto: 'B', confianza: 'alta' }, rutas: [{ km, tiempo: '20 min', seleccionada: true, confianza: 'alta' }], rutaElegida: 0, requiereElegir: false, modalidadSugerida: 'ida_vuelta_total', confianzaGeneral: 'alta', advertencias: [] },
  verificacion: { pacienteOk: true, centroOk: true, coincide: true, advertencias: [] }, rutaElegida: 0, ...extra,
});
const viaje = (extra = {}) => ({ ...P.viajeVacio(0), origen: 'Casa', destino: 'Centro', ...extra });

describe('formato es-AR', () => {
  test('números y pesos', () => {
    assert.strictEqual(P.fmt(1001314.05, 2), '1.001.314,05');
    assert.strictEqual(P.fmt(824.12), '824,12');
    assert.strictEqual(P.fmt(22), '22');
    assert.strictEqual(P.fmt(8.8), '8,8');
    assert.strictEqual(P.fmt(''), '');
    assert.strictEqual(P.pesos(1215.01), '$1.215,01');
    assert.strictEqual(P.pesos(null), '');
  });
  test('período como en el presupuesto en papel', () => {
    assert.strictEqual(P.periodoLabel('2026-09'), 'Septiembre/2026');
    assert.strictEqual(P.periodoLabel('2026-13'), '');
    assert.strictEqual(P.periodoLabel(undefined), '');
  });
});

describe('números escritos a mano', () => {
  test('coma decimal, "km" y espacios', () => {
    assert.strictEqual(P.parseKm('12,4'), 12.4);
    assert.strictEqual(P.parseKm('12.4 km'), 12.4);
    assert.strictEqual(P.parseKm(8), 8);
    for (const x of ['', 'abc', '0', '-3', undefined]) assert.ok(Number.isNaN(P.parseKm(x)));
  });
  test('suma de tramos', () => {
    assert.deepStrictEqual(P.parseTramos('2,9 + 5,7'), [2.9, 5.7]);
    assert.deepStrictEqual(P.parseTramos('8,7 km + 9 km + 1'), [8.7, 9, 1]);
    assert.strictEqual(P.parseTramos('5,6'), null);
    assert.strictEqual(P.parseTramos('2,9 + x'), null);
  });
});

describe('viajePayload', () => {
  test('un solo km y suma de tramos', () => {
    assert.strictEqual(P.viajePayload(viaje({ kmTexto: '5,6' })).km, 5.6);
    const p = P.viajePayload(viaje({ kmTexto: '2,9 + 5,7' }));
    assert.deepStrictEqual(p.tramos, [2.9, 5.7]);
    assert.ok(!('km' in p));
  });
  test('dos recorridos: cada sentido con sus km', () => {
    const p = P.viajePayload(viaje({ modalidad: 'dos_recorridos', kmIdaTexto: '9', kmVueltaTexto: '11,5' }));
    assert.deepStrictEqual([p.kmIda, p.kmVuelta], [9, 11.5]);
  });
  test('el mapa lleva solo los hashes de respaldo, el origen del dato y si hay que confirmar', () => {
    const p = P.viajePayload(viaje({ kmTexto: '12,4', kmOrigen: 'impresion', lecturas: [lectura(12.4, { verificacion: { pacienteOk: false, centroOk: true, coincide: false, advertencias: ['x'] } })], confirmadoManual: true }));
    assert.deepStrictEqual(p.mapa, { hashes: ['a'.repeat(64)], origen: 'impresion', confianza: 'alta', coincide: false, confirmadoManual: true });
    assert.ok(!('mapa' in P.viajePayload(viaje({ kmTexto: '5' }))));
  });
});

describe('aplicarLecturas: ida y vuelta, sin duplicar nunca', () => {
  test('"ida y vuelta (total)": los km leídos son el total, tal cual', () => {
    const v = P.aplicarLecturas(viaje({ modalidad: 'ida_vuelta_total', lecturas: [lectura(18)] }));
    assert.strictEqual(v.kmTexto, '18');
    assert.strictEqual(v.kmOrigen, 'impresion');
    assert.strictEqual(P.viajePayload(v).km, 18);
  });
  test('"solo ida": los km leídos; la vuelta no se duplica salvo que se marque', () => {
    const v = P.aplicarLecturas(viaje({ modalidad: 'solo_ida', lecturas: [lectura(7.4)] }));
    assert.strictEqual(P.viajePayload(v).incluyeVuelta, false);
  });
  test('"dos recorridos": un archivo por sentido', () => {
    const v = P.aplicarLecturas(viaje({ modalidad: 'dos_recorridos', lecturas: [lectura(9), lectura(11.5)] }));
    assert.deepStrictEqual([v.kmIdaTexto, v.kmVueltaTexto], ['9', '11,5']);
  });
  test('con un solo archivo en "dos recorridos", el otro sentido queda para cargar a mano', () => {
    const v = P.aplicarLecturas(viaje({ modalidad: 'dos_recorridos', lecturas: [lectura(9)] }));
    assert.deepStrictEqual([v.kmIdaTexto, v.kmVueltaTexto], ['9', '']);
    assert.ok(P.faltantesViaje(v).includes('los km de la vuelta'));
  });
  test('si no se pudo elegir la ruta no inventa km', () => {
    const l = lectura(10, { rutaElegida: null });
    l.propuesta = { ...l.propuesta, rutas: [{ km: 10, seleccionada: null, tiempo: '', confianza: 'alta' }, { km: 11, seleccionada: null, tiempo: '', confianza: 'alta' }], rutaElegida: null, requiereElegir: true };
    const v = P.aplicarLecturas(viaje({ lecturas: [l] }));
    assert.strictEqual(v.kmTexto, '');
    assert.ok(P.faltantesViaje(v).includes('elegir la ruta de la impresión'));
  });
  test('sin archivos: vuelve a "cargado a mano"', () => {
    assert.strictEqual(P.aplicarLecturas(viaje({ kmOrigen: 'impresion', lecturas: [] })).kmOrigen, 'manual');
  });
});

describe('faltantesViaje', () => {
  test('lo que falta antes de poder calcular', () => {
    assert.deepStrictEqual(P.faltantesViaje(P.viajeVacio(0)).sort(), ['el destino', 'el origen', 'los km'].sort());
    assert.deepStrictEqual(P.faltantesViaje(viaje({ kmTexto: '5,6' })), []);
    assert.ok(P.faltantesViaje(viaje({ kmTexto: '5,6', dias: [] })).includes('los días de traslado'));
  });
  test('un recorrido que no coincide con el paciente exige confirmación', () => {
    const l = lectura(12, { verificacion: { pacienteOk: false, centroOk: null, coincide: false, advertencias: ['x'] } });
    const v = viaje({ kmTexto: '12', lecturas: [l] });
    assert.ok(P.faltantesViaje(v).some(x => /confirmar/.test(x)));
    assert.deepStrictEqual(P.faltantesViaje({ ...v, confirmadoManual: true }), []);
  });
});

describe('textos del desglose', () => {
  test('km por viaje como en papel y sentidos', () => {
    const f = { id: '2', tramos: [2.9, 5.7], kmReales: 8.6, sentidos: [4.3, 4.3] };
    assert.strictEqual(P.kmPorViajeTexto(f), '2,9 km + 5,7 km');
    assert.strictEqual(P.kmPorViajeTexto({ ...f, tramos: null, kmReales: 5.6 }), '5,6 km');
    assert.strictEqual(P.sentidosTexto(f), 'Ida 4,3 km · Vuelta 4,3 km');
    assert.strictEqual(P.sentidosTexto({ ...f, sentidos: [5.6] }), '');
  });
});
