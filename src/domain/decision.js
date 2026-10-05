// Spec 010 · Motor de recomendación v2 (M10). Funciones puras, sin red ni base de datos.
// Responde "¿vender hoy o esperar?" con el costo real (spec 008, D10), la parte de los
// tenedores (D11), el destare (D5), la ganancia diaria (spec 004) y el riesgo de pasto (D4).
import { pesoActual, formatCOP } from './breakeven';
import { gdpTotal, diasEntre, pesoEstimadoHoy } from './gdp';
import { costoAcumuladoAnimal, repartirCostos } from './costos';
import { formatPct } from '../utils/format';
import { esVientre } from './animales';

export const ESCENARIOS_SEMANAS = [0, 2, 4, 8];
export const SENSIBILIDAD = [-0.1, -0.05, 0.05, 0.1];
const DIAS_GASTO_RECIENTE = 90;

const pesos = (n) => `$${formatCOP(Math.round(n))}`;

// Gasto diario promedio del lote en los últimos 90 días (todos sus gastos, de lote y directos).
export function gastoDiarioLote(costosLote, hoy) {
  const recientes = costosLote.filter((c) => c.fecha <= hoy && diasEntre(c.fecha, hoy) < DIAS_GASTO_RECIENTE);
  return recientes.reduce((s, c) => s + c.montoCop, 0) / DIAS_GASTO_RECIENTE;
}

// D8/D11 (decisiones del 2026-09-28, DT-03-3 y DT-04-9): el tenedor recibe su porcentaje de la
// ganancia neta ACUMULADA del contrato: la suma de las ganancias de todos sus animales vendidos
// hasta esta venta, incluidas las ventas anteriores. En cada venta se le paga lo que le toca con
// ese acumulado menos lo que ya se le pagó, nunca menos de $0. Así la pérdida de un animal
// descuenta de lo que ganaron los demás del mismo contrato, aunque se vendan en ventas distintas.
// Si una pérdida llega después de haber pagado, lo pagado de más queda como `saldoAFavor` de
// Santa Rita: se descuenta de las siguientes ventas del contrato o se cobra al cerrarlo.
// items:  [{ contratoId, porcentaje, ganancia }] de esta venta.
// previo: Map contratoId → { ganancia, parte, pagado } de las ventas anteriores (estadoContratos).
export function partesTenedores(items, previo = new Map()) {
  const porContrato = new Map();
  for (const { contratoId, porcentaje, ganancia } of items) {
    // Un contrato al 0 % también se liquida (con $0): así aparece en el detalle de la venta.
    if (!contratoId || porcentaje == null) continue;
    const l = porContrato.get(contratoId) ?? { contratoId, porcentaje, animales: 0, ganancia: 0, parte: 0 };
    l.animales += 1;
    l.ganancia += ganancia;
    l.parte += (ganancia * porcentaje) / 100; // por animal, por si el % del contrato cambió entre ventas
    porContrato.set(contratoId, l);
  }
  for (const l of porContrato.values()) {
    const p = previo.get(l.contratoId) ?? { ganancia: 0, parte: 0, pagado: 0 };
    l.gananciaAcumulada = p.ganancia + l.ganancia;
    l.parteAcumulada = p.parte + l.parte;
    l.pagadoAntes = p.pagado;
    l.monto = Math.max(0, Math.max(0, l.parteAcumulada) - p.pagado);
    const saldo = p.pagado + l.monto - Math.max(0, l.parteAcumulada);
    l.saldoAFavor = saldo >= 1 ? saldo : 0; // menos de $1 es residuo de redondeo
  }
  return porContrato;
}

// Spec 025 · R7: las comisiones y el transporte de la venta se reparten entre los animales en
// proporción a su valor bruto y se restan ANTES de calcular la parte de los tenedores (D8).
export function repartirGastosVenta(brutos, gastosVenta = 0) {
  const total = brutos.reduce((s, b) => s + b, 0);
  if (!(gastosVenta > 0) || !brutos.length) return brutos.map(() => 0);
  return brutos.map((b) => (total > 0 ? (gastosVenta * b) / total : gastosVenta / brutos.length));
}

