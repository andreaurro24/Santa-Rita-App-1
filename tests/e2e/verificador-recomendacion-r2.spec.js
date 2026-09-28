import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { clientePrueba, iniciarSesion } from './helpers';
import { medirDesborde } from './verificador-medidas';

// Pruebas del VERIFICADOR para la spec 010 (recomendación v2), RONDA 2.
// Repite el escenario del Alto de la ronda 1 y confirma o refuta cada Medio y cada Bajo.
// Lotes de prueba (prefijo VRF-R2, todo se borra al final):
//   A: igual que en la ronda 1 (A1, A2 novillos, A4 "Al partir" 50 %, A3 vientre; 270 kg hace 30 días →
//      300 kg HOY; compra $600.000, A3 $500.000; gasto de lote $1.200.000 hace 10 días). Meta 400.
//      A $8.000/kg: margen hoy $3.750.000; a 8 semanas $4.247.778 (diferencia $497.778).
//   C: C1, C2 novillos, 240 kg hace 60 días → 270 kg hace 30 días (GDP 1); sin pesaje hoy. Compra $600.000.
//      Peso estimado de hoy = 270 + 1 × 30 = 300 kg. Meta 290 (y luego 320).
//      A $8.000/kg, sin gastos: peso a pagar 600 / 628 / 656 / 712 kg; ingreso 4.800.000 / 5.024.000 /
//      5.248.000 / 5.696.000; costo 1.200.000; margen 3.600.000 / 3.824.000 / 4.048.000 / 4.496.000;
//      equilibrio 1.200.000 / 600 = $2.000/kg.
//      A $1.900/kg: margen −60.000 / −6.800 / +46.400 / +152.800 → NO_VENDER, positivo en 4 semanas.
//   D: D1 novillo como C1 (estimado 300) y D2 vientre 250 kg sin cambio. Meta 290.
//      /lotes promedia los dos (estimado 275, GDP del lote 0,5 → 30 días); la recomendación solo D1 (300).
//   E: E1 novillo que entró hace 21 días con 250 kg y se pesó al día siguiente con 256 kg (GDP de un día = 6).
//   F: F1, F2 novillos pesados hoy (300 kg), en el potrero VRF-R2 P1 de Santa Rita; otro potrero P2 en rojo.

const DIR = 'test-results/vrf-010-r2';
mkdirSync(DIR, { recursive: true });
const P = 'VRF-R2';

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
  for (const a of animales ?? []) {
    await supabase.from('movimientos').delete().eq('animal_id', a.id);
    await supabase.from('animales').delete().eq('id', a.id);
  }
  if (contratos?.length) await supabase.from('contratos_al_partir').delete().in('id', contratos.map((c) => c.id));
  if (idsTen.length) await supabase.from('tenedores').delete().in('id', idsTen);
  await supabase.from('potreros').delete().like('nombre', `${P}%`);
  await supabase.from('fincas').delete().like('nombre', `${P}%`);
  await supabase.from('lotes').delete().like('codigo', `${P}%`);
  await supabase.from('precios_mercado').delete().like('fuente', `${P}%`);
}

