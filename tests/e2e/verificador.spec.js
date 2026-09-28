import { expect, test } from '@playwright/test';
import { clientePrueba, entrar, iniciarSesion } from './helpers';

// Pruebas del VERIFICADOR para la spec 001 (criterios que las pruebas del implementador no cubren).
// Todo dato creado lleva el prefijo VRF-E2E y se borra en afterAll.
// Ronda 2 (2026-09-28): la prueba del "animal a medias" se rehízo para el RPC registrar_animal y
// se añadieron regresiones del nuevo flujo de login/perfil, fechas futuras, índices y desempate.

const PREFIJO = 'VRF-E2E';
const ANIMAL_PESO = '0103';
const PESO_DOBLE_CLIC = 377.7;
const FECHA_PRECIO = '2020-01-15';
const FUENTE_MANUAL = 'Registro manual (Fedegán/SIPSA)';
const DESC_SANIDAD = `${PREFIJO} vacuna de prueba`;
const STORAGE_KEY = 'sb-eiszvbwwpqcqognkcfew-auth-token';
const ANIMAL_EMPATE = '0104';
const PESOS_EMPATE = [391.1, 382.2]; // mismo día; 382.2 se registra DESPUÉS (created_at mayor)
const FUENTE_FUTURA = 'VRF-E2E precio futuro';

