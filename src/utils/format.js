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

// Ganancia diaria de peso: 2 decimales con coma ("0,78 kg/día"); "—" sin datos suficientes.
export function formatoGdp(g) {
  return g == null ? '—' : `${g.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg/día`;
}

// Spec 012 · R2: cifras con coma decimal y punto de miles (es-CO), en toda la app.
const num1 = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 });

export function formatNumero(n) {
  return n == null || Number.isNaN(Number(n)) ? '—' : num1.format(Number(n));
}

export function formatKg(n) {
  return n == null || Number.isNaN(Number(n)) ? '—' : `${num1.format(Number(n))} kg`;
}

export function formatPct(n) {
  return n == null || Number.isNaN(Number(n)) ? '—' : `${num1.format(Number(n))} %`;
}

// Para rellenar un campo de texto con un número editable: "349,8" (sin separador de miles).
export function numeroParaCampo(n) {
  return n == null ? '' : String(n).replace('.', ',');
}

// "1 res", "2 reses": cantidad con el sustantivo en singular o plural (verificaciones 011–013).
export function cantidad(n, singular, plural) {
  return `${formatNumero(n)} ${n === 1 ? singular : plural}`;
}
