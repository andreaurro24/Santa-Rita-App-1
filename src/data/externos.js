import { useQuery } from '@tanstack/react-query';
import { fetchClimaFinca } from '../api/weather';
import { fetchTRM } from '../api/trm';

// Clima y TRM se piden una vez y se comparten entre pantallas (panel, mercado, venta, reporte).
// Las funciones de api/ ya devuelven un valor de respaldo marcado `isFallback` si no hay red.
const DIEZ_MINUTOS = 10 * 60 * 1000;

export function useClima() {
  return useQuery({ queryKey: ['clima'], queryFn: ({ signal }) => fetchClimaFinca({ signal }), staleTime: DIEZ_MINUTOS });
}

export function useTRM() {
  return useQuery({ queryKey: ['trm'], queryFn: ({ signal }) => fetchTRM({ signal }), staleTime: DIEZ_MINUTOS });
}
