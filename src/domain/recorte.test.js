import { describe, expect, it } from 'vitest';
import { areaFuente, centrar, hacerZoom, limitarPosicion, mover, rutaMiniatura } from './recorte';

// Spec 024 · R2: una foto horizontal de 4000×3000 en un cuadro de 300 px.
const W = 4000;
const H = 3000;
const L = 300;

describe('recortador cuadrado (spec 024 · R2)', () => {
  it('centra la foto con zoom 1 y el recorte es el cuadrado central del lado corto', () => {
    const e = centrar(W, H, L);
    expect(e.zoom).toBe(1);
    expect(e.y).toBe(0);
    expect(e.x).toBe(-50); // 4000 × 0,1 = 400 px mostrados; sobran 100
    expect(areaFuente(e, W, H, L)).toEqual({ sx: 500, sy: 0, sLado: 3000 });
  });

  it('nunca deja bordes vacíos al arrastrar', () => {
    const e = centrar(W, H, L);
    expect(mover(e, 500, 500, W, H, L)).toMatchObject({ x: 0, y: 0 });
    expect(mover(e, -500, -500, W, H, L)).toMatchObject({ x: -100, y: 0 });
    expect(limitarPosicion({ x: 10, y: 10, zoom: 2 }, W, H, L)).toMatchObject({ x: 0, y: 0 });
  });

  it('el zoom alrededor del centro reduce el recorte y lo mantiene centrado', () => {
    const e = hacerZoom(centrar(W, H, L), 2, W, H, L);
    const a = areaFuente(e, W, H, L);
    expect(a.sLado).toBe(1500);
    expect(a.sx).toBe(1250);
    expect(a.sy).toBe(750);
  });

  it('el zoom se queda entre 1 y 4', () => {
    expect(hacerZoom(centrar(W, H, L), 9, W, H, L).zoom).toBe(4);
    expect(hacerZoom(centrar(W, H, L), 0.2, W, H, L).zoom).toBe(1);
  });

  it('una foto vertical también llena el cuadro', () => {
    const e = centrar(3000, 4000, L);
    expect(areaFuente(e, 3000, 4000, L)).toEqual({ sx: 0, sy: 500, sLado: 3000 });
  });
});

describe('miniatura (spec 024 · R4/R5)', () => {
  it('va junto a la foto con -mini', () => {
    expect(rutaMiniatura('abc/123.webp')).toBe('abc/123-mini.webp');
    expect(rutaMiniatura('abc/123.jpg')).toBe('abc/123-mini.jpg');
    expect(rutaMiniatura(null)).toBeNull();
  });
});
