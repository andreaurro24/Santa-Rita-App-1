import { chromium } from 'file:///C:/Users/danie/Documents/Video-Santa-Rita/herramienta/node_modules/playwright/index.mjs';
import { fechaSeed, sesion } from 'file:///C:/Users/danie/Documents/Video-Santa-Rita/herramienta/toma.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const APP = process.env.APP_URL ?? 'http://localhost:5173/';
const DIR = path.join(import.meta.dirname, process.env.SUBDIR ?? 'capturas'); mkdirSync(DIR, { recursive: true });
const LOTE = '#/lotes/9b03a289-5fbc-561d-98a0-f58dc3364cb1';
const CONTRATO = '#/al-partir/c63ee8dd-0aef-5e0e-ade8-9d8794842dc4';
const JORNADA = '#/pesaje/c4df9f2b-1364-47ec-b75e-d12977212ae6';
const VENTA = '#/ventas/92eaf3d9-7685-5b32-8e08-1fef097b9f8b';
const FICHA = '#/animales/0ce5d39f-04dd-5e5e-a6a7-69fd3e4288a9'; // Relámpago-003, el nombre más largo
const SIM = !!process.env.SIMULAR_ABIERTA;
const VIEWS = (process.env.VIEWS ?? '375x812,390x844,1280x800,1440x900').split(',').map((v) => { const [w, h] = v.split('x').map(Number); return { width: w, height: h }; });

function medir() {
  const vw = document.documentElement.clientWidth;
  const vis = (e) => e.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true });
  const lineas = (el) => {
    const tops = [];
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (!n.textContent.trim() || n.parentElement.closest('.sr-only')) continue;
      const r = document.createRange(); r.selectNodeContents(n);
      for (const x of r.getClientRects()) if (x.width > 1 && !tops.some((t) => Math.abs(t - x.top) < 3)) tops.push(x.top);
    }
    return tops.length;
  };
  const txt = (e) => e.innerText.replace(/\s+/g, ' ').trim().slice(0, 45);
  const enScroll = (e) => { for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll') return true; } return false; };
  const chap = [...document.querySelectorAll('span.bg-chapeta')].filter(vis);
  const chapetasPartidas = chap.filter((e) => lineas(e) > 1).map(txt);
  const cont = (e) => e.closest('li, label, a, button') ?? e.parentElement;
  const chapetasFuera = chap.filter((e) => {
    const r = e.getBoundingClientRect(); const rc = cont(e).getBoundingClientRect();
    return r.right > vw + 0.5 || r.right > rc.right + 0.5 || r.left < rc.left - 0.5;
  }).map((e) => `${txt(e)} (${Math.round(e.getBoundingClientRect().right)} > ${Math.round(cont(e).getBoundingClientRect().right)})`);
  const botonesPartidos = [...document.querySelectorAll('button, a[href]')].filter(vis).filter((e) => e.innerText.trim() && e.querySelectorAll('span.bg-chapeta, p, div, ul, li, h2, h3').length === 0 && lineas(e) > 1).map(txt);
  const kgPartidos = [];
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    if (n.children.length || !vis(n)) continue;
    if (/^\s*[\d.,]+\s*kg\s*$/.test(n.textContent) && lineas(n) > 1) kgPartidos.push(n.textContent.trim());
  }
  const recortados = [...document.querySelectorAll('body *')].filter(vis).filter((e) => e.children.length === 0 && e.textContent.trim() && e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).textOverflow === 'ellipsis').map((e) => `${e.textContent.trim().slice(0, 50)} (${e.clientWidth}/${e.scrollWidth}px)`);
  const fuera = [...document.querySelectorAll('body *')].filter(vis).filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > vw + 0.5 && !e.closest('[aria-hidden="true"]') && !enScroll(e); }).map((e) => `${e.tagName.toLowerCase()} "${(e.innerText ?? '').replace(/\s+/g, ' ').slice(0, 30)}" (${Math.round(e.getBoundingClientRect().right)})`).slice(0, 8);
  const pie = document.querySelector('[data-dialogo-pie]');
  const piebotones = pie ? [...pie.querySelectorAll(':scope > button')].map((b) => { const r = b.getBoundingClientRect(); return { t: b.innerText.trim(), x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), lineas: lineas(b) }; }) : null;
  const pieVisible = pie ? pie.getBoundingClientRect().bottom <= innerHeight + 0.5 : null;
  return { scrollWidth: document.documentElement.scrollWidth, vw, chapetas: chap.length, chapetasPartidas, chapetasFuera, botonesPartidos, kgPartidos, recortados, fuera, piebotones, pieVisible };
}

