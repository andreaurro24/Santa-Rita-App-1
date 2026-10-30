// Arma el documento de entrega en Word (entrega/Entrega-Taller-Harness-Santa-Rita.docx) a partir de
// los mismos textos del repo: canvas, instrucciones, reglas, skills, bitácora y reflexión, más las
// capturas. Si cambia un .md, se vuelve a correr y el Word queda al día.
// Requiere la librería docx de npm, que NO es dependencia del proyecto: instálala en una carpeta
// aparte y apúntala con NODE_PATH.  Ejemplo:
//   npm i docx@9.5.1 --prefix C:/tmp/word
//   NODE_PATH=C:/tmp/word/node_modules node taller-harness/scripts/generar-documento-entrega.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(join(process.env.NODE_PATH ?? '.', 'x.js'));
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, ShadingType,
  ImageRun, AlignmentType, BorderStyle, LevelFormat, PageBreak, ExternalHyperlink, Footer, PageNumber, TabStopType,
} = require('docx');

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (p) => readFileSync(join(raiz, p), 'utf8').replace(/\r/g, '');
const VERDE = '2F7A4A', TINTA = '16261C', SUAVE = '56655B', REGLA = 'C9D6E8', FONDO = 'EEF3EE';
const ANCHO = 9360; // carta con márgenes de 1 pulgada, en DXA

// ---------- texto en línea: **negrita**, `código` y [enlace](url)
function enLinea(texto, base = {}) {
  const partes = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let i = 0, m;
  while ((m = re.exec(texto))) {
    if (m.index > i) partes.push(new TextRun({ text: texto.slice(i, m.index), ...base }));
    const t = m[0];
    if (t.startsWith('**')) partes.push(...enLinea(t.slice(2, -2), { ...base, bold: true }));
    else if (t.startsWith('`')) partes.push(new TextRun({ text: t.slice(1, -1), font: 'Consolas', size: (base.size ?? 22) - 2, ...base.color ? { color: base.color } : {} }));
    else {
      const [, txt, url] = t.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (/^https?:/.test(url)) partes.push(new ExternalHyperlink({ link: url, children: [new TextRun({ text: txt, style: 'Hyperlink', ...base })] }));
      else partes.push(new TextRun({ text: txt, ...base }));
    }
    i = m.index + t.length;
  }
  if (i < texto.length) partes.push(new TextRun({ text: texto.slice(i), ...base }));
  return partes;
}

