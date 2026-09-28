import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { clientePrueba, iniciarSesion } from './helpers';
import { medirDesborde } from './verificador-medidas';

// Pruebas del VERIFICADOR para la spec 012 (indicadores, formato es-CO, carga por rutas, ficha imprimible), ronda 1.
// Ronda 2 (2026-09-28, HEAD 1f12e28): la de R2 recorre además los formularios de edición (destare, contrato,
// lote) y la ficha en modo impresión; una prueba nueva comprueba los plurales y las cifras corregidas.
// El cliente propio de Supabase (R3) se prueba en verificador-cliente-r2.spec.js.
// Datos con decimales para cazar cifras con punto decimal (prefijo VRF-KP; todo se borra):
//   potrero de 12,5 ha; contrato "Al partir" de 33,5 %; destare 2,5 %; un animal de 355,5 kg con GDP 0,78;
//   un gasto de lote. Se recorren todas las pantallas y se busca "\d.\d" (punto decimal) en el texto visible
//   y en los campos precargados.

const DIR = 'test-results/vrf-012';
mkdirSync(DIR, { recursive: true });
const P = 'VRF-KP';

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
}

let ids;
test.beforeAll(async () => {
  test.setTimeout(120_000);
  const supabase = await clientePrueba();
  destareInicial = Number((await supabase.from('parametros').select('destare_pct').single()).data.destare_pct);
  await limpiar();
  const { data: propia } = await supabase.from('fincas').select('id').eq('tipo', 'propia').single();
  const lote = (await supabase.from('lotes').insert({ codigo: `${P}-A`, nombre: `${P} A`, tipo: 'ceba', peso_meta_kg: 420.5, fecha_inicio: haceDias(60) }).select('id').single()).data.id;
  const { data: animal, error } = await supabase.rpc('registrar_animal', {
    datos: { numero_interno: `${P}-1`, chapeta_ica: `${P}-1-CH`, sexo: 'Macho', categoria: 'novillo', origen: 'compra', fecha_ingreso: haceDias(50), peso_ingreso_kg: 316.5, peso_objetivo_kg: 420.5, costo_compra_cop: 1_234_567, lote_id: lote, finca_id: propia.id },
  });
  if (error) throw error;
  await supabase.from('pesajes').insert({ animal_id: animal, fecha: hoyBogota(), peso_kg: 355.5 }); // GDP 39 / 50 = 0,78
  await supabase.from('potreros').insert({ finca_id: propia.id, nombre: `${P} P1`, area_ha: 12.5 });
  const finca = (await supabase.from('fincas').insert({ nombre: `${P} finca tenedor`, tipo: 'tenedor' }).select('id').single()).data.id;
  const ten = (await supabase.from('tenedores').insert({ nombre: `${P} tenedor`, finca_id: finca }).select('id').single()).data.id;
  const contrato = (await supabase.from('contratos_al_partir').insert({ tenedor_id: ten, porcentaje_ganancia: 33.5, fecha_inicio: haceDias(30) }).select('id').single()).data.id;
  await supabase.from('costos').insert({ lote_id: lote, categoria: 'suplemento', descripcion: `${P} suplemento`, monto_cop: 333_333, fecha: haceDias(3) });
  await supabase.from('parametros').update({ destare_pct: 2.5 }).eq('id', true);
  ids = { lote, animal, contrato, propia: propia.id };
});
test.afterAll(async () => {
  const supabase = await clientePrueba();
  await supabase.from('parametros').update({ destare_pct: destareInicial }).eq('id', true);
  await limpiar();
});

