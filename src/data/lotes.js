import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

// Spec 006 · R1: lotes como entidad (también los que aún no tienen animales).
export function mapLote(l) {
  return {
    id: l.id,
    codigo: l.codigo,
    nombre: l.nombre,
    tipo: l.tipo,
    fechaInicio: l.fecha_inicio,
    pesoMeta: l.peso_meta_kg != null ? Number(l.peso_meta_kg) : null,
    estado: l.estado,
    descripcion: l.descripcion ?? '', // spec 020 · R2
  };
}

export function useLotes() {
  return useQuery({
    queryKey: ['lotes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lotes')
        .select('id, codigo, nombre, tipo, fecha_inicio, peso_meta_kg, estado, descripcion')
        .order('tipo')
        .order('codigo');
      if (error) throw error;
      return data.map(mapLote);
    },
  });
}

export function useGuardarLote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (lote) => {
      const fila = {
        codigo: lote.codigo.trim().toUpperCase(),
        nombre: lote.nombre.trim(),
        tipo: lote.tipo,
        fecha_inicio: lote.fechaInicio || null,
        // Spec 022 · R6: el lote ya no tiene meta propia; no se envía peso_meta_kg.
        estado: lote.estado,
        descripcion: lote.descripcion?.trim() || null,
      };
      const consulta = lote.id ? supabase.from('lotes').update(fila).eq('id', lote.id) : supabase.from('lotes').insert(fila);
      const { data, error } = await consulta.select('id').single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lotes'] });
      queryClient.invalidateQueries({ queryKey: ['hato'] });
    },
  });
}
