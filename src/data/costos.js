import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

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
