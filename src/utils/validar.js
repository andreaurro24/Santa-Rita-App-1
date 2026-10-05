// Spec 018 · R2: nombres y textos cortos solo con letras (tildes y ñ), números, espacios y
// . , - – ' ( ) # /. La misma regla vive en la base de datos (private.texto_valido).
const PERMITIDOS = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 .,'()#/–-]+$/;

export function nombreValido(texto, maximo = 80) {
  const t = String(texto ?? '').trim();
  return t.length > 0 && t.length <= maximo && PERMITIDOS.test(t);
}

// Mensaje para el formulario, o '' si el texto es válido. `opcional`: vacío está bien.
export function mensajeNombre(texto, campo, { maximo = 80, opcional = false } = {}) {
  const t = String(texto ?? '').trim();
  if (!t) return opcional ? '' : `Escribe ${campo}.`;
  if (t.length > maximo) return `${capitalizar(campo)} puede tener hasta ${maximo} caracteres.`;
  if (!PERMITIDOS.test(t)) return `${capitalizar(campo)} solo puede tener letras, números, espacios y . , - ' ( ) # /`;
  return '';
}

const capitalizar = (s) => s.replace(/^(el |la |los |las )/, '').replace(/^./, (c) => c.toUpperCase());

// R1: texto con puntos de miles → entero (o null si está vacío). "1.250.000" → 1250000.
export function pesosANumero(texto) {
  const digitos = String(texto ?? '').replace(/\D/g, '');
  return digitos ? Number(digitos) : null;
}

// R1: entero → "1.250.000" (sin signo de pesos), para mostrar mientras se escribe.
export function numeroAPesos(n) {
  if (n == null || n === '') return '';
  const digitos = String(n).replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  return digitos.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// Verificación Sprint 05 (M1): lo que no es un monto entero (centavos "12,50", decimales
// "1500000.5", signos "-1", letras "1e6") no se convierte en silencio: se rechaza con un aviso
// y el valor queda como estaba.
export function entradaPesosInvalida(nuevo, anterior) {
  if (/[^\d.\s$]/.test(nuevo)) return true; // coma, signo, letras
  const limpio = nuevo.replace(/[\s$]/g, '');
  const borrando = limpio.replace(/\D/g, '').length < String(anterior ?? '').replace(/\D/g, '').length;
  // Un punto seguido de 0 a 2 dígitos al final es un decimal (al borrar es solo reacomodo de miles).
  return !borrando && /\.\d{0,2}$/.test(limpio);
}
