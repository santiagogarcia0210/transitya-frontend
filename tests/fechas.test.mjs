// src/lib/fechas.ts: el helper de fechas de remitos y egresos.
//
// Es el espejo de utils/fechas.js del backend: los casos de abajo son los MISMOS que prueba el
// backend (test/fechas.test.js), así si uno se desalinea del otro, una de las dos suites lo nota.
//
// Se corre con `npm test`. Usa node:test y no suma ninguna dependencia: Node importa el .ts directo.
import { test, describe } from 'node:test';
import assert from 'node:assert';

const { normalizarFecha: n, fechaISO, fechaDMY, ordenarPorFechaDesc } = await import('../src/lib/fechas.ts');

describe('normalizarFecha: formatos de texto (los mismos que acepta el backend)', () => {
  const casos = [
    ['05/11/2026', '05/11/2026'], ['5/1/2026', '05/01/2026'], ['05/11/26', '05/11/2026'], ['01/01/99', '01/01/2099'],
    ['2026-11-05', '05/11/2026'], ['2026-1-5', '05/01/2026'], ['2026/11/05', '05/11/2026'],
    ['05-11-2026', '05/11/2026'], ['05.11.2026', '05/11/2026'], ['  05/11/2026  ', '05/11/2026'],
    ['05/11/2026 14:30', '05/11/2026'], ['2026-11-05 14:30', '05/11/2026'], ['29/02/2028', '29/02/2028'],
  ];
  for (const [entrada, esperado] of casos) {
    test(`"${entrada}" → "${esperado}"`, () => assert.strictEqual(n(entrada), esperado));
  }
});

describe('normalizarFecha: instantes se pasan a hora de Argentina', () => {
  test('ISO con "Z": 01:30 UTC del día 6 todavía es el 5 en Argentina', () => {
    assert.strictEqual(n('2026-11-06T01:30:00.000Z'), '05/11/2026');
    assert.strictEqual(n('2026-11-06T02:59:59.000Z'), '05/11/2026');
    assert.strictEqual(n('2026-11-06T03:00:00.000Z'), '06/11/2026');
  });
  test('ISO con offset explícito', () => {
    assert.strictEqual(n('2026-11-05T23:30:00-03:00'), '05/11/2026');
    assert.strictEqual(n('2026-11-05T22:00:00-05:00'), '06/11/2026');
  });
  test('ISO con hora y sin zona: se toma el día tal cual', () => {
    assert.strictEqual(n('2026-11-05T22:00:00'), '05/11/2026');
  });
  test('Date y Timestamp sin serializar ({ _seconds } o { seconds })', () => {
    const t = new Date('2026-11-06T01:30:00Z');
    assert.strictEqual(n(t), '05/11/2026');
    assert.strictEqual(n({ _seconds: t.getTime() / 1000, _nanoseconds: 0 }), '05/11/2026');
    assert.strictEqual(n({ seconds: t.getTime() / 1000, nanoseconds: 0 }), '05/11/2026');
  });
});

describe('normalizarFecha: lo que no se entiende da ""', () => {
  const invalidos = ['', null, undefined, '   ', 'basura', '31/02/2026', '29/02/2025', '31/04/2026', '00/11/2026',
    '05/00/2026', '05/13/2026', '2026-13-01', '2026-02-30', '05/11/0206', '05/11/3026', '05/11/226',
    20261105, true, {}, [], new Date('x'), '2026-11-05T25:00:00Z'];
  for (const x of invalidos) {
    test(`${JSON.stringify(x === undefined ? 'undefined' : x)} → ""`, () => assert.strictEqual(n(x), ''));
  }
  test('es idempotente', () => {
    for (const x of ['05/11/2026', '2026-11-05', '5/1/26']) assert.strictEqual(n(n(x)), n(x));
  });
});