test('VRF 012 R1: indicadores contra el cálculo a mano desde la base de datos', async ({ page }) => {
  const supabase = await clientePrueba();
  const { data: animales } = await supabase.from('animales').select('id, estado, numero_interno, chapeta_ica, lote_id, pesajes ( fecha )');
  const activos = animales.filter((a) => a.estado === 'activo');
  const conHistorial = activos.filter((a) => new Set(a.pesajes.map((p) => p.fecha)).size >= 2);
  const pct = (n, d) => Math.round((n / d) * 1000) / 10;
  const esperado = { activos: activos.length, conHistorial: conHistorial.length, historialPct: pct(conHistorial.length, activos.length) };
  const { data: lotes } = await supabase.from('lotes').select('id, nombre, estado').not('estado', 'in', '(vendido,cerrado)');
  esperado.porLote = Object.fromEntries(
    lotes
      .map((l) => [l.nombre, activos.filter((a) => a.lote_id === l.id).flatMap((a) => a.pesajes.map((p) => p.fecha)).sort().at(-1)])
      .filter(([, f]) => f),
  );
  const { count: ventas } = await supabase.from('ventas').select('id', { count: 'exact', head: true });
  esperado.ventas = ventas;

  await iniciarSesion(page);
  await page.goto('/#/indicadores');
  await expect(page.getByText('Metas frente a la línea base')).toBeVisible();
  await page.waitForTimeout(1500);
  const texto = (await page.locator('main').innerText()).split('\n').map((l) => l.trim()).filter(Boolean);
  await page.screenshot({ path: `${DIR}/01-indicadores.png`, fullPage: true });
  registrar('indicadores', { esperado, pantalla: texto });
  expect(texto).toContain(`Hoy: 100 % de ${esperado.activos} reses activas`);
  expect(texto.some((l) => l.startsWith(`Hoy: ${String(esperado.historialPct).replace('.', ',')} % (${esperado.conHistorial} reses)`))).toBe(true);
  for (const [nombre, fecha] of Object.entries(esperado.porLote)) {
    const i = texto.indexOf(nombre);
    const dias = Math.round((Date.parse(`${hoyBogota()}T00:00:00Z`) - Date.parse(`${fecha}T00:00:00Z`)) / 86_400_000);
    expect(texto[i + 1], nombre).toMatch(new RegExp(`^hace ${dias} días`));
  }
});

const RUTAS = [
  '/#/',
  '/#/animales',
  'ANIMAL',
  'LOTE',
  '/#/lotes',
  '/#/fincas',
  'COSTOS',
  '/#/al-partir',
  'CONTRATO',
  '/#/mercado',
  'RECOMENDACION',
  '/#/reporte',
  '/#/indicadores',
  '/#/pesaje',
  '/#/ventas',
  'VENTA_NUEVA',
  '/#/animales/importar',
];

