import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Spec 002 · R1: ningún componente ni página usa colores hexadecimales sueltos ni la paleta
// cruda de Tailwind (red-, green-, amber-, blue-): todo sale de los tokens de index.css.

function archivos(dir) {
  return readdirSync(dir).flatMap((n) => {
    const ruta = join(dir, n);
    return statSync(ruta).isDirectory() ? archivos(ruta) : ruta.endsWith('.jsx') ? [ruta] : [];
  });
}

const fuentes = [...archivos('src/components'), ...archivos('src/pages')];

describe('tokens de diseño', () => {
  it('hay archivos que revisar', () => {
    expect(fuentes.length).toBeGreaterThan(10);
  });

  it.each(fuentes)('%s no tiene colores hexadecimales ni paleta cruda', (ruta) => {
    const codigo = readFileSync(ruta, 'utf8');
    expect(codigo.match(/#[0-9a-fA-F]{6}\b/g) ?? []).toEqual([]);
    expect(codigo.match(/\b(?:bg|text|border|ring)-(?:red|green|amber|blue|yellow)-\d+/g) ?? []).toEqual([]);
  });
});
