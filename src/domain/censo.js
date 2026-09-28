// Spec 013 · lectura y validación del censo en CSV (M13). Funciones puras, sin dependencias.

export const COLUMNAS = [
  { clave: 'numeroInterno', encabezado: 'numero_interno', obligatoria: true },
  { clave: 'chapetaICA', encabezado: 'chapeta_ica', obligatoria: true },
  { clave: 'sexo', encabezado: 'sexo', obligatoria: true },
  { clave: 'categoria', encabezado: 'categoria', obligatoria: true },
  { clave: 'lote', encabezado: 'lote', obligatoria: true },
  { clave: 'fechaIngreso', encabezado: 'fecha_ingreso', obligatoria: true },
  { clave: 'pesoIngreso', encabezado: 'peso_ingreso_kg', obligatoria: true },
  { clave: 'pesoObjetivo', encabezado: 'peso_objetivo_kg', obligatoria: true },
  { clave: 'costoCompra', encabezado: 'costo_compra_cop', obligatoria: false },
];

export const PLANTILLA_CSV =
  COLUMNAS.map((c) => c.encabezado).join(';') + '\n' + '0301;COL-CES-123456;Macho;novillo;LOTE-2026-A;15/09/2026;210,5;350;1250000\n';

const CATEGORIAS = { Macho: ['novillo', 'ternero', 'reproductor'], Hembra: ['ternera', 'vientre'] };

// Separa una línea respetando comillas dobles ("a;b" es un solo campo; "" es una comilla).
function partirLinea(linea, sep) {
  const campos = [];
  let actual = '';
  let enComillas = false;
  for (let i = 0; i < linea.length; i++) {
    const ch = linea[i];
    if (enComillas) {
      if (ch === '"' && linea[i + 1] === '"') {
        actual += '"';
        i++;
      } else if (ch === '"') enComillas = false;
      else actual += ch;
    } else if (ch === '"') enComillas = true;
    else if (ch === sep) {
      campos.push(actual);
      actual = '';
    } else actual += ch;
  }
  campos.push(actual);
  return campos.map((c) => c.trim());
}

const normalizar = (s) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

// R1: devuelve { filas: [{ linea, datos }], error } con las claves de COLUMNAS.
export function parsearCSV(texto) {
  const limpio = texto.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const lineas = limpio.split('\n').filter((l) => l.trim() !== '');
  if (lineas.length < 2) return { filas: [], error: 'El archivo no tiene filas de datos debajo de los encabezados.' };
  const sep = (lineas[0].match(/;/g) ?? []).length >= (lineas[0].match(/,/g) ?? []).length ? ';' : ',';
  const encabezados = partirLinea(lineas[0], sep).map(normalizar);
  const faltan = COLUMNAS.filter((c) => c.obligatoria && !encabezados.includes(c.encabezado)).map((c) => c.encabezado);
  if (faltan.length) return { filas: [], error: `Faltan columnas: ${faltan.join(', ')}. Descarga la plantilla para ver el formato.` };
  const filas = lineas.slice(1).map((linea, i) => {
    const valores = partirLinea(linea, sep);
    const datos = {};
    for (const c of COLUMNAS) {
      const idx = encabezados.indexOf(c.encabezado);
      datos[c.clave] = idx === -1 ? '' : (valores[idx] ?? '');
    }
    return { linea: i + 2, datos };
  });
  return { filas, error: null };
}

// "15/09/2026" o "2026-09-15" → "2026-09-15"; null si no es una fecha real.
export function leerFecha(texto) {
  let y;
  let m;
  let d;
  let r = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(texto);
  if (r) [, y, m, d] = r.map(Number);
  else if ((r = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(texto))) [, d, m, y] = r.map(Number);
  else return null;
  const f = new Date(Date.UTC(y, m - 1, d));
  if (f.getUTCFullYear() !== y || f.getUTCMonth() !== m - 1 || f.getUTCDate() !== d) return null;
  return f.toISOString().slice(0, 10);
}

