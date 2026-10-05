import { describe, expect, it } from 'vitest';
import { coincide, ordenarAnimales, paginar, pasaEstado } from './tabla';

const a = (numeroInterno, extra = {}) => ({ numeroInterno, estado: 'Activo', pesos: [], ...extra });

describe('tabla de animales (spec 022)', () => {
  it('R3: ordena por nombre con números naturales y por pesos, con los vacíos al final', () => {
    const lista = [a('Luna-010', { pesoIngreso: 300 }), a('Luna-002', { pesoIngreso: null }), a('Álamo-001', { pesoIngreso: 250 })];
    expect(ordenarAnimales(lista).map((x) => x.numeroInterno)).toEqual(['Álamo-001', 'Luna-002', 'Luna-010']);
    expect(ordenarAnimales(lista, 'pesoInicial', 'desc').map((x) => x.numeroInterno)).toEqual(['Luna-010', 'Álamo-001', 'Luna-002']);
    expect(ordenarAnimales(lista, 'pesoInicial', 'asc').map((x) => x.numeroInterno)).toEqual(['Álamo-001', 'Luna-010', 'Luna-002']);
  });

  it('R3: el peso actual es el del último pesaje', () => {
    const lista = [a('A', { pesos: [{ fecha: '2026-01-01', pesoKg: 200 }, { fecha: '2026-02-01', pesoKg: 260 }] }), a('B', { pesos: [{ fecha: '2026-01-01', pesoKg: 230 }] })];
    expect(ordenarAnimales(lista, 'pesoActual', 'desc').map((x) => x.numeroInterno)).toEqual(['A', 'B']);
  });

  it('R3: pagina de a 20 con el rango en texto', () => {
    const lista = Array.from({ length: 34 }, (_, i) => i);
    expect(paginar(lista, 1)).toMatchObject({ pagina: 1, paginas: 2, rango: '1–20 de 34' });
    expect(paginar(lista, 2).items).toHaveLength(14);
    expect(paginar(lista, 9)).toMatchObject({ pagina: 2, rango: '21–34 de 34' });
    expect(paginar([], 1)).toMatchObject({ paginas: 1, rango: '0 de 0' });
  });

  it('R5: filtra por estado y busca por nombre, chapeta, dueño o raza sin tildes', () => {
    expect(pasaEstado(a('x'), 'activos')).toBe(true);
    expect(pasaEstado(a('x', { estado: 'Perdido' }), 'baja')).toBe(true);
    expect(pasaEstado(a('x', { estado: 'Vendido' }), 'activos')).toBe(false);
    expect(pasaEstado(a('x', { estado: 'Vendido' }), 'todos')).toBe(true);
    const res = a('Luna-001', { chapetaICA: 'COL1', dueno: 'José', raza: 'Romosinuano' });
    expect(coincide(res, 'jose')).toBe(true);
    expect(coincide(res, 'ROMO')).toBe(true);
    expect(coincide(res, 'col1')).toBe(true);
    expect(coincide(res, 'brahman')).toBe(false);
  });
});
