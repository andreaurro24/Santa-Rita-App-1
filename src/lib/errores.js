// Traduce errores de Supabase/Postgres a mensajes que le dicen al usuario qué hacer (R5, R7).
export function mensajeError(error) {
  if (!error) return null;
  const detalle = `${error.message ?? ''} ${error.details ?? ''}`;

  if (error.code === '23505') {
    if (detalle.includes('numero_interno')) return 'Ya existe un animal con ese número interno. Revisa el número o busca el animal en el hato.';
    if (detalle.includes('chapeta_ica')) return 'Ya existe un animal con esa chapeta ICA. Revisa la chapeta o busca el animal en el hato.';
    if (detalle.includes('lotes_codigo_key')) return 'Ya existe un lote con ese código. Usa otro código.';
    if (detalle.includes('potreros_finca_id_nombre_key') || detalle.includes('potreros_nombre_normalizado_key')) return 'Esa finca ya tiene un potrero con ese nombre.';
    if (detalle.includes('pesajes_uno_por_jornada')) return 'Este animal ya se pesó en esta jornada.';
    if (detalle.includes('precios_mercado')) return 'Ya hay un precio registrado para esa fecha y fuente. Cambia la fecha.';
    return 'Ese registro ya existe. Revisa los datos e inténtalo de nuevo.';
  }
  if (error.code === '23514' && detalle.includes('categoria_sexo')) return 'La categoría no corresponde al sexo: vientre y ternera son hembras; novillo, ternero y reproductor son machos.';
  if (error.code === '23514' && /_fecha(_\w+)?_check|_razonable/.test(detalle)) return 'La fecha no es válida: revisa el año (debe ser del 2000 en adelante).';
  if (error.code === '23514' && detalle.includes('fecha_futura')) return 'La fecha no puede ser futura. Revisa la fecha e inténtalo de nuevo.';
  // Errores de reglas escritos en las funciones SQL como 'codigo: explicación'.
  const regla = /^[a-z_]+: (.+)$/.exec(error.message ?? '');
  if (error.code === '23514' && regla) return `${regla[1][0].toUpperCase()}${regla[1].slice(1)}.`;
  if (error.code === '23514') return 'Algún valor está fuera del rango permitido (por ejemplo, un peso o un precio en cero o negativo). Corrígelo e inténtalo de nuevo.';
  if (error.code === '42501' || error.status === 401 || error.status === 403) {
    return 'Tu sesión no tiene permiso para esta acción. Cierra sesión y vuelve a entrar; si sigue pasando, pide acceso al dueño.';
  }
  if (error.code === '22003' || /out of range|overflow/i.test(detalle)) return 'El número es demasiado grande o no es válido. Revísalo.';
  if (error.code === '22P02') return 'Un valor no tiene el formato esperado (por ejemplo, un número con decimales donde van pesos enteros).';
  if (error.message === 'Invalid login credentials') return 'Correo o contraseña incorrectos.';
  if (error.name === 'TypeError' || /fetch|network/i.test(error.message ?? '')) {
    return 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.';
  }
  return `Ocurrió un error inesperado (${error.message ?? 'sin detalle'}). Inténtalo de nuevo en un momento.`;
}
