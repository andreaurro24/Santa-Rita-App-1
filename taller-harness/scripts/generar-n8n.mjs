// Genera los flujos importables de n8n a partir de las mismas piezas del arnés:
// instrucciones, glosario, skills y ejemplos (system prompt) y arnes/validador.mjs (nodo Code).
// Uso: node taller-harness/scripts/generar-n8n.mjs
// Credenciales que el equipo crea en n8n (nunca en este repo):
//   "Telegram Santa Rita" (token de @BotFather), "Anthropic" (Header Auth: x-api-key),
//   "Supabase arnes_campo" (Postgres con el rol arnes_campo del SQL).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r) => readFileSync(join(raiz, r), 'utf8');
mkdirSync(join(raiz, 'n8n'), { recursive: true });

const MODELO = 'claude-opus-5-5';
const CRED_TELEGRAM = { telegramApi: { id: 'CAMBIAR', name: 'Telegram Santa Rita' } };
const CRED_PG = { postgres: { id: 'CAMBIAR', name: 'Supabase arnes_campo' } };
const CRED_ANTHROPIC = { httpHeaderAuth: { id: 'CAMBIAR', name: 'Anthropic' } };

const sinFrontmatter = (t) => t.replace(/^---[\s\S]*?---\s*/, '');
const SYSTEM_EXTRACTOR = [
  leer('contexto/instrucciones.md'),
  leer('contexto/glosario.md'),
  '# Skill: leer-jornada-pesaje\n' + sinFrontmatter(leer('skills/leer-jornada-pesaje/SKILL.md')),
  '# Skill: leer-evento-sanidad\n' + sinFrontmatter(leer('skills/leer-evento-sanidad/SKILL.md')),
  leer('contexto/ejemplos/ejemplos.md'),
  '# Formato de salida (JSON Schema)\n' + leer('contexto/borrador.schema.json'),
].join('\n\n---\n\n');
const SYSTEM_REVISOR = [
  'Eres el revisor de borradores de Finca Santa Rita. Eres distinto del extractor: compara su lectura con el reporte original. Trabaja solo sobre dudosos e ilegibles; no cambies datos. Responde solo JSON: {"preguntas":[{"numero_interno":"0303 o null","pregunta":"..."}],"alertas":[{"numero_interno":"...","detalle":"..."}],"mensaje_telegram":"resumen de 2 a 4 líneas"}',
  '# Skill: explicar-dudoso\n' + sinFrontmatter(leer('skills/explicar-dudoso/SKILL.md')),
  leer('contexto/reglas.md'),
].join('\n\n---\n\n');

// El validador, sin "export", para pegarlo dentro de un nodo Code.
const VALIDADOR = leer('arnes/validador.mjs').replace(/^export /gm, '');

let x = 0;
const nodos = [];
const conexiones = {};
function nodo(name, type, typeVersion, parameters, extra = {}) {
  nodos.push({ id: `n${++x}`, name, type, typeVersion, position: [240 * (nodos.length % 9), 220 * Math.floor(nodos.length / 9)], parameters, ...extra });
  return name;
}
function unir(desde, hacia, salida = 0) {
  conexiones[desde] ??= { main: [] };
  while (conexiones[desde].main.length <= salida) conexiones[desde].main.push([]);
  conexiones[desde].main[salida].push({ node: hacia, type: 'main', index: 0 });
}
const code = (name, js) => nodo(name, 'n8n-nodes-base.code', 2, { mode: 'runOnceForAllItems', jsCode: js });
const pg = (name, query, replacement, extra) => nodo(name, 'n8n-nodes-base.postgres', 2.5,
  { operation: 'executeQuery', query, options: replacement ? { queryReplacement: replacement } : {} }, { credentials: CRED_PG, ...extra });
