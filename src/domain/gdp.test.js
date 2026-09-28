import { describe, expect, it } from 'vitest';
import { caidaUltimoPesaje, diasEntre, gdpLote, gdpReciente, gdpTotal, pierdePeso, variacionSospechosa } from './gdp';

const p = (fecha, pesoKg, creado) => ({ fecha, pesoKg, creado });

describe('diasEntre', () => {
  it('cuenta días calendario sin importar el horario de verano ni la zona', () => {
    expect(diasEntre('2026-01-01', '2026-01-31')).toBe(30);
    expect(diasEntre('2026-02-28', '2026-03-01')).toBe(1);
    expect(diasEntre('2026-09-28', '2026-09-28')).toBe(0);
  });
});

describe('gdpTotal (R5)', () => {
  it('kg ganados entre el primer y el último pesaje, por día', () => {
    expect(gdpTotal([p('2026-01-01', 200), p('2026-01-31', 215), p('2026-03-02', 230)])).toBe(0.5); // 30 kg en 60 días
  });

  it('ordena por fecha aunque lleguen desordenados', () => {
    expect(gdpTotal([p('2026-03-02', 230), p('2026-01-01', 200)])).toBe(0.5);
  });

  it('null con un solo pesaje o con todos el mismo día', () => {
    expect(gdpTotal([p('2026-01-01', 200)])).toBeNull();
    expect(gdpTotal([p('2026-01-01', 200, 'a'), p('2026-01-01', 201, 'b')])).toBeNull();
    expect(gdpTotal([])).toBeNull();
  });
});

describe('gdpReciente (R5) y pierdePeso (R7)', () => {
  it('usa el último pesaje contra el más reciente de al menos 14 días antes', () => {
    const pesos = [p('2026-01-01', 200), p('2026-02-01', 231), p('2026-03-03', 246)];
    expect(gdpReciente(pesos)).toBe(0.5);
  });

  it('ignora pesajes muy seguidos (ruido de báscula): 2026-09-07 → 09-16 no es un periodo', () => {
    const pesos = [p('2026-08-08', 328.4), p('2026-09-07', 351.3), p('2026-09-16', 349.8)];
    expect(gdpReciente(pesos)).toBeCloseTo((349.8 - 328.4) / 39, 3);
    expect(pierdePeso({ pesos })).toBe(false);
  });

  it('null si no hay un pesaje de al menos 14 días antes', () => {
    expect(gdpReciente([p('2026-09-07', 351), p('2026-09-16', 349)])).toBeNull();
  });

  it('dos pesajes el mismo día cuentan como uno (el último registrado)', () => {
    const pesos = [p('2026-08-01', 300), p('2026-08-31', 290, '2026-08-31T10:00:00Z'), p('2026-08-31', 310, '2026-08-31T11:00:00Z')];
    expect(gdpReciente(pesos)).toBeCloseTo(10 / 30, 3);
  });

  it('300 → 290 kg es pérdida de peso', () => {
    const animal = { pesos: [p('2026-08-01', 300), p('2026-08-31', 290)] };
    expect(gdpReciente(animal.pesos)).toBeLessThan(0);
    expect(pierdePeso(animal)).toBe(true);
  });

  it('casos de la verificación 004: caídas grandes en pocos días sí alertan', () => {
    expect(pierdePeso({ pesos: [p('2026-09-01', 300), p('2026-09-08', 290)] })).toBe(true); // −10 kg en 7 días
    expect(pierdePeso({ pesos: [p('2026-08-01', 280), p('2026-09-01', 300), p('2026-09-13', 280)] })).toBe(true); // −20 kg en 12 días
    expect(pierdePeso({ pesos: [p('2026-09-01', 300), p('2026-09-11', 285)] })).toBe(true); // −15 kg en 10 días
  });

  it('dos caídas pequeñas seguidas que suman más de 8 kg sí alertan (verificación 004 r2)', () => {
    const pesos = [p('2026-09-01', 300), p('2026-09-05', 340), p('2026-09-11', 332), p('2026-09-18', 324)];
    expect(caidaUltimoPesaje(pesos)).toBe(16);
    expect(pierdePeso({ pesos })).toBe(true);
  });

  it('el ruido de báscula (≤ 8 kg entre pesajes seguidos) no alerta', () => {
    expect(caidaUltimoPesaje([p('2026-09-07', 351.3), p('2026-09-16', 344.1)])).toBe(7.2);
    expect(pierdePeso({ pesos: [p('2026-08-08', 328.4), p('2026-09-07', 351.3), p('2026-09-16', 344.1)] })).toBe(false);
    expect(caidaUltimoPesaje([p('2026-09-07', 300), p('2026-09-16', 310)])).toBe(0);
  });

  it('sin datos suficientes no marca pérdida', () => {
    expect(pierdePeso({ pesos: [p('2026-08-01', 300)] })).toBe(false);
  });
});

describe('gdpLote (R6)', () => {
  it('promedia la GDP de los animales activos con dato e ignora los demás', () => {
    const lote = [
      { estado: 'Activo', pesos: [p('2026-01-01', 200), p('2026-01-11', 210)] }, // 1.0
      { estado: 'Activo', pesos: [p('2026-01-01', 200), p('2026-01-11', 205)] }, // 0.5
      { estado: 'Activo', pesos: [p('2026-01-01', 200)] }, // sin dato
      { estado: 'Vendido', pesos: [p('2026-01-01', 200), p('2026-01-11', 300)] }, // no activo
    ];
    expect(gdpLote(lote)).toBe(0.75);
  });

  it('null si ningún animal tiene dato', () => {
    expect(gdpLote([{ estado: 'Activo', pesos: [] }])).toBeNull();
  });
});

describe('variacionSospechosa (R3)', () => {
  it('marca cambios de más del 15 % frente al último peso', () => {
    expect(variacionSospechosa(390, 300)).toBe(true); // +30 %
    expect(variacionSospechosa(250, 300)).toBe(true); // −16,7 %
    expect(variacionSospechosa(340, 300)).toBe(false); // +13,3 %
    expect(variacionSospechosa(345, 300)).toBe(false); // +15 % exacto no es sospechoso
  });

  it('sin peso anterior no hay con qué comparar', () => {
    expect(variacionSospechosa(300, null)).toBe(false);
  });
});
