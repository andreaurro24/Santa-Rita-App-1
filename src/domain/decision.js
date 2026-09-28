// Spec 010 · Motor de recomendación v2 (M10). Funciones puras, sin red ni base de datos.
// Responde "¿vender hoy o esperar?" con el costo real (spec 008, D10), la parte de los
// tenedores (D11), el destare (D5), la ganancia diaria (spec 004) y el riesgo de pasto (D4).
import { pesoActual, formatCOP } from './breakeven';
import { gdpTotal, diasEntre, pesoEstimadoHoy } from './gdp';
import { costoAcumuladoAnimal, repartirCostos } from './costos';
import { formatNumero, formatPct } from '../utils/format';

export const ESCENARIOS_SEMANAS = [0, 2, 4, 8];
export const SENSIBILIDAD = [-0.1, -0.05, 0.05, 0.1];
const DIAS_GASTO_RECIENTE = 90;

const pesos = (n) => `$${formatCOP(Math.round(n))}`;

// Gasto diario promedio del lote en los últimos 90 días (todos sus gastos, de lote y directos).
export function gastoDiarioLote(costosLote, hoy) {
  const recientes = costosLote.filter((c) => c.fecha <= hoy && diasEntre(c.fecha, hoy) < DIAS_GASTO_RECIENTE);
  return recientes.reduce((s, c) => s + c.montoCop, 0) / DIAS_GASTO_RECIENTE;
}

// D8/D11 (decisión del 2026-09-28, DT-03-3): el tenedor recibe su porcentaje de la ganancia neta
// del CONTRATO (la suma de las ganancias de sus animales vendidos), solo si esa suma es positiva.
// Un animal que pierde descuenta de lo que ganaron los demás del mismo contrato.
// items: [{ contratoId, porcentaje, ganancia }] → Map contratoId → { animales, ganancia, monto }.
export function partesTenedores(items) {
  const porContrato = new Map();
  for (const { contratoId, porcentaje, ganancia } of items) {
    if (!contratoId || !porcentaje) continue;
    const l = porContrato.get(contratoId) ?? { contratoId, porcentaje, animales: 0, ganancia: 0, monto: 0 };
    l.animales += 1;
    l.ganancia += ganancia;
    porContrato.set(contratoId, l);
  }
  for (const l of porContrato.values()) l.monto = (Math.max(0, l.ganancia) * l.porcentaje) / 100;
  return porContrato;
}

// Resultado económico de vender ya (dias = 0) o dentro de `dias`, al precio dado.
function resultado(vendibles, { costoBase, pesoBase, precioKg, destarePct, dias, gastoDiarioPorAnimal }) {
  let pesoVendible = 0;
  let ingreso = 0;
  let costo = 0;
  const ganancias = [];
  for (const a of vendibles) {
    const peso = pesoBase.get(a.id) + (gdpTotal(a.pesos) ?? 0) * dias;
    const vendibleKg = peso * (1 - destarePct / 100);
    const ingresoA = vendibleKg * precioKg;
    const costoA = costoBase.get(a.id) + gastoDiarioPorAnimal * dias;
    ganancias.push({ contratoId: a.contratoId, porcentaje: a.porcentajeTenedor, ganancia: ingresoA - costoA });
    pesoVendible += vendibleKg;
    ingreso += ingresoA;
    costo += costoA;
  }
  // D11: la parte de los tenedores se calcula por contrato (partesTenedores).
  let participacion = 0;
  for (const l of partesTenedores(ganancias).values()) participacion += l.monto;
  return {
    pesoVendible,
    ingreso,
    costo,
    participacion,
    margenNeto: ingreso - costo - participacion,
    equilibrioKg: pesoVendible > 0 ? costo / pesoVendible : null, // D10
  };
}

/**
 * @param {object} e
 * @param {object[]} e.animales       animales del lote (forma de useHato)
 * @param {object[]} e.costos         gastos del lote (forma de useCostos)
 * @param {Map}   [e.reparto]         reparto de costos de toda la finca (useRepartoCostos); si falta, se calcula solo con el lote
 * @param {number|null} e.precioKg    precio del kilo en pie
 * @param {number} e.destarePct       destare en %
 * @param {number|null} e.metaKg      meta pactada del lote (si no, promedio de metas)
 * @param {object|null} e.clima       { isFallback, resumenLluvia7d }
 * @param {string|null} e.pasto       nivel más crítico reciente: 'verde' | 'amarillo' | 'rojo' | null
 * @param {string} e.hoy              'AAAA-MM-DD' (Bogotá)
 */
