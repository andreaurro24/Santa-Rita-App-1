// Spec 021 · precio del ganado por zona y categoría. Funciones puras.

export const CATEGORIAS_PRECIO = [
  { valor: 'ternero', label: 'Ternero' },
  { valor: 'ternera', label: 'Ternera' },
  { valor: 'levante', label: 'Levante (menos de 350 kg)' },
  { valor: 'gordo', label: 'Gordo (350 kg o más)' },
  { valor: 'vaca', label: 'Vaca' },
];

export const PESO_GORDO_KG = 350;

// R3: categoría de precio de un animal según su categoría y su peso a la fecha de venta.
export function categoriaPrecio(categoria, pesoKg) {
  if (categoria === 'ternero' || categoria === 'ternera') return categoria;
  if (categoria === 'novillo' || categoria === 'reproductor') return pesoKg >= PESO_GORDO_KG ? 'gordo' : 'levante';
  if (typeof categoria === 'string' && categoria.startsWith('vientre')) return 'vaca';
  return null;
}

// R1/R2: el rango vigente de cada categoría es el más reciente (fecha y hora de registro).
export function rangosVigentes(rangos) {
  const vigentes = new Map();
  const ordenados = [...rangos].sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.creado ?? '').localeCompare(a.creado ?? ''));
  for (const r of ordenados) if (!vigentes.has(r.categoria)) vigentes.set(r.categoria, r);
  return vigentes;
}

export const puntoMedio = (rango) => (rango ? Math.round((rango.precioMin + rango.precioMax) / 2) : null);

// R3: función de precio por animal para el motor de recomendación. Usa el punto medio del rango
// de su categoría; si no hay rango para ella, el precio manual de respaldo (o null).
export function precioPorAnimal(vigentes, respaldo = null) {
  return (animal, pesoKg) => {
    const cat = categoriaPrecio(animal.categoria, pesoKg);
    return puntoMedio(vigentes.get(cat)) ?? respaldo ?? null;
  };
}
