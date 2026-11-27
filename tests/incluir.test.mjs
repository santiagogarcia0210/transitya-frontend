// src/lib/beneficiarioForm.ts: obra social canónica, payload limpio del alta/edición, error real del backend
// y lectura de las planillas de Incluir (un paciente sin N° de afiliado NO se descarta ni rompe la hoja).
// Datos ficticios.
import { test, describe } from 'node:test';
import assert from 'node:assert';

const F = await import('../src/lib/beneficiarioForm.ts');

describe('obra social canónica y selector', () => {
  test('todas las grafías de Incluir → INCLUIR SALUD; el resto se conserva', () => {
    for (const v of ['incluir', 'Incluir Salud', ' INCLUIR  SALUD ', 'Íncluir salud', 'INCLUIR-SALUD']) assert.strictEqual(F.canonicaObraSocial(v), 'INCLUIR SALUD', v);
    assert.strictEqual(F.canonicaObraSocial('OSPRERA'), 'OSPRERA');
    assert.strictEqual(F.canonicaObraSocial(''), '');
    assert.strictEqual(F.canonicaObraSocial(undefined), '');
  });
  test('las opciones del selector: Incluir primero, sin repetir grafías, con las que ya existen', () => {
    assert.deepStrictEqual(F.opcionesObraSocial(['incluir', 'INCLUIR SALUD', 'PNC', 'OSPRERA', '', 'pnc ']), ['INCLUIR SALUD', 'OSPRERA', 'PNC']);
    assert.deepStrictEqual(F.opcionesObraSocial([]), ['INCLUIR SALUD']);
  });
});

describe('limpiarPayloadBeneficiario', () => {
  test('saca id y campos internos y los undefined', () => {
    const p = F.limpiarPayloadBeneficiario({ id: 'x', ID: 'y', creadoEn: 1, _id: 2, DNI: '1', nada: undefined, vacio: '' });
    assert.deepStrictEqual(Object.keys(p).sort(), ['DNI', 'vacio']);
  });
  test('el N° de afiliado queda en N° AFILIADO y nroAfiliado (lo que antes guardaba solo uno de los dos formularios)', () => {
    const p = F.limpiarPayloadBeneficiario({ nroAfiliado: ' 123 ' });
    assert.strictEqual(p['N° AFILIADO'], '123');
    assert.strictEqual(p.nroAfiliado, '123');
    assert.strictEqual(F.limpiarPayloadBeneficiario({ 'N° AFILIADO': '', nroAfiliado: '9' })['N° AFILIADO'], '9');
    assert.ok(!('N° AFILIADO' in F.limpiarPayloadBeneficiario({ DNI: '1' })), 'no inventa un N°');
  });
  test('la obra social se manda canónica en las dos claves', () => {
    const p = F.limpiarPayloadBeneficiario({ obraSocial: 'incluir salud' });
    assert.strictEqual(p['OBRA SOCIAL'], 'INCLUIR SALUD');
    assert.strictEqual(p.obraSocial, 'INCLUIR SALUD');
  });
});

describe('mensajeGuardado: el error real, no uno genérico', () => {
  test('con respuesta del servidor: código y mensaje del backend', () => {
    const e = { response: { status: 404, data: { mensaje: 'No se encontró al paciente (se buscó en registro y en BENEFICIARIOS).' } }, message: 'Request failed with status code 404' };
    assert.match(F.mensajeGuardado(e), /error 404.*No se encontró al paciente/);
  });
  test('sin mensaje del backend usa el del cliente; sin respuesta dice que el servidor no respondió', () => {
    assert.match(F.mensajeGuardado({ response: { status: 500, data: {} }, message: 'Request failed with status code 500' }), /error 500.*Request failed/);
    assert.match(F.mensajeGuardado({ request: {}, message: 'Network Error' }), /el servidor no respondió/);
    assert.match(F.mensajeGuardado(new Error('boom'), 'actualizar'), /No se pudo actualizar: boom/);
  });
});

describe('leerPlanilla / normalizarFilaPlanilla', () => {
  test('lee el N° de `afiliado` (Incluir) y de `nroAfiliado` (DJ ESC 107) y trae el id', () => {
    const inc = F.normalizarFilaPlanilla({ id: 'a1', afiliado: '9000001', nombre: 'Paciente Uno', dni: '1' });
    const dj = F.normalizarFilaPlanilla({ id: 'a2', nroAfiliado: '9000002', apellidoNombre: 'Paciente Dos' });
    assert.deepStrictEqual([inc.id, inc.nroAfiliado, inc.faltaAfiliado, inc.nombre], ['a1', '9000001', false, 'Paciente Uno']);
    assert.deepStrictEqual([dj.id, dj.nroAfiliado, dj.faltaAfiliado, dj.nombre], ['a2', '9000002', false, 'Paciente Dos']);
  });
  test('un paciente sin N° de afiliado NO se descarta: sale con faltaAfiliado', () => {
    const { filas } = F.leerPlanilla({ ok: true, filas: [{ id: 'a', afiliado: '', nombre: 'Paciente Sin N' }, { id: 'b', afiliado: '5', nombre: 'Paciente Con N' }] });
    assert.strictEqual(filas.length, 2);
    assert.strictEqual(filas[0].faltaAfiliado, true);
    assert.strictEqual(filas[0].nroAfiliado, '');
    assert.strictEqual(filas[1].faltaAfiliado, false);
  });
  test('una respuesta rara no rompe: lista vacía', () => {
    for (const d of [undefined, null, {}, { filas: 'x' }, []]) assert.deepStrictEqual(F.leerPlanilla(d), { filas: [], sinObraSocial: [] });
  });
  test('los sin obra social vienen aparte, con id para el link a la ficha', () => {
    const { sinObraSocial } = F.leerPlanilla({ filas: [], sinObraSocial: [{ id: 's1', nombre: 'Paciente S' }, { nombre: 'sin id' }] });
    assert.deepStrictEqual(sinObraSocial, [{ id: 's1', nombre: 'Paciente S' }]);
    assert.strictEqual(F.fichaHref('s1'), '/dashboard/beneficiarios?editar=s1');
    assert.strictEqual(F.fichaHref('a b/c'), '/dashboard/beneficiarios?editar=a%20b%2Fc');
  });
});

describe('aviso e impresión', () => {
  test('texto del aviso: singular, plural y nada', () => {
    assert.strictEqual(F.textoAvisoSinObraSocial(2), '2 pacientes sin obra social: revisar');
    assert.strictEqual(F.textoAvisoSinObraSocial(1), '1 paciente sin obra social: revisar');
    assert.strictEqual(F.textoAvisoSinObraSocial(0), '');
  });
  test('sin N° de afiliado la hoja se imprime con el campo en blanco (nunca "undefined" ni la marca)', () => {
    for (const v of ['', '   ', undefined, null]) assert.strictEqual(F.textoAfiliadoImpreso(v), '');
    assert.strictEqual(F.textoAfiliadoImpreso(' 123 '), '123');
  });
});
