import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { clientePrueba, iniciarSesion } from './helpers';
import { medirDesborde } from './verificador-medidas';

// Pruebas del VERIFICADOR para el commit 10667a9 (2026-09-28, DT-04-9): la parte del tenedor "Al partir"
// es su porcentaje sobre la ganancia neta ACUMULADA del contrato, menos lo ya pagado, con saldo a favor
// de Santa Rita si una pérdida llega después (011 R5, 010 R2, docs/plan.md D8).
// Prefijo VRF-D8A; todo se borra al final.
//
// Todos los animales: 270 kg hace 30 días → 300 kg hoy (GDP 1). $8.000/kg, destare 0 %, sin gastos de lote.
//   "gana":   compra   600.000 → ganancia  1.800.000 (50 % = 900.000)
//   "pierde": compra 3.000.000 → ganancia   −600.000 (50 % = −300.000)
// Contrato G (50 %) en TRES lotes: P1 (G1 gana), P2 (G2 pierde), P3 (G4 gana).
//   Venta P1 (hace 10 días) paga 900.000. Venta P2 (hace 5 días): acumulado 1.200.000 → le tocan 600.000,
//   ya se pagaron 900.000 → paga 0 y saldo a favor 300.000. Recomendación de P3: acumulado 3.000.000 → 1.500.000
//   − 900.000 = 600.000 (no 900.000). Venta P3: paga 600.000. Total 1.500.000 = 50 % de 3.000.000.
// Contrato H (50 %) en el lote R (H1 pierde, H2 gana): venta parcial de H1 (paga 0); la recomendación de R
//   con H2 da 600.000 (no 900.000); venta de H2 paga 600.000 = igual que juntos.
// Contrato J (50 %): T1 (J1 gana) vendido hoy; luego T2 (J2 pierde) con fecha de hace 5 días (anterior).
// Contrato S (50 %): U2 (pierde) y U1 (gana) vendidos el mismo día, en ese orden de registro.
// Contrato Z (0 %) en el lote V (Z1 gana, Z2 pierde), dos ventas.
// Ronda 2 (commit e549801): se liquida en ORDEN DE REGISTRO (created_at). La ficha del contrato muestra la
// "Liquidación acumulada". Contrato K (50 %) en el lote W, sin ventas: su ficha no muestra la tarjeta, y
// sirve para intentar una venta con fecha futura (debe rechazarse).

