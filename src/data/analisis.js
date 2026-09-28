import { useMemo } from 'react';
import { useHato } from './hato';
import { useLotes } from './lotes';
import { useRepartoCostos } from './costos';
import { usePrecios } from './precios';
import { useParametros, useCondicionPasto } from './pasto';
import { useClima } from './externos';
import { useVentas } from './ventas';
import { analizarLoteV2, estadoContratos } from '../domain/decision';
import { pastoMasCritico } from '../domain/pasto';
import { hoyISO } from '../utils/format';

// Spec 010 · reúne todo lo que necesita el motor v2 para un lote. `precioManual` permite simular.
export function useAnalisisLotes() {
  const hato = useHato();
  const lotes = useLotes();
  const costos = useRepartoCostos();
  const precios = usePrecios();
  const parametros = useParametros();
  const pasto = useCondicionPasto();
  const clima = useClima();
  // D8 acumulado: lo que ya se liquidó a cada contrato en ventas anteriores (DT-04-9).
  const ventas = useVentas();
  // El clima entra en la carga: sin esperarlo, la recomendación cambiaba al llegar el pronóstico (verificación 010).
  return { queries: [hato, lotes, ...costos.queries, precios, parametros, pasto, clima, ventas], hato, lotes, costos, precios, parametros, pasto, clima, ventas };
}

export function useAnalisisLote(datos, loteId, precioManual) {
  const { hato, lotes, costos, precios, parametros, pasto, clima, ventas } = datos;
  return useMemo(() => {
    if (!hato.data || !lotes.data || !costos.reparto || !precios.data || !parametros.data || !pasto.data) return null;
    const lote = lotes.data.find((l) => l.id === loteId);
    if (!lote) return null;
    const hoy = hoyISO();
    const animales = hato.data.animales.filter((a) => a.loteId === loteId);
    const activos = animales.filter((a) => a.estado === 'Activo');
    const fincas = [...new Set(activos.map((a) => a.fincaId).filter(Boolean))];
    // Si algún animal no tiene potrero, cualquier potrero de su finca le puede aplicar.
    const potreros = activos.every((a) => a.potreroId) ? [...new Set(activos.map((a) => a.potreroId))] : null;
    const pastoCritico = pastoMasCritico(pasto.data, hoy, fincas, potreros);
    const precioKg = Number(precioManual) || precios.data.precioActual?.precioCOP || null;
    return {
      lote,
      precioKg,
      precioActual: precios.data.precioActual,
      destarePct: parametros.data.destarePct,
      pasto: pastoCritico,
      clima: clima.data ?? null,
      resultado: analizarLoteV2({
        animales,
        costos: costos.costos.filter((c) => c.loteId === loteId),
        reparto: costos.reparto,
        precioKg,
        destarePct: parametros.data.destarePct,
        metaKg: lote.pesoMeta,
        clima: clima.data ?? null,
        pasto: pastoCritico?.nivel ?? null,
        hoy,
        contratosPrevios: estadoContratos(ventas.data ?? []),
      }),
    };
  }, [hato.data, lotes.data, costos.costos, costos.reparto, precios.data, parametros.data, pasto.data, clima.data, ventas.data, loteId, precioManual]);
}
