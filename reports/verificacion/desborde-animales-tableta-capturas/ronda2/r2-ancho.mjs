// SOLO LECTURA (verificador, ronda 2). Copia de trabajo en :5173. Bloquea todo método que no sea
// GET/HEAD/OPTIONS salvo el POST de /storage/v1/object/sign. Mide página, tabla, filtros y R3.
// Uso: node r2-ancho.mjs   (R1SHOTS=<carpeta verif-shots de la ronda 1> para comparar el celular)
import { chromium } from 'file:///C:/Users/danie/Documents/Video-Santa-Rita/herramienta/node_modules/playwright/index.mjs';
import { sesion } from 'file:///C:/Users/danie/Documents/Video-Santa-Rita/herramienta/toma.mjs';
import path from 'node:path';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const SP = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const SHOTS = path.join(SP, 'shots');
mkdirSync(SHOTS, { recursive: true });
const APP = 'http://localhost:5173/';
const RUTAS = ['#/animales', '#/animales?estado=todos', '#/animales?ver=caballos'];
const ANCHOS = (process.env.ANCHOS ?? '375,390,768,800,900,1000,1023,1024,1100,1180,1200,1279,1280,1300,1366,1440,1536,1920').split(',').map(Number);
const BARRAS = process.env.BARRAS === '1';
const s = await sesion();
const b = await chromium.launch({ channel: 'chrome', ignoreDefaultArgs: BARRAS ? ['--hide-scrollbars'] : [] });
const bloqueadas = [], consola = [], red = [], filas = [], hashes = {};
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, locale: 'es-CO', timezoneId: 'America/Bogota' });
await ctx.route('**/*', (r) => {
  const q = r.request();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(q.method()) && !q.url().includes('/storage/v1/object/sign')) { bloqueadas.push(`${q.method()} ${new URL(q.url()).pathname}`); return r.abort(); }
  return r.continue();
});
const p = await ctx.newPage();
p.on('console', (m) => { if (m.type() === 'error') consola.push(m.text().slice(0, 200)); });
p.on('response', (r) => { if (r.status() >= 400) red.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`); });
await p.goto(`${APP}#/login`);
await p.evaluate(([k, v]) => localStorage.setItem(k, v), [s.clave, s.valor]);
for (const ruta of RUTAS) {
  for (const w of ANCHOS) {
    await p.setViewportSize({ width: w, height: 900 });
    await p.goto(APP + ruta); await p.reload(); await p.waitForLoadState('networkidle');
    await p.getByRole('heading', { name: 'Animales', level: 1 }).waitFor();
    await p.waitForTimeout(700);
    const m = await p.evaluate(() => {
      const de = document.documentElement; const vis = (e) => e && e.checkVisibility();
      const t = [...document.querySelectorAll('main table')].find(vis);
      let tabla = null;
      if (t) {
        const caja = t.parentElement; const sw = caja.scrollWidth, cw = caja.clientWidth;
        t.style.width = 'min-content'; const min = Math.ceil(t.getBoundingClientRect().width); t.style.width = '';
        const cols = [...t.querySelectorAll('thead th')].filter(vis).map((th) => th.innerText.trim());
        const orden = [...t.querySelectorAll('thead th button')].filter(vis).length;
        const lineas = [...t.querySelectorAll('tbody td:first-child a > span > span.text-sm')].filter(vis);
        const textosLinea = lineas.map((e) => e.innerText);
        const sueltos = textosLinea.filter((x) => /^\s*·|·\s*$/.test(x));
        const cortadas = lineas.filter((e) => e.scrollWidth > e.clientWidth + 0.5).length;
        const nombres = [...t.querySelectorAll('tbody td:first-child a > span > span.font-semibold')].filter(vis);
        const nombresCortados = nombres.filter((e) => e.scrollWidth > e.clientWidth + 0.5).map((e) => e.innerText);
        const badgeLote = [...t.querySelectorAll('tbody td:nth-child(3) > span > span')].filter(vis);
        const badgeAltoMax = Math.max(0, ...badgeLote.map((e) => Math.round(e.getBoundingClientRect().height)));
        tabla = { sw, cw, min, cols, orden, filas: t.querySelectorAll('tbody tr').length, ejLinea: textosLinea.slice(0, 2), sueltos: sueltos.length, cortadas, nLineas: lineas.length, nombresCortados, badgeAltoMax };
      }
      const tarjetas = [...document.querySelectorAll('main ul')].filter((u) => vis(u) && u.className.includes('divide-y')).map((u) => u.querySelectorAll('li').length);
      const input = document.querySelector('input[placeholder^="Buscar por nombre"]');
      const fila = input?.closest('label')?.parentElement;
      const cs = getComputedStyle(input); const c = document.createElement('canvas').getContext('2d'); c.font = cs.font;
      const phCortado = c.measureText(input.placeholder).width > input.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const selects = [...fila.querySelectorAll('select')].filter(vis).map((x) => Math.round(x.getBoundingClientRect().width));
      const vw = de.clientWidth;
      const enScroll = (e) => { for (let x = e.parentElement; x && x !== document.body; x = x.parentElement) { const o = getComputedStyle(x).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') return true; } return false; };
      const fuera = [...document.querySelectorAll('body *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.right > vw + 0.5 && !enScroll(e); }).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 40)}`).slice(0, 3);
      const tab = [...document.querySelectorAll('[role=tab]')].find((x) => x.getAttribute('aria-selected') === 'true')?.innerText.trim();
      const vacio = document.querySelector('main')?.innerText.match(/Todavía no hay caballos|Todavía no hay animales|No hay animales con ese filtro/)?.[0] ?? null;
      return { sw: de.scrollWidth, cw: vw, tabla, tarjetas, dir: getComputedStyle(fila).flexDirection, buscador: Math.round(input.getBoundingClientRect().width), phCortado, selects, fuera, tab, vacio };
    });
    const ok = m.sw === m.cw;
    filas.push({ ruta, w, ...m });
    const tb = m.tabla;
    console.log(`${ok ? 'OK ' : 'MAL'} ${ruta.padEnd(24)} ${String(w).padStart(4)} pag=${m.sw}/${m.cw} tabla=${tb ? `${tb.sw}/${tb.cw} min=${tb.min} ${tb.filas}f orden=${tb.orden} cols=[${tb.cols.join('|')}] linea2=${tb.nLineas}(cortadas ${tb.cortadas}, sueltos ${tb.sueltos}) ej=${JSON.stringify(tb.ejLinea)} nomCort=${JSON.stringify(tb.nombresCortados)} badgeH=${tb.badgeAltoMax}` : '-'} tarj=${m.tarjetas.join(',') || '-'} filtros=${m.dir} busc=${m.buscador}${m.phCortado ? '(ph cortado)' : ''} sel=${m.selects.join(',')} tab=${m.tab} vacio=${m.vacio ?? '-'} fuera=${JSON.stringify(m.fuera)}`);
    if ([375, 390].includes(w) && !BARRAS) {
      const f = path.join(SHOTS, `r2-${w}-${ruta.replace(/[^a-z]+/g, '_')}.png`);
      await p.screenshot({ path: f, fullPage: true });
      hashes[path.basename(f)] = createHash('md5').update(readFileSync(f)).digest('hex');
    }
    if ([768, 1024, 1279, 1280].includes(w)) await p.screenshot({ path: path.join(SHOTS, `${BARRAS ? 'barras-' : ''}r2-${w}-${ruta.replace(/[^a-z]+/g, '_')}.png`), fullPage: false });
  }
}
await b.close();
writeFileSync(path.join(SP, `r2-ancho${BARRAS ? '-barras' : ''}.json`), JSON.stringify({ filas, hashes, bloqueadas, consola, red }, null, 1));
const R1SHOTS = process.env.R1SHOTS;
if (R1SHOTS) for (const k of Object.keys(hashes)) {
  const a = path.join(R1SHOTS, k.replace('r2-', 'antes-'));
  const ha = existsSync(a) ? createHash('md5').update(readFileSync(a)).digest('hex') : 'NO-EXISTE';
  console.log(ha === hashes[k] ? 'IDENTICAS' : 'DISTINTAS', k, 'vs', path.basename(a));
}
console.log('BLOQUEADAS', JSON.stringify(bloqueadas));
console.log('CONSOLA', JSON.stringify(consola));
console.log('RED>=400', JSON.stringify(red));
