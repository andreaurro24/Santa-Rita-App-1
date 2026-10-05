import { useQuery } from '@tanstack/react-query';
import { rutaMiniatura } from '../domain/recorte';

// Specs 017 y 024 · URLs firmadas de las fotos que se muestran. El módulo de fotos se carga solo si
// hay alguna foto que mostrar. Con `{ mini: true }` (listas y tablas) se piden solo las miniaturas
// (024 · R7, cierra DT-05-3); el mapa devuelto sigue indexado por la ruta de la foto grande.
export function useFotos(rutas, { mini = false } = {}) {
  const lista = [...new Set(rutas.filter(Boolean))].sort();
  return useQuery({
    queryKey: ['fotos', mini ? 'mini' : 'grande', lista],
    enabled: lista.length > 0,
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const { urlsFirmadas } = await import('../lib/fotos');
      if (!mini) return urlsFirmadas(lista);
      const firmadas = await urlsFirmadas(lista.map(rutaMiniatura));
      return new Map(lista.map((r) => [r, firmadas.get(rutaMiniatura(r))]).filter(([, u]) => u));
    },
  });
}