// Spec 025 · R8: cuánto de las comisiones y el transporte de una venta le toca a cada contrato.
export function gastosVentaPorContrato({ animales, precioKg, destarePct = 0, gastosVenta = 0 }) {
  const brutos = animales.map((a) => a.pesoKg * (1 - destarePct / 100) * precioKg);
  const gastos = repartirGastosVenta(brutos, gastosVenta);
  const porContrato = new Map();
  animales.forEach((a, i) => {
    if (a.contratoId) porContrato.set(a.contratoId, (porContrato.get(a.contratoId) ?? 0) + gastos[i]);
  });
  return porContrato;
}

const gananciasVenta = (animales, { precioKg, destarePct = 0, gastosVenta = 0 }) => {
  const brutos = animales.map((a) => a.pesoKg * (1 - destarePct / 100) * precioKg);
  const gastos = repartirGastosVenta(brutos, gastosVenta);
  return animales.map((a, i) => ({
    contratoId: a.contratoId,
    porcentaje: a.porcentajeTenedor,
    ganancia: brutos[i] - a.costoCop - gastos[i],
  }));
};

// 011 R5: las ventas se liquidan en el ORDEN EN QUE SE REGISTRARON (created_at), no por su fecha.
// Así una liquidación ya pagada nunca cambia: una venta registrada después con fecha pasada se
// liquida después y, si hace falta, deja saldo a favor (verificación D8 acumulado, Alto).
const ordenVentas = (a, b) => (a.creado ?? '').localeCompare(b.creado ?? '') || a.id.localeCompare(b.id);

// Estado de cada contrato después de liquidar las ventas en orden. Con `antesDe` (id de una venta)
// solo cuenta las registradas antes de esa; sin él, todas (para una venta nueva o la recomendación).
export function estadoContratos(ventas, { antesDe = null } = {}) {
  const estado = new Map();
  for (const v of [...ventas].sort(ordenVentas)) {
    if (v.id === antesDe) break;
    for (const l of partesTenedores(gananciasVenta(v.animales, v), estado).values()) {
      estado.set(l.contratoId, { ganancia: l.gananciaAcumulada, parte: l.parteAcumulada, pagado: l.pagadoAntes + l.monto });
    }
  }
  return estado;
}

// Spec 021 · R3: el precio puede ser uno solo (número) o uno por animal según su categoría y su
// peso a la fecha de venta (función `(animal, pesoKg) => $/kg`).
const precioDe = (precioKg, a, peso) => (typeof precioKg === 'function' ? precioKg(a, peso) : precioKg);
const escalarPrecio = (precioKg, factor) => (typeof precioKg === 'function' ? (a, peso) => precioKg(a, peso) * factor : precioKg * factor);

// Resultado económico de vender ya (dias = 0) o dentro de `dias`, al precio dado.
function resultado(vendibles, { costoBase, pesoBase, precioKg, destarePct, dias, gastoDiarioPorAnimal, contratosPrevios }) {
  let pesoVendible = 0;
  let ingreso = 0;
  let costo = 0;
  const ganancias = [];
  for (const a of vendibles) {
    const peso = pesoBase.get(a.id) + (gdpTotal(a.pesos) ?? 0) * dias;
    const vendibleKg = peso * (1 - destarePct / 100);
    const ingresoA = vendibleKg * precioDe(precioKg, a, peso);
    const costoA = costoBase.get(a.id) + gastoDiarioPorAnimal * dias;
    ganancias.push({ contratoId: a.contratoId, porcentaje: a.porcentajeTenedor, ganancia: ingresoA - costoA });
    pesoVendible += vendibleKg;
    ingreso += ingresoA;
    costo += costoA;
  }
  // D11: la parte de los tenedores se calcula por contrato (partesTenedores).
  let participacion = 0;
  for (const l of partesTenedores(ganancias, contratosPrevios).values()) participacion += l.monto;
  return {
    pesoVendible,
    ingreso,
    costo,
    participacion,
    margenNeto: ingreso - costo - participacion,
    equilibrioKg: pesoVendible > 0 ? costo / pesoVendible : null, // D10
    precioMedio: pesoVendible > 0 ? ingreso / pesoVendible : null, // 021: promedio ponderado por kilo
  };
}

