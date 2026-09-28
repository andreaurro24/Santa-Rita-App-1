import { expect, test } from '@playwright/test';
import { clientePrueba, entrar, iniciarSesion } from './helpers';

// Pruebas del VERIFICADOR para la spec 001 (criterios que las pruebas del implementador no cubren).
// Todo dato creado lleva el prefijo VRF-E2E y se borra en afterAll.

const PREFIJO = 'VRF-E2E';
const ANIMAL_PESO = '0103';
const PESO_DOBLE_CLIC = 377.7;
const FECHA_PRECIO = '2020-01-15';
const FUENTE_MANUAL = 'Registro manual (Fedegán/SIPSA)';
const DESC_SANIDAD = `${PREFIJO} vacuna de prueba`;
const STORAGE_KEY = 'sb-eiszvbwwpqcqognkcfew-auth-token';

async function abrirAnimal(page, numero) {
  await page.goto('/#/animales');
  await page.getByPlaceholder(/Buscar por número interno/).fill(numero);
  await page.getByRole('link', { name: numero, exact: true }).click();
  await expect(page.getByRole('heading', { name: `Animal N° ${numero}` })).toBeVisible();
}

async function abrirNuevoAnimal(page) {
  await page.goto('/#/animales');
  await page.getByRole('button', { name: 'Registrar animal' }).click();
  return page.getByRole('dialog');
}

async function llenarAnimal(dialogo, { numero, chapeta, ingreso = '200', objetivo = '350' }) {
  await dialogo.getByLabel(/Número interno/).fill(numero);
  await dialogo.getByLabel(/Chapeta ICA/).fill(chapeta);
  await dialogo.getByLabel(/Peso de ingreso/).fill(ingreso);
  await dialogo.getByLabel(/Peso objetivo/).fill(objetivo);
}

test.afterAll(async () => {
  const supabase = await clientePrueba();
  const { data: animales } = await supabase.from('animales').select('id').like('numero_interno', `${PREFIJO}%`);
  for (const a of animales ?? []) await supabase.from('animales').delete().eq('id', a.id); // pesajes/sanidad en cascada
  const { data: a103 } = await supabase.from('animales').select('id').eq('numero_interno', ANIMAL_PESO).single();
  await supabase.from('pesajes').delete().eq('animal_id', a103.id).eq('peso_kg', PESO_DOBLE_CLIC);
  await supabase.from('eventos_sanitarios').delete().eq('descripcion', DESC_SANIDAD);
  await supabase.from('precios_mercado').delete().eq('fecha', FECHA_PRECIO).eq('fuente', FUENTE_MANUAL);
});

