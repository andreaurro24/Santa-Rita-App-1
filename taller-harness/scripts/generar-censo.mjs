// Genera el censo de demostración del taller (animales ficticios, nunca datos de Miguel).
// Uso: node taller-harness/scripts/generar-censo.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');

// Generador pseudoaleatorio con semilla: el censo sale igual en cada corrida.
let semilla = 20261030;
const azar = () => ((semilla = (semilla * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const entre = (a, b) => Math.round(a + azar() * (b - a));

const lotes = [
  { codigo: 'LOTE-2025-B', nombre: 'Lote 2025-B (ceba, próximo a venta)', ingreso: '2026-01-19', prefijo: '01', n: 10, peso: [300, 365], potrero: 'La Ceiba' },
  { codigo: 'LOTE-2026-A', nombre: 'Lote 2026-A (ceba, mitad de ciclo)', ingreso: '2026-05-19', prefijo: '02', n: 8, peso: [228, 285], potrero: 'El Mango' },
  { codigo: 'LOTE-2026-B', nombre: 'Lote 2026-B (ceba, recién ingresado)', ingreso: '2026-08-12', prefijo: '03', n: 6, peso: [172, 212], potrero: 'Los Cocos' },
];

const animales = [];
for (const lote of lotes) {
  for (let i = 1; i <= lote.n; i++) {
    const ultimo = entre(...lote.peso);
    animales.push({
      numero_interno: `${lote.prefijo}${String(i).padStart(2, '0')}`,
      chapeta_ica: `COL-CES-${entre(200000, 299999)}`,
      sexo: 'Macho',
      categoria: 'novillo',
      lote: lote.codigo,
      potrero: lote.potrero,
      fecha_ingreso: lote.ingreso,
      estado: 'activo',
      ultimo_pesaje: { fecha: '2026-09-28', peso_kg: ultimo },
    });
  }
}

const censo = {
  generado: 'scripts/generar-censo.mjs (datos ficticios de demostración)',
  fecha_corte: '2026-09-30',
  finca: 'Santa Rita (Badillo, Cesar)',
  lotes: lotes.map(({ codigo, nombre, ingreso, potrero }) => ({ codigo, nombre, fecha_inicio: ingreso, potrero })),
  animales,
};

const destino = join(raiz, 'contexto', 'censo-demo.json');
mkdirSync(dirname(destino), { recursive: true });
writeFileSync(destino, JSON.stringify(censo, null, 2) + '\n');

// Versión CSV para cargarla como documento de referencia en n8n o en un asistente.
const csv = ['numero_interno,chapeta_ica,lote,potrero,fecha_ingreso,ultimo_peso_kg,fecha_ultimo_peso']
  .concat(animales.map((a) => [a.numero_interno, a.chapeta_ica, a.lote, a.potrero, a.fecha_ingreso, a.ultimo_pesaje.peso_kg, a.ultimo_pesaje.fecha].join(',')))
  .join('\n');
writeFileSync(join(raiz, 'contexto', 'censo-demo.csv'), csv + '\n');
console.log(`Censo: ${animales.length} animales en ${lotes.length} lotes → ${destino}`);
