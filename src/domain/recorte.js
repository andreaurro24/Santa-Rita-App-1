// Spec 024 · R2: geometría del recortador cuadrado. Funciones puras (se prueban sin navegador).
//
// La foto (ancho × alto) se muestra dentro de un cuadro de `lado` px. Con zoom 1 la foto cubre el
// cuadro justo (el lado corto llena el cuadro); el zoom va de 1 a ZOOM_MAXIMO. `x` y `y` son la
// posición de la esquina de la foto respecto al cuadro (≤ 0): nunca dejan bordes vacíos.

export const ZOOM_MAXIMO = 4;

export function escalaBase(ancho, alto, lado) {
  return lado / Math.min(ancho, alto);
}

export function limitarZoom(zoom) {
  return Math.min(ZOOM_MAXIMO, Math.max(1, Number(zoom) || 1));
}

// Mantiene la foto cubriendo el cuadro: x entre (lado − ancho mostrado) y 0.
export function limitarPosicion({ x, y, zoom }, ancho, alto, lado) {
  const e = escalaBase(ancho, alto, lado) * zoom;
  const limitar = (v, mostrado) => Math.min(0, Math.max(lado - mostrado, v));
  return { x: limitar(x, ancho * e), y: limitar(y, alto * e), zoom };
}

// Estado inicial: foto centrada con zoom 1.
export function centrar(ancho, alto, lado) {
  const e = escalaBase(ancho, alto, lado);
  return { x: (lado - ancho * e) / 2, y: (lado - alto * e) / 2, zoom: 1 };
}

// Cambia el zoom manteniendo fijo el punto (px, py) del cuadro (centro o punto del pellizco).
export function hacerZoom(estado, zoomNuevo, ancho, alto, lado, px = lado / 2, py = lado / 2) {
  const z = limitarZoom(zoomNuevo);
  const factor = z / estado.zoom;
  return limitarPosicion({ x: px - (px - estado.x) * factor, y: py - (py - estado.y) * factor, zoom: z }, ancho, alto, lado);
}

export function mover(estado, dx, dy, ancho, alto, lado) {
  return limitarPosicion({ ...estado, x: estado.x + dx, y: estado.y + dy }, ancho, alto, lado);
}

// Parte de la foto original que queda dentro del cuadro: { sx, sy, sLado } en px de la foto.
export function areaFuente(estado, ancho, alto, lado) {
  const e = escalaBase(ancho, alto, lado) * estado.zoom;
  const sLado = Math.min(lado / e, ancho, alto);
  const sx = Math.min(Math.max(0, -estado.x / e), ancho - sLado);
  const sy = Math.min(Math.max(0, -estado.y / e), alto - sLado);
  return { sx, sy, sLado };
}

// Spec 024 · R5: la miniatura vive junto a la foto con "-mini" antes de la extensión.
export function rutaMiniatura(ruta) {
  if (!ruta) return null;
  return ruta.replace(/(\.[a-z]+)$/i, '-mini$1');
}
