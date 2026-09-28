import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

// Spec 011 · ventas reales de lotes.

const SELECT_VENTA = `id, fecha, comprador, precio_kg_cop, destare_pct, recomendacion_sistema, notas,
  lote:lotes ( id, nombre ),
  animales:venta_animales ( animal_id, peso_kg, costo_acumulado_cop, contrato_id, porcentaje_tenedor,
    animal:animales ( numero_interno ),
    contrato:contratos_al_partir ( tenedor:tenedores ( nombre ) ) )`;

function mapVenta(v) {
  return {
    id: v.id,
    fecha: v.fecha,
    comprador: v.comprador,
    precioKg: v.precio_kg_cop,
    destarePct: Number(v.destare_pct),
    recomendacion: v.recomendacion_sistema,
    notas: v.notas,
    lote: v.lote,
    animales: (v.animales ?? []).map((a) => ({
      animalId: a.animal_id,
      numeroInterno: a.animal?.numero_interno,
      pesoKg: Number(a.peso_kg),
      costoCop: Number(a.costo_acumulado_cop),
      contratoId: a.contrato_id,
      tenedor: a.contrato?.tenedor?.nombre ?? null,
      porcentajeTenedor: a.porcentaje_tenedor != null ? Number(a.porcentaje_tenedor) : null,
    })),
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

// R1–R4: la venta completa en una transacción (función SQL registrar_venta).
export function useRegistrarVenta() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (v) => {
      const { data, error } = await supabase.rpc('registrar_venta', {
        lote: v.loteId,
        fecha: v.fecha,
        comprador: v.comprador.trim(),
        precio_kg: v.precioKg,
        destare: v.destarePct,
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
