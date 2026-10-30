// Validador del arnés: reglas fijas, sin IA. Mismo resultado siempre.
// Las reglas V1..V10 están en contexto/reglas.md.
// Este archivo no importa nada a propósito: scripts/generar-n8n.mjs lo copia tal cual dentro
// del nodo Code de n8n, así la versión de Claude Code y la de Telegram usan el mismo código.

export const UMBRAL_VARIACION = 0.15; // RN-01, igual que variacionSospechosa en src/domain/gdp.js
export const PESO_MIN_KG = 80; // V7
export const PESO_MAX_KG = 800; // V7
export const TIPOS_SANIDAD = ['vacuna', 'tratamiento', 'desparasitacion']; // V9

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

// Revisa la forma del JSON del extractor. Si hay errores, el orquestador reintenta (máximo 2).
export function revisarFormato(borrador) {
  const errores = [];
  if (!borrador || typeof borrador !== 'object' || Array.isArray(borrador)) return ['la salida no es un objeto JSON'];
  if (!['pesaje', 'sanidad', 'otro'].includes(borrador.tipo_reporte)) errores.push('tipo_reporte inválido');
  if (!FECHA_ISO.test(String(borrador.fecha_reporte ?? ''))) errores.push('fecha_reporte no tiene formato AAAA-MM-DD');
  if (!Array.isArray(borrador.registros)) errores.push('falta la lista registros');
  if (!Array.isArray(borrador.ilegibles)) errores.push('falta la lista ilegibles');
  for (const [i, r] of (Array.isArray(borrador.registros) ? borrador.registros : []).entries()) {
    if (!r || typeof r !== 'object') { errores.push(`registro ${i + 1} no es un objeto`); continue; }
    if (!r.texto_original) errores.push(`registro ${i + 1} sin texto_original`);
    if (!['alta', 'media', 'baja'].includes(r.confianza)) errores.push(`registro ${i + 1} sin confianza válida`);
    if (r.numero_interno != null && !/^\d{4}$/.test(String(r.numero_interno))) errores.push(`registro ${i + 1}: numero_interno debe tener 4 dígitos`);
    // Ciclo 2: una fila puede identificar al animal solo por chapeta; el validador lo busca en el censo.
    if (!r.numero_interno && !r.alcance_lote && !soloDigitos(r.chapeta)) errores.push(`registro ${i + 1} sin numero_interno, chapeta ni alcance_lote`);
  }
  return errores;
}

const soloDigitos = (s) => String(s ?? '').replace(/\D/g, '');
const normal = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

// V8: el valor tiene que estar escrito en el texto que leyó el extractor.
function apareceEnTexto(valor, texto) {
  if (valor == null) return true;
  const t = String(texto ?? '');
  const sinCeros = soloDigitos(valor).replace(/^0+/, '') || '0';
  const variantes = [String(valor), String(valor).replace('.', ','), sinCeros];
  const numerosDelTexto = t.match(/\d+(?:[.,]\d+)?/g) ?? [];
  return numerosDelTexto.some((n) => variantes.includes(n) || variantes.includes(n.replace(/^0+/, '')));
}

function loteMencionado(codigoLote, potrero, texto) {
  const t = normal(texto);
  const corto = normal(String(codigoLote).replace(/^lote-?/i, ''));
  return t.includes(corto) || (potrero && t.includes(normal(potrero)));
}