// ---------- tabla
function tabla(filas) {
  const n = filas[0].length;
  const largos = Array.from({ length: n }, (_, c) => Math.max(...filas.map((f) => (f[c] ?? '').replace(/[*`]/g, '').length)));
  const peso = largos.map((l) => Math.max(8, Math.min(l, 90)));
  const total = peso.reduce((a, b) => a + b, 0);
  const anchos = peso.map((p) => Math.floor((p / total) * ANCHO));
  anchos[n - 1] += ANCHO - anchos.reduce((a, b) => a + b, 0);
  const borde = { style: BorderStyle.SINGLE, size: 4, color: REGLA };
  return new Table({
    width: { size: ANCHO, type: WidthType.DXA },
    columnWidths: anchos,
    rows: filas.map((f, r) => new TableRow({
      tableHeader: r === 0,
      children: anchos.map((w, c) => new TableCell({
        width: { size: w, type: WidthType.DXA },
        shading: r === 0 ? { type: ShadingType.CLEAR, color: 'auto', fill: FONDO } : undefined,
        borders: { top: borde, bottom: borde, left: borde, right: borde },
        margins: { top: 60, bottom: 60, left: 90, right: 90 },
        children: [new Paragraph({ spacing: { after: 0, line: 260 }, children: enLinea(f[c] ?? '', { size: 18, bold: r === 0 || undefined, color: r === 0 ? TINTA : undefined }) })],
      })),
    })),
  });
}

// ---------- markdown sencillo del repo → bloques de Word
let listaNum = 0;
function markdown(md, { nivelBase = 1, saltarTitulo = true } = {}) {
  md = md.replace(/^---\n[\s\S]*?\n---\n/, '');
  const lineas = md.split('\n');
  const out = [];
  let parrafo = [];
  const cerrarParrafo = () => {
    if (parrafo.length) out.push(new Paragraph({ children: enLinea(parrafo.join(' ')), spacing: { after: 140 } }));
    parrafo = [];
  };
  let primerTitulo = true;
  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i];
    if (!l.trim()) { cerrarParrafo(); continue; }
    const h = l.match(/^(#{1,4})\s+(.*)/);
    if (h) {
      cerrarParrafo();
      if (saltarTitulo && primerTitulo && h[1].length === 1) { primerTitulo = false; continue; }
      primerTitulo = false;
      const nivel = Math.min(h[1].length - 1 + nivelBase, 4);
      out.push(new Paragraph({ heading: [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4][nivel - 1], children: enLinea(h[2]) }));
      continue;
    }
    if (l.startsWith('|')) {
      cerrarParrafo();
      const filas = [];
      while (i < lineas.length && lineas[i].startsWith('|')) {
        if (!/^\|[\s|:-]+\|$/.test(lineas[i].trim())) filas.push(lineas[i].trim().slice(1, -1).split('|').map((c) => c.trim()));
        i++;
      }
      i--;
      out.push(tabla(filas), new Paragraph({ spacing: { after: 120 }, children: [] }));
      continue;
    }
    const li = l.match(/^(\s*)(-|\d+\.)\s+(.*)/);
    if (li) {
      cerrarParrafo();
      let texto = li[3];
      while (i + 1 < lineas.length && /^\s{2,}\S/.test(lineas[i + 1]) && !/^\s*(-|\d+\.)\s/.test(lineas[i + 1])) texto += ' ' + lineas[++i].trim();
      const numerada = li[2] !== '-';
      if (numerada && li[2] === '1.') listaNum++;
      out.push(new Paragraph({
        numbering: numerada ? { reference: 'numeros', level: 0, instance: listaNum } : { reference: 'vinetas', level: li[1].length >= 2 ? 1 : 0 },
        spacing: { after: 80 }, children: enLinea(texto),
      }));
      continue;
    }
    if (l.startsWith('>')) {
      cerrarParrafo();
      let texto = l.replace(/^>\s?/, '');
      while (i + 1 < lineas.length && lineas[i + 1].startsWith('>')) texto += ' ' + lineas[++i].replace(/^>\s?/, '');
      out.push(new Paragraph({ children: enLinea(texto, { italics: true, color: SUAVE }), indent: { left: 360 }, border: { left: { style: BorderStyle.SINGLE, size: 18, color: VERDE, space: 10 } }, spacing: { after: 160 } }));
      continue;
    }
    parrafo.push(l.trim());
  }
  cerrarParrafo();
  return out;
}

// ---------- piezas
const p = (texto, extra = {}) => new Paragraph({ children: enLinea(texto, extra.run ?? {}), spacing: { after: 140 }, ...extra.par });
const h1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun(t)] });
const h2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] });
const h3 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(t)] });
const vineta = (t) => new Paragraph({ numbering: { reference: 'vinetas', level: 0 }, spacing: { after: 80 }, children: enLinea(t) });

function tamano(buf, tipo) {
  if (tipo === 'png') return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
  let o = 2;
  while (o < buf.length) {
    const marca = buf[o + 1], largo = buf.readUInt16BE(o + 2);
    if (marca >= 0xc0 && marca <= 0xc3) return [buf.readUInt16BE(o + 7), buf.readUInt16BE(o + 5)];
    o += 2 + largo;
  }
  return [800, 600];
}
function imagen(ruta, pie, anchoMax = 600) {
  const buf = readFileSync(join(raiz, ruta));
  const tipo = ruta.endsWith('.png') ? 'png' : 'jpg';
  const [w, h] = tamano(buf, tipo);
  const ancho = Math.min(anchoMax, w), alto = Math.round((h / w) * ancho);
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 60 }, keepNext: true, children: [new ImageRun({ type: tipo, data: buf, transformation: { width: ancho, height: alto } })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 220 }, children: enLinea(pie, { size: 18, italics: true, color: SUAVE }) }),
  ];
}
function pendiente(texto) {
  return new Paragraph({
    spacing: { before: 80, after: 160 },
    shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'FBF4E6' },
    border: { left: { style: BorderStyle.SINGLE, size: 18, color: 'A8690F', space: 8 } },
    children: [new TextRun({ text: 'Captura pendiente: ', bold: true, color: 'A8690F' }), ...enLinea(texto)],
  });
}

// ---------- contenido
const hoy = '30 de octubre de 2026';
const bloques = [];

// Portada
bloques.push(
  new Paragraph({ spacing: { before: 2400, after: 200 }, children: [new TextRun({ text: 'Taller Harness Engineering', color: VERDE, bold: true, size: 26 })] }),
  new Paragraph({ spacing: { after: 300 }, children: [new TextRun({ text: 'Una foto de la báscula se vuelve un pesaje confirmado', bold: true, size: 56, color: TINTA })] }),
  new Paragraph({ spacing: { after: 600 }, children: [new TextRun({ text: 'Arnés de IA para los reportes de campo de Finca Santa Rita (Badillo, Cesar)', size: 28, color: SUAVE })] }),
  p('**Equipo:** Andrea Urdaneta, Juan Andrés Lacouture y Andrés Sánchez'),
  p('**Curso:** Gerencia de TI, Universidad de La Sabana, 2026-2'),
  p(`**Fecha:** ${hoy}`),
  p('**Bot de prueba:** [t.me/santarita_campo_prueba_bot](https://t.me/santarita_campo_prueba_bot)'),
  p('**Código y archivos del arnés:** [github.com/andreaurro24/Santa-Rita-App-1, carpeta taller-harness](https://github.com/andreaurro24/Santa-Rita-App-1/tree/main/taller-harness)'),
  new Paragraph({ spacing: { before: 500 }, children: [new TextRun({ text: 'Contenido', bold: true, color: VERDE, size: 24 })] }),
  ...['1. Resumen', '2. Canvas del arnés con justificación', '3. Versión funcional: cómo probarla, capturas, instrucciones, skills y verificaciones', '4. Bitácora de pruebas', '5. Reflexión'].map((t) => p(t, { par: { spacing: { after: 60 } } })),
);

// 1. Resumen
bloques.push(
  h1('1. Resumen'),
  p('Cada mes, el administrador de Finca Santa Rita pesa unas 140 reses y anota los pesos en una planilla de papel. Después alguien los digita en la app de la finca. Un peso en la res equivocada daña la ganancia diaria calculada y, con ella, la recomendación de cuándo vender: en la última venta la finca perdió cerca del 10 % del valor.'),
  p('Construimos un **arnés** alrededor de un agente de IA: el administrador manda la foto de la planilla por Telegram, Claude la lee, un validador con reglas fijas la revisa contra el censo, otro agente redacta las dudas y **una persona distinta a quien envió confirma**. Solo entonces la base de datos carga los pesajes. La idea que guía todo: **la IA propone, las reglas verifican y una persona decide**.'),
  p('**Resultados.** Sin arnés, la IA acertó 3 de 6 casos base; con el arnés, 6 de 6, y con el arnés mejorado, 9 de 9 casos sin ninguna corrección a mano. En ninguna etapa hubo pesos inventados ni asignados a la res equivocada. En la prueba en vivo por Telegram (30 de octubre) se cargaron 17 pesajes y la base bloqueó todos los intentos indebidos: remitentes sin permiso, autoconfirmación, dudosos pendientes y reportes duplicados.'),
);

// 2. Canvas
bloques.push(h1('2. Canvas del arnés con justificación'), ...markdown(leer('entrega/canvas.md'), { nivelBase: 2 }));

// 3. Versión funcional
const cap = (f) => `entrega/capturas/${f}`;
const img = (f) => `entrega/presentacion/img/${f}`;
bloques.push(
  h1('3. Versión funcional'),
  p('La versión funcional corre en **Telegram + n8n + Supabase**, con el mismo arnés que se probó en Claude Code. Usa datos simulados: 24 novillos en 3 lotes, nunca datos reales de la finca.'),
  h2('3.1 Cómo probarla'),
  vineta('Abrir el bot [@santarita_campo_prueba_bot](https://t.me/santarita_campo_prueba_bot) en Telegram y pulsar **Iniciar**.'),
  vineta('El bot **solo responde a personas autorizadas**. Si alguien sin permiso le escribe, no contesta y el intento queda en la bitácora: es uno de los guardarraíles. Para probarlo, escríbale "hola", envíenos su nombre y lo registramos en un minuto.'),
  vineta('Mandar una foto de planilla. En el repositorio hay 9 casos de prueba en `taller-harness/casos/` (por ejemplo `caso-2/planilla.jpg`, que trae un animal que no existe).'),
  vineta('El bot responde con un resumen y tres botones: **Confirmar**, **Confirmar sin los dudosos** y **Rechazar**. Quien envió no puede confirmar: debe hacerlo otra persona autorizada, por eso la prueba completa se hace en un grupo.'),
  h2('3.2 Arquitectura'),
  ...markdown(`| Pieza | Herramienta | Qué hace |
|---|---|---|
| Canal | Telegram | Recibe la foto o el mensaje y muestra el resumen con los botones |
| Orquestación | n8n Cloud | Un solo flujo de 38 nodos: reparte mensajes y botones, llama a Claude, corre el validador y escribe en la base |
| Extractor y revisor | Claude (API de Anthropic) | Lee la planilla con las instrucciones y skills del arnés; el revisor redacta las preguntas de los dudosos |
| Validador | Código JavaScript | Las reglas V1 a V10, el mismo código de \`arnes/validador.mjs\` (24 pruebas automáticas) |
| Base y guardarraíles | Supabase (Postgres) | Rol \`arnes_campo\` sin permiso sobre los pesajes; funciones que exigen confirmación de otra persona, sin dudosos y sin duplicados |`, { saltarTitulo: false }),
  h2('3.3 Capturas'),
  ...imagen(cap('n8n-flujo.jpg'), 'Figura 1. El flujo en n8n: un disparador de Telegram recibe fotos y botones (captura del 30 de octubre).'),
  ...imagen(cap('n8n-nodo-armar-respuesta.png'), 'Figura 2. Nodo "Armar respuesta" en n8n, corregido durante la prueba en vivo para mostrar el motivo real de cada bloqueo.'),
  ...imagen(img('planilla-caso2.jpg'), 'Figura 3. Planilla del caso 2 enviada al grupo. La fila 209 no existe en el censo.', 300),
  pendiente('chat de Telegram con el resumen del bot y los botones (caso 2).'),
  pendiente('los mensajes de bloqueo: "Quien envió el reporte no puede confirmarlo" y "Quedan 1 dudosos sin resolver".'),
  pendiente('el mensaje "Listo: se cargaron 7 registros en la app".'),
  p('Mientras se agregan, estas imágenes recrean el chat con los mensajes exactos que respondió el bot (tomados de la bitácora de la base):', { run: { italics: true, color: SUAVE } }),
  ...imagen(img('demo-respuesta.png'), 'Figura 4. Recreación: resumen del bot con la pregunta por la 0209 y los botones.', 300),
  ...imagen(img('demo-bloqueos.png'), 'Figura 5. Recreación: los dos intentos bloqueados por la base de datos.', 300),
  ...imagen(img('demo-cargado.png'), 'Figura 6. Recreación: otra persona confirma sin los dudosos y se cargan 7 pesajes.', 300),
  ...imagen(cap('evidencia-base.png'), 'Figura 7. Evidencia en Supabase: borradores, bitácora y los 17 pesajes cargados, cada uno con su borrador de origen.', 520),
  pendiente('la app de la finca mostrando el pesaje del 27/10 de un animal (por ejemplo la 0201).'),
  h2('3.4 Instrucciones del agente'),
  p('Archivo `contexto/instrucciones.md`. Es la guía principal del extractor; cabe en una página.', { run: { color: SUAVE } }),
  ...markdown(leer('contexto/instrucciones.md'), { nivelBase: 3 }),
  h2('3.5 Skills'),
  ...['leer-jornada-pesaje', 'leer-evento-sanidad', 'explicar-dudoso'].flatMap((s) => [h3(`Skill ${s}`), ...markdown(leer(`skills/${s}/SKILL.md`), { nivelBase: 4 })]),
  h2('3.6 Verificaciones'),
  p('Lo que se puede comprobar con una regla fija lo comprueba código, no el modelo. Estas reglas las aplica `arnes/validador.mjs` (24 pruebas con `node --test`), el mismo código que corre dentro de n8n.', { run: { color: SUAVE } }),
  ...markdown(leer('contexto/reglas.md'), { nivelBase: 3 }),
  p('Además, la base de datos aplica guardias que el modelo no puede saltarse: el rol del flujo no tiene permiso sobre las tablas de la app, y la única puerta es una función que exige un borrador confirmado por otra persona autorizada, sin dudosos pendientes y sin pesajes repetidos. Antes de aplicarlas en Supabase se probaron en un Postgres embebido: 9 de 9 bloqueos.'),
);

// 4. Bitácora y 5. Reflexión
bloques.push(h1('4. Bitácora de pruebas'), ...markdown(leer('entrega/bitacora-pruebas.md'), { nivelBase: 2 }));
bloques.push(h1('5. Reflexión'), ...markdown(leer('entrega/reflexion.md'), { nivelBase: 2 }));

// ---------- documento
const doc = new Document({
  creator: 'Equipo Santa Rita',
  title: 'Taller Harness Engineering: Finca Santa Rita',
  styles: {
    default: { document: { run: { font: 'Calibri', size: 22, color: '2B3A30' }, paragraph: { spacing: { line: 288 } } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 40, bold: true, color: TINTA }, paragraph: { spacing: { after: 240 }, border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: REGLA, space: 6 } }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 30, bold: true, color: VERDE }, paragraph: { spacing: { before: 320, after: 140 }, keepNext: true, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 25, bold: true, color: TINTA }, paragraph: { spacing: { before: 240, after: 100 }, keepNext: true, outlineLevel: 2 } },
      { id: 'Heading4', name: 'Heading 4', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 22, bold: true, color: SUAVE }, paragraph: { spacing: { before: 180, after: 80 }, keepNext: true, outlineLevel: 3 } },
    ],
  },
  numbering: {
    config: [
      { reference: 'vinetas', levels: [
        { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 260 } } } },
        { level: 1, format: LevelFormat.BULLET, text: '–', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 260 } } } },
      ] },
      { reference: 'numeros', levels: [
        { level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 300 } } } },
      ] },
    ],
  },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
    footers: { default: new Footer({ children: [new Paragraph({
      tabStops: [{ type: TabStopType.RIGHT, position: ANCHO }],
      children: [new TextRun({ text: 'Taller Harness Engineering · Finca Santa Rita', size: 16, color: SUAVE }), new TextRun({ children: ['\t', PageNumber.CURRENT], size: 16, color: SUAVE })],
    })] }) },
    children: bloques,
  }],
});

const salida = join(raiz, 'entrega', 'Entrega-Taller-Harness-Santa-Rita.docx');
writeFileSync(salida, await Packer.toBuffer(doc));
console.log('Documento listo:', salida, existsSync(salida));
