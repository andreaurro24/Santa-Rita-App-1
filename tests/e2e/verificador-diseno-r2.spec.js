import { mkdirSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';
import { clientePrueba, entrar, iniciarSesion } from './helpers';
import { medirContraste, medirControles, medirDesborde } from './verificador-medidas';

// Pruebas del VERIFICADOR para la spec 002, ronda 2 (2026-09-28):
// - regresiones del hook useDialogo (foco, Escape, Tab, scroll del fondo) en las hojas nuevas;
// - R3/R5/R6/R9 en las pantallas del Sprint 1 (Pesaje, Lotes, Fincas, Ubicación en la ficha);
// - el nuevo instrumento de sesión (helpers.js) y el cierre de sesión local.
// Crea una jornada abierta en el lote CRIA y la borra al terminar. Capturas en test-results/vrf-r2/.

const DIR = 'test-results/vrf-r2';
mkdirSync(DIR, { recursive: true });
const LOTE_JORNADA = 'CRIA-2025-2026';
const CLAVE = `sb-${new URL(process.env.VITE_SUPABASE_URL).hostname.split('.')[0]}-auth-token`;

function registrar(nombre, datos) {
  console.log(`${nombre}: ${JSON.stringify(datos)}`);
  test.info().annotations.push({ type: nombre, description: JSON.stringify(datos) });
}

async function idLote(supabase, codigo) {
  const { data } = await supabase.from('lotes').select('id').eq('codigo', codigo).single();
  return data.id;
}

async function limpiarJornadas() {
  const supabase = await clientePrueba();
  const lote = await idLote(supabase, LOTE_JORNADA);
  const { data } = await supabase.from('jornadas_pesaje').select('id').eq('lote_id', lote);
  for (const j of data ?? []) {
    await supabase.from('pesajes').delete().eq('jornada_id', j.id);
    await supabase.from('jornadas_pesaje').delete().eq('id', j.id);
  }
}

// Rectángulo de un elemento y si queda dentro de la pantalla y por encima de la navegación inferior.
async function aLaVista(locator) {
  return locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const nav = document.querySelector('nav[aria-label="Principal"]');
    const navArriba = nav && nav.checkVisibility() ? nav.getBoundingClientRect().top : innerHeight;
    // ¿Lo tapa algo en su centro? (la navegación fija, un velo…)
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const arriba = document.elementFromPoint(cx, cy);
    return {
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      dentro: r.top >= 0 && r.bottom <= innerHeight,
      sobreNav: r.bottom <= navArriba + 0.5,
      tapado: !(arriba === el || el.contains(arriba)),
    };
  });
}

async function hoja(dialogo) {
  return dialogo.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), ancho: Math.round(r.width), arriba: Math.round(r.top), abajo: Math.round(r.bottom) };
  });
}

async function medirTodo(page, nombre) {
  const pequenos = (await page.evaluate(medirControles)).filter(
    // Una casilla dentro de una etiqueta de ≥ 48 px: el área táctil es la etiqueta.
    (c) => !(c.tag === 'input' && c.texto.startsWith('Seleccionar')),
  );
  const desborde = await page.evaluate(medirDesborde);
  const { fallan } = await page.evaluate(medirContraste);
  registrar(`movil ${nombre}`, { pequenos, scrollWidth: desborde.scrollWidth, fuera: desborde.fuera, textoFuera: desborde.textoFuera, contraste: fallan });
  await page.screenshot({ path: `${DIR}/movil-${nombre}.png` });
  return { pequenos, desborde, fallan };
}

test.beforeAll(limpiarJornadas);
test.afterAll(limpiarJornadas);

