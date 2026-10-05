// Spec 008 · costo acumulado por animal y por lote (D9). Funciones puras.
// - Un gasto directo es siempre del animal asignado, esté hoy en el lote que esté.
// - Un gasto de lote se reparte por partes iguales entre los animales que ESTABAN en ese lote
//   en la fecha del gasto: ya habían ingresado, no habían salido (venta) y su lote en esa fecha
//   era ese, según el historial de `movimientos` (verificación 008: Alto y Medio de reparto).

export const CATEGORIAS_COSTO = {
  suplemento: 'Suplemento',
  sal_mineral: 'Sal mineral',
  medicamentos: 'Medicamentos',
  jornales: 'Jornales',
  transporte: 'Transporte',
  arriendo_pasto: 'Arriendo de pasto',
  otros: 'Otros',
};

// Lote de un animal en una fecha. `movs`: movimientos del animal { fecha, desdeLoteId, haciaLoteId, creado }.
export function loteEnFecha(animal, fecha, movs = []) {
  const cambios = movs.filter((m) => m.desdeLoteId !== m.haciaLoteId).sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.creado ?? '').localeCompare(b.creado ?? ''));
  if (!cambios.length) return animal.loteId;
  const anteriores = cambios.filter((m) => m.fecha <= fecha);
  if (anteriores.length) return anteriores.at(-1).haciaLoteId;
  return cambios[0].desdeLoteId; // antes del primer cambio estaba en su lote de origen
}

export function estabaEnLote(animal, loteId, fecha, movs) {
  if (animal.fechaIngreso > fecha) return false;
  if (animal.fechaSalida && animal.fechaSalida < fecha) return false;
  return loteEnFecha(animal, fecha, movs) === loteId;
}

// Reparte todos los gastos entre todos los animales. Devuelve Map animalId → { directos, deLote, porCategoria }.
export function repartirCostos(costos, animales, movimientos = []) {
  const movsPorAnimal = new Map();
  for (const m of movimientos) {
    if (!movsPorAnimal.has(m.animalId)) movsPorAnimal.set(m.animalId, []);
    movsPorAnimal.get(m.animalId).push(m);
  }
  const reparto = new Map(animales.map((a) => [a.id, { directos: 0, deLote: 0, porCategoria: {} }]));
  const sumar = (id, monto, categoria, campo) => {
    const r = reparto.get(id);
    if (!r) return;
    r[campo] += monto;
    r.porCategoria[categoria] = (r.porCategoria[categoria] ?? 0) + monto;
  };
  // Gastos de lote sin animales en esa fecha: no los carga nadie y hay que avisarlo (verificación 008).
  reparto.sinRepartir = [];
  for (const c of costos) {
    // Spec 020 · R4: los gastos de la finca entera no se reparten entre los animales.
    if (!c.loteId) continue;
    if (c.animalId) {
      sumar(c.animalId, c.montoCop, c.categoria, 'directos');
      continue;
    }
    const elegibles = animales.filter((a) => estabaEnLote(a, c.loteId, c.fecha, movsPorAnimal.get(a.id)));
    if (!elegibles.length) reparto.sinRepartir.push(c);
    for (const a of elegibles) sumar(a.id, c.montoCop / elegibles.length, c.categoria, 'deLote');
  }
  return reparto;
}

// R4: costo acumulado de un animal a partir del reparto.
export function costoAcumuladoAnimal(animal, reparto) {
  const r = reparto.get(animal.id) ?? { directos: 0, deLote: 0, porCategoria: {} };
  const compra = animal.costoCompra ?? 0;
  return { compra, directos: r.directos, deLote: r.deLote, gastos: r.directos + r.deLote, total: compra + r.directos + r.deLote, porCategoria: r.porCategoria };
}

// R5: totales de los gastos registrados en el lote y costo acumulado promedio de sus animales activos.
export function resumenCostosLote(animalesLote, costosLote, reparto) {
  const porCategoria = {};
  let total = 0;
  for (const c of costosLote) {
    total += c.montoCop;
    porCategoria[c.categoria] = (porCategoria[c.categoria] ?? 0) + c.montoCop;
  }
  const activos = animalesLote.filter((a) => a.estado === 'Activo');
  const acumulados = activos.map((a) => costoAcumuladoAnimal(a, reparto).total);
  const promedioPorAnimal = acumulados.length ? acumulados.reduce((s, x) => s + x, 0) / acumulados.length : null;
  return { total, porCategoria, promedioPorAnimal };
}
