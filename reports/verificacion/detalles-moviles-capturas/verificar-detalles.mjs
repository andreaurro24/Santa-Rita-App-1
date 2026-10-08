// Recorrido de SOLO LECTURA: Animales (tarjetas, cabecera, tabla) y diálogo Asignar del contrato.
// Bloquea en el navegador cualquier POST/PATCH/PUT/DELETE. No imprime credenciales.
// Uso: node verificar-detalles.mjs   (APP_URL=<url> PRE=antes para la línea base)
import { chromium } from 'file:///C:/Users/danie/Documents/Video-Santa-Rita/herramienta/node_modules/playwright/index.mjs';
import { fechaSeed, sesion } from 'file:///C:/Users/danie/Documents/Video-Santa-Rita/herramienta/toma.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const APP = process.env.APP_URL ?? 'http://localhost:5173/';
const PRE = process.env.PRE ?? 'despues';
const DIR = import.meta.dirname; mkdirSync(DIR, { recursive: true });
const CONTRATO = '#/al-partir/c63ee8dd-0aef-5e0e-ade8-9d8794842dc4';
const VIEWS = (process.env.VIEWS ?? '320x640,375x812,390x844,768x1024,1280x800,1440x900').split(',').map((v) => { const [w, h] = v.split('x').map(Number); return { width: w, height: h }; });
const SOLO_ANIMALES = !!process.env.SOLO_ANIMALES;

function medirAnimales() {
  const vw = document.documentElement.clientWidth;
  const vis = (e) => e.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true });
  const lineas = (el) => { const tops = []; const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); for (let n = w.nextNode(); n; n = w.nextNode()) { if (!n.textContent.trim() || n.parentElement.closest('.sr-only')) continue; const r = document.createRange(); r.selectNodeContents(n); for (const x of r.getClientRects()) if (x.width > 1 && !tops.some((t) => Math.abs(t - x.top) < 3)) tops.push(x.top); } return tops.length; };
  const botones = [...document.querySelectorAll('button')].filter(vis).filter((b) => /^(Editar lotes|Crear lote|Añadir animal|Registrar caballo)$/.test(b.innerText.trim())).map((b) => { const r = b.getBoundingClientRect(); return { t: b.innerText.trim(), lineas: lineas(b), x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), desborda: b.scrollWidth > b.clientWidth + 1 || r.right > vw + 0.5 }; });
  const ulT = document.querySelector('ul.md\\:hidden');
  const tarjetas = ulT && vis(ulT) ? [...ulT.querySelectorAll(':scope > li')].map((li) => {
    const a = li.querySelector('a'); const col = a.querySelector('div.min-w-0'); const nombre = col.querySelector('p.text-lg');
    const ps = col.querySelectorAll(':scope > p'); const peso = ps.length > 2 ? ps[2] : null;
    const ins = col.querySelector(':scope > div.flex-wrap'); const cr = col.getBoundingClientRect(); const ar = a.getBoundingClientRect();
    const badges = ins ? [...ins.children].map((b) => { const r = b.getBoundingClientRect(); return { t: b.innerText.trim(), lineas: lineas(b), fueraCol: r.right > cr.right + 0.5 || r.left < cr.left - 0.5 }; }) : [];
    const chev = a.querySelector(':scope > svg').getBoundingClientRect();
    const badgeFueraDeColumna = [...a.querySelectorAll('span')].some((sp) => /^(Pierde peso|Al partir|Vendido|Muerto|Perdido)$/.test(sp.innerText.trim()) && !col.contains(sp));
    const ultimoP = ps[ps.length - 1];
    return {
      nombre: nombre.textContent, nombreCortado: nombre.scrollWidth > nombre.clientWidth + 1, nombreAncho: `${nombre.clientWidth}/${nombre.scrollWidth}`, colAncho: Math.round(cr.width),
      pesoLineas: peso ? lineas(peso) : null,
      insigniasDebajoPeso: ins ? ins.getBoundingClientRect().top >= (peso ?? ultimoP).getBoundingClientRect().bottom - 0.5 : null,
      badges, badgeFueraDeColumna, chevronDentro: chev.right <= ar.right + 0.5, alto: Math.round(li.getBoundingClientRect().height),
    };
  }) : null;
  const tabla = document.querySelector('table'); let t = null;
  if (tabla && vis(tabla)) {
    const filas = [...tabla.querySelectorAll('tbody tr')]; const cont = tabla.parentElement;
    t = {
      filas: filas.length, altos: [...new Set(filas.map((f) => Math.round(f.getBoundingClientRect().height)))], ths: [...tabla.querySelectorAll('th')].filter(vis).map((x) => x.innerText.trim()),
      scrollInterno: `${cont.scrollWidth}/${cont.clientWidth}`,
      cifrasPartidas: [...tabla.querySelectorAll('td.cifra')].filter((c) => lineas(c) > 1).length,
      nombresPartidos: filas.filter((f) => { const c = f.querySelector('td span.bg-chapeta, td a p, td a span'); return c && lineas(c) > 1; }).length,
    };
  }
  const recortados = [...document.querySelectorAll('body *')].filter(vis).filter((e) => e.children.length === 0 && e.textContent.trim() && e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).textOverflow === 'ellipsis').map((e) => `${e.textContent.trim().slice(0, 50)} (${e.clientWidth}/${e.scrollWidth}px)`);
  const pagTxt = [...document.querySelectorAll('span.min-w-12')].map((x) => x.innerText.replace(/\s+/g, '')).join('');
  return { sw: document.documentElement.scrollWidth, vw, botones, tarjetas, tabla: t, recortados, pagina: pagTxt };
}

