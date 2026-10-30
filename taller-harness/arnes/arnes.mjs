// Pasos fijos del arnés (los que no son IA). Los pasos de IA (extractor y revisor) los corre
// Claude Code con subagentes; ver arnes/ORQUESTACION.md.
//
//   node taller-harness/arnes/arnes.mjs validar  --extraccion <json> --fecha-mensaje AAAA-MM-DD --de <usuario> [--caso caso-1] [--intento 1]
//   node taller-harness/arnes/arnes.mjs revision --id <borrador> --archivo <json del revisor>
//   node taller-harness/arnes/arnes.mjs confirmar --id <borrador> --por <usuario> [--corregir 0303=215] [--descartar 0209] [--motivo "<de dónde salió el dato>"]
//   node taller-harness/arnes/arnes.mjs rechazar  --id <borrador> --por <usuario> --motivo "<texto>"
//   node taller-harness/arnes/arnes.mjs cargar    --id <borrador>
//   node taller-harness/arnes/arnes.mjs estado
import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validarBorrador, revisarFormato, UMBRAL_VARIACION } from './validador.mjs';
import { calificar } from './calificar.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const memoria = join(raiz, 'memoria');
const dirBorradores = join(memoria, 'borradores');
const bitacora = join(memoria, 'bitacora_jornadas.jsonl');
const baseDemo = join(memoria, 'base-demo.json');
mkdirSync(dirBorradores, { recursive: true });

const leerJSON = (ruta) => JSON.parse(readFileSync(ruta, 'utf8'));
const config = leerJSON(join(raiz, 'arnes', 'config.json'));
const censo = leerJSON(join(raiz, 'contexto', 'censo-demo.json'));
const ahora = () => new Date().toISOString();

function args() {
  const [, , comando, ...resto] = process.argv;
  const op = { corregir: [], descartar: [] };
  for (let i = 0; i < resto.length; i += 2) {
    const clave = resto[i].replace(/^--/, '');
    if (clave === 'corregir' || clave === 'descartar') op[clave].push(resto[i + 1]);
    else op[clave] = resto[i + 1];
  }
  return { comando, op };
}

function anotar(evento) {
  appendFileSync(bitacora, JSON.stringify({ momento: ahora(), ...evento }) + '\n');
}
const rutaBorrador = (id) => join(dirBorradores, `${id}.json`);
function leerBorrador(id) {
  if (!existsSync(rutaBorrador(id))) throw new Error(`No existe el borrador ${id}`);
  return leerJSON(rutaBorrador(id));
}
const guardarBorrador = (b) => writeFileSync(rutaBorrador(b.id), JSON.stringify(b, null, 2) + '\n');
function salir(mensaje, codigo = 1) {
  console.error(mensaje);
  process.exit(codigo);
}

