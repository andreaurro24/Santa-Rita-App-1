// Spec 004 · Ganancia diaria de peso (GDP, kg/día). Base de la proyección de venta (spec 006)
// y de la recomendación v2 (spec 010). Funciones puras: reciben pesajes { fecha, pesoKg, creado }.
import { ordenarPesajes } from './breakeven';

export function diasEntre(desdeISO, hastaISO) {
  const [a, b] = [desdeISO, hastaISO].map((f) => {
    const [y, m, d] = f.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  });
  return Math.round((b - a) / 86_400_000);
}

const redondear = (n, dec = 3) => (n == null ? null : Math.round(n * 10 ** dec) / 10 ** dec);

// Un pesaje por día (si hay dos el mismo día vale el último registrado).
function unoPorDia(pesos) {
  const porDia = new Map();
  for (const p of ordenarPesajes(pesos)) porDia.set(p.fecha, p);
  return [...porDia.values()];
}

// R5: entre el primer y el último pesaje. null si no hay dos días distintos.
export function gdpTotal(pesos = []) {
  const serie = unoPorDia(pesos);
  if (serie.length < 2) return null;
  const primero = serie[0];
  const ultimo = serie.at(-1);
  return redondear((ultimo.pesoKg - primero.pesoKg) / diasEntre(primero.fecha, ultimo.fecha));
}

// El "último periodo" se mide contra un pesaje de al menos 14 días antes: la báscula tiene
// ±3 kg de error y entre dos pesajes muy seguidos ese ruido parece pérdida de peso.
export const DIAS_MINIMOS_PERIODO = 14;

// R5: GDP del último periodo = último pesaje contra el más reciente de al menos 14 días antes.
export function gdpReciente(pesos = []) {
  const serie = unoPorDia(pesos);
  if (serie.length < 2) return null;
  const ultimo = serie.at(-1);
  const anterior = serie.slice(0, -1).findLast((p) => diasEntre(p.fecha, ultimo.fecha) >= DIAS_MINIMOS_PERIODO);
  if (!anterior) return null;
  return redondear((ultimo.pesoKg - anterior.pesoKg) / diasEntre(anterior.fecha, ultimo.fecha));
}

// Una caída mayor que el error de la báscula (±3 kg por pesaje) entre dos pesajes seguidos no es
// ruido: en la semilla, la mayor caída por ruido es 7,2 kg (verificación 004, hallazgo Alto).
export const UMBRAL_CAIDA_KG = 8;

// Kilos perdidos entre los dos últimos días con pesaje (0 si ganó o no hay dos pesajes).
export function caidaUltimoPesaje(pesos = []) {
  const serie = unoPorDia(pesos);
  if (serie.length < 2) return 0;
  const [anterior, ultimo] = serie.slice(-2);
  return Math.max(0, redondear(anterior.pesoKg - ultimo.pesoKg, 1));
}

// R7: pierde peso si la GDP del último periodo (≥ 14 días) es negativa, o si entre los dos
// últimos pesajes cayó más de 8 kg (un animal recién comprado o revisado en una visita).
export function pierdePeso(animal) {
  const g = gdpReciente(animal.pesos);
  return (g != null && g < 0) || caidaUltimoPesaje(animal.pesos) > UMBRAL_CAIDA_KG;
}

// R6: promedio de la GDP total de los animales activos que tienen dato.
export function gdpLote(animales = []) {
  const valores = animales
    .filter((a) => a.estado === 'Activo')
    .map((a) => gdpTotal(a.pesos))
    .filter((g) => g != null);
  if (!valores.length) return null;
  return redondear(valores.reduce((s, g) => s + g, 0) / valores.length);
}

// R3: un peso que cambia más del 15 % frente al último es probablemente un error de digitación.
export function variacionSospechosa(pesoNuevo, pesoAnterior, umbral = 0.15) {
  if (!pesoAnterior || !pesoNuevo) return false;
  return Math.abs(pesoNuevo - pesoAnterior) / pesoAnterior > umbral;
}
