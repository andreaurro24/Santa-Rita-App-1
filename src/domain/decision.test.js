import { describe, expect, it } from 'vitest';
import { analizarLoteV2, gastoDiarioLote, resultadoVenta, siguioRecomendacion } from './decision';

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

describe('resultadoVenta (spec 011 · R5, R6)', () => {
  const vendidos = [
    { pesoKg: 350, costoCop: 1_500_000, contratoId: null, porcentajeTenedor: null },
    { pesoKg: 300, costoCop: 1_000_000, contratoId: 'C1', porcentajeTenedor: 50 },
    { pesoKg: 200, costoCop: 2_000_000, contratoId: 'C1', porcentajeTenedor: 50 }, // pierde: no paga al tenedor
  ];

  it('ingreso con destare, costo, participación y margen neto', () => {
    const r = resultadoVenta(vendidos, { precioKg: 8_000, destarePct: 0 });
    expect(r.ingreso).toBe(6_800_000);
    expect(r.costo).toBe(4_500_000);
    // tenedor: 50 % de (2.400.000 − 1.000.000); el tercero gana −400.000 → 0
    expect(r.participacion).toBe(700_000);
    expect(r.margenNeto).toBe(1_600_000);
  });

  it('liquida por contrato con la ganancia y el monto a pagar', () => {
    const r = resultadoVenta(vendidos, { precioKg: 8_000 });
    expect(r.liquidaciones).toEqual([{ contratoId: 'C1', animales: 2, ganancia: 1_000_000, monto: 700_000 }]);
  });

  it('el destare reduce el ingreso', () => {
    expect(resultadoVenta([vendidos[0]], { precioKg: 8_000, destarePct: 5 }).ingreso).toBe(2_660_000);
  });

  it('siguió la recomendación si decía vender', () => {
    expect(siguioRecomendacion('VENDER')).toBe(true);
    expect(siguioRecomendacion('VENDER_ANTICIPADO')).toBe(true);
    expect(siguioRecomendacion('ESPERAR')).toBe(false);
    expect(siguioRecomendacion(null)).toBeNull();
  });
});

describe('analizarLoteV2 · peso estimado de hoy (verificación 010, Alto)', () => {
  it('un lote pesado hace 30 días parte del peso estimado de hoy, no del último pesaje', () => {
    // 1 kg/día; último pesaje el 31-ago (270 kg); hoy 30-sep → 300 kg estimados por animal
    const viejo = (id) => animal(id, { pesos: [{ fecha: '2026-08-01', pesoKg: 240 }, { fecha: '2026-08-31', pesoKg: 270 }] });
    const r = analizarLoteV2(base({ animales: [viejo('a'), viejo('b')], metaKg: 300 }));
    expect(r.pesoPromedio).toBe(300);
    expect(r.escenarios[0].pesoVendible).toBe(600);
    expect(r.escenarios.find((e) => e.semanas === 4).pesoVendible).toBe(656);
    expect(r.recomendacion).toBe('VENDER'); // ya está en la meta según el peso estimado
  });

  it('con riesgo de pasto no invita a esperar a que suba el margen', () => {
    const animales = [animal('a', { costoCompra: 2_500_000 }), animal('b', { costoCompra: 2_500_000 })];
    const r = analizarLoteV2(base({ animales, pasto: 'rojo' }));
    expect(r.recomendacion).toBe('NO_VENDER');
    expect(r.razones.join(' ')).toMatch(/hay riesgo de pasto/);
    expect(r.razones.join(' ')).not.toMatch(/Si el lote sigue ganando peso al ritmo actual/);
  });

  it('margen exactamente cero no dice "pérdida de $-0"', () => {
    const animales = [animal('a', { costoCompra: 2_400_000 }), animal('b', { costoCompra: 2_400_000 })];
    const r = analizarLoteV2(base({ animales }));
    expect(r.razones[0]).toBe('Vender hoy no dejaría ganancia para Santa Rita.');
  });

  it('vender antes de la meta dice cuánto se deja de ganar (D4)', () => {
    expect(analizarLoteV2(base({ pasto: 'rojo' })).razones.join(' ')).toMatch(/Anticipar la venta deja de ganar hasta/);
  });
});