// "1.250.000" o "210,5" → número; null si no es número. En pesos, la coma es el decimal.
export function leerNumero(texto, { entero = false } = {}) {
  if (texto === '' || texto == null) return null;
  const t = entero ? texto.replace(/[.\s$]/g, '') : texto.replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}

const capital = (s) => (s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s);

// R2: valida cada fila contra sí misma, contra el archivo y contra el hato.
// contexto: { hoy, lotes: [{ id, codigo }], existentes: { numeros: Set, chapetas: Set } }
export function validarFilas(filas, { hoy, lotes, existentes }) {
  const vistos = { numeros: new Map(), chapetas: new Map() };
  return filas.map(({ linea, datos }) => {
    const errores = [];
    for (const c of COLUMNAS) if (c.obligatoria && !String(datos[c.clave]).trim()) errores.push(`Falta ${c.encabezado}.`);

    const numero = datos.numeroInterno.trim();
    const chapeta = datos.chapetaICA.trim().toUpperCase();
    const sexo = capital(datos.sexo.trim());
    const categoria = datos.categoria.trim().toLowerCase();
    const lote = lotes.find((l) => l.codigo.toUpperCase() === datos.lote.trim().toUpperCase());
    const fecha = leerFecha(datos.fechaIngreso.trim());
    const pesoIngreso = leerNumero(datos.pesoIngreso);
    const pesoObjetivo = leerNumero(datos.pesoObjetivo);
    const costo = leerNumero(datos.costoCompra, { entero: true });

    if (numero) {
      if (existentes.numeros.has(numero.toUpperCase())) errores.push(`El número interno ${numero} ya existe en el hato.`);
      if (vistos.numeros.has(numero.toUpperCase())) errores.push(`El número interno ${numero} se repite en la fila ${vistos.numeros.get(numero.toUpperCase())}.`);
      else vistos.numeros.set(numero.toUpperCase(), linea);
    }
    if (chapeta) {
      if (existentes.chapetas.has(chapeta)) errores.push(`La chapeta ${chapeta} ya existe en el hato.`);
      if (vistos.chapetas.has(chapeta)) errores.push(`La chapeta ${chapeta} se repite en la fila ${vistos.chapetas.get(chapeta)}.`);
      else vistos.chapetas.set(chapeta, linea);
    }
    if (datos.sexo && !CATEGORIAS[sexo]) errores.push('El sexo debe ser Macho o Hembra.');
    else if (datos.categoria && !CATEGORIAS[sexo]?.includes(categoria)) errores.push(`La categoría "${datos.categoria}" no corresponde a ${sexo}.`);
    if (datos.lote && !lote) errores.push(`No existe el lote ${datos.lote}.`);
    if (datos.fechaIngreso && !fecha) errores.push(`La fecha "${datos.fechaIngreso}" no es válida (usa dd/mm/aaaa).`);
    else if (fecha && fecha > hoy) errores.push('La fecha de ingreso no puede ser futura.');
    else if (fecha && fecha < '2000-01-01') errores.push('La fecha de ingreso es anterior al año 2000.');
    if (datos.pesoIngreso && !(pesoIngreso > 0 && pesoIngreso < 1500)) errores.push('El peso de ingreso debe estar entre 0,1 y 1.499 kg.');
    if (datos.pesoObjetivo && !(pesoObjetivo > 0 && pesoObjetivo < 1500)) errores.push('El peso objetivo debe estar entre 0,1 y 1.499 kg.');
    if (pesoIngreso && pesoObjetivo && pesoObjetivo <= pesoIngreso) errores.push('El peso objetivo debe ser mayor que el de ingreso.');
    if (datos.costoCompra && !(Number.isInteger(costo) && costo >= 0)) errores.push('El costo de compra debe ser un número entero de pesos.');

    return {
      linea,
      errores,
      animal: errores.length
        ? null
        : {
            numeroInterno: numero,
            chapetaICA: chapeta,
            sexo,
            categoria,
            loteId: lote.id,
            fechaIngreso: fecha,
            pesoIngreso: Math.round(pesoIngreso * 10) / 10,
            pesoObjetivo: Math.round(pesoObjetivo * 10) / 10,
            costoCompra: costo,
          },
    };
  });
}
