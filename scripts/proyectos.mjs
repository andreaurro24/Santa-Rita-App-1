// Spec 014 · R2: proyectos de Supabase y guarda contra escribir datos de prueba en producción.
//
// Producción (la app publicada en Vercel y los datos reales de Miguel) es el proyecto
// `eiszvbwwpqcqognkcfew`. El script de datos de ejemplo y la suite E2E borran y crean datos, así
// que solo pueden correr contra un proyecto de PRUEBAS, que se configura en .env.local/.env.test
// y se declara en PROYECTO_PRUEBAS (ver DEPLOY.md).
export const PROYECTO_PRODUCCION = 'eiszvbwwpqcqognkcfew';

export function refDe(url) {
  return new URL(url).hostname.split('.')[0];
}

// Lanza un error si `url` apunta a producción, o a un proyecto distinto del declarado en
// PROYECTO_PRUEBAS. `que` dice qué se iba a hacer, para el mensaje.
export function exigirProyectoDePruebas(url, que) {
  if (!url) throw new Error('Falta VITE_SUPABASE_URL (ver .env.example).');
  const ref = refDe(url);
  if (ref === PROYECTO_PRODUCCION) {
    throw new Error(
      `${que} no puede correr contra PRODUCCIÓN (${PROYECTO_PRODUCCION}): borraría o mezclaría datos reales de la finca. ` +
        'Configura un proyecto de pruebas en .env.local y .env.test y declara PROYECTO_PRUEBAS (ver DEPLOY.md).',
    );
  }
  const declarado = process.env.PROYECTO_PRUEBAS;
  if (!declarado) throw new Error(`${que}: declara PROYECTO_PRUEBAS=<ref del proyecto de pruebas> en .env.test (ver DEPLOY.md).`);
  if (ref !== declarado) throw new Error(`${que}: la URL (${ref}) no es el proyecto de pruebas declarado (${declarado}).`);
}