function medirAsignar() {
  const lineas = (el) => { const tops = []; const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); for (let n = w.nextNode(); n; n = w.nextNode()) { if (!n.textContent.trim()) continue; const r = document.createRange(); r.selectNodeContents(n); for (const x of r.getClientRects()) if (x.width > 1 && !tops.some((t) => Math.abs(t - x.top) < 3)) tops.push(x.top); } return tops.length; };
  const d = document.querySelector('[role=dialog]'); const ul = d.querySelector('#form-asignar ul');
  const inp = [...d.querySelectorAll('input')].find((i) => i.type === 'text');
  const ur = ul.getBoundingClientRect(); const lis = [...ul.querySelectorAll(':scope > li')];
  const tops = []; for (const li of lis) { const tp = Math.round(li.getBoundingClientRect().top); const f = tops.find((x) => Math.abs(x.top - tp) < 3); if (f) f.n++; else tops.push({ top: tp, n: 1 }); }
  const completas = lis.filter((li) => { const r = li.getBoundingClientRect(); return r.top >= ur.top - 0.5 && r.bottom <= ur.bottom + 0.5; }).length;
  const pie = d.querySelector('[data-dialogo-pie]');
  return {
    inputMode: inp.getAttribute('inputmode'), placeholder: inp.placeholder, type: inp.type,
    ulDisplay: getComputedStyle(ul).display, ulMaxH: getComputedStyle(ul).maxHeight, ulAlto: Math.round(ur.height), ulAncho: Math.round(ur.width), ulScroll: `${ul.scrollHeight}/${ul.clientHeight}`,
    liAnchos: [...new Set(lis.map((li) => Math.round(li.getBoundingClientRect().width)))].slice(0, 6),
    candidatos: lis.length, porFila: tops.map((x) => x.n), filas: tops.length, completasVisibles: completas,
    chapetasPartidas: lis.filter((li) => lineas(li.querySelector('span.bg-chapeta')) > 1).length,
    liFuera: lis.filter((li) => li.getBoundingClientRect().right > ur.right + 0.5).length,
    dialogoScrollX: `${d.scrollWidth}/${d.clientWidth}`, docScrollX: `${document.documentElement.scrollWidth}/${document.documentElement.clientWidth}`,
    pieVisible: pie ? pie.getBoundingClientRect().bottom <= innerHeight + 0.5 : null,
    pieBotones: pie ? [...pie.querySelectorAll(':scope > button')].map((b) => `${b.innerText.trim()}:${lineas(b)}l`) : null,
    nombres: lis.map((li) => li.querySelector('span.bg-chapeta').textContent.trim()),
    textoVacio: lis.length ? null : (ul.nextElementSibling?.innerText ?? '').slice(0, 60),
    ulVisibleAltoCero: lis.length === 0 ? Math.round(ur.height) : null,
  };
}