const comandos = {
  // Paso 2 del flujo: validador con reglas fijas. Crea el borrador y lo anota en la bitácora.
  validar({ extraccion, 'fecha-mensaje': fechaMensaje, de, caso, intento = '1' }) {
    if (!config.pueden_enviar.includes(de)) {
      anotar({ tipo: 'mensaje_ignorado', de, motivo: 'remitente no autorizado' });
      salir(`Ignorado: "${de}" no está autorizado para enviar reportes.`, 3);
    }
    let salida;
    try {
      salida = leerJSON(extraccion);
    } catch {
      salida = null;
    }
    const errores = revisarFormato(salida);
    if (errores.length) {
      const n = Number(intento);
      anotar({ tipo: 'formato_invalido', caso, intento: n, errores });
      if (n > config.max_reintentos_extractor) salir(`Formato inválido después de ${n - 1} reintentos: pasa a revisión humana.\n- ${errores.join('\n- ')}`, 4);
      salir(`Formato inválido (intento ${n}). Reintentar el extractor con estos errores:\n- ${errores.join('\n- ')}`, 2);
    }
    const resultado = validarBorrador(salida, censo, { fechaMensaje });
    const id = `${(caso ?? 'msg')}-${Date.now().toString(36)}`;
    const { estado: estadoValidacion, ...datos } = resultado;
    const borrador = { id, caso: caso ?? null, de, fecha_mensaje: fechaMensaje, creado: ahora(), estado: 'borrador', estado_validacion: estadoValidacion, extraccion: salida, ...datos, revision: null, historial: [{ momento: ahora(), estado: 'borrador' }] };
    guardarBorrador(borrador);
    anotar({ tipo: 'borrador_creado', id, caso, de, ...resultado.resumen });
    let nota = null;
    if (caso) {
      const def = leerJSON(join(raiz, 'casos', 'casos.json')).casos.find((c) => c.id === caso);
      if (def) nota = calificar(def, resultado, censo);
    }
    console.log(JSON.stringify({ id, estado: resultado.estado, resumen: resultado.resumen, dudosos: resultado.dudosos.map((d) => ({ numero: d.numero_interno, peso: d.peso_kg, motivos: d.motivos.map((m) => `${m.regla}: ${m.texto}`) })), ilegibles: resultado.ilegibles, calificacion: nota }, null, 2));
  },

  // Paso 3: guarda las preguntas del revisor (IA) en el borrador. No cambia ningún dato.
  revision({ id, archivo }) {
    const b = leerBorrador(id);
    b.revision = leerJSON(archivo);
    guardarBorrador(b);
    anotar({ tipo: 'revision_agregada', id, preguntas: b.revision.preguntas?.length ?? 0 });
    console.log(`Revisión guardada en ${id}`);
  },

  // Paso 4: decisión humana. Solo un usuario autorizado; las correcciones quedan registradas.
  confirmar({ id, por, corregir, descartar, motivo }) {
    if (!config.pueden_confirmar.includes(por)) {
      anotar({ tipo: 'confirmacion_rechazada', id, por, motivo: 'usuario no autorizado' });
      salir(`"${por}" no puede confirmar borradores.`, 3);
    }
    const b = leerBorrador(id);
    if (b.estado !== 'borrador') salir(`El borrador ${id} está "${b.estado}"; solo se confirma un borrador.`);
    // Hallazgo de la prueba de retomar: quien envía no se confirma a sí mismo (segregación de funciones).
    if (b.de === por) {
      anotar({ tipo: 'confirmacion_rechazada', id, por, motivo: 'quien envió no puede confirmar su propio reporte' });
      salir(`"${por}" envió este reporte; lo tiene que confirmar otra persona autorizada.`, 3);
    }
    // Hallazgo de la prueba de retomar: toda corrección o descarte deja su motivo (de dónde salió el dato).
    if ((corregir.length || descartar.length) && !String(motivo ?? '').trim()) {
      salir('Toda corrección o descarte necesita --motivo "<de dónde salió el dato>".');
    }
    const correcciones = [];
    for (const c of corregir) {
      const [numero, peso] = c.split('=');
      const i = b.dudosos.findIndex((d) => d.numero_interno === numero);
      if (i < 0) salir(`La ${numero} no está entre los dudosos de ${id}.`);
      const d = b.dudosos[i];
      // Aun corregido por una persona, un peso con más de 15 % de cambio no entra sin otra mirada (RN-01).
      const anterior = censo.animales.find((a) => a.numero_interno === numero)?.ultimo_pesaje?.peso_kg;
      if (b.tipo_reporte === 'pesaje' && anterior && Math.abs(Number(peso) - anterior) / anterior > UMBRAL_VARIACION) {
        console.warn(`Aviso: la ${numero} con ${peso} kg sigue cambiando más del 15 % frente a ${anterior} kg. Se carga porque lo confirmó ${por}.`);
      }
      b.dudosos.splice(i, 1);
      b.validos.push({ ...d, motivos: undefined, peso_kg: b.tipo_reporte === 'pesaje' ? Number(peso) : d.peso_kg, corregido_por: por });
      correcciones.push({ numero, de: d.peso_kg, a: Number(peso), regla: d.motivos.map((m) => m.regla).join(','), motivo });
    }
    for (const numero of descartar) {
      const i = b.dudosos.findIndex((d) => d.numero_interno === numero);
      if (i < 0) salir(`La ${numero} no está entre los dudosos de ${id}.`);
      correcciones.push({ numero, descartado: true, regla: b.dudosos[i].motivos.map((m) => m.regla).join(','), motivo });
      b.dudosos.splice(i, 1);
    }
    if (b.dudosos.length) salir(`Quedan ${b.dudosos.length} dudosos sin resolver en ${id}. Corrígelos (--corregir) o descártalos (--descartar).`);
    b.estado = 'confirmado';
    b.confirmado_por = por;
    b.correcciones = correcciones;
    b.historial.push({ momento: ahora(), estado: 'confirmado', por, correcciones: correcciones.length });
    guardarBorrador(b);
    anotar({ tipo: 'borrador_confirmado', id, por, correcciones });
    console.log(`Confirmado ${id} por ${por}: ${b.validos.length} registros listos para cargar, ${correcciones.length} correcciones.`);
  },

  rechazar({ id, por, motivo }) {
    if (!config.pueden_confirmar.includes(por)) salir(`"${por}" no puede rechazar borradores.`, 3);
    const b = leerBorrador(id);
    b.estado = 'rechazado';
    b.historial.push({ momento: ahora(), estado: 'rechazado', por, motivo });
    guardarBorrador(b);
    anotar({ tipo: 'borrador_rechazado', id, por, motivo });
    console.log(`Rechazado ${id}.`);
  },

  // Paso 5: cargador fijo. Guardarraíl: sin confirmación de un usuario autorizado, no carga nada.
  cargar({ id }) {
    const b = leerBorrador(id);
    if (b.estado !== 'confirmado' || !config.pueden_confirmar.includes(b.confirmado_por)) {
      anotar({ tipo: 'carga_bloqueada', id, estado: b.estado });
      salir(`Bloqueado: el borrador ${id} está "${b.estado}". Solo se carga lo confirmado por una persona autorizada.`, 5);
    }
    const base = existsSync(baseDemo) ? leerJSON(baseDemo) : { pesajes: [], eventos_sanitarios: [] };
    for (const v of b.validos) {
      // Igual que el índice pesajes_uno_por_jornada de la app: un pesaje por animal y fecha.
      if (b.tipo_reporte === 'pesaje') {
        const previo = base.pesajes.find((p) => p.numero_interno === v.numero_interno && p.fecha === v.fecha);
        if (previo) {
          anotar({ tipo: 'carga_bloqueada', id, motivo: `la ${v.numero_interno} ya tiene pesaje el ${v.fecha} (borrador ${previo.borrador})` });
          salir(`Bloqueado: la ${v.numero_interno} ya tiene pesaje el ${v.fecha} (cargado por ${previo.borrador}). No se cargó nada de ${id}.`, 5);
        }
        base.pesajes.push({ numero_interno: v.numero_interno, fecha: v.fecha, peso_kg: v.peso_kg, notas: `Telegram/arnés ${id}`, borrador: id });
      } else {
        base.eventos_sanitarios.push({ numero_interno: v.numero_interno, tipo: v.evento_sanitario.tipo, descripcion: v.evento_sanitario.descripcion, estado: 'aplicado', fecha_aplicada: v.fecha, borrador: id });
      }
    }
    writeFileSync(baseDemo, JSON.stringify(base, null, 2) + '\n');
    b.estado = 'cargado';
    b.historial.push({ momento: ahora(), estado: 'cargado' });
    guardarBorrador(b);
    anotar({ tipo: 'borrador_cargado', id, registros: b.validos.length });
    console.log(`Cargados ${b.validos.length} registros de ${id}.`);
  },

  // Para retomar en otra sesión sin preguntar nada: qué hay pendiente y en qué estado.
  estado() {
    const borradores = readdirSync(dirBorradores).filter((f) => f.endsWith('.json')).map((f) => leerJSON(join(dirBorradores, f)));
    const filas = borradores.map((b) => `${b.id.padEnd(22)} ${b.estado.padEnd(11)} válidos ${b.validos.length}, dudosos ${b.dudosos.length}, ilegibles ${b.ilegibles.length}`);
    console.log(filas.join('\n') || 'No hay borradores.');
  },
};

const { comando, op } = args();
if (!comandos[comando]) salir('Comandos: validar, revision, confirmar, rechazar, cargar, estado');
comandos[comando](op);
