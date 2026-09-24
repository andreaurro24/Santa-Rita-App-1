// Script de generación de datos semilla (determinístico) para el MVP de Finca Santa Rita.
// Se corre una sola vez con `node scripts/generate-seed.mjs` y su salida se guarda en
// src/data/seedAnimals.json para que la app arranque siempre con el mismo set de datos de ejemplo.

import { writeFileSync } from 'node:fs';

// PRNG determinístico (mulberry32) para que la generación sea reproducible.
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260916);
const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const pick = (arr) => arr[randInt(0, arr.length - 1)];
const round1 = (n) => Math.round(n * 10) / 10;

const HOY = new Date('2026-09-16');
const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};
const iso = (d) => d.toISOString().slice(0, 10);

const TENEDORES = [
  { nombre: 'Jorge Ramírez – Predio El Progreso', porcentaje: 50 },
  { nombre: 'Carlos Peña – Finca La Esperanza', porcentaje: 50 },
  { nombre: 'Elvia Torres – Hato Los Alcaravanes', porcentaje: 40 },
  { nombre: 'Wilson Brito – Finca Buenavista', porcentaje: 50 },
];

const LOTES = [
  {
    codigo: 'LOTE-2025-B',
    nombre: 'Lote 2025-B (Ceba – próximo a venta)',
    diasEnFinca: 240, // ~8 meses
    n: 35,
    pesoIngresoRango: [140, 175],
    pesoObjetivoRango: [320, 350],
    gdpRango: [0.65, 0.85], // ganancia diaria de peso kg/día
  },
  {
    codigo: 'LOTE-2026-A',
    nombre: 'Lote 2026-A (Ceba – mitad de ciclo)',
    diasEnFinca: 120, // ~4 meses
    n: 40,
    pesoIngresoRango: [130, 165],
    pesoObjetivoRango: [280, 320],
    gdpRango: [0.6, 0.8],
  },
  {
    codigo: 'LOTE-2026-B',
    nombre: 'Lote 2026-B (Ceba – recién ingresado)',
    diasEnFinca: 35,
    n: 30,
    pesoIngresoRango: [120, 155],
    pesoObjetivoRango: [200, 240],
    gdpRango: [0.55, 0.75],
  },
  {
    codigo: 'CRIA-2025-2026',
    nombre: 'Cría propia (levante)',
    diasEnFinca: null, // se calcula por animal (nacimientos escalonados)
    n: 35,
    pesoIngresoRango: [32, 42], // peso al nacer
    pesoObjetivoRango: [180, 220],
    gdpRango: [0.4, 0.6],
  },
];

const VACUNAS = [
  { tipo: 'Vacuna', descripcion: 'Fiebre Aftosa (ciclo semestral ICA)' },
  { tipo: 'Vacuna', descripcion: 'Brucelosis (hembras jóvenes)' },
  { tipo: 'Vacuna', descripcion: 'Carbón sintomático / Septicemia' },
  { tipo: 'Tratamiento', descripcion: 'Desparasitación interna' },
  { tipo: 'Tratamiento', descripcion: 'Baño garrapaticida' },
  { tipo: 'Tratamiento', descripcion: 'Vitaminización / minerales' },
];

let contador = 1;
const animales = [];

