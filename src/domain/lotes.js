// Spec 006 · resumen del lote y fecha proyectada para llegar a la meta pactada (D3).
import { pesoActual, fechaUltimoPesaje } from './breakeven';
import { diasEntre, gdpLote } from './gdp';

function sumarDias(iso, dias) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
}

const redondear1 = (n) => Math.round(n * 10) / 10;

// R2–R4. `meta` es la meta pactada del lote; si no tiene, el promedio de las metas de sus animales.
export function resumenLote(lote, hoy) {
  const activos = (lote.animales ?? []).filter((a) => a.estado === 'Activo');
  if (!activos.length) {
    return { nActivos: 0, pesoPromedio: null, meta: lote.pesoMeta ?? null, avancePct: null, gdp: null, proyeccion: { tipo: 'sin_animales' } };
  }
  const pesoPromedio = redondear1(activos.reduce((s, a) => s + pesoActual(a), 0) / activos.length);
  const meta = lote.pesoMeta ?? redondear1(activos.reduce((s, a) => s + a.pesoObjetivo, 0) / activos.length);
  const avancePct = redondear1((pesoPromedio / meta) * 100);
  const gdp = gdpLote(activos);

  let proyeccion;
  if (pesoPromedio >= meta) {
    proyeccion = { tipo: 'meta_alcanzada' }; // R4: sugerir marcar el lote como listo
  } else if (gdp == null || gdp <= 0) {
    proyeccion = { tipo: 'sin_datos' }; // R3
  } else {
    // La proyección arranca en la fecha del peso usado (el último pesaje del lote), no en hoy:
    // si el lote se pesó hace 30 días, ya ganó ese peso (verificación 006, Medio 1).
    const base = activos.map(fechaUltimoPesaje).filter(Boolean).sort().at(-1) ?? hoy;
    const fecha = sumarDias(base, Math.ceil((meta - pesoPromedio) / gdp));
    const dias = diasEntre(hoy, fecha);
    proyeccion = dias > 0 ? { tipo: 'fecha', dias, fecha, desde: base } : { tipo: 'meta_estimada', fecha, desde: base };
  }

  return { nActivos: activos.length, pesoPromedio, meta, avancePct, gdp, proyeccion };
}

// R8 / D2: hembras que se quieren pasar a un lote de ceba (que se vende). Incluye vientres y
// terneras: una ternera puede tener potencial reproductivo, y D2 dice que esas no se venden.
export const HEMBRAS_REPRODUCTIVAS = ['vientre', 'ternera'];

export function vientresHaciaCeba(animales, loteDestino) {
  if (!loteDestino || loteDestino.tipo !== 'ceba') return [];
  return animales.filter((a) => HEMBRAS_REPRODUCTIVAS.includes(a.categoria));
}

