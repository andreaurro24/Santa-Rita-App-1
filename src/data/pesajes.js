import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

// Spec 004 · jornadas de pesaje por lote. Cada peso de la jornada es un pesaje con jornada_id.

const SELECT_JORNADA = 'id, lote_id, fecha, estado, notas, cerrada_at, pesajes ( animal_id, peso_kg )';

function mapJornada(j) {
  const pesos = (j.pesajes ?? []).map((p) => Number(p.peso_kg));
  return {
    id: j.id,
    loteId: j.lote_id,
    fecha: j.fecha,
    estado: j.estado,
    notas: j.notas,
    cerradaAt: j.cerrada_at,
    pesados: new Map((j.pesajes ?? []).map((p) => [p.animal_id, Number(p.peso_kg)])),
    nPesados: pesos.length,
    pesoPromedio: pesos.length ? Math.round((pesos.reduce((s, x) => s + x, 0) / pesos.length) * 10) / 10 : null,
  };
}

// R8: jornadas de un lote, la más reciente primero.
export function useJornadasLote(loteId) {
  return useQuery({
    queryKey: ['jornadas', loteId],
    enabled: Boolean(loteId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jornadas_pesaje')
        .select(SELECT_JORNADA)
        .eq('lote_id', loteId)
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data.map(mapJornada);
    },
  });
}

export function useJornada(id) {
  return useQuery({
    queryKey: ['jornada', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('jornadas_pesaje').select(SELECT_JORNADA).eq('id', id).maybeSingle();
      if (error) throw error;
      return data ? mapJornada(data) : null;
    },
  });
}

function useInvalidarPesaje() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['hato'] });
    queryClient.invalidateQueries({ queryKey: ['jornadas'] });
    queryClient.invalidateQueries({ queryKey: ['jornada'] });
  };
}

// R1: abre una jornada. Si el lote ya tiene una abierta, la retoma en vez de duplicarla.
export function useAbrirJornada() {
  const invalidar = useInvalidarPesaje();
  return useMutation({
    mutationFn: async ({ loteId, fecha }) => {
      const { data, error } = await supabase.from('jornadas_pesaje').insert({ lote_id: loteId, fecha }).select('id').single();
      if (!error) return data.id;
      if (error.code !== '23505') throw error;
      const { data: abierta, error: e2 } = await supabase
        .from('jornadas_pesaje')
        .select('id')
        .eq('lote_id', loteId)
        .eq('estado', 'abierta')
        .single();
      if (e2) throw e2;
      return abierta.id;
    },
    onSuccess: invalidar,
  });
}

// R2: guarda el peso de un animal en la jornada (una vez por animal y jornada).
export function useRegistrarEnJornada() {
  const invalidar = useInvalidarPesaje();
  return useMutation({
    mutationFn: async ({ jornada, animalId, pesoKg }) => {
      const { error } = await supabase
        .from('pesajes')
        .insert({ animal_id: animalId, fecha: jornada.fecha, peso_kg: pesoKg, jornada_id: jornada.id });
      if (error) throw error;
    },
    onSuccess: invalidar,
  });
}

// R4: cierra la jornada aunque queden animales sin pesar.
export function useCerrarJornada() {
  const invalidar = useInvalidarPesaje();
  return useMutation({
    mutationFn: async ({ id, notas }) => {
      const { error } = await supabase
        .from('jornadas_pesaje')
        .update({ estado: 'cerrada', cerrada_at: new Date().toISOString(), notas: notas?.trim() || null })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidar,
  });
}
