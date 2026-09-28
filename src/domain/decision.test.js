import { describe, expect, it } from 'vitest';
import { analizarLoteV2, gastoDiarioLote } from './decision';

// Lote de números redondos para calcular a mano:
// 2 novillos de 300 kg, compra $600.000 c/u, meta 350 kg, GDP 1 kg/día (270 → 300 en 30 días).
const HOY = '2026-09-30';
const animal = (id, extra = {}) => ({
  id,
  loteId: 'L',
  estado: 'Activo',
  categoria: 'novillo',
  fechaIngreso: '2026-01-01',
  costoCompra: 600_000,
  pesoObjetivo: 350,
  porcentajeTenedor: null,
  pesos: [
    { fecha: '2026-08-31', pesoKg: 270 },
    { fecha: HOY, pesoKg: 300 },
  ],
  ...extra,
});
const lote = () => [animal('a'), animal('b')];
const base = (extra = {}) => ({ animales: lote(), costos: [], precioKg: 8_000, destarePct: 0, hoy: HOY, ...extra });

describe('analizarLoteV2 · cifras (R1–R4)', () => {
  it('equilibrio real = costo total / peso vendible (D10), margen = ingreso − costo', () => {
    const r = analizarLoteV2(base());
    // costo 1.200.000 / 600 kg = 2.000 $/kg; ingreso 600 × 8.000 = 4.800.000
    expect(r.hoy.equilibrioKg).toBe(2_000);
    expect(r.hoy.ingreso).toBe(4_800_000);
    expect(r.hoy.margenNeto).toBe(3_600_000);
  });

  it('el destare reduce el peso vendible (D5)', () => {
    const r = analizarLoteV2(base({ destarePct: 5 }));
    // 600 × 0,95 = 570 kg; ingreso 4.560.000; equilibrio 1.200.000 / 570
    expect(r.hoy.pesoVendible).toBeCloseTo(570, 6);
    expect(r.hoy.ingreso).toBeCloseTo(4_560_000, 2);
    expect(r.hoy.equilibrioKg).toBeCloseTo(2105.263, 2);
  });

  it('suma los gastos del lote al costo (spec 008)', () => {
    const r = analizarLoteV2(base({ costos: [{ loteId: 'L', animalId: null, categoria: 'suplemento', montoCop: 200_000, fecha: '2026-09-01' }] }));
    expect(r.hoy.costo).toBe(1_400_000);
    expect(r.hoy.equilibrioKg).toBeCloseTo(2333.33, 1);
  });

  it('descuenta la participación del tenedor: su % de la ganancia neta positiva (D11)', () => {
    const animales = [animal('a', { porcentajeTenedor: 50 }), animal('b')];
    const r = analizarLoteV2(base({ animales }));
    // ganancia de a: 2.400.000 − 600.000 = 1.800.000 → tenedor 900.000
    expect(r.hoy.participacion).toBe(900_000);
    expect(r.hoy.margenNeto).toBe(3_600_000 - 900_000);
  });

  it('sin participación si la ganancia del animal es negativa', () => {
    const animales = [animal('a', { porcentajeTenedor: 50, costoCompra: 5_000_000 }), animal('b')];
    expect(analizarLoteV2(base({ animales })).hoy.participacion).toBe(0);
  });

  it('escenarios: peso + GDP × días, y costo + gasto diario × días (R3)', () => {
    // gasto de 90 días: 900.000 → 10.000 $/día para el lote
    const costos = [{ loteId: 'L', animalId: null, categoria: 'suplemento', montoCop: 900_000, fecha: '2026-08-01' }];
    const r = analizarLoteV2(base({ costos }));
    expect(r.gastoDiario).toBe(10_000);
    const cuatro = r.escenarios.find((e) => e.semanas === 4);
    // 28 días: cada animal 328 kg → 656 kg × 8.000 = 5.248.000; costo 1.200.000 + 900.000 + 280.000
    expect(cuatro.ingreso).toBe(5_248_000);
    expect(cuatro.costo).toBe(2_380_000);
    expect(cuatro.margenNeto).toBe(2_868_000);
  });

  it('sensibilidad al precio ±5 % y ±10 % (R4)', () => {
    const r = analizarLoteV2(base());
    expect(r.sensibilidad.map((s) => Math.round(s.margenNeto))).toEqual([3_120_000, 3_360_000, 3_840_000, 4_080_000]);
  });
});

