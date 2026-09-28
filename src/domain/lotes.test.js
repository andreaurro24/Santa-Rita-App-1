import { describe, expect, it } from 'vitest';
import { resumenLote, vientresHaciaCeba } from './lotes';

const animal = (pesos, extra = {}) => ({
  estado: 'Activo',
  pesoIngreso: pesos[0][1],
  pesoObjetivo: 350,
  pesos: pesos.map(([fecha, pesoKg]) => ({ fecha, pesoKg })),
  ...extra,
});

describe('resumenLote', () => {
  it('R2: promedio, avance, GDP y fecha proyectada = hoy + (meta − promedio) / GDP', () => {
    const lote = {
      pesoMeta: 350,
      animales: [
        animal([['2026-07-01', 200], ['2026-09-29', 290]]), // 1,0 kg/día
        animal([['2026-07-01', 200], ['2026-09-29', 245]]), // 0,5 kg/día
      ],
    };
    const r = resumenLote(lote, '2026-09-29');
    expect(r.nActivos).toBe(2);
    expect(r.pesoPromedio).toBe(267.5);
    expect(r.gdp).toBe(0.75);
    expect(r.avancePct).toBe(76.4);
    // (350 − 267,5) / 0,75 = 110 días
    expect(r.proyeccion).toEqual({ tipo: 'fecha', dias: 110, fecha: '2027-01-17' });
  });

  it('sin meta del lote usa el promedio de las metas de sus animales', () => {
    const lote = { animales: [animal([['2026-07-01', 200], ['2026-09-29', 290]], { pesoObjetivo: 300 }), animal([['2026-07-01', 200], ['2026-09-29', 290]], { pesoObjetivo: 320 })] };
    expect(resumenLote(lote, '2026-09-29').meta).toBe(310);
  });

  it('R3: sin dos pesajes o con GDP ≤ 0 no inventa una fecha', () => {
    expect(resumenLote({ pesoMeta: 350, animales: [animal([['2026-09-01', 200]])] }, '2026-09-29').proyeccion).toEqual({ tipo: 'sin_datos' });
    expect(resumenLote({ pesoMeta: 350, animales: [animal([['2026-08-01', 300], ['2026-09-01', 290]])] }, '2026-09-29').proyeccion).toEqual({ tipo: 'sin_datos' });
  });

  it('R4: con el promedio en la meta o por encima, la meta está alcanzada', () => {
    const r = resumenLote({ pesoMeta: 300, animales: [animal([['2026-07-01', 250], ['2026-09-01', 305]])] }, '2026-09-29');
    expect(r.proyeccion).toEqual({ tipo: 'meta_alcanzada' });
  });

  it('ignora animales que no están activos', () => {
    const lote = { pesoMeta: 350, animales: [animal([['2026-07-01', 200], ['2026-09-29', 290]]), animal([['2026-07-01', 100], ['2026-09-29', 100]], { estado: 'Vendido' })] };
    expect(resumenLote(lote, '2026-09-29').nActivos).toBe(1);
  });

  it('lote vacío', () => {
    expect(resumenLote({ animales: [] }, '2026-09-29').proyeccion).toEqual({ tipo: 'sin_animales' });
  });
});

describe('vientresHaciaCeba (R8, D2)', () => {
  const vientre = { categoria: 'vientre' };
  const novillo = { categoria: 'novillo' };
  it('avisa solo si el destino es un lote de ceba', () => {
    expect(vientresHaciaCeba([vientre, novillo], { tipo: 'ceba' })).toEqual([vientre]);
    expect(vientresHaciaCeba([vientre], { tipo: 'cria' })).toEqual([]);
    expect(vientresHaciaCeba([vientre], null)).toEqual([]);
  });
});
