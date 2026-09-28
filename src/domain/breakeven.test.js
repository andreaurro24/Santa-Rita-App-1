import { describe, expect, it } from 'vitest';
import { fechaUltimoPesaje, formatCOP, pesoActual } from './breakeven';

// Utilidades de peso y formato (el motor v1 se reemplazó por decision.js, spec 010).

function animal(overrides = {}) {
  return {
    estado: 'Activo',
    pesoIngreso: 200,
    pesoObjetivo: 350,
    costoCompra: 1_200_000,
    pesos: [
      { fecha: '2026-01-10', pesoKg: 200 },
      { fecha: '2026-09-10', pesoKg: 300 },
    ],
    ...overrides,
  };
}


describe('pesoActual / fechaUltimoPesaje', () => {
  it('usa el pesaje más reciente aunque venga desordenado', () => {
    const a = animal({ pesos: [{ fecha: '2026-09-16', pesoKg: 349.8 }, { fecha: '2026-09-07', pesoKg: 351.3 }] });
    expect(pesoActual(a)).toBe(349.8);
    expect(fechaUltimoPesaje(a)).toBe('2026-09-16');
  });

  it('con dos pesajes el mismo día vale el último registrado', () => {
    const a = animal({
      pesos: [
        { fecha: '2026-09-20', pesoKg: 310, creado: '2026-09-20T15:00:00Z' },
        { fecha: '2026-09-20', pesoKg: 305, creado: '2026-09-20T12:00:00Z' },
      ],
    });
    expect(pesoActual(a)).toBe(310);
  });

  it('sin pesajes usa el peso de ingreso y no hay fecha', () => {
    const a = animal({ pesos: [] });
    expect(pesoActual(a)).toBe(200);
    expect(fechaUltimoPesaje(a)).toBeNull();
  });
});

describe('formatCOP', () => {
  it('formatea con separador de miles colombiano y maneja vacíos', () => {
    expect(formatCOP(1234567)).toBe('1.234.567');
    expect(formatCOP(null)).toBe('—');
    expect(formatCOP(Number.NaN)).toBe('—');
  });
});
