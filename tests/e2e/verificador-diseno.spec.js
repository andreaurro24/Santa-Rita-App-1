import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { clientePrueba, entrar, iniciarSesion } from './helpers';

// Pruebas del VERIFICADOR para la spec 002 (sistema de diseño y layout adaptable), ronda 1.
// Mide en el navegador lo que las pruebas del implementador no cubren: áreas táctiles en TODAS
// las pantallas y formularios abiertos, contraste real de cada texto contra su fondo efectivo,
// formularios como hoja inferior (R9), foco con teclado, fuentes, marca e impresión.
// No crea datos: abre los formularios y los cancela. Las capturas quedan en test-results/vrf-diseno/.

const DIR = 'test-results/vrf-diseno';
mkdirSync(DIR, { recursive: true });
const ANIMAL = '0101';

// ---------- utilidades que corren en la página ----------

// Controles interactivos visibles con su tamaño (R5 pide 48×48 en celular).
function medirControles() {
  const sel = 'a[href], button, input:not([type=hidden]), select, textarea, [role=button], [tabindex]:not([tabindex="-1"])';
  return [...document.querySelectorAll(sel)]
    .filter((el) => el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }))
    .map((el) => {
      const r = el.getBoundingClientRect();
      const texto = (el.getAttribute('aria-label') || el.innerText || el.placeholder || el.value || el.tagName).trim().replace(/\s+/g, ' ');
      return { texto: texto.slice(0, 40), tag: el.tagName.toLowerCase(), ancho: Math.round(r.width), alto: Math.round(r.height) };
    })
    .filter((c) => c.alto < 47.5 || c.ancho < 47.5);
}

