import { describe, expect, it } from 'vitest';
import { categoriaPrecio, precioPorAnimal, puntoMedio, rangosVigentes } from './precios';

const rango = (categoria, precioMin, precioMax, fecha, creado = '') => ({ categoria, precioMin, precioMax, fecha, creado });

describe('categoría de precio (spec 021 · R3)', () => {
  it('ternero y ternera por su categoría; novillo y reproductor por peso; vientres como vaca', () => {
    expect(categoriaPrecio('ternero', 180)).toBe('ternero');
    expect(categoriaPrecio('ternera', 180)).toBe('ternera');
    expect(categoriaPrecio('novillo', 349.9)).toBe('levante');
    expect(categoriaPrecio('novillo', 350)).toBe('gordo');
    expect(categoriaPrecio('reproductor', 600)).toBe('gordo');
    expect(categoriaPrecio('vientre_parida', 420)).toBe('vaca');
    expect(categoriaPrecio('yegua', 400)).toBeNull();
  });
});

describe('rangos vigentes y precio por animal (R1–R3)', () => {
  const rangos = [
    rango('gordo', 8_000, 9_000, '2026-09-01'),
    rango('gordo', 8_400, 9_400, '2026-10-01'),
    rango('levante', 8_500, 10_000, '2026-10-01'),
  ];

  it('vale el rango más reciente de cada categoría', () => {
    expect(rangosVigentes(rangos).get('gordo').precioMin).toBe(8_400);
    expect(puntoMedio(rangosVigentes(rangos).get('gordo'))).toBe(8_900);
  });

  it('el mismo día desempata por hora de registro', () => {
    const dia = [rango('vaca', 7_000, 8_000, '2026-10-01', '10:00'), rango('vaca', 7_200, 8_200, '2026-10-01', '11:00')];
    expect(rangosVigentes(dia).get('vaca').precioMin).toBe(7_200);
  });

  it('cada animal toma el punto medio de su categoría y, si falta, el respaldo', () => {
    const precio = precioPorAnimal(rangosVigentes(rangos), 7_777);
    expect(precio({ categoria: 'novillo' }, 300)).toBe(9_250);
    expect(precio({ categoria: 'novillo' }, 400)).toBe(8_900);
    expect(precio({ categoria: 'ternero' }, 150)).toBe(7_777);
    expect(precioPorAnimal(new Map())({ categoria: 'ternero' }, 150)).toBeNull();
  });
});
