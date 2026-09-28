// Utilidades de peso y formato. El motor de recomendación v1 que vivía aquí lo reemplazó
// src/domain/decision.js (spec 010).

// Orden cronológico de pesajes. Si hay dos el mismo día, vale el último registrado (`creado`).
export function ordenarPesajes(pesos = []) {
  return [...pesos].sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.creado ?? '').localeCompare(b.creado ?? ''));
}

export function pesoActual(animal) {
  if (!animal.pesos?.length) return animal.pesoIngreso;
  return ordenarPesajes(animal.pesos).at(-1).pesoKg;
}

export function fechaUltimoPesaje(animal) {
  if (!animal.pesos?.length) return null;
  return ordenarPesajes(animal.pesos).at(-1).fecha;
}

export function formatCOP(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('es-CO').format(n);
}
