// SOLO LECTURA (verificador, ronda 2). Ordenar por cada columna a 768, 1024 y 1279 px (solo
// estado del cliente) y tamaño de los botones de los encabezados. Bloquea escrituras.
import { chromium } from 'file:///C:/Users/danie/Documents/Video-Santa-Rita/herramienta/node_modules/playwright/index.mjs';
import { sesion } from 'file:///C:/Users/danie/Documents/Video-Santa-Rita/herramienta/toma.mjs';
const APP = 'http://localhost:5173/';
const s = await sesion();
const b = await chromium.launch({ channel: 'chrome' });
const bloqueadas = [];
const ctx = await b.newContext({ viewport: { width: 1024, height: 900 }, deviceScaleFactor: 1, locale: 'es-CO', timezoneId: 'America/Bogota' });
await ctx.route('**/*', (r) => { const q = r.request(); if (!['GET', 'HEAD', 'OPTIONS'].includes(q.method()) && !q.url().includes('/storage/v1/object/sign')) { bloqueadas.push(`${q.method()} ${new URL(q.url()).pathname}`); return r.abort(); } return r.continue(); });
const p = await ctx.newPage();
await p.goto(`${APP}#/login`); await p.evaluate(([k, v]) => localStorage.setItem(k, v), [s.clave, s.valor]);
const num = (x) => Number(String(x).replace(/[^\d,]/g, '').replace(',', '.')) || 0;
for (const w of [768, 1024, 1279]) {
  await p.setViewportSize({ width: w, height: 900 });
  await p.goto(`${APP}#/animales?estado=todos`); await p.reload(); await p.waitForLoadState('networkidle');
  const t = p.locator('main table').first(); await t.waitFor(); await p.waitForTimeout(400);
  const botones = await t.locator('thead th button').evaluateAll((bs) => bs.map((b) => `${b.innerText.replace(/\s+/g, ' ').trim()}=${Math.round(b.getBoundingClientRect().width)}x${Math.round(b.getBoundingClientRect().height)}`));
  const res = [];
  for (const [nombre, col] of [['Peso actual', 5], ['Peso inicial', 6], ['Precio', 7]]) {
    const btn = t.locator('thead th button', { hasText: new RegExp(nombre, 'i') });
    await btn.click(); await p.waitForTimeout(150);
    const a = (await t.locator(`tbody tr td:nth-child(${col})`).allInnerTexts()).map(num);
    await btn.click(); await p.waitForTimeout(150);
    const d = (await t.locator(`tbody tr td:nth-child(${col})`).allInnerTexts()).map(num);
    const asc = a.every((v, i) => i === 0 || a[i - 1] <= v), desc = d.every((v, i) => i === 0 || d[i - 1] >= v);
    res.push(`${nombre}: 1er clic ${asc ? 'asc' : desc ? '?' : 'NO ordena'} / 2º clic ${desc ? 'desc' : 'NO desc'} [${a}] -> [${d}]`);
  }
  console.log(w, 'botones', JSON.stringify(botones));
  for (const r of res) console.log('   ', r);
}
await b.close();
console.log('BLOQUEADAS', JSON.stringify(bloqueadas));