test.describe('celular 375×812', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

  test('VRF 002-r2 R3/R5/R6: pantallas del Sprint 1 sin desborde, con áreas de 48 px y contraste AA', async ({ page }) => {
    test.setTimeout(120_000);
    const supabase = await clientePrueba();
    const errores = [];
    page.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
    page.on('response', (r) => r.status() >= 400 && errores.push(`${r.status()} ${r.url()}`));
    await iniciarSesion(page);
    const problemas = {};
    const anotar = (nombre, m) => {
      if (m.pequenos.length || m.desborde.scrollWidth > 375 || m.desborde.textoFuera.length || m.fallan.length) problemas[nombre] = m;
    };

    await page.goto('/#/pesaje');
    await expect(page.getByRole('heading', { name: 'Jornada de pesaje' })).toBeVisible();
    await expect(page.getByText(/Todavía no hay jornadas|pesados/).first()).toBeVisible();
    anotar('pesaje-inicio', await medirTodo(page, 'pesaje-inicio'));

    await page.getByLabel('Lote').selectOption(await idLote(supabase, LOTE_JORNADA));
    await page.getByRole('button', { name: 'Abrir jornada' }).click();
    await expect(page.getByTestId('avance')).toBeVisible();
    anotar('pesaje-captura', await medirTodo(page, 'pesaje-captura'));

    await page.getByRole('button', { name: 'Cerrar jornada' }).first().click();
    await expect(page.getByRole('dialog', { name: 'Cerrar jornada' })).toBeVisible();
    anotar('pesaje-cerrar', await medirTodo(page, 'pesaje-cerrar'));
    await page.getByRole('button', { name: 'Seguir pesando' }).click();

    await page.goto('/#/lotes');
    await expect(page.getByText(/Llega a la meta/).first()).toBeVisible();
    anotar('lotes', await medirTodo(page, 'lotes'));
    await page.getByRole('button', { name: 'Nuevo lote' }).click();
    anotar('lotes-form', await medirTodo(page, 'lotes-form'));
    await page.keyboard.press('Escape');

    await page.goto(`/#/lotes/${await idLote(supabase, 'LOTE-2026-A')}`);
    await expect(page.getByRole('heading', { name: /Lote 2026-A/ })).toBeVisible();
    anotar('lote-detalle', await medirTodo(page, 'lote-detalle'));
    await page.getByRole('checkbox').nth(0).check();
    await page.getByRole('checkbox').nth(1).check();
    await page.getByRole('button', { name: /Mover seleccionados/ }).click();
    anotar('lote-mover', await medirTodo(page, 'lote-mover'));
    await page.keyboard.press('Escape');

    await page.goto('/#/lotes');
    await page.getByRole('link', { name: /Lote 2025-B/ }).click();
    await expect(page.getByRole('button', { name: 'Marcar como listo' })).toBeVisible();
    anotar('lote-listo', await medirTodo(page, 'lote-listo'));

    await page.goto('/#/fincas');
    await expect(page.getByRole('heading', { name: 'Fincas y potreros' })).toBeVisible();
    await expect(page.getByRole('article').first()).toBeVisible();
    anotar('fincas', await medirTodo(page, 'fincas'));

    // Ficha con la tarjeta de Ubicación (0101)
    await page.goto('/#/animales');
    await page.getByPlaceholder(/Buscar por número interno/).fill('0101');
    await page.getByRole('link', { name: /^0101/ }).first().click();
    await expect(page.getByRole('heading', { name: 'Ubicación' })).toBeVisible();
    await expect(page.getByText(/Sin movimientos registrados|Movimientos/).first()).toBeVisible();
    anotar('ficha-ubicacion', await medirTodo(page, 'ficha-ubicacion'));
    await page.getByRole('button', { name: 'Mover' }).click();
    anotar('ficha-mover', await medirTodo(page, 'ficha-mover'));
    await page.keyboard.press('Escape');

    // Hoja "Más" con las 2 secciones nuevas
    await page.getByRole('button', { name: 'Más' }).click();
    const mas = page.getByRole('dialog', { name: 'Más secciones' });
    await expect(mas.getByRole('link', { name: 'Lotes y ciclos' })).toBeVisible();
    await expect(mas.getByRole('link', { name: 'Fincas y potreros' })).toBeVisible();
    anotar('hoja-mas', await medirTodo(page, 'hoja-mas'));

    registrar('problemas', problemas);
    registrar('consola y red', errores);
    expect.soft(errores, 'errores de consola o HTTP ≥ 400').toEqual([]);
    expect(problemas, 'pantallas con controles < 48 px, desborde o contraste < AA').toEqual({});
  });

  test('VRF 002-r2 R9: formularios nuevos en celular (lote, mover, cerrar jornada, potrero)', async ({ page }) => {
    const supabase = await clientePrueba();
    await iniciarSesion(page);
    const r = {};

    await page.goto('/#/lotes');
    await page.getByRole('button', { name: 'Nuevo lote' }).click();
    let d = page.getByRole('dialog', { name: 'Nuevo lote' });
    r['nuevo lote'] = { ...(await hoja(d)), guardar: await aLaVista(d.getByRole('button', { name: 'Guardar' })) };
    await page.keyboard.press('Escape');

    await page.goto(`/#/lotes/${await idLote(supabase, 'LOTE-2026-A')}`);
    await page.getByRole('checkbox').nth(0).check();
    await page.getByRole('button', { name: /Mover seleccionados/ }).click();
    d = page.getByRole('dialog', { name: /^Mover/ });
    r['mover'] = { ...(await hoja(d)), guardar: await aLaVista(d.getByRole('button', { name: 'Mover' })) };
    await page.keyboard.press('Escape');

    await page.goto('/#/pesaje');
    await page.getByLabel('Lote').selectOption(await idLote(supabase, LOTE_JORNADA));
    const abrir = page.getByRole('button', { name: /Abrir jornada|Continuar la jornada/ });
    await abrir.click();
    await expect(page.getByTestId('avance')).toBeVisible();
    r['captura (Guardar peso)'] = await aLaVista(page.getByRole('button', { name: 'Guardar peso' }));
    r['captura (Saltar)'] = await aLaVista(page.getByRole('button', { name: 'Saltar' }));
    await page.getByRole('button', { name: 'Cerrar jornada' }).first().click();
    d = page.getByRole('dialog', { name: 'Cerrar jornada' });
    r['cerrar jornada'] = { ...(await hoja(d)), guardar: await aLaVista(d.getByRole('button', { name: 'Cerrar jornada' })) };
    await page.keyboard.press('Escape');

    await page.goto('/#/fincas');
    // La última finca de la lista: el formulario se abre donde esté la tarjeta.
    const ultima = page.getByRole('article').last();
    await ultima.getByRole('button', { name: 'Agregar potrero' }).scrollIntoViewIfNeeded();
    await ultima.getByRole('button', { name: 'Agregar potrero' }).click();
    // Premisa corregida en la 006 (verificación 004 ronda 2): el potrero ahora es una hoja inferior.
    d = page.getByRole('dialog', { name: /^Nuevo potrero en / });
    const dialogoPotrero = await d.count();
    r['potrero (última finca)'] = { esDialogo: dialogoPotrero > 0, ...(dialogoPotrero ? await hoja(d) : {}), guardar: await aLaVista(page.getByRole('button', { name: 'Guardar potrero' })) };
    await page.screenshot({ path: `${DIR}/movil-potrero-form.png` });
    await page.keyboard.press('Escape');
    await expect(d).toHaveCount(0);
    const primera = page.getByRole('article').first();
    await page.evaluate(() => scrollTo(0, 0));
    await primera.getByRole('button', { name: 'Agregar potrero' }).click();
    r['potrero (primera finca)'] = { guardar: await aLaVista(page.getByRole('button', { name: 'Guardar potrero' })) };

    registrar('R9 formularios Sprint 1', r);
    // Hallazgo Medio de la spec 006 (no de la 002): el formulario de potrero es en línea, no una hoja
    // inferior, aunque Guardar queda a la vista. Se deja como anotación, no como falla.
    if (!r['potrero (última finca)'].esDialogo) registrar('HALLAZGO 006 R9 potrero', 'formulario en línea, no hoja inferior');
    expect(r['potrero (última finca)'].guardar.dentro && !r['potrero (última finca)'].guardar.tapado).toBe(true);
    expect(r['potrero (última finca)'].esDialogo).toBe(true);
    for (const k of ['nuevo lote', 'mover', 'cerrar jornada', 'potrero (última finca)']) {
      expect(r[k].x).toBe(0);
      expect(r[k].ancho).toBe(375);
      expect(r[k].abajo).toBe(812);
      expect(r[k].guardar.dentro && !r[k].guardar.tapado).toBe(true);
    }
    expect(r['captura (Guardar peso)'].dentro && r['captura (Guardar peso)'].sobreNav && !r['captura (Guardar peso)'].tapado).toBe(true);
  });

  test('VRF 002-r2 useDialogo: foco, Tab, Escape y scroll del fondo en las hojas nuevas', async ({ page }) => {
    const supabase = await clientePrueba();
    await iniciarSesion(page);
    const r = {};
    const activo = () => page.evaluate(() => {
      const el = document.activeElement;
      return el ? (el.getAttribute('aria-label') || el.innerText || el.tagName).trim().slice(0, 40) : null;
    });
    const dentroDe = (nombre) => page.evaluate((n) => Boolean(document.activeElement?.closest(`[role=dialog][aria-label="${n}"], [role=dialog]`)), nombre);

    // 1) Mover desde el detalle del lote: foco inicial, Tab atrapado, Escape y regreso del foco.
    await page.goto(`/#/lotes/${await idLote(supabase, 'LOTE-2026-A')}`);
    await page.getByRole('checkbox').nth(0).check();
    const boton = page.getByRole('button', { name: /Mover seleccionados/ });
    await boton.click();
    const mover = page.getByRole('dialog', { name: /^Mover/ });
    await expect(mover).toBeVisible();
    r.moverFocoInicial = await activo();
    r.bodyOverflowAbierto = await page.evaluate(() => document.body.style.overflow);
    let salio = false;
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Tab');
      if (!(await dentroDe())) salio = true;
    }
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Shift+Tab');
      if (!(await dentroDe())) salio = true;
    }
    r.moverTabSaleDelDialogo = salio;
    await page.keyboard.press('Escape');
    await expect(mover).toHaveCount(0);
    r.moverFocoVuelve = await activo();
    r.bodyOverflowCerrado = await page.evaluate(() => document.body.style.overflow);

    // 2) Escape dentro de un campo con texto: cierra (se pierde lo escrito), igual que antes.
    await boton.click();
    await mover.getByLabel('Motivo').fill('texto que se pierde');
    await page.keyboard.press('Escape');
    r.escapeEnCampoCierra = (await mover.count()) === 0;

    // 3) Mover con éxito: ¿a dónde va el foco? (el botón que abrió queda deshabilitado)
    //    Se mueve 1 animal a su MISMO lote (no cambia nada) y se borra el movimiento al final.
    await boton.click();
    await mover.getByLabel('Lote de destino').selectOption(await idLote(supabase, 'LOTE-2026-A'));
    await mover.getByLabel('Motivo').fill('VRF-R2 foco tras mover');
    await mover.getByRole('button', { name: 'Mover' }).click();
    await expect(mover).toHaveCount(0);
    r.focoTrasMoverConExito = await activo();
    r.botonMoverDeshabilitado = await boton.isDisabled();
    await supabase.from('movimientos').delete().eq('motivo', 'VRF-R2 foco tras mover');

    // 4) Pesaje: el aviso de variación (>15 %) sobre un campo con autoFocus.
    await page.goto('/#/pesaje');
    await page.getByLabel('Lote').selectOption(await idLote(supabase, LOTE_JORNADA));
    await page.getByRole('button', { name: /Abrir jornada|Continuar la jornada/ }).click();
    const campo = page.getByLabel(/^Peso de .+ \(kg\)$/);
    await expect(campo).toBeFocused();
    r.capturaAutoFocus = true;
    await campo.fill('999');
    await page.keyboard.press('Enter');
    const aviso = page.getByRole('dialog', { name: '¿El peso es correcto?' });
    await expect(aviso).toBeVisible();
    r.avisoFocoInicial = await activo();
    await page.keyboard.press('Escape');
    await expect(aviso).toHaveCount(0);
    r.avisoEscapeFocoEnCampo = await campo.evaluate((el) => el === document.activeElement);
    r.avisoEscapeConservaValor = await campo.inputValue();
    // Enter dos veces seguidas (el teclado del celular): el segundo no debe guardar sin querer.
    await campo.press('Enter');
    await expect(aviso).toBeVisible();
    await page.keyboard.press('Enter'); // el foco está en el primer botón del pie
    await page.waitForTimeout(500);
    r.enterEnAvisoActiva = await activo();
    r.avisoSigueAbiertoTrasEnter = (await aviso.count()) > 0;
    const { count: guardados } = await supabase.from('pesajes').select('id', { count: 'exact', head: true }).eq('peso_kg', 999);
    r.pesoGuardadoSinConfirmar = guardados;

    // 5) Hoja "Más": Escape y foco de vuelta, luego un Modal: un Escape cierra solo uno.
    await page.goto('/#/');
    const masBtn = page.getByRole('button', { name: 'Más' });
    await masBtn.click();
    await expect(page.getByRole('dialog', { name: 'Más secciones' })).toBeVisible();
    r.masFocoInicial = await activo();
    await page.keyboard.press('Escape');
    r.masFocoVuelve = await activo();

    registrar('useDialogo', r);
    expect(r.moverTabSaleDelDialogo).toBe(false);
    expect(r.moverFocoVuelve).toMatch(/Mover seleccionados/);
    expect(r.bodyOverflowAbierto).toBe('hidden');
    expect(r.bodyOverflowCerrado).toBe('');
    expect(r.avisoEscapeFocoEnCampo).toBe(true);
    expect(r.avisoEscapeConservaValor).toBe('999');
    expect(r.pesoGuardadoSinConfirmar).toBe(0);
    expect(r.masFocoVuelve).toBe('Más');
  });
});

