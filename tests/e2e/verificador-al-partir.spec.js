import { mkdirSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';
import { clientePrueba, iniciarSesion } from './helpers';
import { medirControles, medirDesborde } from './verificador-medidas';

// Pruebas del VERIFICADOR para la spec 007 ("Al partir": tenedores, contratos, asignación y visitas), ronda 1.
// - asignar_a_contrato y registrar_visita por API: atomicidad, validaciones, anon, contrato terminado.
// - Lo que las tablas aceptan fuera de las funciones, y la coherencia con mover_animales (006).
// - Flujo completo en el celular (375×812): tenedor, contrato, asignar, visita, terminar.
// Todo lo creado lleva el prefijo VRF-AP (tenedores, fincas, lote, animales) y se borra al final.

const DIR = 'test-results/vrf-007';
mkdirSync(DIR, { recursive: true });
const P = 'VRF-AP';
const NOTA_VISITA = 'Visita de verificación Al partir';

const hoyBogota = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
const haceDias = (n) => new Date(Date.parse(`${hoyBogota()}T12:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);

function registrar(nombre, datos) {
  console.log(`${nombre}: ${JSON.stringify(datos)}`);
  test.info().annotations.push({ type: nombre, description: JSON.stringify(datos) });
}

async function limpiar() {
  const supabase = await clientePrueba();
  const { data: tenedores } = await supabase.from('tenedores').select('id').like('nombre', `${P}%`);
  const idsTen = (tenedores ?? []).map((t) => t.id);
  const { data: contratos } = idsTen.length ? await supabase.from('contratos_al_partir').select('id').in('tenedor_id', idsTen) : { data: [] };
  const idsCon = (contratos ?? []).map((c) => c.id);
  if (idsCon.length) await supabase.from('visitas_verificacion').delete().in('contrato_id', idsCon);
  const { data: animales } = await supabase.from('animales').select('id').like('numero_interno', `${P}%`);
  for (const a of animales ?? []) await supabase.from('animales').delete().eq('id', a.id);
  if (idsCon.length) await supabase.from('contratos_al_partir').delete().in('id', idsCon);
  if (idsTen.length) await supabase.from('tenedores').delete().in('id', idsTen);
  await supabase.from('potreros').delete().like('nombre', `${P}%`);
  await supabase.from('fincas').delete().like('nombre', `${P}%`);
  await supabase.from('lotes').delete().like('codigo', `${P}%`);
}
test.beforeAll(limpiar);
test.afterAll(limpiar);

async function base(supabase, s = 'BD') {
  const { data: propia } = await supabase.from('fincas').select('id').eq('tipo', 'propia').single();
  const { data: lote } = await supabase.from('lotes').insert({ codigo: `${P}-LOTE-${s}`, nombre: `${P} lote ${s}`, tipo: 'ceba', peso_meta_kg: 400 }).select('id').single();
  const tenedor = async (sufijo, conFinca = true) => {
    let fincaId = null;
    if (conFinca) fincaId = (await supabase.from('fincas').insert({ nombre: `${P} finca ${sufijo}`, tipo: 'tenedor' }).select('id').single()).data.id;
    const t = (await supabase.from('tenedores').insert({ nombre: `${P} ${sufijo}`, finca_id: fincaId }).select('id').single()).data;
    return { id: t.id, fincaId };
  };
  const contrato = async (tenedorId, extra = {}) =>
    (await supabase.from('contratos_al_partir').insert({ tenedor_id: tenedorId, porcentaje_ganancia: 50, fecha_inicio: haceDias(20), ...extra }).select('id').single()).data.id;
  const animal = async (sufijo, { ingreso = haceDias(60), estado } = {}) => {
    const numero = `${P}-${sufijo}`;
    const { data: id, error } = await supabase.rpc('registrar_animal', {
      datos: { numero_interno: numero, chapeta_ica: `${numero}-CH`, sexo: 'Macho', categoria: 'novillo', origen: 'compra', fecha_ingreso: ingreso, peso_ingreso_kg: 250, peso_objetivo_kg: 400, lote_id: lote.id, finca_id: propia.id },
    });
    if (error) throw error;
    if (estado) await supabase.from('animales').update({ estado }).eq('id', id);
    return { id, numero };
  };
  return { propia, lote, tenedor, contrato, animal };
}

test('VRF 007 BD: asignar_a_contrato y registrar_visita (atomicidad, validaciones, anon, terminado) y coherencia con mover', async () => {
  test.setTimeout(120_000);
  const supabase = await clientePrueba();
  const b = await base(supabase);
  const t1 = await b.tenedor('T1');
  const t2 = await b.tenedor('T2');
  const t3 = await b.tenedor('T3 sin finca', false);
  const c1 = await b.contrato(t1.id);
  const c2 = await b.contrato(t2.id);
  const c3 = await b.contrato(t3.id);
  const a1 = await b.animal('1');
  const a2 = await b.animal('2');
  const a3 = await b.animal('3');
  const muerto = await b.animal('M', { estado: 'muerto' });
  const reciente = await b.animal('R', { ingreso: haceDias(2) });
  const { data: pot } = await supabase.from('potreros').insert({ finca_id: b.propia.id, nombre: `${P} potrero` }).select('id').single();
  await supabase.from('animales').update({ potrero_id: pot.id }).eq('id', a1.id);
  const estado = async (id) => (await supabase.from('animales').select('finca_id, potrero_id, contrato_id').eq('id', id).single()).data;
  const movs = async (motivo) => (await supabase.from('movimientos').select('id', { count: 'exact', head: true }).eq('motivo', motivo)).count;
  const rpc = async (args) => {
    const { error } = await supabase.rpc('asignar_a_contrato', { fecha: hoyBogota(), motivo: `${P} x`, ...args });
    return error ? `${error.code} ${error.message.slice(0, 60)}` : 'ACEPTADO';
  };
  const r = { asignar: {}, visita: {}, tablas: {}, coherencia: {} };

  // asignar_a_contrato
  const antesA1 = await estado(a1.id);
  const at = await supabase.rpc('asignar_a_contrato', { ids: [a1.id, a2.id, muerto.id], contrato: c1, fecha: hoyBogota(), motivo: `${P} atomicidad` });
  r.asignar.atomicidad = { error: at.error?.message, movimientos: await movs(`${P} atomicidad`), a1Igual: JSON.stringify(await estado(a1.id)) === JSON.stringify(antesA1) };
  const dup = await supabase.rpc('asignar_a_contrato', { ids: [a1.id, a1.id], contrato: c1, fecha: hoyBogota(), motivo: `${P} duplicado` });
  r.asignar.idsRepetidos = { error: dup.error?.message ?? 'ACEPTADO', movimientos: await movs(`${P} duplicado`) };
  r.asignar.sinAnimales = await rpc({ ids: [], contrato: c1 });
  r.asignar.contratoInexistente = await rpc({ ids: [a1.id], contrato: '00000000-0000-4000-8000-000000000000' });
  r.asignar.tenedorSinFinca = await rpc({ ids: [a1.id], contrato: c3 });
  r.asignar.fechaFutura = await rpc({ ids: [a1.id], contrato: c1, fecha: '2099-01-01' });
  r.asignar.motivoEnBlanco = await rpc({ ids: [a1.id], contrato: c1, motivo: '   ' });
  r.asignar.fecha1999 = await rpc({ ids: [a3.id], contrato: c1, fecha: '1999-01-01' });
  const anon = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const an = await anon.rpc('asignar_a_contrato', { ids: [a1.id], contrato: c1, fecha: hoyBogota(), motivo: `${P} anon` });
  const anV = await anon.rpc('registrar_visita', { contrato: c1, fecha: hoyBogota(), notas: null, revisiones: [{ animal_id: a1.id, peso_kg: 300 }] });
  const anSel = await anon.from('visitas_verificacion').select('id');
  r.asignar.anon = { asignar: an.error?.code ?? 'ACEPTADO', visita: anV.error?.code ?? 'ACEPTADO', select: anSel.error?.code ?? `devolvió ${anSel.data?.length}` };
  // Fecha anterior al ingreso del animal y al inicio del contrato (hace 20 días).
  r.asignar.fechaAntesDelIngreso = await rpc({ ids: [reciente.id], contrato: c1, fecha: haceDias(30), motivo: `${P} antes del ingreso` });
  // Válido: a1 (con potrero en Santa Rita) y a2.
  const ok = await supabase.rpc('asignar_a_contrato', { ids: [a1.id, a2.id], contrato: c1, fecha: hoyBogota(), motivo: `${P} entrega` });
  r.asignar.valido = ok.error?.message ?? ok.data;
  const { data: m1 } = await supabase.from('movimientos').select('desde_finca_id, desde_potrero_id, hacia_finca_id, hacia_potrero_id, desde_lote_id, hacia_lote_id').eq('animal_id', a1.id).eq('motivo', `${P} entrega`).single();
  const e1 = await estado(a1.id);
  r.asignar.resultadoA1 = {
    fincaTenedor: e1.finca_id === t1.fincaId, potreroVacio: e1.potrero_id === null, contrato: e1.contrato_id === c1,
    movDesdePotrero: m1.desde_potrero_id === pot.id, movHaciaFinca: m1.hacia_finca_id === t1.fincaId, movHaciaPotreroNulo: m1.hacia_potrero_id === null, loteIgual: m1.desde_lote_id === m1.hacia_lote_id,
  };
  // Reasignar un animal que ya está en otro contrato (la interfaz no lo ofrece; ¿la BD?).
  r.asignar.yaEnOtroContrato = await rpc({ ids: [a2.id], contrato: c2, motivo: `${P} reasignar` });
  r.asignar.a2Ahora = (await estado(a2.id)).contrato_id === c2 ? 'pasó al contrato de T2' : 'sigue en T1';

  // registrar_visita
  const visita = async (revisiones, extra = {}) => {
    const { data, error } = await supabase.rpc('registrar_visita', { contrato: c1, fecha: hoyBogota(), notas: `${P} visita`, revisiones, ...extra });
    return error ? `${error.code} ${error.message.slice(0, 60)}` : `ACEPTADO ${data}`;
  };
  const cuentaVisitas = async () => (await supabase.from('visitas_verificacion').select('id', { count: 'exact', head: true }).eq('contrato_id', c1)).count;
  const cuentaPesajesVisita = async () => (await supabase.from('pesajes').select('id', { count: 'exact', head: true }).eq('animal_id', a1.id).eq('notas', NOTA_VISITA)).count;
  r.visita.fueraDelContrato = await visita([{ animal_id: a1.id, peso_kg: 300 }, { animal_id: a3.id, peso_kg: 300 }]);
  r.visita.pesoCero = await visita([{ animal_id: a1.id, peso_kg: 0 }]);
  r.visita.peso2000 = await visita([{ animal_id: a1.id, peso_kg: 2000 }]);
  r.visita.pesoTexto = await visita([{ animal_id: a1.id, peso_kg: 'abc' }]);
  r.visita.animalRepetido = await visita([{ animal_id: a1.id, peso_kg: 300 }, { animal_id: a1.id, peso_kg: 301 }]);
  r.visita.sinRevisiones = await visita([]);
  r.visita.fechaFutura = await visita([{ animal_id: a1.id, peso_kg: 300 }], { fecha: '2099-01-01' });
  r.visita.fecha1999 = await visita([{ animal_id: a1.id, peso_kg: 300 }], { fecha: '1999-01-01' });
  r.visita.trasErrores = { visitas: await cuentaVisitas(), pesajes: await cuentaPesajesVisita() };
  // Fecha anterior a la asignación (hoy) y al inicio del contrato (hace 20 días).
  r.visita.antesDeLaAsignacion = await visita([{ animal_id: a1.id, peso_kg: 280 }], { fecha: haceDias(40) });
  // Válida: a1 pesado, a2 no está (fue reasignado); probamos con a1 y un "no encontrado" de un animal del contrato.
  await supabase.rpc('asignar_a_contrato', { ids: [a3.id], contrato: c1, fecha: hoyBogota(), motivo: `${P} entrega 3` });
  r.visita.valida = await visita([{ animal_id: a1.id, peso_kg: 305.5 }, { animal_id: a3.id, peso_kg: null }]);
  const { data: va } = await supabase.from('visita_animales').select('animal_id, encontrado, pesaje:pesajes ( fecha, peso_kg, jornada_id, notas )').eq('visita_id', r.visita.valida.split(' ')[1]);
  r.visita.filas = va;

  // Lo que las tablas aceptan directamente, sin pasar por las funciones.
  const vd = await supabase.from('visitas_verificacion').insert({ contrato_id: c1, fecha: '2099-01-01', notas: `${P} directa` }).select('id').single();
  r.tablas.visitaDirectaFechaFutura = vd.error?.code ?? 'ACEPTADO';
  if (vd.data) {
    const vaDir = await supabase.from('visita_animales').insert({ visita_id: vd.data.id, animal_id: reciente.id, encontrado: true }).select('id');
    r.tablas.visitaAnimalFueraDelContrato = vaDir.error?.code ?? 'ACEPTADO';
  }
  const dirUpdate = await supabase.from('animales').update({ contrato_id: c1 }).eq('id', reciente.id).select('finca_id, contrato_id').single();
  r.tablas.updateDirectoContratoSinMovimiento = dirUpdate.error?.code ?? { aceptado: true, fincaSigueEnSantaRita: dirUpdate.data.finca_id === b.propia.id };
  await supabase.from('animales').update({ contrato_id: null }).eq('id', reciente.id);

  // Coherencia con mover_animales (006): devolver a1 a Santa Rita.
  const vuelta = await supabase.rpc('mover_animales', { ids: [a1.id], fecha: hoyBogota(), motivo: `${P} vuelve a Santa Rita`, finca_destino: b.propia.id });
  const e1b = await estado(a1.id);
  r.coherencia.moverASantaRita = { resultado: vuelta.error?.message ?? 'ok', fincaEsSantaRita: e1b.finca_id === b.propia.id, sigueEnElContrato: e1b.contrato_id === c1 };
  // ¿Se le puede registrar una visita del tenedor aunque esté en Santa Rita?
  r.coherencia.visitaConAnimalEnSantaRita = await visita([{ animal_id: a1.id, peso_kg: 306 }], { fecha: hoyBogota() });

  // R7: terminar el contrato con animales adentro, y luego intentar asignar.
  const term = await supabase.from('contratos_al_partir').update({ estado: 'terminado' }).eq('id', c1).select('id');
  r.terminar = { conAnimalesAdentro: term.error?.code ?? 'ACEPTADO' };
  const { count: siguen } = await supabase.from('animales').select('id', { count: 'exact', head: true }).eq('contrato_id', c1);
  r.terminar.animalesQueSiguenLigados = siguen;
  r.terminar.asignarRpc = await rpc({ ids: [reciente.id], contrato: c1 });
  const dir = await supabase.from('animales').update({ contrato_id: c1 }).eq('id', reciente.id).select('id');
  r.terminar.asignarDirecto = dir.error?.code ?? 'ACEPTADO';
  r.terminar.visitaAContratoTerminado = await visita([{ animal_id: a3.id, peso_kg: 280 }]);
  const reabrir = await supabase.from('contratos_al_partir').update({ estado: 'vigente' }).eq('id', c1).select('id');
  r.terminar.reabrir = reabrir.error?.code ?? 'ACEPTADO';

  // Contrato: porcentaje fuera de rango y precios negativos en la BD.
  const cc = async (extra) => {
    const { error } = await supabase.from('contratos_al_partir').insert({ tenedor_id: t2.id, porcentaje_ganancia: 50, ...extra }).select('id');
    return error ? error.code : 'ACEPTADO';
  };
  r.contrato = { pct101: await cc({ porcentaje_ganancia: 101 }), pctNeg: await cc({ porcentaje_ganancia: -1 }), precioNeg: await cc({ precio_animal_cop: -1 }), precioKgDecimal: await cc({ precio_kg_cop: 1.5 }), estadoRaro: await cc({ estado: 'pausado' }), inicio2099: await cc({ fecha_inicio: '2099-01-01' }) };
  const tn = await supabase.from('tenedores').insert({ nombre: '   ' }).select('id');
  r.tenedorNombreEnBlanco = tn.error?.code ?? 'ACEPTADO';

  registrar('BD Al partir', r);
  expect(r.asignar.atomicidad.movimientos).toBe(0);
  expect(r.asignar.atomicidad.a1Igual).toBe(true);
  expect(r.asignar.idsRepetidos.movimientos).toBe(0);
  expect(r.asignar.sinAnimales).toMatch(/sin_animales/);
  expect(r.asignar.contratoInexistente).toMatch(/contrato_inexistente/);
  expect(r.asignar.tenedorSinFinca).toMatch(/tenedor_sin_finca/);
  expect(r.asignar.fechaFutura).toMatch(/fecha_futura/);
  expect(r.asignar.motivoEnBlanco).toMatch(/sin_motivo/);
  expect(r.asignar.anon).toEqual({ asignar: '42501', visita: '42501', select: '42501' });
  expect(r.asignar.valido).toBe(2);
  expect(Object.values(r.asignar.resultadoA1).every(Boolean)).toBe(true);
  expect(r.visita.fueraDelContrato).toMatch(/animal_fuera_del_contrato/);
  expect(r.visita.pesoCero).toMatch(/^23514/);
  expect(r.visita.peso2000).toMatch(/^23514/);
  expect(r.visita.animalRepetido).toMatch(/^23505/);
  expect(r.visita.sinRevisiones).toMatch(/sin_revisiones/);
  expect(r.visita.fechaFutura).toMatch(/fecha_futura/);
  expect(r.visita.trasErrores).toEqual({ visitas: 0, pesajes: 0 });
  expect(r.visita.valida).toMatch(/^ACEPTADO/);
  expect(r.terminar.asignarRpc).toMatch(/contrato_terminado/);
  expect(r.terminar.asignarDirecto).toBe('23514');
  expect(r.contrato.pct101).toBe('23514');
  expect(r.contrato.precioNeg).toBe('23514');
});

test.describe('celular 375×812', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

  test('VRF 007 criterios: tenedor, contrato, asignar 2, visita con un peso, un no encontrado y uno sin revisar; terminar', async ({ page }) => {
    test.setTimeout(180_000);
    const supabase = await clientePrueba();
    const b = await base(supabase, 'UI');
    const animales = [await b.animal('U1'), await b.animal('U2'), await b.animal('U3')];
    const errores = [];
    page.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
    page.on('response', (x) => x.status() >= 400 && !x.url().includes('/auth/v1/') && errores.push(`${x.status()} ${x.request().method()} ${x.url().split('?')[0]}`));
    const r = {};
    const alertaDe = async (hoja) => ((await hoja.getByRole('alert').count()) ? (await hoja.getByRole('alert').first().innerText()).trim() : 'SIN MENSAJE');

    await iniciarSesion(page);
    await page.getByRole('button', { name: /Más/ }).first().tap();
    await page.getByRole('link', { name: 'Al partir' }).tap();
    await expect(page.getByRole('heading', { name: 'Al partir' })).toBeVisible();
    r.lista = { desborde: await page.evaluate(medirDesborde), controlesChicos: await page.evaluate(medirControles) };
    await page.screenshot({ path: `${DIR}/01-lista.png`, fullPage: true });

    // R1: nuevo tenedor (validaciones, doble toque) y ¿se puede editar?
    await page.getByRole('button', { name: 'Nuevo tenedor' }).tap();
    let hoja = page.getByRole('dialog', { name: 'Nuevo tenedor' });
    await hoja.getByRole('button', { name: 'Guardar' }).tap();
    r.tenedorVacio = await alertaDe(hoja);
    await hoja.getByRole('textbox', { name: 'Nombre *' }).fill(`${P} Tenedor UI`);
    await hoja.getByRole('button', { name: 'Guardar' }).tap();
    r.tenedorSinFinca = await alertaDe(hoja);
    await hoja.getByLabel('Teléfono').fill('300 123 4567');
    await hoja.getByLabel('Nombre de la finca nueva').fill(`${P} Finca UI`);
    await hoja.getByRole('button', { name: 'Guardar' }).dblclick();
    await expect(hoja).toHaveCount(0);
    r.tenedorDobleToque = {
      tenedores: (await supabase.from('tenedores').select('id').eq('nombre', `${P} Tenedor UI`)).data.length,
      fincas: (await supabase.from('fincas').select('id').eq('nombre', `${P} Finca UI`)).data.length,
    };
    r.editarTenedorEnPantalla = await page.getByRole('button', { name: /Editar tenedor/ }).count();

    // R2: nuevo contrato (validaciones).
    await page.getByRole('button', { name: 'Nuevo contrato' }).tap();
    hoja = page.getByRole('dialog', { name: 'Nuevo contrato' });
    await hoja.getByRole('button', { name: 'Guardar' }).tap();
    r.contratoSinTenedor = await alertaDe(hoja);
    await hoja.getByLabel('Tenedor').selectOption({ label: `${P} Tenedor UI` });
    const pct = hoja.getByLabel('Porcentaje de la ganancia neta (%)');
    r.contrato = {};
    for (const v of ['150', '-5']) {
      await pct.fill(v);
      await hoja.getByRole('button', { name: 'Guardar' }).tap();
      r.contrato[`pct ${v}`] = await alertaDe(hoja);
    }
    await pct.fill('45');
    await hoja.getByLabel('Precio del animal (COP)').fill('-1');
    await hoja.getByRole('button', { name: 'Guardar' }).tap();
    r.contrato.precioNegativo = await alertaDe(hoja);
    await hoja.getByLabel('Precio del animal (COP)').fill('1500000.5');
    await hoja.getByRole('button', { name: 'Guardar' }).tap();
    await page.waitForTimeout(1500);
    r.contrato.precioConDecimales = (await hoja.count()) ? await alertaDe(hoja) : 'GUARDADO';
    // Porcentaje vacío: ¿se guarda como 0 %?
    await hoja.getByLabel('Precio del animal (COP)').fill('1500000');
    await pct.fill('');
    await hoja.getByRole('button', { name: 'Guardar' }).tap();
    await page.waitForTimeout(1500);
    r.contrato.porcentajeVacio = (await hoja.count()) ? await alertaDe(hoja) : 'GUARDADO';
    if (r.contrato.porcentajeVacio !== 'GUARDADO') {
      await pct.fill('45');
      await hoja.getByRole('button', { name: 'Guardar' }).tap();
    }
    await expect(page.getByRole('heading', { name: `${P} Tenedor UI` })).toBeVisible();
    const contratoId = page.url().split('/').pop();
    r.contrato.guardado = (await supabase.from('contratos_al_partir').select('porcentaje_ganancia, precio_animal_cop, estado').eq('id', contratoId).single()).data;
    await page.screenshot({ path: `${DIR}/02-contrato.png`, fullPage: true });

    // R3: asignar (sin selección, luego 3 animales con doble toque).
    await page.getByRole('button', { name: 'Asignar animales' }).tap();
    hoja = page.getByRole('dialog', { name: /Asignar animales/ });
    await hoja.getByRole('button', { name: /^Asignar/ }).tap();
    r.asignarSinSeleccion = await alertaDe(hoja);
    await hoja.getByLabel('Buscar por número interno').fill(P);
    for (const a of animales) await hoja.getByRole('checkbox', { name: `Asignar ${a.numero}` }).check();
    r.hojaAsignar = await hoja.evaluate((el) => ({ abajo: Math.round(el.getBoundingClientRect().bottom), pieVisible: el.querySelector('[data-dialogo-pie]').getBoundingClientRect().bottom <= innerHeight }));
    await page.screenshot({ path: `${DIR}/03-asignar.png` });
    await hoja.getByRole('button', { name: 'Asignar (3)' }).dblclick();
    await expect(hoja).toHaveCount(0);
    const { data: movs } = await supabase.from('movimientos').select('animal_id').in('animal_id', animales.map((a) => a.id));
    r.movimientosTrasAsignar = movs.length;
    await expect(page.getByText('Animales (3)')).toBeVisible();

    // R5/R6: visita. U1 pesado (−20 % frente a 250), U2 "no encontrado", U3 sin tocar.
    await page.getByRole('button', { name: 'Registrar visita' }).tap();
    hoja = page.getByRole('dialog', { name: 'Registrar visita de verificación' });
    await hoja.getByRole('button', { name: 'Guardar visita' }).tap();
    r.visitaVacia = await alertaDe(hoja);
    await hoja.getByLabel(`Peso de ${animales[0].numero} (kg)`).fill('abc');
    await hoja.getByRole('button', { name: 'Guardar visita' }).tap();
    r.visitaPesoTexto = await alertaDe(hoja);
    await hoja.getByLabel('Fecha de la visita').fill('2099-01-01');
    await hoja.getByRole('button', { name: 'Guardar visita' }).tap();
    r.visitaFechaFutura = await alertaDe(hoja);
    await hoja.getByLabel('Fecha de la visita').fill(hoyBogota());
    await hoja.getByLabel(`Peso de ${animales[0].numero} (kg)`).fill('200');
    await hoja.getByRole('listitem').filter({ hasText: animales[1].numero }).getByLabel('No encontrado').check();
    r.hojaVisita = { controlesChicos: await page.evaluate(medirControles), desborde: (await page.evaluate(medirDesborde)).scrollWidth };
    await page.screenshot({ path: `${DIR}/04-visita.png` });
    await hoja.getByRole('button', { name: 'Guardar visita' }).tap();
    await page.waitForTimeout(1200);
    r.visitaConMenos20 = (await hoja.count()) ? `pidió algo: ${await alertaDe(hoja)}` : 'guardada sin pedir confirmación';
    await expect(hoja).toHaveCount(0);
    const visitas = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Visitas de verificación' }) });
    r.visitaEnContrato = (await visitas.innerText()).replace(/\s+/g, ' ');
    const { data: vs } = await supabase.from('visitas_verificacion').select('id, revisiones:visita_animales ( animal_id, encontrado )').eq('contrato_id', contratoId);
    r.visitaBD = vs.map((v) => v.revisiones.map((x) => `${animales.find((a) => a.id === x.animal_id)?.numero}:${x.encontrado}`));
    await page.screenshot({ path: `${DIR}/05-contrato-con-visita.png`, fullPage: true });

    // En la ficha: el peso de la visita (U1) y el "no encontrado" (U2).
    await page.goto(`/#/animales/${animales[0].id}`);
    await page.reload();
    await expect(page.getByRole('heading', { name: `Animal N° ${animales[0].numero}` })).toBeVisible();
    r.fichaU1 = {
      peso: await page.getByText('200 kg', { exact: true }).count(),
      pierdePeso: await page.getByText('Pierde peso').count(),
      ubicacion: (await page.locator('section').filter({ has: page.getByRole('heading', { name: 'Ubicación' }) }).innerText()).replace(/\s+/g, ' ').slice(0, 200),
    };
    await page.goto(`/#/animales/${animales[1].id}`);
    await expect(page.getByRole('heading', { name: `Animal N° ${animales[1].numero}` })).toBeVisible();
    r.fichaU2NoEncontrado = await page.getByText(/no encontrado/i).count();
    await page.screenshot({ path: `${DIR}/06-ficha-no-encontrado.png`, fullPage: true });

    // Lista: última visita.
    await page.goto('/#/al-partir');
    r.tarjetaLista = (await page.getByRole('link', { name: new RegExp(`${P} Tenedor UI`) }).innerText()).replace(/\s+/g, ' ');

    // R7: terminar desde la interfaz.
    await page.goto(`/#/al-partir/${contratoId}`);
    await page.getByRole('button', { name: 'Editar contrato' }).tap();
    hoja = page.getByRole('dialog', { name: 'Editar contrato' });
    await hoja.getByLabel('Estado').selectOption('terminado');
    await hoja.getByRole('button', { name: 'Guardar' }).tap();
    await expect(hoja).toHaveCount(0);
    await expect(page.getByText(/Contrato terminado/)).toBeVisible();
    r.terminado = {
      botonAsignar: await page.getByRole('button', { name: 'Asignar animales' }).count(),
      texto: (await page.getByText(/Contrato terminado/).innerText()).slice(0, 80),
      animalesSiguen: await page.getByText('Animales (3)').count(),
    };
    r.detalle = { desborde: await page.evaluate(medirDesborde), controlesChicos: await page.evaluate(medirControles) };
    await page.screenshot({ path: `${DIR}/07-terminado.png`, fullPage: true });

    registrar('flujo en el celular', r);
    registrar('consola y red', errores);
    expect(r.tenedorVacio).toMatch(/nombre/);
    expect(r.tenedorSinFinca).toMatch(/finca/);
    expect(r.tenedorDobleToque).toEqual({ tenedores: 1, fincas: 1 });
    expect(r.contrato['pct 150']).toMatch(/entre 0 y 100/);
    expect(r.contrato['pct -5']).toMatch(/entre 0 y 100/);
    expect(r.contrato.precioNegativo).toMatch(/negativo/);
    expect(r.movimientosTrasAsignar).toBe(3);
    expect(r.visitaVacia).toMatch(/al menos un peso/);
    expect(r.visitaFechaFutura).toMatch(/futura/);
    expect(r.visitaEnContrato).toMatch(/1 pesados, 1 no encontrados/);
    expect(r.fichaU1.peso).toBeGreaterThan(0);
    expect(r.terminado.botonAsignar).toBe(0);
    expect(r.lista.desborde.scrollWidth).toBe(375);
    expect(r.detalle.desborde.scrollWidth).toBe(375);
    // Hallazgos (anotaciones): R1 sin edición de tenedores; "no encontrado" fuera de la ficha; U3 sin marcar.
    if (!r.editarTenedorEnPantalla) registrar('HALLAZGO 007 R1', 'no hay forma de editar un tenedor en la interfaz');
    if (!r.fichaU2NoEncontrado) registrar('HALLAZGO 007 criterio 1', 'la ficha del animal no muestra que no se encontró en la visita');
  });
});