describe('fechaISO: lo que se compara contra el input type="date"', () => {
  test('pasa cualquier formato a yyyy-MM-dd', () => {
    for (const x of ['05/11/2026', '5/11/26', '2026-11-05', '2026-11-05T14:30:00Z']) assert.strictEqual(fechaISO(x), '2026-11-05', x);
  });
  test('"" si no se entiende', () => {
    for (const x of ['', null, 'basura', '31/02/2026']) assert.strictEqual(fechaISO(x), '');
  });
  test('REGRESIÓN: comparar el texto dd/MM/yyyy contra el valor del input daba resultados sin sentido', () => {
    // El filtro viejo hacía `r.fecha < filtroDesde` con r.fecha = "05/12/2026" y filtroDesde = "2026-11-01".
    // Como texto, '0' < '2', así que descartaba todo lo que tuviera día menor a 20, sin importar el mes.
    assert.ok('05/12/2026' < '2026-11-01', 'el 5 de diciembre quedaba EXCLUIDO de "desde el 1 de noviembre"');
    assert.ok(!('25/10/2026' < '2026-11-01'), 'y el 25 de octubre quedaba INCLUIDO');
    // Con fechaISO se comparan fechas de verdad:
    assert.ok(!(fechaISO('05/12/2026') < '2026-11-01'), 'el 5 de diciembre entra');
    assert.ok(fechaISO('25/10/2026') < '2026-11-01', 'el 25 de octubre queda afuera');
    assert.ok(fechaISO('2026-11-12') >= '2026-11-10', 'un ISO también compara bien');
  });
  test('los textos ISO ordenan igual que las fechas (por eso se pueden comparar como texto)', () => {
    assert.ok(fechaISO('31/12/2026') < fechaISO('01/01/2027'));
    assert.ok(fechaISO('01/02/2026') > fechaISO('31/01/2026'));
  });
});

describe('fechaDMY: lo que se muestra en la lista', () => {
  test('siempre dd/MM/yyyy aunque el dato venga en ISO', () => {
    assert.strictEqual(fechaDMY('2026-11-05'), '05/11/2026');
    assert.strictEqual(fechaDMY('5/11/26'), '05/11/2026');
    assert.strictEqual(fechaDMY('05/11/2026'), '05/11/2026');
  });
  test('si no se entiende, muestra el texto original (que se vea que hay algo para corregir)', () => {
    assert.strictEqual(fechaDMY('basura'), 'basura');
    assert.strictEqual(fechaDMY('31/02/2026'), '31/02/2026');
    assert.strictEqual(fechaDMY(''), '');
    assert.strictEqual(fechaDMY(undefined), '');
  });
});

describe('ordenarPorFechaDesc', () => {
  const ids = l => l.map(x => x.id);

  test('REGRESIÓN: los ISO se ordenan con el resto y no caen al final', () => {
    const lista = [
      { id: 'dmy-vieja', fecha: '01/11/2026' }, { id: 'iso-nueva', fecha: '2026-11-10' },
      { id: 'dmy-media', fecha: '05/11/2026' }, { id: 'iso-vieja', fecha: '2026-10-20' },
    ];
    assert.deepStrictEqual(ids(ordenarPorFechaDesc(lista)), ['iso-nueva', 'dmy-media', 'dmy-vieja', 'iso-vieja']);
  });

  test('mezcla todos los formatos', () => {
    const lista = [
      { id: 'a', fecha: '1/11/26' }, { id: 'b', fecha: '2026-11-09T10:00:00Z' }, { id: 'c', fecha: '08/11/2026' },
      { id: 'f', fecha: '2026-11-10' },
    ];
    assert.deepStrictEqual(ids(ordenarPorFechaDesc(lista)), ['f', 'b', 'c', 'a']);
  });

  test('los que no tienen fecha válida quedan al final, sin perder ninguno', () => {
    const lista = [{ id: 'basura', fecha: 'basura' }, { id: 'ok', fecha: '01/01/2020' }, { id: 'vacia', fecha: '' }, { id: 'imposible', fecha: '31/02/2026' }];
    const orden = ids(ordenarPorFechaDesc(lista));
    assert.strictEqual(orden[0], 'ok');
    assert.deepStrictEqual(orden.slice(1), ['basura', 'vacia', 'imposible'], 'entre sí conservan el orden de entrada');
    assert.strictEqual(orden.length, 4);
  });

  test('es estable: a igual fecha se conserva el orden que mandó el servidor (cargado más tarde primero)', () => {
    const lista = [{ id: 'x', fecha: '05/11/2026' }, { id: 'y', fecha: '2026-11-05' }, { id: 'z', fecha: '5/11/26' }];
    assert.deepStrictEqual(ids(ordenarPorFechaDesc(lista)), ['x', 'y', 'z']);
  });

  test('devuelve una lista nueva y no modifica la original; una lista vacía no falla', () => {
    const lista = [{ id: 'a', fecha: '01/01/2026' }, { id: 'b', fecha: '02/01/2026' }];
    const r = ordenarPorFechaDesc(lista);
    assert.notStrictEqual(r, lista);
    assert.strictEqual(lista[0].id, 'a');
    assert.deepStrictEqual(ordenarPorFechaDesc([]), []);
  });
});
