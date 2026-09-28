import { describe, expect, it } from 'vitest';
import { mapAnimal } from './hato';

const fila = {
  id: 'a1',
  numero_interno: '0101',
  chapeta_ica: 'COL-CES-1',
  marca_finca: 'Hierro Santa Rita (SR)',
  sexo: 'Macho',
  categoria: 'novillo',
  origen: 'compra',
  fecha_ingreso: '2026-01-19',
  peso_ingreso_kg: '159.2',
  peso_objetivo_kg: '338.0',
  costo_compra_cop: 947081,
  estado: 'activo',
  lote: { id: 'l1', codigo: 'LOTE-2025-B', nombre: 'Lote 2025-B' },
  contrato: null,
  pesajes: [{ fecha: '2026-01-19', peso_kg: '162.0', created_at: '2026-01-19T10:00:00Z' }],
  eventos_sanitarios: [
    { id: 'e1', tipo: 'vacuna', descripcion: 'Aftosa', estado: 'aplicado', fecha_aplicada: '2026-05-25', fecha_programada: null },
    { id: 'e2', tipo: 'desparasitacion', descripcion: 'Refuerzo', estado: 'programado', fecha_aplicada: null, fecha_programada: '2026-10-01' },
  ],
};

describe('mapAnimal', () => {
  it('convierte la fila de Supabase a la forma que usan las páginas', () => {
    const a = mapAnimal(fila);
    expect(a).toMatchObject({
      numeroInterno: '0101',
      origen: 'Compra',
      estado: 'Activo',
      pesoIngreso: 159.2,
      pesoObjetivo: 338,
      lote: 'LOTE-2025-B',
      esquema: 'Propio',
      tenedor: null,
    });
    expect(a.pesos[0]).toEqual({ fecha: '2026-01-19', pesoKg: 162, creado: '2026-01-19T10:00:00Z' });
    expect(a.sanidad[0]).toMatchObject({ tipo: 'Vacuna', fecha: '2026-05-25' });
    expect(a.sanidad[1]).toMatchObject({ tipo: 'Desparasitación', pendiente: true, proximaFecha: '2026-10-01', fecha: null });
  });

  it('marca "Al partir" con el tenedor, su finca y el porcentaje', () => {
    const a = mapAnimal({
      ...fila,
      contrato: { id: 'c1', porcentaje_ganancia: '40.00', tenedor: { nombre: 'Elvia Torres', finca: { nombre: 'Hato Los Alcaravanes' } } },
    });
    expect(a.esquema).toBe('Al partir');
    expect(a.tenedor).toBe('Elvia Torres – Hato Los Alcaravanes');
    expect(a.porcentajeTenedor).toBe(40);
  });

  it('conserva costo de compra cero (no lo confunde con vacío)', () => {
    expect(mapAnimal({ ...fila, costo_compra_cop: 0 }).costoCompra).toBe(0);
    expect(mapAnimal({ ...fila, costo_compra_cop: null }).costoCompra).toBeNull();
  });
});
