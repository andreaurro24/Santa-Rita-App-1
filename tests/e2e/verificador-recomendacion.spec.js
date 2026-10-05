import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { clientePrueba, iniciarSesion } from './helpers';
import { medirDesborde } from './verificador-medidas';

// Pruebas del VERIFICADOR para la spec 010 (recomendación de venta v2), ronda 1.
// Lote de prueba de números redondos (VRF-RC A), calculado a mano:
//   A1, A2 novillos y A4 novillo "Al partir" (50 %): 270 kg hace 30 días → 300 kg hoy (GDP 1 kg/día),
//   compra $600.000; A3 vientre (excluido, D2). Gasto de lote $1.200.000 hace 10 días → $300.000 c/u (4 animales).
//   Precio $8.000/kg, destare 0 %:
//   - Costo de los 3 vendibles 3 × 900.000 = 2.700.000; peso 900 kg; equilibrio $3.000/kg (D10).
//   - Ingreso 7.200.000; ganancia de A4 2.400.000 − 900.000 = 1.500.000 → tenedor 750.000 (D11).
//   - Margen neto hoy 7.200.000 − 2.700.000 − 750.000 = 3.750.000.
//   - Gasto diario 1.200.000 / 90 = 13.333,33 (4.444,44 por vendible).
//   - En 2 / 4 / 8 semanas: margen 3.874.444 / 3.998.889 / 4.247.778 (ver el reporte).
//   - Sensibilidad −10 / −5 / +5 / +10 %: 3.150.000 / 3.450.000 / 4.050.000 / 4.350.000.
//   - Destare 5 %: 855 kg, equilibrio 3.157,89, margen 3.450.000.
// El clima se simula con page.route sobre Open-Meteo. Prefijo VRF-RC; todo se borra y el destare se restaura.

const DIR = 'test-results/vrf-010';
mkdirSync(DIR, { recursive: true });
const P = 'VRF-RC';

