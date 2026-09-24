// Integración real con el portal de Datos Abiertos de Colombia (datos.gov.co, Socrata) para
// la TRM (Tasa Representativa del Mercado, peso colombiano / dólar). Es una API pública sin
// llave. El Project Charter documenta que la revaluación del peso frente al dólar le ha
// costado a la finca ~$1.200 COP por kilo vendido, así que mostrar la TRM del día ayuda a
// contextualizar ese riesgo cambiario en el módulo de mercado.
const TRM_DATASET_URL = 'https://www.datos.gov.co/resource/32sa-8pi3.json?$limit=1&$order=vigenciadesde%20DESC';

const FALLBACK_TRM = { isFallback: true, valor: 4550, fecha: null };

export async function fetchTRM({ signal } = {}) {
  try {
    const res = await fetch(TRM_DATASET_URL, { signal });
    if (!res.ok) throw new Error(`datos.gov.co respondió ${res.status}`);
    const data = await res.json();
    const registro = data?.[0];
    if (!registro) throw new Error('Respuesta sin registros');
    return {
      isFallback: false,
      valor: Math.round(Number(registro.valor)),
      fecha: registro.vigenciadesde?.slice(0, 10) ?? null,
    };
  } catch (err) {
    console.warn('No se pudo obtener la TRM en vivo, usando valor de respaldo:', err.message);
    return FALLBACK_TRM;
  }
}
