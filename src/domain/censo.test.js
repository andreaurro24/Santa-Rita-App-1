import { describe, expect, it } from 'vitest';
import { PLANTILLA_CSV, leerFecha, leerNumero, parsearCSV, validarFilas } from './censo';

const ENC = 'numero_interno;chapeta_ica;sexo;categoria;lote;fecha_ingreso;peso_ingreso_kg;peso_objetivo_kg;costo_compra_cop';
const ctx = {
  hoy: '2026-09-30',
  lotes: [{ id: 'L1', codigo: 'LOTE-2026-A' }],
  existentes: { numeros: new Set(['0101']), chapetas: new Set(['COL-CES-265093']) },
};

describe('parsearCSV (R1)', () => {
  it('lee la plantilla con punto y coma', () => {
    const { filas, error } = parsearCSV(PLANTILLA_CSV);
    expect(error).toBeNull();
    expect(filas[0].datos).toMatchObject({ numeroInterno: '0301', lote: 'LOTE-2026-A', pesoIngreso: '210,5' });
  });

  it('acepta coma como separador, BOM, CRLF, comillas y encabezados con tildes o mayúsculas', () => {
    const csv = '﻿Número Interno,Chapeta ICA,Sexo,Categoría,Lote,Fecha Ingreso,Peso Ingreso Kg,Peso Objetivo Kg\r\n"0302","COL, 1",Macho,novillo,LOTE-2026-A,2026-09-01,200,340\r\n';
    const { filas, error } = parsearCSV(csv);
    expect(error).toBeNull();
    expect(filas[0].datos.chapetaICA).toBe('COL, 1');
    expect(filas[0].datos.costoCompra).toBe('');
  });

  it('avisa si faltan columnas o no hay datos', () => {
    expect(parsearCSV('numero_interno;sexo\n1;Macho').error).toMatch(/Faltan columnas: chapeta_ica/);
    expect(parsearCSV(ENC).error).toMatch(/no tiene filas/);
  });
});

describe('leerFecha y leerNumero', () => {
  it('fechas dd/mm/aaaa y aaaa-mm-dd; rechaza fechas imposibles', () => {
    expect(leerFecha('15/09/2026')).toBe('2026-09-15');
    expect(leerFecha('2026-9-5')).toBe('2026-09-05');
    expect(leerFecha('31/02/2026')).toBeNull();
    expect(leerFecha('ayer')).toBeNull();
  });

  it('números con coma decimal y puntos de miles', () => {
    expect(leerNumero('210,5')).toBe(210.5);
    expect(leerNumero('1.250.000', { entero: true })).toBe(1_250_000);
    expect(leerNumero('$ 1.250.000', { entero: true })).toBe(1_250_000);
    expect(leerNumero('abc')).toBeNull();
    expect(leerNumero('')).toBeNull();
  });
});

describe('validarFilas (R2)', () => {
  const fila = (valores, linea = 2) => ({ linea, datos: Object.fromEntries(Object.entries(valores)) });
  const valida = { numeroInterno: '0301', chapetaICA: 'col-ces-1', sexo: 'macho', categoria: 'Novillo', lote: 'lote-2026-a', fechaIngreso: '15/09/2026', pesoIngreso: '210,5', pesoObjetivo: '350', costoCompra: '1.250.000' };

  it('una fila válida produce el animal normalizado', () => {
    const [r] = validarFilas([fila(valida)], ctx);
    expect(r.errores).toEqual([]);
    expect(r.animal).toEqual({
      numeroInterno: '0301',
      chapetaICA: 'COL-CES-1',
      sexo: 'Macho',
      categoria: 'novillo',
      loteId: 'L1',
      fechaIngreso: '2026-09-15',
      pesoIngreso: 210.5,
      pesoObjetivo: 350,
      costoCompra: 1_250_000,
    });
  });

  it('detecta repetidos contra el hato y dentro del archivo', () => {
    const r = validarFilas(
      [fila({ ...valida, numeroInterno: '0101' }), fila({ ...valida, numeroInterno: '0400', chapetaICA: 'X' }, 3), fila({ ...valida, numeroInterno: '0400', chapetaICA: 'X' }, 4)],
      ctx,
    );
    expect(r[0].errores.join(' ')).toMatch(/0101 ya existe/);
    expect(r[1].errores).toEqual([]);
    expect(r[2].errores.join(' ')).toMatch(/se repite en la fila 3/);
  });

  it('valida sexo y categoría, lote, fechas y pesos', () => {
    const [r] = validarFilas(
      [fila({ ...valida, sexo: 'Hembra', categoria: 'novillo', lote: 'NO-EXISTE', fechaIngreso: '2099-01-01', pesoIngreso: '400', pesoObjetivo: '300', costoCompra: '-5' })],
      ctx,
    );
    expect(r.errores).toEqual([
      'La categoría "novillo" no corresponde a Hembra.',
      'No existe el lote NO-EXISTE.',
      'La fecha de ingreso no puede ser futura.',
      'El peso objetivo debe ser mayor que el de ingreso.',
      'El costo de compra debe ser un número entero de pesos.',
    ]);
    expect(r.animal).toBeNull();
  });

  it('campos obligatorios vacíos', () => {
    const [r] = validarFilas([fila({ ...valida, chapetaICA: '', pesoObjetivo: '' })], ctx);
    expect(r.errores).toContain('Falta chapeta_ica.');
    expect(r.errores).toContain('Falta peso_objetivo_kg.');
  });
});