let ids;
test.beforeAll(async () => {
  test.setTimeout(180_000);
  const supabase = await clientePrueba();
  destareInicial = Number((await supabase.from('parametros').select('destare_pct').single()).data.destare_pct);
  await limpiar();
  await supabase.from('parametros').update({ destare_pct: 0 }).eq('id', true);
  const { data: propia } = await supabase.from('fincas').select('id').eq('tipo', 'propia').single();
  const lote = async (s, meta) => {
    const { data, error } = await supabase.from('lotes').insert({ codigo: `${P}-${s}`, nombre: `${P} ${s}`, tipo: 'ceba', peso_meta_kg: meta, fecha_inicio: haceDias(90) }).select('id').single();
    if (error) throw error;
    return data.id;
  };
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
  a.A3 = await animal('A3', A, { ingreso: haceDias(30), peso: 270, sexo: 'Hembra', categoria: 'vientre', compra: 500_000, pesos: [[hoyBogota(), 300]] });
  const finca = (await supabase.from('fincas').insert({ nombre: `${P} finca tenedor`, tipo: 'tenedor' }).select('id').single()).data.id;
  const ten = (await supabase.from('tenedores').insert({ nombre: `${P} tenedor`, finca_id: finca }).select('id').single()).data.id;
  const contrato = (await supabase.from('contratos_al_partir').insert({ tenedor_id: ten, porcentaje_ganancia: 50, fecha_inicio: haceDias(30) }).select('id').single()).data.id;
  const asig = await supabase.rpc('asignar_a_contrato', { ids: [a.A4], contrato, fecha: hoyBogota(), motivo: `${P} al partir` });
  if (asig.error) throw asig.error;
  const g = await supabase.from('costos').insert({ lote_id: A, categoria: 'suplemento', descripcion: `${P} suplemento`, monto_cop: 1_200_000, fecha: haceDias(10) });
  if (g.error) throw g.error;

  const C = await lote('C', 290);
  for (const s of ['C1', 'C2']) await animal(s, C, { ingreso: haceDias(60), peso: 240, pesos: [[haceDias(30), 270]] });
  const D = await lote('D', 290);
  await animal('D1', D, { ingreso: haceDias(60), peso: 240, pesos: [[haceDias(30), 270]] });
  await animal('D2', D, { ingreso: haceDias(60), peso: 250, sexo: 'Hembra', categoria: 'vientre', pesos: [[haceDias(30), 250]] });
  const E = await lote('E', 400);
  await animal('E1', E, { ingreso: haceDias(21), peso: 250, pesos: [[haceDias(20), 256]] });
  const F = await lote('F', 400);
  const p1 = (await supabase.from('potreros').insert({ finca_id: propia.id, nombre: `${P} P1` }).select('id').single()).data.id;
  const p2 = (await supabase.from('potreros').insert({ finca_id: propia.id, nombre: `${P} P2` }).select('id').single()).data.id;
  const f = {};
  for (const s of ['F1', 'F2']) {
    f[s] = await animal(s, F, { ingreso: haceDias(30), peso: 270, pesos: [[hoyBogota(), 300]] });
    const u = await supabase.from('animales').update({ potrero_id: p1 }).eq('id', f[s]);
    if (u.error) throw u.error;
  }
  ids = { A, C, D, E, F, p1, p2, propia: propia.id, fincaTenedor: finca, a };
});
test.afterAll(async () => {
  const supabase = await clientePrueba();
  await supabase.from('parametros').update({ destare_pct: destareInicial }).eq('id', true);
  await limpiar();
});

function climaFalso(lluvias) {
  const time = lluvias.map((_, i) => haceDias(-i));
  return {
    current: { temperature_2m: 30, precipitation: 0, weather_code: 1 },
    daily: { time, temperature_2m_max: lluvias.map(() => 33), temperature_2m_min: lluvias.map(() => 22), precipitation_sum: lluvias, weather_code: lluvias.map(() => 1) },
  };
}
async function simularClima(page, modo) {
  await page.unroute('https://api.open-meteo.com/**').catch(() => {});
  if (modo?.colgado) await page.route('https://api.open-meteo.com/**', () => {}); // nunca responde
  else if (modo?.lento) await page.route('https://api.open-meteo.com/**', async (r) => { await new Promise((ok) => setTimeout(ok, modo.lento)); await r.fulfill({ json: climaFalso(modo.lluvias) }).catch(() => {}); });
  else await page.route('https://api.open-meteo.com/**', (r) => r.fulfill({ json: climaFalso(modo) }));
}

const num = (s) => (s == null ? NaN : Number(s.replace(/[−-]/, '-').replace(/[^\d-]/g, '')));

