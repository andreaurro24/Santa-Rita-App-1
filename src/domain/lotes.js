// Spec 006 · resumen del lote y fecha proyectada para llegar a la meta pactada (D3).
import { pesoActual } from './breakeven';
import { gdpLote, pesoEstimadoHoy } from './gdp';

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
    // Se estima el peso de hoy de cada animal con su propia GDP desde su último pesaje: si el lote
    // se pesó hace 30 días ya ganó ese peso (verificación 006), y pesar un solo animal hoy no
    // mueve la fecha de todo el lote (verificación 004 r2).
    const estimados = activos.map((a) => pesoEstimadoHoy(a, hoy));
    const estimadoHoy = redondear1(estimados.reduce((s, x) => s + x, 0) / estimados.length);
    if (estimadoHoy >= meta) {
      proyeccion = { tipo: 'meta_estimada', pesoEstimadoHoy: estimadoHoy };
    } else {
      const dias = Math.ceil((meta - estimadoHoy) / gdp);
      proyeccion = { tipo: 'fecha', dias, fecha: sumarDias(hoy, dias), pesoEstimadoHoy: estimadoHoy };
    }
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

