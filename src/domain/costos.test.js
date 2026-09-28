import { describe, expect, it } from 'vitest';
import { costoAcumuladoAnimal, estabaEnLote, loteEnFecha, repartirCostos, resumenCostosLote } from './costos';

const animal = (id, fechaIngreso, extra = {}) => ({ id, loteId: 'L', fechaIngreso, estado: 'Activo', costoCompra: 1_000_000, ...extra });
const costo = (montoCop, fecha, extra = {}) => ({ loteId: 'L', animalId: null, categoria: 'suplemento', montoCop, fecha, ...extra });
const mov = (animalId, fecha, desdeLoteId, haciaLoteId) => ({ animalId, fecha, desdeLoteId, haciaLoteId });

describe('loteEnFecha / estabaEnLote', () => {
  it('reconstruye el lote en una fecha desde los movimientos', () => {
    const a = animal('a', '2026-01-01', { loteId: 'X' }); // hoy en X; estuvo en L hasta el 1-jun
    const movs = [mov('a', '2026-06-01', 'L', 'X')];
    expect(loteEnFecha(a, '2026-03-01', movs)).toBe('L');
    expect(loteEnFecha(a, '2026-06-01', movs)).toBe('X');
    expect(loteEnFecha(a, '2026-09-01', movs)).toBe('X');
    expect(loteEnFecha(a, '2026-09-01', [])).toBe('X');
  });

  it('no estaba antes de ingresar ni después de venderse', () => {
    const a = animal('a', '2026-03-01', { fechaSalida: '2026-08-01' });
    expect(estabaEnLote(a, 'L', '2026-02-01', [])).toBe(false);
    expect(estabaEnLote(a, 'L', '2026-05-01', [])).toBe(true);
    expect(estabaEnLote(a, 'L', '2026-09-01', [])).toBe(false);
  });
});

describe('repartirCostos + costoAcumuladoAnimal (R3, R4, D9)', () => {
  it('$1.000.000 entre 30 = $33.333,33 cada uno', () => {
    const lote = Array.from({ length: 30 }, (_, i) => animal(`a${i}`, '2026-08-01'));
    const r = costoAcumuladoAnimal(lote[0], repartirCostos([costo(1_000_000, '2026-09-01')], lote));
    expect(r.deLote).toBeCloseTo(33_333.33, 2);
    expect(r.total).toBeCloseTo(1_033_333.33, 2);
  });

  it('un animal que ingresó después del gasto no paga parte de él', () => {
    const lote = [animal('a', '2026-01-01'), animal('b', '2026-06-01')];
    const reparto = repartirCostos([costo(100_000, '2026-03-01')], lote);
    expect(costoAcumuladoAnimal(lote[0], reparto).deLote).toBe(100_000);
    expect(costoAcumuladoAnimal(lote[1], reparto).deLote).toBe(0);
  });

  it('el gasto directo sigue al animal aunque cambie de lote (verificación 008, Alto)', () => {
    const b = animal('b', '2026-01-01', { loteId: 'X' });
    const c = [costo(50_000, '2026-03-01', { animalId: 'b', categoria: 'medicamentos' })];
    const r = costoAcumuladoAnimal(b, repartirCostos(c, [animal('a', '2026-01-01'), b], [mov('b', '2026-06-01', 'L', 'X')]));
    expect(r.directos).toBe(50_000);
    expect(r.porCategoria).toEqual({ medicamentos: 50_000 });
  });

  it('mover un animal no reparte hacia atrás (verificación 008, Medio)', () => {
    // a y b en L desde enero; gasto de 200.000 en marzo; en junio c llega a L desde X.
    const a = animal('a', '2026-01-01');
    const b = animal('b', '2026-01-01');
    const c = animal('c', '2026-01-01'); // hoy en L, pero en marzo estaba en X
    const reparto = repartirCostos([costo(200_000, '2026-03-01')], [a, b, c], [mov('c', '2026-06-01', 'X', 'L')]);
    expect(costoAcumuladoAnimal(a, reparto).deLote).toBe(100_000);
    expect(costoAcumuladoAnimal(c, reparto).deLote).toBe(0);
  });

  it('un animal vendido no recibe gastos posteriores a su venta', () => {
    const a = animal('a', '2026-01-01');
    const v = animal('v', '2026-01-01', { estado: 'Vendido', fechaSalida: '2026-05-01' });
    const reparto = repartirCostos([costo(100_000, '2026-06-01')], [a, v]);
    expect(costoAcumuladoAnimal(a, reparto).deLote).toBe(100_000);
    expect(costoAcumuladoAnimal(v, reparto).deLote).toBe(0);
  });

  it('un gasto de lote sin animales en su fecha queda marcado como sin repartir', () => {
    const tarde = animal('a', '2026-06-01');
    const reparto = repartirCostos([costo(500_000, '2026-03-01')], [tarde]);
    expect(reparto.sinRepartir).toHaveLength(1);
    expect(costoAcumuladoAnimal(tarde, reparto).deLote).toBe(0);
  });

  it('cría propia sin costo de compra', () => {
    const a = animal('a', '2026-01-01', { costoCompra: null });
    expect(costoAcumuladoAnimal(a, repartirCostos([costo(10_000, '2026-02-01')], [a])).total).toBe(10_000);
  });
});

describe('resumenCostosLote (R5)', () => {
  it('total de los gastos del lote y promedio del costo acumulado de los activos', () => {
    const lote = [animal('a', '2026-01-01'), animal('b', '2026-01-01'), animal('c', '2026-01-01', { estado: 'Vendido' })];
    const c = [costo(300_000, '2026-02-01'), costo(30_000, '2026-02-01', { animalId: 'a', categoria: 'jornales' })];
    const r = resumenCostosLote(lote, c, repartirCostos(c, lote));
    expect(r.total).toBe(330_000);
    expect(r.porCategoria).toEqual({ suplemento: 300_000, jornales: 30_000 });
    expect(r.promedioPorAnimal).toBe(1_115_000);
  });

  it('sin animales activos no hay promedio', () => {
    expect(resumenCostosLote([], [], new Map()).promedioPorAnimal).toBeNull();
  });
});