const DIR = 'test-results/vrf-d8a';
mkdirSync(DIR, { recursive: true });
const P = 'VRF-D8A';

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
  await supabase.from('precios_referencia').delete().like('fuente', `${P}%`); // Sprint 05
  const { data: lotes } = await supabase.from('lotes').select('id').like('codigo', `${P}%`);
  const idsLotes = (lotes ?? []).map((l) => l.id);
  if (idsLotes.length) await supabase.from('ventas').delete().in('lote_id', idsLotes);
  await supabase.from('ventas').delete().like('comprador', `${P}%`);
  const { data: tenedores } = await supabase.from('tenedores').select('id').like('nombre', `${P}%`);
  const idsTen = (tenedores ?? []).map((t) => t.id);
  const { data: contratos } = idsTen.length ? await supabase.from('contratos_al_partir').select('id').in('tenedor_id', idsTen) : { data: [] };
  await supabase.from('precios_mercado').delete().like('fuente', `${P}%`);
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
let fichaHNegativa; // texto de la tarjeta del contrato H cuando solo se ha vendido la pérdida (prueba 2)
test.beforeAll(async () => {
  test.setTimeout(240_000);
  const supabase = await clientePrueba();
  await limpiar();
  destareOriginal = (await supabase.from('parametros').select('destare_pct').eq('id', true).single()).data?.destare_pct;
  await supabase.from('parametros').update({ destare_pct: 0 }).eq('id', true);
  const { data: propia } = await supabase.from('fincas').select('id').eq('tipo', 'propia').single();
  const lote = async (s) => {
    const { data, error } = await supabase.from('lotes').insert({ codigo: `${P}-${s}`, nombre: `${P} ${s}`, tipo: 'ceba', peso_meta_kg: 300, fecha_inicio: haceDias(90) }).select('id').single();
    if (error) throw error;
    return data.id;
  };
  const animal = async (s, loteId, compra) => {
    const numero = `${P}-${s}`;
    const { data: id, error } = await supabase.rpc('registrar_animal', {
      datos: { numero_interno: numero, chapeta_ica: `${numero}-CH`, sexo: 'Macho', categoria: 'novillo', origen: 'compra', fecha_ingreso: haceDias(30), peso_ingreso_kg: 270, peso_objetivo_kg: 400, costo_compra_cop: compra, lote_id: loteId, finca_id: propia.id },
    });
    if (error) throw new Error(`${s}: ${error.message}`);
    const { error: e } = await supabase.from('pesajes').insert({ animal_id: id, fecha: hoyBogota(), peso_kg: 300 });
    if (e) throw e;
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
  const GANA = 600_000;
  const PIERDE = 3_000_000;
  const L = {};
  for (const s of ['P1', 'P2', 'P3', 'R', 'T1', 'T2', 'U1', 'U2', 'V', 'W']) L[s] = await lote(s);
  const a = {};
  a.G1 = await animal('G1', L.P1, GANA);
  a.G2 = await animal('G2', L.P2, PIERDE);
  a.G4 = await animal('G4', L.P3, GANA);
  a.H1 = await animal('H1', L.R, PIERDE);
  a.H2 = await animal('H2', L.R, GANA);
  a.J1 = await animal('J1', L.T1, GANA);
  a.J2 = await animal('J2', L.T2, PIERDE);
  a.S1 = await animal('S1', L.U1, GANA);
  a.S2 = await animal('S2', L.U2, PIERDE);
  a.Z1 = await animal('Z1', L.V, GANA);
  a.Z2 = await animal('Z2', L.V, PIERDE);
  a.K1 = await animal('K1', L.W, GANA);
  const C = {};
  C.G = await contrato('G', 50, [a.G1, a.G2, a.G4]);
  C.H = await contrato('H', 50, [a.H1, a.H2]);
  C.J = await contrato('J', 50, [a.J1, a.J2]);
  C.S = await contrato('S', 50, [a.S1, a.S2]);
  C.Z = await contrato('Z', 0, [a.Z1, a.Z2]);
  C.K = await contrato('K', 50, [a.K1]);
  // El reporte usa el último boletín: uno de hoy a $8.000.
  const pr = await supabase.from('precios_mercado').insert({ fecha: hoyBogota(), precio_kg_cop: 8000, fuente: `${P} boletín` });
  if (pr.error) throw pr.error;
  // Sprint 05 (spec 021): el reporte usa el precio de la zona; se fija en $8.000 para todas las categorías.
  for (const categoria of ['ternero', 'ternera', 'levante', 'gordo', 'vaca']) {
    const z = await supabase.from('precios_referencia').insert({ categoria, precio_min_cop: 8000, precio_max_cop: 8000, fecha: hoyBogota(), fuente: `${P} zona` });
    if (z.error) throw z.error;
  }
  ids = { L, a, C };
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

function vigilar(page, errores) {
  page.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
  page.on('response', (x) => x.status() >= 400 && !x.url().includes('/auth/v1/') && errores.push(`${x.status()} ${x.request().method()} ${x.url().split('?')[0]}`));
}

// /recomendacion o /reporte de un lote: parte de los tenedores y margen de hoy.
async function leerRecomendacion(page, lote) {
  await page.goto('/#/recomendacion');
  await page.getByLabel('Lote a evaluar').selectOption({ label: `${P} ${lote}` });
  await page.getByLabel('Probar con otro precio por kilo').fill('8000');
  await page.waitForTimeout(600);
  await page.locator('details').evaluateAll((ds) => ds.forEach((d) => (d.open = true))); // Sprint 05
  const sec = page.locator('section').filter({ has: page.getByRole('heading', { name: `${P} ${lote}`, exact: true }) });
  const ls = await lineas(sec);
  return { tenedores: trasEtiqueta(ls, 'Parte de los tenedores'), margen: trasEtiqueta(ls, 'Margen para Santa Rita hoy') };
}
async function leerReporte(page, lote) {
  await page.goto('/#/reporte');
  await page.reload();
  await page.locator('select').first().selectOption({ label: `${P} ${lote}` });
  await expect(page.locator('article')).toBeVisible();
  await page.waitForTimeout(600);
  const ls = await lineas(page.locator('article'));
  return { tenedores: trasEtiqueta(ls, 'Parte de los tenedores'), margen: trasEtiqueta(ls, 'Margen para Santa Rita hoy') };
}

async function leerDetalle(page) {
  const ls = await lineas(page.locator('main'));
  const liq = await page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: /Liquidación de tenedores/ }) })
    .locator('li')
    .evaluateAll((lis) => lis.map((li) => li.innerText.replace(/\s+/g, ' ').trim()));
  return { margen: trasEtiqueta(ls, 'Margen neto'), margenEsperado: trasEtiqueta(ls, 'Margen esperado'), liq };
}