test('VRF R2: una ruta profunda (#/animales/:id) vuelve a esa ficha tras entrar', async ({ page }) => {
  const supabase = await clientePrueba();
  const { data } = await supabase.from('animales').select('id').eq('numero_interno', '0101').single();
  await page.goto(`/#/animales/${data.id}`);
  await expect(page).toHaveURL(/#\/login$/);
  await entrar(page);
  await expect(page.getByRole('heading', { name: 'Animal N° 0101' })).toBeVisible();
});

test('VRF R3: sesión expirada (refresh inválido) vuelve a /login y vacía la caché', async ({ page }) => {
  test.setTimeout(120_000);
  const pedidosHato = [];
  page.on('request', (r) => {
    if (r.url().includes('/rest/v1/animales')) pedidosHato.push(Date.now());
  });
  await iniciarSesion(page);
  await page.goto('/#/animales');
  await expect(page.getByText('140 reses registradas', { exact: false })).toBeVisible();

  // Simula una sesión vencida cuyo refresh token ya no sirve (p. ej. revocado o caducado).
  await page.evaluate((key) => {
    const s = JSON.parse(localStorage.getItem(key));
    s.expires_at = Math.floor(Date.now() / 1000) - 60;
    s.refresh_token = 'refresh-token-invalido';
    localStorage.setItem(key, JSON.stringify(s));
  }, STORAGE_KEY);

  // Sin recargar: el refresco automático de supabase-js (cada 30 s) debe detectar la expiración.
  await expect(page).toHaveURL(/#\/login/, { timeout: 75_000 });

  // Entrar de nuevo antes de que venza staleTime (30 s): si la caché se vació, el hato se vuelve a pedir.
  const antes = pedidosHato.length;
  await entrar(page);
  // R2: vuelve a la ruta donde estaba (#/animales).
  await expect(page.getByRole('heading', { name: 'Trazabilidad del hato' })).toBeVisible();
  await expect.poll(() => pedidosHato.length, { timeout: 10_000 }).toBeGreaterThan(antes);
});

test('VRF R3: sesión expirada al recargar lleva a /login', async ({ page }) => {
  await iniciarSesion(page);
  await page.evaluate((key) => {
    const s = JSON.parse(localStorage.getItem(key));
    s.expires_at = Math.floor(Date.now() / 1000) - 60;
    s.refresh_token = 'refresh-token-invalido';
    localStorage.setItem(key, JSON.stringify(s));
  }, STORAGE_KEY);
  await page.goto('/#/animales');
  await page.reload();
  await expect(page).toHaveURL(/#\/login$/, { timeout: 15_000 });
});

test('VRF R7: sin red hacia la base de datos, el hato muestra error con qué hacer y Reintentar', async ({ page }) => {
  test.setTimeout(150_000);
  await iniciarSesion(page);
  await page.route('**/rest/v1/animales**', (route) => route.abort('internetdisconnected'));
  await page.goto('/#/reporte');
  await page.reload(); // recarga completa: la caché en memoria se pierde y el hato se vuelve a pedir
  const t0 = Date.now();
  await expect(page.getByRole('alert')).toContainText('No se pudieron cargar los datos', { timeout: 120_000 });
  console.log('R7 segundos hasta ver el error de red:', ((Date.now() - t0) / 1000).toFixed(1));
  // Criterio del verificador: en el campo, más de 15 s de spinner sin explicación es inaceptable.
  expect.soft(Date.now() - t0, 'segundos de spinner antes del mensaje de error').toBeLessThan(15_000);
  await expect(page.getByRole('alert')).toContainText('Revisa tu internet');
  await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible();
  await page.unroute('**/rest/v1/animales**');
  await page.getByRole('button', { name: 'Reintentar' }).click();
  await expect(page.getByRole('heading', { name: 'Reporte resumen de apoyo a la decisión' })).toBeVisible();
});

test('VRF R7: si falla la consulta del perfil, el mensaje no culpa a la cuenta', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/#/login');
  await page.route('**/rest/v1/perfiles**', (route) => route.abort('internetdisconnected'));
  await entrar(page);
  const t0 = Date.now();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'test-results/vrf-perfil-sin-red-3s.png' });
  console.log('R7 perfil: a los 3 s la pantalla muestra el formulario de login?', await page.getByRole('button', { name: 'Ingresar' }).isVisible());
  await expect(page.getByText('No hay conexión con el servidor', { exact: false })).toBeVisible({ timeout: 30_000 });
  console.log('R7 perfil: segundos hasta el mensaje:', ((Date.now() - t0) / 1000).toFixed(1));
  // El encabezado no debería decir que la cuenta no tiene acceso cuando el problema es la red.
  await expect(page.getByText('Tu cuenta no tiene acceso a los datos de la finca')).toHaveCount(0);
});

test('VRF pesaje: fecha futura y peso vacío se rechazan en el formulario', async ({ page }) => {
  await iniciarSesion(page);
  await abrirAnimal(page, ANIMAL_PESO);
  await page.getByRole('button', { name: 'Registrar peso' }).click();
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('alert')).toHaveText('El peso debe estar entre 0,1 y 1.499 kg.');
  await page.getByLabel('Peso (kg)').fill('300');
  await page.getByLabel('Fecha').fill('2099-01-01');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('alert')).toHaveText('La fecha del pesaje no puede ser futura.');
});

