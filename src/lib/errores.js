// Traduce errores de Supabase/Postgres a mensajes que le dicen al usuario qué hacer (R5, R7).
export function mensajeError(error) {
  if (!error) return null;
  const detalle = `${error.message ?? ''} ${error.details ?? ''}`;

  if (error.code === '23505') {
    if (detalle.includes('numero_interno')) return 'Ya existe un animal con ese número interno. Revisa el número o busca el animal en el hato.';
    if (detalle.includes('chapeta_ica')) return 'Ya existe un animal con esa chapeta ICA. Revisa la chapeta o busca el animal en el hato.';
    if (detalle.includes('precios_mercado')) return 'Ya hay un precio registrado para esa fecha y fuente. Cambia la fecha.';
    return 'Ese registro ya existe. Revisa los datos e inténtalo de nuevo.';
  }
  if (error.code === '23514' && detalle.includes('categoria_sexo')) return 'La categoría no corresponde al sexo: vientre y ternera son hembras; novillo, ternero y reproductor son machos.';
  if (error.code === '23514' && detalle.includes('fecha_futura')) return 'La fecha no puede ser futura. Revisa la fecha e inténtalo de nuevo.';
  if (error.code === '23514') return 'Algún valor está fuera del rango permitido (por ejemplo, un peso o un precio en cero o negativo). Corrígelo e inténtalo de nuevo.';
  if (error.code === '42501' || error.status === 401 || error.status === 403) {
    return 'Tu sesión no tiene permiso para esta acción. Cierra sesión y vuelve a entrar; si sigue pasando, pide acceso al dueño.';
  }
  if (error.message === 'Invalid login credentials') return 'Correo o contraseña incorrectos.';
  if (error.name === 'TypeError' || /fetch|network/i.test(error.message ?? '')) {
    return 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.';
  }
  return `Ocurrió un error inesperado (${error.message ?? 'sin detalle'}). Inténtalo de nuevo en un momento.`;
}
