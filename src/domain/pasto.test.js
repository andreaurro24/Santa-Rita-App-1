import { describe, expect, it } from 'vitest';
import { pastoMasCritico, ultimoPorFinca } from './pasto';

const e = (fincaId, fecha, nivel, creado, potreroId = null) => ({ fincaId, fecha, nivel, creado, potreroId });

describe('ultimoPorFinca (R2)', () => {
  it('toma el más reciente de cada finca y marca los de más de 30 días', () => {
    const r = ultimoPorFinca([e('A', '2026-09-01', 'verde'), e('A', '2026-09-20', 'rojo'), e('B', '2026-07-01', 'amarillo')], '2026-09-30');
    expect(r.get('A')).toMatchObject({ nivel: 'rojo', desactualizado: false });
    expect(r.get('B')).toMatchObject({ nivel: 'amarillo', desactualizado: true });
  });

  it('el mismo día desempata por hora de registro', () => {
    const r = ultimoPorFinca([e('A', '2026-09-20', 'verde', '2026-09-20T10:00Z'), e('A', '2026-09-20', 'rojo', '2026-09-20T11:00Z')], '2026-09-30');
    expect(r.get('A').nivel).toBe('rojo');
  });
});

describe('pastoMasCritico', () => {
  it('el peor nivel vigente, ignorando los desactualizados', () => {
    const estados = [e('A', '2026-09-20', 'amarillo'), e('B', '2026-06-01', 'rojo'), e('C', '2026-09-25', 'verde')];
    expect(pastoMasCritico(estados, '2026-09-30').nivel).toBe('amarillo');
  });

  it('puede limitarse a las fincas donde está el lote', () => {
    const estados = [e('A', '2026-09-20', 'rojo'), e('C', '2026-09-25', 'verde')];
    expect(pastoMasCritico(estados, '2026-09-30', ['C']).nivel).toBe('verde');
  });

  it('null sin estados vigentes', () => {
    expect(pastoMasCritico([], '2026-09-30')).toBeNull();
  });
});

describe('potreros de una misma finca (verificación 009)', () => {
  it('el verde de un potrero no tapa el rojo de otro', () => {
    const estados = [e('A', '2026-09-20', 'rojo', null, 'P1'), e('A', '2026-09-25', 'verde', null, 'P2')];
    expect(ultimoPorFinca(estados, '2026-09-30').get('A').nivel).toBe('rojo');
    expect(pastoMasCritico(estados, '2026-09-30').nivel).toBe('rojo');
  });

  it('un estado nuevo del mismo potrero sí reemplaza al anterior', () => {
    const estados = [e('A', '2026-09-20', 'rojo', null, 'P1'), e('A', '2026-09-25', 'verde', null, 'P1')];
    expect(pastoMasCritico(estados, '2026-09-30').nivel).toBe('verde');
  });
});