const si = (name, expr) => nodo(name, 'n8n-nodes-base.if', 2, {
  conditions: {
    options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
    conditions: [{ id: `c${x}`, leftValue: expr, rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } }],
    combinator: 'and',
  },
  options: {},
});
const claude = (name) => nodo(name, 'n8n-nodes-base.httpRequest', 4.2, {
  method: 'POST',
  url: 'https://api.anthropic.com/v1/messages',
  authentication: 'genericCredentialType',
  genericAuthType: 'httpHeaderAuth',
  sendHeaders: true,
  headerParameters: { parameters: [
    { name: 'anthropic-version', value: '2026-10-21' },
    // Si el modelo rechaza la petición por política, el servidor reintenta con otro modelo.
    { name: 'anthropic-beta', value: 'server-side-fallback-2026-07-01' },
  ] },
  sendBody: true,
  specifyBody: 'json',
  jsonBody: '={{ JSON.stringify($json.peticion) }}',
  options: { timeout: 120000 },
}, { credentials: CRED_ANTHROPIC });
const telegram = (name, parameters) => nodo(name, 'n8n-nodes-base.telegram', 1.2, parameters, { credentials: CRED_TELEGRAM });

// ---------------------------------------------------------------- procesar-reporte
const tg = nodo('Telegram: mensaje', 'n8n-nodes-base.telegramTrigger', 1.1, { updates: ['message'], additionalFields: { download: true } }, { credentials: CRED_TELEGRAM, webhookId: 'santa-rita-reportes' });

const preparar = code('Preparar reporte', `// Datos del mensaje y foto en base64 (la más grande que manda Telegram).
const m = $input.first().json.message ?? {};
let imagen_b64 = null;
if ($input.first().binary?.data) imagen_b64 = (await this.helpers.getBinaryDataBuffer(0, 'data')).toString('base64');
const fecha = new Date((m.date ?? Date.now() / 1000) * 1000).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
return [{ json: { chat_id: m.chat?.id, user_id: m.from?.id, message_id: m.message_id, fecha_mensaje: fecha,
  texto: m.text ?? m.caption ?? '', imagen_b64, media_type: 'image/jpeg' } }];`);
unir(tg, preparar);

const autorizado = pg('Supabase: ¿puede enviar?', 'select exists (select 1 from campo.telegram_autorizados where telegram_user_id = $1 and puede_enviar) as autorizado', '={{ [$json.user_id] }}');
unir(preparar, autorizado);
const siAut = si('¿Remitente autorizado?', '={{ $json.autorizado }}');
unir(autorizado, siAut);
const ignorar = pg('Bitácora: mensaje ignorado', `insert into campo.bitacora_jornadas (tipo, telegram_user_id, detalle) values ('mensaje_ignorado', $1, '{"motivo":"remitente no autorizado"}')`, "={{ [$('Preparar reporte').first().json.user_id] }}");
unir(siAut, ignorar, 1);

const censo = pg('Supabase: censo', `select json_build_object(
  'lotes', coalesce((select json_agg(row_to_json(l)) from campo.lotes_arnes l), '[]'::json),
  'animales', coalesce((select json_agg(json_build_object('numero_interno', c.numero_interno, 'chapeta_ica', c.chapeta_ica,
     'lote', c.lote, 'fecha_ingreso', c.fecha_ingreso, 'estado', c.estado,
     'ultimo_pesaje', case when c.ultimo_peso_kg is null then null else json_build_object('fecha', c.fecha_ultimo_peso, 'peso_kg', c.ultimo_peso_kg) end))
   from campo.censo_arnes c), '[]'::json)) as censo`);
unir(siAut, censo, 0);

