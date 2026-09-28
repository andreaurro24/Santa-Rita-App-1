import { describe, expect, it } from 'vitest';
import { animalesElegibles, costoAcumuladoAnimal, resumenCostosLote } from './costos';

const animal = (id, fechaIngreso, extra = {}) => ({ id, loteId: 'L', fechaIngreso, estado: 'Activo', costoCompra: 1_000_000, ...extra });
const costo = (montoCop, fecha, extra = {}) => ({ loteId: 'L', animalId: null, categoria: 'suplemento', montoCop, fecha, ...extra });

describe('animalesElegibles', () => {
  it('solo los que ya habían ingresado en la fecha del gasto (incluido ese día)', () => {
    const lote = [animal('a', '2026-01-01'), animal('b', '2026-03-01'), animal('c', '2026-03-02')];
    expect(animalesElegibles(lote, '2026-03-01').map((a) => a.id)).toEqual(['a', 'b']);
  });
});

describe('costoAcumuladoAnimal (R3, R4, D9)', () => {
  it('reparte un gasto de lote por partes iguales: $1.000.000 entre 30 = $33.333,33 cada uno', () => {
    const lote = Array.from({ length: 30 }, (_, i) => animal(`a${i}`, '2026-08-01'));
    const r = costoAcumuladoAnimal(lote[0], [costo(1_000_000, '2026-09-01')], lote);
    expect(r.deLote).toBeCloseTo(33_333.33, 2);
    expect(r.total).toBeCloseTo(1_033_333.33, 2);
  });

  it('un animal que ingresó después del gasto no paga parte de él', () => {
    const lote = [animal('a', '2026-01-01'), animal('b', '2026-06-01')];
    const c = [costo(100_000, '2026-03-01')];
    expect(costoAcumuladoAnimal(lote[0], c, lote).deLote).toBe(100_000);
    expect(costoAcumuladoAnimal(lote[1], c, lote).deLote).toBe(0);
  });

  it('un gasto directo solo suma al animal asignado', () => {
    const lote = [animal('a', '2026-01-01'), animal('b', '2026-01-01')];
    const c = [costo(50_000, '2026-03-01', { animalId: 'b', categoria: 'medicamentos' })];
    expect(costoAcumuladoAnimal(lote[0], c, lote).gastos).toBe(0);
    const b = costoAcumuladoAnimal(lote[1], c, lote);
    expect(b.directos).toBe(50_000);
    expect(b.porCategoria).toEqual({ medicamentos: 50_000 });
  });

  it('desglosa por categoría y suma la compra', () => {
    const lote = [animal('a', '2026-01-01'), animal('b', '2026-01-01')];
    const c = [costo(200_000, '2026-02-01'), costo(60_000, '2026-02-01', { categoria: 'sal_mineral' }), costo(10_000, '2026-02-01', { animalId: 'a', categoria: 'sal_mineral' })];
    const r = costoAcumuladoAnimal(lote[0], c, lote);
    expect(r.porCategoria).toEqual({ suplemento: 100_000, sal_mineral: 40_000 });
    expect(r.total).toBe(1_140_000);
  });

  it('cría propia sin costo de compra', () => {
    const a = animal('a', '2026-01-01', { costoCompra: null });
    expect(costoAcumuladoAnimal(a, [costo(10_000, '2026-02-01')], [a]).total).toBe(10_000);
  });
});

describe('resumenCostosLote (R5)', () => {
  it('total, por categoría y promedio del costo acumulado de los activos', () => {
    const lote = [animal('a', '2026-01-01'), animal('b', '2026-01-01'), animal('c', '2026-01-01', { estado: 'Vendido' })];
    const c = [costo(300_000, '2026-02-01'), costo(30_000, '2026-02-01', { animalId: 'a', categoria: 'jornales' })];
    const r = resumenCostosLote(lote, c);
    expect(r.total).toBe(330_000);
    expect(r.porCategoria).toEqual({ suplemento: 300_000, jornales: 30_000 });
    // a: 1.000.000 + 100.000 + 30.000; b: 1.000.000 + 100.000 (el vendido también pagó su parte)
    expect(r.promedioPorAnimal).toBe(1_115_000);
  });

  it('sin animales activos no hay promedio', () => {
    expect(resumenCostosLote([], []).promedioPorAnimal).toBeNull();
  });
});