async function leer(raiz) {
  const texto = await raiz.innerText();
  const lineas = texto.split('\n').map((l) => l.trim()).filter(Boolean);
  const stat = (label) => {
    const i = lineas.indexOf(label);
    return i >= 0 ? { valor: lineas[i + 1], sub: lineas[i + 2] } : null;
  };
  const badge = ['Vender ahora', 'Vender antes de la meta', 'Esperar', 'No vender todavía', 'Faltan datos'].find((b) => lineas.includes(b));
  const badgeClase = badge ? await raiz.getByText(badge, { exact: true }).first().getAttribute('class') : null;
  const filas = await raiz.locator('tbody tr').evaluateAll((trs) => trs.map((tr) => [...tr.cells].filter((td) => td.checkVisibility()).map((td) => td.innerText.trim())));
  return {
    badge,
    badgeClase,
    razon: lineas[lineas.indexOf(badge) + 1],
    reses: stat('Reses para vender'),
    peso: stat('Peso promedio'),
    equilibrio: stat('Punto de equilibrio real'),
    margen: stat('Margen neto hoy'),
    filas,
    porQue: lineas.slice(lineas.indexOf('Por qué') + 1),
  };
}

async function analizar(page, loteNombre, precio = '8000') {
  await page.getByLabel('Lote a evaluar').selectOption({ label: loteNombre });
  await page.getByLabel('Precio de mercado (COP/kg)').fill(precio);
  const card = page.locator('section').filter({ has: page.getByRole('heading', { name: loteNombre, exact: true }) });
  await expect(card).toBeVisible();
  await page.waitForTimeout(400);
  return leer(card);
}

async function textoLote(page, loteId) {
  await page.goto(`/#/lotes/${loteId}`);
  await page.reload(); // sin caché: los datos pudieron cambiar en la base
  await expect(page.getByText('Llega a la meta').first()).toBeVisible();
  const main = (await page.locator('main').innerText()).split('\n').map((l) => l.trim()).filter(Boolean);
  const tras = (label) => main[main.indexOf(label) + 1];
  return { pesoPromedio: tras('Peso promedio'), meta: tras('Meta pactada'), avance: main[main.indexOf('Meta pactada') + 2], llega: tras('Llega a la meta') };
}

