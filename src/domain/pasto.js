// Spec 009 · estado del pasto por finca (D4). Funciones puras.
import { diasEntre } from './gdp';

export const DIAS_VIGENCIA_PASTO = 30;
const SEVERIDAD = { verde: 0, amarillo: 1, rojo: 2 };

// R2: el último estado de cada finca, marcando si tiene más de 30 días.
export function ultimoPorFinca(estados, hoy) {
  const porFinca = new Map();
  for (const e of [...estados].sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.creado ?? '').localeCompare(a.creado ?? ''))) {
    if (!porFinca.has(e.fincaId)) porFinca.set(e.fincaId, { ...e, desactualizado: diasEntre(e.fecha, hoy) > DIAS_VIGENCIA_PASTO });
  }
  return porFinca;
}

// Para la recomendación: el nivel más crítico entre los estados vigentes (≤ 30 días), o null.
export function pastoMasCritico(estados, hoy, fincaIds = null) {
  let peor = null;
  for (const e of ultimoPorFinca(estados, hoy).values()) {
    if (e.desactualizado || (fincaIds && !fincaIds.includes(e.fincaId))) continue;
    if (!peor || SEVERIDAD[e.nivel] > SEVERIDAD[peor.nivel]) peor = e;
  }
  return peor;
}
