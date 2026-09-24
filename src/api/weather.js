// Integración real con Open-Meteo (https://open-meteo.com) — API pública, gratuita y sin
// necesidad de API key, pensada para uso no comercial. Se usa aquí para el pronóstico de
// Badillo, Cesar, una de las variables externas que el Project Charter pide integrar
// (Cap. 1.3.2 y 5.3.1) para apoyar la decisión de venta ante riesgos climáticos (El Niño).

import { UBICACION_FINCA } from '../data/seedMercado';

const WEATHER_CODE_LABELS = {
  0: 'Despejado',
  1: 'Mayormente despejado',
  2: 'Parcialmente nublado',
  3: 'Nublado',
  45: 'Niebla',
  48: 'Niebla con escarcha',
  51: 'Llovizna ligera',
  53: 'Llovizna moderada',
  55: 'Llovizna densa',
  61: 'Lluvia ligera',
  63: 'Lluvia moderada',
  65: 'Lluvia fuerte',
  80: 'Chubascos ligeros',
  81: 'Chubascos moderados',
  82: 'Chubascos fuertes',
  95: 'Tormenta eléctrica',
};

export function describeWeatherCode(code) {
  return WEATHER_CODE_LABELS[code] ?? 'Condición desconocida';
}

const FALLBACK_WEATHER = {
  isFallback: true,
  actual: { temperaturaC: 33, precipitacionMm: 0, codigo: 1 },
  diario: Array.from({ length: 7 }).map((_, i) => ({
    fecha: new Date(Date.now() + i * 86400000).toISOString().slice(0, 10),
    tempMaxC: 33 - (i % 3),
    tempMinC: 22,
    precipitacionMm: i === 3 || i === 4 ? 4 : 0,
  })),
  resumenLluvia7d: 4,
};

export async function fetchClimaFinca({ signal } = {}) {
  const { latitud, longitud } = UBICACION_FINCA;
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', latitud);
  url.searchParams.set('longitude', longitud);
  url.searchParams.set('current', 'temperature_2m,precipitation,weather_code');
  url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code');
  url.searchParams.set('timezone', 'America/Bogota');
  url.searchParams.set('forecast_days', '7');

  try {
    const res = await fetch(url.toString(), { signal });
    if (!res.ok) throw new Error(`Open-Meteo respondió ${res.status}`);
    const data = await res.json();

    const diario = data.daily.time.map((fecha, i) => ({
      fecha,
      tempMaxC: data.daily.temperature_2m_max[i],
      tempMinC: data.daily.temperature_2m_min[i],
      precipitacionMm: data.daily.precipitation_sum[i],
      codigo: data.daily.weather_code[i],
    }));

    return {
      isFallback: false,
      actual: {
        temperaturaC: data.current.temperature_2m,
        precipitacionMm: data.current.precipitation,
        codigo: data.current.weather_code,
      },
      diario,
      resumenLluvia7d: round1(diario.reduce((acc, d) => acc + (d.precipitacionMm || 0), 0)),
    };
  } catch (err) {
    console.warn('No se pudo obtener el clima en vivo, usando datos de respaldo:', err.message);
    return FALLBACK_WEATHER;
  }
}

function round1(n) {
  return Math.round(n * 10) / 10;
}
