// SOLO LECTURA. Qué ve el usuario entre 768 y 1279 px: ancho del buscador, botones de ordenar, chapeta/precio/dueño.
import { chromium } from 'file:///C:/Users/danie/Documents/Video-Santa-Rita/herramienta/node_modules/playwright/index.mjs';
import { sesion } from 'file:///C:/Users/danie/Documents/Video-Santa-Rita/herramienta/toma.mjs';
const s = await sesion();
const b = await chromium.launch({ channel: 'chrome' });
const bloqueadas = [];
for (const [cual, APP] of [['antes', 'http://localhost:5181/'], ['despues', 'http://localhost:5173/']]) {
  const ctx = await b.newContext({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 1, locale: 'es-CO' });
  await ctx.route('**/*', (r) => { const q = r.request(); if (!['GET', 'HEAD', 'OPTIONS'].includes(q.method()) && !q.url().includes('/storage/v1/object/sign')) { bloqueadas.push(q.method()); return r.abort(); } return r.continue(); });
  const p = await ctx.newPage();
  await p.goto(`${APP}#/login`); await p.evaluate(([k, v]) => localStorage.setItem(k, v), [s.clave, s.valor]);
  for (const w of [768, 1024, 1093, 1100, 1279, 1280]) {
    await p.setViewportSize({ width: w, height: 900 });
    await p.goto(`${APP}#/animales`); await p.reload(); await p.waitForLoadState('networkidle'); await p.waitForTimeout(500);
    const m = await p.evaluate(() => {
      const main = document.querySelector('main');
      const vis = [...main.querySelectorAll('*')].filter((e) => e.checkVisibility());
      const texto = main.innerText;
      const input = main.querySelector('input[placeholder^="Buscar"]');
      return {
        buscador: Math.round(input.getBoundingClientRect().width),
        placeholderCortado: input.scrollWidth > input.clientWidth || (() => { const c = document.createElement('canvas').getContext('2d'); c.font = getComputedStyle(input).font; const cs = getComputedStyle(input); return c.measureText(input.placeholder).width > input.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight); })(),
        botonesOrdenar: vis.filter((e) => e.tagName === 'BUTTON' && e.closest('th')).length,
        chapetaVisible: /COL-CES-99/.test(texto),
        precioKgVisible: /\$\d/.test(texto),
      };
    });
    console.log(cual, w, JSON.stringify(m));
  }
  await ctx.close();
}
await b.close();
console.log('BLOQUEADAS', JSON.stringify(bloqueadas));
