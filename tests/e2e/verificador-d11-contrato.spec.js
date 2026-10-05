import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { clientePrueba, iniciarSesion } from './helpers';
import { medirDesborde } from './verificador-medidas';

// Pruebas del VERIFICADOR para el cambio de regla del commit 186bf8c (2026-09-28, DT-03-3 y DT-03-9):
// la parte del tenedor "Al partir" se calcula sobre la ganancia neta del CONTRATO (suma de sus
// animales, solo si es positiva), en /recomendacion, /reporte, /ventas/nueva y el detalle de la venta.
// Prefijo VRF-D11; todo se borra al final.
//
// Lote K (meta 300 kg), $8.000/kg, destare 0 %, sin gastos de lote. Todos 270 kg hace 30 días → 300 kg hoy (GDP 1).
//   K1 propio             compra   600.000 → ganancia  1.800.000
//   K2 contrato A (50 %)  compra   600.000 → ganancia  1.800.000
//   K3 contrato A (50 %)  compra 3.000.000 → ganancia   −600.000   → A: 1.200.000 → paga 600.000
//   K4 contrato B (30 %)  compra 1.000.000 → ganancia  1.400.000   → B: 1.400.000 → paga 420.000
//   K5 contrato C (40 %)  compra 3.500.000 → ganancia −1.100.000   → C: negativo  → paga 0
// Hoy: ingreso 12.000.000; costo 8.700.000; tenedores 1.020.000 (por animal serían 1.320.000); margen 2.280.000.
// Escenarios (margen): hoy 2.280.000; 2 sem 2.694.400; 4 sem 3.108.800; 8 sem 3.937.600.
// Sensibilidad (margen): −10 % 1.392.000; −5 % 1.836.000; +5 % 2.724.000; +10 % 3.168.000.
// Lote M (DT-03-9): 2 novillos planos en 300 kg (GDP 0), meta 400, gasto $90.000 hace 5 días → VENDER sin meta.

const DIR = 'test-results/vrf-d11';
mkdirSync(DIR, { recursive: true });
const P = 'VRF-D11';

