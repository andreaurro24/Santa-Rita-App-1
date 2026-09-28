import { mkdirSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';
import { clientePrueba, iniciarSesion } from './helpers';
import { medirControles, medirDesborde } from './verificador-medidas';

// Pruebas del VERIFICADOR para la spec 008 (insumos y costos, D9), ronda 1.
// - Criterio: $1.000.000 en el 2026-B (30 animales) suma $33.333 a cada uno, en el celular (375×812).
// - Validaciones en la interfaz y en la BD (trigger validar_costo, CHECK, RLS con anon).
// - La simplificación declarada (pertenencia actual + fecha de ingreso) frente a mover animales y bajas.
// Todo lo creado lleva el prefijo VRF-COS (lotes, animales, descripciones) y se borra al final.

const DIR = 'test-results/vrf-008';
mkdirSync(DIR, { recursive: true });
const P = 'VRF-COS';

const hoyBogota = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
const haceDias = (n) => new Date(Date.parse(`${hoyBogota()}T12:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);
const cop = (n) => `$${new Intl.NumberFormat('es-CO').format(Math.round(n))}`;

function registrar(nombre, datos) {
  console.log(`${nombre}: ${JSON.stringify(datos)}`);
  test.info().annotations.push({ type: nombre, description: JSON.stringify(datos) });
}

async function limpiar() {
  const supabase = await clientePrueba();
  await supabase.from('costos').delete().like('descripcion', `${P}%`);
  const { data: lotes } = await supabase.from('lotes').select('id').like('codigo', `${P}%`);
  for (const l of lotes ?? []) await supabase.from('costos').delete().eq('lote_id', l.id);
  const { data: animales } = await supabase.from('animales').select('id').like('numero_interno', `${P}%`);
  for (const a of animales ?? []) await supabase.from('animales').delete().eq('id', a.id);
  for (const l of lotes ?? []) await supabase.from('lotes').delete().eq('id', l.id);
}
test.beforeAll(limpiar);
test.afterAll(limpiar);

async function crearLote(supabase, sufijo) {
  const { data, error } = await supabase.from('lotes').insert({ codigo: `${P}-${sufijo}`, nombre: `${P} ${sufijo}`, tipo: 'ceba', peso_meta_kg: 400 }).select('id').single();
  if (error) throw error;
  return data.id;
}
async function crearAnimal(supabase, sufijo, loteId, { ingreso = haceDias(60), compra = 1_000_000 } = {}) {
  const numero = `${P}-${sufijo}`;
  const { data: id, error } = await supabase.rpc('registrar_animal', {
    datos: { numero_interno: numero, chapeta_ica: `${numero}-CH`, sexo: 'Macho', categoria: 'novillo', origen: 'compra', fecha_ingreso: ingreso, peso_ingreso_kg: 250, peso_objetivo_kg: 400, costo_compra_cop: compra, lote_id: loteId },
  });
  if (error) throw error;
  return { id, numero };
}

// Lee la tarjeta "Costo acumulado" de la ficha.
async function costoEnFicha(page, id) {
  await page.goto(`/#/animales/${id}`);
  const tarjeta = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Costo acumulado' }) });
  await expect(tarjeta).toBeVisible();
  const texto = (await tarjeta.innerText()).replace(/\s+/g, ' ');
  const valor = (label) => Number((texto.match(new RegExp(`${label} \\$([\\d.]+)`))?.[1] ?? 'NaN').replace(/\./g, ''));
  return { total: valor('Total'), directos: valor('Gastos directos'), deLote: valor('Parte de los gastos del lote'), texto };
}

test.describe('celular 375×812', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

  test('VRF 008 criterio 1 y 2: $1.000.000 en el 2026-B suma $33.333 a cada uno; un gasto directo solo a ese animal', async ({ page, browser }) => {
    test.setTimeout(150_000);
    const supabase = await clientePrueba();
    const { data: lote } = await supabase.from('lotes').select('id').eq('codigo', 'LOTE-2026-B').single();
    const { data: animales } = await supabase.from('animales').select('id, numero_interno, costo_compra_cop, estado, fecha_ingreso').eq('lote_id', lote.id).order('numero_interno');
    const errores = [];
    page.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
    page.on('response', (x) => x.status() >= 400 && !x.url().includes('/auth/v1/') && errores.push(`${x.status()} ${x.request().method()} ${x.url().split('?')[0]}`));
    const r = { animalesEnLote: animales.length, activos: animales.filter((a) => a.estado === 'activo').length };

    await iniciarSesion(page);
    // Llegar desde la navegación del celular: "Más" → "Insumos y costos".
    await page.getByRole('button', { name: /Más/ }).first().tap();
    await page.getByRole('link', { name: 'Insumos y costos' }).tap();
    await expect(page.getByRole('heading', { name: 'Insumos y costos' })).toBeVisible();
    await page.getByRole('combobox', { name: /^Lote/ }).selectOption(lote.id);
    r.pantallaVacia = { desborde: await page.evaluate(medirDesborde), controlesChicos: await page.evaluate(medirControles) };
    await page.screenshot({ path: `${DIR}/01-costos-vacio.png`, fullPage: true });

    await page.getByRole('button', { name: 'Registrar gasto' }).first().tap();
    const hoja = page.getByRole('dialog', { name: 'Registrar gasto' });
    await expect(hoja).toBeVisible();
    r.hoja = await hoja.evaluate((el) => {
      const b = el.getBoundingClientRect();
      const pie = el.querySelector('[data-dialogo-pie]').getBoundingClientRect();
      return { x: b.x, ancho: b.width, abajo: Math.round(b.bottom), pieVisible: pie.bottom <= innerHeight };
    });
    await hoja.getByLabel('Categoría').selectOption('suplemento');
    await hoja.getByLabel('Monto (COP)').fill('1.000.000'); // con puntos de miles, como se escribe en Colombia
    r.tecladoMonto = await hoja.getByLabel('Monto (COP)').getAttribute('inputmode');
    await hoja.getByLabel('Descripción').fill(`${P} suplemento criterio`);
    await page.screenshot({ path: `${DIR}/02-hoja-registrar.png` });
    await hoja.getByRole('button', { name: 'Guardar' }).dblclick();
    await expect(hoja).toHaveCount(0);
    const { data: filas } = await supabase.from('costos').select('id, monto_cop, fecha').eq('descripcion', `${P} suplemento criterio`);
    r.dobleClic = filas.length;
    r.guardado = filas[0];
    await page.screenshot({ path: `${DIR}/03-costos-con-gasto.png`, fullPage: true });
    r.pantallaConGasto = { desborde: await page.evaluate(medirDesborde), controlesChicos: await page.evaluate(medirControles) };
    const resumen = (await page.locator('section').filter({ has: page.getByRole('heading', { name: 'Resumen del lote' }) }).innerText()).replace(/\s+/g, ' ');
    r.resumen = resumen;

    // Cálculo independiente: compra + 1.000.000 / (animales que ya habían ingresado).
    const elegibles = animales.filter((a) => a.fecha_ingreso <= filas[0].fecha).length;
    const parte = 1_000_000 / elegibles;
    const [a, b] = animales;
    const fa = await costoEnFicha(page, a.id);
    r.fichaA = { esperadoTotal: Math.round(a.costo_compra_cop + parte), ...fa };
    await page.screenshot({ path: `${DIR}/04-ficha-costo.png`, fullPage: true });

    // Gasto directo a B: cambia B y no cambia A.
    await supabase.from('costos').insert({ lote_id: lote.id, animal_id: b.id, categoria: 'medicamentos', descripcion: `${P} directo B`, monto_cop: 50_000, fecha: hoyBogota() });
    await page.reload();
    const fb = await costoEnFicha(page, b.id);
    const fa2 = await costoEnFicha(page, a.id);
    r.fichaB = { esperadoTotal: Math.round(b.costo_compra_cop + parte + 50_000), ...fb };
    r.fichaATrasDirectoDeB = fa2.total;

    // Detalle del lote: tarjeta de costos.
    await page.goto(`/#/lotes/${lote.id}`);
    const tarjetaLote = (await page.locator('section').filter({ has: page.getByRole('heading', { name: 'Costos' }) }).innerText()).replace(/\s+/g, ' ');
    const promedioCompra = animales.reduce((s, x) => s + x.costo_compra_cop, 0) / animales.length;
    r.lote = { texto: tarjetaLote, esperadoPromedio: Math.round(promedioCompra + 1_000_000 / animales.length + 50_000 / animales.length) };
    r.loteDesborde = (await page.evaluate(medirDesborde)).scrollWidth;

    // Persistencia en otra sesión (escritorio).
    const otro = await browser.newContext();
    const p2 = await otro.newPage();
    await iniciarSesion(p2);
    await p2.goto(`/#/costos?lote=${lote.id}`);
    r.otraSesion = await expect(p2.getByText(`${P} suplemento criterio`)).toBeVisible().then(() => true, () => false);
    await p2.screenshot({ path: `${DIR}/05-costos-escritorio.png`, fullPage: true });
    await otro.close();

    registrar('criterio 2026-B', r);
    registrar('consola y red', errores);
    expect(r.animalesEnLote).toBe(30);
    expect(r.dobleClic).toBe(1);
    expect(r.guardado.monto_cop).toBe(1_000_000);
    expect(r.fichaA.total).toBe(r.fichaA.esperadoTotal);
    expect(r.fichaA.deLote).toBe(33_333);
    expect(r.fichaB.total).toBe(r.fichaB.esperadoTotal);
    expect(r.fichaB.directos).toBe(50_000);
    expect(r.fichaATrasDirectoDeB).toBe(r.fichaA.total);
    expect(r.lote.texto).toContain(cop(1_050_000));
    expect(r.lote.texto).toContain(cop(r.lote.esperadoPromedio));
    expect(r.pantallaConGasto.desborde.scrollWidth).toBe(375);
    expect(r.hoja.pieVisible).toBe(true);
    expect(r.otraSesion).toBe(true);
  });
});

test('VRF 008 R2: validaciones en la interfaz y en la base de datos, RLS', async ({ page }) => {
  const supabase = await clientePrueba();
  const { data: lote } = await supabase.from('lotes').select('id').eq('codigo', 'LOTE-2026-B').single();
  const { data: otroLote } = await supabase.from('lotes').select('id').eq('codigo', 'LOTE-2026-A').single();
  const { data: animalB } = await supabase.from('animales').select('id').eq('lote_id', lote.id).limit(1).single();
  const r = { ui: {}, bd: {} };

  await iniciarSesion(page);
  await page.goto(`/#/costos?lote=${lote.id}`);
  await page.getByRole('button', { name: 'Registrar gasto' }).first().click();
  const hoja = page.getByRole('dialog', { name: 'Registrar gasto' });
  const alerta = async () => ((await hoja.getByRole('alert').count()) ? (await hoja.getByRole('alert').innerText()).trim() : 'SIN MENSAJE');
  await hoja.getByRole('button', { name: 'Guardar' }).click();
  r.ui.vacio = await alerta();
  await hoja.getByLabel('Descripción').fill('   ');
  await hoja.getByLabel('Monto (COP)').fill('1000');
  await hoja.getByRole('button', { name: 'Guardar' }).click();
  r.ui.descripcionEnBlanco = await alerta();
  await hoja.getByLabel('Descripción').fill(`${P} validación`);
  for (const monto of ['0', '-5', 'abc', '1000,50', '$1.000', '1,000,000']) {
    await hoja.getByLabel('Monto (COP)').fill(monto);
    await hoja.getByRole('button', { name: 'Guardar' }).click();
    await page.waitForTimeout(300);
    r.ui[`monto ${monto}`] = (await hoja.count()) ? await alerta() : 'GUARDADO';
  }
  await hoja.getByLabel('Monto (COP)').fill('1000');
  await hoja.getByLabel('Fecha').fill('2099-01-01');
  await hoja.getByRole('button', { name: 'Guardar' }).click();
  r.ui.fechaFutura = await alerta();
  await hoja.getByLabel('Fecha').fill('1999-12-31');
  await hoja.getByRole('button', { name: 'Guardar' }).click();
  await page.waitForTimeout(1500);
  r.ui.fecha1999 = (await hoja.count()) ? await alerta() : 'GUARDADO';
  // Un monto con punto decimal: "12.5" se lee como 125 (los puntos se quitan como separadores de miles).
  await hoja.getByLabel('Fecha').fill(hoyBogota());
  await hoja.getByLabel('Descripción').fill(`${P} punto decimal`);
  await hoja.getByLabel('Monto (COP)').fill('12.5');
  await hoja.getByRole('button', { name: 'Guardar' }).click();
  await expect(hoja).toHaveCount(0).catch(() => {});
  r.ui.montoConPuntoDecimal = (await supabase.from('costos').select('monto_cop').eq('descripcion', `${P} punto decimal`)).data.map((x) => x.monto_cop);
  // Un monto enorme (error de ceros de más): ¿pide confirmación o avisa?
  await page.getByRole('button', { name: 'Registrar gasto' }).first().click();
  await hoja.getByLabel('Descripción').fill(`${P} enorme`);
  await hoja.getByLabel('Monto (COP)').fill('99999999999999999999');
  await hoja.getByRole('button', { name: 'Guardar' }).click();
  await page.waitForTimeout(1500);
  r.ui.montoFueraDeRango = (await hoja.count()) ? await alerta() : 'GUARDADO';
  await hoja.getByLabel('Monto (COP)').fill('100000000000');
  await hoja.getByRole('button', { name: 'Guardar' }).click();
  await page.waitForTimeout(1500);
  r.ui.cienMilMillones = (await hoja.count()) ? await alerta() : 'GUARDADO SIN CONFIRMAR';

  const base = { lote_id: lote.id, categoria: 'otros', descripcion: `${P} api`, fecha: haceDias(1), monto_cop: 1000 };
  const code = async (fila) => {
    const { error } = await supabase.from('costos').insert({ ...base, ...fila }).select('id');
    return error ? `${error.code} ${error.message.slice(0, 40)}` : 'ACEPTADO';
  };
  r.bd.montoCero = await code({ monto_cop: 0 });
  r.bd.montoNegativo = await code({ monto_cop: -1 });
  r.bd.montoDecimal = await code({ monto_cop: 1.5 });
  r.bd.fechaFutura = await code({ fecha: '2099-01-01' });
  r.bd.fecha1999 = await code({ fecha: '1999-12-31' });
  r.bd.sinLote = await code({ lote_id: null });
  r.bd.descripcionEnBlanco = await code({ descripcion: '   ' });
  r.bd.categoriaInvalida = await code({ categoria: 'gasolina' });
  const { data: deOtro } = await supabase.from('animales').select('id').eq('lote_id', otroLote.id).limit(1).single();
  r.bd.animalDeOtroLote = await code({ animal_id: deOtro.id });
  // Editar un gasto existente a fecha futura.
  const { data: ok } = await supabase.from('costos').insert({ ...base, descripcion: `${P} editar` }).select('id').single();
  const ed = await supabase.from('costos').update({ fecha: '2099-01-01' }).eq('id', ok.id).select('id');
  r.bd.editarAFechaFutura = ed.error?.code ?? 'ACEPTADO';
  const ed2 = await supabase.from('costos').update({ animal_id: deOtro.id }).eq('id', ok.id).select('id');
  r.bd.editarAAnimalDeOtroLote = ed2.error?.code ?? 'ACEPTADO';
  // anon
  const anon = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const aSel = await anon.from('costos').select('id');
  const aIns = await anon.from('costos').insert(base);
  const aDel = await anon.from('costos').delete().eq('id', ok.id).select('id');
  r.bd.anon = { select: aSel.error?.code ?? `devolvió ${aSel.data?.length}`, insert: aIns.error?.code ?? 'ACEPTADO', delete: aDel.error?.code ?? `borró ${aDel.data?.length}` };
  // Un gasto directo de un animal del lote (válido).
  r.bd.directoValido = await code({ animal_id: animalB.id, descripcion: `${P} directo válido` });

  registrar('validaciones', r);
  expect(r.ui.vacio).toMatch(/Describe el gasto/);
  expect(r.ui.descripcionEnBlanco).toMatch(/Describe el gasto/);
  for (const m of ['0', '-5', 'abc', '1000,50']) expect(r.ui[`monto ${m}`]).toMatch(/mayor que cero/);
  expect(r.ui.fechaFutura).toMatch(/futura/);
  expect(r.bd.montoCero).toMatch(/^23514/);
  expect(r.bd.montoNegativo).toMatch(/^23514/);
  expect(r.bd.fechaFutura).toMatch(/fecha_futura/);
  expect(r.bd.fecha1999).toMatch(/^23514/);
  expect(r.bd.sinLote).toMatch(/^23502/);
  expect(r.bd.descripcionEnBlanco).toMatch(/^23514/);
  expect(r.bd.categoriaInvalida).toMatch(/^23514/);
  expect(r.bd.animalDeOtroLote).toMatch(/animal_de_otro_lote/);
  expect(r.bd.editarAFechaFutura).toBe('23514');
  expect(r.bd.anon.select).toBe('42501');
  expect(r.bd.anon.insert).toBe('42501');
  expect(r.bd.directoValido).toBe('ACEPTADO');
});

test('VRF 008 R3/R4 y la simplificación declarada: mover animales entre lotes y bajas', async ({ page }) => {
  test.setTimeout(120_000);
  const supabase = await clientePrueba();
  const loteX = await crearLote(supabase, 'X');
  const loteY = await crearLote(supabase, 'Y');
  const x1 = await crearAnimal(supabase, 'X1', loteX);
  const x2 = await crearAnimal(supabase, 'X2', loteX);
  const x3 = await crearAnimal(supabase, 'X3', loteX);
  const y1 = await crearAnimal(supabase, 'Y1', loteY);
  const y2 = await crearAnimal(supabase, 'Y2', loteY);
  // Gastos de hace 30 días: X $900.000 (300.000 c/u), Y $200.000 (100.000 c/u), y $50.000 directo a X1.
  await supabase.from('costos').insert([
    { lote_id: loteX, categoria: 'suplemento', descripcion: `${P} sup X`, monto_cop: 900_000, fecha: haceDias(30) },
    { lote_id: loteY, categoria: 'suplemento', descripcion: `${P} sup Y`, monto_cop: 200_000, fecha: haceDias(30) },
  ]);
  const { data: directo } = await supabase.from('costos').insert({ lote_id: loteX, animal_id: x1.id, categoria: 'medicamentos', descripcion: `${P} directo X1`, monto_cop: 50_000, fecha: haceDias(20) }).select('id').single();
  await iniciarSesion(page);
  const r = { antes: {}, despues: {} };
  for (const [k, a] of Object.entries({ x1, x2, y1 })) r.antes[k] = await costoEnFicha(page, a.id);

  // Hoy se mueve X1 del lote X al Y (función del spec 006, desde la interfaz o la API).
  const mov = await supabase.rpc('mover_animales', { ids: [x1.id], fecha: hoyBogota(), motivo: `${P} mover`, lote_destino: loteY });
  r.mover = mov.error?.message ?? 'ok';
  await page.reload();
  for (const [k, a] of Object.entries({ x1, x2, y1 })) r.despues[k] = await costoEnFicha(page, a.id);
  // Resumen del lote X en /costos: total gastado vs. suma de lo que cargan sus animales activos.
  await page.goto(`/#/costos?lote=${loteX}`);
  r.resumenX = (await page.locator('section').filter({ has: page.getByRole('heading', { name: 'Resumen del lote' }) }).innerText()).replace(/\s+/g, ' ');
  // ¿Se puede corregir el gasto directo de X1 después de moverlo?
  const ed = await supabase.from('costos').update({ descripcion: `${P} directo X1 corregido` }).eq('id', directo.id).select('id');
  r.editarDirectoTrasMover = ed.error ? `${ed.error.code} ${ed.error.message}` : 'ok';
  await page.goto(`/#/costos?lote=${loteX}`);
  await page.getByRole('button', { name: `Editar gasto ${P} directo X1` }).click();
  const hoja = page.getByRole('dialog', { name: 'Editar gasto' });
  r.editarDirectoUI = { paraQuien: await hoja.getByLabel('¿Para quién?').evaluate((s) => s.options[s.selectedIndex]?.text) };
  await hoja.getByLabel('Monto (COP)').fill('60000');
  await hoja.getByRole('button', { name: 'Guardar' }).click();
  await page.waitForTimeout(1500);
  r.editarDirectoUI.resultado = (await hoja.count()) ? (await hoja.getByRole('alert').innerText().catch(() => 'sin alerta')) : 'guardado';
  await page.screenshot({ path: `${DIR}/06-editar-directo-tras-mover.png` });

  // Baja: X3 muere (estado por API; la interfaz de bajas es la spec 003) y luego se gasta $200.000 en X.
  await supabase.from('animales').update({ estado: 'muerto' }).eq('id', x3.id);
  await supabase.from('costos').insert({ lote_id: loteX, categoria: 'sal_mineral', descripcion: `${P} sal X tras la baja`, monto_cop: 200_000, fecha: hoyBogota() });
  await page.goto('/#/');
  await page.reload();
  r.trasBaja = { x2: (await costoEnFicha(page, x2.id)).deLote };

  registrar('simplificación', r);
  // Antes de mover, todo cuadra con D9.
  expect(r.antes.x1.deLote).toBe(300_000);
  expect(r.antes.x1.directos).toBe(50_000);
  expect(r.antes.y1.deLote).toBe(100_000);
  // Hallazgos (anotaciones, no fallas) de la simplificación y del filtro por lote actual.
  if (r.despues.x1.directos !== 50_000) registrar('HALLAZGO 008 R4', `al mover X1 su gasto directo de $50.000 desaparece de la ficha (directos ${r.despues.x1.directos})`);
  if (r.despues.y1.deLote !== 100_000) registrar('HALLAZGO 008 R3', `mover X1 a Y cambia hacia atrás el costo de Y1: ${r.antes.y1.deLote} → ${r.despues.y1.deLote}`);
  if (r.trasBaja.x2 !== 450_000 + 200_000) registrar('HALLAZGO 008 D9 bajas', `un animal muerto sigue recibiendo parte de los gastos posteriores: X2 = ${r.trasBaja.x2}`);
});