test('VRF pesaje: escribir "355,5" con coma decimal (teclado es-CO) se entiende como 355,5 kg', async ({ page }) => {
  await iniciarSesion(page);
  await abrirAnimal(page, ANIMAL_PESO);
  await page.getByRole('button', { name: 'Registrar peso' }).click();
  const campo = page.getByLabel('Peso (kg)');
  await campo.click();
  await campo.pressSequentially('355,5');
  const valor = await campo.inputValue();
  console.log('Valor del campo tras teclear "355,5":', JSON.stringify(valor));
  await page.getByRole('button', { name: 'Cancelar' }).click();
  expect(valor).toMatch(/^355[.,]5$/);
});

test('VRF pesaje: doble clic en Guardar crea un solo pesaje', async ({ page }) => {
  await iniciarSesion(page);
  await abrirAnimal(page, ANIMAL_PESO);
  await page.getByRole('button', { name: 'Registrar peso' }).click();
  await page.getByLabel('Peso (kg)').fill(String(PESO_DOBLE_CLIC));
  await page.getByRole('button', { name: 'Guardar' }).dblclick();
  await expect(page.getByText(`${PESO_DOBLE_CLIC} kg`, { exact: true })).toBeVisible();
  await page.waitForTimeout(1500);
  const supabase = await clientePrueba();
  const { data: a } = await supabase.from('animales').select('id').eq('numero_interno', ANIMAL_PESO).single();
  const { count } = await supabase
    .from('pesajes')
    .select('id', { count: 'exact', head: true })
    .eq('animal_id', a.id)
    .eq('peso_kg', PESO_DOBLE_CLIC);
  expect(count).toBe(1);
});

test('VRF animal: registro válido persiste tras recargar y en otra sesión', async ({ page, browser }) => {
  await iniciarSesion(page);
  const dialogo = await abrirNuevoAnimal(page);
  await llenarAnimal(dialogo, { numero: `${PREFIJO}-1`, chapeta: `${PREFIJO}-CH-1` });
  await dialogo.getByLabel(/Costo de compra/).fill('1500000');
  await dialogo.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('141 reses registradas', { exact: false })).toBeVisible();
  await page.reload();
  await page.getByPlaceholder(/Buscar por número interno/).fill(`${PREFIJO}-1`);
  await expect(page.getByRole('link', { name: `${PREFIJO}-1`, exact: true })).toBeVisible();

  const otra = await browser.newContext();
  const page2 = await otra.newPage();
  await iniciarSesion(page2);
  await page2.goto('/#/animales');
  await page2.getByPlaceholder(/Buscar por número interno/).fill(`${PREFIJO}-1`);
  await expect(page2.getByRole('link', { name: `${PREFIJO}-1`, exact: true })).toBeVisible();
  await otra.close();
});

test('VRF animal: validaciones del formulario (vacíos, cero, negativos, objetivo ≤ ingreso)', async ({ page }) => {
  await iniciarSesion(page);
  const dialogo = await abrirNuevoAnimal(page);
  const guardar = dialogo.getByRole('button', { name: 'Guardar' });
  await guardar.click();
  await expect(dialogo.getByRole('alert')).toHaveText('El número interno y la chapeta ICA son obligatorios.');
  await llenarAnimal(dialogo, { numero: `${PREFIJO}-X`, chapeta: `${PREFIJO}-CH-X`, ingreso: '0' });
  await guardar.click();
  await expect(dialogo.getByRole('alert')).toHaveText(/peso de ingreso debe estar entre/);
  await dialogo.getByLabel(/Peso de ingreso/).fill('-5');
  await guardar.click();
  await expect(dialogo.getByRole('alert')).toHaveText(/peso de ingreso debe estar entre/);
  await dialogo.getByLabel(/Peso de ingreso/).fill('300');
  await dialogo.getByLabel(/Peso objetivo/).fill('250');
  await guardar.click();
  await expect(dialogo.getByRole('alert')).toHaveText('El peso objetivo debe ser mayor que el peso de ingreso.');
  await dialogo.getByLabel(/Peso objetivo/).fill('350');
  await dialogo.getByLabel(/Costo de compra/).fill('-1');
  await guardar.click();
  await expect(dialogo.getByRole('alert')).toHaveText('El costo de compra no puede ser negativo.');
});

