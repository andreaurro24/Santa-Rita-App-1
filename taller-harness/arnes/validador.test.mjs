// Pruebas del validador (reglas V1..V10 de contexto/reglas.md) y de la calificación de casos.
// Correr: node --test taller-harness/arnes
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validarBorrador, revisarFormato } from './validador.mjs';
import { extraccionIdeal, calificar } from './calificar.mjs';

const leer = (ruta) => JSON.parse(readFileSync(new URL(ruta, import.meta.url), 'utf8'));
const censo = leer('../contexto/censo-demo.json');
const { casos } = leer('../casos/casos.json');

const fila = (numero, peso, extra = {}) => ({ numero_interno: numero, chapeta: null, alcance_lote: null, peso_kg: peso, evento_sanitario: null, confianza: 'alta', texto_original: `${Number(numero)} ${peso}`, ...extra });
const pesaje = (registros, fecha = '2026-10-27') => ({ tipo_reporte: 'pesaje', fecha_reporte: fecha, lote: null, registros, ilegibles: [] });
const opciones = { fechaMensaje: '2026-10-28' };
const reglas = (r) => r.dudosos.flatMap((d) => d.motivos.map((m) => m.regla));

test('V1: un número que no está en el censo queda dudoso', () => {
  const r = validarBorrador(pesaje([fila('0209', 268)]), censo, opciones);
  assert.deepEqual(reglas(r), ['V1']);
});

test('V2: una chapeta que no coincide queda dudosa', () => {
  const r = validarBorrador(pesaje([fila('0101', 361, { chapeta: '999999' })]), censo, opciones);
  assert.deepEqual(reglas(r), ['V2']);
});

test('V3: fecha posterior al mensaje queda dudosa (RN-14)', () => {
  const r = validarBorrador(pesaje([fila('0101', 361)], '2026-11-27'), censo, opciones);
  assert.ok(reglas(r).includes('V3'));
});

test('V4: fecha anterior al ingreso del animal queda dudosa (RN-14)', () => {
  const r = validarBorrador(pesaje([fila('0301', 190)], '2026-08-01'), censo, opciones);
  assert.ok(reglas(r).includes('V4'));
});

test('V5: un cambio de más del 15 % queda dudoso (RN-01) y uno de 15 % justo no', () => {
  // 0303 pesó 187 kg: 232 es +24 %; 215 es +15 % (no supera el umbral).
  assert.deepEqual(reglas(validarBorrador(pesaje([fila('0303', 232)]), censo, opciones)), ['V5']);
  assert.equal(validarBorrador(pesaje([fila('0303', 215)]), censo, opciones).resumen.validos, 1);
});

test('V6: un animal repetido deja todas sus filas en dudosos', () => {
  const r = validarBorrador(pesaje([fila('0302', 218), fila('0301', 209), fila('0302', 221)]), censo, opciones);
  assert.equal(r.dudosos.length, 2);
  assert.equal(r.validos.length, 1);
});

test('V7: un peso fuera de rango queda dudoso', () => {
  assert.ok(reglas(validarBorrador(pesaje([fila('0101', 36)]), censo, opciones)).includes('V7'));
});

test('V8: un peso que no aparece en el texto leído queda dudoso (no inventar)', () => {
  const r = validarBorrador(pesaje([fila('0106', 368, { texto_original: '1?6 3?8' })]), censo, opciones);
  assert.ok(reglas(r).includes('V8'));
});

test('V8: confianza baja nunca pasa como válida', () => {
  const r = validarBorrador(pesaje([fila('0101', 361, { confianza: 'baja' })]), censo, opciones);
  assert.ok(reglas(r).includes('V8'));
});

test('V9: evento sanitario sin tipo válido queda dudoso', () => {
  const b = { tipo_reporte: 'sanidad', fecha_reporte: '2026-10-28', registros: [{ numero_interno: '0204', evento_sanitario: { tipo: 'vitamina', descripcion: 'B12' }, confianza: 'alta', texto_original: 'a la 204 le pusimos B12' }], ilegibles: [] };
  assert.ok(reglas(validarBorrador(b, censo, opciones)).includes('V9'));
});

test('V10: un evento para todo el lote se expande con el censo', () => {
  const b = { tipo_reporte: 'sanidad', fecha_reporte: '2026-10-28', registros: [{ alcance_lote: 'LOTE-2026-B', evento_sanitario: { tipo: 'vacuna', descripcion: 'Aftosa' }, confianza: 'alta', texto_original: 'vacunamos el lote 2026-B' }], ilegibles: [] };
  const r = validarBorrador(b, censo, opciones);
  assert.equal(r.validos.length, 6);
});

test('Ciclo 1: en sanidad, dos eventos distintos del mismo animal no son un duplicado', () => {
  const ev = (tipo, descripcion, texto) => ({ numero_interno: '0204', evento_sanitario: { tipo, descripcion }, confianza: 'alta', texto_original: texto });
  const b = { tipo_reporte: 'sanidad', fecha_reporte: '2026-10-26', registros: [ev('desparasitacion', 'Ivermectina', 'purgamos a la 204'), ev('tratamiento', 'Oxitetraciclina', 'a la 204 oxitetraciclina')], ilegibles: [] };
  assert.equal(validarBorrador(b, censo, opciones).validos.length, 2);
  // El mismo evento dos veces sí es duplicado (V6).
  b.registros[1] = ev('desparasitacion', 'ivermectina', 'y la 204 también purgada');
  assert.deepEqual(reglas(validarBorrador(b, censo, opciones)), ['V6', 'V6']);
});

test('Ciclo 2: una fila con solo chapeta se resuelve con el censo; una chapeta desconocida queda dudosa', () => {
  const porChapeta = (chapeta, peso) => ({ numero_interno: null, chapeta, peso_kg: peso, confianza: 'alta', texto_original: `${chapeta} ${peso}` });
  const r = validarBorrador(pesaje([porChapeta('215576', 361), porChapeta('999999', 300)]), censo, opciones);
  assert.equal(r.validos[0].numero_interno, '0101');
  assert.deepEqual(reglas(r), ['V1']);
  assert.deepEqual(revisarFormato(pesaje([porChapeta('215576', 361)])), []);
});

test('revisarFormato detecta una salida mal formada', () => {
  assert.ok(revisarFormato({ tipo_reporte: 'pesaje', fecha_reporte: '27/10/2026', registros: [{ numero_interno: '101' }] }).length >= 3);
  assert.deepEqual(revisarFormato(extraccionIdeal(casos[0])), []);
});

for (const caso of casos) {
  test(`${caso.id}: con una extracción perfecta, el validador da la respuesta esperada`, () => {
    const r = validarBorrador(extraccionIdeal(caso), censo, { fechaMensaje: caso.fecha_mensaje });
    const nota = calificar(caso, r, censo);
    assert.equal(nota.correcto, true, nota.detalle.join('; '));
  });
}

test('calificar detecta el peor error: una fila ilegible inventada', () => {
  const caso = casos.find((c) => c.id === 'caso-4');
  const b = extraccionIdeal(caso);
  b.ilegibles = [];
  b.registros.splice(5, 0, fila('0106', 368, { confianza: 'media' }));
  const nota = calificar(caso, validarBorrador(b, censo, { fechaMensaje: caso.fecha_mensaje }), censo);
  assert.ok(nota.erroresGraves >= 1);
});
