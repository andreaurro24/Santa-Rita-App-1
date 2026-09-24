// Motor de recomendación de venta: modelo basado en reglas + punto de equilibrio,
// tal como lo describe el Capítulo 4.2.1 del proyecto ("modelo basado en reglas y punto de
// equilibrio, más simple y explicable" frente a un modelo predictivo de machine learning).
//
// Punto de equilibrio (precio mínimo de venta por kilo que cubre el costo de compra del
// animal al peso actual):
//   precioEquilibrio = costoCompra / pesoActual
//
// Si el precio de mercado vigente supera el punto de equilibrio, vender genera margen
// positivo. La recomendación final también considera qué tan cerca está el lote de su
// meta de peso pactada y el riesgo climático de corto plazo (lluvias fuertes / sequía).

export function pesoActual(animal) {
  if (!animal.pesos?.length) return animal.pesoIngreso;
  const ultimo = [...animal.pesos].sort((a, b) => a.fecha.localeCompare(b.fecha)).at(-1);
  return ultimo.pesoKg;
}

export function fechaUltimoPesaje(animal) {
  if (!animal.pesos?.length) return null;
  return [...animal.pesos].sort((a, b) => a.fecha.localeCompare(b.fecha)).at(-1).fecha;
}

export function analizarLote(animales, { precioMercadoCOP, clima }) {
  const activos = animales.filter((a) => a.estado === 'Activo');
  if (activos.length === 0) return null;

  const pesos = activos.map(pesoActual);
  const pesoPromedioActual = promedio(pesos);
  const pesoObjetivoPromedio = promedio(activos.map((a) => a.pesoObjetivo));
  const avancePct = clamp((pesoPromedioActual / pesoObjetivoPromedio) * 100, 0, 200);

  const conCosto = activos.filter((a) => a.costoCompra);
  const costoPromedioCompra = conCosto.length ? promedio(conCosto.map((a) => a.costoCompra)) : null;
  const pesoPromedioConCosto = conCosto.length ? promedio(conCosto.map(pesoActual)) : null;

  const precioEquilibrioCOPkg =
    costoPromedioCompra && pesoPromedioConCosto ? costoPromedioCompra / pesoPromedioConCosto : null;

  const margenPorKgCOP = precioEquilibrioCOPkg != null ? precioMercadoCOP - precioEquilibrioCOPkg : null;
  const margenTotalEstimadoCOP =
    margenPorKgCOP != null ? Math.round(margenPorKgCOP * pesoPromedioActual * activos.length) : null;

  const razones = [];
  let recomendacion;

  const riesgoClimatico = clima && !clima.isFallback && clima.resumenLluvia7d < 2;
  const lluviaFuerte = clima && clima.resumenLluvia7d > 40;

  if (precioEquilibrioCOPkg == null) {
    recomendacion = 'SIN_DATOS_DE_COSTO';
    razones.push('El lote no tiene costo de compra registrado (animales de cría propia); no se puede calcular punto de equilibrio de compra.');
  } else if (margenPorKgCOP <= 0) {
    recomendacion = 'ESPERAR';
    razones.push(
      `El precio de mercado actual ($${formatCOP(precioMercadoCOP)}/kg) está por debajo del punto de equilibrio ($${formatCOP(
        Math.round(precioEquilibrioCOPkg),
      )}/kg). Vender hoy generaría pérdida.`,
    );
  } else if (avancePct >= 92) {
    recomendacion = 'VENDER';
    razones.push(`El lote está al ${avancePct.toFixed(0)}% de su meta de peso pactada, con margen positivo de $${formatCOP(Math.round(margenPorKgCOP))}/kg.`);
  } else if (riesgoClimatico) {
    recomendacion = 'VENDER';
    razones.push('Pronóstico de muy baja precipitación en los próximos 7 días: riesgo de escasez de pasto (patrón similar a episodios de El Niño reportados por Fedegán).');
    razones.push(`Aún con margen positivo ($${formatCOP(Math.round(margenPorKgCOP))}/kg), se recomienda anticipar la venta por precaución.`);
  } else {
    recomendacion = 'ESPERAR';
    razones.push(`El lote está al ${avancePct.toFixed(0)}% de su meta de peso; conviene esperar a acercarse más a la meta pactada.`);
    razones.push(`Margen actual si se vendiera hoy: $${formatCOP(Math.round(margenPorKgCOP))}/kg.`);
  }

  if (lluviaFuerte) {
    razones.push('Precipitación acumulada alta en el pronóstico de 7 días: vigilar caminos y acceso para el comprador.');
  }

  return {
    nAnimales: activos.length,
    pesoPromedioActual: round1(pesoPromedioActual),
    pesoObjetivoPromedio: round1(pesoObjetivoPromedio),
    avancePct: round1(avancePct),
    costoPromedioCompra: costoPromedioCompra != null ? Math.round(costoPromedioCompra) : null,
    precioEquilibrioCOPkg: precioEquilibrioCOPkg != null ? Math.round(precioEquilibrioCOPkg) : null,
    precioMercadoCOP,
    margenPorKgCOP: margenPorKgCOP != null ? Math.round(margenPorKgCOP) : null,
    margenTotalEstimadoCOP,
    recomendacion,
    razones,
  };
}

export function formatCOP(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('es-CO').format(n);
}

function promedio(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}
function round1(n) {
  return Math.round(n * 10) / 10;
}
function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}