export function analizarLoteV2({ animales, costos, reparto = null, precioKg, destarePct = 0, metaKg = null, clima = null, pasto = null, hoy }) {
  const activos = animales.filter((a) => a.estado === 'Activo');
  const vendibles = activos.filter((a) => a.categoria !== 'vientre'); // R7 / D2
  const excluidos = activos.length - vendibles.length;
  const razones = [];
  if (excluidos) razones.push(`${excluidos} ${excluidos === 1 ? 'vientre se excluyó' : 'vientres se excluyeron'} del cálculo: no se venden.`);

  if (!precioKg || precioKg <= 0 || !vendibles.length) {
    razones.unshift(!vendibles.length ? 'El lote no tiene animales para vender.' : 'Falta el precio del kilo en pie: regístralo en Mercado y clima.');
    return { recomendacion: 'SIN_DATOS', razones, nAnimales: vendibles.length, excluidos };
  }

  // Costo acumulado de cada animal hasta hoy (compra + gastos directos + parte del lote).
  const repartoLote = reparto ?? repartirCostos(costos, animales);
  const costoBase = new Map(vendibles.map((a) => [a.id, costoAcumuladoAnimal(a, repartoLote).total]));
  const gastoDiario = gastoDiarioLote(costos, hoy);
  const gastoDiarioPorAnimal = gastoDiario / vendibles.length;
  // R3 (verificación 010, Alto): se parte del peso ESTIMADO de hoy de cada animal, no del último
  // pesaje, que puede tener semanas. Es el mismo cálculo de la proyección del lote (spec 006).
  const pesoBase = new Map(vendibles.map((a) => [a.id, pesoEstimadoHoy(a, hoy)]));
  const base = { costoBase, pesoBase, precioKg, destarePct, gastoDiarioPorAnimal };

  const hoyR = resultado(vendibles, { ...base, dias: 0 });
  const escenarios = ESCENARIOS_SEMANAS.map((semanas) => ({ semanas, ...resultado(vendibles, { ...base, dias: semanas * 7 }) }));
  const sensibilidad = SENSIBILIDAD.map((f) => ({ variacion: f, precioKg: precioKg * (1 + f), ...resultado(vendibles, { ...base, precioKg: precioKg * (1 + f), dias: 0 }) }));

  const pesoPromedio = vendibles.reduce((s, a) => s + pesoBase.get(a.id), 0) / vendibles.length;
  const meta = metaKg ?? vendibles.reduce((s, a) => s + a.pesoObjetivo, 0) / vendibles.length;
  const avancePct = (pesoPromedio / meta) * 100;
  const metaAlcanzada = pesoPromedio >= meta;

  const climaUsable = clima && !clima.isFallback;
  const sequia = climaUsable && clima.resumenLluvia7d < 2;
  const riesgoPasto = pasto === 'rojo' || sequia;
  const futuros = escenarios.slice(1);
  const mejorFuturo = futuros.reduce((m, e) => (e.margenNeto > m.margenNeto ? e : m), futuros[0]);

  razones.push(
    `Punto de equilibrio real: ${pesos(hoyR.equilibrioKg)}/kg, con compra, gastos y ${formatPct(destarePct)} de destare. El precio de hoy es ${pesos(precioKg)}/kg.`,
  );
  if (hoyR.participacion > 0) razones.push(`La parte de los tenedores "Al partir" hoy sería ${pesos(hoyR.participacion)}.`);
  if (clima && clima.isFallback) razones.push('El pronóstico está sin conexión: no se usó la lluvia para recomendar.'); // R6
  if (pasto === 'amarillo') razones.push('El pasto está en amarillo: vigílalo en la próxima visita.');

  let recomendacion;
  if (hoyR.margenNeto <= 0) {
    recomendacion = 'NO_VENDER';
    razones.unshift(
      Math.round(hoyR.margenNeto) === 0
        ? 'Vender hoy no dejaría ganancia para Santa Rita.'
        : `Vender hoy dejaría una pérdida de ${pesos(-hoyR.margenNeto)} para Santa Rita.`,
    );
    const positivo = futuros.find((e) => e.margenNeto > 0);
    if (positivo && !riesgoPasto) {
      razones.push(`Si el lote sigue ganando peso al ritmo actual, en ${positivo.semanas} semanas el margen sería de ${pesos(positivo.margenNeto)}.`);
    } else if (positivo) {
      razones.push(
        `En ${positivo.semanas} semanas el margen sería de ${pesos(positivo.margenNeto)} si el lote sigue ganando peso, pero hay riesgo de pasto: sin pasto los animales pueden dejar de ganar o perder peso. Evalúa suplementar o buscar un mejor precio.`,
      );
    } else if (riesgoPasto) {
      razones.push('Además hay riesgo de pasto: busca un mejor precio o suplementa mientras tanto.');
    }
  } else if (metaAlcanzada) {
    recomendacion = 'VENDER';
    razones.unshift(`El lote llegó a la meta pactada (${Math.round(avancePct)} %) con un margen neto de ${pesos(hoyR.margenNeto)}.`);
    // D3: se vende al peso pactado con el comprador, aunque engordar más pudiera dar más margen.
    if (mejorFuturo.margenNeto > hoyR.margenNeto) {
      razones.push(
        `Si el comprador acepta animales más pesados, esperar ${mejorFuturo.semanas} semanas daría ${pesos(mejorFuturo.margenNeto)} (${pesos(mejorFuturo.margenNeto - hoyR.margenNeto)} más). La meta pactada ya se cumplió.`,
      );
    }
  } else if (riesgoPasto) {
    recomendacion = 'VENDER_ANTICIPADO';
    razones.unshift(
      pasto === 'rojo'
        ? `El pasto está en rojo: se recomienda anticipar la venta mientras el margen es positivo (${pesos(hoyR.margenNeto)}).`
        : `Casi no se pronostica lluvia (${formatNumero(clima.resumenLluvia7d)} mm en 7 días): riesgo de escasez de pasto. Se recomienda anticipar la venta con margen positivo (${pesos(hoyR.margenNeto)}).`,
    );
    // D4: decir cuánto se deja de ganar al anticipar.
    if (mejorFuturo.margenNeto > hoyR.margenNeto) {
      razones.push(
        `Anticipar la venta deja de ganar hasta ${pesos(mejorFuturo.margenNeto - hoyR.margenNeto)} frente a esperar ${mejorFuturo.semanas} semanas, si el lote siguiera ganando peso sin problemas de pasto.`,
      );
    }
  } else if (mejorFuturo.margenNeto > hoyR.margenNeto) {
    recomendacion = 'ESPERAR';
    razones.unshift(
      `Esperar ${mejorFuturo.semanas} semanas subiría el margen de ${pesos(hoyR.margenNeto)} a ${pesos(mejorFuturo.margenNeto)}: los animales ganan más de lo que cuesta mantenerlos. El lote va en el ${Math.round(avancePct)} % de la meta.`,
    );
  } else {
    recomendacion = 'VENDER';
    // R5 (decisión del 2026-09-28, DT-03-9): se vende aunque no se haya llegado a la meta pactada,
    // porque esperar ya no sube el margen; se dice explícitamente que la meta no se alcanzó.
    razones.unshift(`Esperar ya no paga: lo que cuesta mantener el lote supera lo que gana en peso. El margen de hoy es ${pesos(hoyR.margenNeto)}.`);
    if (avancePct != null) razones.push(`El lote no llegó a la meta pactada (va en el ${Math.round(avancePct)} %): confirma con el comprador que acepta ese peso.`);
  }

  return {
    recomendacion,
    razones,
    nAnimales: vendibles.length,
    excluidos,
    pesoPromedio,
    meta,
    avancePct,
    gastoDiario,
    hoy: hoyR,
    escenarios,
    sensibilidad,
    riesgoPasto,
  };
}

