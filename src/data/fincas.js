import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

// Spec 006 · R5–R7: fincas (propia y de tenedores), potreros y movimientos de animales.

export function useFincas() {
  return useQuery({
    queryKey: ['fincas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fincas')
        .select('id, nombre, tipo, municipio, potreros ( id, nombre, area_ha )')
        .order('tipo', { ascending: true })
        .order('nombre');
      if (error) throw error;
      return data.map((f) => ({
        id: f.id,
        nombre: f.nombre,
        tipo: f.tipo,
        municipio: f.municipio,
        potreros: (f.potreros ?? [])
          .map((p) => ({ id: p.id, nombre: p.nombre, areaHa: p.area_ha != null ? Number(p.area_ha) : null }))
          .sort((a, b) => a.nombre.localeCompare(b.nombre)),
      }));
    },
  });
}

export function useCrearPotrero() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ fincaId, nombre, areaHa }) => {
      const { error } = await supabase
        .from('potreros')
        .insert({ finca_id: fincaId, nombre: nombre.trim(), area_ha: areaHa === '' || areaHa == null ? null : Number(areaHa) });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fincas'] }),
  });
}

// R6: mueve varios animales en una sola transacción (función SQL mover_animales).
export function useMoverAnimales() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, fecha, motivo, fincaId, potreroId, loteId }) => {
      const { data, error } = await supabase.rpc('mover_animales', {
        ids,
        fecha,
        motivo: motivo.trim(),
        finca_destino: fincaId || null,
        potrero_destino: potreroId || null,
        lote_destino: loteId || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hato'] });
      queryClient.invalidateQueries({ queryKey: ['movimientos'] });
    },
  });
}

// R7: historial de movimientos de un animal, el más reciente primero.
export function useMovimientos(animalId) {
  return useQuery({
    queryKey: ['movimientos', animalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('movimientos')
        .select(
          `id, fecha, motivo, created_at,
           desde_finca:fincas!movimientos_desde_finca_id_fkey ( nombre ),
           desde_potrero:potreros!movimientos_desde_potrero_id_fkey ( nombre ),
           desde_lote:lotes!movimientos_desde_lote_id_fkey ( nombre ),
           hacia_finca:fincas!movimientos_hacia_finca_id_fkey ( nombre ),
           hacia_potrero:potreros!movimientos_hacia_potrero_id_fkey ( nombre ),
           hacia_lote:lotes!movimientos_hacia_lote_id_fkey ( nombre )`,
        )
        .eq('animal_id', animalId)
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      const lugar = (finca, potrero) => [finca?.nombre, potrero?.nombre].filter(Boolean).join(', ') || '—';
      return data.map((m) => ({
        id: m.id,
        fecha: m.fecha,
        motivo: m.motivo,
        desde: lugar(m.desde_finca, m.desde_potrero),
        hacia: lugar(m.hacia_finca, m.hacia_potrero),
        loteDesde: m.desde_lote?.nombre ?? null,
        loteHacia: m.hacia_lote?.nombre ?? null,
      }));
    },
  });
}