// Desborde horizontal de la página y elementos que se salen del viewport o recortan su texto.
function medirDesborde() {
  const vw = document.documentElement.clientWidth;
  const fuera = [...document.querySelectorAll('body *')]
    .filter((el) => el.checkVisibility())
    .filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && (r.right > vw + 0.5 || r.left < -0.5);
    })
    .filter((el) => !el.closest('[aria-hidden="true"]'))
    .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)} (${Math.round(el.getBoundingClientRect().right)})`)
    .slice(0, 10);
  const recortados = [...document.querySelectorAll('body *')]
    .filter((el) => el.checkVisibility() && !el.closest('.sr-only') && el.children.length === 0 && el.textContent.trim())
    .filter((el) => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'visible')
    .map((el) => el.textContent.trim().slice(0, 50))
    .slice(0, 15);
  // Texto que se sale de su caja (una palabra larga en una columna estrecha no cambia el tamaño del elemento).
  const textoFuera = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const rg = document.createRange();
    rg.selectNodeContents(n);
    const b = rg.getBoundingClientRect();
    if (b.width && b.right > 375.5 && !n.parentElement.closest('nav, .sr-only')) textoFuera.push(`${n.textContent.trim().slice(0, 40)} (hasta ${Math.round(b.right)} px)`);
  }
  return { scrollWidth: document.documentElement.scrollWidth, fuera, recortados, textoFuera: textoFuera.slice(0, 10) };
}

// Contraste de cada texto visible contra su fondo efectivo (capas semitransparentes mezcladas).
function medirContraste() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 1;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  const rgba = (c) => {
    cx.clearRect(0, 0, 1, 1);
    cx.fillStyle = '#000';
    cx.fillStyle = c;
    cx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = cx.getImageData(0, 0, 1, 1).data;
    return [r, g, b, a / 255];
  };
  const sobre = (arriba, abajo) => {
    const a = arriba[3];
    return [0, 1, 2].map((i) => arriba[i] * a + abajo[i] * (1 - a)).concat(1);
  };
  const lum = ([r, g, b]) => {
    const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (x, y) => {
    const [a, b] = [lum(x), lum(y)].sort((m, n) => n - m);
    return (a + 0.05) / (b + 0.05);
  };
  const fondo = (el) => {
    const capas = [];
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const bg = rgba(getComputedStyle(n).backgroundColor);
      if (bg[3] > 0) capas.push(bg);
      if (bg[3] >= 1) break;
    }
    let color = [255, 255, 255, 1];
    for (const c of capas.reverse()) color = sobre(c, color);
    return color;
  };
  const hex = (c) => '#' + c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  const salida = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
    if (el.closest('[disabled], [aria-hidden="true"]')) continue;
    const propio = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!propio) continue;
    const cs = getComputedStyle(el);
    const esSvg = el instanceof SVGElement;
    let fg = rgba(esSvg ? cs.fill : cs.color);
    const bg = fondo(esSvg ? el.closest('div') : el);
    if (fg[3] < 1) fg = sobre(fg, bg);
    const tam = parseFloat(cs.fontSize);
    const grande = tam >= 24 || (tam >= 18.66 && Number(cs.fontWeight) >= 700);
    const r = ratio(fg, bg);
    salida.push({ texto: el.textContent.trim().slice(0, 30), fg: hex(fg), bg: hex(bg), ratio: Math.round(r * 100) / 100, minimo: grande ? 3 : 4.5 });
  }
  // Placeholders (el texto de ayuda del buscador es su única pista visible).
  for (const el of document.querySelectorAll('input[placeholder]')) {
    if (!el.checkVisibility() || el.value) continue;
    const fg0 = rgba(getComputedStyle(el, '::placeholder').color);
    const bg = fondo(el);
    const fg = fg0[3] < 1 ? sobre(fg0, bg) : fg0;
    salida.push({ texto: `placeholder: ${el.placeholder.slice(0, 24)}`, fg: hex(fg), bg: hex(bg), ratio: Math.round(ratio(fg, bg) * 100) / 100, minimo: 4.5 });
  }
  const pares = {};
  for (const s of salida) {
    const k = `${s.fg} sobre ${s.bg}`;
    pares[k] ??= { ratio: s.ratio, minimo: s.minimo, ejemplo: s.texto, n: 0 };
    pares[k].n++;
    pares[k].minimo = Math.max(pares[k].minimo, s.minimo);
  }
  return {
    fallan: salida.filter((s) => s.ratio < s.minimo),
    pares,
  };
}

async function registrar(nombre, datos) {
  console.log(`${nombre}: ${JSON.stringify(datos)}`);
  test.info().annotations.push({ type: nombre, description: JSON.stringify(datos) });
}

async function abrirFicha(page) {
  await page.goto('/#/animales');
  await page.getByPlaceholder(/Buscar por número/).fill(ANIMAL);
  await page.getByRole('link', { name: new RegExp(`^${ANIMAL}`) }).first().click();
  await expect(page.getByRole('heading', { name: `Animal N° ${ANIMAL}` })).toBeVisible();
}

// Escenarios: pantalla o formulario abierto. `preparar` deja la página en ese estado.
const ESCENARIOS = [
  ['inicio', async (p) => { await p.goto('/#/'); await expect(p.getByRole('heading', { name: /^Hola/ })).toBeVisible(); }],
  ['hato', async (p) => { await p.goto('/#/animales'); await expect(p.getByText(/reses activas/)).toBeVisible(); }],
  ['ficha', abrirFicha],
  ['ficha-form-peso', async (p) => { await abrirFicha(p); await p.getByRole('button', { name: 'Registrar peso' }).click(); }],
  ['ficha-form-sanidad', async (p) => { await abrirFicha(p); await p.getByRole('button', { name: 'Registrar evento' }).click(); }],
  ['mercado', async (p) => { await p.goto('/#/mercado'); await expect(p.getByRole('heading', { name: 'Precio y pasto' })).toBeVisible(); await p.waitForTimeout(1500); }],
  ['mercado-form-precio', async (p) => { await p.goto('/#/mercado'); await p.getByRole('button', { name: /Actualizar Gordo/ }).click(); await p.waitForTimeout(800); }],
  ['venta', async (p) => { await p.goto('/#/recomendacion'); await expect(p.getByRole('heading', { name: '¿Vendo?' })).toBeVisible(); await p.waitForTimeout(800); }],
  ['reporte', async (p) => { await p.goto('/#/reporte'); await expect(p.getByRole('article')).toBeVisible(); await p.waitForTimeout(800); }],
  ['form-nuevo-animal', async (p) => {
    await p.goto('/#/animales');
    await p.getByRole('button', { name: 'Registrar animal' }).click();
    await p.getByRole('dialog').getByLabel('Esquema').selectOption('Al partir');
  }],
];

// ---------- celular ----------

test.describe('celular 375×812', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

  test('VRF 002 R3/R5/R6: desborde, áreas táctiles y contraste en todas las pantallas y formularios abiertos', async ({ page }) => {
    test.setTimeout(180_000);
    const errores = [];
    page.on('console', (m) => m.type() === 'error' && errores.push(m.text().slice(0, 160)));
    page.on('pageerror', (e) => errores.push(`pageerror: ${e.message}`));

    const informe = {};
    // Login (antes de entrar).
    await page.goto('/#/login');
    await expect(page.getByRole('button', { name: 'Ingresar' })).toBeVisible();
    await page.screenshot({ path: `${DIR}/movil-login.png`, fullPage: true });
    informe.login = { pequenos: await page.evaluate(medirControles), desborde: await page.evaluate(medirDesborde), contraste: (await page.evaluate(medirContraste)).fallan };
    await entrar(page);
    await expect(page.getByRole('heading', { name: /^Hola/ })).toBeVisible();

    for (const [nombre, preparar] of ESCENARIOS) {
      await preparar(page);
      await page.screenshot({ path: `${DIR}/movil-${nombre}.png`, fullPage: true });
      informe[nombre] = {
        pequenos: await page.evaluate(medirControles),
        desborde: await page.evaluate(medirDesborde),
        contraste: (await page.evaluate(medirContraste)).fallan,
      };
      if (nombre === 'form-nuevo-animal') await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();
    }
    // Hoja "Más".
    await page.goto('/#/');
    await page.getByRole('button', { name: 'Más' }).click();
    await expect(page.getByRole('dialog', { name: 'Más secciones' })).toBeVisible();
    await page.screenshot({ path: `${DIR}/movil-hoja-mas.png` });
    informe['hoja-mas'] = { pequenos: await page.evaluate(medirControles), contraste: (await page.evaluate(medirContraste)).fallan };

    for (const [k, v] of Object.entries(informe)) await registrar(`movil ${k}`, v);
    await registrar('errores de consola', errores);
    for (const [k, v] of Object.entries(informe)) {
      expect.soft(v.pequenos, `${k}: controles de menos de 48×48 px`).toEqual([]);
      if (v.desborde) expect.soft(v.desborde.scrollWidth, `${k}: scroll horizontal`).toBeLessThanOrEqual(375);
      expect.soft(v.contraste, `${k}: textos por debajo de AA`).toEqual([]);
    }
    expect.soft(errores, 'errores de consola').toEqual([]);
  });

  test('VRF 002 R9: cada formulario en celular se abre como hoja inferior con Guardar a la vista', async ({ page }) => {
    await iniciarSesion(page);
    const resultado = {};
    const medirHoja = async (nombre) => {
      const dialogo = page.getByRole('dialog');
      const n = await dialogo.count();
      if (n === 0) {
        const guardar = page.getByRole('button', { name: 'Guardar' });
        resultado[nombre] = { hoja: false, guardarEnPantalla: await guardar.evaluate((b) => b.getBoundingClientRect().bottom <= innerHeight && b.getBoundingClientRect().top >= 0) };
        return;
      }
      const caja = await dialogo.boundingBox();
      resultado[nombre] = {
        hoja: true,
        x: Math.round(caja.x), ancho: Math.round(caja.width), arriba: Math.round(caja.y), abajo: Math.round(caja.y + caja.height),
        guardarEnPantalla: await dialogo.getByRole('button', { name: 'Guardar' }).evaluate((b) => b.getBoundingClientRect().bottom <= innerHeight),
      };
    };
    await page.goto('/#/animales');
    await page.getByRole('button', { name: 'Registrar animal' }).click();
    await page.getByRole('dialog').getByLabel('Esquema').selectOption('Al partir');
    // Bajar hasta el final del contenido: el pie con Guardar debe seguir visible.
    await page.getByRole('dialog').getByLabel(/Contrato/).scrollIntoViewIfNeeded();
    await medirHoja('nuevo animal');
    await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();

    await abrirFicha(page);
    await page.getByRole('button', { name: 'Registrar peso' }).click();
    await medirHoja('registrar peso');
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await page.getByRole('button', { name: 'Registrar evento' }).click();
    await medirHoja('registrar evento sanitario');
    await page.getByRole('button', { name: 'Cancelar' }).click();

    await page.goto('/#/mercado');
    await page.getByRole('button', { name: /Actualizar Gordo/ }).click();
    await medirHoja('actualizar precio');

    await registrar('R9 formularios', resultado);
    for (const [k, v] of Object.entries(resultado)) {
      expect.soft(v.hoja, `${k}: no se abre como hoja inferior`).toBe(true);
      expect.soft(v.guardarEnPantalla, `${k}: Guardar fuera de la pantalla`).toBe(true);
    }
  });

  test('VRF 002 a11y: hoja "Más" y hoja de formulario (Escape, foco dentro, foco de vuelta)', async ({ page }) => {
    await iniciarSesion(page);
    const r = {};
    const dentro = (nombre) => page.evaluate((n) => Boolean(document.activeElement?.closest(`[role=dialog]${n ? `[aria-label="${n}"]` : ''}`)), nombre);

    const mas = page.getByRole('button', { name: 'Más' });
    await mas.click();
    const hoja = page.getByRole('dialog', { name: 'Más secciones' });
    await expect(hoja).toBeVisible();
    r.masAriaModal = await hoja.getAttribute('aria-modal');
    r.masFocoAlAbrir = await dentro('Más secciones');
    for (let i = 0; i < 8; i++) await page.keyboard.press('Tab');
    r.masFocoTras8Tab = await dentro('Más secciones');
    await page.keyboard.press('Escape');
    r.masCierraConEscape = (await hoja.count()) === 0;
    if (!r.masCierraConEscape) await hoja.getByRole('button', { name: 'Cerrar', exact: true }).click();

    await page.goto('/#/animales');
    const abrir = page.getByRole('button', { name: 'Registrar animal' });
    await abrir.click();
    const modal = page.getByRole('dialog', { name: 'Registrar animal' });
    await expect(modal).toBeVisible();
    r.modalFocoAlAbrir = await dentro(null);
    for (let i = 0; i < 20; i++) await page.keyboard.press('Tab');
    r.modalFocoTras20Tab = await dentro(null);
    await page.keyboard.press('Escape');
    r.modalCierraConEscape = (await modal.count()) === 0;
    r.focoVuelveAlBoton = await abrir.evaluate((b) => document.activeElement === b);

    await registrar('a11y hojas', r);
    expect.soft(r.masCierraConEscape, 'la hoja "Más" no se cierra con Escape').toBe(true);
    expect.soft(r.masFocoAlAbrir, 'al abrir "Más" el foco no entra en la hoja').toBe(true);
    expect.soft(r.masFocoTras8Tab, 'el tabulador sale de la hoja "Más" hacia la página de atrás').toBe(true);
    expect.soft(r.modalFocoAlAbrir, 'al abrir el formulario el foco no entra en la hoja').toBe(true);
    expect.soft(r.modalFocoTras20Tab, 'el tabulador sale del formulario hacia la página de atrás').toBe(true);
    expect.soft(r.modalCierraConEscape).toBe(true);
  });

  test('VRF 002 capturas de lo que ve el usuario (solo la pantalla, sin página completa)', async ({ page }) => {
    await iniciarSesion(page);
    await page.screenshot({ path: `${DIR}/vp-movil-inicio.png` });
    await page.goto('/#/animales');
    await expect(page.getByText(/reses activas/)).toBeVisible();
    await page.screenshot({ path: `${DIR}/vp-movil-hato.png` });
    await abrirFicha(page);
    await page.getByRole('button', { name: 'Registrar peso' }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${DIR}/vp-movil-tras-registrar-peso.png` });
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await page.getByRole('button', { name: 'Registrar evento' }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${DIR}/vp-movil-tras-registrar-evento.png` });
    await page.goto('/#/animales');
    await page.getByRole('button', { name: 'Registrar animal' }).click();
    await page.screenshot({ path: `${DIR}/vp-movil-form-animal.png` });
    await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();
    for (const [n, r] of [['mercado', '/#/mercado'], ['venta', '/#/recomendacion'], ['reporte', '/#/reporte']]) {
      await page.goto(r);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${DIR}/vp-movil-${n}.png` });
    }
  });

  test('VRF 002 R11: impresión desde el celular sin barra superior ni navegación inferior', async ({ page }) => {
    await iniciarSesion(page);
    await page.goto('/#/reporte');
    await expect(page.getByRole('article')).toBeVisible();
    await page.emulateMedia({ media: 'print' });
    const visibles = await page.evaluate(() => ({
      header: [...document.querySelectorAll('header')].filter((h) => !h.closest('article') && h.checkVisibility()).length,
      nav: [...document.querySelectorAll('nav')].filter((n) => n.checkVisibility()).length,
      botones: [...document.querySelectorAll('button, select, input')].filter((b) => b.checkVisibility()).map((b) => b.innerText || b.tagName),
    }));
    await page.screenshot({ path: `${DIR}/movil-reporte-impresion.png`, fullPage: true });
    await registrar('impresión celular', visibles);
    expect(visibles).toEqual({ header: 0, nav: 0, botones: [] });
  });
});

