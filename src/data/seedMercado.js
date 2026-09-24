// Datos de referencia de precio del kilo en pie (ganado gordo, novillo).
//
// El Capítulo 4 del proyecto documenta que SIPSA (DANE) y Fedegán publican boletines
// de precios, pero NO exponen una API pública formal para consumo automático. Por eso,
// a diferencia del clima (que sí se integra en vivo contra Open-Meteo), el precio se
// modela aquí como una serie de referencia pre-cargada con valores publicados por
// Fedegán/Bolsa Mercantil de Colombia para 2026, que el dueño o el administrador pueden
// actualizar manualmente desde el módulo "Mercado y clima" cuando consulten un nuevo
// boletín — tal como lo hacen hoy de forma manual, pero ahora queda centralizado.
export const PRECIO_KILO_EN_PIE_HISTORICO = [
  { fecha: '2026-01-19', precioCOP: 7977, fuente: 'Fedegán / Bolsa Mercantil de Colombia' },
  { fecha: '2026-02-16', precioCOP: 7860, fuente: 'Fedegán / Bolsa Mercantil de Colombia' },
  { fecha: '2026-03-16', precioCOP: 7910, fuente: 'Fedegán / Bolsa Mercantil de Colombia' },
  { fecha: '2026-04-13', precioCOP: 8025, fuente: 'Fedegán / Bolsa Mercantil de Colombia' },
  { fecha: '2026-05-11', precioCOP: 8140, fuente: 'Fedegán / Bolsa Mercantil de Colombia' },
  { fecha: '2026-06-08', precioCOP: 8210, fuente: 'Fedegán / Bolsa Mercantil de Colombia' },
  { fecha: '2026-07-06', precioCOP: 8330, fuente: 'Fedegán / Bolsa Mercantil de Colombia' },
  { fecha: '2026-08-10', precioCOP: 8455, fuente: 'Fedegán / Bolsa Mercantil de Colombia' },
  { fecha: '2026-09-07', precioCOP: 8520, fuente: 'Fedegán / Bolsa Mercantil de Colombia' },
];

export const UBICACION_FINCA = {
  nombre: 'Badillo, Cesar (corregimiento de La Jagua de Ibirico)',
  latitud: 9.5667,
  longitud: -73.3333,
};

// Pérdida histórica documentada en el Project Charter (Cap. 1.2), usada como referencia
// en el dashboard para contextualizar el riesgo cambiario.
export const PERDIDA_REVALUACION_COP_POR_KG = 1200;
