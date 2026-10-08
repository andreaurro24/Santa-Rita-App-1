// SOLO LECTURA. Mide si Motivo/Fecha quedan a la vista o alcanzables en el diálogo Asignar,
// y qué elemento desborda Animales a 768 px. Bloquea POST/PATCH/PUT/DELETE.
import { chromium } from 'file:///C:/Users/danie/Documents/Video-Santa-Rita/herramienta/node_modules/playwright/index.mjs';
import { fechaSeed, sesion } from 'file:///C:/Users/danie/Documents/Video-Santa-Rita/herramienta/toma.mjs';
import path from 'node:path';
const APP = process.env.APP_URL ?? 'http://localhost:5173/';
const PRE = process.env.PRE ?? 'despues';
const CONTRATO = '#/al-partir/c63ee8dd-0aef-5e0e-ade8-9d8794842dc4';
const b = await chromium.launch({ channel: 'chrome' });
const s = await sesion();
const bloqueadas = [];
for (const [w, h] of [[320, 568], [375, 667], [375, 812], [390, 844]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, locale: 'es-CO', timezoneId: 'America/Bogota' });
  await ctx.route('**/*', (r) => { const q = r.request(); if (!['GET', 'HEAD', 'OPTIONS'].includes(q.method()) && !q.url().includes('/storage/v1/object/sign')) { bloqueadas.push(q.method() + ' ' + new URL(q.url()).pathname); return r.abort(); } return r.continue(); });
  const p = await ctx.newPage();
  await p.clock.setFixedTime(new Date(`${fechaSeed()}T19:30:00-05:00`));
  await p.goto(`${APP}#/login`); await p.evaluate(([k, v]) => localStorage.setItem(k, v), [s.clave, s.valor]);
  await p.goto(APP + CONTRATO); await p.reload(); await p.waitForLoadState('networkidle'); await p.waitForTimeout(1200);
  await p.getByRole('button', { name: 'Asignar animales' }).click();
  await p.getByRole('dialog').waitFor(); await p.waitForTimeout(600);
  const m = await p.evaluate(() => {
    const d = document.querySelector('[role=dialog]'); const form = d.querySelector('#form-asignar'); const ul = form.querySelector('ul');
    let cuerpo = form.parentElement; while (cuerpo && cuerpo !== d && !['auto', 'scroll'].includes(getComputedStyle(cuerpo).overflowY)) cuerpo = cuerpo.parentElement;
    const pie = d.querySelector('[data-dialogo-pie]').getBoundingClientRect();
    const fecha = d.querySelector('input[type=date]').getBoundingClientRect();
    const motivo = [...d.querySelectorAll('input')].filter((i) => i.type === 'text')[1].getBoundingClientRect();
    const r = { cuerpoScroll: cuerpo ? `${cuerpo.scrollHeight}/${cuerpo.clientHeight}` : 'sin cuerpo con scroll', ulAlto: Math.round(ul.getBoundingClientRect().height), motivoVisible: motivo.bottom <= pie.top + 0.5, fechaVisible: fecha.bottom <= pie.top + 0.5, fechaTop: Math.round(fecha.top), pieTop: Math.round(pie.top) };
    if (cuerpo) { cuerpo.scrollTop = cuerpo.scrollHeight; const f2 = d.querySelector('input[type=date]').getBoundingClientRect(); r.fechaVisibleTrasScroll = f2.bottom <= d.querySelector('[data-dialogo-pie]').getBoundingClientRect().top + 0.5; r.ulVisibleTrasScroll = Math.round(Math.max(0, Math.min(ul.getBoundingClientRect().bottom, cuerpo.getBoundingClientRect().bottom) - Math.max(ul.getBoundingClientRect().top, cuerpo.getBoundingClientRect().top))); }
    return r;
  });
  await p.screenshot({ path: path.join(import.meta.dirname, `${PRE}-${w}x${h}-dlg-asignar-fondo.png`) });
  console.log(PRE, `${w}x${h}`, JSON.stringify(m));
  await p.getByRole('dialog').locator('[data-dialogo-pie] > button', { hasText: 'Cancelar' }).click();
  await ctx.close();
}
// Desborde a 768 (anterior al diff, se mide igual en local y en Vercel).
const ctx = await b.newContext({ viewport: { width: 768, height: 1024 }, deviceScaleFactor: 1 });
await ctx.route('**/*', (r) => { const q = r.request(); if (!['GET', 'HEAD', 'OPTIONS'].includes(q.method())) { bloqueadas.push(q.method() + ' ' + new URL(q.url()).pathname); return r.abort(); } return r.continue(); });
const p = await ctx.newPage();
await p.goto(`${APP}#/login`); await p.evaluate(([k, v]) => localStorage.setItem(k, v), [s.clave, s.valor]);
await p.goto(APP + '#/animales'); await p.reload(); await p.waitForLoadState('networkidle'); await p.waitForTimeout(1200);
console.log('768', JSON.stringify(await p.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const enScroll = (e) => { for (let x = e.parentElement; x && x !== document.body; x = x.parentElement) { const o = getComputedStyle(x).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') return true; } return false; };
  return { sw: document.documentElement.scrollWidth, fuera: [...document.querySelectorAll('body *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.right > vw + 0.5 && !enScroll(e); }).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 70)} "${(e.innerText ?? '').replace(/\s+/g, ' ').slice(0, 40)}" r=${Math.round(e.getBoundingClientRect().right)}`).slice(0, 6) };
})));
await b.close();
console.log('BLOQUEADAS', bloqueadas);
