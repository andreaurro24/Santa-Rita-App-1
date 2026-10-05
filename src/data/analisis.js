import { useMemo } from 'react';
import { useHato } from './hato';
import { useLotes } from './lotes';
import { useRepartoCostos } from './costos';
import { usePrecios, usePreciosReferencia } from './precios';
import { useParametros, useCondicionPasto } from './pasto';
import { useVentas } from './ventas';
import { analizarLoteV2, estadoContratos } from '../domain/decision';
import { pastoMasCritico } from '../domain/pasto';
import { precioPorAnimal, rangosVigentes } from '../domain/precios';
import { hoyISO } from '../utils/format';

// Spec 010 · reúne todo lo que necesita el motor v2 para un lote. `precioManual` permite simular.
// Spec 015 · R1: sin clima. Spec 021 · R3: precio por animal según los rangos de la zona.
export function useAnalisisLotes() {
  const hato = useHato();
  const lotes = useLotes();
  const costos = useRepartoCostos();
  const precios = usePrecios();
  const referencia = usePreciosReferencia();
  const parametros = useParametros();
  const pasto = useCondicionPasto();
  // D8 acumulado: lo que ya se liquidó a cada contrato en ventas anteriores (DT-04-9).
  const ventas = useVentas();
  return {
    queries: [hato, lotes, ...costos.queries, precios, referencia, parametros, pasto, ventas],
    hato,
    lotes,
    costos,
    precios,
    referencia,
    parametros,
    pasto,
    ventas,
  };
}

// Spec 025: versión sin hook, para analizar varios lotes a la vez (venta de varios lotes).
export function analizarLote(datos, loteId, precioManual) {
  const { hato, lotes, costos, precios, referencia, parametros, pasto, ventas } = datos;
  if (!hato.data || !lotes.data || !costos.reparto || !precios.data || !referencia.data || !parametros.data || !pasto.data) return null;
  const lote = lotes.data.find((l) => l.id === loteId);
  if (!lote) return null;
  const hoy = hoyISO();
  const animales = hato.data.animales.filter((a) => a.loteId === loteId);
  const activos = animales.filter((a) => a.estado === 'Activo');
  const fincas = [...new Set(activos.map((a) => a.fincaId).filter(Boolean))];
  // Si algún animal no tiene potrero, cualquier potrero de su finca le puede aplicar.
  const potreros = activos.every((a) => a.potreroId) ? [...new Set(activos.map((a) => a.potreroId))] : null;
  const pastoCritico = pastoMasCritico(pasto.data, hoy, fincas, potreros);
  const manual = Number(precioManual) || null;
  const vigentes = rangosVigentes(referencia.data);
  // Precio simulado: uno solo para todo el lote. Si no, el de la zona por categoría (respaldo: último manual).
  const precioKg = manual ?? precioPorAnimal(vigentes, precios.data.precioActual?.precioCOP ?? null);
  return {
    lote,
    precioKg,
    precioSimulado: manual,
    precioActual: precios.data.precioActual,
    rangos: vigentes,
    destarePct: parametros.data.destarePct,
    pasto: pastoCritico,
    resultado: analizarLoteV2({
      animales,
      costos: costos.costos.filter((c) => c.loteId === loteId),
      reparto: costos.reparto,
      precioKg,
      destarePct: parametros.data.destarePct,
      metaKg: null, // spec 022 · R6: la meta sale de los pesos objetivo de los animales
      pasto: pastoCritico?.nivel ?? null,
      hoy,
      contratosPrevios: estadoContratos(ventas.data ?? []),
    }),
  };
}

export function useAnalisisLote(datos, loteId, precioManual) {
  const { hato, lotes, costos, precios, referencia, parametros, pasto, ventas } = datos;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- depende de los datos, no del objeto `datos`
  return useMemo(() => analizarLote(datos, loteId, precioManual), [hato.data, lotes.data, costos.costos, costos.reparto, precios.data, referencia.data, parametros.data, pasto.data, ventas.data, loteId, precioManual]);
}