export function validarBorrador(borrador, censo, { fechaMensaje }) {
  const porNumero = new Map(censo.animales.map((a) => [a.numero_interno, a]));
  const resultado = {
    tipo_reporte: borrador.tipo_reporte,
    fecha_reporte: borrador.fecha_reporte,
    lote: borrador.lote ?? null,
    validos: [],
    dudosos: [],
    ilegibles: [...(borrador.ilegibles ?? [])],
  };
  if (borrador.tipo_reporte === 'otro') return conResumen(resultado);

  // V10: un evento para todo el lote se expande con el censo, nunca con lo que diga el modelo.
  const filas = [];
  for (const r of borrador.registros) {
    if (r.alcance_lote) {
      const lote = censo.lotes.find((l) => l.codigo === r.alcance_lote);
      const animalesLote = censo.animales.filter((a) => a.lote === r.alcance_lote && a.estado === 'activo');
      if (!lote || animalesLote.length === 0) {
        resultado.dudosos.push({ ...r, motivos: [{ regla: 'V1', texto: `el lote ${r.alcance_lote} no está en el censo` }] });
        continue;
      }
      if (!loteMencionado(lote.codigo, lote.potrero, r.texto_original)) {
        resultado.dudosos.push({ ...r, motivos: [{ regla: 'V8', texto: 'el lote no aparece en el texto leído' }] });
        continue;
      }
      for (const a of animalesLote) filas.push({ ...r, numero_interno: a.numero_interno, alcance_lote: r.alcance_lote, expandido: true });
    } else if (!r.numero_interno) {
      // Ciclo 2 (V1/V2): planilla anotada por chapeta. El número interno lo pone el censo, no el modelo.
      const digitos = soloDigitos(r.chapeta);
      const candidatos = digitos.length >= 4 ? censo.animales.filter((a) => soloDigitos(a.chapeta_ica).endsWith(digitos)) : [];
      if (candidatos.length === 1) {
        filas.push({ ...r, numero_interno: candidatos[0].numero_interno, porChapeta: true });
      } else {
        const texto = candidatos.length ? `la chapeta ${r.chapeta} coincide con ${candidatos.length} animales del censo` : `la chapeta ${r.chapeta} no está en el censo`;
        resultado.dudosos.push({ ...r, motivos: [{ regla: candidatos.length ? 'V2' : 'V1', texto }] });
      }
    } else {
      filas.push({ ...r });
    }
  }

  // V6: cuántas veces aparece cada animal en este reporte. Ciclo 1: en sanidad, un mismo animal
  // puede tener eventos distintos el mismo día (purga y tratamiento); solo se repite si es el mismo evento.
  const claveDuplicado = (f) => borrador.tipo_reporte === 'sanidad'
    ? `${f.numero_interno}|${f.evento_sanitario?.tipo}|${normal(f.evento_sanitario?.descripcion)}`
    : f.numero_interno;
  const veces = new Map();
  for (const f of filas) veces.set(claveDuplicado(f), (veces.get(claveDuplicado(f)) ?? 0) + 1);

  for (const f of filas) {
    const motivos = [];
    const animal = porNumero.get(f.numero_interno);
    const fecha = borrador.fecha_reporte;

    if (!animal || animal.estado !== 'activo') motivos.push({ regla: 'V1', texto: `la ${f.numero_interno} no está en el censo de animales activos` });
    if (animal && f.chapeta && soloDigitos(f.chapeta) && !soloDigitos(animal.chapeta_ica).endsWith(soloDigitos(f.chapeta))) {
      motivos.push({ regla: 'V2', texto: `la chapeta ${f.chapeta} no coincide con la del censo (${animal.chapeta_ica})` });
    }
    if (fechaMensaje && fecha > fechaMensaje) motivos.push({ regla: 'V3', texto: `la fecha ${fecha} es posterior al mensaje (${fechaMensaje})` });
    if (animal && fecha < animal.fecha_ingreso) motivos.push({ regla: 'V4', texto: `la fecha ${fecha} es anterior al ingreso del animal (${animal.fecha_ingreso})` });
    if (veces.get(claveDuplicado(f)) > 1) motivos.push({ regla: 'V6', texto: `la ${f.numero_interno} aparece ${veces.get(claveDuplicado(f))} veces en el reporte` });
    const idLeido = f.porChapeta ? soloDigitos(f.chapeta) : f.numero_interno;
    if (!f.expandido && !apareceEnTexto(idLeido, f.texto_original)) motivos.push({ regla: 'V8', texto: `el ${f.porChapeta ? 'número de chapeta' : 'número interno'} no aparece en el texto leído` });

    if (borrador.tipo_reporte === 'pesaje') {
      const peso = Number(f.peso_kg);
      if (!Number.isFinite(peso) || peso < PESO_MIN_KG || peso > PESO_MAX_KG) {
        motivos.push({ regla: 'V7', texto: `peso fuera de rango (${f.peso_kg} kg)` });
      } else {
        const anterior = animal?.ultimo_pesaje?.peso_kg;
        if (anterior && Math.abs(peso - anterior) / anterior > UMBRAL_VARIACION) {
          const cambio = Math.round(((peso - anterior) / anterior) * 100);
          motivos.push({ regla: 'V5', texto: `cambió ${cambio > 0 ? '+' : ''}${cambio} % frente al último pesaje (${anterior} kg el ${animal.ultimo_pesaje.fecha})` });
        }
        if (!apareceEnTexto(f.peso_kg, f.texto_original)) motivos.push({ regla: 'V8', texto: 'el peso no aparece en el texto leído' });
      }
      if (f.confianza === 'baja') motivos.push({ regla: 'V8', texto: 'el extractor no está seguro de la lectura (confianza baja)' });
    } else if (borrador.tipo_reporte === 'sanidad') {
      const ev = f.evento_sanitario;
      if (!ev || !TIPOS_SANIDAD.includes(ev.tipo) || !String(ev.descripcion ?? '').trim()) motivos.push({ regla: 'V9', texto: 'evento sanitario incompleto (tipo o descripción)' });
    }

    const registro = {
      numero_interno: f.numero_interno,
      chapeta: animal?.chapeta_ica ?? f.chapeta ?? null,
      fecha,
      peso_kg: borrador.tipo_reporte === 'pesaje' ? Number(f.peso_kg) : null,
      evento_sanitario: borrador.tipo_reporte === 'sanidad' ? f.evento_sanitario : null,
      texto_original: f.texto_original,
      confianza: f.confianza,
    };
    if (motivos.length) resultado.dudosos.push({ ...registro, motivos });
    else resultado.validos.push(registro);
  }
  return conResumen(resultado);
}

function conResumen(r) {
  r.resumen = { validos: r.validos.length, dudosos: r.dudosos.length, ilegibles: r.ilegibles.length };
  r.estado = r.dudosos.length || r.ilegibles.length ? 'requiere_revision' : 'listo_para_confirmar';
  return r;
}
