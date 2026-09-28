import { describe, expect, it } from 'vitest';
import { mensajeError } from './errores';

describe('mensajeError', () => {
  it('distingue número interno y chapeta repetidos (también con índices normalizados)', () => {
    expect(mensajeError({ code: '23505', message: 'duplicate key value violates unique constraint "animales_numero_interno_key"' })).toMatch(/número interno/);
    expect(mensajeError({ code: '23505', message: 'duplicate key value violates unique constraint "animales_chapeta_ica_normalizada_key"' })).toMatch(/chapeta ICA/);
    expect(mensajeError({ code: '23505', message: 'duplicate key value violates unique constraint "precios_mercado_fecha_fuente_key"' })).toMatch(/precio registrado/);
  });

  it('explica una fecha futura rechazada por la base de datos', () => {
    expect(mensajeError({ code: '23514', message: 'fecha_futura: el pesaje tiene fecha 2099-01-01' })).toMatch(/no puede ser futura/);
    expect(mensajeError({ code: '23514', message: 'new row violates check constraint "pesajes_peso_kg_check"' })).toMatch(/fuera del rango/);
  });

  it('reconoce credenciales incorrectas, permisos y falta de red', () => {
    expect(mensajeError({ message: 'Invalid login credentials' })).toBe('Correo o contraseña incorrectos.');
    expect(mensajeError({ code: '42501', message: 'permission denied' })).toMatch(/permiso/);
    expect(mensajeError({ message: 'TypeError: Failed to fetch' })).toMatch(/No hay conexión/);
  });

  it('devuelve null sin error y un mensaje accionable para lo desconocido', () => {
    expect(mensajeError(null)).toBeNull();
    expect(mensajeError({ message: 'algo raro' })).toMatch(/Inténtalo de nuevo/);
  });
});