test('VRF animal: chapeta ICA duplicada (misma, exacta) muestra error y no se crea', async ({ page }) => {
  await iniciarSesion(page);
  const dialogo = await abrirNuevoAnimal(page);
  await llenarAnimal(dialogo, { numero: `${PREFIJO}-2`, chapeta: 'COL-CES-265093' }); // chapeta del 0101
  await dialogo.getByRole('button', { name: 'Guardar' }).click();
  await expect(dialogo.getByRole('alert')).toHaveText(/Ya existe un animal con esa chapeta ICA/);
  const supabase = await clientePrueba();
  const { count } = await supabase.from('animales').select('id', { count: 'exact', head: true }).eq('numero_interno', `${PREFIJO}-2`);
  expect(count).toBe(0);
});

test('VRF animal: chapeta ICA duplicada escrita en minúsculas también se rechaza', async ({ page }) => {
  await iniciarSesion(page);
  const dialogo = await abrirNuevoAnimal(page);
  await llenarAnimal(dialogo, { numero: `${PREFIJO}-3`, chapeta: 'col-ces-265093' }); // la del 0101 en minúsculas
  await dialogo.getByRole('button', { name: 'Guardar' }).click();
  await page.waitForTimeout(2000);
  const supabase = await clientePrueba();
  const { count } = await supabase.from('animales').select('id', { count: 'exact', head: true }).eq('numero_interno', `${PREFIJO}-3`);
  expect(count, 'la base de datos aceptó una chapeta que solo cambia en mayúsculas/minúsculas').toBe(0);
});

test('VRF animal: doble clic en Guardar no deja un mensaje de error falso', async ({ page }) => {
  await iniciarSesion(page);
  const dialogo = await abrirNuevoAnimal(page);
  await llenarAnimal(dialogo, { numero: `${PREFIJO}-4`, chapeta: `${PREFIJO}-CH-4` });
  await dialogo.getByRole('button', { name: 'Guardar' }).dblclick();
  await page.waitForTimeout(2500);
  const supabase = await clientePrueba();
  const { count } = await supabase.from('animales').select('id', { count: 'exact', head: true }).eq('numero_interno', `${PREFIJO}-4`);
  expect(count).toBe(1);
  // Si se creó, el modal debe cerrarse sin decir "Ya existe…".
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('VRF animal: si falla el pesaje inicial, no queda un animal a medias', async ({ page }) => {
  await iniciarSesion(page);
  const dialogo = await abrirNuevoAnimal(page);
  await llenarAnimal(dialogo, { numero: `${PREFIJO}-5`, chapeta: `${PREFIJO}-CH-5` });
  // Se corta la red solo para el INSERT del pesaje inicial (el del animal pasa).
  await page.route('**/rest/v1/pesajes**', (route) =>
    route.request().method() === 'POST' ? route.abort('internetdisconnected') : route.continue(),
  );
  await dialogo.getByRole('button', { name: 'Guardar' }).click();
  await expect(dialogo.getByRole('alert')).toBeVisible({ timeout: 30_000 });
  const mensaje = await dialogo.getByRole('alert').innerText();
  await page.unroute('**/rest/v1/pesajes**');
  const supabase = await clientePrueba();
  const { data } = await supabase.from('animales').select('id, pesajes(id)').eq('numero_interno', `${PREFIJO}-5`);
  console.log('Animal a medias:', JSON.stringify({ mensaje, filas: data }));
  // Reintentar desde el mismo formulario:
  await dialogo.getByRole('button', { name: 'Guardar' }).click();
  await page.waitForTimeout(2000);
  const segundo = (await dialogo.getByRole('alert').count()) ? await dialogo.getByRole('alert').innerText() : '(sin mensaje)';
  console.log('Mensaje al reintentar:', segundo);
  expect(data, 'el animal quedó creado aunque la app dijo que hubo un error').toHaveLength(0);
});

test('VRF sanidad: descripción vacía, fecha futura y registro válido persistente', async ({ page }) => {
  await iniciarSesion(page);
  await abrirAnimal(page, ANIMAL_PESO);
  await page.getByRole('button', { name: 'Registrar evento' }).click();
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('alert')).toHaveText('Describe la vacuna o el tratamiento aplicado.');
  await page.getByLabel('Descripción').fill(DESC_SANIDAD);
  await page.getByLabel('Fecha').fill('2099-01-01');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('alert')).toHaveText('La fecha de aplicación no puede ser futura.');
  await page.getByLabel('Fecha').fill('2026-09-20');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText(DESC_SANIDAD)).toBeVisible();
  await page.reload();
  await expect(page.getByText(DESC_SANIDAD)).toBeVisible();
});

