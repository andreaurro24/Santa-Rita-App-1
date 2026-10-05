import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { clientePrueba, iniciarSesion } from './helpers';
import { medirControles, medirDesborde } from './verificador-medidas';

// Pruebas del VERIFICADOR para la spec 011 (venta real y cierre del ciclo), ronda 1.
// 2026-09-28 (commit 186bf8c): cifras del tenedor adaptadas a la regla por contrato (DT-03-3).
// Prefijo VRF-VT; todo se borra al final (ventas, animales, lotes, contrato, costos).
// Ronda 2 de la 012 (2026-09-28, HEAD 1f12e28): "1 vientre no aparece: no se vende." en singular (la regex acepta los
// dos textos y la espera tiene tiempo límite); el Medio 5 de la 011 (animal vendido) pasa a comprobarse.
//
// Lote V (meta 300), precio $8.000/kg, destare 0 %. Gasto de lote $1.000.000 hace 10 días → $200.000 a cada uno de 5.
//   V1 novillo  compra   600.000 → costo   800.000; 270 → 300 kg hoy.
//   V2 novillo  compra   600.000 → costo   800.000; 300 kg; "Al partir" 50 %.
//   V3 novillo  compra 3.000.000 → costo 3.200.000; 300 kg; "Al partir" 50 % (pierde).
//   V4 vientre  compra   500.000 → costo   700.000; no se vende (D2).
//   V5 ternera  compra   400.000 → costo   600.000; 180 → 200 kg hoy.
// Venta de V1, V2, V3 y V5 a los pesos propuestos:
//   ingreso 2.400.000 × 3 + 1.600.000 = 8.800.000; costo 5.400.000.
//   Ganancia por animal: V1 1.600.000, V2 1.600.000, V3 −800.000, V5 1.000.000.
//   Tenedor (D8/D11 por contrato desde el 2026-09-28, DT-03-3): ganancia neta del contrato
//   1.600.000 − 800.000 = 800.000 → 50 % = 400.000. (Con la regla anterior, por animal, eran 800.000.)
//   Margen neto 8.800.000 − 5.400.000 − 400.000 = 3.000.000.

const DIR = 'test-results/vrf-011';
mkdirSync(DIR, { recursive: true });
const P = 'VRF-VT';
const COMPRADOR = `${P} Comprador`;

