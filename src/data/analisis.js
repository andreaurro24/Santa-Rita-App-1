import { useMemo } from 'react';
import { useHato } from './hato';
import { useLotes } from './lotes';
import { useCostos } from './costos';
import { usePrecios } from './precios';
import { useParametros, useCondicionPasto } from './pasto';
import { useClima } from './externos';
import { analizarLoteV2 } from '../domain/decision';
import { pastoMasCritico } from '../domain/pasto';
import { hoyISO } from '../utils/format';

// Spec 010 · reúne todo lo que necesita el motor v2 para un lote. `precioManual` permite simular.
export function useAnalisisLotes() {
  const hato = useHato();
  const lotes = useLotes();
  const costos = useCostos();
  const precios = usePrecios();
  const parametros = useParametros();
  const pasto = useCondicionPasto();
  const clima = useClima();
  return { queries: [hato, lotes, costos, precios, parametros, pasto], hato, lotes, costos, precios, parametros, pasto, clima };
}

export function useAnalisisLote(datos, loteId, precioManual) {
  const { hato, lotes, costos, precios, parametros, pasto, clima } = datos;
  return useMemo(() => {
    if (!hato.data || !lotes.data || !costos.data || !precios.data || !parametros.data || !pasto.data) return null;
    const lote = lotes.data.find((l) => l.id === loteId);
    if (!lote) return null;
    const hoy = hoyISO();
    const animales = hato.data.animales.filter((a) => a.loteId === loteId);
    const fincas = [...new Set(animales.filter((a) => a.estado === 'Activo').map((a) => a.fincaId).filter(Boolean))];
    const pastoCritico = pastoMasCritico(pasto.data, hoy, fincas);
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
        costos: costos.data.filter((c) => c.loteId === loteId),
        precioKg,
        destarePct: parametros.data.destarePct,
        metaKg: lote.pesoMeta,
        clima: clima.data ?? null,
        pasto: pastoCritico?.nivel ?? null,
        hoy,
      }),
    };
  }, [hato.data, lotes.data, costos.data, precios.data, parametros.data, pasto.data, clima.data, loteId, precioManual]);
}
