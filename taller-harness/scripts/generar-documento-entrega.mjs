// Arma el documento de entrega en Word (entrega/Entrega-Taller-Harness-Santa-Rita.docx) a partir de
// los mismos textos del repo: canvas, instrucciones, reglas, skills, bitácora y reflexión, más las
// capturas. Sigue el formato del documento del proyecto de Gerencia de TI: portada de La Sabana,
// Times New Roman 12 justificado, títulos numerados, tabla de contenido y pies de figura centrados.
// Requiere la librería docx de npm, que NO es dependencia del proyecto: instálala en una carpeta
// aparte y apúntala con NODE_PATH.  Ejemplo:
//   npm i docx@9.5.1 --prefix C:/tmp/word
//   NODE_PATH=C:/tmp/word/node_modules node taller-harness/scripts/generar-documento-entrega.mjs
// La tabla de contenido queda como campo de Word: se actualiza al abrir el archivo (o con F9).
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(join(process.env.NODE_PATH ?? '.', 'x.js'));
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, ShadingType,
  ImageRun, AlignmentType, BorderStyle, LevelFormat, ExternalHyperlink, Footer, PageNumber, TableOfContents,
} = require('docx');

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (p) => readFileSync(join(raiz, p), 'utf8').replace(/\r/g, '');
const FUENTE = 'Times New Roman';
const NEGRO = '000000', BORDE = 'BFBFBF', ENCABEZADO = 'EDE7DB', AZUL = '0F4761', AMBAR = 'A8690F';
const ANCHO = 9360; // carta con márgenes de 1 pulgada, en DXA

// ---------- numeración de títulos (1., 1.1., 1.1.1.)
const contador = [0, 0, 0, 0];
function titulo(nivel, texto, extra = {}) {
  contador[nivel - 1]++;
  for (let k = nivel; k < 4; k++) contador[k] = 0;
  const num = contador.slice(0, nivel).join('.') + '.';
  const heading = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4][nivel - 1];
  return new Paragraph({ heading, ...extra, children: enLinea(`${num} ${texto.replace(/^\d+(\.\d+)*\.?\s+/, '')}`) });
}

