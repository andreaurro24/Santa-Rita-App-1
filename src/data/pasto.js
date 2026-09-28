import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

// Spec 009 · estado del pasto y parámetros de venta.

export function useCondicionPasto() {
  return useQuery({
    queryKey: ['pasto'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('condicion_pasto')
        .select('id, finca_id, potrero_id, fecha, nivel, notas, created_at')
        .order('fecha', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data.map((e) => ({ id: e.id, fincaId: e.finca_id, potreroId: e.potrero_id, fecha: e.fecha, nivel: e.nivel, notas: e.notas, creado: e.created_at }));
    },
  });
}

export function useRegistrarPasto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ fincaId, potreroId, fecha, nivel, notas }) => {
      const { error } = await supabase
        .from('condicion_pasto')
        .insert({ finca_id: fincaId, potrero_id: potreroId || null, fecha, nivel, notas: notas?.trim() || null });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pasto'] }),
  });
}

export function useParametros() {
  return useQuery({
    queryKey: ['parametros'],
    queryFn: async () => {
      const { data, error } = await supabase.from('parametros').select('destare_pct').maybeSingle();
      if (error) throw error;
      return { destarePct: data ? Number(data.destare_pct) : 0 };
    },
  });
}

export function useGuardarParametros() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ destarePct }) => {
      const { data, error } = await supabase
        .from('parametros')
        .update({ destare_pct: destarePct, updated_at: new Date().toISOString() })
        .eq('id', true)
        .select('destare_pct');
      if (error) throw error;
      if (!data.length) throw Object.assign(new Error('No se pudo guardar el parámetro.'), { code: '42501' });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['parametros'] }),
  });
}
