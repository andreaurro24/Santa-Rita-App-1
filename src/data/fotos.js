import { useQuery } from '@tanstack/react-query';

// Spec 017 · R4: URLs firmadas de las fotos que se muestran (lista o ficha). El módulo de fotos se
// carga solo si hay alguna foto que mostrar (R5).
export function useFotos(rutas) {
  const lista = [...new Set(rutas.filter(Boolean))].sort();
  return useQuery({
    queryKey: ['fotos', lista],
    enabled: lista.length > 0,
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const { urlsFirmadas } = await import('../lib/fotos');
      return urlsFirmadas(lista);
    },
  });
}