test('VRF 002-r2 sesión: login real por formulario → recargar → sigue dentro; cerrar sesión local no saca a otro dispositivo y revoca la sesión cerrada', async ({ browser }) => {
  // Dos "dispositivos" (contextos) con inicios de sesión reales por el formulario.
  const celular = await browser.newContext();
  const computador = await browser.newContext();
  const a = await celular.newPage();
  const b = await computador.newPage();
  await a.goto('/#/login');
  await entrar(a);
  await expect(a.getByRole('heading', { name: /^Hola/ })).toBeVisible();
  await a.reload();
  await expect(a.getByRole('heading', { name: /^Hola/ })).toBeVisible();
  const refreshA = await a.evaluate((k) => JSON.parse(localStorage.getItem(k)).refresh_token, CLAVE);

  await b.goto('/#/login');
  await entrar(b);
  await expect(b.getByRole('heading', { name: /^Hola/ })).toBeVisible();

  await a.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(a).toHaveURL(/#\/login/);
  // logout() navega antes de que termine signOut: se espera a que la sesión salga del almacenamiento.
  await expect.poll(() => a.evaluate((k) => localStorage.getItem(k), CLAVE), { timeout: 10_000 }).toBeNull();
  const tokenTrasSalir = await a.evaluate((k) => (localStorage.getItem(k) ? 'presente' : null), CLAVE);

  await b.reload();
  const computadorSigue = await expect(b.getByRole('heading', { name: /^Hola/ }))
    .toBeVisible({ timeout: 10_000 })
    .then(() => true, () => false);
  await b.goto('/#/animales');
  await expect(b.getByText(/reses registradas/)).toBeVisible();

  // ¿Se revocó en el servidor la sesión que se cerró? (el refresh token de A ya no debe servir)
  const suelto = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await suelto.auth.refreshSession({ refresh_token: refreshA });
  registrar('cierre local', { tokenTrasSalir, computadorSigue, refreshDeASirve: !error, errorRefresh: error?.message });
  expect(tokenTrasSalir).toBeNull();
  expect(computadorSigue).toBe(true);
  expect(error, 'la sesión cerrada en el celular sigue siendo renovable en el servidor').not.toBeNull();
  await celular.close();
  await computador.close();
});

test('VRF 002-r2 sesión: cerrar sesión SIN señal (falla /auth/v1/logout) ¿deja la sesión guardada en el celular?', async ({ page }) => {
  await iniciarSesion(page);
  await page.route('**/auth/v1/logout**', (route) => route.abort('internetdisconnected'));
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/#\/login/);
  await page.waitForTimeout(2000);
  const guardada = await page.evaluate((k) => Boolean(localStorage.getItem(k)), CLAVE);
  await page.unroute('**/auth/v1/logout**');
  await page.goto('/#/animales');
  await page.reload();
  const dentro = await page.getByText(/reses registradas/).isVisible({ timeout: 10_000 }).catch(() => false);
  registrar('cerrar sesión sin señal', { sesionSigueGuardada: guardada, alRecargarEntraSinContrasena: dentro });
  expect(dentro, 'tras "Cerrar sesión" sin señal, al recargar la app vuelve a entrar sin contraseña').toBe(false);
});

test('VRF 002-r2 0800: fechas anteriores al 2000 se rechazan en la BD y la app lo explica', async ({ page }) => {
  const supabase = await clientePrueba();
  const { data: a } = await supabase.from('animales').select('id, lote_id').eq('numero_interno', '0101').single();
  const pes = await supabase.from('pesajes').insert({ animal_id: a.id, fecha: '1999-12-31', peso_kg: 300 });
  const jor = await supabase.from('jornadas_pesaje').insert({ lote_id: a.lote_id, fecha: '1999-12-31' });
  const mov = await supabase.rpc('mover_animales', { ids: [a.id], fecha: '1999-12-31', motivo: 'VRF-R2 1999', lote_destino: a.lote_id });
  registrar('0800', { pesaje: pes.error?.code, jornada: jor.error?.code, movimiento: mov.error?.code });
  expect([pes.error?.code, jor.error?.code, mov.error?.code]).toEqual(['23514', '23514', '23514']);

  // En la ficha: pesaje con fecha 1999 → mensaje sobre el año.
  await iniciarSesion(page);
  await page.goto(`/#/animales/${a.id}`);
  await page.getByRole('button', { name: 'Registrar peso' }).click();
  const d = page.getByRole('dialog', { name: 'Registrar peso' });
  await d.getByLabel('Peso (kg)').fill('300');
  await d.getByLabel('Fecha').fill('1999-12-31');
  await d.getByRole('button', { name: 'Guardar' }).click();
  await expect(d.getByRole('alert')).toBeVisible();
  registrar('mensaje 1999', await d.getByRole('alert').innerText());
  await expect(d.getByRole('alert')).toContainText(/año|2000/);
});
