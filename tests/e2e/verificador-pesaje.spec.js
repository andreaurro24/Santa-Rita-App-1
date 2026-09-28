import { mkdirSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';
import { clientePrueba, iniciarSesion } from './helpers';

// Pruebas del VERIFICADOR para la spec 004 (jornada de pesaje por lote y GDP), rondas 1 y 2.
// Ronda 2: la BD ata el pesaje a su jornada (migración 1100), la alerta suma la caída > 8 kg y la
// ficha pide confirmación > 15 %; las expectativas se actualizaron al comportamiento corregido.
// - Corral en el celular (375×812): abrir, validar, pesar con coma, variación, saltar, retomar el
//   saltado, doble toque, red caída, cerrar con pendientes e historial.
// - Integridad en la BD: una jornada abierta por lote, un pesaje por animal y jornada, RLS, cierres.
// - GDP (R5/R7) con animales de prueba: 300 → 290 y los casos que la regla de 14 días deja pasar.
// Todo lo creado lleva el prefijo VRF-PES o vive en jornadas del lote CRIA, y se borra al final.

const DIR = 'test-results/vrf-004';
mkdirSync(DIR, { recursive: true });
const PREFIJO = 'VRF-PES';
const LOTE_CORRAL = 'CRIA-2025-2026';

const hoyBogota = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
const haceDias = (n) => new Date(Date.parse(`${hoyBogota()}T12:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);
const coma = (n) => String(n).replace('.', ',');

function registrar(nombre, datos) {
  console.log(`${nombre}: ${JSON.stringify(datos)}`);
  test.info().annotations.push({ type: nombre, description: JSON.stringify(datos) });
}

async function idLote(supabase, codigo) {
  const { data } = await supabase.from('lotes').select('id').eq('codigo', codigo).single();
  return data.id;
}

async function limpiar() {
  const supabase = await clientePrueba();
  const { data: animales } = await supabase.from('animales').select('id').like('numero_interno', `${PREFIJO}%`);
  for (const a of animales ?? []) await supabase.from('animales').delete().eq('id', a.id);
  const { data: lotes } = await supabase.from('lotes').select('id').like('codigo', `${PREFIJO}%`);
  const ids = [await idLote(supabase, LOTE_CORRAL), await idLote(supabase, 'LOTE-2026-A'), ...(lotes ?? []).map((l) => l.id)];
  const { data: jornadas } = await supabase.from('jornadas_pesaje').select('id').in('lote_id', ids);
  for (const j of jornadas ?? []) {
    await supabase.from('pesajes').delete().eq('jornada_id', j.id);
    await supabase.from('jornadas_pesaje').delete().eq('id', j.id);
  }
  for (const l of lotes ?? []) await supabase.from('lotes').delete().eq('id', l.id);
}

test.beforeAll(limpiar);
test.afterAll(limpiar);

test.describe('celular 375×812 en el corral', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

  test('VRF 004 R1–R4, R8: jornada completa desde el celular', async ({ page }) => {
    test.setTimeout(180_000);
    const supabase = await clientePrueba();
    const loteId = await idLote(supabase, LOTE_CORRAL);
    const { count: total } = await supabase.from('animales').select('id', { count: 'exact', head: true }).eq('lote_id', loteId).eq('estado', 'activo');
    const errores = [];
    page.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
    page.on('response', (r) => r.status() >= 400 && !r.url().includes('/auth/v1/') && errores.push(`${r.status()} ${r.request().method()} ${r.url().split('?')[0]}`));
    const r = { total };

    await iniciarSesion(page);
    await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Pesaje' }).tap();
    await expect(page.getByRole('heading', { name: 'Jornada de pesaje' })).toBeVisible();
    await page.getByLabel('Lote').selectOption(loteId);
    await page.getByRole('button', { name: 'Abrir jornada' }).tap();
    await expect(page).toHaveURL(/#\/pesaje\/[0-9a-f-]{36}$/);
    const jornadaId = page.url().split('/').pop();
    const avance = page.getByTestId('avance');
    await expect(avance).toHaveText(`0 de ${total} pesados`);
    await page.screenshot({ path: `${DIR}/01-captura.png` });

    const campo = page.getByLabel(/^Peso de .+ \(kg\)$/);
    const guardar = page.getByRole('button', { name: 'Guardar peso' });
    const numero = async () => (await campo.evaluate((el) => el.closest('label').textContent)).match(/Peso de (.+) \(kg\)/)[1];
    // Spec 012 R2 (premisa nueva): cifras es-CO, "1.234,5 kg".
    const ultimo = async () => Number((await page.getByText(/^Último peso:/).innerText()).match(/([\d.,]+) kg/)[1].replace(/\./g, '').replace(',', '.'));
    const pesoEnJornada = async (num) => {
      const { data: a } = await supabase.from('animales').select('id').eq('numero_interno', num).single();
      const { data } = await supabase.from('pesajes').select('peso_kg, fecha').eq('jornada_id', jornadaId).eq('animal_id', a.id);
      return data;
    };
    r.autoFocusAlAbrir = await campo.evaluate((el) => el === document.activeElement);
    r.inputMode = await campo.getAttribute('inputmode');

    // 1) Validaciones: vacío, texto, cero, negativo, miles con punto, 1500.
    const validaciones = {};
    for (const malo of ['', 'abc', '0', '-5', '1.234,5', '1500', '0,04']) {
      await campo.fill(malo);
      await guardar.tap();
      const alerta = page.getByRole('alert');
      validaciones[malo || '(vacío)'] = (await alerta.count()) ? await alerta.first().innerText() : 'SIN MENSAJE';
    }
    r.validaciones = validaciones;
    await expect(avance).toHaveText(`0 de ${total} pesados`);

    // 2) Peso normal con coma decimal (+1,5 kg).
    const n1 = await numero();
    const p1 = Math.round(((await ultimo()) + 1.5) * 10) / 10;
    await campo.fill(coma(p1));
    const resp1 = page.waitForResponse((x) => x.url().includes('/rest/v1/pesajes') && x.request().method() === 'POST');
    await guardar.tap();
    await resp1;
    // Justo después de la respuesta, antes de que llegue la jornada actualizada:
    r.ventanaTrasGuardar = { numero: await numero(), valor: await campo.inputValue(), botonHabilitado: await guardar.isEnabled() };
    await expect(avance).toHaveText(`1 de ${total} pesados`);
    r.siguienteDistinto = (await numero()) !== n1;
    r.siguienteVacio = (await campo.inputValue()) === '';
    r.siguienteConFoco = await campo.evaluate((el) => el === document.activeElement);
    r.guardado1 = { numero: n1, escrito: coma(p1), bd: await pesoEnJornada(n1) };

    // 3) Variación +30 %: hoja de confirmación → "Guardar igual".
    const n2 = await numero();
    const p2 = Math.round((await ultimo()) * 1.3 * 10) / 10;
    await campo.fill(coma(p2));
    await guardar.tap();
    const aviso = page.getByRole('dialog', { name: '¿El peso es correcto?' });
    await expect(aviso).toBeVisible();
    r.aviso = { texto: await aviso.innerText(), ...(await aviso.evaluate((el) => { const b = el.getBoundingClientRect(); return { x: b.x, ancho: b.width, abajo: b.bottom }; })) };
    await page.screenshot({ path: `${DIR}/02-aviso-variacion.png` });
    await aviso.getByRole('button', { name: 'Guardar igual' }).tap();
    await expect(avance).toHaveText(`2 de ${total} pesados`);
    r.guardado2 = { numero: n2, bd: await pesoEnJornada(n2) };

    // 4) Saltar.
    const saltado = await numero();
    await page.getByRole('button', { name: 'Saltar' }).tap();
    r.trasSaltar = await numero();
    r.saltadoEnLista = await page.getByRole('button', { name: `Pesar ${saltado} (saltado)` }).isVisible();

    // 5) Toque en Guardar justo cuando llega la respuesta (la ventana antes del refresco).
    const n5 = await numero();
    const p5 = Math.round(((await ultimo()) + 2) * 10) / 10;
    await campo.fill(coma(p5));
    const resp5 = page.waitForResponse((x) => x.url().includes('/rest/v1/pesajes') && x.request().method() === 'POST');
    await guardar.tap();
    await resp5;
    const segundo = page.waitForResponse((x) => x.url().includes('/rest/v1/pesajes') && x.request().method() === 'POST', { timeout: 3000 }).catch(() => null);
    await guardar.tap({ timeout: 2000 }).catch(() => {});
    const r2 = await segundo;
    await expect(avance).toHaveText(`3 de ${total} pesados`);
    await page.waitForTimeout(800);
    r.segundoToque = {
      numero: n5,
      segundoPOST: r2 ? r2.status() : 'no hubo',
      alertaVisible: (await page.getByRole('alert').count()) ? await page.getByRole('alert').first().innerText() : null,
      filasBD: (await pesoEnJornada(n5)).length,
    };
    await page.screenshot({ path: `${DIR}/03-tras-segundo-toque.png` });

    // 6) Red caída al guardar: el peso no se pierde en pantalla y se puede reintentar.
    const n6 = await numero();
    const p6 = Math.round(((await ultimo()) + 1) * 10) / 10;
    await campo.fill(coma(p6));
    await page.route('**/rest/v1/pesajes*', (route) => (route.request().method() === 'POST' ? route.abort('internetdisconnected') : route.continue()));
    await guardar.tap();
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 15_000 });
    r.sinRed = { mensaje: await page.getByRole('alert').first().innerText(), valorConservado: await campo.inputValue(), mismoAnimal: (await numero()) === n6 };
    await page.screenshot({ path: `${DIR}/04-sin-red.png` });
    await page.unroute('**/rest/v1/pesajes*');
    await guardar.tap();
    await expect(avance).toHaveText(`4 de ${total} pesados`);
    r.sinRed.trasReintentar = await pesoEnJornada(n6);

    // 7) Tecla Enter del teclado ("Ir") guarda.
    const n7 = await numero();
    await campo.fill(coma(Math.round(((await ultimo()) + 0.5) * 10) / 10));
    await campo.press('Enter');
    await expect(avance).toHaveText(`5 de ${total} pesados`);
    r.enterGuarda = (await pesoEnJornada(n7)).length === 1;

    // 8) Retomar el saltado desde la lista de pendientes.
    await page.getByRole('button', { name: `Pesar ${saltado} (saltado)` }).tap();
    r.retomaSaltado = (await numero()) === saltado;
    await campo.fill(coma(await ultimo()));
    await guardar.tap();
    await expect(avance).toHaveText(`6 de ${total} pesados`);

    // 9) Cerrar con pendientes.
    await page.getByRole('button', { name: 'Cerrar jornada' }).first().tap();
    const cierre = page.getByRole('dialog', { name: 'Cerrar jornada' });
    await expect(cierre).toContainText(`Quedan ${total - 6} animales sin pesar`);
    await cierre.getByLabel('Notas (opcional)').fill(`${PREFIJO} corral`);
    await page.screenshot({ path: `${DIR}/05-cerrar.png` });
    await cierre.getByRole('button', { name: 'Cerrar jornada' }).tap();
    await expect(page.getByText(/, cerrada$/)).toBeVisible();
    r.trasCerrar = {
      capturaVisible: await campo.isVisible(),
      pendientesDeshabilitados: await page.getByRole('button', { name: /^Pesar / }).first().isDisabled(),
    };
    const { data: j } = await supabase.from('jornadas_pesaje').select('estado, notas, fecha, pesajes(peso_kg)').eq('id', jornadaId).single();
    const promedio = Math.round((j.pesajes.reduce((s, p) => s + Number(p.peso_kg), 0) / j.pesajes.length) * 10) / 10;
    r.bd = { estado: j.estado, notas: j.notas, fecha: j.fecha, pesados: j.pesajes.length, promedio };

    // 10) Historial (R8).
    await page.goto('/#/pesaje');
    await page.getByLabel('Lote').selectOption(loteId);
    const fila = page.getByRole('link', { name: /6 pesados/ });
    await expect(fila).toBeVisible();
    r.historial = await fila.innerText();
    await page.screenshot({ path: `${DIR}/06-historial.png` });

    registrar('corral', r);
    registrar('consola y red', errores);
    expect(r.autoFocusAlAbrir).toBe(true);
    expect(Object.values(validaciones).every((v) => v.includes('entre 0,1 y 1.499'))).toBe(true);
    expect(r.guardado1.bd).toEqual([{ peso_kg: p1, fecha: j.fecha }]);
    expect(r.siguienteVacio && r.siguienteDistinto).toBe(true);
    expect(r.segundoToque.filasBD).toBe(1);
    expect(r.sinRed.valorConservado).toBe(coma(p6));
    expect(r.retomaSaltado).toBe(true);
    expect(r.historial).toContain(`promedio ${coma(promedio)} kg`);
    expect(r.historial).toContain('Cerrada');
  });
});

test('VRF 004 BD: una jornada abierta por lote, un pesaje por animal y jornada, RLS y jornadas cerradas', async () => {
  const supabase = await clientePrueba();
  const loteA = await idLote(supabase, 'LOTE-2026-A');
  const loteCria = await idLote(supabase, LOTE_CORRAL);
  const { data: animalA } = await supabase.from('animales').select('id').eq('lote_id', loteA).eq('estado', 'activo').limit(1).single();
  const { data: animalCria } = await supabase.from('animales').select('id').eq('lote_id', loteCria).eq('estado', 'activo').limit(1).single();
  const r = {};

  const j1 = await supabase.from('jornadas_pesaje').insert({ lote_id: loteA, fecha: hoyBogota() }).select('id').single();
  r.primeraAbierta = j1.error?.code ?? 'ok';
  const j2 = await supabase.from('jornadas_pesaje').insert({ lote_id: loteA, fecha: haceDias(1) }).select('id').single();
  r.segundaAbiertaMismoLote = j2.error?.code ?? 'ACEPTADA';

  const anon = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const aSel = await anon.from('jornadas_pesaje').select('id');
  const aIns = await anon.from('jornadas_pesaje').insert({ lote_id: loteA, fecha: hoyBogota() });
  r.anon = { select: aSel.error?.code ?? `devolvió ${aSel.data?.length} filas`, insert: aIns.error?.code ?? 'ACEPTADO' };

  const p1 = await supabase.from('pesajes').insert({ animal_id: animalA.id, fecha: hoyBogota(), peso_kg: 250, jornada_id: j1.data.id });
  const p2 = await supabase.from('pesajes').insert({ animal_id: animalA.id, fecha: hoyBogota(), peso_kg: 251, jornada_id: j1.data.id });
  r.pesajeRepetido = [p1.error?.code ?? 'ok', p2.error?.code ?? 'ACEPTADO'];
  const otroLote = await supabase.from('pesajes').insert({ animal_id: animalCria.id, fecha: hoyBogota(), peso_kg: 170, jornada_id: j1.data.id });
  r.pesajeDeAnimalDeOtroLote = otroLote.error?.code ?? 'ACEPTADO';
  const otraFecha = await supabase.from('pesajes').insert({ animal_id: (await supabase.from('animales').select('id').eq('lote_id', loteA).neq('id', animalA.id).limit(1).single()).data.id, fecha: haceDias(20), peso_kg: 240, jornada_id: j1.data.id }).select('id').single();
  r.pesajeConFechaDistintaALaJornada = otraFecha.error?.code ?? 'ACEPTADO';

  const cerrar = await supabase.from('jornadas_pesaje').update({ estado: 'cerrada', cerrada_at: new Date().toISOString() }).eq('id', j1.data.id).select('id');
  r.cerrar = cerrar.error?.code ?? 'ok';
  const { data: tercero } = await supabase.from('animales').select('id').eq('lote_id', loteA).order('numero_interno', { ascending: false }).limit(1).single();
  const enCerrada = await supabase.from('pesajes').insert({ animal_id: tercero.id, fecha: hoyBogota(), peso_kg: 245, jornada_id: j1.data.id });
  r.pesajeEnJornadaCerrada = enCerrada.error?.code ?? 'ACEPTADO';
  const j3 = await supabase.from('jornadas_pesaje').insert({ lote_id: loteA, fecha: hoyBogota() }).select('id').single();
  const reabrir = await supabase.from('jornadas_pesaje').update({ estado: 'abierta' }).eq('id', j1.data.id).select('id');
  r.reabrirConOtraAbierta = reabrir.error?.code ?? 'ACEPTADO';
  // Ronda 2: ¿se puede cambiar el peso de un pesaje de la jornada ya cerrada?
  const { data: p1fila } = await supabase.from('pesajes').select('id').eq('jornada_id', j1.data.id).eq('animal_id', animalA.id).single();
  const editar = await supabase.from('pesajes').update({ peso_kg: 999 }).eq('id', p1fila.id).select('id');
  r.editarPesoEnJornadaCerrada = editar.error?.code ?? (editar.data?.length ? 'ACEPTADO' : 'sin filas');
  await supabase.from('pesajes').update({ peso_kg: 250 }).eq('id', p1fila.id);
  const futura = await supabase.from('jornadas_pesaje').update({ fecha: '2099-01-01' }).eq('id', j3.data.id).select('id');
  r.fechaFuturaAlEditar = futura.error?.code ?? 'ACEPTADO';
  const estadoRaro = await supabase.from('jornadas_pesaje').update({ estado: 'pausada' }).eq('id', j3.data.id).select('id');
  r.estadoInvalido = estadoRaro.error?.code ?? 'ACEPTADO';

  // Borrar la jornada: ¿qué pasa con sus pesajes?
  await supabase.from('jornadas_pesaje').delete().eq('id', j1.data.id);
  const { data: huerfanos } = await supabase.from('pesajes').select('id, jornada_id').eq('animal_id', animalA.id).eq('peso_kg', 250);
  r.pesajesTrasBorrarJornada = huerfanos;
  for (const h of huerfanos ?? []) await supabase.from('pesajes').delete().eq('id', h.id);
  await supabase.from('pesajes').delete().eq('animal_id', animalCria.id).eq('peso_kg', 170);
  if (otraFecha.data) await supabase.from('pesajes').delete().eq('id', otraFecha.data.id);
  await supabase.from('pesajes').delete().eq('animal_id', tercero.id).eq('peso_kg', 245);
  if (j3.data) await supabase.from('jornadas_pesaje').delete().eq('id', j3.data.id);

  registrar('integridad BD', r);
  expect(r.segundaAbiertaMismoLote).toBe('23505');
  expect(r.anon.select).toBe('42501');
  expect(r.anon.insert).toBe('42501');
  expect(r.pesajeRepetido).toEqual(['ok', '23505']);
  expect(r.reabrirConOtraAbierta).toBe('23505');
  expect(r.fechaFuturaAlEditar).toBe('23514');
  expect(r.estadoInvalido).toBe('23514');
  // Ronda 2 (migración 1100): la BD ata el pesaje a su jornada.
  expect(r.pesajeDeAnimalDeOtroLote).toBe('23514');
  expect(r.pesajeConFechaDistintaALaJornada).toBe('23514');
  expect(r.pesajeEnJornadaCerrada).toBe('23514');
  if (r.editarPesoEnJornadaCerrada === 'ACEPTADO') registrar('HALLAZGO 004 BD (ronda 2)', 'se puede cambiar el peso de un pesaje de una jornada cerrada');
});

test('VRF 004 R1: dos teléfonos abren la jornada del mismo lote a la vez → ambos quedan en la misma', async ({ browser }) => {
  const supabase = await clientePrueba();
  const loteA = await idLote(supabase, 'LOTE-2026-A');
  const c1 = await browser.newContext();
  const c2 = await browser.newContext();
  const [a, b] = [await c1.newPage(), await c2.newPage()];
  await iniciarSesion(a);
  await iniciarSesion(b);
  for (const p of [a, b]) {
    await p.goto('/#/pesaje');
    await p.getByLabel('Lote').selectOption(loteA);
    await expect(p.getByText('Todavía no hay jornadas')).toBeVisible(); // la lista ya cargó
    await expect(p.getByRole('button', { name: 'Abrir jornada' })).toBeVisible();
  }
  // B se queda con la pantalla vieja (sin jornada abierta): se congela su consulta de jornadas.
  const listaDeJornadas = (url) => url.pathname.endsWith('/rest/v1/jornadas_pesaje') && url.search.includes('order=');
  await b.route(listaDeJornadas, (route) => (route.request().method() === 'GET' ? route.fulfill({ json: [] }) : route.continue()));
  await a.getByRole('button', { name: 'Abrir jornada' }).click();
  await expect(a).toHaveURL(/#\/pesaje\/[0-9a-f-]{36}$/);
  await b.getByRole('button', { name: 'Abrir jornada' }).click(); // el INSERT de B choca con la abierta (23505) y la retoma
  await b.unrouteAll();
  await expect(b).toHaveURL(/#\/pesaje\/[0-9a-f-]{36}$/);
  const ids = [a.url().split('/').pop(), b.url().split('/').pop()];
  registrar('dos teléfonos', { ids, misma: ids[0] === ids[1] });
  const { count } = await supabase.from('jornadas_pesaje').select('id', { count: 'exact', head: true }).eq('lote_id', loteA).eq('estado', 'abierta');
  await supabase.from('jornadas_pesaje').delete().eq('id', ids[0]);
  await c1.close();
  await c2.close();
  expect(ids[0]).toBe(ids[1]);
  expect(count).toBe(1);
});

test('VRF 004 R5/R7 (ronda 2): regla de 14 días + caída > 8 kg; casos de la ronda 1, bordes y R3 en la ficha', async ({ page }) => {
  test.setTimeout(150_000);
  const supabase = await clientePrueba();
  // Ronda 2: antes de crear nada, el panel no debe marcar reses de la semilla (falsas alarmas).
  await iniciarSesion(page);
  await page.goto('/#/');
  const panelSemilla = await page.locator('section', { hasText: 'Pierden peso' }).innerText();
  const { data: lote } = await supabase.from('lotes').insert({ codigo: `${PREFIJO}-LOTE`, nombre: `${PREFIJO} lote`, tipo: 'ceba', peso_meta_kg: 400 }).select('id').single();
  const crear = async (sufijo, pesos) => {
    const numero = `${PREFIJO}-${sufijo}`;
    const [primero, ...resto] = pesos;
    const { data: id, error } = await supabase.rpc('registrar_animal', {
      datos: { numero_interno: numero, chapeta_ica: `${numero}-CH`, sexo: 'Macho', categoria: 'novillo', origen: 'compra', fecha_ingreso: primero[0], peso_ingreso_kg: primero[1], peso_objetivo_kg: 400, lote_id: lote.id },
    });
    if (error) throw error;
    for (const [fecha, peso] of resto) {
      const { error: e } = await supabase.from('pesajes').insert({ animal_id: id, fecha, peso_kg: peso });
      if (e) throw e;
    }
    return { id, numero };
  };
  const casos = {
    // Criterio de aceptación: 300 → 290 con un mes de diferencia.
    A: await crear('A', [[haceDias(30), 300], [hoyBogota(), 290]]),
    // Casos de la ronda 1 que la regla de 14 días dejaba sin alerta:
    B: await crear('B', [[haceDias(7), 300], [hoyBogota(), 290]]), // −10 kg en 7 días (recién comprado)
    C: await crear('C', [[haceDias(40), 300], [haceDias(12), 330], [hoyBogota(), 310]]), // −20 kg en 12 días (visita al tenedor)
    D: await crear('D', [[haceDias(70), 280], [haceDias(40), 305], [haceDias(10), 330], [hoyBogota(), 315]]), // −15 kg en 10 días
    // Ronda 2, bordes de la regla nueva:
    // E: pérdida sostenida de 16 kg en 13 días, en dos caídas de 8 kg (jornada + dos visitas seguidas).
    E: await crear('E', [[haceDias(60), 300], [haceDias(13), 340], [haceDias(6), 332], [hoyBogota(), 324]]),
    // F: exactamente 8 kg en 7 días (−1,14 kg/día en todo el ciclo).
    F: await crear('F', [[haceDias(7), 300], [hoyBogota(), 292]]),
    // G: 8,1 kg en 3 días (apenas sobre el umbral).
    G: await crear('G', [[haceDias(40), 300], [haceDias(3), 330], [hoyBogota(), 321.9]]),
  };

  const r = { panelSemilla: panelSemilla.replace(/\s+/g, ' ') };
  await page.reload(); // el hato quedó en caché antes de crear los animales de prueba
  for (const [k, { id, numero }] of Object.entries(casos)) {
    await page.goto(`/#/animales/${id}`);
    await expect(page.getByRole('heading', { name: `Animal N° ${numero}` })).toBeVisible();
    const stat = async (label) => (await page.getByText(label).locator('..').innerText()).replace(/\s+/g, ' ');
    r[k] = {
      alertaFicha: (await page.getByText('Pierde peso').count()) > 0,
      total: await stat('Ganancia diaria (todo el ciclo)'),
      reciente: await stat('Ganancia diaria (último periodo)'),
    };
    await page.screenshot({ path: `${DIR}/r2-gdp-${k}.png` });
  }
  await page.goto('/#/animales');
  await page.getByPlaceholder(/Buscar por número interno/).fill(`${PREFIJO}-`);
  r.hato = {};
  for (const k of Object.keys(casos)) {
    const fila = page.getByRole('row', { name: new RegExp(`${PREFIJO}-${k}\\b`) });
    r.hato[k] = await fila.locator('[aria-label="Pierde peso"]').count();
  }
  await page.goto('/#/');
  const panel = page.locator('section', { hasText: 'Pierden peso' });
  r.panel = (await panel.innerText()).replace(/\s+/g, ' ');

  // R3 en "Registrar peso" de la ficha (corregido): +55 % pide confirmación; "Guardar igual" guarda una vez.
  await page.goto(`/#/animales/${casos.A.id}`);
  await page.getByRole('button', { name: 'Registrar peso' }).click();
  const d = page.getByRole('dialog', { name: 'Registrar peso' });
  await d.getByLabel('Peso (kg)').fill('450');
  await d.getByRole('button', { name: 'Guardar' }).click();
  await page.waitForTimeout(1200);
  const cuenta450 = async () => (await supabase.from('pesajes').select('id').eq('animal_id', casos.A.id).eq('peso_kg', 450)).data.length;
  r.fichaMas55 = {
    aviso: (await d.getByRole('alert').count()) ? (await d.getByRole('alert').first().innerText()).replace(/\s+/g, ' ') : null,
    boton: await d.getByRole('button', { name: /Guardar/ }).last().innerText(),
    guardadoSinConfirmar: await cuenta450(),
  };
  await page.screenshot({ path: `${DIR}/r2-ficha-r3.png` });
  // Cambiar el número quita el aviso; volver a 450 lo pide otra vez.
  await d.getByLabel('Peso (kg)').fill('291');
  r.fichaMas55.avisoTrasCorregir = await d.getByRole('alert').count();
  await d.getByLabel('Peso (kg)').fill('450');
  await d.getByRole('button', { name: 'Guardar' }).click();
  await d.getByRole('button', { name: 'Guardar igual' }).dblclick();
  await expect(d).toHaveCount(0);
  r.fichaMas55.guardadoTrasConfirmar = await cuenta450();

  registrar('GDP y alertas (ronda 2)', r);
  expect(r.panelSemilla, 'la semilla no debe tener falsas alarmas').toMatch(/Ningún animal activo perdió peso/);
  expect(r.A.alertaFicha).toBe(true);
  for (const k of ['A', 'B', 'C', 'D', 'G']) {
    expect.soft(r[k].alertaFicha, `${k}: alerta en la ficha`).toBe(true);
    expect.soft(r.hato[k], `${k}: alerta en el hato`).toBe(1);
    expect.soft(r.panel, `${k}: alerta en el panel`).toContain(`${PREFIJO}-${k}`);
  }
  expect(r.fichaMas55.guardadoSinConfirmar).toBe(0);
  expect(r.fichaMas55.aviso).toMatch(/Guardar igual/);
  expect(r.fichaMas55.guardadoTrasConfirmar).toBe(1);
  // Hallazgos de la ronda 2 (bordes que la regla deja pasar): anotaciones, no fallas.
  if (!r.E.alertaFicha) registrar('HALLAZGO 004 R7 (ronda 2)', 'E: −16 kg en 13 días en dos caídas de 8 kg no marca pérdida');
  if (!r.F.alertaFicha) registrar('HALLAZGO 004 R7 borde', `F: −8 kg en 7 días no marca pérdida y la ficha muestra ${r.F.total}`);
});