test('VRF 010 r2 · Alto: lote pesado hace 30 días, /lotes y /recomendacion ya no se contradicen', async ({ page }) => {
  test.setTimeout(150_000);
  const errores = [];
  page.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
  page.on('response', (x) => x.status() >= 400 && !x.url().includes('/auth/v1/') && errores.push(`${x.status()} ${x.request().method()} ${x.url().split('?')[0]}`));
  const supabase = await clientePrueba();
  await simularClima(page, [3, 3, 3, 3, 3, 3, 3]);
  await iniciarSesion(page);
  const r = {};
  r.loteC290 = await textoLote(page, ids.C);
  await page.goto('/#/recomendacion');
  r.recC290 = await analizar(page, `${P} C`);
  await page.screenshot({ path: `${DIR}/01-recomendacion-C-meta290.png`, fullPage: true });
  // Reporte (R8) con el mismo lote y un boletín de hoy de $8.000 (el reporte usa el último boletín).
  await supabase.from('precios_mercado').insert({ fecha: hoyBogota(), precio_kg_cop: 8000, fuente: `${P} boletín` });
  await page.goto('/#/reporte');
  await page.reload();
  await page.locator('select').first().selectOption({ label: `${P} C` });
  await expect(page.locator('article')).toBeVisible();
  await page.waitForTimeout(400);
  const rep = await leer(page.locator('article'));
  r.reporteC = { badge: rep.badge, peso: rep.peso, filas: rep.filas.map((f) => [f[1], f.at(-1)]) };
  await supabase.from('precios_mercado').delete().like('fuente', `${P}%`);
  // Meta 320: /lotes proyecta 20 días; la recomendación debe decir ESPERAR con 94 %.
  await supabase.from('lotes').update({ peso_meta_kg: 320 }).eq('id', ids.C);
  r.loteC320 = await textoLote(page, ids.C);
  await page.goto('/#/recomendacion');
  await page.reload();
  r.recC320 = await analizar(page, `${P} C`);
  await supabase.from('lotes').update({ peso_meta_kg: 290 }).eq('id', ids.C);
  // Lote D: un novillo y un vientre.
  r.loteD = await textoLote(page, ids.D);
  await page.goto('/#/recomendacion');
  r.recD = await analizar(page, `${P} D`);
  await page.screenshot({ path: `${DIR}/02-recomendacion-D-vientre.png`, fullPage: true });
  // Lote E: GDP de un solo día.
  r.loteE = await textoLote(page, ids.E);
  await page.goto('/#/recomendacion');
  r.recE = await analizar(page, `${P} E`);
  // Los lotes de la semilla: ¿dicen lo mismo las dos pantallas?
  r.semilla = {};
  const { data: semilla } = await supabase.from('lotes').select('id, nombre').not('codigo', 'like', `${P}%`).not('codigo', 'like', 'VRF%').eq('estado', 'activo');
  for (const l of semilla ?? []) {
    const lt = await textoLote(page, l.id);
    await page.goto('/#/recomendacion');
    const x = await analizar(page, l.nombre);
    r.semilla[l.nombre] = { lotes: `${lt.pesoPromedio} · ${lt.avance} · ${lt.llega}`, recomendacion: `${x.badge} · ${x.peso?.valor} · ${x.peso?.sub} · ${x.reses?.valor} reses` };
  }
  registrar('Alto r2', r);
  registrar('consola y red', errores);

  // C, meta 290: las dos pantallas dicen que ya está en la meta.
  expect(r.loteC290.llega).toMatch(/Ya debería estar en la meta \(peso estimado 300 kg\)/);
  expect(r.recC290.badge).toBe('Vender ahora');
  expect(r.recC290.razon).toMatch(/llegó a la meta pactada \(103 %\) con un margen neto de \$3\.600\.000/);
  expect(r.recC290.peso.valor).toBe('300 kg');
  expect(r.recC290.equilibrio.valor).toBe('$2.000/kg');
  expect(r.recC290.filas.map((f) => f[1])).toEqual(['600 kg', '628 kg', '656 kg', '712 kg']);
  expect(r.recC290.filas.map((f) => num(f.at(-1)))).toEqual([3_600_000, 3_824_000, 4_048_000, 4_496_000]);
  expect(r.reporteC.badge).toBe('Vender ahora');
  expect(r.reporteC.filas.map((f) => num(f[1]))).toEqual([3_600_000, 3_824_000, 4_048_000, 4_496_000]);
  // C, meta 320: 20 días en /lotes; ESPERAR con 94 % en la recomendación.
  expect(r.loteC320.llega).toMatch(/20 días|\d{1,2} de \w+/);
  expect(r.recC320.badge).toBe('Esperar');
  expect(r.recC320.razon).toMatch(/94 % de la meta/);
  if (r.loteC320.pesoPromedio !== r.recC320.peso.valor) registrar('HALLAZGO 010r2 peso promedio distinto', { lotes: r.loteC320, recomendacion: r.recC320.peso });
  if (/días|de \w+ de/.test(r.loteD.llega) && r.recD.badge === 'Vender ahora') registrar('HALLAZGO 010r2 lote con vientre se contradice', { lotes: r.loteD, recomendacion: { badge: r.recD.badge, razon: r.recD.razon } });
  registrar('Lote E (GDP de un día)', { lotes: r.loteE, recomendacion: { badge: r.recE.badge, razon: r.recE.razon, peso: r.recE.peso, filas: r.recE.filas.map((f) => f[1]) } });
});

