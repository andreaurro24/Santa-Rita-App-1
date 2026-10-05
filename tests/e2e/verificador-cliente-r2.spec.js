import { expect, test } from '@playwright/test';
import { clientePrueba, entrar, iniciarSesion } from './helpers';

// Pruebas del VERIFICADOR para la spec 012 · R3, ronda 2 (HEAD 1f12e28).
// `src/lib/supabase.js` ya no usa createClient: arma el cliente con AuthClient (@supabase/auth-js) y
// PostgrestClient (@supabase/postgrest-js). Se comprueba que se comporte como supabase-js:
//   - misma llave de sesión en localStorage (sb-<ref>-auth-token), y ninguna otra;
//   - cada consulta a /rest/v1 lleva apikey y el token de la sesión (no la llave pública);
//   - sin sesión, la llave pública no lee nada (RLS → 42501);
//   - refresco de token real, otra pestaña que lo ve, cerrar sesión que saca a la otra pestaña y
//     revoca el refresh token en el servidor.
// No crea datos. La prueba de refresco usa un inicio de sesión propio para no rotar el token compartido.

const URL_SB = () => process.env.VITE_SUPABASE_URL;
const LLAVE = () => process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const CLAVE = () => `sb-${new URL(URL_SB()).hostname.split('.')[0]}-auth-token`;

function registrar(nombre, datos) {
  console.log(`${nombre}: ${JSON.stringify(datos)}`);
  test.info().annotations.push({ type: nombre, description: JSON.stringify(datos) });
}

function capturar(page) {
  const pedidos = [];
  page.on('request', (r) => {
    if (r.url().startsWith(URL_SB())) pedidos.push(r);
  });
  return pedidos;
}
async function cabeceras(pedidos, filtro) {
  const out = [];
  for (const r of pedidos.filter((x) => x.url().includes(filtro))) out.push({ url: r.url().split('?')[0].replace(URL_SB(), ''), metodo: r.method(), h: await r.allHeaders() });
  return out;
}
const quien = (auth, token) => (auth === `Bearer ${token}` ? 'token de la sesión' : auth === `Bearer ${LLAVE()}` ? 'llave pública' : auth ? 'otro token' : 'sin Authorization');

test('VRF 012 r2 · R3: llave de sesión, apikey y token de la sesión en cada consulta', async ({ page }) => {
  const errores = [];
  page.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
  page.on('response', (x) => x.status() >= 400 && errores.push(`${x.status()} ${x.request().method()} ${x.url().split('?')[0]}`));
  const pedidos = capturar(page);
  await iniciarSesion(page);
  const supabase = await clientePrueba();
  const { data } = await supabase.auth.getSession();
  for (const [url, titulo] of [
    ['/#/animales', 'Animales'],
    ['/#/lotes', null],
    ['/#/indicadores', null],
  ]) {
    await page.goto(url);
    if (titulo) await expect(page.getByRole('heading', { name: titulo })).toBeVisible();
    await page.waitForTimeout(1200);
  }
  const rest = await cabeceras(pedidos, '/rest/v1/');
  const r = {
    clavesLocalStorage: await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('sb-'))),
    consultas: rest.length,
    authorization: [...new Set(rest.map((p) => quien(p.h.authorization, data.session.access_token)))],
    apikey: [...new Set(rest.map((p) => (p.h.apikey === LLAVE() ? 'llave pública' : p.h.apikey ?? 'sin apikey')))],
    xClientInfo: [...new Set(rest.map((p) => p.h['x-client-info'] ?? 'sin X-Client-Info'))],
    perfil: [...new Set(rest.filter((p) => p.metodo === 'GET').map((p) => p.h['accept-profile'] ?? 'sin Accept-Profile'))],
    ejemplos: rest.slice(0, 4).map((p) => `${p.metodo} ${p.url}`),
  };
  registrar('cabeceras', r);
  registrar('consola y red', errores);
  expect(r.clavesLocalStorage).toEqual([CLAVE()]);
  expect(r.consultas).toBeGreaterThan(3);
  expect(r.authorization).toEqual(['token de la sesión']);
  expect(r.apikey).toEqual(['llave pública']);
  expect(errores).toEqual([]);
});

