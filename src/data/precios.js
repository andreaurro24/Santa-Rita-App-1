import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

const PRECIOS_KEY = ['precios'];

// Devuelve la misma forma del MVP: { precios: [{ fecha, precioCOP, fuente }], precioActual }.
export function usePrecios() {
  return useQuery({
    queryKey: PRECIOS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('precios_mercado')
        .select('fecha, precio_kg_cop, fuente')
        .order('fecha', { ascending: true });
      if (error) throw error;
      const precios = data.map((p) => ({ fecha: p.fecha, precioCOP: p.precio_kg_cop, fuente: p.fuente }));
      return { precios, precioActual: precios.at(-1) ?? null };
    },
  });
}

export function useAddPrecio() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ fecha, precioCOP, fuente }) => {
      const { error } = await supabase.from('precios_mercado').insert({ fecha, precio_kg_cop: precioCOP, fuente });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PRECIOS_KEY }),
  });
}

// Spec 021 · rangos de precio por zona y categoría (historial completo; el vigente lo elige el dominio).
const REFERENCIA_KEY = ['precios-referencia'];

export function usePreciosReferencia() {
  return useQuery({
    queryKey: REFERENCIA_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('precios_referencia')
        .select('id, categoria, zona, precio_min_cop, precio_max_cop, fecha, fuente, created_at')
        .order('fecha', { ascending: false });
      if (error) throw error;
      return data.map((r) => ({
        id: r.id,
        categoria: r.categoria,
        zona: r.zona,
        precioMin: r.precio_min_cop,
        precioMax: r.precio_max_cop,
        fecha: r.fecha,
        fuente: r.fuente,
        creado: r.created_at,
      }));
    },
  });
}

export function useAddPrecioReferencia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ categoria, precioMin, precioMax, fecha, fuente }) => {
      const { error } = await supabase
        .from('precios_referencia')
        .insert({ categoria, precio_min_cop: precioMin, precio_max_cop: precioMax, fecha, fuente: fuente.trim() });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: REFERENCIA_KEY }),
  });
}
