// Utilidades de medición del VERIFICADOR (copiadas de verificador-diseno.spec.js, ronda 1), para
// reutilizarlas en las pruebas de la ronda 2 de la 002 y en las de las specs 004 y 006.
// Corren dentro de la página con page.evaluate().

// Controles interactivos visibles con su tamaño (R5 pide 48×48 en celular).
export function medirControles() {
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
export function medirDesborde() {
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
export function medirContraste() {
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