test('VRF 012 R2: ninguna cifra con punto decimal en toda la app (texto visible y campos precargados)', async ({ page }) => {
  test.setTimeout(240_000);
  await page.route('https://api.open-meteo.com/**', (r) =>
    r.fulfill({ json: { current: { temperature_2m: 30.4, precipitation: 0.3, weather_code: 1 }, daily: { time: [0, 1, 2, 3, 4, 5, 6].map((i) => haceDias(-i)), temperature_2m_max: Array(7).fill(33.6), temperature_2m_min: Array(7).fill(22.2), precipitation_sum: [0.3, 1.2, 0, 0, 2.5, 0, 0.1], weather_code: Array(7).fill(1) } } }),
  );
  await iniciarSesion(page);
  const hallados = {};
  const ruta = (r) =>
    ({ ANIMAL: `/#/animales/${ids.animal}`, LOTE: `/#/lotes/${ids.lote}`, COSTOS: `/#/costos?lote=${ids.lote}`, CONTRATO: `/#/al-partir/${ids.contrato}`, VENTA_NUEVA: `/#/ventas/nueva?lote=${ids.lote}`, RECOMENDACION: '/#/recomendacion' })[r] ?? r;
  const decimalConPunto = /(?<![\d.,/:-])\d{1,3}\.\d{1,2}(?![\d.])/g;
  const milesUS = /(?<![\d.,])\d{1,3},\d{3}(?![\d,])/g;
  for (const r of RUTAS) {
    await page.goto(ruta(r));
    await page.reload();
    await page.waitForTimeout(1800);
    if (r === 'RECOMENDACION' || r === '/#/reporte') {
      await page.locator('select').first().selectOption({ label: `${P} A` });
      await page.waitForTimeout(600);
    }
    const texto = await page.locator('body').innerText();
    const campos = await page.locator('input:not([type=hidden]):not([type=file])').evaluateAll((xs) => xs.map((x) => `${x.getAttribute('aria-label') ?? x.name ?? x.type}=${x.value}`));
    const puntos = [...new Set(texto.match(decimalConPunto) ?? [])];
    const us = [...new Set(texto.match(milesUS) ?? [])];
    const camposConPunto = campos.filter((c) => /=\d+\.\d+$/.test(c));
    if (puntos.length || us.length || camposConPunto.length) {
      const contexto = puntos.map((p) => {
        const i = texto.indexOf(p);
        return texto.slice(Math.max(0, i - 50), i + 20).replace(/\s+/g, ' ');
      });
      hallados[ruta(r)] = { puntos, contexto, us, camposConPunto };
    }
  }
  // Formularios que se abren desde la pantalla: registrar animal (lista de contratos "Al partir").
  await page.goto('/#/animales');
  await page.getByRole('button', { name: 'Registrar animal' }).click();
  await page.getByLabel('Esquema').selectOption('Al partir');
  await page.waitForTimeout(1500);
  const opciones = await page.locator('select option').allInnerTexts();
  const conPunto = opciones.filter((o) => /\d\.\d/.test(o));
  if (conPunto.length) hallados['/#/animales · Registrar animal (opciones)'] = conPunto;
  await page.keyboard.press('Escape');
  // Ronda 2: formularios de edición con cifras decimales precargadas (texto que ve el usuario).
  // Los <input type=number> guardan "33.5" en .value por norma HTML y Chromium los muestra con la
  // configuración regional; por eso se registran aparte (visto) y solo cuentan los type=text.
  const formularios = [
    ['/#/mercado', 'Cambiar destare', 'Destare (%)'],
    [`/#/al-partir/${ids.contrato}`, 'Editar contrato', null],
    [`/#/lotes/${ids.lote}`, 'Editar lote', null],
  ];
  const editados = {};
  for (const [url, boton, etiqueta] of formularios) {
    await page.goto(url);
    await page.reload();
    await page.getByRole('button', { name: boton }).click();
    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toBeVisible();
    const campos = await dialogo.locator('input').evaluateAll((xs) => xs.map((x) => ({ tipo: x.type, valor: x.value })));
    editados[boton] = { campos: campos.filter((c) => /\d/.test(c.valor)), campo: etiqueta ? await dialogo.getByLabel(etiqueta).inputValue() : null };
    await page.screenshot({ path: `${DIR}/r2-${boton.replace(/\s+/g, '-')}.png` });
    const conPuntoTexto = campos.filter((c) => c.tipo === 'text' && /^\d+\.\d+$/.test(c.valor));
    if (conPuntoTexto.length) hallados[`${url} · ${boton}`] = conPuntoTexto;
    await page.keyboard.press('Escape');
  }
  registrar('formularios de edición (valores)', editados);
  // Ronda 2: la ficha del animal en modo impresión (R2 + R4).
  await page.goto(`/#/animales/${ids.animal}`);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Imprimir ficha' })).toBeVisible();
  await page.waitForTimeout(800);
  await page.emulateMedia({ media: 'print' });
  const ficha = await page.locator('main').innerText();
  const pFicha = [...new Set(ficha.match(decimalConPunto) ?? [])];
  if (pFicha.length) hallados['ficha (impresa)'] = pFicha.map((p) => ficha.slice(Math.max(0, ficha.indexOf(p) - 50), ficha.indexOf(p) + 20).replace(/\s+/g, ' '));
  await page.emulateMedia({ media: 'screen' });
  // El reporte impreso.
  await page.goto('/#/reporte');
  await page.reload();
  await page.locator('select').first().selectOption({ label: `${P} A` });
  await page.waitForTimeout(800);
  await page.emulateMedia({ media: 'print' });
  const impreso = await page.locator('article').innerText();
  const pImp = [...new Set(impreso.match(decimalConPunto) ?? [])];
  if (pImp.length) hallados['/#/reporte (impreso)'] = pImp.map((p) => impreso.slice(Math.max(0, impreso.indexOf(p) - 50), impreso.indexOf(p) + 20).replace(/\s+/g, ' '));
  await page.emulateMedia({ media: 'screen' });
  registrar('cifras con punto decimal', hallados);
  expect(Object.keys(hallados)).toEqual([]);
});