for (const lote of LOTES) {
  for (let i = 0; i < lote.n; i++) {
    const numeroInterno = String(100 + contador).padStart(4, '0');
    const id = `SR-${String(contador).padStart(4, '0')}`;
    const chapetaICA = `COL-CES-2${randInt(10000, 99999)}`;

    const origen = lote.codigo === 'CRIA-2025-2026' ? 'Nacimiento' : 'Compra';
    const sexo = origen === 'Nacimiento' ? pick(['Macho', 'Hembra', 'Hembra']) : 'Macho';

    const diasEnFinca = lote.diasEnFinca ?? randInt(30, 500);
    const fechaIngreso = addDays(HOY, -diasEnFinca);

    const pesoIngreso = round1(randInt(lote.pesoIngresoRango[0] * 10, lote.pesoIngresoRango[1] * 10) / 10);
    const pesoObjetivo = randInt(lote.pesoObjetivoRango[0], lote.pesoObjetivoRango[1]);
    const gdp = round1(lote.gdpRango[0] + rand() * (lote.gdpRango[1] - lote.gdpRango[0]));

    // Historial de peso: una lectura cada ~30 días desde el ingreso hasta hoy (pesaje mensual, según AS-IS).
    const pesos = [];
    let diasTranscurridos = 0;
    let pesoActual = pesoIngreso;
    while (diasTranscurridos <= diasEnFinca) {
      const ruido = (rand() - 0.5) * 6; // variación de pesaje +/- 3kg
      pesos.push({
        fecha: iso(addDays(fechaIngreso, diasTranscurridos)),
        pesoKg: round1(Math.max(pesoIngreso, pesoActual + ruido)),
      });
      diasTranscurridos += 30;
      pesoActual = pesoIngreso + gdp * diasTranscurridos;
    }
    // Asegurar una lectura reciente (últimos ~10 días) para que el dashboard se vea "vivo".
    const pesoHoy = round1(pesoIngreso + gdp * diasEnFinca + (rand() - 0.5) * 4);
    pesos.push({ fecha: iso(addDays(HOY, -randInt(2, 9))), pesoKg: Math.max(pesoIngreso, pesoHoy) });

    // Historial sanitario: 2 a 5 eventos distribuidos en la estadía del animal.
    const sanidad = [];
    const nEventos = randInt(2, 5);
    for (let e = 0; e < nEventos; e++) {
      const evento = pick(VACUNAS);
      const diasAtras = randInt(0, Math.max(1, diasEnFinca));
      sanidad.push({
        fecha: iso(addDays(HOY, -diasAtras)),
        tipo: evento.tipo,
        descripcion: evento.descripcion,
      });
    }
    // Una porción minoritaria del hato tiene una alerta de vacunación pendiente (vencida o
    // próxima); el resto está al día, para que el dashboard refleje una operación sana con
    // puntos de atención puntuales, no una crisis generalizada.
    if (rand() < 0.22) {
      const diasProxima = randInt(-10, 20);
      sanidad.push({
        fecha: null,
        tipo: 'Vacuna',
        descripcion: 'Refuerzo Fiebre Aftosa',
        proximaFecha: iso(addDays(HOY, diasProxima)),
        pendiente: true,
      });
    }
    sanidad.sort((a, b) => (a.fecha ?? a.proximaFecha).localeCompare(b.fecha ?? b.proximaFecha));

    const esAlPartir = lote.codigo !== 'CRIA-2025-2026' && rand() < 0.28;
    const tenedor = esAlPartir ? pick(TENEDORES) : null;

    const precioCompraKg = origen === 'Compra' ? randInt(5800, 6600) : 0;

    animales.push({
      id,
      numeroInterno,
      marcaFinca: 'Hierro Santa Rita (SR)',
      chapetaICA,
      sexo,
      origen,
      fechaIngreso: iso(fechaIngreso),
      pesoIngreso,
      pesoObjetivo,
      costoCompra: origen === 'Compra' ? Math.round(precioCompraKg * pesoIngreso) : null,
      lote: lote.codigo,
      loteNombre: lote.nombre,
      esquema: esAlPartir ? 'Al partir' : 'Propio',
      tenedor: tenedor?.nombre ?? null,
      porcentajeTenedor: tenedor?.porcentaje ?? null,
      estado: 'Activo',
      pesos,
      sanidad,
    });
    contador++;
  }
}

writeFileSync(
  new URL('../src/data/seedAnimals.json', import.meta.url),
  JSON.stringify(animales, null, 2),
);

console.log(`Generados ${animales.length} animales de ejemplo en src/data/seedAnimals.json`);