const MAX_INTENTOS = 3; // 1 intento + 2 reintentos (guardarraíl: después pasa a una persona)
let anterior = censo;
const okPorIntento = [];
for (let k = 1; k <= MAX_INTENTOS; k++) {
  const pet = code(`Petición extractor ${k}`, `// Intento ${k}: instrucciones + glosario + skills + ejemplos en el system; censo y reporte en el mensaje.
const SYSTEM = ${JSON.stringify(SYSTEM_EXTRACTOR)};
const r = $('Preparar reporte').first().json;
const censo = $('Supabase: censo').first().json.censo;
const contenido = [];
if (r.imagen_b64) contenido.push({ type: 'image', source: { type: 'base64', media_type: r.media_type, data: r.imagen_b64 } });
contenido.push({ type: 'text', text: 'Fecha del mensaje: ' + r.fecha_mensaje + '\\nTexto del mensaje: ' + (r.texto || '(sin texto)') + '\\n\\nCenso (censo-demo.json):\\n' + JSON.stringify(censo) });
const messages = [{ role: 'user', content: contenido }];
${k > 1 ? `const previo = $('Validar ${k - 1}').first().json;
messages.push({ role: 'assistant', content: previo.texto_modelo || '{}' });
messages.push({ role: 'user', content: 'El validador rechazó tu salida (intento ${k - 1} de ${MAX_INTENTOS}). Errores:\\n- ' + previo.errores.join('\\n- ') + '\\nDevuelve de nuevo solo el JSON del borrador.' });` : ''}
return [{ json: { peticion: { model: '${MODELO}', max_tokens: 16000, fallbacks: 'default', output_config: { effort: 'medium' }, system: SYSTEM, messages } } }];`);
  unir(anterior, pet, anterior === censo ? 0 : 1);
  const http = claude(`Claude: extractor ${k}`);
  unir(pet, http);
  const val = code(`Validar ${k}`, `// Validador con reglas fijas (copiado de taller-harness/arnes/validador.mjs).
${VALIDADOR}
const resp = $input.first().json;
const r = $('Preparar reporte').first().json;
const censo = $('Supabase: censo').first().json.censo;
let texto_modelo = '';
let extraccion = null;
let errores = [];
if (resp.stop_reason === 'refusal') errores = ['el modelo rechazó la petición'];
else {
  texto_modelo = (resp.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
  try { extraccion = JSON.parse(texto_modelo.replace(/^\`\`\`(json)?|\`\`\`$/g, '')); } catch { errores = ['la salida no es JSON válido']; }
  if (!errores.length) errores = revisarFormato(extraccion);
}
const ok = errores.length === 0;
const resultado = ok ? validarBorrador(extraccion, censo, { fechaMensaje: r.fecha_mensaje }) : null;
return [{ json: { ok, intento: ${k}, errores, texto_modelo, extraccion, resultado } }];`);
  unir(http, val);
  const siOk = si(`¿Formato válido? ${k}`, '={{ $json.ok }}');
  unir(val, siOk);
  okPorIntento.push(siOk);
  anterior = siOk;
}
const aHumano = pg('Bitácora: a revisión humana', `insert into campo.bitacora_jornadas (tipo, telegram_user_id, detalle) values ('formato_invalido_revision_humana', $1, $2::jsonb)`,
  `={{ [$('Preparar reporte').first().json.user_id, JSON.stringify({ errores: $json.errores, intentos: ${MAX_INTENTOS} })] }}`);
unir(anterior, aHumano, 1);
const avisoHumano = telegram('Telegram: no pude leerlo', { chatId: "={{ $('Preparar reporte').first().json.chat_id }}", text: 'No pude convertir este reporte en registros después de 3 intentos. Lo revisa una persona. Si puedes, manda una foto más clara o escribe las filas como "número – peso".', additionalFields: { appendAttribution: false } });
unir(aHumano, avisoHumano);

const juntar = code('Borrador validado', `// Toma la salida del intento que pasó el formato.
const ultimo = [${okPorIntento.map((_, i) => `'Validar ${i + 1}'`).join(', ')}].map((n) => { try { return $(n).first().json; } catch { return null; } }).filter((v) => v && v.ok).pop();
const r = ultimo.resultado;
return [{ json: { ...ultimo, necesita_revisor: r.dudosos.length + r.ilegibles.length > 0 } }];`);
for (const n of okPorIntento) unir(n, juntar, 0);

