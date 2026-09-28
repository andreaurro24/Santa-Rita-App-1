import { describe, expect, it } from 'vitest';
import { analizarLote, fechaUltimoPesaje, formatCOP, pesoActual } from './breakeven';

// Spec 001 · R10: el motor de recomendación se movió a src/domain sin cambiar su lógica.
// Estas pruebas fijan el comportamiento actual para que la v2 (Sprint 3) cambie a propósito.

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

const climaNormal = { isFallback: false, resumenLluvia7d: 15 };

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

describe('analizarLote', () => {
  it('devuelve null si no hay animales activos', () => {
    expect(analizarLote([animal({ estado: 'Vendido' })], { precioMercadoCOP: 8000, clima: climaNormal })).toBeNull();
  });

  it('ignora los animales que no están activos', () => {
    const r = analizarLote([animal(), animal({ estado: 'Muerto' })], { precioMercadoCOP: 8000, clima: climaNormal });
    expect(r.nAnimales).toBe(1);
  });

  it('sin costo de compra (cría propia) no calcula punto de equilibrio', () => {
    const r = analizarLote([animal({ costoCompra: null })], { precioMercadoCOP: 8000, clima: climaNormal });
    expect(r.recomendacion).toBe('SIN_DATOS_DE_COSTO');
    expect(r.precioEquilibrioCOPkg).toBeNull();
  });

  it('punto de equilibrio = costo de compra / peso actual', () => {
    const r = analizarLote([animal()], { precioMercadoCOP: 8000, clima: climaNormal });
    expect(r.precioEquilibrioCOPkg).toBe(4000); // 1.200.000 / 300 kg
    expect(r.margenPorKgCOP).toBe(4000);
  });

  it('recomienda ESPERAR si el precio de mercado no cubre el punto de equilibrio', () => {
    const r = analizarLote([animal()], { precioMercadoCOP: 3500, clima: climaNormal });
    expect(r.recomendacion).toBe('ESPERAR');
    expect(r.margenPorKgCOP).toBe(-500);
  });

  it('recomienda VENDER si el lote está al 92 % o más de la meta con margen positivo', () => {
    const lote = [animal({ pesos: [{ fecha: '2026-09-10', pesoKg: 330 }] })]; // 94 %
    const r = analizarLote(lote, { precioMercadoCOP: 8000, clima: climaNormal });
    expect(r.recomendacion).toBe('VENDER');
    expect(r.avancePct).toBeGreaterThanOrEqual(92);
  });

  it('recomienda VENDER anticipado ante riesgo de sequía (< 2 mm en 7 días)', () => {
    const r = analizarLote([animal()], { precioMercadoCOP: 8000, clima: { isFallback: false, resumenLluvia7d: 1 } });
    expect(r.recomendacion).toBe('VENDER');
    expect(r.razones.join(' ')).toMatch(/escasez de pasto/);
  });

  it('no usa el clima de respaldo (sin conexión) para anticipar la venta', () => {
    const r = analizarLote([animal()], { precioMercadoCOP: 8000, clima: { isFallback: true, resumenLluvia7d: 0 } });
    expect(r.recomendacion).toBe('ESPERAR');
  });

  it('avisa por lluvia fuerte (> 40 mm) sin cambiar la recomendación', () => {
    const r = analizarLote([animal()], { precioMercadoCOP: 8000, clima: { isFallback: false, resumenLluvia7d: 60 } });
    expect(r.recomendacion).toBe('ESPERAR');
    expect(r.razones.join(' ')).toMatch(/Precipitación acumulada alta/);
  });

  it('margen total = margen por kg × peso promedio × número de animales', () => {
    const r = analizarLote([animal(), animal()], { precioMercadoCOP: 8000, clima: climaNormal });
    expect(r.margenTotalEstimadoCOP).toBe(4000 * 300 * 2);
  });
});

describe('formatCOP', () => {
  it('formatea con separador de miles colombiano y maneja vacíos', () => {
    expect(formatCOP(1234567)).toBe('1.234.567');
    expect(formatCOP(null)).toBe('—');
    expect(formatCOP(Number.NaN)).toBe('—');
  });
});