test('VRF precio: registro válido y duplicado (misma fecha y fuente)', async ({ page }) => {
  await iniciarSesion(page);
  await page.goto('/#/mercado');
  for (const intento of [1, 2]) {
    await page.getByRole('button', { name: 'Actualizar precio' }).click();
    await page.getByLabel('Fecha del boletín').fill(FECHA_PRECIO);
    await page.getByLabel('Precio (COP/kg)').fill('7000');
    await page.getByRole('button', { name: 'Guardar' }).click();
    if (intento === 1) await expect(page.getByLabel('Precio (COP/kg)')).toHaveCount(0);
  }
  await expect(page.getByRole('alert')).toHaveText(/Ya hay un precio registrado para esa fecha y fuente/);
});

test('VRF consola y red: recorrido de las 6 pantallas sin errores de consola ni HTTP ≥ 400', async ({ page }) => {
  const errores = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(`consola: ${m.text()}`);
  });
  page.on('pageerror', (e) => errores.push(`pageerror: ${e.message}`));
  page.on('response', (r) => {
    if (r.status() >= 400) errores.push(`HTTP ${r.status()} ${r.request().method()} ${r.url().split('?')[0]}`);
  });
  await iniciarSesion(page);
  await page.goto('/#/animales');
  await expect(page.getByText(/\d+ reses registradas/)).toBeVisible();
  await page.getByPlaceholder(/Buscar por número interno/).fill('0101');
  await page.getByRole('link', { name: '0101', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Animal N° 0101' })).toBeVisible();
  for (const [ruta, titulo] of [
    ['/#/mercado', 'Mercado y clima'],
    ['/#/recomendacion', 'Recomendación de venta'],
    ['/#/reporte', 'Reporte resumen de apoyo a la decisión'],
    ['/#/', /^Hola/],
  ]) {
    await page.goto(ruta);
    await expect(page.getByRole('heading', { name: titulo })).toBeVisible();
    await page.waitForTimeout(1500);
  }
  expect(errores).toEqual([]);
});

test.describe('celular 375×812', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

  test('VRF móvil: login y pantallas sin desbordamiento horizontal', async ({ page }) => {
    await iniciarSesion(page);
    const desbordes = {};
    for (const ruta of ['/#/', '/#/animales', '/#/mercado', '/#/recomendacion', '/#/reporte']) {
      await page.goto(ruta);
      await page.waitForTimeout(1000);
      const r = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        mainWidth: Math.round(document.querySelector('main')?.getBoundingClientRect().width ?? 0),
      }));
      desbordes[ruta] = r;
    }
    await page.screenshot({ path: 'test-results/vrf-movil-animales.png', fullPage: false });
    test.info().annotations.push({ type: 'medidas', description: JSON.stringify(desbordes) });
    console.log('MEDIDAS MOVIL', JSON.stringify(desbordes));
    for (const [ruta, r] of Object.entries(desbordes)) {
      expect.soft(r.scrollWidth, `${ruta} desborda`).toBeLessThanOrEqual(375);
      expect.soft(r.mainWidth, `${ruta} área útil`).toBeGreaterThanOrEqual(300);
    }
  });
});