const hoyBogota = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
const haceDias = (n) => new Date(Date.parse(`${hoyBogota()}T12:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);
const num = (s) => (s == null ? NaN : Number(String(s).replace(/[−-]/, '-').replace(/[^\d-]/g, '')));
const lineas = async (loc) => (await loc.innerText()).split('\n').map((l) => l.trim()).filter(Boolean);
const trasEtiqueta = (ls, etiqueta) => num(ls[ls.indexOf(etiqueta) + 1]);

function registrar(nombre, datos) {
  console.log(`${nombre}: ${JSON.stringify(datos)}`);
  test.info().annotations.push({ type: nombre, description: JSON.stringify(datos) });
}

async function limpiar() {
  const supabase = await clientePrueba();
  const { data: lotes } = await supabase.from('lotes').select('id').like('codigo', `${P}%`);
  const idsLotes = (lotes ?? []).map((l) => l.id);
  if (idsLotes.length) await supabase.from('ventas').delete().in('lote_id', idsLotes);
  await supabase.from('ventas').delete().like('comprador', `${P}%`);
  const { data: tenedores } = await supabase.from('tenedores').select('id').like('nombre', `${P}%`);
  const idsTen = (tenedores ?? []).map((t) => t.id);
  const { data: contratos } = idsTen.length ? await supabase.from('contratos_al_partir').select('id').in('tenedor_id', idsTen) : { data: [] };
  await supabase.from('costos').delete().like('descripcion', `${P}%`);
  await supabase.from('precios_mercado').delete().like('fuente', `${P}%`);
  await supabase.from('precios_referencia').delete().like('fuente', `${P}%`); // Sprint 05
  const { data: animales } = await supabase.from('animales').select('id').like('numero_interno', `${P}%`);
  for (const a of animales ?? []) {
    await supabase.from('venta_animales').delete().eq('animal_id', a.id);
    await supabase.from('movimientos').delete().eq('animal_id', a.id);
    await supabase.from('animales').delete().eq('id', a.id);
  }
  if (contratos?.length) await supabase.from('contratos_al_partir').delete().in('id', contratos.map((c) => c.id));
  if (idsTen.length) await supabase.from('tenedores').delete().in('id', idsTen);
  await supabase.from('fincas').delete().like('nombre', `${P}%`);
  await supabase.from('lotes').delete().like('codigo', `${P}%`);
}

let ids;
let destareOriginal;
test.beforeAll(async () => {
  test.setTimeout(180_000);
  const supabase = await clientePrueba();
  await limpiar();
  destareOriginal = (await supabase.from('parametros').select('destare_pct').eq('id', true).single()).data?.destare_pct;
  await supabase.from('parametros').update({ destare_pct: 0 }).eq('id', true);
  const { data: propia } = await supabase.from('fincas').select('id').eq('tipo', 'propia').single();
  const lote = async (s, meta) => {
    const { data, error } = await supabase.from('lotes').insert({ codigo: `${P}-${s}`, nombre: `${P} ${s}`, tipo: 'ceba', peso_meta_kg: meta, fecha_inicio: haceDias(90) }).select('id').single();
    if (error) throw error;
    return data.id;
  };
  const animal = async (s, loteId, { compra, peso = 270, pesos = [[hoyBogota(), 300]] }) => {
    const numero = `${P}-${s}`;
    const { data: id, error } = await supabase.rpc('registrar_animal', {
      datos: { numero_interno: numero, chapeta_ica: `${numero}-CH`, sexo: 'Macho', categoria: 'novillo', origen: 'compra', fecha_ingreso: haceDias(30), peso_ingreso_kg: peso, peso_objetivo_kg: 400, costo_compra_cop: compra, lote_id: loteId, finca_id: propia.id },
    });
    if (error) throw new Error(`${s}: ${error.message}`);
    for (const [fecha, kg] of pesos) {
      const { error: e } = await supabase.from('pesajes').insert({ animal_id: id, fecha, peso_kg: kg });
      if (e) throw e;
    }
    return id;
  };
  const contrato = async (letra, pct, animalesIds) => {
    const finca = (await supabase.from('fincas').insert({ nombre: `${P} finca ${letra}`, tipo: 'tenedor' }).select('id').single()).data.id;
    const ten = (await supabase.from('tenedores').insert({ nombre: `${P} tenedor ${letra}`, finca_id: finca }).select('id').single()).data.id;
    const c = (await supabase.from('contratos_al_partir').insert({ tenedor_id: ten, porcentaje_ganancia: pct, fecha_inicio: haceDias(40) }).select('id').single()).data.id;
    const asig = await supabase.rpc('asignar_a_contrato', { ids: animalesIds, contrato: c, fecha: haceDias(20), motivo: `${P} al partir` });
    if (asig.error) throw asig.error;
    return c;
  };
  const K = await lote('K', 300);
  const k = {};
  k.K1 = await animal('K1', K, { compra: 600_000 });
  k.K2 = await animal('K2', K, { compra: 600_000 });
  k.K3 = await animal('K3', K, { compra: 3_000_000 });
  k.K4 = await animal('K4', K, { compra: 1_000_000 });
  k.K5 = await animal('K5', K, { compra: 3_500_000 });
  const cA = await contrato('A', 50, [k.K2, k.K3]);
  const cB = await contrato('B', 30, [k.K4]);
  const cC = await contrato('C', 40, [k.K5]);
  const M = await lote('M', 400);
  const m1 = await animal('M1', M, { compra: 600_000, peso: 300 });
  const m2 = await animal('M2', M, { compra: 600_000, peso: 300 });
  const g = await supabase.from('costos').insert({ lote_id: M, categoria: 'suplemento', descripcion: `${P} suplemento M`, monto_cop: 90_000, fecha: haceDias(5) });
  if (g.error) throw g.error;
  // El reporte usa el último boletín: uno de hoy a $8.000.
  const pr = await supabase.from('precios_mercado').insert({ fecha: hoyBogota(), precio_kg_cop: 8000, fuente: `${P} boletín` });
  if (pr.error) throw pr.error;
  // Sprint 05 (spec 021): el reporte usa el precio de la zona; se fija en $8.000 para todas las categorías.
  for (const categoria of ['ternero', 'ternera', 'levante', 'gordo', 'vaca']) {
    const z = await supabase.from('precios_referencia').insert({ categoria, precio_min_cop: 8000, precio_max_cop: 8000, fecha: hoyBogota(), fuente: `${P} zona` });
    if (z.error) throw z.error;
  }
  const { data: pasto } = await supabase.from('condicion_pasto').select('finca_id, fecha, nivel').eq('finca_id', propia.id).gte('fecha', haceDias(30));
  ids = { K, M, k, m1, m2, cA, cB, cC, propia: propia.id, pastoPropia: pasto };
});
test.afterAll(async () => {
  await limpiar();
  const supabase = await clientePrueba();
  if (destareOriginal != null) await supabase.from('parametros').update({ destare_pct: destareOriginal }).eq('id', true);
});

async function simularClima(page) {
  await page.route('https://api.open-meteo.com/**', (r) =>
    r.fulfill({ json: { current: { temperature_2m: 30, precipitation: 0, weather_code: 1 }, daily: { time: [0, 1, 2, 3, 4, 5, 6].map((i) => haceDias(-i)), temperature_2m_max: Array(7).fill(33), temperature_2m_min: Array(7).fill(22), precipitation_sum: Array(7).fill(3), weather_code: Array(7).fill(1) } } }),
  );
}

// Lee las cifras del componente AnalisisVenta dentro de `raiz`.
async function leerAnalisis(page, raiz) {
  await raiz.locator('details').evaluateAll((ds) => ds.forEach((d) => (d.open = true))); // Sprint 05: detalles plegados
  const ls = await lineas(raiz);
  const filas = await raiz.locator('table tbody tr').evaluateAll((trs) => trs.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.innerText.trim())));
  const sens = await raiz.locator('ul li.rounded-lg').evaluateAll((lis) => lis.map((li) => li.innerText.split('\n').map((x) => x.trim()).filter(Boolean)));
  return {
    margenHoy: trasEtiqueta(ls, 'Margen para Santa Rita hoy'),
    tenedores: trasEtiqueta(ls, 'Parte de los tenedores'),
    costo: trasEtiqueta(ls, 'Costo acumulado'),
    escenarios: filas.map((f) => num(f.at(-1))),
    costoConTenedores: filas.map((f) => num(f[3])),
    sensibilidad: sens.map((s) => num(s.at(-1))),
    texto: ls.join(' | '),
  };
}

const ESPERADO_K = {
  margenHoy: 2_280_000,
  tenedores: 1_020_000,
  costo: 8_700_000,
  escenarios: [2_280_000, 2_694_400, 3_108_800, 3_937_600],
  sensibilidad: [1_392_000, 1_836_000, 2_724_000, 3_168_000],
};

test('VRF D11 · el lote K con un contrato que gana, uno que pierde y un propio: recomendación, reporte, asistente y detalle', async ({ page, browser }) => {
  test.setTimeout(240_000);
  const errores = [];
  page.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
  page.on('response', (x) => x.status() >= 400 && !x.url().includes('/auth/v1/') && errores.push(`${x.status()} ${x.request().method()} ${x.url().split('?')[0]}`));
  const supabase = await clientePrueba();
  await simularClima(page);
  await iniciarSesion(page);
  const r = { pastoPropia: ids.pastoPropia };

  // /recomendacion con precio simulado de $8.000.
  await page.goto('/#/recomendacion');
  await page.getByLabel('Lote a evaluar').selectOption({ label: `${P} K` });
  await page.getByLabel('Probar con otro precio por kilo').fill('8000');
  await page.waitForTimeout(500);
  const secRec = page.locator('section').filter({ has: page.getByRole('heading', { name: `${P} K`, exact: true }) });
  r.recomendacion = await leerAnalisis(page, secRec);
  await page.screenshot({ path: `${DIR}/01-recomendacion-K.png`, fullPage: true });

  // /reporte con el boletín de hoy.
  await page.goto('/#/reporte');
  await page.reload();
  await page.locator('select').first().selectOption({ label: `${P} K` });
  await expect(page.locator('article')).toBeVisible();
  await page.waitForTimeout(500);
  r.reporte = await leerAnalisis(page, page.locator('article'));
  await page.screenshot({ path: `${DIR}/02-reporte-K.png`, fullPage: true });

  // /ventas/nueva: todos, sin K3 (el que pierde) y sin K2 (el que gana).
  await page.goto(`/#/ventas/nueva?lote=${ids.K}`);
  await expect(page.getByRole('heading', { name: 'Registrar venta' })).toBeVisible();
  // Sprint 05 (spec 019): 3 pasos. El paso 2 una vez; luego se va y viene entre el paso 1 y el 3.
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByLabel('Precio por kilo').fill('8000');
  await page.getByLabel('Destare (%)').fill('0');
  await page.getByLabel('Comprador').fill(`${P} Comprador`);
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.waitForTimeout(400);
  const secRes = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Resultado de esta venta' }) });
  const leerVista = async () => {
    const ls = await lineas(secRes);
    return { ingreso: trasEtiqueta(ls, 'Ingreso'), costo: trasEtiqueta(ls, 'Costo acumulado'), tenedores: trasEtiqueta(ls, 'A los tenedores'), margen: trasEtiqueta(ls, 'Margen neto') };
  };
  const alPaso1 = async () => { await page.getByRole('button', { name: 'Atrás' }).click(); await page.getByRole('button', { name: 'Atrás' }).click(); };
  const alPaso3 = async () => { await page.getByRole('button', { name: 'Siguiente' }).click(); await page.getByRole('button', { name: 'Siguiente' }).click(); await page.waitForTimeout(300); };
  r.asistenteTodos = await leerVista();
  await alPaso1();
  await page.getByRole('checkbox', { name: `Vender ${P}-K3` }).uncheck();
  await alPaso3();
  r.asistenteSinK3 = await leerVista();
  await alPaso1();
  await page.getByRole('checkbox', { name: `Vender ${P}-K3` }).check();
  await page.getByRole('checkbox', { name: `Vender ${P}-K2` }).uncheck();
  await alPaso3();
  r.asistenteSinK2 = await leerVista();
  await alPaso1();
  await page.getByRole('checkbox', { name: `Vender ${P}-K2` }).check();
  await alPaso3();
  r.asistenteOtraVez = await leerVista();
  r.asistenteRecomendacion = (await page.locator('section').filter({ has: page.getByRole('heading', { name: 'Lo que recomienda el sistema hoy' }) }).innerText()).replace(/\s+/g, ' ');
  await page.screenshot({ path: `${DIR}/03-asistente-K.png`, fullPage: true });
  await page.getByRole('button', { name: 'Guardar venta' }).click();
  await expect(page.getByRole('heading', { name: new RegExp(`^Venta de ${P} K`) })).toBeVisible({ timeout: 15_000 });
  const ventaId = page.url().split('/ventas/')[1];
  await page.waitForTimeout(500);

  const leerDetalle = async (p) => {
    const ls = await lineas(p.locator('main'));
    const liq = await p
      .locator('section')
      .filter({ has: p.getByRole('heading', { name: /Liquidación de tenedores/ }) })
      .locator('li')
      .evaluateAll((lis) => lis.map((li) => li.innerText.replace(/\s+/g, ' ').trim()));
    return { margen: trasEtiqueta(ls, 'Margen neto'), margenEsperado: trasEtiqueta(ls, 'Margen esperado'), ingreso: trasEtiqueta(ls, 'Ingreso'), liquidacion: liq.sort() };
  };
  r.detalle = await leerDetalle(page);
  await page.screenshot({ path: `${DIR}/04-detalle-K.png`, fullPage: true });

  // Copias en venta_animales.
  const { data: filas } = await supabase.from('venta_animales').select('animal_id, peso_kg, costo_acumulado_cop, contrato_id, porcentaje_tenedor').eq('venta_id', ventaId);
  const nombre = (id) => Object.entries(ids.k).find(([, v]) => v === id)?.[0];
  r.copias = filas.map((f) => ({ a: nombre(f.animal_id), peso: Number(f.peso_kg), costo: f.costo_acumulado_cop, contrato: f.contrato_id === ids.cA ? 'A' : f.contrato_id === ids.cB ? 'B' : f.contrato_id === ids.cC ? 'C' : f.contrato_id, pct: f.porcentaje_tenedor == null ? null : Number(f.porcentaje_tenedor) })).sort((a, b) => a.a.localeCompare(b.a));
  const { data: ventaBd } = await supabase.from('ventas').select('recomendacion_sistema').eq('id', ventaId).single();
  r.recomendacionGuardada = ventaBd.recomendacion_sistema;

  // Se cambia el porcentaje del contrato A después de la venta: el detalle debe seguir con la copia.
  const up = await supabase.from('contratos_al_partir').update({ porcentaje_ganancia: 10 }).eq('id', ids.cA);
  r.cambioPct = up.error?.message ?? 'ok';
  await page.reload();
  await expect(page.getByRole('heading', { name: new RegExp(`^Venta de ${P} K`) })).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(500);
  r.detalleTrasRecargar = await leerDetalle(page);

  // Otra sesión: lista y detalle.
  const otro = await browser.newContext();
  const p2 = await otro.newPage();
  await simularClima(p2);
  await iniciarSesion(p2);
  await p2.goto('/#/ventas');
  const item = p2.getByRole('link').filter({ hasText: `${P} K` });
  const lsLista = await lineas(item);
  r.lista = { tenedores: trasEtiqueta(lsLista, 'A los tenedores'), margen: trasEtiqueta(lsLista, 'Margen neto') };
  await item.click();
  await expect(p2.getByRole('heading', { name: new RegExp(`^Venta de ${P} K`) })).toBeVisible({ timeout: 15_000 });
  await p2.waitForTimeout(500);
  r.detalleOtraSesion = await leerDetalle(p2);
  await otro.close();
  registrar('lote K', r);
  registrar('consola y red', errores);

  // Recomendación y reporte contra el cálculo a mano (y entre sí).
  for (const pantalla of ['recomendacion', 'reporte']) {
    const x = r[pantalla];
    expect.soft(x.tenedores, `${pantalla} tenedores`).toBe(ESPERADO_K.tenedores);
    expect.soft(x.margenHoy, `${pantalla} margen hoy`).toBe(ESPERADO_K.margenHoy);
    expect.soft(x.costo, `${pantalla} costo`).toBe(ESPERADO_K.costo);
    expect.soft(x.escenarios, `${pantalla} escenarios`).toEqual(ESPERADO_K.escenarios);
    expect.soft(x.sensibilidad, `${pantalla} sensibilidad`).toEqual(ESPERADO_K.sensibilidad);
  }
  expect.soft(r.recomendacion.costoConTenedores[0]).toBe(8_700_000 + 1_020_000);
  // Asistente.
  expect.soft(r.asistenteTodos).toEqual({ ingreso: 12_000_000, costo: 8_700_000, tenedores: 1_020_000, margen: 2_280_000 });
  // Sin K3, el contrato A solo tiene a K2: 900.000 + 420.000.
  expect.soft(r.asistenteSinK3.tenedores).toBe(1_320_000);
  // Sin K2, el contrato A solo tiene a K3 (pierde): 0 + 420.000.
  expect.soft(r.asistenteSinK2.tenedores).toBe(420_000);
  expect.soft(r.asistenteOtraVez).toEqual(r.asistenteTodos);
  // Detalle, lista y otra sesión.
  const liqEsperada = [
    `${P} tenedor A: 2 reses, ganancia neta $1.200.000 Pagar $600.000`,
    `${P} tenedor B: 1 res, ganancia neta $1.400.000 Pagar $420.000`,
    `${P} tenedor C: 1 res, ganancia neta −$1.100.000 Pagar $0`,
  ];
  expect.soft(r.detalle.liquidacion).toEqual(liqEsperada);
  expect.soft(r.detalle.margen).toBe(2_280_000);
  expect.soft(r.detalle.margenEsperado).toBe(2_280_000);
  expect.soft(r.recomendacionGuardada?.margenNeto).toBe(2_280_000);
  expect.soft(r.detalleTrasRecargar).toEqual(r.detalle);
  expect.soft(r.detalleOtraSesion).toEqual(r.detalle);
  expect.soft(r.lista).toEqual({ tenedores: 1_020_000, margen: 2_280_000 });
  expect.soft(r.copias.map((c) => [c.a, c.contrato, c.pct, c.costo])).toEqual([
    ['K1', null, null, 600_000],
    ['K2', 'A', 50, 600_000],
    ['K3', 'A', 50, 3_000_000],
    ['K4', 'B', 30, 1_000_000],
    ['K5', 'C', 40, 3_500_000],
  ]);
  expect.soft(errores).toEqual([]);
});

