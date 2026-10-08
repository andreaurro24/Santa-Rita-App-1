// SOLO LECTURA (verificador, ronda 2). Captura la tabla del ganado y mide qué se ve de la línea
// bajo el nombre (chapeta · raza · dueño) y del nombre. DATOS=demo | realista (inyectados solo en el
// navegador vía route.fulfill del GET de /rest/v1/animales). Bloquea escrituras.
import { chromium } from 'file:///C:/Users/danie/Documents/Video-Santa-Rita/herramienta/node_modules/playwright/index.mjs';
import { sesion } from 'file:///C:/Users/danie/Documents/Video-Santa-Rita/herramienta/toma.mjs';
import path from 'node:path';
import { mkdirSync } from 'node:fs';

const SP = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const SHOTS = path.join(SP, 'shots');
mkdirSync(SHOTS, { recursive: true });
const APP = 'http://localhost:5173/';
const DATOS = process.env.DATOS ?? 'demo';
const ANCHOS = (process.env.ANCHOS ?? '768,1024,1100,1279,1280,1440,1536').split(',').map(Number);
const T = {
  demo: (r) => r,
  // Todo dentro de los maxLength del formulario. Dueño y nombre de lote como los usaría la finca.
  realista: (r, i) => ({ ...r, dueno: i % 2 ? 'Miguel Ángel' : 'Socio Pedro Gómez', numero_interno: i % 3 === 0 ? `Novillo Pintado ${r.numero_interno}` : r.numero_interno }),
};
const s = await sesion();
const b = await chromium.launch({ channel: 'chrome' });
const bloqueadas = [];
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, locale: 'es-CO', timezoneId: 'America/Bogota' });
await ctx.route('**/*', async (r) => {
  const q = r.request();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(q.method()) && !q.url().includes('/storage/v1/object/sign')) { bloqueadas.push(`${q.method()} ${new URL(q.url()).pathname}`); return r.abort(); }
  const u = new URL(q.url());
  if (DATOS !== 'demo' && q.method() === 'GET' && u.pathname === '/rest/v1/animales' && u.searchParams.get('select')?.includes('pesajes')) {
    const resp = await r.fetch();
    return r.fulfill({ response: resp, json: (await resp.json()).map(T[DATOS]) });
  }
  return r.continue();
});
const p = await ctx.newPage();
await p.goto(`${APP}#/login`);
await p.evaluate(([k, v]) => localStorage.setItem(k, v), [s.clave, s.valor]);
for (const w of ANCHOS) {
  await p.setViewportSize({ width: w, height: 900 });
  await p.goto(`${APP}#/animales?estado=todos`); await p.reload(); await p.waitForLoadState('networkidle');
  const t = p.locator('main table').first();
  await t.waitFor(); await p.waitForTimeout(500);
  const m = await t.evaluate((t) => {
    const filas = [...t.querySelectorAll('tbody tr')];
    const caja = t.parentElement;
    return {
      caja: `${caja.scrollWidth}/${caja.clientWidth}`,
      filas: filas.slice(0, 12).map((tr) => {
        const nom = tr.querySelector('td:first-child .font-semibold');
        const lin = tr.querySelector('td:first-child span.block.truncate.text-sm');
        // Cuánto del texto cabe: proporción del ancho visible frente al total.
        const vis = (e) => (e && e.checkVisibility() ? `${e.innerText}${e.scrollWidth > e.clientWidth + 0.5 ? ` [CORTADO: se ve ${Math.round((100 * e.clientWidth) / e.scrollWidth)}%]` : ''}` : '-');
        return `${vis(nom)} | ${vis(lin)}`;
      }),
    };
  });
  console.log(`${DATOS} ${w} caja=${m.caja}`);
  for (const f of m.filas) console.log('   ', f);
  await t.screenshot({ path: path.join(SHOTS, `tabla-${DATOS}-${w}.png`) });
}
await b.close();
console.log('BLOQUEADAS', JSON.stringify(bloqueadas));