const siRev = si('¿Hay dudosos o ilegibles?', '={{ $json.necesita_revisor }}');
unir(juntar, siRev);
const petRev = code('Petición revisor', `const SYSTEM = ${JSON.stringify(SYSTEM_REVISOR)};
const r = $('Preparar reporte').first().json;
const b = $json;
const contenido = [];
if (r.imagen_b64) contenido.push({ type: 'image', source: { type: 'base64', media_type: r.media_type, data: r.imagen_b64 } });
contenido.push({ type: 'text', text: 'Reporte original: ' + (r.texto || '(foto)') + '\\nBorrador validado: ' + JSON.stringify(b.resultado) });
return [{ json: { peticion: { model: '${MODELO}', max_tokens: 16000, fallbacks: 'default', output_config: { effort: 'medium' }, system: SYSTEM, messages: [{ role: 'user', content: contenido }] } } }];`);
unir(siRev, petRev, 0);
const httpRev = claude('Claude: revisor');
unir(petRev, httpRev);
const leerRev = code('Leer revisión', `const resp = $input.first().json;
const texto = (resp.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
let revision = null;
try { revision = JSON.parse(texto.replace(/^\`\`\`(json)?|\`\`\`$/g, '')); } catch { revision = { preguntas: [], alertas: [], mensaje_telegram: 'Hay registros en duda. Revisa el borrador.' }; }
return [{ json: { ...$('Borrador validado').first().json, revision } }];`);
unir(httpRev, leerRev);
const sinRev = code('Sin revisión', 'return [{ json: { ...$input.first().json, revision: null } }];');
unir(siRev, sinRev, 1);

const guardar = pg('Supabase: guardar borrador', `insert into campo.borradores_campo (telegram_chat_id, telegram_user_id, telegram_message_id, fecha_mensaje, tipo_reporte, extraccion, resultado, revision, intentos)
values ($1, $2, $3, $4::date, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9) returning id`,
"={{ (() => { const r = $('Preparar reporte').first().json; return [r.chat_id, r.user_id, r.message_id, r.fecha_mensaje, $json.extraccion.tipo_reporte, JSON.stringify($json.extraccion), JSON.stringify($json.resultado), JSON.stringify($json.revision), $json.intento]; })() }}");
unir(leerRev, guardar);
unir(sinRev, guardar);
const bitacora = pg('Bitácora: borrador creado', `insert into campo.bitacora_jornadas (tipo, borrador_id, telegram_user_id, detalle) values ('borrador_creado', $1::uuid, $2, $3::jsonb)`,
  "={{ (() => { const v = $('Supabase: guardar borrador').first().json; const b = $('Borrador validado').first().json; return [v.id, $('Preparar reporte').first().json.user_id, JSON.stringify({ validos: b.resultado.validos.length, dudosos: b.resultado.dudosos.length, ilegibles: b.resultado.ilegibles.length, intentos: b.intento })]; })() }}");
unir(guardar, bitacora);
const resumen = code('Armar resumen', `const id = $('Supabase: guardar borrador').first().json.id;
const b = $('Supabase: guardar borrador').first().json;
const v = (() => { try { return $('Leer revisión').first().json; } catch { return $('Sin revisión').first().json; } })();
const r = v.resultado;
const tipo = r.tipo_reporte === 'pesaje' ? 'Pesaje' : 'Sanidad';
let texto = tipo + ' del ' + r.fecha_reporte + (r.lote ? ' (' + r.lote + ')' : '') + ':\\n' + r.validos.length + ' listos para cargar, ' + r.dudosos.length + ' en duda, ' + r.ilegibles.length + ' ilegibles.';
if (v.revision?.mensaje_telegram) texto += '\\n\\n' + v.revision.mensaje_telegram;
texto += '\\n\\nNada se guarda en la app hasta que una persona autorizada lo confirme.';
return [{ json: { id, texto, chat_id: $('Preparar reporte').first().json.chat_id } }];`);
unir(bitacora, resumen);
const enviar = telegram('Telegram: borrador con botones', {
  chatId: '={{ $json.chat_id }}',
  text: '={{ $json.texto }}',
  replyMarkup: 'inlineKeyboard',
  inlineKeyboard: { rows: [
    { row: { buttons: [{ text: '✅ Confirmar', additionalFields: { callback_data: "={{ 'c:' + $json.id }}" } }] } },
    { row: { buttons: [{ text: '🗑️ Confirmar sin los dudosos', additionalFields: { callback_data: "={{ 'd:' + $json.id }}" } }] } },
    { row: { buttons: [{ text: '❌ Rechazar', additionalFields: { callback_data: "={{ 'r:' + $json.id }}" } }] } },
  ] },
  additionalFields: { appendAttribution: false },
});
unir(resumen, enviar);
const preguntaEnviada = pg('Bitácora: preguntas enviadas', `insert into campo.bitacora_jornadas (tipo, borrador_id, detalle) values ('borrador_enviado_a_telegram', $1::uuid, '{}')`, "={{ [$('Armar resumen').first().json.id] }}");
unir(enviar, preguntaEnviada);