/**
 * @param {object} e
 * @param {object[]} e.animales       animales del lote (forma de useHato)
 * @param {object[]} e.costos         gastos del lote (forma de useCostos)
 * @param {Map}   [e.reparto]         reparto de costos de toda la finca (useRepartoCostos); si falta, se calcula solo con el lote
 * @param {number|function|null} e.precioKg  precio del kilo en pie, o `(animal, pesoKg) => $/kg` (spec 021)
 * @param {number} e.destarePct       destare en %
 * @param {number|null} e.metaKg      meta pactada del lote (si no, promedio de metas)
 * @param {string|null} e.pasto       nivel más crítico reciente: 'verde' | 'amarillo' | 'rojo' | null
 * @param {string} e.hoy              'AAAA-MM-DD' (Bogotá)
 * @param {Map}   [e.contratosPrevios] estado de los contratos por las ventas ya hechas (estadoContratos)
 */
export function analizarLoteV2({ animales, costos, reparto = null, precioKg, destarePct = 0, metaKg = null, pasto = null, hoy, contratosPrevios = new Map() }) {
  const activos = animales.filter((a) => a.estado === 'Activo');
  const vendibles = activos.filter((a) => !esVientre(a.categoria)); // R7 / D2 (los tres tipos de vientre, spec 016)
  const excluidos = activos.length - vendibles.length;
  const razones = [];
  if (excluidos) razones.push(`${excluidos} ${excluidos === 1 ? 'vientre se excluyó' : 'vientres se excluyeron'} del cálculo: no se venden.`);

  const sinPrecio = typeof precioKg === 'function' ? vendibles.some((a) => !(precioKg(a, pesoActual(a)) > 0)) : !(precioKg > 0);
  if (sinPrecio || !vendibles.length) {
    razones.unshift(!vendibles.length ? 'El lote no tiene animales para vender.' : 'Falta el precio del kilo: regístralo en Precio y pasto.');
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
  const base = { costoBase, pesoBase, precioKg, destarePct, gastoDiarioPorAnimal, contratosPrevios };

  const hoyR = resultado(vendibles, { ...base, dias: 0 });
  const escenarios = ESCENARIOS_SEMANAS.map((semanas) => ({ semanas, ...resultado(vendibles, { ...base, dias: semanas * 7 }) }));
  const sensibilidad = SENSIBILIDAD.map((f) => {
    const r = resultado(vendibles, { ...base, precioKg: escalarPrecio(precioKg, 1 + f), dias: 0 });
    return { variacion: f, ...r, precioKg: r.precioMedio };
  });

  const pesoPromedio = vendibles.reduce((s, a) => s + pesoBase.get(a.id), 0) / vendibles.length;
  // Spec 016 · R6: el peso objetivo es opcional; la meta sale de los animales que lo tienen.
  const conObjetivo = vendibles.filter((a) => a.pesoObjetivo > 0);
  const meta = metaKg ?? (conObjetivo.length ? conObjetivo.reduce((s, a) => s + a.pesoObjetivo, 0) / conObjetivo.length : null);
  const avancePct = meta ? (pesoPromedio / meta) * 100 : null;
  const metaAlcanzada = meta != null && pesoPromedio >= meta;

  // Spec 015 · R1: el riesgo de pasto sale solo del semáforo que registra Miguel (sin clima).
  const riesgoPasto = pasto === 'rojo';
  const futuros = escenarios.slice(1);
  const mejorFuturo = futuros.reduce((m, e) => (e.margenNeto > m.margenNeto ? e : m), futuros[0]);

  razones.push(
    `Punto de equilibrio real: ${pesos(hoyR.equilibrioKg)}/kg, con compra, gastos y ${formatPct(destarePct)} de destare. El precio de hoy es ${pesos(hoyR.precioMedio)}/kg.`,
  );
  if (hoyR.participacion > 0) razones.push(`La parte de los tenedores "Al partir" hoy sería ${pesos(hoyR.participacion)}.`);
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
    razones.unshift(`El pasto está en rojo: se recomienda anticipar la venta mientras el margen es positivo (${pesos(hoyR.margenNeto)}).`);
    // D4: decir cuánto se deja de ganar al anticipar.
    if (mejorFuturo.margenNeto > hoyR.margenNeto) {
      razones.push(
        `Anticipar la venta deja de ganar hasta ${pesos(mejorFuturo.margenNeto - hoyR.margenNeto)} frente a esperar ${mejorFuturo.semanas} semanas, si el lote siguiera ganando peso sin problemas de pasto.`,
      );
    }
  } else if (mejorFuturo.margenNeto > hoyR.margenNeto) {
    recomendacion = 'ESPERAR';
    razones.unshift(
      `Esperar ${mejorFuturo.semanas} semanas subiría el margen de ${pesos(hoyR.margenNeto)} a ${pesos(mejorFuturo.margenNeto)}: los animales ganan más de lo que cuesta mantenerlos.${Number.isFinite(avancePct) ? ` El lote va en el ${Math.round(avancePct)} % de la meta.` : ''}`,
    );
  } else {
    recomendacion = 'VENDER';
    // R5 (decisión del 2026-09-28, DT-03-9): se vende aunque no se haya llegado a la meta pactada,
    // porque esperar ya no sube el margen; se dice explícitamente que la meta no se alcanzó.
    // Verificación Sprint 05 (B6): el aviso va en la frase principal, que se ve sin abrir detalles.
    razones.unshift(
      `Esperar ya no paga: lo que cuesta mantener el lote supera lo que gana en peso. El margen de hoy es ${pesos(hoyR.margenNeto)}.` +
        (Number.isFinite(avancePct) ? ` El lote no llegó a la meta pactada (va en el ${Math.round(avancePct)} %): confirma con el comprador que acepta ese peso.` : ''),
    );
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
// previo: estado de los contratos por las ventas anteriores (estadoContratos), D8 acumulado.
// Spec 025 · R2/R7: `gastosVenta` son las comisiones y el transporte de toda la venta.
export function resultadoVenta(animales, { precioKg, destarePct = 0, gastosVenta = 0 }, previo = new Map()) {
  let pesoTotal = 0;
  let pesoVendible = 0;
  let ingreso = 0;
  let costo = 0;
  for (const a of animales) {
    const vendibleKg = a.pesoKg * (1 - destarePct / 100);
    pesoTotal += a.pesoKg;
    pesoVendible += vendibleKg;
    ingreso += vendibleKg * precioKg;
    costo += a.costoCop;
  }
  const gastos = gastosVenta > 0 ? gastosVenta : 0;
  const liquidaciones = [...partesTenedores(gananciasVenta(animales, { precioKg, destarePct, gastosVenta: gastos }), previo).values()].map(
    ({ contratoId, animales: n, ganancia, gananciaAcumulada, pagadoAntes, monto, saldoAFavor }) => ({ contratoId, animales: n, ganancia, gananciaAcumulada, pagadoAntes, monto, saldoAFavor }),
  );
  const participacion = liquidaciones.reduce((s, l) => s + l.monto, 0);
  const margenNeto = ingreso - costo - gastos - participacion;
  return {
    cabezas: animales.length,
    pesoTotal,
    pesoVendible,
    ingreso,
    costo,
    gastosVenta: gastos,
    participacion,
    margenNeto,
    // 025 · R2: margen sobre el valor bruto, como en la referencia.
    margenPct: ingreso > 0 ? (margenNeto / ingreso) * 100 : null,
    liquidaciones,
  };
}

// Spec 025 · R2: el panel del simulador. `animales`: [{ pesoKg, costoCop, contratoId, porcentajeTenedor }].
export function simularVenta({ animales, precioKg, destarePct = 0, gastosVenta = 0, previo = new Map() }) {
  return resultadoVenta(animales, { precioKg: precioKg || 0, destarePct, gastosVenta }, previo);
}

// R6: se siguió la recomendación si el sistema decía vender (o vender antes) y se vendió.
export function siguioRecomendacion(recomendacion) {
  if (!recomendacion) return null;
  return recomendacion === 'VENDER' || recomendacion === 'VENDER_ANTICIPADO';
}
