// Spec 016 · categorías, especies y reglas de los animales. Funciones puras.

// R5: tres tipos de vientre ("fábrica"); ninguno se vende (D2).
export const CATEGORIAS_BOVINO = {
  Macho: [
    { valor: 'novillo', label: 'Novillo' },
    { valor: 'ternero', label: 'Ternero' },
    { valor: 'reproductor', label: 'Reproductor (toro)' },
  ],
  Hembra: [
    { valor: 'ternera', label: 'Ternera' },
    { valor: 'vientre_menor', label: 'Vientre menor (no se vende)' },
    { valor: 'vientre_mayor', label: 'Vientre mayor (no se vende)' },
    { valor: 'vientre_parida', label: 'Vientre parida (no se vende)' },
  ],
};

// R8: caballos.
export const CATEGORIAS_EQUINO = {
  Macho: [
    { valor: 'caballo', label: 'Caballo' },
    { valor: 'potro', label: 'Potro' },
  ],
  Hembra: [
    { valor: 'yegua', label: 'Yegua' },
    { valor: 'potranca', label: 'Potranca' },
  ],
};

const ETIQUETAS = Object.fromEntries(
  [...Object.values(CATEGORIAS_BOVINO), ...Object.values(CATEGORIAS_EQUINO)].flat().map((c) => [c.valor, c.label.replace(' (no se vende)', '')]),
);

export function etiquetaCategoria(categoria) {
  return ETIQUETAS[categoria] ?? categoria;
}

export function esVientre(categoria) {
  return typeof categoria === 'string' && categoria.startsWith('vientre');
}

// R6: el peso objetivo no se pide para los vientres (no se venden).
export function pidePesoObjetivo(categoria) {
  return !esVientre(categoria);
}

// R7: precio de compra por kilo ↔ total por animal (redondeado a pesos).
export function totalDesdeKilo(precioKg, pesoKg) {
  if (!(precioKg > 0) || !(pesoKg > 0)) return null;
  return Math.round(precioKg * pesoKg);
}

export function kiloDesdeTotal(total, pesoKg) {
  if (!(total > 0) || !(pesoKg > 0)) return null;
  return Math.round(total / pesoKg);
}

// R4: dueños que ya existen (para sugerirlos), sin repetir mayúsculas ni espacios.
export function duenosExistentes(animales) {
  const vistos = new Map();
  for (const a of animales) {
    const d = a.dueno?.trim();
    if (d && !vistos.has(d.toLowerCase())) vistos.set(d.toLowerCase(), d);
  }
  return [...vistos.values()].sort((x, y) => x.localeCompare(y, 'es'));
}
