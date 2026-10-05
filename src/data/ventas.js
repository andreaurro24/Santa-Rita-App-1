import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

// Spec 011 · ventas reales. Spec 025 · R6/R8: una venta puede llevar animales de varios lotes (cada
// animal vendido guarda el lote en que estaba) y guarda las comisiones y el transporte.

const SELECT_VENTA = `id, fecha, created_at, comprador, precio_kg_cop, destare_pct, gastos_venta_cop, recomendacion_sistema, notas,
  animales:venta_animales ( animal_id, peso_kg, costo_acumulado_cop, contrato_id, porcentaje_tenedor,
    lote:lotes ( id, nombre ),
    animal:animales ( numero_interno ),
    contrato:contratos_al_partir ( tenedor:tenedores ( nombre ) ) )`;

// "Lote A y Lote B": los lotes de la venta en el orden en que aparecen.
export function nombreLotes(lotes) {
  const nombres = lotes.map((l) => l.nombre);
  if (nombres.length <= 1) return nombres[0] ?? 'Venta';
  return `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}`;
}

function mapVenta(v) {
  const animales = (v.animales ?? []).map((a) => ({
    animalId: a.animal_id,
    numeroInterno: a.animal?.numero_interno,
    loteId: a.lote?.id ?? null,
    loteNombre: a.lote?.nombre ?? null,
    pesoKg: Number(a.peso_kg),
    costoCop: Number(a.costo_acumulado_cop),
    contratoId: a.contrato_id,
    tenedor: a.contrato?.tenedor?.nombre ?? null,
    porcentajeTenedor: a.porcentaje_tenedor != null ? Number(a.porcentaje_tenedor) : null,
  }));
  const lotes = [...new Map(animales.filter((a) => a.loteId).map((a) => [a.loteId, { id: a.loteId, nombre: a.loteNombre }])).values()];
  return {
    id: v.id,
    fecha: v.fecha,
    creado: v.created_at,
    comprador: v.comprador,
    precioKg: v.precio_kg_cop,
    destarePct: Number(v.destare_pct),
    recomendacion: v.recomendacion_sistema,
    notas: v.notas,
    gastosVenta: Number(v.gastos_venta_cop ?? 0),
    lotes,
    titulo: nombreLotes(lotes),
    animales,
  };
}

export function useVentas() {
  return useQuery({
    queryKey: ['ventas'],
    queryFn: async () => {
      const { data, error } = await supabase.from('ventas').select(SELECT_VENTA).order('fecha', { ascending: false });
      if (error) throw error;
      return data.map(mapVenta);
    },
  });
}

// R1–R4 y spec 025 · R5/R6: la venta completa en una transacción (función SQL registrar_venta);
// los lotes los deduce la base de datos de los animales.
export function useRegistrarVenta() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (v) => {
      const { data, error } = await supabase.rpc('registrar_venta', {
        fecha: v.fecha,
        comprador: v.comprador.trim(),
        precio_kg: v.precioKg,
        destare: v.destarePct,
        gastos_venta: Math.round(v.gastosVenta ?? 0),
        recomendacion: v.recomendacion,
        notas: v.notas,
        animales: v.animales.map((a) => ({ animal_id: a.animalId, peso_kg: a.pesoKg, costo_cop: Math.round(a.costoCop) })),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => ['ventas', 'hato', 'lotes', 'historia-lotes'].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] })),
  });
}