// ---------- texto en línea: **negrita**, `código` y [enlace](url)
function enLinea(texto, base = {}) {
  const partes = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let i = 0, m;
  while ((m = re.exec(texto))) {
    if (m.index > i) partes.push(new TextRun({ text: texto.slice(i, m.index), ...base }));
    const t = m[0];
    if (t.startsWith('**')) partes.push(...enLinea(t.slice(2, -2), { ...base, bold: true }));
    else if (t.startsWith('`')) partes.push(new TextRun({ text: t.slice(1, -1), ...base, font: 'Consolas', size: Math.max((base.size ?? 24) - 4, 16) }));
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

// ---------- tabla con bordes finos y encabezado beige, como en el documento del proyecto
function tabla(filas) {
  const n = filas[0].length;
  const largos = Array.from({ length: n }, (_, c) => Math.max(...filas.map((f) => (f[c] ?? '').replace(/[*`]/g, '').length)));
  const peso = largos.map((l) => Math.max(8, Math.min(l, 90)));
  const total = peso.reduce((a, b) => a + b, 0);
  const anchos = peso.map((p) => Math.floor((p / total) * ANCHO));
  anchos[n - 1] += ANCHO - anchos.reduce((a, b) => a + b, 0);
  const borde = { style: BorderStyle.SINGLE, size: 4, color: BORDE };
  return new Table({
    width: { size: ANCHO, type: WidthType.DXA },
    columnWidths: anchos,
    rows: filas.map((f, r) => new TableRow({
      tableHeader: r === 0,
      children: anchos.map((w, c) => new TableCell({
        width: { size: w, type: WidthType.DXA },
        shading: r === 0 ? { type: ShadingType.CLEAR, color: 'auto', fill: ENCABEZADO } : undefined,
        borders: { top: borde, bottom: borde, left: borde, right: borde },
        margins: { top: 60, bottom: 60, left: 100, right: 100 },
        children: [new Paragraph({ alignment: AlignmentType.LEFT, spacing: { after: 0, line: 240 }, children: enLinea(f[c] ?? '', { size: 20, bold: r === 0 || undefined }) })],
      })),
    })),
  });
}

// ---------- markdown sencillo del repo → bloques de Word (los títulos se numeran solos)
let listaNum = 0;
function markdown(md, { nivelBase = 2, saltarTitulo = true, omitir = [] } = {}) {
  md = md.replace(/^---\n[\s\S]*?\n---\n/, '');
  const lineas = md.split('\n');
  const out = [];
  let parrafo = [];
  const cerrarParrafo = () => {
    if (parrafo.length) out.push(new Paragraph({ children: enLinea(parrafo.join(' ')) }));
    parrafo = [];
  };
  let primerTitulo = true;
  let saltando = 0; // nivel del subtema omitido, 0 si no se omite nada
  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i];
    const h = l.match(/^(#{1,4})\s+(.*)/);
    if (saltando && !(h && h[1].length <= saltando)) continue;
    saltando = 0;
    if (h && omitir.some((o) => h[2].replace(/^\d+\.\s*/, '').startsWith(o))) { cerrarParrafo(); saltando = h[1].length; continue; }
    if (!l.trim()) { cerrarParrafo(); continue; }
    if (h) {
      cerrarParrafo();
      if (saltarTitulo && primerTitulo && h[1].length === 1) { primerTitulo = false; continue; }
      primerTitulo = false;
      out.push(titulo(Math.min(h[1].length - 2 + nivelBase, 4), h[2]));
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
      out.push(new Paragraph({ children: enLinea(texto, { italics: true }), indent: { left: 567, right: 567 } }));
      continue;
    }
    parrafo.push(l.trim());
  }
  cerrarParrafo();
  return out;
}

// ---------- piezas
const p = (texto, extra = {}) => new Paragraph({ children: enLinea(texto, extra.run ?? {}), ...extra.par });
const vineta = (t) => new Paragraph({ numbering: { reference: 'vinetas', level: 0 }, spacing: { after: 80 }, children: enLinea(t) });
const centrado = (texto, run = {}, spacing = {}) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0, ...spacing }, children: [new TextRun({ text: texto, ...run })] });
const vacio = (n = 1) => Array.from({ length: n }, () => new Paragraph({ spacing: { after: 0 }, children: [] }));

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
let figura = 0;
function imagen(ruta, pie, anchoMax = 600) {
  const buf = readFileSync(join(raiz, ruta));
  const tipo = ruta.endsWith('.png') ? 'png' : 'jpg';
  const [w, h] = tamano(buf, tipo);
  const ancho = Math.min(anchoMax, w), alto = Math.round((h / w) * ancho);
  figura++;
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 60 }, keepNext: true, children: [new ImageRun({ type: tipo, data: buf, transformation: { width: ancho, height: alto } })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: enLinea(`Figura ${figura}. ${pie}`, { size: 22 }) }),
  ];
}
function pendiente(texto) {
  return new Paragraph({
    spacing: { before: 80, after: 160 },
    shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'FBF4E6' },
    border: { left: { style: BorderStyle.SINGLE, size: 18, color: AMBAR, space: 8 } },
    children: [new TextRun({ text: 'Captura pendiente: ', bold: true, color: AMBAR }), ...enLinea(texto)],
  });
}

// ---------- portada: igual a la del documento del proyecto de Gerencia de TI
const logo = readFileSync(join(raiz, 'entrega', 'recursos', 'logo-sabana.jpg'));
const portada = [
  new Paragraph({ spacing: { after: 0 }, children: [new ImageRun({ type: 'jpg', data: logo, transformation: { width: 250, height: 99 } })] }),
  ...vacio(6),
  centrado('Taller Harness Engineering: arnés de IA para los reportes de campo', { bold: true }, { after: 360 }),
  centrado('Finca Santa Rita', { bold: true }),
  ...vacio(5),
  centrado('Andrea Paola Urdaneta Rosales (314077)', {}, { after: 360 }),
  centrado('Juan Andrés Lacouture Daza (310338)', {}, { after: 360 }),
  centrado('Andres Felipe Sanchez Garcia (312803)'),
  ...vacio(9),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [
    new TextRun({ text: 'Facultad de ingeniería – Universidad de La Sabana ', bold: true }),
    new TextRun({ text: '𓅥', font: 'Segoe UI Historic' }),
  ] }),
  centrado('', {}),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [new TextRun({ text: 'PROFESOR: ', bold: true }), new TextRun({ text: 'Mateo Andrés Barón' })] }),
  centrado('Octubre de 2026', { bold: true }),
];

// ---------- contenido
const bloques = [
  new Paragraph({ pageBreakBefore: true, spacing: { after: 120 }, children: [new TextRun({ text: 'Contenido', color: AZUL, size: 32, font: 'Aptos' })] }),
  new TableOfContents('Contenido', { hyperlink: true, headingStyleRange: '1-3' }),
];

// 1. Resumen
bloques.push(
  titulo(1, 'Resumen', { pageBreakBefore: true }),
  p('Cada mes, el administrador de Finca Santa Rita pesa unas 140 reses y anota los pesos en una planilla de papel. Después alguien los digita en la app de la finca. Un peso en la res equivocada daña la ganancia diaria calculada y, con ella, la recomendación de cuándo vender: en la última venta la finca perdió cerca del 10 % del valor.'),
  p('Construimos un **arnés** alrededor de un agente de IA: el administrador manda la foto de la planilla por Telegram, Claude la lee, un validador con reglas fijas la revisa contra el censo, otro agente redacta las dudas y **una persona distinta a quien envió confirma**. Solo entonces la base de datos carga los pesajes. La idea que guía todo: **la IA propone, las reglas verifican y una persona decide**.'),
  p('Sin arnés, la IA acertó 3 de 6 casos base; con el arnés, 6 de 6, y con el arnés mejorado, 9 de 9 casos sin ninguna corrección a mano. En ninguna etapa hubo pesos inventados ni asignados a la res equivocada. En la prueba en vivo por Telegram (30 de octubre de 2026) se cargaron 17 pesajes y la base bloqueó todos los intentos indebidos: remitentes sin permiso, autoconfirmación, dudosos pendientes y reportes duplicados.'),
  p('**Bot de prueba:** [t.me/santarita_campo_prueba_bot](https://t.me/santarita_campo_prueba_bot)', { par: { alignment: AlignmentType.LEFT, spacing: { after: 40 } } }),
  p('**Código y archivos del arnés:** [github.com/andreaurro24/Santa-Rita-App-1, carpeta taller-harness](https://github.com/andreaurro24/Santa-Rita-App-1/tree/main/taller-harness)', { par: { alignment: AlignmentType.LEFT } }),
);

// 2. Canvas
bloques.push(titulo(1, 'Canvas del arnés con justificación'), ...markdown(leer('entrega/canvas.md'), { nivelBase: 2, omitir: ['Plataforma elegida'] }));

// 3. Versión funcional
const cap = (f) => `entrega/capturas/${f}`;
const img = (f) => `entrega/presentacion/img/${f}`;
bloques.push(
  titulo(1, 'Versión funcional', { pageBreakBefore: true }),
  p('La versión funcional corre en **Telegram + n8n + Supabase**, con el mismo arnés que se probó en Claude Code. Usa datos simulados: 24 novillos en 3 lotes, nunca datos reales de la finca.'),
  titulo(2, 'Cómo probarla'),
  vineta('Abrir [@santarita_campo_prueba_bot](https://t.me/santarita_campo_prueba_bot) en Telegram y escribirle "hola". El bot **solo responde a personas autorizadas**: el intento queda en la bitácora y lo registramos en un minuto.'),
  vineta('Mandar una foto de planilla; hay 9 casos en `taller-harness/casos/` (por ejemplo `caso-2/planilla.jpg`, que trae un animal que no existe).'),
  vineta('El bot responde con un resumen y los botones **Confirmar**, **Confirmar sin los dudosos** y **Rechazar**. Confirma otra persona autorizada, por eso la prueba completa se hace en un grupo.'),
  titulo(2, 'Arquitectura'),
  ...markdown(`| Pieza | Herramienta | Qué hace |
|---|---|---|
| Canal | Telegram | Recibe la foto o el mensaje y muestra el resumen con los botones |
| Orquestación | n8n Cloud | Un flujo de 38 nodos: reparte mensajes y botones, llama a Claude, corre el validador y escribe en la base |
| Extractor y revisor | Claude (API de Anthropic) | Lee la planilla con las instrucciones y skills; el revisor redacta las preguntas de los dudosos |
| Validador | Código JavaScript | Reglas V1 a V10, el mismo código de \`arnes/validador.mjs\` (24 pruebas automáticas) |
| Base y guardarraíles | Supabase (Postgres) | Rol sin permiso sobre los pesajes; solo carga lo confirmado por otra persona, sin dudosos ni duplicados |`, { saltarTitulo: false }),
  titulo(2, 'Capturas'),
  ...imagen(cap('n8n-flujo.jpg'), 'Flujo en n8n: un disparador de Telegram recibe fotos y botones.', 520),
  ...imagen(img('planilla-caso2.jpg'), 'Planilla del caso 2 enviada al grupo. La fila 209 no existe en el censo.', 220),
  ...imagen(cap('evidencia-base.png'), 'Evidencia en Supabase: borradores, bitácora y los 17 pesajes cargados, cada uno con su borrador de origen.', 430),
  pendiente('chat de Telegram con el resumen y los botones; los dos bloqueos ("Quien envió el reporte no puede confirmarlo" y "Quedan 1 dudosos sin resolver"); el mensaje "Listo: se cargaron 7 registros en la app"; y la app con el pesaje del 27/10.'),
  titulo(2, 'Instrucciones del agente'),
  p('El extractor recibe la foto o el mensaje, la fecha, el censo y el glosario, y entrega **solo un borrador en JSON**: no guarda nada. Sus reglas de oro (`contexto/instrucciones.md`):'),
  ...[
    '**No inventar:** lo que no se lee con seguridad va a ilegibles, con su motivo.',
    '**Copiar lo que ve:** cada registro guarda el texto original de la planilla.',
    '**Número interno de 4 dígitos**, sin cambiarlo por uno parecido del censo; si la planilla usa chapeta, la copia y el validador busca el animal.',
    '**La fecha es la del pesaje**, no la del mensaje.',
    '**Marcar la confianza** de cada fila: alta, media o baja.',
    '**Un evento para todo un lote** se escribe una vez; el validador saca los animales del censo.',
    '**No revisar reglas:** variación de peso, duplicados y fechas los revisa el validador.',
  ].map((t, k) => new Paragraph({ numbering: { reference: 'numeros', level: 0, instance: 900 }, spacing: { after: 60 }, children: enLinea(t) })),
  p('Nunca borra ni edita registros, ni habla de ventas, precios o contratos "Al partir".', { par: { spacing: { before: 120 } } }),
  titulo(2, 'Skills'),
  ...markdown(`| Skill | Cuándo se usa | Qué hace |
|---|---|---|
| \`leer-jornada-pesaje\` | El reporte es una foto de planilla o filas "número – peso" | Encabezado (lote y fecha), una fila por animal con su confianza, ilegibles aparte |
| \`leer-evento-sanidad\` | El mensaje habla de vacunar, purgar, bañar o tratar | Tipo, producto y fecha de cada evento; un lote completo se escribe una sola vez |
| \`explicar-dudoso\` | En el revisor, solo para dudosos e ilegibles | Explica en lenguaje simple por qué quedó en duda y qué debe responder el administrador |`, { saltarTitulo: false }),
  titulo(2, 'Verificaciones'),
  p('Lo que se puede comprobar con una regla fija lo comprueba código, no el modelo: `arnes/validador.mjs`, con 24 pruebas automáticas, el mismo código que corre en n8n.'),
  ...markdown(leer('contexto/reglas.md'), { nivelBase: 3 }).slice(1),
  p('La base de datos agrega guardias que el modelo no puede saltarse: el rol del flujo no puede escribir en las tablas de la app y la única puerta exige un borrador confirmado por otra persona, sin dudosos ni pesajes repetidos (9 de 9 bloqueos probados).'),
);

// 4. Bitácora y 5. Reflexión
bloques.push(titulo(1, 'Bitácora de pruebas', { pageBreakBefore: true }), ...markdown(leer('entrega/bitacora-pruebas.md'), { nivelBase: 2, omitir: ['Cómo se corrió cada etapa', 'Otros hallazgos', 'Métricas de la corrida'] }));
bloques.push(titulo(1, 'Reflexión', { pageBreakBefore: true }), ...markdown(leer('entrega/reflexion.md'), { nivelBase: 2 }));

// ---------- documento
const tituloEstilo = (id, name, nivel, size, antes) => ({
  id, name, basedOn: 'Normal', next: 'Normal', quickFormat: true,
  run: { font: FUENTE, size, bold: true, color: NEGRO },
  paragraph: { alignment: AlignmentType.LEFT, spacing: { before: antes, after: 120 }, keepNext: true, outlineLevel: nivel },
});
const doc = new Document({
  creator: 'Equipo Santa Rita',
  title: 'Taller Harness Engineering: Finca Santa Rita',
  features: { updateFields: true },
  styles: {
    default: { document: { run: { font: FUENTE, size: 24, color: NEGRO }, paragraph: { alignment: AlignmentType.JUSTIFIED, spacing: { after: 160, line: 264 } } } },
    paragraphStyles: [
      tituloEstilo('Heading1', 'Heading 1', 0, 26, 240),
      tituloEstilo('Heading2', 'Heading 2', 1, 24, 240),
      tituloEstilo('Heading3', 'Heading 3', 2, 24, 200),
      tituloEstilo('Heading4', 'Heading 4', 3, 24, 160),
    ],
  },
  numbering: {
    config: [
      { reference: 'vinetas', levels: [
        { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
        { level: 1, format: LevelFormat.BULLET, text: 'o', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1440, hanging: 360 } } } },
      ] },
      { reference: 'numeros', levels: [
        { level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
      ] },
    ],
  },
  sections: [{
    properties: { titlePage: true, page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
    footers: {
      first: new Footer({ children: [new Paragraph({ children: [] })] }),
      default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ children: [PageNumber.CURRENT], size: 20 })] })] }),
    },
    children: [...portada, ...bloques],
  }],
});

const salida = join(raiz, 'entrega', 'Entrega-Taller-Harness-Santa-Rita.docx');
writeFileSync(salida, await Packer.toBuffer(doc));
console.log('Documento listo:', salida);
