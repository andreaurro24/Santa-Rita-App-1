import { mkdirSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';
import { clientePrueba, iniciarSesion } from './helpers';
import { medirControles, medirDesborde } from './verificador-medidas';

// Pruebas del VERIFICADOR para la spec 009 (estado del pasto y destare), ronda 1.
// - R1/R2 en el celular: registrar, ver el último por finca, "Desactualizado" a los 31 días (no a los 30),
//   y el caso de dos potreros de la misma finca.
// - R3: destare 0–15 %, vacío, texto, coma decimal; persistencia y otra sesión.
// - R4: validaciones en la interfaz y en la BD (fecha futura, 1999, nivel inválido, potrero de otra finca), RLS con anon.
// Prefijo VRF-PA (fincas, potreros, notas). El destare se devuelve a su valor inicial.

const DIR = 'test-results/vrf-009';
mkdirSync(DIR, { recursive: true });
const P = 'VRF-PA';

const hoyBogota = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
const haceDias = (n) => new Date(Date.parse(`${hoyBogota()}T12:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);

function registrar(nombre, datos) {
  console.log(`${nombre}: ${JSON.stringify(datos)}`);
  test.info().annotations.push({ type: nombre, description: JSON.stringify(datos) });
}

let destareInicial = 0;
async function limpiar() {
  const supabase = await clientePrueba();
  await supabase.from('condicion_pasto').delete().like('notas', `${P}%`);
  await supabase.from('potreros').delete().like('nombre', `${P}%`);
  await supabase.from('fincas').delete().like('nombre', `${P}%`);
}
test.beforeAll(async () => {
  const supabase = await clientePrueba();
  destareInicial = Number((await supabase.from('parametros').select('destare_pct').single()).data.destare_pct);
  await limpiar();
});
test.afterAll(async () => {
  const supabase = await clientePrueba();
  await supabase.from('parametros').update({ destare_pct: destareInicial }).eq('id', true);
  await limpiar();
});

test('VRF 009 R4 y RLS: la base de datos valida el estado del pasto y el destare', async () => {
  const supabase = await clientePrueba();
  const { data: propia } = await supabase.from('fincas').select('id').eq('tipo', 'propia').single();
  const { data: ajena } = await supabase.from('fincas').insert({ nombre: `${P} finca ajena`, tipo: 'tenedor' }).select('id').single();
  const { data: potAjeno } = await supabase.from('potreros').insert({ finca_id: ajena.id, nombre: `${P} potrero ajeno` }).select('id').single();
  const base = { finca_id: propia.id, fecha: haceDias(1), nivel: 'verde', notas: `${P} bd` };
  const ins = async (fila) => {
    const { error } = await supabase.from('condicion_pasto').insert({ ...base, ...fila }).select('id');
    return error ? `${error.code} ${error.message.slice(0, 50)}` : 'ACEPTADO';
  };
  const r = { pasto: {}, destare: {}, anon: {} };
  r.pasto.valido = await ins({});
  r.pasto.fechaFutura = await ins({ fecha: '2099-01-01' });
  r.pasto.manana = await ins({ fecha: haceDias(-1) });
  r.pasto.fecha1999 = await ins({ fecha: '1999-12-31' });
  r.pasto.nivelInvalido = await ins({ nivel: 'morado' });
  r.pasto.nivelMayusculas = await ins({ nivel: 'ROJO' });
  r.pasto.sinFinca = await ins({ finca_id: null });
  r.pasto.potreroDeOtraFinca = await ins({ potrero_id: potAjeno.id });
  const { data: una } = await supabase.from('condicion_pasto').select('id').eq('notas', `${P} bd`).limit(1).single();
  const up = await supabase.from('condicion_pasto').update({ fecha: '2099-01-01' }).eq('id', una.id).select('id');
  r.pasto.editarAFechaFutura = up.error?.code ?? 'ACEPTADO';
  const d = async (v) => {
    const { error } = await supabase.from('parametros').update({ destare_pct: v }).eq('id', true).select('destare_pct');
    return error ? error.code : 'ACEPTADO';
  };
  r.destare = { menos1: await d(-1), dieciseis: await d(16), quince: await d(15), cero: await d(0), texto: await d('abc') };
  const ins2 = await supabase.from('parametros').insert({ id: true, destare_pct: 5 });
  r.destare.segundaFila = ins2.error?.code ?? 'ACEPTADO';
  const anon = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const aSel = await anon.from('condicion_pasto').select('id');
  const aIns = await anon.from('condicion_pasto').insert(base);
  const aPar = await anon.from('parametros').select('destare_pct');
  const aUpd = await anon.from('parametros').update({ destare_pct: 9 }).eq('id', true).select('destare_pct');
  r.anon = { selectPasto: aSel.error?.code ?? `devolvió ${aSel.data?.length}`, insertPasto: aIns.error?.code ?? 'ACEPTADO', selectParametros: aPar.error?.code ?? `devolvió ${aPar.data?.length}`, updateParametros: aUpd.error?.code ?? `actualizó ${aUpd.data?.length}` };
  await supabase.from('parametros').update({ destare_pct: destareInicial }).eq('id', true);

  registrar('BD 009', r);
  expect(r.pasto.valido).toBe('ACEPTADO');
  expect(r.pasto.fechaFutura).toMatch(/fecha_futura/);
  expect(r.pasto.manana).toMatch(/fecha_futura/);
  expect(r.pasto.fecha1999).toMatch(/^23514/);
  expect(r.pasto.nivelInvalido).toMatch(/^23514/);
  expect(r.pasto.nivelMayusculas).toMatch(/^23514/);
  expect(r.pasto.sinFinca).toMatch(/^23502/);
  expect(r.pasto.potreroDeOtraFinca).toMatch(/potrero_de_otra_finca/);
  expect(r.pasto.editarAFechaFutura).toBe('23514');
  expect(r.destare.menos1).toBe('23514');
  expect(r.destare.dieciseis).toBe('23514');
  expect(r.destare.quince).toBe('ACEPTADO');
  expect(r.anon.selectPasto).toBe('42501');
  expect(r.anon.insertPasto).toBe('42501');
  expect(r.anon.selectParametros).toBe('42501');
});

test.describe('celular 375×812', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

  test('VRF 009 R1–R3 en el celular: registrar, desactualizado, potreros y destare', async ({ page, browser }) => {
    test.setTimeout(150_000);
    const supabase = await clientePrueba();
    // Dos fincas de prueba: una con un estado de hace 30 días y otra de hace 31.
    const { data: f30 } = await supabase.from('fincas').insert({ nombre: `${P} finca 30 días`, tipo: 'tenedor' }).select('id').single();
    const { data: f31 } = await supabase.from('fincas').insert({ nombre: `${P} finca 31 días`, tipo: 'tenedor' }).select('id').single();
    const { data: fPot } = await supabase.from('fincas').insert({ nombre: `${P} finca con potreros`, tipo: 'tenedor' }).select('id').single();
    const { data: pots } = await supabase.from('potreros').insert([{ finca_id: fPot.id, nombre: `${P} potrero A` }, { finca_id: fPot.id, nombre: `${P} potrero B` }]).select('id, nombre');
    await supabase.from('condicion_pasto').insert([
      { finca_id: f30.id, fecha: haceDias(30), nivel: 'rojo', notas: `${P} 30` },
      { finca_id: f31.id, fecha: haceDias(31), nivel: 'rojo', notas: `${P} 31` },
    ]);
    const errores = [];
    page.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
    page.on('response', (x) => x.status() >= 400 && !x.url().includes('/auth/v1/') && !x.url().includes('open-meteo') && errores.push(`${x.status()} ${x.request().method()} ${x.url().split('?')[0]}`));
    const r = {};
    await iniciarSesion(page);
    await page.goto('/#/mercado');
    await expect(page.getByRole('heading', { name: 'Precio y pasto' })).toBeVisible();
    const pasto = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Estado del pasto' }) });
    await expect(pasto.getByRole('listitem').filter({ hasText: `${P} finca 30 días` })).toBeVisible();
    const fila = async (nombre) => (await pasto.getByRole('listitem').filter({ hasText: nombre }).innerText()).replace(/\s+/g, ' ');
    r.fila30 = await fila(`${P} finca 30 días`);
    r.fila31 = await fila(`${P} finca 31 días`);
    r.pantalla = { desborde: (await page.evaluate(medirDesborde)).scrollWidth, controlesChicos: await page.evaluate(medirControles) };
    await page.screenshot({ path: `${DIR}/01-mercado.png`, fullPage: true });

    // R1/R4 en la interfaz.
    await pasto.getByRole('button', { name: 'Registrar estado' }).tap();
    let hoja = page.getByRole('dialog', { name: 'Registrar estado del pasto' });
    const alerta = async () => ((await hoja.getByRole('alert').count()) ? (await hoja.getByRole('alert').innerText()).trim() : 'SIN MENSAJE');
    await hoja.getByRole('button', { name: 'Guardar' }).tap();
    r.sinNivel = await alerta();
    await hoja.getByRole('combobox').first().selectOption({ label: `${P} finca con potreros` });
    r.opcionesPotrero = await hoja.getByRole('combobox').nth(1).evaluate((s) => [...s.options].map((o) => o.text));
    await hoja.getByRole('combobox').nth(1).selectOption({ label: `${P} potrero A` });
    await hoja.getByText('Escaso').tap();
    await hoja.getByLabel('Fecha').fill('2099-01-01');
    await hoja.getByRole('button', { name: 'Guardar' }).tap();
    r.fechaFutura = await alerta();
    await hoja.getByLabel('Fecha').fill('1999-12-31');
    await hoja.getByRole('button', { name: 'Guardar' }).tap();
    await page.waitForTimeout(1500);
    r.fecha1999 = (await hoja.count()) ? await alerta() : 'GUARDADO';
    await hoja.getByLabel('Fecha').fill(hoyBogota());
    await hoja.getByLabel('Notas').fill(`${P} potrero A seco`);
    r.hoja = { controlesChicos: await page.evaluate(medirControles) };
    await page.screenshot({ path: `${DIR}/02-hoja-pasto.png` });
    await hoja.getByRole('button', { name: 'Guardar' }).dblclick();
    await expect(hoja).toHaveCount(0);
    r.dobleToque = (await supabase.from('condicion_pasto').select('id').eq('notas', `${P} potrero A seco`)).data.length;
    r.filaTrasRojoPotreroA = await fila(`${P} finca con potreros`);
    // Luego el potrero B en verde (registrado después): ¿qué muestra la finca?
    await pasto.getByRole('button', { name: 'Registrar estado' }).tap();
    hoja = page.getByRole('dialog', { name: 'Registrar estado del pasto' });
    await hoja.getByRole('combobox').first().selectOption({ label: `${P} finca con potreros` });
    await hoja.getByRole('combobox').nth(1).selectOption({ label: `${P} potrero B` });
    await hoja.getByText('Bien').tap();
    await hoja.getByLabel('Notas').fill(`${P} potrero B bien`);
    await hoja.getByRole('button', { name: 'Guardar' }).tap();
    await expect(hoja).toHaveCount(0);
    r.filaTrasVerdePotreroB = await fila(`${P} finca con potreros`);

    // R3: destare.
    const parametros = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Parámetros de venta' }) });
    r.destareInicialEnPantalla = (await parametros.innerText()).replace(/\s+/g, ' ');
    r.destare = {};
    for (const v of ['15,1', '-1', 'abc', '', '7,5']) {
      await parametros.getByRole('button', { name: 'Cambiar destare' }).tap();
      hoja = page.getByRole('dialog', { name: 'Cambiar destare' });
      await hoja.getByLabel('Destare (%)').fill(v);
      await hoja.getByRole('button', { name: 'Guardar' }).tap();
      await page.waitForTimeout(800);
      if (await hoja.count()) {
        r.destare[`"${v}"`] = await alerta();
        await hoja.getByRole('button', { name: 'Cancelar' }).tap();
      } else r.destare[`"${v}"`] = `GUARDADO → ${(await supabase.from('parametros').select('destare_pct').single()).data.destare_pct}`;
    }
    r.destareEnPantalla = (await parametros.innerText()).replace(/\s+/g, ' ');
    await page.screenshot({ path: `${DIR}/03-destare.png`, fullPage: true });
    // Persistencia: recarga y otra sesión (escritorio).
    await page.reload();
    await expect(parametros).toContainText('7,5 %');
    const otra = await browser.newContext();
    const p2 = await otra.newPage();
    await iniciarSesion(p2);
    await p2.goto('/#/mercado');
    const par2 = p2.locator('section').filter({ has: p2.getByRole('heading', { name: 'Parámetros de venta' }) });
    r.otraSesion = await expect(par2).toContainText('7,5 %').then(() => true, () => false);
    r.otraSesionPotreros = (await p2.locator('section').filter({ has: p2.getByRole('heading', { name: 'Estado del pasto' }) }).getByRole('listitem').filter({ hasText: `${P} finca con potreros` }).innerText()).replace(/\s+/g, ' ');
    await p2.screenshot({ path: `${DIR}/04-mercado-escritorio.png`, fullPage: true });
    await otra.close();

    registrar('UI 009', r);
    registrar('consola y red', errores);
    expect(r.fila30).toMatch(/Escaso/);
    expect(r.fila30).not.toMatch(/Desactualizado/);
    expect(r.fila31).toMatch(/Desactualizado/);
    expect(r.sinNivel).toMatch(/Elige cómo está el pasto/);
    expect(r.fechaFutura).toMatch(/futura/);
    expect(r.dobleToque).toBe(1);
    expect(r.destare['"15,1"']).toMatch(/entre 0 y 15/);
    expect(r.destare['"-1"']).toMatch(/entre 0 y 15/);
    expect(r.destare['"abc"']).toMatch(/entre 0 y 15/);
    expect(r.destare['"7,5"']).toMatch(/GUARDADO → 7.5/);
    expect(r.otraSesion).toBe(true);
    expect(r.pantalla.desborde).toBe(375);
  });
});