const hoyBogota = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
const haceDias = (n) => new Date(Date.parse(`${hoyBogota()}T12:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);
const num = (s) => (s == null ? NaN : Number(String(s).replace(/[−-]/, '-').replace(/[^\d-]/g, '')));

function registrar(nombre, datos) {
  console.log(`${nombre}: ${JSON.stringify(datos)}`);
  test.info().annotations.push({ type: nombre, description: JSON.stringify(datos) });
}

async function limpiar() {
  const supabase = await clientePrueba();
  const { data: lotes } = await supabase.from('lotes').select('id').like('codigo', `${P}%`);
  const idsLotes = (lotes ?? []).map((l) => l.id);
  if (idsLotes.length) {
    const { data: ventas } = await supabase.from('ventas').select('id').in('lote_id', idsLotes);
    for (const v of ventas ?? []) await supabase.from('ventas').delete().eq('id', v.id);
  }
  await supabase.from('ventas').delete().like('comprador', `${P}%`);
  const { data: tenedores } = await supabase.from('tenedores').select('id').like('nombre', `${P}%`);
  const idsTen = (tenedores ?? []).map((t) => t.id);
  const { data: contratos } = idsTen.length ? await supabase.from('contratos_al_partir').select('id').in('tenedor_id', idsTen) : { data: [] };
  await supabase.from('costos').delete().like('descripcion', `${P}%`);
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
test.beforeAll(async () => {
  test.setTimeout(180_000);
  const supabase = await clientePrueba();
  await limpiar();
  await supabase.from('parametros').update({ destare_pct: 0 }).eq('id', true);
  const { data: propia } = await supabase.from('fincas').select('id').eq('tipo', 'propia').single();
  const lote = async (s, meta = 300) => {
    const { data, error } = await supabase.from('lotes').insert({ codigo: `${P}-${s}`, nombre: `${P} ${s}`, tipo: 'ceba', peso_meta_kg: meta, fecha_inicio: haceDias(90) }).select('id').single();
    if (error) throw error;
    return data.id;
  };
  const animal = async (s, loteId, { ingreso = haceDias(30), peso = 270, sexo = 'Macho', categoria = 'novillo', compra = 600_000, pesos = [[hoyBogota(), 300]] } = {}) => {
    const numero = `${P}-${s}`;
    const { data: id, error } = await supabase.rpc('registrar_animal', {
      datos: { numero_interno: numero, chapeta_ica: `${numero}-CH`, sexo, categoria, origen: 'compra', fecha_ingreso: ingreso, peso_ingreso_kg: peso, peso_objetivo_kg: 400, costo_compra_cop: compra, lote_id: loteId, finca_id: propia.id },
    });
    if (error) throw new Error(`${s}: ${error.message}`);
    for (const [fecha, kg] of pesos) {
      const { error: e } = await supabase.from('pesajes').insert({ animal_id: id, fecha, peso_kg: kg });
      if (e) throw e;
    }
    return id;
  };
  const V = await lote('V');
  const v = {};
  v.V1 = await animal('V1', V);
  v.V2 = await animal('V2', V);
  v.V3 = await animal('V3', V, { compra: 3_000_000 });
  v.V4 = await animal('V4', V, { sexo: 'Hembra', categoria: 'vientre_mayor', compra: 500_000 });
  v.V5 = await animal('V5', V, { sexo: 'Hembra', categoria: 'ternera', compra: 400_000, peso: 180, pesos: [[hoyBogota(), 200]] });
  const finca = (await supabase.from('fincas').insert({ nombre: `${P} finca tenedor`, tipo: 'tenedor' }).select('id').single()).data.id;
  const ten = (await supabase.from('tenedores').insert({ nombre: `${P} tenedor`, finca_id: finca }).select('id').single()).data.id;
  const contrato = (await supabase.from('contratos_al_partir').insert({ tenedor_id: ten, porcentaje_ganancia: 50, fecha_inicio: haceDias(40) }).select('id').single()).data.id;
  const asig = await supabase.rpc('asignar_a_contrato', { ids: [v.V2, v.V3], contrato, fecha: haceDias(20), motivo: `${P} al partir` });
  if (asig.error) throw asig.error;
  const g = await supabase.from('costos').insert({ lote_id: V, categoria: 'suplemento', descripcion: `${P} suplemento V`, monto_cop: 1_000_000, fecha: haceDias(10) });
  if (g.error) throw g.error;
  // W: pesado hace 30 días (240 → 270, estimado hoy 300) y un vientre; para la API y la propuesta de peso.
  const W = await lote('W');
  const w = {};
  for (const s of ['W1', 'W2']) w[s] = await animal(s, W, { ingreso: haceDias(60), peso: 240, pesos: [[haceDias(30), 270]] });
  w.W3 = await animal('W3', W, { sexo: 'Hembra', categoria: 'vientre_mayor', compra: 500_000 });
  // X: un solo novillo (el lote debe quedar vendido). Z: gasto después de la fecha de venta.
  const X = await lote('X');
  const x1 = await animal('X1', X);
  const Z = await lote('Z');
  const z = {};
  for (const s of ['Z1', 'Z2']) z[s] = await animal(s, Z, { ingreso: haceDias(60), peso: 240 });
  const gz = await supabase.from('costos').insert({ lote_id: Z, categoria: 'suplemento', descripcion: `${P} suplemento Z`, monto_cop: 400_000, fecha: haceDias(5) });
  if (gz.error) throw gz.error;
  // (animales.lote_id es NOT NULL: no hay animales sin lote que colar en una venta.)
  ids = { V, W, X, Z, v, w, x1, z, contrato, propia: propia.id };
});
test.afterAll(async () => {
  await limpiar();
});

async function simularClima(page) {
  await page.route('https://api.open-meteo.com/**', (r) =>
    r.fulfill({ json: { current: { temperature_2m: 30, precipitation: 0, weather_code: 1 }, daily: { time: [0, 1, 2, 3, 4, 5, 6].map((i) => haceDias(-i)), temperature_2m_max: Array(7).fill(33), temperature_2m_min: Array(7).fill(22), precipitation_sum: Array(7).fill(3), weather_code: Array(7).fill(1) } } }),
  );
}

async function costoEnFicha(page, id) {
  await page.goto(`/#/animales/${id}`);
  await page.reload();
  const card = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Costo acumulado' }) });
  await expect(card).toBeVisible();
  const t = (await card.innerText()).split('\n').map((l) => l.trim()).filter(Boolean);
  return num(t[t.indexOf('Total') + 1]);
}

test('VRF 011 R1–R6: asistente de venta del lote V contra el cálculo a mano (escritorio)', async ({ page, browser }) => {
  test.setTimeout(180_000);
  const errores = [];
  page.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
  page.on('response', (x) => x.status() >= 400 && !x.url().includes('/auth/v1/') && errores.push(`${x.status()} ${x.request().method()} ${x.url().split('?')[0]}`));
  const supabase = await clientePrueba();
  await simularClima(page);
  await iniciarSesion(page);
  const r = {};
  await page.goto('/#/');
  await expect(page.getByText('Reses activas')).toBeVisible();
  r.activosAntes = (await page.locator('main').innerText()).match(/Reses activas\s+(\d+)/)?.[1];
  await page.goto(`/#/ventas/nueva?lote=${ids.V}`);
  await expect(page.getByRole('heading', { name: 'Registrar venta' })).toBeVisible();
  // Sprint 05 (spec 019): asistente en 3 pasos. Paso 1: animales y pesos.
  const main = page.locator('main');
  const alerta = async () => ((await page.getByRole('alert').count()) ? (await page.getByRole('alert').first().innerText()).trim() : 'SIN MENSAJE');
  const siguiente = () => page.getByRole('button', { name: 'Siguiente' }).click();
  r.asistente = {
    animales: await page.getByRole('heading', { name: /^Animales \(/ }).innerText(),
    vientres: await main.getByText(/vientres? no aparecen?/).innerText({ timeout: 5000 }).catch(() => 'SIN AVISO'),
    ternera: await page.getByRole('status').filter({ hasText: /ternera/ }).innerText().catch(() => 'SIN AVISO'),
    pesos: await main.locator('ul li input[type=text]').evaluateAll((xs) => xs.map((x) => x.value)),
  };
  r.ui = {};
  await page.getByLabel(`Peso de venta de ${P}-V1 (kg)`).fill('abc');
  await siguiente();
  r.ui.pesoTexto = await alerta();
  await page.getByLabel(`Peso de venta de ${P}-V1 (kg)`).fill('0');
  await siguiente();
  r.ui.pesoCero = await alerta();
  await page.getByLabel(`Peso de venta de ${P}-V1 (kg)`).fill('300');
  await siguiente();
  // Paso 2: comprador, precio, destare y fecha.
  await page.getByLabel('Destare (%)').fill('0');
  await siguiente();
  r.ui.sinComprador = await alerta();
  await page.getByLabel('Comprador').fill(COMPRADOR);
  await page.getByLabel('Precio por kilo').fill('');
  await siguiente();
  r.ui.sinPrecio = await alerta();
  await page.getByLabel('Precio por kilo').fill('8000');
  await page.getByLabel('Destare (%)').fill('20');
  await siguiente();
  r.ui.destare20 = await alerta();
  await page.getByLabel('Destare (%)').fill('0');
  await page.getByLabel('Fecha de la venta').fill('2099-01-01');
  await siguiente();
  r.ui.fechaFutura = await alerta();
  await page.getByLabel('Fecha de la venta').fill(hoyBogota());
  await siguiente();
  // Paso 3: resumen.
  await page.waitForTimeout(500);
  r.asistente.recomendacion = (await page.locator('section').filter({ has: page.getByRole('heading', { name: 'Lo que recomienda el sistema hoy' }) }).innerText()).replace(/\s+/g, ' ');
  r.asistente.resultado = (await page.locator('section').filter({ has: page.getByRole('heading', { name: 'Resultado de esta venta' }) }).innerText()).split('\n').map((l) => l.trim()).filter(Boolean);
  await page.screenshot({ path: `${DIR}/01-asistente.png`, fullPage: true });
  // Doble clic en Guardar.
  await page.getByRole('button', { name: 'Guardar venta' }).dblclick();
  await expect(page.getByRole('heading', { name: new RegExp(`^Venta de ${P} V`) })).toBeVisible({ timeout: 15_000 });
  const ventaId = page.url().split('/ventas/')[1];
  await page.waitForTimeout(500);
  const detalle = (await page.locator('main').innerText()).split('\n').map((l) => l.trim()).filter(Boolean);
  r.detalle = detalle;
  await page.screenshot({ path: `${DIR}/02-detalle.png`, fullPage: true });

  // Base de datos.
  const { data: ventas } = await supabase.from('ventas').select('id, fecha, comprador, precio_kg_cop, destare_pct, recomendacion_sistema').eq('lote_id', ids.V);
  const { data: filas } = await supabase.from('venta_animales').select('animal_id, peso_kg, costo_acumulado_cop, contrato_id, porcentaje_tenedor').eq('venta_id', ventaId);
  const { data: estados } = await supabase.from('animales').select('numero_interno, estado').like('numero_interno', `${P}-V%`).order('numero_interno');
  const { data: loteV } = await supabase.from('lotes').select('estado').eq('id', ids.V).single();
  r.bd = { ventas: ventas.length, venta: ventas[0], filas: filas.map((f) => ({ ...f, animal_id: Object.entries(ids.v).find(([, id]) => id === f.animal_id)?.[0] })), estados, loteV: loteV.estado };

  // Lista, otra sesión y efecto en el resto de la app.
  const otro = await browser.newContext();
  const p2 = await otro.newPage();
  await simularClima(p2);
  await iniciarSesion(p2);
  await p2.goto('/#/ventas');
  const item = p2.getByRole('link').filter({ hasText: `${P} V` });
  r.lista = (await item.innerText()).split('\n').map((l) => l.trim()).filter(Boolean);
  await otro.close();
  await page.goto('/#/');
  await page.reload();
  await expect(page.getByText('Reses activas')).toBeVisible();
  r.activosDespues = (await page.locator('main').innerText()).match(/Reses activas\s+(\d+)/)?.[1];
  await page.goto('/#/recomendacion');
  await page.getByLabel('Lote a evaluar').selectOption({ label: `${P} V` });
  await page.waitForTimeout(400);
  r.recomendacionTrasVenta = (await page.locator('section').filter({ has: page.getByRole('heading', { name: `${P} V`, exact: true }) }).innerText()).replace(/\s+/g, ' ');
  // Un gasto de hoy en el lote V solo debe cargarlo V4 (el único activo).
  await supabase.from('costos').insert({ lote_id: ids.V, categoria: 'sal_mineral', descripcion: `${P} sal tras venta`, monto_cop: 500_000, fecha: hoyBogota() });
  r.fichaV4 = await costoEnFicha(page, ids.v.V4);
  r.fichaV1 = await costoEnFicha(page, ids.v.V1);
  r.fichaV1Texto = (await page.locator('main').innerText()).slice(0, 400).replace(/\s+/g, ' ');
  r.fichaV1OfreceRegistrarPeso = await page.getByRole('button', { name: /Registrar peso/ }).isVisible().catch(() => false);
  r.fichaV1Acciones = await page.locator('main button').evaluateAll((bs) => bs.filter((b) => b.checkVisibility()).map((b) => b.innerText.trim()).filter(Boolean));
  r.fichaV1DiceVendido = /vendid/i.test(await page.locator('main').innerText());
  await page.goto('/#/animales');
  await page.getByPlaceholder(/Buscar por número/).fill(`${P}-V1`);
  r.hatoV1 = (await page.locator('main table tbody').innerText().catch(() => '')).replace(/\s+/g, ' ');
  await page.goto('/#/indicadores');
  await page.reload();
  await expect(page.getByText('Metas frente a la línea base')).toBeVisible();
  r.indicadores = (await page.locator('main').innerText()).split('\n').filter((l) => /venta/i.test(l));
  registrar('venta V', r);
  registrar('consola y red', errores);

  // R1–R5 contra el cálculo a mano.
  expect(r.asistente.animales).toBe('Animales (4 de 4)');
  expect(r.asistente.pesos).toEqual(['300', '300', '300', '200']);
  expect(num(r.asistente.resultado[r.asistente.resultado.indexOf('Ingreso') + 1])).toBe(8_800_000);
  expect(num(r.asistente.resultado[r.asistente.resultado.indexOf('Costo acumulado') + 1])).toBe(5_400_000);
  expect(num(r.asistente.resultado[r.asistente.resultado.indexOf('A los tenedores') + 1])).toBe(400_000);
  expect(num(r.asistente.resultado[r.asistente.resultado.indexOf('Margen neto') + 1])).toBe(3_000_000);
  expect(r.ui.sinComprador).toMatch(/comprador/);
  expect(r.ui.destare20).toMatch(/destare/i);
  expect(r.ui.fechaFutura).toMatch(/futura/);
  expect(r.ui.pesoTexto).toMatch(/peso/i);
  expect(r.ui.pesoCero).toMatch(/peso/i);
  expect(r.ui.sinPrecio).toMatch(/precio/i);
  expect(r.bd.ventas).toBe(1);
  expect(r.bd.filas).toHaveLength(4);
  const porAnimal = Object.fromEntries(r.bd.filas.map((f) => [f.animal_id, f]));
  expect(porAnimal.V1.costo_acumulado_cop).toBe(800_000);
  expect(porAnimal.V3.costo_acumulado_cop).toBe(3_200_000);
  expect(Number(porAnimal.V2.porcentaje_tenedor)).toBe(50);
  expect(r.bd.estados.map((e) => e.estado)).toEqual(['vendido', 'vendido', 'vendido', 'activo', 'vendido']);
  expect(r.bd.loteV).toBe('activo'); // le queda el vientre V4
  expect(r.bd.venta.recomendacion_sistema).toMatchObject({ recomendacion: expect.any(String), margenNeto: expect.any(Number), equilibrioKg: expect.any(Number) });
  expect(r.detalle).toContain('$8.800.000');
  expect(r.detalle).toContain('$3.000.000');
  // Un gasto del mismo día de la venta: debería cargarlo solo V4 (el único activo) o reflejarse en la venta.
  if (r.fichaV4 !== 1_200_000 || r.fichaV1 !== 800_000) registrar('HALLAZGO 011 gasto del día de la venta', { fichaV4: r.fichaV4, esperadoV4: 1_200_000, fichaV1Vendido: r.fichaV1, copiaEnLaVenta: 800_000 });
  expect(Number(r.activosAntes) - Number(r.activosDespues)).toBe(4);
  expect(r.recomendacionTrasVenta).toMatch(/no tiene animales para vender/);
  const liq = r.detalle.find((l) => /ganancia neta/.test(l));
  registrar('liquidación', { texto: liq, pagar: r.detalle[r.detalle.indexOf(liq) + 1] });
  expect(r.detalle[r.detalle.indexOf(liq) + 1]).toBe('Pagar $400.000'); // D11 por contrato
  // Ronda 2 (011 Medio 5 y Bajo 1): el vendido se marca en /animales y su ficha no ofrece "Registrar peso".
  expect(r.asistente.vientres).toBe('1 vientre no aparece: no se vende.');
  expect(r.hatoV1).toMatch(/Vendido/);
  expect(r.fichaV1OfreceRegistrarPeso).toBe(false);
  expect(r.indicadores.join(' ')).not.toMatch(/(^|\D)1 ventas/);
});

test('VRF 011 R2/R3: atomicidad y D2 en la base de datos (API)', async () => {
  test.setTimeout(120_000);
  const supabase = await clientePrueba();
  const base = { fecha: hoyBogota(), comprador: `${P} API`, precio_kg: 8000, destare: 0, recomendacion: null, notas: null };
  const venta = (lote, animales, extra = {}) => supabase.rpc('registrar_venta', { ...base, lote, animales, ...extra });
  const fila = (id, peso = 280) => ({ animal_id: id, peso_kg: peso, costo_cop: 600_000 });
  const estado = async (id) => (await supabase.from('animales').select('estado').eq('id', id).single()).data.estado;
  const conteo = async () => (await supabase.from('ventas').select('id', { count: 'exact', head: true }).like('comprador', `${P}%`)).count;
  const r = {};
  const antes = await conteo();
  r.conVientre = (await venta(ids.W, [fila(ids.w.W1), fila(ids.w.W3)])).error?.message ?? 'ACEPTADA';
  r.duplicado = (await venta(ids.W, [fila(ids.w.W1), fila(ids.w.W1)])).error?.message ?? 'ACEPTADA';
  r.deOtroLote = (await venta(ids.W, [fila(ids.w.W1), fila(ids.x1)])).error?.message ?? 'ACEPTADA';
  r.fechaFutura = (await venta(ids.W, [fila(ids.w.W1)], { fecha: '2099-01-01' })).error?.message ?? 'ACEPTADA';
  r.antesDelIngreso = (await venta(ids.W, [fila(ids.w.W1)], { fecha: haceDias(90) })).error?.message ?? 'ACEPTADA';
  r.pesoCero = (await venta(ids.W, [fila(ids.w.W1, 0)])).error?.message ?? 'ACEPTADA';
  r.precioCero = (await venta(ids.W, [fila(ids.w.W1)], { precio_kg: 0 })).error?.message ?? 'ACEPTADA';
  r.destare20 = (await venta(ids.W, [fila(ids.w.W1)], { destare: 20 })).error?.message ?? 'ACEPTADA';
  r.compradorVacio = (await venta(ids.W, [fila(ids.w.W1)], { comprador: '   ' })).error?.message ?? 'ACEPTADA';
  r.sinAnimales = (await venta(ids.W, [])).error?.message ?? 'ACEPTADA';
  r.costoNegativo = (await venta(ids.W, [{ animal_id: ids.w.W1, peso_kg: 280, costo_cop: -5 }])).error?.message ?? 'ACEPTADA';
  r.ventasTrasErrores = (await conteo()) - antes;
  r.W1TrasErrores = await estado(ids.w.W1);
  // Venta completa del lote X (un solo novillo): el lote queda vendido; una segunda venta se rechaza.
  const vx = await venta(ids.X, [fila(ids.x1)], { comprador: `${P} API X` });
  r.ventaX = vx.error?.message ?? 'ok';
  r.loteX = (await supabase.from('lotes').select('estado').eq('id', ids.X).single()).data.estado;
  r.segundaVentaX = (await venta(ids.X, [fila(ids.x1)], { comprador: `${P} API X2` })).error?.message ?? 'ACEPTADA';
  // D2 por fuera de la función: insertar directamente el vientre W3 en la venta de X.
  const ins = await supabase.from('venta_animales').insert({ venta_id: vx.data, animal_id: ids.w.W3, peso_kg: 300, costo_acumulado_cop: 500_000 }).select('id');
  r.vientreDirectoEnVentaAnimales = ins.error ? `${ins.error.code} ${ins.error.message}` : 'ACEPTADO';
  if (!ins.error) await supabase.from('venta_animales').delete().eq('animal_id', ids.w.W3);
  // Editar a mano el peso de una venta ya registrada.
  const ed = await supabase.from('venta_animales').update({ peso_kg: 999 }).eq('animal_id', ids.x1).select('peso_kg');
  r.editarPesoDeVentaCerrada = ed.error ? ed.error.code : `ACEPTADO (${ed.data?.[0]?.peso_kg})`;
  // Borrar la venta: ¿qué pasa con el animal y el lote?
  const del = await supabase.from('ventas').delete().eq('id', vx.data).select('id');
  r.borrarVenta = del.error ? del.error.code : `borró ${del.data.length}`;
  r.x1TrasBorrarVenta = await estado(ids.x1);
  r.loteXTrasBorrarVenta = (await supabase.from('lotes').select('estado').eq('id', ids.X).single()).data.estado;
  // anon
  const { createClient } = await import('@supabase/supabase-js');
  const anon = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  r.anon = {
    select: (await anon.from('ventas').select('id')).error?.code ?? 'devolvió filas',
    rpc: (await anon.rpc('registrar_venta', { ...base, lote: ids.W, animales: [fila(ids.w.W1)] })).error?.code ?? 'ACEPTADA',
  };
  registrar('API', r);
  expect(r.conVientre).toMatch(/vientre_no_se_vende/);
  expect(r.duplicado).not.toBe('ACEPTADA');
  expect(r.deOtroLote).toMatch(/animal_de_otro_lote/);
  expect(r.fechaFutura).toMatch(/fecha_futura/);
  expect(r.antesDelIngreso).toMatch(/fecha_antes_del_ingreso/);
  expect(r.ventasTrasErrores).toBe(0);
  expect(r.W1TrasErrores).toBe('activo');
  expect(r.loteX).toBe('vendido');
  expect(r.segundaVentaX).toMatch(/lote_cerrado/);
  expect(r.anon.select).toBe('42501');
});

test('VRF 011: venta con fecha pasada y el peso propuesto (lotes Z y W)', async ({ page }) => {
  test.setTimeout(120_000);
  const supabase = await clientePrueba();
  await simularClima(page);
  await iniciarSesion(page);
  const r = {};
  // W: pesado hace 30 días (270 kg), estimado hoy 300 kg. ¿Qué peso propone el asistente?
  await page.goto(`/#/ventas/nueva?lote=${ids.W}`);
  await expect(page.getByRole('heading', { name: /^Animales \(/ })).toBeVisible({ timeout: 15_000 }); // Sprint 05
  await page.waitForTimeout(500);
  r.W = { pesos: await page.locator('main ul li input[type=text]').evaluateAll((xs) => xs.map((x) => x.value)), vientres: await page.getByText(/vientres? no aparecen?/).innerText({ timeout: 5000 }).catch(() => 'SIN AVISO') };
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByLabel('Comprador').fill(`${P} Comprador W`);
  await page.getByLabel('Precio por kilo').fill('8000');
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.waitForTimeout(500);
  r.W.recomendacion = (await page.locator('section').filter({ has: page.getByRole('heading', { name: 'Lo que recomienda el sistema hoy' }) }).innerText()).replace(/\s+/g, ' ');
  r.W.resultado = (await page.locator('section').filter({ has: page.getByRole('heading', { name: 'Resultado de esta venta' }) }).innerText()).replace(/\s+/g, ' ');
  // Z: gasto de $400.000 hace 5 días; se vende Z1 con fecha de hace 10 días.
  r.fichaZ1Antes = await costoEnFicha(page, ids.z.Z1);
  await page.goto(`/#/ventas/nueva?lote=${ids.Z}`);
  await page.getByRole('checkbox', { name: `Vender ${P}-Z2` }).uncheck();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByLabel('Comprador').fill(`${P} Comprador Z`);
  await page.getByLabel('Precio por kilo').fill('8000');
  await page.getByLabel('Fecha de la venta').fill(haceDias(10));
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByRole('button', { name: 'Guardar venta' }).click();
  await expect(page.getByRole('heading', { name: new RegExp(`^Venta de ${P} Z`) })).toBeVisible({ timeout: 15_000 });
  const { data: fz } = await supabase.from('venta_animales').select('costo_acumulado_cop').eq('animal_id', ids.z.Z1).single();
  r.copiaCostoZ1 = fz.costo_acumulado_cop;
  r.fichaZ2Despues = await costoEnFicha(page, ids.z.Z2);
  await page.goto(`/#/costos?lote=${ids.Z}`);
  await page.reload();
  r.costosZ = (await page.locator('main').innerText()).split('\n').filter((l) => /sin repartir|no se repart|Promedio|Total/i.test(l)).slice(0, 6);
  r.sumaCargada = r.copiaCostoZ1 + r.fichaZ2Despues;
  r.costoReal = 600_000 * 2 + 400_000;
  registrar('fecha pasada y peso propuesto', r);
  if (r.sumaCargada !== r.costoReal) registrar('HALLAZGO 011 doble conteo con venta de fecha pasada', { copiaZ1: r.copiaCostoZ1, fichaZ2: r.fichaZ2Despues, suma: r.sumaCargada, real: r.costoReal });
  expect(r.W.pesos).toEqual(['270', '270']);
});

test.describe('celular 375×812', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  test('VRF 011 asistente, lista y detalle en el celular', async ({ page }) => {
    await simularClima(page);
    await iniciarSesion(page);
    const r = {};
    await page.goto(`/#/ventas/nueva?lote=${ids.W}`);
    await expect(page.getByRole('heading', { name: 'Registrar venta' })).toBeVisible();
    await page.waitForTimeout(500);
    r.asistente = { desborde: await page.evaluate(medirDesborde), pequenos: await page.evaluate(medirControles) };
    await page.screenshot({ path: `${DIR}/03-asistente-celular.png`, fullPage: true });
    await page.goto('/#/ventas');
    await page.waitForTimeout(800);
    r.lista = { desborde: await page.evaluate(medirDesborde) };
    // Ronda 2 (011 Medio 5): en las tarjetas del celular el vendido también se marca.
    await page.goto('/#/animales');
    await page.getByPlaceholder(/Buscar por número/).fill(`${P}-V1`);
    await page.waitForTimeout(500);
    r.tarjetaV1 = (await page.locator('main ul li').filter({ hasText: `${P}-V1` }).first().innerText().catch(() => 'SIN TARJETA')).replace(/\s+/g, ' ');
    await page.screenshot({ path: `${DIR}/04-lista-celular.png`, fullPage: true });
    const link = page.getByRole('link').filter({ hasText: `${P} V` }).first();
    if (await link.count()) {
      await link.click();
      await page.waitForTimeout(800);
      r.detalle = { desborde: await page.evaluate(medirDesborde), pequenos: await page.evaluate(medirControles) };
      await page.screenshot({ path: `${DIR}/05-detalle-celular.png`, fullPage: true });
    }
    registrar('celular', r);
    expect(r.asistente.desborde.scrollWidth).toBe(375);
    expect(r.lista.desborde.scrollWidth).toBe(375);
    expect(r.tarjetaV1).toMatch(/Vendido/);
  });
});