test('VRF 012 r2 · R3: sin sesión, la llave pública con las cabeceras del cliente no lee ni escribe (RLS)', async ({ page }) => {
  const h = { apikey: LLAVE(), Authorization: `Bearer ${LLAVE()}`, 'Content-Type': 'application/json' };
  const r = {};
  for (const tabla of ['animales', 'pesajes', 'ventas', 'perfiles', 'costos']) {
    const res = await fetch(`${URL_SB()}/rest/v1/${tabla}?select=id&limit=1`, { headers: h });
    const body = await res.json().catch(() => null);
    r[tabla] = `${res.status} ${body?.code ?? (Array.isArray(body) ? `${body.length} filas` : '')}`;
  }
  const rpc = await fetch(`${URL_SB()}/rest/v1/rpc/registrar_animal`, { method: 'POST', headers: h, body: JSON.stringify({ datos: {} }) });
  r.rpcRegistrarAnimal = `${rpc.status} ${(await rpc.json().catch(() => ({}))).code ?? ''}`;
  // La app sin sesión: la ruta protegida lleva al login y no consulta tablas.
  const pedidos = capturar(page);
  await page.goto('/#/animales');
  await expect(page).toHaveURL(/#\/login/);
  await page.waitForTimeout(1000);
  r.consultasSinSesion = (await cabeceras(pedidos, '/rest/v1/')).map((p) => p.url);
  registrar('anon', r);
  for (const t of ['animales', 'pesajes', 'ventas', 'perfiles', 'costos']) expect(r[t], t).toMatch(/^40[13] 42501/);
  expect(r.rpcRegistrarAnimal).toMatch(/42501/);
  expect(r.consultasSinSesion).toEqual([]);
});

test('VRF 012 r2 · R3: refresco de token, otra pestaña y cerrar sesión con el cliente propio', async ({ context }) => {
  test.setTimeout(120_000);
  const a = await context.newPage();
  const tokenResp = [];
  a.on('response', (x) => {
    if (x.url().includes('/auth/v1/token')) tokenResp.push(`${x.status()} ${new URL(x.url()).searchParams.get('grant_type')}`);
  });
  const errores = [];
  for (const p of [a]) p.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
  await a.goto('/#/login');
  await entrar(a);
  await expect(a.getByRole('heading', { name: /^Hola/ })).toBeVisible({ timeout: 20_000 });
  const leer = (p) => p.evaluate((k) => JSON.parse(localStorage.getItem(k)), CLAVE());
  const s0 = await leer(a);
  const b = await context.newPage();
  const pedidosB = capturar(b);
  await b.goto('/#/animales');
  await expect(b.getByRole('heading', { name: 'Animales', exact: true })).toBeVisible({ timeout: 15_000 });

  // Deja la sesión a 20 s de vencer (dentro del margen de 90 s de auth-js) y recarga A: debe refrescar.
  await a.evaluate((k) => {
    const s = JSON.parse(localStorage.getItem(k));
    s.expires_at = Math.floor(Date.now() / 1000) + 20;
    localStorage.setItem(k, JSON.stringify(s));
  }, CLAVE());
  const pedidosA = capturar(a);
  await a.reload();
  await expect.poll(() => tokenResp.filter((t) => t.endsWith('refresh_token')).length, { timeout: 20_000 }).toBeGreaterThan(0);
  await expect(a.getByRole('heading', { name: /^Hola/ })).toBeVisible({ timeout: 15_000 });
  const s1 = await leer(a);
  await a.goto('/#/lotes');
  await a.waitForTimeout(1500);
  const restA = await cabeceras(pedidosA, '/rest/v1/');
  // B no se recarga: su siguiente consulta debe salir con el token nuevo.
  const antesB = pedidosB.length;
  await b.goto('/#/fincas');
  await b.waitForTimeout(1500);
  const restB = (await cabeceras(pedidosB.slice(antesB), '/rest/v1/')).map((p) => quien(p.h.authorization, s1.access_token));

  // Cerrar sesión en A saca a B.
  await a.goto('/#/');
  await a.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(a).toHaveURL(/#\/login/, { timeout: 15_000 });
  await expect(b).toHaveURL(/#\/login/, { timeout: 15_000 });
  const tras = await a.evaluate((k) => localStorage.getItem(k), CLAVE());
  // El refresh token de esa sesión quedó revocado en el servidor.
  const rev = await fetch(`${URL_SB()}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { apikey: LLAVE(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: s1.refresh_token }),
  });
  const r = {
    tokenResp,
    tokenCambio: s1.access_token !== s0.access_token,
    nuevoVenceEnMin: Math.round((s1.expires_at * 1000 - Date.now()) / 60_000),
    restA: [...new Set(restA.map((p) => quien(p.h.authorization, s1.access_token)))],
    restB: [...new Set(restB)],
    sesionTrasSalir: tras,
    refreshRevocado: `${rev.status} ${(await rev.json().catch(() => ({}))).error_code ?? ''}`,
    errores,
  };
  registrar('refresco y pestañas', r);
  expect(r.tokenCambio).toBe(true);
  expect(r.nuevoVenceEnMin).toBeGreaterThan(30);
  expect(r.restA).toEqual(['token de la sesión']);
  expect(r.restB).toEqual(['token de la sesión']);
  expect(r.sesionTrasSalir).toBeNull();
  expect(rev.status).toBeGreaterThanOrEqual(400);
});
