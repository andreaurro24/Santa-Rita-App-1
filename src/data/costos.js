import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { repartirCostos } from '../domain/costos';
import { useHato } from './hato';

// Spec 008 · gastos por lote o por animal.
const mapCosto = (c) => ({
  id: c.id,
  loteId: c.lote_id,
  animalId: c.animal_id,
  categoria: c.categoria,
  descripcion: c.descripcion,
  montoCop: Number(c.monto_cop),
  fecha: c.fecha,
});

export function useCostos() {
  return useQuery({
    queryKey: ['costos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('costos')
        .select('id, lote_id, animal_id, categoria, descripcion, monto_cop, fecha')
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data.map(mapCosto);
    },
  });
}

export function useGuardarCosto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (c) => {
      const fila = {
        lote_id: c.loteId,
        animal_id: c.animalId || null,
        categoria: c.categoria,
        descripcion: c.descripcion.trim(),
        monto_cop: c.montoCop,
        fecha: c.fecha,
      };
      const { error } = c.id ? await supabase.from('costos').update(fila).eq('id', c.id) : await supabase.from('costos').insert(fila);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['costos'] }),
  });
}

export function useBorrarCosto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      // RLS solo deja borrar al dueño; si no borra nada, se avisa en vez de fallar en silencio.
      const { data, error } = await supabase.from('costos').delete().eq('id', id).select('id');
      if (error) throw error;
      if (!data.length) throw Object.assign(new Error('Solo el dueño puede borrar gastos.'), { code: '42501' });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['costos'] }),
  });
}

// Movimientos de lote de todos los animales (para saber en qué lote estaba cada uno en cada fecha)
// y fecha de venta de los vendidos. Son los datos que necesita el reparto histórico de costos.
function useHistoriaLotes() {
  return useQuery({
    queryKey: ['historia-lotes'],
    queryFn: async () => {
      const [movs, vendidos] = await Promise.all([
        supabase.from('movimientos').select('animal_id, fecha, desde_lote_id, hacia_lote_id, created_at'),
        supabase.from('venta_animales').select('animal_id, venta:ventas ( fecha )'),
      ]);
      if (movs.error) throw movs.error;
      if (vendidos.error) throw vendidos.error;
      return {
        movimientos: movs.data.map((m) => ({ animalId: m.animal_id, fecha: m.fecha, desdeLoteId: m.desde_lote_id, haciaLoteId: m.hacia_lote_id, creado: m.created_at })),
        salidas: new Map(vendidos.data.map((v) => [v.animal_id, v.venta?.fecha])),
      };
    },
  });
}

// Spec 008 · reparto de todos los gastos entre todos los animales (D9, con historial de lotes).
export function useRepartoCostos() {
  const hato = useHato();
  const costos = useCostos();
  const historia = useHistoriaLotes();
  const reparto = useMemo(() => {
    if (!hato.data || !costos.data || !historia.data) return null;
    const animales = hato.data.animales.map((a) => ({ ...a, fechaSalida: historia.data.salidas.get(a.id) ?? null }));
    return repartirCostos(costos.data, animales, historia.data.movimientos);
  }, [hato.data, costos.data, historia.data]);
  return { queries: [hato, costos, historia], reparto, costos: costos.data };
}
