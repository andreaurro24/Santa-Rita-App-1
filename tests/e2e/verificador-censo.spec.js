import { mkdirSync, readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { clientePrueba, iniciarSesion } from './helpers';
import { medirDesborde } from './verificador-medidas';

// Pruebas del VERIFICADOR para la spec 013 (importar el censo desde CSV), ronda 1.
// Archivos reales y hostiles: Excel con BOM, punto y coma y CRLF; comillas; fechas mal escritas; duplicados
// dentro del archivo y contra el hato; filas vacías (también las ";;;;;;;;" que deja Excel); Latin-1; un
// encabezado distinto; 200 filas; la plantilla; y la red que se cae a mitad de la importación.
// Prefijo VRF-CN; todo se borra.

const DIR = 'test-results/vrf-013';
mkdirSync(DIR, { recursive: true });
const P = 'VRF-CN';
const ENC = 'numero_interno;chapeta_ica;sexo;categoria;lote;fecha_ingreso;peso_ingreso_kg;peso_objetivo_kg;costo_compra_cop';

function registrar(nombre, datos) {
  console.log(`${nombre}: ${JSON.stringify(datos)}`);
  test.info().annotations.push({ type: nombre, description: JSON.stringify(datos) });
}

async function limpiar() {
  const supabase = await clientePrueba();
  for (let i = 0; i < 5; i++) {
    const { data } = await supabase.from('animales').select('id').like('numero_interno', `${P}%`).limit(500);
    if (!data?.length) break;
    await supabase.from('animales').delete().in('id', data.map((a) => a.id));
  }
}
test.beforeAll(limpiar);
test.afterAll(limpiar);

async function abrir(page) {
  await page.goto('/#/animales/importar');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Importar censo' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Descargar plantilla' })).toBeVisible();
}
async function cargar(page, nombre, buffer) {
  await page.getByLabel('Archivo CSV del censo').setInputFiles({ name: nombre, mimeType: 'text/csv', buffer });
  await page.waitForTimeout(800);
}
async function vistaPrevia(page) {
  const main = page.locator('main');
  const texto = (await main.innerText()).split('\n').map((l) => l.trim()).filter(Boolean);
  const errores = {};
  let fila = null;
  for (const l of texto) {
    const m = /^Fila (\d+)$/.exec(l);
    if (m) fila = m[1];
    else if (fila && !/^(Importar|Se omitirán|Ninguna fila)/.test(l)) (errores[fila] ??= []).push(l);
    if (/^(Importar|Se omitirán|Ninguna fila)/.test(l)) fila = null;
  }
  return {
    validas: texto.find((l) => /filas válidas$/.test(l)),
    conErrores: texto.find((l) => /con errores$/.test(l)) ?? '0 con errores',
    boton: texto.find((l) => /^Importar \d+/.test(l)),
    omitir: texto.find((l) => /^Se omitirán/.test(l)),
    alerta: (await page.getByRole('alert').count()) ? (await page.getByRole('alert').first().innerText()).trim() : null,
    errores,
  };
}

