// SOLO LECTURA (verificador). Margen de la tabla del ganado a 1280/1366/1440/1536: ancho mínimo
// (min-content) frente al ancho disponible, con datos demo y variantes aisladas inyectadas en el
// navegador (route.fulfill del GET de /rest/v1/animales). Nada se escribe en Supabase.
import { chromium } from 'file:///C:/Users/danie/Documents/Video-Santa-Rita/herramienta/node_modules/playwright/index.mjs';
import { sesion } from 'file:///C:/Users/danie/Documents/Video-Santa-Rita/herramienta/toma.mjs';

const APP = process.env.APP_URL ?? 'http://localhost:5173/';
const BARRAS = process.env.BARRAS === '1';
const conLote = (nombre, alPartir) => (r) => ({ ...r, lote: r.lote ? { ...r.lote, nombre } : r.lote, contrato: alPartir ? { id: 'x', porcentaje_ganancia: 50, tenedor: { nombre: 'P', finca: { nombre: 'F' } } } : r.contrato });
const VARIANTES = {
  demo: (r) => r,
  'lote placeholder "Lote 2027-A (Ceba)" + Al partir': conLote('Lote 2027-A (Ceba)', true),
  'lote "Novillos de la vega" (demo) + Al partir en todos': conLote('Novillos de la vega', true),
  'lote 30 car. "Novillos comprados en Bosconia"': conLote('Novillos comprados en Bosconia', false),
  'chapeta 20 car. "COL-CES-990001234567"': (r, i) => ({ ...r, chapeta_ica: `COL-CES-99000${String(1234567 + i)}` }),
  'peso 1.234,5 kg y $12.345/kg': (r) => ({ ...r, peso_ingreso_kg: 1234.5, precio_compra_kg_cop: 12345 }),
  'raza "Brahman rojo x Gyr lechero" y dueño 28 car.': (r) => ({ ...r, raza: 'Brahman rojo x Gyr lechero', dueno: 'Miguel Ángel Rodríguez Pérez' }),
};
const s = await sesion();
const b = await chromium.launch({ channel: 'chrome', ignoreDefaultArgs: BARRAS ? ['--hide-scrollbars'] : [] });
const bloqueadas = [];
for (const [nombre, f] of Object.entries(VARIANTES)) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, locale: 'es-CO' });
  await ctx.route('**/*', async (r) => {
    const q = r.request();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(q.method()) && !q.url().includes('/storage/v1/object/sign')) { bloqueadas.push(`${q.method()} ${new URL(q.url()).pathname}`); return r.abort(); }
    const u = new URL(q.url());
    if (q.method() === 'GET' && u.pathname === '/rest/v1/animales' && u.searchParams.get('select')?.includes('pesajes')) {
      const resp = await r.fetch();
      return r.fulfill({ response: resp, json: (await resp.json()).map(f) });
    }
    return r.continue();
  });
  const p = await ctx.newPage();
  await p.goto(`${APP}#/login`);
  await p.evaluate(([k, v]) => localStorage.setItem(k, v), [s.clave, s.valor]);
  const res = [];
  for (const w of [1280, 1366, 1440, 1536]) {
    await p.setViewportSize({ width: w, height: 900 });
    await p.goto(`${APP}#/animales?estado=todos`);
    await p.reload();
    await p.waitForLoadState('networkidle');
    await p.locator('main table').first().waitFor();
    await p.waitForTimeout(400);
    res.push(await p.evaluate((w) => {
      const t = [...document.querySelectorAll('main table')].find((x) => x.checkVisibility());
      const caja = t.parentElement;
      const disp = caja.clientWidth;
      const sw = caja.scrollWidth;
      t.style.width = 'min-content';
      const minimo = Math.ceil(t.getBoundingClientRect().width);
      t.style.width = '';
      return `${w}: ${sw === disp ? 'cabe' : 'DESPLAZA'} ${sw}/${disp} min=${minimo} margen=${disp - minimo}`;
    }, w));
  }
  console.log(`${nombre.padEnd(55)} ${res.join(' | ')}`);
  await ctx.close();
}
await b.close();
console.log('BARRAS', BARRAS, 'BLOQUEADAS', JSON.stringify(bloqueadas));