const b = await chromium.launch({ channel: 'chrome' });
const s = await sesion();
const resultados = [];
const consola = [], red = [], bloqueadas = [];
for (const v of VIEWS) {
  const ctx = await b.newContext({ viewport: v, deviceScaleFactor: 1, locale: 'es-CO', timezoneId: 'America/Bogota' });
  await ctx.route('**/*', async (r) => {
    const q = r.request(); const u = q.url();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(q.method()) && (u.includes('/rest/v1') || (u.includes('/storage/v1') && !u.includes('/object/sign')))) { bloqueadas.push(`${q.method()} ${u.split('?')[0]}`); return r.abort(); }
    // Jornada abierta SIMULADA solo en este navegador (respuesta reescrita; no se escribe nada en la base).
    if (SIM && q.method() === 'GET' && u.includes('/rest/v1/jornadas_pesaje')) {
      const resp = await r.fetch(); const datos = await resp.json();
      const arreglar = (j) => (j && j.id === 'c4df9f2b-1364-47ec-b75e-d12977212ae6' ? { ...j, estado: 'abierta', cerrada_at: null, pesajes: (j.pesajes ?? []).slice(0, 2) } : j);
      const nuevo = Array.isArray(datos) ? datos.map(arreglar) : arreglar(datos);
      return r.fulfill({ response: resp, body: JSON.stringify(nuevo) });
    }
    return r.continue();
  });
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error') consola.push(`${v.width}: ${m.text().slice(0, 200)}`); });
  p.on('response', (r) => { if (r.status() >= 400) red.push(`${v.width}: ${r.status()} ${r.request().method()} ${r.url().split('?')[0]}`); });
  await p.clock.setFixedTime(new Date(`${fechaSeed()}T19:30:00-05:00`));
  await p.goto(`${APP}#/login`); await p.evaluate(([k, val]) => localStorage.setItem(k, val), [s.clave, s.valor]);
  let primera = true;
  const tag = `${v.width}`;
  const ir = async (ruta) => { await p.goto(APP + ruta); if (primera) { await p.reload(); primera = false; } await p.waitForLoadState('networkidle'); await p.waitForTimeout(1200); };
  const registrar = async (nombre, full = true) => {
    const m = await p.evaluate(medir);
    await p.screenshot({ path: path.join(DIR, `${tag}-${nombre}.png`), fullPage: full });
    resultados.push({ vista: tag, pantalla: nombre, ...m });
  };
  const dialogo = async (nombre, abrir, cerrarCon = 'Cancelar') => {
    try {
      await abrir();
      await p.getByRole('dialog').waitFor({ timeout: 5000 }); await p.waitForTimeout(600);
      await registrar(`dlg-${nombre}`, false);
      const d = p.getByRole('dialog');
      const btn = d.locator('[data-dialogo-pie] > button', { hasText: cerrarCon });
      if (await btn.count()) await btn.first().click(); else await d.getByRole('button', { name: 'Cerrar' }).click();
      await p.getByRole('dialog').waitFor({ state: 'detached', timeout: 5000 });
    } catch (e) { resultados.push({ vista: tag, pantalla: `dlg-${nombre}`, error: String(e).slice(0, 200) }); await p.keyboard.press('Escape').catch(() => {}); }
  };
  if (SIM) {
    await ir(JORNADA); await registrar('jornada-abierta-SIMULADA');
    await dialogo('cerrar-jornada-SIMULADA', () => p.getByRole('button', { name: 'Cerrar jornada' }).first().click(), 'Seguir pesando');
    await ctx.close(); continue;
  }
  await ir('#/'); await registrar('inicio');
  await ir('#/animales'); await registrar('animales');
  await ir(FICHA); await registrar('ficha-relampago');
  await dialogo('registrar-peso', () => p.getByRole('button', { name: 'Registrar peso' }).first().click());
  await ir(LOTE); await registrar('lote');
  await dialogo('editar-lote', () => p.getByRole('button', { name: 'Editar lote' }).click());
  await dialogo('mover-seleccionados', async () => { const cb = p.locator('input[type=checkbox][aria-label^="Seleccionar"]'); await cb.nth(0).check(); await cb.nth(1).check(); await p.getByRole('button', { name: /Mover seleccionados/ }).click(); });
  await ir('#/pesaje'); await registrar('pesaje');
  await ir(JORNADA); await registrar('jornada-cerrada');
  await ir(CONTRATO); await registrar('contrato');
  await dialogo('asignar-animales', () => p.getByRole('button', { name: 'Asignar animales' }).click());
  await dialogo('registrar-visita', () => p.getByRole('button', { name: 'Registrar visita' }).click());
  await ir('#/ventas'); await registrar('ventas');
  await ir(VENTA); await registrar('venta-detalle');
  await ir('#/ventas/nueva'); await registrar('ventas-nueva');
  await ir('#/costos'); await registrar('costos');
  await dialogo('anotar-gasto', () => p.getByRole('button', { name: 'Anotar gasto' }).first().click());
  await ctx.close();
}
await b.close();
writeFileSync(path.join(import.meta.dirname, (process.env.SUBDIR ?? '') + (SIM ? 'resultados-abierta.json' : 'resultados.json')), JSON.stringify({ resultados, consola, red, bloqueadas }, null, 1));
for (const r of resultados) {
  const malo = r.error || r.scrollWidth > r.vw || r.chapetasPartidas?.length || r.chapetasFuera?.length || r.botonesPartidos?.length || r.kgPartidos?.length || r.recortados?.length || r.fuera?.length || r.piebotones?.some((x) => x.lineas > 1) || r.pieVisible === false;
  console.log(`${malo ? 'XX' : 'ok'} ${r.vista} ${r.pantalla} sw=${r.scrollWidth}/${r.vw} chap=${r.chapetas}`, r.error ?? '', malo ? JSON.stringify({ cp: r.chapetasPartidas, cf: r.chapetasFuera, bp: r.botonesPartidos, kg: r.kgPartidos, rec: r.recortados, fuera: r.fuera }) : '', r.piebotones ? 'pie=' + JSON.stringify(r.piebotones) + ' vis=' + r.pieVisible : '');
}
console.log('CONSOLA', consola); console.log('RED', red); console.log('BLOQUEADAS', bloqueadas);
