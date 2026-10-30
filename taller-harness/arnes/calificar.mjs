// Califica el resultado del arnés contra la respuesta correcta de un caso (casos/casos.json).
// Lo usan las pruebas y la bitácora del ciclo de dirección.

// Lo que un extractor perfecto habría devuelto para el caso. Sirve de referencia en las pruebas.
export function extraccionIdeal(caso) {
  if (caso.id === 'caso-8') {
    return {
      tipo_reporte: 'sanidad', fecha_reporte: caso.esperado.fecha, lote: 'LOTE-2026-A',
      registros: [
        { numero_interno: null, chapeta: null, alcance_lote: 'LOTE-2026-A', peso_kg: null, evento_sanitario: { tipo: 'desparasitacion', descripcion: 'Ivermectina' }, confianza: 'alta', texto_original: 'El lunes purgamos con ivermectina a los de El Mango' },
        { numero_interno: '0204', chapeta: null, alcance_lote: null, peso_kg: null, evento_sanitario: { tipo: 'tratamiento', descripcion: 'Oxitetraciclina' }, confianza: 'alta', texto_original: 'a la 204 le pusimos oxitetraciclina' },
      ],
      ilegibles: [],
    };
  }
  if (caso.entrada === 'texto') {
    return {
      tipo_reporte: 'sanidad',
      fecha_reporte: caso.esperado.fecha,
      lote: 'LOTE-2026-B',
      registros: [{
        numero_interno: null, chapeta: null, alcance_lote: 'LOTE-2026-B', peso_kg: null,
        evento_sanitario: { tipo: 'vacuna', descripcion: 'Aftosa' }, confianza: 'alta', texto_original: caso.texto,
      }],
      ilegibles: [],
    };
  }
  const p = caso.planilla;
  const [d, m, a] = p.fecha.split('/');
  const registros = [];
  const ilegibles = [];
  p.filas.forEach(([numero, peso], i) => {
    if (p.fila_borrosa === i) ilegibles.push({ texto_original: '??? ???', motivo: 'fila manchada' });
    else if (p.columna_id === 'Chapeta') registros.push({ numero_interno: null, chapeta: numero, alcance_lote: null, peso_kg: Number(peso), evento_sanitario: null, confianza: 'alta', texto_original: `${numero} ${peso}` });
    else registros.push({ numero_interno: numero.padStart(4, '0'), chapeta: null, alcance_lote: null, peso_kg: Number(peso), evento_sanitario: null, confianza: 'alta', texto_original: `${numero} ${peso}` });
  });
  return { tipo_reporte: 'pesaje', fecha_reporte: `${a}-${m}-${d}`, lote: p.lote, registros, ilegibles };
}

// Devuelve { correcto, correcciones, erroresGraves, detalle[] } según los criterios de "terminado".
export function calificar(caso, resultado, censo) {
  const esp = caso.esperado;
  const detalle = [];
  let erroresGraves = 0;

  // Pares (número, peso) que de verdad están escritos y se pueden leer en la planilla.
  const leibles = new Map();
  if (caso.planilla) {
    caso.planilla.filas.forEach(([n, peso], i) => {
      if (caso.planilla.fila_borrosa === i) return;
      const k = caso.ids_censo ? caso.ids_censo[i] : n.padStart(4, '0');
      leibles.set(k, [...(leibles.get(k) ?? []), Number(peso)]);
    });
  }

  if (resultado.fecha_reporte !== esp.fecha) detalle.push(`fecha ${resultado.fecha_reporte} en vez de ${esp.fecha}`);

  // Peor error: peso en la res equivocada o inventado, entre los registros que pasarían a la app.
  for (const v of resultado.validos) {
    if (caso.planilla) {
      const pesos = leibles.get(v.numero_interno);
      if (!pesos || !pesos.includes(v.peso_kg)) {
        erroresGraves++;
        detalle.push(`ERROR GRAVE: ${v.numero_interno} con ${v.peso_kg} kg no está así en la planilla`);
      }
    } else {
      const loteEsperado = esp.lote_esperado ?? 'LOTE-2026-B';
      const delLote = censo.animales.filter((a) => a.lote === loteEsperado).map((a) => a.numero_interno);
      if (!delLote.includes(v.numero_interno)) { erroresGraves++; detalle.push(`ERROR GRAVE: evento para ${v.numero_interno}, que no es del lote`); }
    }
  }
  for (const n of esp.prohibido ?? []) {
    const inventado = [...resultado.validos, ...resultado.dudosos].find((r) => r.numero_interno === n);
    if (inventado) { erroresGraves++; detalle.push(`ERROR GRAVE: inventó la fila ilegible (${n}, ${inventado.peso_kg} kg)`); }
  }

  const validos = new Set(resultado.validos.map((v) => v.numero_interno));
  for (const n of esp.validos) if (!validos.has(n)) detalle.push(`faltó ${n} en válidos`);
  for (const n of validos) if (!esp.validos.includes(n)) detalle.push(`${n} quedó válido y no debía`);

  for (const [n, regla] of Object.entries(esp.dudosos)) {
    const d = resultado.dudosos.find((x) => x.numero_interno === n);
    if (!d) detalle.push(`${n} debía quedar dudoso por ${regla}`);
    else if (!d.motivos?.some((m) => m.regla === regla)) detalle.push(`${n} quedó dudoso pero no por ${regla}`);
  }
  if (resultado.ilegibles.length !== esp.ilegibles) detalle.push(`${resultado.ilegibles.length} ilegibles en vez de ${esp.ilegibles}`);
  if (esp.evento && resultado.validos.some((v) => v.evento_sanitario?.tipo !== esp.evento.tipo)) detalle.push(`tipo sanitario distinto de ${esp.evento.tipo}`);
  if (esp.eventos_esperados && resultado.validos.length !== esp.eventos_esperados) detalle.push(`${resultado.validos.length} eventos válidos en vez de ${esp.eventos_esperados}`);

  const correcciones = detalle.filter((d) => !d.startsWith('ERROR GRAVE')).length;
  return { correcto: detalle.length === 0, correcciones, erroresGraves, detalle };
}
