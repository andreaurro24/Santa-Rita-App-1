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
