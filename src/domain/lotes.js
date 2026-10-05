// Spec 006 · resumen del lote y fecha proyectada para llegar a la meta pactada (D3).
import { pesoActual } from './breakeven';
import { gdpLote, pesoEstimadoHoy } from './gdp';
import { esVientre } from './animales';

function sumarDias(iso, dias) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
}

const redondear1 = (n) => Math.round(n * 10) / 10;

// R2–R4. Spec 022 · R6: la meta del lote es el promedio de los pesos objetivo de sus animales (el
// lote ya no tiene meta propia; `peso_meta_kg` queda en la base de datos sin usar).
export function resumenLote(lote, hoy) {
  const activos = (lote.animales ?? []).filter((a) => a.estado === 'Activo');
  if (!activos.length) {
    return { nActivos: 0, pesoPromedio: null, meta: null, avancePct: null, gdp: null, proyeccion: { tipo: 'sin_animales' } };
  }
  const pesoPromedio = redondear1(activos.reduce((s, a) => s + pesoActual(a), 0) / activos.length);
  // Spec 016 · R6: el peso objetivo es opcional; la meta sale de los animales que lo tienen.
  const conObjetivo = activos.filter((a) => a.pesoObjetivo > 0);
  const meta = conObjetivo.length ? redondear1(conObjetivo.reduce((s, a) => s + a.pesoObjetivo, 0) / conObjetivo.length) : null;
  const avancePct = meta ? redondear1((pesoPromedio / meta) * 100) : null;
  const gdp = gdpLote(activos);

  let proyeccion;
  if (meta == null) {
    proyeccion = { tipo: 'sin_meta' };
  } else if (pesoPromedio >= meta) {
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
// Spec 016 · R5: los tres tipos de vientre (menor, mayor, parida) cuentan.
export const HEMBRAS_REPRODUCTIVAS = ['vientre', 'vientre_menor', 'vientre_mayor', 'vientre_parida', 'ternera'];

export const esHembraReproductiva = (categoria) => categoria === 'ternera' || esVientre(categoria);

export function vientresHaciaCeba(animales, loteDestino) {
  if (!loteDestino || loteDestino.tipo !== 'ceba') return [];
  return animales.filter((a) => esHembraReproductiva(a.categoria));
}


// Spec 020 · R3: tenedores "Al partir" que tienen animales activos del lote (para marcarlo).
export function tenedoresDelLote(animales) {
  const nombres = new Set();
  for (const a of animales ?? []) if (a.estado === 'Activo' && a.esquema === 'Al partir' && a.tenedor) nombres.add(a.tenedor.split(' – ')[0]);
  return [...nombres];
}

// Estados del lote con su etiqueta y el tono de su insignia.
export const ESTADO_LOTE = {
  activo: { label: 'Activo', tono: 'potrero' },
  listo: { label: 'Listo para vender', tono: 'ok' },
  vendido: { label: 'Vendido', tono: 'neutro' },
  cerrado: { label: 'Cerrado', tono: 'neutro' },
};