describe('analizarLoteV2 · recomendación (R5–R7)', () => {
  it('ESPERAR cuando ganar peso vale más que mantener el lote y no hay riesgo', () => {
    const r = analizarLoteV2(base());
    expect(r.recomendacion).toBe('ESPERAR');
    expect(r.razones[0]).toMatch(/Esperar 8 semanas/);
  });

  it('VENDER cuando el promedio llegó a la meta con margen positivo', () => {
    const r = analizarLoteV2(base({ metaKg: 300 }));
    expect(r.recomendacion).toBe('VENDER');
    expect(r.razones.join(' ')).toMatch(/Si el comprador acepta animales más pesados, esperar 8 semanas/);
  });

  it('VENDER_ANTICIPADO con el pasto en rojo y margen positivo', () => {
    expect(analizarLoteV2(base({ pasto: 'rojo' })).recomendacion).toBe('VENDER_ANTICIPADO');
  });

  it('VENDER_ANTICIPADO por sequía pronosticada, pero no con el clima de respaldo (R6)', () => {
    expect(analizarLoteV2(base({ clima: { isFallback: false, resumenLluvia7d: 1 } })).recomendacion).toBe('VENDER_ANTICIPADO');
    const r = analizarLoteV2(base({ clima: { isFallback: true, resumenLluvia7d: 0 } }));
    expect(r.recomendacion).toBe('ESPERAR');
    expect(r.razones.join(' ')).toMatch(/sin conexión/);
  });

  it('NO_VENDER con margen negativo hoy, avisando cuándo sería positivo', () => {
    const animales = [animal('a', { costoCompra: 2_500_000 }), animal('b', { costoCompra: 2_500_000 })];
    const r = analizarLoteV2(base({ animales }));
    // ingreso 4.800.000 < costo 5.000.000; en 2 semanas 628 kg × 8.000 = 5.024.000 > 5.000.000
    expect(r.recomendacion).toBe('NO_VENDER');
    expect(r.razones.join(' ')).toMatch(/en 2 semanas el margen sería de \$24\.000/);
  });

  it('VENDER si esperar ya no paga (el costo diario supera la ganancia de peso)', () => {
    // Cada día el lote gana 2 kg × $100.000 = $200.000, pero cuesta $300.000 (27.000.000 / 90).
    const costos = [{ loteId: 'L', animalId: null, categoria: 'arriendo_pasto', montoCop: 27_000_000, fecha: '2026-08-01' }];
    const animales = [animal('a', { costoCompra: 0 }), animal('b', { costoCompra: 0 })];
    const r = analizarLoteV2(base({ animales, costos, precioKg: 100_000 }));
    expect(r.recomendacion).toBe('VENDER');
  });

  it('excluye los vientres y lo dice (D2)', () => {
    const animales = [...lote(), animal('v', { categoria: 'vientre' })];
    const r = analizarLoteV2(base({ animales }));
    expect(r.nAnimales).toBe(2);
    expect(r.excluidos).toBe(1);
    expect(r.razones.join(' ')).toMatch(/1 vientre se excluyó/);
  });

  it('SIN_DATOS sin precio o sin animales para vender', () => {
    expect(analizarLoteV2(base({ precioKg: null })).recomendacion).toBe('SIN_DATOS');
    expect(analizarLoteV2(base({ animales: [animal('v', { categoria: 'vientre' })] })).recomendacion).toBe('SIN_DATOS');
  });
});

describe('gastoDiarioLote', () => {
  it('solo cuenta los últimos 90 días y nunca gastos futuros', () => {
    const c = (montoCop, fecha) => ({ montoCop, fecha });
    expect(gastoDiarioLote([c(90_000, '2026-09-01'), c(1_000_000, '2026-06-01'), c(5_000, '2026-10-05')], HOY)).toBe(1_000);
  });
});
