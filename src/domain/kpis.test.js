import { describe, expect, it } from 'vitest';
import { calcularKpis } from './kpis';

const a = (id, loteId, fechas, extra = {}) => ({
  id,
  loteId,
  estado: 'Activo',
  numeroInterno: id,
  chapetaICA: `CH-${id}`,
  pesos: fechas.map((fecha, i) => ({ fecha, pesoKg: 200 + i })),
  ...extra,
});

describe('calcularKpis (spec 012 · R1)', () => {
  const entrada = {
    animales: [
      a('1', 'L1', ['2026-08-01', '2026-09-01']),
      a('2', 'L1', ['2026-09-10']),
      a('3', 'L2', ['2026-07-01', '2026-07-01']), // dos pesajes el mismo día no son historial
      a('4', 'L2', ['2026-06-01', '2026-09-20'], { estado: 'Vendido' }),
    ],
    lotes: [
      { id: 'L1', nombre: 'Lote 1', estado: 'activo' },
      { id: 'L2', nombre: 'Lote 2', estado: 'activo' },
      { id: 'L3', nombre: 'Vendido', estado: 'vendido' },
    ],
    ventas: [{ recomendacion: { recomendacion: 'VENDER' } }, { recomendacion: { recomendacion: 'ESPERAR' } }, { recomendacion: null }],
    hoy: '2026-09-30',
    fuentes: [
      { nombre: 'Precio', activa: true },
      { nombre: 'Clima', activa: true },
      { nombre: 'TRM', activa: false },
    ],
  };

  it('porcentajes de registro e historial sobre los activos', () => {
    const k = calcularKpis(entrada);
    expect(k.activos).toBe(3);
    expect(k.registroDigitalPct).toBe(100);
    expect(k.historialPesoPct).toBe(33.3);
  });

  it('días desde el último pesaje de cada lote activo con animales', () => {
    const k = calcularKpis(entrada);
    expect(k.porLote).toEqual([
      { id: 'L1', nombre: 'Lote 1', animales: 2, ultimoPesaje: '2026-09-10', dias: 20 },
      { id: 'L2', nombre: 'Lote 2', animales: 1, ultimoPesaje: '2026-07-01', dias: 91 },
    ]);
  });

  it('fuentes activas y ventas que siguieron la recomendación', () => {
    const k = calcularKpis(entrada);
    expect(k.fuentesActivas).toBe(2);
    expect(k.ventas).toBe(3);
    expect(k.ventasConRecomendacion).toBe(2);
    expect(k.ventasQueSiguieron).toBe(1);
  });

  it('sin animales no divide por cero', () => {
    expect(calcularKpis({ ...entrada, animales: [] }).registroDigitalPct).toBeNull();
  });
});