test('VRF 010 r2 · Medios y Bajos de la ronda 1', async ({ page }) => {
  test.setTimeout(240_000);
  const supabase = await clientePrueba();
  const r = {};
  const pasto = async (fincaId, nivel, potreroId = null) => {
    await supabase.from('condicion_pasto').delete().like('notas', `${P}%`);
    if (nivel) {
      const { error } = await supabase.from('condicion_pasto').insert({ finca_id: fincaId, potrero_id: potreroId, fecha: hoyBogota(), nivel, notas: `${P} ${nivel}` });
      if (error) throw error;
    }
  };
  const ver = async (clave, { precio = '8000', clima = [3, 3, 3, 3, 3, 3, 3], lote = `${P} A` } = {}) => {
    await simularClima(page, clima);
    await page.goto('/#/recomendacion');
    await page.reload();
    const x = await analizar(page, lote, precio);
    r[clave] = { badge: x.badge, clase: x.badgeClase, razon: x.razon, porQue: x.porQue, reses: x.reses };
    return x;
  };
  await iniciarSesion(page);
  // Medio 1: NO_VENDER con el pasto en rojo (lote C a $1.900: positivo recién en 4 semanas).
  await pasto(ids.propia, 'rojo');
  await ver('noVenderPastoRojo', { lote: `${P} C`, precio: '1900' });
  await pasto(null, null);
  await ver('noVenderSequia', { lote: `${P} C`, precio: '1900', clima: [0, 0, 0, 0, 0, 0, 0] });
  await ver('noVenderSinRiesgo', { lote: `${P} C`, precio: '1900' });
  // Medio 3 (D4): VENDER_ANTICIPADO dice cuánto se deja de ganar.
  await pasto(ids.propia, 'rojo');
  await ver('anticipadoPasto');
  await page.screenshot({ path: `${DIR}/03-anticipado-pasto.png`, fullPage: true });
  await pasto(null, null);
  await ver('anticipadoSequia', { clima: [0.5, 1, 0, 0, 0, 0, 0] });
  // Bajos: margen cero y singular.
  await ver('margenCero', { precio: '3000' });
  await ver('esperar');
  // "Vender ahora" sin llegar a la meta (decisión pendiente): lote A con un gasto diario alto.
  const { data: caro } = await supabase.from('costos').insert({ lote_id: ids.A, categoria: 'arriendo_pasto', descripcion: `${P} arriendo caro`, monto_cop: 1_800_000, fecha: haceDias(5) }).select('id').single();
  await ver('esperarYaNoPaga');
  await supabase.from('costos').delete().eq('id', caro.id);
  // Pasto por área: potrero P2 en rojo, el lote F está en P1 (en verde).
  await supabase.from('condicion_pasto').delete().like('notas', `${P}%`);
  await supabase.from('condicion_pasto').insert([
    { finca_id: ids.propia, potrero_id: ids.p1, fecha: hoyBogota(), nivel: 'verde', notas: `${P} verde P1` },
    { finca_id: ids.propia, potrero_id: ids.p2, fecha: hoyBogota(), nivel: 'rojo', notas: `${P} rojo P2` },
  ]);
  await ver('loteEnP1VerdeConP2Rojo', { lote: `${P} F` });
  await page.goto('/#/mercado');
  await page.waitForTimeout(1500);
  r.mercadoPasto = (await page.locator('main').innerText()).split('\n').filter((l) => /Santa Rita|Escaso|Regular|Bueno|P1|P2/.test(l)).slice(0, 12);
  await supabase.from('condicion_pasto').delete().like('notas', `${P}%`);
  registrar('Medios y Bajos', r);

  expect(r.noVenderPastoRojo.badge).toBe('No vender todavía');
  expect(r.noVenderPastoRojo.porQue.join(' ')).toMatch(/riesgo de pasto/);
  expect(r.noVenderPastoRojo.porQue.join(' ')).not.toMatch(/Si el lote sigue ganando peso al ritmo actual/);
  expect(r.noVenderSequia.porQue.join(' ')).toMatch(/riesgo de pasto/);
  expect(r.noVenderSinRiesgo.porQue.join(' ')).toMatch(/Si el lote sigue ganando peso al ritmo actual, en 4 semanas el margen sería de \$46\.400/);
  expect(r.anticipadoPasto.badge).toBe('Vender antes de la meta');
  expect(r.anticipadoPasto.porQue.join(' ')).toMatch(/deja de ganar hasta \$497\.778 frente a esperar 8 semanas/);
  expect(r.anticipadoPasto.clase).toMatch(/bg-ok/);
  expect(r.anticipadoSequia.porQue.join(' ')).toMatch(/deja de ganar hasta \$497\.778/);
  expect(r.margenCero.badge).toBe('No vender todavía');
  expect(r.margenCero.razon).toBe('Vender hoy no dejaría ganancia para Santa Rita.');
  expect(r.esperar.reses.sub).toBe('1 vientre excluido');
  expect(r.esperar.clase).toMatch(/bg-alerta/);
  if (r.loteEnP1VerdeConP2Rojo.badge === 'Vender antes de la meta') registrar('HALLAZGO 010r2 potrero ajeno en rojo', r.loteEnP1VerdeConP2Rojo);
  if (r.anticipadoPasto.porQue.some((x) => /Pasto: rojo/.test(x))) registrar('HALLAZGO 010r2 rojo vs Escaso', r.anticipadoPasto.porQue.at(-1));
});