test('VRF 012 r2 · Bajo 1: plurales con cantidad() ("1 res") y cifras de la ronda 1 ya corregidas', async ({ page }) => {
  await page.route('https://api.open-meteo.com/**', (r) =>
    r.fulfill({ json: { current: { temperature_2m: 30.4, precipitation: 0.3, weather_code: 1 }, daily: { time: [0, 1, 2, 3, 4, 5, 6].map((i) => haceDias(-i)), temperature_2m_max: Array(7).fill(33.6), temperature_2m_min: Array(7).fill(22.2), precipitation_sum: [0.3, 1.2, 0, 0, 2.5, 0, 0.1], weather_code: Array(7).fill(1) } } }),
  );
  await iniciarSesion(page);
  const lineas = async (url) => {
    await page.goto(url);
    await page.reload();
    await page.waitForTimeout(1500);
    return (await page.locator('main').innerText()).split('\n').map((l) => l.trim()).filter(Boolean);
  };
  const r = {};
  const panel = await lineas('/#/');
  r.panelLote = panel[panel.indexOf(`${P} A`) + 1];
  const fincas = await lineas('/#/fincas');
  r.fincasPotrero = fincas.filter((l) => l.includes(`${P} P1`) || /^\d+ res(es)?$/.test(l)).slice(0, 6);
  r.fincasTexto = fincas.find((l) => l.startsWith(`${P} P1`));
  await page.goto('/#/pesaje');
  await page.reload();
  await page.waitForTimeout(1200);
  r.pesajeOpcion = (await page.locator('select option').allInnerTexts()).find((o) => o.startsWith(`${P} A`));
  await page.goto('/#/recomendacion');
  await page.reload();
  await page.locator('select').first().selectOption({ label: `${P} A` });
  await page.waitForTimeout(800);
  r.razonDestare = (await page.locator('main').innerText()).split('\n').find((l) => /de destare/.test(l));
  const ind = await lineas('/#/indicadores');
  r.indicadoresDias = ind.filter((l) => /^hace \d+ días?/.test(l));
  registrar('plurales y cifras', r);
  expect(r.panelLote).toBe('1 res');
  expect(r.fincasTexto).toContain('(12,5 ha)');
  expect(r.pesajeOpcion).toBe(`${P} A (1 res)`);
  expect(r.razonDestare).toContain('2,5 % de destare');
});

test('VRF 012 R4: ficha del animal imprimible (identificación, pesos, sanidad, ubicación y costos)', async ({ page }) => {
  await iniciarSesion(page);
  await page.goto(`/#/animales/${ids.animal}`);
  await expect(page.getByRole('button', { name: 'Imprimir ficha' })).toBeVisible();
  await page.waitForTimeout(800);
  await page.emulateMedia({ media: 'print' });
  const r = {};
  r.encabezados = await page.locator('main h2, main h3').evaluateAll((hs) => hs.filter((h) => h.checkVisibility()).map((h) => h.innerText.trim()));
  r.botonesVisibles = await page.locator('button, a[href]').evaluateAll((bs) => bs.filter((b) => b.checkVisibility()).map((b) => b.innerText.trim()).filter(Boolean));
  r.navegacionVisible = await page.locator('nav').evaluateAll((ns) => ns.some((n) => n.checkVisibility()));
  r.texto = (await page.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 900);
  await page.pdf({ path: `${DIR}/02-ficha.pdf`, format: 'Letter', printBackground: true });
  await page.screenshot({ path: `${DIR}/03-ficha-impresion.png`, fullPage: true });
  registrar('ficha imprimible', r);
  for (const h of ['Identificación', 'Historial de peso', 'Historial sanitario', 'Ubicación', 'Costo acumulado']) expect(r.encabezados.join(' | '), h).toContain(h);
  expect(r.navegacionVisible).toBe(false);
  expect(r.texto).toContain('355,5 kg');
  expect(r.texto).toContain('$1.234.567');
});

test.describe('celular 375×812', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  test('VRF 012 indicadores y ficha en el celular', async ({ page }) => {
    await iniciarSesion(page);
    await page.goto('/#/indicadores');
    await expect(page.getByText('Metas frente a la línea base')).toBeVisible();
    await page.waitForTimeout(800);
    const r = { indicadores: await page.evaluate(medirDesborde) };
    await page.screenshot({ path: `${DIR}/04-indicadores-celular.png`, fullPage: true });
    await page.goto(`/#/animales/${ids.animal}`);
    await expect(page.getByRole('button', { name: 'Imprimir ficha' })).toBeVisible();
    r.ficha = await page.evaluate(medirDesborde);
    registrar('celular', r);
    expect(r.indicadores.scrollWidth).toBe(375);
    expect(r.ficha.scrollWidth).toBe(375);
  });
});
