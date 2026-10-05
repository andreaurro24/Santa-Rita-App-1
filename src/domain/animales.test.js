import { describe, expect, it } from 'vitest';
import {
  cuentaCompra,
  duenosExistentes,
  esVientre,
  etiquetaCategoria,
  kiloDesdeTotal,
  mesAnioDesdeNacimiento,
  nacimientoDesdeMesAnio,
  pidePesoObjetivo,
  problemaNacimiento,
  RAZAS_BOVINO,
  siguienteNumero,
  sugerirNombre,
  textoNacimiento,
  totalDesdeKilo,
} from './animales';

describe('categorías (spec 016 · R5, R6, R8)', () => {
  it('los tres tipos de vientre son vientres y no piden peso objetivo', () => {
    for (const c of ['vientre_menor', 'vientre_mayor', 'vientre_parida']) {
      expect(esVientre(c)).toBe(true);
      expect(pidePesoObjetivo(c)).toBe(false);
    }
    expect(esVientre('ternera')).toBe(false);
    expect(pidePesoObjetivo('novillo')).toBe(true);
  });

  it('etiquetas legibles, también de caballos', () => {
    expect(etiquetaCategoria('vientre_parida')).toBe('Vientre parida');
    expect(etiquetaCategoria('yegua')).toBe('Yegua');
  });
});

describe('compra por kilo o por animal (R7)', () => {
  it('total = precio por kilo × peso, y kilo = total / peso', () => {
    expect(totalDesdeKilo(8_000, 250)).toBe(2_000_000);
    expect(kiloDesdeTotal(2_000_000, 250)).toBe(8_000);
    expect(kiloDesdeTotal(1_000_000, 300)).toBe(3_333);
  });

  it('sin datos suficientes no inventa un valor', () => {
    expect(totalDesdeKilo(8_000, 0)).toBeNull();
    expect(kiloDesdeTotal(null, 250)).toBeNull();
  });
});

describe('dueños existentes (R4)', () => {
  it('sin repetidos ni vacíos, en orden alfabético', () => {
    const animales = [{ dueno: 'José' }, { dueno: ' josé ' }, { dueno: 'Familia' }, { dueno: null }, { dueno: '' }];
    expect(duenosExistentes(animales)).toEqual(['Familia', 'José']);
  });
});

describe('spec 023 · R1 nombre con número', () => {
  const hato = [{ numeroInterno: 'Luna-041' }, { numeroInterno: 'Toro-007' }, { numeroInterno: 'Sin número' }];
  it('el consecutivo es de toda la finca', () => {
    expect(siguienteNumero(hato)).toBe(42);
    expect(siguienteNumero([])).toBe(1);
  });
  it('sugiere el nombre con 3 cifras y no sugiere si ya trae número', () => {
    expect(sugerirNombre('Luna', hato)).toBe('Luna-042');
    expect(sugerirNombre(' Sol- ', [])).toBe('Sol-001');
    expect(sugerirNombre('Luna-050', hato)).toBeNull();
    expect(sugerirNombre('', hato)).toBeNull();
  });
});

describe('spec 023 · R2 razas', () => {
  it('incluye las cebuinas y criollas del Caribe', () => {
    expect(RAZAS_BOVINO).toEqual(expect.arrayContaining(['Brahman', 'Gyr', 'Romosinuano', 'Costeño con Cuernos']));
  });
});

describe('spec 023 · R3 nacimiento por mes y año', () => {
  it('guarda el día 1 del mes, o el 1 de enero si no se sabe el mes', () => {
    expect(nacimientoDesdeMesAnio('3', '2024')).toEqual({ fechaNacimiento: '2024-03-01', nacimientoMesConocido: true });
    expect(nacimientoDesdeMesAnio('', '2024')).toEqual({ fechaNacimiento: '2024-01-01', nacimientoMesConocido: false });
    expect(nacimientoDesdeMesAnio('3', '')).toEqual({ fechaNacimiento: null, nacimientoMesConocido: null });
    expect(mesAnioDesdeNacimiento('2024-01-01', false)).toEqual({ mes: '', anio: '2024' });
    expect(mesAnioDesdeNacimiento('2024-03-01', true)).toEqual({ mes: '3', anio: '2024' });
  });
  it('rechaza el futuro y antes del 2000', () => {
    expect(problemaNacimiento('11', '2026', '2026-10-05')).toMatch(/futuro/);
    expect(problemaNacimiento('10', '2026', '2026-10-05')).toBeNull();
    expect(problemaNacimiento('', '1999', '2026-10-05')).toMatch(/2000/);
    expect(problemaNacimiento('5', '', '2026-10-05')).toMatch(/año/);
  });
  it('muestra el mes o solo el año, con la edad', () => {
    expect(textoNacimiento('2024-03-01', true, '2026-10-05')).toBe('Nació en marzo de 2024 (2 años)');
    expect(textoNacimiento('2026-01-01', false, '2026-10-05')).toBe('Nació en 2026 (unos 9 meses)');
  });
});

describe('spec 023 · R6 cuenta de la compra', () => {
  const f = (n) => new Intl.NumberFormat('es-CO').format(n);
  it('por kilo multiplica y por animal divide', () => {
    expect(cuentaCompra({ modo: 'kilo', precioKg: 9000, peso: 450 }, f)).toEqual({ calculado: 4050000, cuenta: '$9.000 × 450 kg = $4.050.000' });
    expect(cuentaCompra({ modo: 'animal', total: 4050000, peso: 450 }, f)).toEqual({ calculado: 9000, cuenta: '$4.050.000 ÷ 450 kg = $9.000 por kilo' });
  });
  it('dice qué falta', () => {
    expect(cuentaCompra({ modo: 'kilo', precioKg: 9000, peso: '' }, f).falta).toMatch(/peso/);
    expect(cuentaCompra({ modo: 'animal', total: 0, peso: 450 }, f).falta).toMatch(/precio/);
  });
});
