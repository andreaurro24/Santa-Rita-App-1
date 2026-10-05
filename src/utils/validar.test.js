import { describe, expect, it } from 'vitest';
import { mensajeNombre, nombreValido, numeroAPesos, pesosANumero } from './validar';

describe('nombres válidos (spec 018 · R2)', () => {
  it('acepta letras con tildes, ñ, números y signos comunes', () => {
    expect(nombreValido('José Peña')).toBe(true);
    expect(nombreValido('Lote 2026-A (Ceba – mitad de ciclo)')).toBe(true);
    expect(nombreValido("Finca O'Neil #2 / Norte")).toBe(true);
  });

  it('rechaza caracteres raros, vacíos y textos muy largos', () => {
    expect(nombreValido('Juan<script>')).toBe(false);
    expect(nombreValido('😀 vaca')).toBe(false);
    expect(nombreValido('   ')).toBe(false);
    expect(nombreValido('a'.repeat(81))).toBe(false);
    expect(nombreValido('1234567890123456789012345678901', 30)).toBe(false);
  });

  it('mensajes claros; opcional vacío no es error', () => {
    expect(mensajeNombre('', 'el dueño', { opcional: true })).toBe('');
    expect(mensajeNombre('', 'el nombre')).toBe('Escribe el nombre.');
    expect(mensajeNombre('Ana$', 'el dueño')).toMatch(/^Dueño solo puede tener letras/);
  });
});

describe('pesos con puntos de miles (spec 018 · R1)', () => {
  it('formatea mientras se escribe', () => {
    expect(numeroAPesos('1000')).toBe('1.000');
    expect(numeroAPesos('1000000')).toBe('1.000.000');
    expect(numeroAPesos('1.2a50')).toBe('1.250');
    expect(numeroAPesos('007')).toBe('7');
    expect(numeroAPesos('')).toBe('');
  });

  it('lee el número sin puntos', () => {
    expect(pesosANumero('1.250.000')).toBe(1_250_000);
    expect(pesosANumero('$ 8.000')).toBe(8_000);
    expect(pesosANumero('')).toBeNull();
  });
});