const b = await chromium.launch({ channel: 'chrome' });
const s = await sesion();
const out = { animales: [], asignar: [], busquedas: [], consola: [], red: [], bloqueadas: [], errores: [] };
for (const v of VIEWS) {
  const ctx = await b.newContext({ viewport: v, deviceScaleFactor: 1, locale: 'es-CO', timezoneId: 'America/Bogota' });
  await ctx.route('**/*', (r) => { const q = r.request(); const u = q.url(); if (!['GET', 'HEAD', 'OPTIONS'].includes(q.method()) && !(u.includes('/storage/v1/object/sign'))) { out.bloqueadas.push(`${q.method()} ${u.split('?')[0]}`); return r.abort(); } return r.continue(); });
  const p = await ctx.newPage(); const tag = `${v.width}`;
  p.on('console', (m) => { if (m.type() === 'error') out.consola.push(`${tag}: ${m.text().slice(0, 200)}`); });
  p.on('response', (r) => { if (r.status() >= 400) out.red.push(`${tag}: ${r.status()} ${r.request().method()} ${r.url().split('?')[0]}`); });
  await p.clock.setFixedTime(new Date(`${fechaSeed()}T19:30:00-05:00`));
  await p.goto(`${APP}#/login`); await p.evaluate(([k, val]) => localStorage.setItem(k, val), [s.clave, s.valor]);
  let primera = true;
  const ir = async (ruta) => { await p.goto(APP + ruta); if (primera) { await p.reload(); primera = false; } await p.waitForLoadState('networkidle'); await p.waitForTimeout(1200); };
  try {
    for (const [nombre, ruta] of [['animales', '#/animales'], ['animales-todos', '#/animales?estado=todos'], ['caballos', '#/animales?ver=caballos']]) {
      await ir(ruta);
      for (let pag = 1; pag <= 10; pag++) {
        const m = await p.evaluate(medirAnimales);
        out.animales.push({ vista: tag, pantalla: nombre, pag, ...m });
        await p.screenshot({ path: path.join(DIR, `${PRE}-${tag}-${nombre}-p${pag}.png`), fullPage: true });
        const sig = p.getByRole('button', { name: 'Página siguiente' });
        if (!(await sig.count()) || (await sig.isDisabled())) break;
        await sig.click(); await p.waitForTimeout(500);
      }
    }
    if (!SOLO_ANIMALES) {
      await ir(CONTRATO);
      await p.getByRole('button', { name: 'Asignar animales' }).click();
      await p.getByRole('dialog').waitFor({ timeout: 5000 }); await p.waitForTimeout(600);
      const m = await p.evaluate(medirAsignar); out.asignar.push({ vista: tag, ...m });
      await p.screenshot({ path: path.join(DIR, `${PRE}-${tag}-dlg-asignar.png`) });
      const todos = m.nombres;
      const input = p.getByRole('dialog').getByLabel('Buscar por nombre');
      const sinTildes = (t) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
      for (const q of ['paloma', 'PALOMA', 'PaLoMa', '  paloma  ', 'moro', 'MORO', 'relampago', 'Relámpago', 'RELÁMPAGO', '00', 'zzz', '']) {
        await input.fill(q); await p.waitForTimeout(150);
        const r = await p.evaluate(medirAsignar);
        const esperado = todos.filter((n) => n.toLowerCase().includes(q.trim().toLowerCase()));
        const esperadoSinTildes = todos.filter((n) => sinTildes(n).includes(sinTildes(q.trim())));
        out.busquedas.push({ vista: tag, q, n: r.candidatos, nombres: r.nombres.slice(0, 6), coincideMinus: JSON.stringify(r.nombres) === JSON.stringify(esperado), esperadoSinTildes: esperadoSinTildes.length, textoVacio: r.textoVacio, ulAltoVacio: r.ulVisibleAltoCero });
        if (['PALOMA', 'zzz', 'relampago'].includes(q)) await p.screenshot({ path: path.join(DIR, `${PRE}-${tag}-dlg-asignar-buscar-${q}.png`) });
      }
      await p.getByRole('dialog').locator('[data-dialogo-pie] > button', { hasText: 'Cancelar' }).click();
      await p.getByRole('dialog').waitFor({ state: 'detached', timeout: 5000 });
    }
  } catch (e) { out.errores.push(`${tag}: ${String(e).slice(0, 300)}`); }
  await ctx.close();
}
await b.close();
writeFileSync(path.join(DIR, `${PRE}-resultados.json`), JSON.stringify(out, null, 1));
for (const a of out.animales) {
  const malas = (a.tarjetas ?? []).filter((t) => t.nombreCortado || t.pesoLineas > 1 || t.insigniasDebajoPeso === false || t.badgeFueraDeColumna || t.badges.some((x) => x.lineas > 1 || x.fueraCol) || !t.chevronDentro);
  const conIns = (a.tarjetas ?? []).filter((t) => t.badges.length);
  console.log(`${a.vista} ${a.pantalla} p${a.pag}(${a.pagina}) sw=${a.sw}/${a.vw} tarjetas=${a.tarjetas?.length ?? '-'} conInsignias=${conIns.length} malas=${malas.length}`, JSON.stringify(malas.slice(0, 4)), 'botones=' + JSON.stringify(a.botones), a.tabla ? 'tabla=' + JSON.stringify(a.tabla) : '', a.recortados.length ? 'REC=' + JSON.stringify(a.recortados) : '');
}
for (const a of out.asignar) { const { nombres, ...r } = a; console.log('ASIGNAR', JSON.stringify(r)); }
for (const q of out.busquedas) console.log('BUSCA', q.vista, JSON.stringify(q.q), q.n, q.coincideMinus ? 'ok' : 'XX', 'sinTildes=' + q.esperadoSinTildes, JSON.stringify(q.nombres), q.textoVacio ?? '', q.ulAltoVacio ?? '');
console.log('CONSOLA', out.consola); console.log('RED', out.red); console.log('BLOQUEADAS', out.bloqueadas); console.log('ERRORES', out.errores);
