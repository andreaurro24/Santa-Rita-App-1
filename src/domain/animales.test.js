import { describe, expect, it } from 'vitest';
import { duenosExistentes, esVientre, etiquetaCategoria, kiloDesdeTotal, pidePesoObjetivo, totalDesdeKilo } from './animales';

describe('categorías (spec 016 · R5, R6, R8)', () => {
  it('los tres tipos de vientre son vientres y no piden peso objetivo', () => {
    for (const c of ['vientre_menor', 'vientre_mayor', 'vientre_parida']) {
      expect(esVientre(c)).toBe(true);
      expect(pidePesoObjetivo(c)).toBe(false);
    }
    expect(esVientre('ternera')).toBe(false);
    expect(pidePesoObjetivo('novillo')).toBe(true);
  });

  it('etiquetas legibles, también de caballos', () => {
    expect(etiquetaCategoria('vientre_parida')).toBe('Vientre parida');
    expect(etiquetaCategoria('yegua')).toBe('Yegua');
  });
});

describe('compra por kilo o por animal (R7)', () => {
  it('total = precio por kilo × peso, y kilo = total / peso', () => {
    expect(totalDesdeKilo(8_000, 250)).toBe(2_000_000);
    expect(kiloDesdeTotal(2_000_000, 250)).toBe(8_000);
    expect(kiloDesdeTotal(1_000_000, 300)).toBe(3_333);
  });

  it('sin datos suficientes no inventa un valor', () => {
    expect(totalDesdeKilo(8_000, 0)).toBeNull();
    expect(kiloDesdeTotal(null, 250)).toBeNull();
  });
});

describe('dueños existentes (R4)', () => {
  it('sin repetidos ni vacíos, en orden alfabético', () => {
    const animales = [{ dueno: 'José' }, { dueno: ' josé ' }, { dueno: 'Familia' }, { dueno: null }, { dueno: '' }];
    expect(duenosExistentes(animales)).toEqual(['Familia', 'José']);
  });
});