// Spec 011 · R5, R6: resultado real de una venta y liquidación de cada contrato "Al partir".
// animales: [{ pesoKg, costoCop, contratoId, porcentajeTenedor }] (copias guardadas en la venta).
export function resultadoVenta(animales, { precioKg, destarePct = 0 }) {
  let pesoVendible = 0;
  let ingreso = 0;
  let costo = 0;
  const ganancias = [];
  for (const a of animales) {
    const vendibleKg = a.pesoKg * (1 - destarePct / 100);
    const ingresoA = vendibleKg * precioKg;
    ganancias.push({ contratoId: a.contratoId, porcentaje: a.porcentajeTenedor, ganancia: ingresoA - a.costoCop });
    pesoVendible += vendibleKg;
    ingreso += ingresoA;
    costo += a.costoCop;
  }
  const liquidaciones = [...partesTenedores(ganancias).values()].map(({ contratoId, animales: n, ganancia, monto }) => ({ contratoId, animales: n, ganancia, monto }));
  const participacion = liquidaciones.reduce((s, l) => s + l.monto, 0);
  return { pesoVendible, ingreso, costo, participacion, margenNeto: ingreso - costo - participacion, liquidaciones };
}

// R6: se siguió la recomendación si el sistema decía vender (o vender antes) y se vendió.
export function siguioRecomendacion(recomendacion) {
  if (!recomendacion) return null;
  return recomendacion === 'VENDER' || recomendacion === 'VENDER_ANTICIPADO';
}