const flujo = (name, nodes, connections) => ({ name, nodes, connections, settings: { executionOrder: 'v1' }, pinData: {}, active: false, meta: { templateCredsSetupCompleted: false }, tags: [] });
writeFileSync(join(raiz, 'n8n', 'procesar-reporte.json'), JSON.stringify(flujo('Santa Rita · procesar-reporte', nodos.splice(0), { ...conexiones }), null, 2) + '\n');
for (const k of Object.keys(conexiones)) delete conexiones[k];

// ---------------------------------------------------------------- confirmar-borrador
const tgBoton = nodo('Telegram: botón', 'n8n-nodes-base.telegramTrigger', 1.1, { updates: ['callback_query'], additionalFields: {} }, { credentials: CRED_TELEGRAM, webhookId: 'santa-rita-botones' });
const leerBoton = code('Leer botón', `const q = $input.first().json.callback_query;
const [accion, id] = String(q.data || '').split(':');
const sql = accion === 'r'
  ? "select campo.rechazar_borrador($1::uuid, $2::bigint, 'rechazado desde Telegram') as resultado"
  : 'select campo.confirmar_y_cargar($1::uuid, $2::bigint, ' + (accion === 'd' ? 'true' : 'false') + ') as resultado';
return [{ json: { accion, id, user_id: q.from.id, chat_id: q.message.chat.id, query_id: q.id, sql } }];`);
unir(tgBoton, leerBoton);
// Las reglas viven en la base de datos: quién puede confirmar, dudosos pendientes, autoconfirmación, doble carga.
const ejecutar = pg('Supabase: confirmar o rechazar', '={{ $json.sql }}', '={{ [$json.id, $json.user_id] }}', { onError: 'continueRegularOutput' });
unir(leerBoton, ejecutar);
const respuesta = code('Armar respuesta', `const b = $('Leer botón').first().json;
const r = $input.first().json;
let texto;
if (r.error) texto = 'No se cargó nada: ' + String(r.error.message || r.error).replace(/^.*?: /, '');
else if (b.accion === 'r') texto = 'Borrador rechazado. No se cargó nada.';
else texto = 'Listo: se cargaron ' + r.resultado + ' registros en la app.';
return [{ json: { ...b, texto, ok: !r.error } }];`);
unir(ejecutar, respuesta);
const contestar = telegram('Telegram: responder botón', { resource: 'callback', queryId: '={{ $json.query_id }}', additionalFields: { text: '={{ $json.texto.slice(0, 190) }}' } });
unir(respuesta, contestar);
const mensaje = telegram('Telegram: resultado', { chatId: "={{ $('Armar respuesta').first().json.chat_id }}", text: "={{ $('Armar respuesta').first().json.texto }}", additionalFields: { appendAttribution: false } });
unir(contestar, mensaje);
const bitBoton = pg('Bitácora: botón', `insert into campo.bitacora_jornadas (tipo, borrador_id, telegram_user_id, detalle) values ('boton_' || $1, $2::uuid, $3, $4::jsonb)`,
  "={{ (() => { const r = $('Armar respuesta').first().json; return [r.ok ? r.accion : r.accion + '_bloqueado', r.id, r.user_id, JSON.stringify({ texto: r.texto })]; })() }}");
unir(mensaje, bitBoton);
writeFileSync(join(raiz, 'n8n', 'confirmar-borrador.json'), JSON.stringify(flujo('Santa Rita · confirmar-borrador', nodos.splice(0), { ...conexiones }), null, 2) + '\n');
console.log('Flujos generados en taller-harness/n8n/');