test('VRF D11 · DT-03-9: VENDER sin llegar a la meta lo dice y pide confirmar el peso', async ({ page }) => {
  await simularClima(page);
  await iniciarSesion(page);
  await page.goto('/#/recomendacion');
  await page.getByLabel('Lote a evaluar').selectOption({ label: `${P} M` });
  await page.getByLabel('Probar con otro precio por kilo').fill('8000');
  await page.waitForTimeout(500);
  const sec = page.locator('section').filter({ has: page.getByRole('heading', { name: `${P} M`, exact: true }) });
  await sec.locator('details').evaluateAll((ds) => ds.forEach((d) => (d.open = true))); // Sprint 05: detalles plegados
  const texto = (await sec.innerText()).replace(/\s+/g, ' ');
  await page.screenshot({ path: `${DIR}/05-recomendacion-M.png`, fullPage: true });
  registrar('lote M', { texto, pastoPropia: ids.pastoPropia });
  expect(texto).toMatch(/Esperar ya no paga/);
  expect(texto).toMatch(/El lote no llegó a la meta pactada \(va en el 75 %\): confirma con el comprador que acepta ese peso\./);
  expect(texto).not.toMatch(/llegó a la meta pactada \(\d+ %\) con un margen/);
});

test.describe('celular 375×812', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  test('VRF D11 · liquidación por contrato legible en el celular', async ({ page }) => {
    await simularClima(page);
    await iniciarSesion(page);
    await page.goto('/#/ventas');
    const link = page.getByRole('link').filter({ hasText: `${P} K` }).first();
    await expect(link).toBeVisible({ timeout: 15_000 });
    await link.click();
    await page.waitForTimeout(800);
    const liq = page.locator('section').filter({ has: page.getByRole('heading', { name: /Liquidación de tenedores/ }) });
    await liq.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${DIR}/06-detalle-celular.png`, fullPage: true });
    const d = await page.evaluate(medirDesborde);
    registrar('celular', { desborde: d, liq: (await liq.innerText()).replace(/\s+/g, ' ') });
    expect(d.scrollWidth).toBe(375);
  });
});
