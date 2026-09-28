// D12: las fechas del negocio son días calendario en America/Bogota.
const ZONA = 'America/Bogota';

// Fecha de hoy en Bogotá como 'AAAA-MM-DD' (no en UTC: a las 8 p. m. en Colombia ya es
// "mañana" en UTC y el formulario propondría una fecha futura).
export function hoyISO() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(new Date());
}

export function formatFecha(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function diasDesde(iso) {
  if (!iso) return null;
  const d = new Date(iso + 'T00:00:00');
  return Math.round((Date.now() - d.getTime()) / 86400000);
}

export function diasHasta(iso) {
  if (!iso) return null;
  const d = new Date(iso + 'T00:00:00');
  return Math.round((d.getTime() - Date.now()) / 86400000);
}
