import { describe, expect, it } from 'vitest';
import { entradaPesosInvalida, pegadoPesosValido } from './validar';

// Spec 018 · R1 y verificación Sprint 05 (M1): nada de convertir montos en silencio.
describe('entradaPesosInvalida', () => {
  it('rechaza centavos, decimales, signos y letras', () => {
    expect(entradaPesosInvalida('1.000,50', '')).toBe(true);
    expect(entradaPesosInvalida('12,50', '')).toBe(true);
    expect(entradaPesosInvalida('1500000.5', '')).toBe(true);
    expect(entradaPesosInvalida('-1', '')).toBe(true);
    expect(entradaPesosInvalida('1e6', '')).toBe(true);
    expect(entradaPesosInvalida('1.000.', '1.000')).toBe(true);
  });

  it('acepta dígitos, montos con puntos de miles y el reacomodo al borrar', () => {
    expect(entradaPesosInvalida('1000000', '')).toBe(false);
    expect(entradaPesosInvalida('$ 1.250.000', '')).toBe(false);
    expect(entradaPesosInvalida('1.0005', '1.000')).toBe(false); // escribir un dígito al final
    expect(entradaPesosInvalida('1.00', '1.000')).toBe(false); // borrar un cero
    expect(entradaPesosInvalida('', '5')).toBe(false);
  });
});

describe('pegadoPesosValido (verificación Sprint 05, M1-r2)', () => {
  it('solo enteros con o sin puntos de miles bien puestos', () => {
    expect(pegadoPesosValido('1250000')).toBe(true);
    expect(pegadoPesosValido('$ 1.250.000')).toBe(true);
    expect(pegadoPesosValido('1500.5')).toBe(false);
    expect(pegadoPesosValido('12.5')).toBe(false);
    expect(pegadoPesosValido('1.000,50')).toBe(false);
    expect(pegadoPesosValido('1.00.000')).toBe(false);
    expect(pegadoPesosValido('-1')).toBe(false);
  });
});