// Hoy y mañana en America/Bogota (D12), como 'AAAA-MM-DD'.
const hoyBogota = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
const mananaBogota = () => new Date(Date.parse(`${hoyBogota()}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

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
  await supabase.from('precios_mercado').delete().eq('fuente', FUENTE_FUTURA);
  const { data: a104 } = await supabase.from('animales').select('id').eq('numero_interno', ANIMAL_EMPATE).single();
  await supabase.from('pesajes').delete().eq('animal_id', a104.id).in('peso_kg', PESOS_EMPATE);
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
  await page.goto('/#/animales');
  await page.route('**/rest/v1/perfiles**', (route) => route.abort('internetdisconnected'));
  const t0 = Date.now();
  await entrar(page);
  // Ronda 1: a los 3 s volvía el formulario vacío. Ahora debe explicarse en pocos segundos.
  await expect(page.getByText('No hay conexión con el servidor', { exact: false })).toBeVisible({ timeout: 30_000 });
  const seg = (Date.now() - t0) / 1000;
  console.log('R7 perfil: segundos hasta el mensaje:', seg.toFixed(1));
  expect.soft(seg, 'segundos hasta explicar el fallo del perfil').toBeLessThan(8);
  await expect(page.getByRole('button', { name: 'Ingresar' })).toHaveCount(0);
  // El encabezado no debería decir que la cuenta no tiene acceso cuando el problema es la red.
  await expect(page.getByText('Tu cuenta no tiene acceso a los datos de la finca')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/vrf-perfil-sin-red.png' });
  // Vuelve la red: Reintentar entra y lleva a la ruta pedida (R2).
  await page.unroute('**/rest/v1/perfiles**');
  await page.getByRole('button', { name: 'Reintentar' }).click();
  await expect(page.getByRole('heading', { name: 'Trazabilidad del hato' })).toBeVisible({ timeout: 15_000 });
});

test('VRF R4/R7: una cuenta sin perfil ve "pide acceso", no ve datos y puede cerrar sesión', async ({ page }) => {
  const pedidosHato = [];
  page.on('request', (r) => {
    if (r.url().includes('/rest/v1/animales')) pedidosHato.push(r.url());
  });
  // Simula una cuenta de Auth sin fila en `perfiles` (no se permite crear usuarios reales).
  await page.route('**/rest/v1/perfiles**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
  await page.goto('/#/login');
  await entrar(page);
  await expect(page.getByText('Tu cuenta no tiene acceso a los datos de la finca')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Pídele al dueño que te dé acceso', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reintentar' })).toHaveCount(0);
  // Una ruta protegida tampoco muestra datos, ni tras recargar.
  await page.goto('/#/animales');
  await page.reload();
  await expect(page.getByText('Tu cuenta no tiene acceso a los datos de la finca')).toBeVisible({ timeout: 10_000 });
  expect(pedidosHato, 'la app pidió el hato para una cuenta sin perfil').toEqual([]);
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page.getByRole('button', { name: 'Ingresar' })).toBeVisible();
});

test('VRF R3: iniciar sesión en otra pestaña se refleja en esta (como ya pasa al cerrar sesión)', async ({ context }) => {
  const a = await context.newPage();
  await a.goto('/#/login');
  await expect(a.getByRole('button', { name: 'Ingresar' })).toBeVisible();
  const b = await context.newPage();
  await iniciarSesion(b);
  await a.bringToFront();
  await a.waitForTimeout(3000);
  const sigueEnLogin = await a.getByRole('button', { name: 'Ingresar' }).isVisible();
  console.log('Pestaña A sigue en el formulario de login tras entrar en B:', sigueEnLogin);
  // Simétrico: cerrar sesión en B sí saca a A (comprobación de control).
  await a.goto('/#/animales');
  await a.reload(); // recarga completa: la sesión compartida se restaura con INITIAL_SESSION
  await expect(a.getByRole('heading', { name: 'Trazabilidad del hato' })).toBeVisible({ timeout: 15_000 });
  await b.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(a).toHaveURL(/#\/login/, { timeout: 15_000 });
  expect.soft(sigueEnLogin, 'la pestaña A no se enteró del inicio de sesión en B').toBe(false);
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
  await expect(dialogo.getByRole('alert')).toHaveText(/Ya existe un animal con esa chapeta ICA/, { timeout: 15_000 });
  const supabase = await clientePrueba();
  const { count } = await supabase.from('animales').select('id', { count: 'exact', head: true }).eq('numero_interno', `${PREFIJO}-3`);
  expect(count, 'la base de datos aceptó una chapeta que solo cambia en mayúsculas/minúsculas').toBe(0);
});

test('VRF animal: número interno repetido con espacios y chapeta con espacios también se rechazan', async ({ page }) => {
  await iniciarSesion(page);
  const dialogo = await abrirNuevoAnimal(page);
  await llenarAnimal(dialogo, { numero: ' 0101 ', chapeta: `${PREFIJO}-CH-6` });
  await dialogo.getByRole('button', { name: 'Guardar' }).click();
  await expect(dialogo.getByRole('alert')).toHaveText(/Ya existe un animal con ese número interno/, { timeout: 15_000 });
  // Y saltando la interfaz (API directa, sin el trim del cliente):
  const supabase = await clientePrueba();
  const { data: a101 } = await supabase.from('animales').select('lote_id, chapeta_ica').eq('numero_interno', '0101').single();
  const base = { sexo: 'Macho', origen: 'compra', fecha_ingreso: '2026-09-01', peso_ingreso_kg: 200, peso_objetivo_kg: 350, lote_id: a101.lote_id };
  const r1 = await supabase.from('animales').insert({ ...base, numero_interno: '0101 ', chapeta_ica: `${PREFIJO}-CH-7` });
  const r2 = await supabase.from('animales').insert({ ...base, numero_interno: `${PREFIJO}-8`, chapeta_ica: ` ${a101.chapeta_ica.toLowerCase()} ` });
  if (!r1.error) await supabase.from('animales').delete().eq('chapeta_ica', `${PREFIJO}-CH-7`);
  expect([r1.error?.code, r2.error?.code]).toEqual(['23505', '23505']);
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

// Ronda 2: el alta ya no hace dos POST (animales + pesajes) sino un solo POST a
// rpc/registrar_animal. Para probar la atomicidad hay que hacer fallar el pesaje DENTRO de la
// función, después de que el INSERT del animal ya tuvo éxito: se reescribe la petición para que
// fecha_ingreso sea mañana. `animales.fecha_ingreso` no tiene CHECK de fecha (el INSERT del animal
// pasa) y el trigger de `pesajes` rechaza la fecha futura (el segundo INSERT falla).
test('VRF animal: si falla el pesaje inicial dentro de registrar_animal, no queda un animal a medias', async ({ page }) => {
  await iniciarSesion(page);
  const dialogo = await abrirNuevoAnimal(page);
  await llenarAnimal(dialogo, { numero: `${PREFIJO}-5`, chapeta: `${PREFIJO}-CH-5` });
  const manana = mananaBogota();
  let reescritas = 0;
  await page.route('**/rest/v1/rpc/registrar_animal', async (route) => {
    const body = route.request().postDataJSON();
    body.datos.fecha_ingreso = manana;
    reescritas++;
    await route.continue({ postData: JSON.stringify(body) });
  });
  const respuesta = page.waitForResponse('**/rest/v1/rpc/registrar_animal');
  await dialogo.getByRole('button', { name: 'Guardar' }).click();
  const r = await respuesta;
  const cuerpo = await r.json();
  console.log('RPC con pesaje fallido:', r.status(), JSON.stringify(cuerpo));
  expect(reescritas).toBe(1);
  expect(cuerpo.message, 'el fallo debe venir del pesaje (segundo INSERT de la función)').toMatch(/fecha_futura: el pesaje/);
  await expect(dialogo.getByRole('alert')).toBeVisible();
  const supabase = await clientePrueba();
  const { data } = await supabase.from('animales').select('id').eq('numero_interno', `${PREFIJO}-5`);
  expect(data, 'el INSERT del animal no se revirtió al fallar el pesaje').toHaveLength(0);

  // Reintentar con la red normal: se guarda (sin el "Ya existe…" de la ronda 1) con su pesaje.
  await page.unroute('**/rest/v1/rpc/registrar_animal');
  await dialogo.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 15_000 });
  const { data: creado } = await supabase
    .from('animales')
    .select('id, fecha_ingreso, pesajes(fecha, peso_kg)')
    .eq('numero_interno', `${PREFIJO}-5`);
  expect(creado).toHaveLength(1);
  expect(creado[0].pesajes).toEqual([{ fecha: hoyBogota(), peso_kg: 200 }]);
});

test('VRF animal: la función registrar_animal no está disponible sin sesión', async () => {
  const { createClient } = await import('@supabase/supabase-js');
  const anon = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const { error } = await anon.rpc('registrar_animal', { datos: { numero_interno: `${PREFIJO}-anon`, chapeta_ica: `${PREFIJO}-anon` } });
  expect(error?.code).toBe('42501');
});

test('VRF R5: la base de datos rechaza fechas futuras (Bogotá) en pesajes y sanidad aplicada, no en sanidad programada', async () => {
  const supabase = await clientePrueba();
  const { data: a } = await supabase.from('animales').select('id').eq('numero_interno', ANIMAL_PESO).single();
  const manana = mananaBogota();
  const p = await supabase.from('pesajes').insert({ animal_id: a.id, fecha: manana, peso_kg: 300 });
  const e = await supabase
    .from('eventos_sanitarios')
    .insert({ animal_id: a.id, tipo: 'vacuna', descripcion: DESC_SANIDAD, estado: 'aplicado', fecha_aplicada: manana });
  const prog = await supabase
    .from('eventos_sanitarios')
    .insert({ animal_id: a.id, tipo: 'vacuna', descripcion: DESC_SANIDAD, estado: 'programado', fecha_programada: '2027-01-15' })
    .select('id');
  if (prog.data?.[0]) await supabase.from('eventos_sanitarios').delete().eq('id', prog.data[0].id);
  expect([p.error?.code, e.error?.code, prog.error?.code ?? 'ok']).toEqual(['23514', '23514', 'ok']);
});

test('VRF R5: la base de datos rechaza un precio de mercado con fecha futura', async () => {
  // El formulario de Mercado lo valida (Market.jsx:168), pero `precios_mercado.fecha` no tiene
  // CHECK ni trigger. El precio con la fecha mayor es el "precio vigente" (precios.js:17).
  const supabase = await clientePrueba();
  const { data, error } = await supabase
    .from('precios_mercado')
    .insert({ fecha: '2030-01-01', precio_kg_cop: 1, fuente: FUENTE_FUTURA })
    .select('id');
  if (data?.[0]) await supabase.from('precios_mercado').delete().eq('id', data[0].id);
  expect(error?.code, 'se aceptó un precio de 2030 que pasaría a ser el precio vigente').toBe('23514');
});

test('VRF peso actual: con dos pesajes el mismo día vale el último registrado', async ({ page }) => {
  const supabase = await clientePrueba();
  const { data: a } = await supabase.from('animales').select('id').eq('numero_interno', ANIMAL_EMPATE).single();
  const hoy = hoyBogota();
  // Se inserta PRIMERO el que se registró después, para que el orden físico no coincida con created_at.
  const r1 = await supabase.from('pesajes').insert({ animal_id: a.id, fecha: hoy, peso_kg: PESOS_EMPATE[1], created_at: `${hoy}T15:00:00Z` });
  const r2 = await supabase.from('pesajes').insert({ animal_id: a.id, fecha: hoy, peso_kg: PESOS_EMPATE[0], created_at: `${hoy}T14:00:00Z` });
  expect([r1.error, r2.error]).toEqual([null, null]);
  await iniciarSesion(page);
  await abrirAnimal(page, ANIMAL_EMPATE);
  await expect(page.getByText(`${PESOS_EMPATE[1]} kg`, { exact: true })).toBeVisible();
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