// Registra la venta de un lote por el asistente y devuelve lo que mostró el asistente y el detalle.
async function venderUI(page, lote, { fecha = hoyBogota(), desmarcar = [], nombre } = {}) {
  await page.goto(`/#/ventas/nueva?lote=${ids.L[lote]}`);
  await expect(page.getByRole('heading', { name: 'Registrar venta' })).toBeVisible({ timeout: 15_000 });
  // Sprint 05 (spec 019): asistente en 3 pasos.
  for (const s of desmarcar) await page.getByRole('checkbox', { name: `Vender ${P}-${s}` }).uncheck();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByLabel('Precio por kilo').fill('8000');
  await page.getByLabel('Destare (%)').fill('0');
  await page.getByLabel('Fecha de la venta').fill(fecha);
  await page.getByLabel('Comprador').fill(`${P} Comprador ${nombre ?? lote}`);
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.waitForTimeout(500);
  const secRes = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Resultado de esta venta' }) });
  const ls = await lineas(secRes);
  const vista = { tenedores: trasEtiqueta(ls, 'A los tenedores'), margen: trasEtiqueta(ls, 'Margen neto') };
  // Ronda 2 (Bajo 4): aviso bajo "A los tenedores" cuando se descuenta lo acumulado.
  const aviso = ls.includes('Con lo acumulado y lo ya pagado del contrato');
  await page.screenshot({ path: `${DIR}/asistente-${nombre ?? lote}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Guardar venta' }).click();
  await expect(page.getByRole('heading', { name: new RegExp(`^Venta de ${P} ${lote}$`) })).toBeVisible({ timeout: 15_000 });
  const ventaId = page.url().split('/ventas/')[1];
  await page.waitForTimeout(500);
  const detalle = await leerDetalle(page);
  await page.screenshot({ path: `${DIR}/detalle-${nombre ?? lote}.png`, fullPage: true });
  return { vista, aviso, ventaId, detalle };
}

async function detallePorId(page, ventaId) {
  await page.goto(`/#/ventas/${ventaId}`);
  await expect(page.getByRole('heading', { name: /^Venta de / })).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(400);
  return leerDetalle(page);
}

async function leerLista(page) {
  await page.goto('/#/ventas');
  await expect(page.getByRole('heading', { name: 'Ventas', exact: true })).toBeVisible();
  await page.waitForTimeout(600);
  const items = await page.getByRole('link').filter({ hasText: `${P} Comprador` }).all();
  const out = {};
  for (const it of items) {
    const ls = await lineas(it);
    const comprador = ls.find((l) => l.includes(`${P} Comprador`)).match(/Comprador (\S+)\./)[1];
    out[comprador] = { tenedores: trasEtiqueta(ls, 'A los tenedores'), margen: trasEtiqueta(ls, 'Margen neto') };
  }
  return out;
}

test.describe.configure({ mode: 'serial' });

test('VRF D8A · contrato en tres lotes: ganancia primero, pérdida después (saldo a favor) y la recomendación lo descuenta', async ({ page, browser }) => {
  test.setTimeout(300_000);
  const errores = [];
  vigilar(page, errores);
  await simularClima(page);
  await iniciarSesion(page);
  const r = {};
  r.recP3Antes = await leerRecomendacion(page, 'P3');
  r.ventaP1 = await venderUI(page, 'P1', { fecha: haceDias(10) });
  r.ventaP2 = await venderUI(page, 'P2', { fecha: haceDias(5) });
  r.recP3 = await leerRecomendacion(page, 'P3');
  await page.screenshot({ path: `${DIR}/recomendacion-P3.png`, fullPage: true });
  r.repP3 = await leerReporte(page, 'P3');
  r.ventaP3 = await venderUI(page, 'P3');
  // Otra sesión: lista y detalle de P2.
  const otro = await browser.newContext();
  const p2 = await otro.newPage();
  await simularClima(p2);
  await iniciarSesion(p2);
  r.lista = await leerLista(p2);
  r.detalleP2OtraSesion = await detallePorId(p2, r.ventaP2.ventaId);
  await otro.close();
  registrar('contrato G', r);
  registrar('consola y red', errores);

  expect.soft(r.recP3Antes.tenedores).toBe(900_000);
  expect.soft(r.ventaP1.vista).toEqual({ tenedores: 900_000, margen: 900_000 });
  expect.soft(r.ventaP1.aviso, 'P1 es la primera venta de G: sin aviso').toBe(false);
  expect.soft(r.ventaP2.aviso, 'P2 descuenta lo pagado en P1: con aviso').toBe(true);
  expect.soft(r.ventaP3.aviso, 'P3 descuenta el saldo: con aviso').toBe(true);
  expect.soft(r.ventaP1.detalle.liq).toEqual([`${P} tenedor G: 1 res, ganancia neta $1.800.000 Pagar $900.000`]);
  expect.soft(r.ventaP2.vista).toEqual({ tenedores: 0, margen: -600_000 });
  expect.soft(r.ventaP2.detalle.liq).toEqual([
    `${P} tenedor G: 1 res, ganancia neta −$600.000 Acumulada del contrato $1.200.000; ya se le pagaron $900.000. Saldo a favor de Santa Rita: $300.000 (se descuenta de las próximas ventas del contrato o se cobra al cerrarlo). Pagar $0`,
  ]);
  // La recomendación de P3 descuenta el saldo a favor: 50 % de 3.000.000 − 900.000 = 600.000.
  expect.soft(r.recP3).toEqual({ tenedores: 600_000, margen: 1_200_000 });
  expect.soft(r.repP3).toEqual(r.recP3);
  expect.soft(r.ventaP3.vista).toEqual({ tenedores: 600_000, margen: 1_200_000 });
  expect.soft(r.ventaP3.detalle.liq).toEqual([`${P} tenedor G: 1 res, ganancia neta $1.800.000 Acumulada del contrato $3.000.000; ya se le pagaron $900.000. Pagar $600.000`]);
  expect.soft(r.ventaP3.detalle.margenEsperado).toBe(1_200_000);
  expect.soft(r.lista).toMatchObject({ P1: { tenedores: 900_000, margen: 900_000 }, P2: { tenedores: 0, margen: -600_000 }, P3: { tenedores: 600_000, margen: 1_200_000 } });
  expect.soft(r.detalleP2OtraSesion).toEqual(r.ventaP2.detalle);
  expect.soft(errores).toEqual([]);
});

test('VRF D8A · venta parcial de un lote: la pérdida primero, la ganancia después paga igual que juntos', async ({ page }) => {
  test.setTimeout(240_000);
  const errores = [];
  vigilar(page, errores);
  await simularClima(page);
  await iniciarSesion(page);
  const r = {};
  r.recRAntes = await leerRecomendacion(page, 'R');
  r.venta1 = await venderUI(page, 'R', { fecha: haceDias(10), desmarcar: ['H2'], nombre: 'R1' });
  r.fichaH = await leerFicha(page, 'H');
  fichaHNegativa = (await page.locator('section').filter({ has: page.getByRole('heading', { name: 'Liquidación acumulada' }) }).innerText()).replace(/\s+/g, ' ');
  r.fichaHTexto = fichaHNegativa;
  r.recR = await leerRecomendacion(page, 'R');
  r.repR = await leerReporte(page, 'R');
  r.venta2 = await venderUI(page, 'R', { nombre: 'R2' });
  registrar('contrato H', r);
  registrar('consola y red', errores);
  // Juntos: 1.200.000 → 600.000.
  expect.soft(r.recRAntes.tenedores).toBe(600_000);
  expect.soft(r.fichaH).toMatchObject({ ganancia: -600_000, pagado: 0, saldo: 0 });
  expect.soft(r.venta1.vista.tenedores).toBe(0);
  expect.soft(r.venta1.detalle.liq).toEqual([`${P} tenedor H: 1 res, ganancia neta −$600.000 Pagar $0`]);
  expect.soft(r.recR).toEqual({ tenedores: 600_000, margen: 1_200_000 });
  expect.soft(r.repR).toEqual(r.recR);
  expect.soft(r.venta2.vista).toEqual({ tenedores: 600_000, margen: 1_200_000 });
  expect.soft(r.venta2.detalle.liq).toEqual([`${P} tenedor H: 1 res, ganancia neta $1.800.000 Acumulada del contrato $1.200.000; ya se le pagaron $0. Pagar $600.000`]);
  expect.soft(errores).toEqual([]);
});

test('VRF D8A · dos ventas el mismo día se liquidan en el orden de registro', async ({ page }) => {
  test.setTimeout(240_000);
  const errores = [];
  vigilar(page, errores);
  await simularClima(page);
  await iniciarSesion(page);
  const r = {};
  r.ventaU2 = await venderUI(page, 'U2'); // pierde, registrada primero
  r.ventaU1 = await venderUI(page, 'U1'); // gana, mismo día, después
  r.detalleU2 = await detallePorId(page, r.ventaU2.ventaId);
  const lista = await leerLista(page);
  r.lista = { U1: lista.U1, U2: lista.U2 };
  registrar('contrato S', r);
  registrar('consola y red', errores);
  expect.soft(r.ventaU1.vista.tenedores).toBe(600_000);
  expect.soft(r.ventaU1.detalle.liq).toEqual([`${P} tenedor S: 1 res, ganancia neta $1.800.000 Acumulada del contrato $1.200.000; ya se le pagaron $0. Pagar $600.000`]);
  expect.soft(r.detalleU2.liq).toEqual([`${P} tenedor S: 1 res, ganancia neta −$600.000 Pagar $0`]);
  expect.soft(r.lista).toEqual({ U1: { tenedores: 600_000, margen: 1_200_000 }, U2: { tenedores: 0, margen: -600_000 } });
  expect.soft(errores).toEqual([]);
});

test('VRF D8A · contrato al 0 % en dos ventas: aparece con $0, sin saldo ni NaN', async ({ page }) => {
  test.setTimeout(240_000);
  const errores = [];
  vigilar(page, errores);
  await simularClima(page);
  await iniciarSesion(page);
  const r = {};
  r.venta1 = await venderUI(page, 'V', { fecha: haceDias(10), desmarcar: ['Z2'], nombre: 'V1' });
  r.venta2 = await venderUI(page, 'V', { nombre: 'V2' });
  registrar('contrato Z', r);
  expect.soft(r.venta1.vista.tenedores).toBe(0);
  expect.soft(r.venta1.detalle.liq).toEqual([`${P} tenedor Z: 1 res, ganancia neta $1.800.000 Pagar $0`]);
  expect.soft(r.venta2.detalle.liq).toEqual([`${P} tenedor Z: 1 res, ganancia neta −$600.000 Acumulada del contrato $1.200.000; ya se le pagaron $0. Pagar $0`]);
  expect.soft(JSON.stringify(r)).not.toMatch(/NaN/);
  expect.soft(errores).toEqual([]);
});

test('VRF D8A · la carga extra de ventas: estados de carga y de error en /recomendacion, /reporte y /ventas/nueva', async ({ page }) => {
  test.setTimeout(180_000);
  await simularClima(page);
  await iniciarSesion(page);
  const r = {};
  for (const ruta of ['/#/recomendacion', '/#/reporte', '/#/ventas/nueva']) {
    // Lenta: muestra "Cargando datos…".
    await page.route('**/rest/v1/ventas*', async (x) => {
      await new Promise((ok) => setTimeout(ok, 2500));
      await x.continue().catch(() => {});
    });
    await page.goto('/#/');
    await page.goto(ruta);
    await page.reload();
    const cargando = await page.getByText('Cargando datos…').first().waitFor({ timeout: 2000 }).then(() => true).catch(() => false);
    await page.unroute('**/rest/v1/ventas*');
    // Falla: error con Reintentar, y al reintentar se recupera.
    await page.route('**/rest/v1/ventas*', (x) => x.fulfill({ status: 500, json: { message: 'caída simulada' } }));
    await page.reload();
    const alerta = page.getByRole('alert').filter({ hasText: 'No se pudieron cargar los datos' });
    const error = await alerta.waitFor({ timeout: 20_000 }).then(() => true).catch(() => false);
    const textoError = error ? (await alerta.innerText()).replace(/\s+/g, ' ') : null;
    await page.unroute('**/rest/v1/ventas*');
    if (error) await page.getByRole('button', { name: 'Reintentar' }).click();
    const recupera = await page
      .getByRole('heading', { name: /¿Vendo?|Reporte resumen|Registrar venta/ })
      .first()
      .waitFor({ timeout: 20_000 })
      .then(() => true)
      .catch(() => false);
    r[ruta] = { cargando, error, textoError, recupera };
    await page.screenshot({ path: `${DIR}/carga-${ruta.replace(/\W+/g, '_')}.png`, fullPage: true });
  }
  registrar('carga y error', r);
  for (const [ruta, x] of Object.entries(r)) {
    expect.soft(x.cargando, `${ruta} cargando`).toBe(true);
    expect.soft(x.error, `${ruta} error`).toBe(true);
    expect.soft(x.recupera, `${ruta} recupera`).toBe(true);
  }
});

test.describe('celular 375×812', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  test('VRF D8A · el saldo a favor se lee en el celular', async ({ page }) => {
    await simularClima(page);
    await iniciarSesion(page);
    await page.goto('/#/ventas');
    const link = page.getByRole('link').filter({ hasText: `${P} Comprador P2` }).first();
    await expect(link).toBeVisible({ timeout: 15_000 });
    await link.click();
    await page.waitForTimeout(800);
    const liq = page.locator('section').filter({ has: page.getByRole('heading', { name: /Liquidación de tenedores/ }) });
    await liq.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${DIR}/detalle-P2-celular.png`, fullPage: true });
    const d = await page.evaluate(medirDesborde);
    registrar('celular', { desborde: d, liq: (await liq.innerText()).replace(/\s+/g, ' ') });
    expect(d.scrollWidth).toBe(375);
    await expect(liq).toContainText('Saldo a favor de Santa Rita: $300.000');
  });
});

// Venta con fecha pasada ANTERIOR a otra ya registrada del mismo contrato.
// Ronda 2 (011 R5 reescrita): se liquida en orden de registro. T1 (registrada primero, hoy) paga 900.000 y no
// cambia nunca; T2 (registrada después con fecha de hace 5 días, pierde) paga 0 y deja 300.000 a favor.
test('VRF D8A · venta con fecha pasada registrada después: no cambia la liquidación ya hecha y deja saldo a favor', async ({ page }) => {
  test.setTimeout(240_000);
  const errores = [];
  vigilar(page, errores);
  await simularClima(page);
  await iniciarSesion(page);
  const r = {};
  r.ventaT1 = await venderUI(page, 'T1'); // gana, hoy: paga 900.000
  r.ventaT2 = await venderUI(page, 'T2', { fecha: haceDias(5) }); // pierde, con fecha anterior
  r.detalleT1Despues = await detallePorId(page, r.ventaT1.ventaId);
  r.detalleT2Recargado = await detallePorId(page, r.ventaT2.ventaId);
  const lista = await leerLista(page);
  r.lista = { T1: lista.T1, T2: lista.T2 };
  registrar('contrato J (fecha pasada)', r);
  registrar('consola y red', errores);
  expect.soft(r.ventaT1.detalle.liq).toEqual([`${P} tenedor J: 1 res, ganancia neta $1.800.000 Pagar $900.000`]);
  expect.soft(r.detalleT1Despues.liq, 'la liquidación ya mostrada de T1 no cambia').toEqual(r.ventaT1.detalle.liq);
  expect.soft(r.detalleT1Despues.margen, 'margen real de T1 sin cambios').toBe(r.ventaT1.detalle.margen);
  expect.soft(r.detalleT1Despues.margenEsperado).toBe(r.detalleT1Despues.margen);
  // El asistente de T2 muestra lo mismo que queda guardado (Bajo 3 de la ronda 1).
  expect.soft(r.ventaT2.vista).toEqual({ tenedores: 0, margen: -600_000 });
  expect.soft(r.ventaT2.aviso).toBe(true);
  expect.soft(r.ventaT2.detalle.liq).toEqual([
    `${P} tenedor J: 1 res, ganancia neta −$600.000 Acumulada del contrato $1.200.000; ya se le pagaron $900.000. Saldo a favor de Santa Rita: $300.000 (se descuenta de las próximas ventas del contrato o se cobra al cerrarlo). Pagar $0`,
  ]);
  expect.soft(r.ventaT2.detalle.margenEsperado, 'la copia de la recomendación coincide con el asistente').toBe(-600_000);
  expect.soft(r.detalleT2Recargado).toEqual(r.ventaT2.detalle);
  expect.soft(r.lista).toEqual({ T1: { tenedores: 900_000, margen: 900_000 }, T2: { tenedores: 0, margen: -600_000 } });
  expect.soft(errores).toEqual([]);
});

// Ronda 2 (Medio 2): la tarjeta "Liquidación acumulada" de la ficha del contrato cuadra con las ventas.
async function leerFicha(page, letra) {
  await page.goto(`/#/al-partir/${ids.C[letra]}`);
  await expect(page.getByRole('heading', { name: `${P} tenedor ${letra}`, level: 1 })).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(400);
  const card = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Liquidación acumulada' }) });
  if (!(await card.count())) return null;
  const ls = await lineas(card);
  const saldoClase = await card.locator('p.cifra').nth(2).getAttribute('class');
  return {
    ganancia: trasEtiqueta(ls, 'Ganancia neta vendida'),
    pagado: trasEtiqueta(ls, 'Pagado al tenedor'),
    saldo: trasEtiqueta(ls, 'Saldo a favor de Santa Rita'),
    saldoEnRojo: /peligro/.test(saldoClase ?? ''),
  };
}

test('VRF D8A · ficha del contrato: la liquidación acumulada cuadra con el detalle de las ventas', async ({ page, browser }) => {
  test.setTimeout(240_000);
  const errores = [];
  vigilar(page, errores);
  await simularClima(page);
  await iniciarSesion(page);
  const lista = await leerLista(page);
  const suma = (...ks) => ks.reduce((s, k) => s + (lista[k]?.tenedores ?? NaN), 0);
  const r = { fichas: {}, sumasLista: { G: suma('P1', 'P2', 'P3'), H: suma('R1', 'R2'), J: suma('T1', 'T2'), S: suma('U1', 'U2'), Z: suma('V1', 'V2') } };
  for (const c of ['G', 'H', 'J', 'S', 'Z', 'K']) r.fichas[c] = await leerFicha(page, c);
  await leerFicha(page, 'J');
  await page.screenshot({ path: `${DIR}/ficha-J.png`, fullPage: true });
  // Otra sesión ve lo mismo.
  const otro = await browser.newContext();
  const p2 = await otro.newPage();
  await simularClima(p2);
  await iniciarSesion(p2);
  r.fichaJOtraSesion = await leerFicha(p2, 'J');
  await otro.close();
  registrar('fichas', r);
  registrar('consola y red', errores);
  expect.soft(r.fichas.G).toEqual({ ganancia: 3_000_000, pagado: 1_500_000, saldo: 0, saldoEnRojo: false });
  expect.soft(r.fichas.H).toEqual({ ganancia: 1_200_000, pagado: 600_000, saldo: 0, saldoEnRojo: false });
  expect.soft(r.fichas.J).toEqual({ ganancia: 1_200_000, pagado: 900_000, saldo: 300_000, saldoEnRojo: true });
  expect.soft(r.fichas.S).toEqual({ ganancia: 1_200_000, pagado: 600_000, saldo: 0, saldoEnRojo: false });
  expect.soft(r.fichas.Z).toEqual({ ganancia: 1_200_000, pagado: 0, saldo: 0, saldoEnRojo: false });
  expect.soft(r.fichas.K, 'contrato sin ventas: sin tarjeta').toBeNull();
  for (const c of ['G', 'H', 'J', 'S', 'Z']) expect.soft(r.fichas[c]?.pagado, `${c}: pagado = suma de "A los tenedores"`).toBe(r.sumasLista[c]);
  expect.soft(r.fichaJOtraSesion).toEqual(r.fichas.J);
  expect.soft(errores).toEqual([]);
});

test('VRF D8A · ficha del contrato: estados de carga y de error con la consulta de ventas', async ({ page }) => {
  test.setTimeout(180_000);
  await simularClima(page);
  await iniciarSesion(page);
  const ruta = `/#/al-partir/${ids.C.J}`;
  await page.route('**/rest/v1/ventas*', async (x) => {
    await new Promise((ok) => setTimeout(ok, 2500));
    await x.continue().catch(() => {});
  });
  await page.goto('/#/');
  await page.goto(ruta);
  await page.reload();
  const cargando = await page.getByText('Cargando datos…').first().waitFor({ timeout: 2000 }).then(() => true).catch(() => false);
  await page.unroute('**/rest/v1/ventas*');
  await page.route('**/rest/v1/ventas*', (x) => x.fulfill({ status: 500, json: { message: 'caída simulada' } }));
  await page.reload();
  const alerta = page.getByRole('alert').filter({ hasText: 'No se pudieron cargar los datos' });
  const error = await alerta.waitFor({ timeout: 20_000 }).then(() => true).catch(() => false);
  const textoError = error ? (await alerta.innerText()).replace(/\s+/g, ' ') : null;
  await page.screenshot({ path: `${DIR}/ficha-error.png`, fullPage: true });
  await page.unroute('**/rest/v1/ventas*');
  if (error) await page.getByRole('button', { name: 'Reintentar' }).click();
  const recupera = await page.getByRole('heading', { name: 'Liquidación acumulada' }).waitFor({ timeout: 20_000 }).then(() => true).catch(() => false);
  registrar('ficha carga y error', { cargando, error, textoError, recupera });
  expect.soft({ cargando, error, recupera }).toEqual({ cargando: true, error: true, recupera: true });
});

test.describe('celular 375×812 · ficha del contrato', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  test('VRF D8A · la liquidación acumulada se lee en el celular', async ({ page }) => {
    await simularClima(page);
    await iniciarSesion(page);
    const f = await leerFicha(page, 'J');
    const card = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Liquidación acumulada' }) });
    await card.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${DIR}/ficha-J-celular.png`, fullPage: true });
    const d = await page.evaluate(medirDesborde);
    registrar('ficha celular', { f, desborde: d });
    expect.soft(d.scrollWidth).toBe(375);
    expect.soft(d.fuera).toEqual([]);
    expect.soft(d.recortados).toEqual([]);
    expect.soft(d.textoFuera).toEqual([]);
    expect.soft(f).toEqual({ ganancia: 1_200_000, pagado: 900_000, saldo: 300_000, saldoEnRojo: true });
  });
});

// Va al final: documenta un hueco anterior (la tabla ventas acepta fecha futura fuera de registrar_venta)
// y, si falla, en modo serial no debe saltarse las demás pruebas.
test('VRF D8A · venta con fecha futura: la rechazan el asistente y la base de datos', async ({ page }) => {
  test.setTimeout(180_000);
  const manana = haceDias(-1);
  const supabase = await clientePrueba();
  const rpc = await supabase.rpc('registrar_venta', {
    lote: ids.L.W,
    fecha: manana,
    comprador: `${P} Comprador futura`,
    precio_kg: 8000,
    destare: 0,
    recomendacion: null,
    notas: null,
    animales: [{ animal_id: ids.a.K1, peso_kg: 300, costo_cop: 600000 }],
  });
  // Inserción directa en la tabla, sin pasar por registrar_venta (la API la permite a los miembros).
  const directa = await supabase
    .from('ventas')
    .insert({ lote_id: ids.L.W, fecha: manana, comprador: `${P} Comprador directa futura`, precio_kg_cop: 8000, destare_pct: 0 })
    .select('id');
  if (directa.data?.length) await supabase.from('ventas').delete().in('id', directa.data.map((x) => x.id));
  await simularClima(page);
  await iniciarSesion(page);
  await page.goto(`/#/ventas/nueva?lote=${ids.L.W}`);
  await expect(page.getByRole('heading', { name: 'Registrar venta' })).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Siguiente' }).click(); // Sprint 05: 3 pasos
  await page.getByLabel('Precio por kilo').fill('8000');
  await page.getByLabel('Fecha de la venta').fill(manana);
  await page.getByLabel('Comprador').fill(`${P} Comprador UI futura`);
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.waitForTimeout(1500);
  const mensaje = await page.getByText('La fecha de la venta no puede ser futura.').isVisible();
  const sigue = page.url().includes('/ventas/nueva');
  const { data: creadas } = await supabase.from('ventas').select('id, comprador').like('comprador', `${P} Comprador%futura`);
  const { data: k1 } = await supabase.from('venta_animales').select('venta_id').eq('animal_id', ids.a.K1);
  const r = { rpcError: rpc.error?.message ?? null, directaError: directa.error?.message ?? null, directaCreada: directa.data?.length ?? 0, mensaje, sigue, creadas, k1Vendido: k1?.length ?? 0 };
  registrar('fecha futura', r);
  expect.soft(r.rpcError).toMatch(/fecha_futura/);
  expect.soft(r.mensaje).toBe(true);
  expect.soft(r.sigue).toBe(true);
  expect.soft(r.creadas).toEqual([]);
  expect.soft(r.k1Vendido).toBe(0);
  expect.soft(r.directaCreada, 'la tabla ventas acepta una fecha futura fuera de registrar_venta').toBe(0);
  // Bajo (ronda 2): la ficha del contrato escribe una ganancia negativa como "$-600.000", distinto del resto de la app.
  expect.soft(fichaHNegativa, 'ganancia negativa en la ficha con el formato de la app').toContain('−$600.000');
});
