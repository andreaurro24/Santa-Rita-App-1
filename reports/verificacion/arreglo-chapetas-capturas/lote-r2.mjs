import { chromium } from 'file:///C:/Users/danie/Documents/Video-Santa-Rita/herramienta/node_modules/playwright/index.mjs';
import { fechaSeed, sesion } from 'file:///C:/Users/danie/Documents/Video-Santa-Rita/herramienta/toma.mjs';
import path from 'node:path';
const APP = 'http://localhost:5173/';
const LOTE = '#/lotes/9b03a289-5fbc-561d-98a0-f58dc3364cb1';
const b = await chromium.launch({ channel: 'chrome' });
const s = await sesion();
let bloqueadas = 0;
for (const [w, h] of [[320, 640], [360, 780], [375, 812], [390, 844], [768, 1024], [1024, 768], [1280, 800], [1440, 900]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, locale: 'es-CO', timezoneId: 'America/Bogota' });
  await ctx.route('**/*', (r) => { const q = r.request(); const u = q.url(); if (!['GET', 'HEAD', 'OPTIONS'].includes(q.method()) && (u.includes('/rest/v1') || (u.includes('/storage/v1') && !u.includes('/object/sign')))) { bloqueadas++; return r.abort(); } return r.continue(); });
  const p = await ctx.newPage();
  await p.clock.setFixedTime(new Date(`${fechaSeed()}T19:30:00-05:00`));
  await p.goto(`${APP}#/login`); await p.evaluate(([k, v]) => localStorage.setItem(k, v), [s.clave, s.valor]);
  await p.goto(APP + LOTE); await p.reload(); await p.waitForLoadState('networkidle'); await p.waitForTimeout(1200);
  const m = await p.evaluate(() => {
    const ul = document.querySelector('input[aria-label^="Seleccionar"]').closest('ul');
    const cols = getComputedStyle(ul).gridTemplateColumns.split(' ').length;
    const ulR = ul.getBoundingClientRect();
    const filas = [...ul.querySelectorAll('li')].map((li) => {
      const lab = li.querySelector('label'); const lr = lab.getBoundingClientRect();
      const chap = li.querySelector('span.bg-chapeta'); const finca = chap.parentElement.querySelector(':scope > span.text-xs');
      const kg = li.querySelector('span.cifra.ml-auto');
      const rg = document.createRange(); rg.selectNodeContents(finca); const lineasFinca = new Set([...rg.getClientRects()].map((x) => Math.round(x.top))).size;
      const fr = finca.getBoundingClientRect(), kr = kg.getBoundingClientRect(), cr = chap.getBoundingClientRect();
      return { chapeta: chap.textContent, finca: finca.textContent, lineasFinca, fincaCortada: finca.scrollWidth > finca.clientWidth + 1, kg: kg.textContent, kgLineas: Math.round(kr.height / parseFloat(getComputedStyle(kg).lineHeight)), fuera: Math.max(cr.right, fr.right, kr.right) > lr.right + 0.5 || lr.right > ulR.right + 0.5, solapa: cr.right > kr.left || fr.right > kr.left, liAncho: Math.round(lr.width) };
    });
    return { sw: document.documentElement.scrollWidth, vw: document.documentElement.clientWidth, cols, ulAncho: Math.round(ulR.width), filas };
  });
  const malas = m.filas.filter((f) => f.lineasFinca > 1 || f.fincaCortada || f.kgLineas > 1 || f.fuera || f.solapa);
  console.log(`${w}px sw=${m.sw}/${m.vw} cols=${m.cols} ul=${m.ulAncho} li=${m.filas.map((f) => f.liAncho).join('/')} ${malas.length ? 'MAL ' + JSON.stringify(malas) : 'ok: ' + m.filas.map((f) => `${f.chapeta}|${f.finca}|${f.kg}`).join('; ')}`);
  if ([320, 375, 390, 1280, 1440].includes(w)) await p.locator('input[aria-label^="Seleccionar"]').first().locator('xpath=ancestor::ul[1]').screenshot({ path: path.join(import.meta.dirname, 'r2', `lista-lote-${w}.png`) });
  await ctx.close();
}
console.log('BLOQUEADAS', bloqueadas);
await b.close();