const hoyBogota = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
const haceDias = (n) => new Date(Date.parse(`${hoyBogota()}T12:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);

function registrar(nombre, datos) {
  console.log(`${nombre}: ${JSON.stringify(datos)}`);
  test.info().annotations.push({ type: nombre, description: JSON.stringify(datos) });
}

let destareInicial = 0;
async function limpiar() {
  const supabase = await clientePrueba();
  const { data: tenedores } = await supabase.from('tenedores').select('id').like('nombre', `${P}%`);
  const idsTen = (tenedores ?? []).map((t) => t.id);
  const { data: contratos } = idsTen.length ? await supabase.from('contratos_al_partir').select('id').in('tenedor_id', idsTen) : { data: [] };
  await supabase.from('condicion_pasto').delete().like('notas', `${P}%`);
  await supabase.from('costos').delete().like('descripcion', `${P}%`);
  const { data: animales } = await supabase.from('animales').select('id').like('numero_interno', `${P}%`);
  for (const a of animales ?? []) await supabase.from('animales').delete().eq('id', a.id);
  if (contratos?.length) await supabase.from('contratos_al_partir').delete().in('id', contratos.map((c) => c.id));
  if (idsTen.length) await supabase.from('tenedores').delete().in('id', idsTen);
  await supabase.from('fincas').delete().like('nombre', `${P}%`);
  await supabase.from('lotes').delete().like('codigo', `${P}%`);
  await supabase.from('precios_mercado').delete().like('fuente', `${P}%`);
}

let ids;
test.beforeAll(async () => {
  test.setTimeout(120_000);
  const supabase = await clientePrueba();
  destareInicial = Number((await supabase.from('parametros').select('destare_pct').single()).data.destare_pct);
  await limpiar();
  await supabase.from('parametros').update({ destare_pct: 0 }).eq('id', true);
  const { data: propia } = await supabase.from('fincas').select('id').eq('tipo', 'propia').single();
  const lote = async (s, meta) => (await supabase.from('lotes').insert({ codigo: `${P}-${s}`, nombre: `${P} ${s}`, tipo: 'ceba', peso_meta_kg: meta }).select('id').single()).data.id;
  const animal = async (s, loteId, { ingreso, peso, sexo = 'Macho', categoria = 'novillo', compra = 600_000, pesos = [] }) => {
    const numero = `${P}-${s}`;
    const { data: id, error } = await supabase.rpc('registrar_animal', {
      datos: { numero_interno: numero, chapeta_ica: `${numero}-CH`, sexo, categoria, origen: 'compra', fecha_ingreso: ingreso, peso_ingreso_kg: peso, peso_objetivo_kg: 400, costo_compra_cop: compra, lote_id: loteId, finca_id: propia.id },
    });
    if (error) throw error;
    for (const [fecha, kg] of pesos) {
      const { error: e } = await supabase.from('pesajes').insert({ animal_id: id, fecha, peso_kg: kg });
      if (e) throw e;
    }
    return id;
  };
  const A = await lote('A', 400);
  const a = {};
  for (const s of ['A1', 'A2', 'A4']) a[s] = await animal(s, A, { ingreso: haceDias(30), peso: 270, pesos: [[hoyBogota(), 300]] });
  a.A3 = await animal('A3', A, { ingreso: haceDias(30), peso: 270, sexo: 'Hembra', categoria: 'vientre_mayor', compra: 500_000, pesos: [[hoyBogota(), 300]] });
  const finca = (await supabase.from('fincas').insert({ nombre: `${P} finca tenedor`, tipo: 'tenedor' }).select('id').single()).data.id;
  const ten = (await supabase.from('tenedores').insert({ nombre: `${P} tenedor`, finca_id: finca }).select('id').single()).data.id;
  const contrato = (await supabase.from('contratos_al_partir').insert({ tenedor_id: ten, porcentaje_ganancia: 50, fecha_inicio: haceDias(30) }).select('id').single()).data.id;
  const asig = await supabase.rpc('asignar_a_contrato', { ids: [a.A4], contrato, fecha: hoyBogota(), motivo: `${P} al partir` });
  if (asig.error) throw asig.error;
  const g = await supabase.from('costos').insert({ lote_id: A, categoria: 'suplemento', descripcion: `${P} suplemento`, monto_cop: 1_200_000, fecha: haceDias(10) });
  if (g.error) throw g.error;
  // Lote B: solo un vientre. Lote C: pesado hace 30 días (240 → 270 kg, GDP 1), meta 290.
  const B = await lote('B', 400);
  await animal('B1', B, { ingreso: haceDias(30), peso: 280, sexo: 'Hembra', categoria: 'vientre_mayor' });
  const C = await lote('C', 290);
  for (const s of ['C1', 'C2']) await animal(s, C, { ingreso: haceDias(60), peso: 240, pesos: [[haceDias(30), 270]] });
  ids = { A, B, C, propia: propia.id, fincaTenedor: finca, a };
});
test.afterAll(async () => {
  const supabase = await clientePrueba();
  await supabase.from('parametros').update({ destare_pct: destareInicial }).eq('id', true);
  await limpiar();
});

// Clima simulado de Open-Meteo con la lluvia diaria dada (7 días).
function climaFalso(lluvias) {
  const time = lluvias.map((_, i) => haceDias(-i));
  return {
    current: { temperature_2m: 30, precipitation: 0, weather_code: 1 },
    daily: { time, temperature_2m_max: lluvias.map(() => 33), temperature_2m_min: lluvias.map(() => 22), precipitation_sum: lluvias, weather_code: lluvias.map(() => 1) },
  };
}
async function simularClima(page, modo) {
  await page.unroute('https://api.open-meteo.com/**').catch(() => {});
  if (modo === 'caido') await page.route('https://api.open-meteo.com/**', (r) => r.abort());
  else if (modo?.lento) await page.route('https://api.open-meteo.com/**', async (r) => { await new Promise((ok) => setTimeout(ok, modo.lento)); await r.fulfill({ json: climaFalso(modo.lluvias) }); });
  else await page.route('https://api.open-meteo.com/**', (r) => r.fulfill({ json: climaFalso(modo) }));
}

const num = (s) => (s == null ? NaN : Number(s.replace(/[−-]/, '-').replace(/[^\d-]/g, '')));

// Lee todo lo que muestra AnalisisVenta dentro de `raiz`.
async function leer(raiz) {
  await raiz.locator('details').evaluateAll((ds) => ds.forEach((d) => (d.open = true))); // Sprint 05: detalles plegados
  const texto = await raiz.innerText();
  const lineas = texto.split('\n').map((l) => l.trim()).filter(Boolean);
  const stat = (label) => {
    const i = lineas.indexOf(label);
    return i >= 0 ? { valor: lineas[i + 1], sub: lineas[i + 2] } : null;
  };
  const badge = ['Vender ahora', 'Vender antes de la meta', 'Esperar', 'No vender todavía', 'Faltan datos'].find((b) => lineas.includes(b));
  const filas = await raiz.locator('tbody tr').evaluateAll((trs) => trs.map((tr) => [...tr.cells].map((td) => td.innerText.trim())));
  const sens = await raiz.locator('ul li').filter({ hasText: '/kg)' }).evaluateAll((lis) => lis.map((li) => li.innerText.replace(/\s+/g, ' ').trim()));
  const razones = lineas;
  return {
    badge,
    razon: lineas[lineas.indexOf(badge) + 1],
    reses: stat('Reses para vender'),
    peso: stat('Peso promedio'),
    equilibrio: stat('Punto de equilibrio real'),
    precio: stat('Precio del kilo'),
    margen: stat('Margen para Santa Rita hoy'),
    tenedores: stat('Parte de los tenedores'),
    costo: stat('Costo acumulado'),
    gastoDiario: stat('Gasto diario del lote'),
    filas,
    sens,
    porQue: razones.slice(razones.indexOf('Por qué') + 1),
  };
}

async function analizar(page, loteNombre, precio = '8000') {
  await page.getByLabel('Lote a evaluar').selectOption({ label: loteNombre });
  await page.getByLabel('Probar con otro precio por kilo').fill(precio);
  const card = page.locator('section').filter({ has: page.getByRole('heading', { name: loteNombre, exact: true }) });
  await expect(card).toBeVisible();
  await page.waitForTimeout(400);
  return leer(card);
}

test('VRF 010 R1–R4 y R7: cada cifra del lote de prueba contra el cálculo a mano (escritorio)', async ({ page }) => {
  test.setTimeout(120_000);
  const errores = [];
  page.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
  page.on('response', (x) => x.status() >= 400 && !x.url().includes('/auth/v1/') && errores.push(`${x.status()} ${x.request().method()} ${x.url().split('?')[0]}`));
  await simularClima(page, [3, 3, 3, 3, 3, 3, 3]); // 21 mm: sin sequía
  await iniciarSesion(page);
  await page.goto('/#/recomendacion');
  const r = {};
  r.base = await analizar(page, `${P} A`);
  await page.screenshot({ path: `${DIR}/01-recomendacion-A.png`, fullPage: true });
  // Destare 5 %.
  const supabase = await clientePrueba();
  await supabase.from('parametros').update({ destare_pct: 5 }).eq('id', true);
  await page.reload();
  r.destare5 = await analizar(page, `${P} A`);
  await supabase.from('parametros').update({ destare_pct: 0 }).eq('id', true);
  registrar('cifras A', r);
  registrar('consola y red', errores);

  const b = r.base;
  expect(b.badge).toBe('Esperar');
  expect(b.reses.valor).toBe('3');
  expect(b.reses.sub).toMatch(/^1 /); // 1 excluida
  expect(b.peso.valor).toBe('300 kg');
  expect(b.peso.sub).toBe('75 % de la meta (400 kg)');
  expect(b.equilibrio.valor).toBe('$3.000/kg');
  expect(b.precio.valor).toBe('$8.000/kg');
  expect(b.margen.valor).toBe('$3.750.000');
  expect(b.tenedores.valor).toBe('$750.000');
  expect(b.costo.valor).toBe('$2.700.000');
  expect(b.gastoDiario.valor).toBe('$13.333');
  // Escenarios: Cuándo | Peso a pagar | Ingreso | Costo (con tenedores) | Margen neto.
  expect(b.filas.map((f) => f[1])).toEqual(['900 kg', '942 kg', '984 kg', '1.068 kg']);
  expect(b.filas.map((f) => num(f[2]))).toEqual([7_200_000, 7_536_000, 7_872_000, 8_544_000]);
  expect(b.filas.map((f) => num(f[3]))).toEqual([3_450_000, 3_661_556, 3_873_111, 4_296_222]);
  expect(b.filas.map((f) => num(f[4]))).toEqual([3_750_000, 3_874_444, 3_998_889, 4_247_778]);
  expect(b.sens.map((s) => num(s.split(')')[1]))).toEqual([3_150_000, 3_450_000, 4_050_000, 4_350_000]);
  expect(b.razon).toMatch(/Esperar 8 semanas subiría el margen de \$3\.750\.000 a \$4\.247\.778/);
  const d = r.destare5;
  expect(d.equilibrio.valor).toBe('$3.158/kg');
  expect(d.filas[0][1]).toBe('855 kg');
  expect(d.margen.valor).toBe('$3.450.000');
});

test('VRF 010 R5/R6: cada regla de recomendación, pasto, sequía, clima de respaldo y SIN_DATOS', async ({ page }) => {
  test.setTimeout(240_000);
  const supabase = await clientePrueba();
  const r = {};
  const pasto = async (fincaId, nivel, fecha = hoyBogota()) => {
    await supabase.from('condicion_pasto').delete().like('notas', `${P}%`);
    if (nivel) await supabase.from('condicion_pasto').insert({ finca_id: fincaId, fecha, nivel, notas: `${P} ${nivel}` });
  };
  r.pastoPrevioEnBD = (await supabase.from('condicion_pasto').select('finca_id, nivel, fecha, notas').gte('fecha', haceDias(30))).data;
  const ver = async (clave, { precio = '8000', clima = [3, 3, 3, 3, 3, 3, 3], lote = `${P} A` } = {}) => {
    await simularClima(page, clima);
    await page.goto('/#/recomendacion');
    await page.reload();
    const x = await analizar(page, lote, precio);
    r[clave] = { badge: x.badge, razon: x.razon, porQue: x.porQue };
    return x;
  };
  await iniciarSesion(page);

  await ver('esperar');
  await ver('sequia', { clima: [0.5, 1, 0, 0, 0, 0, 0] });
  await ver('climaCaido', { clima: 'caido' });
  await pasto(ids.propia, 'rojo');
  await ver('pastoRojo');
  await page.screenshot({ path: `${DIR}/02-pasto-rojo.png`, fullPage: true });
  await ver('pastoRojoYPrecioBajo', { precio: '2000' });
  await pasto(ids.propia, 'rojo', haceDias(31));
  await ver('pastoRojoViejo');
  await pasto(ids.fincaTenedor, 'rojo');
  await ver('pastoRojoSoloFincaDelTenedor');
  await pasto(ids.propia, 'amarillo');
  await ver('pastoAmarillo');
  await pasto(null, null);
  await ver('sequiaYPrecioBajo', { clima: [0, 0, 0, 0, 0, 0, 0], precio: '2000' });
  await ver('noVender', { precio: '2000' });
  await ver('margenCero', { precio: '3000' });
  // VENDER: meta del lote 300 (ya la alcanzó).
  await supabase.from('lotes').update({ peso_meta_kg: 300 }).eq('id', ids.A);
  await ver('vender');
  await pasto(ids.propia, 'rojo');
  await ver('venderConPastoRojo');
  await pasto(null, null);
  await supabase.from('lotes').update({ peso_meta_kg: 400 }).eq('id', ids.A);
  // SIN_DATOS: lote con solo un vientre; y sin ningún precio registrado (se simula la respuesta vacía).
  await ver('soloVientre', { lote: `${P} B` });
  await page.route('**/rest/v1/precios_mercado*', (x) => x.fulfill({ json: [] }));
  await ver('sinPrecio', { precio: '' });
  await page.unroute('**/rest/v1/precios_mercado*');
  // Clima que tarda: ¿qué se recomienda mientras llega el pronóstico (sequía)?
  await simularClima(page, { lento: 6000, lluvias: [0, 0, 0, 0, 0, 0, 0] });
  await page.goto('/#/recomendacion');
  await page.reload();
  const mientras = await analizar(page, `${P} A`);
  r.climaLento = { mientras: { badge: mientras.badge, lluvia: mientras.porQue.at(-1) } };
  await page.waitForTimeout(7000);
  const despues = await leer(page.locator('section').filter({ has: page.getByRole('heading', { name: `${P} A`, exact: true }) }));
  r.climaLento.despues = { badge: despues.badge, lluvia: despues.porQue.at(-1) };

  registrar('reglas', r);
  expect(r.esperar.badge).toBe('Esperar');
  expect(r.sequia.badge).toBe('Vender antes de la meta');
  expect(r.sequia.razon).toMatch(/1,5 mm en 7 días/);
  expect(r.climaCaido.badge).toBe('Esperar');
  expect(r.climaCaido.porQue.join(' ')).toMatch(/sin conexión: no se usó la lluvia/);
  expect(r.pastoRojo.badge).toBe('Vender antes de la meta');
  expect(r.pastoRojo.razon).toMatch(/El pasto está en rojo/);
  expect(r.pastoRojoViejo.badge).toBe('Esperar');
  expect(r.pastoAmarillo.badge).toBe('Esperar');
  expect(r.pastoAmarillo.porQue.join(' ')).toMatch(/amarillo/);
  expect(r.noVender.badge).toBe('No vender todavía');
  expect(r.noVender.razon).toMatch(/pérdida de \$900\.000/);
  expect(r.vender.badge).toBe('Vender ahora');
  expect(r.vender.razon).toMatch(/llegó a la meta pactada \(100 %\) con un margen neto de \$3\.750\.000/);
  expect(r.soloVientre.badge).toBe('Faltan datos');
  expect(r.sinPrecio.badge).toBe('Faltan datos');
  // Hallazgos como anotaciones.
  if (!/pasto|rojo/i.test([r.pastoRojoYPrecioBajo.razon, ...r.pastoRojoYPrecioBajo.porQue].join(' '))) registrar('HALLAZGO 010 NO_VENDER calla el pasto', r.pastoRojoYPrecioBajo);
  if (/pérdida de \$0/.test(r.margenCero.razon)) registrar('HALLAZGO 010 margen cero', r.margenCero.razon);
});

test('VRF 010 R8 reporte y el peso de hoy frente a /lotes (lote pesado hace 30 días)', async ({ page }) => {
  test.setTimeout(120_000);
  const supabase = await clientePrueba();
  // Precio de hoy $8.000 (boletín de prueba) para que el reporte use los números redondos.
  const pr = await supabase.from('precios_mercado').insert({ fecha: hoyBogota(), precio_kg_cop: 8000, fuente: `${P} boletín` });
  const r = { precioInsertado: pr.error?.message ?? 'ok' };
  await simularClima(page, [3, 3, 3, 3, 3, 3, 3]);
  await iniciarSesion(page);
  await page.goto('/#/reporte');
  await page.locator('select').first().selectOption({ label: `${P} A` });
  const art = page.locator('article');
  await expect(art.getByRole('heading', { name: `${P} A` })).toBeVisible();
  await page.waitForTimeout(400);
  r.reporte = await leer(art);
  await page.screenshot({ path: `${DIR}/03-reporte.png`, fullPage: true });

  // Lote C: último pesaje hace 30 días (270 kg) con GDP 1 → hoy ~300 kg; meta 290.
  await page.goto(`/#/lotes/${ids.C}`);
  await expect(page.getByText('Llega a la meta')).toBeVisible();
  r.loteC = (await page.getByText('Llega a la meta').locator('..').innerText()).replace(/\s+/g, ' ');
  await page.goto('/#/recomendacion');
  const c = await analizar(page, `${P} C`);
  r.recomendacionC = { badge: c.badge, razon: c.razon, peso: c.peso, filas: c.filas.map((f) => [f[0], f[1]]) };
  await page.screenshot({ path: `${DIR}/04-recomendacion-C.png`, fullPage: true });
  // NO_VENDER con el pasto en rojo cuando esperar volvería positivo el margen (lote C, $2.200/kg).
  await supabase.from('condicion_pasto').insert({ finca_id: ids.propia, fecha: hoyBogota(), nivel: 'rojo', notas: `${P} rojo C` });
  await page.reload();
  const cr = await analizar(page, `${P} C`, '2200');
  r.noVenderConPastoRojo = { badge: cr.badge, razon: cr.razon, porQue: cr.porQue };
  await page.screenshot({ path: `${DIR}/05-no-vender-pasto-rojo.png`, fullPage: true });
  await supabase.from('condicion_pasto').delete().like('notas', `${P}%`);
  registrar('reporte y peso de hoy', r);

  const b = r.reporte;
  expect(b.badge).toBe('Esperar');
  expect(b.precio.sub).toMatch(/^Boletín del/);
  expect(b.equilibrio.valor).toBe('$3.000/kg');
  expect(b.margen.valor).toBe('$3.750.000');
  expect(b.filas.map((f) => num(f[4]))).toEqual([3_750_000, 3_874_444, 3_998_889, 4_247_778]);
  expect(b.filas.map((f) => num(f[2]))).toEqual([7_200_000, 7_536_000, 7_872_000, 8_544_000]);
  if (/Ya debería estar en la meta/.test(r.loteC) && r.recomendacionC.badge !== 'Vender ahora') registrar('HALLAZGO 010 peso de hoy', { lotes: r.loteC, recomendacion: r.recomendacionC });
});

test.describe('celular 375×812', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  test('VRF 010 en el celular: recomendación y reporte sin desborde', async ({ page }) => {
    await simularClima(page, [3, 3, 3, 3, 3, 3, 3]);
    await iniciarSesion(page);
    await page.goto('/#/recomendacion');
    const x = await analizar(page, `${P} A`);
    const r = { badge: x.badge, columnas: x.filas[0]?.length, desborde: await page.evaluate(medirDesborde) };
    await page.screenshot({ path: `${DIR}/05-recomendacion-celular.png`, fullPage: true });
    await page.goto('/#/reporte');
    await page.locator('select').first().selectOption({ label: `${P} A` });
    await expect(page.locator('article')).toBeVisible();
    r.reporteDesborde = await page.evaluate(medirDesborde);
    await page.screenshot({ path: `${DIR}/06-reporte-celular.png`, fullPage: true });
    registrar('celular', r);
    expect(r.badge).toBe('Esperar');
    expect(r.desborde.scrollWidth).toBe(375);
  });
});