test('VRF 010 r2 · Medio 2: el pronóstico lento y el pronóstico que nunca responde', async ({ page }) => {
  test.setTimeout(120_000);
  const r = {};
  await iniciarSesion(page);
  // Lento (6 s) con sequía: ¿se ve algún badge antes de que llegue el pronóstico?
  await simularClima(page, { lento: 6000, lluvias: [0, 0, 0, 0, 0, 0, 0] });
  await page.goto('/#/recomendacion');
  await page.reload();
  const vistos = [];
  const t0 = Date.now();
  while (Date.now() - t0 < 9000) {
    const t = await page.locator('main').innerText().catch(() => '');
    const b = ['Vender ahora', 'Vender antes de la meta', 'Esperar', 'No vender todavía', 'Faltan datos'].find((x) => t.includes(x));
    vistos.push(`${Math.round((Date.now() - t0) / 100) / 10}s:${b ?? (t.includes('Cargando') ? 'cargando' : '—')}`);
    await page.waitForTimeout(500);
  }
  r.lento = vistos;
  // Colgado: Open-Meteo no responde nunca (red rural lenta). ¿Qué ve Miguel a los 20 s?
  await simularClima(page, { colgado: true });
  for (const ruta of ['/#/recomendacion', '/#/ventas/nueva', '/#/reporte']) {
    await page.goto(ruta);
    await page.reload();
    await page.waitForTimeout(20_000);
    const t = await page.locator('main').innerText();
    r[`colgado ${ruta}`] = t.includes('Cargando') ? 'SIGUE CARGANDO a los 20 s' : t.slice(0, 120).replace(/\s+/g, ' ');
  }
  await page.screenshot({ path: `${DIR}/04-clima-colgado.png`, fullPage: true });
  registrar('clima', r);
  // Antes de que llegue el pronóstico (6 s) no debe verse ninguna recomendación.
  expect(r.lento.filter((x) => parseFloat(x) < 5.5 && !/(cargando|—)$/.test(x))).toEqual([]);
});

test.describe('celular 375×812', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  test('VRF 010 r2 · el reporte en el celular y al imprimir', async ({ page }) => {
    const supabase = await clientePrueba();
    await supabase.from('precios_mercado').insert({ fecha: hoyBogota(), precio_kg_cop: 8000, fuente: `${P} boletín` });
    await simularClima(page, [3, 3, 3, 3, 3, 3, 3]);
    await iniciarSesion(page);
    await page.goto('/#/reporte');
    await page.locator('select').first().selectOption({ label: `${P} A` });
    const art = page.locator('article');
    await expect(art).toBeVisible();
    await page.waitForTimeout(400);
    const celular = await leer(art);
    const r = { columnasCelular: celular.filas[0], desborde: await page.evaluate(medirDesborde) };
    await page.screenshot({ path: `${DIR}/05-reporte-celular.png`, fullPage: true });
    await page.emulateMedia({ media: 'print' });
    const imp = await leer(art);
    r.columnasImpresion = imp.filas[0];
    await page.pdf({ path: `${DIR}/06-reporte.pdf`, format: 'Letter' }).catch((e) => (r.pdf = e.message));
    await supabase.from('precios_mercado').delete().like('fuente', `${P}%`);
    registrar('reporte celular', r);
    expect(r.columnasCelular).toHaveLength(3);
    expect(r.columnasImpresion).toHaveLength(5);
    expect(r.desborde.scrollWidth).toBe(375);
  });
});
