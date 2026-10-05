// Spec 016 · categorías, especies y reglas de los animales. Funciones puras.

// R5: tres tipos de vientre ("fábrica"); ninguno se vende (D2).
export const CATEGORIAS_BOVINO = {
  Macho: [
    { valor: 'novillo', label: 'Novillo' },
    { valor: 'ternero', label: 'Ternero' },
    { valor: 'reproductor', label: 'Reproductor (toro)' },
  ],
  Hembra: [
    { valor: 'ternera', label: 'Ternera' },
    { valor: 'vientre_menor', label: 'Vientre menor (no se vende)' },
    { valor: 'vientre_mayor', label: 'Vientre mayor (no se vende)' },
    { valor: 'vientre_parida', label: 'Vientre parida (no se vende)' },
  ],
};

// R8: caballos.
export const CATEGORIAS_EQUINO = {
  Macho: [
    { valor: 'caballo', label: 'Caballo' },
    { valor: 'potro', label: 'Potro' },
  ],
  Hembra: [
    { valor: 'yegua', label: 'Yegua' },
    { valor: 'potranca', label: 'Potranca' },
  ],
};

const ETIQUETAS = Object.fromEntries(
  [...Object.values(CATEGORIAS_BOVINO), ...Object.values(CATEGORIAS_EQUINO)].flat().map((c) => [c.valor, c.label.replace(' (no se vende)', '')]),
);

export function etiquetaCategoria(categoria) {
  return ETIQUETAS[categoria] ?? categoria;
}

export function esVientre(categoria) {
  return typeof categoria === 'string' && categoria.startsWith('vientre');
}

// R6: el peso objetivo no se pide para los vientres (no se venden).
export function pidePesoObjetivo(categoria) {
  return !esVientre(categoria);
}

// R7: precio de compra por kilo ↔ total por animal (redondeado a pesos).
export function totalDesdeKilo(precioKg, pesoKg) {
  if (!(precioKg > 0) || !(pesoKg > 0)) return null;
  return Math.round(precioKg * pesoKg);
}

export function kiloDesdeTotal(total, pesoKg) {
  if (!(total > 0) || !(pesoKg > 0)) return null;
  return Math.round(total / pesoKg);
}

// R4: dueños que ya existen (para sugerirlos), sin repetir mayúsculas ni espacios.
export function duenosExistentes(animales) {
  const vistos = new Map();
  for (const a of animales) {
    const d = a.dueno?.trim();
    if (d && !vistos.has(d.toLowerCase())) vistos.set(d.toLowerCase(), d);
  }
  return [...vistos.values()].sort((x, y) => x.localeCompare(y, 'es'));
}

// Spec 023 · R2: razas más comunes en Colombia (el 95 % del hato tiene genética cebuina; en el
// Cesar predominan Brahman, Gyr y sus cruces con Pardo Suizo). También se puede escribir otra.
export const RAZAS_BOVINO = [
  'Brahman',
  'Cebú comercial',
  'Gyr',
  'Guzerá',
  'Nelore',
  'Gyrolando',
  'Pardo Suizo',
  'Holstein',
  'Simmental',
  'Simbrah',
  'Angus',
  'Brangus',
  'Romosinuano',
  'Costeño con Cuernos',
  'Blanco Orejinegro (BON)',
  'Normando',
  'Cruzado (mestizo)',
];
export const RAZAS_EQUINO = ['Criollo colombiano', 'Cuarto de milla', 'Paso fino', 'Mestizo'];

// Spec 023 · R1: el número del nombre es un consecutivo de toda la finca ("Luna-042").
const NUMERO_FINAL = /-(\d+)\s*$/;

export function siguienteNumero(animales) {
  let mayor = 0;
  for (const a of animales) {
    const m = String(a.numeroInterno ?? '').match(NUMERO_FINAL);
    if (m) mayor = Math.max(mayor, Number(m[1]));
  }
  return mayor + 1;
}

// Devuelve el nombre sugerido, o null si ya trae número o está vacío.
export function sugerirNombre(texto, animales) {
  const base = String(texto ?? '').trim().replace(/-+$/, '').trim();
  if (!base || /\d$/.test(base)) return null;
  return `${base}-${String(siguienteNumero(animales)).padStart(3, '0')}`;
}

// Spec 023 · R3: nacimiento por mes y año. `fecha_nacimiento` guarda el día 1 del mes, o el 1 de
// enero si no se sabe el mes (con `nacimiento_mes_conocido = false`).
export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export function nacimientoDesdeMesAnio(mes, anio) {
  if (!anio) return { fechaNacimiento: null, nacimientoMesConocido: null };
  const conocido = Boolean(mes);
  return { fechaNacimiento: `${anio}-${String(conocido ? mes : 1).padStart(2, '0')}-01`, nacimientoMesConocido: conocido };
}

export function mesAnioDesdeNacimiento(fecha, mesConocido) {
  if (!fecha) return { mes: '', anio: '' };
  const [anio, mes] = fecha.split('-');
  return { mes: mesConocido === false ? '' : String(Number(mes)), anio };
}

// Problema del mes y año elegidos, o null. `hoy` en ISO.
export function problemaNacimiento(mes, anio, hoy) {
  if (!anio) return mes ? 'Elige también el año de nacimiento.' : null;
  const [anioHoy, mesHoy] = hoy.split('-').map(Number);
  if (Number(anio) < 2000) return 'El año de nacimiento no puede ser anterior al 2000.';
  if (Number(anio) > anioHoy || (Number(anio) === anioHoy && mes && Number(mes) > mesHoy)) return 'El nacimiento no puede ser en el futuro.';
  return null;
}

export function edadEnMeses(fecha, hoy) {
  if (!fecha) return null;
  const [a1, m1] = fecha.split('-').map(Number);
  const [a2, m2] = hoy.split('-').map(Number);
  return Math.max(0, (a2 - a1) * 12 + (m2 - m1));
}

export function textoNacimiento(fecha, mesConocido, hoy) {
  if (!fecha) return null;
  const [anio, mes] = fecha.split('-').map(Number);
  const cuando = mesConocido === false ? `Nació en ${anio}` : `Nació en ${MESES[mes - 1]} de ${anio}`;
  const meses = edadEnMeses(fecha, hoy);
  const edad = meses < 24 ? `${meses} ${meses === 1 ? 'mes' : 'meses'}` : `${Math.floor(meses / 12)} años`;
  return `${cuando} (${mesConocido === false ? 'unos ' : ''}${edad})`;
}

// Spec 023 · R6: la cuenta de la compra, para mostrarla. `formato` pone los puntos de miles.
// Devuelve { calculado, cuenta } o { falta } con lo que hace falta escribir.
export function cuentaCompra({ modo, precioKg, total, peso }, formato) {
  const kg = Number(peso);
  if (!(kg > 0)) return { falta: 'Escribe el peso inicial para ver la cuenta.' };
  const kgTexto = `${formato(kg)} kg`;
  if (modo === 'kilo') {
    const calculado = totalDesdeKilo(precioKg, kg);
    if (!calculado) return { falta: 'Escribe el precio por kilo para ver el total.' };
    return { calculado, cuenta: `$${formato(precioKg)} × ${kgTexto} = $${formato(calculado)} por animal` };
  }
  const calculado = kiloDesdeTotal(total, kg);
  if (!calculado) return { falta: 'Escribe el precio del animal para ver el precio por kilo.' };
  return { calculado, cuenta: `$${formato(total)} ÷ ${kgTexto} = $${formato(calculado)} por kilo` };
}
