// SOLO LECTURA (verificador). Estrés de la tabla de #/animales con textos largos y caballos.
// Los datos se alteran SOLO en el navegador: se intercepta el GET de /rest/v1/animales y se
// devuelve una copia modificada (route.fulfill). Nada se escribe en Supabase; todo método que no
// sea GET/HEAD/OPTIONS se aborta (salvo el POST de /storage/v1/object/sign).
import { chromium } from 'file:///C:/Users/danie/Documents/Video-Santa-Rita/herramienta/node_modules/playwright/index.mjs';
import { sesion } from 'file:///C:/Users/danie/Documents/Video-Santa-Rita/herramienta/toma.mjs';
import path from 'node:path';
import { mkdirSync } from 'node:fs';

const SP = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const SHOTS = path.join(SP, 'verif-shots');
mkdirSync(SHOTS, { recursive: true });
const SERVIDORES = { despues: 'http://localhost:5173/', antes: 'http://localhost:5181/' };
const ANCHOS = [768, 1024, 1279, 1280, 1366, 1440, 1536, 1920];
const BARRAS = process.env.BARRAS === '1';

// Escenarios de datos (todos dentro de los maxLength del formulario: número 30, chapeta 30, raza 40, color 40, dueño 80).
const ESCENARIOS = {
  realista: (r, i) => ({
    ...r,
    numero_interno: i % 3 === 0 ? `Novillo Cebú Pintado ${r.numero_interno}` : r.numero_interno,
    chapeta_ica: `COL-2026-${String(10000000 + i)}`,
    raza: 'Brahman x Gyr',
    dueno: 'Miguel Ángel Rodríguez Pérez',
    lote: r.lote ? { ...r.lote, nombre: 'Lote 2026-B Ceba Bosconia' } : r.lote,
    peso_ingreso_kg: 1234.5,
    precio_compra_kg_cop: 12345,
    contrato: i % 2 ? { id: 'x', porcentaje_ganancia: 50, tenedor: { nombre: 'Pedro', finca: { nombre: 'La Esperanza' } } } : r.contrato,
  }),
  maximo: (r, i) => ({
    ...r,
    numero_interno: `${'N'.repeat(26)}${String(i).padStart(4, '0')}`,
    chapeta_ica: `${'C'.repeat(26)}${String(i).padStart(4, '0')}`,
    raza: 'R'.repeat(40),
    dueno: 'Miguel Ángel Rodríguez Pérez de la Santísima Trinidad Gómez Sánchez y Ortega'.slice(0, 80),
    lote: r.lote ? { ...r.lote, nombre: 'Lote de ceba novillos comprados en Bosconia segundo semestre 2026' } : r.lote,
    peso_ingreso_kg: 1234.5,
    precio_compra_kg_cop: 123456,
    contrato: { id: 'x', porcentaje_ganancia: 50, tenedor: { nombre: 'Pedro', finca: { nombre: 'La Esperanza' } } },
  }),
};

const s = await sesion();
const b = await chromium.launch({ channel: 'chrome', ignoreDefaultArgs: BARRAS ? ['--hide-scrollbars'] : [] });
const bloqueadas = [];
const consola = [];
for (const [nombreEsc, transformar] of Object.entries(ESCENARIOS)) {
  for (const cual of ['antes', 'despues']) {
    const APP = SERVIDORES[cual];
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, locale: 'es-CO', timezoneId: 'America/Bogota' });
    await ctx.route('**/*', async (r) => {
      const q = r.request();
      if (!['GET', 'HEAD', 'OPTIONS'].includes(q.method()) && !q.url().includes('/storage/v1/object/sign')) {
        bloqueadas.push(`${cual} ${q.method()} ${new URL(q.url()).pathname}`);
        return r.abort();
      }
      const u = new URL(q.url());
      if (q.method() === 'GET' && u.pathname === '/rest/v1/animales' && u.searchParams.get('select')?.includes('pesajes')) {
        const resp = await r.fetch();
        const filas = await resp.json();
        const ganado = filas.map(transformar);
        // 22 caballos sintéticos (para ver la tabla de caballos y la paginación de 20).
        const base = filas[0];
        const caballos = Array.from({ length: 22 }, (_, i) => transformar({ ...base, id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, especie: 'equino', categoria: i % 2 ? 'yegua' : 'caballo', numero_interno: `Lucero ${i}`, color: i % 2 ? 'Alazán tostado con medias blancas' : 'Moro', foto_path: null, pesajes: [], lote: null, contrato: null, costo_compra_cop: 12_500_000 }, i));
        return r.fulfill({ response: resp, json: [...ganado, ...caballos] });
      }
      return r.continue();
    });
    const p = await ctx.newPage();
    p.on('console', (m) => { if (m.type() === 'error') consola.push(`${cual}/${nombreEsc}: ${m.text().slice(0, 160)}`); });
    await p.goto(`${APP}#/login`);
    await p.evaluate(([k, v]) => localStorage.setItem(k, v), [s.clave, s.valor]);
    for (const ruta of ['#/animales?estado=todos', '#/animales?ver=caballos']) {
      for (const w of ANCHOS) {
        await p.setViewportSize({ width: w, height: 900 });
        await p.goto(APP + ruta);
        await p.reload();
        await p.waitForLoadState('networkidle');
        await p.getByRole('heading', { name: 'Animales', level: 1 }).waitFor();
        await p.waitForTimeout(600);
        const m = await p.evaluate(() => {
          const de = document.documentElement;
          const vis = (e) => e && e.checkVisibility();
          const t = [...document.querySelectorAll('main table')].find(vis);
          const tabla = t ? { sw: t.parentElement.scrollWidth, cw: t.parentElement.clientWidth, filas: t.querySelectorAll('tbody tr').length, anchoCols: [...t.querySelectorAll('thead th')].filter(vis).map((th) => `${th.innerText.trim().slice(0, 10)}:${Math.round(th.getBoundingClientRect().width)}`) } : null;
          const tarjetas = [...document.querySelectorAll('main ul')].filter((u) => vis(u) && u.className.includes('divide-y')).map((u) => u.querySelectorAll('li').length);
          return { sw: de.scrollWidth, cw: de.clientWidth, tabla, tarjetas };
        });
        const ok = m.sw === m.cw && (!m.tabla || m.tabla.sw === m.tabla.cw);
        console.log(`${ok ? 'OK ' : 'MAL'} ${nombreEsc.padEnd(8)} ${cual.padEnd(7)} ${ruta.padEnd(24)} ${String(w).padStart(4)} pag=${m.sw}/${m.cw} tabla=${m.tabla ? `${m.tabla.sw}/${m.tabla.cw}(${m.tabla.filas}f) ${m.tabla.anchoCols.join(' ')}` : '-'} tarjetas=${m.tarjetas.join(',') || '-'}`);
        if (cual === 'despues' && [1024, 1280, 1536].includes(w)) await p.screenshot({ path: path.join(SHOTS, `${BARRAS ? 'barras-' : ''}estres-${nombreEsc}-${w}-${ruta.replace(/[^a-z]+/g, '_')}.png`), fullPage: false });
      }
    }
    await ctx.close();
  }
}
await b.close();
console.log('BLOQUEADAS', JSON.stringify(bloqueadas));
console.log('CONSOLA', JSON.stringify(consola));
