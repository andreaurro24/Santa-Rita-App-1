// Spec 022 · R3/R5: ordenar, filtrar y paginar la tabla de animales. Funciones puras.
import { pesoActual } from './breakeven';

export const POR_PAGINA = 20;

// R5: filtro de estado. "activos" (por defecto), "vendidos", "baja" (muerto o perdido) o "todos".
export const FILTROS_ESTADO = [
  ['activos', 'Activos'],
  ['vendidos', 'Vendidos'],
  ['baja', 'De baja'],
  ['todos', 'Todos'],
];

export function pasaEstado(animal, filtro) {
  if (filtro === 'todos') return true;
  if (filtro === 'vendidos') return animal.estado === 'Vendido';
  if (filtro === 'baja') return animal.estado === 'Muerto' || animal.estado === 'Perdido';
  return animal.estado === 'Activo';
}

// R5: busca por nombre, chapeta, dueño o raza, sin importar mayúsculas ni tildes.
const sinTildes = (t) => String(t ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export function coincide(animal, busqueda) {
  const q = sinTildes(busqueda).trim();
  if (!q) return true;
  return [animal.numeroInterno, animal.chapetaICA, animal.dueno, animal.raza].some((v) => sinTildes(v).includes(q));
}

// R3: columnas que se pueden ordenar.
const VALOR = {
  animal: (a) => a.numeroInterno,
  pesoActual: (a) => (a.pesos?.length ? pesoActual(a) : null),
  pesoInicial: (a) => a.pesoIngreso,
  precioKg: (a) => a.precioCompraKg,
};

export function ordenarAnimales(lista, campo = 'animal', dir = 'asc') {
  const valor = VALOR[campo] ?? VALOR.animal;
  const signo = dir === 'desc' ? -1 : 1;
  return [...lista].sort((x, y) => {
    const a = valor(x);
    const b = valor(y);
    // Los vacíos siempre al final, sin importar el sentido.
    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;
    const c = typeof a === 'string' ? a.localeCompare(b, 'es', { numeric: true }) : a - b;
    return c * signo;
  });
}

// R3: página `pagina` (desde 1). Devuelve los elementos y el texto "1–20 de 34".
export function paginar(lista, pagina, porPagina = POR_PAGINA) {
  const paginas = Math.max(1, Math.ceil(lista.length / porPagina));
  const actual = Math.min(Math.max(1, pagina), paginas);
  const inicio = (actual - 1) * porPagina;
  const items = lista.slice(inicio, inicio + porPagina);
  const rango = lista.length ? `${inicio + 1}–${inicio + items.length} de ${lista.length}` : '0 de 0';
  return { items, pagina: actual, paginas, rango };
}