// ---------- escritorio ----------

test.describe('escritorio 1280×800', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('VRF 002 R4/R10/R6: capturas, tabla completa y contraste en escritorio', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/#/login');
    await expect(page.getByRole('button', { name: 'Ingresar' })).toBeVisible();
    await page.screenshot({ path: `${DIR}/escritorio-login.png` });
    const informe = { login: (await page.evaluate(medirContraste)).fallan };
    await entrar(page);
    await expect(page.getByRole('heading', { name: /^Hola/ })).toBeVisible();
    for (const [nombre, preparar] of ESCENARIOS) {
      await preparar(page);
      await page.screenshot({ path: `${DIR}/escritorio-${nombre}.png`, fullPage: true });
      informe[nombre] = (await page.evaluate(medirContraste)).fallan;
      if (nombre === 'form-nuevo-animal') await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();
    }
    await page.goto('/#/animales');
    const tabla = await page.locator('table').evaluate((t) => {
      const cont = t.parentElement;
      return { columnas: t.querySelectorAll('thead th').length, scrollInterno: cont.scrollWidth > cont.clientWidth, ancho: Math.round(t.getBoundingClientRect().width) };
    });
    const navInferior = await page.getByRole('button', { name: 'Más' }).isVisible();
    const lateral = await page.getByRole('complementary').isVisible();
    await registrar('tabla escritorio', { ...tabla, navInferior, lateral });
    for (const [k, v] of Object.entries(informe)) {
      await registrar(`contraste escritorio ${k}`, v);
      expect.soft(v, `${k}: textos por debajo de AA`).toEqual([]);
    }
    expect(tabla.scrollInterno, 'la tabla del hato necesita scroll horizontal a 1280 px').toBe(false);
    expect([navInferior, lateral]).toEqual([false, true]);
  });

  test('VRF 002 R6: inventario de pares de color texto/fondo realmente usados', async ({ page }) => {
    test.setTimeout(120_000);
    await iniciarSesion(page);
    const pares = {};
    for (const [, preparar] of ESCENARIOS) {
      await preparar(page);
      Object.assign(pares, (await page.evaluate(medirContraste)).pares);
      if ((await page.getByRole('dialog').count()) > 0) await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();
    }
    const ordenados = Object.fromEntries(Object.entries(pares).sort((a, b) => a[1].ratio - b[1].ratio));
    await registrar('pares de color', ordenados);
    expect(Object.values(ordenados).filter((p) => p.ratio < p.minimo)).toEqual([]);
  });

  test('VRF 002 a11y: lang, nombres accesibles, foco visible con teclado', async ({ page }) => {
    await iniciarSesion(page);
    const lang = await page.evaluate(() => document.documentElement.lang);
    const sinNombre = {};
    for (const [nombre, preparar] of ESCENARIOS.filter(([n]) => ['inicio', 'hato', 'ficha', 'mercado', 'venta', 'reporte', 'form-nuevo-animal'].includes(n))) {
      await preparar(page);
      sinNombre[nombre] = await page.evaluate(() =>
        [...document.querySelectorAll('a[href], button, input, select, [role=button]')]
          .filter((el) => el.checkVisibility())
          .filter((el) => {
            const n = el.getAttribute('aria-label') || el.innerText?.trim() || el.getAttribute('title') || el.labels?.[0]?.innerText?.trim() || el.closest('label')?.innerText?.trim() || el.querySelector('[aria-label]')?.getAttribute('aria-label');
            return !n;
          })
          .map((el) => el.outerHTML.slice(0, 120)),
      );
      if (nombre === 'form-nuevo-animal') await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();
    }
    // Foco: recorrer con Tab desde el principio (barra lateral oscura y luego el contenido).
    await page.goto('/#/');
    await page.reload();
    await expect(page.getByRole('heading', { name: /^Hola/ })).toBeVisible();
    const focos = [];
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      focos.push(
        await page.evaluate(() => {
          const el = document.activeElement;
          const cs = getComputedStyle(el);
          let fondo = 'transparent';
          for (let n = el.parentElement; n; n = n.parentElement) {
            const b = getComputedStyle(n).backgroundColor;
            if (b !== 'rgba(0, 0, 0, 0)') { fondo = b; break; }
          }
          return { el: el === document.body ? 'BODY' : (el.innerText || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 25), outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`, fondoAlrededor: fondo };
        }),
      );
      if (i === 1) {
        await page.waitForTimeout(400); // transition-colors también anima outline-color
        await page.screenshot({ path: `${DIR}/escritorio-foco-lateral.png`, clip: { x: 0, y: 0, width: 300, height: 400 } });
        focos.push(await page.evaluate(() => ({ el: 'tras 400 ms', outline: getComputedStyle(document.activeElement).outlineColor })));
      }
    }
    await registrar('lang', lang);
    await registrar('sin nombre accesible', sinNombre);
    await registrar('foco con teclado', focos);
    expect(lang).toBe('es');
    for (const [k, v] of Object.entries(sinNombre)) expect.soft(v, `${k}: controles sin nombre accesible`).toEqual([]);
    expect(focos.filter((f) => f.el !== 'BODY' && f.outline.startsWith('none'))).toEqual([]);
  });

  test('VRF 002 R2/R7: fuentes cargadas, cifras tabulares y marca SR (login, navegación, favicon)', async ({ page, request }) => {
    await page.goto('/#/login');
    await expect(page.getByRole('button', { name: 'Ingresar' })).toBeVisible();
    const marcaLogin = await page.getByRole('img', { name: 'Finca Santa Rita' }).count();
    await entrar(page);
    await expect(page.getByRole('heading', { name: /^Hola/ })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const fuentes = await page.evaluate(() => {
      const cs = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const s = getComputedStyle(el);
        return { familia: s.fontFamily.split(',')[0], ancho: s.fontStretch, numeros: s.fontVariantNumeric };
      };
      return {
        archivoCargada: document.fonts.check('700 16px Archivo'),
        publicSansCargada: document.fonts.check('400 16px "Public Sans"'),
        cargadas: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family} ${f.weight} ${f.stretch}`).slice(0, 8),
        h1: cs('h1'),
        cuerpo: cs('main p'),
        cifra: cs('.cifra'),
      };
    });
    const marcaLateral = await page.getByRole('complementary').getByRole('img', { name: 'Finca Santa Rita' }).count();
    await page.goto('/#/reporte');
    await expect(page.getByRole('article')).toBeVisible();
    const tablaReporte = await page.locator('article td').last().evaluate((td) => getComputedStyle(td).fontVariantNumeric);
    const favicon = await request.get('/favicon.svg');
    const svg = await favicon.text();
    const html = await (await request.get('/')).text();
    await registrar('fuentes', { ...fuentes, tablaReporte });
    await registrar('marca', { marcaLogin, marcaLateral, favicon: favicon.status(), faviconEnlazado: html.includes('href="/favicon.svg"'), mismoTrazo: svg.includes('M27 34.5V10h7.2') });
    expect.soft(fuentes.archivoCargada).toBe(true);
    expect.soft(fuentes.publicSansCargada).toBe(true);
    expect.soft(fuentes.h1.familia).toMatch(/Archivo/);
    expect.soft(fuentes.cifra.numeros).toContain('tabular-nums');
    expect.soft(tablaReporte).toContain('tabular-nums');
    expect([marcaLogin, marcaLateral, favicon.status()]).toEqual([1, 1, 200]);
    expect(svg).toContain('M27 34.5V10h7.2');
  });

  test('VRF 002 R11: el reporte impreso (PDF) no lleva navegación ni controles', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'page.pdf solo en Chromium');
    await iniciarSesion(page);
    await page.goto('/#/reporte');
    await expect(page.getByRole('article')).toBeVisible();
    await page.waitForTimeout(1000);
    await page.emulateMedia({ media: 'print' });
    const visibles = await page.evaluate(() => ({
      aside: [...document.querySelectorAll('aside')].filter((a) => a.checkVisibility()).length,
      nav: [...document.querySelectorAll('nav')].filter((n) => n.checkVisibility()).length,
      controles: [...document.querySelectorAll('button, select, input')].filter((b) => b.checkVisibility()).length,
      h1: [...document.querySelectorAll('h1')].filter((h) => h.checkVisibility()).map((h) => h.innerText),
      articulo: document.querySelector('article')?.checkVisibility(),
    }));
    await page.pdf({ path: `${DIR}/reporte.pdf`, format: 'A4', printBackground: true });
    await page.screenshot({ path: `${DIR}/escritorio-reporte-impresion.png`, fullPage: true });
    await registrar('impresión escritorio', visibles);
    expect(visibles).toEqual({ aside: 0, nav: 0, controles: 0, h1: [], articulo: true });
  });
});

// Limpieza defensiva: estas pruebas no guardan nada, pero si un Guardar se colara, se borra.
test.afterAll(async () => {
  const supabase = await clientePrueba();
  await supabase.from('animales').delete().like('numero_interno', 'VRF-D%');
});
