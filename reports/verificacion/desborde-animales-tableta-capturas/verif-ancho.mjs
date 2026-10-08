// SOLO LECTURA (verificador). Mide desborde de #/animales en antes (HEAD, :5181) y después (copia de trabajo, :5173).
// Bloquea todo método que no sea GET/HEAD/OPTIONS salvo el POST de /storage/v1/object/sign.
import { chromium } from 'file:///C:/Users/danie/Documents/Video-Santa-Rita/herramienta/node_modules/playwright/index.mjs';
import { sesion } from 'file:///C:/Users/danie/Documents/Video-Santa-Rita/herramienta/toma.mjs';
import path from 'node:path';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const SP = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const SHOTS = path.join(SP, 'verif-shots');
mkdirSync(SHOTS, { recursive: true });
const SERVIDORES = { despues: 'http://localhost:5173/', antes: 'http://localhost:5181/' };
const RUTAS = ['#/animales', '#/animales?estado=todos', '#/animales?ver=caballos'];
const ANCHOS = [375, 390, 768, 800, 900, 1000, 1023, 1024, 1100, 1200, 1279, 1280, 1300, 1366, 1440, 1536, 1920];
const BARRAS = process.env.BARRAS === '1'; // 1 = barras de desplazamiento clásicas (como Chrome en Windows)
const SOLO = (process.env.SOLO ?? 'despues,antes').split(',');

const s = await sesion();
const b = await chromium.launch({ channel: 'chrome', ignoreDefaultArgs: BARRAS ? ['--hide-scrollbars'] : [] });
const bloqueadas = [];
const consola = [];
const red = [];
const filas = [];
const hashes = {};

for (const cual of SOLO) {
  const APP = SERVIDORES[cual];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, locale: 'es-CO', timezoneId: 'America/Bogota' });
  await ctx.route('**/*', (r) => {
    const q = r.request();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(q.method()) && !q.url().includes('/storage/v1/object/sign')) {
      bloqueadas.push(`${cual} ${q.method()} ${new URL(q.url()).pathname}`);
      return r.abort();
    }
    return r.continue();
  });
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error') consola.push(`${cual}: ${m.text().slice(0, 200)}`); });
  p.on('response', (r) => { if (r.status() >= 400) red.push(`${cual} ${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`); });
  await p.goto(`${APP}#/login`);
  await p.evaluate(([k, v]) => localStorage.setItem(k, v), [s.clave, s.valor]);
  for (const ruta of RUTAS) {
    for (const w of ANCHOS) {
      await p.setViewportSize({ width: w, height: 900 });
      await p.goto(APP + ruta);
      await p.reload();
      await p.waitForLoadState('networkidle');
      await p.getByRole('heading', { name: 'Animales', level: 1 }).waitFor();
      await p.waitForTimeout(700);
      const m = await p.evaluate(() => {
        const de = document.documentElement;
        const vis = (e) => e && e.checkVisibility();
        const tablas = [...document.querySelectorAll('main table')].filter(vis).map((t) => ({ sw: t.parentElement.scrollWidth, cw: t.parentElement.clientWidth, filas: t.querySelectorAll('tbody tr').length, cols: [...t.querySelectorAll('thead th')].filter(vis).map((th) => th.innerText.trim()) }));
        const tarjetas = [...document.querySelectorAll('main ul')].filter((u) => vis(u) && u.className.includes('divide-y')).map((u) => u.querySelectorAll('li').length);
        const tab = [...document.querySelectorAll('[role=tab]')].find((t) => t.getAttribute('aria-selected') === 'true')?.innerText.trim();
        const buscador = document.querySelector('input[placeholder^="Buscar por nombre"]');
        const fila = buscador?.closest('label')?.parentElement;
        const dirFiltros = fila ? getComputedStyle(fila).flexDirection : null;
        const vw = de.clientWidth;
        const enScroll = (e) => { for (let x = e.parentElement; x && x !== document.body; x = x.parentElement) { const o = getComputedStyle(x).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') return true; } return false; };
        const fuera = [...document.querySelectorAll('body *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.right > vw + 0.5 && !enScroll(e); }).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 40)} r=${Math.round(e.getBoundingClientRect().right)}`).slice(0, 3);
        // Textos truncados dentro de la tabla (para saber si max-w-40 corta algo real).
        const truncados = [...document.querySelectorAll('main table .truncate')].filter((e) => vis(e) && e.scrollWidth > e.clientWidth).map((e) => e.innerText.slice(0, 40)).slice(0, 5);
        const vacio = document.querySelector('main')?.innerText.match(/Todavía no hay caballos|Todavía no hay animales|No hay animales con ese filtro/)?.[0] ?? null;
        return { sw: de.scrollWidth, cw: vw, tablas, tarjetas, tab, dirFiltros, fuera, truncados, vacio };
      });
      const ok = m.sw === m.cw && m.tablas.every((t) => t.sw === t.cw);
      const fila = { cual, ruta, w, ok, ...m };
      filas.push(fila);
      console.log(`${ok ? 'OK ' : 'MAL'} ${cual.padEnd(7)} ${ruta.padEnd(24)} ${String(w).padStart(4)} pag=${m.sw}/${m.cw} tabla=${m.tablas.map((t) => `${t.sw}/${t.cw}(${t.filas}f,${t.cols.length}c)`).join(',') || '-'} tarjetas=${m.tarjetas.join(',') || '-'} tab=${m.tab} filtros=${m.dirFiltros} vacio=${m.vacio ?? '-'} fuera=${JSON.stringify(m.fuera)} trunc=${JSON.stringify(m.truncados)}`);
      if ([375, 390, 768, 1023, 1024, 1279, 1280, 1440].includes(w)) {
        const f = path.join(SHOTS, `${BARRAS ? 'barras-' : ''}${cual}-${w}-${ruta.replace(/[^a-z]+/g, '_')}.png`);
        await p.screenshot({ path: f, fullPage: true });
        hashes[path.basename(f)] = createHash('md5').update(readFileSync(f)).digest('hex');
      }
    }
  }
  await ctx.close();
}
await b.close();
writeFileSync(path.join(SP, `verif-ancho${BARRAS ? '-barras' : ''}.json`), JSON.stringify({ filas, hashes, bloqueadas, consola, red }, null, 1));
console.log('HASHES celular (antes vs despues):');
for (const k of Object.keys(hashes).filter((k) => k.startsWith(`${BARRAS ? 'barras-' : ''}despues-375`) || k.startsWith(`${BARRAS ? 'barras-' : ''}despues-390`))) {
  const a = k.replace('despues-', 'antes-');
  console.log(hashes[k] === hashes[a] ? 'IDENTICAS' : 'DISTINTAS', k, a);
}
console.log('BLOQUEADAS', JSON.stringify(bloqueadas));
console.log('CONSOLA', JSON.stringify(consola));
console.log('RED>=400', JSON.stringify(red));
