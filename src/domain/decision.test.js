import { describe, expect, it } from 'vitest';
import { analizarLoteV2, estadoContratos, gastoDiarioLote, resultadoVenta, siguioRecomendacion } from './decision';

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
    const animales = [animal('a', { contratoId: 'C1', porcentajeTenedor: 50 }), animal('b')];
    const r = analizarLoteV2(base({ animales }));
    // ganancia de a: 2.400.000 − 600.000 = 1.800.000 → tenedor 900.000
    expect(r.hoy.participacion).toBe(900_000);
    expect(r.hoy.margenNeto).toBe(3_600_000 - 900_000);
  });

  it('sin participación si la ganancia del contrato es negativa', () => {
    const animales = [animal('a', { contratoId: 'C1', porcentajeTenedor: 50, costoCompra: 5_000_000 }), animal('b')];
    expect(analizarLoteV2(base({ animales })).hoy.participacion).toBe(0);
  });

  it('D11 por contrato: la pérdida de un animal descuenta de la ganancia de otro del mismo contrato', () => {
    // a gana 1.800.000; b pierde 2.400.000 − 3.000.000 = −600.000 → contrato 1.200.000 → tenedor 600.000
    const animales = [animal('a', { contratoId: 'C1', porcentajeTenedor: 50 }), animal('b', { contratoId: 'C1', porcentajeTenedor: 50, costoCompra: 3_000_000 })];
    expect(analizarLoteV2(base({ animales })).hoy.participacion).toBe(600_000);
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
    // DT-03-9: se vende sin haber llegado a la meta (300 de 350 kg) y la razón lo dice.
    expect(r.razones.join(' ')).toMatch(/no llegó a la meta pactada \(va en el 86 %\)/);
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
    { pesoKg: 200, costoCop: 2_000_000, contratoId: 'C1', porcentajeTenedor: 50 }, // pierde: descuenta de la ganancia del contrato
  ];

  it('ingreso con destare, costo, participación y margen neto', () => {
    const r = resultadoVenta(vendidos, { precioKg: 8_000, destarePct: 0 });
    expect(r.ingreso).toBe(6_800_000);
    expect(r.costo).toBe(4_500_000);
    // D11 por contrato: C1 gana 1.400.000 − 400.000 = 1.000.000 → tenedor 50 % = 500.000
    expect(r.participacion).toBe(500_000);
    expect(r.margenNeto).toBe(1_800_000);
  });

  it('liquida por contrato con la ganancia y el monto a pagar', () => {
    const r = resultadoVenta(vendidos, { precioKg: 8_000 });
    expect(r.liquidaciones).toEqual([{ contratoId: 'C1', animales: 2, ganancia: 1_000_000, gananciaAcumulada: 1_000_000, pagadoAntes: 0, monto: 500_000, saldoAFavor: 0 }]);
  });

  it('liquida por separado dos contratos de la misma venta y lista el contrato al 0 %', () => {
    const r = resultadoVenta(
      [
        ...vendidos,
        { pesoKg: 300, costoCop: 1_000_000, contratoId: 'C2', porcentajeTenedor: 30 }, // gana 1.400.000 → 420.000
        { pesoKg: 300, costoCop: 1_000_000, contratoId: 'C3', porcentajeTenedor: 0 },
      ],
      { precioKg: 8_000 },
    );
    expect(r.liquidaciones.map((l) => [l.contratoId, l.monto])).toEqual([['C1', 500_000], ['C2', 420_000], ['C3', 0]]);
    expect(r.participacion).toBe(920_000);
  });

  it('un contrato con ganancia neta negativa no paga nada al tenedor', () => {
    const r = resultadoVenta([vendidos[2]], { precioKg: 8_000 });
    expect(r.liquidaciones).toEqual([{ contratoId: 'C1', animales: 1, ganancia: -400_000, gananciaAcumulada: -400_000, pagadoAntes: 0, monto: 0, saldoAFavor: 0 }]);
    expect(r.participacion).toBe(0);
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

describe('liquidación acumulada por contrato (011 R5, 010 R2, D8, DT-04-9)', () => {
  // Contrato C1 al 50 %. A $8.000/kg: 300 kg con costo 600.000 gana 1.800.000; 150 kg con costo 1.800.000 pierde 600.000.
  const gana = { pesoKg: 300, costoCop: 600_000, contratoId: 'C1', porcentajeTenedor: 50 };
  const pierde = { pesoKg: 150, costoCop: 1_800_000, contratoId: 'C1', porcentajeTenedor: 50 };
  const venta = (id, fecha, animales, creado = '') => ({ id, fecha, creado, precioKg: 8_000, destarePct: 0, animales });

  it('si la ganancia se vende primero y la pérdida después, lo pagado de más queda como saldo a favor', () => {
    const juntos = resultadoVenta([gana, pierde], { precioKg: 8_000 }).participacion;
    const ventas = [venta('v1', '2026-09-01', [gana]), venta('v2', '2026-09-10', [pierde])];
    const primera = resultadoVenta([gana], ventas[0], estadoContratos(ventas, { antesDe: 'v1' }));
    const segunda = resultadoVenta([pierde], ventas[1], estadoContratos(ventas, { antesDe: 'v2' }));
    expect(juntos).toBe(600_000);
    // La primera paga 900.000; con la pérdida, al contrato le tocan 600.000: 300.000 a favor de Santa Rita.
    expect(primera.participacion).toBe(900_000);
    expect(segunda.participacion).toBe(0);
    expect(segunda.liquidaciones[0]).toMatchObject({ gananciaAcumulada: 1_200_000, pagadoAntes: 900_000, monto: 0, saldoAFavor: 300_000 });
  });

  it('si la pérdida se vende primero, la ganancia posterior la descuenta', () => {
    const ventas = [venta('v1', '2026-09-01', [pierde]), venta('v2', '2026-09-10', [gana])];
    expect(resultadoVenta([pierde], ventas[0], estadoContratos(ventas, { antesDe: 'v1' })).participacion).toBe(0);
    const segunda = resultadoVenta([gana], ventas[1], estadoContratos(ventas, { antesDe: 'v2' }));
    // Igual que venderlos juntos: 50 % de 1.200.000.
    expect(segunda.participacion).toBe(600_000);
    expect(segunda.liquidaciones[0]).toMatchObject({ gananciaAcumulada: 1_200_000, pagadoAntes: 0, saldoAFavor: 0 });
  });

  it('011 R5: una venta registrada después con fecha pasada no cambia lo ya liquidado (queda saldo a favor)', () => {
    // T1 (gana) registrada primero con fecha de hoy; T2 (pierde) registrada después con fecha anterior.
    const ventas = [venta('t2', '2026-09-05', [pierde], '2026-09-10T12:00Z'), venta('t1', '2026-09-10', [gana], '2026-09-10T09:00Z')];
    expect(resultadoVenta([gana], ventas[1], estadoContratos(ventas, { antesDe: 't1' })).participacion).toBe(900_000);
    const t2 = resultadoVenta([pierde], ventas[0], estadoContratos(ventas, { antesDe: 't2' }));
    expect(t2.liquidaciones[0]).toMatchObject({ pagadoAntes: 900_000, monto: 0, saldoAFavor: 300_000 });
  });

  it('un saldo a favor se absorbe con la ganancia de la venta siguiente, en parte o del todo', () => {
    const ventas = [venta('v1', '2026-09-01', [gana], '1'), venta('v2', '2026-09-02', [pierde], '2')];
    const chica = { pesoKg: 200, costoCop: 1_200_000, contratoId: 'C1', porcentajeTenedor: 50 }; // gana 400.000
    // Acumulado 1.600.000: le tocan 800.000 y ya se pagaron 900.000; no paga y el saldo baja a 100.000.
    expect(resultadoVenta([chica], { precioKg: 8_000 }, estadoContratos(ventas)).liquidaciones[0]).toMatchObject({ monto: 0, saldoAFavor: 100_000 });
    // Acumulado 3.000.000: le tocan 1.500.000 y ya se pagaron 900.000; paga 600.000 y el saldo queda en 0.
    expect(resultadoVenta([gana], { precioKg: 8_000 }, estadoContratos(ventas)).liquidaciones[0]).toMatchObject({ monto: 600_000, saldoAFavor: 0 });
  });

  it('si el porcentaje del contrato cambia entre ventas, cada animal cuenta con el % de su venta', () => {
    const ventas = [venta('v1', '2026-09-01', [{ ...gana, porcentajeTenedor: 40 }], '1')];
    // Ya se pagaron 720.000 (40 % de 1.800.000); ahora gana 1.800.000 al 50 %: 720.000 + 900.000 − 720.000.
    expect(resultadoVenta([gana], { precioKg: 8_000 }, estadoContratos(ventas)).participacion).toBe(900_000);
  });

  it('un contrato al 0 % acumula sin pagar ni dejar saldo', () => {
    const cero = (a) => ({ ...a, porcentajeTenedor: 0 });
    const ventas = [venta('v1', '2026-09-01', [cero(gana)], '1')];
    expect(resultadoVenta([cero(pierde)], { precioKg: 8_000 }, estadoContratos(ventas)).liquidaciones[0]).toMatchObject({ monto: 0, saldoAFavor: 0, gananciaAcumulada: 1_200_000 });
  });

  it('ordena por hora de registro, sin importar el orden de la lista', () => {
    const ventas = [venta('b', '2026-09-01', [gana], '2026-09-01T11:00Z'), venta('a', '2026-09-01', [pierde], '2026-09-01T10:00Z')];
    expect(estadoContratos(ventas, { antesDe: 'b' }).get('C1')).toEqual({ ganancia: -600_000, parte: -300_000, pagado: 0 });
    expect(estadoContratos(ventas).get('C1')).toEqual({ ganancia: 1_200_000, parte: 600_000, pagado: 600_000 });
  });

  it('la recomendación descuenta lo que ya se le pagó al tenedor en ventas anteriores', () => {
    // a gana 1.800.000 hoy (50 % = 900.000), pero el contrato ya tiene una pérdida de 600.000 vendida antes.
    const previo = new Map([['C1', { ganancia: -600_000, parte: -300_000, pagado: 0 }]]);
    const animales = [animal('a', { contratoId: 'C1', porcentajeTenedor: 50 }), animal('b')];
    expect(analizarLoteV2(base({ animales, contratosPrevios: previo })).hoy.participacion).toBe(600_000);
  });
});