test('VRF 013 R1–R4: CSV de Excel hostil (BOM, ; , CRLF, comillas, fechas, duplicados, filas vacías)', async ({ page }) => {
  test.setTimeout(150_000);
  const errores = [];
  page.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
  page.on('response', (x) => x.status() >= 400 && !x.url().includes('/auth/v1/') && errores.push(`${x.status()} ${x.request().method()} ${x.url().split('?')[0]}`));
  const supabase = await clientePrueba();
  const { data: existente } = await supabase.from('animales').select('numero_interno, chapeta_ica').eq('numero_interno', '0102').single();
  const lineas = [
    ENC, // 1
    `${P}-01;${P}-CH-01;Macho;novillo;LOTE-2026-A;15/09/2026;210,5;350;1.250.000`, // 2 válida
    `"${P}-02";"${P}-CH-02";"Hembra";"ternera";"LOTE-2026-A";"2026-09-16";"150";"260";"$ 900.000"`, // 3 válida, comillas y $
    `"${P}-03 ""A"";x";${P}-CH-03;Macho;novillo;LOTE-2026-A;01/09/2026;200;330;`, // 4 comillas con ; y "" dentro
    `${P}-04;${P}-CH-04;Macho;novillo;LOTE-2026-A;31/02/2026;200;330;`, // 5 fecha imposible
    `${P}-05;${P}-CH-05;Macho;novillo;LOTE-2026-A;2026/09/15;200;330;`, // 6 fecha aaaa/mm/dd
    `${P}-06;${P}-CH-06;Macho;novillo;LOTE-2026-A;15-09-2026;200;330;`, // 7 fecha con guiones
    `${P}-07;${P}-CH-07;Macho;novillo;LOTE-2026-A;15/09/26;200;330;`, // 8 año de 2 dígitos
    `${P}-08;${P}-CH-08;Macho;novillo;LOTE-2026-A;01/01/2099;200;330;`, // 9 futura
    `${P}-09;${P}-CH-09;Macho;novillo;LOTE-2026-A;31/12/1999;200;330;`, // 10 antes de 2000
    `${P}-01;${P}-CH-10;Macho;novillo;LOTE-2026-A;15/09/2026;200;330;`, // 11 número repetido en el archivo
    `${P}-11;${P.toLowerCase()}-ch-02;Macho;novillo;LOTE-2026-A;15/09/2026;200;330;`, // 12 chapeta repetida (minúsculas)
    `${existente.numero_interno};${P}-CH-12;Macho;novillo;LOTE-2026-A;15/09/2026;200;330;`, // 13 número del hato
    `${P}-13;${existente.chapeta_ica};Macho;novillo;LOTE-2026-A;15/09/2026;200;330;`, // 14 chapeta del hato
    ';;;;;;;;', // 15 fila vacía de Excel
    '', // 16 línea en blanco
    `${P}-14;${P}-CH-14;Macho;novillo;NO-EXISTE;15/09/2026;200;330;`, // 17 lote inexistente (tras la línea en blanco)
    `${P}-15;${P}-CH-15;Macho;novillo;LOTE-2026-A;15/09/2026;210.5;350;`, // 18 punto decimal
    `${P}-16;${P}-CH-16;Macho;novillo;LOTE-2026-A;15/09/2026;200;330;1,250,000`, // 19 miles en inglés
    `${P}-17;${P}-CH-17;Macho;novillo;LOTE-2026-A;15/09/2026;200;330;$ 1.250.000,00`, // 20 formato moneda de Excel
    `${P}-18;${P}-CH-18;Macho;vientre;LOTE-2026-A;15/09/2026;200;330;`, // 21 categoría y sexo
    `  ${P}-19  ; ${P}-CH-19 ;macho;NOVILLO;lote-2026-a;5/9/2026; 200 ;330;`, // 22 espacios, mayúsculas, d/m
    `${P}-20;${P}-CH-20;Macho;novillo`, // 23 fila corta
    `${P}-21;${P}-CH-21;Macho;novillo;LOTE-2026-A;15/09/2026;-5;330;`, // 24 peso negativo
    `${P}-22;${P}-CH-22;Macho;novillo;LOTE-2026-A;15/09/2026;abc;330;`, // 25 texto en número
    `${P}-23;${P}-CH-23;Macho;novillo;LOTE-2026-A;15/09/2026;0;330;`, // 26 cero
    '', // 27
    '', // 28
  ];
  const csv = '﻿' + lineas.join('\r\n');
  await iniciarSesion(page);
  await abrir(page);
  await cargar(page, 'censo excel.csv', Buffer.from(csv, 'utf-8'));
  const r = { vista: await vistaPrevia(page) };
  await page.screenshot({ path: `${DIR}/01-vista-previa.png`, fullPage: true });
  // Doble clic en Importar.
  const boton = page.getByRole('button', { name: /^Importar \d+/ });
  await boton.dblclick();
  await expect(page.getByText(/^Se importaron \d+/)).toBeVisible({ timeout: 60_000 });
  r.final = (await page.getByRole('status').filter({ hasText: 'Se importaron' }).innerText()).replace(/\s+/g, ' ');
  const { data: creados } = await supabase
    .from('animales')
    .select('numero_interno, chapeta_ica, sexo, categoria, fecha_ingreso, peso_ingreso_kg, costo_compra_cop, origen, pesajes ( fecha, peso_kg )')
    .like('numero_interno', `${P}%`)
    .order('numero_interno');
  r.creados = creados;
  registrar('csv hostil', r);
  registrar('consola y red', errores);

  const e = r.vista.errores;
  expect(e['5']?.join(' ')).toMatch(/31\/02\/2026" no es válida/);
  expect(e['6']?.join(' ')).toMatch(/no es válida/);
  expect(e['7']?.join(' ')).toMatch(/no es válida/);
  expect(e['8']?.join(' ')).toMatch(/no es válida/);
  expect(e['9']?.join(' ')).toMatch(/futura/);
  expect(e['10']?.join(' ')).toMatch(/2000/);
  expect(e['11']?.join(' ')).toMatch(/se repite en la fila 2/);
  expect(e['12']?.join(' ')).toMatch(/se repite en la fila 3/);
  expect(e['13']?.join(' ')).toMatch(/ya existe en el hato/);
  expect(e['14']?.join(' ')).toMatch(/ya existe en el hato/);
  expect(Object.values(e).flat().join(' ')).toMatch(/La categoría "vientre" no corresponde a Macho/);
  expect(Object.keys(e)).not.toContain('2');
  expect(Object.keys(e)).not.toContain('3');
  expect(creados.find((a) => a.numero_interno === `${P}-01`)).toMatchObject({ peso_ingreso_kg: 210.5, costo_compra_cop: 1_250_000, fecha_ingreso: '2026-09-15' });
  expect(creados.find((a) => a.numero_interno === `${P}-02`)).toMatchObject({ costo_compra_cop: 900_000, sexo: 'Hembra', categoria: 'ternera' });
  expect(creados.every((a) => a.pesajes.length === 1)).toBe(true);
  // Número de fila del lote inexistente: está en la línea 17 del archivo (después de una línea en blanco).
  const filaLote = Object.entries(e).find(([, v]) => v.join(' ').includes('NO-EXISTE'))?.[0];
  if (filaLote !== '17') registrar('HALLAZGO 013 número de fila corrido', { esperado: '17', mostrado: filaLote, filas: Object.keys(e) });
  if (e['15']) registrar('HALLAZGO 013 fila ;;;;;;;; de Excel como error', e['15']);
});

test('VRF 013 R1: Latin-1 (CSV de Excel sin UTF-8) y un encabezado de costo distinto', async ({ page }) => {
  await iniciarSesion(page);
  const r = {};
  await abrir(page);
  const latin1 = Buffer.from([ENC, `${P}-Ñ1;${P}-CH-Ñ1;Macho;novillo;LOTE-2026-A;15/09/2026;200;330;`].join('\r\n'), 'latin1');
  await cargar(page, 'latin1.csv', latin1);
  r.latin1 = await vistaPrevia(page);
  // La vista previa no muestra las filas válidas: se importa para ver qué quedó guardado.
  await page.getByRole('button', { name: 'Importar 1 animal' }).click();
  await expect(page.getByText(/^Se importaron \d+/)).toBeVisible({ timeout: 30_000 });
  const supabase = await clientePrueba();
  const { data: l1 } = await supabase.from('animales').select('numero_interno, chapeta_ica').like('chapeta_ica', `${P}-CH-%1`).not('chapeta_ica', 'like', `${P}-CH-0%`);
  r.latin1Texto = (l1 ?? []).map((a) => `${a.numero_interno} | ${a.chapeta_ica}`);
  await abrir(page);
  const otroEncabezado = ['Número interno;Chapeta ICA;Sexo;Categoría;Lote;Fecha de ingreso;Peso de ingreso (kg);Peso objetivo (kg);Costo de compra', `${P}-E1;${P}-CH-E1;Macho;novillo;LOTE-2026-A;15/09/2026;200;330;1.000.000`].join('\n');
  await cargar(page, 'encabezados.csv', Buffer.from(otroEncabezado, 'utf-8'));
  r.encabezadosConPalabras = await vistaPrevia(page);
  await abrir(page);
  const costoDistinto = [ENC.replace('costo_compra_cop', 'costo_compra'), `${P}-E2;${P}-CH-E2;Macho;novillo;LOTE-2026-A;15/09/2026;200;330;1.000.000`].join('\n');
  await cargar(page, 'costo.csv', Buffer.from(costoDistinto, 'utf-8'));
  r.encabezadoCosto = await vistaPrevia(page);
  await abrir(page);
  await cargar(page, 'vacio.csv', Buffer.from(ENC + '\n', 'utf-8'));
  r.soloEncabezado = await vistaPrevia(page);
  await abrir(page);
  await cargar(page, 'coma.csv', Buffer.from([ENC.replaceAll(';', ','), `${P}-C1,${P}-CH-C1,Macho,novillo,LOTE-2026-A,15/09/2026,"210,5",350,1250000`].join('\n'), 'utf-8'));
  r.separadorComa = await vistaPrevia(page);
  registrar('codificación y encabezados', r);
  if (r.latin1Texto?.some((t) => t.includes('�'))) registrar('HALLAZGO 013 Latin-1 se importa con caracteres dañados', r.latin1Texto);
  if (r.encabezadoCosto.validas?.startsWith('1')) registrar('HALLAZGO 013 columna de costo con otro nombre se ignora sin aviso', r.encabezadoCosto);
  expect(r.soloEncabezado.alerta).toMatch(/no tiene filas/);
  expect(r.separadorComa.validas).toBe('1 filas válidas');
});

test('VRF 013 R4: archivo de 200 filas', async ({ page }) => {
  test.setTimeout(300_000);
  const filas = Array.from({ length: 200 }, (_, i) => {
    const n = String(i + 1).padStart(3, '0');
    return `${P}-G${n};${P}-CHG${n};${i % 2 ? 'Hembra' : 'Macho'};${i % 2 ? 'ternera' : 'novillo'};LOTE-2026-B;${String((i % 28) + 1).padStart(2, '0')}/08/2026;${150 + (i % 50)},${i % 10};${300 + (i % 40)};${1_000_000 + i * 1000}`;
  });
  await iniciarSesion(page);
  await abrir(page);
  const t0 = Date.now();
  await cargar(page, 'censo-200.csv', Buffer.from('﻿' + [ENC, ...filas].join('\r\n'), 'utf-8'));
  const r = { vista: await vistaPrevia(page), msVistaPrevia: Date.now() - t0 };
  const t1 = Date.now();
  await page.getByRole('button', { name: 'Importar 200 animales' }).click();
  await page.waitForTimeout(2000);
  r.progreso = await page.getByRole('button', { name: /Importando/ }).innerText().catch(() => 'sin progreso visible');
  await expect(page.getByText(/^Se importaron \d+/)).toBeVisible({ timeout: 240_000 });
  r.msImportacion = Date.now() - t1;
  r.final = (await page.getByRole('status').filter({ hasText: 'Se importaron' }).innerText()).replace(/\s+/g, ' ');
  const supabase = await clientePrueba();
  const { count } = await supabase.from('animales').select('id', { count: 'exact', head: true }).like('numero_interno', `${P}-G%`);
  const { count: pesajes } = await supabase.from('pesajes').select('id, animales!inner(numero_interno)', { count: 'exact', head: true }).like('animales.numero_interno', `${P}-G%`);
  r.enBD = count;
  r.pesajesEnBD = pesajes;
  await page.goto('/#/');
  await page.reload();
  r.activosPanel = (await page.locator('main').innerText()).match(/Reses activas\s+(\d+)/)?.[1];
  registrar('200 filas', r);
  expect(r.vista.validas).toBe('200 filas válidas');
  expect(r.enBD).toBe(200);
  expect(r.pesajesEnBD).toBe(200);
});

test('VRF 013 R5 y red: plantilla descargable y la red que se cae a mitad de la importación', async ({ page }) => {
  test.setTimeout(150_000);
  await iniciarSesion(page);
  await abrir(page);
  const r = {};
  const [descarga] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Descargar plantilla' }).click()]);
  r.nombre = descarga.suggestedFilename();
  const bytes = readFileSync(await descarga.path());
  r.bom = bytes.subarray(0, 3).toString('hex');
  r.contenido = bytes.toString('utf-8').replace(/^﻿/, '');
  // Subir la plantilla tal cual: ¿qué dice la vista previa?
  await cargar(page, r.nombre, bytes);
  r.plantillaTalCual = await vistaPrevia(page);

  // Red caída a mitad: las 2 primeras llamadas a registrar_animal pasan y las demás fallan.
  await abrir(page);
  const filas = Array.from({ length: 6 }, (_, i) => `${P}-R${i + 1};${P}-CHR${i + 1};Macho;novillo;LOTE-2026-A;15/09/2026;200;330;`);
  const archivo = Buffer.from([ENC, ...filas].join('\n'), 'utf-8');
  await cargar(page, 'red.csv', archivo);
  let llamadas = 0;
  await page.route('**/rest/v1/rpc/registrar_animal', (ruta) => (++llamadas <= 2 ? ruta.continue() : ruta.abort('internetdisconnected')));
  await page.getByRole('button', { name: 'Importar 6 animales' }).click();
  await expect(page.getByText(/^Se importaron \d+/)).toBeVisible({ timeout: 60_000 });
  r.redCaida = (await page.getByRole('status').filter({ hasText: 'Se importaron' }).innerText()).split('\n').map((l) => l.trim()).filter(Boolean);
  r.vistaTrasFallo = await page.getByText('3. Revisa e importa').isVisible();
  await page.screenshot({ path: `${DIR}/02-red-caida.png`, fullPage: true });
  await page.unroute('**/rest/v1/rpc/registrar_animal');
  // Se vuelve a cargar el mismo archivo con la red de vuelta.
  await cargar(page, 'red.csv', archivo);
  r.reintento = await vistaPrevia(page);
  if (r.reintento.boton) {
    await page.getByRole('button', { name: /^Importar \d+/ }).click();
    await expect(page.getByText(/^Se importaron \d+/)).toBeVisible({ timeout: 60_000 });
  }
  const supabase = await clientePrueba();
  const { count } = await supabase.from('animales').select('id', { count: 'exact', head: true }).like('numero_interno', `${P}-R%`);
  r.enBDFinal = count;
  registrar('plantilla y red', r);
  expect(r.bom).toBe('efbbbf');
  expect(r.contenido.split('\n')[0]).toBe(ENC);
  expect(r.redCaida[0]).toBe('Se importaron 2 animales.');
  expect(r.redCaida.join(' ')).toMatch(/No hay conexión/);
  expect(r.reintento.errores['2']?.join(' ')).toMatch(/ya existe en el hato/);
  expect(r.enBDFinal).toBe(6);
});

test.describe('celular 375×812', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  test('VRF 013 vista previa con errores en el celular', async ({ page }) => {
    await iniciarSesion(page);
    await abrir(page);
    const csv = [ENC, `${P}-M1;${P}-CH-M1;Macho;novillo;NO-EXISTE-UN-LOTE-CON-NOMBRE-MUY-LARGO-2026;31/02/2026;abc;330;`, `${P}-M2;${P}-CH-M2;Macho;novillo;LOTE-2026-A;15/09/2026;200;330;`].join('\n');
    await cargar(page, 'm.csv', Buffer.from(csv, 'utf-8'));
    const r = { desborde: await page.evaluate(medirDesborde) };
    await page.screenshot({ path: `${DIR}/03-celular.png`, fullPage: true });
    registrar('celular', r);
    expect(r.desborde.scrollWidth).toBe(375);
  });
});
