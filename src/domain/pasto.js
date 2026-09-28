// Spec 009 · estado del pasto por finca y potrero (D4). Funciones puras.
import { diasEntre } from './gdp';

export const DIAS_VIGENCIA_PASTO = 30;
const SEVERIDAD = { verde: 0, amarillo: 1, rojo: 2 };

const masReciente = (a, b) => b.fecha.localeCompare(a.fecha) || (b.creado ?? '').localeCompare(a.creado ?? '');

// El último estado de cada área: la finca entera (sin potrero) o cada potrero por separado.
// Así el verde de un potrero no tapa el rojo de otro (verificación 009, Medio).
function ultimoPorArea(estados, hoy) {
  const porArea = new Map();
  for (const e of [...estados].sort(masReciente)) {
    const clave = `${e.fincaId}|${e.potreroId ?? ''}`;
    if (!porArea.has(clave)) porArea.set(clave, { ...e, desactualizado: diasEntre(e.fecha, hoy) > DIAS_VIGENCIA_PASTO });
  }
  return [...porArea.values()];
}

// R2: por finca, el estado más crítico entre sus áreas vigentes (≤ 30 días). Si todas están
// desactualizadas, el más reciente, marcado como desactualizado.
export function ultimoPorFinca(estados, hoy) {
  const porFinca = new Map();
  for (const e of ultimoPorArea(estados, hoy)) {
    const actual = porFinca.get(e.fincaId);
    if (!actual) {
      porFinca.set(e.fincaId, e);
      continue;
    }
    if (actual.desactualizado && !e.desactualizado) porFinca.set(e.fincaId, e);
    else if (actual.desactualizado === e.desactualizado && SEVERIDAD[e.nivel] > SEVERIDAD[actual.nivel]) porFinca.set(e.fincaId, e);
  }
  return porFinca;
}

// Para la recomendación: el nivel más crítico entre los estados vigentes, o null.
export function pastoMasCritico(estados, hoy, fincaIds = null) {
  let peor = null;
  for (const e of ultimoPorArea(estados, hoy)) {
    if (e.desactualizado || (fincaIds && !fincaIds.includes(e.fincaId))) continue;
    if (!peor || SEVERIDAD[e.nivel] > SEVERIDAD[peor.nivel]) peor = e;
  }
  return peor;
}
