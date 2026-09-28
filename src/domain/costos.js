// Spec 008 · costo acumulado por animal y por lote (D9). Funciones puras.
// Un gasto de lote se reparte por partes iguales entre los animales del lote que ya habían
// ingresado en la fecha del gasto. Un gasto asignado a un animal es solo de ese animal.

export const CATEGORIAS_COSTO = {
  suplemento: 'Suplemento',
  sal_mineral: 'Sal mineral',
  medicamentos: 'Medicamentos',
  jornales: 'Jornales',
  transporte: 'Transporte',
  arriendo_pasto: 'Arriendo de pasto',
  otros: 'Otros',
};

// Simplificación declarada en la spec: la pertenencia al lote es la actual (todavía no se
// reconstruye desde `movimientos`), filtrada por fecha de ingreso.
export function animalesElegibles(animalesLote, fecha) {
  return animalesLote.filter((a) => a.fechaIngreso <= fecha);
}

// R3, R4. `costos` son los del lote del animal (de lote y directos); `animalesLote`, todos sus animales.
export function costoAcumuladoAnimal(animal, costos, animalesLote) {
  const porCategoria = {};
  let directos = 0;
  let deLote = 0;
  for (const c of costos) {
    let parte = 0;
    if (c.animalId) {
      if (c.animalId === animal.id) parte = c.montoCop;
    } else if (c.loteId === animal.loteId) {
      const elegibles = animalesElegibles(animalesLote, c.fecha);
      if (elegibles.some((a) => a.id === animal.id)) parte = c.montoCop / elegibles.length;
    }
    if (!parte) continue;
    if (c.animalId) directos += parte;
    else deLote += parte;
    porCategoria[c.categoria] = (porCategoria[c.categoria] ?? 0) + parte;
  }
  const compra = animal.costoCompra ?? 0;
  return { compra, directos, deLote, gastos: directos + deLote, total: compra + directos + deLote, porCategoria };
}

// R5: totales del lote y costo acumulado promedio de sus animales activos.
export function resumenCostosLote(animalesLote, costos) {
  const porCategoria = {};
  let total = 0;
  for (const c of costos) {
    total += c.montoCop;
    porCategoria[c.categoria] = (porCategoria[c.categoria] ?? 0) + c.montoCop;
  }
  const activos = animalesLote.filter((a) => a.estado === 'Activo');
  const acumulados = activos.map((a) => costoAcumuladoAnimal(a, costos, animalesLote).total);
  const promedioPorAnimal = acumulados.length ? acumulados.reduce((s, x) => s + x, 0) / acumulados.length : null;
  return { total, porCategoria, promedioPorAnimal };
}
